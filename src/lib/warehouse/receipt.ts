import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { writeAudit, type AuditActor } from "@/lib/audit/log";
import { IN_TRANSIT_WAREHOUSE, BUCKET_WAREHOUSE } from "@/lib/inventory/buckets";
import { consumeLots, postMovement, addLot } from "@/lib/inventory/ledger";
import { postJournal } from "@/lib/accounting/post";
import { ACC } from "@/lib/accounting/accounts";
import { isReceiptEditable, receiptLineMath, validateReceipt as validateReceiptLines, type ReceiptInput } from "@/lib/contracts/stockReceipt";

/**
 * Stock Transfer Receipt engine. The DESTINATION branch (login) acknowledges stock
 * dispatched to it: moves In-Transit → destination real warehouse (accepted qty) and
 * → Damage/Quarantine (damaged qty); missing qty stays In-Transit. Writes the ledger
 * and posts internal accounting ONLY (Inventory Dr / Inventory In-Transit Cr). No
 * purchase / supplier / GST entries.
 */
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const REAL_WH = "Main Store";
type Actor = AuditActor & { fullName?: string | null };

function assertReceivingScope(scope: ActiveScope, destinationBranchId: number) {
  if (scope.readBranchIds?.length && !scope.readBranchIds.includes(destinationBranchId))
    throw new Error("You can only receive stock at your own (destination) branch.");
}

interface ReceiptConfig { qualityHold: boolean; binManagement: boolean }
export async function receiptConfig(scope: ActiveScope, branchId: number | null | undefined): Promise<ReceiptConfig> {
  const cfg = branchId ? await prisma.warehouseConfiguration.findFirst({ where: { tenantId: scope.tenantId, branchId }, select: { config: true } }) : null;
  const c = (cfg?.config as any) ?? {};
  return { qualityHold: c.inventory?.qualityHold ?? false, binManagement: c.inventory?.binManagement ?? false };
}

/* ------------------------------------------------------ pending dispatches */
// Dispatches awaiting receipt at the login user's branch (they are the destination).
export async function listPendingDispatches(scope: ActiveScope, q?: string) {
  const where: Prisma.StockTransferDispatchWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), status: { in: ["Dispatched", "Partially Dispatched", "Partially Received"] }, ...(scope.readBranchIds?.length ? { destinationBranchId: { in: scope.readBranchIds } } : {}), ...(q ? { OR: [{ dispatchNo: { contains: q } }, { referenceNo: { contains: q } }] } : {}) };
  const rows = await prisma.stockTransferDispatch.findMany({ where, orderBy: { id: "desc" }, take: 100 });
  const bids = [...new Set(rows.flatMap((r) => [r.sourceBranchId, r.destinationBranchId]))];
  const branches = bids.length ? await prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: bids } }, select: { id: true, name: true } }) : [];
  const bn = new Map(branches.map((b) => [b.id, b.name]));
  return rows.map((r) => ({ dispatchId: r.id, dispatchNo: r.dispatchNo, dispatchDate: r.dispatchDate, referenceNo: r.referenceNo, source: bn.get(r.sourceBranchId) ?? `#${r.sourceBranchId}`, destination: bn.get(r.destinationBranchId) ?? `#${r.destinationBranchId}`, totalItems: r.totalItems, totalDispatchQty: num(r.totalDispatchQty), status: r.status }));
}

/** How much of each dispatch item is already received (non-cancelled receipts). */
async function alreadyReceived(scope: ActiveScope, dispatchId: number) {
  const rows = await prisma.stockTransferReceiptItem.findMany({ where: { tenantId: scope.tenantId, receipt: { dispatchId, status: { not: "Cancelled" } } }, select: { dispatchItemId: true, receivedQty: true } });
  const m = new Map<number, number>();
  for (const r of rows) if (r.dispatchItemId != null) m.set(r.dispatchItemId, r3(num(m.get(r.dispatchItemId)) + num(r.receivedQty)));
  return m;
}

