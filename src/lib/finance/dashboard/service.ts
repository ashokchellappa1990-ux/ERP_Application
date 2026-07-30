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
 * Enterprise Finance Dashboard service — every figure is derived LIVE from the
 * finance modules (GL, AR/AP, budget, recurring, statutory, cost/profit centre,
 * audit). Three role-oriented builders: executive / operations / controller.
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: unknown) => (v == null ? 0 : Number(v));
type NameVal = { name: string; value: number };

export interface DashOpts { period: string; from?: string; to?: string; costCenterId?: number | null; profitCenterId?: number | null }
export interface Branch { id: number; name: string }

function monthRange(period: string) { const [y, m] = period.split("-").map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}` }; }
function recentMonths(period: string, n: number): string[] { const [y, m] = period.split("-").map(Number); const out: string[] = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`); } return out; }
const mLabel = (p: string) => { const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; const [y, m] = p.split("-").map(Number); return `${names[m - 1]} ${String(y).slice(2)}`; };
const bizWhere = (s: ActiveScope) => scopeWhere(s, { branch: true }) as { tenantId: number; businessId?: number; branchId?: number | { in: number[] } };
const bal = (rows: { code: string; balance: number }[], code: string) => rows.find((r) => r.code === code)?.balance ?? 0;

/* ============================================================== EXECUTIVE */
export async function executiveDashboard(scope: ActiveScope, opts: DashOpts, branches: Branch[]) {
  const { from, to } = opts.from && opts.to ? { from: opts.from, to: opts.to } : monthRange(opts.period);
  const asOf = await accountBalancesAsOf(scope, to);
  const period = await accountBalancesPeriod(scope, from, to);

  const cash = bal(asOf, ACC.CASH);
  const bank = bal(asOf, ACC.BANK);
  const receivable = Math.max(0, bal(asOf, ACC.RECEIVABLE));
  const payable = Math.max(0, bal(asOf, ACC.PAYABLE));
  const currentAssets = r2(asOf.filter((a) => a.type === "Asset" && !a.group.toLowerCase().includes("fixed")).reduce((s, a) => s + a.balance, 0));
  const currentLiabilities = r2(asOf.filter((a) => a.type === "Liability").reduce((s, a) => s + a.balance, 0));
  const monthlyRevenue = r2(period.filter((a) => a.type === "Income").reduce((s, a) => s + a.balance, 0));
  const monthlyExpense = r2(period.filter((a) => a.type === "Expense").reduce((s, a) => s + a.balance, 0));
  const directIncome = r2(period.filter((a) => a.type === "Income" && a.group.toLowerCase().startsWith("direct")).reduce((s, a) => s + a.balance, 0));
  const directExpense = r2(period.filter((a) => a.type === "Expense" && a.group.toLowerCase().startsWith("direct")).reduce((s, a) => s + a.balance, 0));
  const grossProfit = r2(directIncome - directExpense);
  const netProfit = r2(monthlyRevenue - monthlyExpense);
  const workingCapital = r2(currentAssets - currentLiabilities);

  const budget = await budgetSummary(scope, to);
  const cf = await cashFlow(scope, from, to);

  // revenue vs expense — 12-month trend
  const months = recentMonths(opts.period, 12);
  const trend = await Promise.all(months.map(async (mo) => {
    const mr = monthRange(mo); const p = await accountBalancesPeriod(scope, mr.from, mr.to);
    return { name: mLabel(mo), a: r2(p.filter((x) => x.type === "Income").reduce((s, x) => s + x.balance, 0)), b: r2(p.filter((x) => x.type === "Expense").reduce((s, x) => s + x.balance, 0)) };
  }));
  const forecast = r2(cf.closingBalance + (trend.slice(-3).reduce((s, t) => s + (t.a - t.b), 0) / 3));

  // profitability
  const profitMargin = monthlyRevenue > 0 ? r2((netProfit / monthlyRevenue) * 100) : 0;
  const interestExp = r2(period.filter((a) => a.name.toLowerCase().includes("interest")).reduce((s, a) => s + a.balance, 0));
  const ebitda = r2(netProfit + interestExp);
  const operatingMargin = monthlyRevenue > 0 ? r2((grossProfit / monthlyRevenue) * 100) : 0;

  // business performance + tops
  const [byBranch, byChannel, byCategory, topCustomers, topSuppliers, topExpense] = await Promise.all([
    revenueByBranch(scope, from, to, branches),
    revenueByChannel(scope, from, to),
    topCategories(scope, from, to),
    topParties("customer", scope, from, to),
    topParties("supplier", scope, from, to),
    topExpenseHeads(scope, from, to),
  ]);

  // health score
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 2;
  const factors = [
    { name: "Liquidity (current ratio)", score: Math.max(0, Math.min(100, Math.round((currentRatio / 2) * 100))) },
    { name: "Profitability (margin)", score: Math.max(0, Math.min(100, Math.round(profitMargin * 4))) },
    { name: "Budget discipline", score: Math.max(0, Math.min(100, Math.round(100 - Math.max(0, budget.utilization - 100)))) },
    { name: "Cash position", score: cash + bank > 0 ? 85 : 20 },
  ];
  const score = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length);
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Average" : "Poor";

  const insights = buildInsights({ cash: cash + bank, forecast, budget, receivable, netProfit, scope, period: opts.period });

  return {
    summary: { cashInHand: cash, bankBalance: bank, receivable, payable, workingCapital, monthlyRevenue, monthlyExpense, grossProfit, netProfit, budgetUtilization: budget.utilization, currentAssets, currentLiabilities },
    revenueExpenseTrend: trend,
    cashFlow: { opening: cf.openingBalance, receipts: cf.totalInflow, payments: cf.totalOutflow, closing: cf.closingBalance, forecast },
    profitability: { grossProfit, netProfit, profitMargin, ebitda, operatingMargin },
    budget,
    performance: { byBranch, byCategory, byChannel },
    tops: { customers: topCustomers, suppliers: topSuppliers, categories: byCategory, expenseHeads: topExpense },
    health: { score, label, factors },
    insights,
  };
}

