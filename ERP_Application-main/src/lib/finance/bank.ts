import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope, AllowedScope } from "@/lib/auth/scope";

/**
 * Bank ledger + reconciliation. The bank master is the existing `setup_banks` (branch-mapped).
 * Every NON-CASH payment/receipt writes a `bank_transactions` row. Instruments that don't settle
 * instantly (cheque, bank transfer, NEFT/RTGS, ECS, DD, card) start as **pending** ("not cleared")
 * and are cleared with a clearing date + status (Credited | Bounced | Cancelled); UPI/IMPS/wallet
 * are auto-credited. The bank BALANCE is driven by the CLEARING date — GL stays on one Cash-at-Bank
 * account (no per-bank GL codes).
 */

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const isNonCash = (mode?: string | null) => !!mode && !mode.toLowerCase().includes("cash");
/** Instant-settlement modes → auto-credited; everything else non-cash needs clearing. */
export const isInstant = (mode?: string | null) => !!mode && /upi|imps|wallet/i.test(mode);
function initialClearing(mode: string | null | undefined, date: string): { clearingStatus: string; clearingDate: string | null } {
  return isInstant(mode) ? { clearingStatus: "credited", clearingDate: date } : { clearingStatus: "pending", clearingDate: null };
}

export interface BankRef { id: number; bankName: string; account: string; ifsc: string | null; branchId: number | null; label: string; openingBalance: number }

/** Bank accounts visible for payments/receipts: company-level (HO) banks PLUS the user's branch. */
export async function listBanksForScope(scope: ActiveScope, _allowed: AllowedScope): Promise<BankRef[]> {
  const branchOr = [{ branchId: null }, ...(scope.readBranchIds?.length ? [{ branchId: { in: scope.readBranchIds } }] : [])];
  const rows = await prisma.setupBank.findMany({
    where: { setup: { tenantId: scope.tenantId }, ...(scope.businessId ? { businessId: scope.businessId } : {}), OR: branchOr },
    orderBy: { id: "asc" }, select: { id: true, bankName: true, branch: true, account: true, ifsc: true, branchId: true, openingBalance: true },
  });
  return rows.map((b) => ({ id: b.id, bankName: b.bankName ?? "Bank", account: b.account ?? "", ifsc: b.ifsc ?? null, branchId: b.branchId, openingBalance: num(b.openingBalance), label: `${b.bankName ?? "Bank"}${b.account ? ` · ${b.account}` : ""}` }));
}

/* ------------------------------------------------------------- movements */
export interface BankCtx { tenantId: number; businessId: number | null; branchId: number | null; userId?: number | null; userName?: string | null }
export interface BankMovementInput {
  bankId?: number | null; bankName?: string | null; bankAccount?: string | null;
  date: string; direction: "in" | "out"; amount: number; mode?: string | null; reference?: string | null;
  sourceType: string; sourceId?: number | null; sourceNo?: string | null; partyName?: string | null; journalId?: number | null; narration?: string | null;
}
type Db = Prisma.TransactionClient | typeof prisma;

/** Record one bank movement — no-op for cash / missing bank / zero amount (safe to always call). */
export async function recordBankMovement(db: Db, ctx: BankCtx, input: BankMovementInput): Promise<number | null> {
  if (!input.bankId || !isNonCash(input.mode) || !input.amount) return null;
  const clr = initialClearing(input.mode, input.date);
  const row = await db.bankTransaction.create({
    data: {
      tenantId: ctx.tenantId, businessId: ctx.businessId ?? null, branchId: ctx.branchId ?? null,
      bankId: input.bankId, bankName: input.bankName ?? null, bankAccount: input.bankAccount ?? null,
      date: input.date, direction: input.direction, amount: r2(input.amount), mode: input.mode ?? null, reference: input.reference ?? null,
      sourceType: input.sourceType, sourceId: input.sourceId ?? null, sourceNo: input.sourceNo ?? null, partyName: input.partyName ?? null,
      journalId: input.journalId ?? null, narration: input.narration ?? null,
      clearingStatus: clr.clearingStatus, clearingDate: clr.clearingDate,
    },
    select: { id: true },
  });
  return row.id;
}

