/**
 * DEFAULT_PURCHASE_CONFIG — procurement policy that the Purchase module obeys.
 * Single source of truth (would be the persisted `purchase_config` per company/branch).
 * Every Purchase screen branches on these values instead of hardcoding behaviour.
 */
export interface PurchaseConfigData {
  fields: Record<string, string>;
  flags: Record<string, boolean>;
}

export const DEFAULT_PURCHASE_CONFIG: PurchaseConfigData = {
  fields: {
    taxMethod: "exclusive",
    costingMethod: "FIFO",
    landedBasis: "value", // value | qty | weight
    approvalThreshold: "50000",
    maxApprovalLevels: "3",
    grnTolerancePct: "5",
    poPrefix: "PO", grnPrefix: "GRN", piPrefix: "PINV", rtnPrefix: "PRTN", dnPrefix: "DN", payPrefix: "PAY", prPrefix: "PR", rfqPrefix: "RFQ",
    branchCode: "CHN",
  },
  flags: {
    multiLevelApproval: true,
    threeWayMatch: true,
    grnBeforeInvoice: true,
    gstMandatorySupplier: true,
    allowOverReceipt: false,
    landedCostEnabled: true,
    autoReorderSuggestion: true,
    qcOnReceipt: true,
    eWayBillCapture: true,
    batchExpiryOnReceipt: true,
  },
};

export const pf = (n: string) => DEFAULT_PURCHASE_CONFIG.fields[n] ?? "";
export const pflag = (id: string) => !!DEFAULT_PURCHASE_CONFIG.flags[id];

/** Build a purchase document number from the numbering policy. */
export function purchaseDocNo(prefix = "PO", seq = 1) {
  const f = DEFAULT_PURCHASE_CONFIG.fields;
  return [prefix, f.branchCode, "26-27", String(Math.max(1, seq)).padStart(4, "0")].filter(Boolean).join("/");
}
