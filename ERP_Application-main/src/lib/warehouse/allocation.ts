import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { writeAudit, type AuditActor } from "@/lib/audit/log";
import { BUCKET_WAREHOUSES } from "@/lib/inventory/buckets";
import { ALLOC_STATUSES, isAllocationEditable, type AllocPolicy, type AllocateInput, type SaveDraftInput } from "@/lib/contracts/stockAllocation";

/**
 * Stock Allocation engine. Reserves inventory against an approved Stock Transfer
 * Request. Reservation lives ONLY in stock_allocation_lots (status Active); physical
 * inventory_balances / inventory_lots are never mutated — no ledger, no accounting.
 * Available = physical on-hand − sum(active reservations). Allocation follows the
 * product master policy (FIFO / FEFO / Serial / Batch) or plain qty.
 */
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
type Actor = AuditActor & { fullName?: string | null };

/** Allocation is done by the DESTINATION branch (the stock-receiving entity) and is
 * validated against the destination's own stock, so a branch-scoped user may only
 * allocate requests destined to one of their branches (business-level users pass). */
function assertBranchScope(scope: ActiveScope, destinationBranchId: number) {
  if (scope.readBranchIds?.length && !scope.readBranchIds.includes(destinationBranchId))
    throw new Error("You can only allocate requests destined to your own branch — log in as the destination branch to allocate this request.");
}

/* --------------------------------------------------- warehouse config gate */
/** Reads config.dispatch.stockAllocationRequired for a branch (default: true). */
export async function allocationRequiredForBranch(scope: ActiveScope, branchId: number | null | undefined): Promise<boolean> {
  if (!branchId) return true;
  const cfg = await prisma.warehouseConfiguration.findFirst({ where: { tenantId: scope.tenantId, branchId }, select: { config: true } });
  const dispatch = (cfg?.config as { dispatch?: { stockAllocationRequired?: boolean } } | null)?.dispatch;
  return dispatch?.stockAllocationRequired ?? true;
}

/* --------------------------------------------------- policy + availability */
function resolvePolicy(p: { invSerial?: boolean; invBatch?: boolean; valuation?: string | null } | null): AllocPolicy {
  if (!p) return "Qty";
  if (p.invSerial) return "Serial";
  const val = (p.valuation || "").toLowerCase();
  if (val === "fefo") return "FEFO";
  if (val === "fifo") return "FIFO";
  if (p.invBatch) return "Batch"; // batch-tracked without valuation → FIFO order
  return "Qty";
}
const lotKey = (b: string | null | undefined, e: string | null | undefined) => `${b ?? ""}|${e ?? ""}`;

/** Sum of ACTIVE reservations for a product at a branch (optionally a warehouse),
 * broken down for aggregate qty, per-batch and per-serial availability. */
async function activeReservations(scope: ActiveScope, productId: number, branchId: number, warehouse?: string | null, excludeAllocationId?: number) {
  const rows = await prisma.stockAllocationLot.findMany({
    where: { tenantId: scope.tenantId, productId, branchId, status: "Active", ...(warehouse ? { warehouse } : {}), ...(excludeAllocationId ? { allocationId: { not: excludeAllocationId } } : {}) },
    select: { qty: true, batchNo: true, expiryDate: true, serialNo: true },
  });
  let total = 0;
  const byLot = new Map<string, number>();
  const serials = new Set<string>();
  for (const r of rows) {
    const q = num(r.qty); total += q;
    byLot.set(lotKey(r.batchNo, r.expiryDate), (byLot.get(lotKey(r.batchNo, r.expiryDate)) ?? 0) + q);
    if (r.serialNo) serials.add(r.serialNo);
  }
  return { total: r3(total), byLot, serials };
}

