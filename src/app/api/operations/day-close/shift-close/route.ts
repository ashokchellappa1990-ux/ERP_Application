import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { eodCashierScope, resolveEodTerminalId } from "@/lib/eod/scope";
import { getActiveTerminalContext, POS_CTX_COOKIE } from "@/lib/pos/terminalContext";
import { buildLiveSummary } from "@/lib/eod/summary";
import { ShiftCloseSchema, type ShiftClosingRow } from "@/lib/contracts/eodCash";
import type { LiveSummary } from "@/lib/contracts/eod";

const PERM = "operations.day-close";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +n.toFixed(2);

async function shape(rows: Awaited<ReturnType<typeof fetchRows>>): Promise<ShiftClosingRow[]> {
  const userIds = Array.from(new Set(rows.map((r) => r.cashierUserId)));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));
  return rows.map((r) => ({
    id: r.id, dayOpeningId: r.dayOpeningId, terminalId: r.terminalId, shiftId: r.shiftId, terminalSessionId: r.terminalSessionId,
    cashierUserId: r.cashierUserId, cashierName: uMap.get(r.cashierUserId) ?? "", closedAt: r.closedAt.toISOString(),
    expectedCash: num(r.expectedCash), countedCash: num(r.countedCash), difference: num(r.difference), status: r.status,
    summary: (r.summary as unknown as LiveSummary | null) ?? null,
  }));
}
function fetchRows(where: object) {
  return prisma.shiftClosing.findMany({ where, orderBy: { id: "desc" }, take: 50 });
}

// GET /api/operations/day-close/shift-close — recent shift closings for the active day.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const cashier = eodCashierScope(user);
  const tId = await resolveEodTerminalId(user, new URL(req.url).searchParams.get("terminalId"));
  // Terminal filter (admin/manager view): show that terminal's shift closings across the day.
  // Otherwise restrict to the active session's day (default cashier behavior).
  let where: object;
  if (tId) {
    where = { ...sw, ...cashier, terminalId: tId };
  } else {
    const ctx = await getActiveTerminalContext(user);
    where = { ...sw, ...cashier, ...(ctx?.dayOpeningId ? { dayOpeningId: ctx.dayOpeningId } : {}) };
  }
  const rows = await shape(await fetchRows(where));
  return NextResponse.json({ ok: true, rows });
}

// POST /api/operations/day-close/shift-close — validate, snapshot, close the shift/session.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ShiftClosing" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { raw = {}; }
  const parsed = ShiftCloseSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const ctx = await getActiveTerminalContext(user);
  if (!ctx || !ctx.dayOpeningId) return NextResponse.json({ ok: false, message: "Open the day first." }, { status: 422 });

  const day = await prisma.dayOpening.findFirst({ where: { id: ctx.dayOpeningId, tenantId: user.tenantId } });
  if (!day) return NextResponse.json({ ok: false, message: "Open the day first." }, { status: 422 });

  // Validation gate: a cash declaration must exist for this day and not be pending approval.
  const declaration = await prisma.cashDeclaration.findFirst({ where: { tenantId: user.tenantId, dayOpeningId: ctx.dayOpeningId }, orderBy: { id: "desc" } });
  if (!declaration) return NextResponse.json({ ok: false, message: "Declare cash first." }, { status: 422 });
  if (declaration.approvalStatus === "Pending") return NextResponse.json({ ok: false, message: "Cash declaration is pending manager approval." }, { status: 422 });

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const today = new Date().toISOString().slice(0, 10);

  const summary = await buildLiveSummary(
    {
      tenantId: user.tenantId, businessId: scope.businessId, branchIds: scope.readBranchIds ?? null,
      terminalSessionId: ctx.terminalSessionId, date: today,
    },
    { cash: num(day.openingCash), bank: num(day.openingBankBalance), safe: num(day.openingSafeBalance) },
  );

  const expectedCash = r2(summary.cash.expected);
  const countedCash = r2(body.countedCash ?? num(declaration.physicalCount));
  const difference = r2(countedCash - expectedCash);
  const validations = {
    declaration: true,
    diffApproved: declaration.approvalStatus !== "Pending",
    forced: !!body.force,
  };

  try {
    const closing = await prisma.$transaction(async (tx) => {
      const sc = await tx.shiftClosing.create({
        data: {
          tenantId: user.tenantId, ...seg, dayOpeningId: ctx.dayOpeningId!, terminalId: ctx.terminalId, shiftId: day.shiftId ?? null,
          terminalSessionId: ctx.terminalSessionId, cashierUserId: ctx.cashierUserId,
          validations: validations as unknown as Prisma.InputJsonValue, summary: summary as unknown as Prisma.InputJsonValue,
          expectedCash, countedCash, difference, status: "Closed", createdBy: user.id,
        },
        select: { id: true },
      });
      await tx.terminalClosingSummary.create({
        data: {
          tenantId: user.tenantId, ...seg, dayDate: today, terminalId: ctx.terminalId, terminalSessionId: ctx.terminalSessionId,
          openingCash: num(day.openingCash), closingCash: countedCash, difference, totals: summary as unknown as Prisma.InputJsonValue, createdBy: user.id,
        },
      });
      await tx.terminalSession.update({
        where: { id: ctx.terminalSessionId },
        data: { status: "Closed", logoutAt: new Date(), closingCash: countedCash, expectedCash, cashDifference: difference },
      });
      return { id: sc.id };
    });

    await writeAudit(prisma, user, {
      action: "shift.close", entity: "ShiftClosing", entityId: closing.id,
      summary: `Closed shift for day ${day.dayOpeningNo} — expected ${expectedCash}, counted ${countedCash}, diff ${difference}`,
      meta: { expectedCash, countedCash, difference, dayOpeningId: ctx.dayOpeningId, terminalSessionId: ctx.terminalSessionId },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });

    const res = NextResponse.json({ ok: true, message: "Shift closed.", id: closing.id, expectedCash, countedCash, difference }, { status: 201 });
    res.cookies.set(POS_CTX_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    console.error("[shift-close] error", err);
    return NextResponse.json({ ok: false, message: "Could not close the shift." }, { status: 500 });
  }
}
