import { z } from "zod";

/**
 * Shared contract for the Transport & Vehicle Operations module (Phase 1).
 * This module manages ONLY the physical movement of vehicles and dispatch
 * execution — it never writes InventoryLedger/journal_entries itself. See
 * src/lib/transport/dispatchExecution.ts for the two integration points that
 * DO move stock/GL (the existing postDispatch/createSaleTx engines).
 */

/* --------------------------------------------------------------- shared */
export type DispatchDocType =
  | "Customer" | "StockTransfer" | "PurchaseReturn" | "SalesReturn"
  | "ProductionTransfer" | "JobWork" | "VendorDispatch" | "Others";
export const DISPATCH_DOC_TYPES: DispatchDocType[] = [
  "Customer", "StockTransfer", "PurchaseReturn", "SalesReturn",
  "ProductionTransfer", "JobWork", "VendorDispatch", "Others",
];

export type DispatchPlanningStatus = "Draft" | "Approved" | "Vehicle Pending" | "Vehicle Assigned" | "Completed" | "Cancelled";
export type DispatchExecutionStatus = "Draft" | "Vehicle Assigned" | "Gate In" | "Loading" | "Loaded" | "Gate Out" | "Completed" | "Cancelled";
export type GateEntryStatus = "Waiting" | "Inside Factory" | "Loading" | "Completed" | "Exited";
export type WeighmentApprovalStatus = "NotRequired" | "Pending" | "Approved";

/** Vehicle Type master list — used by Vehicle Master, and read-only elsewhere
 * (Gate Entry, Load & Dispatch) once a Vehicle Number is picked. */
export const VEHICLE_TYPE_OPTS = ["Truck 10W", "Truck 12W", "Truck 16W", "Tipper 407", "Tipper 3U", "Tractor", "Tata ACE", "Ashok Leyland Dost"] as const;

/* ------------------------------------------------------------- masters */
const masterBase = {
  status: z.enum(["Active", "Inactive"]).default("Active"),
  remarks: z.string().trim().max(2000).optional().nullable(),
};

export const vehicleInput = z.object({
  vehicleNo: z.string().trim().min(1, "Vehicle number is required").max(40),
  vehicleType: z.string().trim().max(60).optional().nullable(),
  capacity: z.coerce.number().min(0).default(0),
  capacityUnit: z.string().trim().max(20).optional().nullable(),
  transportCompanyId: z.coerce.number().int().positive().optional().nullable(),
  ownerType: z.enum(["Own", "Hired", "Transporter"]).default("Own"),
  ...masterBase,
});
export type VehicleInput = z.infer<typeof vehicleInput>;

export const driverInput = z.object({
  name: z.string().trim().min(1, "Driver name is required").max(150),
  licenseNo: z.string().trim().max(60).optional().nullable(),
  licenseExpiry: z.string().trim().max(20).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  transportCompanyId: z.coerce.number().int().positive().optional().nullable(),
  ...masterBase,
});
export type DriverInput = z.infer<typeof driverInput>;

