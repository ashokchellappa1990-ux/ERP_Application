import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import {
  type SalesFilters, periodRange, prevPeriodRange, yearRange, prevYearRange,
  saleWhere, docWhere, returnWhere, customerWhere, productMatches,
} from "./filters";

/**
 * SALES COMMAND CENTER — data service. One function per dashboard section, all scoped +
 * filter-aware over the LIVE sales data (Sale = POS/B2B invoices, SalesDocument = orders +
 * quotations, SalesReturn). Gross profit = total − cost (FIFO COGS captured on each Sale).
 * "Executive" = cashier-as-executive proxy (Sale.cashierUserId → User.fullName). Region/State/
 * City are derived from the Branch. NO targets (a target module is deferred).
 */

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (cur: number, prev: number) => (prev !== 0 ? r2(((cur - prev) / Math.abs(prev)) * 100) : cur > 0 ? 100 : 0);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const today = () => new Date().toISOString().slice(0, 10);
const monthsBack = (period: string, n: number) => { const [y, m] = period.split("-").map(Number); const out: string[] = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`); } return out; };
const ORDER_OPEN = ["Draft", "Sent", "Accepted"];        // SalesDocument order not yet converted/cancelled/expired
const ORDER_DONE = ["Converted", "Completed"];

const saleDone = (scope: ActiveScope, f: SalesFilters, date = true): Prisma.SaleWhereInput => ({ ...saleWhere(scope, f, { date }), status: "Completed" });
const orderWhere = (scope: ActiveScope, f: SalesFilters, date = true): Prisma.SalesDocumentWhereInput => ({ ...docWhere(scope, f, { date }), docType: "order" });

async function monthlySaleValues(scope: ActiveScope, f: SalesFilters, months: string[]) {
  const rows = await prisma.sale.findMany({ where: { ...saleWhere(scope, f), status: "Completed", saleDate: { gte: `${months[0]}-01` } }, select: { saleDate: true, total: true } });
  const map = new Map<string, number>();
  for (const r of rows) { const k = r.saleDate.slice(0, 7); map.set(k, (map.get(k) ?? 0) + num(r.total)); }
  return months.map((k) => r2(map.get(k) ?? 0));
}

export interface Kpi { key: string; label: string; unit: "money" | "count" | "percent"; value: number; prev: number; growthPct: number; spark: number[]; tone: string }

// ---------------------------------------------------------------- KPIs
export async function executiveKpis(scope: ActiveScope, f: SalesFilters): Promise<Kpi[]> {
  const period = f.period || new Date().toISOString().slice(0, 7);
  const { from, to } = periodRange(f);
  const prev = prevPeriodRange(f);
  const yr = yearRange(f);
  const td = today();
  const spark = await monthlySaleValues(scope, f, monthsBack(period, 6));

  const [todayAgg, monthAgg, prevAgg, yearAgg, cancelled, ordersMonth, pendingOrders, orderAvg, retMonth, retPrev] = await Promise.all([
    prisma.sale.aggregate({ where: { ...saleWhere(scope, f), status: "Completed", saleDate: td }, _sum: { total: true } }),
    prisma.sale.aggregate({ where: saleDone(scope, f), _sum: { total: true, cost: true, subtotal: true, itemDiscount: true, billDiscount: true }, _count: true, _avg: { total: true } }),
    prisma.sale.aggregate({ where: { ...saleWhere(scope, f), status: "Completed", saleDate: { gte: prev.from, lte: prev.to } }, _sum: { total: true }, _count: true }),
    prisma.sale.aggregate({ where: { ...saleWhere(scope, f), status: "Completed", saleDate: { gte: yr.from, lte: yr.to } }, _sum: { total: true } }),
    prisma.sale.count({ where: { ...saleWhere(scope, f), status: "Cancelled", saleDate: { gte: from, lte: to } } }),
    prisma.salesDocument.count({ where: orderWhere(scope, f) }),
    prisma.salesDocument.count({ where: { ...orderWhere(scope, f, false), status: { in: ORDER_OPEN } } }),
    prisma.salesDocument.aggregate({ where: orderWhere(scope, f), _avg: { netAmount: true } }),
    prisma.salesReturn.aggregate({ where: { ...returnWhere(scope, f, { date: true }) }, _sum: { refundAmount: true } }),
    prisma.salesReturn.aggregate({ where: { ...returnWhere(scope, f), returnDate: { gte: prev.from, lte: prev.to } }, _sum: { refundAmount: true } }),
  ]);

  const salesMonth = num(monthAgg._sum.total);
  const salesPrev = num(prevAgg._sum.total);
  const grossSales = num(monthAgg._sum.subtotal);
  const grossProfit = salesMonth - num(monthAgg._sum.cost);
  const discountTotal = num(monthAgg._sum.itemDiscount) + num(monthAgg._sum.billDiscount);
  const returnValue = num(retMonth._sum.refundAmount);
  const netSales = salesMonth - returnValue;
  const avgDiscount = grossSales > 0 ? r2((discountTotal / grossSales) * 100) : 0;
  const marginPct = salesMonth > 0 ? r2((grossProfit / salesMonth) * 100) : 0;
  const returnPct = salesMonth > 0 ? r2((returnValue / salesMonth) * 100) : 0;

  const mk = (key: string, label: string, unit: Kpi["unit"], value: number, prevV: number, tone: string, sp: number[] = []): Kpi => ({ key, label, unit, value: r2(value), prev: r2(prevV), growthPct: pct(value, prevV), spark: sp, tone });
  return [
    mk("salesToday", "Today's Sales", "money", num(todayAgg._sum.total), 0, "success"),
    mk("salesMonth", "Current Month Sales", "money", salesMonth, salesPrev, "primary", spark),
    mk("salesYear", "Current Year Sales", "money", num(yearAgg._sum.total), 0, "primary"),
    mk("grossSales", "Gross Sales", "money", grossSales, 0, "secondary"),
    mk("netSales", "Net Sales", "money", netSales, 0, "success"),
    mk("grossProfit", "Gross Profit", "money", grossProfit, 0, "success"),
    mk("marginPct", "Gross Margin", "percent", marginPct, 0, marginPct >= 20 ? "success" : marginPct >= 10 ? "warning" : "danger"),
    mk("invoices", "Sales Invoices", "count", monthAgg._count, prevAgg._count, "info"),
    mk("orders", "Sales Orders", "count", ordersMonth, 0, "info"),
    mk("pendingOrders", "Pending Orders", "count", pendingOrders, 0, "warning"),
    mk("cancelled", "Cancelled Invoices", "count", cancelled, 0, "danger"),
    mk("avgInvoice", "Average Invoice Value", "money", num(monthAgg._avg.total), 0, "secondary"),
    mk("avgOrderValue", "Average Order Value", "money", num(orderAvg._avg.netAmount), 0, "secondary"),
    mk("avgDiscount", "Average Discount", "percent", avgDiscount, 0, "accent"),
    mk("returnValue", "Sales Return Value", "money", returnValue, num(retPrev._sum.refundAmount), "danger"),
    mk("returnPct", "Sales Return %", "percent", returnPct, 0, returnPct >= 5 ? "danger" : "success"),
  ];
}

// ---------------------------------------------------------------- TREND
export async function trend(scope: ActiveScope, f: SalesFilters) {
  const g = f.granularity || "monthly";
  const now = f.period ? new Date(`${f.period}-15T00:00:00Z`) : new Date();
  const buckets: { name: string; from: string; to: string }[] = [];
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (g === "daily") { for (let i = 29; i >= 0; i--) { const d = new Date(now.getTime() - i * 864e5); buckets.push({ name: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, from: iso(d), to: iso(d) }); } }
  else if (g === "weekly") { for (let i = 11; i >= 0; i--) { const end = new Date(now.getTime() - i * 7 * 864e5); const start = new Date(end.getTime() - 6 * 864e5); buckets.push({ name: `${start.getUTCDate()}/${start.getUTCMonth() + 1}`, from: iso(start), to: iso(end) }); } }
  else if (g === "quarterly") { const qy = now.getUTCFullYear(); const qm = now.getUTCMonth(); for (let i = 3; i >= 0; i--) { const qStartMonth = Math.floor(qm / 3) * 3 - i * 3; const d = new Date(Date.UTC(qy, qStartMonth, 1)); const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 0)); buckets.push({ name: `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${String(d.getUTCFullYear()).slice(2)}`, from: iso(d), to: iso(e) }); } }
  else if (g === "yearly") { const y = now.getUTCFullYear(); for (let i = 2; i >= 0; i--) buckets.push({ name: String(y - i), from: `${y - i}-01-01`, to: `${y - i}-12-31` }); }
  else { const [yy, mm] = (f.period || iso(now).slice(0, 7)).split("-").map(Number); for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(yy, mm - 1 - i, 1)); const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); buckets.push({ name: MON[d.getUTCMonth()], from: iso(d), to: iso(e) }); } }

  const rows = await prisma.sale.findMany({ where: { ...saleWhere(scope, f), status: "Completed", saleDate: { gte: buckets[0].from, lte: buckets[buckets.length - 1].to } }, select: { saleDate: true, total: true } });
  const points = buckets.map((b) => ({ name: b.name, value: r2(rows.filter((r) => r.saleDate >= b.from && r.saleDate <= b.to).reduce((s, r) => s + num(r.total), 0)) }));
  const currentTotal = r2(points.reduce((s, p) => s + p.value, 0));
  const half = Math.floor(points.length / 2);
  const prevTotal = r2(points.slice(0, half).reduce((s, p) => s + p.value, 0));
  const curHalf = r2(points.slice(half).reduce((s, p) => s + p.value, 0));
  return { granularity: g, points, currentTotal, growthPct: pct(curHalf, prevTotal) };
}

// ---------------------------------------------------------------- TOP BRANCHES
export async function topBranches(scope: ActiveScope, f: SalesFilters) {
  const prev = prevPeriodRange(f);
  const [cur, pr, branches] = await Promise.all([
    prisma.sale.groupBy({ by: ["branchId"], where: saleDone(scope, f), _sum: { total: true }, _count: true }),
    prisma.sale.groupBy({ by: ["branchId"], where: { ...saleWhere(scope, f), status: "Completed", saleDate: { gte: prev.from, lte: prev.to } }, _sum: { total: true } }),
    prisma.branch.findMany({ where: scopeWhereBranch(scope), select: { id: true, name: true } }),
  ]);
  const bmap = new Map(branches.map((b) => [b.id, b.name]));
  const prevMap = new Map(pr.map((r) => [r.branchId, num(r._sum.total)]));
  const rows = cur.map((r) => { const value = r2(num(r._sum.total)); const prevV = num(prevMap.get(r.branchId)); return { name: r.branchId != null ? bmap.get(r.branchId) ?? `Branch ${r.branchId}` : "Unassigned", value, orders: r._count, growthPct: pct(value, prevV) }; }).sort((a, b) => b.value - a.value).slice(0, 10);
  return { branches: rows };
}

// ---------------------------------------------------------------- TOP EXECUTIVES (cashier proxy)
export async function topExecutives(scope: ActiveScope, f: SalesFilters) {
  const rows = await prisma.sale.groupBy({ by: ["cashierUserId"], where: saleDone(scope, f), _sum: { total: true }, _count: true, orderBy: { _sum: { total: "desc" } }, take: 10 });
  const ids = rows.map((r) => r.cashierUserId).filter((x): x is number => x != null);
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } }) : [];
  const umap = new Map(users.map((u) => [u.id, u.fullName]));
  return { executives: rows.map((r) => ({ name: r.cashierUserId != null ? umap.get(r.cashierUserId) || `User ${r.cashierUserId}` : "Unattributed", sales: r2(num(r._sum.total)), orders: r._count })) };
}

// ---------------------------------------------------------------- RECENT ACTIVITY
export async function recentActivity(scope: ActiveScope, f: SalesFilters) {
  const [orders, invoices, returns] = await Promise.all([
    prisma.salesDocument.findMany({ where: { ...docWhere(scope, f), docType: "order" }, orderBy: { id: "desc" }, take: 8, select: { id: true, docNo: true, customerName: true, netAmount: true, docDate: true, status: true } }),
    prisma.sale.findMany({ where: saleWhere(scope, f), orderBy: { id: "desc" }, take: 8, select: { id: true, invoiceNo: true, customerName: true, total: true, saleDate: true, channel: true, status: true } }),
    prisma.salesReturn.findMany({ where: returnWhere(scope, f), orderBy: { id: "desc" }, take: 8, select: { id: true, returnNo: true, customerName: true, refundAmount: true, returnDate: true, status: true } }),
  ]);
  return {
    orders: orders.map((o) => ({ id: o.id, no: o.docNo, customer: o.customerName ?? "—", amount: r2(num(o.netAmount)), date: o.docDate, status: o.status, href: `/sales/order/${o.id}` })),
    invoices: invoices.map((i) => ({ id: i.id, no: i.invoiceNo, customer: i.customerName ?? "Walk-in", amount: r2(num(i.total)), date: i.saleDate, status: i.channel, href: `/sales/history` })),
    returns: returns.map((r) => ({ id: r.id, no: r.returnNo, customer: r.customerName ?? "—", amount: r2(num(r.refundAmount)), date: r.returnDate, status: r.status, href: `/sales/return` })),
  };
}

// ---------------------------------------------------------------- PRODUCT PERFORMANCE
type NV = { name: string; value: number };
async function saleLineAgg(scope: ActiveScope, f: SalesFilters) {
  const rows = await prisma.saleLine.groupBy({ by: ["productId"], where: { sale: { is: saleDone(scope, f) } }, _sum: { qty: true, value: true, cost: true } });
  const ids = rows.map((r) => r.productId);
  const products = ids.length ? await prisma.product.findMany({ where: { tenantId: scope.tenantId, id: { in: ids } }, select: { id: true, name: true, category: true, brand: true } }) : [];
  const pmap = new Map(products.map((p) => [p.id, p]));
  return rows.map((r) => { const p = pmap.get(r.productId); return { id: r.productId, name: p?.name ?? `#${r.productId}`, category: p?.category ?? "Uncategorised", brand: p?.brand ?? "—", qty: r2(num(r._sum.qty)), value: r2(num(r._sum.value)), cost: r2(num(r._sum.cost)), _p: p }; }).filter((x) => productMatches(f, x._p));
}

