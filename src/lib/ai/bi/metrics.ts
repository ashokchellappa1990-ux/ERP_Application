import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere } from "@/lib/auth/scope";
import { accountBalancesAsOf, accountBalancesPeriod } from "@/lib/accounting/reports";
import { ACC } from "@/lib/accounting/accounts";
import { computeUsage, fyFromDate } from "@/lib/finance/budgetService";
import { computeLiability } from "@/lib/finance/statutory/engine";
import type { Range } from "./period";
import { ym } from "./period";

/**
 * BI METRIC CATALOG — the extensible KPI registry for the AI Business Intelligence
 * engine. Every KPI is one entry with metadata (definition/formula/interpretation) +
 * a compute() and the engine (explain/compare/trend/chart/summary) works generically
 * over ANY metric. New modules add metrics here (or, in future, register them via the
 * AI Module Registry) — no engine changes needed.
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const bw = (s: ActiveScope) => scopeWhere(s, { branch: true }) as { tenantId: number; businessId?: number; branchId?: number | { in: number[] } };
const bal = (rows: { code: string; balance: number }[], code: string) => rows.find((r) => r.code === code)?.balance ?? 0;

export interface Metric {
  key: string;
  label: string;
  module: string;
  unit: "money" | "count" | "percent";
  goodDirection: "up" | "down" | "neutral";
  asOf?: boolean; // balance metric (point-in-time as of range.to) vs flow (over from..to)
  keywords: RegExp;
  definition: string;
  formula: string;
  improve: string[];
  drilldown: string;
  compute: (scope: ActiveScope, range: Range) => Promise<number>;
}

// -- shared computes ---------------------------------------------------------
async function periodBal(scope: ActiveScope, r: Range) { return accountBalancesPeriod(scope, r.from, r.to); }
const incomeOf = (rows: { type: string; balance: number }[]) => r2(rows.filter((a) => a.type === "Income").reduce((s, a) => s + a.balance, 0));
const expenseOf = (rows: { type: string; balance: number }[]) => r2(rows.filter((a) => a.type === "Expense").reduce((s, a) => s + a.balance, 0));
const directIncomeOf = (rows: { type: string; group: string; balance: number }[]) => r2(rows.filter((a) => a.type === "Income" && a.group.toLowerCase().startsWith("direct")).reduce((s, a) => s + a.balance, 0));
const directExpenseOf = (rows: { type: string; group: string; balance: number }[]) => r2(rows.filter((a) => a.type === "Expense" && a.group.toLowerCase().startsWith("direct")).reduce((s, a) => s + a.balance, 0));

async function salesTotal(scope: ActiveScope, r: Range) { return num((await prisma.sale.aggregate({ where: { ...bw(scope), status: "Completed", saleDate: { gte: r.from, lte: r.to } }, _sum: { total: true } }))._sum.total); }
async function ordersCount(scope: ActiveScope, r: Range) { return prisma.sale.count({ where: { ...bw(scope), status: "Completed", saleDate: { gte: r.from, lte: r.to } } }); }
async function budgetSnapshot(scope: ActiveScope, r: Range) {
  const fy = fyFromDate(r.to);
  const headers = await prisma.budgetHeader.findMany({ where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), fy, status: { in: ["Approved", "Active"] } }, select: { lines: { select: { headId: true, annual: true, trackBudget: true } } } });
  let budget = 0; const heads = new Set<number>();
  for (const h of headers) for (const l of h.lines) { if (!l.trackBudget) continue; budget += num(l.annual); heads.add(l.headId); }
  const usage = await computeUsage(prisma, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: scope.branchId } as never, fy).catch(() => ({ actual: {} as Record<number, number>, committed: {} }));
  let actual = 0; for (const id of heads) actual += num((usage.actual as Record<number, number>)[id]);
  return { budget: r2(budget), actual: r2(actual) };
}

// -- the catalog -------------------------------------------------------------
export const METRICS: Metric[] = [
  { key: "sales", label: "Sales", module: "sales", unit: "money", goodDirection: "up", keywords: /\bsales?\b|\brevenue from sales\b|\bturnover\b|\bbilling\b/, definition: "Total value of completed sales invoices in the period.", formula: "Σ completed sale invoice totals", improve: ["Run promotions on slow-moving stock", "Increase average bill via cross-sell/upsell", "Follow up on quotations & abandoned carts"], drilldown: "/sales/history", compute: salesTotal },
  { key: "orders", label: "Orders", module: "sales", unit: "count", goodDirection: "up", keywords: /\borders?\b|\binvoices? count\b|\bbills? count\b|\bfootfall\b/, definition: "Number of completed sale invoices in the period.", formula: "count(completed sales)", improve: ["Drive footfall with campaigns", "Improve conversion at POS"], drilldown: "/sales/history", compute: ordersCount },
  { key: "avgBill", label: "Average Bill Value", module: "sales", unit: "money", goodDirection: "up", keywords: /\baverage bill\b|\bavg bill\b|\bbasket size\b|\baverage order\b|\baov\b/, definition: "Average value per sale invoice.", formula: "Sales ÷ Orders", improve: ["Bundle products", "Recommend add-ons", "Set minimum-cart offers"], drilldown: "/sales/analytics", compute: async (s, r) => { const [t, c] = await Promise.all([salesTotal(s, r), ordersCount(s, r)]); return c ? r2(t / c) : 0; } },
  { key: "purchases", label: "Purchases", module: "purchase", unit: "money", goodDirection: "neutral", keywords: /\bpurchases?\b|\bbuying\b|\bprocurement\b/, definition: "Total posted purchase invoice value in the period.", formula: "Σ posted purchase net payable", improve: ["Consolidate suppliers for better rates", "Negotiate volume discounts"], drilldown: "/purchase/invoice", compute: async (s, r) => num((await prisma.purchaseInvoice.aggregate({ where: { ...bw(s), status: "Posted", supplierInvoiceDate: { gte: r.from, lte: r.to } }, _sum: { netPayable: true } }))._sum.netPayable) },
  { key: "revenue", label: "Revenue", module: "finance", unit: "money", goodDirection: "up", keywords: /\brevenue\b|\bincome\b|\btotal income\b/, definition: "All income posted to the ledger in the period.", formula: "Σ income ledger movement", improve: ["Grow sales and service income", "Reduce discounts & returns"], drilldown: "/finance/reports", compute: async (s, r) => incomeOf(await periodBal(s, r)) },
  { key: "expense", label: "Expense", module: "finance", unit: "money", goodDirection: "down", keywords: /\bexpenses?\b|\bspend(ing)?\b|\bcosts?\b|\boverheads?\b/, definition: "All expense posted to the ledger in the period.", formula: "Σ expense ledger movement", improve: ["Review top expense heads for anomalies", "Renegotiate recurring costs", "Enforce budget controls"], drilldown: "/finance/petty-cash", compute: async (s, r) => expenseOf(await periodBal(s, r)) },
  { key: "grossProfit", label: "Gross Profit", module: "finance", unit: "money", goodDirection: "up", keywords: /\bgross profit\b|\bgross margin\b/, definition: "Trading profit before indirect items.", formula: "Direct Income − Direct Expense", improve: ["Improve product margins", "Reduce cost of goods sold"], drilldown: "/finance/reports", compute: async (s, r) => { const b = await periodBal(s, r); return r2(directIncomeOf(b) - directExpenseOf(b)); } },
  { key: "netProfit", label: "Net Profit", module: "finance", unit: "money", goodDirection: "up", keywords: /\bnet profit\b|\bprofit\b|\bp&l\b|\bbottom line\b/, definition: "Profit after all income and expense.", formula: "Total Income − Total Expense", improve: ["Grow revenue", "Control indirect expenses", "Optimise pricing"], drilldown: "/finance/reports", compute: async (s, r) => { const b = await periodBal(s, r); return r2(incomeOf(b) - expenseOf(b)); } },
  { key: "profitMargin", label: "Net Profit Margin", module: "finance", unit: "percent", goodDirection: "up", keywords: /\bprofit margin\b|\bnet margin\b|\bmargin\b/, definition: "Net profit as a percent of revenue.", formula: "Net Profit ÷ Revenue × 100", improve: ["Raise prices where possible", "Cut low-margin lines", "Reduce overheads"], drilldown: "/finance/reports", compute: async (s, r) => { const b = await periodBal(s, r); const inc = incomeOf(b); const np = r2(inc - expenseOf(b)); return inc > 0 ? r2((np / inc) * 100) : 0; } },
  { key: "cash", label: "Cash in Hand", module: "finance", unit: "money", goodDirection: "up", asOf: true, keywords: /\bcash\b(?!.*flow)|\bcash in hand\b|\bcash position\b/, definition: "Closing balance of the cash ledger.", formula: "Cash ledger balance as of date", improve: ["Bank surplus cash", "Tighten cash handling controls"], drilldown: "/finance/cash", compute: async (s, r) => bal(await accountBalancesAsOf(s, r.to), ACC.CASH) },
  { key: "bank", label: "Bank Balance", module: "finance", unit: "money", goodDirection: "up", asOf: true, keywords: /\bbank balance\b|\bbank\b/, definition: "Closing balance of the bank ledger.", formula: "Bank ledger balance as of date", improve: ["Park idle funds in short-term instruments"], drilldown: "/finance/bank-recon", compute: async (s, r) => bal(await accountBalancesAsOf(s, r.to), ACC.BANK) },
  { key: "receivable", label: "Accounts Receivable", module: "finance", unit: "money", goodDirection: "down", asOf: true, keywords: /\breceivable\b|\bdebtors\b|\bto collect\b|\bcustomer dues\b/, definition: "Outstanding amount customers owe.", formula: "Receivable ledger balance", improve: ["Tighten credit terms", "Increase overdue follow-up", "Offer early-payment incentives"], drilldown: "/finance/receivables", compute: async (s, r) => Math.max(0, bal(await accountBalancesAsOf(s, r.to), ACC.RECEIVABLE)) },
  { key: "payable", label: "Accounts Payable", module: "finance", unit: "money", goodDirection: "down", asOf: true, keywords: /\bpayable\b|\bcreditors\b|\bto pay\b|\bsupplier dues\b/, definition: "Outstanding amount owed to suppliers.", formula: "Payable ledger balance", improve: ["Schedule payments to due dates", "Use supplier credit periods fully"], drilldown: "/finance/payables", compute: async (s, r) => Math.max(0, bal(await accountBalancesAsOf(s, r.to), ACC.PAYABLE)) },
  { key: "workingCapital", label: "Working Capital", module: "finance", unit: "money", goodDirection: "up", asOf: true, keywords: /\bworking capital\b/, definition: "Current assets minus current liabilities.", formula: "Current Assets − Current Liabilities", improve: ["Speed up collections", "Optimise inventory", "Extend payables within terms"], drilldown: "/finance", compute: async (s, r) => { const a = await accountBalancesAsOf(s, r.to); const ca = r2(a.filter((x) => x.type === "Asset" && !x.group.toLowerCase().includes("fixed")).reduce((t, x) => t + x.balance, 0)); const cl = r2(a.filter((x) => x.type === "Liability").reduce((t, x) => t + x.balance, 0)); return r2(ca - cl); } },
  { key: "gstDue", label: "GST Payable", module: "statutory", unit: "money", goodDirection: "down", keywords: /\bgst\b/, definition: "Net GST payable to government for the month.", formula: "Output GST − eligible ITC", improve: ["Reconcile ITC in GSTR-2B", "Pay before due date to avoid interest"], drilldown: "/finance/statutory-compliance", compute: async (s, r) => (await computeLiability(s, "GST", ym(r.to))).balance },
  { key: "budgetUtil", label: "Budget Utilization", module: "budget", unit: "percent", goodDirection: "down", keywords: /\bbudget utilization\b|\bbudget utilisation\b|\bbudget used\b|\bbudget consumed\b/, definition: "Actual spend as a percent of approved budget for the year.", formula: "Actual ÷ Budget × 100", improve: ["Reallocate unused budget", "Investigate over-budget heads"], drilldown: "/finance/budget", compute: async (s, r) => { const b = await budgetSnapshot(s, r); return b.budget > 0 ? Math.round((b.actual / b.budget) * 100) : 0; } },
];

export function findMetric(message: string): Metric | null {
  const q = message.toLowerCase();
  // Prefer the most specific match (longest keyword hit wins).
  let best: Metric | null = null; let bestLen = 0;
  for (const m of METRICS) { const hit = q.match(m.keywords); if (hit && hit[0].length > bestLen) { best = m; bestLen = hit[0].length; } }
  return best;
}
export function metricByKey(key: string) { return METRICS.find((m) => m.key === key) ?? null; }

/** Time series for a metric across the given YYYY-MM months. */
export async function seriesFor(metric: Metric, scope: ActiveScope, months: string[]): Promise<{ name: string; value: number }[]> {
  const { monthRange, monthShort } = await import("./period");
  const out: { name: string; value: number }[] = [];
  for (const mo of months) { const v = await metric.compute(scope, monthRange(mo)); out.push({ name: monthShort(mo), value: r2(v) }); }
  return out;
}

export const fmtUnit = (unit: Metric["unit"], v: number) => unit === "money" ? `₹${Math.round(v).toLocaleString("en-IN")}` : unit === "percent" ? `${Math.round(v)}%` : `${Math.round(v).toLocaleString("en-IN")}`;
