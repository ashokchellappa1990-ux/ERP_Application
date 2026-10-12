import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { type PurchaseFilters, periodRange, poWhere, piWhere, payWhere, returnWhere } from "./filters";
import { supplierPerformance, analytics, budgetMonitor, scorecard } from "./service";
import { purchaseInsights } from "./ai";

/** PURCHASE DRILL-DOWN — breakup behind a Procurement widget as a generic table for DrillModal. */
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const OPEN_PO = ["Approved", "Issued", "Partially Received"];

export interface DrillCol { key: string; label: string; type?: "money" | "number" | "percent" | "text" | "date"; align?: "left" | "right" | "center" }
export interface DrillData { title: string; subtitle?: string; summary?: { label: string; value: string; tone?: string }[]; columns: DrillCol[]; rows: Record<string, string | number>[]; next?: { widget: string; keyField: string; labelField?: string } | null }

const NV = (label: string, rows: { name: string; value: number }[], colLabel = "Value"): DrillData => ({ title: label, columns: [{ key: "name", label: "Name", type: "text" }, { key: "value", label: colLabel, type: "money", align: "right" }], rows });

async function bySupplier(scope: ActiveScope, f: PurchaseFilters, title: string): Promise<DrillData> {
  const { from, to } = periodRange(f);
  const rows = await prisma.purchaseInvoice.groupBy({ by: ["supplier"], where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: from, lte: to } }, _sum: { netPayable: true }, _count: true, orderBy: { _sum: { netPayable: "desc" } } });
  const grand = rows.reduce((s, r) => s + num(r._sum.netPayable), 0) || 1;
  return { title: `${title} — by Supplier`, summary: [{ label: "Total", value: inr(grand) }], columns: [{ key: "supplier", label: "Supplier", type: "text" }, { key: "value", label: "Purchase", type: "money", align: "right" }, { key: "bills", label: "Bills", type: "number", align: "right" }, { key: "share", label: "Share", type: "percent", align: "right" }], rows: rows.map((r) => ({ supplier: r.supplier ?? "—", value: r2(num(r._sum.netPayable)), bills: r._count, share: r2((num(r._sum.netPayable) / grand) * 100) })), next: { widget: "piBySupplier", keyField: "supplier" } };
}
async function poList(scope: ActiveScope, f: PurchaseFilters, status: string | string[] | null, title: string): Promise<DrillData> {
  const where: Prisma.PurchaseOrderWhereInput = { ...poWhere(scope, f) };
  if (status) where.status = Array.isArray(status) ? { in: status } : status;
  const rows = await prisma.purchaseOrder.findMany({ where, orderBy: { id: "desc" }, take: 200, select: { poNo: true, poDate: true, supplier: true, status: true, netAmount: true } });
  return { title, subtitle: `${rows.length} order(s)`, summary: [{ label: "Value", value: inr(rows.reduce((s, r) => s + num(r.netAmount), 0)) }], columns: [{ key: "poNo", label: "PO No", type: "text" }, { key: "poDate", label: "Date", type: "date" }, { key: "supplier", label: "Supplier", type: "text" }, { key: "status", label: "Status", type: "text" }, { key: "netAmount", label: "Value", type: "money", align: "right" }], rows: rows.map((r) => ({ poNo: r.poNo, poDate: r.poDate, supplier: r.supplier ?? "—", status: r.status, netAmount: r2(num(r.netAmount)) })) };
}
async function piList(scope: ActiveScope, f: PurchaseFilters, extra: Prisma.PurchaseInvoiceWhereInput, title: string): Promise<DrillData> {
  const rows = await prisma.purchaseInvoice.findMany({ where: { ...piWhere(scope, f), ...extra }, orderBy: { id: "desc" }, take: 200, select: { invoiceNo: true, supplierInvoiceDate: true, supplier: true, status: true, netPayable: true } });
  return { title, subtitle: `${rows.length} bill(s)`, summary: [{ label: "Total", value: inr(rows.reduce((s, r) => s + num(r.netPayable), 0)) }], columns: [{ key: "invoiceNo", label: "Invoice", type: "text" }, { key: "date", label: "Date", type: "date" }, { key: "supplier", label: "Supplier", type: "text" }, { key: "status", label: "Status", type: "text" }, { key: "netPayable", label: "Payable", type: "money", align: "right" }], rows: rows.map((r) => ({ invoiceNo: r.invoiceNo, date: r.supplierInvoiceDate ?? "", supplier: r.supplier ?? "—", status: r.status, netPayable: r2(num(r.netPayable)) })) };
}