/* ============================================================= OPERATIONS */
export async function operationsDashboard(scope: ActiveScope, opts: DashOpts) {
  const today = new Date().toISOString().slice(0, 10);
  const bw = bizWhere(scope);

  // Section 1 — Today's activities
  const [expT, rcptT, jrnT, saleT, purT] = await Promise.all([
    prisma.pettyCashVoucher.aggregate({ where: { ...bw, voucherDate: today, status: { not: "Cancelled" } }, _sum: { totalAmount: true }, _count: true }),
    prisma.receiptTransaction.aggregate({ where: { ...bw, voucherDate: today, status: { not: "Cancelled" } }, _sum: { amount: true }, _count: true }),
    prisma.journalEntry.count({ where: { ...bw, date: today, voucherType: "JOURNAL" } }),
    prisma.sale.aggregate({ where: { ...bw, saleDate: today, status: "Completed" }, _sum: { total: true }, _count: true }),
    prisma.purchaseInvoice.aggregate({ where: { ...bw, supplierInvoiceDate: today, status: "Posted" }, _sum: { netPayable: true }, _count: true }),
  ]);
  const today_ = {
    receipts: { count: rcptT._count, amount: num(rcptT._sum.amount) },
    expenseVouchers: { count: expT._count, amount: num(expT._sum.totalAmount) },
    journalVouchers: { count: jrnT, amount: 0 },
    salesCollection: { count: saleT._count, amount: num(saleT._sum.total) },
    purchasePayment: { count: purT._count, amount: num(purT._sum.netPayable) },
  };

  // Section 2 & 3 — AR / AP aging
  const ar = await arAging(scope, today);
  const ap = await apAging(scope, today);

  // Section 4 — Cash & bank
  const asOf = await accountBalancesAsOf(scope, today);
  const cfToday = await cashFlow(scope, today, today);
  const cashBank = { cash: bal(asOf, ACC.CASH), bank: bal(asOf, ACC.BANK), todayCollection: cfToday.totalInflow, todayPayment: cfToday.totalOutflow };

  // Section 5 — Recurring
  const recurring = await recurringSummary(scope, today);

  // Section 6 — Budget monitoring
  const budget = await budgetSummary(scope, today);

  // Section 7 — Approval center
  const approvals = await approvalCenter(scope);

  return { today: today_, ar, ap, cashBank, recurring, budget, approvals };
}

