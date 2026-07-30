import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { writeAudit, type AuditActor } from "@/lib/audit/log";
import { BUCKET_WAREHOUSES, IN_TRANSIT_WAREHOUSE } from "@/lib/inventory/buckets";
import { consumeLots, postMovement, addLot } from "@/lib/inventory/ledger";
import { postJournal } from "@/lib/accounting/post";
import { ACC } from "@/lib/accounting/accounts";
import { isDispatchEditable, type DispatchInput } from "@/lib/contracts/stockDispatch";

/**
 * Stock Transfer Dispatch engine. Physically moves inventory: reduces the DISPATCH
 * SOURCE branch's stock (the holding/allocating branch), creates in-transit stock at
 * the DISPATCH DESTINATION (receiving branch), writes the inventory ledger and posts
 * ONLY internal-movement accounting (Inventory In-Transit Dr / Inventory Cr). NO
 * sales / purchase / GST / customer / supplier entries.
 *
 * Consistency with Stock Allocation (destination-validated): for a Transfer-Request
 * dispatch the login user is the fulfiller = the request's DESTINATION branch, so
 * dispatch.source = request.destination (where the allocation reserved stock) and
 * dispatch.destination = request.source (the requester receiving the goods).
 */
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
type Actor = AuditActor & { fullName?: string | null };

function assertBranchScope(scope: ActiveScope, branchId: number) {
  if (scope.readBranchIds?.length && !scope.readBranchIds.includes(branchId))
    throw new Error("You can only dispatch stock from your own branch.");
}

/* ------------------------------------------------------ warehouse config */
interface DispatchConfig { allocationRequired: boolean; requirePicking: boolean; binManagement: boolean; serialManagement: boolean; fefo: boolean; allowPartial: boolean }
export async function dispatchConfig(scope: ActiveScope, branchId: number | null | undefined): Promise<DispatchConfig> {
  const cfg = branchId ? await prisma.warehouseConfiguration.findFirst({ where: { tenantId: scope.tenantId, branchId }, select: { config: true } }) : null;
  const c = (cfg?.config as any) ?? {};
  return {
    allocationRequired: c.dispatch?.stockAllocationRequired ?? true,
    requirePicking: c.dispatch?.requirePicking ?? false,
    binManagement: c.inventory?.binManagement ?? false,
    serialManagement: c.inventory?.serialManagement ?? false,
    fefo: c.inventory?.fefo ?? false,
    allowPartial: c.dispatch?.allowPartialDispatch ?? true,
  };
}

