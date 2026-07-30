import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { writeAudit, type AuditActor } from "@/lib/audit/log";
import { TRANSFER_TYPES, PRIORITIES, STR_NEXT, isEditable, validateHeader, type StrStatus, type StockTransferInput } from "@/lib/contracts/stockTransfer";

/**
 * Stock Transfer Request engine. Records the request only — NO inventory / accounting posting.
 * Source = the login branch; Destination = a same-business branch whose entity type is NOT an
 * office. Approval is config-driven from the source warehouse's Warehouse Configuration
 * (transfer.approvalRequired). Audit every action.
 */
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function branchWhere(scope: ActiveScope): Prisma.BranchWhereInput {
  return { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(scope.readBranchIds?.length ? { id: { in: scope.readBranchIds } } : {}) };
}
async function officeEntityTypeIds(tenantId: number): Promise<number[]> {
  const ets = await prisma.entityType.findMany({ where: { tenantId }, select: { id: true, name: true } });
  return ets.filter((e) => /office/i.test(e.name)).map((e) => e.id);
}
async function warehousesFor(tenantId: number, branchIds: number[]): Promise<Map<number, string[]>> {
  if (!branchIds.length) return new Map();
  const rows = await prisma.inventoryBalance.findMany({ where: { tenantId, branchId: { in: branchIds } }, select: { branchId: true, warehouse: true }, distinct: ["branchId", "warehouse"] });
  const m = new Map<number, string[]>();
  for (const r of rows) { if (r.branchId == null) continue; const arr = m.get(r.branchId) ?? []; if (r.warehouse && !arr.includes(r.warehouse)) arr.push(r.warehouse); m.set(r.branchId, arr); }
  return m;
}

