import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { maintenanceCompleteInput } from "@/lib/contracts/vehicleMaintenance";

const PERM = "masters.transport";

// POST /api/transport/vehicle-maintenance/[id]/complete — closes the service
// entry (Under Maintenance → Completed → vehicle available again) and, if
// this fulfils a Schedule, rolls that schedule's Last/Next Service forward.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const trip = await prisma.vehicleMaintenance.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!trip) return NextResponse.json({ ok: false, message: "Service entry not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleMaintenance", entityId: id, businessId: trip.businessId, branchId: trip.branchId });
  if (denied) return denied;
  if (trip.status !== "InProgress" && trip.status !== "Draft") return NextResponse.json({ ok: false, message: `Cannot complete a service entry that is ${trip.status}.` }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = maintenanceCompleteInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  const odometer = b.odometer ?? (trip.odometer != null ? Number(trip.odometer) : null);
  const nextDueDate = b.nextDueDate ? new Date(b.nextDueDate) : trip.nextDueDate;
  const nextDueKm = b.nextDueKm ?? (trip.nextDueKm != null ? Number(trip.nextDueKm) : null);

  await prisma.$transaction(async (tx) => {
    await tx.vehicleMaintenance.update({
      where: { id },
      data: { status: "Completed", odometer: odometer ?? undefined, nextDueDate: nextDueDate ?? undefined, nextDueKm: nextDueKm ?? undefined, remarks: b.remarks || undefined, updatedBy: user.id },
    });
    if (trip.scheduleId) {
      await tx.vehicleMaintenanceSchedule.update({
        where: { id: trip.scheduleId },
        data: { lastServiceDate: new Date(), lastServiceKm: odometer ?? undefined, nextDueDate: nextDueDate ?? undefined, nextDueKm: nextDueKm ?? undefined, updatedBy: user.id },
      });
    }
  });

  await writeAudit(prisma, user, { action: "vehicle_maintenance.complete", entity: "VehicleMaintenance", entityId: id, summary: `Completed service entry ${trip.maintenanceNo}`, businessId: trip.businessId, branchId: trip.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Service entry completed — vehicle is available again." });
}
