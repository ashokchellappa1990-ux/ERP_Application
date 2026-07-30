import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere } from "@/lib/auth/scope";
import { accountBalancesAsOf, accountBalancesPeriod, cashFlow } from "@/lib/accounting/reports";
import { ACC } from "@/lib/accounting/accounts";
import { groupByParty, type AgeableRow } from "@/lib/finance/aging";
import { computeUsage, fyFromDate } from "@/lib/finance/budgetService";
import { computeLiability } from "@/lib/finance/statutory/engine";
import { dueDate as statDueDate } from "@/lib/finance/statutory/types";

/**
 * AI Finance Intelligence engine — the central financial assistant. Every figure is
 * derived LIVE from the finance modules (GL, AR/AP, budget, recurring, statutory,
 * cost/profit centre, audit). It produces a holistic analysis: health score, insights,
 * alerts, action centre, forecast, recommendations, compliance, recent + upcoming
 * activities, system status and an overall priority score. Nothing is invented — the
 * "AI" is a deterministic rule engine over real ledger data (explainable & auditable).
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const addDays = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
const bizWhere = (s: ActiveScope) => scopeWhere(s, { branch: true }) as { tenantId: number; businessId?: number; branchId?: number | { in: number[] } };
const bizOnly = (s: ActiveScope) => ({ tenantId: s.tenantId, ...(s.businessId != null ? { businessId: s.businessId } : {}) });
const bal = (rows: { code: string; balance: number }[], code: string) => rows.find((r) => r.code === code)?.balance ?? 0;
function monthRange(period: string) { const [y, m] = period.split("-").map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}` }; }
function prevMonth(period: string) { const [y, m] = period.split("-").map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; }

export interface AiOpts { period: string; from?: string; to?: string; costCenterId?: number | null; profitCenterId?: number | null }
export type FeedbackMap = Map<string, { status: string; assignedTo: string | null }>;

export interface HealthFactor { name: string; score: number; note: string }
export interface AiHealth { score: number; status: string; color: "green" | "orange" | "red"; factors: HealthFactor[] }
export interface AiInsight { key: string; severity: "critical" | "high" | "medium" | "info"; category: string; title: string; detail: string; metric?: string; href?: string; status?: string }
export interface AiAlert { key: string; level: "Critical" | "High" | "Medium" | "Information"; type: string; message: string; href?: string; status?: string; assignedTo?: string | null }
export interface AiAction { key: string; label: string; count: number; amount?: number; href: string; group: string }
export interface AiForecast { horizon: string; days: number; cashBalance: number; collections: number; payments: number; recurringExpense: number; recurringIncome: number; workingCapital: number; profit: number; budgetUtilization: number }
export interface AiRecommendation { key: string; title: string; reason: string; impact: string; action: string; href?: string; priority: number }
export interface AiActivity { at: string; type: string; summary: string; user: string }
export interface AiUpcoming { key: string; label: string; due: string; amount?: number; kind: string; href?: string; overdue: boolean }
export interface AiSystem { name: string; ok: boolean; detail: string }

// ------------------------------------------------------------------- base pull
async function base(scope: ActiveScope, opts: AiOpts) {
  const { period } = opts;
  const today = todayStr();
  const { from, to } = opts.from && opts.to ? { from: opts.from, to: opts.to } : monthRange(period);
  const bw = bizWhere(scope);

  const [asOf, cur, prev, cf] = await Promise.all([
    accountBalancesAsOf(scope, to),
    accountBalancesPeriod(scope, from, to),
    (async () => { const p = prevMonth(period); const r = monthRange(p); return accountBalancesPeriod(scope, r.from, r.to); })(),
    cashFlow(scope, from, to),
  ]);

  const cash = bal(asOf, ACC.CASH), bank = bal(asOf, ACC.BANK);
  const receivable = Math.max(0, bal(asOf, ACC.RECEIVABLE)), payable = Math.max(0, bal(asOf, ACC.PAYABLE));
  const currentAssets = r2(asOf.filter((a) => a.type === "Asset" && !a.group.toLowerCase().includes("fixed")).reduce((s, a) => s + a.balance, 0));
  const currentLiabilities = r2(asOf.filter((a) => a.type === "Liability").reduce((s, a) => s + a.balance, 0));
  const revenue = r2(cur.filter((a) => a.type === "Income").reduce((s, a) => s + a.balance, 0));
  const expense = r2(cur.filter((a) => a.type === "Expense").reduce((s, a) => s + a.balance, 0));
  const prevRevenue = r2(prev.filter((a) => a.type === "Income").reduce((s, a) => s + a.balance, 0));
  const prevExpense = r2(prev.filter((a) => a.type === "Expense").reduce((s, a) => s + a.balance, 0));
  const netProfit = r2(revenue - expense), prevNetProfit = r2(prevRevenue - prevExpense);
  const workingCapital = r2(currentAssets - currentLiabilities);

  // AR / AP aging
  const arRows = await prisma.sale.findMany({ where: { ...bw, status: "Completed", paymentStatus: { not: "Paid" } }, select: { customerName: true, total: true, amountPaid: true, dueDate: true, saleDate: true }, take: 5000 });
  const ar: AgeableRow[] = arRows.map((s) => { const b = r2(num(s.total) - num(s.amountPaid)); const due = s.dueDate || s.saleDate; return { party: s.customerName || "Walk-in", billed: num(s.total), paid: num(s.amountPaid), balance: b, dueDate: due, overdue: !!due && due < today }; }).filter((r) => r.balance > 0.5);
  const arAgg = groupByParty(ar, today);
  const apRows = await prisma.payable.findMany({ where: { ...bw, status: { not: "Paid" } }, select: { supplier: true, totalAmount: true, paidAmount: true, balanceAmount: true, dueDate: true, docDate: true }, take: 5000 });
  const ap: AgeableRow[] = apRows.map((p) => { const due = p.dueDate || p.docDate; return { party: p.supplier || "—", billed: num(p.totalAmount), paid: num(p.paidAmount), balance: num(p.balanceAmount), dueDate: due, overdue: !!due && due < today }; }).filter((r) => r.balance > 0.5);
  const apAgg = groupByParty(ap, today);

  // budget
  const fy = fyFromDate(to);
  const headers = await prisma.budgetHeader.findMany({ where: { ...bizOnly(scope), fy, status: { in: ["Approved", "Active"] } }, select: { lines: { select: { headId: true, headName: true, annual: true, trackBudget: true } } } });
  const budgetByHead = new Map<number, { name: string; budget: number }>();
  for (const h of headers) for (const l of h.lines) { if (!l.trackBudget) continue; const c = budgetByHead.get(l.headId) ?? { name: l.headName ?? `Head ${l.headId}`, budget: 0 }; c.budget = r2(c.budget + num(l.annual)); budgetByHead.set(l.headId, c); }
  const usage = await computeUsage(prisma, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: scope.branchId } as never, fy).catch(() => ({ actual: {}, committed: {} }));
  let budget = 0, actual = 0, committed = 0; const overBudget: { name: string; pct: number }[] = [];
  for (const [id, info] of budgetByHead) { const a = num((usage.actual as Record<number, number>)[id]); const c = num((usage.committed as Record<number, number>)[id]); budget += info.budget; actual += a; committed += c; if (info.budget > 0 && a > info.budget * 0.9) overBudget.push({ name: info.name, pct: pct(a, info.budget) }); }
  const budgetUtil = pct(actual, budget);

  // statutory
  const [gst, tds, tcs] = await Promise.all([computeLiability(scope, "GST", period), computeLiability(scope, "TDS", period), computeLiability(scope, "TCS", period)]);

  return {
    period, today, from, to, cash, bank, receivable, payable, currentAssets, currentLiabilities,
    revenue, expense, netProfit, prevRevenue, prevExpense, prevNetProfit, workingCapital,
    arAgg, apAgg, ar, ap, cf, budget: r2(budget), actual: r2(actual), committed: r2(committed), budgetUtil, overBudget: overBudget.sort((a, b) => b.pct - a.pct),
    gst, tds, tcs,
  };
}
type Base = Awaited<ReturnType<typeof base>>;

// -------------------------------------------------------------------- health
function health(b: Base): AiHealth {
  const currentRatio = b.currentLiabilities > 0 ? b.currentAssets / b.currentLiabilities : 2;
  const margin = b.revenue > 0 ? (b.netProfit / b.revenue) * 100 : 0;
  const arOverdue = b.arAgg.aging.d31_60 + b.arAgg.aging.d61_90 + b.arAgg.aging.d90;
  const arTotal = Object.values(b.arAgg.aging).reduce((s, v) => s + v, 0);
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const factors: HealthFactor[] = [
    { name: "Cash Position", score: clamp(b.cash + b.bank > 0 ? 88 : 15), note: money(b.cash + b.bank) },
    { name: "Working Capital", score: clamp(b.workingCapital >= 0 ? 80 + Math.min(20, b.workingCapital / 10000) : 30), note: money(b.workingCapital) },
    { name: "Profitability", score: clamp(50 + margin * 3), note: `${margin.toFixed(1)}% margin` },
    { name: "Receivables health", score: clamp(arTotal > 0 ? 100 - pct(arOverdue, arTotal) : 90), note: `${money(arOverdue)} > 30d` },
    { name: "Payables control", score: clamp(b.apAgg.aging.d90 > 0 ? 55 : 85), note: money(b.payable) },
    { name: "Budget discipline", score: clamp(b.budgetUtil > 100 ? 40 : 100 - Math.max(0, b.budgetUtil - 80)), note: `${b.budgetUtil}% used` },
    { name: "Compliance", score: clamp((b.gst.balance > 0.5 ? 0 : 40) + (b.tds.balance > 0.5 ? 0 : 30) + (b.tcs.balance > 0.5 ? 0 : 30)), note: b.gst.balance + b.tds.balance + b.tcs.balance > 0.5 ? "dues pending" : "clear" },
    { name: "Bank Balance", score: clamp(b.bank > 0 ? 85 : 20), note: money(b.bank) },
    { name: "Outstanding (AR)", score: clamp(b.receivable > 0 ? 70 : 90), note: money(b.receivable) },
    { name: "Liquidity ratio", score: clamp((currentRatio / 2) * 100), note: `${currentRatio.toFixed(2)}×` },
  ];
  const score = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length);
  const status = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Average" : "Poor";
  const color: AiHealth["color"] = score >= 70 ? "green" : score >= 45 ? "orange" : "red";
  return { score, status, color, factors };
}

// ------------------------------------------------------------------ insights
function insights(b: Base, fb: FeedbackMap): AiInsight[] {
  const out: AiInsight[] = [];
  const push = (severity: AiInsight["severity"], category: string, title: string, detail: string, metric?: string, href?: string) => {
    const key = `insight:${category}:${b.period}`; out.push({ key, severity, category, title, detail, metric, href });
  };
  // Cash runway
  const dailyBurn = b.cf.totalOutflow / 30;
  if (dailyBurn > 0) { const runway = Math.floor((b.cash + b.bank) / dailyBurn); if (runway < 15) push("critical", "cash-runway", "Cash may run low soon", `At the current spend rate, cash & bank cover about ${runway} day(s).`, `${runway}d runway`, "/finance/cash"); }
  // Expense trend
  if (b.prevExpense > 0) { const chg = pct(b.expense - b.prevExpense, b.prevExpense); if (chg >= 15) push("high", "expense-trend", "Expenses rising", `Expenses are ${chg}% higher than last month (${money(b.expense)} vs ${money(b.prevExpense)}).`, `+${chg}%`, "/finance/petty-cash"); }
  // Revenue vs last month
  if (b.prevRevenue > 0) { const chg = pct(b.revenue - b.prevRevenue, b.prevRevenue); if (chg <= -10) push("high", "revenue-trend", "Revenue below last month", `Revenue is ${Math.abs(chg)}% lower than last month.`, `${chg}%`, "/sales/analytics"); }
  // Net margin
  if (b.prevNetProfit !== 0 && b.revenue > 0 && b.prevRevenue > 0) { const m = (b.netProfit / b.revenue) * 100, pm = (b.prevNetProfit / b.prevRevenue) * 100; const d = Math.round(m - pm); if (d <= -3) push("medium", "margin", "Net profit margin dropped", `Net margin fell ${Math.abs(d)} points vs last month to ${m.toFixed(1)}%.`, `${d} pts`); }
  // Receivables 90+
  if (b.arAgg.aging.d90 > 0) push("high", "ar-90", "Receivables above 90 days", `${money(b.arAgg.aging.d90)} is stuck over 90 days overdue.`, money(b.arAgg.aging.d90), "/finance/receivables");
  // Supplier over terms
  const worstAp = b.apAgg.groups.find((g) => g.aging.d61_90 + g.aging.d90 > 0);
  if (worstAp) push("medium", "ap-terms", "Supplier past credit terms", `${worstAp.party} has ${money(worstAp.overdue)} pending beyond terms.`, money(worstAp.overdue), "/finance/payables");
  // Budget utilization
  if (b.budgetUtil >= 90) push(b.budgetUtil > 100 ? "critical" : "high", "budget", "Budget utilisation is high", `Budget utilisation has reached ${b.budgetUtil}%.`, `${b.budgetUtil}%`, "/finance/budget");
  for (const h of b.overBudget.slice(0, 2)) push("high", `overbudget-${h.name}`, "Head over budget", `"${h.name}" is at ${h.pct}% of its allocation.`, `${h.pct}%`, "/finance/budget");
  // GST due
  if (b.gst.balance > 0.5) { const due = statDueDate("GST", b.period); push("high", "gst-due", "GST payment due", `Net GST payable ${money(b.gst.balance)} — due ${due}.`, money(b.gst.balance), "/finance/statutory-compliance"); }
  if (b.tds.balance > 0.5) push("medium", "tds-due", "TDS payment pending", `TDS payable ${money(b.tds.balance)} pending.`, money(b.tds.balance), "/finance/statutory-compliance");
  // Positive insight
  if (b.netProfit > 0) push("info", "profit", "Business is profitable", `Net profit this period is ${money(b.netProfit)}.`, money(b.netProfit));
  if (!out.length) push("info", "all-good", "All indicators normal", "No anomalies detected in the current period.");
  // annotate + filter dismissed/ignored
  return out.map((i) => ({ ...i, status: fb.get(i.key)?.status })).filter((i) => i.status !== "dismissed");
}

// -------------------------------------------------------------------- alerts
function alerts(b: Base, recurringFailed: number, unpostedDrafts: number, fb: FeedbackMap): AiAlert[] {
  const out: AiAlert[] = [];
  const push = (level: AiAlert["level"], type: string, message: string, href?: string) => { const key = `alert:${type}:${b.period}`; out.push({ key, level, type, message, href }); };
  if (b.cf.netChange < 0 && b.cash + b.bank < Math.abs(b.cf.netChange)) push("Critical", "negative-cashflow", `Negative cash flow of ${money(Math.abs(b.cf.netChange))} this period.`, "/finance/cash");
  if (b.bank < 10000) push("High", "low-bank", `Bank balance is low (${money(b.bank)}).`, "/finance/bank-recon");
  if (b.budgetUtil > 100) push("High", "budget-exceeded", `Budget exceeded — utilisation at ${b.budgetUtil}%.`, "/finance/budget");
  if (b.gst.balance > 0.5) push("High", "gst-due", `GST payment of ${money(b.gst.balance)} is due.`, "/finance/statutory-compliance");
  if (b.tds.balance > 0.5) push("Medium", "tds-due", `TDS payment of ${money(b.tds.balance)} pending.`, "/finance/statutory-compliance");
  if (b.tcs.balance > 0.5) push("Medium", "tcs-due", `TCS payment of ${money(b.tcs.balance)} pending.`, "/finance/statutory-compliance");
  if (b.arAgg.aging.d90 > 0) push("High", "outstanding-customer", `${money(b.arAgg.aging.d90)} receivable overdue 90+ days.`, "/finance/receivables");
  if (b.apAgg.aging.d90 > 0) push("Medium", "outstanding-supplier", `${money(b.apAgg.aging.d90)} payable overdue 90+ days.`, "/finance/payables");
  if (recurringFailed > 0) push("High", "recurring-failure", `${recurringFailed} recurring transaction(s) failed.`, "/finance/recurring");
  if (unpostedDrafts > 0) push("Information", "unposted", `${unpostedDrafts} draft receipt/journal awaiting posting.`, "/finance/receipt");
  if (!out.length) push("Information", "clear", "No active financial alerts.");
  return out.map((a) => ({ ...a, status: fb.get(a.key)?.status, assignedTo: fb.get(a.key)?.assignedTo })).filter((a) => a.status !== "ignored");
}

// ------------------------------------------------------------- action centre
async function actionCentre(scope: ActiveScope): Promise<AiAction[]> {
  const bw = bizWhere(scope);
  const safe = async (fn: () => Promise<number>) => { try { return await fn(); } catch { return 0; } };
  const [supPay, custColl, budgetRev, budgetTrf, govPay, recAppr, recManual, recFail, receipts, purchaseInv, retPending] = await Promise.all([
    safe(() => prisma.payable.count({ where: { ...bw, status: { not: "Paid" } } })),
    safe(() => prisma.sale.count({ where: { ...bw, status: "Completed", paymentStatus: { not: "Paid" } } })),
    safe(() => prisma.budgetRevision.count({ where: { ...bw, status: "Pending" } })),
    safe(() => prisma.budgetTransfer.count({ where: { ...bw, status: "Pending" } })),
    safe(() => prisma.statutoryPayment.count({ where: { ...bw, status: "Submitted" } })),
    safe(() => prisma.recurringExecution.count({ where: { ...bw, status: "PendingApproval" } })),
    safe(() => prisma.recurringConfig.count({ where: { ...bw, status: "Active", generationMode: "manual", nextExecution: { lte: todayStr() } } })),
    safe(() => prisma.recurringExecution.count({ where: { ...bw, status: "Failed" } })),
    safe(() => prisma.receiptTransaction.count({ where: { ...bw, status: "Submitted" } })),
    safe(() => prisma.purchaseInvoice.count({ where: { ...bw, status: "Pending Approval" } })),
    safe(() => prisma.statutoryReturn.count({ where: { ...bw, status: { not: "Filed" } } })),
  ]);
  const items: AiAction[] = [
    { key: "supplier-payments", label: "Supplier Payments", count: supPay, href: "/finance/payables", group: "Payments" },
    { key: "customer-collections", label: "Customer Collections", count: custColl, href: "/finance/receivables", group: "Collections" },
    { key: "expense-approvals", label: "Expense / Purchase Approvals", count: purchaseInv, href: "/purchase/invoice", group: "Approvals" },
    { key: "budget-revisions", label: "Budget Revisions", count: budgetRev, href: "/finance/budget/revision", group: "Approvals" },
    { key: "budget-transfers", label: "Budget Transfers", count: budgetTrf, href: "/finance/budget/transfer", group: "Approvals" },
    { key: "gov-payments", label: "Government Payments", count: govPay, href: "/finance/statutory-compliance", group: "Approvals" },
    { key: "receipt-approvals", label: "Receipt Vouchers", count: receipts, href: "/finance/receipt", group: "Approvals" },
    { key: "recurring-manual", label: "Recurring Manual Txns", count: recManual, href: "/finance/recurring", group: "Recurring" },
    { key: "recurring-approval", label: "Recurring Approvals", count: recAppr, href: "/finance/recurring", group: "Recurring" },
    { key: "recurring-failed", label: "Recurring Failures", count: recFail, href: "/finance/recurring", group: "Recurring" },
    { key: "return-filing", label: "Pending Return Filing", count: retPending, href: "/finance/statutory-compliance", group: "Compliance" },
  ];
  return items.filter((i) => i.count > 0);
}

// -------------------------------------------------------------------- forecast
async function forecast(scope: ActiveScope, b: Base): Promise<AiForecast[]> {
  const bw = bizWhere(scope);
  const dailyNet = b.cf.netChange / 30;
  const horizons: { horizon: string; days: number }[] = [{ horizon: "Next 7 Days", days: 7 }, { horizon: "Next 30 Days", days: 30 }, { horizon: "Next 90 Days", days: 90 }];
  const out: AiForecast[] = [];
  for (const h of horizons) {
    const until = addDays(h.days);
    const [coll, pay, recExp, recInc] = await Promise.all([
      prisma.sale.findMany({ where: { ...bw, status: "Completed", paymentStatus: { not: "Paid" }, dueDate: { lte: until } }, select: { total: true, amountPaid: true }, take: 5000 }).then((rs) => r2(rs.reduce((s, x) => s + (num(x.total) - num(x.amountPaid)), 0))),
      prisma.payable.aggregate({ where: { ...bw, status: { not: "Paid" }, dueDate: { lte: until } }, _sum: { balanceAmount: true } }).then((a) => num(a._sum.balanceAmount)),
      prisma.recurringConfig.findMany({ where: { ...bw, status: "Active", txnType: "expense", nextExecution: { lte: until } }, select: { amount: true } }).then((rs) => r2(rs.reduce((s, x) => s + num(x.amount), 0))),
      prisma.recurringConfig.findMany({ where: { ...bw, status: "Active", txnType: "income", nextExecution: { lte: until } }, select: { amount: true } }).then((rs) => r2(rs.reduce((s, x) => s + num(x.amount), 0))),
    ]);
    const cashBalance = r2(b.cash + b.bank + dailyNet * h.days + coll - pay);
    const profit = r2((b.netProfit / 30) * h.days);
    out.push({ horizon: h.horizon, days: h.days, cashBalance, collections: coll, payments: r2(pay), recurringExpense: recExp, recurringIncome: recInc, workingCapital: r2(b.workingCapital + coll - pay), profit, budgetUtilization: Math.min(200, b.budgetUtil + Math.round((b.budgetUtil / 30) * h.days * 0.3)) });
  }
  return out;
}

// ------------------------------------------------------------- recommendations
function recommendations(b: Base): AiRecommendation[] {
  const out: AiRecommendation[] = [];
  const push = (priority: number, title: string, reason: string, impact: string, action: string, href?: string) => out.push({ key: `rec:${title}`, priority, title, reason, impact, action, href });
  if (b.cash + b.bank < b.cf.totalOutflow / 2) push(90, "Optimise cash flow", `Available cash (${money(b.cash + b.bank)}) is low vs this period's outflow.`, "Avoids a cash shortfall.", "Delay non-critical payments and accelerate collections.", "/finance/cash");
  if (b.arAgg.aging.d61_90 + b.arAgg.aging.d90 > 0) push(85, "Collect overdue invoices", `${money(b.arAgg.aging.d61_90 + b.arAgg.aging.d90)} is overdue beyond 60 days.`, `Recovers up to ${money(b.arAgg.aging.d61_90 + b.arAgg.aging.d90)} in cash.`, "Increase follow-up on overdue customers.", "/finance/receivables");
  if (b.overBudget.length) push(80, "Rebalance budget", `${b.overBudget.length} head(s) near/over budget.`, "Prevents budget overrun.", `Transfer unused budget to ${b.overBudget[0].name}.`, "/finance/budget/transfer");
  if (b.prevExpense > 0 && b.expense > b.prevExpense * 1.15) push(75, "Review rising expenses", `Expenses up ${pct(b.expense - b.prevExpense, b.prevExpense)}% vs last month.`, "Controls cost creep.", "Review the top expense heads for anomalies.", "/finance/petty-cash");
  if (b.gst.balance > 0.5) push(88, "Clear GST liability", `GST payable ${money(b.gst.balance)} is due soon.`, "Avoids interest & penalty.", "Create a GST government payment.", "/finance/statutory-compliance");
  if (b.apAgg.aging.d90 > 0) push(60, "Settle aged payables", `${money(b.apAgg.aging.d90)} payable is 90+ days old.`, "Protects supplier relationships.", "Prioritise the oldest supplier dues.", "/finance/payables");
  if (!out.length) push(20, "Maintain course", "All key finance metrics are within healthy ranges.", "Sustains financial health.", "Keep monitoring receivables and budget.", "/finance");
  return out.sort((a, b2) => b2.priority - a.priority);
}

// ----------------------------------------------------- recent + upcoming + system
async function recentActivities(scope: ActiveScope): Promise<AiActivity[]> {
  const logs = await prisma.auditLog.findMany({ where: { ...bizOnly(scope), action: { in: ["petty_cash.create", "journal.create", "statutory.payment.markPaid", "statutory.payment.create", "recurring.execute", "budget.revision.create", "budget.transfer.create", "receipt.create", "sales.collection", "purchase.payment"] } }, orderBy: { id: "desc" }, take: 12, select: { action: true, summary: true, userName: true, createdAt: true } }).catch(() => []);
  if (logs.length) return logs.map((l) => ({ at: l.createdAt.toISOString(), type: l.action, summary: l.summary || l.action, user: l.userName || "—" }));
  const any = await prisma.auditLog.findMany({ where: { ...bizOnly(scope) }, orderBy: { id: "desc" }, take: 12, select: { action: true, summary: true, userName: true, createdAt: true } }).catch(() => []);
  return any.map((l) => ({ at: l.createdAt.toISOString(), type: l.action, summary: l.summary || l.action, user: l.userName || "—" }));
}

async function upcomingActivities(scope: ActiveScope, b: Base): Promise<AiUpcoming[]> {
  const bw = bizWhere(scope); const today = todayStr(); const soon = addDays(30);
  const out: AiUpcoming[] = [];
  const [payDue, collDue, recDue] = await Promise.all([
    prisma.payable.findMany({ where: { ...bw, status: { not: "Paid" }, dueDate: { not: null, lte: soon } }, orderBy: { dueDate: "asc" }, take: 5, select: { supplier: true, balanceAmount: true, dueDate: true } }),
    prisma.sale.findMany({ where: { ...bw, status: "Completed", paymentStatus: { not: "Paid" }, dueDate: { not: null, lte: soon } }, orderBy: { dueDate: "asc" }, take: 5, select: { customerName: true, total: true, amountPaid: true, dueDate: true } }),
    prisma.recurringConfig.findMany({ where: { ...bw, status: "Active", nextExecution: { not: null, lte: soon } }, orderBy: { nextExecution: "asc" }, take: 5, select: { name: true, amount: true, nextExecution: true, txnType: true } }),
  ]);
  for (const p of payDue) out.push({ key: `pay:${p.supplier}:${p.dueDate}`, label: `Supplier Payment — ${p.supplier ?? "—"}`, due: p.dueDate!, amount: num(p.balanceAmount), kind: "payment", href: "/finance/payables", overdue: !!p.dueDate && p.dueDate < today });
  for (const c of collDue) out.push({ key: `coll:${c.customerName}:${c.dueDate}`, label: `Customer Collection — ${c.customerName ?? "—"}`, due: c.dueDate!, amount: r2(num(c.total) - num(c.amountPaid)), kind: "collection", href: "/finance/receivables", overdue: !!c.dueDate && c.dueDate < today });
  for (const rc of recDue) out.push({ key: `rec:${rc.name}:${rc.nextExecution}`, label: `Recurring ${rc.txnType} — ${rc.name}`, due: rc.nextExecution!, amount: num(rc.amount), kind: "recurring", href: "/finance/recurring", overdue: !!rc.nextExecution && rc.nextExecution < today });
  if (b.gst.balance > 0.5) { const d = statDueDate("GST", b.period); out.push({ key: `gst:${b.period}`, label: "GST Payment", due: d, amount: b.gst.balance, kind: "gst", href: "/finance/statutory-compliance", overdue: d < today }); }
  if (b.tds.balance > 0.5) { const d = statDueDate("TDS", b.period); out.push({ key: `tds:${b.period}`, label: "TDS Payment", due: d, amount: b.tds.balance, kind: "tds", href: "/finance/statutory-compliance", overdue: d < today }); }
  return out.sort((a, z) => a.due.localeCompare(z.due)).slice(0, 12);
}

async function systemStatus(scope: ActiveScope): Promise<AiSystem[]> {
  const bw = bizWhere(scope);
  const [recentJe, dbOk, schedulerRecent, gstReady] = await Promise.all([
    prisma.journalEntry.count({ where: { ...bw, date: { gte: addDays(-2) } } }).catch(() => -1),
    prisma.$queryRawUnsafe("SELECT 1").then(() => true).catch(() => false),
    prisma.recurringExecution.count({ where: { ...bw, generatedByUserId: null, createdAt: { gte: new Date(Date.now() - 3 * 864e5) } } }).catch(() => -1),
    prisma.ledgerAccount.count({ where: { tenantId: scope.tenantId, code: { in: [ACC.OUTPUT_GST, ACC.INPUT_GST] } } }).then((c) => c >= 2).catch(() => false),
  ]);
  return [
    { name: "Accounting Engine", ok: recentJe >= 0, detail: recentJe >= 0 ? "Posting vouchers" : "No recent postings" },
    { name: "Scheduler", ok: schedulerRecent >= 0, detail: schedulerRecent > 0 ? `${schedulerRecent} auto-runs (3d)` : "Idle" },
    { name: "GST Engine", ok: gstReady, detail: gstReady ? "Accounts ready" : "Not configured" },
    { name: "Database", ok: dbOk, detail: dbOk ? "Healthy" : "Unreachable" },
    { name: "Bank Integration", ok: false, detail: "Manual reconciliation" },
    { name: "Notification Engine", ok: true, detail: "In-app alerts active" },
    { name: "API", ok: true, detail: "Operational" },
  ];
}

// -------------------------------------------------------------------- compose
export async function analyze(scope: ActiveScope, opts: AiOpts, fb: FeedbackMap) {
  const b = await base(scope, opts);
  const bw = bizWhere(scope);
  const [recurringFailed, unposted] = await Promise.all([
    prisma.recurringExecution.count({ where: { ...bw, status: "Failed" } }).catch(() => 0),
    prisma.receiptTransaction.count({ where: { ...bw, status: { in: ["Draft", "Submitted"] } } }).catch(() => 0),
  ]);
  const [actions, fc, recent, upcoming, system] = await Promise.all([
    actionCentre(scope), forecast(scope, b), recentActivities(scope), upcomingActivities(scope, b), systemStatus(scope),
  ]);
  const h = health(b);
  const ins = insights(b, fb);
  const al = alerts(b, recurringFailed, unposted, fb);
  const recs = recommendations(b);
  const compliance = {
    gst: { input: b.gst.gst?.itc ?? 0, output: b.gst.gst?.outputTax ?? 0, net: b.gst.liability, paymentDue: b.gst.balance, returnDue: statDueDate("GST", b.period) },
    tds: { deducted: b.tds.liability, paid: b.tds.alreadyPaid, pending: b.tds.balance, returnDue: statDueDate("TDS", b.period) },
    tcs: { collected: b.tcs.liability, paid: b.tcs.alreadyPaid, pending: b.tcs.balance, returnDue: statDueDate("TCS", b.period) },
    future: [{ name: "Provident Fund (PF)", status: "Future" }, { name: "ESI", status: "Future" }, { name: "Professional Tax", status: "Future" }],
  };
  // priority score — how urgent is the overall financial situation (0 = calm, 100 = critical)
  const critical = al.filter((a) => a.level === "Critical").length;
  const high = al.filter((a) => a.level === "High").length + ins.filter((i) => i.severity === "high" || i.severity === "critical").length;
  const priorityScore = Math.min(100, critical * 30 + high * 12 + (actions.reduce((s, a) => s + Math.min(a.count, 5), 0)));

  return {
    period: b.period, generatedAt: new Date().toISOString(),
    health: h, insights: ins, alerts: al, actions, forecast: fc, recommendations: recs, compliance, recent, upcoming, system,
    priorityScore,
    summary: { cash: r2(b.cash + b.bank), receivable: b.receivable, payable: b.payable, netProfit: b.netProfit, budgetUtil: b.budgetUtil },
  };
}

// ---------------------------------------------------------------------- pulse
/** Cheap change-signature — the panel polls this; when it changes, a new financial
 *  event has posted, so the panel refreshes without a page reload. */
