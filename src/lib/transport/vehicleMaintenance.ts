import { prisma } from "@/lib/db/prisma";
import type { DueStatus } from "@/lib/contracts/vehicleMaintenance";

/** The one authoritative "current KM" source for a vehicle — the latest
 * completed trip's end odometer. No second odometer value is stored
 * anywhere in Maintenance; this is always resolved live. */
export async function getCurrentOdometer(tenantId: number, vehicleId: number): Promise<number | null> {
  const last = await prisma.vehicleTrip.findFirst({
    where: { tenantId, vehicleId, endOdometer: { not: null } },
    orderBy: [{ endAt: "desc" }, { id: "desc" }],
    select: { endOdometer: true },
  });
  return last?.endOdometer != null ? Number(last.endOdometer) : null;
}

export function computeDueStatus(params: {
  triggerType: string; nextDueDate: Date | null; nextDueKm: number | null; currentKm: number | null;
  alertBeforeDays?: number | null; alertBeforeKm?: number | null; today?: Date;
}): { status: DueStatus; dueInKm: number | null; dueInDays: number | null } {
  const today = params.today ?? new Date();
  let dueInKm: number | null = null;
  let dueInDays: number | null = null;

  if ((params.triggerType === "KM" || params.triggerType === "Both") && params.nextDueKm != null && params.currentKm != null) {
    dueInKm = params.nextDueKm - params.currentKm;
  }
  if ((params.triggerType === "Date" || params.triggerType === "Both") && params.nextDueDate) {
    dueInDays = Math.round((params.nextDueDate.getTime() - today.getTime()) / 86400000);
  }

  if (dueInKm == null && dueInDays == null) return { status: "Not Set", dueInKm, dueInDays };

  const overdue = (dueInKm != null && dueInKm < 0) || (dueInDays != null && dueInDays < 0);
  if (overdue) return { status: "Overdue", dueInKm, dueInDays };

  const alertKm = params.alertBeforeKm ?? undefined;
  const alertDays = params.alertBeforeDays ?? 7;
  const dueSoon = (dueInKm != null && alertKm != null && dueInKm <= alertKm) || (dueInDays != null && dueInDays <= alertDays);
  return { status: dueSoon ? "Due" : "Upcoming", dueInKm, dueInDays };
}

/** A vehicle is unavailable for a new trip/assignment while it has an
 * in-progress Service Entry or an open Breakdown. Deliberately defensive —
 * any unexpected error is treated as "not blocking" rather than ever hard-
 * failing an unrelated Trip/Assignment creation because of a maintenance
 * lookup issue. */
export async function isVehicleUnderMaintenance(tenantId: number, vehicleId: number): Promise<boolean> {
  try {
    const [svc, brk] = await Promise.all([
      prisma.vehicleMaintenance.findFirst({ where: { tenantId, vehicleId, status: "InProgress" }, select: { id: true } }),
      prisma.vehicleBreakdown.findFirst({ where: { tenantId, vehicleId, status: { notIn: ["Completed", "Cancelled"] } }, select: { id: true } }),
    ]);
    return !!(svc || brk);
  } catch {
    return false;
  }
}
