import { prisma } from "@/lib/db/prisma";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import { DEFAULT_SALES_CONFIG } from "@/lib/settings/salesConfigDefaults";
import type { ScopeUser } from "@/lib/auth/scope";

const ALL_SETTLEMENT_MODES = ["cash", "upi", "card", "creditNote", "storeCredit", "wallet"];
const DEFAULT_REASONS = ["Size Issue", "Colour Change", "Wrong Product", "Manufacturing Defect", "Customer Preference", "Damaged Item", "Other"];

export interface ExchangeConfig {
  exchangeAllowed: boolean; allowB2cExchange: boolean; allowB2bExchange: boolean;
  allowPartialExchange: boolean; allowFullExchange: boolean; allowMultipleExchange: boolean; exchangeWithoutInvoice: boolean;
  productMustMatch: boolean; allowDifferentProduct: boolean; allowSameProduct: boolean;
  allowDifferentSize: boolean; allowDifferentColour: boolean; allowDifferentVariant: boolean; allowDifferentBatch: boolean; allowDifferentSerial: boolean;
  partialQtyAllowed: boolean; fullQtyMandatory: boolean; multipleExchangeAllowed: boolean;
  allowPriceDifference: boolean; autoCalcDifference: boolean; refundIfLower: boolean; collectIfHigher: boolean; ignorePriceDifference: boolean;
  qualityInspectionRequired: boolean; approvalEnabled: boolean;
  maxExchangeDays: number | null; exchangeBasis: string; priceBasis: string; maxExchangeQty: number | null;
  approvalAutoLimit: number; approvalBasis: string[];
  settlementModes: string[]; defaultSettlement: string;
  handlingModes: string[]; defaultHandling: string;
  searchToggles: Record<string, boolean>; defaultSearch: string;
  reasons: string[];
}

/** Effective Sales-Exchange configuration for the user's active business/branch (the
 * per-branch override of the sales-settings JSON blob). Falls back to safe defaults
 * so the exchange flow works even before the config tab is touched. */
export async function getExchangeConfig(user: ScopeUser): Promise<ExchangeConfig> {
  const row = await resolveScoped((where) => prisma.salesSetting.findFirst({ where }), await settingScope(user));
  const cfg = (row?.config ?? DEFAULT_SALES_CONFIG) as { fields?: Record<string, string>; flags?: Record<string, boolean>; toggles?: Record<string, Record<string, boolean>> };
  const f = cfg.fields ?? {}; const fl = cfg.flags ?? {}; const tg = cfg.toggles ?? {};

  const period = String(f.exchangeValidityDays ?? "unlimited");
  const maxExchangeDays = period === "unlimited" || period === "" ? null : Number(period) || null;
  const maxQty = Number(f.maxExchangeQty);
  const settlementModes = Object.entries(tg.exchangeSettlement ?? {}).filter(([, v]) => v).map(([k]) => k);
  const handlingModes = Object.entries(tg.exchangeHandling ?? {}).filter(([, v]) => v).map(([k]) => k);
  const approvalBasis = Object.entries(tg.exchangeApprovalBasis ?? {}).filter(([, v]) => v).map(([k]) => k);
  let reasons: string[] = [];
  try { reasons = JSON.parse(f.exchangeReasons || "[]"); } catch { /* keep [] */ }
  if (!reasons.length) reasons = DEFAULT_REASONS;

  return {
    exchangeAllowed: fl.exchangeAllowed !== false,
    allowB2cExchange: fl.allowB2cExchange !== false,
    allowB2bExchange: fl.allowB2bExchange !== false,
    allowPartialExchange: fl.allowPartialExchange !== false,
    allowFullExchange: fl.allowFullExchange !== false,
    allowMultipleExchange: fl.allowMultipleExchange !== false,
    exchangeWithoutInvoice: !!fl.exchangeWithoutInvoice,
    productMustMatch: !!fl.productMustMatch,
    allowDifferentProduct: fl.allowDifferentProduct !== false,
    allowSameProduct: fl.allowSameProduct !== false,
    allowDifferentSize: fl.allowDifferentSize !== false,
    allowDifferentColour: fl.allowDifferentColour !== false,
    allowDifferentVariant: fl.allowDifferentVariant !== false,
    allowDifferentBatch: fl.allowDifferentBatch !== false,
    allowDifferentSerial: fl.allowDifferentSerial !== false,
    partialQtyAllowed: fl.partialQtyAllowed !== false,
    fullQtyMandatory: !!fl.fullQtyMandatory,
    multipleExchangeAllowed: fl.multipleExchangeAllowed !== false,
    allowPriceDifference: fl.allowPriceDifference !== false,
    autoCalcDifference: fl.autoCalcDifference !== false,
    refundIfLower: fl.refundIfLower !== false,
    collectIfHigher: fl.collectIfHigher !== false,
    ignorePriceDifference: !!fl.ignorePriceDifference,
    qualityInspectionRequired: !!fl.qualityInspectionRequired,
    approvalEnabled: !!fl.exchangeApprovalEnabled,
    maxExchangeDays,
    exchangeBasis: String(f.exchangeBasis || "invoiceDate"),
    priceBasis: String(f.exchangePriceBasis || "current"),
    maxExchangeQty: Number.isFinite(maxQty) && maxQty > 0 ? maxQty : null,
    approvalAutoLimit: Number(f.exchangeApprovalAutoLimit) || 0,
    approvalBasis: approvalBasis.length ? approvalBasis : ["amount"],
    settlementModes: settlementModes.length ? settlementModes : ALL_SETTLEMENT_MODES,
    defaultSettlement: String(f.defaultExchangeSettlement || settlementModes[0] || "cash"),
    handlingModes: handlingModes.length ? handlingModes : ["good", "damaged", "quarantine"],
    defaultHandling: String(f.defaultExchangeHandling || "good"),
    searchToggles: tg.exchangeSearch ?? { invoiceNo: true, mobile: true, name: true, qrCode: true, barcode: true },
    defaultSearch: String(f.defaultExchangeSearch || "invoiceNo"),
    reasons,
  };
}
