import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { ensureAccounts } from "@/lib/accounting/accounts";
import type { TrialBalanceResponse, GlLedgerResponse } from "@/lib/contracts/finance";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const PERM = "finance.gl";

// GET /api/finance/gl
//   (no accountId) → Trial Balance: every account's debit/credit totals + balance.
//   ?accountId=N   → that account's ledger: each posting with a running balance.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const accountId = Number(new URL(req.url).searchParams.get("accountId")) || 0;
  // GL/trial balance reflects the active branch (journal lines carry the branch).
  const jl = scopeWhere(await getActiveScope(user), { branch: true });

  // Make sure system accounts exist so the page isn't empty before any posting.
  const accounts = await prisma.$transaction(async (tx) => {
    await ensureAccounts(tx, user.tenantId);
    return tx.ledgerAccount.findMany({ where: { tenantId: user.tenantId }, orderBy: { code: "asc" } });
  });

  if (!accountId) {
    // Trial balance
    const sums = await prisma.journalLine.groupBy({ by: ["accountId"], where: { ...jl }, _sum: { debit: true, credit: true } });
    const sumMap = new Map(sums.map((s) => [s.accountId, { d: num(s._sum.debit), c: num(s._sum.credit) }]));
    let totalDr = 0, totalCr = 0;
    const rows = accounts.map((a) => {
      const s = sumMap.get(a.id) ?? { d: 0, c: 0 };
      const bal = a.normalBalance === "Debit" ? s.d - s.c : s.c - s.d;
      const drBal = a.normalBalance === "Debit" ? Math.max(0, bal) : Math.max(0, -bal);
      const crBal = a.normalBalance === "Credit" ? Math.max(0, bal) : Math.max(0, -bal);
      totalDr += drBal; totalCr += crBal;
      return { id: a.id, code: a.code, name: a.name, type: a.type, group: a.group ?? "", debit: +drBal.toFixed(2), credit: +crBal.toFixed(2) };
    });
    return NextResponse.json({
      ok: true, mode: "trial",
      accounts: accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type })),
      rows, totals: { debit: +totalDr.toFixed(2), credit: +totalCr.toFixed(2) },
    } satisfies TrialBalanceResponse);
  }

  // Per-account ledger
  const acct = accounts.find((a) => a.id === accountId);
  if (!acct) return NextResponse.json({ ok: false, message: "Account not found." }, { status: 404 });

  const lines = await prisma.journalLine.findMany({
    where: { ...jl, accountId },
    include: { journal: { select: { voucherNo: true, voucherType: true, date: true, narration: true, refNo: true, status: true } } },
    orderBy: { id: "asc" },
  });

  let running = 0;
  const sign = acct.normalBalance === "Debit" ? 1 : -1;
  const rows = lines.map((l) => {
    running += sign * (num(l.debit) - num(l.credit));
    return {
      date: l.journal.date, voucherNo: l.journal.voucherNo, voucherType: l.journal.voucherType,
      narration: l.narration || l.journal.narration || "", refNo: l.journal.refNo ?? "", status: l.journal.status,
      debit: num(l.debit), credit: num(l.credit), balance: +running.toFixed(2),
    };
  });
  const totDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totCredit = rows.reduce((s, r) => s + r.credit, 0);

  return NextResponse.json({
    ok: true, mode: "ledger",
    accounts: accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type })),
    account: { id: acct.id, code: acct.code, name: acct.name, type: acct.type, normalBalance: acct.normalBalance },
    rows, totals: { debit: +totDebit.toFixed(2), credit: +totCredit.toFixed(2), balance: +running.toFixed(2) },
  } satisfies GlLedgerResponse);
}
