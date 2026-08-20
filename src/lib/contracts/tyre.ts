import { z } from "zod";

/**
 * Tyre Management — additive Fleet Management feature over VehicleMaster/
 * DriverMaster/VehicleTrip/Supplier/Product (all referenced by id, never
 * duplicated). Vehicle KM for install/removal snapshots is resolved live via
 * getCurrentOdometer() (src/lib/transport/vehicleMaintenance.ts) — no second
 * odometer store. Position codes are data-driven (TyrePositionTemplate/
 * TyrePositionCode) instead of hardcoded.
 */

export const TYRE_STATUS_OPTS = [
  "In Stock", "Available", "Fitted", "Under Inspection", "Under Repair",
  "Under Retreading", "Removed", "Scrapped", "Sold", "Lost", "Warranty Claim",
] as const;
export const TYRE_TYPE_OPTS = ["Radial", "Bias", "Tubeless", "Tube"] as const;
export const TYRE_CATEGORY_OPTS = ["Steer", "Drive", "Trailer", "Spare"] as const;
export const REMOVAL_REASON_OPTS = ["Rotation", "Puncture", "Wear", "Damage", "Retreading", "Warranty", "Scrap", "Other"] as const;
export const INSPECTION_CONDITION_OPTS = ["Good", "Wear", "Damage", "Critical"] as const;
export const RECOMMENDED_ACTION_OPTS = ["None", "Rotate", "Repair", "Retread", "Replace", "Scrap"] as const;
export const REPAIR_STATUS_OPTS = ["Draft", "InProgress", "Completed", "Cancelled"] as const;
export const RETREAD_STATUS_OPTS = ["Sent", "InProgress", "Received", "Rejected", "Cancelled"] as const;
export const WARRANTY_STATUS_OPTS = ["Filed", "UnderReview", "Approved", "Rejected", "Settled"] as const;

