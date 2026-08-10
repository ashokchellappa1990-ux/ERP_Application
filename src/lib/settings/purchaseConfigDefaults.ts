/**
 * DEFAULT_PURCHASE_INVOICE_CONFIG — the single source of truth for the Purchase
 * Invoice / Supplier Bill rule engine. The Purchase Configuration screen edits it
 * and the Purchase Invoice module obeys it. Stored per (tenant, business, branch)
 * in `PurchaseSetting.config`.
 */
export interface PurchaseConfigData {
  fields: Record<string, string>;
  flags: Record<string, boolean>;
}

export const DEFAULT_PURCHASE_INVOICE_CONFIG: PurchaseConfigData = {
  fields: {
    piPrefix: "PINV",
    prPrefix: "PRTN",
    assetPrefix: "FA",
    invoiceVariancePct: "5",
    qtyVariancePct: "5",
    defaultCurrency: "INR",
    defaultPaymentTerms: "Net 30",
    defaultCreditDays: "30",
    truckWeightUom: "Kg",
  },
  flags: {
    // General
    enablePurchaseInvoice: true,
    enableTruckWeightGrn: false,
    autoCreatePiDuringGrn: false,
    allowPiAfterGrn: true,
    // Mandatory fields
    invoiceNoMandatory: true,
    invoiceDateMandatory: true,
    dueDateMandatory: false,
    billAttachmentMandatory: false,
    gstMandatory: true,
    // Approval & posting
    approvalRequired: false,
    autoAccountsPosting: true,
    autoCreateOutstanding: true,
    // Purchase Return
    enablePurchaseReturn: true,
    purchaseReturnApprovalRequired: false,
    purchaseReturnReasonMandatory: true,
    // Matching & variance
    allowMultipleGrnsPerInvoice: true,
    allowMultipleInvoicesPerGrn: false,
    twoWayMatch: true,
    threeWayMatch: false,
  },
};

/** Deep clone so editable copies never mutate the shared default. */
export function clonePurchaseConfig(): PurchaseConfigData {
  return JSON.parse(JSON.stringify(DEFAULT_PURCHASE_INVOICE_CONFIG));
}
