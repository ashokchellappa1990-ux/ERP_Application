/**
 * DEFAULT_ACCOUNTING_CONFIG — the single source of truth for the Dispatch &
 * Sales Accounting engine (Finance & Accounting → Accounting Configuration →
 * Dispatch & Sales Accounting). Controls when Customer Receivable / Sales
 * Revenue / GST / Inventory-COGS get recognized (On Dispatch vs On Sales
 * Invoice), whether a separate Dispatch Accounting Voucher (DAV) posts at
 * Complete Load & Dispatch time, and how Driver Batta / Transit Pass /
 * Vehicle Rent / other operational charges get accounted. Stored per (tenant,
 * business, branch) in `AccountingConfiguration.config`, same shape
 * convention as `TransportConfigData` (see transportConfigDefaults.ts).
 */
export interface AccountingConfigData {
  fields: Record<string, string>;
  flags: Record<string, boolean>;
  // Semantic key -> ledger account code (see src/lib/accounting/accounts.ts's
  // ACC map for the default codes). Lets an org redirect a posting category
  // to a different account without any code change.
  glMapping: Record<string, string>;
}

export const ACCOUNTING_GL_MAPPING_KEYS = [
  "customerReceivable", "dispatchClearingLiability", "salesRevenue", "outputGst",
  "transitPassRecovery", "vehicleRentRecovery", "driverBattaExpense", "vehicleRentExpense",
  "operatingChargesRecovery", "operatingExpenseDispatch", "inventory", "goodsInTransit",
  "cogs", "cash", "bank",
] as const;
export type AccountingGlMappingKey = (typeof ACCOUNTING_GL_MAPPING_KEYS)[number];

export const DEFAULT_ACCOUNTING_CONFIG: AccountingConfigData = {
  fields: {
    // Stage 1 (Dispatch) vs Stage 2 (Sales Invoice) recognition timing.
    customerReceivableTiming: "OnDispatch", // OnDispatch | OnInvoice
    salesRevenueTiming: "OnInvoice", // OnDispatch | OnInvoice
    gstRecognitionTiming: "OnInvoice", // OnDispatch | OnInvoice
    // Physical stock always leaves the warehouse at Dispatch completion
    // regardless of this setting (unchanged, load-bearing) — this only
    // decides whether the GL debit at Dispatch time goes straight to Cost of
    // Goods Sold (OnDispatch) or parks in Goods in Transit pending
    // reclassification to COGS at Sales Invoice time (OnInvoice).
    inventoryCogsTiming: "OnDispatch", // OnDispatch | OnInvoice
    // Prefills (doesn't override) the per-dispatch Driver Batta toggle on the
    // Direct Customer Dispatch screen.
    driverBattaModeDefault: "Adjustment", // Adjustment | Payment
    transitPassAccounting: "Recoverable", // Recoverable | CompanyExpense
    vehicleRentAccounting: "Recoverable", // Recoverable | CompanyExpense
    // Other Transport Cost charges — each shares the same two GL accounts
    // (Operating Charges Recovery / Operating Expense — Dispatch) but is
    // independently switchable between Recoverable and Company Expense.
    otherChargeFreight: "Recoverable",
    otherChargeLoading: "Recoverable",
    otherChargeUnloading: "Recoverable",
    otherChargeFuel: "Recoverable",
    otherChargeToll: "Recoverable",
    otherChargeDriverAllowance: "Recoverable",
    otherChargeHelperAllowance: "Recoverable",
    otherChargeMisc: "Recoverable",
  },
  flags: {
    // Master switch — when off, nothing posts at Complete Load & Dispatch;
    // everything (Receivable/Revenue/GST/recoveries) posts in one voucher at
    // Sales Invoice time, exactly like the app's original single-stage
    // behavior.
    createSeparateDispatchVoucher: true,
    // Only meaningful when createSeparateDispatchVoucher is on AND
    // customerReceivableTiming is OnDispatch (that's the only combination
    // where a Dispatch Clearing Liability balance actually exists to settle).
    reverseDispatchVoucherOnInvoice: true,
  },
  glMapping: {
    customerReceivable: "1100", dispatchClearingLiability: "2170", salesRevenue: "3000", outputGst: "2100",
    transitPassRecovery: "3280", vehicleRentRecovery: "3290", driverBattaExpense: "4410", vehicleRentExpense: "4420",
    operatingChargesRecovery: "3295", operatingExpenseDispatch: "4430", inventory: "1200", goodsInTransit: "1210",
    cogs: "4000", cash: "1000", bank: "1010",
  },
};

/** Deep-merge a stored config onto the defaults so newly-added keys always exist. */
export function mergeAccountingConfigData(stored: Partial<AccountingConfigData> | null | undefined): AccountingConfigData {
  const base = JSON.parse(JSON.stringify(DEFAULT_ACCOUNTING_CONFIG)) as AccountingConfigData;
  if (!stored) return base;
  base.fields = { ...base.fields, ...(stored.fields ?? {}) };
  base.flags = { ...base.flags, ...(stored.flags ?? {}) };
  base.glMapping = { ...base.glMapping, ...(stored.glMapping ?? {}) };
  return base;
}

/** Whether a given amount is treated as recoverable-from-customer (true) or a
 * company expense (false) for the given charge-config value. */
export function isRecoverable(mode: string | undefined): boolean {
  return (mode ?? "Recoverable") === "Recoverable";
}
