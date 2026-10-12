import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { BUCKET_WAREHOUSES, BUCKET_WAREHOUSE, IN_TRANSIT_WAREHOUSE } from "@/lib/inventory/buckets";

/**
 * Inventory Dashboard data service — the Inventory Control Center. Everything is
 * derived from the live inventory tables (inventory_balances / inventory_ledger /
 * inventory_lots), the product master and the transfer engines. Mirrors the
 * Purchase/Finance dashboard service shape (per-section functions, scope-aware).
 */
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r0 = (n: number) => Math.round(Number(n) || 0);
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface InvFilters { period: string; warehouse?: string; category?: string; branch?: number | null; product?: number | null }
export function readInvFilters(url: URL): InvFilters {
  const p = url.searchParams;
  return {
    period: p.get("period") || new Date().toISOString().slice(0, 7),
    warehouse: p.get("warehouse") || undefined,
    category: p.get("category") || undefined,
    branch: p.get("branch") ? Number(p.get("branch")) : null,
    product: p.get("product") ? Number(p.get("product")) : null,
  };
}
function periodRange(period: string) {
  const [y, m] = period.split("-").map(Number);
  const from = `${period}-01`;
  const last = new Date(y, m, 0).getDate();
  return { from, to: `${period}-${String(last).padStart(2, "0")}` };
}
function branchScope(scope: ActiveScope, f: InvFilters): Prisma.IntFilter | number | undefined {
  if (f.branch) return f.branch;
  if (scope.readBranchIds?.length) return { in: scope.readBranchIds };
  return undefined;
}
/** Balance where — good (sellable) stock by default; pass warehouse to scope to one. */
function balWhere(scope: ActiveScope, f: InvFilters, opts?: { warehouse?: string; onlyGood?: boolean }): Prisma.InventoryBalanceWhereInput {
  const b = branchScope(scope, f);
  const wh = opts?.warehouse ?? f.warehouse;
  const w: Prisma.InventoryBalanceWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(b != null ? { branchId: b } : {}) };
  if (wh) w.warehouse = wh;
  else if (opts?.onlyGood !== false) w.warehouse = { notIn: BUCKET_WAREHOUSES };
  if (f.category || f.product) w.product = { is: { ...(f.category ? { category: f.category } : {}), ...(f.product ? { id: f.product } : {}) } };
  return w;
}
function ledgerWhere(scope: ActiveScope, f: InvFilters, opts?: { direction?: "IN" | "OUT" }): Prisma.InventoryLedgerWhereInput {
  const b = branchScope(scope, f);
  const { from, to } = periodRange(f.period);
  const w: Prisma.InventoryLedgerWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(b != null ? { branchId: b } : {}), warehouse: { notIn: BUCKET_WAREHOUSES }, txnDate: { gte: from, lte: to } };
  if (f.warehouse) w.warehouse = f.warehouse;
  if (opts?.direction) w.direction = opts.direction;
  if (f.category || f.product) w.product = { is: { ...(f.category ? { category: f.category } : {}), ...(f.product ? { id: f.product } : {}) } };
  return w;
}

/* ------------------------------------------------------ filters */
export async function filterOptions(scope: ActiveScope) {
  const bScope = branchScope(scope, { period: "" });
  const [cats, whs, branches] = await Promise.all([
    prisma.product.findMany({ where: { tenantId: scope.tenantId, category: { not: null } }, select: { category: true }, distinct: ["category"], take: 300 }),
    prisma.inventoryBalance.findMany({ where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), warehouse: { notIn: BUCKET_WAREHOUSES } }, select: { warehouse: true }, distinct: ["warehouse"], take: 100 }),
    prisma.branch.findMany({ where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(bScope != null ? { id: bScope as Prisma.IntFilter } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 100 }),
  ]);
  return {
    categories: [...new Set(cats.map((c) => c.category).filter((x): x is string => !!x))].sort(),
    warehouses: [...new Set(whs.map((w) => w.warehouse).filter(Boolean))].sort(),
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
  };
}

