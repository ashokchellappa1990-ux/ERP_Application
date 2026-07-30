import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { type SalesFilters, periodRange, yearRange, saleWhere, returnWhere, docWhere } from "./filters";
import { scorecard } from "./service";
import { salesInsights, salesRisks, salesRecommendations } from "./ai";

/**
 * SALES DRILL-DOWN — returns the breakup behind a dashboard widget as a generic table
 * ({title, summary, columns, rows, next?}) for the shared DrillModal. Level-1 widgets break
 * down by branch/day/category/etc.; clicking a row drills to the leaf (invoices/products).
 */

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

export interface DrillCol { key: string; label: string; type?: "money" | "number" | "percent" | "text" | "date"; align?: "left" | "right" | "center" }
export interface DrillData { title: string; subtitle?: string; summary?: { label: string; value: string; tone?: string }[]; columns: DrillCol[]; rows: Record<string, string | number>[]; next?: { widget: string; keyField: string; labelField?: string } | null }

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const saleDone = (scope: ActiveScope, f: SalesFilters, from: string, to: string): Prisma.SaleWhereInput => ({ ...saleWhere(scope, f), status: "Completed", saleDate: { gte: from, lte: to } });

function windowFor(widget: string, f: SalesFilters): { from: string; to: string; label: string } {
  if (widget === "salesToday") { const t = today(); return { from: t, to: t, label: "Today" }; }
  if (widget === "salesYear" || widget === "cmpYoY") { const y = yearRange(f); return { ...y, label: "This year" }; }
  const p = periodRange(f); return { ...p, label: "This month" };
}

async function branchMap(scope: ActiveScope): Promise<Map<number, string>> {
  const w: Prisma.BranchWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(scope.readBranchIds?.length ? { id: { in: scope.readBranchIds } } : {}) };
  const rows = await prisma.branch.findMany({ where: w, select: { id: true, name: true } });
  return new Map(rows.map((b) => [b.id, b.name]));
}

// ---- level-1: breakdown by branch (with sales/cost/profit) ----
async function byBranch(scope: ActiveScope, f: SalesFilters, widget: string, title: string): Promise<DrillData> {
  const { from, to, label } = windowFor(widget, f);
  const [rows, bmap] = await Promise.all([
    prisma.sale.groupBy({ by: ["branchId"], where: saleDone(scope, f, from, to), _sum: { total: true, cost: true }, _count: true, orderBy: { _sum: { total: "desc" } } }),
    branchMap(scope),
  ]);
  const grand = rows.reduce((s, r) => s + num(r._sum.total), 0) || 1;
  return {
    title: `${title} — by Branch`, subtitle: `${label} · ${rows.length} branch(es)`,
    summary: [{ label: "Total Sales", value: inr(grand) }, { label: "Invoices", value: String(rows.reduce((s, r) => s + r._count, 0)) }],
    columns: [{ key: "branch", label: "Branch", type: "text" }, { key: "sales", label: "Sales", type: "money", align: "right" }, { key: "profit", label: "Gross Profit", type: "money", align: "right" }, { key: "invoices", label: "Invoices", type: "number", align: "right" }, { key: "share", label: "Share", type: "percent", align: "right" }],
    rows: rows.map((r) => ({ branchId: r.branchId ?? 0, branch: r.branchId != null ? bmap.get(r.branchId) ?? `Branch ${r.branchId}` : "Unassigned", sales: r2(num(r._sum.total)), profit: r2(num(r._sum.total) - num(r._sum.cost)), invoices: r._count, share: r2((num(r._sum.total) / grand) * 100) })),
    next: { widget: "invByBranch", keyField: "branchId", labelField: "branch" },
  };
}

