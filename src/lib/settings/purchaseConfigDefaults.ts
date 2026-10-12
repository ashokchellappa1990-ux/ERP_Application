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
    // Transit Pass — ₹ per Ton, payable to the supplier on GRN alongside the
    // goods value. Same field name as Dispatch Configuration's transitPassPerTon
    // (independent rate, since purchase-side and dispatch-side transit pass
    // rates aren't necessarily the same).
    transitPassPerTon: "0",
    // Transit Pass Wallet — one-time opening balance (qty in Ton + amount in ₹)
    // to seed the running ledger before this feature existed. Both must be
    // entered together: qty tracks outstanding pass tonnage, amount tracks
    // the outstanding ₹ exposure (paid to suppliers, not yet recovered from
    // customers). See src/lib/transport/transitPassWallet.ts.
    transitPassOpeningQty: "0",
    transitPassOpeningAmount: "0",
  },
  flags: {
    // General
    enablePurchaseInvoice: true,
    enableTruckWeightGrn: false,
    enableWeighbridgeFetch: false,
    enableTransitPass: false,
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
