import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere } from "@/lib/auth/scope";
import type { Range } from "@/lib/ai/bi/period";
import { monthRange, monthShort } from "@/lib/ai/bi/period";
import { metricByKey } from "@/lib/ai/bi/metrics";
import type { SeriesPoint } from "./forecast";

/**
 * DECISION METRIC CATALOG — the set of metrics the intelligence platform predicts,
 * grouped by module. It REUSES the BI metric catalog's compute() functions (single
 * source of truth) and adds a few module metrics the BI catalog lacks. Any metric here
 * gets forecasting, risk scoring, explainability and charts for free.
 */

export type DecisionModule = "finance" | "sales" | "purchase" | "inventory" | "customer" | "supplier" | "budget" | "costcentre" | "profitcentre";
export const DECISION_MODULES: { key: DecisionModule; label: string }[] = [
  { key: "finance", label: "Financial" }, { key: "sales", label: "Sales" }, { key: "purchase", label: "Purchase" },
  { key: "inventory", label: "Inventory" }, { key: "customer", label: "Customer" }, { key: "supplier", label: "Supplier" },
  { key: "budget", label: "Budget" }, { key: "costcentre", label: "Cost Centre" }, { key: "profitcentre", label: "Profit Centre" },
];

export interface DecisionMetric {
  key: string; label: string; module: DecisionModule; unit: "money" | "count" | "percent";
  goodDirection: "up" | "down" | "neutral"; asOf?: boolean;
  definition: string; drilldown: string;
  compute: (scope: ActiveScope, range: Range) => Promise<number>;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const iw = (s: ActiveScope) => scopeWhere(s, { branch: true }) as Prisma.InventoryBalanceWhereInput;
const cw = (s: ActiveScope) => scopeWhere(s, { branch: true }) as Prisma.CustomerWhereInput;
const sw = (s: ActiveScope) => scopeWhere(s, { branch: true }) as Prisma.SupplierWhereInput;

// -- module metrics not in the BI catalog -----------------------------------
async function inventoryValue(scope: ActiveScope) { return r2(num((await prisma.inventoryBalance.aggregate({ where: iw(scope), _sum: { purchaseValue: true } }))._sum.purchaseValue)); }
async function lowStockCount(scope: ActiveScope) {
  const rows = await prisma.inventoryBalance.findMany({ where: { ...iw(scope), product: { is: { status: "Active", reorderLevel: { gt: 0 } } } }, select: { qtyOnHand: true, product: { select: { reorderLevel: true } } }, take: 8000 });
  return rows.filter((b) => num(b.qtyOnHand) <= num(b.product?.reorderLevel)).length;
}
async function activeCustomers(scope: ActiveScope) { return prisma.customer.count({ where: { ...cw(scope), status: "Active" } }); }
async function activeSuppliers(scope: ActiveScope) { return prisma.supplier.count({ where: { ...sw(scope), status: "Active" } }); }

// Wrap a BI-catalog metric key into a DecisionMetric with a module tag.
function fromBi(key: string, module: DecisionModule, extra?: Partial<DecisionMetric>): DecisionMetric {
  const m = metricByKey(key);
  if (!m) throw new Error(`BI metric not found: ${key}`);
  return { key: m.key, label: m.label, module, unit: m.unit, goodDirection: m.goodDirection, asOf: m.asOf, definition: m.definition, drilldown: m.drilldown, compute: m.compute, ...extra };
}

export const DECISION_METRICS: DecisionMetric[] = [
  // Finance
  fromBi("revenue", "finance"), fromBi("expense", "finance"), fromBi("grossProfit", "finance"), fromBi("netProfit", "finance"),
  fromBi("profitMargin", "finance"), fromBi("cash", "finance"), fromBi("bank", "finance"), fromBi("workingCapital", "finance"), fromBi("gstDue", "finance"),
  // Sales
  fromBi("sales", "sales"), fromBi("orders", "sales"), fromBi("avgBill", "sales"),
  // Purchase
  fromBi("purchases", "purchase"),
  // Inventory
  { key: "inventoryValue", label: "Inventory Value", module: "inventory", unit: "money", goodDirection: "neutral", asOf: true, definition: "Total stock value at cost.", drilldown: "/inventory", compute: (s) => inventoryValue(s) },
  { key: "lowStock", label: "Low-Stock Items", module: "inventory", unit: "count", goodDirection: "down", asOf: true, definition: "Products at or below reorder level.", drilldown: "/inventory", compute: (s) => lowStockCount(s) },
  // Customer
  fromBi("receivable", "customer", { label: "Customer Receivable" }),
  { key: "activeCustomers", label: "Active Customers", module: "customer", unit: "count", goodDirection: "up", asOf: true, definition: "Count of active customers.", drilldown: "/masters/customer", compute: (s) => activeCustomers(s) },
  // Supplier
  fromBi("payable", "supplier", { label: "Supplier Payable" }),
  { key: "activeSuppliers", label: "Active Suppliers", module: "supplier", unit: "count", goodDirection: "neutral", asOf: true, definition: "Count of active suppliers.", drilldown: "/masters/supplier", compute: (s) => activeSuppliers(s) },
  // Budget
  fromBi("budgetUtil", "budget"), fromBi("expense", "budget", { key: "budgetSpend", label: "Budget Spend" }),
  // Cost Centre (proxy: total expense) / Profit Centre (proxy: net profit) — dedicated per-centre engine deferred
  fromBi("expense", "costcentre", { key: "ccCost", label: "Centre Cost" }),
  fromBi("netProfit", "profitcentre", { key: "pcProfit", label: "Centre Profit" }),
];

export function decisionMetric(key: string): DecisionMetric | null { return DECISION_METRICS.find((m) => m.key === key) ?? null; }
export function metricsForModule(module: DecisionModule): DecisionMetric[] { return DECISION_METRICS.filter((m) => m.module === module); }

/** Historical monthly series for a decision metric (reuses each metric's compute). */
export async function metricHistory(metric: DecisionMetric, scope: ActiveScope, months: string[]): Promise<SeriesPoint[]> {
  const out: SeriesPoint[] = [];
  for (const mo of months) { const v = await metric.compute(scope, monthRange(mo)); out.push({ name: monthShort(mo), value: r2(v) }); }
  return out;
}
