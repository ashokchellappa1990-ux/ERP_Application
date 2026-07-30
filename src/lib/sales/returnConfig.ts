import { prisma } from "@/lib/db/prisma";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import { DEFAULT_SALES_CONFIG } from "@/lib/settings/salesConfigDefaults";
import type { ScopeUser } from "@/lib/auth/scope";

const ALL_REFUND_MODES = ["cash", "upi", "bank", "storeCredit", "creditNote"];
const DEFAULT_REASONS = ["Damaged Product", "Expired Product", "Wrong Product", "Customer Not Satisfied", "Quality Issue", "Billing Error", "Warranty Claim", "Other"];

export interface ReturnConfig {
  returnAllowed: boolean; returnWithoutInvoice: boolean; reasonMandatory: boolean; allowCustomReason: boolean;
  refundEnabled: boolean; inventoryHandlingEnabled: boolean; approvalEnabled: boolean; qrReturnEnabled: boolean;
  maxReturnDays: number | null; refundModes: string[]; defaultRefund: string; defaultInventoryHandling: string;
  approvalAutoLimit: number; reasons: string[]; searchToggles: Record<string, boolean>; defaultSearch: string;
}

/** Effective Sales-Return configuration for the user's active business/branch (the
 * per-branch override of the sales-settings JSON blob). Falls back to safe defaults
 * so the return flow works even before the config tab is touched. */
export async function getReturnConfig(user: ScopeUser): Promise<ReturnConfig> {
  const row = await resolveScoped((where) => prisma.salesSetting.findFirst({ where }), await settingScope(user));
  const cfg = (row?.config ?? DEFAULT_SALES_CONFIG) as { fields?: Record<string, string>; flags?: Record<string, boolean>; toggles?: Record<string, Record<string, boolean>> };
  const f = cfg.fields ?? {}; const fl = cfg.flags ?? {}; const tg = cfg.toggles ?? {};
  const period = String(f.maxReturnPeriod ?? "unlimited");
  const maxReturnDays = period === "unlimited" || period === "" ? null : Number(period) || null;
  const refundModes = Object.entries(tg.refundModes ?? {}).filter(([, v]) => v).map(([k]) => k);
  let reasons: string[] = [];
  try { reasons = JSON.parse(f.returnReasons || "[]"); } catch { /* keep [] */ }
  if (!reasons.length) reasons = DEFAULT_REASONS;
  return {
    returnAllowed: fl.returnAllowed !== false,
    returnWithoutInvoice: !!fl.returnWithoutInvoice,
    reasonMandatory: !!fl.reasonMandatory,
    allowCustomReason: fl.allowCustomReason !== false,
    refundEnabled: fl.refundEnabled !== false,
    inventoryHandlingEnabled: fl.inventoryHandlingEnabled !== false,
    approvalEnabled: !!fl.approvalEnabled,
    qrReturnEnabled: fl.qrReturnEnabled !== false,
    maxReturnDays,
    refundModes: refundModes.length ? refundModes : ALL_REFUND_MODES,
    defaultRefund: String(f.defaultRefund || refundModes[0] || "cash"),
    defaultInventoryHandling: String(f.defaultInventoryHandling || "good"),
    approvalAutoLimit: Number(f.approvalAutoLimit) || 0,
    reasons,
    searchToggles: tg.returnSearch ?? { invoiceNo: true, mobile: true, name: true, barcode: true, qrCode: true },
    defaultSearch: String(f.defaultSearch || "invoiceNo"),
  };
}