/* ------------------------------------------------------ availability */
export interface DispatchAvailability { productId: number; name: string; sku: string | null; uom: string | null; policy: "Qty" | "FIFO" | "FEFO" | "Batch" | "Serial"; onHand: number; reserved: number; available: number; unitCost: number; batches: { batchNo: string | null; mfgDate: string | null; expiryDate: string | null; onHand: number }[]; serials: { serialNo: string; batchNo: string | null }[] }
function resolvePolicy(p: { invSerial?: boolean; invBatch?: boolean; valuation?: string | null } | null): DispatchAvailability["policy"] {
  if (!p) return "Qty";
  if (p.invSerial) return "Serial";
  const v = (p.valuation || "").toLowerCase();
  if (v === "fefo") return "FEFO";
  if (v === "fifo") return "FIFO";
  if (p.invBatch) return "Batch";
  return "Qty";
}
export async function availabilityAt(scope: ActiveScope, q: { productId: number; branchId: number; warehouse?: string | null; excludeAllocationId?: number }): Promise<DispatchAvailability> {
  const wh = q.warehouse || null;
  const balWhere: Prisma.InventoryBalanceWhereInput = { tenantId: scope.tenantId, productId: q.productId, branchId: q.branchId, ...(wh ? { warehouse: wh } : { warehouse: { notIn: BUCKET_WAREHOUSES } }) };
  const [product, balances, reservedAgg] = await Promise.all([
    prisma.product.findFirst({ where: { id: q.productId, tenantId: scope.tenantId }, select: { name: true, sku: true, baseUom: true, invSerial: true, invBatch: true, valuation: true } }),
    prisma.inventoryBalance.findMany({ where: balWhere, select: { qtyOnHand: true, purchaseRate: true } }),
    prisma.stockAllocationLot.aggregate({ where: { tenantId: scope.tenantId, productId: q.productId, branchId: q.branchId, status: "Active", ...(wh ? { warehouse: wh } : {}), ...(q.excludeAllocationId ? { allocationId: { not: q.excludeAllocationId } } : {}) }, _sum: { qty: true } }),
  ]);
  const onHand = r3(balances.reduce((s, b) => s + num(b.qtyOnHand), 0));
  const unitCost = r2(num(balances.find((b) => b.purchaseRate != null)?.purchaseRate));
  const reserved = r3(num(reservedAgg._sum.qty));
  const available = r3(Math.max(0, onHand - reserved));
  const policy = resolvePolicy(product);
  let batches: DispatchAvailability["batches"] = [];
  let serials: DispatchAvailability["serials"] = [];
  if (policy === "Serial") {
    const rows = await prisma.qrCodeMapping.findMany({ where: { tenantId: scope.tenantId, productId: q.productId, branchId: q.branchId, status: "Active", ...(wh ? { warehouse: wh } : {}) }, select: { serialNo: true, batchNo: true }, orderBy: { id: "asc" }, take: 500 });
    serials = rows.filter((s) => s.serialNo).map((s) => ({ serialNo: s.serialNo!, batchNo: s.batchNo }));
  } else if (policy === "FEFO" || policy === "FIFO" || policy === "Batch") {
    const orderBy: Prisma.InventoryLotOrderByWithRelationInput[] = policy === "FEFO" ? [{ expiryDate: "asc" }, { receivedDate: "asc" }, { id: "asc" }] : [{ receivedDate: "asc" }, { id: "asc" }];
    const raw = await prisma.inventoryLot.findMany({ where: { tenantId: scope.tenantId, productId: q.productId, branchId: q.branchId, qtyOnHand: { gt: 0 }, ...(wh ? { warehouse: wh } : { warehouse: { notIn: BUCKET_WAREHOUSES } }) }, orderBy, select: { batchNo: true, mfgDate: true, expiryDate: true, qtyOnHand: true } });
    const agg = new Map<string, DispatchAvailability["batches"][number]>();
    for (const l of raw) { const k = `${l.batchNo ?? ""}|${l.expiryDate ?? ""}`; const c = agg.get(k); if (c) c.onHand = r3(c.onHand + num(l.qtyOnHand)); else agg.set(k, { batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate, onHand: r3(num(l.qtyOnHand)) }); }
    batches = [...agg.values()];
  }
  return { productId: q.productId, name: product?.name ?? "", sku: product?.sku ?? null, uom: product?.baseUom ?? null, policy, onHand, reserved, available, unitCost, batches, serials };
}

/* ------------------------------------------------------ Mode 1: request lookup */
// Approved transfer requests the login user can dispatch (they are the fulfiller =
// the request's DESTINATION branch), not yet fully dispatched.
export async function listDispatchableRequests(scope: ActiveScope, q?: string) {
  const where: Prisma.StockTransferRequestWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), status: "Approved", ...(scope.readBranchIds?.length ? { destinationBranchId: { in: scope.readBranchIds } } : {}), ...(q ? { OR: [{ requestNo: { contains: q } }, { referenceDoc: { contains: q } }] } : {}) };
  const rows = await prisma.stockTransferRequest.findMany({ where, orderBy: { id: "desc" }, take: 100 });
  const bids = [...new Set(rows.flatMap((r) => [r.sourceBranchId, r.destinationBranchId]))];
  const branches = bids.length ? await prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: bids } }, select: { id: true, name: true } }) : [];
  const bn = new Map(branches.map((b) => [b.id, b.name]));
  const allocs = rows.length ? await prisma.stockAllocation.findMany({ where: { tenantId: scope.tenantId, requestId: { in: rows.map((r) => r.id) }, status: { in: ["Allocated", "Partially Allocated"] } }, select: { requestId: true, totalAllocatedQty: true } }) : [];
  const allocByReq = new Map(allocs.map((a) => [a.requestId, num(a.totalAllocatedQty)]));
  return rows.map((r) => ({ requestId: r.id, requestNo: r.requestNo, requestDate: r.requestDate, fulfiller: bn.get(r.destinationBranchId) ?? `#${r.destinationBranchId}`, receiver: bn.get(r.sourceBranchId) ?? `#${r.sourceBranchId}`, priority: r.priority, itemCount: r.itemCount, requestedQty: num(r.totalRequestedQty), allocatedQty: allocByReq.get(r.id) ?? 0, hasAllocation: allocByReq.has(r.id) }));
}

