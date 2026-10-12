import { z } from "zod";

/**
 * Warehouse Configuration — shared contracts. A warehouse is a Branch (entity type
 * Warehouse/DC/Dark Store); these types configure it. Section 1-8 detail lives in a JSON
 * `config` blob (config-driven), key fields are columns for reporting.
 */

/* --------------------------------------------------------- warehouse entity */
export const WAREHOUSE_ENTITY_CODES = ["WH", "DC", "DARK"];
export function isWarehouseEntity(et?: { code?: string | null; name?: string | null } | null): boolean {
  if (!et) return false;
  const code = (et.code ?? "").toUpperCase();
  if (WAREHOUSE_ENTITY_CODES.includes(code)) return true;
  return /warehouse|distribution|dark\s*store/i.test(et.name ?? "");
}

/* ----------------------------------------------------------------- registries */
export const DEFAULT_CATEGORIES: { code: string; name: string; storageTypeDefault: string }[] = [
  { code: "CENTRAL", name: "Central Warehouse", storageTypeDefault: "Standard" },
  { code: "REGIONAL", name: "Regional Warehouse", storageTypeDefault: "Standard" },
  { code: "DISTRIBUTION", name: "Distribution Warehouse", storageTypeDefault: "Standard" },
  { code: "RAW_MATERIAL", name: "Raw Material Warehouse", storageTypeDefault: "Standard" },
  { code: "FINISHED_GOODS", name: "Finished Goods Warehouse", storageTypeDefault: "Standard" },
  { code: "RETURNS", name: "Returns Warehouse", storageTypeDefault: "Standard" },
  { code: "COLD_STORAGE", name: "Cold Storage", storageTypeDefault: "Cold Storage" },
  { code: "TRANSIT", name: "Transit Warehouse", storageTypeDefault: "Standard" },
  { code: "QUARANTINE", name: "Quarantine Warehouse", storageTypeDefault: "Standard" },
  { code: "SCRAP", name: "Scrap Warehouse", storageTypeDefault: "Standard" },
];
export const STORAGE_TYPES = ["Standard", "Cold Storage", "Bonded", "Hazardous", "Mixed"];
export const CAPACITY_UNITS = ["Square Feet", "Square Meter", "Pallet", "Cartons"];
export const WEIGHT_UNITS = ["Kg", "Ton", "Quintal", "Lb"];
export const RELATIONSHIP_TYPES = [{ key: "receive_from", label: "Receive Stock From" }, { key: "dispatch_to", label: "Dispatch Stock To" }, { key: "both", label: "Both" }] as const;
export const PRIORITIES = [{ key: "primary", label: "Primary" }, { key: "secondary", label: "Secondary" }, { key: "emergency", label: "Emergency" }] as const;
export const CONFIG_STATUS = ["Pending", "Configured", "Active", "Inactive"] as const;
export const PROGRESS_STEPS = [
  { key: "branchCreated", label: "Branch Created" },
  { key: "warehouseConfigured", label: "Warehouse Configured" },
  { key: "layoutConfigured", label: "Warehouse Layout Configured" },
  { key: "zoneConfigured", label: "Zone Configured" },
  { key: "rackConfigured", label: "Rack Configured" },
  { key: "shelfConfigured", label: "Shelf Configured" },
  { key: "binConfigured", label: "Bin Configured" },
  { key: "readyForOperations", label: "Ready For Operations" },
] as const;

/* ----------------------------------------------------------- config blob shape */
export interface WhConfig {
  general: { shortName: string; description: string; manager: string; contactNumber: string; email: string; temperatureControlled: boolean; minTemp: string; maxTemp: string; humidityControlled: boolean; minHumidity: string; maxHumidity: string; receivingTime: string; dispatchTime: string };
  receiving: { enabled: boolean; defaultZone: string; allowDirectGrn: boolean; requireQualityInspection: boolean; mandatoryBarcodeScan: boolean; mandatoryBatchNumber: boolean; mandatorySerialNumber: boolean; mandatoryExpiry: boolean; allowPartialReceipt: boolean; allowOverReceipt: boolean; overReceiptPercentage: string; defaultBin: string };
  dispatch: { defaultZone: string; requirePicking: boolean; requirePacking: boolean; requireDispatchVerification: boolean; stockAllocationRequired: boolean; allowPartialDispatch: boolean; allowBackOrder: boolean; allowNegativeDispatch: boolean; approvalRequired: boolean };
  transfer: { internalEnabled: boolean; requestRequired: boolean; approvalRequired: boolean; autoDispatch: boolean; autoReceipt: boolean; allowPartial: boolean; allowCrossWarehouse: boolean; allowInterBranch: boolean; allowInterBusiness: boolean };
  inventory: { binManagement: boolean; zoneManagement: boolean; rackManagement: boolean; shelfManagement: boolean; fifo: boolean; fefo: boolean; batchManagement: boolean; serialManagement: boolean; expiryManagement: boolean; cycleCount: boolean; physicalVerification: boolean; negativeStockAllowed: boolean; autoReplenishment: boolean; autoPutAway: boolean; stockReservation: boolean; qualityHold: boolean; quarantineArea: boolean };
  capabilities: { purchaseReceiving: boolean; salesDispatch: boolean; stockTransfer: boolean; customerReturns: boolean; supplierReturns: boolean; productionReceipt: boolean; productionIssue: boolean; stockAdjustment: boolean; cycleCount: boolean; physicalVerification: boolean };
}
export type WhProgress = Record<(typeof PROGRESS_STEPS)[number]["key"], boolean>;