/* ============================================================= CONTROLLER */
export async function controllerDashboard(scope: ActiveScope, opts: DashOpts) {
  const period = opts.period;
  const bw = bizWhere(scope);
  const { from, to } = monthRange(period);
  const today = new Date().toISOString().slice(0, 10);

  // Section 1 — Statutory
  const [gst, tds, tcs] = await Promise.all([
    computeLiability(scope, "GST", period), computeLiability(scope, "TDS", period), computeLiability(scope, "TCS", period),
  ]);
  const statutory = {
    gst: { input: gst.gst?.itc ?? 0, output: gst.gst?.outputTax ?? 0, net: gst.liability, paymentDue: gst.balance, returnDue: statDueDate("GST", period) },
    tds: { deducted: tds.liability, paid: tds.alreadyPaid, pending: tds.balance, returnDue: statDueDate("TDS", period) },
    tcs: { collected: tcs.liability, paid: tcs.alreadyPaid, pending: tcs.balance, returnDue: statDueDate("TCS", period) },
  };

  // Section 2 — Government payments
  const payAgg = await prisma.statutoryPayment.groupBy({ by: ["statutoryType"], where: { ...bw, status: "Paid", taxPeriod: period }, _sum: { totalPayable: true } });
  const paidMap = new Map(payAgg.map((p) => [p.statutoryType, num(p._sum.totalPayable)]));
  const pendingChallans = await prisma.statutoryPayment.count({ where: { ...bw, status: "Paid", challanStatus: "Pending" } });
  const govPayments = {
    gstPaid: paidMap.get("GST") ?? 0, tdsPaid: paidMap.get("TDS") ?? 0, tcsPaid: paidMap.get("TCS") ?? 0, pendingChallans,
    upcoming: [
      { type: "GST", due: statutory.gst.returnDue, amount: statutory.gst.paymentDue },
      { type: "TDS", due: statutory.tds.returnDue, amount: statutory.tds.pending },
      { type: "TCS", due: statutory.tcs.returnDue, amount: statutory.tcs.pending },
    ].filter((u) => u.amount > 0.5),
  };

  // Section 3 — Reconciliation (real where data exists)
  const gstReconPending = await safeCount(() => prisma.gstReconciliation.count({ where: { ...bw, status: { in: ["Pending", "PartiallyMatched", "MissingInErp", "SupplierNotFiled", "Mismatch"] } } }));
  const reconciliation = [
    { name: "Bank Reconciliation", status: "Review", pending: 0 },
    { name: "GST Reconciliation", status: gstReconPending > 0 ? "Pending" : "Matched", pending: gstReconPending },
    { name: "Vendor Reconciliation", status: "Review", pending: await prisma.payable.count({ where: { ...bw, status: { not: "Paid" } } }) },
    { name: "Customer Reconciliation", status: "Review", pending: await prisma.sale.count({ where: { ...bw, status: "Completed", paymentStatus: { not: "Paid" } } }) },
    { name: "Ledger Reconciliation", status: "Review", pending: 0 },
  ];

  // Section 4 — Journal analysis
  const [posted, reversed, journalType, todayJournals] = await Promise.all([
    prisma.journalEntry.count({ where: { ...bw, status: "Posted" } }),
    prisma.journalEntry.count({ where: { ...bw, status: "Reversed" } }),
    prisma.journalEntry.count({ where: { ...bw, voucherType: "JOURNAL" } }),
    prisma.journalEntry.count({ where: { ...bw, voucherType: "JOURNAL", date: today } }),
  ]);
  const journals = { posted, reversed, adjustment: journalType, today: todayJournals };

  // Section 5 — Budget control
  const budget = await budgetSummary(scope, to);
  const [revPending, trfPending] = await Promise.all([
    safeCount(() => prisma.budgetRevision.count({ where: { ...bw, status: "Pending" } })),
    safeCount(() => prisma.budgetTransfer.count({ where: { ...bw, status: "Pending" } })),
  ]);
  const budgetControl = { utilization: budget.utilization, variance: r2(budget.budget - budget.actual), overBudget: budget.topOverBudget.length, transferPending: trfPending, revisionPending: revPending };

  // Section 6 & 7 — Cost / Profit centre analysis
  const costCentre = await costCentreAnalysis(scope, from, to);
  const profitCentre = await profitCentreAnalysis(scope, from, to);

  // Section 8 — Audit monitoring
  const audit = await auditMonitoring(scope, today);

  return { statutory, govPayments, reconciliation, journals, budgetControl, costCentre, profitCentre, audit };
}