/* ------------------------------------------------------ Mode 1: request prefill */
export async function loadRequestForDispatch(scope: ActiveScope, requestId: number) {
  const req = await prisma.stockTransferRequest.findFirst({ where: { id: requestId, tenantId: scope.tenantId }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!req) throw new Error("Transfer request not found.");
  if (req.status !== "Approved") throw new Error("Only an Approved transfer request can be dispatched.");
  // The fulfiller (login) is the request's DESTINATION; stock ships FROM there.
  const sourceBranchId = req.destinationBranchId, sourceWarehouse = req.destinationWarehouse;
  const destBranchId = req.sourceBranchId, destWarehouse = req.sourceWarehouse;
  assertBranchScope(scope, sourceBranchId);
  const cfg = await dispatchConfig(scope, sourceBranchId);
  const alloc = await prisma.stockAllocation.findFirst({ where: { tenantId: scope.tenantId, requestId, status: { in: ["Allocated", "Partially Allocated"] } }, include: { lines: true, lots: { where: { status: "Active" } } } });
  const [srcName, dstName] = await Promise.all([
    prisma.branch.findFirst({ where: { id: sourceBranchId, tenantId: scope.tenantId }, select: { name: true } }),
    prisma.branch.findFirst({ where: { id: destBranchId, tenantId: scope.tenantId }, select: { name: true } }),
  ]);

  // Build dispatch items. When an allocation exists, dispatch exactly the reserved
  // lots (grouped per product+batch, serials collected); else dispatch requested qty.
  const items: any[] = [];
  if (alloc && cfg.allocationRequired) {
    const lineByProduct = new Map(alloc.lines.map((l) => [l.productId, l]));
    const byKey = new Map<string, any>();
    for (const lot of alloc.lots) {
      const key = `${lot.productId}|${lot.batchNo ?? ""}|${lot.expiryDate ?? ""}`;
      const line = lineByProduct.get(lot.productId);
      let it = byKey.get(key);
      if (!it) { it = { productId: lot.productId, batchNo: lot.batchNo, mfgDate: lot.mfgDate, expiryDate: lot.expiryDate, serials: [] as string[], allocatedQty: 0, requestedQty: num(line?.requestedQty), productName: line?.productName ?? "", sku: line?.sku ?? null, uom: line?.uom ?? null }; byKey.set(key, it); }
      it.allocatedQty = r3(it.allocatedQty + num(lot.qty));
      if (lot.serialNo) it.serials.push(lot.serialNo);
    }
    for (const it of byKey.values()) {
      const av = await availabilityAt(scope, { productId: it.productId, branchId: sourceBranchId, warehouse: sourceWarehouse, excludeAllocationId: alloc.id });
      items.push({ ...it, availableQty: av.available, unitCost: av.unitCost, dispatchQty: it.allocatedQty, policy: av.policy });
    }
  } else {
    for (const line of req.lines) {
      const av = await availabilityAt(scope, { productId: line.productId, branchId: sourceBranchId, warehouse: sourceWarehouse });
      items.push({ productId: line.productId, productName: line.productName, sku: line.sku, uom: line.uom, batchNo: null, mfgDate: null, expiryDate: null, serials: [], requestedQty: num(line.requestedQty), allocatedQty: 0, availableQty: av.available, unitCost: av.unitCost, dispatchQty: Math.min(num(line.requestedQty), av.available), policy: av.policy });
    }
  }
  return {
    header: { referenceId: req.id, referenceNo: req.requestNo, allocationId: alloc?.id ?? null, transferType: req.transferType, priority: req.priority,
      sourceBranchId, sourceName: srcName?.name ?? "", sourceWarehouse, destinationBranchId: destBranchId, destinationName: dstName?.name ?? "", destinationWarehouse: destWarehouse },
    items, config: cfg,
  };
}

/* ------------------------------------------------------ Mode 2: direct options */
export async function directDispatchOptions(scope: ActiveScope) {
  const officeIds = (await prisma.entityType.findMany({ where: { tenantId: scope.tenantId }, select: { id: true, name: true } })).filter((e) => /office/i.test(e.name)).map((e) => e.id);
  const bizWhere: Prisma.BranchWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), status: "active" };
  const [srcName, destinations] = await Promise.all([
    scope.branchId ? prisma.branch.findFirst({ where: { id: scope.branchId, tenantId: scope.tenantId }, select: { name: true } }) : null,
    prisma.branch.findMany({ where: { ...bizWhere, ...(officeIds.length ? { entityTypeId: { notIn: officeIds } } : {}), ...(scope.branchId ? { id: { not: scope.branchId } } : {}) }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);
  return { sourceBranchId: scope.branchId ?? null, sourceName: srcName?.name ?? "", destinationBranches: destinations, config: await dispatchConfig(scope, scope.branchId) };
}

/* ------------------------------------------------------ create / update */
async function resolveHeader(scope: ActiveScope, input: DispatchInput) {
  if (input.dispatchType === "Transfer Request Based") {
    if (!input.referenceId) throw new Error("Select a transfer request.");
    const req = await prisma.stockTransferRequest.findFirst({ where: { id: input.referenceId, tenantId: scope.tenantId }, select: { destinationBranchId: true, destinationWarehouse: true, sourceBranchId: true, sourceWarehouse: true, requestNo: true, status: true } });
    if (!req) throw new Error("Transfer request not found.");
    if (req.status !== "Approved") throw new Error("Only an Approved transfer request can be dispatched.");
    assertBranchScope(scope, req.destinationBranchId);
    const alloc = await prisma.stockAllocation.findFirst({ where: { tenantId: scope.tenantId, requestId: input.referenceId, status: { in: ["Allocated", "Partially Allocated"] } }, select: { id: true } });
    return { referenceType: "TRANSFER_REQUEST", referenceId: input.referenceId, referenceNo: req.requestNo, allocationId: alloc?.id ?? null, sourceBranchId: req.destinationBranchId, sourceWarehouse: req.destinationWarehouse, destinationBranchId: req.sourceBranchId, destinationWarehouse: req.sourceWarehouse };
  }
  // Direct dispatch — login branch is the source.
  if (!scope.branchId) throw new Error("A branch context is required for a direct dispatch.");
  return { referenceType: null, referenceId: null, referenceNo: null, allocationId: null, sourceBranchId: scope.branchId, sourceWarehouse: input.sourceWarehouse ?? null, destinationBranchId: input.destinationBranchId, destinationWarehouse: input.destinationWarehouse ?? null };
}

export async function createDispatch(scope: ActiveScope, user: Actor, input: DispatchInput) {
  const h = await resolveHeader(scope, input);
  if (h.sourceBranchId === h.destinationBranchId) throw new Error("Source and destination branch cannot be the same.");
  const items = input.items.filter((i) => i.productId > 0);
  const totalQty = r3(items.reduce((s, i) => s + num(i.dispatchQty), 0));
  return prisma.$transaction(async (tx) => {
    const d = await tx.stockTransferDispatch.create({
      data: {
        tenantId: scope.tenantId, businessId: scope.businessId, branchId: h.sourceBranchId, dispatchNo: "TMP", dispatchDate: (input.dispatchDate || today()).slice(0, 10), dispatchType: input.dispatchType,
        referenceType: h.referenceType, referenceId: h.referenceId, referenceNo: h.referenceNo, allocationId: h.allocationId,
        sourceBranchId: h.sourceBranchId, sourceWarehouse: h.sourceWarehouse, destinationBranchId: h.destinationBranchId, destinationWarehouse: h.destinationWarehouse,
        vehicleNo: input.vehicleNo || null, driverName: input.driverName || null, transportName: input.transportName || null, lrNumber: input.lrNumber || null, expectedDeliveryDate: input.expectedDeliveryDate || null,
        priority: input.priority || "Normal", status: "Draft", approvalStatus: "NotRequired", remarks: input.remarks || null, totalItems: items.length, totalDispatchQty: totalQty, totalValue: r2(items.reduce((s, i) => s + num(i.dispatchQty) * num(i.unitCost), 0)),
        createdBy: user?.id ?? null, createdByName: user?.fullName ?? null,
        items: { create: items.map((i) => ({ tenantId: scope.tenantId, productId: i.productId, productName: i.productName, sku: i.sku || null, uom: i.uom || null, batchNo: i.batchNo || null, mfgDate: i.mfgDate || null, expiryDate: i.expiryDate || null, serials: i.serials?.length ? JSON.stringify(i.serials) : null, availableQty: r3(num(i.availableQty)), requestedQty: r3(num(i.requestedQty)), allocatedQty: r3(num(i.allocatedQty)), pickedQty: r3(num(i.pickedQty)), dispatchQty: r3(num(i.dispatchQty)), unitCost: r2(num(i.unitCost)), stockValue: r2(num(i.dispatchQty) * num(i.unitCost)), remarks: i.remarks || null })) },
      },
    });
    const dispatchNo = `DISP-${String(d.id).padStart(5, "0")}`;
    await tx.stockTransferDispatch.update({ where: { id: d.id }, data: { dispatchNo } });
    await writeAudit(tx, user, { action: "stock_dispatch.create", entity: "StockTransferDispatch", entityId: d.id, summary: `Created dispatch ${dispatchNo} (${input.dispatchType})`, businessId: scope.businessId, meta: { type: input.dispatchType, items: items.length } });
    return { id: d.id, dispatchNo };
  });
}

export async function updateDispatch(scope: ActiveScope, user: Actor, id: number, input: DispatchInput) {
  const ex = await prisma.stockTransferDispatch.findFirst({ where: { id, tenantId: scope.tenantId }, select: { status: true, dispatchNo: true, sourceBranchId: true } });
  if (!ex) throw new Error("Dispatch not found.");
  if (!isDispatchEditable(ex.status)) throw new Error(`A ${ex.status} dispatch cannot be edited.`);
  assertBranchScope(scope, ex.sourceBranchId);
  const items = input.items.filter((i) => i.productId > 0);
  return prisma.$transaction(async (tx) => {
    await tx.stockTransferDispatchItem.deleteMany({ where: { dispatchId: id } });
    await tx.stockTransferDispatch.update({
      where: { id }, data: {
        dispatchDate: (input.dispatchDate || today()).slice(0, 10), vehicleNo: input.vehicleNo || null, driverName: input.driverName || null, transportName: input.transportName || null, lrNumber: input.lrNumber || null, expectedDeliveryDate: input.expectedDeliveryDate || null,
        priority: input.priority || "Normal", remarks: input.remarks || null, destinationWarehouse: input.destinationWarehouse ?? null, totalItems: items.length, totalDispatchQty: r3(items.reduce((s, i) => s + num(i.dispatchQty), 0)), totalValue: r2(items.reduce((s, i) => s + num(i.dispatchQty) * num(i.unitCost), 0)),
        items: { create: items.map((i) => ({ tenantId: scope.tenantId, productId: i.productId, productName: i.productName, sku: i.sku || null, uom: i.uom || null, batchNo: i.batchNo || null, mfgDate: i.mfgDate || null, expiryDate: i.expiryDate || null, serials: i.serials?.length ? JSON.stringify(i.serials) : null, availableQty: r3(num(i.availableQty)), requestedQty: r3(num(i.requestedQty)), allocatedQty: r3(num(i.allocatedQty)), pickedQty: r3(num(i.pickedQty)), dispatchQty: r3(num(i.dispatchQty)), unitCost: r2(num(i.unitCost)), stockValue: r2(num(i.dispatchQty) * num(i.unitCost)), remarks: i.remarks || null })) },
      },
    });
    await writeAudit(tx, user, { action: "stock_dispatch.update", entity: "StockTransferDispatch", entityId: id, summary: `Updated dispatch ${ex.dispatchNo}`, businessId: scope.businessId });
    return { id, dispatchNo: ex.dispatchNo };
  });
}

/* ------------------------------------------------------ validate (dry-run) */
export async function validateDispatch(scope: ActiveScope, id: number) {
  const d = await prisma.stockTransferDispatch.findFirst({ where: { id, tenantId: scope.tenantId }, include: { items: true } });
  if (!d) throw new Error("Dispatch not found.");
  const errors: string[] = [];
  for (const it of d.items) {
    if (num(it.dispatchQty) <= 0) continue;
    const av = await availabilityAt(scope, { productId: it.productId, branchId: d.sourceBranchId, warehouse: d.sourceWarehouse, excludeAllocationId: d.allocationId ?? undefined });
    if (num(it.dispatchQty) > av.available + 0.001) errors.push(`${it.productName}: dispatch ${num(it.dispatchQty)} exceeds available ${av.available}.`);
    if (num(it.allocatedQty) > 0 && num(it.dispatchQty) > num(it.allocatedQty) + 0.001) errors.push(`${it.productName}: dispatch ${num(it.dispatchQty)} exceeds allocated ${num(it.allocatedQty)}.`);
  }
  return { ok: errors.length === 0, errors };
}

/* ------------------------------------------------------ POST dispatch (the real move) */
export async function postDispatch(scope: ActiveScope, user: Actor, id: number) {
  const d = await prisma.stockTransferDispatch.findFirst({ where: { id, tenantId: scope.tenantId }, include: { items: true } });
  if (!d) throw new Error("Dispatch not found.");
  if (!isDispatchEditable(d.status)) throw new Error(`A ${d.status} dispatch has already been posted.`);
  assertBranchScope(scope, d.sourceBranchId);
  const { errors } = await validateDispatch(scope, id);
  if (errors.length) throw new Error(errors[0]);

  const product = new Map<number, { fefo: boolean }>();
  for (const it of d.items) if (!product.has(it.productId)) { const p = await prisma.product.findFirst({ where: { id: it.productId, tenantId: scope.tenantId }, select: { valuation: true } }); product.set(it.productId, { fefo: (p?.valuation || "").toLowerCase() === "fefo" }); }

  let totalValue = 0, totalQty = 0, anyPartial = false;
  const result = await prisma.$transaction(async (tx) => {
    for (const it of d.items) {
      const qty = r3(num(it.dispatchQty));
      if (qty <= 0) continue;
      const fefo = product.get(it.productId)!.fefo;
      // 1) reduce SOURCE lots (FIFO/FEFO or the specific reserved batch)
      const consumed = await consumeLots(tx, scope.tenantId, d.sourceBranchId, it.productId, d.sourceWarehouse, qty, { batchNo: it.batchNo, fefo });
      const cost = consumed.cost > 0 ? consumed.cost : r2(qty * num(it.unitCost));
      const unitCost = qty > 0 ? r2(cost / qty) : num(it.unitCost);
      const batchNo = it.batchNo ?? consumed.batchNo;
      const mfgDate = it.mfgDate ?? consumed.mfgDate;
      const expiryDate = it.expiryDate ?? consumed.expiryDate;
      // 2) SOURCE out movement (reduces balance + ledger)
      await postMovement(tx, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: d.sourceBranchId, productId: it.productId, txnType: "TRANSFER_OUT", direction: "OUT", qty, rate: unitCost, warehouse: d.sourceWarehouse, batchNo, mfgDate, expiryDate, refType: "TRANSFER_DISPATCH", refId: d.id, refNo: d.dispatchNo, txnDate: d.dispatchDate, createdBy: user?.id ?? null, remarks: `To ${d.destinationBranchId}` });
      // 3) DESTINATION in-transit lot + in movement
      await addLot(tx, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: d.destinationBranchId, productId: it.productId, warehouse: IN_TRANSIT_WAREHOUSE, batchNo, mfgDate, expiryDate, refType: "TRANSFER_DISPATCH", refId: d.id, refNo: d.dispatchNo, receivedDate: d.dispatchDate, qty, unitRate: unitCost });
      await postMovement(tx, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: d.destinationBranchId, productId: it.productId, txnType: "TRANSFER_IN", direction: "IN", qty, rate: unitCost, warehouse: IN_TRANSIT_WAREHOUSE, batchNo, mfgDate, expiryDate, refType: "TRANSFER_DISPATCH", refId: d.id, refNo: d.dispatchNo, txnDate: d.dispatchDate, createdBy: user?.id ?? null, remarks: "In-transit" });
      // 4) serials → Transferred, moved to destination in-transit
      const serials: string[] = it.serials ? (JSON.parse(it.serials) as string[]) : [];
      if (serials.length) await tx.qrCodeMapping.updateMany({ where: { tenantId: scope.tenantId, productId: it.productId, serialNo: { in: serials }, status: "Active" }, data: { status: "Transferred", branchId: d.destinationBranchId, warehouse: IN_TRANSIT_WAREHOUSE } });
      await tx.stockTransferDispatchItem.update({ where: { id: it.id }, data: { unitCost, stockValue: r2(cost), batchNo, mfgDate, expiryDate } });
      totalValue = r2(totalValue + cost); totalQty = r3(totalQty + qty);
      if (num(it.requestedQty) > 0 && qty < num(it.requestedQty) - 0.001) anyPartial = true;
    }

    // 5) consume the allocation reservations + advance the transfer request
    if (d.allocationId) {
      await tx.stockAllocationLot.updateMany({ where: { allocationId: d.allocationId, status: "Active" }, data: { status: "Dispatched" } });
      const remaining = await tx.stockAllocationLot.count({ where: { allocationId: d.allocationId, status: "Active" } });
      if (remaining === 0) await tx.stockAllocation.update({ where: { id: d.allocationId }, data: { status: "Released" } });
    }
    if (d.referenceType === "TRANSFER_REQUEST" && d.referenceId) {
      const req = await tx.stockTransferRequest.findUnique({ where: { id: d.referenceId }, select: { totalRequestedQty: true, totalDispatchedQty: true } });
      const dispatched = r3(num(req?.totalDispatchedQty) + totalQty);
      const reqStatus = dispatched >= num(req?.totalRequestedQty) - 0.001 ? "Fully Dispatched" : "Partially Dispatched";
      await tx.stockTransferRequest.update({ where: { id: d.referenceId }, data: { totalDispatchedQty: dispatched, status: reqStatus } });
    }

    // 6) internal-movement accounting only: Dr Inventory In-Transit, Cr Inventory
    if (totalValue > 0.004) {
      await postJournal(tx, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: d.sourceBranchId, voucherType: "TRANSFER", prefix: "TF", date: d.dispatchDate, narration: `Stock transfer dispatch — ${d.dispatchNo}`, sourceType: "TRANSFER_DISPATCH", sourceId: d.id, refNo: d.dispatchNo, createdBy: user?.id ?? null, lines: [
        { code: ACC.INVENTORY_IN_TRANSIT, debit: totalValue, narration: "Stock dispatched (in-transit)" },
        { code: ACC.INVENTORY, credit: totalValue, narration: "Inventory issued from source" },
      ] });
    }

    const status = anyPartial ? "Partially Dispatched" : "Dispatched";
    await tx.stockTransferDispatch.update({ where: { id }, data: { status, totalDispatchQty: totalQty, totalValue, dispatchedAt: new Date(), lockedAt: new Date() } });
    await writeAudit(tx, user, { action: "stock_dispatch.dispatch", entity: "StockTransferDispatch", entityId: id, summary: `Dispatched ${d.dispatchNo} → ${status} (qty ${totalQty}, value ${totalValue})`, businessId: scope.businessId, meta: { status, totalQty, totalValue } });
    return { status, totalQty, totalValue };
  });
  return result;
}

