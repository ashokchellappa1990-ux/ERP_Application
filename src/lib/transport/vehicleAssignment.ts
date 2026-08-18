import { prisma } from "@/lib/db/prisma";

/** Inclusive date-range overlap; a null end date means "open-ended" (ongoing). */
function rangesOverlap(aFrom: Date, aTo: Date | null, bFrom: Date, bTo: Date | null): boolean {
  const aEnd = aTo ?? new Date(8640000000000000);
  const bEnd = bTo ?? new Date(8640000000000000);
  return aFrom.getTime() <= bEnd.getTime() && bFrom.getTime() <= aEnd.getTime();
}

/** Exact-duplicate guard — same vehicle + driver + type + date range, not
 * already cancelled. */
export async function findDuplicateAssignment(
  tenantId: number, vehicleId: number, driverId: number, assignmentType: string,
  fromDate: Date, toDate: Date | null, excludeId?: number,
) {
  const rows = await prisma.vehicleDriverAssignment.findMany({
    where: { tenantId, vehicleId, driverId, assignmentType, status: { not: "Cancelled" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, fromDate: true, toDate: true },
  });
  return rows.find((r) => r.fromDate.getTime() === fromDate.getTime() && (r.toDate?.getTime() ?? null) === (toDate?.getTime() ?? null)) ?? null;
}

/** Primary-driver overlap guard — only one Primary per vehicle for any given
 * day, unless the earlier one is Cancelled (a date-elapsed "Completed" one
 * naturally stops overlapping once its toDate is before the new fromDate). */
export async function findOverlappingPrimary(
  tenantId: number, vehicleId: number, fromDate: Date, toDate: Date | null, excludeId?: number,
) {
  const rows = await prisma.vehicleDriverAssignment.findMany({
    where: { tenantId, vehicleId, isPrimary: true, status: "Active", ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, fromDate: true, toDate: true, driverId: true },
  });
  return rows.find((r) => rangesOverlap(fromDate, toDate, r.fromDate, r.toDate)) ?? null;
}