/* ----------------------------------------------------------------- options */
export async function transferOptions(scope: ActiveScope) {
  const officeIds = await officeEntityTypeIds(scope.tenantId);
  const bizWhere: Prisma.BranchWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), status: "active" };
  const [sourceBranches, destBranchesRaw] = await Promise.all([
    prisma.branch.findMany({ where: branchWhere(scope), select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { ...bizWhere, ...(officeIds.length ? { entityTypeId: { notIn: officeIds } } : {}) }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);
  const allIds = [...new Set([...sourceBranches.map((b) => b.id), ...destBranchesRaw.map((b) => b.id)])];
  const wh = await warehousesFor(scope.tenantId, allIds);
  const withWh = (b: { id: number; name: string; code: string }) => ({ id: b.id, name: b.name, code: b.code, warehouses: wh.get(b.id) ?? [] });
  return {
    defaultSourceBranchId: scope.branchId ?? sourceBranches[0]?.id ?? null,
    sourceBranches: sourceBranches.map(withWh), destinationBranches: destBranchesRaw.map(withWh),
    transferTypes: [...TRANSFER_TYPES], priorities: [...PRIORITIES],
  };
}

/** Available qty + min/max for a product at source (and destination). */
export async function availability(scope: ActiveScope, q: { productId: number; sourceBranchId?: number; sourceWarehouse?: string; destBranchId?: number; destWarehouse?: string }) {
  const sum = async (branchId?: number, warehouse?: string) => {
    if (!branchId) return 0;
    const agg = await prisma.inventoryBalance.aggregate({ where: { tenantId: scope.tenantId, productId: q.productId, branchId, ...(warehouse ? { warehouse } : {}) }, _sum: { qtyOnHand: true } });
    return r3(num(agg._sum.qtyOnHand));
  };
  const [product, source, dest] = await Promise.all([
    prisma.product.findFirst({ where: { id: q.productId, tenantId: scope.tenantId }, select: { name: true, sku: true, minStock: true, maxStock: true, baseUom: true } }),
    sum(q.sourceBranchId, q.sourceWarehouse), sum(q.destBranchId, q.destWarehouse),
  ]);
  return { productId: q.productId, name: product?.name ?? "", sku: product?.sku ?? "", uom: product?.baseUom ?? "", availableSource: source, availableDest: dest, minStockQty: product?.minStock != null ? num(product.minStock) : null, maxStockQty: product?.maxStock != null ? num(product.maxStock) : null };
}

/* --------------------------------------------------------- create / update */
async function assertValid(scope: ActiveScope, input: StockTransferInput) {
  const err = validateHeader(input);
  if (err) throw new Error(err);
  const [src, dst, officeIds] = await Promise.all([
    prisma.branch.findFirst({ where: { id: input.sourceBranchId, tenantId: scope.tenantId }, select: { businessId: true } }),
    prisma.branch.findFirst({ where: { id: input.destinationBranchId, tenantId: scope.tenantId }, select: { businessId: true, entityTypeId: true } }),
    officeEntityTypeIds(scope.tenantId),
  ]);
  if (!src || !dst) throw new Error("Source or destination branch not found.");
  if (src.businessId !== dst.businessId) throw new Error("Source and Destination must belong to the same Business.");
  if (dst.entityTypeId != null && officeIds.includes(dst.entityTypeId)) throw new Error("The destination entity cannot receive stock (office).");
}

export async function createRequest(scope: ActiveScope, user: AuditActor & { fullName?: string | null }, input: StockTransferInput) {
  await assertValid(scope, input);
  const lines = input.lines.filter((l) => Number(l.requestedQty) > 0 || Number(l.productId) > 0);
  const totalReq = r3(lines.reduce((s, l) => s + num(l.requestedQty), 0));
  return prisma.$transaction(async (tx) => {
    const t = await tx.stockTransferRequest.create({
      data: {
        tenantId: scope.tenantId, businessId: scope.businessId, requestNo: "TMP", requestDate: (input.requestDate || new Date().toISOString().slice(0, 10)).slice(0, 10),
        transferType: input.transferType || "Internal Transfer", sourceBranchId: input.sourceBranchId, sourceWarehouse: input.sourceWarehouse || null,
        destinationBranchId: input.destinationBranchId, destinationWarehouse: input.destinationWarehouse || null, priority: input.priority || "Normal",
        requiredDate: input.requiredDate || null, expectedDeliveryDate: input.expectedDeliveryDate || null, referenceDoc: input.referenceDoc || null, remarks: input.remarks || null,
        status: "Draft", approvalStatus: "NotRequired", totalRequestedQty: totalReq, itemCount: lines.length, createdBy: user?.id ?? null, createdByName: user?.fullName ?? null,
        lines: { create: lines.map((l) => ({ tenantId: scope.tenantId, productId: l.productId, productName: l.productName, sku: l.sku || null, uom: l.uom || null, availableSource: r3(num(l.availableSource)), availableDest: r3(num(l.availableDest)), requestedQty: r3(num(l.requestedQty)), minStockQty: l.minStockQty ?? null, maxStockQty: l.maxStockQty ?? null, remarks: l.remarks || null })) },
      },
    });
    const requestNo = `STR-${String(t.id).padStart(5, "0")}`;
    await tx.stockTransferRequest.update({ where: { id: t.id }, data: { requestNo } });
    await writeAudit(tx, user, { action: "stock_transfer.create", entity: "StockTransferRequest", entityId: t.id, summary: `Created transfer request ${requestNo}`, businessId: scope.businessId, meta: { requestNo, source: input.sourceBranchId, dest: input.destinationBranchId, items: lines.length } });
    return { id: t.id, requestNo };
  });
}

export async function updateRequest(scope: ActiveScope, user: AuditActor & { fullName?: string | null }, id: number, input: StockTransferInput) {
  const ex = await prisma.stockTransferRequest.findFirst({ where: { id, tenantId: scope.tenantId }, select: { status: true, requestNo: true } });
  if (!ex) throw new Error("Request not found.");
  if (!isEditable(ex.status)) throw new Error(`A ${ex.status} request cannot be edited.`);
  await assertValid(scope, input);
  const lines = input.lines.filter((l) => Number(l.productId) > 0);
  const totalReq = r3(lines.reduce((s, l) => s + num(l.requestedQty), 0));
  return prisma.$transaction(async (tx) => {
    await tx.stockTransferRequestLine.deleteMany({ where: { requestId: id } });
    await tx.stockTransferRequest.update({
      where: { id }, data: {
        requestDate: (input.requestDate || new Date().toISOString().slice(0, 10)).slice(0, 10), transferType: input.transferType || "Internal Transfer",
        sourceBranchId: input.sourceBranchId, sourceWarehouse: input.sourceWarehouse || null, destinationBranchId: input.destinationBranchId, destinationWarehouse: input.destinationWarehouse || null,
        priority: input.priority || "Normal", requiredDate: input.requiredDate || null, expectedDeliveryDate: input.expectedDeliveryDate || null, referenceDoc: input.referenceDoc || null, remarks: input.remarks || null,
        totalRequestedQty: totalReq, itemCount: lines.length,
        lines: { create: lines.map((l) => ({ tenantId: scope.tenantId, productId: l.productId, productName: l.productName, sku: l.sku || null, uom: l.uom || null, availableSource: r3(num(l.availableSource)), availableDest: r3(num(l.availableDest)), requestedQty: r3(num(l.requestedQty)), minStockQty: l.minStockQty ?? null, maxStockQty: l.maxStockQty ?? null, remarks: l.remarks || null })) },
      },
    });
    await writeAudit(tx, user, { action: "stock_transfer.update", entity: "StockTransferRequest", entityId: id, summary: `Updated transfer request ${ex.requestNo}`, businessId: scope.businessId });
    return { id, requestNo: ex.requestNo };
  });
}

/* ------------------------------------------------------------- workflow */
async function sourceNeedsApproval(scope: ActiveScope, sourceBranchId: number): Promise<boolean> {
  const cfg = await prisma.warehouseConfiguration.findFirst({ where: { tenantId: scope.tenantId, branchId: sourceBranchId }, select: { config: true } });
  const transfer = (cfg?.config as { transfer?: { approvalRequired?: boolean } } | null)?.transfer;
  return transfer?.approvalRequired ?? true; // default: require approval
}
export async function requestAction(scope: ActiveScope, user: AuditActor & { fullName?: string | null }, id: number, action: string, remarks?: string) {
  const t = await prisma.stockTransferRequest.findFirst({ where: { id, tenantId: scope.tenantId } });
  if (!t) throw new Error("Request not found.");
  let next = STR_NEXT[t.status as StrStatus]?.[action];
  if (!next) throw new Error(`Action "${action}" not allowed from ${t.status}.`);
  const data: Prisma.StockTransferRequestUpdateInput = { status: next };

  if (action === "submit") {
    if (await sourceNeedsApproval(scope, t.sourceBranchId)) { data.approvalStatus = "Pending"; data.submittedAt = new Date(); data.submittedBy = user?.id ?? null; }
    else { next = "Approved"; data.status = "Approved"; data.approvalStatus = "Approved"; data.approvedAt = new Date(); data.approvedBy = user?.id ?? null; data.approvedByName = user?.fullName ?? null; }
  } else if (action === "approve") {
    // Destination user (or a business-level user) accepts the request.
    const canApprove = !scope.readBranchIds?.length || scope.readBranchIds.includes(t.destinationBranchId);
    if (!canApprove) throw new Error("Only a destination-branch user can approve this request.");
    data.approvalStatus = "Approved"; data.approvedAt = new Date(); data.approvedBy = user?.id ?? null; data.approvedByName = user?.fullName ?? null;
  } else if (action === "reject") { data.approvalStatus = "Rejected"; data.rejectedBy = user?.id ?? null; data.rejectReason = remarks ?? null; }
  else if (action === "reopen") { data.approvalStatus = "NotRequired"; }
  else if (action === "cancel") { data.cancelledAt = new Date(); }

  const u = await prisma.stockTransferRequest.update({ where: { id }, data });
  await writeAudit(prisma, user, { action: `stock_transfer.${action}`, entity: "StockTransferRequest", entityId: id, summary: `${cap(action)} transfer request ${t.requestNo} → ${u.status}`, businessId: scope.businessId, meta: { remarks } });
  return { status: u.status, approvalStatus: u.approvalStatus };
}

export async function duplicateRequest(scope: ActiveScope, user: AuditActor & { fullName?: string | null }, id: number) {
  const t = await prisma.stockTransferRequest.findFirst({ where: { id, tenantId: scope.tenantId }, include: { lines: true } });
  if (!t) throw new Error("Request not found.");
  return createRequest(scope, user, {
    transferType: t.transferType || undefined, sourceBranchId: t.sourceBranchId, sourceWarehouse: t.sourceWarehouse || undefined, destinationBranchId: t.destinationBranchId, destinationWarehouse: t.destinationWarehouse || undefined,
    priority: t.priority, requiredDate: t.requiredDate || undefined, expectedDeliveryDate: t.expectedDeliveryDate || undefined, referenceDoc: t.referenceDoc || undefined, remarks: t.remarks || undefined,
    lines: t.lines.map((l) => ({ productId: l.productId, productName: l.productName, sku: l.sku, uom: l.uom, availableSource: num(l.availableSource), availableDest: num(l.availableDest), requestedQty: num(l.requestedQty), minStockQty: l.minStockQty != null ? num(l.minStockQty) : null, maxStockQty: l.maxStockQty != null ? num(l.maxStockQty) : null, remarks: l.remarks })),
  });
}

/* ---------------------------------------------------------------- list / get */
export async function listRequests(scope: ActiveScope, f: { q?: string; from?: string; to?: string; sourceWarehouse?: string; destWarehouse?: string; status?: string; priority?: string; requestedBy?: string }) {
  const where: Prisma.StockTransferRequestWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  if (f.q) where.OR = [{ requestNo: { contains: f.q } }, { referenceDoc: { contains: f.q } }];
  if (f.status && f.status !== "All") where.status = f.status;
  if (f.priority && f.priority !== "All") where.priority = f.priority;
  if (f.sourceWarehouse) where.sourceWarehouse = f.sourceWarehouse;
  if (f.destWarehouse) where.destinationWarehouse = f.destWarehouse;
  if (f.requestedBy) where.createdBy = Number(f.requestedBy);
  if (f.from || f.to) where.requestDate = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  const rows = await prisma.stockTransferRequest.findMany({ where, orderBy: { id: "desc" }, take: 200 });
  const bids = [...new Set(rows.flatMap((r) => [r.sourceBranchId, r.destinationBranchId]))];
  const branches = bids.length ? await prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: bids } }, select: { id: true, name: true } }) : [];
  const bn = new Map(branches.map((b) => [b.id, b.name]));
  return rows.map((r) => ({ id: r.id, requestNo: r.requestNo, requestDate: r.requestDate, transferType: r.transferType, source: bn.get(r.sourceBranchId) ?? `#${r.sourceBranchId}`, sourceWarehouse: r.sourceWarehouse, destination: bn.get(r.destinationBranchId) ?? `#${r.destinationBranchId}`, destinationWarehouse: r.destinationWarehouse, priority: r.priority, itemCount: r.itemCount, totalRequestedQty: num(r.totalRequestedQty), status: r.status, approvalStatus: r.approvalStatus, createdByName: r.createdByName }));
}

