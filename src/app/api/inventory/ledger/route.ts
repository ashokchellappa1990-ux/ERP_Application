import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { IN_TRANSIT_WAREHOUSE, BUCKET_WAREHOUSES, WIP_WAREHOUSE } from "@/lib/inventory/buckets";
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
  const areaId = Number(url.searchParams.get("areaId")) || 0;
  const brand = (url.searchParams.get("brand") ?? "").trim();
  const inventoryCategory = (url.searchParams.get("inventoryCategory") ?? "").trim();

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.InventoryLedgerWhereInput = { ...sw, warehouse: NOT_IN_TRANSIT };
  if (type !== "All") where.txnType = type;
  // Day-wise movement date range (txnDate is YYYY-MM-DD, so string compare works).
  if (from || to) where.txnDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (areaId) where.areaId = areaId;
  if (brand || inventoryCategory) where.product = { is: { ...(brand ? { brand } : {}), ...(inventoryCategory ? { inventoryCategory } : {}) } };
  if (q) {
    where.OR = [
      { qrCode: { contains: q } },
      { refNo: { contains: q } },
      { product: { is: { OR: [{ name: { contains: q } }, { code: { contains: q } }, { sku: { contains: q } }] } } },
    ];
  }

  const balWhere: Prisma.InventoryBalanceWhereInput = { ...sw, warehouse: NOT_BUCKET };
  if (brand || inventoryCategory) balWhere.product = { is: { ...(brand ? { brand } : {}), ...(inventoryCategory ? { inventoryCategory } : {}) } };
  const lotWhere: Prisma.InventoryLotWhereInput = { ...sw, qtyOnHand: { gt: 0 }, warehouse: NOT_BUCKET };
  if (areaId) lotWhere.areaId = areaId;
  if (brand || inventoryCategory) lotWhere.product = { is: { ...(brand ? { brand } : {}), ...(inventoryCategory ? { inventoryCategory } : {}) } };

  const [rows, balances, movements, lots, wipBalances] = await Promise.all([
    prisma.inventoryLedger.findMany({
      where,
      orderBy: [{ txnDate: "desc" }, { id: "desc" }],
      take: 300,
      include: { product: { select: { name: true, code: true, sku: true, baseUom: true } } },
    }),
    prisma.inventoryBalance.findMany({
      where: balWhere,
      orderBy: { updatedAt: "desc" },
      include: { product: { select: { id: true, name: true, code: true, sku: true, baseUom: true, brand: true, retailPrice: true, mrp: true } } },
    }),
    prisma.inventoryLedger.count({ where: { ...sw, warehouse: NOT_IN_TRANSIT } }),
    prisma.inventoryLot.findMany({
      where: lotWhere,
      orderBy: [{ receivedDate: "asc" }, { id: "asc" }],
      include: { product: { select: { name: true, code: true, sku: true, baseUom: true } } },
    }),
    // WIP / In-Process — raw material issued into a Material Processing
    // transaction, not yet completed. A distinct bucket from In-Transit.
    prisma.inventoryBalance.findMany({ where: { ...sw, warehouse: WIP_WAREHOUSE }, select: { productId: true, qtyOnHand: true } }),
  ]);
  const wipByProduct = new Map<number, number>();
  for (const w of wipBalances) wipByProduct.set(w.productId, (wipByProduct.get(w.productId) ?? 0) + num(w.qtyOnHand));

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

  // `InventoryBalance` is warehouse-keyed only (no Area column, by design — see
  // schema comment on InventoryLedger.areaId) so it can't be filtered by Area
  // directly. When an Area filter is active, on-hand is instead derived by
  // summing the Area-tagged ledger movements themselves (IN − OUT per product),
  // valued at that product's overall average rate (purchaseValue / qty from the
  // unfiltered balance) since the ledger's per-movement rate isn't a reliable
  // per-area valuation on its own (e.g. a SALES row carries its COGS, not a rate).
  let inStock: { b: Bal; qty: number; pv: number; sv: number }[];
  if (areaId) {
    const areaLedgerWhere: Prisma.InventoryLedgerWhereInput = { ...sw, warehouse: NOT_BUCKET, areaId };
    if (brand || inventoryCategory) areaLedgerWhere.product = { is: { ...(brand ? { brand } : {}), ...(inventoryCategory ? { inventoryCategory } : {}) } };
    const areaAgg = await prisma.inventoryLedger.groupBy({ by: ["productId", "direction"], where: areaLedgerWhere, _sum: { qty: true } });
    const qtyByProduct = new Map<number, number>();
    for (const r of areaAgg) {
      const q = num(r._sum.qty);
      qtyByProduct.set(r.productId, (qtyByProduct.get(r.productId) ?? 0) + (r.direction === "IN" ? q : -q));
    }
    inStock = [...qtyByProduct.entries()]
      .map(([productId, qty]) => {
        const g = prodMap.get(productId);
        if (!g || qty <= 0.0001) return null;
        const rate = g.qty > 0.0001 ? g.pv / g.qty : num(g.b.purchaseRate);
        const sRate = g.qty > 0.0001 ? g.sv / g.qty : num(g.b.sellingRate);
        return { b: g.b, qty, pv: qty * rate, sv: qty * sRate };
      })
      .filter((x): x is { b: Bal; qty: number; pv: number; sv: number } => x != null);
  } else {
    inStock = [...prodMap.values()].filter((g) => g.qty > 0.0001);
  }

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
    brand: b.product.brand ?? "", warehouse: "", qtyOnHand: r3(qty), wipQty: r3(wipByProduct.get(b.product.id) ?? 0),
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
    totalQty: r3(inStock.reduce((s, g) => s + g.qty, 0)),
    totalValue: r2(inStock.reduce((s, g) => s + g.pv, 0)),
    totalSellingValue: r2(inStock.reduce((s, g) => s + g.sv, 0)),
    movements,
  };
  return NextResponse.json({ ok: true, rows: shapedRows, balances: shapedBalances, lots: shapedLots, stats });
}
