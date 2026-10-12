import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { scopeWhere, type ActiveScope } from "@/lib/auth/scope";
import { ACC } from "@/lib/accounting/accounts";
import { accountBalancesAsOf, accountBalancesPeriod } from "@/lib/accounting/reports";
import { fyFromDate, computeUsage } from "@/lib/finance/budgetService";

/**
 * FINANCE DRILL-DOWN — the real breakup behind a Finance-dashboard widget, for the DetailModal.
 * Bank/Cash are GL account balances (single code each) so the meaningful split is BY BRANCH
 * (journal_entries.branchId). Per physical bank account isn't stored (no bank master).
 */
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export interface DrillCol { key: string; label: string; type?: "money" | "number" | "percent" | "text" | "date"; align?: "left" | "right" | "center" }
export interface DrillData { title: string; subtitle?: string; summary?: { label: string; value: string; tone?: string }[]; columns: DrillCol[]; rows: Record<string, string | number>[] }

export interface FinDrillOpts { period?: string; from?: string; to?: string }
function monthRange(o: FinDrillOpts): { from: string; to: string } {
  if (o.from && o.to) return { from: o.from, to: o.to };
  const period = o.period || new Date().toISOString().slice(0, 7);
  const [y, m] = period.split("-").map(Number);
  return { from: `${period}-01`, to: `${period}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}` };
}

async function branchMap(scope: ActiveScope): Promise<Map<number, string>> {
  const w: Prisma.BranchWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(scope.readBranchIds?.length ? { id: { in: scope.readBranchIds } } : {}) };
  const rows = await prisma.branch.findMany({ where: w, select: { id: true, name: true } });
  return new Map(rows.map((b) => [b.id, b.name]));
}

/** GL balance of one account code, split by the posting branch (as-of `to`). */
async function accountByBranch(scope: ActiveScope, code: string, to: string, title: string): Promise<DrillData> {
  const acct = await prisma.ledgerAccount.findFirst({ where: { tenantId: scope.tenantId, code }, select: { id: true } });
  if (!acct) return { title, columns: [{ key: "branch", label: "Branch", type: "text" }, { key: "balance", label: "Balance", type: "money", align: "right" }], rows: [] };
  const jw = scopeWhere(scope, { branch: true }) as Prisma.JournalEntryWhereInput;
  const lines = await prisma.journalLine.findMany({ where: { accountId: acct.id, journal: { is: { ...jw, date: { lte: to } } } }, select: { debit: true, credit: true, journal: { select: { branchId: true } } } });
  const map = new Map<number, number>();
  for (const l of lines) { const b = l.journal.branchId ?? 0; map.set(b, (map.get(b) ?? 0) + (num(l.debit) - num(l.credit))); }
  const bmap = await branchMap(scope);
  const rows = [...map.entries()].map(([bid, bal]) => ({ branch: bid ? bmap.get(bid) ?? `Branch ${bid}` : "Unassigned / Head Office", balance: r2(bal) })).filter((r) => Math.abs(r.balance) > 0.5).sort((a, b) => b.balance - a.balance);
  return { title: `${title} — Branch-wise`, subtitle: `As of ${to}`, summary: [{ label: "Total", value: inr(rows.reduce((s, r) => s + r.balance, 0)) }], columns: [{ key: "branch", label: "Branch", type: "text" }, { key: "balance", label: "Balance", type: "money", align: "right" }], rows };
}

/** As-of balances of every account of a given type (e.g. current assets / liabilities). */
async function accountsByType(scope: ActiveScope, to: string, pred: (a: { type: string; group: string }) => boolean, title: string): Promise<DrillData> {
  const asOf = await accountBalancesAsOf(scope, to);
  const rows = asOf.filter((a) => pred(a) && Math.abs(a.balance) > 0.5).map((a) => ({ account: `${a.code} · ${a.name}`, group: a.group || a.type, balance: r2(a.balance) })).sort((x, y) => y.balance - x.balance);
  return { title, subtitle: `As of ${to}`, summary: [{ label: "Total", value: inr(rows.reduce((s, r) => s + r.balance, 0)) }], columns: [{ key: "account", label: "Ledger Account", type: "text" }, { key: "group", label: "Group", type: "text" }, { key: "balance", label: "Balance", type: "money", align: "right" }], rows };
}

