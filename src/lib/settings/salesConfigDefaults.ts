/**
 * DEFAULT_SALES_CONFIG — the single source of truth for sales behaviour.
 *
 * BOTH the Sales Settings rule-engine screen (which edits it) and the Sales
 * Management module (which obeys it) read this object. No sales screen hardcodes
 * behaviour: it always branches on these values. In production this would be the
 * persisted `sales_config` document fetched per company/branch.
 */
export interface SalesConfigData {
  fields: Record<string, string>;
  toggles: Record<string, Record<string, boolean>>;
  flags: Record<string, boolean>;
}

const on = (...ids: string[]) => ids.reduce<Record<string, boolean>>((a, id) => ((a[id] = true), a), {});

export const DEFAULT_SALES_CONFIG: SalesConfigData = {
  fields: {
    businessMode: "retail",
    defaultChannel: "b2c",
    defaultProductMethod: "barcode",
    batchTracking: "optional",
    batchSelection: "FEFO",
    expiryValidation: "optional",
    nearExpiry: "30",
    serialTracking: "optional",
    inventoryMethod: "FIFO",
    priceSource: "mrp",
    mrpSource: "product_master",
    taxMethod: "inclusive",
    cgst: "9", sgst: "9", igst: "18", cess: "0",
    maxCreditDays: "30",
    b2cSeries: "INV-RT", b2bSeries: "INV-WS",
    seqStart: "1", seqPadding: "4", sampleBranchCode: "CHN",
    seqSeparator: "/", resetFrequency: "financial_year", yearFormat: "fy_short",
    // Sales Return Configuration
    returnSeries: "SR", maxReturnPeriod: "30", defaultSearch: "invoiceNo",
    defaultRefund: "cash", defaultInventoryHandling: "good", approvalAutoLimit: "500",
    returnReasons: JSON.stringify(["Damaged Product", "Expired Product", "Wrong Product", "Customer Not Satisfied", "Quality Issue", "Billing Error", "Warranty Claim", "Other"]),
    // Sales Exchange Configuration
    exchangeSeries: "SE", exchangeBasis: "invoiceDate", exchangeValidityDays: "30",
    maxExchangeQty: "", exchangePriceBasis: "current", exchangeApprovalAutoLimit: "1000",
    defaultExchangeSearch: "invoiceNo", defaultExchangeSettlement: "cash", defaultExchangeHandling: "good",
    exchangeReasons: JSON.stringify(["Size Issue", "Colour Change", "Wrong Product", "Manufacturing Defect", "Customer Preference", "Damaged Item", "Other"]),
    // Sales Cancellation Configuration
    cancellationSeries: "SC", maxCancellationPeriod: "sameDay", defaultCancellationSearch: "invoiceNo",
    defaultCancellationRefund: "original", cancellationApprovalAutoLimit: "0",
    cancellationReasons: JSON.stringify(["Wrong Customer", "Wrong Billing", "Duplicate Invoice", "Wrong Product", "Wrong Quantity", "Wrong Price", "Cashier Error", "System Error", "Customer Cancelled Purchase", "Other"]),
  },
  toggles: {
    channels: on("b2c", "counter", "online"),
    productMethods: on("name", "barcode", "grid"),
    barcodeTypes: on("ean", "code128"),
    qrContains: on("code", "batch", "expiry", "mrp"),
    qrActions: on("autoAdd", "autoPrice"),
    serialCategories: on("mobile", "electronics"),
    customerCapture: on("name", "mobile", "dob", "anniversary", "group"),
    priceSources: on("promotion", "customer", "batch", "branch", "product"),
    discountSources: on("product", "customer", "coupon"),
    approvalFor: on("discount", "price"),
    printFormats: on("thermal", "a4"),
    delivery: on("immediate", "challan"),
    posScreen: on("customerPanel", "discountColumn", "taxColumn", "productStock", "quickKeys", "touchMode"),
    notifications: on("invoiceSms", "whatsapp"),
    aiFeatures: on("productRec", "nearExpiry"),
    returnSearch: on("invoiceNo", "mobile", "name", "barcode", "qrCode"),
    refundModes: on("cash", "upi", "bank", "storeCredit", "creditNote"),
    returnApprovalBasis: on("amount"),
    exchangeSearch: on("invoiceNo", "mobile", "name", "qrCode", "barcode"),
    exchangeHandling: on("good", "damaged", "quarantine"),
    exchangeSettlement: on("cash", "upi", "card", "creditNote", "storeCredit"),
    exchangeApprovalBasis: on("amount"),
    // Sales Cancellation Configuration
    cancellationSearch: on("invoiceNo", "mobile", "name", "barcode", "qrCode"),
    cancellationRefundModes: on("original", "cash", "storeCredit", "wallet"),
    cancellationApprovalBasis: on("amount"),
  },
  flags: {
    enableBarcode: true, dupBarcodeValidation: true, barcodeMandatory: false,
    enableQr: true,
    allowManualBatchOverride: true,
    allowExpiredSales: false, nearExpiryDiscount: true,
    dupSerialValidation: true, warrantyIntegration: true,
    walkInAllowed: true, custRegRequired: false, mobileMandatoryB2c: false, gstMandatoryB2c: false, allowQuickCustomer: true,
    custMasterMandatory: true, gstMandatoryB2b: true, creditLimitValidationB2b: true, outstandingValidationB2b: true, contractPricing: true, custSpecificPricing: true, soMandatory: false,
    allowPriceOverride: true, priceOverrideApproval: true,
    allowDiscounts: true,
    eInvoice: true, eWayBill: true,
    allowCreditSales: true, creditLimitCheck: true, outstandingCheck: true, creditApprovalWorkflow: true,
    enableLoyalty: true, tierBenefits: true, birthdayBenefits: true, specialCustomerBenefits: false,
    autoNumbering: true, branchWiseNumbering: true, separateB2bSequence: true, lockOnReset: true,
    includeBranchInNumber: true, includeFyInNumber: true, includeMonthInNumber: false,
    enableAi: true,
    // Sales Return Configuration
    returnAllowed: true, returnWithoutInvoice: false, qrReturnEnabled: true,
    reasonMandatory: true, allowCustomReason: true, refundEnabled: true,
    inventoryHandlingEnabled: true, approvalEnabled: true,
    // Sales Exchange Configuration
    exchangeAllowed: true, allowB2cExchange: true, allowB2bExchange: true,
    allowPartialExchange: true, allowFullExchange: true, allowMultipleExchange: true, exchangeWithoutInvoice: false,
    productMustMatch: false, allowDifferentProduct: true, allowSameProduct: true,
    allowDifferentSize: true, allowDifferentColour: true, allowDifferentVariant: true, allowDifferentBatch: true, allowDifferentSerial: true,
    partialQtyAllowed: true, fullQtyMandatory: false, multipleExchangeAllowed: true,
    allowPriceDifference: true, autoCalcDifference: true, refundIfLower: true, collectIfHigher: true, ignorePriceDifference: false,
    qualityInspectionRequired: false, exchangeApprovalEnabled: true,
    // Sales Cancellation Configuration
    cancellationAllowed: true, autoGenerateCancellationNo: true, autoCloseCancellation: true,
    cancellationReasonMandatory: true, cancellationRemarksMandatory: true, allowCustomCancellationReason: true,
    cancellationApprovalEnabled: true,
    // time restrictions
    allowCancelBeforePayment: true, allowCancelAfterPayment: true,
    allowCancelBeforeShiftClose: true, allowCancelAfterShiftClose: false,
    allowCancelBeforeDayClose: true, allowCancelAfterDayClose: false,
    allowCancelAfterPeriodClose: false,
    // inventory / finance reversal switches
    cancelRestoreInventory: true, cancelRestoreSerialStatus: true,
    cancelReverseAccounting: true, cancelReverseCustomerOutstanding: true, cancelReverseLoyalty: true,
  },
};