export async function productPerformance(scope: ActiveScope, f: SalesFilters) {
  const [agg, activeCount] = await Promise.all([
    saleLineAgg(scope, f),
    prisma.product.count({ where: { tenantId: scope.tenantId, status: "Active" } }),
  ]);
  const topRevenue: NV[] = [...agg].sort((a, b) => b.value - a.value).slice(0, 8).map((x) => ({ name: x.name, value: x.value }));
  const topQty: NV[] = [...agg].sort((a, b) => b.qty - a.qty).slice(0, 8).map((x) => ({ name: x.name, value: x.qty }));
  const topProfit: NV[] = [...agg].map((x) => ({ name: x.name, value: r2(x.value - x.cost) })).sort((a, b) => b.value - a.value).slice(0, 8);
  const slow: NV[] = [...agg].filter((x) => x.qty > 0).sort((a, b) => a.qty - b.qty).slice(0, 8).map((x) => ({ name: x.name, value: x.qty }));
  const movingCount = agg.length;
  const nonMovingCount = Math.max(0, activeCount - movingCount);
  return { topRevenue, topQty, topProfit, slow, movingCount, nonMovingCount, activeCount };
}

// ---------------------------------------------------------------- CATEGORY / BRAND MIX
export async function mix(scope: ActiveScope, f: SalesFilters) {
  const agg = await saleLineAgg(scope, f);
  const cat = new Map<string, number>(), brand = new Map<string, number>();
  for (const x of agg) { cat.set(x.category, (cat.get(x.category) ?? 0) + x.value); brand.set(x.brand, (brand.get(x.brand) ?? 0) + x.value); }
  const sortNV = (m: Map<string, number>) => [...m.entries()].map(([name, value]) => ({ name, value: r2(value) })).sort((a, b) => b.value - a.value);
  const byCategory = sortNV(cat).slice(0, 10);
  const byBrand = sortNV(brand).filter((x) => x.name !== "—").slice(0, 10);
  const catTotal = byCategory.reduce((s, x) => s + x.value, 0) || 1;
  const brandTotal = byBrand.reduce((s, x) => s + x.value, 0) || 1;
  return {
    byCategory, byBrand,
    categoryContribution: byCategory.map((x) => ({ name: x.name, value: r2((x.value / catTotal) * 100) })),
    brandContribution: byBrand.map((x) => ({ name: x.name, value: r2((x.value / brandTotal) * 100) })),
  };
}

