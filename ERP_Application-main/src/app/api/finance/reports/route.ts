import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { ACC } from "@/lib/accounting/accounts";
import {
  ensureSeeded, trialBalance, profitAndLoss, tradingAccount, balanceSheet, cashFlow, fundFlow, dayBook, accountLedger,
} from "@/lib/accounting/reports";

// GET /api/finance/reports?report=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD[&code=1000]
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "finance.reports");
  if (denied) return denied;

  const url = new URL(req.url);
  const report = (url.searchParams.get("report") ?? "trial-balance").trim();
  const from = (url.searchParams.get("from") ?? "").trim() || undefined;
  const to = (url.searchParams.get("to") ?? "").trim() || undefined;
  const code = (url.searchParams.get("code") ?? "").trim() || undefined;
  const tid = user.tenantId;
  // Active business + branch scope (topbar filter) — every report is filtered to
  // the selected branch (or all allowed branches when "All branches" is chosen).
  const scope = await getActiveScope(user);

  await ensureSeeded(tid);

  let data: unknown;
  switch (report) {
    case "trial-balance": data = await trialBalance(scope, to); break;
    case "profit-loss": data = await profitAndLoss(scope, from, to); break;
    case "trading": data = await tradingAccount(scope, from, to); break;
    case "balance-sheet": data = await balanceSheet(scope, to); break;
    case "cash-flow": data = await cashFlow(scope, from, to); break;
    case "fund-flow": data = await fundFlow(scope, from, to); break;
    case "day-book":
    case "journal-register": data = await dayBook(scope, from, to); break;
    case "cash-book": data = await accountLedger(scope, ACC.CASH, from, to); break;
    case "bank-book": data = await accountLedger(scope, ACC.BANK, from, to); break;
    case "general-ledger": data = await accountLedger(scope, code ?? ACC.SALES, from, to); break;
    default: return NextResponse.json({ ok: false, message: "Unknown report." }, { status: 422 });
  }

  // Account list (for the General Ledger account picker).
  const accounts = report === "general-ledger"
    ? (await prisma.ledgerAccount.findMany({ where: { tenantId: tid }, orderBy: { code: "asc" }, select: { code: true, name: true } }))
    : undefined;

  return NextResponse.json({ ok: true, report, from: from ?? "", to: to ?? "", accounts, data });
}
