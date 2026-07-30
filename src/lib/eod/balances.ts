import { prisma } from "@/lib/db/prisma";
import { ACC } from "@/lib/accounting/accounts";

const n = (v: unknown) => (v == null ? 0 : Number(v));

/** Branch-scoped safe-locker balance = Σ IN_FROM_TERMINAL − Σ (OUT_TO_TERMINAL + OUT_TO_BANK). */
export async function currentSafeBalance(tenantId: number, branchIds?: number[] | null): Promise<number> {
  const branch = branchIds?.length ? { branchId: { in: branchIds } } : {};
  const [ins, outs] = await Promise.all([
    prisma.safeLockerTransaction.aggregate({ where: { tenantId, ...branch, direction: { in: ["IN_FROM_TERMINAL", "IN_FROM_BANK"] } }, _sum: { amount: true } }),
    prisma.safeLockerTransaction.aggregate({ where: { tenantId, ...branch, direction: { in: ["OUT_TO_TERMINAL", "OUT_TO_BANK"] } }, _sum: { amount: true } }),
  ]);
  return n(ins._sum.amount) - n(outs._sum.amount);
}

/** The branch's opening snapshot for a date: cash = Σ of the day's DayOpening
 *  opening cash; bank/safe = the earliest opening snapshot for that date (falling
 *  back to the live ledger balances when no day was opened). */
export async function branchOpeningSnapshot(tenantId: number, branchIds: number[] | null | undefined, date: string): Promise<{ cash: number; bank: number; safe: number }> {
  const branch = branchIds?.length ? { branchId: { in: branchIds } } : {};
  const days = await prisma.dayOpening.findMany({ where: { tenantId, ...branch, openingDate: date }, orderBy: { id: "asc" }, select: { openingCash: true, openingBankBalance: true, openingSafeBalance: true } });
  const cash = days.reduce((a, d) => a + n(d.openingCash), 0);
  const first = days[0];
  const bank = first?.openingBankBalance != null ? n(first.openingBankBalance) : await currentBankBalance(tenantId, branchIds);
  const safe = first?.openingSafeBalance != null ? n(first.openingSafeBalance) : await currentSafeBalance(tenantId, branchIds);
  return { cash, bank, safe };
}

/** Current BANK ledger balance (debit-normal) from the accounting journal — view-only. */
export async function currentBankBalance(tenantId: number, branchIds?: number[] | null): Promise<number> {
  const acct = await prisma.ledgerAccount.findFirst({ where: { tenantId, code: ACC.BANK }, select: { id: true } });
  if (!acct) return 0;
  const branch = branchIds?.length ? { branchId: { in: branchIds } } : {};
  const agg = await prisma.journalLine.aggregate({ where: { tenantId, accountId: acct.id, ...branch }, _sum: { debit: true, credit: true } });
  return n(agg._sum.debit) - n(agg._sum.credit);
}
