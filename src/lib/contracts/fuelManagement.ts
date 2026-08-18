import { z } from "zod";

/**
 * Fuel Management — additive over VehicleMaster/DriverMaster/VehicleTrip/
 * Supplier (all referenced by id, never duplicated). "Fuel Entry" = external
 * refuelling (no stock impact); "Fuel Issue" = dispensed from an internal
 * FuelTank (decrements stock). Odometer's "last known reading" is always
 * resolved live across FuelEntry/FuelIssue/VehicleTrip — no second stored
 * odometer system.
 */

export const FUEL_TYPE_OPTS = ["Diesel", "Petrol", "CNG", "EV Charging", "Other"] as const;
export const FUEL_TXN_STATUS_OPTS = ["Draft", "Confirmed", "Cancelled"] as const;
export const ADJUSTMENT_TYPE_OPTS = ["Increase", "Decrease"] as const;
export const ADJUSTMENT_REASON_OPTS = ["Measurement Difference", "Leakage", "Evaporation", "Stock Correction", "Calibration Difference", "Other"] as const;
export const PAYMENT_MODE_OPTS = ["Cash", "Card", "Fuel Card", "UPI", "Credit/Account", "Other"] as const;

/* ------------------------------------------------------- station / tank */
export const stationInput = z.object({
  code: z.string().trim().min(1, "Code is required.").max(40),
  name: z.string().trim().min(1, "Name is required.").max(150),
  location: z.string().trim().max(200).optional().nullable(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type StationInput = z.infer<typeof stationInput>;
export interface StationRow { id: number; code: string; name: string; location: string | null; status: string; tankCount: number }

export const tankInput = z.object({
  tankCode: z.string().trim().min(1, "Tank code is required.").max(40),
  tankName: z.string().trim().min(1, "Tank name is required.").max(150),
  stationId: z.coerce.number().int().positive("Station is required."),
  fuelType: z.enum(FUEL_TYPE_OPTS).default("Diesel"),
  capacity: z.coerce.number().min(0).default(0),
  minLevel: z.coerce.number().min(0).optional().nullable(),
  maxLevel: z.coerce.number().min(0).optional().nullable(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type TankInput = z.infer<typeof tankInput>;
export interface TankRow {
  id: number; tankCode: string; tankName: string; stationId: number; stationName: string;
  fuelType: string; capacity: number; currentQty: number; minLevel: number | null; maxLevel: number | null;
  status: string; lowStock: boolean;
}

/* --------------------------------------------------------------- entry */
export const fuelEntryInput = z.object({
  entryDate: z.string().trim().min(1, "Date is required.").max(30),
  vehicleId: z.coerce.number().int().positive("Vehicle is required."),
  driverId: z.coerce.number().int().positive().optional().nullable(),
  tripId: z.coerce.number().int().positive().optional().nullable(),
  fuelType: z.enum(FUEL_TYPE_OPTS).default("Diesel"),
  fuelStationId: z.coerce.number().int().positive().optional().nullable(),
  fuelStationName: z.string().trim().max(200).optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  uom: z.string().trim().max(20).default("Litre"),
  rate: z.coerce.number().min(0, "Rate cannot be negative.").default(0),
  odometer: z.coerce.number().min(0).optional().nullable(),
  invoiceNo: z.string().trim().max(60).optional().nullable(),
  invoiceDate: z.string().trim().max(30).optional().nullable(),
  paymentMode: z.string().trim().max(30).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  overrideOdometerWarning: z.coerce.boolean().default(false),
});
export type FuelEntryInput = z.infer<typeof fuelEntryInput>;

export interface FuelEntryRow {
  id: number; entryNo: string; entryDate: string; vehicleId: number; vehicleNo: string;
  driverId: number | null; driverName: string | null; tripId: number | null; tripNo: string | null;
  fuelType: string; fuelStationName: string | null; quantity: number; rate: number; amount: number;
  odometer: number | null; status: string; createdByName: string | null; createdAt: string;
}
export interface FuelEntryDetail extends FuelEntryRow {
  uom: string; invoiceNo: string | null; invoiceDate: string | null; paymentMode: string | null; remarks: string | null;
  fuelStationId: number | null;
  efficiency: number | null; distanceSincePrev: number | null;
  updatedByName: string | null; updatedAt: string;
  cancelledByName: string | null; cancelledAt: string | null; cancellationReason: string | null;
}

/* --------------------------------------------------------------- issue */
export const fuelIssueInput = z.object({
  issueDate: z.string().trim().min(1, "Date is required.").max(30),
  tankId: z.coerce.number().int().positive("Tank is required."),
  vehicleId: z.coerce.number().int().positive("Vehicle is required."),
  driverId: z.coerce.number().int().positive().optional().nullable(),
  tripId: z.coerce.number().int().positive().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  rate: z.coerce.number().min(0, "Rate cannot be negative.").default(0),
  odometer: z.coerce.number().min(0).optional().nullable(),
  dispenser: z.string().trim().max(100).optional().nullable(),
  operator: z.string().trim().max(150).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  overrideOdometerWarning: z.coerce.boolean().default(false),
});
export type FuelIssueInput = z.infer<typeof fuelIssueInput>;

export interface FuelIssueRow {
  id: number; issueNo: string; issueDate: string; tankId: number; tankName: string;
  vehicleId: number; vehicleNo: string; driverId: number | null; driverName: string | null;
  tripId: number | null; tripNo: string | null; quantity: number; rate: number; amount: number;
  odometer: number | null; status: string; createdByName: string | null; createdAt: string;
}
export interface FuelIssueDetail extends FuelIssueRow {
  stationId: number | null; dispenser: string | null; operator: string | null; remarks: string | null;
  efficiency: number | null; distanceSincePrev: number | null;
  updatedByName: string | null; updatedAt: string;
  cancelledByName: string | null; cancelledAt: string | null; cancellationReason: string | null;
}

/* ------------------------------------------------------------ purchase */
export const fuelPurchaseInput = z.object({
  purchaseDate: z.string().trim().min(1, "Date is required.").max(30),
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  supplierName: z.string().trim().max(200).optional().nullable(),
  fuelType: z.enum(FUEL_TYPE_OPTS).default("Diesel"),
  tankId: z.coerce.number().int().positive("Tank is required."),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  rate: z.coerce.number().min(0, "Rate cannot be negative.").default(0),
  invoiceNo: z.string().trim().max(60).optional().nullable(),
  invoiceDate: z.string().trim().max(30).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type FuelPurchaseInput = z.infer<typeof fuelPurchaseInput>;

export interface FuelPurchaseRow {
  id: number; purchaseNo: string; purchaseDate: string; supplierName: string | null;
  tankId: number; tankName: string; fuelType: string; quantity: number; rate: number; amount: number;
  status: string; createdByName: string | null; createdAt: string;
}

/* --------------------------------------------------------- adjustment */
export const stockAdjustmentInput = z.object({
  tankId: z.coerce.number().int().positive("Tank is required."),
  adjustmentDate: z.string().trim().min(1, "Date is required.").max(30),
  adjustmentType: z.enum(ADJUSTMENT_TYPE_OPTS),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  reason: z.enum(ADJUSTMENT_REASON_OPTS),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentInput>;
export interface AdjustmentRow {
  id: number; adjustmentNo: string; tankId: number; tankName: string; adjustmentDate: string;
  adjustmentType: string; quantity: number; reason: string; createdByName: string | null; createdAt: string;
}

export const cancelInput = z.object({ cancellationReason: z.string().trim().min(1, "A reason is required.").max(1000) });
