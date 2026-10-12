import { z } from "zod";

/**
 * Vehicle Trip Management — the common operational-journey engine sitting
 * OVER the existing Sales Dispatch and Purchase GRN flows (never replacing
 * them). Auto-created off Vehicle Gate Entry (see
 * src/lib/transport/vehicleTrip.ts), or created manually for "Other"
 * (non-sales/non-purchase) vehicle movement. Only `vehicleGateEntryId` is
 * stored — Weighment/Dispatch/GRN detail is resolved live through that gate
 * entry, never duplicated in.
 */

export const TRIP_TYPE_OPTS = ["Sales", "Purchase", "Other"] as const;
export type TripType = (typeof TRIP_TYPE_OPTS)[number];

/** "Other" trip purposes — a plain list for now; swap for a configurable
 * master later without changing the shape of anything that stores it. */
export const TRIP_PURPOSE_OPTS = [
  "Internal Material Movement", "Stock Transfer", "Inter-Plant Transfer", "Raw Material Movement",
  "Supplier Pickup", "Customer Pickup", "Maintenance Movement", "Empty Vehicle Movement",
  "Vehicle Testing", "Fuel/Service Movement", "Administrative Movement", "Other",
] as const;

export const TRIP_STATUS_OPTS = ["PLANNED", "ASSIGNED", "STARTED", "IN_TRANSIT", "ARRIVED", "COMPLETED", "ON_HOLD", "CANCELLED", "RETURNED"] as const;
export type TripStatus = (typeof TRIP_STATUS_OPTS)[number];

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  PLANNED: "Planned", ASSIGNED: "Assigned", STARTED: "Started", IN_TRANSIT: "In Transit", ARRIVED: "Arrived",
  COMPLETED: "Completed", ON_HOLD: "On Hold", CANCELLED: "Cancelled", RETURNED: "Returned",
};

export interface TripRow {
  id: number; tripNo: string; tripType: TripType | string; tripPurpose: string | null;
  vehicleId: number; vehicleNo: string;
  driverId: number | null; driverName: string | null;
  transportCompanyId: number | null; transportCompanyName: string | null;
  sourceLocation: string | null; destinationLocation: string | null;
  materialName: string | null; plannedQty: number | null; actualQty: number | null; uom: string | null;
  plannedStartAt: string | null; actualStartAt: string | null; arrivalAt: string | null; endAt: string | null;
  startOdometer: number | null; endOdometer: number | null; tripDistance: number | null;
  status: TripStatus | string;
  createdByName: string | null; createdAt: string;
}

export interface TripLinkedDocs {
  gateEntryNo: string | null; gateEntryId: number | null;
  salesOrderNo: string | null;
  loadDispatchNo: string | null; loadDispatchId: number | null;
  grnNo: string | null; grnId: number | null;
  weighmentNetWeight: number | null; weighmentUom: string | null;
}

export interface TripTimelineEvent { label: string; at: string | null; done: boolean }

export interface TripDetail extends TripRow {
  remarks: string | null;
  sourceModule: string | null; sourceTransactionType: string | null; sourceTransactionId: number | null; sourceTransactionNo: string | null;
  linked: TripLinkedDocs;
  timeline: TripTimelineEvent[];
  updatedByName: string | null; updatedAt: string;
}

export const tripCreateInput = z.object({
  tripType: z.enum(TRIP_TYPE_OPTS).default("Other"),
  tripPurpose: z.string().trim().max(60).optional().nullable(),
  vehicleId: z.coerce.number().int().positive("Vehicle is required."),
  driverId: z.coerce.number().int().positive().optional().nullable(),
  transportCompanyId: z.coerce.number().int().positive().optional().nullable(),
  sourceLocation: z.string().trim().max(200).optional().nullable(),
  destinationLocation: z.string().trim().max(200).optional().nullable(),
  materialName: z.string().trim().max(200).optional().nullable(),
  plannedQty: z.coerce.number().min(0).optional().nullable(),
  uom: z.string().trim().max(20).optional().nullable(),
  plannedStartAt: z.string().trim().max(30).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type TripCreateInput = z.infer<typeof tripCreateInput>;

export const tripStartInput = z.object({
  startOdometer: z.coerce.number().min(0).optional().nullable(),
  sourceLocation: z.string().trim().max(200).optional().nullable(),
  driverId: z.coerce.number().int().positive().optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export const tripTransitInput = z.object({
  currentLocation: z.string().trim().max(200).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export const tripArriveInput = z.object({
  destinationLocation: z.string().trim().max(200).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export const tripCompleteInput = z.object({
  endOdometer: z.coerce.number().min(0).optional().nullable(),
  actualQty: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export const tripHoldInput = z.object({ remarks: z.string().trim().max(2000).optional().nullable() });
export const tripCancelInput = z.object({ remarks: z.string().trim().min(1, "A reason is required.").max(2000) });
export const tripReturnInput = z.object({ remarks: z.string().trim().min(1, "A reason is required.").max(2000) });