/* ------------------------------------------------------ load dispatch → receipt */
export async function loadDispatchForReceipt(scope: ActiveScope, dispatchId: number) {
  const d = await prisma.stockTransferDispatch.findFirst({ where: { id: dispatchId, tenantId: scope.tenantId }, include: { items: { orderBy: { id: "asc" } } } });
  if (!d) throw new Error("Dispatch not found.");
  if (!["Dispatched", "Partially Dispatched", "Partially Received"].includes(d.status)) throw new Error(`A ${d.status} dispatch cannot be received.`);
  assertReceivingScope(scope, d.destinationBranchId);
  const [srcName, dstName, prior] = await Promise.all([
    prisma.branch.findFirst({ where: { id: d.sourceBranchId, tenantId: scope.tenantId }, select: { name: true } }),
    prisma.branch.findFirst({ where: { id: d.destinationBranchId, tenantId: scope.tenantId }, select: { name: true } }),
    alreadyReceived(scope, dispatchId),
  ]);
  const products = await prisma.product.findMany({ where: { tenantId: scope.tenantId, id: { in: [...new Set(d.items.map((i) => i.productId))] } }, select: { id: true, mrp: true, retailPrice: true } });
  const pm = new Map(products.map((p) => [p.id, p]));
  const items = d.items.map((it) => {
    const remaining = r3(num(it.dispatchQty) - num(prior.get(it.id)));
    const p = pm.get(it.productId);
    return { dispatchItemId: it.id, productId: it.productId, productName: it.productName, sku: it.sku, uom: it.uom, batchNo: it.batchNo, mfgDate: it.mfgDate, expiryDate: it.expiryDate, serials: it.serials ? (JSON.parse(it.serials) as string[]) : [],
      dispatchQty: remaining, receivedQty: remaining, damagedQty: 0, purchasePrice: num(it.unitCost), sellingPrice: r2(num(p?.retailPrice) || num(p?.mrp)), mrp: r2(num(p?.mrp)) };
  }).filter((i) => i.dispatchQty > 0.001);
  return {
    header: { dispatchId: d.id, dispatchNo: d.dispatchNo, dispatchDate: d.dispatchDate, sourceBranchId: d.sourceBranchId, sourceName: srcName?.name ?? "", destinationBranchId: d.destinationBranchId, destinationName: dstName?.name ?? "", destinationWarehouse: d.destinationWarehouse, vehicleNo: d.vehicleNo, driverName: d.driverName, transportName: d.transportName },
    items, config: await receiptConfig(scope, d.destinationBranchId),
  };
}

/* ------------------------------------------------------ create / update */
export async function createReceipt(scope: ActiveScope, user: Actor, input: ReceiptInput) {
  const d = await prisma.stockTransferDispatch.findFirst({ where: { id: input.dispatchId, tenantId: scope.tenantId }, select: { id: true, dispatchNo: true, dispatchDate: true, sourceBranchId: true, destinationBranchId: true, destinationWarehouse: true, vehicleNo: true, driverName: true, transportName: true, status: true } });
  if (!d) throw new Error("Dispatch not found.");
  if (!["Dispatched", "Partially Dispatched", "Partially Received"].includes(d.status)) throw new Error(`A ${d.status} dispatch cannot be received.`);
  assertReceivingScope(scope, d.destinationBranchId);
  const items = input.items.filter((i) => i.productId > 0);
  return prisma.$transaction(async (tx) => {
    const rec = await tx.stockTransferReceipt.create({
      data: {
        tenantId: scope.tenantId, businessId: scope.businessId, branchId: d.destinationBranchId, receiptNo: "TMP", receiptDate: (input.receiptDate || today()).slice(0, 10),
        dispatchId: d.id, dispatchNo: d.dispatchNo, dispatchDate: d.dispatchDate, sourceBranchId: d.sourceBranchId, destinationBranchId: d.destinationBranchId, destinationWarehouse: d.destinationWarehouse,
        vehicleNo: d.vehicleNo, driverName: d.driverName, transportName: d.transportName, status: "Draft", approvalStatus: "NotRequired", remarks: input.remarks || null, totalItems: items.length,
        createdBy: user?.id ?? null, createdByName: user?.fullName ?? null,
        items: { create: items.map((i) => { const m = receiptLineMath(num(i.dispatchQty), num(i.receivedQty), num(i.damagedQty)); return { tenantId: scope.tenantId, dispatchItemId: i.dispatchItemId ?? null, productId: i.productId, productName: i.productName, sku: i.sku || null, uom: i.uom || null, batchNo: i.batchNo || null, mfgDate: i.mfgDate || null, expiryDate: i.expiryDate || null, serials: i.serials?.length ? JSON.stringify(i.serials) : null, dispatchQty: r3(num(i.dispatchQty)), receivedQty: r3(num(i.receivedQty)), damagedQty: r3(num(i.damagedQty)), acceptedQty: r3(m.acceptedQty), missingQty: r3(m.missingQty), purchasePrice: r2(num(i.purchasePrice)), sellingPrice: r2(num(i.sellingPrice)), mrp: r2(num(i.mrp)), remarks: i.remarks || null }; }) },
      },
    });
    const receiptNo = `RCPT-${String(rec.id).padStart(5, "0")}`;
    await tx.stockTransferReceipt.update({ where: { id: rec.id }, data: { receiptNo } });
    await writeAudit(tx, user, { action: "stock_receipt.create", entity: "StockTransferReceipt", entityId: rec.id, summary: `Created receipt ${receiptNo} for ${d.dispatchNo}`, businessId: scope.businessId, meta: { dispatchNo: d.dispatchNo, items: items.length } });
    return { id: rec.id, receiptNo };
  });
}