/* ------------------------------------------------------ KPIs */
export interface Kpi { key: string; label: string; unit: "money" | "count" | "qty" | "percent"; value: number; prev: number; growthPct: number; tone: string }
export async function executiveKpis(scope: ActiveScope, f: InvFilters): Promise<Kpi[]> {
  const b = branchScope(scope, f);
  const bizBranch = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(b != null ? { branchId: b } : {}) };
  // StockAllocationLot has no businessId column — scope it by tenant + branch only.
  const allocWhere = { tenantId: scope.tenantId, status: "Active", ...(b != null ? { branchId: b } : {}) };
  const [good, inAgg, outAgg, transit, reserved, negCount, skuCount] = await Promise.all([
    prisma.inventoryBalance.aggregate({ where: balWhere(scope, f), _sum: { qtyOnHand: true, purchaseValue: true } }),
    prisma.inventoryLedger.aggregate({ where: ledgerWhere(scope, f, { direction: "IN" }), _sum: { qty: true } }),
    prisma.inventoryLedger.aggregate({ where: ledgerWhere(scope, f, { direction: "OUT" }), _sum: { qty: true } }),
    prisma.inventoryBalance.aggregate({ where: { ...bizBranch, warehouse: IN_TRANSIT_WAREHOUSE }, _sum: { qtyOnHand: true } }),
    prisma.stockAllocationLot.aggregate({ where: allocWhere, _sum: { qty: true } }),
    prisma.inventoryBalance.count({ where: { ...balWhere(scope, f), qtyOnHand: { lt: 0 } } }),
    prisma.inventoryBalance.count({ where: { ...balWhere(scope, f), qtyOnHand: { gt: 0 } } }),
  ]);
  const stockQty = r2(num(good._sum.qtyOnHand));
  const reservedQty = r2(num(reserved._sum.qty));
  const available = r2(Math.max(0, stockQty - reservedQty));
  const accuracy = skuCount > 0 ? r2(Math.max(0, 100 - (negCount / (skuCount + negCount)) * 100)) : 100;
  return [
    { key: "invValue", label: "Inventory Value", unit: "money", value: r2(num(good._sum.purchaseValue)), prev: 0, growthPct: 0, tone: "primary" },
    { key: "stockQty", label: "Stock Quantity", unit: "qty", value: stockQty, prev: 0, growthPct: 0, tone: "primary" },
    { key: "stockIn", label: "Stock In", unit: "qty", value: r2(num(inAgg._sum.qty)), prev: 0, growthPct: 0, tone: "success" },
    { key: "stockOut", label: "Stock Out", unit: "qty", value: r2(num(outAgg._sum.qty)), prev: 0, growthPct: 0, tone: "danger" },
    { key: "inTransit", label: "In Transit", unit: "qty", value: r2(num(transit._sum.qtyOnHand)), prev: 0, growthPct: 0, tone: "info" },
    { key: "reserved", label: "Reserved", unit: "qty", value: reservedQty, prev: 0, growthPct: 0, tone: "warning" },
    { key: "available", label: "Available", unit: "qty", value: available, prev: 0, growthPct: 0, tone: "success" },
    { key: "accuracy", label: "Inventory Accuracy", unit: "percent", value: accuracy, prev: 0, growthPct: 0, tone: accuracy >= 98 ? "success" : accuracy >= 90 ? "warning" : "danger" },
  ];
}

