import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { scheduleInput, type ScheduleRow } from "@/lib/contracts/vehicleMaintenance";
import { getCurrentOdometer, computeDueStatus } from "@/lib/transport/vehicleMaintenance";

// Shares the Transport masters' permission key — same one-key-per-module
// convention already used for every other Vehicle Management screen this
// session (no per-action RBAC granularity exists anywhere in this app).
const PERM = "masters.transport";

function toDate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dateStr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.VehicleMaintenanceScheduleWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (status && status !== "All") where.status = status;
  if (q) where.OR = [{ scheduleNo: { contains: q } }, { maintenanceType: { contains: q } }];

  const rows = await prisma.vehicleMaintenanceSchedule.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const vehicles = vehicleIds.length ? await prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [];
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const currentKmByVehicle = new Map<number, number | null>();
  await Promise.all(vehicleIds.map(async (id) => currentKmByVehicle.set(id, await getCurrentOdometer(user.tenantId, id))));

  const list: ScheduleRow[] = rows.map((r) => {
    const currentKm = currentKmByVehicle.get(r.vehicleId) ?? null;
    const due = computeDueStatus({ triggerType: r.triggerType, nextDueDate: r.nextDueDate, nextDueKm: r.nextDueKm != null ? Number(r.nextDueKm) : null, currentKm, alertBeforeDays: r.alertBeforeDays, alertBeforeKm: r.alertBeforeKm != null ? Number(r.alertBeforeKm) : null });
    return {
      id: r.id, scheduleNo: r.scheduleNo, vehicleId: r.vehicleId, vehicleNo: vMap.get(r.vehicleId) ?? "—",
      maintenanceType: r.maintenanceType, triggerType: r.triggerType,
      lastServiceDate: dateStr(r.lastServiceDate), lastServiceKm: r.lastServiceKm != null ? Number(r.lastServiceKm) : null,
      nextDueDate: dateStr(r.nextDueDate), nextDueKm: r.nextDueKm != null ? Number(r.nextDueKm) : null,
      status: r.status, dueStatus: r.status === "Inactive" ? "Not Set" : due.status, dueInKm: due.dueInKm, dueInDays: due.dueInDays,
      currentKm, remarks: r.remarks,
    };
  });
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleMaintenanceSchedule" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = scheduleInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: b.vehicleId, tenantId: user.tenantId, deletedAt: null } });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 422 });

  const seg = await resolveWriteScope(user);
  const created = await prisma.vehicleMaintenanceSchedule.create({
    data: {
      tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
      scheduleNo: "TMP", vehicleId: b.vehicleId, maintenanceType: b.maintenanceType, triggerType: b.triggerType,
      intervalKm: b.intervalKm ?? null, intervalMonths: b.intervalMonths ?? null,
      lastServiceDate: toDate(b.lastServiceDate), lastServiceKm: b.lastServiceKm ?? null,
      nextDueDate: toDate(b.nextDueDate), nextDueKm: b.nextDueKm ?? null,
      alertBeforeDays: b.alertBeforeDays ?? null, alertBeforeKm: b.alertBeforeKm ?? null,
      status: b.status, remarks: b.remarks ?? null, createdBy: user.id,
    },
  });
  const scheduleNo = `MSCH-${String(created.id).padStart(5, "0")}`;
  await prisma.vehicleMaintenanceSchedule.update({ where: { id: created.id }, data: { scheduleNo } });

  await writeAudit(prisma, user, { action: "vehicle_maintenance_schedule.create", entity: "VehicleMaintenanceSchedule", entityId: created.id, summary: `Created schedule ${scheduleNo} (${b.maintenanceType}) for vehicle ${vehicle.vehicleNo}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, scheduleNo, message: "Schedule created." }, { status: 201 });
}
