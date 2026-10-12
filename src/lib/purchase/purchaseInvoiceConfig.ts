import { prisma } from "@/lib/db/prisma";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import { DEFAULT_PURCHASE_INVOICE_CONFIG } from "@/lib/settings/purchaseConfigDefaults";
import type { ScopeUser } from "@/lib/auth/scope";

export interface PurchaseInvoiceConfig {
  enablePurchaseInvoice: boolean;
  autoCreatePiDuringGrn: boolean;
  allowPiAfterGrn: boolean;
  invoiceNoMandatory: boolean;
  invoiceDateMandatory: boolean;
  dueDateMandatory: boolean;
  billAttachmentMandatory: boolean;
  gstMandatory: boolean;
  approvalRequired: boolean;
  autoAccountsPosting: boolean;
  autoCreateOutstanding: boolean;
  enablePurchaseReturn: boolean;
  purchaseReturnApprovalRequired: boolean;
  purchaseReturnReasonMandatory: boolean;
  allowMultipleGrnsPerInvoice: boolean;
  allowMultipleInvoicesPerGrn: boolean;
  twoWayMatch: boolean;
  threeWayMatch: boolean;
  piPrefix: string;
  invoiceVariancePct: number | null;
  qtyVariancePct: number | null;
  defaultCurrency: string;
  defaultPaymentTerms: string;
  defaultCreditDays: number;
}

/** Effective Purchase-Invoice configuration for the user's active business/branch
 * (the per-branch override of the purchase-settings JSON blob). Falls back to safe
 * defaults so the invoice flow works even before the config page is touched. */
export async function getPurchaseInvoiceConfig(user: ScopeUser): Promise<PurchaseInvoiceConfig> {
  const row = await resolveScoped((where) => prisma.purchaseSetting.findFirst({ where }), await settingScope(user));
  const cfg = (row?.config ?? DEFAULT_PURCHASE_INVOICE_CONFIG) as { fields?: Record<string, string>; flags?: Record<string, boolean> };
  const f = cfg.fields ?? {};
  const fl = cfg.flags ?? {};
  const pct = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

  return {
    enablePurchaseInvoice: fl.enablePurchaseInvoice !== false,
    autoCreatePiDuringGrn: !!fl.autoCreatePiDuringGrn,
    allowPiAfterGrn: fl.allowPiAfterGrn !== false,
    invoiceNoMandatory: fl.invoiceNoMandatory !== false,
    invoiceDateMandatory: fl.invoiceDateMandatory !== false,
    dueDateMandatory: !!fl.dueDateMandatory,
    billAttachmentMandatory: !!fl.billAttachmentMandatory,
    gstMandatory: fl.gstMandatory !== false,
    approvalRequired: !!fl.approvalRequired,
    autoAccountsPosting: fl.autoAccountsPosting !== false,
    autoCreateOutstanding: fl.autoCreateOutstanding !== false,
    enablePurchaseReturn: fl.enablePurchaseReturn !== false,
    purchaseReturnApprovalRequired: !!fl.purchaseReturnApprovalRequired,
    purchaseReturnReasonMandatory: fl.purchaseReturnReasonMandatory !== false,
    allowMultipleGrnsPerInvoice: fl.allowMultipleGrnsPerInvoice !== false,
    allowMultipleInvoicesPerGrn: !!fl.allowMultipleInvoicesPerGrn,
    twoWayMatch: fl.twoWayMatch !== false,
    threeWayMatch: !!fl.threeWayMatch,
    piPrefix: String(f.piPrefix || "PINV"),
    invoiceVariancePct: pct(f.invoiceVariancePct),
    qtyVariancePct: pct(f.qtyVariancePct),
    defaultCurrency: String(f.defaultCurrency || "INR"),
    defaultPaymentTerms: String(f.defaultPaymentTerms || "Net 30"),
    defaultCreditDays: Number(f.defaultCreditDays) || 30,
  };
}
