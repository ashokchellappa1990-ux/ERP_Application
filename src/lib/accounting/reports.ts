import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { scopeWhere, type ActiveScope } from "@/lib/auth/scope";
import { ensureAccounts, ACC } from "./accounts";

// Branch/business scope fragment for journal lines & entries (both carry the
// columns) so every report reflects the active branch filter.
const jlWhere = (s: ActiveScope) => scopeWhere(s, { branch: true }) as unknown as Prisma.JournalLineWhereInput;
const jeWhere = (s: ActiveScope) => scopeWhere(s, { branch: true }) as unknown as Prisma.JournalEntryWhereInput;

/**
 * Financial reports — all derived from the double-entry ledger (journal_entries /
 * journal_lines / ledger_accounts). Reversed entries are intentionally included
 * because their reversing voucher nets them to zero (correct treatment).
 */
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

export interface AcctBal {
  id: number; code: string; name: string; type: string; group: string; normalBalance: string;
  debit: number; credit: number; balance: number;
}

/** Per-account debit/credit totals + signed balance, optionally filtered by a
 * journal-date predicate (cumulative "as of" → { lte }, period → { gte, lte }). */
async function balances(scope: ActiveScope, dateWhere?: Prisma.StringFilter): Promise<AcctBal[]> {
  const accounts = await prisma.ledgerAccount.findMany({ where: { tenantId: scope.tenantId }, orderBy: { code: "asc" } });
  const lineWhere: Prisma.JournalLineWhereInput = { ...jlWhere(scope) };
  if (dateWhere) lineWhere.journal = { is: { date: dateWhere } };
  const sums = await prisma.journalLine.groupBy({ by: ["accountId"], where: lineWhere, _sum: { debit: true, credit: true } });
  const map = new Map(sums.map((s) => [s.accountId, { d: num(s._sum.debit), c: num(s._sum.credit) }]));
  return accounts.map((a) => {
    const s = map.get(a.id) ?? { d: 0, c: 0 };
    const balance = a.normalBalance === "Debit" ? s.d - s.c : s.c - s.d;
    return { id: a.id, code: a.code, name: a.name, type: a.type, group: a.group ?? "", normalBalance: a.normalBalance, debit: r2(s.d), credit: r2(s.c), balance: r2(balance) };
  });
}

const sum = (arr: number[]) => r2(arr.reduce((a, b) => a + b, 0));
const dateFilter = (from?: string, to?: string): Prisma.StringFilter | undefined =>
  from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

export async function ensureSeeded(tenantId: number) {
  await prisma.$transaction((tx) => ensureAccounts(tx, tenantId));
}

/** Per-account signed balances as of a date (cumulative) — for dashboard KPIs. */
export async function accountBalancesAsOf(scope: ActiveScope, to?: string): Promise<AcctBal[]> {
  return balances(scope, to ? { lte: to } : undefined);
}
/** Per-account signed movement within a period — for revenue/expense KPIs. */
export async function accountBalancesPeriod(scope: ActiveScope, from?: string, to?: string): Promise<AcctBal[]> {
  return balances(scope, dateFilter(from, to));
}

/* ----------------------------------------------------------------- TRIAL BAL */
export async function trialBalance(scope: ActiveScope, to?: string) {
  const rows = (await balances(scope, to ? { lte: to } : undefined))
    .map((a) => {
      const drBal = a.normalBalance === "Debit" ? Math.max(0, a.balance) : Math.max(0, -a.balance);
      const crBal = a.normalBalance === "Credit" ? Math.max(0, a.balance) : Math.max(0, -a.balance);
      return { code: a.code, name: a.name, type: a.type, group: a.group, debit: r2(drBal), credit: r2(crBal) };
    });
  return { rows, totals: { debit: sum(rows.map((r) => r.debit)), credit: sum(rows.map((r) => r.credit)) } };
}

/* ---------------------------------------------------------- TRADING & P / L */
function plParts(rowsPeriod: AcctBal[]) {
  const income = rowsPeriod.filter((a) => a.type === "Income");
  const expense = rowsPeriod.filter((a) => a.type === "Expense");
  const isDirect = (a: AcctBal) => a.group.toLowerCase().startsWith("direct");
  const directIncome = income.filter(isDirect);
  const directExpense = expense.filter(isDirect);
  const indirectIncome = income.filter((a) => !isDirect(a));
  const indirectExpense = expense.filter((a) => !isDirect(a));
  const grossProfit = r2(sum(directIncome.map((a) => a.balance)) - sum(directExpense.map((a) => a.balance)));
  const netProfit = r2(grossProfit + sum(indirectIncome.map((a) => a.balance)) - sum(indirectExpense.map((a) => a.balance)));
  return { income, expense, directIncome, directExpense, indirectIncome, indirectExpense, grossProfit, netProfit };
}
const line = (a: AcctBal) => ({ code: a.code, name: a.name, amount: a.balance });

