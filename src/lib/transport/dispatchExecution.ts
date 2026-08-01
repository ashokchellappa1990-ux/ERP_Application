import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { writeAudit, type AuditActor } from "@/lib/audit/log";
import { postDispatch } from "@/lib/warehouse/dispatch";
import { createSaleTx, type PreparedSale } from "@/lib/sales/createSale";
import { getDispatchConfig } from "@/lib/settings/dispatchConfig";
import type { TerminalStamp } from "@/lib/pos/terminalContext";

/**
 * The shared Dispatch Execution engine (Phase 1). Covers Customer dispatch
 * (Sales-Order-based + Direct) and Stock Transfer dispatch as ONE
 * docType-discriminated table (`dispatch_execution`), mirroring how
 * `sales_documents`/`advances` share one table with a string discriminator.
 *
 * This module NEVER writes InventoryLedger/journal_entries directly — the two
 * integration points that actually move stock/GL are:
 *   - StockTransfer → calls the EXISTING postDispatch() (src/lib/warehouse/dispatch.ts),
 *     which already reduces source stock, creates in-transit stock, and posts
 *     Dr Inventory-In-Transit / Cr Inventory. `sourceRefId` on the execution
 *     row IS that StockTransferDispatch's id (created earlier via the existing
 *     Stock Transfer Dispatch screen) — this module only carries it through
 *     the physical gate/weighment/loading workflow and fires it on completion.
 *   - Customer → calls the EXISTING createSaleTx() (src/lib/sales/createSale.ts),
 *     the same single source-of-truth POS billing uses for inventory OUT + the
 *     sales journal, per the configured posting method (Automatic/Manual).
 * Other docTypes (PurchaseReturn/SalesReturn/ProductionTransfer/JobWork/
 * VendorDispatch/Others) are Phase-1 physical-tracking only — completion just
 * marks the record Completed; no stock-moving engine exists for them yet.
 */

type Actor = AuditActor & { fullName?: string | null };
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const r3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const today = () => new Date().toISOString().slice(0, 10);

const DOC_PREFIX: Record<string, string> = {
  Customer: "DE", StockTransfer: "DE-ST", PurchaseReturn: "DE-PR", SalesReturn: "DE-SR",
  ProductionTransfer: "DE-PT", JobWork: "DE-JW", VendorDispatch: "DE-VD", Others: "DE-OT",
};

async function assignDocNo(tx: Prisma.TransactionClient, tenantId: number, docType: string, id: number) {
  const prefix = DOC_PREFIX[docType] ?? "DE";
  const docNo = `${prefix}-${String(id).padStart(5, "0")}`;
  await tx.dispatchExecution.update({ where: { id }, data: { docNo } });
  return docNo;
}

/* --------------------------------------------------- Sales-Order based load */
export interface LoadFromSalesOrderInput { salesOrderId: number; dispatchPlanningId?: number | null; docDate: string; warehouse?: string | null }