export interface ProductAvailability {
  productId: number; name: string; sku: string | null; uom: string | null; policy: AllocPolicy;
  onHand: number; reserved: number; available: number;
  order: "FEFO" | "FIFO" | null;
  lots: { priority: number; batchNo: string | null; mfgDate: string | null; expiryDate: string | null; onHand: number; reserved: number; available: number }[];
  serials: { serialNo: string; batchNo: string | null; expiryDate: string | null }[];
}
export async function productAvailability(scope: ActiveScope, q: { productId: number; branchId: number; warehouse?: string | null; excludeAllocationId?: number }): Promise<ProductAvailability> {
  const wh = q.warehouse || null;
  const [product, balAgg, res] = await Promise.all([
    prisma.product.findFirst({ where: { id: q.productId, tenantId: scope.tenantId }, select: { name: true, sku: true, baseUom: true, invSerial: true, invBatch: true, valuation: true } }),
    prisma.inventoryBalance.aggregate({ where: { tenantId: scope.tenantId, productId: q.productId, branchId: q.branchId, ...(wh ? { warehouse: wh } : { warehouse: { notIn: BUCKET_WAREHOUSES } }) }, _sum: { qtyOnHand: true } }),
    activeReservations(scope, q.productId, q.branchId, wh, q.excludeAllocationId),
  ]);
  const policy = resolvePolicy(product);
  const onHand = r3(num(balAgg._sum.qtyOnHand));
  const reserved = res.total;
  const available = r3(Math.max(0, onHand - reserved));
  const order: "FEFO" | "FIFO" | null = policy === "FEFO" ? "FEFO" : policy === "FIFO" || policy === "Batch" ? "FIFO" : null;

  let lots: ProductAvailability["lots"] = [];
  let serials: ProductAvailability["serials"] = [];

  if (policy === "Serial") {
    const rows = await prisma.qrCodeMapping.findMany({ where: { tenantId: scope.tenantId, productId: q.productId, branchId: q.branchId, status: "Active", ...(wh ? { warehouse: wh } : {}) }, select: { serialNo: true, batchNo: true, expiryDate: true }, orderBy: { id: "asc" }, take: 500 });
    serials = rows.filter((s) => s.serialNo && !res.serials.has(s.serialNo)).map((s) => ({ serialNo: s.serialNo!, batchNo: s.batchNo, expiryDate: s.expiryDate }));
  } else if (policy === "FEFO" || policy === "FIFO" || policy === "Batch") {
    const orderBy: Prisma.InventoryLotOrderByWithRelationInput[] = order === "FEFO"
      ? [{ expiryDate: "asc" }, { receivedDate: "asc" }, { id: "asc" }]
      : [{ receivedDate: "asc" }, { id: "asc" }];
    const raw = await prisma.inventoryLot.findMany({ where: { tenantId: scope.tenantId, productId: q.productId, branchId: q.branchId, qtyOnHand: { gt: 0 }, ...(wh ? { warehouse: wh } : { warehouse: { notIn: BUCKET_WAREHOUSES } }) }, orderBy, select: { batchNo: true, mfgDate: true, expiryDate: true, qtyOnHand: true } });
    const agg = new Map<string, { batchNo: string | null; mfgDate: string | null; expiryDate: string | null; onHand: number }>();
    for (const l of raw) { const k = lotKey(l.batchNo, l.expiryDate); const c = agg.get(k); if (c) c.onHand += num(l.qtyOnHand); else agg.set(k, { batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate, onHand: num(l.qtyOnHand) }); }
    lots = [...agg.values()].map((b, i) => { const rsv = res.byLot.get(lotKey(b.batchNo, b.expiryDate)) ?? 0; return { priority: i + 1, batchNo: b.batchNo, mfgDate: b.mfgDate, expiryDate: b.expiryDate, onHand: r3(b.onHand), reserved: r3(rsv), available: r3(Math.max(0, b.onHand - rsv)) }; });
  }
  return { productId: q.productId, name: product?.name ?? "", sku: product?.sku ?? null, uom: product?.baseUom ?? null, policy, onHand, reserved, available, order, lots, serials };
}

/* --------------------------------------------------- reservation builder */
interface ReservationRow { batchNo: string | null; mfgDate: string | null; expiryDate: string | null; serialNo: string | null; qty: number }
/** Build the reservation rows for a qty by policy (excluding this allocation's own
 * lots, which the caller releases first). Throws if not enough available. */