/* ============================================================== HELPERS */
async function safeCount(fn: () => Promise<number>): Promise<number> { try { return await fn(); } catch { return 0; } }

async function budgetSummary(scope: ActiveScope, dateStr: string) {
  const fy = fyFromDate(dateStr);
  const bw = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  const headers = await prisma.budgetHeader.findMany({ where: { ...bw, fy, status: { in: ["Approved", "Active"] } }, select: { id: true, lines: { select: { headId: true, headName: true, annual: true, trackBudget: true } } } });
  const budgetByHead = new Map<number, { name: string; budget: number }>();
  for (const h of headers) for (const l of h.lines) { if (!l.trackBudget) continue; const cur = budgetByHead.get(l.headId) ?? { name: l.headName ?? `Head ${l.headId}`, budget: 0 }; cur.budget = r2(cur.budget + num(l.annual)); budgetByHead.set(l.headId, cur); }
  const usage = await computeUsage(prisma, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: scope.branchId } as never, fy).catch(() => ({ actual: {}, committed: {} }));
  let budget = 0, actual = 0, committed = 0;
  const overBudget: { name: string; budget: number; actual: number; pct: number }[] = [];
  for (const [headId, info] of budgetByHead) {
    const a = num((usage.actual as Record<number, number>)[headId]); const c = num((usage.committed as Record<number, number>)[headId]);
    budget += info.budget; actual += a; committed += c;
    if (info.budget > 0 && a > info.budget) overBudget.push({ name: info.name, budget: info.budget, actual: r2(a), pct: Math.round((a / info.budget) * 100) });
  }
  budget = r2(budget); actual = r2(actual); committed = r2(committed);
  return { budget, actual, committed, available: r2(budget - actual - committed), utilization: budget > 0 ? Math.round((actual / budget) * 100) : 0, topOverBudget: overBudget.sort((a, b) => b.pct - a.pct).slice(0, 5) };
}

async function arAging(scope: ActiveScope, today: string) {
  const rows = await prisma.sale.findMany({ where: { ...bizWhere(scope), status: "Completed", paymentStatus: { not: "Paid" } }, select: { customerName: true, total: true, amountPaid: true, dueDate: true, saleDate: true }, take: 5000 });
  const age: AgeableRow[] = rows.map((s) => { const balance = r2(num(s.total) - num(s.amountPaid)); const due = s.dueDate || s.saleDate; return { party: s.customerName || "Walk-in / Cash", billed: num(s.total), paid: num(s.amountPaid), balance, dueDate: due, overdue: !!due && due < today }; }).filter((r) => r.balance > 0.5);
  const { groups, aging } = groupByParty(age, today);
  const outstanding = r2(age.reduce((s, r) => s + r.balance, 0));
  const overdue = r2(age.filter((r) => r.overdue).reduce((s, r) => s + r.balance, 0));
  return { outstanding, overdue, collectionDue: r2(outstanding - overdue), aging, top: groups.slice(0, 6).map((g) => ({ name: g.party, value: g.balance })) };
}

async function apAging(scope: ActiveScope, today: string) {
  const rows = await prisma.payable.findMany({ where: { ...bizWhere(scope), status: { not: "Paid" } }, select: { supplier: true, totalAmount: true, paidAmount: true, balanceAmount: true, dueDate: true, docDate: true }, take: 5000 });
  const age: AgeableRow[] = rows.map((p) => { const due = p.dueDate || p.docDate; return { party: p.supplier || "—", billed: num(p.totalAmount), paid: num(p.paidAmount), balance: num(p.balanceAmount), dueDate: due, overdue: !!due && due < today }; }).filter((r) => r.balance > 0.5);
  const { groups, aging } = groupByParty(age, today);
  const outstanding = r2(age.reduce((s, r) => s + r.balance, 0));
  const overdue = r2(age.filter((r) => r.overdue).reduce((s, r) => s + r.balance, 0));
  return { outstanding, paymentDue: overdue, aging, top: groups.slice(0, 6).map((g) => ({ name: g.party, value: g.balance })) };
}