/** Auto-loads a Customer dispatch from a Sales Order's remaining (undelivered)
 * quantity — `SalesDocumentItem.qty - deliveredQty` per line. No duplicate
 * manual item entry: every line comes straight from the order. */
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

  const id = await prisma.$transaction(async (tx) => {
    const doc = await tx.dispatchExecution.create({
      data: {
        tenantId: scope.tenantId, businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined,
        docNo: "TMP", docType: "Customer", docDate: input.docDate,
        dispatchPlanningId: input.dispatchPlanningId ?? undefined,
        sourceRefType: "SALES_ORDER", sourceRefId: so.id, sourceRefNo: so.docNo,
        partyType: "Customer", partyId: so.customerId ?? undefined, partyName: so.customerName ?? undefined,
        deliveryAddress: so.deliveryAddress ?? undefined, warehouse: input.warehouse ?? so.warehouse ?? undefined,
        status: "Draft", totalQty: r3(totalQty), totalValue: r2(totalValue),
        createdBy: user.id, createdByName: user.fullName ?? undefined,
        items: {
          create: remaining.map((it) => {
            const lineRemaining = num(it.qty) - num(it.deliveredQty);
            const unitRate = num(it.qty) > 0 ? num(it.rate) : 0;
            return {
              tenantId: scope.tenantId, productId: it.productId ?? 0, productName: it.productName, sku: it.sku,
              uom: it.uom, orderedQty: it.qty, dispatchedQty: lineRemaining, rate: unitRate,
              value: r2(lineRemaining * unitRate),
            };
          }),
        },
      },
      select: { id: true },
    });
    await assignDocNo(tx, scope.tenantId, "Customer", doc.id);
    return doc.id;
  });
  await writeAudit(prisma, user, { action: "dispatch_execution.create", entity: "DispatchExecution", entityId: id, summary: `Loaded Customer dispatch from Sales Order ${so.docNo}`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
  return { id };
}

/* ------------------------------------------------ Stock Transfer based load */
export interface LoadFromStockTransferDispatchInput { stockTransferDispatchId: number; dispatchPlanningId?: number | null; docDate: string }

/** Auto-loads a StockTransfer dispatch execution from an EXISTING (Draft)
 * StockTransferDispatch record — items copied as-is; the actual stock+GL
 * movement is NOT performed here, only on completeExecution() via the
 * existing postDispatch(). */
export async function loadFromStockTransferDispatch(scope: ActiveScope, user: Actor, input: LoadFromStockTransferDispatchInput) {
  const std = await prisma.stockTransferDispatch.findFirst({
    where: { id: input.stockTransferDispatchId, tenantId: scope.tenantId },
    include: { items: true },
  });
  if (!std) throw new Error("Stock Transfer Dispatch not found.");
  if (std.status !== "Draft") throw new Error(`This Stock Transfer Dispatch is already ${std.status}.`);

  const id = await prisma.$transaction(async (tx) => {
    const doc = await tx.dispatchExecution.create({
      data: {
        tenantId: scope.tenantId, businessId: scope.businessId ?? undefined, branchId: std.sourceBranchId,
        docNo: "TMP", docType: "StockTransfer", docDate: input.docDate,
        dispatchPlanningId: input.dispatchPlanningId ?? undefined,
        sourceRefType: "STOCK_TRANSFER_DISPATCH", sourceRefId: std.id, sourceRefNo: std.dispatchNo,
        partyType: "Branch", partyId: std.destinationBranchId, warehouse: std.sourceWarehouse ?? undefined,
        status: "Draft", totalQty: std.totalDispatchQty, totalValue: std.totalValue,
        createdBy: user.id, createdByName: user.fullName ?? undefined,
        items: {
          create: std.items.map((it) => ({
            tenantId: scope.tenantId, productId: it.productId, productName: it.productName, sku: it.sku, uom: it.uom,
            batchNo: it.batchNo, mfgDate: it.mfgDate, expiryDate: it.expiryDate,
            orderedQty: it.requestedQty, dispatchedQty: it.dispatchQty, rate: it.unitCost, value: it.stockValue,
          })),
        },
      },
      select: { id: true },
    });
    await assignDocNo(tx, scope.tenantId, "StockTransfer", doc.id);
    return doc.id;
  });
  await writeAudit(prisma, user, { action: "dispatch_execution.create", entity: "DispatchExecution", entityId: id, summary: `Loaded Stock Transfer dispatch from ${std.dispatchNo}`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
  return { id };
}

/* ----------------------------------------------- Direct customer dispatch */
export interface DirectDispatchItemInput { productId: number; productName?: string; sku?: string | null; uom?: string | null; batchNo?: string | null; dispatchedQty: number; rate?: number | null; remarks?: string | null }
export interface DirectCustomerDispatchInput {
  docDate: string; customerId?: number | null; customerName?: string | null; deliveryAddress?: string | null;
  warehouse?: string | null; remarks?: string | null; items: DirectDispatchItemInput[];
}

/** Direct Customer Dispatch — manual entry, no Sales Order (allowed only when
 * Dispatch Configuration's `allowDirectCustomerDispatch`/`allowDispatchWithoutSalesOrder` are on). */
export async function createDirectCustomerDispatch(scope: ActiveScope, user: Actor, input: DirectCustomerDispatchInput) {
  const cfg = await getDispatchConfig(user);
  if (!cfg.flags.allowDirectCustomerDispatch || !cfg.flags.allowDispatchWithoutSalesOrder) {
    throw new Error("Direct customer dispatch (without a Sales Order) is disabled in Dispatch Configuration.");
  }
  if (!input.items.length) throw new Error("Add at least one item.");

  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const prods = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: scope.tenantId }, select: { id: true, name: true, sku: true, baseUom: true } });
  const byId = new Map(prods.map((p) => [p.id, p]));
  if (prods.length !== productIds.length) throw new Error("One or more items are not in your catalog.");

  let totalQty = 0, totalValue = 0;
  const items = input.items.map((i) => {
    const p = byId.get(i.productId)!;
    const qty = r3(Number(i.dispatchedQty) || 0);
    const rate = i.rate != null ? Number(i.rate) : 0;
    const value = r2(qty * rate);
    totalQty += qty; totalValue += value;
    return {
      tenantId: scope.tenantId, productId: i.productId, productName: i.productName || p.name, sku: i.sku ?? p.sku,
      uom: i.uom ?? p.baseUom, batchNo: i.batchNo ?? undefined, orderedQty: qty, dispatchedQty: qty, rate, value,
      remarks: i.remarks ?? undefined,
    };
  });

  const id = await prisma.$transaction(async (tx) => {
    const doc = await tx.dispatchExecution.create({
      data: {
        tenantId: scope.tenantId, businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined,
        docNo: "TMP", docType: "Customer", docDate: input.docDate,
        sourceRefType: "DIRECT", partyType: "Customer", partyId: input.customerId ?? undefined,
        partyName: input.customerName ?? undefined, deliveryAddress: input.deliveryAddress ?? undefined,
        warehouse: input.warehouse ?? undefined, remarks: input.remarks ?? undefined,
        status: "Draft", totalQty: r3(totalQty), totalValue: r2(totalValue),
        createdBy: user.id, createdByName: user.fullName ?? undefined,
        items: { create: items },
      },
      select: { id: true },
    });
    await assignDocNo(tx, scope.tenantId, "Customer", doc.id);
    return doc.id;
  });
  await writeAudit(prisma, user, { action: "dispatch_execution.create", entity: "DispatchExecution", entityId: id, summary: `Direct Customer dispatch created (${totalQty} qty)`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
  return { id };
}

/* ------------------------------------------------------------- completion */
/** Builds a minimal PreparedSale from a completed dispatch's items so
 * createSaleTx (the same engine POS billing uses) can post it. B2B/dispatch
 * invoices skip POS-only promos (loyalty/coupon/promo/membership/gift
 * voucher) in Phase 1 — those fields are zeroed. Tax is computed tax-exclusive
 * from each product's gstRate, matching prepareSale's B2B (non-inclusive) path. */
async function buildPreparedSaleFromExecution(tenantId: number, execution: { items: { productId: number; productName: string; sku: string | null; uom: string | null; batchNo: string | null; mfgDate: string | null; expiryDate: string | null; dispatchedQty: Prisma.Decimal; rate: Prisma.Decimal | null }[]; warehouse: string | null; partyId: number | null; partyName: string | null; docDate: string }): Promise<PreparedSale> {
  const productIds = Array.from(new Set(execution.items.map((i) => i.productId)));
  const prods = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId }, select: { id: true, gstRate: true } });
  const gstById = new Map(prods.map((p) => [p.id, Number(String(p.gstRate ?? "0").replace(/[^0-9.]/g, "")) || 0]));

  let subtotal = 0, taxableValue = 0, taxTotal = 0, itemCount = 0;
  const lines: Prisma.SaleLineUncheckedCreateWithoutSaleInput[] = execution.items.map((it) => {
    const qty = num(it.dispatchedQty);
    const rate = num(it.rate);
    const gst = gstById.get(it.productId) ?? 0;
    const gross = qty * rate;
    const taxable = gross;
    const tax = gst > 0 ? r2(taxable * (gst / 100)) : 0;
    subtotal += gross; taxableValue += taxable; taxTotal += tax; itemCount += qty;
    return {
      productId: it.productId, productName: it.productName, sku: it.sku, uom: it.uom,
      qty, mrp: null, rate, discPct: null, discAmount: 0, taxPct: gst || null, taxableValue: r2(taxable), taxAmount: tax, value: r2(taxable + tax),
      batchNo: it.batchNo, mfgDate: it.mfgDate, expiryDate: it.expiryDate,
    };
  });
  const total = r2(taxableValue + taxTotal);

  return {
    saleDate: execution.docDate, warehouse: execution.warehouse || "Main Store",
    customerId: execution.partyId, customerName: execution.partyName ?? "Dispatch Customer", customerPhone: null, notes: null,
    lines, lineCodes: lines.map(() => []), scannedCodes: [], fefoSet: new Set(),
    payments: [], // dispatch-triggered invoices post as unpaid/on-account — Accounts settles separately
    subtotal: r2(subtotal), itemDiscount: 0, billDiscount: 0, taxableValue: r2(taxableValue),
    taxTotal: r2(taxTotal), cgst: r2(taxTotal / 2), sgst: r2(taxTotal / 2), roundOff: 0, total, itemCount: Math.round(itemCount),
    amountPaid: 0, changeDue: 0, paymentStatus: "Unpaid", paymentMode: "Credit",
    loyaltyProgramId: null, loyaltyRedeemPoints: 0, loyaltyRedeemValue: 0,
    couponId: null, couponCode: null, couponDiscount: 0, couponTaxableReduced: 0,
    promoId: null, promoCode: null, promoDiscount: 0, promoTaxableReduced: 0,
    membershipDiscount: 0, membershipLevelId: null, membershipDiscountCode: "",
    giftVoucherId: null, giftVoucherNo: null, giftVoucherAmount: 0,
    engineDiscount: 0, engineApplied: [],
  };
}

