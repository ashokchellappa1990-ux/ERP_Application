import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { BUCKET_WAREHOUSES } from "@/lib/inventory/buckets";
import type { BatchTrackRow } from "@/lib/contracts/inventoryTracking";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +n.toFixed(2);

// GET /api/inventory/tracking/batches?q=&warehouse= — batch-wise stock from lots,
// with sold/returned/damaged derived from the inventory ledger.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "inventory.tracking");
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const warehouse = (url.searchParams.get("warehouse") ?? "").trim();
  const sw = scopeWhere(await getActiveScope(user), { branch: true });

  const lots = await prisma.inventoryLot.findMany({
    // Only sellable stock — in-transit + damage/quarantine buckets are excluded.
    where: { ...sw, batchNo: { not: null }, ...(warehouse ? { warehouse } : { warehouse: { notIn: BUCKET_WAREHOUSES } }) },
    orderBy: { id: "desc" }, take: 2000,
  });
  if (!lots.length) return NextResponse.json({ ok: true, rows: [] });

  const productIds = Array.from(new Set(lots.map((l) => l.productId)));
  const grnIds = Array.from(new Set(lots.map((l) => l.grnId).filter((x): x is number => x != null)));
  const [prods, grns, ledgerAgg] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true } }),
    grnIds.length ? prisma.goodsReceiptNote.findMany({ where: { id: { in: grnIds } }, select: { id: true, supplier: true } }) : Promise.resolve([]),
    prisma.inventoryLedger.groupBy({ by: ["productId", "batchNo", "txnType"], where: { ...sw, batchNo: { not: null } }, _sum: { qty: true } }),
  ]);
  const pMap = new Map(prods.map((p) => [p.id, p]));
  const gMap = new Map(grns.map((g) => [g.id, g.supplier ?? ""]));
  // ledger totals keyed by `${productId}|${batchNo}` → { txnType: qty }
  const moves = new Map<string, Record<string, number>>();
  for (const a of ledgerAgg) {
    const k = `${a.productId}|${a.batchNo}`;
    const m = moves.get(k) ?? {};
    m[a.txnType] = (m[a.txnType] ?? 0) + num(a._sum.qty);
    moves.set(k, m);
  }

  // Group by product + batch (merging warehouses like Damage Store into ONE record) so
  // a batch's good + damaged qty tallies as a single row instead of separate records.
  const groups = new Map<string, BatchTrackRow>();
  for (const l of lots) {
    const key = `${l.productId}|${l.batchNo}`;
    const p = pMap.get(l.productId);
    let row = groups.get(key);
    if (!row) {
      const mv = moves.get(`${l.productId}|${l.batchNo}`) ?? {};
      row = {
        key, batchNo: l.batchNo ?? "", productId: l.productId, product: p?.name ?? `#${l.productId}`, sku: p?.sku ?? "", warehouse: "",
        supplier: l.grnId ? (gMap.get(l.grnId) ?? "") : "", mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "",
        purchaseRate: num(l.purchaseRate), sellingRate: num(l.sellingRate),
        received: 0, available: 0, reserved: 0,
        sold: r2(mv.SALES ?? 0), returned: r2(mv.SALES_RETURN ?? 0), damaged: r2((mv.ADJUSTMENT ?? 0) + (mv.WASTAGE ?? 0)), dispatched: r2(mv.TRANSFER_OUT ?? 0),
        status: "",
      };
      groups.set(key, row);
    }
    row.received = r2(row.received + num(l.receivedQty));
    row.available = r2(row.available + num(l.qtyOnHand));
    if (!row.mfgDate && l.mfgDate) row.mfgDate = l.mfgDate;
    if (!row.expiryDate && l.expiryDate) row.expiryDate = l.expiryDate;
  }

  let rows = [...groups.values()].map((r) => ({ ...r, status: r.available > 0 ? "Active" : "Closed" }));
  if (q) rows = rows.filter((r) => r.batchNo.toLowerCase().includes(q) || r.product.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q));
  rows.sort((a, b) => (a.product + a.batchNo).localeCompare(b.product + b.batchNo));
  return NextResponse.json({ ok: true, rows });
}
