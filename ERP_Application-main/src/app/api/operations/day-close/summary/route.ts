import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { eodCashierScope, resolveEodTerminalId } from "@/lib/eod/scope";
import { buildLiveSummary } from "@/lib/eod/summary";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/operations/day-close/summary?date=&terminalId=&terminalSessionId=
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "operations.day-close");
  if (denied) return denied;

  const url = new URL(req.url);
  const date = (url.searchParams.get("date") || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const filterTerminalId = await resolveEodTerminalId(user, url.searchParams.get("terminalId")); // validated against mapping
  let terminalSessionId = url.searchParams.get("terminalSessionId") ? Number(url.searchParams.get("terminalSessionId")) : null;

  const scope = await getActiveScope(user);
  const cashier = eodCashierScope(user);

  // Resolve the opening snapshot + how to aggregate:
  //  • explicit session   → that session
  //  • terminal filter    → the whole terminal's day (today's open/last opening)
  //  • otherwise          → the cashier's own open day (default)
  let day;
  let terminalId: number | null = null;
  if (terminalSessionId) {
    day = await prisma.dayOpening.findFirst({ where: { tenantId: user.tenantId, terminalSessionId }, orderBy: { id: "desc" }, select: { terminalSessionId: true, openingCash: true, openingBankBalance: true, openingSafeBalance: true } });
  } else if (filterTerminalId) {
    terminalId = filterTerminalId;
    day = await prisma.dayOpening.findFirst({ where: { tenantId: user.tenantId, terminalId, status: "Open" }, orderBy: { id: "desc" }, select: { terminalSessionId: true, openingCash: true, openingBankBalance: true, openingSafeBalance: true } })
      ?? await prisma.dayOpening.findFirst({ where: { tenantId: user.tenantId, terminalId, openingDate: date }, orderBy: { id: "desc" }, select: { terminalSessionId: true, openingCash: true, openingBankBalance: true, openingSafeBalance: true } });
  } else {
    day = await prisma.dayOpening.findFirst({ where: { tenantId: user.tenantId, status: "Open", ...(cashier.cashierUserId ? { cashierUserId: cashier.cashierUserId } : {}) }, orderBy: { id: "desc" }, select: { terminalSessionId: true, openingCash: true, openingBankBalance: true, openingSafeBalance: true } });
    if (day?.terminalSessionId) terminalSessionId = day.terminalSessionId;
  }

  const summary = await buildLiveSummary(
    { tenantId: user.tenantId, businessId: scope.businessId, branchIds: scope.readBranchIds ?? null, terminalId, terminalSessionId, cashierUserId: cashier.cashierUserId ?? null, date },
    { cash: num(day?.openingCash), bank: num(day?.openingBankBalance), safe: num(day?.openingSafeBalance) },
  );
  return NextResponse.json({ ok: true, summary });
}