/* ------------------------------------------------------ stock health */
export interface HealthCard { key: string; label: string; count: number; qty: number; tone: string }
export async function stockHealth(scope: ActiveScope, f: InvFilters): Promise<{ cards: HealthCard[]; score: number }> {
  const b = branchScope(scope, f);
  const bizBranch = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(b != null ? { branchId: b } : {}) };
  const today = new Date().toISOString().slice(0, 10);
  const near = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  // Per-product on-hand (good) for STOCKED products only (those with a balance record),
  // so card counts match the drill-downs and never-stocked products don't inflate OOS.
  const bals = await prisma.inventoryBalance.groupBy({ by: ["productId"], where: balWhere(scope, f), _sum: { qtyOnHand: true } });
  const onHand = new Map(bals.map((r) => [r.productId, num(r._sum.qtyOnHand)]));
  const prods = bals.length ? await prisma.product.findMany({ where: { id: { in: bals.map((x) => x.productId) } }, select: { id: true, minStock: true, maxStock: true, reorderLevel: true } }) : [];
  let low = 0, out = 0, over = 0, neg = 0;
  for (const p of prods) {
    const q = onHand.get(p.id) ?? 0;
    const reorder = p.reorderLevel != null ? num(p.reorderLevel) : p.minStock != null ? num(p.minStock) : 0;
    const max = p.maxStock != null ? num(p.maxStock) : 0;
    if (q < 0) neg++;
    else if (q <= 0) out++;
    else if (reorder > 0 && q < reorder) low++;
    if (max > 0 && q > max) over++;
  }
  const [nearExp, expired, damaged, blocked] = await Promise.all([
    prisma.inventoryLot.groupBy({ by: ["productId"], where: { ...bizBranch, qtyOnHand: { gt: 0 }, warehouse: { notIn: BUCKET_WAREHOUSES }, expiryDate: { gte: today, lte: near } }, _sum: { qtyOnHand: true } }),
    prisma.inventoryLot.groupBy({ by: ["productId"], where: { ...bizBranch, qtyOnHand: { gt: 0 }, warehouse: { notIn: BUCKET_WAREHOUSES }, expiryDate: { lt: today, not: null } }, _sum: { qtyOnHand: true } }),
    prisma.inventoryBalance.aggregate({ where: { ...bizBranch, warehouse: BUCKET_WAREHOUSE.damaged, qtyOnHand: { gt: 0 } }, _sum: { qtyOnHand: true }, _count: true }),
    prisma.inventoryBalance.aggregate({ where: { ...bizBranch, warehouse: BUCKET_WAREHOUSE.quarantine, qtyOnHand: { gt: 0 } }, _sum: { qtyOnHand: true }, _count: true }),
  ]);
  const cards: HealthCard[] = [
    { key: "lowStock", label: "Low Stock", count: low, qty: low, tone: "warning" },
    { key: "outOfStock", label: "Out of Stock", count: out, qty: out, tone: "danger" },
    { key: "overStock", label: "Over Stock", count: over, qty: over, tone: "info" },
    { key: "negativeStock", label: "Negative Stock", count: neg, qty: neg, tone: "danger" },
    { key: "nearExpiry", label: "Near Expiry", count: nearExp.length, qty: r0(nearExp.reduce((s, r) => s + num(r._sum.qtyOnHand), 0)), tone: "warning" },
    { key: "expired", label: "Expired", count: expired.length, qty: r0(expired.reduce((s, r) => s + num(r._sum.qtyOnHand), 0)), tone: "danger" },
    { key: "damaged", label: "Damaged", count: damaged._count, qty: r0(num(damaged._sum.qtyOnHand)), tone: "danger" },
    { key: "blocked", label: "Blocked Stock", count: blocked._count, qty: r0(num(blocked._sum.qtyOnHand)), tone: "neutral" },
  ];
  // Health score: penalise out-of-stock, negative, expired the most.
  const totalSku = prods.length || 1;
  const penalty = (out * 3 + neg * 4 + low * 1 + expired.length * 3 + nearExp.length * 1) / totalSku * 100;
  const score = r0(Math.max(0, Math.min(100, 100 - penalty)));
  return { cards, score };
}

/* ------------------------------------------------------ operational widgets */
export async function operational(scope: ActiveScope, f: InvFilters) {
  void f;
  const bizBranch = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  const branchIn = scope.readBranchIds?.length ? { in: scope.readBranchIds } : undefined;
  const [grn, dispatch, receiptPending, transfer, allocation] = await Promise.all([
    prisma.goodsReceiptNote.count({ where: { ...bizBranch, status: "Draft", ...(branchIn ? { branchId: branchIn } : {}) } }),
    prisma.stockTransferDispatch.count({ where: { ...bizBranch, status: "Draft", ...(branchIn ? { sourceBranchId: branchIn } : {}) } }),
    prisma.stockTransferDispatch.count({ where: { ...bizBranch, status: { in: ["Dispatched", "Partially Dispatched", "Partially Received"] }, ...(branchIn ? { destinationBranchId: branchIn } : {}) } }),
    prisma.stockTransferRequest.count({ where: { ...bizBranch, status: { in: ["Submitted", "Approved"] } } }),
    prisma.stockAllocation.count({ where: { ...bizBranch, status: "Draft" } }),
  ]);
  return {
    items: [
      { key: "grn", label: "Pending GRN", count: grn, href: "/purchase/goods-receipt" },
      { key: "dispatch", label: "Pending Dispatch", count: dispatch, href: "/warehouse/transfer/dispatch" },
      { key: "receipt", label: "Pending Receipt", count: receiptPending, href: "/warehouse/transfer/receipt" },
      { key: "transfer", label: "Stock Transfer", count: transfer, href: "/warehouse/transfer/request" },
      { key: "allocation", label: "Pending Allocation", count: allocation, href: "/warehouse/transfer/allocation" },
      { key: "verification", label: "Physical Verification", count: 0, href: "/inventory/verification" },
    ],
  };
}