export async function tradingAccount(scope: ActiveScope, from?: string, to?: string) {
  const p = plParts(await balances(scope, dateFilter(from, to)));
  return {
    revenue: p.directIncome.map(line), revenueTotal: sum(p.directIncome.map((a) => a.balance)),
    costs: p.directExpense.map(line), costsTotal: sum(p.directExpense.map((a) => a.balance)),
    grossProfit: p.grossProfit,
  };
}

export async function profitAndLoss(scope: ActiveScope, from?: string, to?: string) {
  const p = plParts(await balances(scope, dateFilter(from, to)));
  return {
    directIncome: p.directIncome.map(line), directExpense: p.directExpense.map(line),
    grossProfit: p.grossProfit,
    indirectIncome: p.indirectIncome.map(line), indirectIncomeTotal: sum(p.indirectIncome.map((a) => a.balance)),
    indirectExpense: p.indirectExpense.map(line), indirectExpenseTotal: sum(p.indirectExpense.map((a) => a.balance)),
    netProfit: p.netProfit,
  };
}

/* ------------------------------------------------------------- BALANCE SHEET */
export async function balanceSheet(scope: ActiveScope, to?: string) {
  const rows = await balances(scope, to ? { lte: to } : undefined);
  const assets = rows.filter((a) => a.type === "Asset" && a.balance !== 0).map(line);
  const liabilities = rows.filter((a) => a.type === "Liability" && a.balance !== 0).map(line);
  const equity = rows.filter((a) => a.type === "Equity" && a.balance !== 0).map(line);
  // Net profit (cumulative income − expense up to `to`) → retained earnings.
  const netProfit = r2(sum(rows.filter((a) => a.type === "Income").map((a) => a.balance)) - sum(rows.filter((a) => a.type === "Expense").map((a) => a.balance)));
  const assetsTotal = sum(assets.map((a) => a.amount));
  const liabTotal = sum(liabilities.map((a) => a.amount));
  const equityTotal = r2(sum(equity.map((a) => a.amount)) + netProfit);
  return { assets, assetsTotal, liabilities, equity, netProfit, liabilitiesTotal: liabTotal, equityTotal, liabAndEquityTotal: r2(liabTotal + equityTotal), balanced: Math.abs(assetsTotal - (liabTotal + equityTotal)) < 0.05 };
}

/* ---------------------------------------------------------------- CASH FLOW */
const TYPE_LABEL: Record<string, string> = { SALES: "Sales receipts", RECEIPT: "Customer collections", PAYMENT: "Supplier payments", PURCHASE: "Purchases (cash)", JOURNAL: "Journal / adjustments" };

export async function cashFlow(scope: ActiveScope, from?: string, to?: string) {
  const cashIds = await prisma.ledgerAccount.findMany({ where: { tenantId: scope.tenantId, code: { in: [ACC.CASH, ACC.BANK] } }, select: { id: true } });
  const ids = cashIds.map((a) => a.id);
  if (!ids.length) return { openingBalance: 0, rows: [], totalInflow: 0, totalOutflow: 0, netChange: 0, closingBalance: 0 };

  // Opening = cash+bank movement strictly before `from`.
  let opening = 0;
  if (from) {
    const o = await prisma.journalLine.aggregate({ where: { ...jlWhere(scope), accountId: { in: ids }, journal: { is: { date: { lt: from } } } }, _sum: { debit: true, credit: true } });
    opening = r2(num(o._sum.debit) - num(o._sum.credit));
  }
  // Period movements grouped by voucher type.
  const lines = await prisma.journalLine.findMany({
    where: { ...jlWhere(scope), accountId: { in: ids }, ...(from || to ? { journal: { is: { date: dateFilter(from, to) } } } : {}) },
    include: { journal: { select: { voucherType: true } } },
  });
  const byType = new Map<string, { inflow: number; outflow: number }>();
  for (const l of lines) {
    const t = l.journal.voucherType;
    const e = byType.get(t) ?? { inflow: 0, outflow: 0 };
    e.inflow += num(l.debit); e.outflow += num(l.credit);
    byType.set(t, e);
  }
  const rows = [...byType.entries()].map(([t, v]) => ({ activity: t, label: TYPE_LABEL[t] ?? t, inflow: r2(v.inflow), outflow: r2(v.outflow), net: r2(v.inflow - v.outflow) }));
  const totalInflow = sum(rows.map((r) => r.inflow));
  const totalOutflow = sum(rows.map((r) => r.outflow));
  const netChange = r2(totalInflow - totalOutflow);
  return { openingBalance: opening, rows, totalInflow, totalOutflow, netChange, closingBalance: r2(opening + netChange) };
}