async function recurringSummary(scope: ActiveScope, today: string) {
  const bw = bizWhere(scope);
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const [todaySched, pendingManual, upcoming, failed, completed, pendingApproval] = await Promise.all([
    safeCount(() => prisma.recurringConfig.count({ where: { ...bw, status: "Active", nextExecution: today } })),
    safeCount(() => prisma.recurringConfig.count({ where: { ...bw, status: "Active", generationMode: "manual", nextExecution: { lte: today } } })),
    safeCount(() => prisma.recurringConfig.count({ where: { ...bw, status: "Active", nextExecution: { gt: today, lte: in7 } } })),
    safeCount(() => prisma.recurringExecution.count({ where: { ...bw, status: "Failed" } })),
    safeCount(() => prisma.recurringExecution.count({ where: { ...bw, status: "Posted" } })),
    safeCount(() => prisma.recurringExecution.count({ where: { ...bw, status: "PendingApproval" } })),
  ]);
  return { todaySchedule: todaySched, pendingManual, pendingApproval, upcoming, failed, completed };
}

async function approvalCenter(scope: ActiveScope) {
  const bw = bizWhere(scope);
  const [budgetRevision, budgetTransfer, govPayment, receipt, recurring, purchaseInvoice] = await Promise.all([
    safeCount(() => prisma.budgetRevision.count({ where: { ...bw, status: "Pending" } })),
    safeCount(() => prisma.budgetTransfer.count({ where: { ...bw, status: "Pending" } })),
    safeCount(() => prisma.statutoryPayment.count({ where: { ...bw, status: "Submitted" } })),
    safeCount(() => prisma.receiptTransaction.count({ where: { ...bw, status: "Submitted" } })),
    safeCount(() => prisma.recurringExecution.count({ where: { ...bw, status: "PendingApproval" } })),
    safeCount(() => prisma.purchaseInvoice.count({ where: { ...bw, status: "Pending Approval" } })),
  ]);
  const items = [
    { key: "budget-revision", label: "Budget Revision", count: budgetRevision, href: "/finance/budget/revision" },
    { key: "budget-transfer", label: "Budget Transfer", count: budgetTransfer, href: "/finance/budget/transfer" },
    { key: "gov-payment", label: "Government Payment", count: govPayment, href: "/finance/statutory-compliance" },
    { key: "receipt", label: "Receipt Voucher", count: receipt, href: "/finance/receipt" },
    { key: "recurring", label: "Recurring Execution", count: recurring, href: "/finance/recurring" },
    { key: "purchase", label: "Purchase Invoice", count: purchaseInvoice, href: "/purchase/invoice" },
  ];
  return { items, total: items.reduce((s, i) => s + i.count, 0) };
}

