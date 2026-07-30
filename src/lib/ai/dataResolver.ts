import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere } from "@/lib/auth/scope";
import { accountBalancesAsOf, accountBalancesPeriod, cashFlow } from "@/lib/accounting/reports";
import { ACC } from "@/lib/accounting/accounts";
import { computeLiability } from "@/lib/finance/statutory/engine";

/**
 * LIVE-DATA RESOLVER — turns a natural-language business question into a REAL figure
 * computed from the ERP (GL, sales, AR/AP, statutory). This is what lets the copilot
 * answer "last week sales" with an actual number even without a Claude API key. When a
 * key IS present, these facts are injected into the prompt so Claude answers grounded
 * in real data (never guessing).
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const bw = (s: ActiveScope) => scopeWhere(s, { branch: true }) as { tenantId: number; businessId?: number; branchId?: number | { in: number[] } };
const bal = (rows: { code: string; balance: number }[], code: string) => rows.find((r) => r.code === code)?.balance ?? 0;

export interface DataAnswer { text: string; facts: string; entity: string }

// -------------------------------------------------------------- period parsing
const iso = (d: Date) => d.toISOString().slice(0, 10);
function parsePeriod(q: string): { from: string; to: string; label: string } {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
  const monday = (d: Date) => { const wd = (d.getUTCDay() + 6) % 7; return day(d, -wd); }; // ISO week start
  const firstOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 1));
  const lastOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0));

  if (/\byesterday\b/.test(q)) { const y = day(today, -1); return { from: iso(y), to: iso(y), label: "yesterday" }; }
  if (/\btoday\b|\bday'?s?\b(?!.*week|.*month)/.test(q) && !/week|month|year|last/.test(q)) return { from: iso(today), to: iso(today), label: "today" };
  if (/\blast week\b|\bprevious week\b/.test(q)) { const thisMon = monday(today); const lastMon = day(thisMon, -7); const lastSun = day(thisMon, -1); return { from: iso(lastMon), to: iso(lastSun), label: "last week" }; }
  if (/\bthis week\b|\bweek\b/.test(q)) return { from: iso(monday(today)), to: iso(today), label: "this week" };
  if (/\blast month\b|\bprevious month\b/.test(q)) { const y = today.getUTCFullYear(), m = today.getUTCMonth(); const lm = m === 0 ? 11 : m - 1; const ly = m === 0 ? y - 1 : y; return { from: iso(firstOfMonth(ly, lm)), to: iso(lastOfMonth(ly, lm)), label: "last month" }; }
  if (/\bthis year\b|\byear\b/.test(q)) return { from: iso(new Date(Date.UTC(today.getUTCFullYear(), 0, 1))), to: iso(today), label: "this year" };
  if (/\bthis month\b|\bmonth\b|\bmtd\b/.test(q)) return { from: iso(firstOfMonth(today.getUTCFullYear(), today.getUTCMonth())), to: iso(today), label: "this month" };
  // default: this month to date
  return { from: iso(firstOfMonth(today.getUTCFullYear(), today.getUTCMonth())), to: iso(today), label: "this month" };
}
const currentPeriodYm = () => new Date().toISOString().slice(0, 7);

// ---------------------------------------------------------------- intent probes
export async function resolveData(scope: ActiveScope, message: string): Promise<DataAnswer | null> {
  const q = message.toLowerCase();
  const w = bw(scope);
  try {
    // ---- SALES (by period) + optional top customers
    if (/\bsales?\b|\brevenue\b|\bturnover\b|\bbilling\b/.test(q) && !/purchase|supplier/.test(q)) {
      const { from, to, label } = parsePeriod(q);
      const agg = await prisma.sale.aggregate({ where: { ...w, status: "Completed", saleDate: { gte: from, lte: to } }, _sum: { total: true, taxableValue: true }, _count: true });
      const total = num(agg._sum.total); const count = agg._count;
      let extra = "";
      if (/top\s+customer|best\s+customer|which customer/.test(q)) {
        const rows = await prisma.sale.groupBy({ by: ["customerName"], where: { ...w, status: "Completed", saleDate: { gte: from, lte: to } }, _sum: { total: true }, orderBy: { _sum: { total: "desc" } }, take: 5 });
        extra = "\nTop customers: " + rows.map((rr) => `${rr.customerName || "Walk-in"} ${inr(num(rr._sum.total))}`).join(", ");
      }
      const text = count === 0
        ? `There were no completed sales ${label} (${from}${from !== to ? ` to ${to}` : ""}).`
        : `Sales ${label} (${from}${from !== to ? ` to ${to}` : ""}): **${inr(total)}** across **${count}** ${count === 1 ? "invoice" : "invoices"} (average ${inr(count ? total / count : 0)}/bill).${extra}`;
      return { text, facts: `Sales ${label} [${from}..${to}]: total=${inr(total)}, orders=${count}`, entity: "Sales.period" };
    }

    // ---- PURCHASES
    if (/\bpurchase\b|\bbuying\b/.test(q) && !/return/.test(q)) {
      const { from, to, label } = parsePeriod(q);
      const agg = await prisma.purchaseInvoice.aggregate({ where: { ...w, status: "Posted", supplierInvoiceDate: { gte: from, lte: to } }, _sum: { netPayable: true }, _count: true });
      const total = num(agg._sum.netPayable);
      return { text: `Purchases ${label} (${from} to ${to}): **${inr(total)}** across **${agg._count}** invoices.`, facts: `Purchases ${label}: ${inr(total)}, ${agg._count} invoices`, entity: "Purchase.period" };
    }

    // ---- CASH / BANK balance
    if (/\bcash\b.*\bbalance\b|\bbank\b.*\bbalance\b|\bcash in hand\b|\bcash position\b|\bhow much cash\b/.test(q) || (/\bbalance\b/.test(q) && /\bcash\b|\bbank\b/.test(q))) {
      const asOf = await accountBalancesAsOf(scope);
      const cash = bal(asOf, ACC.CASH), bank = bal(asOf, ACC.BANK);
      return { text: `Current balances — Cash in hand: **${inr(cash)}**, Bank: **${inr(bank)}**. Total liquid: **${inr(cash + bank)}**.`, facts: `Cash=${inr(cash)}, Bank=${inr(bank)}, Total=${inr(cash + bank)}`, entity: "Finance.cashBank" };
    }

    // ---- RECEIVABLES
    if (/\breceivable\b|\bto collect\b|\bcustomer dues\b|\bdebtors\b|\boutstanding.*customer\b/.test(q)) {
      const rows = await prisma.sale.findMany({ where: { ...w, status: "Completed", paymentStatus: { not: "Paid" } }, select: { total: true, amountPaid: true, dueDate: true, saleDate: true }, take: 5000 });
      const today = iso(new Date());
      let outstanding = 0, overdue = 0;
      for (const s of rows) { const b = r2(num(s.total) - num(s.amountPaid)); if (b <= 0.5) continue; outstanding += b; if ((s.dueDate || s.saleDate) < today) overdue += b; }
      return { text: `Accounts Receivable — outstanding: **${inr(outstanding)}**, of which **${inr(overdue)}** is overdue.`, facts: `AR outstanding=${inr(outstanding)}, overdue=${inr(overdue)}`, entity: "Receivables.outstanding" };
    }

    // ---- PAYABLES
    if (/\bpayable\b|\bto pay\b|\bsupplier.*payment\b|\bvendor.*payment\b|\bcreditors\b|\boutstanding.*supplier\b/.test(q)) {
      const agg = await prisma.payable.aggregate({ where: { ...w, status: { not: "Paid" } }, _sum: { balanceAmount: true }, _count: true });
      return { text: `Accounts Payable — outstanding: **${inr(num(agg._sum.balanceAmount))}** across **${agg._count}** bills.`, facts: `AP outstanding=${inr(num(agg._sum.balanceAmount))}, bills=${agg._count}`, entity: "Payables.due" };
    }

    // ---- GST / TDS / TCS
    if (/\bgst\b/.test(q)) { const l = await computeLiability(scope, "GST", currentPeriodYm()); return { text: `GST for ${currentPeriodYm()} — Net liability **${inr(l.liability)}**, already paid ${inr(l.alreadyPaid)}, balance due **${inr(l.balance)}**.`, facts: `GST net=${inr(l.liability)}, due=${inr(l.balance)}`, entity: "GST.net" }; }
    if (/\btds\b/.test(q)) { const l = await computeLiability(scope, "TDS", currentPeriodYm()); return { text: `TDS for ${currentPeriodYm()} — deducted **${inr(l.liability)}**, pending **${inr(l.balance)}**.`, facts: `TDS=${inr(l.liability)}, pending=${inr(l.balance)}`, entity: "TDS.pending" }; }
    if (/\btcs\b/.test(q)) { const l = await computeLiability(scope, "TCS", currentPeriodYm()); return { text: `TCS for ${currentPeriodYm()} — collected **${inr(l.liability)}**, pending **${inr(l.balance)}**.`, facts: `TCS=${inr(l.liability)}, pending=${inr(l.balance)}`, entity: "TCS.pending" }; }

    // ---- NET PROFIT / P&L
    if (/\bnet profit\b|\bprofit\b|\bp&l\b|\bprofit and loss\b|\bprofitab/.test(q)) {
      const { from, to, label } = parsePeriod(q);
      const p = await accountBalancesPeriod(scope, from, to);
      const income = r2(p.filter((a) => a.type === "Income").reduce((s, a) => s + a.balance, 0));
      const expense = r2(p.filter((a) => a.type === "Expense").reduce((s, a) => s + a.balance, 0));
      const net = r2(income - expense);
      return { text: `For ${label} (${from} to ${to}) — Revenue **${inr(income)}**, Expense **${inr(expense)}**, Net ${net >= 0 ? "Profit" : "Loss"} **${inr(Math.abs(net))}**.`, facts: `Revenue=${inr(income)}, Expense=${inr(expense)}, Net=${inr(net)}`, entity: "PnL.netProfit" };
    }

    // ---- EXPENSES
    if (/\bexpenses?\b|\bspend(ing)?\b|\bspent\b|\bcosts?\b/.test(q)) {
      const { from, to, label } = parsePeriod(q);
      const p = await accountBalancesPeriod(scope, from, to);
      const expense = r2(p.filter((a) => a.type === "Expense").reduce((s, a) => s + a.balance, 0));
      return { text: `Total expenses ${label} (${from} to ${to}): **${inr(expense)}**.`, facts: `Expense ${label}=${inr(expense)}`, entity: "Finance.expense" };
    }

    // ---- WORKING CAPITAL
    if (/\bworking capital\b/.test(q)) {
      const asOf = await accountBalancesAsOf(scope);
      const ca = r2(asOf.filter((a) => a.type === "Asset" && !a.group.toLowerCase().includes("fixed")).reduce((s, a) => s + a.balance, 0));
      const cl = r2(asOf.filter((a) => a.type === "Liability").reduce((s, a) => s + a.balance, 0));
      return { text: `Working capital: **${inr(ca - cl)}** (current assets ${inr(ca)} − current liabilities ${inr(cl)}).`, facts: `WorkingCapital=${inr(ca - cl)}`, entity: "Finance.workingCapital" };
    }

    // ---- CASH FLOW
    if (/\bcash ?flow\b/.test(q)) {
      const { from, to, label } = parsePeriod(q);
      const cf = await cashFlow(scope, from, to);
      return { text: `Cash flow ${label} — opening ${inr(cf.openingBalance)}, receipts **${inr(cf.totalInflow)}**, payments **${inr(cf.totalOutflow)}**, closing **${inr(cf.closingBalance)}**.`, facts: `Cashflow ${label}: in=${inr(cf.totalInflow)}, out=${inr(cf.totalOutflow)}, closing=${inr(cf.closingBalance)}`, entity: "Finance.cashFlow" };
    }

    return null;
  } catch {
    return null;
  }
}
