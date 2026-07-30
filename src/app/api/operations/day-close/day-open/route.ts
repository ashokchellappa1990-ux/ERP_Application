import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { POS_CTX_COOKIE, ctxCookieValue } from "@/lib/pos/terminalContext";
import { eodCashierScope, resolveEodTerminalId } from "@/lib/eod/scope";
import { currentBankBalance, currentSafeBalance } from "@/lib/eod/balances";
import { isTerminalSetupRequired } from "@/lib/pos/terminalGuard";
import { getUserTerminalIds } from "@/lib/pos/userTerminals";
import { DayOpenSchema, type DayOpeningRow, type DayOpeningStatus, type DayOpenMeta } from "@/lib/contracts/eod";

const PERM = "operations.day-close";
const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Picker metadata for the Day Opening form (drives the conditional terminal/shift
 *  fields + previous-day closing-cash defaults). */
async function buildMeta(user: { id: number; tenantId: number; role?: string | null; roleId?: number | null; businessId?: number | null; branchId?: number | null }): Promise<DayOpenMeta> {
  const required = await isTerminalSetupRequired(user);
  const mappedIds = await getUserTerminalIds(user); // empty = unmapped → no terminal field
  const terminals = mappedIds.length
    ? await prisma.posTerminal.findMany({ where: { id: { in: mappedIds }, tenantId: user.tenantId, status: "active" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } })
    : [];
  const withPrev = await Promise.all(terminals.map(async (t) => {
    const last = await prisma.terminalSession.findFirst({ where: { terminalId: t.id, status: "Closed" }, orderBy: { id: "desc" }, select: { closingCash: true } });
    return { id: t.id, code: t.code, name: t.name, prevClosingCash: last?.closingCash != null ? num(last.closingCash) : null };
  }));
  const shiftRows = await prisma.shift.findMany({ where: { tenantId: user.tenantId, status: "active" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  return { terminalSetupRequired: required, terminals: withPrev, shifts: shiftRows };
}

async function shape(rows: Awaited<ReturnType<typeof fetchRows>>): Promise<DayOpeningRow[]> {
  const termIds = Array.from(new Set(rows.map((r) => r.terminalId).filter((x): x is number => x != null)));
  const userIds = Array.from(new Set(rows.map((r) => r.cashierUserId)));
  const [terms, users] = await Promise.all([
    termIds.length ? prisma.posTerminal.findMany({ where: { id: { in: termIds } }, select: { id: true, code: true, name: true } }) : Promise.resolve([]),
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : Promise.resolve([]),
  ]);
  const tMap = new Map(terms.map((t) => [t.id, t]));
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));
  return rows.map((r) => ({
    id: r.id, dayOpeningNo: r.dayOpeningNo, openingDate: r.openingDate, openingAt: r.openingAt.toISOString(),
    terminalId: r.terminalId, terminalCode: r.terminalId != null ? tMap.get(r.terminalId)?.code ?? "" : "", terminalName: r.terminalId != null ? tMap.get(r.terminalId)?.name ?? "" : "",
    shiftId: r.shiftId, cashierUserId: r.cashierUserId, cashierName: uMap.get(r.cashierUserId) ?? "", terminalSessionId: r.terminalSessionId,
    openingCash: num(r.openingCash), openingBankBalance: r.openingBankBalance == null ? null : num(r.openingBankBalance),
    openingSafeBalance: r.openingSafeBalance == null ? null : num(r.openingSafeBalance), openingPettyCash: r.openingPettyCash == null ? null : num(r.openingPettyCash),
    remarks: r.remarks ?? "", status: r.status as DayOpeningStatus,
  }));
}
function fetchRows(where: object) {
  return prisma.dayOpening.findMany({ where, orderBy: { id: "desc" }, take: 50 });
}

// GET /api/operations/day-close/day-open — the user's active open day + recent list.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const cashier = eodCashierScope(user);
  const tId = await resolveEodTerminalId(user, new URL(req.url).searchParams.get("terminalId"));
  const listWhere = { ...sw, ...cashier, ...(tId ? { terminalId: tId } : {}) };
  const [list, active] = await Promise.all([
    fetchRows(listWhere),
    prisma.dayOpening.findFirst({ where: { ...sw, status: "Open", cashierUserId: user.id }, orderBy: { id: "desc" } }),
  ]);
  const rows = await shape(list);
  const activeRow = active ? (await shape([active]))[0] : null;
  const meta = await buildMeta(user);
  return NextResponse.json({ ok: true, rows, active: activeRow, meta });
}