export interface CompleteExecutionOpts { stamp: TerminalStamp }

/** The ONLY place that triggers postDispatch (StockTransfer) or createSaleTx
 * (Customer, when config posting method is Automatic) — called from Gate
 * Exit's completion step, never from the gate/weighment/loading screens
 * directly. */
export async function completeExecution(scope: ActiveScope, user: Actor, executionId: number, opts: CompleteExecutionOpts) {
  const exec = await prisma.dispatchExecution.findFirst({ where: { id: executionId, tenantId: scope.tenantId }, include: { items: true } });
  if (!exec) throw new Error("Dispatch Execution not found.");
  if (exec.status === "Completed") throw new Error("This dispatch has already been completed.");
  if (exec.status === "Cancelled") throw new Error("Cannot complete a cancelled dispatch.");

  const cfg = await getDispatchConfig(user);

  if (exec.docType === "StockTransfer") {
    if (!exec.sourceRefId) throw new Error("No linked Stock Transfer Dispatch to post.");
    await postDispatch(scope, user, exec.sourceRefId); // existing engine — full stock + GL movement
    await prisma.dispatchExecution.update({ where: { id: executionId }, data: { status: "Completed", completedAt: new Date() } });
    await writeAudit(prisma, user, { action: "dispatch_execution.complete", entity: "DispatchExecution", entityId: executionId, summary: `Completed Stock Transfer dispatch ${exec.docNo} — posted via existing dispatch engine`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
    return { status: "Completed" as const, invoiceNo: null as string | null, dcNo: null as string | null };
  }

  if (exec.docType === "Customer") {
    let invoiceNo: string | null = null;
    let dcNo: string | null = null;
    await prisma.$transaction(async (tx) => {
      // Delivery Challan — physical proof of dispatch, no stock/GL impact.
      if (cfg.flags.generateDcAutomatically) {
        const dc = await tx.deliveryChallan.create({
          data: {
            tenantId: scope.tenantId, businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined,
            dcNo: "TMP", dcDate: exec.docDate, dispatchExecutionId: exec.id,
            customerId: exec.partyId, customerName: exec.partyName, deliveryAddress: exec.deliveryAddress,
            totalQty: exec.totalQty, totalValue: exec.totalValue, status: "Generated", generatedAt: new Date(),
          },
          select: { id: true },
        });
        dcNo = `${cfg.fields.dcPrefix || "DC"}-${String(dc.id).padStart(5, "0")}`;
        await tx.deliveryChallan.update({ where: { id: dc.id }, data: { dcNo } });
      }

      // Sales-Order-sourced items: roll the dispatched qty into deliveredQty.
      if (exec.sourceRefType === "SALES_ORDER" && exec.sourceRefId) {
        for (const it of exec.items) {
          await tx.salesDocumentItem.updateMany({
            where: { salesDocumentId: exec.sourceRefId, productId: it.productId },
            data: { deliveredQty: { increment: it.dispatchedQty } },
          });
        }
      }

      if (cfg.fields.salesInvoicePostingMethod === "Automatic") {
        const prepared = await buildPreparedSaleFromExecution(scope.tenantId, {
          items: exec.items, warehouse: exec.warehouse, partyId: exec.partyId, partyName: exec.partyName, docDate: exec.docDate,
        });
        const sale = await createSaleTx(tx, prepared, { user: { id: user.id, tenantId: scope.tenantId }, seg: { businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined }, stamp: opts.stamp, channel: "B2B", series: "b2b" });
        invoiceNo = sale.invoiceNo;
      }

      await tx.dispatchExecution.update({ where: { id: executionId }, data: { status: "Completed", completedAt: new Date() } });
    });
    await writeAudit(prisma, user, { action: "dispatch_execution.complete", entity: "DispatchExecution", entityId: executionId, summary: `Completed Customer dispatch ${exec.docNo}${dcNo ? ` — DC ${dcNo}` : ""}${invoiceNo ? `, invoice ${invoiceNo}` : ""}`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
    return { status: "Completed" as const, invoiceNo, dcNo };
  }

  // PurchaseReturn | SalesReturn | ProductionTransfer | JobWork | VendorDispatch | Others —
  // Phase 1: physical tracking only, no stock-moving engine wired yet.
  await prisma.dispatchExecution.update({ where: { id: executionId }, data: { status: "Completed", completedAt: new Date() } });
  await writeAudit(prisma, user, { action: "dispatch_execution.complete", entity: "DispatchExecution", entityId: executionId, summary: `Completed ${exec.docType} dispatch ${exec.docNo} (physical tracking only — no stock/GL engine wired for this doc type yet)`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null });
  return { status: "Completed" as const, invoiceNo: null, dcNo: null };
}

export { today as todayStr };