export async function pulse(scope: ActiveScope): Promise<string> {
  const bw = bizWhere(scope);
  const [je, sale, pay, audit] = await Promise.all([
    prisma.journalEntry.aggregate({ where: bw, _max: { id: true }, _count: true }).catch(() => ({ _max: { id: 0 }, _count: 0 })),
    prisma.sale.aggregate({ where: bw, _max: { id: true } }).catch(() => ({ _max: { id: 0 } })),
    prisma.payable.aggregate({ where: bw, _max: { id: true } }).catch(() => ({ _max: { id: 0 } })),
    prisma.auditLog.aggregate({ where: bizOnly(scope), _max: { id: true } }).catch(() => ({ _max: { id: 0 } })),
  ]);
  return `${je._max.id ?? 0}.${(je as { _count?: number })._count ?? 0}.${sale._max.id ?? 0}.${pay._max.id ?? 0}.${audit._max.id ?? 0}`;
}

// --------------------------------------------------------------------- search
export async function search(scope: ActiveScope, q: string) {
  const bw = bizWhere(scope); const term = q.trim(); if (term.length < 2) return { results: [] };
  const [vouchers, sales, suppliers, customers, expenses] = await Promise.all([
    prisma.journalEntry.findMany({ where: { ...bw, OR: [{ voucherNo: { contains: term } }, { narration: { contains: term } }, { refNo: { contains: term } }] }, orderBy: { id: "desc" }, take: 6, select: { voucherNo: true, voucherType: true, date: true, narration: true } }),
    prisma.sale.findMany({ where: { ...bw, OR: [{ invoiceNo: { contains: term } }, { customerName: { contains: term } }] }, orderBy: { id: "desc" }, take: 6, select: { invoiceNo: true, customerName: true, total: true } }),
    prisma.supplier.findMany({ where: { tenantId: scope.tenantId, name: { contains: term } }, take: 5, select: { id: true, name: true } }).catch(() => []),
    prisma.customer.findMany({ where: { tenantId: scope.tenantId, name: { contains: term } }, take: 5, select: { id: true, name: true } }).catch(() => []),
    prisma.pettyCashVoucher.findMany({ where: { ...bw, OR: [{ voucherNo: { contains: term } }, { payeeName: { contains: term } }] }, orderBy: { id: "desc" }, take: 5, select: { voucherNo: true, payeeName: true, totalAmount: true } }),
  ]);
  const results = [
    ...vouchers.map((v) => ({ type: "Journal", label: `${v.voucherNo} · ${v.voucherType}`, sub: v.narration ?? v.date, href: "/finance/journal" })),
    ...sales.map((s) => ({ type: "Sale", label: `${s.invoiceNo}`, sub: `${s.customerName ?? "Walk-in"} · ${money(num(s.total))}`, href: "/sales/history" })),
    ...expenses.map((e) => ({ type: "Expense", label: `${e.voucherNo}`, sub: `${e.payeeName ?? ""} · ${money(num(e.totalAmount))}`, href: "/finance/petty-cash" })),
    ...suppliers.map((s) => ({ type: "Supplier", label: s.name, sub: "Supplier master", href: "/masters/supplier" })),
    ...customers.map((c) => ({ type: "Customer", label: c.name, sub: "Customer master", href: "/masters/customer" })),
  ];
  return { results };
}
