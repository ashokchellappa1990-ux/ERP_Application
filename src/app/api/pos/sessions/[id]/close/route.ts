import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { POS_CTX_COOKIE } from "@/lib/pos/terminalContext";
import { SessionCloseSchema } from "@/lib/contracts/terminalSession";

const r2 = (n: number) => +n.toFixed(2);

// POST /api/pos/sessions/[id]/close — reconcile cash and close the session.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, "pos.sessions", { req, entity: "TerminalSession", entityId: id });
  if (denied) return denied;

  const s = await prisma.terminalSession.findFirst({ where: { id, tenantId: user.tenantId }, include: { shift: { select: { name: true, maxCashDifference: true, managerApprovalRequired: true, closingCashMandatory: true } } } });
  if (!s) return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  if (s.status !== "Open") return NextResponse.json({ ok: false, message: "Session is already closed." }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { raw = {}; }
  const parsed = SessionCloseSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  if (s.shift?.closingCashMandatory && body.closingCash == null) {
    return NextResponse.json({ ok: false, message: `Closing cash is mandatory for shift ${s.shift.name}.` }, { status: 422 });
  }

  // Expected = opening cash + cash collected on sales stamped to this session.
  const cashAgg = await prisma.salePayment.aggregate({ where: { sale: { terminalSessionId: id }, mode: { contains: "Cash" } }, _sum: { amount: true } });
  const cashSales = Number(cashAgg._sum.amount ?? 0);
  const expectedCash = r2(Number(s.openingCash ?? 0) + cashSales);
  const closingCash = body.closingCash != null ? r2(body.closingCash) : null;
  const cashDifference = closingCash != null ? r2(closingCash - expectedCash) : null;

  // Manager approval gate when the difference exceeds the shift's tolerance.
  const limit = s.shift?.maxCashDifference != null ? Number(s.shift.maxCashDifference) : null;
  const overLimit = limit != null && cashDifference != null && Math.abs(cashDifference) > limit;
  if (overLimit && s.shift?.managerApprovalRequired && !body.approve) {
    return NextResponse.json({ ok: false, message: `Cash difference ${cashDifference} exceeds the ${limit} limit — manager approval required.`, needsApproval: true, expectedCash, cashDifference }, { status: 422 });
  }

  await prisma.terminalSession.update({
    where: { id },
    data: {
      status: "Closed", logoutAt: new Date(), closingCash, expectedCash, cashDifference,
      closingNote: body.closingNote || null, approvedBy: overLimit && body.approve ? user.id : null,
    },
  });
  await writeAudit(prisma, user, {
    action: "session.close", entity: "TerminalSession", entityId: id,
    summary: `Closed session ${s.sessionNo} — expected ${expectedCash}, diff ${cashDifference ?? "—"}`,
    meta: { expectedCash, closingCash, cashDifference, cashSales, approved: overLimit && !!body.approve },
    businessId: s.businessId, branchId: s.branchId, ip: requestMeta(req).ip,
  });

  const res = NextResponse.json({ ok: true, message: "Session closed.", expectedCash, cashDifference });
  res.cookies.set(POS_CTX_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 }); // clear active context
  return res;
}