/* ------------------------------------------------------ cancel (Draft only) */
export async function cancelDispatch(scope: ActiveScope, user: Actor, id: number, remarks?: string) {
  const d = await prisma.stockTransferDispatch.findFirst({ where: { id, tenantId: scope.tenantId }, select: { status: true, dispatchNo: true, sourceBranchId: true } });
  if (!d) throw new Error("Dispatch not found.");
  assertBranchScope(scope, d.sourceBranchId);
  if (d.status === "Cancelled") throw new Error("Dispatch is already cancelled.");
  if (d.status !== "Draft") throw new Error("A posted dispatch cannot be cancelled — process a Transfer Return instead.");
  await prisma.stockTransferDispatch.update({ where: { id }, data: { status: "Cancelled", cancelledAt: new Date(), remarks: remarks ?? undefined } });
  await writeAudit(prisma, user, { action: "stock_dispatch.cancel", entity: "StockTransferDispatch", entityId: id, summary: `Cancelled dispatch ${d.dispatchNo}`, businessId: scope.businessId });
  return { status: "Cancelled" };
}

/* ------------------------------------------------------ delivery challan */
export async function generateChallan(scope: ActiveScope, user: Actor, id: number) {
  const d = await prisma.stockTransferDispatch.findFirst({ where: { id, tenantId: scope.tenantId }, select: { status: true, challanNo: true, dispatchNo: true, sourceBranchId: true } });
  if (!d) throw new Error("Dispatch not found.");
  if (d.status !== "Dispatched" && d.status !== "Partially Dispatched") throw new Error("A delivery challan can be generated only after dispatch.");
  if (d.challanNo) return { challanNo: d.challanNo, existing: true };
  const challanNo = `DC-${String(id).padStart(5, "0")}`;
  await prisma.stockTransferDispatch.update({ where: { id }, data: { challanNo, challanGeneratedAt: new Date() } });
  await writeAudit(prisma, user, { action: "stock_dispatch.challan", entity: "StockTransferDispatch", entityId: id, summary: `Generated delivery challan ${challanNo} for ${d.dispatchNo}`, businessId: scope.businessId });
  return { challanNo, existing: false };
}