export async function reverseBankMovement(db: Db, tenantId: number, sourceType: string, sourceId: number): Promise<number> {
  const { count } = await db.bankTransaction.deleteMany({ where: { tenantId, sourceType, sourceId } });
  return count;
}

/* --------------------------------------------------------- balance / book */
function scopeWhere(scope: ActiveScope): Prisma.BankTransactionWhereInput {
  return { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(scope.readBranchIds?.length ? { OR: [{ branchId: null }, { branchId: { in: scope.readBranchIds } }] } : {}) };
}

const lastDay = (period: string) => { const [y, m] = period.split("-").map(Number); return `${period}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`; };

/** Per-bank opening balance from the Account Opening Balance screen (`opening_balances`, kind=BANK).
 *  Matches by bankId; falls back to bank name (setup_banks ids can change on re-setup); picks the
 *  branch-specific row for the bank's branch, else the company-level row — never sums across scopes. */
async function accountOpenings(scope: ActiveScope, banks: BankRef[]): Promise<Map<number, number>> {
  const rows = await prisma.openingBalance.findMany({
    where: { tenantId: scope.tenantId, kind: "BANK", ...(scope.readBranchIds?.length ? { OR: [{ branchId: null }, { branchId: { in: scope.readBranchIds } }] } : {}) },
    select: { bankId: true, bankName: true, amount: true, branchId: true },
  });
  const out = new Map<number, number>();
  for (const b of banks) {
    const matches = rows.filter((r) => (r.bankId != null && r.bankId === b.id) || (!!r.bankName && r.bankName.toLowerCase() === b.bankName.toLowerCase()));
    const pick = matches.find((r) => r.branchId === b.branchId) ?? matches.find((r) => r.branchId == null) ?? matches[0];
    out.set(b.id, r2(num(pick?.amount) || b.openingBalance));
  }
  return out;
}

export interface BankBalanceRow { bankId: number; bankName: string; account: string; opening: number; credit: number; debit: number; closing: number; unclearedIn: number; unclearedOut: number; bookBalance: number; pendingCount: number }
/** Per-account monthly cash-book: opening (as of month start) · credit (cleared receipts in month) ·
 *  debit (cleared payments in month) · closing · uncleared (pending) — all by clearing date. */
