import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ShiftUpdateSchema, ShiftStatusSchema, type ShiftDetail, type ShiftConfig, type ShiftStatus } from "@/lib/contracts/shift";

const PERM = "pos.shifts";

// GET /api/pos/shifts/[id]
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const s = await prisma.shift.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!s) return NextResponse.json({ ok: false, message: "Shift not found." }, { status: 404 });

  const data: ShiftDetail = {
    id: s.id, code: s.code, name: s.name, description: s.description ?? "",
    startTime: s.startTime, endTime: s.endTime, crossDay: s.crossDay, gracePeriodMins: s.gracePeriodMins,
    openingCashMandatory: s.openingCashMandatory, closingCashMandatory: s.closingCashMandatory,
    physicalCountRequired: s.physicalCountRequired, managerApprovalRequired: s.managerApprovalRequired,
    maxCashDifference: s.maxCashDifference == null ? null : Number(s.maxCashDifference),
    status: s.status as ShiftStatus, config: (s.config ?? {}) as ShiftConfig, createdAt: s.createdAt.toISOString(),
  };
  return NextResponse.json({ ok: true, data });
}

// PUT /api/pos/shifts/[id] — edit shift.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "Shift", entityId: id });
  if (denied) return denied;

  const existing = await prisma.shift.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Shift not found." }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ShiftUpdateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  if (b.code && b.code !== existing.code) {
    const dupe = await prisma.shift.findFirst({ where: { tenantId: user.tenantId, code: b.code, NOT: { id } }, select: { id: true } });
    if (dupe) return NextResponse.json({ ok: false, message: `Shift code "${b.code}" already exists.` }, { status: 422 });
  }

  try {
    await prisma.shift.update({
      where: { id },
      data: {
        code: b.code, name: b.name,
        description: b.description !== undefined ? b.description || null : undefined,
        startTime: b.startTime, endTime: b.endTime, crossDay: b.crossDay,
        gracePeriodMins: b.gracePeriodMins !== undefined ? b.gracePeriodMins ?? null : undefined,
        openingCashMandatory: b.openingCashMandatory, closingCashMandatory: b.closingCashMandatory,
        physicalCountRequired: b.physicalCountRequired, managerApprovalRequired: b.managerApprovalRequired,
        maxCashDifference: b.maxCashDifference !== undefined ? b.maxCashDifference ?? null : undefined,
        status: b.status,
        config: b.config !== undefined ? (b.config as Prisma.InputJsonValue) : undefined,
      },
    });
    await writeAudit(prisma, user, {
      action: "shift.update", entity: "Shift", entityId: id,
      summary: `Updated shift ${b.code ?? existing.code}`,
      businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Shift updated.", id });
  } catch (err) {
    console.error("[pos-shift] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the shift." }, { status: 500 });
  }
}

// PATCH /api/pos/shifts/[id] — activate / deactivate.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "Shift", entityId: id });
  if (denied) return denied;

  const existing = await prisma.shift.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Shift not found." }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ShiftStatusSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 422 });

  await prisma.shift.update({ where: { id }, data: { status: parsed.data.status } });
  await writeAudit(prisma, user, {
    action: "shift.status", entity: "Shift", entityId: id,
    summary: `Shift ${existing.code} set ${parsed.data.status}`,
    businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: `Shift ${parsed.data.status === "active" ? "activated" : "deactivated"}.` });
}

// DELETE /api/pos/shifts/[id]
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "Shift", entityId: id });
  if (denied) return denied;

  const existing = await prisma.shift.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Shift not found." }, { status: 404 });
  const openSession = await prisma.terminalSession.findFirst({ where: { shiftId: id, status: "Open" }, select: { id: true } });
  if (openSession) return NextResponse.json({ ok: false, message: "Close the open session using this shift before deleting it." }, { status: 422 });

  await prisma.shift.delete({ where: { id } });
  await writeAudit(prisma, user, {
    action: "shift.delete", entity: "Shift", entityId: id,
    summary: `Deleted shift ${existing.code}`,
    businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Shift deleted." });
}