// ---- level-1: by executive (cashier proxy) ----
async function byExec(scope: ActiveScope, f: SalesFilters, title: string): Promise<DrillData> {
  const { from, to } = windowFor("x", f);
  const rows = await prisma.sale.groupBy({ by: ["cashierUserId"], where: saleDone(scope, f, from, to), _sum: { total: true }, _count: true, orderBy: { _sum: { total: "desc" } } });
  const ids = rows.map((r) => r.cashierUserId).filter((x): x is number => x != null);
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } }) : [];
  const umap = new Map(users.map((u) => [u.id, u.fullName]));
  const grand = rows.reduce((s, r) => s + num(r._sum.total), 0) || 1;
  return {
    title: `${title} — by Sales Executive`, subtitle: "Cashier used as executive proxy",
    columns: [{ key: "exec", label: "Executive", type: "text" }, { key: "sales", label: "Sales", type: "money", align: "right" }, { key: "invoices", label: "Invoices", type: "number", align: "right" }, { key: "share", label: "Share", type: "percent", align: "right" }],
    rows: rows.map((r) => ({ execId: r.cashierUserId ?? 0, exec: r.cashierUserId != null ? umap.get(r.cashierUserId) || `User ${r.cashierUserId}` : "Unattributed", sales: r2(num(r._sum.total)), invoices: r._count, share: r2((num(r._sum.total) / grand) * 100) })),
    next: { widget: "invByExec", keyField: "execId", labelField: "exec" },
  };
}

// ---- level-1: by day (current month) ----
async function byDay(scope: ActiveScope, f: SalesFilters): Promise<DrillData> {
  const { from, to } = periodRange(f);
  const rows = await prisma.sale.groupBy({ by: ["saleDate"], where: saleDone(scope, f, from, to), _sum: { total: true }, _count: true, orderBy: { saleDate: "asc" } });
  return {
    title: "Sales Trend — by Day", subtitle: `${from} → ${to}`,
    columns: [{ key: "day", label: "Date", type: "date" }, { key: "sales", label: "Sales", type: "money", align: "right" }, { key: "invoices", label: "Invoices", type: "number", align: "right" }],
    rows: rows.map((r) => ({ day: r.saleDate, sales: r2(num(r._sum.total)), invoices: r._count })),
    next: { widget: "invByDay", keyField: "day" },
  };
}

// ---- level-1: by product category or brand ----
async function byProductGroup(scope: ActiveScope, f: SalesFilters, group: "category" | "brand"): Promise<DrillData> {
  const { from, to } = periodRange(f);
  const lines = await prisma.saleLine.groupBy({ by: ["productId"], where: { sale: { is: saleDone(scope, f, from, to) } }, _sum: { value: true, qty: true } });
  const ids = lines.map((l) => l.productId);
  const products = ids.length ? await prisma.product.findMany({ where: { tenantId: scope.tenantId, id: { in: ids } }, select: { id: true, category: true, brand: true } }) : [];
  const pmap = new Map(products.map((p) => [p.id, p]));
  const agg = new Map<string, { value: number; qty: number }>();
  for (const l of lines) { const p = pmap.get(l.productId); const g = (group === "category" ? p?.category : p?.brand) || (group === "category" ? "Uncategorised" : "—"); const e = agg.get(g) ?? { value: 0, qty: 0 }; e.value += num(l._sum.value); e.qty += num(l._sum.qty); agg.set(g, e); }
  const rows = [...agg.entries()].map(([name, v]) => ({ grp: name, revenue: r2(v.value), qty: r2(v.qty) })).sort((a, b) => b.revenue - a.revenue);
  return {
    title: group === "category" ? "Category-wise Sales" : "Brand-wise Sales",
    columns: [{ key: "grp", label: group === "category" ? "Category" : "Brand", type: "text" }, { key: "revenue", label: "Revenue", type: "money", align: "right" }, { key: "qty", label: "Qty", type: "number", align: "right" }],
    rows, next: { widget: group === "category" ? "prodByCategory" : "prodByBrand", keyField: "grp" },
  };
}

