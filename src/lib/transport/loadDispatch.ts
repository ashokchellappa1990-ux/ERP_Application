import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { writeAudit, type AuditActor } from "@/lib/audit/log";
import { createDispatch, postDispatch, loadRequestForDispatch } from "@/lib/warehouse/dispatch";
import { postMovement, consumeLots } from "@/lib/inventory/ledger";
import { createSaleTx, type PreparedSale } from "@/lib/sales/createSale";
import { getDispatchConfig } from "@/lib/settings/dispatchConfig";
import type { TerminalStamp } from "@/lib/pos/terminalContext";
import type { LoadDispatchItemDto } from "@/lib/contracts/loadDispatch";

/**
 * Load & Dispatch — the single warehouse-execution screen. Absorbs the old
 * Dispatch Execution + Loading Confirmation screens; Stock Transfer Dispatch
 * is no longer a user-facing screen — for docType=StockTransfer this engine
 * creates the backing StockTransferDispatch row internally (reusing the
 * EXISTING createDispatch()/loadRequestForDispatch() from
 * src/lib/warehouse/dispatch.ts, no reimplementation) and calls the EXISTING
 * postDispatch() at completion — the actual stock+GL movement is untouched.
 * For Customer dispatches, Complete Load & Dispatch itself reduces stock
 * (reusing the same postMovement()/consumeLots() primitives everything else
 * in the app uses — src/lib/inventory/ledger.ts) since goods physically leave
 * the warehouse the moment loading is complete, not whenever an invoice
 * eventually posts. An explicit "Delivery Challan" click then creates a
 * DeliveryChallan and, per Dispatch Configuration's posting method, calls the
 * EXISTING createSaleTx() (src/lib/sales/createSale.ts) with
 * skipInventoryMovement so that already-moved stock is never moved twice —
 * this engine never posts GL itself for any docType.
 */

type Actor = AuditActor & { fullName?: string | null };
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const r3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

const DOC_PREFIX: Record<string, string> = {
  Customer: "LD", StockTransfer: "LD-ST", PurchaseReturn: "LD-PR", SalesReturnPickup: "LD-SR",
  ProductionTransfer: "LD-PT", JobWork: "LD-JW", Others: "LD-OT",
};

async function assignDispatchNo(tx: Prisma.TransactionClient, docType: string, id: number) {
  const prefix = DOC_PREFIX[docType] ?? "LD";
  const dispatchNo = `${prefix}-${String(id).padStart(5, "0")}`;
  await tx.loadDispatch.update({ where: { id }, data: { dispatchNo } });
  return dispatchNo;
}

/** Best-effort: find an existing Vehicle Gate Entry already raised for this
 * reference, so Section 3 (Transport Info) can auto-load without the user
 * re-entering it. Not required — a Load & Dispatch can be drafted before any
 * gate entry exists. */
async function findLinkedGateEntry(tenantId: number, dispatchType: string, referenceNo: string | null) {
  if (!referenceNo) return null;
  return prisma.vehicleGateEntry.findFirst({
    where: { tenantId, dispatchType, referenceNo, deletedAt: null },
    orderBy: { id: "desc" },
  });
}

/* --------------------------------------------------- Sales-Order based load */
export interface LoadFromSalesOrderInput { salesOrderId: number; dispatchDate: string; warehouse?: string | null }

