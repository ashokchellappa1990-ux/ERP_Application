import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { ensureAccounts } from "@/lib/accounting/accounts";
import type { LedgerAccountRow, AccountType, NormalBalance, ChartOfAccountsStats, ChartOfAccountsResponse } from "@/lib/contracts/accounting";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/accounting/chart-of-accounts — seed + list ledger accounts with balances.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const accounts = await prisma.$transaction(async (tx) => {
    await ensureAccounts(tx, user.tenantId);
    return tx.ledgerAccount.findMany({ where: { tenantId: user.tenantId }, orderBy: { code: "asc" } });
  });

  const sums = await prisma.journalLine.groupBy({ by: ["accountId"], where: scopeWhere(await getActiveScope(user), { branch: true }), _sum: { debit: true, credit: true } });
  const sumMap = new Map(sums.map((s) => [s.accountId, { d: num(s._sum.debit), c: num(s._sum.credit) }]));

  const rows: LedgerAccountRow[] = accounts.map((a) => {
    const s = sumMap.get(a.id) ?? { d: 0, c: 0 };
    const balance = a.normalBalance === "Debit" ? s.d - s.c : s.c - s.d;
    return { id: a.id, code: a.code, name: a.name, type: a.type as AccountType, group: a.group ?? "", normalBalance: a.normalBalance as NormalBalance, debit: +s.d.toFixed(2), credit: +s.c.toFixed(2), balance: +balance.toFixed(2) };
  });

  const byType = (t: string) => rows.filter((r) => r.type === t).reduce((s, r) => s + r.balance, 0);
  const stats: ChartOfAccountsStats = {
    accounts: rows.length,
    assets: +byType("Asset").toFixed(2),
    liabilities: +byType("Liability").toFixed(2),
    income: +byType("Income").toFixed(2),
    expense: +byType("Expense").toFixed(2),
  };
  return NextResponse.json({ ok: true, rows, stats } satisfies ChartOfAccountsResponse);
}
