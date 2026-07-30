import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { POS_CTX_COOKIE, ctxCookieValue } from "@/lib/pos/terminalContext";
import { terminalListWhere } from "@/lib/pos/terminalGuard";
import { SessionOpenSchema, type SessionRow, type SessionListStats, type SessionStatus } from "@/lib/contracts/terminalSession";

const PERM = "pos.sessions";
const num = (v: unknown) => (v == null ? null : Number(v));

// GET /api/pos/sessions — sessions list + stats (open / today).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const tw = await terminalListWhere(user, url.searchParams.get("terminalId"));
  const where: Prisma.TerminalSessionWhereInput = { ...sw, ...tw };
  if (status === "Open" || status === "Closed") where.status = status;

  const rows = await prisma.terminalSession.findMany({
    where, orderBy: { id: "desc" }, take: 200,
    include: { terminal: { select: { code: true, name: true } }, shift: { select: { name: true } } },
  });
  const cashierIds = Array.from(new Set(rows.map((r) => r.cashierUserId)));
  const cashiers = cashierIds.length ? await prisma.user.findMany({ where: { id: { in: cashierIds } }, select: { id: true, fullName: true } }) : [];
  const cashierName = new Map(cashiers.map((c) => [c.id, c.fullName]));

  const today = new Date().toISOString().slice(0, 10);
  const [open, todayCount] = await Promise.all([
    prisma.terminalSession.count({ where: { ...sw, status: "Open" } }),
    prisma.terminalSession.count({ where: { ...sw, loginAt: { gte: new Date(`${today}T00:00:00.000Z`) } } }),
  ]);

  const shaped: SessionRow[] = rows.map((s) => ({
    id: s.id, sessionNo: s.sessionNo, terminalId: s.terminalId, terminalCode: s.terminal?.code ?? "", terminalName: s.terminal?.name ?? "",
    shiftId: s.shiftId, shiftName: s.shift?.name ?? "", cashierUserId: s.cashierUserId, cashierName: cashierName.get(s.cashierUserId) ?? "",
    loginAt: s.loginAt.toISOString(), logoutAt: s.logoutAt ? s.logoutAt.toISOString() : null,
    openingCash: num(s.openingCash), closingCash: num(s.closingCash), cashDifference: num(s.cashDifference), status: s.status as SessionStatus,
  }));
  const stats: SessionListStats = { open, today: todayCount };
  return NextResponse.json({ ok: true, rows: shaped, stats });
}

// POST /api/pos/sessions — open a terminal session for the signed-in cashier.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TerminalSession" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = SessionOpenSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const terminal = await prisma.posTerminal.findFirst({ where: { id: body.terminalId, tenantId: user.tenantId } });
  if (!terminal) return NextResponse.json({ ok: false, message: "Terminal not found." }, { status: 404 });
  if (terminal.status !== "active") return NextResponse.json({ ok: false, message: "Terminal is inactive." }, { status: 422 });

  const already = await prisma.terminalSession.findFirst({ where: { terminalId: terminal.id, status: "Open" }, select: { id: true, sessionNo: true } });
  if (already) return NextResponse.json({ ok: false, message: `Terminal already has an open session (${already.sessionNo}). Close it first.` }, { status: 422 });

  let shiftId: number | null = null;
  if (body.shiftId) {
    const shift = await prisma.shift.findFirst({ where: { id: body.shiftId, tenantId: user.tenantId } });
    if (!shift) return NextResponse.json({ ok: false, message: "Shift not found." }, { status: 404 });
    if (shift.openingCashMandatory && body.openingCash == null) return NextResponse.json({ ok: false, message: `Opening cash is mandatory for shift ${shift.name}.` }, { status: 422 });
    shiftId = shift.id;
  }

  const seg = scopeData(await getActiveScope(user), { branch: true });
  try {
    const created = await prisma.$transaction(async (tx) => {
      const s = await tx.terminalSession.create({
        data: {
          tenantId: user.tenantId, ...seg, sessionNo: "TMP", terminalId: terminal.id, shiftId, cashierUserId: user.id,
          openingCash: body.openingCash ?? null, openingNote: body.openingNote || null, status: "Open",
        },
        select: { id: true },
      });
      const sessionNo = `SES-${String(s.id).padStart(6, "0")}`;
      await tx.terminalSession.update({ where: { id: s.id }, data: { sessionNo } });
      return { id: s.id, sessionNo };
    });
    await writeAudit(prisma, user, {
      action: "session.open", entity: "TerminalSession", entityId: created.id,
      summary: `Opened session ${created.sessionNo} on ${terminal.code}`,
      meta: { terminalId: terminal.id, shiftId, openingCash: body.openingCash ?? null },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    // Set the active POS context cookie so transactions stamp this session.
    const res = NextResponse.json({ ok: true, message: "Session opened.", id: created.id, sessionNo: created.sessionNo }, { status: 201 });
    res.cookies.set(POS_CTX_COOKIE, ctxCookieValue({ terminalId: terminal.id, sessionId: created.id, shiftId }), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    });
    return res;
  } catch (err) {
    console.error("[pos-session] open error", err);
    return NextResponse.json({ ok: false, message: "Could not open the session." }, { status: 500 });
  }
}