async function revenueByBranch(scope: ActiveScope, from: string, to: string, branches: Branch[]): Promise<NameVal[]> {
  const rows = await prisma.sale.groupBy({ by: ["branchId"], where: { ...bizWhere(scope), status: "Completed", saleDate: { gte: from, lte: to } }, _sum: { total: true } });
  const nameOf = (id: number | null) => branches.find((b) => b.id === id)?.name ?? (id ? `Branch ${id}` : "Head Office");
  return rows.map((r) => ({ name: nameOf(r.branchId), value: num(r._sum.total) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
}

async function revenueByChannel(scope: ActiveScope, from: string, to: string): Promise<NameVal[]> {
  const rows = await prisma.sale.groupBy({ by: ["channel"], where: { ...bizWhere(scope), status: "Completed", saleDate: { gte: from, lte: to } }, _sum: { total: true } });
  return rows.map((r) => ({ name: r.channel || "POS", value: num(r._sum.total) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
}

async function topCategories(scope: ActiveScope, from: string, to: string): Promise<NameVal[]> {
  const lines = await prisma.saleLine.findMany({ where: { sale: { ...bizWhere(scope), status: "Completed", saleDate: { gte: from, lte: to } } }, select: { value: true, product: { select: { category: true } } }, take: 5000 });
  const m = new Map<string, number>();
  for (const l of lines) { const c = l.product?.category || "Uncategorised"; m.set(c, r2((m.get(c) ?? 0) + num(l.value))); }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
}

async function topParties(kind: "customer" | "supplier", scope: ActiveScope, from: string, to: string): Promise<NameVal[]> {
  if (kind === "customer") {
    const rows = await prisma.sale.groupBy({ by: ["customerName"], where: { ...bizWhere(scope), status: "Completed", saleDate: { gte: from, lte: to } }, _sum: { total: true }, orderBy: { _sum: { total: "desc" } }, take: 6 });
    return rows.map((r) => ({ name: r.customerName || "Walk-in / Cash", value: num(r._sum.total) })).filter((x) => x.value > 0);
  }
  const rows = await prisma.purchaseInvoice.groupBy({ by: ["supplier"], where: { ...bizWhere(scope), status: "Posted", supplierInvoiceDate: { gte: from, lte: to } }, _sum: { netPayable: true }, orderBy: { _sum: { netPayable: "desc" } }, take: 6 });
  return rows.map((r) => ({ name: r.supplier || "—", value: num(r._sum.netPayable) })).filter((x) => x.value > 0);
}

async function topExpenseHeads(scope: ActiveScope, from: string, to: string): Promise<NameVal[]> {
  const rows = await prisma.pettyCashLine.groupBy({ by: ["headName"], where: { voucher: { ...bizWhere(scope), status: { not: "Cancelled" }, voucherDate: { gte: from, lte: to } } }, _sum: { amount: true }, orderBy: { _sum: { amount: "desc" } }, take: 6 });
  return rows.map((r) => ({ name: r.headName || "Uncategorised", value: num(r._sum.amount) })).filter((x) => x.value > 0);
}

async function dimensionExpense(scope: ActiveScope, dim: "costCenterId" | "profitCenterId", from: string, to: string, accountType: "Expense" | "Income") {
  const accts = await prisma.ledgerAccount.findMany({ where: { tenantId: scope.tenantId, type: accountType }, select: { id: true } });
  const ids = accts.map((a) => a.id); if (!ids.length) return new Map<number, number>();
  const lines = await prisma.journalLine.findMany({ where: { ...bizWhere(scope), accountId: { in: ids }, journal: { is: { status: "Posted", date: { gte: from, lte: to }, [dim]: { not: null } } } }, select: { debit: true, credit: true, journal: { select: { [dim]: true } as never } }, take: 20000 });
  const m = new Map<number, number>();
  for (const l of lines) { const id = (l.journal as Record<string, number | null>)[dim]; if (id == null) continue; const v = accountType === "Expense" ? num(l.debit) - num(l.credit) : num(l.credit) - num(l.debit); m.set(id, r2((m.get(id) ?? 0) + v)); }
  return m;
}

async function costCentreAnalysis(scope: ActiveScope, from: string, to: string) {
  const exp = await dimensionExpense(scope, "costCenterId", from, to, "Expense");
  const centres = await prisma.costCentre.findMany({ where: { tenantId: scope.tenantId, id: { in: [...exp.keys()] } }, select: { id: true, name: true, department: true } });
  const nameOf = (id: number) => centres.find((c) => c.id === id)?.name ?? `CC ${id}`;
  const rows = [...exp.entries()].map(([id, value]) => ({ name: nameOf(id), value: r2(value) })).filter((x) => x.value !== 0).sort((a, b) => b.value - a.value);
  const byDept = new Map<string, number>();
  for (const c of centres) { const e = exp.get(c.id) ?? 0; const d = c.department || "Unassigned"; byDept.set(d, r2((byDept.get(d) ?? 0) + e)); }
  return { total: r2(rows.reduce((s, r) => s + r.value, 0)), top: rows.slice(0, 8), byDepartment: [...byDept.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6) };
}

async function profitCentreAnalysis(scope: ActiveScope, from: string, to: string) {
  const [rev, exp] = await Promise.all([dimensionExpense(scope, "profitCenterId", from, to, "Income"), dimensionExpense(scope, "profitCenterId", from, to, "Expense")]);
  const ids = new Set([...rev.keys(), ...exp.keys()]);
  const centres = await prisma.profitCentre.findMany({ where: { tenantId: scope.tenantId, id: { in: [...ids] } }, select: { id: true, name: true } });
  const nameOf = (id: number) => centres.find((c) => c.id === id)?.name ?? `PC ${id}`;
  const rows = [...ids].map((id) => { const revenue = r2(rev.get(id) ?? 0); const expense = r2(exp.get(id) ?? 0); const profit = r2(revenue - expense); return { name: nameOf(id), revenue, expense, profit, margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0 }; }).sort((a, b) => b.profit - a.profit);
  return { rows, totals: { revenue: r2(rows.reduce((s, r) => s + r.revenue, 0)), expense: r2(rows.reduce((s, r) => s + r.expense, 0)), profit: r2(rows.reduce((s, r) => s + r.profit, 0)) } };
}

async function auditMonitoring(scope: ActiveScope, today: string) {
  const bw = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  const logs = await prisma.auditLog.findMany({ where: { ...bw, createdAt: { gte: new Date(today + "T00:00:00.000Z") } }, orderBy: { id: "desc" }, take: 400, select: { action: true, entity: true, summary: true, userName: true, createdAt: true } });
  const has = (a: string, ...k: string[]) => k.some((x) => a.toLowerCase().includes(x));
  const configChanges = logs.filter((l) => has(l.action, "config", "setting", "update")).length;
  const voucherChanges = logs.filter((l) => has(l.entity ?? "", "voucher", "journal", "payment", "receipt", "sale", "purchase")).length;
  const deleted = logs.filter((l) => has(l.action, "delete", "cancel", "void", "reverse")).length;
  const approvals = logs.filter((l) => has(l.action, "approve", "submit", "rbac")).length;
  return { todayCount: logs.length, configChanges, voucherChanges, deleted, approvals, recent: logs.slice(0, 12).map((l) => ({ action: l.action, entity: l.entity ?? "", summary: l.summary ?? "", user: l.userName ?? "—", at: l.createdAt.toISOString() })) };
}

function buildInsights(o: { cash: number; forecast: number; budget: { utilization: number; topOverBudget: { name: string; pct: number }[] }; receivable: number; netProfit: number; scope: ActiveScope; period: string }): string[] {
  const out: string[] = [];
  if (o.forecast < 0) out.push(`⚠️ Forecast cash flow may turn negative (projected ${Math.round(o.forecast).toLocaleString("en-IN")}). Review upcoming payments.`);
  if (o.budget.utilization >= 90) out.push(`📊 Budget utilization has reached ${o.budget.utilization}% — nearing the limit.`);
  for (const h of o.budget.topOverBudget.slice(0, 2)) out.push(`🚫 "${h.name}" is over budget at ${h.pct}% of allocation.`);
  if (o.receivable > 0) out.push(`💰 Receivables outstanding: ₹${Math.round(o.receivable).toLocaleString("en-IN")}. Follow up on overdue collections.`);
  if (o.netProfit < 0) out.push(`📉 Net result for the period is a loss of ₹${Math.round(-o.netProfit).toLocaleString("en-IN")}.`);
  else if (o.netProfit > 0) out.push(`📈 Period is profitable: net ₹${Math.round(o.netProfit).toLocaleString("en-IN")}.`);
  if (!out.length) out.push("All finance indicators are within normal range for the selected period.");
  return out;
}

/** Cost/profit-centre filter options for the global filter bar. */
export async function dashboardFilters(scope: ActiveScope) {
  const bw = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  const [cc, pc] = await Promise.all([
    prisma.costCentre.findMany({ where: { ...bw, status: "Active" }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.profitCentre.findMany({ where: { ...bw, status: "Active" }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  return { costCentres: cc, profitCentres: pc };
}