/* ----------------------------------------------------------- master */
export const tyreMasterInput = z.object({
  tyreCode: z.string().trim().max(40).optional().nullable(),
  serialNo: z.string().trim().max(80).optional().nullable(),
  brand: z.string().trim().max(80).optional().nullable(),
  pattern: z.string().trim().max(80).optional().nullable(),
  size: z.string().trim().max(40).optional().nullable(),
  tyreType: z.enum(TYRE_TYPE_OPTS).optional().nullable(),
  category: z.enum(TYRE_CATEGORY_OPTS).optional().nullable(),
  productId: z.coerce.number().int().positive().optional().nullable(),
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  purchaseDate: z.string().trim().max(20).optional().nullable(),
  purchaseInvoiceNo: z.string().trim().max(60).optional().nullable(),
  purchaseCost: z.coerce.number().min(0).default(0),
  warrantyMonths: z.coerce.number().int().min(0).optional().nullable(),
  warrantyKm: z.coerce.number().min(0).optional().nullable(),
  warrantyExpiryDate: z.string().trim().max(20).optional().nullable(),
  originalTreadDepthMm: z.coerce.number().min(0).optional().nullable(),
  minTreadDepthMm: z.coerce.number().min(0).default(1.6),
  ratedPressurePsi: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type TyreMasterInput = z.infer<typeof tyreMasterInput>;

export const tyreStatusInput = z.object({
  action: z.enum(["makeAvailable", "scrap", "sell", "reportLost", "fileWarrantyClaim"]),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type TyreStatusInput = z.infer<typeof tyreStatusInput>;

export interface TyreRow {
  id: number; tyreCode: string; serialNo: string | null; brand: string | null; size: string | null;
  tyreType: string | null; category: string | null; status: string;
  currentVehicleId: number | null; currentVehicleNo: string | null; currentPositionCode: string | null;
  purchaseCost: number; retreadCount: number; createdAt: string;
}
export interface TyreDetail extends TyreRow {
  pattern: string | null; productId: number | null; supplierId: number | null; supplierName: string | null;
  purchaseDate: string | null; purchaseInvoiceNo: string | null;
  warrantyMonths: number | null; warrantyKm: number | null; warrantyExpiryDate: string | null;
  originalTreadDepthMm: number | null; minTreadDepthMm: number | null; ratedPressurePsi: number | null;
  remarks: string | null;
  lifeKm: number; firstLifeKm: number; retreadLifeKm: number; netCost: number; costPerKm: number | null;
}

/* --------------------------------------------------- position template */
export const positionTemplateInput = z.object({
  templateName: z.string().trim().min(1, "Template name is required.").max(80),
  vehicleType: z.string().trim().max(60).optional().nullable(),
  numberOfAxles: z.coerce.number().int().min(1).optional().nullable(),
  isDefault: z.coerce.boolean().default(false),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type PositionTemplateInput = z.infer<typeof positionTemplateInput>;

export const positionCodeInput = z.object({
  positionCode: z.string().trim().min(1, "Position code is required.").max(20),
  positionLabel: z.string().trim().min(1, "Position label is required.").max(60),
  axleNumber: z.coerce.number().int().min(1).optional().nullable(),
  side: z.string().trim().max(10).optional().nullable(),
  wheelSet: z.string().trim().max(10).optional().nullable(),
  displayOrder: z.coerce.number().int().min(1).default(1),
});
export type PositionCodeInput = z.infer<typeof positionCodeInput>;

export interface PositionTemplateRow {
  id: number; templateName: string; vehicleType: string | null; numberOfAxles: number | null;
  isDefault: boolean; status: string; codeCount: number;
}
export interface PositionCodeRow { id: number; positionCode: string; positionLabel: string; axleNumber: number | null; side: string | null; wheelSet: string | null; displayOrder: number }

/* ------------------------------------------------------------- fitting */
export const fittingInput = z.object({
  tyreId: z.coerce.number().int().positive("Tyre is required."),
  vehicleId: z.coerce.number().int().positive("Vehicle is required."),
  positionCode: z.string().trim().min(1, "Position is required.").max(20),
  fittedAt: z.string().trim().min(1, "Fitting date is required.").max(30),
  fittedBy: z.coerce.number().int().positive().optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type FittingInput = z.infer<typeof fittingInput>;

export const removalInput = z.object({
  removalReason: z.enum(REMOVAL_REASON_OPTS),
  removedBy: z.coerce.number().int().positive().optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type RemovalInput = z.infer<typeof removalInput>;

export const replacementInput = z.object({
  removalReason: z.enum(REMOVAL_REASON_OPTS),
  newTyreId: z.coerce.number().int().positive("New tyre is required."),
  fittedAt: z.string().trim().min(1, "Fitting date is required.").max(30),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type ReplacementInput = z.infer<typeof replacementInput>;

export interface FittingRow {
  id: number; tyreId: number; tyreCode: string; vehicleId: number; vehicleNo: string; positionCode: string;
  fittedAt: string; fittedOdometer: number | null;
  removedAt: string | null; removedOdometer: number | null; removalReason: string | null; runningKm: number | null;
  status: string;
}

/* ------------------------------------------------------------ rotation */
export const rotationInput = z.object({
  vehicleId: z.coerce.number().int().positive("Vehicle is required."),
  rotationDate: z.string().trim().min(1, "Rotation date is required.").max(30),
  performedBy: z.coerce.number().int().positive().optional().nullable(),
  lines: z.array(z.object({
    tyreId: z.coerce.number().int().positive(),
    toPositionCode: z.string().trim().min(1).max(20),
  })).min(2, "A rotation needs at least two tyres."),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type RotationInput = z.infer<typeof rotationInput>;

export interface RotationRow {
  id: number; rotationNo: string; vehicleId: number; vehicleNo: string; rotationDate: string;
  odometer: number | null; lineCount: number; remarks: string | null; createdAt: string;
}

/* --------------------------------------------------------- inspection */
export const inspectionInput = z.object({
  tyreId: z.coerce.number().int().positive("Tyre is required."),
  vehicleId: z.coerce.number().int().positive().optional().nullable(),
  positionCode: z.string().trim().max(20).optional().nullable(),
  inspectionDate: z.string().trim().min(1, "Inspection date is required.").max(30),
  treadDepthMm: z.coerce.number().min(0).optional().nullable(),
  pressurePsi: z.coerce.number().min(0).optional().nullable(),
  condition: z.enum(INSPECTION_CONDITION_OPTS).default("Good"),
  defectType: z.string().trim().max(60).optional().nullable(),
  inspectedBy: z.coerce.number().int().positive().optional().nullable(),
  recommendedAction: z.enum(RECOMMENDED_ACTION_OPTS).default("None"),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type InspectionInput = z.infer<typeof inspectionInput>;

export interface InspectionRow {
  id: number; inspectionNo: string; tyreId: number; tyreCode: string; vehicleId: number | null; vehicleNo: string | null;
  positionCode: string | null; inspectionDate: string; odometer: number | null;
  treadDepthMm: number | null; pressurePsi: number | null; condition: string; defectType: string | null;
  recommendedAction: string | null; remarks: string | null; createdAt: string;
}

/* -------------------------------------------------------------- repair */
const costLine = z.object({
  productId: z.coerce.number().int().positive().optional().nullable(),
  itemName: z.string().trim().min(1, "Item name is required.").max(200),
  qty: z.coerce.number().min(0).default(1),
  uom: z.string().trim().max(20).optional().nullable(),
  rate: z.coerce.number().min(0).default(0),
  remarks: z.string().trim().max(300).optional().nullable(),
});
const labourLine = z.object({
  description: z.string().trim().min(1, "Description is required.").max(200),
  hours: z.coerce.number().min(0).optional().nullable(),
  rate: z.coerce.number().min(0).default(0),
  technician: z.string().trim().max(150).optional().nullable(),
  remarks: z.string().trim().max(300).optional().nullable(),
});

export const repairInput = z.object({
  tyreId: z.coerce.number().int().positive("Tyre is required."),
  vehicleId: z.coerce.number().int().positive().optional().nullable(),
  repairDate: z.string().trim().min(1, "Repair date is required.").max(30),
  workshopId: z.coerce.number().int().positive().optional().nullable(),
  workshopName: z.string().trim().max(200).optional().nullable(),
  repairType: z.string().trim().max(60).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  otherCost: z.coerce.number().min(0).default(0),
  items: z.array(costLine).default([]),
  labour: z.array(labourLine).default([]),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type RepairInput = z.infer<typeof repairInput>;

export const repairStatusInput = z.object({
  action: z.enum(["start", "complete", "cancel"]),
  cancellationReason: z.string().trim().max(1000).optional().nullable(),
});

export interface RepairRow {
  id: number; repairNo: string; tyreId: number; tyreCode: string; vehicleId: number | null; vehicleNo: string | null;
  repairDate: string; workshopName: string | null; repairType: string | null; totalCost: number; status: string; createdAt: string;
}

/* ---------------------------------------------------------- retreading */
export const retreadingInput = z.object({
  tyreId: z.coerce.number().int().positive("Tyre is required."),
  sentDate: z.string().trim().min(1, "Sent date is required.").max(30),
  vendorId: z.coerce.number().int().positive().optional().nullable(),
  vendorName: z.string().trim().max(200).optional().nullable(),
  retreadType: z.string().trim().max(40).optional().nullable(),
  cost: z.coerce.number().min(0).default(0),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type RetreadingInput = z.infer<typeof retreadingInput>;

export const retreadReceiveInput = z.object({
  action: z.enum(["start", "receive", "reject", "cancel"]),
  newTreadDepthMm: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

export interface RetreadingRow {
  id: number; retreadNo: string; tyreId: number; tyreCode: string; sentDate: string; vendorName: string | null;
  cost: number; receivedDate: string | null; status: string; createdAt: string;
}

/* ------------------------------------------------------- warranty claim */
export const warrantyClaimInput = z.object({
  tyreId: z.coerce.number().int().positive("Tyre is required."),
  claimDate: z.string().trim().min(1, "Claim date is required.").max(30),
  reason: z.string().trim().min(1, "Reason is required.").max(200),
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  claimedAmount: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type WarrantyClaimInput = z.infer<typeof warrantyClaimInput>;

export const warrantyStatusInput = z.object({
  action: z.enum(["review", "approve", "reject", "settle"]),
  approvedAmount: z.coerce.number().min(0).optional().nullable(),
  creditNoteRef: z.string().trim().max(60).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

export interface WarrantyClaimRow {
  id: number; claimNo: string; tyreId: number; tyreCode: string; claimDate: string; reason: string;
  claimedAmount: number | null; approvedAmount: number | null; status: string; createdAt: string;
}

/* ------------------------------------------------------------- history */
export interface MovementHistoryRow {
  id: number; tyreId: number; tyreCode: string; vehicleId: number | null; vehicleNo: string | null;
  eventType: string; eventAt: string; positionCode: string | null; odometer: number | null;
  cost: number | null; actorName: string | null; remarks: string | null;
}