async function buildReservation(scope: ActiveScope, opts: { productId: number; branchId: number; warehouse?: string | null; qty: number; serials?: string[]; excludeAllocationId: number; productName: string }): Promise<ReservationRow[]> {
  const av = await productAvailability(scope, { productId: opts.productId, branchId: opts.branchId, warehouse: opts.warehouse, excludeAllocationId: opts.excludeAllocationId });
  const qty = r3(opts.qty);
  if (qty <= 0) return [];
  if (qty > av.available + 0.001) throw new Error(`"${opts.productName}": cannot allocate ${qty} — only ${av.available} available.`);

  if (av.policy === "Serial") {
    const chosen = (opts.serials ?? []).filter(Boolean);
    if (chosen.length !== Math.round(qty)) throw new Error(`"${opts.productName}": select exactly ${Math.round(qty)} serial number(s).`);
    const avail = new Set(av.serials.map((s) => s.serialNo));
    for (const s of chosen) if (!avail.has(s)) throw new Error(`"${opts.productName}": serial ${s} is not available.`);
    const meta = new Map(av.serials.map((s) => [s.serialNo, s]));
    return chosen.map((s) => ({ batchNo: meta.get(s)?.batchNo ?? null, mfgDate: null, expiryDate: meta.get(s)?.expiryDate ?? null, serialNo: s, qty: 1 }));
  }
  if (av.policy === "FEFO" || av.policy === "FIFO" || av.policy === "Batch") {
    const rows: ReservationRow[] = [];
    let left = qty;
    for (const lot of av.lots) {
      if (left <= 0.001) break;
      const take = Math.min(left, lot.available);
      if (take > 0.001) { rows.push({ batchNo: lot.batchNo, mfgDate: lot.mfgDate, expiryDate: lot.expiryDate, serialNo: null, qty: r3(take) }); left = r3(left - take); }
    }
    // Any residual (stock exists on-hand but not lot-tracked) → a plain reservation.
    if (left > 0.001) rows.push({ batchNo: null, mfgDate: null, expiryDate: null, serialNo: null, qty: r3(left) });
    return rows;
  }
  return [{ batchNo: null, mfgDate: null, expiryDate: null, serialNo: null, qty }];
}

/* ------------------------------------------------------------- list / get */
export async function listPendingRequests(scope: ActiveScope) {
  // Allocation is validated against the DESTINATION branch's stock (the receiving
  // entity), so only requests destined to the login user's branch are allocatable —
  // the Available qty shown is then the logged-in user's own inventory. Business-level
  // users (no branch scope) can allocate for any branch in the business.
  const srcWhere: Prisma.StockTransferRequestWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), status: "Approved", ...(scope.readBranchIds?.length ? { destinationBranchId: { in: scope.readBranchIds } } : {}) };
  const reqs = await prisma.stockTransferRequest.findMany({ where: srcWhere, orderBy: { id: "desc" }, take: 200 });
  const ids = reqs.map((r) => r.id);
  const [allocs, branches] = await Promise.all([
    ids.length ? prisma.stockAllocation.findMany({ where: { tenantId: scope.tenantId, requestId: { in: ids }, status: { notIn: ["Cancelled"] } }, select: { requestId: true, totalAllocatedQty: true, status: true } }) : [],
    prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: [...new Set(reqs.flatMap((r) => [r.sourceBranchId, r.destinationBranchId]))] } }, select: { id: true, name: true } }),
  ]);
  const bn = new Map(branches.map((b) => [b.id, b.name]));
  const allocByReq = new Map<number, { qty: number; status: string }>();
  for (const a of allocs) allocByReq.set(a.requestId, { qty: num(a.totalAllocatedQty), status: a.status });
  return reqs.map((r) => {
    const a = allocByReq.get(r.id);
    const requested = num(r.totalRequestedQty);
    const allocated = a?.qty ?? 0;
    const allocStatus = !a ? "Not Allocated" : allocated >= requested - 0.001 ? "Allocated" : "Partially Allocated";
    return { requestId: r.id, requestNo: r.requestNo, requestDate: r.requestDate, transferType: r.transferType, source: bn.get(r.sourceBranchId) ?? `#${r.sourceBranchId}`, destination: bn.get(r.destinationBranchId) ?? `#${r.destinationBranchId}`, priority: r.priority, itemCount: r.itemCount, requestedQty: r3(requested), allocatedQty: r3(allocated), allocStatus };
  }).filter((r) => r.allocStatus !== "Allocated"); // pending = not fully allocated yet
}

