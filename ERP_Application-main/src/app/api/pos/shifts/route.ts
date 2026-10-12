import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ShiftCreateSchema, type ShiftRow, type ShiftListStats, type ShiftStatus } from "@/lib/contracts/shift";

const PERM = "pos.shifts";

// GET /api/pos/shifts — shift registry list + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.ShiftWhereInput = { ...sw };
  if (q) where.OR = [{ code: { contains: q } }, { name: { contains: q } }];
  if (status !== "All") where.status = status;

  const [rows, total, active] = await Promise.all([
    prisma.shift.findMany({ where, orderBy: { id: "desc" }, take: 200 }),
    prisma.shift.count({ where: sw }),
    prisma.shift.count({ where: { ...sw, status: "active" } }),
  ]);

  const shaped: ShiftRow[] = rows.map((s) => ({
    id: s.id, code: s.code, name: s.name, startTime: s.startTime, endTime: s.endTime,
    crossDay: s.crossDay, status: s.status as ShiftStatus, createdAt: s.createdAt.toISOString(),
  }));
  const stats: ShiftListStats = { total, active, inactive: total - active };
  return NextResponse.json({ ok: true, rows: shaped, stats });
}

// POST /api/pos/shifts — create a new shift.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "Shift" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ShiftCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const seg = scopeData(await getActiveScope(user), { branch: true });
  const dupe = await prisma.shift.findFirst({ where: { tenantId: user.tenantId, code: body.code }, select: { id: true } });
  if (dupe) return NextResponse.json({ ok: false, message: `Shift code "${body.code}" already exists.` }, { status: 422 });

  try {
    const created = await prisma.shift.create({
      data: {
        tenantId: user.tenantId, ...seg,
        code: body.code, name: body.name, description: body.description || null,
        startTime: body.startTime || "09:00", endTime: body.endTime || "21:00", crossDay: body.crossDay ?? false,
        gracePeriodMins: body.gracePeriodMins ?? null,
        openingCashMandatory: body.openingCashMandatory ?? true, closingCashMandatory: body.closingCashMandatory ?? true,
        physicalCountRequired: body.physicalCountRequired ?? false, managerApprovalRequired: body.managerApprovalRequired ?? false,
        maxCashDifference: body.maxCashDifference ?? null,
        status: body.status ?? "active",
        config: (body.config ?? {}) as Prisma.InputJsonValue, createdBy: user.id,
      },
      select: { id: true, code: true, name: true },
    });
    await writeAudit(prisma, user, {
      action: "shift.create", entity: "Shift", entityId: created.id,
      summary: `Created shift ${created.code} — ${created.name}`,
      meta: { code: created.code }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Shift created.", id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[pos-shift] create error", err);
    return NextResponse.json({ ok: false, message: "Could not create the shift." }, { status: 500 });
  }
}