/** Deep clone so editable copies never mutate the shared default. */
export function cloneSalesConfig(): SalesConfigData {
  return JSON.parse(JSON.stringify(DEFAULT_SALES_CONFIG));
}

/* ---------- read helpers used by the Sales module (config-driven) ------- */
export const field = (n: string) => DEFAULT_SALES_CONFIG.fields[n] ?? "";
export const flag = (id: string) => !!DEFAULT_SALES_CONFIG.flags[id];
export const isOn = (group: string, id: string) => !!DEFAULT_SALES_CONFIG.toggles[group]?.[id];
export const enabledIds = (group: string) => Object.entries(DEFAULT_SALES_CONFIG.toggles[group] ?? {}).filter(([, v]) => v).map(([k]) => k);

/** Build a bill number purely from the numbering config (optional sequence override). */
export function sampleBillNumber(series: "b2c" | "b2b" = "b2c", seq?: number) {
  const f = DEFAULT_SALES_CONFIG.fields;
  const fl = DEFAULT_SALES_CONFIG.flags;
  const parts: string[] = [];
  const prefix = (series === "b2b" ? f.b2bSeries : f.b2cSeries)?.replace(/[\s/_-]+$/, "");
  if (prefix) parts.push(prefix);
  if (fl.includeBranchInNumber && f.sampleBranchCode) parts.push(f.sampleBranchCode);
  if (fl.includeFyInNumber) parts.push("26-27");
  if (fl.includeMonthInNumber) parts.push("06");
  const n = seq ?? Math.max(1, Number(f.seqStart) || 1);
  parts.push(String(Math.max(1, n)).padStart(Math.max(1, Number(f.seqPadding) || 4), "0"));
  return parts.join(f.seqSeparator ?? "/");
}