/* ------------------------------------------------------ movement */
export async function movement(scope: ActiveScope, f: InvFilters) {
  const rows = await prisma.inventoryLedger.findMany({ where: ledgerWhere(scope, f), select: { txnDate: true, direction: true, txnType: true, qty: true }, orderBy: { txnDate: "asc" }, take: 20000 });
  const byDay = new Map<string, { in: number; out: number }>();
  const byType = new Map<string, number>();
  for (const r of rows) {
    const d = r.txnDate || "—"; const q = num(r.qty);
    const g = byDay.get(d) ?? { in: 0, out: 0 };
    if (r.direction === "IN") g.in += q; else g.out += q;
    byDay.set(d, g);
    byType.set(r.txnType, (byType.get(r.txnType) ?? 0) + q);
  }
  const days = [...byDay.keys()].sort();
  let running = 0;
  const trend = days.map((d) => { const g = byDay.get(d)!; running += g.in - g.out; return { name: d.slice(5), value: r2(running) }; });
  const inOut = days.map((d) => { const g = byDay.get(d)!; return { name: d.slice(5), a: r2(g.in), b: r2(g.out) }; });
  const typeMix = [...byType.entries()].map(([name, value]) => ({ name: name.replace(/_/g, " "), value: r2(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  const totalIn = r2(inOut.reduce((s, x) => s + x.a, 0)), totalOut = r2(inOut.reduce((s, x) => s + x.b, 0));
  return { trend, inOut, typeMix, totalIn, totalOut, net: r2(totalIn - totalOut) };
}

/* ------------------------------------------------------ analytics */
export async function analytics(scope: ActiveScope, f: InvFilters) {
  const bals = await prisma.inventoryBalance.findMany({ where: balWhere(scope, f), select: { qtyOnHand: true, purchaseValue: true, warehouse: true, branchId: true, productId: true } });
  const prodIds = [...new Set(bals.map((b) => b.productId))];
  const [prods, branches] = await Promise.all([
    prodIds.length ? prisma.product.findMany({ where: { id: { in: prodIds } }, select: { id: true, category: true } }) : [],
    prisma.branch.findMany({ where: { tenantId: scope.tenantId }, select: { id: true, name: true } }),
  ]);
  const cat = new Map(prods.map((p) => [p.id, p.category || "Uncategorised"]));
  const bn = new Map(branches.map((b) => [b.id, b.name]));
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  const byCat = new Map<string, number>(), byBranch = new Map<string, number>(), byWh = new Map<string, number>();
  for (const b of bals) {
    const val = num(b.purchaseValue);
    add(byCat, cat.get(b.productId) ?? "Uncategorised", val);
    add(byBranch, b.branchId != null ? bn.get(b.branchId) ?? `#${b.branchId}` : "—", val);
    add(byWh, b.warehouse || "Main Store", num(b.qtyOnHand));
  }
  const top = (m: Map<string, number>, n = 8) => [...m.entries()].map(([name, value]) => ({ name, value: r2(value) })).sort((a, b) => b.value - a.value).slice(0, n);
  return { byCategory: top(byCat), byBranch: top(byBranch), byWarehouse: top(byWh) };
}

/* ------------------------------------------------------ health lists (Health tab) */
export async function healthList(scope: ActiveScope, f: InvFilters) {
  const { cards } = await stockHealth(scope, f);
  return { cards };
}
