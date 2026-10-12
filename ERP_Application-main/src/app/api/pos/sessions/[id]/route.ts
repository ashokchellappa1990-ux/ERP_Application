import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { SessionDetail, SessionStatus } from "@/lib/contracts/terminalSession";

const num = (v: unknown) => (v == null ? null : Number(v));

// GET /api/pos/sessions/[id] — one session with live cash reconciliation.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "pos.sessions");
  if (denied) return denied;

  const id = Number(params.id);
  const s = await prisma.terminalSession.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { terminal: { select: { code: true, name: true } }, shift: { select: { name: true } } },
  });
  if (!s) return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });

  const cashier = await prisma.user.findUnique({ where: { id: s.cashierUserId }, select: { fullName: true } });
  // Cash collected on sales stamped to this session (MVP reconciliation basis).
  const cashAgg = await prisma.salePayment.aggregate({ where: { sale: { terminalSessionId: id }, mode: { contains: "Cash" } }, _sum: { amount: true } });
  const cashSales = Number(cashAgg._sum.amount ?? 0);
  const openingCash = num(s.openingCash);
  const liveExpected = s.status === "Open" ? (openingCash ?? 0) + cashSales : num(s.expectedCash);

  const data: SessionDetail = {
    id: s.id, sessionNo: s.sessionNo, terminalId: s.terminalId, terminalCode: s.terminal?.code ?? "", terminalName: s.terminal?.name ?? "",
    shiftId: s.shiftId, shiftName: s.shift?.name ?? "", cashierUserId: s.cashierUserId, cashierName: cashier?.fullName ?? "",
    loginAt: s.loginAt.toISOString(), logoutAt: s.logoutAt ? s.logoutAt.toISOString() : null,
    openingCash, closingCash: num(s.closingCash), cashDifference: num(s.cashDifference), status: s.status as SessionStatus,
    expectedCash: liveExpected, cashSales, openingNote: s.openingNote ?? "", closingNote: s.closingNote ?? "", createdAt: s.createdAt.toISOString(),
  };
  return NextResponse.json({ ok: true, data });
}
