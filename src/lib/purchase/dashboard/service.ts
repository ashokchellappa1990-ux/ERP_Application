import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { fyFromDate, computeUsage } from "@/lib/finance/budgetService";
import { type PurchaseFilters, periodRange, prevPeriodRange, poWhere, piWhere, grnWhere, payWhere, returnWhere, invWhere, supplierWhere } from "./filters";

/**
 * PROCUREMENT COMMAND CENTER — data service. One function per dashboard section, all
 * scoped + filter-aware. Real data where the ERP stores it; supplier on-time %, lead time
 * and the procurement scorecard are COMPUTED from PO→GRN history (GRN.poNo ↔ PurchaseOrder.poNo).
 */

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (cur: number, prev: number) => (prev !== 0 ? r2(((cur - prev) / Math.abs(prev)) * 100) : cur > 0 ? 100 : 0);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const monthsBack = (period: string, n: number) => { const [y, m] = period.split("-").map(Number); const out: string[] = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`); } return out; };
const OPEN_PO = ["Approved", "Issued", "Partially Received"];

// ---- shared 6-month PI value + PO count series (for sparklines) ----
async function monthlyPiValues(scope: ActiveScope, f: PurchaseFilters, months: string[]) {
  const rows = await prisma.purchaseInvoice.findMany({ where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: `${months[0]}-01` } }, select: { supplierInvoiceDate: true, netPayable: true } });
  const map = new Map<string, number>();
  for (const r of rows) { if (!r.supplierInvoiceDate) continue; const k = r.supplierInvoiceDate.slice(0, 7); map.set(k, (map.get(k) ?? 0) + num(r.netPayable)); }
  return months.map((k) => r2(map.get(k) ?? 0));
}

export interface Kpi { key: string; label: string; unit: "money" | "count" | "percent" | "days"; value: number; prev: number; growthPct: number; spark: number[]; tone: string }

export async function executiveKpis(scope: ActiveScope, f: PurchaseFilters): Promise<Kpi[]> {
  const period = f.period || new Date().toISOString().slice(0, 7);
  const { from, to } = periodRange(f);
  const prev = prevPeriodRange(f);
  const td = today();
  const months = monthsBack(period, 6);
  const spark = await monthlyPiValues(scope, f, months);

  const [poToday, poMonth, poMonthPrev, valToday, valMonth, valPrev, pendingPO, pendingAppr, partRecv, fullRecv, cancelled, cancelledPrev, avgVal, openCommit, retMonth, retPrev, payable, poForLead, grnForLead, budget] = await Promise.all([
    prisma.purchaseOrder.count({ where: { ...poWhere(scope, f), poDate: td } }),
    prisma.purchaseOrder.count({ where: { ...poWhere(scope, f), poDate: { gte: from, lte: to } } }),
    prisma.purchaseOrder.count({ where: { ...poWhere(scope, f), poDate: { gte: prev.from, lte: prev.to } } }),
    prisma.purchaseInvoice.aggregate({ where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: td }, _sum: { netPayable: true } }),
    prisma.purchaseInvoice.aggregate({ where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: from, lte: to } }, _sum: { netPayable: true }, _count: true, _avg: { netPayable: true } }),
    prisma.purchaseInvoice.aggregate({ where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: prev.from, lte: prev.to } }, _sum: { netPayable: true } }),
    prisma.purchaseOrder.count({ where: { ...poWhere(scope, f), status: "Draft" } }),
    prisma.purchaseInvoice.count({ where: { ...piWhere(scope, f), status: "Pending Approval" } }),
    prisma.purchaseOrder.count({ where: { ...poWhere(scope, f), status: "Partially Received" } }),
    prisma.purchaseOrder.count({ where: { ...poWhere(scope, f), status: "Received" } }),
    prisma.purchaseOrder.count({ where: { ...poWhere(scope, f), status: "Cancelled", poDate: { gte: from, lte: to } } }),
    prisma.purchaseOrder.count({ where: { ...poWhere(scope, f), status: "Cancelled", poDate: { gte: prev.from, lte: prev.to } } }),
    prisma.purchaseInvoice.aggregate({ where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: from, lte: to } }, _avg: { netPayable: true } }),
    prisma.purchaseOrder.aggregate({ where: { ...poWhere(scope, f), status: { in: OPEN_PO } }, _sum: { netAmount: true } }),
    prisma.purchaseReturn.aggregate({ where: { ...returnWhere(scope, f), returnDate: { gte: from, lte: to } }, _sum: { returnAmount: true } }).catch(() => ({ _sum: { returnAmount: 0 } })),
    prisma.purchaseReturn.aggregate({ where: { ...returnWhere(scope, f), returnDate: { gte: prev.from, lte: prev.to } }, _sum: { returnAmount: true } }).catch(() => ({ _sum: { returnAmount: 0 } })),
    prisma.payable.aggregate({ where: { ...payWhere(scope, f), status: { in: ["Open", "Partial"] } }, _sum: { balanceAmount: true } }),
    prisma.purchaseOrder.findMany({ where: { ...poWhere(scope, f) }, select: { poNo: true, poDate: true, expectedDeliveryDate: true }, take: 3000 }),
    prisma.goodsReceiptNote.findMany({ where: { ...grnWhere(scope, f), status: "Posted" }, select: { poNo: true, grnDate: true }, take: 3000 }),
    budgetUtil(scope, f),
  ]);

  // Late deliveries + avg lead time (PO↔GRN by poNo).
  const grnByPo = new Map<string, string>(); // poNo -> earliest grnDate
  for (const g of grnForLead) { if (!g.poNo) continue; const cur = grnByPo.get(g.poNo); if (!cur || g.grnDate < cur) grnByPo.set(g.poNo, g.grnDate); }
  let leadSum = 0, leadN = 0, late = 0;
  for (const p of poForLead) {
    const g = grnByPo.get(p.poNo);
    if (g && p.poDate) { const d = daysBetween(g, p.poDate); if (d >= 0) { leadSum += d; leadN++; } }
    if (!g && p.expectedDeliveryDate && p.expectedDeliveryDate < td) late++;
  }
  const avgLead = leadN ? Math.round(leadSum / leadN) : 0;

  const mk = (key: string, label: string, unit: Kpi["unit"], value: number, prevV: number, tone: string, sp: number[] = []): Kpi => ({ key, label, unit, value: r2(value), prev: r2(prevV), growthPct: pct(value, prevV), spark: sp, tone });
  return [
    mk("poToday", "Today's Purchase Orders", "count", poToday, 0, "primary"),
    mk("poMonth", "Purchase Orders (month)", "count", poMonth, poMonthPrev, "primary"),
    mk("valToday", "Purchase Value Today", "money", num(valToday._sum.netPayable), 0, "success"),
    mk("valMonth", "Purchase Value (month)", "money", num(valMonth._sum.netPayable), num(valPrev._sum.netPayable), "success", spark),
    mk("pendingPO", "Pending Purchase Orders", "count", pendingPO, 0, "warning"),
    mk("pendingAppr", "Pending Approvals", "count", pendingAppr, 0, "warning"),
    mk("partRecv", "Partially Received", "count", partRecv, 0, "info"),
    mk("fullRecv", "Fully Received", "count", fullRecv, 0, "success"),
    mk("late", "Late Deliveries", "count", late, 0, "danger"),
    mk("cancelled", "Cancelled Orders", "count", cancelled, cancelledPrev, "danger"),
    mk("avgVal", "Average Purchase Value", "money", num(valMonth._avg.netPayable ?? avgVal._avg.netPayable), 0, "secondary"),
    mk("openCommit", "Open Purchase Commitments", "money", num(openCommit._sum.netAmount), 0, "primary"),
    mk("retValue", "Purchase Return Value", "money", num(retMonth._sum.returnAmount), num(retPrev._sum.returnAmount), "accent"),
    mk("avgLead", "Avg Supplier Lead Time", "days", avgLead, 0, "info"),
    mk("budgetUtil", "Budget Utilization", "percent", budget, 0, budget >= 90 ? "danger" : "success"),
    mk("payable", "Outstanding Payables", "money", num(payable._sum.balanceAmount), 0, "danger"),
  ];
}

async function budgetUtil(scope: ActiveScope, f: PurchaseFilters): Promise<number> {
  try { const b = await budgetMonitor(scope, f); return b.utilizationPct; } catch { return 0; }
}

// ---------------------------------------------------------------- PIPELINE
export async function pipeline(scope: ActiveScope, f: PurchaseFilters) {
  const poRows = await prisma.purchaseOrder.groupBy({ by: ["status"], where: poWhere(scope, f), _count: true, _sum: { netAmount: true } });
  const poMap = new Map(poRows.map((r) => [r.status, { count: r._count, value: r2(num(r._sum.netAmount)) }]));
  const stage = (name: string, s: string) => ({ name, count: poMap.get(s)?.count ?? 0, value: poMap.get(s)?.value ?? 0 });
  const [awaitingInv, invoiced, paymentPending] = await Promise.all([
    prisma.goodsReceiptNote.aggregate({ where: { ...grnWhere(scope, f), status: "Posted", invoiceRecorded: false }, _count: true, _sum: { totalValue: true } }),
    prisma.purchaseInvoice.aggregate({ where: { ...piWhere(scope, f), status: { in: ["Approved", "Posted"] } }, _count: true, _sum: { netPayable: true } }),
    prisma.payable.aggregate({ where: { ...payWhere(scope, f), status: { in: ["Open", "Partial"] } }, _count: true, _sum: { balanceAmount: true } }),
  ]);
  return {
    stages: [
      stage("Draft", "Draft"), stage("Approved", "Approved"), stage("Issued (Released)", "Issued"),
      stage("Partially Received", "Partially Received"), stage("Fully Received", "Received"),
      { name: "Awaiting Invoice", count: awaitingInv._count, value: r2(num(awaitingInv._sum.totalValue)) },
      { name: "Invoiced", count: invoiced._count, value: r2(num(invoiced._sum.netPayable)) },
      { name: "Payment Pending", count: paymentPending._count, value: r2(num(paymentPending._sum.balanceAmount)) },
      stage("Completed (Closed)", "Closed"), stage("Cancelled", "Cancelled"),
    ],
  };
}

// ---------------------------------------------------------------- TREND
export async function trend(scope: ActiveScope, f: PurchaseFilters) {
  const g = f.granularity || "monthly";
  const now = f.period ? new Date(`${f.period}-15T00:00:00Z`) : new Date();
  const buckets: { key: string; name: string; from: string; to: string }[] = [];
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (g === "daily") { for (let i = 29; i >= 0; i--) { const d = new Date(now.getTime() - i * 864e5); buckets.push({ key: iso(d), name: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, from: iso(d), to: iso(d) }); } }
  else if (g === "weekly") { for (let i = 11; i >= 0; i--) { const end = new Date(now.getTime() - i * 7 * 864e5); const start = new Date(end.getTime() - 6 * 864e5); buckets.push({ key: iso(start), name: `${start.getUTCDate()}/${start.getUTCMonth() + 1}`, from: iso(start), to: iso(end) }); } }
  else if (g === "quarterly") { const qy = now.getUTCFullYear(); const qm = now.getUTCMonth(); for (let i = 3; i >= 0; i--) { const qStartMonth = Math.floor(qm / 3) * 3 - i * 3; const d = new Date(Date.UTC(qy, qStartMonth, 1)); const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 0)); buckets.push({ key: iso(d), name: `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${String(d.getUTCFullYear()).slice(2)}`, from: iso(d), to: iso(e) }); } }
  else if (g === "yearly") { const y = now.getUTCFullYear(); for (let i = 2; i >= 0; i--) buckets.push({ key: String(y - i), name: String(y - i), from: `${y - i}-01-01`, to: `${y - i}-12-31` }); }
  else { const [yy, mm] = (f.period || iso(now).slice(0, 7)).split("-").map(Number); for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(yy, mm - 1 - i, 1)); const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); buckets.push({ key: iso(d).slice(0, 7), name: MON[d.getUTCMonth()], from: iso(d), to: iso(e) }); } }

  const windowFrom = buckets[0].from;
  const rows = await prisma.purchaseInvoice.findMany({ where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: windowFrom, lte: buckets[buckets.length - 1].to } }, select: { supplierInvoiceDate: true, netPayable: true } });
  const points = buckets.map((b) => ({ name: b.name, value: r2(rows.filter((r) => r.supplierInvoiceDate && r.supplierInvoiceDate >= b.from && r.supplierInvoiceDate <= b.to).reduce((s, r) => s + num(r.netPayable), 0)) }));
  const currentTotal = r2(points.reduce((s, p) => s + p.value, 0));
  const half = Math.floor(points.length / 2);
  const prevTotal = r2(points.slice(0, half).reduce((s, p) => s + p.value, 0));
  const curHalf = r2(points.slice(half).reduce((s, p) => s + p.value, 0));
  return { granularity: g, points, currentTotal, growthPct: pct(curHalf, prevTotal) };
}

// ---------------------------------------------------------------- SUPPLIERS
export async function supplierPerformance(scope: ActiveScope, f: PurchaseFilters) {
  const period = f.period || new Date().toISOString().slice(0, 7);
  const from6 = `${monthsBack(period, 6)[0]}-01`;
  const [spend, pos, grns, payables, returns] = await Promise.all([
    prisma.purchaseInvoice.groupBy({ by: ["supplier"], where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: from6 } }, _sum: { netPayable: true }, _count: true, orderBy: { _sum: { netPayable: "desc" } }, take: 10 }),
    prisma.purchaseOrder.findMany({ where: { ...poWhere(scope, f) }, select: { supplier: true, poNo: true, poDate: true, expectedDeliveryDate: true } , take: 4000 }),
    prisma.goodsReceiptNote.findMany({ where: { ...grnWhere(scope, f), status: "Posted" }, select: { poNo: true, grnDate: true, supplier: true }, take: 4000 }),
    prisma.payable.groupBy({ by: ["supplier"], where: { ...payWhere(scope, f), status: { in: ["Open", "Partial"] } }, _sum: { balanceAmount: true } }),
    prisma.purchaseReturn.groupBy({ by: ["supplier"], where: { ...returnWhere(scope, f), returnDate: { gte: from6 } }, _sum: { returnAmount: true } }).catch(() => []),
  ]);
  const grnByPo = new Map<string, string>();
  for (const g of grns) { if (!g.poNo) continue; const c = grnByPo.get(g.poNo); if (!c || g.grnDate < c) grnByPo.set(g.poNo, g.grnDate); }
  // per-supplier delivery stats from its POs
  const supStats = new Map<string, { onTime: number; total: number; leadSum: number; leadN: number; orders: number }>();
  for (const p of pos) { const s = p.supplier ?? "—"; const e = supStats.get(s) ?? { onTime: 0, total: 0, leadSum: 0, leadN: 0, orders: 0 }; e.orders++; const g = grnByPo.get(p.poNo); if (g) { e.total++; if (p.poDate) { const d = daysBetween(g, p.poDate); if (d >= 0) { e.leadSum += d; e.leadN++; } } if (!p.expectedDeliveryDate || g <= p.expectedDeliveryDate) e.onTime++; } supStats.set(s, e); }
  const outMap = new Map(payables.map((p) => [p.supplier ?? "", num(p._sum.balanceAmount)]));
  const retMap = new Map((returns as { supplier: string | null; _sum: { returnAmount: number | null } }[]).map((r) => [r.supplier ?? "", num(r._sum.returnAmount)]));

  return spend.map((s) => {
    const name = s.supplier || "—"; const st = supStats.get(name); const sp = r2(num(s._sum.netPayable));
    const onTimePct = st && st.total ? Math.round((st.onTime / st.total) * 100) : null;
    const avgLeadDays = st && st.leadN ? Math.round(st.leadSum / st.leadN) : null;
    const returnPct = sp > 0 ? r2((num(retMap.get(name)) / sp) * 100) : 0;
    // rating 1-5 from on-time, returns, lead time
    let rating = 3; if (onTimePct != null) rating = onTimePct >= 90 ? 5 : onTimePct >= 75 ? 4 : onTimePct >= 50 ? 3 : 2; if (returnPct > 5) rating = Math.max(1, rating - 1);
    const riskScore = Math.min(100, Math.max(0, (onTimePct != null ? 100 - onTimePct : 40) * 0.5 + returnPct * 3 + (num(outMap.get(name)) > sp ? 20 : 0)));
    const tag = riskScore >= 60 ? "Review supplier" : rating >= 5 ? "Preferred" : onTimePct != null && onTimePct < 70 ? "Improve delivery" : "Stable";
    return { name, spend: sp, orders: st?.orders ?? s._count, onTimePct, avgLeadDays, returnPct, rating, riskScore: Math.round(riskScore), outstanding: r2(num(outMap.get(name))), tag };
  });
}

// ---------------------------------------------------------------- ANALYTICS
export async function analytics(scope: ActiveScope, f: PurchaseFilters) {
  const { from, to } = periodRange(f);
  const piW = { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: from, lte: to } };
  const [byType, bySupplier, byBuyer, byWarehouse, invIds] = await Promise.all([
    prisma.purchaseInvoice.groupBy({ by: ["purchaseType"], where: piW, _sum: { netPayable: true }, orderBy: { _sum: { netPayable: "desc" } } }),
    prisma.purchaseInvoice.groupBy({ by: ["supplier"], where: piW, _sum: { netPayable: true }, orderBy: { _sum: { netPayable: "desc" } }, take: 8 }),
    prisma.purchaseOrder.groupBy({ by: ["buyer"], where: { ...poWhere(scope, f), poDate: { gte: from, lte: to } }, _sum: { netAmount: true }, orderBy: { _sum: { netAmount: "desc" } }, take: 8 }),
    prisma.purchaseOrder.groupBy({ by: ["warehouse"], where: { ...poWhere(scope, f), poDate: { gte: from, lte: to } }, _sum: { netAmount: true }, orderBy: { _sum: { netAmount: "desc" } }, take: 8 }),
    prisma.purchaseInvoice.findMany({ where: piW, select: { id: true } }),
  ]);
  const nv = (rows: Array<Record<string, unknown> & { _sum: Record<string, unknown> }>, key: string) => rows.map((r) => ({ name: (r[key] as string) || "—", value: r2(num(r._sum.netPayable ?? r._sum.netAmount)) })).filter((x) => x.value > 0);

  // Category / brand / products need PI items → product join.
  const ids = invIds.map((x) => x.id);
  let byCategory: { name: string; value: number }[] = [], byBrand: { name: string; value: number }[] = [], topProducts: { name: string; value: number }[] = [], leastProducts: { name: string; value: number }[] = [];
  if (ids.length) {
    const items = await prisma.purchaseInvoiceItem.findMany({ where: { purchaseInvoiceId: { in: ids } }, select: { productId: true, productName: true, lineValue: true } });
    const prodIds = [...new Set(items.map((i) => i.productId).filter((x): x is number => !!x))];
    const products = prodIds.length ? await prisma.product.findMany({ where: { tenantId: scope.tenantId, id: { in: prodIds } }, select: { id: true, category: true, brand: true } }) : [];
    const pmap = new Map(products.map((p) => [p.id, p]));
    const cat = new Map<string, number>(), brand = new Map<string, number>(), prod = new Map<string, number>();
    for (const it of items) { const v = num(it.lineValue); const p = it.productId ? pmap.get(it.productId) : null; cat.set(p?.category || "Uncategorised", (cat.get(p?.category || "Uncategorised") ?? 0) + v); brand.set(p?.brand || "—", (brand.get(p?.brand || "—") ?? 0) + v); prod.set(it.productName, (prod.get(it.productName) ?? 0) + v); }
    const sortNV = (m: Map<string, number>) => [...m.entries()].map(([name, value]) => ({ name, value: r2(value) })).sort((a, b) => b.value - a.value);
    byCategory = sortNV(cat).slice(0, 8); byBrand = sortNV(brand).filter((x) => x.name !== "—").slice(0, 8);
    const allProd = sortNV(prod); topProducts = allProd.slice(0, 8); leastProducts = allProd.filter((x) => x.value > 0).slice(-8).reverse();
  }
  return { byType: nv(byType, "purchaseType"), bySupplier: nv(bySupplier, "supplier"), byBuyer: nv(byBuyer, "buyer"), byWarehouse: nv(byWarehouse, "warehouse"), byCategory, byBrand, topProducts, leastProducts };
}

// ---------------------------------------------------------------- DELIVERY
export async function deliveryMonitor(scope: ActiveScope, f: PurchaseFilters) {
  const td = today();
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const pos = await prisma.purchaseOrder.findMany({ where: { ...poWhere(scope, f), status: { in: OPEN_PO }, expectedDeliveryDate: { not: null } }, select: { id: true, poNo: true, supplier: true, expectedDeliveryDate: true, netAmount: true, status: true }, orderBy: { expectedDeliveryDate: "asc" }, take: 200 });
  const rowOf = (p: typeof pos[number]) => ({ id: p.id, poNo: p.poNo, supplier: p.supplier ?? "—", date: p.expectedDeliveryDate ?? "", value: r2(num(p.netAmount)), status: p.status, href: `/purchase/order/${p.id}` });
  const late = pos.filter((p) => p.expectedDeliveryDate! < td).map(rowOf);
  const todayList = pos.filter((p) => p.expectedDeliveryDate === td).map(rowOf);
  const upcoming = pos.filter((p) => p.expectedDeliveryDate! > td && p.expectedDeliveryDate! <= in7).map(rowOf);
  const later = pos.filter((p) => p.expectedDeliveryDate! > in7).map(rowOf);
  const partial = pos.filter((p) => p.status === "Partially Received").map(rowOf);
  return { counts: { late: late.length, today: todayList.length, upcoming: upcoming.length, partial: partial.length }, late, today: todayList, upcoming, later, partial };
}

// ---------------------------------------------------------------- REORDER
export async function reorder(scope: ActiveScope, f: PurchaseFilters) {
  const rows = await prisma.inventoryBalance.findMany({ where: { ...invWhere(scope, f), product: { is: { status: "Active", reorderLevel: { gt: 0 } } } }, select: { qtyOnHand: true, warehouse: true, product: { select: { id: true, name: true, reorderLevel: true, safetyStock: true, maxStock: true, leadTime: true, lastPurchasePrice: true } } }, take: 5000 });
  const items = rows.filter((b) => num(b.qtyOnHand) <= num(b.product?.reorderLevel)).map((b) => {
    const onHand = num(b.qtyOnHand); const rl = num(b.product?.reorderLevel); const max = num(b.product?.maxStock); const safety = num(b.product?.safetyStock);
    const suggestedQty = r2(Math.max(rl * 2, max || rl * 2) - onHand);
    const level = onHand <= 0 ? "Out of Stock" : onHand <= safety ? "Critical" : "Below Reorder";
    return { name: b.product?.name ?? "—", warehouse: b.warehouse, onHand: r2(onHand), reorderLevel: r2(rl), suggestedQty: Math.max(0, suggestedQty), level, leadDays: num(b.product?.leadTime) };
  }).sort((a, b) => a.onHand - b.onHand);
  return { belowCount: items.length, criticalCount: items.filter((i) => i.level === "Critical").length, outCount: items.filter((i) => i.level === "Out of Stock").length, items: items.slice(0, 100) };
}

// ---------------------------------------------------------------- BUDGET
export async function budgetMonitor(scope: ActiveScope, f: PurchaseFilters) {
  const fy = f.fy || fyFromDate(periodRange(f).to);
  const headers = await prisma.budgetHeader.findMany({ where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), fy, status: { in: ["Approved", "Active"] } }, select: { lines: { select: { headId: true, headName: true, annual: true, trackBudget: true } } } });
  const heads = new Map<number, { name: string; budget: number }>();
  for (const h of headers) for (const l of h.lines) { if (!l.trackBudget) continue; const e = heads.get(l.headId) ?? { name: l.headName ?? `Head ${l.headId}`, budget: 0 }; e.budget += num(l.annual); heads.set(l.headId, e); }
  const usage = await computeUsage(prisma, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: scope.branchId } as never, fy).catch(() => ({ actual: {} as Record<number, number>, committed: {} as Record<number, number> }));
  let allocated = 0, consumed = 0, committed = 0;
  const topHeads: { name: string; budget: number; actual: number; pct: number }[] = [];
  for (const [id, h] of heads) { const a = num((usage.actual as Record<number, number>)[id]); const c = num((usage.committed as Record<number, number>)[id]); allocated += h.budget; consumed += a; committed += c; topHeads.push({ name: h.name, budget: r2(h.budget), actual: r2(a), pct: h.budget > 0 ? Math.round((a / h.budget) * 100) : 0 }); }
  topHeads.sort((a, b) => b.actual - a.actual);
  const remaining = r2(allocated - consumed - committed);
  const utilizationPct = allocated > 0 ? Math.round((consumed / allocated) * 100) : 0;
  const alerts = topHeads.filter((h) => h.pct >= 90).map((h) => `${h.name} at ${h.pct}% of budget`);
  return { fy, allocated: r2(allocated), consumed: r2(consumed), committed: r2(committed), remaining, utilizationPct, variancePct: pct(consumed, allocated), topHeads: topHeads.slice(0, 8), alerts };
}

// ---------------------------------------------------------------- FINANCIAL
export async function financialSummary(scope: ActiveScope, f: PurchaseFilters) {
  const { from, to } = periodRange(f);
  const [commit, pay, adv, piAgg, ret] = await Promise.all([
    prisma.purchaseOrder.aggregate({ where: { ...poWhere(scope, f), status: { in: OPEN_PO } }, _sum: { netAmount: true } }),
    prisma.payable.aggregate({ where: { ...payWhere(scope, f), status: { in: ["Open", "Partial"] } }, _sum: { balanceAmount: true, paidAmount: true } }),
    prisma.supplier.aggregate({ where: supplierWhere(scope, f), _sum: { openingAdvance: true } }),
    prisma.purchaseInvoice.aggregate({ where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: from, lte: to } }, _sum: { gstAmount: true, freight: true, loading: true, packing: true, insurance: true, otherCharges: true, netPayable: true } }),
    prisma.purchaseReturn.aggregate({ where: { ...returnWhere(scope, f), returnDate: { gte: from, lte: to } }, _sum: { returnAmount: true } }).catch(() => ({ _sum: { returnAmount: 0 } })),
  ]);
  const s = piAgg._sum;
  return {
    commitment: r2(num(commit._sum.netAmount)), liability: r2(num(pay._sum.balanceAmount)), advancePaid: r2(num(adv._sum.openingAdvance)),
    outstandingPayables: r2(num(pay._sum.balanceAmount)), purchaseValue: r2(num(s.netPayable)),
    gstInput: r2(num(s.gstAmount)), freight: r2(num(s.freight)), additionalCharges: r2(num(s.loading) + num(s.packing) + num(s.insurance) + num(s.otherCharges)),
    returnValue: r2(num(ret._sum.returnAmount)),
  };
}

// ---------------------------------------------------------------- APPROVALS
export async function approvals(scope: ActiveScope, f: PurchaseFilters) {
  const [invoices, orders] = await Promise.all([
    prisma.purchaseInvoice.findMany({ where: { ...piWhere(scope, f), status: "Pending Approval" }, select: { id: true, invoiceNo: true, supplier: true, netPayable: true, supplierInvoiceDate: true }, orderBy: { id: "desc" }, take: 30 }),
    prisma.purchaseOrder.findMany({ where: { ...poWhere(scope, f), status: "Draft" }, select: { id: true, poNo: true, supplier: true, netAmount: true, poDate: true }, orderBy: { id: "desc" }, take: 30 }),
  ]);
  return {
    invoices: invoices.map((i) => ({ id: i.id, no: i.invoiceNo, supplier: i.supplier ?? "—", amount: r2(num(i.netPayable)), date: i.supplierInvoiceDate ?? "", href: `/purchase/invoice/${i.id}`, kind: "invoice" as const })),
    orders: orders.map((o) => ({ id: o.id, no: o.poNo, supplier: o.supplier ?? "—", amount: r2(num(o.netAmount)), date: o.poDate, href: `/purchase/order/${o.id}`, kind: "order" as const })),
  };
}

// ---------------------------------------------------------------- CALENDAR
export async function calendar(scope: ActiveScope, f: PurchaseFilters) {
  const period = f.period || new Date().toISOString().slice(0, 7);
  const from = `${period}-01`; const [y, m] = period.split("-").map(Number); const to = `${period}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const [created, deliveries, dues] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: { ...poWhere(scope, f), poDate: { gte: from, lte: to } }, select: { id: true, poNo: true, poDate: true }, take: 200 }),
    prisma.purchaseOrder.findMany({ where: { ...poWhere(scope, f), status: { in: OPEN_PO }, expectedDeliveryDate: { gte: from, lte: to } }, select: { id: true, poNo: true, expectedDeliveryDate: true, supplier: true }, take: 200 }),
    prisma.payable.findMany({ where: { ...payWhere(scope, f), status: { in: ["Open", "Partial"] }, dueDate: { gte: from, lte: to } }, select: { refNo: true, dueDate: true, supplier: true, balanceAmount: true }, take: 200 }),
  ]);
  const events: { date: string; type: string; label: string; href?: string }[] = [];
  for (const c of created) events.push({ date: c.poDate, type: "po", label: `PO ${c.poNo}`, href: `/purchase/order/${c.id}` });
  for (const d of deliveries) if (d.expectedDeliveryDate) events.push({ date: d.expectedDeliveryDate, type: "delivery", label: `Delivery ${d.poNo} · ${d.supplier ?? ""}`, href: `/purchase/order/${d.id}` });
  for (const d of dues) if (d.dueDate) events.push({ date: d.dueDate, type: "payment", label: `Payment due ${d.supplier ?? ""} ${r2(num(d.balanceAmount))}`, href: "/finance/payables" });
  return { period, events };
}