export async function drillPurchase(scope: ActiveScope, f: PurchaseFilters, widget: string, key?: string): Promise<DrillData> {
  const { from, to } = periodRange(f);
  // leaves
  if (widget === "piBySupplier") return piList(scope, f, { status: { not: "Cancelled" }, supplierInvoiceDate: { gte: from, lte: to }, supplier: String(key) }, `Bills — ${key}`);

  // KPIs
  if (["valToday", "valMonth", "avgVal"].includes(widget)) return bySupplier(scope, f, "Purchase Value");
  if (["poToday", "poMonth"].includes(widget)) return poList(scope, f, null, "Purchase Orders");
  if (widget === "pendingPO") return poList(scope, f, "Draft", "Pending Purchase Orders");
  if (widget === "partRecv") return poList(scope, f, "Partially Received", "Partially Received");
  if (widget === "fullRecv") return poList(scope, f, "Received", "Fully Received");
  if (widget === "cancelled") return poList(scope, f, "Cancelled", "Cancelled Orders");
  if (widget === "late" || widget === "openCommit") return poList(scope, f, OPEN_PO, "Open Purchase Orders");
  if (widget === "pendingAppr") return piList(scope, f, { status: "Pending Approval" }, "Invoices Awaiting Approval");
  if (widget === "retValue") {
    const rows = await prisma.purchaseReturn.findMany({ where: { ...returnWhere(scope, f), returnDate: { gte: from, lte: to } }, orderBy: { id: "desc" }, take: 200, select: { returnNo: true, returnDate: true, supplier: true, returnAmount: true } }).catch(() => []);
    return { title: "Purchase Returns", columns: [{ key: "returnNo", label: "Return", type: "text" }, { key: "returnDate", label: "Date", type: "date" }, { key: "supplier", label: "Supplier", type: "text" }, { key: "returnAmount", label: "Value", type: "money", align: "right" }], rows: (rows as { returnNo: string; returnDate: string; supplier: string | null; returnAmount: number | null }[]).map((r) => ({ returnNo: r.returnNo, returnDate: r.returnDate, supplier: r.supplier ?? "—", returnAmount: r2(num(r.returnAmount)) })) };
  }
  if (widget === "payable") {
    const rows = await prisma.payable.groupBy({ by: ["supplier"], where: { ...payWhere(scope, f), status: { in: ["Open", "Partial"] } }, _sum: { balanceAmount: true }, orderBy: { _sum: { balanceAmount: "desc" } } });
    return { title: "Outstanding Payables — by Supplier", columns: [{ key: "supplier", label: "Supplier", type: "text" }, { key: "balance", label: "Balance", type: "money", align: "right" }], rows: rows.map((r) => ({ supplier: r.supplier ?? "—", balance: r2(num(r._sum.balanceAmount)) })) };
  }
  if (widget === "budgetUtil") { const b = await budgetMonitor(scope, f).catch(() => null); return { title: "Budget Utilisation — by Head", columns: [{ key: "name", label: "Head", type: "text" }, { key: "budget", label: "Budget", type: "money", align: "right" }, { key: "actual", label: "Actual", type: "money", align: "right" }, { key: "pct", label: "Used", type: "percent", align: "right" }], rows: (b?.topHeads ?? []).map((h) => ({ name: h.name, budget: h.budget, actual: h.actual, pct: h.pct })) }; }
  if (widget === "avgLead" || widget === "suppliers") { const sp = await supplierPerformance(scope, f); return { title: "Supplier Performance", columns: [{ key: "name", label: "Supplier", type: "text" }, { key: "spend", label: "Spend", type: "money", align: "right" }, { key: "onTimePct", label: "On-Time", type: "percent", align: "right" }, { key: "avgLeadDays", label: "Lead(d)", type: "number", align: "right" }, { key: "riskScore", label: "Risk", type: "number", align: "right" }], rows: sp.map((s) => ({ name: s.name, spend: s.spend, onTimePct: s.onTimePct ?? 0, avgLeadDays: s.avgLeadDays ?? 0, riskScore: s.riskScore })) }; }

  // analytics arrays
  const an = ["an-type", "an-category", "an-supplier", "an-buyer", "an-warehouse", "an-brand", "an-topProducts", "an-leastProducts"];
  if (an.includes(widget)) {
    const a = await analytics(scope, f);
    const map: Record<string, { name: string; value: number }[]> = { "an-type": a.byType, "an-category": a.byCategory, "an-supplier": a.bySupplier, "an-buyer": a.byBuyer, "an-warehouse": a.byWarehouse, "an-brand": a.byBrand, "an-topProducts": a.topProducts, "an-leastProducts": a.leastProducts };
    return NV(widget.replace("an-", "Purchase by "), map[widget] ?? [], "Purchase");
  }
  if (widget === "scorecard") { const s = await scorecard(scope, f); return { title: "Procurement Scorecard", columns: [{ key: "label", label: "Component", type: "text" }, { key: "score", label: "Score", type: "number", align: "right" }], rows: s.subScores.map((x) => ({ label: x.label, score: x.score })) }; }
  if (widget === "insights") { const ins = await purchaseInsights(scope, f); return { title: "AI Procurement Insights", columns: [{ key: "title", label: "Insight", type: "text" }, { key: "detail", label: "Detail", type: "text" }], rows: ins.map((i) => ({ title: i.title, detail: i.detail })) }; }
  if (widget === "trend") {
    const rows = await prisma.purchaseInvoice.groupBy({ by: ["supplierInvoiceDate"], where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: from, lte: to } }, _sum: { netPayable: true }, orderBy: { supplierInvoiceDate: "asc" } });
    return { title: "Purchase Trend — by Day", columns: [{ key: "day", label: "Date", type: "date" }, { key: "value", label: "Purchase", type: "money", align: "right" }], rows: rows.map((r) => ({ day: r.supplierInvoiceDate ?? "", value: r2(num(r._sum.netPayable)) })) };
  }
  return bySupplier(scope, f, "Purchase Value");
}