// ---------------------------------------------------------------- RETURN ANALYSIS
export async function returnAnalysis(scope: ActiveScope, f: SalesFilters) {
  const period = f.period || new Date().toISOString().slice(0, 7);
  const months = monthsBack(period, 6);
  const [rows, lines, salesMonth, retMonth] = await Promise.all([
    prisma.salesReturn.findMany({ where: { ...returnWhere(scope, f), returnDate: { gte: `${months[0]}-01` } }, select: { returnDate: true, refundAmount: true } }),
    prisma.salesReturnLine.groupBy({ by: ["productId"], where: { salesReturn: { is: returnWhere(scope, f, { date: true }) } }, _sum: { returnValue: true, returnQty: true }, orderBy: { _sum: { returnValue: "desc" } }, take: 8 }).catch(() => [] as { productId: number; _sum: { returnValue: number | null; returnQty: number | null } }[]),
    prisma.sale.aggregate({ where: saleDone(scope, f), _sum: { total: true } }),
    prisma.salesReturn.aggregate({ where: returnWhere(scope, f, { date: true }), _sum: { refundAmount: true } }),
  ]);
  const map = new Map<string, number>();
  for (const r of rows) { const k = r.returnDate.slice(0, 7); map.set(k, (map.get(k) ?? 0) + num(r.refundAmount)); }
  const trendPts = months.map((k) => ({ name: MON[Number(k.split("-")[1]) - 1], value: r2(map.get(k) ?? 0) }));
  const ids = lines.map((l) => l.productId);
  const products = ids.length ? await prisma.product.findMany({ where: { tenantId: scope.tenantId, id: { in: ids } }, select: { id: true, name: true } }) : [];
  const pmap = new Map(products.map((p) => [p.id, p.name]));
  const topReturned = lines.map((l) => ({ name: pmap.get(l.productId) ?? `#${l.productId}`, value: r2(num(l._sum.returnValue)) }));
  const rv = num(retMonth._sum.refundAmount); const sv = num(salesMonth._sum.total);
  return { trend: trendPts, topReturned, returnValue: r2(rv), returnPct: sv > 0 ? r2((rv / sv) * 100) : 0 };
}