// ---------------------------------------------------------------- SCORECARD
export async function scorecard(scope: ActiveScope, f: PurchaseFilters) {
  const [sup, rd, bud, po] = await Promise.all([
    supplierPerformance(scope, f), reorder(scope, f), budgetMonitor(scope, f).catch(() => ({ utilizationPct: 0 })),
    prisma.purchaseOrder.groupBy({ by: ["status"], where: poWhere(scope, f), _count: true }),
  ]);
  const onTimes = sup.map((s) => s.onTimePct).filter((x): x is number => x != null);
  const deliveryPerf = onTimes.length ? Math.round(onTimes.reduce((a, b) => a + b, 0) / onTimes.length) : 70;
  const returns = sup.map((s) => s.returnPct); const avgReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const costEfficiency = Math.max(0, Math.round(100 - avgReturn * 4));
  const poMap = new Map(po.map((r) => [r.status, r._count])); const received = (poMap.get("Received") ?? 0) + (poMap.get("Partially Received") ?? 0); const totalPo = po.reduce((s, r) => s + r._count, 0) - (poMap.get("Cancelled") ?? 0);
  const purchaseEfficiency = totalPo > 0 ? Math.round((received / totalPo) * 100) : 60;
  const budgetCompliance = Math.max(0, Math.min(100, 100 - Math.max(0, bud.utilizationPct - 100)));
  const inventoryPlanning = Math.max(0, 100 - Math.min(60, rd.criticalCount * 5 + rd.outCount * 8));
  const supplierPerf = onTimes.length ? deliveryPerf : 70;
  const aiScore = Math.round((supplierPerf + purchaseEfficiency + costEfficiency + deliveryPerf + budgetCompliance + inventoryPlanning) / 6);
  const subScores = [
    { label: "Supplier Performance", score: supplierPerf }, { label: "Purchase Efficiency", score: purchaseEfficiency },
    { label: "Cost Efficiency", score: costEfficiency }, { label: "Delivery Performance", score: deliveryPerf },
    { label: "Budget Compliance", score: budgetCompliance }, { label: "Inventory Planning", score: inventoryPlanning },
    { label: "AI Procurement Score", score: aiScore },
  ];
  const overall = Math.round(subScores.reduce((s, x) => s + x.score, 0) / subScores.length);
  const band = overall >= 80 ? "Excellent" : overall >= 60 ? "Good" : overall >= 40 ? "Average" : "Critical";
  return { overall, band, subScores };
}
