/**
 * DEFAULT_INVENTORY_CONFIG — inventory control policy obeyed by every screen.
 * Single source of truth (would be persisted `inventory_config` per company/branch).
 */
export interface InventoryConfigData {
  fields: Record<string, string>;
  flags: Record<string, boolean>;
}

export const DEFAULT_INVENTORY_CONFIG: InventoryConfigData = {
  fields: {
    valuationMethod: "FIFO", // FIFO | WAVG | STD
    batchIssue: "FEFO", // FIFO | FEFO | manual
    nearExpiryDays: "30",
    cycleAbc: "ABC", // classification scheme
    countFrequency: "monthly",
    branchCode: "CHN",
    adjPrefix: "ADJ", trfPrefix: "TRF", resPrefix: "RES", pvPrefix: "PV", ccPrefix: "CC", whPrefix: "WH", binPrefix: "BIN",
  },
  flags: {
    realTimeTracking: true,
    batchTracking: true,
    expiryTracking: true,
    serialTracking: true,
    multiWarehouse: true,
    multiBranch: true,
    allowNegativeStock: false,
    reservationEnabled: true,
    adjustmentApproval: true,
    transferApproval: true,
    qcOnReceipt: true,
    binTracking: true,
    aiOptimization: true,
    deadStockAlert: true,
  },
};

export const inv = (n: string) => DEFAULT_INVENTORY_CONFIG.fields[n] ?? "";
export const invFlag = (id: string) => !!DEFAULT_INVENTORY_CONFIG.flags[id];

export function inventoryDocNo(prefix = "ADJ", seq = 1) {
  const f = DEFAULT_INVENTORY_CONFIG.fields;
  return [prefix, f.branchCode, "26-27", String(Math.max(1, seq)).padStart(4, "0")].filter(Boolean).join("/");
}