export async function updateReceipt(scope: ActiveScope, user: Actor, id: number, input: ReceiptInput) {
  const ex = await prisma.stockTransferReceipt.findFirst({ where: { id, tenantId: scope.tenantId }, select: { status: true, receiptNo: true, destinationBranchId: true } });
  if (!ex) throw new Error("Receipt not found.");
  if (!isReceiptEditable(ex.status)) throw new Error(`A ${ex.status} receipt cannot be edited.`);
  assertReceivingScope(scope, ex.destinationBranchId);
  const items = input.items.filter((i) => i.productId > 0);
  return prisma.$transaction(async (tx) => {
    await tx.stockTransferReceiptItem.deleteMany({ where: { receiptId: id } });
    await tx.stockTransferReceipt.update({ where: { id }, data: {
      receiptDate: (input.receiptDate || today()).slice(0, 10), remarks: input.remarks || null, totalItems: items.length,
      items: { create: items.map((i) => { const m = receiptLineMath(num(i.dispatchQty), num(i.receivedQty), num(i.damagedQty)); return { tenantId: scope.tenantId, dispatchItemId: i.dispatchItemId ?? null, productId: i.productId, productName: i.productName, sku: i.sku || null, uom: i.uom || null, batchNo: i.batchNo || null, mfgDate: i.mfgDate || null, expiryDate: i.expiryDate || null, serials: i.serials?.length ? JSON.stringify(i.serials) : null, dispatchQty: r3(num(i.dispatchQty)), receivedQty: r3(num(i.receivedQty)), damagedQty: r3(num(i.damagedQty)), acceptedQty: r3(m.acceptedQty), missingQty: r3(m.missingQty), purchasePrice: r2(num(i.purchasePrice)), sellingPrice: r2(num(i.sellingPrice)), mrp: r2(num(i.mrp)), remarks: i.remarks || null }; }) },
    } });
    await writeAudit(tx, user, { action: "stock_receipt.update", entity: "StockTransferReceipt", entityId: id, summary: `Updated receipt ${ex.receiptNo}`, businessId: scope.businessId });
    return { id, receiptNo: ex.receiptNo };
  });
}

/* ------------------------------------------------------ validate */
export async function validateReceipt(scope: ActiveScope, id: number) {
  const r = await prisma.stockTransferReceipt.findFirst({ where: { id, tenantId: scope.tenantId }, include: { items: true } });
  if (!r) throw new Error("Receipt not found.");
  const msg = validateReceiptLines(r.items.map((it) => ({ dispatchQty: num(it.dispatchQty), receivedQty: num(it.receivedQty), damagedQty: num(it.damagedQty), productName: it.productName })));
  return { ok: !msg, errors: msg ? [msg] : [] };
}