export async function listAllocations(scope: ActiveScope, f: { q?: string; from?: string; to?: string; status?: string; history?: boolean }) {
  const where: Prisma.StockAllocationWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  if (f.history) where.status = { in: ["Released", "Cancelled"] };
  else if (f.status && f.status !== "All") where.status = f.status;
  if (f.q) where.OR = [{ allocationNo: { contains: f.q } }, { requestNo: { contains: f.q } }];
  if (f.from || f.to) where.allocationDate = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  const rows = await prisma.stockAllocation.findMany({ where, orderBy: { id: "desc" }, take: 200 });
  const bids = [...new Set(rows.flatMap((r) => [r.sourceBranchId, r.destinationBranchId]))];
  const branches = bids.length ? await prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: bids } }, select: { id: true, name: true } }) : [];
  const bn = new Map(branches.map((b) => [b.id, b.name]));
  return rows.map((r) => ({ id: r.id, allocationNo: r.allocationNo, allocationDate: r.allocationDate, requestNo: r.requestNo, source: bn.get(r.sourceBranchId) ?? `#${r.sourceBranchId}`, destination: bn.get(r.destinationBranchId) ?? `#${r.destinationBranchId}`, priority: r.priority, totalItems: r.totalItems, totalRequestedQty: num(r.totalRequestedQty), totalAllocatedQty: num(r.totalAllocatedQty), status: r.status, allocatedByName: r.allocatedByName, createdAt: r.createdAt }));
}

export async function getAllocation(scope: ActiveScope, id: number) {
  const a = await prisma.stockAllocation.findFirst({ where: { id, tenantId: scope.tenantId }, include: { lines: { orderBy: { id: "asc" } }, lots: { where: { status: "Active" }, orderBy: { id: "asc" } } } });
  if (!a) return null;
  const branches = await prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: [a.sourceBranchId, a.destinationBranchId] } }, select: { id: true, name: true } });
  const bn = new Map(branches.map((b) => [b.id, b.name]));
  const lotsByLine = new Map<number, typeof a.lots>();
  for (const l of a.lots) { const arr = lotsByLine.get(l.lineId) ?? []; arr.push(l); lotsByLine.set(l.lineId, arr); }
  return {
    header: { id: a.id, allocationNo: a.allocationNo, allocationDate: a.allocationDate, requestNo: a.requestNo, requestId: a.requestId, transferType: a.transferType, priority: a.priority, status: a.status, approvalStatus: a.approvalStatus, remarks: a.remarks, totalItems: a.totalItems, totalRequestedQty: num(a.totalRequestedQty), totalAllocatedQty: num(a.totalAllocatedQty), allocatedByName: a.allocatedByName, createdByName: a.createdByName,
      sourceBranchId: a.sourceBranchId, sourceName: bn.get(a.sourceBranchId) ?? "", sourceWarehouse: a.sourceWarehouse, destinationBranchId: a.destinationBranchId, destinationName: bn.get(a.destinationBranchId) ?? "", destinationWarehouse: a.destinationWarehouse },
    lines: a.lines.map((l) => ({ id: l.id, productId: l.productId, productName: l.productName, sku: l.sku, uom: l.uom, requestedQty: num(l.requestedQty), availableQty: num(l.availableQty), reservedQty: num(l.reservedQty), allocatedQty: num(l.allocatedQty), remainingQty: num(l.remainingQty), policy: l.policy, allocationStatus: l.allocationStatus, remarks: l.remarks,
      lots: (lotsByLine.get(l.id) ?? []).map((x) => ({ batchNo: x.batchNo, expiryDate: x.expiryDate, serialNo: x.serialNo, qty: num(x.qty) })) })),
    editable: isAllocationEditable(a.status), dispatched: a.lots.some((l) => l.status === "Dispatched"),
  };
}