/* ------------------------------------------------------ list / get */
export async function listDispatches(scope: ActiveScope, f: { q?: string; from?: string; to?: string; status?: string; type?: string; history?: boolean }) {
  const where: Prisma.StockTransferDispatchWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  if (f.history) where.status = { in: ["Dispatched", "Partially Dispatched", "Cancelled"] };
  else if (f.status && f.status !== "All") where.status = f.status;
  if (f.type && f.type !== "All") where.dispatchType = f.type;
  if (f.q) where.OR = [{ dispatchNo: { contains: f.q } }, { referenceNo: { contains: f.q } }, { challanNo: { contains: f.q } }];
  if (f.from || f.to) where.dispatchDate = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  const rows = await prisma.stockTransferDispatch.findMany({ where, orderBy: { id: "desc" }, take: 200 });
  const bids = [...new Set(rows.flatMap((r) => [r.sourceBranchId, r.destinationBranchId]))];
  const branches = bids.length ? await prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: bids } }, select: { id: true, name: true } }) : [];
  const bn = new Map(branches.map((b) => [b.id, b.name]));
  return rows.map((r) => ({ id: r.id, dispatchNo: r.dispatchNo, dispatchDate: r.dispatchDate, dispatchType: r.dispatchType, referenceNo: r.referenceNo, source: bn.get(r.sourceBranchId) ?? `#${r.sourceBranchId}`, destination: bn.get(r.destinationBranchId) ?? `#${r.destinationBranchId}`, priority: r.priority, totalItems: r.totalItems, totalDispatchQty: num(r.totalDispatchQty), totalValue: num(r.totalValue), status: r.status, challanNo: r.challanNo, createdByName: r.createdByName, createdAt: r.createdAt }));
}

