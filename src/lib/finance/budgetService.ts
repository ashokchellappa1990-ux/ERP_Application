import type { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { MONTHS, QUARTERS, HALVES, monthLabel, rangeLabel, type MonthKey, type BudgetPeriod, type BudgetControl, type BudgetUsageDto } from "@/lib/contracts/budget";

/**
 * Budget Planning — accounting integration helpers.
 *
 * A budget never posts to the GL. These helpers derive utilisation by reading:
 *   • Actual    — the expense sub-ledger `PettyCashLine` (by head), because the GL
 *                 only knows accounts and several heads can map to one account.
 *   • Committed — open expense `Payable`s, pro-rated onto each head via the source
 *                 voucher's lines (approved-but-unpaid obligations / encumbrance).
 * `checkBudget` is the pre-post guard the expense voucher calls before postJournal.
 */

const num = (v: unknown) => (v == null ? 0 : Number(v));
type Db = Prisma.TransactionClient | typeof defaultPrisma;

/* ------------------------------------------------------------ FY calendar -- */

/** Financial-year label (Apr→Mar) for a YYYY-MM-DD date, e.g. 2026-05-10 → "FY 26-27". */
export function fyFromDate(dateStr: string): string {
  const d = new Date((dateStr || new Date().toISOString().slice(0, 10)) + "T00:00:00");
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // Jan-Mar belong to the prior FY start
  return `FY ${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

/** Start year of an "FY 26-27" label (→ 2026). Falls back to the current FY. */
export function fyStartYear(fy: string): number {
  const m = /(\d{2})\s*-\s*(\d{2})/.exec(fy || "");
  if (m) return 2000 + Number(m[1]);
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

/** ISO date window [start, end] covering the financial year. */
export function fyDateRange(fy: string): { start: string; end: string } {
  const sy = fyStartYear(fy);
  return { start: `${sy}-04-01`, end: `${sy + 1}-03-31` };
}

/** 0-based FY month index for a date (Apr=0 … Mar=11) → the m1..m12 bucket. */
export function fyMonthKey(dateStr: string): MonthKey {
  const d = new Date((dateStr || new Date().toISOString().slice(0, 10)) + "T00:00:00");
  const idx = (d.getMonth() - 3 + 12) % 12;
  return MONTHS[idx].key;
}

/** ISO window for one FY month bucket (m1 = Apr … m12 = Mar). */
export function fyMonthRange(fy: string, monthKey: MonthKey): { start: string; end: string } {
  const sy = fyStartYear(fy);
  const idx = MONTHS.findIndex((m) => m.key === monthKey); // 0..11 from April
  const calMonth = (3 + idx) % 12; // JS month 0-11
  const year = calMonth >= 3 ? sy : sy + 1;
  const first = new Date(Date.UTC(year, calMonth, 1));
  const last = new Date(Date.UTC(year, calMonth + 1, 0));
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
}

/** The budget bucket (date range + month keys + label) a date falls into for a
 *  given planning period. Budget/actual for control are summed over these months. */
export function periodWindow(fy: string, period: BudgetPeriod, dateStr: string): { start: string; end: string; months: MonthKey[]; label: string } {
  const mKey = fyMonthKey(dateStr);
  if (period === "yearly") { const r = fyDateRange(fy); return { start: r.start, end: r.end, months: MONTHS.map((m) => m.key), label: `Year · ${fy}` }; }
  if (period === "monthly") { const r = fyMonthRange(fy, mKey); return { start: r.start, end: r.end, months: [mKey], label: `${monthLabel(mKey)} ${fy}` }; }
  if (period === "halfyearly") {
    const hi = HALVES.findIndex((h) => (h.months as MonthKey[]).includes(mKey));
    const months = HALVES[hi].months as MonthKey[];
    return { start: fyMonthRange(fy, months[0]).start, end: fyMonthRange(fy, months[5]).end, months, label: `H${hi + 1} · ${rangeLabel(months)} ${fy}` };
  }
  const qi = QUARTERS.findIndex((q) => (q.months as MonthKey[]).includes(mKey));
  const months = QUARTERS[qi].months as MonthKey[];
  return { start: fyMonthRange(fy, months[0]).start, end: fyMonthRange(fy, months[2]).end, months, label: `Q${qi + 1} · ${rangeLabel(months)} ${fy}` };
}

/* --------------------------------------------------------- scope filters -- */

interface Scope { tenantId: number; businessId: number | null; branchId: number | null }

/** Line/voucher scope: branch plan → that branch; company plan → whole business. */
function scopeFilter(s: Scope): { tenantId: number; businessId?: number; branchId?: number } {
  const w: { tenantId: number; businessId?: number; branchId?: number } = { tenantId: s.tenantId };
  if (s.branchId != null) w.branchId = s.branchId;
  else if (s.businessId != null) w.businessId = s.businessId;
  return w;
}

/* -------------------------------------------------------------- Committed -- */

/** Open expense Payables pro-rated onto each head via the source voucher's lines. */
async function committedByHead(db: Db, s: Scope): Promise<Record<number, number>> {
  const pays = await db.payable.findMany({
    where: { ...scopeFilter(s), sourceType: "EXPENSE", status: { in: ["Open", "Partial"] } },
    select: { sourceId: true, balanceAmount: true },
  });
  const out: Record<number, number> = {};
  if (!pays.length) return out;
  const vIds = [...new Set(pays.map((p) => p.sourceId))];
  const lines = await db.pettyCashLine.findMany({
    where: { voucherId: { in: vIds }, headId: { not: null } },
    select: { voucherId: true, headId: true, amount: true },
  });
  // voucher → { total, byHead }
  const byV = new Map<number, { total: number; heads: Record<number, number> }>();
  for (const l of lines) {
    const g = byV.get(l.voucherId) ?? { total: 0, heads: {} };
    const amt = num(l.amount);
    g.total += amt;
    if (l.headId != null) g.heads[l.headId] = (g.heads[l.headId] ?? 0) + amt;
    byV.set(l.voucherId, g);
  }
  for (const p of pays) {
    const g = byV.get(p.sourceId);
    if (!g || g.total <= 0) continue;
    const bal = num(p.balanceAmount);
    for (const [hid, amt] of Object.entries(g.heads)) out[Number(hid)] = (out[Number(hid)] ?? 0) + bal * (amt / g.total);
  }
  return out;
}

/* ---------------------------------------------------------------- Actual -- */

/** Posted expense (from the sub-ledger) per head for a date window. Uses the gross
 *  line amount as the spend against budget; cancelled vouchers are excluded. */
async function actualByHead(db: Db, s: Scope, start: string, end: string): Promise<Record<number, number>> {
  const rows = await db.pettyCashLine.groupBy({
    by: ["headId"],
    where: { ...scopeFilter(s), headId: { not: null }, voucher: { voucherDate: { gte: start, lte: end }, status: { not: "Cancelled" } } },
    _sum: { amount: true },
  });
  const out: Record<number, number> = {};
  for (const r of rows) if (r.headId != null) out[r.headId] = num(r._sum.amount);
  return out;
}

/* ------------------------------------------------------- public compute ---- */

export interface Usage { actual: Record<number, number>; committed: Record<number, number> }

/** FY-wide Actual + Committed per head for a plan's scope — used by monitoring. */
export async function computeUsage(db: Db, s: Scope, fy: string): Promise<Usage> {
  const { start, end } = fyDateRange(fy);
  const [actual, committed] = await Promise.all([actualByHead(db, s, start, end), committedByHead(db, s)]);
  return { actual, committed };
}

/* ------------------------------------------------------------- the guard -- */

export type BudgetDecision =
  | { ok: true; warn?: false }
  | { ok: true; warn: true; message: string; head: string; budget: number; projected: number }
  | { ok: false; reason: "stop" | "approval"; message: string; head: string; budget: number; projected: number };

/* ------------------------------------------- revisions + transfers (deltas) -- */

/**
 * Net APPROVED revision + transfer delta per head — the adjustment added to the
 * ORIGINAL planned budget to get the effective/current budget. The original plan
 * (budget_lines) is never modified; current = original + Σ(this delta).
 *   +revision(increase) −revision(decrease) +transfer(to) −transfer(from)
 */
export async function headDeltas(db: Db, s: Scope, fy: string): Promise<Record<number, number>> {
  const [revs, trs] = await Promise.all([
    db.budgetRevision.findMany({ where: { ...scopeFilter(s), fy, status: "Approved" }, select: { headId: true, revisionType: true, amount: true } }),
    db.budgetTransfer.findMany({ where: { ...scopeFilter(s), fy, status: "Approved" }, select: { fromHeadId: true, toHeadId: true, amount: true } }),
  ]);
  const map: Record<number, number> = {};
  for (const r of revs) map[r.headId] = (map[r.headId] ?? 0) + (r.revisionType === "increase" ? num(r.amount) : -num(r.amount));
  for (const t of trs) { map[t.toHeadId] = (map[t.toHeadId] ?? 0) + num(t.amount); map[t.fromHeadId] = (map[t.fromHeadId] ?? 0) - num(t.amount); }
  return map;
}

export interface HeadSnapshot { original: number; current: number; committed: number; actual: number; available: number }
/** Original / Current / Committed / Actual / Available for one head under a plan —
 *  used by the Revision & Transfer add screens and their validations (annual level). */
export async function headSnapshot(db: Db, headerId: number, headId: number): Promise<HeadSnapshot | null> {
  const header = await db.budgetHeader.findFirst({ where: { id: headerId } });
  const line = await db.budgetLine.findFirst({ where: { headerId, headId } });
  if (!header || !line) return null;
  const scope: Scope = { tenantId: header.tenantId, businessId: header.businessId, branchId: header.branchId };
  const [usage, delta] = await Promise.all([computeUsage(db, scope, header.fy), headDeltas(db, scope, header.fy)]);
  const original = num(line.annual);
  const current = +(original + (delta[headId] ?? 0)).toFixed(2);
  const committed = +(usage.committed[headId] ?? 0).toFixed(2);
  const actual = +(usage.actual[headId] ?? 0).toFixed(2);
  return { original, current, committed, actual, available: +(current - committed - actual).toFixed(2) };
}

/** The ACTIVE plan governing a head's scope + FY (branch plan wins over company). */
async function activePlan(db: Db, tenantId: number, businessId: number | null, branchId: number | null, fy: string) {
  return db.budgetHeader.findFirst({
    where: {
      tenantId, fy, status: "Active",
      ...(businessId != null ? { businessId } : {}),
      OR: [{ branchId: branchId ?? undefined }, { branchId: null }],
    },
    orderBy: { branchId: "desc" },
  });
}

/**
 * Pre-post budget guard for an expense voucher line. Finds the ACTIVE plan for the
 * head's scope + the voucher's FY, resolves the bucket for the plan's PERIOD
 * (yearly/half-yearly/quarterly/monthly), computes available (budget − actual −
 * committed) and returns the configured action if the spend would exceed budget.
 * No plan / untracked head / allowExceed → always ok. Never writes to the GL.
 */
export async function checkBudget(
  db: Db,
  args: { tenantId: number; businessId: number | null; branchId: number | null; headId: number; dateStr: string; amount: number },
): Promise<BudgetDecision> {
  const fy = fyFromDate(args.dateStr);
  const header = await activePlan(db, args.tenantId, args.businessId, args.branchId, fy);
  if (!header) return { ok: true };

  const line = await db.budgetLine.findFirst({ where: { headerId: header.id, headId: args.headId } });
  if (!line || !line.trackBudget) return { ok: true };
  if (line.allowExceed) return { ok: true };

  const scope: Scope = { tenantId: args.tenantId, businessId: header.businessId, branchId: header.branchId };
  const period = (header.period as BudgetPeriod) ?? "quarterly";
  const win = periodWindow(fy, period, args.dateStr);
  // Effective budget = original bucket + approved revision/transfer delta, pro-rated to the window.
  const delta = (await headDeltas(db, scope, fy))[args.headId] ?? 0;
  const budget = +(win.months.reduce((s, k) => s + num((line as unknown as Record<string, unknown>)[k]), 0) + delta * (win.months.length / 12)).toFixed(2);

  const actualMap = await actualByHead(db, scope, win.start, win.end);
  const committedMap = period === "yearly" ? await committedByHead(db, scope) : {}; // committed is FY-level
  const actual = actualMap[args.headId] ?? 0;
  const committed = committedMap[args.headId] ?? 0;
  const projected = +(actual + committed + args.amount).toFixed(2);

  if (budget <= 0 || projected <= budget) return { ok: true };

  const head = line.headName || "expense head";
  const over = +(projected - budget).toFixed(2);
  const base = `Budget exceeded for "${head}" (${win.label}): budget ${budget.toFixed(2)}, projected ${projected.toFixed(2)}, over by ${over.toFixed(2)}.`;
  if (line.budgetControl === "stop") return { ok: false, reason: "stop", message: `${base} Posting is blocked by budget control.`, head, budget, projected };
  if (line.budgetControl === "approval") return { ok: false, reason: "approval", message: `${base} This requires budget approval before posting.`, head, budget, projected };
  return { ok: true, warn: true, message: base, head, budget, projected };
}

/**
 * Per-head budget snapshot for the CURRENT period — shown live on the expense
 * voucher when a head is picked (total budget / utilised / balance for the bucket).
 * Returns hasBudget:false when no active plan governs the head.
 */
export async function headUsage(
  db: Db,
  args: { tenantId: number; businessId: number | null; branchId: number | null; headId: number; headName?: string; dateStr: string },
): Promise<BudgetUsageDto> {
  const fy = fyFromDate(args.dateStr);
  const off: BudgetUsageDto = { headId: args.headId, headName: args.headName ?? "", hasBudget: false, period: "quarterly", periodLabel: "", budget: 0, utilized: 0, committed: 0, balance: 0, control: "warning", allowExceed: false };
  const header = await activePlan(db, args.tenantId, args.businessId, args.branchId, fy);
  if (!header) return off;
  const line = await db.budgetLine.findFirst({ where: { headerId: header.id, headId: args.headId } });
  if (!line || !line.trackBudget) return off;

  const scope: Scope = { tenantId: args.tenantId, businessId: header.businessId, branchId: header.branchId };
  const period = (header.period as BudgetPeriod) ?? "quarterly";
  const win = periodWindow(fy, period, args.dateStr);
  const delta = (await headDeltas(db, scope, fy))[args.headId] ?? 0;
  const budget = +(win.months.reduce((s, k) => s + num((line as unknown as Record<string, unknown>)[k]), 0) + delta * (win.months.length / 12)).toFixed(2);
  const actualMap = await actualByHead(db, scope, win.start, win.end);
  const committedMap = period === "yearly" ? await committedByHead(db, scope) : {};
  const utilized = +(actualMap[args.headId] ?? 0).toFixed(2);
  const committed = +(committedMap[args.headId] ?? 0).toFixed(2);
  return {
    headId: args.headId, headName: line.headName ?? args.headName ?? "", hasBudget: true,
    period, periodLabel: win.label, budget, utilized, committed, balance: +(budget - utilized - committed).toFixed(2),
    control: (line.budgetControl as BudgetControl) ?? "warning", allowExceed: line.allowExceed,
  };
}