// ---------------------------------------------------------------- CUSTOMER ANALYTICS
export async function customerAnalytics(scope: ActiveScope, f: SalesFilters) {
  const { from, to } = periodRange(f);
  const period = f.period || new Date().toISOString().slice(0, 7);
  const months = monthsBack(period, 6);
  const cw = customerWhere(scope, f);
  const [totalCustomers, activeCustomers, newCustomers, acqRows, monthSales, repeatRows] = await Promise.all([
    prisma.customer.count({ where: cw }),
    prisma.customer.count({ where: { ...cw, status: "Active" } }),
    prisma.customer.count({ where: { ...cw, createdAt: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) } } }),
    prisma.customer.findMany({ where: { ...cw, createdAt: { gte: new Date(`${months[0]}-01T00:00:00Z`) } }, select: { createdAt: true } }),
    prisma.sale.findMany({ where: saleDone(scope, f), select: { customerId: true, total: true } }),
    prisma.sale.groupBy({ by: ["customerId"], where: { ...saleWhere(scope, f), status: "Completed", customerId: { not: null } }, _count: true }),
  ]);
  // acquisition trend (6 months)
  const acq = new Map<string, number>();
  for (const c of acqRows) { const k = c.createdAt.toISOString().slice(0, 7); acq.set(k, (acq.get(k) ?? 0) + 1); }
  const acquisition = months.map((k) => ({ name: MON[Number(k.split("-")[1]) - 1], value: acq.get(k) ?? 0 }));
  const repeatCustomers = repeatRows.filter((r) => r._count > 1).length;
  const buyers = repeatRows.length || 1;
  // per-customer breakdowns for the month
  const custIds = [...new Set(monthSales.map((s) => s.customerId).filter((x): x is number => x != null))];
  const customers = custIds.length ? await prisma.customer.findMany({ where: { tenantId: scope.tenantId, id: { in: custIds } }, select: { id: true, name: true, type: true, category: true, city: true, state: true } }) : [];
  const cmap = new Map(customers.map((c) => [c.id, c]));
  const byType = new Map<string, number>(), byCategory = new Map<string, number>(), byCity = new Map<string, number>(), byState = new Map<string, number>(), byCustomer = new Map<number, { name: string; value: number }>();
  for (const s of monthSales) {
    const v = num(s.total); const c = s.customerId != null ? cmap.get(s.customerId) : null;
    byType.set(c?.type || "Unclassified", (byType.get(c?.type || "Unclassified") ?? 0) + v);
    byCategory.set(c?.category || "Unclassified", (byCategory.get(c?.category || "Unclassified") ?? 0) + v);
    if (c?.city) byCity.set(c.city, (byCity.get(c.city) ?? 0) + v);
    if (c?.state) byState.set(c.state, (byState.get(c.state) ?? 0) + v);
    if (s.customerId != null) { const e = byCustomer.get(s.customerId) ?? { name: c?.name || "Walk-in", value: 0 }; e.value += v; byCustomer.set(s.customerId, e); }
  }
  const sortNV = (m: Map<string, number>) => [...m.entries()].map(([name, value]) => ({ name, value: r2(value) })).sort((a, b) => b.value - a.value);
  const topCustomers = [...byCustomer.values()].map((x) => ({ name: x.name, value: r2(x.value) })).sort((a, b) => b.value - a.value).slice(0, 10);
  return {
    totals: { totalCustomers, activeCustomers, inactiveCustomers: Math.max(0, totalCustomers - activeCustomers), newCustomers, repeatCustomers, repeatPct: r2((repeatCustomers / buyers) * 100) },
    byType: sortNV(byType).slice(0, 8), byCategory: sortNV(byCategory).slice(0, 8),
    byCity: sortNV(byCity).slice(0, 8), byState: sortNV(byState).slice(0, 8),
    topCustomers, acquisition,
  };
}

