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
export const USAGE_TYPE_OPTS = ["vehicle", "storage"] as const;

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
  // Optional — a tank/drum doesn't have to belong to a formal Fuel Station.
  stationId: z.coerce.number().int().positive().optional().nullable(),
  fuelType: z.enum(FUEL_TYPE_OPTS).default("Diesel"),
  capacity: z.coerce.number().min(0).default(0),
  minLevel: z.coerce.number().min(0).optional().nullable(),
  maxLevel: z.coerce.number().min(0).optional().nullable(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type TankInput = z.infer<typeof tankInput>;
export interface TankRow {
  id: number; tankCode: string; tankName: string; stationId: number | null; stationName: string | null;
  fuelType: string; capacity: number; currentQty: number; minLevel: number | null; maxLevel: number | null;
  status: string; lowStock: boolean;
}

/* --------------------------------------------------------------- entry */
// "Fuel Entry" in the UI is now labeled "Fuel Purchase" (vehicle-level,
// external refuel, a real GL-posting expense document) — the model/table
// name stays FuelEntry to avoid a data migration; only the UI label changed.
const fuelEntryLine = z.object({
  headId: z.coerce.number().int().positive().optional().nullable(),
  description: z.string().trim().max(300).optional().nullable(),
  amount: z.coerce.number().min(0).default(0),
});
export type FuelEntryLineInput = z.infer<typeof fuelEntryLine>;

const fuelEntryPayment = z.object({
  mode: z.string().trim().min(1).max(30),
  amount: z.coerce.number().min(0).default(0),
  reference: z.string().trim().max(80).optional().nullable(),
});
export type FuelEntryPaymentInput = z.infer<typeof fuelEntryPayment>;

const fuelEntryAttachment = z.object({
  fileName: z.string(), fileUrl: z.string(), fileType: z.string().nullable().optional(), size: z.coerce.number().optional(),
});
export type FuelEntryAttachmentInput = z.infer<typeof fuelEntryAttachment>;

export const fuelEntryInput = z.object({
  entryDate: z.string().trim().min(1, "Date is required.").max(30),
  // "vehicle" (default) = fuel goes straight into a vehicle, vehicleId
  // required below; "storage" = bought into a barrel/drum for later use.
  usageType: z.enum(USAGE_TYPE_OPTS).default("vehicle"),
  vehicleId: z.coerce.number().int().positive().optional().nullable(),
  driverId: z.coerce.number().int().positive().optional().nullable(),
  tripId: z.coerce.number().int().positive().optional().nullable(),
  // Required instead of vehicleId when usageType is "storage" — which Tank
  // (FuelTank master) this purchase tops up; its currentQty is incremented.
  tankId: z.coerce.number().int().positive().optional().nullable(),
  fuelType: z.enum(FUEL_TYPE_OPTS).default("Diesel"),
  // Supplier/vendor — never free-typed; the name is always resolved
  // server-side from Supplier Master.
  fuelStationId: z.coerce.number().int().positive().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  uom: z.literal("Litre").default("Litre"),
  rate: z.coerce.number().min(0, "Rate cannot be negative.").default(0),
  odometer: z.coerce.number().min(0).optional().nullable(),
  invoiceNo: z.string().trim().max(60).optional().nullable(),
  invoiceDate: z.string().trim().max(30).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  overrideOdometerWarning: z.coerce.boolean().default(false),
  // Accounting — Expense Head (GL account), GST, and Payment (AP vs Pay Now).
  headId: z.coerce.number().int().positive().optional().nullable(),
  gstApplicable: z.coerce.boolean().default(false),
  gstPct: z.coerce.number().min(0).max(100).optional().nullable(),
  supplierGstin: z.string().trim().max(20).optional().nullable(),
  postingType: z.enum(["ap", "paynow"]).default("paynow"),
  bankId: z.coerce.number().int().positive().optional().nullable(),
  bankName: z.string().trim().max(160).optional().nullable(),
  bankAccount: z.string().trim().max(60).optional().nullable(),
  lines: z.array(fuelEntryLine).default([]),
  payments: z.array(fuelEntryPayment).default([]),
  attachments: z.array(fuelEntryAttachment).default([]),
}).superRefine((v, ctx) => {
  if (v.usageType === "vehicle" && !v.vehicleId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["vehicleId"], message: "Vehicle is required." });
  if (v.usageType === "storage" && !v.tankId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tankId"], message: "Tank is required." });
});
export type FuelEntryInput = z.infer<typeof fuelEntryInput>;

export interface FuelEntryRow {
  id: number; entryNo: string; entryDate: string; usageType: string; vehicleId: number | null; vehicleNo: string | null;
  tankId: number | null; tankName: string | null;
  driverId: number | null; driverName: string | null; tripId: number | null; tripNo: string | null;
  fuelType: string; fuelStationName: string | null; quantity: number; rate: number; amount: number;
  odometer: number | null; status: string; createdByName: string | null; createdAt: string;
  totalAmount: number; postingType: string;
}
export interface FuelEntryLineOut { id: number; headId: number | null; headName: string | null; description: string | null; amount: number }
export interface FuelEntryPaymentOut { id: number; mode: string; amount: number; reference: string | null }
export interface FuelEntryDetail extends FuelEntryRow {
  uom: string; invoiceNo: string | null; invoiceDate: string | null; remarks: string | null;
  fuelStationId: number | null;
  efficiency: number | null; distanceSincePrev: number | null;
  updatedByName: string | null; updatedAt: string;
  cancelledByName: string | null; cancelledAt: string | null; cancellationReason: string | null;
  headId: number | null; headName: string | null; gstApplicable: boolean; gstPct: number | null; taxAmount: number; otherCost: number;
  supplierGstin: string | null; bankId: number | null; bankName: string | null; bankAccount: string | null;
  lines: FuelEntryLineOut[]; payments: FuelEntryPaymentOut[]; attachments: FuelEntryAttachmentInput[];
}

/* --------------------------------------------------------------- issue */
export const TRANSFER_TYPE_OPTS = ["tank_vehicle", "tank_tank"] as const;

export const fuelIssueInput = z.object({
  issueDate: z.string().trim().min(1, "Date is required.").max(30),
  // "tank_vehicle" (default) dispenses to a vehicle; "tank_tank" moves fuel
  // to another FuelTank instead — vehicleId/toTankId are required exclusively
  // based on this, enforced below.
  transferType: z.enum(TRANSFER_TYPE_OPTS).default("tank_vehicle"),
  tankId: z.coerce.number().int().positive("Tank is required."),
  toTankId: z.coerce.number().int().positive().optional().nullable(),
  vehicleId: z.coerce.number().int().positive().optional().nullable(),
  driverId: z.coerce.number().int().positive().optional().nullable(),
  tripId: z.coerce.number().int().positive().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  rate: z.coerce.number().min(0, "Rate cannot be negative.").default(0),
  odometer: z.coerce.number().min(0).optional().nullable(),
  dispenser: z.string().trim().max(100).optional().nullable(),
  operator: z.string().trim().max(150).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  overrideOdometerWarning: z.coerce.boolean().default(false),
}).superRefine((v, ctx) => {
  if (v.transferType === "tank_vehicle" && !v.vehicleId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["vehicleId"], message: "Vehicle is required." });
  if (v.transferType === "tank_tank") {
    if (!v.toTankId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toTankId"], message: "Destination tank is required." });
    else if (v.toTankId === v.tankId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toTankId"], message: "Destination tank must be different from the source tank." });
  }
});
export type FuelIssueInput = z.infer<typeof fuelIssueInput>;

export interface FuelIssueRow {
  id: number; issueNo: string; issueDate: string; transferType: string; tankId: number; tankName: string;
  toTankId: number | null; toTankName: string | null;
  vehicleId: number | null; vehicleNo: string | null; driverId: number | null; driverName: string | null;
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

/* --------------------------------------------------------- storage log */
// Tank-wise stock ledger — Opening/Purchase/Transfer(Issue)/Closing per day,
// built from FuelEntry (usageType="storage") + legacy FuelPurchase (both
// increment FuelTank.currentQty) against FuelIssue (which decrements it).
export interface FuelStorageTxn { id: number; refNo: string; qty: number; amount: number; note: string | null }
export interface FuelStorageLogRow {
  tankId: number; tankName: string; date: string; opening: number; purchaseQty: number; issueQty: number; closing: number;
  purchases: FuelStorageTxn[]; issues: FuelStorageTxn[];
}