/* ---------------------------------------------------------------- FUND FLOW */
export async function fundFlow(scope: ActiveScope, from?: string, to?: string) {
  const move = await balances(scope, dateFilter(from, to)); // period movement per account
  const netProfit = r2(sum(move.filter((a) => a.type === "Income").map((a) => a.balance)) - sum(move.filter((a) => a.type === "Expense").map((a) => a.balance)));
  const nonCashAsset = (a: AcctBal) => a.type === "Asset" && a.code !== ACC.CASH && a.code !== ACC.BANK;

  const sources: { label: string; amount: number }[] = [];
  const applications: { label: string; amount: number }[] = [];
  if (netProfit > 0) sources.push({ label: "Funds from operations (net profit)", amount: netProfit });
  else if (netProfit < 0) applications.push({ label: "Loss from operations", amount: r2(-netProfit) });

  for (const a of move) {
    if (a.balance === 0) continue;
    if (a.type === "Liability" || a.type === "Equity") {
      if (a.balance > 0) sources.push({ label: `Increase in ${a.name}`, amount: a.balance });
      else applications.push({ label: `Decrease in ${a.name}`, amount: r2(-a.balance) });
    } else if (nonCashAsset(a)) {
      if (a.balance > 0) applications.push({ label: `Increase in ${a.name}`, amount: a.balance });
      else sources.push({ label: `Decrease in ${a.name}`, amount: r2(-a.balance) });
    }
  }
  const sourcesTotal = sum(sources.map((s) => s.amount));
  const applicationsTotal = sum(applications.map((s) => s.amount));
  return { sources, sourcesTotal, applications, applicationsTotal, netChangeInFunds: r2(sourcesTotal - applicationsTotal) };
}

/* ----------------------------------------------------------------- DAY BOOK */
export async function dayBook(scope: ActiveScope, from?: string, to?: string) {
  const entries = await prisma.journalEntry.findMany({
    where: { ...jeWhere(scope), ...(from || to ? { date: dateFilter(from, to) } : {}) },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    include: { lines: { include: { account: { select: { code: true, name: true } } } } },
    take: 1000,
  });
  const rows = entries.map((e) => ({
    date: e.date, voucherNo: e.voucherNo, voucherType: e.voucherType, narration: e.narration ?? "", refNo: e.refNo ?? "", status: e.status,
    debit: num(e.totalDebit), credit: num(e.totalCredit),
    lines: e.lines.map((l) => ({ code: l.account.code, account: l.account.name, debit: num(l.debit), credit: num(l.credit) })),
  }));
  return { rows, totals: { debit: sum(rows.map((r) => r.debit)), credit: sum(rows.map((r) => r.credit)) } };
}

/* ------------------------------------------------- CASH / BANK / GL LEDGER */
export async function accountLedger(scope: ActiveScope, code: string, from?: string, to?: string) {
  const acct = await prisma.ledgerAccount.findUnique({ where: { tenantId_code: { tenantId: scope.tenantId, code } } });
  if (!acct) return null;
  // Opening before `from`.
  let opening = 0;
  if (from) {
    const o = await prisma.journalLine.aggregate({ where: { ...jlWhere(scope), accountId: acct.id, journal: { is: { date: { lt: from } } } }, _sum: { debit: true, credit: true } });
    opening = acct.normalBalance === "Debit" ? r2(num(o._sum.debit) - num(o._sum.credit)) : r2(num(o._sum.credit) - num(o._sum.debit));
  }
  const lines = await prisma.journalLine.findMany({
    where: { ...jlWhere(scope), accountId: acct.id, ...(from || to ? { journal: { is: { date: dateFilter(from, to) } } } : {}) },
    include: { journal: { select: { voucherNo: true, voucherType: true, date: true, narration: true, refNo: true } } },
    orderBy: { id: "asc" },
  });
  const sign = acct.normalBalance === "Debit" ? 1 : -1;
  let running = opening;
  const rows = lines.map((l) => {
    running = r2(running + sign * (num(l.debit) - num(l.credit)));
    return { date: l.journal.date, voucherNo: l.journal.voucherNo, voucherType: l.journal.voucherType, narration: l.narration || l.journal.narration || "", refNo: l.journal.refNo ?? "", debit: num(l.debit), credit: num(l.credit), balance: running };
  });
  return {
    account: { code: acct.code, name: acct.name, type: acct.type, normalBalance: acct.normalBalance },
    openingBalance: opening, rows,
    totals: { debit: sum(rows.map((r) => r.debit)), credit: sum(rows.map((r) => r.credit)), closing: running },
  };
}