// ---------------------------------------------------------------- ANALYTICS (deep)
export async function analytics(scope: ActiveScope, f: SalesFilters) {
  const { from, to } = periodRange(f);
  const prev = prevPeriodRange(f);
  const yr = yearRange(f); const pyr = prevYearRange(f);
  const [byChannelRows, byBranchRows, branches, mm, mmPrev, yy, yyPrev, discAgg, cancelAgg, mixData, custData, execData] = await Promise.all([
    prisma.sale.groupBy({ by: ["channel"], where: saleDone(scope, f), _sum: { total: true }, _count: true }),
    prisma.sale.groupBy({ by: ["branchId"], where: saleDone(scope, f), _sum: { total: true }, _count: true }),
    prisma.branch.findMany({ where: scopeWhereBranch(scope), select: { id: true, name: true, state: true, city: true } }),
    prisma.sale.aggregate({ where: saleDone(scope, f), _sum: { total: true } }),
    prisma.sale.aggregate({ where: { ...saleWhere(scope, f), status: "Completed", saleDate: { gte: prev.from, lte: prev.to } }, _sum: { total: true } }),
    prisma.sale.aggregate({ where: { ...saleWhere(scope, f), status: "Completed", saleDate: { gte: yr.from, lte: yr.to } }, _sum: { total: true } }),
    prisma.sale.aggregate({ where: { ...saleWhere(scope, f), status: "Completed", saleDate: { gte: pyr.from, lte: pyr.to } }, _sum: { total: true } }),
    prisma.sale.aggregate({ where: saleDone(scope, f), _sum: { itemDiscount: true, billDiscount: true, subtotal: true } }),
    prisma.sale.aggregate({ where: { ...saleWhere(scope, f), status: "Cancelled", saleDate: { gte: from, lte: to } }, _sum: { total: true }, _count: true }),
    mix(scope, f),
    customerAnalytics(scope, f),
    topExecutives(scope, f),
  ]);
  const bmap = new Map(branches.map((b) => [b.id, b]));
  const byBranch = byBranchRows.map((r) => ({ name: r.branchId != null ? bmap.get(r.branchId)?.name ?? `Branch ${r.branchId}` : "Unassigned", value: r2(num(r._sum.total)) })).sort((a, b) => b.value - a.value);
  const stateMap = new Map<string, number>(), cityMap = new Map<string, number>();
  for (const r of byBranchRows) { const b = r.branchId != null ? bmap.get(r.branchId) : null; const v = num(r._sum.total); if (b?.state) stateMap.set(b.state, (stateMap.get(b.state) ?? 0) + v); if (b?.city) cityMap.set(b.city, (cityMap.get(b.city) ?? 0) + v); }
  const sortNV = (m: Map<string, number>) => [...m.entries()].map(([name, value]) => ({ name, value: r2(value) })).sort((a, b) => b.value - a.value);
  const byChannel = byChannelRows.map((r) => ({ name: r.channel, value: r2(num(r._sum.total)) })).sort((a, b) => b.value - a.value);
  const discountTotal = num(discAgg._sum.itemDiscount) + num(discAgg._sum.billDiscount);
  const execs = execData.executives;
  return {
    byBranch, byChannel, byState: sortNV(stateMap), byCity: sortNV(cityMap),
    byCategory: mixData.byCategory, byBrand: mixData.byBrand,
    byCustomerCategory: custData.byCategory, byCustomerType: custData.byType,
    comparativeMoM: { current: r2(num(mm._sum.total)), previous: r2(num(mmPrev._sum.total)), growthPct: pct(num(mm._sum.total), num(mmPrev._sum.total)) },
    comparativeYoY: { current: r2(num(yy._sum.total)), previous: r2(num(yyPrev._sum.total)), growthPct: pct(num(yy._sum.total), num(yyPrev._sum.total)) },
    discount: { total: r2(discountTotal), pct: num(discAgg._sum.subtotal) > 0 ? r2((discountTotal / num(discAgg._sum.subtotal)) * 100) : 0 },
    cancellation: { value: r2(num(cancelAgg._sum.total)), count: cancelAgg._count },
    ranking: {
      topBranch: byBranch[0] ?? null, lowBranch: byBranch.length > 1 ? byBranch[byBranch.length - 1] : null,
      topExec: execs[0] ? { name: execs[0].name, value: execs[0].sales } : null,
      lowExec: execs.length > 1 ? { name: execs[execs.length - 1].name, value: execs[execs.length - 1].sales } : null,
    },
  };
}