/* ------------------------------------------------------ POST receipt */
export async function postReceipt(scope: ActiveScope, user: Actor, id: number) {
  const r = await prisma.stockTransferReceipt.findFirst({ where: { id, tenantId: scope.tenantId }, include: { items: true } });
  if (!r) throw new Error("Receipt not found.");
  if (!isReceiptEditable(r.status)) throw new Error(`A ${r.status} receipt has already been posted.`);
  assertReceivingScope(scope, r.destinationBranchId);
  const { errors } = await validateReceipt(scope, id);
  if (errors.length) throw new Error(errors[0]);
  const cfg = await receiptConfig(scope, r.destinationBranchId);
  const damageWh = cfg.qualityHold ? BUCKET_WAREHOUSE.quarantine : BUCKET_WAREHOUSE.damaged;
  const realWh = r.destinationWarehouse || REAL_WH;
  const prod = new Map<number, boolean>(); // fefo?
  for (const it of r.items) if (!prod.has(it.productId)) { const p = await prisma.product.findFirst({ where: { id: it.productId, tenantId: scope.tenantId }, select: { valuation: true } }); prod.set(it.productId, (p?.valuation || "").toLowerCase() === "fefo"); }

  let receivedValue = 0, totRec = 0, totAcc = 0, totDmg = 0, totMiss = 0;
  const out = await prisma.$transaction(async (tx) => {
    for (const it of r.items) {
      const received = r3(num(it.receivedQty));
      if (received <= 0) continue;
      const damaged = r3(Math.min(num(it.damagedQty), received));
      const accepted = r3(received - damaged);
      const missing = r3(Math.max(0, num(it.dispatchQty) - received));
      const fefo = prod.get(it.productId)!;
      // 1) reduce IN-TRANSIT at destination (received qty leaves transit)
      const consumed = await consumeLots(tx, scope.tenantId, r.destinationBranchId, it.productId, IN_TRANSIT_WAREHOUSE, received, { batchNo: it.batchNo, fefo });
      const cost = consumed.cost > 0 ? consumed.cost : r2(received * num(it.purchasePrice));
      const unitCost = received > 0 ? r2(cost / received) : num(it.purchasePrice);
      const batchNo = it.batchNo ?? consumed.batchNo, mfgDate = it.mfgDate ?? consumed.mfgDate, expiryDate = it.expiryDate ?? consumed.expiryDate;
      await postMovement(tx, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: r.destinationBranchId, productId: it.productId, txnType: "TRANSFER_IN", direction: "OUT", qty: received, rate: unitCost, warehouse: IN_TRANSIT_WAREHOUSE, batchNo, mfgDate, expiryDate, refType: "TRANSFER_RECEIPT", refId: r.id, refNo: r.receiptNo, txnDate: r.receiptDate, createdBy: user?.id ?? null, remarks: "Received from transit" });
      // 2) accepted → destination real warehouse (sets the branch selling price)
      if (accepted > 0.001) {
        await addLot(tx, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: r.destinationBranchId, productId: it.productId, warehouse: realWh, batchNo, mfgDate, expiryDate, refType: "TRANSFER_RECEIPT", refId: r.id, refNo: r.receiptNo, receivedDate: r.receiptDate, qty: accepted, unitRate: unitCost, sellingRate: num(it.sellingPrice) || null });
        await postMovement(tx, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: r.destinationBranchId, productId: it.productId, txnType: "TRANSFER_IN", direction: "IN", qty: accepted, rate: unitCost, sellingRate: num(it.sellingPrice) || null, warehouse: realWh, batchNo, mfgDate, expiryDate, refType: "TRANSFER_RECEIPT", refId: r.id, refNo: r.receiptNo, txnDate: r.receiptDate, createdBy: user?.id ?? null, remarks: "Accepted into stock" });
        const serials: string[] = it.serials ? (JSON.parse(it.serials) as string[]) : [];
        if (serials.length) await tx.qrCodeMapping.updateMany({ where: { tenantId: scope.tenantId, productId: it.productId, serialNo: { in: serials }, status: "Transferred" }, data: { status: "Active", warehouse: realWh } });
      }
      // 3) damaged → damage / quarantine bucket
      if (damaged > 0.001) {
        await addLot(tx, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: r.destinationBranchId, productId: it.productId, warehouse: damageWh, batchNo, mfgDate, expiryDate, refType: "TRANSFER_RECEIPT", refId: r.id, refNo: r.receiptNo, receivedDate: r.receiptDate, qty: damaged, unitRate: unitCost });
        await postMovement(tx, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: r.destinationBranchId, productId: it.productId, txnType: "TRANSFER_IN", direction: "IN", qty: damaged, rate: unitCost, warehouse: damageWh, batchNo, mfgDate, expiryDate, refType: "TRANSFER_RECEIPT", refId: r.id, refNo: r.receiptNo, txnDate: r.receiptDate, createdBy: user?.id ?? null, remarks: cfg.qualityHold ? "Damaged — quality hold" : "Damaged" });
      }
      await tx.stockTransferReceiptItem.update({ where: { id: it.id }, data: { acceptedQty: accepted, missingQty: missing, damagedQty: damaged, purchasePrice: unitCost } });
      receivedValue = r2(receivedValue + cost); totRec = r3(totRec + received); totAcc = r3(totAcc + accepted); totDmg = r3(totDmg + damaged); totMiss = r3(totMiss + missing);
    }

    // 4) internal accounting: Dr Inventory (destination) / Cr Inventory In-Transit
    if (receivedValue > 0.004) {
      await postJournal(tx, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: r.destinationBranchId, voucherType: "TRANSFER", prefix: "TF", date: r.receiptDate, narration: `Stock transfer receipt — ${r.receiptNo}`, sourceType: "TRANSFER_RECEIPT", sourceId: r.id, refNo: r.receiptNo, createdBy: user?.id ?? null, lines: [
        { code: ACC.INVENTORY, debit: receivedValue, narration: "Stock received into destination" },
        { code: ACC.INVENTORY_IN_TRANSIT, credit: receivedValue, narration: "In-transit cleared on receipt" },
      ] });
    }

    // 5) advance the dispatch status
    const dispatch = await tx.stockTransferDispatch.findUnique({ where: { id: r.dispatchId }, select: { totalDispatchQty: true } });
    const allRec = await tx.stockTransferReceiptItem.aggregate({ where: { tenantId: scope.tenantId, receipt: { dispatchId: r.dispatchId, status: { not: "Cancelled" } } }, _sum: { receivedQty: true } });
    const receivedSoFar = r3(num(allRec._sum.receivedQty) + totRec); // this receipt not yet flipped from Draft
    const dispStatus = receivedSoFar >= num(dispatch?.totalDispatchQty) - 0.001 ? "Received" : "Partially Received";
    await tx.stockTransferDispatch.update({ where: { id: r.dispatchId }, data: { status: dispStatus } });

    const status = totMiss > 0.001 ? "Partially Received" : "Received";
    await tx.stockTransferReceipt.update({ where: { id }, data: { status, totalReceivedQty: totRec, totalAcceptedQty: totAcc, totalDamagedQty: totDmg, totalMissingQty: totMiss, totalValue: receivedValue, receivedBy: user?.id ?? null, receivedByName: user?.fullName ?? null, completedAt: new Date(), lockedAt: new Date() } });
    await writeAudit(tx, user, { action: "stock_receipt.receive", entity: "StockTransferReceipt", entityId: id, summary: `Received ${r.receiptNo} → ${status} (acc ${totAcc}, dmg ${totDmg}, miss ${totMiss})`, businessId: scope.businessId, meta: { status, totAcc, totDmg, totMiss, value: receivedValue, dispatch: dispStatus } });
    return { status, totalAcceptedQty: totAcc, totalDamagedQty: totDmg, totalMissingQty: totMiss, totalValue: receivedValue, dispatchStatus: dispStatus };
  });
  return out;
}

