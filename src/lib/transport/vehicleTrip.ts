import { prisma } from "@/lib/db/prisma";
import type { TripStatus } from "@/lib/contracts/vehicleTrip";

/** Controlled status transitions — mirrors the same NEXT-table pattern used
 * by Gate Entry's own status route (src/app/api/transport/gate-entry/[id]/status/route.ts).
 * "hold" is reachable from every in-progress state; "resume" always targets
 * whatever `preHoldStatus` was captured when it went on hold. */
export const TRIP_NEXT: Record<string, Record<string, TripStatus>> = {
  start:    { PLANNED: "STARTED", ASSIGNED: "STARTED" },
  transit:  { STARTED: "IN_TRANSIT" },
  arrive:   { STARTED: "ARRIVED", IN_TRANSIT: "ARRIVED" },
  complete: { ARRIVED: "COMPLETED", IN_TRANSIT: "COMPLETED" },
  hold:     { PLANNED: "ON_HOLD", ASSIGNED: "ON_HOLD", STARTED: "ON_HOLD", IN_TRANSIT: "ON_HOLD", ARRIVED: "ON_HOLD" },
  cancel:   { PLANNED: "CANCELLED", ASSIGNED: "CANCELLED", STARTED: "CANCELLED", IN_TRANSIT: "CANCELLED" },
  return:   { STARTED: "RETURNED", IN_TRANSIT: "RETURNED", ARRIVED: "RETURNED" },
};

/** Idempotent — a Trip already exists for this Gate Entry → return it as-is.
 * Called right after Gate Entry create commits (src/app/api/transport/gate-entry/route.ts),
 * always wrapped in try/catch there so a Trip-side failure can never block or
 * revert the Gate Entry itself (same "best-effort side effect" convention
 * GRN already uses for its own post-create back-links). */
export async function createOrLinkTripForGateEntry(params: {
  tenantId: number; businessId: number | null; branchId: number | null;
  gateEntryId: number; gateEntryNo: string; entryType: string;
  vehicleId: number; driverId: number | null; transportCompanyId: number | null;
  supplierName: string | null; customerName: string | null; deliveryAddress: string | null;
  location: string | null; sourceWarehouse: string | null; destinationWarehouse: string | null;
  expectedMaterial: string | null; expectedLoadWeight: number | null;
  createdBy: number;
}): Promise<number> {
  const sourceModule = params.entryType === "RawMaterial" ? "PURCHASE" : "SALES";
  const existing = await prisma.vehicleTrip.findFirst({
    where: { tenantId: params.tenantId, sourceModule, sourceTransactionType: "GATE_ENTRY", sourceTransactionId: params.gateEntryId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const tripType = params.entryType === "RawMaterial" ? "Purchase" : "Sales";
  const isPurchase = tripType === "Purchase";
  const sourceLocation = isPurchase ? params.supplierName : (params.sourceWarehouse ?? params.location);
  const destinationLocation = isPurchase ? params.location : (params.destinationWarehouse ?? params.deliveryAddress ?? params.customerName);

  const created = await prisma.vehicleTrip.create({
    data: {
      tenantId: params.tenantId, businessId: params.businessId ?? undefined, branchId: params.branchId ?? undefined,
      tripNo: "TMP", tripType,
      vehicleId: params.vehicleId, driverId: params.driverId ?? undefined, transportCompanyId: params.transportCompanyId ?? undefined,
      sourceLocation: sourceLocation ?? undefined, destinationLocation: destinationLocation ?? undefined,
      materialName: params.expectedMaterial ?? undefined, plannedQty: params.expectedLoadWeight ?? undefined,
      plannedStartAt: new Date(),
      sourceModule, sourceTransactionType: "GATE_ENTRY", sourceTransactionId: params.gateEntryId, sourceTransactionNo: params.gateEntryNo,
      vehicleGateEntryId: params.gateEntryId,
      status: "ASSIGNED",
      createdBy: params.createdBy,
    },
    select: { id: true },
  });
  const tripNo = `TRIP-${String(created.id).padStart(6, "0")}`;
  await prisma.vehicleTrip.update({ where: { id: created.id }, data: { tripNo } });
  return created.id;
}