/** Period movement of every account of a given type (income / expense). */
async function accountsByTypePeriod(scope: ActiveScope, from: string, to: string, type: "Income" | "Expense", title: string): Promise<DrillData> {
  const rows0 = await accountBalancesPeriod(scope, from, to);
  const rows = rows0.filter((a) => a.type === type && Math.abs(a.balance) > 0.5).map((a) => ({ account: `${a.code} · ${a.name}`, amount: r2(Math.abs(a.balance)) })).sort((x, y) => y.amount - x.amount);
  return { title, subtitle: `${from} → ${to}`, summary: [{ label: "Total", value: inr(rows.reduce((s, r) => s + r.amount, 0)) }], columns: [{ key: "account", label: "Ledger Account", type: "text" }, { key: "amount", label: "Amount", type: "money", align: "right" }], rows };
}

/** Sales-based revenue/profit split by branch. */
async function salesByBranch(scope: ActiveScope, from: string, to: string, mode: "revenue" | "profit"): Promise<DrillData> {
  const sw = scopeWhere(scope, { branch: true }) as Prisma.SaleWhereInput;
  const [rows, bmap] = await Promise.all([
    prisma.sale.groupBy({ by: ["branchId"], where: { ...sw, status: "Completed", saleDate: { gte: from, lte: to } }, _sum: { total: true, cost: true }, _count: true, orderBy: { _sum: { total: "desc" } } }),
    branchMap(scope),
  ]);
  const out = rows.map((r) => ({ branch: r.branchId != null ? bmap.get(r.branchId) ?? `Branch ${r.branchId}` : "Unassigned", revenue: r2(num(r._sum.total)), profit: r2(num(r._sum.total) - num(r._sum.cost)), invoices: r._count }));
  const cols: DrillCol[] = mode === "profit"
    ? [{ key: "branch", label: "Branch", type: "text" }, { key: "revenue", label: "Revenue", type: "money", align: "right" }, { key: "profit", label: "Gross Profit", type: "money", align: "right" }]
    : [{ key: "branch", label: "Branch", type: "text" }, { key: "revenue", label: "Revenue", type: "money", align: "right" }, { key: "invoices", label: "Invoices", type: "number", align: "right" }];
  return { title: mode === "profit" ? "Profit — Branch-wise (sales)" : "Revenue — Branch-wise", subtitle: `${from} → ${to}`, summary: [{ label: mode === "profit" ? "Gross Profit" : "Revenue", value: inr(out.reduce((s, r) => s + (mode === "profit" ? r.profit : r.revenue), 0)) }], columns: cols, rows: out };
}

async function receivablesByParty(scope: ActiveScope): Promise<DrillData> {
  const sw = scopeWhere(scope, { branch: true }) as Prisma.SaleWhereInput;
  const rows = await prisma.sale.findMany({ where: { ...sw, status: "Completed" }, select: { customerName: true, total: true, amountPaid: true, dueDate: true, saleDate: true } });
  const today = new Date().toISOString().slice(0, 10);
  const map = new Map<string, { balance: number; overdue: number }>();
  for (const s of rows) { const bal = num(s.total) - num(s.amountPaid); if (bal <= 0.5) continue; const p = s.customerName || "Walk-in / Cash"; const due = s.dueDate || s.saleDate; const e = map.get(p) ?? { balance: 0, overdue: 0 }; e.balance += bal; if (due && due < today) e.overdue += bal; map.set(p, e); }
  const out = [...map.entries()].map(([party, v]) => ({ party, outstanding: r2(v.balance), overdue: r2(v.overdue) })).sort((a, b) => b.outstanding - a.outstanding).slice(0, 100);
  return { title: "Receivables — Party-wise", summary: [{ label: "Outstanding", value: inr(out.reduce((s, r) => s + r.outstanding, 0)), tone: "danger" }], columns: [{ key: "party", label: "Customer", type: "text" }, { key: "outstanding", label: "Outstanding", type: "money", align: "right" }, { key: "overdue", label: "Overdue", type: "money", align: "right" }], rows: out };
}

