/**
 * GRN batch-wise pricing — line-item field configuration (enable / mandatory)
 * plus category-wise behaviour. The GRN form reads this so every batch-pricing
 * field can be turned on/off and made mandatory from Settings. Mutable singleton.
 */
export interface GrnField { key: string; label: string; group: "Batch" | "Pricing" | "Control"; mandatoryable: boolean; price?: boolean }
export const GRN_LINE_FIELDS: GrnField[] = [
  { key: "batchNo", label: "Batch Number", group: "Batch", mandatoryable: true },
  { key: "mfgDate", label: "Manufacturing Date", group: "Batch", mandatoryable: true },
  { key: "expDate", label: "Expiry Date", group: "Batch", mandatoryable: true },
  { key: "cost", label: "Purchase Cost", group: "Pricing", mandatoryable: true, price: true },
  { key: "mrp", label: "MRP", group: "Pricing", mandatoryable: true, price: true },
  { key: "retail", label: "Retail Price", group: "Pricing", mandatoryable: false, price: true },
  { key: "wholesale", label: "Wholesale Price", group: "Pricing", mandatoryable: false, price: true },
  { key: "dealer", label: "Dealer Price", group: "Pricing", mandatoryable: false, price: true },
  { key: "distributor", label: "Distributor Price", group: "Pricing", mandatoryable: false, price: true },
  { key: "online", label: "Online Price", group: "Pricing", mandatoryable: false, price: true },
  { key: "margin", label: "Margin %", group: "Pricing", mandatoryable: false },
  { key: "effectiveDate", label: "Effective Date", group: "Control", mandatoryable: false },
  { key: "reason", label: "Price Revision Reason", group: "Control", mandatoryable: false },
];

export interface GrnFieldSetting { enabled: boolean; mandatory: boolean }
function build(): Record<string, GrnFieldSetting> {
  const c: Record<string, GrnFieldSetting> = {};
  const mustDefault = ["batchNo", "cost", "mrp"];
  for (const f of GRN_LINE_FIELDS) c[f.key] = { enabled: true, mandatory: mustDefault.includes(f.key) };
  return c;
}
export const DEFAULT_GRN_PRICING_CONFIG: Record<string, GrnFieldSetting> = build();
export const grnFieldOn = (k: string) => DEFAULT_GRN_PRICING_CONFIG[k]?.enabled ?? true;
export const grnFieldMust = (k: string) => !!DEFAULT_GRN_PRICING_CONFIG[k]?.mandatory;
export function setGrnField(k: string, patch: Partial<GrnFieldSetting>) {
  DEFAULT_GRN_PRICING_CONFIG[k] = { ...{ enabled: true, mandatory: false }, ...DEFAULT_GRN_PRICING_CONFIG[k], ...patch };
}
/** Hydrate the singleton from a persisted config (DB row). */
export function applyGrnConfig(stored: Partial<Record<string, GrnFieldSetting>> | null | undefined) {
  if (!stored) return;
  for (const f of GRN_LINE_FIELDS) if (stored[f.key]) setGrnField(f.key, stored[f.key]!);
}

/* ----------------------------------------------- category behaviour ---- */
export interface CategoryRule {
  category: string;
  batch: "Mandatory" | "Optional" | "N/A";
  expiry: "Mandatory" | "Optional" | "N/A";
  batchPrice: "Mandatory" | "Allowed" | "N/A";
  pricing: "Product" | "Batch" | "Variant" | "Customer";
  serial: boolean;
  contract?: boolean;
}
export const CATEGORY_RULES: CategoryRule[] = [
  { category: "Pharmacy", batch: "Mandatory", expiry: "Mandatory", batchPrice: "Mandatory", pricing: "Batch", serial: false },
  { category: "Grocery", batch: "Optional", expiry: "Optional", batchPrice: "Allowed", pricing: "Batch", serial: false },
  { category: "Electronics", batch: "Optional", expiry: "N/A", batchPrice: "Allowed", pricing: "Product", serial: true },
  { category: "Textile", batch: "Optional", expiry: "N/A", batchPrice: "Allowed", pricing: "Variant", serial: false },
  { category: "Wholesale", batch: "Optional", expiry: "Optional", batchPrice: "Allowed", pricing: "Customer", serial: false, contract: true },
];
export function ruleFor(category: string): CategoryRule {
  return CATEGORY_RULES.find((r) => new RegExp(r.category, "i").test(category))
    ?? (/dairy|beverage|personal/i.test(category) ? CATEGORY_RULES[1] : CATEGORY_RULES[1]);
}