export async function getDispatch(scope: ActiveScope, id: number) {
  const d = await prisma.stockTransferDispatch.findFirst({ where: { id, tenantId: scope.tenantId }, include: { items: { orderBy: { id: "asc" } } } });
  if (!d) return null;
  const branches = await prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: [d.sourceBranchId, d.destinationBranchId] } }, select: { id: true, name: true, code: true } });
  const bn = new Map(branches.map((b) => [b.id, b]));
  return {
    header: { id: d.id, dispatchNo: d.dispatchNo, dispatchDate: d.dispatchDate, dispatchType: d.dispatchType, referenceType: d.referenceType, referenceNo: d.referenceNo, allocationId: d.allocationId, priority: d.priority, status: d.status, approvalStatus: d.approvalStatus, remarks: d.remarks,
      vehicleNo: d.vehicleNo, driverName: d.driverName, transportName: d.transportName, lrNumber: d.lrNumber, expectedDeliveryDate: d.expectedDeliveryDate, challanNo: d.challanNo, challanGeneratedAt: d.challanGeneratedAt, dispatchedAt: d.dispatchedAt, createdByName: d.createdByName,
      totalItems: d.totalItems, totalDispatchQty: num(d.totalDispatchQty), totalValue: num(d.totalValue),
      sourceBranchId: d.sourceBranchId, sourceName: bn.get(d.sourceBranchId)?.name ?? "", sourceWarehouse: d.sourceWarehouse, destinationBranchId: d.destinationBranchId, destinationName: bn.get(d.destinationBranchId)?.name ?? "", destinationWarehouse: d.destinationWarehouse },
    items: d.items.map((i) => ({ id: i.id, productId: i.productId, productName: i.productName, sku: i.sku, uom: i.uom, batchNo: i.batchNo, mfgDate: i.mfgDate, expiryDate: i.expiryDate, serials: i.serials ? (JSON.parse(i.serials) as string[]) : [], availableQty: num(i.availableQty), requestedQty: num(i.requestedQty), allocatedQty: num(i.allocatedQty), dispatchQty: num(i.dispatchQty), unitCost: num(i.unitCost), stockValue: num(i.stockValue), remarks: i.remarks })),
    editable: isDispatchEditable(d.status),
  };
}

/* ------------------------------------------------------ dashboard KPIs */
export async function dispatchKpis(scope: ActiveScope) {
  const where: Prisma.StockTransferDispatchWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  const [todayRows, drafts, posted] = await Promise.all([
    prisma.stockTransferDispatch.count({ where: { ...where, dispatchDate: today(), status: { in: ["Dispatched", "Partially Dispatched"] } } }),
    prisma.stockTransferDispatch.count({ where: { ...where, status: "Draft" } }),
    prisma.stockTransferDispatch.aggregate({ where: { ...where, status: { in: ["Dispatched", "Partially Dispatched"] } }, _sum: { totalDispatchQty: true, totalValue: true } }),
  ]);
  const inTransit = await prisma.inventoryBalance.aggregate({ where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), warehouse: IN_TRANSIT_WAREHOUSE, qtyOnHand: { gt: 0 } }, _sum: { qtyOnHand: true } });
  return { todayDispatch: todayRows, pendingDispatch: drafts, inTransitQty: r3(num(inTransit._sum.qtyOnHand)), dispatchedQty: r3(num(posted._sum.totalDispatchQty)), dispatchValue: r2(num(posted._sum.totalValue)) };
}
