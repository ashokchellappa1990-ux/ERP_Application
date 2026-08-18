import { prisma } from "@/lib/db/prisma";

/** Highest known odometer reading for a vehicle across every source this app
 * tracks (FuelEntry, FuelIssue, VehicleTrip) — the one authoritative value
 * used for odometer validation. Never a second/independent odometer system. */
export async function getLastKnownOdometer(tenantId: number, vehicleId: number, opts?: { excludeFuelEntryId?: number; excludeFuelIssueId?: number }): Promise<number | null> {
  const [entries, issues, trips] = await Promise.all([
    prisma.fuelEntry.findMany({ where: { tenantId, vehicleId, odometer: { not: null }, status: { not: "Cancelled" }, ...(opts?.excludeFuelEntryId ? { id: { not: opts.excludeFuelEntryId } } : {}) }, select: { odometer: true }, orderBy: { odometer: "desc" }, take: 1 }),
    prisma.fuelIssue.findMany({ where: { tenantId, vehicleId, odometer: { not: null }, status: { not: "Cancelled" }, ...(opts?.excludeFuelIssueId ? { id: { not: opts.excludeFuelIssueId } } : {}) }, select: { odometer: true }, orderBy: { odometer: "desc" }, take: 1 }),
    prisma.vehicleTrip.findMany({ where: { tenantId, vehicleId, endOdometer: { not: null } }, select: { endOdometer: true }, orderBy: { endOdometer: "desc" }, take: 1 }),
  ]);
  const values = [entries[0]?.odometer, issues[0]?.odometer, trips[0]?.endOdometer].filter((v): v is NonNullable<typeof v> => v != null).map(Number);
  return values.length ? Math.max(...values) : null;
}

/** Distance/efficiency vs. the previous fuel transaction (Entry or Issue,
 * whichever is most recent by odometer) for the SAME vehicle. Returns nulls
 * when there isn't enough data to be meaningful, rather than a misleading number. */
export async function computeEfficiency(tenantId: number, vehicleId: number, currentOdometer: number | null, currentQty: number, opts?: { excludeFuelEntryId?: number; excludeFuelIssueId?: number }): Promise<{ distanceSincePrev: number | null; efficiency: number | null }> {
  if (currentOdometer == null || currentQty <= 0) return { distanceSincePrev: null, efficiency: null };
  const prevOdometer = await getLastKnownOdometer(tenantId, vehicleId, opts);
  if (prevOdometer == null || prevOdometer >= currentOdometer) return { distanceSincePrev: null, efficiency: null };
  const distance = currentOdometer - prevOdometer;
  return { distanceSincePrev: distance, efficiency: Math.round((distance / currentQty) * 100) / 100 };
}