// ---- level-1: customer breakdowns (type/category/city/state/top) ----
async function byCustomerField(scope: ActiveScope, f: SalesFilters, field: "type" | "category" | "city" | "state" | "top"): Promise<DrillData> {
  const { from, to } = periodRange(f);
  const sales = await prisma.sale.findMany({ where: saleDone(scope, f, from, to), select: { customerId: true, total: true } });
  const ids = [...new Set(sales.map((s) => s.customerId).filter((x): x is number => x != null))];
  const customers = ids.length ? await prisma.customer.findMany({ where: { tenantId: scope.tenantId, id: { in: ids } }, select: { id: true, name: true, type: true, category: true, city: true, state: true } }) : [];
  const cmap = new Map(customers.map((c) => [c.id, c]));
  if (field === "top") {
    const agg = new Map<number, { name: string; value: number; count: number }>();
    for (const s of sales) { if (s.customerId == null) continue; const c = cmap.get(s.customerId); const e = agg.get(s.customerId) ?? { name: c?.name || "Walk-in", value: 0, count: 0 }; e.value += num(s.total); e.count++; agg.set(s.customerId, e); }
    const rows = [...agg.entries()].map(([id, v]) => ({ customerId: id, customer: v.name, sales: r2(v.value), invoices: v.count })).sort((a, b) => b.sales - a.sales).slice(0, 50);
    return { title: "Top Customers", columns: [{ key: "customer", label: "Customer", type: "text" }, { key: "sales", label: "Sales", type: "money", align: "right" }, { key: "invoices", label: "Invoices", type: "number", align: "right" }], rows, next: { widget: "invByCustomer", keyField: "customerId", labelField: "customer" } };
  }
  const agg = new Map<string, number>();
  for (const s of sales) { const c = s.customerId != null ? cmap.get(s.customerId) : null; const k = (c?.[field] as string) || "Unclassified"; agg.set(k, (agg.get(k) ?? 0) + num(s.total)); }
  const rows = [...agg.entries()].map(([name, value]) => ({ grp: name, sales: r2(value) })).sort((a, b) => b.sales - a.sales);
  const labels: Record<string, string> = { type: "Customer Type", category: "Customer Category", city: "City", state: "State" };
  return { title: `Sales by ${labels[field]}`, columns: [{ key: "grp", label: labels[field], type: "text" }, { key: "sales", label: "Sales", type: "money", align: "right" }], rows };
}

// ---- leaf: invoice lists ----
async function invoices(scope: ActiveScope, f: SalesFilters, filter: Prisma.SaleWhereInput, title: string): Promise<DrillData> {
  const rows = await prisma.sale.findMany({ where: filter, orderBy: { id: "desc" }, take: 200, select: { invoiceNo: true, saleDate: true, customerName: true, channel: true, total: true, itemCount: true } });
  const total = rows.reduce((s, r) => s + num(r.total), 0);
  return {
    title, subtitle: `${rows.length} invoice(s)`, summary: [{ label: "Total", value: inr(total) }, { label: "Count", value: String(rows.length) }],
    columns: [{ key: "invoiceNo", label: "Invoice", type: "text" }, { key: "saleDate", label: "Date", type: "date" }, { key: "customerName", label: "Customer", type: "text" }, { key: "channel", label: "Channel", type: "text" }, { key: "itemCount", label: "Items", type: "number", align: "right" }, { key: "total", label: "Total", type: "money", align: "right" }],
    rows: rows.map((r) => ({ invoiceNo: r.invoiceNo, saleDate: r.saleDate, customerName: r.customerName ?? "Walk-in", channel: r.channel, itemCount: r.itemCount, total: r2(num(r.total)) })),
  };
}

async function productsIn(scope: ActiveScope, f: SalesFilters, group: "category" | "brand", value: string): Promise<DrillData> {
  const { from, to } = periodRange(f);
  const lines = await prisma.saleLine.groupBy({ by: ["productId"], where: { sale: { is: saleDone(scope, f, from, to) }, product: { is: group === "category" ? { category: value } : { brand: value } } }, _sum: { value: true, qty: true } });
  const ids = lines.map((l) => l.productId);
  const products = ids.length ? await prisma.product.findMany({ where: { tenantId: scope.tenantId, id: { in: ids } }, select: { id: true, name: true } }) : [];
  const pmap = new Map(products.map((p) => [p.id, p.name]));
  const rows = lines.map((l) => ({ product: pmap.get(l.productId) ?? `#${l.productId}`, revenue: r2(num(l._sum.value)), qty: r2(num(l._sum.qty)) })).sort((a, b) => b.revenue - a.revenue);
  return { title: `${value} — Products`, columns: [{ key: "product", label: "Product", type: "text" }, { key: "revenue", label: "Revenue", type: "money", align: "right" }, { key: "qty", label: "Qty", type: "number", align: "right" }], rows };
}