/* ------------------------------------------------------------- create */
export async function createFromRequest(scope: ActiveScope, user: Actor, requestId: number) {
  const req = await prisma.stockTransferRequest.findFirst({ where: { id: requestId, tenantId: scope.tenantId }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!req) throw new Error("Transfer request not found.");
  if (req.status === "Cancelled" || req.status === "Rejected") throw new Error(`Cannot allocate a ${req.status} request.`);
  if (req.status !== "Approved") throw new Error("Only an Approved transfer request can be allocated.");
  assertBranchScope(scope, req.destinationBranchId);
  const required = await allocationRequiredForBranch(scope, req.destinationBranchId);
  if (!required) throw new Error("Stock Allocation is not enabled for this warehouse. Proceed to Stock Transfer Dispatch.");
  const existing = await prisma.stockAllocation.findFirst({ where: { tenantId: scope.tenantId, requestId, status: { notIn: ["Cancelled"] } }, select: { id: true } });
  if (existing) return { id: existing.id, existing: true };

  // Snapshot availability + policy per line — validated against the DESTINATION branch.
  const av = await Promise.all(req.lines.map((l) => productAvailability(scope, { productId: l.productId, branchId: req.destinationBranchId, warehouse: req.destinationWarehouse })));
  const totalReq = r3(req.lines.reduce((s, l) => s + num(l.requestedQty), 0));
  return prisma.$transaction(async (tx) => {
    const a = await tx.stockAllocation.create({
      data: {
        tenantId: scope.tenantId, businessId: scope.businessId, allocationNo: "TMP", allocationDate: new Date().toISOString().slice(0, 10),
        requestId, requestNo: req.requestNo, sourceBranchId: req.sourceBranchId, sourceWarehouse: req.sourceWarehouse, destinationBranchId: req.destinationBranchId, destinationWarehouse: req.destinationWarehouse,
        transferType: req.transferType, priority: req.priority, status: "Draft", approvalStatus: "NotRequired", totalItems: req.lines.length, totalRequestedQty: totalReq, totalAllocatedQty: 0, createdBy: user?.id ?? null, createdByName: user?.fullName ?? null,
        lines: { create: req.lines.map((l, i) => ({ tenantId: scope.tenantId, productId: l.productId, productName: l.productName, sku: l.sku, uom: l.uom, requestedQty: num(l.requestedQty), availableQty: av[i].available, reservedQty: 0, allocatedQty: 0, remainingQty: num(l.requestedQty), policy: av[i].policy, allocationStatus: "Pending", remarks: null })) },
      },
    });
    const allocationNo = `ALLOC-${String(a.id).padStart(5, "0")}`;
    await tx.stockAllocation.update({ where: { id: a.id }, data: { allocationNo } });
    await writeAudit(tx, user, { action: "stock_allocation.create", entity: "StockAllocation", entityId: a.id, summary: `Created allocation ${allocationNo} for ${req.requestNo}`, businessId: scope.businessId, meta: { requestNo: req.requestNo, items: req.lines.length } });
    return { id: a.id, allocationNo, existing: false };
  });
}

/* ------------------------------------------------------------- save draft */
export async function saveDraft(scope: ActiveScope, user: Actor, id: number, input: SaveDraftInput) {
  const a = await loadEditable(scope, id);
  const byLine = new Map((input.lines ?? []).map((l) => [l.lineId, l]));
  await prisma.$transaction(async (tx) => {
    for (const l of a.lines) {
      const patch = byLine.get(l.id);
      if (!patch) continue;
      const planned = r3(Math.min(num(patch.allocatedQty), num(l.requestedQty)));
      await tx.stockAllocationLine.update({ where: { id: l.id }, data: { allocatedQty: planned, remainingQty: r3(num(l.requestedQty) - planned), remarks: patch.remarks ?? l.remarks } });
    }
    await tx.stockAllocation.update({ where: { id }, data: { remarks: input.remarks ?? a.remarks } });
    await writeAudit(tx, user, { action: "stock_allocation.update", entity: "StockAllocation", entityId: id, summary: `Saved draft allocation ${a.allocationNo}`, businessId: scope.businessId });
  });
  return { id };
}

/* ------------------------------------------------------------- allocate */
export async function allocate(scope: ActiveScope, user: Actor, id: number, input: AllocateInput) {
  const a = await loadForAllocate(scope, id);
  const byLine = new Map((input.lines ?? []).map((l) => [l.lineId, l]));

  // Compute + validate ALL reservations first (nothing is mutated yet), so a failed
  // allocation never wipes the existing reservation. `excludeAllocationId` makes the
  // availability math ignore this allocation's own active lots, so re-running simply
  // recomputes rather than double-reserving ("cannot allocate the same qty twice").
  const plan: { lineId: number; requestedQty: number; reserved: number; lineStatus: string; remarks?: string | null; rows: ReservationRow[] }[] = [];
  for (const line of a.lines) {
    const instr = byLine.get(line.id);
    let qty = 0;
    let serials: string[] | undefined;
    if (input.all) qty = r3(Math.min(num(line.requestedQty), (await productAvailability(scope, { productId: line.productId, branchId: a.destinationBranchId, warehouse: a.destinationWarehouse, excludeAllocationId: id })).available));
    else if (instr) { qty = r3(Math.min(num(instr.allocatedQty), num(line.requestedQty))); serials = instr.serials; }
    else { qty = num(line.allocatedQty); } // keep prior planned qty for lines not in payload
    const rows = qty > 0 ? await buildReservation(scope, { productId: line.productId, branchId: a.destinationBranchId, warehouse: a.destinationWarehouse, qty, serials, excludeAllocationId: id, productName: line.productName }) : [];
    const reserved = r3(rows.reduce((s, r) => s + r.qty, 0));
    const lineStatus = reserved <= 0 ? "Pending" : reserved >= num(line.requestedQty) - 0.001 ? "Allocated" : "Partial";
    plan.push({ lineId: line.id, requestedQty: num(line.requestedQty), reserved, lineStatus, remarks: instr?.remarks, rows });
  }
  const totalAllocated = r3(plan.reduce((s, p) => s + p.reserved, 0));
  const anyAllocated = plan.some((p) => p.reserved > 0);
  const allFull = plan.every((p) => p.reserved >= p.requestedQty - 0.001);
  const status = !anyAllocated ? "Draft" : allFull ? "Allocated" : "Partially Allocated";

  await prisma.$transaction(async (tx) => {
    await tx.stockAllocationLot.updateMany({ where: { allocationId: id, status: "Active" }, data: { status: "Released" } });
    for (const p of plan) {
      await tx.stockAllocationLine.update({ where: { id: p.lineId }, data: { allocatedQty: p.reserved, reservedQty: p.reserved, remainingQty: r3(p.requestedQty - p.reserved), allocationStatus: p.lineStatus, ...(p.remarks !== undefined ? { remarks: p.remarks } : {}) } });
      if (p.rows.length) await tx.stockAllocationLot.createMany({ data: p.rows.map((r) => ({ tenantId: scope.tenantId, allocationId: id, lineId: p.lineId, productId: a.lines.find((l) => l.id === p.lineId)!.productId, branchId: a.destinationBranchId, warehouse: a.destinationWarehouse, batchNo: r.batchNo, mfgDate: r.mfgDate, expiryDate: r.expiryDate, serialNo: r.serialNo, qty: r.qty, status: "Active" })) });
    }
    await tx.stockAllocation.update({ where: { id }, data: { status, totalAllocatedQty: totalAllocated, allocatedBy: user?.id ?? null, allocatedByName: user?.fullName ?? null, allocatedAt: new Date() } });
    await writeAudit(tx, user, { action: "stock_allocation.allocate", entity: "StockAllocation", entityId: id, summary: `Allocated ${a.allocationNo} → ${status} (${totalAllocated} qty)`, businessId: scope.businessId, meta: { status, totalAllocated } });
  });
  return { status, totalAllocatedQty: totalAllocated };
}

/* ------------------------------------------------------ release / reallocate / cancel */
export async function allocationAction(scope: ActiveScope, user: Actor, id: number, action: "release" | "reallocate" | "cancel", remarks?: string) {
  const a = await prisma.stockAllocation.findFirst({ where: { id, tenantId: scope.tenantId }, include: { lots: { select: { status: true } } } });
  if (!a) throw new Error("Allocation not found.");
  assertBranchScope(scope, a.destinationBranchId);
  if (a.lots.some((l) => l.status === "Dispatched")) throw new Error("This allocation has been dispatched and can no longer be modified.");
  if (a.status === "Cancelled") throw new Error("Allocation is already cancelled.");

  await prisma.$transaction(async (tx) => {
    // Free all active reservations.
    await tx.stockAllocationLot.updateMany({ where: { allocationId: id, status: "Active" }, data: { status: "Released" } });
    if (action === "release") {
      await tx.stockAllocationLine.updateMany({ where: { allocationId: id }, data: { reservedQty: 0, allocationStatus: "Pending" } });
      await tx.stockAllocation.update({ where: { id }, data: { status: "Released", totalAllocatedQty: 0, releasedAt: new Date(), remarks: remarks ?? a.remarks } });
    } else if (action === "reallocate") {
      await tx.stockAllocationLine.updateMany({ where: { allocationId: id }, data: { reservedQty: 0, allocatedQty: 0, allocationStatus: "Pending" } });
      // reset remainingQty = requestedQty per line
      const lines = await tx.stockAllocationLine.findMany({ where: { allocationId: id }, select: { id: true, requestedQty: true } });
      for (const l of lines) await tx.stockAllocationLine.update({ where: { id: l.id }, data: { remainingQty: l.requestedQty } });
      await tx.stockAllocation.update({ where: { id }, data: { status: "Draft", totalAllocatedQty: 0 } });
    } else {
      await tx.stockAllocationLine.updateMany({ where: { allocationId: id }, data: { reservedQty: 0, allocationStatus: "Pending" } });
      await tx.stockAllocation.update({ where: { id }, data: { status: "Cancelled", totalAllocatedQty: 0, cancelledAt: new Date(), remarks: remarks ?? a.remarks } });
    }
    await writeAudit(tx, user, { action: `stock_allocation.${action}`, entity: "StockAllocation", entityId: id, summary: `${action[0].toUpperCase()}${action.slice(1)} allocation ${a.allocationNo}`, businessId: scope.businessId, meta: { remarks } });
  });
  const after = await prisma.stockAllocation.findUnique({ where: { id }, select: { status: true } });
  return { status: after?.status ?? "" };
}

/* ---------------------------------------------------------------- helpers */
// Allocation can be (re)allocated from Draft, Partially Allocated or Allocated;
// blocked once dispatched, released or cancelled.
async function loadForAllocate(scope: ActiveScope, id: number) {
  const a = await prisma.stockAllocation.findFirst({ where: { id, tenantId: scope.tenantId }, include: { lines: { orderBy: { id: "asc" } }, lots: { select: { status: true } } } });
  if (!a) throw new Error("Allocation not found.");
  assertBranchScope(scope, a.destinationBranchId);
  if (a.lots.some((l) => l.status === "Dispatched")) throw new Error("This allocation has been dispatched and can no longer be modified.");
  if (a.status === "Released" || a.status === "Cancelled") throw new Error(`A ${a.status} allocation cannot be allocated. Use Reallocate first.`);
  return a;
}
async function loadEditable(scope: ActiveScope, id: number) {
  const a = await prisma.stockAllocation.findFirst({ where: { id, tenantId: scope.tenantId }, include: { lines: { orderBy: { id: "asc" } }, lots: { select: { status: true } } } });
  if (!a) throw new Error("Allocation not found.");
  assertBranchScope(scope, a.destinationBranchId);
  if (a.lots.some((l) => l.status === "Dispatched")) throw new Error("This allocation has been dispatched and can no longer be modified.");
  if (!ALLOC_STATUSES.includes(a.status as never)) throw new Error("Invalid allocation status.");
  if (!isAllocationEditable(a.status)) throw new Error(`A ${a.status} allocation cannot be modified.`);
  return a;
}