// POST /api/operations/day-close/day-open — open the business day (creates + links a TerminalSession).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "DayOpening" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = DayOpenSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  // One open day per user at a time.
  const existingDay = await prisma.dayOpening.findFirst({ where: { tenantId: user.tenantId, cashierUserId: user.id, status: "Open" }, select: { dayOpeningNo: true } });
  if (existingDay) return NextResponse.json({ ok: false, message: `You already have an open day (${existingDay.dayOpeningNo}). Close it first.` }, { status: 422 });

  // Terminal is only required when terminal-based setup is on AND the user is
  // mapped to a terminal; otherwise the day opens at branch level (no session).
  const required = await isTerminalSetupRequired(user);
  const mappedIds = await getUserTerminalIds(user);
  let terminal: { id: number; code: string; status: string } | null = null;
  if (body.terminalId) {
    terminal = await prisma.posTerminal.findFirst({ where: { id: body.terminalId, tenantId: user.tenantId }, select: { id: true, code: true, status: true } });
    if (!terminal) return NextResponse.json({ ok: false, message: "Terminal not found." }, { status: 404 });
    if (terminal.status !== "active") return NextResponse.json({ ok: false, message: "Terminal is inactive." }, { status: 422 });
    const openSession = await prisma.terminalSession.findFirst({ where: { terminalId: terminal.id, status: "Open" }, select: { id: true } });
    if (openSession) return NextResponse.json({ ok: false, message: "This terminal already has an open session. Close it first." }, { status: 422 });
  } else if (required && mappedIds.length) {
    return NextResponse.json({ ok: false, message: "Select a terminal to open the day." }, { status: 422 });
  }

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const branchIds = scope.readBranchIds ?? null;
  const [openingBank, openingSafe] = await Promise.all([currentBankBalance(user.tenantId, branchIds), currentSafeBalance(user.tenantId, branchIds)]);
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      let sessionId: number | null = null;
      if (terminal) {
        const sess = await tx.terminalSession.create({
          data: { tenantId: user.tenantId, ...seg, sessionNo: "TMP", terminalId: terminal.id, shiftId: body.shiftId ?? null, cashierUserId: user.id, openingCash: body.openingCash ?? 0, status: "Open" },
          select: { id: true },
        });
        await tx.terminalSession.update({ where: { id: sess.id }, data: { sessionNo: `SES-${String(sess.id).padStart(6, "0")}` } });
        sessionId = sess.id;
      }
      const day = await tx.dayOpening.create({
        data: {
          tenantId: user.tenantId, ...seg, dayOpeningNo: "TMP", openingDate: today, terminalId: terminal?.id ?? null, shiftId: body.shiftId ?? null,
          terminalSessionId: sessionId, cashierUserId: user.id, openingCash: body.openingCash ?? 0,
          openingBankBalance: openingBank, openingSafeBalance: openingSafe, openingPettyCash: body.openingPettyCash ?? null,
          remarks: body.remarks || null, status: "Open", createdBy: user.id,
        },
        select: { id: true },
      });
      const dayOpeningNo = `DO-${today.replace(/-/g, "")}-${String(day.id).padStart(4, "0")}`;
      await tx.dayOpening.update({ where: { id: day.id }, data: { dayOpeningNo } });
      return { dayId: day.id, sessionId, dayOpeningNo };
    });

    await writeAudit(prisma, user, {
      action: "day_opening.create", entity: "DayOpening", entityId: result.dayId,
      summary: `Opened day ${result.dayOpeningNo}${terminal ? ` on ${terminal.code}` : " (branch level)"}`,
      meta: { terminalId: terminal?.id ?? null, openingCash: body.openingCash ?? 0, openingBank, openingSafe },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });

    const res = NextResponse.json({ ok: true, message: "Day opened.", id: result.dayId, dayOpeningNo: result.dayOpeningNo }, { status: 201 });
    if (terminal && result.sessionId) {
      res.cookies.set(POS_CTX_COOKIE, ctxCookieValue({ terminalId: terminal.id, sessionId: result.sessionId, shiftId: body.shiftId ?? null }), {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
      });
    }
    return res;
  } catch (err) {
    console.error("[day-open] error", err);
    return NextResponse.json({ ok: false, message: "Could not open the day." }, { status: 500 });
  }
}