/* ------------------------------------------------------ cancel */
export async function cancelReceipt(scope: ActiveScope, user: Actor, id: number, remarks?: string) {
  const r = await prisma.stockTransferReceipt.findFirst({ where: { id, tenantId: scope.tenantId }, select: { status: true, receiptNo: true, destinationBranchId: true } });
  if (!r) throw new Error("Receipt not found.");
  assertReceivingScope(scope, r.destinationBranchId);
  if (r.status === "Cancelled") throw new Error("Receipt is already cancelled.");
  if (r.status !== "Draft") throw new Error("A completed receipt cannot be cancelled.");
  await prisma.stockTransferReceipt.update({ where: { id }, data: { status: "Cancelled", cancelledAt: new Date(), remarks: remarks ?? undefined } });
  await writeAudit(prisma, user, { action: "stock_receipt.cancel", entity: "StockTransferReceipt", entityId: id, summary: `Cancelled receipt ${r.receiptNo}`, businessId: scope.businessId });
  return { status: "Cancelled" };
}

/* ------------------------------------------------------ list / get */
export async function listReceipts(scope: ActiveScope, f: { q?: string; from?: string; to?: string; status?: string; history?: boolean }) {
  const where: Prisma.StockTransferReceiptWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  if (f.history) where.status = { in: ["Received", "Partially Received", "Cancelled"] };
  else if (f.status && f.status !== "All") where.status = f.status;
  if (f.q) where.OR = [{ receiptNo: { contains: f.q } }, { dispatchNo: { contains: f.q } }];
  if (f.from || f.to) where.receiptDate = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  const rows = await prisma.stockTransferReceipt.findMany({ where, orderBy: { id: "desc" }, take: 200 });
  const bids = [...new Set(rows.flatMap((r) => [r.sourceBranchId, r.destinationBranchId]))];
  const branches = bids.length ? await prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: bids } }, select: { id: true, name: true } }) : [];
  const bn = new Map(branches.map((b) => [b.id, b.name]));
  return rows.map((r) => ({ id: r.id, receiptNo: r.receiptNo, receiptDate: r.receiptDate, dispatchNo: r.dispatchNo, dispatchDate: r.dispatchDate, source: bn.get(r.sourceBranchId) ?? `#${r.sourceBranchId}`, destination: bn.get(r.destinationBranchId) ?? `#${r.destinationBranchId}`, totalItems: r.totalItems, totalReceivedQty: num(r.totalReceivedQty), totalDamagedQty: num(r.totalDamagedQty), totalMissingQty: num(r.totalMissingQty), status: r.status, createdByName: r.createdByName, receivedByName: r.receivedByName }));
}

