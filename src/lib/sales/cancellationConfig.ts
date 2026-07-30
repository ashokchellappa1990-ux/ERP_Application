import { prisma } from "@/lib/db/prisma";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import { DEFAULT_SALES_CONFIG } from "@/lib/settings/salesConfigDefaults";
import type { ScopeUser } from "@/lib/auth/scope";

const ALL_REFUND_MODES = ["original", "cash", "storeCredit", "wallet"];
const DEFAULT_REASONS = ["Wrong Customer", "Wrong Billing", "Duplicate Invoice", "Wrong Product", "Wrong Quantity", "Wrong Price", "Cashier Error", "System Error", "Customer Cancelled Purchase", "Other"];

export interface CancellationConfig {
  cancellationAllowed: boolean;
  autoGenerateNo: boolean;
  autoClose: boolean;
  reasonMandatory: boolean;
  remarksMandatory: boolean;
  allowCustomReason: boolean;
  approvalEnabled: boolean;
  approvalAutoLimit: number;
  approvalBasis: string[];
  // time restrictions
  allowBeforePayment: boolean;
  allowAfterPayment: boolean;
  allowBeforeShiftClose: boolean;
  allowAfterShiftClose: boolean;
  allowBeforeDayClose: boolean;
  allowAfterDayClose: boolean;
  allowAfterPeriodClose: boolean;
  maxCancellationPeriod: string; // "30min" | "2hr" | "sameDay" | "unlimited" | "<minutes>"
  // reversal switches
  restoreInventory: boolean;
  restoreSerialStatus: boolean;
  reverseAccounting: boolean;
  reverseCustomerOutstanding: boolean;
  reverseLoyalty: boolean;
  // refund + search
  refundModes: string[];
  defaultRefund: string;
  searchToggles: Record<string, boolean>;
  defaultSearch: string;
  reasons: string[];
}

/** Effective Sales-Cancellation configuration for the user's active business/branch
 * (the per-branch override of the sales-settings JSON blob). Falls back to safe
 * defaults so the flow works even before the config tab is touched. */
export async function getCancellationConfig(user: ScopeUser): Promise<CancellationConfig> {
  const row = await resolveScoped((where) => prisma.salesSetting.findFirst({ where }), await settingScope(user));
  const cfg = (row?.config ?? DEFAULT_SALES_CONFIG) as { fields?: Record<string, string>; flags?: Record<string, boolean>; toggles?: Record<string, Record<string, boolean>> };
  const f = cfg.fields ?? {}; const fl = cfg.flags ?? {}; const tg = cfg.toggles ?? {};

  const refundModes = Object.entries(tg.cancellationRefundModes ?? {}).filter(([, v]) => v).map(([k]) => k);
  const approvalBasis = Object.entries(tg.cancellationApprovalBasis ?? {}).filter(([, v]) => v).map(([k]) => k);
  let reasons: string[] = [];
  try { reasons = JSON.parse(f.cancellationReasons || "[]"); } catch { /* keep [] */ }
  if (!reasons.length) reasons = DEFAULT_REASONS;

  return {
    cancellationAllowed: fl.cancellationAllowed !== false,
    autoGenerateNo: fl.autoGenerateCancellationNo !== false,
    autoClose: fl.autoCloseCancellation !== false,
    reasonMandatory: fl.cancellationReasonMandatory !== false,
    remarksMandatory: fl.cancellationRemarksMandatory !== false,
    allowCustomReason: fl.allowCustomCancellationReason !== false,
    approvalEnabled: !!fl.cancellationApprovalEnabled,
    approvalAutoLimit: Number(f.cancellationApprovalAutoLimit) || 0,
    approvalBasis: approvalBasis.length ? approvalBasis : ["amount"],
    allowBeforePayment: fl.allowCancelBeforePayment !== false,
    allowAfterPayment: fl.allowCancelAfterPayment !== false,
    allowBeforeShiftClose: fl.allowCancelBeforeShiftClose !== false,
    allowAfterShiftClose: !!fl.allowCancelAfterShiftClose,
    allowBeforeDayClose: fl.allowCancelBeforeDayClose !== false,
    allowAfterDayClose: !!fl.allowCancelAfterDayClose,
    allowAfterPeriodClose: !!fl.allowCancelAfterPeriodClose,
    maxCancellationPeriod: String(f.maxCancellationPeriod || "sameDay"),
    restoreInventory: fl.cancelRestoreInventory !== false,
    restoreSerialStatus: fl.cancelRestoreSerialStatus !== false,
    reverseAccounting: fl.cancelReverseAccounting !== false,
    reverseCustomerOutstanding: fl.cancelReverseCustomerOutstanding !== false,
    reverseLoyalty: fl.cancelReverseLoyalty !== false,
    refundModes: refundModes.length ? refundModes : ALL_REFUND_MODES,
    defaultRefund: String(f.defaultCancellationRefund || "original"),
    searchToggles: tg.cancellationSearch ?? { invoiceNo: true, mobile: true, name: true, barcode: true, qrCode: true },
    defaultSearch: String(f.defaultCancellationSearch || "invoiceNo"),
    reasons,
  };
}
