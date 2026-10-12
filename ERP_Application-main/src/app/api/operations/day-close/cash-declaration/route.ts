import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { eodCashierScope, resolveEodTerminalId } from "@/lib/eod/scope";
import { getActiveTerminalContext } from "@/lib/pos/terminalContext";
import { buildLiveSummary } from "@/lib/eod/summary";
import { CashDeclareSchema, type CashDeclarationRow } from "@/lib/contracts/eodCash";

const PERM = "operations.day-close";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +n.toFixed(2);

async function shape(rows: Awaited<ReturnType<typeof fetchRows>>): Promise<CashDeclarationRow[]> {
  const userIds = Array.from(new Set(rows.map((r) => r.cashierUserId)));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));
  return rows.map((r) => ({
    id: r.id, dayOpeningId: r.dayOpeningId, terminalId: r.terminalId, terminalSessionId: r.terminalSessionId,
    cashierUserId: r.cashierUserId, cashierName: uMap.get(r.cashierUserId) ?? "",
    expectedCash: num(r.expectedCash), physicalCount: num(r.physicalCount), excess: num(r.excess), shortage: num(r.shortage),
    difference: num(r.difference), remarks: r.remarks ?? "", approvalStatus: r.approvalStatus, createdAt: r.createdAt.toISOString(),
  }));
}
function fetchRows(where: object) {
  return prisma.cashDeclaration.findMany({ where, orderBy: { id: "desc" }, take: 50 });
}

// GET /api/operations/day-close/cash-declaration — recent declarations for the active day.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const cashier = eodCashierScope(user);
  const tId = await resolveEodTerminalId(user, new URL(req.url).searchParams.get("terminalId"));
  // Terminal filter (admin/manager view): show that terminal's declarations across the day.
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

// POST /api/operations/day-close/cash-declaration — declare physical cash vs expected.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "CashDeclaration" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = CashDeclareSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const ctx = await getActiveTerminalContext(user);
  if (!ctx || !ctx.dayOpeningId) return NextResponse.json({ ok: false, message: "Open the day first." }, { status: 422 });

  const day = await prisma.dayOpening.findFirst({ where: { id: ctx.dayOpeningId, tenantId: user.tenantId } });
  if (!day) return NextResponse.json({ ok: false, message: "Open the day first." }, { status: 422 });
  const shift = day.shiftId
    ? await prisma.shift.findFirst({ where: { id: day.shiftId, tenantId: user.tenantId }, select: { maxCashDifference: true, managerApprovalRequired: true } })
    : null;

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

  const expected = r2(summary.cash.expected);
  const physical = r2(body.physicalCount);
  const difference = r2(physical - expected);
  const excess = r2(Math.max(0, difference));
  const shortage = r2(Math.max(0, -difference));
  const limit = shift?.maxCashDifference != null ? Number(shift.maxCashDifference) : null;
  const approvalStatus =
    limit != null && Math.abs(difference) > limit && shift?.managerApprovalRequired ? "Pending" : "NotRequired";

  try {
    const decl = await prisma.cashDeclaration.create({
      data: {
        tenantId: user.tenantId, ...seg, dayOpeningId: ctx.dayOpeningId, terminalId: ctx.terminalId,
        terminalSessionId: ctx.terminalSessionId, cashierUserId: ctx.cashierUserId,
        expectedCash: expected, physicalCount: physical, excess, shortage, difference,
        denominations: body.denominations ? (body.denominations as unknown as Prisma.InputJsonValue) : undefined,
        remarks: body.remarks || null, approvalStatus, createdBy: user.id,
      },
      select: { id: true },
    });

    await writeAudit(prisma, user, {
      action: "cash_declaration.create", entity: "CashDeclaration", entityId: decl.id,
      summary: `Declared ${physical} vs expected ${expected} (diff ${difference})`,
      meta: { expected, physical, difference, excess, shortage, approvalStatus, dayOpeningId: ctx.dayOpeningId },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });

    return NextResponse.json({ ok: true, message: "Cash declared.", id: decl.id, expectedCash: expected, difference, excess, shortage, approvalStatus }, { status: 201 });
  } catch (err) {
    console.error("[cash-declaration] error", err);
    return NextResponse.json({ ok: false, message: "Could not record the declaration." }, { status: 500 });
  }
}