/* ------------------------------------------------------------- dispatcher */
export async function drillSales(scope: ActiveScope, f: SalesFilters, widget: string, key?: string): Promise<DrillData> {
  const { from, to } = periodRange(f);
  // leaves
  if (widget === "invByBranch") return invoices(scope, f, { ...saleDone(scope, f, from, to), branchId: Number(key) }, "Invoices — Branch");
  if (widget === "invByExec") return invoices(scope, f, { ...saleDone(scope, f, from, to), cashierUserId: Number(key) }, "Invoices — Executive");
  if (widget === "invByCustomer") return invoices(scope, f, { ...saleDone(scope, f, from, to), customerId: Number(key) }, "Invoices — Customer");
  if (widget === "invByDay") return invoices(scope, f, { ...saleWhere(scope, f), status: "Completed", saleDate: String(key) }, `Invoices — ${key}`);
  if (widget === "prodByCategory") return productsIn(scope, f, "category", String(key));
  if (widget === "prodByBrand") return productsIn(scope, f, "brand", String(key));

  // level-1 mappings
  const branchWidgets = ["salesToday", "salesMonth", "salesYear", "grossSales", "netSales", "grossProfit", "marginPct", "invoices", "avgInvoice", "avgDiscount", "topBranches", "anBranch", "rankTopBranch", "rankLowBranch", "cmpMoM", "cmpYoY", "anDiscount"];
  if (branchWidgets.includes(widget)) return byBranch(scope, f, widget, titleFor(widget));
  if (["topExecutives", "rankTopExec", "rankLowExec"].includes(widget)) return byExec(scope, f, titleFor(widget));
  if (widget === "trend") return byDay(scope, f);
  if (["mixCategory", "anCategory", "prodRevenue", "prodQty", "prodProfit", "prodSlow"].includes(widget)) return byProductGroup(scope, f, "category");
  if (["mixBrand", "anBrand"].includes(widget)) return byProductGroup(scope, f, "brand");
  if (["custType", "anCustType"].includes(widget)) return byCustomerField(scope, f, "type");
  if (["custCategory", "anCustCat"].includes(widget)) return byCustomerField(scope, f, "category");
  if (["custCity", "anCity"].includes(widget)) return byCustomerField(scope, f, "city");
  if (["custState", "anState"].includes(widget)) return byCustomerField(scope, f, "state");
  if (widget === "custTop") return byCustomerField(scope, f, "top");
  if (widget === "anChannel") return byChannel(scope, f);
  if (widget === "returnValue" || widget === "returnPct" || widget === "returnTrend" || widget === "returnTop" || widget === "anCancel") return returnsList(scope, f, widget);
  if (widget === "orders" || widget === "pendingOrders" || widget === "avgOrderValue") return ordersList(scope, f);
  if (widget === "cancelled") return cancelledList(scope, f);
  if (widget === "recent") return invoices(scope, f, saleDone(scope, f, from, to), "Recent Invoices");
  if (widget === "scorecard") return listFrom("Sales Scorecard", await scorecard(scope, f).then((s) => s.subScores.map((x) => ({ metric: x.label, score: x.score }))), [{ key: "metric", label: "Component", type: "text" }, { key: "score", label: "Score", type: "number", align: "right" }]);
  if (widget === "insights") return listFrom("AI Sales Insights", (await salesInsights(scope, f)).map((i) => ({ title: i.title, detail: i.detail })), [{ key: "title", label: "Insight", type: "text" }, { key: "detail", label: "Detail", type: "text" }]);
  if (widget === "aiRisk") return listFrom("Risk Radar", (await salesRisks(scope, f)).map((i) => ({ severity: i.severity, title: i.title, mitigation: i.mitigation })), [{ key: "severity", label: "Severity", type: "text" }, { key: "title", label: "Risk", type: "text" }, { key: "mitigation", label: "Mitigation", type: "text" }]);
  if (widget === "aiRec") return listFrom("Recommendations", (await salesRecommendations(scope, f)).map((i) => ({ title: i.title, benefit: i.expectedBenefit })), [{ key: "title", label: "Recommendation", type: "text" }, { key: "benefit", label: "Benefit", type: "text" }]);

  // fallback → by branch
  return byBranch(scope, f, widget, titleFor(widget));
}

function titleFor(w: string): string {
  const m: Record<string, string> = { salesToday: "Today's Sales", salesMonth: "Current Month Sales", salesYear: "Current Year Sales", grossSales: "Gross Sales", netSales: "Net Sales", grossProfit: "Gross Profit", marginPct: "Gross Margin", invoices: "Sales Invoices", avgInvoice: "Average Invoice", avgDiscount: "Average Discount", topBranches: "Top Branches", anBranch: "Branch-wise Sales", rankTopBranch: "Top Branch", rankLowBranch: "Lowest Branch", topExecutives: "Top Executives", rankTopExec: "Top Executive", rankLowExec: "Lowest Executive", cmpMoM: "Month-on-Month", cmpYoY: "Year-on-Year", anDiscount: "Discount Given" };
  return m[w] ?? "Sales";
}
function listFrom(title: string, rows: Record<string, string | number>[], columns: DrillCol[]): DrillData { return { title, columns, rows }; }