export const DEFAULT_WAREHOUSE_CONFIG: WhConfig = {
  general: { shortName: "", description: "", manager: "", contactNumber: "", email: "", temperatureControlled: false, minTemp: "", maxTemp: "", humidityControlled: false, minHumidity: "", maxHumidity: "", receivingTime: "", dispatchTime: "" },
  receiving: { enabled: true, defaultZone: "", allowDirectGrn: true, requireQualityInspection: false, mandatoryBarcodeScan: false, mandatoryBatchNumber: false, mandatorySerialNumber: false, mandatoryExpiry: false, allowPartialReceipt: true, allowOverReceipt: false, overReceiptPercentage: "", defaultBin: "" },
  dispatch: { defaultZone: "", requirePicking: true, requirePacking: true, requireDispatchVerification: false, stockAllocationRequired: true, allowPartialDispatch: true, allowBackOrder: false, allowNegativeDispatch: false, approvalRequired: false },
  transfer: { internalEnabled: true, requestRequired: true, approvalRequired: true, autoDispatch: false, autoReceipt: false, allowPartial: true, allowCrossWarehouse: true, allowInterBranch: true, allowInterBusiness: false },
  inventory: { binManagement: true, zoneManagement: true, rackManagement: false, shelfManagement: false, fifo: true, fefo: false, batchManagement: true, serialManagement: false, expiryManagement: false, cycleCount: true, physicalVerification: true, negativeStockAllowed: false, autoReplenishment: false, autoPutAway: false, stockReservation: true, qualityHold: false, quarantineArea: false },
  capabilities: { purchaseReceiving: true, salesDispatch: true, stockTransfer: true, customerReturns: false, supplierReturns: false, productionReceipt: false, productionIssue: false, stockAdjustment: true, cycleCount: true, physicalVerification: true },
};
export const DEFAULT_PROGRESS: WhProgress = { branchCreated: true, warehouseConfigured: false, layoutConfigured: false, zoneConfigured: false, rackConfigured: false, shelfConfigured: false, binConfigured: false, readyForOperations: false };

/** Merge a stored config over the defaults so new fields always exist. */
export function mergeConfig(stored: unknown): WhConfig {
  const s = (stored ?? {}) as Partial<WhConfig>;
  const d = DEFAULT_WAREHOUSE_CONFIG;
  return {
    general: { ...d.general, ...(s.general ?? {}) }, receiving: { ...d.receiving, ...(s.receiving ?? {}) }, dispatch: { ...d.dispatch, ...(s.dispatch ?? {}) },
    transfer: { ...d.transfer, ...(s.transfer ?? {}) }, inventory: { ...d.inventory, ...(s.inventory ?? {}) }, capabilities: { ...d.capabilities, ...(s.capabilities ?? {}) },
  };
}
export const mergeProgress = (stored: unknown): WhProgress => ({ ...DEFAULT_PROGRESS, ...((stored ?? {}) as Partial<WhProgress>) });

export const capabilityCount = (cfg: WhConfig) => Object.values(cfg.capabilities).filter(Boolean).length;
export function progressPercent(p: WhProgress): number { const keys = PROGRESS_STEPS.map((s) => s.key); return Math.round((keys.filter((k) => p[k]).length / keys.length) * 100); }

/* ------------------------------------------------------------------ schemas */
export const warehouseConfigInput = z.object({
  warehouseCategoryId: z.coerce.number().int().nullable().optional(),
  storageType: z.string().optional(),
  capacity: z.coerce.number().nullable().optional(),
  capacityUnit: z.string().optional(),
  maxWeight: z.coerce.number().nullable().optional(),
  weightUnit: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
  progress: z.record(z.string(), z.any()).optional(),
});
export type WarehouseConfigInput = z.infer<typeof warehouseConfigInput>;

export const parentMappingInput = z.object({
  sourceWarehouseBranchId: z.coerce.number().int(),
  destinationWarehouseBranchId: z.coerce.number().int(),
  relationshipType: z.enum(["receive_from", "dispatch_to", "both"]).default("both"),
  priority: z.enum(["primary", "secondary", "emergency"]).default("primary"),
  isDefault: z.boolean().default(false),
});

export const categoryInput = z.object({ id: z.coerce.number().int().optional(), code: z.string().min(1), name: z.string().min(1), description: z.string().optional(), storageTypeDefault: z.string().optional(), displayOrder: z.coerce.number().int().default(1), status: z.string().default("active") });

/** Section-9 progress + save-time validation. category & capacity mandatory; ≥1 capability. */
export function validateConfig(input: WarehouseConfigInput): string | null {
  if (!input.warehouseCategoryId) return "Warehouse Category is mandatory.";
  if (!input.capacity || Number(input.capacity) <= 0) return "Warehouse Capacity is mandatory.";
  const cfg = mergeConfig(input.config);
  if (capabilityCount(cfg) < 1) return "At least one operational capability must be enabled.";
  return null;
}