export async function bankBalances(scope: ActiveScope, allowed: AllowedScope, period?: string): Promise<BankBalanceRow[]> {
  const banks = await listBanksForScope(scope, allowed);
  const openings = await accountOpenings(scope, banks);
  const p = period || new Date().toISOString().slice(0, 7);
  const from = `${p}-01`, to = lastDay(p);
  const base = scopeWhere(scope);
  const [prior, month, pending, pendCnt] = await Promise.all([
    prisma.bankTransaction.groupBy({ by: ["bankId", "direction"], where: { ...base, clearingStatus: "credited", clearingDate: { lt: from } }, _sum: { amount: true } }),
    prisma.bankTransaction.groupBy({ by: ["bankId", "direction"], where: { ...base, clearingStatus: "credited", clearingDate: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.bankTransaction.groupBy({ by: ["bankId", "direction"], where: { ...base, clearingStatus: "pending" }, _sum: { amount: true } }),
    prisma.bankTransaction.groupBy({ by: ["bankId"], where: { ...base, clearingStatus: "pending" }, _count: true }),
  ]);
  const g = (rows: typeof prior, id: number, dir: string) => num(rows.find((r) => r.bankId === id && r.direction === dir)?._sum.amount);
  const pc = new Map(pendCnt.map((r) => [r.bankId, r._count]));
  return banks.map((b) => {
    const ob = num(openings.get(b.id));
    const opening = r2(ob + g(prior, b.id, "in") - g(prior, b.id, "out"));
    const credit = r2(g(month, b.id, "in")), debit = r2(g(month, b.id, "out"));
    const closing = r2(opening + credit - debit);
    const pi = r2(g(pending, b.id, "in")), po = r2(g(pending, b.id, "out"));
    return { bankId: b.id, bankName: b.bankName, account: b.account, opening, credit, debit, closing, unclearedIn: pi, unclearedOut: po, bookBalance: r2(closing + pi - po), pendingCount: num(pc.get(b.id)) };
  });
}

export interface BankBookRow { id: number; date: string; direction: string; amount: number; mode: string | null; reference: string | null; sourceType: string; sourceNo: string | null; partyName: string | null; narration: string | null; clearingStatus: string; clearingDate: string | null; running: number }
export interface BankBook { opening: number; clearedBalance: number; unclearedIn: number; unclearedOut: number; bookBalance: number; rows: BankBookRow[] }
export async function bankBook(scope: ActiveScope, bankId: number, opts: { direction?: "in" | "out"; from?: string; to?: string }): Promise<BankBook> {
  const bank = await prisma.setupBank.findFirst({ where: { id: bankId, setup: { tenantId: scope.tenantId } }, select: { id: true, bankName: true, branch: true, account: true, ifsc: true, branchId: true, openingBalance: true } });
  const bankRef: BankRef = bank ? { id: bank.id, bankName: bank.bankName ?? "Bank", account: bank.account ?? "", ifsc: bank.ifsc, branchId: bank.branchId, openingBalance: num(bank.openingBalance), label: "" } : { id: bankId, bankName: "", account: "", ifsc: null, branchId: null, openingBalance: 0, label: "" };
  const opening = num((await accountOpenings(scope, [bankRef])).get(bankId));
  const base: Prisma.BankTransactionWhereInput = { ...scopeWhere(scope), bankId };
  // opening carry = credited movements strictly before the window (by clearing date)
  let openingCarry = opening;
  if (opts.from) { const prior = await prisma.bankTransaction.groupBy({ by: ["direction"], where: { ...base, clearingStatus: "credited", clearingDate: { lt: opts.from } }, _sum: { amount: true } }); for (const p of prior) openingCarry += (p.direction === "in" ? 1 : -1) * num(p._sum.amount); }

  const where: Prisma.BankTransactionWhereInput = { ...base, ...(opts.direction ? { direction: opts.direction } : {}), ...(opts.from || opts.to ? { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}) };
  const rows = await prisma.bankTransaction.findMany({ where, orderBy: [{ date: "asc" }, { id: "asc" }], take: 1000 });
  let running = r2(openingCarry);
  const out: BankBookRow[] = rows.map((m) => {
    if (m.clearingStatus === "credited") running = r2(running + (m.direction === "in" ? 1 : -1) * num(m.amount)); // book running follows cleared money
    return { id: m.id, date: m.date, direction: m.direction, amount: num(m.amount), mode: m.mode, reference: m.reference, sourceType: m.sourceType, sourceNo: m.sourceNo, partyName: m.partyName, narration: m.narration, clearingStatus: m.clearingStatus, clearingDate: m.clearingDate, running };
  });
  // window-level summary
  const [cr, pn] = await Promise.all([
    prisma.bankTransaction.groupBy({ by: ["direction"], where: { ...base, clearingStatus: "credited" }, _sum: { amount: true } }),
    prisma.bankTransaction.groupBy({ by: ["direction"], where: { ...base, clearingStatus: "pending" }, _sum: { amount: true } }),
  ]);
  const gd = (rows: typeof cr, dir: string) => num(rows.find((r) => r.direction === dir)?._sum.amount);
  const clearedBalance = r2(opening + gd(cr, "in") - gd(cr, "out"));
  const unclearedIn = r2(gd(pn, "in")), unclearedOut = r2(gd(pn, "out"));
  return { opening, clearedBalance, unclearedIn, unclearedOut, bookBalance: r2(clearedBalance + unclearedIn - unclearedOut), rows: out };
}

/** Clear (or reverse) a set of movements: Credited (sets clearing date), Bounced or Cancelled. */
export async function clearMovements(scope: ActiveScope, ids: number[], status: "credited" | "bounced" | "cancelled" | "pending", opts: { clearingDate?: string | null; note?: string | null; userId?: number | null }): Promise<number> {
  const clearingDate = status === "credited" ? (opts.clearingDate || new Date().toISOString().slice(0, 10)) : status === "pending" ? null : (opts.clearingDate || null);
  const { count } = await prisma.bankTransaction.updateMany({
    where: { tenantId: scope.tenantId, id: { in: ids } },
    data: { clearingStatus: status, clearingDate, clearNote: opts.note ?? null, clearedBy: status === "pending" ? null : opts.userId ?? null, clearedAt: status === "pending" ? null : new Date(), status: status === "credited" ? "reconciled" : "unreconciled" },
  });
  return count;
}