export const transportCompanyInput = z.object({
  code: z.string().trim().min(1, "Code is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(150),
  contactPerson: z.string().trim().max(150).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  gstin: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  ...masterBase,
});
export type TransportCompanyInput = z.infer<typeof transportCompanyInput>;

export const routeInput = z.object({
  code: z.string().trim().min(1, "Code is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(150),
  sourceBranchId: z.coerce.number().int().positive().optional().nullable(),
  destinationBranchId: z.coerce.number().int().positive().optional().nullable(),
  distanceKm: z.coerce.number().min(0).optional().nullable(),
  estimatedHours: z.coerce.number().min(0).optional().nullable(),
  ...masterBase,
});
export type RouteInput = z.infer<typeof routeInput>;

export const loadingBayInput = z.object({
  code: z.string().trim().min(1, "Code is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(150),
  warehouse: z.string().trim().max(120).optional().nullable(),
  capacity: z.coerce.number().min(0).optional().nullable(),
  ...masterBase,
});
export type LoadingBayInput = z.infer<typeof loadingBayInput>;

export const weighbridgeInput = z.object({
  code: z.string().trim().min(1, "Code is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(150),
  location: z.string().trim().max(200).optional().nullable(),
  capacity: z.coerce.number().min(0).optional().nullable(),
  calibrationDueDate: z.string().trim().max(20).optional().nullable(),
  ...masterBase,
});
export type WeighbridgeInput = z.infer<typeof weighbridgeInput>;

/* -------------------------------------------------------- dispatch planning */
export const dispatchPlanningItemInput = z.object({
  productId: z.coerce.number().int().positive(),
  productName: z.string().trim().max(250).optional(),
  sku: z.string().trim().max(60).optional().nullable(),
  batchNo: z.string().trim().max(80).optional().nullable(),
  allocationLotId: z.coerce.number().int().positive().optional().nullable(),
  qty: z.coerce.number().positive("Quantity must be greater than 0"),
  uom: z.string().trim().max(20).optional().nullable(),
  remarks: z.string().trim().max(300).optional().nullable(),
});

export const dispatchPlanningInput = z.object({
  planningDate: z.string().trim().min(1, "Planning date is required"),
  dispatchSource: z.enum(["Sales Order", "Stock Transfer", "Direct", "Other"]).default("Sales Order"),
  referenceType: z.string().trim().max(30).optional().nullable(),
  referenceId: z.coerce.number().int().positive().optional().nullable(),
  referenceNo: z.string().trim().max(60).optional().nullable(),
  warehouse: z.string().trim().max(120).optional().nullable(),
  expectedDispatchDate: z.string().trim().max(20).optional().nullable(),
  priority: z.enum(["Low", "Normal", "High", "Urgent"]).default("Normal"),
  transportMode: z.string().trim().max(30).optional().nullable(),
  estimatedWeight: z.coerce.number().min(0).default(0),
  estimatedVolume: z.coerce.number().min(0).default(0),
  remarks: z.string().trim().max(2000).optional().nullable(),
  items: z.array(dispatchPlanningItemInput).default([]),
});
export type DispatchPlanningInput = z.infer<typeof dispatchPlanningInput>;

export const dispatchPlanningActionInput = z.object({
  action: z.enum(["approve", "assign-vehicle", "complete", "cancel"]),
  remarks: z.string().trim().max(300).optional(),
});

/* -------------------------------------------------------- dispatch execution */
export const dispatchExecutionItemInput = z.object({
  productId: z.coerce.number().int().positive(),
  productName: z.string().trim().max(250).optional(),
  sku: z.string().trim().max(60).optional().nullable(),
  uom: z.string().trim().max(20).optional().nullable(),
  batchNo: z.string().trim().max(80).optional().nullable(),
  mfgDate: z.string().trim().max(20).optional().nullable(),
  expiryDate: z.string().trim().max(20).optional().nullable(),
  allocationLotId: z.coerce.number().int().positive().optional().nullable(),
  orderedQty: z.coerce.number().min(0).default(0),
  dispatchedQty: z.coerce.number().positive("Dispatched quantity must be greater than 0"),
  rate: z.coerce.number().min(0).optional().nullable(),
  qrCode: z.string().trim().max(80).optional().nullable(),
  remarks: z.string().trim().max(300).optional().nullable(),
});

/** Load items automatically from a Sales Order's Stock Allocation. */
export const loadFromSalesOrderInput = z.object({
  docType: z.literal("Customer"),
  salesOrderId: z.coerce.number().int().positive(),
  dispatchPlanningId: z.coerce.number().int().positive().optional().nullable(),
  docDate: z.string().trim().min(1),
  warehouse: z.string().trim().max(120).optional().nullable(),
});

/** Load items automatically from a Stock Transfer Request's Stock Allocation. */
export const loadFromTransferRequestInput = z.object({
  docType: z.literal("StockTransfer"),
  transferRequestId: z.coerce.number().int().positive(),
  dispatchPlanningId: z.coerce.number().int().positive().optional().nullable(),
  docDate: z.string().trim().min(1),
});

/** Direct customer dispatch — manual entry, no Sales Order. */
export const directCustomerDispatchInput = z.object({
  docType: z.literal("Customer"),
  docDate: z.string().trim().min(1),
  customerId: z.coerce.number().int().positive().optional().nullable(),
  customerName: z.string().trim().max(200).optional().nullable(),
  deliveryAddress: z.string().trim().max(400).optional().nullable(),
  warehouse: z.string().trim().max(120).optional().nullable(),
  items: z.array(dispatchExecutionItemInput).min(1, "Add at least one item"),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

export const dispatchExecutionActionInput = z.object({
  action: z.enum(["assign-vehicle", "gate-in", "start-loading", "complete", "cancel"]),
  remarks: z.string().trim().max(300).optional(),
  vehicleId: z.coerce.number().int().positive().optional(),
  driverId: z.coerce.number().int().positive().optional(),
  transportCompanyId: z.coerce.number().int().positive().optional(),
});

/* ------------------------------------------------------------ gate / weighment / loading */
export const gateEntryInput = z.object({
  vehicleId: z.coerce.number().int().positive(),
  driverId: z.coerce.number().int().positive().optional().nullable(),
  transportCompanyId: z.coerce.number().int().positive().optional().nullable(),
  dispatchPlanningId: z.coerce.number().int().positive().optional().nullable(),
  dispatchExecutionId: z.coerce.number().int().positive().optional().nullable(),
  dispatchType: z.string().trim().max(24).optional().nullable(),
  referenceNo: z.string().trim().max(60).optional().nullable(),
  arrivalTime: z.string().trim().optional().nullable(),
  securityOfficer: z.string().trim().max(160).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  // Section 1 – Gate Information
  gate: z.string().trim().max(60).optional().nullable(),
  // Section 2/3 – Reference Document. `customerName`/`deliveryAddress`/`sourceWarehouse`/
  // `destinationWarehouse` sent by the client are advisory only — the server
  // re-resolves them from salesOrderId/transferRequestId when given.
  gateEntryNo: z.string().trim().max(40).optional().nullable(),
  referenceType: z.enum(["Sales Order", "Direct Customer Dispatch"]).optional().nullable(),
  salesOrderId: z.coerce.number().int().positive().optional().nullable(),
  transferRequestId: z.coerce.number().int().positive().optional().nullable(),
  // Direct Customer Dispatch (no Sales Order to derive from): customerId is
  // re-resolved from the Customer Master server-side; deliveryAddress is
  // legitimately free text here since there's no authoritative source doc.
  customerId: z.coerce.number().int().positive().optional().nullable(),
  deliveryAddress: z.string().trim().max(400).optional().nullable(),
  // Section 4 – Transport Details
  transportMode: z.string().trim().max(30).optional().nullable(),
  vehicleType: z.string().trim().max(60).optional().nullable(),
  trailerNumber: z.string().trim().max(40).optional().nullable(),
  containerNumber: z.string().trim().max(40).optional().nullable(),
  // Section 5 – Driver Details (captured fresh at the gate)
  driverName: z.string().trim().max(150).optional().nullable(),
  driverMobile: z.string().trim().max(20).optional().nullable(),
  driverLicenseNo: z.string().trim().max(60).optional().nullable(),
  helperName: z.string().trim().max(150).optional().nullable(),
  helperMobile: z.string().trim().max(20).optional().nullable(),
  // Section 6 – Vehicle Details (optional)
  vehicleCapacity: z.coerce.number().min(0).optional().nullable(),
  expectedLoadWeight: z.coerce.number().min(0).optional().nullable(),
  gpsAvailable: z.coerce.boolean().optional(),
  sealNumber: z.string().trim().max(60).optional().nullable(),
  // Section 7 – Entry Details (optional)
  purpose: z.string().trim().max(200).optional().nullable(),
  expectedExitTime: z.string().trim().optional().nullable(),
  loadingBayId: z.coerce.number().int().positive().optional().nullable(),
  // Item Details (optional) — what the vehicle is expected to carry; purely
  // informational at this stage, no allocation/stock/GL implication.
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    productName: z.string().trim().max(250).optional(),
    sku: z.string().trim().max(60).optional().nullable(),
    uom: z.string().trim().max(40).optional().nullable(),
    qty: z.coerce.number().min(0),
    remarks: z.string().trim().max(300).optional().nullable(),
  })).optional(),
  // Vehicle Entry Type — Dispatch (outbound, default) vs RawMaterial (inbound,
  // arrives loaded against a Supplier, feeds a GRN). `supplierName` is never
  // accepted from the client — the server re-resolves it from supplierId.
  entryType: z.enum(["Dispatch", "RawMaterial"]).optional(),
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  expectedMaterial: z.string().trim().max(200).optional().nullable(),
  grossWeight: z.coerce.number().min(0).optional().nullable(),
  weightSlipRefNo: z.string().trim().max(60).optional().nullable(),
});
/** Gate Entry's own Dispatch Type picker — a friendly-labelled subset of
 * DISPATCH_DOC_TYPES (values stay consistent with Dispatch Execution's docType). */
export const GATE_ENTRY_DISPATCH_TYPES: { value: DispatchDocType; label: string }[] = [
  { value: "Customer", label: "Customer Dispatch" },
  { value: "StockTransfer", label: "Stock Transfer" },
  { value: "PurchaseReturn", label: "Purchase Return" },
  { value: "ProductionTransfer", label: "Production Transfer" },
  { value: "JobWork", label: "Job Work" },
  { value: "Others", label: "Others" },
];

export const gateEntryActionInput = z.object({
  action: z.enum(["move-inside", "start-loading", "complete", "exit"]),
  remarks: z.string().trim().max(300).optional(),
});

export const preLoadingWeighmentInput = z.object({
  gateEntryId: z.coerce.number().int().positive(),
  tareWeight: z.coerce.number().min(0),
  weighDate: z.string().trim().max(20).optional().nullable(),
  weighTime: z.string().trim().max(10).optional().nullable(),
  operator: z.string().trim().max(160).optional().nullable(),
  weighbridgeId: z.coerce.number().int().positive().optional().nullable(),
  photoUrl: z.string().trim().max(400).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

export const loadingConfirmationInput = z.object({
  gateEntryId: z.coerce.number().int().positive(),
  warehouse: z.string().trim().max(120).optional().nullable(),
  loadingBayId: z.coerce.number().int().positive().optional().nullable(),
  supervisor: z.string().trim().max(160).optional().nullable(),
  loadingStart: z.string().trim().optional().nullable(),
  loadingEnd: z.string().trim().optional().nullable(),
  packages: z.coerce.number().int().min(0).default(0),
  pallets: z.coerce.number().int().min(0).default(0),
  batchNo: z.string().trim().max(80).optional().nullable(),
  serialNumber: z.string().trim().max(120).optional().nullable(),
  sealNumber: z.string().trim().max(60).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

export const postLoadingWeighmentInput = z.object({
  gateEntryId: z.coerce.number().int().positive(),
  grossWeight: z.coerce.number().min(0),
  weighDate: z.string().trim().max(20).optional().nullable(),
  operator: z.string().trim().max(160).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

export const gateExitInput = z.object({
  gateEntryId: z.coerce.number().int().positive(),
  exitTime: z.string().trim().optional().nullable(),
  securityOfficer: z.string().trim().max(160).optional().nullable(),
  sealVerified: z.coerce.boolean().default(false),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

/* ------------------------------------------------------------- transport cost */
export const transportCostInput = z.object({
  dispatchExecutionId: z.coerce.number().int().positive(),
  transportCompanyId: z.coerce.number().int().positive().optional().nullable(),
  vehicleId: z.coerce.number().int().positive().optional().nullable(),
  distance: z.coerce.number().min(0).default(0),
  freightCharge: z.coerce.number().min(0).default(0),
  loadingCharge: z.coerce.number().min(0).default(0),
  unloadingCharge: z.coerce.number().min(0).default(0),
  fuelCharge: z.coerce.number().min(0).default(0),
  tollCharge: z.coerce.number().min(0).default(0),
  driverAllowance: z.coerce.number().min(0).default(0),
  helperAllowance: z.coerce.number().min(0).default(0),
  otherCharges: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  gstAmount: z.coerce.number().min(0).default(0),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type TransportCostInput = z.infer<typeof transportCostInput>;

/* ----------------------------------------------------------------- DTOs */
export interface TransportListRow {
  id: number;
  [key: string]: unknown;
}

/* ------------------------------------------------------ dispatch planning DTOs */
export interface DispatchPlanningRow {
  id: number; planningNo: string; planningDate: string; dispatchSource: string;
  referenceNo: string; warehouse: string; priority: string; status: string;
  itemCount: number; totalQty: number; createdAt: string;
}
export interface DispatchPlanningItemDto {
  id: number; productId: number; productName: string; sku: string | null;
  batchNo: string | null; qty: number; uom: string | null; remarks: string | null;
}
export interface DispatchPlanningDetail {
  id: number; planningNo: string; planningDate: string; dispatchSource: string;
  referenceType: string | null; referenceId: number | null; referenceNo: string | null;
  warehouse: string | null; expectedDispatchDate: string | null; priority: string;
  transportMode: string | null; estimatedWeight: number; estimatedVolume: number;
  remarks: string | null; status: string;
  approvedByName: string | null; approvedAt: string | null; cancelledAt: string | null; cancelReason: string | null;
  createdByName: string | null; createdAt: string;
  items: DispatchPlanningItemDto[];
}

/* ----------------------------------------------------- dispatch execution DTOs */
export interface DispatchExecutionRow {
  id: number; docNo: string; docType: string; docDate: string;
  sourceRefNo: string | null; partyName: string | null; warehouse: string | null;
  status: string; totalQty: number; totalValue: number; createdAt: string;
}
export interface DispatchExecutionItemDto {
  id: number; productId: number; productName: string; sku: string | null; uom: string | null;
  batchNo: string | null; mfgDate: string | null; expiryDate: string | null;
  orderedQty: number; dispatchedQty: number; rate: number | null; value: number;
  qrCode: string | null; remarks: string | null;
}
export interface DispatchExecutionDetail {
  id: number; docNo: string; docType: string; docDate: string;
  dispatchPlanningId: number | null; sourceRefType: string | null; sourceRefId: number | null; sourceRefNo: string | null;
  partyType: string | null; partyId: number | null; partyName: string | null; deliveryAddress: string | null;
  warehouse: string | null; transportCompanyId: number | null; vehicleId: number | null; driverId: number | null;
  status: string; isPartial: boolean; totalQty: number; totalValue: number; remarks: string | null;
  completedAt: string | null; cancelledAt: string | null; cancelReason: string | null;
  createdByName: string | null; createdAt: string;
  items: DispatchExecutionItemDto[];
}