export async function getReceipt(scope: ActiveScope, id: number) {
  const r = await prisma.stockTransferReceipt.findFirst({ where: { id, tenantId: scope.tenantId }, include: { items: { orderBy: { id: "asc" } } } });
  if (!r) return null;
  const branches = await prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: [r.sourceBranchId, r.destinationBranchId] } }, select: { id: true, name: true } });
  const bn = new Map(branches.map((b) => [b.id, b.name]));
  return {
    header: { id: r.id, receiptNo: r.receiptNo, receiptDate: r.receiptDate, dispatchId: r.dispatchId, dispatchNo: r.dispatchNo, dispatchDate: r.dispatchDate, status: r.status, approvalStatus: r.approvalStatus, remarks: r.remarks, vehicleNo: r.vehicleNo, driverName: r.driverName, transportName: r.transportName,
      totalItems: r.totalItems, totalReceivedQty: num(r.totalReceivedQty), totalAcceptedQty: num(r.totalAcceptedQty), totalDamagedQty: num(r.totalDamagedQty), totalMissingQty: num(r.totalMissingQty), totalValue: num(r.totalValue), createdByName: r.createdByName, receivedByName: r.receivedByName, completedAt: r.completedAt,
      sourceBranchId: r.sourceBranchId, sourceName: bn.get(r.sourceBranchId) ?? "", destinationBranchId: r.destinationBranchId, destinationName: bn.get(r.destinationBranchId) ?? "", destinationWarehouse: r.destinationWarehouse },
    items: r.items.map((i) => ({ id: i.id, productId: i.productId, productName: i.productName, sku: i.sku, uom: i.uom, batchNo: i.batchNo, expiryDate: i.expiryDate, serials: i.serials ? (JSON.parse(i.serials) as string[]) : [], dispatchQty: num(i.dispatchQty), receivedQty: num(i.receivedQty), missingQty: num(i.missingQty), damagedQty: num(i.damagedQty), acceptedQty: num(i.acceptedQty), purchasePrice: num(i.purchasePrice), sellingPrice: num(i.sellingPrice), mrp: num(i.mrp), remarks: i.remarks })),
    editable: isReceiptEditable(r.status),
  };
}

/* ------------------------------------------------------ dashboard KPIs */
export async function receiptKpis(scope: ActiveScope) {
  const where: Prisma.StockTransferReceiptWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  const [pending, receivedToday, agg, completed] = await Promise.all([
    prisma.stockTransferDispatch.count({ where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), status: { in: ["Dispatched", "Partially Dispatched", "Partially Received"] }, ...(scope.readBranchIds?.length ? { destinationBranchId: { in: scope.readBranchIds } } : {}) } }),
    prisma.stockTransferReceipt.count({ where: { ...where, receiptDate: today(), status: { in: ["Received", "Partially Received"] } } }),
    prisma.stockTransferReceipt.aggregate({ where: { ...where, status: { in: ["Received", "Partially Received"] } }, _sum: { totalDamagedQty: true, totalMissingQty: true } }),
    prisma.stockTransferReceipt.findMany({ where: { ...where, status: { in: ["Received", "Partially Received"] } }, select: { receiptDate: true, dispatchDate: true }, take: 200 }),
  ]);
  let days = 0, n = 0;
  for (const c of completed) { if (c.receiptDate && c.dispatchDate) { const d = (new Date(c.receiptDate).getTime() - new Date(c.dispatchDate).getTime()) / 86400000; if (Number.isFinite(d) && d >= 0) { days += d; n++; } } }
  return { pendingReceipts: pending, receivedToday, damagedStock: r3(num(agg._sum.totalDamagedQty)), missingStock: r3(num(agg._sum.totalMissingQty)), avgReceiptDays: n ? Math.round((days / n) * 10) / 10 : 0 };
}