async function byChannel(scope: ActiveScope, f: SalesFilters): Promise<DrillData> {
  const { from, to } = periodRange(f);
  const rows = await prisma.sale.groupBy({ by: ["channel"], where: saleDone(scope, f, from, to), _sum: { total: true }, _count: true, orderBy: { _sum: { total: "desc" } } });
  const grand = rows.reduce((s, r) => s + num(r._sum.total), 0) || 1;
  return { title: "Channel-wise Sales", columns: [{ key: "channel", label: "Channel", type: "text" }, { key: "sales", label: "Sales", type: "money", align: "right" }, { key: "invoices", label: "Invoices", type: "number", align: "right" }, { key: "share", label: "Share", type: "percent", align: "right" }], rows: rows.map((r) => ({ channel: r.channel, sales: r2(num(r._sum.total)), invoices: r._count, share: r2((num(r._sum.total) / grand) * 100) })) };
}
async function returnsList(scope: ActiveScope, f: SalesFilters, widget: string): Promise<DrillData> {
  if (widget === "anCancel") return cancelledList(scope, f);
  const { from, to } = periodRange(f);
  const rows = await prisma.salesReturn.findMany({ where: { ...returnWhere(scope, f), returnDate: { gte: from, lte: to } }, orderBy: { id: "desc" }, take: 200, select: { returnNo: true, returnDate: true, customerName: true, refundAmount: true, status: true } });
  const total = rows.reduce((s, r) => s + num(r.refundAmount), 0);
  return { title: "Sales Returns", subtitle: `${rows.length} return(s)`, summary: [{ label: "Refund Total", value: inr(total), tone: "danger" }], columns: [{ key: "returnNo", label: "Return", type: "text" }, { key: "returnDate", label: "Date", type: "date" }, { key: "customerName", label: "Customer", type: "text" }, { key: "status", label: "Status", type: "text" }, { key: "refundAmount", label: "Refund", type: "money", align: "right" }], rows: rows.map((r) => ({ returnNo: r.returnNo, returnDate: r.returnDate, customerName: r.customerName ?? "—", status: r.status, refundAmount: r2(num(r.refundAmount)) })) };
}
async function ordersList(scope: ActiveScope, f: SalesFilters): Promise<DrillData> {
  const rows = await prisma.salesDocument.findMany({ where: { ...docWhere(scope, f, { date: true }), docType: "order" }, orderBy: { id: "desc" }, take: 200, select: { docNo: true, docDate: true, customerName: true, netAmount: true, status: true } });
  const total = rows.reduce((s, r) => s + num(r.netAmount), 0);
  return { title: "Sales Orders", subtitle: `${rows.length} order(s)`, summary: [{ label: "Total", value: inr(total) }], columns: [{ key: "docNo", label: "Order", type: "text" }, { key: "docDate", label: "Date", type: "date" }, { key: "customerName", label: "Customer", type: "text" }, { key: "status", label: "Status", type: "text" }, { key: "netAmount", label: "Value", type: "money", align: "right" }], rows: rows.map((r) => ({ docNo: r.docNo, docDate: r.docDate, customerName: r.customerName ?? "—", status: r.status, netAmount: r2(num(r.netAmount)) })) };
}
async function cancelledList(scope: ActiveScope, f: SalesFilters): Promise<DrillData> {
  const { from, to } = periodRange(f);
  const rows = await prisma.sale.findMany({ where: { ...saleWhere(scope, f), status: "Cancelled", saleDate: { gte: from, lte: to } }, orderBy: { id: "desc" }, take: 200, select: { invoiceNo: true, saleDate: true, customerName: true, total: true } });
  return { title: "Cancelled Invoices", subtitle: `${rows.length} cancelled`, columns: [{ key: "invoiceNo", label: "Invoice", type: "text" }, { key: "saleDate", label: "Date", type: "date" }, { key: "customerName", label: "Customer", type: "text" }, { key: "total", label: "Value", type: "money", align: "right" }], rows: rows.map((r) => ({ invoiceNo: r.invoiceNo, saleDate: r.saleDate, customerName: r.customerName ?? "—", total: r2(num(r.total)) })) };
}