export async function getRequest(scope: ActiveScope, id: number) {
  const t = await prisma.stockTransferRequest.findFirst({ where: { id, tenantId: scope.tenantId }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!t) return null;
  const branches = await prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: [t.sourceBranchId, t.destinationBranchId] } }, select: { id: true, name: true, code: true } });
  const bn = new Map(branches.map((b) => [b.id, b]));
  const canApprove = !scope.readBranchIds?.length || scope.readBranchIds.includes(t.destinationBranchId);
  return {
    header: { id: t.id, requestNo: t.requestNo, requestDate: t.requestDate, transferType: t.transferType, priority: t.priority, requiredDate: t.requiredDate, expectedDeliveryDate: t.expectedDeliveryDate, referenceDoc: t.referenceDoc, remarks: t.remarks, status: t.status, approvalStatus: t.approvalStatus, createdByName: t.createdByName, approvedByName: t.approvedByName, rejectReason: t.rejectReason,
      sourceBranchId: t.sourceBranchId, sourceName: bn.get(t.sourceBranchId)?.name ?? "", sourceWarehouse: t.sourceWarehouse, destinationBranchId: t.destinationBranchId, destinationName: bn.get(t.destinationBranchId)?.name ?? "", destinationWarehouse: t.destinationWarehouse },
    lines: t.lines.map((l) => ({ id: l.id, productId: l.productId, productName: l.productName, sku: l.sku, uom: l.uom, availableSource: num(l.availableSource), availableDest: num(l.availableDest), requestedQty: num(l.requestedQty), minStockQty: l.minStockQty != null ? num(l.minStockQty) : null, maxStockQty: l.maxStockQty != null ? num(l.maxStockQty) : null, dispatchedQty: num(l.dispatchedQty), remarks: l.remarks })),
    canApprove, editable: isEditable(t.status), nextActions: Object.keys(STR_NEXT[t.status as StrStatus] ?? {}),
  };
}