// ---------------------------------------------------------------- SCORECARD
export async function scorecard(scope: ActiveScope, f: SalesFilters) {
  const [kpis, ra, ca, ordersMonth, doneOrders] = await Promise.all([
    executiveKpis(scope, f), returnAnalysis(scope, f), customerAnalytics(scope, f),
    prisma.salesDocument.count({ where: orderWhere(scope, f) }),
    prisma.salesDocument.count({ where: { ...orderWhere(scope, f), status: { in: ORDER_DONE } } }),
  ]);
  const kv = (k: string) => kpis.find((x) => x.key === k);
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const growth = kv("salesMonth")?.growthPct ?? 0;
  const growthScore = clamp(60 + growth); // 0% growth → 60
  const marginScore = clamp((kv("marginPct")?.value ?? 0) * 3); // 33% margin → 100
  const returnScore = clamp(100 - ra.returnPct * 8);
  const conversionScore = ordersMonth > 0 ? clamp((doneOrders / ordersMonth) * 100) : 70;
  const customerScore = clamp(ca.totals.repeatPct * 1.5);
  const aiScore = clamp((growthScore + marginScore + returnScore + conversionScore + customerScore) / 5);
  const subScores = [
    { label: "Sales Growth", score: growthScore }, { label: "Profitability", score: marginScore },
    { label: "Return Control", score: returnScore }, { label: "Order Conversion", score: conversionScore },
    { label: "Customer Loyalty", score: customerScore }, { label: "AI Sales Score", score: aiScore },
  ];
  const overall = clamp(subScores.reduce((s, x) => s + x.score, 0) / subScores.length);
  const band = overall >= 80 ? "Excellent" : overall >= 60 ? "Good" : overall >= 40 ? "Average" : "Critical";
  return { overall, band, subScores };
}

// scope helper for branch master (tenant + business + branch visibility)
function scopeWhereBranch(scope: ActiveScope): Prisma.BranchWhereInput {
  const w: Prisma.BranchWhereInput = { tenantId: scope.tenantId };
  if (scope.businessId != null) w.businessId = scope.businessId;
  if (scope.readBranchIds && scope.readBranchIds.length) w.id = { in: scope.readBranchIds };
  return w;
}
