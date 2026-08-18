import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { scheduleInput } from "@/lib/contracts/vehicleMaintenance";
import { getCurrentOdometer, computeDueStatus } from "@/lib/transport/vehicleMaintenance";

const PERM = "masters.transport";

function toDate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dateStr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

async function toDetail(user: { tenantId: number }, r: NonNullable<Awaited<ReturnType<typeof prisma.vehicleMaintenanceSchedule.findFirst>>>) {
  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: r.vehicleId }, select: { vehicleNo: true } });
  const currentKm = await getCurrentOdometer(user.tenantId, r.vehicleId);
  const due = computeDueStatus({ triggerType: r.triggerType, nextDueDate: r.nextDueDate, nextDueKm: r.nextDueKm != null ? Number(r.nextDueKm) : null, currentKm, alertBeforeDays: r.alertBeforeDays, alertBeforeKm: r.alertBeforeKm != null ? Number(r.alertBeforeKm) : null });
  return {
    id: r.id, scheduleNo: r.scheduleNo, vehicleId: r.vehicleId, vehicleNo: vehicle?.vehicleNo ?? "—",
    maintenanceType: r.maintenanceType, triggerType: r.triggerType,
    intervalKm: r.intervalKm != null ? Number(r.intervalKm) : null, intervalMonths: r.intervalMonths,
    lastServiceDate: dateStr(r.lastServiceDate), lastServiceKm: r.lastServiceKm != null ? Number(r.lastServiceKm) : null,
    nextDueDate: dateStr(r.nextDueDate), nextDueKm: r.nextDueKm != null ? Number(r.nextDueKm) : null,
    alertBeforeDays: r.alertBeforeDays, alertBeforeKm: r.alertBeforeKm != null ? Number(r.alertBeforeKm) : null,
    status: r.status, dueStatus: r.status === "Inactive" ? "Not Set" : due.status, dueInKm: due.dueInKm, dueInDays: due.dueInDays,
    currentKm, remarks: r.remarks,
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const r = await prisma.vehicleMaintenanceSchedule.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Schedule not found." }, { status: 404 });
  return NextResponse.json({ ok: true, row: await toDetail(user, r) });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleMaintenanceSchedule.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Schedule not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleMaintenanceSchedule", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = scheduleInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const updated = await prisma.vehicleMaintenanceSchedule.update({
    where: { id },
    data: {
      vehicleId: b.vehicleId, maintenanceType: b.maintenanceType, triggerType: b.triggerType,
      intervalKm: b.intervalKm ?? null, intervalMonths: b.intervalMonths ?? null,
      lastServiceDate: toDate(b.lastServiceDate), lastServiceKm: b.lastServiceKm ?? null,
      nextDueDate: toDate(b.nextDueDate), nextDueKm: b.nextDueKm ?? null,
      alertBeforeDays: b.alertBeforeDays ?? null, alertBeforeKm: b.alertBeforeKm ?? null,
      status: b.status, remarks: b.remarks ?? null, updatedBy: user.id,
    },
  });
  await writeAudit(prisma, user, { action: "vehicle_maintenance_schedule.update", entity: "VehicleMaintenanceSchedule", entityId: id, summary: `Updated schedule ${updated.scheduleNo}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, row: await toDetail(user, updated), message: "Schedule updated." });
}
