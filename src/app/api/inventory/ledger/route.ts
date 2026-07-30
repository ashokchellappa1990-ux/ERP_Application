import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { IN_TRANSIT_WAREHOUSE, BUCKET_WAREHOUSES } from "@/lib/inventory/buckets";
import type { LedgerRow, LedgerBalance, LedgerLot, LedgerStats } from "@/lib/contracts/openingStock";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r3 = (n: number) => +n.toFixed(3);
const r2 = (n: number) => +n.toFixed(2);
// On-hand / balances count only SELLABLE stock — exclude in-transit AND damage/quarantine
// buckets (damaged stock isn't part of good on-hand). The movement LOG keeps showing
// damage movements (in-transit only excluded there) so nothing is silently hidden.
const NOT_IN_TRANSIT = { not: IN_TRANSIT_WAREHOUSE };
const NOT_BUCKET = { notIn: BUCKET_WAREHOUSES };

// GET /api/inventory/ledger — day-wise movement log + current balances (tenant-scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "inventory.ledger");
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const type = (url.searchParams.get("type") ?? "All").trim();
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.InventoryLedgerWhereInput = { ...sw, warehouse: NOT_IN_TRANSIT };
  if (type !== "All") where.txnType = type;
  // Day-wise movement date range (txnDate is YYYY-MM-DD, so string compare works).
  if (from || to) where.txnDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (q) {
    where.OR = [
      { qrCode: { contains: q } },
      { refNo: { contains: q } },
      { product: { is: { OR: [{ name: { contains: q } }, { code: { contains: q } }, { sku: { contains: q } }] } } },
    ];
  }

  const [rows, balances, agg, movements, lots] = await Promise.all([
    prisma.inventoryLedger.findMany({
      where,
      orderBy: [{ txnDate: "desc" }, { id: "desc" }],
      take: 300,
      include: { product: { select: { name: true, code: true, sku: true, baseUom: true } } },
    }),
    prisma.inventoryBalance.findMany({
      where: { ...sw, warehouse: NOT_BUCKET },
      orderBy: { updatedAt: "desc" },
      include: { product: { select: { id: true, name: true, code: true, sku: true, baseUom: true, brand: true, retailPrice: true, mrp: true } } },
    }),
    prisma.inventoryBalance.aggregate({ where: { ...sw, warehouse: NOT_BUCKET }, _sum: { qtyOnHand: true, purchaseValue: true, sellingValue: true } }),
    prisma.inventoryLedger.count({ where: { ...sw, warehouse: NOT_IN_TRANSIT } }),
    prisma.inventoryLot.findMany({
      where: { ...sw, qtyOnHand: { gt: 0 }, warehouse: NOT_BUCKET },
      orderBy: [{ receivedDate: "asc" }, { id: "asc" }],
      include: { product: { select: { name: true, code: true, sku: true, baseUom: true } } },
    }),
  ]);

  // Group the per-warehouse balances into ONE record per product (in-transit already
  // excluded) so damaged / bucket stock doesn't appear as a separate untallied row.
  // On-hand = physical total the product holds at this branch across warehouses.
  type Bal = (typeof balances)[number];
  const prodMap = new Map<number, { b: Bal; qty: number; pv: number; sv: number }>();
  for (const b of balances) {
    const g = prodMap.get(b.product.id);
    if (g) { g.qty += num(b.qtyOnHand); g.pv += num(b.purchaseValue); g.sv += num(b.sellingValue); if (b.lastMovementAt && (!g.b.lastMovementAt || b.lastMovementAt > g.b.lastMovementAt)) g.b = b; }
    else prodMap.set(b.product.id, { b, qty: num(b.qtyOnHand), pv: num(b.purchaseValue), sv: num(b.sellingValue) });
  }
  const inStock = [...prodMap.values()].filter((g) => g.qty > 0.0001);

  const shapedRows: LedgerRow[] = rows.map((r) => ({
    id: r.id, txnDate: r.txnDate, productName: r.product.name, sku: r.product.sku ?? r.product.code ?? "",
    uom: r.product.baseUom ?? "", qrCode: r.qrCode ?? "", txnType: r.txnType, direction: r.direction as "IN" | "OUT",
    qty: num(r.qty),
    rate: r.purchaseRate != null ? num(r.purchaseRate) : null, value: r.purchaseValue != null ? num(r.purchaseValue) : null,
    sellingRate: r.sellingRate != null ? num(r.sellingRate) : null, sellingValue: r.sellingValue != null ? num(r.sellingValue) : null,
    balanceQty: num(r.balanceQty), warehouse: r.warehouse ?? "", batchNo: r.batchNo ?? "", refNo: r.refNo ?? "",
    createdAt: r.createdAt.toISOString(),
  }));
  const shapedBalances: LedgerBalance[] = inStock.map(({ b, qty, pv, sv }) => ({
    productId: b.product.id, productName: b.product.name, sku: b.product.sku ?? b.product.code ?? "", uom: b.product.baseUom ?? "",
    brand: b.product.brand ?? "", warehouse: "", qtyOnHand: r3(qty),
    purchaseRate: b.purchaseRate != null ? num(b.purchaseRate) : null,
    sellingRate: b.sellingRate != null ? num(b.sellingRate) : (b.product.retailPrice != null ? num(b.product.retailPrice) : b.product.mrp != null ? num(b.product.mrp) : null),
    value: r2(pv), purchaseValue: r2(pv), sellingValue: r2(sv), lastMovementAt: b.lastMovementAt != null ? b.lastMovementAt.toISOString() : null,
  }));
  const shapedLots: LedgerLot[] = lots.map((l) => ({
    productName: l.product.name, sku: l.product.sku ?? l.product.code ?? "", uom: l.product.baseUom ?? "",
    warehouse: l.warehouse, batchNo: l.batchNo ?? "", refType: l.refType ?? "", refNo: l.refNo ?? "",
    receivedDate: l.receivedDate ?? "", expiryDate: l.expiryDate ?? "",
    qtyOnHand: num(l.qtyOnHand),
    purchaseRate: l.purchaseRate != null ? num(l.purchaseRate) : null,
    sellingRate: l.sellingRate != null ? num(l.sellingRate) : null,
    value: num(l.purchaseValue), purchaseValue: num(l.purchaseValue), sellingValue: num(l.sellingValue),
  }));
  const stats: LedgerStats = {
    skuCount: inStock.length,
    totalQty: num(agg._sum.qtyOnHand),
    totalValue: num(agg._sum.purchaseValue),
    totalSellingValue: num(agg._sum.sellingValue),
    movements,
  };
  return NextResponse.json({ ok: true, rows: shapedRows, balances: shapedBalances, lots: shapedLots, stats });
}