export async function loadFromSalesOrder(scope: ActiveScope, user: Actor, input: LoadFromSalesOrderInput) {
  const so = await prisma.salesDocument.findFirst({
    where: { id: input.salesOrderId, tenantId: scope.tenantId, docType: "order" },
    include: { items: true },
  });
  if (!so) throw new Error("Sales Order not found.");
  const remaining = so.items.filter((it) => num(it.qty) - num(it.deliveredQty) > 0.001);
  if (!remaining.length) throw new Error("This Sales Order has nothing left to dispatch.");

  const totalQty = remaining.reduce((s, it) => s + (num(it.qty) - num(it.deliveredQty)), 0);
  const totalValue = remaining.reduce((s, it) => {
    const lineRemaining = num(it.qty) - num(it.deliveredQty);
    const unitValue = num(it.qty) > 0 ? num(it.lineValue) / num(it.qty) : 0;
    return s + lineRemaining * unitValue;
  }, 0);

  const gateEntry = await findLinkedGateEntry(scope.tenantId, "Customer", so.docNo);

  const id = await prisma.$transaction(async (tx) => {
    const doc = await tx.loadDispatch.create({
      data: {
        tenantId: scope.tenantId, businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined,
        dispatchNo: "TMP", dispatchDate: input.dispatchDate, docType: "Customer",
        sourceRefType: "SALES_ORDER", sourceRefId: so.id, sourceRefNo: so.docNo,
        partyType: "Customer", partyId: so.customerId ?? undefined, partyName: so.customerName ?? undefined,
        deliveryAddress: so.deliveryAddress ?? undefined, warehouse: input.warehouse ?? so.warehouse ?? undefined,
        vehicleGateEntryId: gateEntry?.id ?? undefined,
        transportCompanyId: gateEntry?.transportCompanyId ?? undefined, vehicleId: gateEntry?.vehicleId ?? undefined,
        vehicleType: gateEntry?.vehicleType ?? undefined, driverName: gateEntry?.driverName ?? undefined,
        driverMobile: gateEntry?.driverMobile ?? undefined, driverLicenseNo: gateEntry?.driverLicenseNo ?? undefined,
        status: "Draft", totalProducts: remaining.length, totalQty: r3(totalQty), totalPackages: 0,
        createdBy: user.id, createdByName: user.fullName ?? undefined,
        items: {
          create: remaining.map((it) => {
            const lineRemaining = num(it.qty) - num(it.deliveredQty);
            const unitRate = num(it.qty) > 0 ? num(it.rate) : 0;
            return {
              tenantId: scope.tenantId, productId: it.productId ?? 0, productName: it.productName, sku: it.sku,
              uom: it.uom, allocatedQty: lineRemaining, dispatchedQty: lineRemaining, pendingQty: 0,
              rate: unitRate, value: r2(lineRemaining * unitRate),
            };
          }),
        },
      },
      select: { id: true },
    });
    await assignDispatchNo(tx, "Customer", doc.id);
    return doc.id;
  }, { maxWait: 10_000, timeout: 30_000 });
  await writeAudit(prisma, user, { action: "load_dispatch.create", entity: "LoadDispatch", entityId: id, summary: `Loaded Customer dispatch from Sales Order ${so.docNo}`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
  return { id };
}

/* ----------------------------------------------- Direct customer dispatch */
export interface DirectDispatchItemInput {
  productId: number; productName?: string; sku?: string | null; uom?: string | null; batchNo?: string | null;
  dispatchedQty: number; rate?: number | null; discPct?: number | null; discAmount?: number; taxPct?: number | null;
  remarks?: string | null;
}
export interface PaymentCollectionInput {
  paymentMode: "Full" | "Partial" | "Credit"; paymentAmount?: number | null; paymentMethod?: string | null;
  bankId?: number | null; bankName?: string | null; bankAccount?: string | null;
}
export interface DirectCustomerDispatchInput {
  dispatchDate: string; customerId?: number | null; customerName?: string | null; deliveryAddress?: string | null;
  warehouse?: string | null;
  vehicleGateEntryId?: number | null; transportCompanyId?: number | null; vehicleId?: number | null; vehicleType?: string | null;
  driverName?: string | null; driverMobile?: string | null; driverLicenseNo?: string | null;
  helperName?: string | null; helperMobile?: string | null; sealNumber?: string | null;
  payment?: PaymentCollectionInput;
  remarks?: string | null; items: DirectDispatchItemInput[];
}

export async function createDirectCustomerDispatch(scope: ActiveScope, user: Actor, input: DirectCustomerDispatchInput) {
  const cfg = await getDispatchConfig(user);
  if (!cfg.flags.allowDirectCustomerDispatch || !cfg.flags.allowDispatchWithoutSalesOrder) {
    throw new Error("Direct customer dispatch (without a Sales Order) is disabled in Dispatch Configuration.");
  }
  if (!input.items.length) throw new Error("Add at least one item.");

  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const prods = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: scope.tenantId }, select: { id: true, name: true, sku: true, baseUom: true, gstRate: true } });
  const byId = new Map(prods.map((p) => [p.id, p]));
  if (prods.length !== productIds.length) throw new Error("One or more items are not in your catalog.");

  // Auto-load Transport Info from the linked Vehicle Gate Entry when given,
  // used as a fallback for whichever fields the client didn't already send
  // (the client typically pre-fills these itself, but this keeps the server
  // authoritative if the client omits them).
  const gateEntry = input.vehicleGateEntryId
    ? await prisma.vehicleGateEntry.findFirst({ where: { id: input.vehicleGateEntryId, tenantId: scope.tenantId } })
    : null;

  let totalQty = 0, totalValue = 0;
  const items = input.items.map((i) => {
    const p = byId.get(i.productId)!;
    const qty = r3(Number(i.dispatchedQty) || 0);
    const rate = i.rate != null ? Number(i.rate) : 0;
    const gross = r2(qty * rate);
    const discPct = i.discPct != null ? Number(i.discPct) : null;
    const discAmount = i.discAmount != null ? r2(Number(i.discAmount)) : discPct ? r2(gross * (discPct / 100)) : 0;
    const taxableValue = r2(Math.max(0, gross - discAmount));
    const taxPct = i.taxPct != null ? Number(i.taxPct) : Number(String(p.gstRate ?? "0").replace(/[^0-9.]/g, "")) || null;
    const taxAmount = taxPct ? r2(taxableValue * (taxPct / 100)) : 0;
    const value = r2(taxableValue + taxAmount);
    totalQty += qty; totalValue += value;
    return {
      tenantId: scope.tenantId, productId: i.productId, productName: i.productName || p.name, sku: i.sku ?? p.sku,
      uom: i.uom ?? p.baseUom, batchNo: i.batchNo ?? undefined, allocatedQty: qty, dispatchedQty: qty, pendingQty: 0,
      rate, discPct: discPct ?? undefined, discAmount, taxPct: taxPct ?? undefined, taxableValue, taxAmount, value,
      remarks: i.remarks ?? undefined,
    };
  });

  const payment = input.payment;
  const id = await prisma.$transaction(async (tx) => {
    const doc = await tx.loadDispatch.create({
      data: {
        tenantId: scope.tenantId, businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined,
        dispatchNo: "TMP", dispatchDate: input.dispatchDate, docType: "Customer", sourceRefType: "DIRECT",
        partyType: "Customer", partyId: input.customerId ?? undefined, partyName: input.customerName ?? undefined,
        deliveryAddress: input.deliveryAddress ?? undefined, warehouse: input.warehouse ?? undefined,
        vehicleGateEntryId: input.vehicleGateEntryId ?? undefined,
        transportCompanyId: input.transportCompanyId ?? gateEntry?.transportCompanyId ?? undefined,
        vehicleId: input.vehicleId ?? gateEntry?.vehicleId ?? undefined,
        vehicleType: input.vehicleType ?? gateEntry?.vehicleType ?? undefined,
        driverName: input.driverName ?? gateEntry?.driverName ?? undefined,
        driverMobile: input.driverMobile ?? gateEntry?.driverMobile ?? undefined,
        driverLicenseNo: input.driverLicenseNo ?? gateEntry?.driverLicenseNo ?? undefined,
        helperName: input.helperName ?? gateEntry?.helperName ?? undefined,
        helperMobile: input.helperMobile ?? gateEntry?.helperMobile ?? undefined,
        sealNumber: input.sealNumber ?? undefined,
        paymentMode: payment?.paymentMode ?? undefined, paymentAmount: payment?.paymentAmount ?? undefined,
        paymentMethod: payment?.paymentMethod ?? undefined, bankId: payment?.bankId ?? undefined,
        bankName: payment?.bankName ?? undefined, bankAccount: payment?.bankAccount ?? undefined,
        remarks: input.remarks ?? undefined,
        status: "Draft", totalProducts: items.length, totalQty: r3(totalQty), totalPackages: 0,
        createdBy: user.id, createdByName: user.fullName ?? undefined,
        items: { create: items },
      },
      select: { id: true },
    });
    await assignDispatchNo(tx, "Customer", doc.id);
    // The physical vehicle flow (Gate Entry → Loading) ends once its dispatch is
    // recorded here — flip the linked Gate Entry straight to Completed so the
    // Vehicle Gate Entry list reflects that this reference is done.
    if (input.vehicleGateEntryId) {
      await tx.vehicleGateEntry.updateMany({ where: { id: input.vehicleGateEntryId, tenantId: scope.tenantId }, data: { status: "Completed" } });
    }
    return doc.id;
  }, { maxWait: 10_000, timeout: 30_000 });
  await writeAudit(prisma, user, { action: "load_dispatch.create", entity: "LoadDispatch", entityId: id, summary: `Direct Customer dispatch created (${totalQty} qty, ${totalValue.toFixed(2)})`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
  return { id };
}

/* ------------------------------------------------ Stock Transfer based load */
export interface LoadFromTransferRequestInput { transferRequestId: number; dispatchDate: string }

/** Auto-loads from a Transfer Request's Stock Allocation (reusing the EXISTING
 * loadRequestForDispatch() + createDispatch() from src/lib/warehouse/dispatch.ts
 * — no reimplementation of allocation-reading logic). Creates the backing
 * StockTransferDispatch (Draft, not user-facing) right away so its items stay
 * consistent with what's shown here; postDispatch() only fires at completion. */
export async function loadFromTransferRequest(scope: ActiveScope, user: Actor, input: LoadFromTransferRequestInput) {
  const { header, items } = await loadRequestForDispatch(scope, input.transferRequestId);
  if (!items.length) throw new Error("Nothing available to dispatch for this transfer request.");

  const std = await createDispatch(scope, user, {
    dispatchType: "Transfer Request Based", dispatchDate: input.dispatchDate, referenceId: input.transferRequestId,
    destinationBranchId: header.destinationBranchId, priority: header.priority,
    items: items.map((it) => ({
      productId: it.productId, productName: it.productName, sku: it.sku, uom: it.uom,
      batchNo: it.batchNo, mfgDate: it.mfgDate, expiryDate: it.expiryDate, serials: it.serials,
      availableQty: it.availableQty, requestedQty: it.requestedQty, allocatedQty: it.allocatedQty,
      pickedQty: 0, dispatchQty: it.dispatchQty, unitCost: it.unitCost,
    })),
  });

  const id = await prisma.$transaction(async (tx) => {
    const doc = await tx.loadDispatch.create({
      data: {
        tenantId: scope.tenantId, businessId: scope.businessId ?? undefined, branchId: header.sourceBranchId,
        dispatchNo: "TMP", dispatchDate: input.dispatchDate, docType: "StockTransfer",
        sourceRefType: "TRANSFER_REQUEST", sourceRefId: input.transferRequestId, sourceRefNo: header.referenceNo,
        stockTransferDispatchId: std.id,
        partyType: "Branch", partyId: header.destinationBranchId, partyName: header.destinationName,
        warehouse: header.sourceWarehouse ?? undefined, destinationWarehouse: header.destinationWarehouse ?? undefined,
        status: "Draft", totalProducts: items.length,
        totalQty: r3(items.reduce((s, it) => s + num(it.dispatchQty), 0)),
        totalPackages: 0,
        createdBy: user.id, createdByName: user.fullName ?? undefined,
        items: {
          create: items.map((it) => ({
            tenantId: scope.tenantId, productId: it.productId, productName: it.productName, sku: it.sku, uom: it.uom,
            batchNo: it.batchNo, mfgDate: it.mfgDate, expiryDate: it.expiryDate,
            allocatedQty: r3(num(it.allocatedQty)), dispatchedQty: r3(num(it.dispatchQty)),
            pendingQty: r3(Math.max(0, num(it.requestedQty) - num(it.dispatchQty))),
            rate: num(it.unitCost), value: r2(num(it.dispatchQty) * num(it.unitCost)),
          })),
        },
      },
      select: { id: true },
    });
    await assignDispatchNo(tx, "StockTransfer", doc.id);
    return doc.id;
  }, { maxWait: 10_000, timeout: 30_000 });
  await writeAudit(prisma, user, { action: "load_dispatch.create", entity: "LoadDispatch", entityId: id, summary: `Loaded Stock Transfer dispatch from ${header.referenceNo}`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
  return { id };
}

/* -------------------------------------------------------- other docTypes */
export interface OtherDispatchInput {
  docType: "PurchaseReturn" | "SalesReturnPickup" | "ProductionTransfer" | "JobWork" | "Others";
  dispatchDate: string; partyName?: string | null; warehouse?: string | null; remarks?: string | null;
  items?: DirectDispatchItemInput[];
}

/** Phase-1 physical tracking only — no stock-moving engine exists yet for
 * these docTypes (matches the original Transport module's scope decision). */
export async function createOtherDispatch(scope: ActiveScope, user: Actor, input: OtherDispatchInput) {
  const items = input.items ?? [];
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const prods = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: scope.tenantId }, select: { id: true, name: true, sku: true, baseUom: true } }) : [];
  const byId = new Map(prods.map((p) => [p.id, p]));

  let totalQty = 0;
  const created = items.map((i) => {
    const p = byId.get(i.productId);
    const qty = r3(Number(i.dispatchedQty) || 0);
    totalQty += qty;
    return { tenantId: scope.tenantId, productId: i.productId, productName: i.productName || p?.name || "", sku: i.sku ?? p?.sku, uom: i.uom ?? p?.baseUom, allocatedQty: qty, dispatchedQty: qty, pendingQty: 0, rate: i.rate ?? undefined, value: 0 };
  });

  const id = await prisma.$transaction(async (tx) => {
    const doc = await tx.loadDispatch.create({
      data: {
        tenantId: scope.tenantId, businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined,
        dispatchNo: "TMP", dispatchDate: input.dispatchDate, docType: input.docType, sourceRefType: "DIRECT",
        partyName: input.partyName ?? undefined, warehouse: input.warehouse ?? undefined, remarks: input.remarks ?? undefined,
        status: "Draft", totalProducts: created.length, totalQty: r3(totalQty), totalPackages: 0,
        createdBy: user.id, createdByName: user.fullName ?? undefined,
        items: created.length ? { create: created } : undefined,
      },
      select: { id: true },
    });
    await assignDispatchNo(tx, input.docType, doc.id);
    return doc.id;
  }, { maxWait: 10_000, timeout: 30_000 });
  await writeAudit(prisma, user, { action: "load_dispatch.create", entity: "LoadDispatch", entityId: id, summary: `${input.docType} dispatch created (physical tracking only)`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
  return { id };
}

/* ------------------------------------------------------------- completion */
/** The ONLY place that triggers postDispatch (StockTransfer). Validates the
 * spec's prerequisites, item quantities, and moves status Draft/Ready/Loading
 * → Dispatched. Never called from the gate/weighment screens directly. */
export async function completeLoadDispatch(scope: ActiveScope, user: Actor, id: number) {
  const doc = await prisma.loadDispatch.findFirst({ where: { id, tenantId: scope.tenantId }, include: { items: true } });
  if (!doc) throw new Error("Load & Dispatch not found.");
  if (doc.status === "Cancelled") throw new Error("Cannot complete a cancelled dispatch.");
  if (["Dispatched", "Delivery Challan Generated", "Sales Invoice Posted"].includes(doc.status)) throw new Error(`This dispatch is already ${doc.status}.`);

  const cfg = await getDispatchConfig(user);

  // Quantity guard: dispatched ≤ allocated (server-side, mirrors what the UI enforces live).
  for (const it of doc.items) {
    if (num(it.dispatchedQty) > num(it.allocatedQty) + 0.001) {
      throw new Error(`"${it.productName}" — dispatched quantity cannot exceed the allocated quantity.`);
    }
  }

  // Prerequisite: Vehicle Gate Entry / Pre-Loading Weighment, if configured.
  if (doc.vehicleGateEntryId) {
    if (cfg.flags.requireWeighment) {
      const pre = await prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: doc.vehicleGateEntryId, tenantId: scope.tenantId } });
      if (!pre) throw new Error("Pre-Loading Weighment must be completed for the linked Vehicle Gate Entry before completing this dispatch.");
    }
  } else if (cfg.flags.enableVehicleGateEntry && cfg.flags.requireVehicleAssignmentBeforeDispatch) {
    throw new Error("A Vehicle Gate Entry is required before completing this dispatch (per Dispatch Configuration).");
  }

  if (doc.docType === "StockTransfer" && doc.stockTransferDispatchId) {
    await postDispatch(scope, user, doc.stockTransferDispatchId); // existing engine — full stock + GL movement
  }

  if (doc.docType === "Customer") {
    await consumeInventoryForCustomerDispatch(scope, user, doc);
  }

  await prisma.loadDispatch.update({ where: { id }, data: { status: "Dispatched", completedBy: user.id, completedAt: new Date() } });
  await writeAudit(prisma, user, { action: "load_dispatch.complete", entity: "LoadDispatch", entityId: id, summary: `Completed Load & Dispatch ${doc.dispatchNo}${doc.docType === "StockTransfer" ? " — posted via existing dispatch engine" : doc.docType === "Customer" ? " — stock reduced" : ""}`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
  return { status: "Dispatched" as const };
}

/** Reduces stock the moment a Customer dispatch completes (reuses postMovement/
 * consumeLots — the same primitives Opening Stock/GRN/POS use, nothing new).
 * Resolves each line's actual batch/cost via FEFO/FIFO when no specific batch
 * was captured, falling back to an unconstrained draw if the requested batch
 * is short (mirrors postSaleLineMovements' own fallback in src/lib/sales/postSaleLine.ts).
 * Stores the resolved cost/batch on the LoadDispatchItem so the Sales Invoice,
 * whenever it posts, uses skipInventoryMovement and never re-consumes stock. */
async function consumeInventoryForCustomerDispatch(
  scope: ActiveScope, user: Actor,
  doc: { id: number; warehouse: string | null; dispatchDate: string; dispatchNo: string; items: { id: number; productId: number; dispatchedQty: Prisma.Decimal; batchNo: string | null; mfgDate: string | null; expiryDate: string | null }[] },
) {
  await prisma.$transaction(async (tx) => {
    for (const it of doc.items) {
      const qty = num(it.dispatchedQty);
      if (qty <= 0) continue;
      let res = await consumeLots(tx, scope.tenantId, scope.branchId ?? null, it.productId, doc.warehouse, qty, { batchNo: it.batchNo ?? undefined });
      if (res.taken < qty - 0.001) {
        const shortfall = r3(qty - res.taken);
        const fallback = await consumeLots(tx, scope.tenantId, scope.branchId ?? null, it.productId, doc.warehouse, shortfall);
        res = { cost: r2(res.cost + fallback.cost), taken: qty, batchNo: res.batchNo ?? fallback.batchNo, mfgDate: res.mfgDate ?? fallback.mfgDate, expiryDate: res.expiryDate ?? fallback.expiryDate, grnId: res.grnId ?? fallback.grnId };
      }
      await postMovement(tx, {
        tenantId: scope.tenantId, businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined,
        productId: it.productId, txnType: "SALES", direction: "OUT", qty, rate: res.cost, warehouse: doc.warehouse,
        batchNo: it.batchNo ?? res.batchNo, mfgDate: it.mfgDate ?? res.mfgDate, expiryDate: it.expiryDate ?? res.expiryDate,
        refType: "LOAD_DISPATCH", refId: it.id, refNo: doc.dispatchNo, txnDate: doc.dispatchDate, createdBy: user.id,
      });
      await tx.loadDispatchItem.update({
        where: { id: it.id },
        data: { cost: res.cost, batchNo: it.batchNo ?? res.batchNo ?? undefined, mfgDate: it.mfgDate ?? res.mfgDate ?? undefined, expiryDate: it.expiryDate ?? res.expiryDate ?? undefined },
      });
    }
    await tx.loadDispatch.update({ where: { id: doc.id }, data: { inventoryPostedAt: new Date() } });
  }, { maxWait: 10_000, timeout: 30_000 });
}

/* ------------------------------------------------------- delivery challan */
/** Explicit "Delivery Challan" button action (Customer dispatches only, after
 * Complete Load & Dispatch). Automatic posting mode fires the Sales Invoice
 * immediately afterward in the same call; Manual mode leaves the separate
 * "Post Sales Invoice" button for the user. */
export async function generateDeliveryChallanForLoadDispatch(scope: ActiveScope, user: Actor, id: number, opts: { stamp: TerminalStamp }) {
  const doc = await prisma.loadDispatch.findFirst({ where: { id, tenantId: scope.tenantId }, include: { items: true } });
  if (!doc) throw new Error("Load & Dispatch not found.");
  if (doc.docType !== "Customer") throw new Error("Delivery Challan only applies to Customer dispatches.");
  if (doc.status !== "Dispatched") throw new Error(`Complete the Load & Dispatch before generating a Delivery Challan (currently ${doc.status}).`);
  if (doc.deliveryChallanId) throw new Error("A Delivery Challan has already been generated for this dispatch.");

  const cfg = await getDispatchConfig(user);
  let invoiceNo: string | null = null;

  // maxWait/timeout: createSaleTx posts a full sales journal + inventory
  // consumption sequentially against a remote RDS instance — the 5s Prisma
  // default was too tight and failed with P2028 (expired transaction).
  const dcId = await prisma.$transaction(async (tx) => {
    const dc = await tx.deliveryChallan.create({
      data: {
        tenantId: scope.tenantId, businessId: doc.businessId ?? undefined, branchId: doc.branchId ?? undefined,
        dcNo: "TMP", dcDate: doc.dispatchDate, loadDispatchId: doc.id,
        customerId: doc.partyId, customerName: doc.partyName, deliveryAddress: doc.deliveryAddress,
        totalQty: doc.totalQty, totalValue: doc.items.reduce((s, it) => s + num(it.value), 0),
        status: "Generated", generatedAt: new Date(),
      },
      select: { id: true },
    });
    const dcNo = `${cfg.fields.dcPrefix || "DC"}-${String(dc.id).padStart(5, "0")}`;
    await tx.deliveryChallan.update({ where: { id: dc.id }, data: { dcNo } });

    if (doc.sourceRefType === "SALES_ORDER" && doc.sourceRefId) {
      for (const it of doc.items) {
        await tx.salesDocumentItem.updateMany({ where: { salesDocumentId: doc.sourceRefId, productId: it.productId }, data: { deliveredQty: { increment: it.dispatchedQty } } });
      }
    }

    let saleId: number | null = null;
    if (cfg.fields.salesInvoicePostingMethod === "Automatic") {
      const prepared = await buildPreparedSale(scope.tenantId, doc);
      const sale = await createSaleTx(tx, prepared, { user: { id: user.id, tenantId: scope.tenantId }, seg: { businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined }, stamp: opts.stamp, channel: "B2B", series: "b2b", skipInventoryMovement: true });
      invoiceNo = sale.invoiceNo; saleId = sale.id;
    }

    await tx.loadDispatch.update({ where: { id: doc.id }, data: { deliveryChallanId: dc.id, saleId: saleId ?? undefined, status: saleId ? "Sales Invoice Posted" : "Delivery Challan Generated" } });
    return dc.id;
  }, { maxWait: 10_000, timeout: 30_000 });

  await writeAudit(prisma, user, { action: "load_dispatch.delivery_challan", entity: "LoadDispatch", entityId: id, summary: `Generated Delivery Challan for ${doc.dispatchNo}${invoiceNo ? `, invoice ${invoiceNo}` : ""}`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
  return { deliveryChallanId: dcId, invoiceNo };
}

/** Manual-mode "Post Sales Invoice" button — only reachable once a Delivery
 * Challan already exists and no invoice has posted yet. */
export async function postSalesInvoiceForLoadDispatch(scope: ActiveScope, user: Actor, id: number, opts: { stamp: TerminalStamp }) {
  const doc = await prisma.loadDispatch.findFirst({ where: { id, tenantId: scope.tenantId }, include: { items: true } });
  if (!doc) throw new Error("Load & Dispatch not found.");
  if (!doc.deliveryChallanId) throw new Error("Generate the Delivery Challan first.");
  if (doc.saleId) throw new Error("A Sales Invoice has already been posted for this dispatch.");

  let invoiceNo = "";
  // maxWait/timeout: same P2028 risk as generateDeliveryChallanForLoadDispatch —
  // createSaleTx does several sequential round trips against a remote RDS instance.
  await prisma.$transaction(async (tx) => {
    const prepared = await buildPreparedSale(scope.tenantId, doc);
    const sale = await createSaleTx(tx, prepared, { user: { id: user.id, tenantId: scope.tenantId }, seg: { businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined }, stamp: opts.stamp, channel: "B2B", series: "b2b", skipInventoryMovement: true });
    invoiceNo = sale.invoiceNo;
    await tx.loadDispatch.update({ where: { id: doc.id }, data: { saleId: sale.id, status: "Sales Invoice Posted" } });
  }, { maxWait: 10_000, timeout: 30_000 });
  await writeAudit(prisma, user, { action: "load_dispatch.post_invoice", entity: "LoadDispatch", entityId: id, summary: `Posted Sales Invoice ${invoiceNo} for ${doc.dispatchNo}`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
  return { invoiceNo };
}

/** PreparedSale builder — see src/lib/transport/dispatchExecution.ts for the
 * original version this mirrors; B2B/dispatch invoices skip POS-only promos
 * (loyalty/coupon/promo/membership/gift voucher) in Phase 1. Uses each item's
 * OWN stored discount/tax (set at Direct Customer Dispatch entry time, or via
 * the main editor) when present; falls back to the product's gstRate for
 * items that never captured per-line tax (the Sales-Order/Stock-Transfer
 * auto-load paths, where dispatch is qty-only). Payment collection
 * (Full/Partial/Credit) captured on the LoadDispatch row drives amountPaid/
 * payments/paymentStatus here — this is the ONLY place that intent gets
 * applied to a real posted invoice. */
interface PreparedSaleSourceItem {
  productId: number; productName: string; sku: string | null; uom: string | null; batchNo: string | null; mfgDate: string | null; expiryDate: string | null;
  dispatchedQty: Prisma.Decimal; rate: Prisma.Decimal | null;
  discPct: Prisma.Decimal | null; discAmount: Prisma.Decimal; taxPct: Prisma.Decimal | null; taxableValue: Prisma.Decimal; taxAmount: Prisma.Decimal;
  cost: Prisma.Decimal | null;
}
interface PreparedSaleSourceDoc {
  items: PreparedSaleSourceItem[]; warehouse: string | null; partyId: number | null; partyName: string | null; dispatchDate: string;
  sourceRefType: string | null; sourceRefNo: string | null;
  paymentMode: string | null; paymentAmount: Prisma.Decimal | null; paymentMethod: string | null;
  bankId: number | null; bankName: string | null; bankAccount: string | null;
}
async function buildPreparedSale(tenantId: number, doc: PreparedSaleSourceDoc): Promise<PreparedSale> {
  const items = doc.items;
  const needsGst = items.filter((it) => it.taxPct == null);
  const productIds = Array.from(new Set(needsGst.map((i) => i.productId)));
  const prods = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds }, tenantId }, select: { id: true, gstRate: true } }) : [];
  const gstById = new Map(prods.map((p) => [p.id, Number(String(p.gstRate ?? "0").replace(/[^0-9.]/g, "")) || 0]));
  // GSTIN isn't captured on LoadDispatch itself — read it from the customer
  // master so the posted invoice isn't missing it on the B2B invoice list.
  const customer = doc.partyId ? await prisma.customer.findFirst({ where: { id: doc.partyId, tenantId }, select: { gstin: true } }) : null;

  let subtotal = 0, itemDiscount = 0, taxableValue = 0, taxTotal = 0, itemCount = 0;
  const lines: Prisma.SaleLineUncheckedCreateWithoutSaleInput[] = items.map((it) => {
    const qty = num(it.dispatchedQty);
    const rate = num(it.rate);
    const gross = r2(qty * rate);
    const hasStoredTax = it.taxPct != null;
    const discAmount = hasStoredTax ? num(it.discAmount) : 0;
    const taxable = hasStoredTax ? num(it.taxableValue) : gross;
    const gst = hasStoredTax ? num(it.taxPct) : (gstById.get(it.productId) ?? 0);
    const tax = hasStoredTax ? num(it.taxAmount) : (gst > 0 ? r2(taxable * (gst / 100)) : 0);
    subtotal += gross; itemDiscount += discAmount; taxableValue += taxable; taxTotal += tax; itemCount += qty;
    return {
      productId: it.productId, productName: it.productName, sku: it.sku, uom: it.uom,
      qty, mrp: null, rate, discPct: it.discPct != null ? num(it.discPct) : null, discAmount, taxPct: gst || null, taxableValue: r2(taxable), taxAmount: tax, value: r2(taxable + tax),
      batchNo: it.batchNo, mfgDate: it.mfgDate, expiryDate: it.expiryDate,
      // Already resolved by completeLoadDispatch's inventory consumption — the
      // Sales Invoice posts with skipInventoryMovement, so this is the final cost.
      cost: num(it.cost),
    };
  });
  const total = r2(taxableValue + taxTotal);

  // Payment collection — Full/Partial/Credit, same terminology as the
  // existing B2B Sales Invoice screen (src/components/sales/B2bInvoiceForm.tsx).
  const mode = doc.paymentMode ?? "Credit";
  const amountPaid = mode === "Full" ? total : mode === "Partial" ? r2(Math.min(num(doc.paymentAmount), total)) : 0;
  const paymentStatus = amountPaid <= 0 ? "Unpaid" : amountPaid >= total ? "Paid" : "Partial";
  const method = doc.paymentMethod || "Cash";
  const payments = amountPaid > 0 ? [{ mode: method, amount: amountPaid, reference: null }] : [];

  return {
    saleDate: doc.dispatchDate, warehouse: doc.warehouse || "Main Store",
    customerId: doc.partyId, customerName: doc.partyName ?? "Dispatch Customer", customerPhone: null, notes: null,
    customerGstin: customer?.gstin ?? null, soNumber: doc.sourceRefType === "SALES_ORDER" ? doc.sourceRefNo : null,
    lines, lineCodes: lines.map(() => []), scannedCodes: [], fefoSet: new Set(),
    payments,
    subtotal: r2(subtotal), itemDiscount: r2(itemDiscount), billDiscount: 0, taxableValue: r2(taxableValue),
    taxTotal: r2(taxTotal), cgst: r2(taxTotal / 2), sgst: r2(taxTotal / 2), roundOff: 0, total, itemCount: Math.round(itemCount),
    amountPaid, changeDue: 0, paymentStatus, paymentMode: method,
    bankId: doc.bankId ?? null, bankName: doc.bankName ?? null, bankAccount: doc.bankAccount ?? null,
    loyaltyProgramId: null, loyaltyRedeemPoints: 0, loyaltyRedeemValue: 0,
    couponId: null, couponCode: null, couponDiscount: 0, couponTaxableReduced: 0,
    promoId: null, promoCode: null, promoDiscount: 0, promoTaxableReduced: 0,
    membershipDiscount: 0, membershipLevelId: null, membershipDiscountCode: "",
    giftVoucherId: null, giftVoucherNo: null, giftVoucherAmount: 0,
    engineDiscount: 0, engineApplied: [],
  };
}

export type { LoadDispatchItemDto };