async function payablesBySupplier(scope: ActiveScope): Promise<DrillData> {
  const sw = scopeWhere(scope, { branch: true }) as Prisma.PayableWhereInput;
  const rows = await prisma.payable.groupBy({ by: ["supplier"], where: { ...sw, status: { in: ["Open", "Partial"] } }, _sum: { balanceAmount: true }, orderBy: { _sum: { balanceAmount: "desc" } } }).catch(() => [] as { supplier: string | null; _sum: { balanceAmount: number | null } }[]);
  const out = rows.map((r) => ({ supplier: r.supplier ?? "—", balance: r2(num(r._sum.balanceAmount)) })).filter((r) => r.balance > 0.5);
  return { title: "Payables — Supplier-wise", summary: [{ label: "Outstanding", value: inr(out.reduce((s, r) => s + r.balance, 0)), tone: "danger" }], columns: [{ key: "supplier", label: "Supplier", type: "text" }, { key: "balance", label: "Balance", type: "money", align: "right" }], rows: out };
}

async function budgetByHead(scope: ActiveScope, to: string): Promise<DrillData> {
  const fy = fyFromDate(to);
  const headers = await prisma.budgetHeader.findMany({ where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), fy, status: { in: ["Approved", "Active"] } }, select: { lines: { select: { headId: true, headName: true, annual: true, trackBudget: true } } } });
  const heads = new Map<number, { name: string; budget: number }>();
  for (const h of headers) for (const l of h.lines) { if (!l.trackBudget) continue; const e = heads.get(l.headId) ?? { name: l.headName ?? `Head ${l.headId}`, budget: 0 }; e.budget += num(l.annual); heads.set(l.headId, e); }
  const usage = await computeUsage(prisma, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: scope.branchId } as never, fy).catch(() => ({ actual: {} as Record<number, number> }));
  const out = [...heads.entries()].map(([id, h]) => { const a = num((usage.actual as Record<number, number>)[id]); return { head: h.name, budget: r2(h.budget), actual: r2(a), used: h.budget > 0 ? r2((a / h.budget) * 100) : 0 }; }).sort((x, y) => y.actual - x.actual);
  return { title: `Budget — Head-wise (${fy})`, columns: [{ key: "head", label: "Head", type: "text" }, { key: "budget", label: "Budget", type: "money", align: "right" }, { key: "actual", label: "Actual", type: "money", align: "right" }, { key: "used", label: "Used", type: "percent", align: "right" }], rows: out };
}

export async function drillFinance(scope: ActiveScope, opts: FinDrillOpts, widget: string): Promise<DrillData> {
  const { from, to } = monthRange(opts);
  switch (widget) {
    case "bankBalance": return accountByBranch(scope, ACC.BANK, to, "Bank Balance");
    case "cashInHand": return accountByBranch(scope, ACC.CASH, to, "Cash In Hand");
    case "currentAssets": return accountsByType(scope, to, (a) => a.type === "Asset" && !a.group.toLowerCase().includes("fixed"), "Current Assets — Account-wise");
    case "currentLiabilities": return accountsByType(scope, to, (a) => a.type === "Liability", "Current Liabilities — Account-wise");
    case "workingCapital": return accountsByType(scope, to, (a) => (a.type === "Asset" && !a.group.toLowerCase().includes("fixed")) || a.type === "Liability", "Working Capital — Components");
    case "revenue": return accountsByTypePeriod(scope, from, to, "Income", "Revenue — Account-wise");
    case "expense": return accountsByTypePeriod(scope, from, to, "Expense", "Expense — Account-wise");
    case "grossProfit": case "netProfit": return salesByBranch(scope, from, to, "profit");
    case "receivable": return receivablesByParty(scope);
    case "payable": return payablesBySupplier(scope);
    case "budget": return budgetByHead(scope, to);
    default: return { title: "Detail", columns: [], rows: [] };
  }
}
