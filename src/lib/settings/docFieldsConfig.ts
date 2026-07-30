/**
 * Screen-wise document field configuration: per document screen, which optional
 * fields/features are enabled and which are mandatory. The 4 commercial documents
 * (Sales Order/Invoice, Purchase Order/Invoice) read this to show/hide fields and
 * enforce required-ness. Mutable singleton (Settings screen edits it in-session).
 */
export interface DocFieldDef { key: string; label: string; mandatoryable: boolean; gst?: boolean; group: "Fields" | "Discount" | "Taxes" }
export interface DocScreen { key: string; label: string; module: "sales" | "purchase"; feature: string; fields: DocFieldDef[] }

const FEATURES: DocFieldDef[] = [
  { key: "tax", label: "Tax Column", mandatoryable: false, gst: true, group: "Taxes" },
  { key: "hsn", label: "HSN Code Column", mandatoryable: false, gst: true, group: "Taxes" },
  { key: "itemDiscount", label: "Item-level Discount", mandatoryable: false, group: "Discount" },
  { key: "txnDiscount", label: "Transaction-level Discount", mandatoryable: false, group: "Discount" },
  { key: "tds", label: "TDS", mandatoryable: false, group: "Taxes" },
  { key: "tcs", label: "TCS", mandatoryable: false, group: "Taxes" },
  { key: "otherCharges", label: "Other Charges / Tax", mandatoryable: false, group: "Taxes" },
];
const salesFields: DocFieldDef[] = [
  { key: "salesperson", label: "Salesperson", mandatoryable: true, group: "Fields" },
  { key: "paymentTerms", label: "Payment Terms", mandatoryable: true, group: "Fields" },
  { key: "deliveryMethod", label: "Delivery Method", mandatoryable: true, group: "Fields" },
  { key: "customerNote", label: "Customer Note", mandatoryable: false, group: "Fields" },
  { key: "terms", label: "Terms & Conditions", mandatoryable: false, group: "Fields" },
  { key: "attachments", label: "Attachments / File Upload", mandatoryable: false, group: "Fields" },
];
const purchaseFields: DocFieldDef[] = [
  { key: "buyer", label: "Purchaser / Buyer", mandatoryable: true, group: "Fields" },
  { key: "paymentTerms", label: "Payment Terms", mandatoryable: true, group: "Fields" },
  { key: "deliveryMethod", label: "Delivery Method", mandatoryable: true, group: "Fields" },
  { key: "note", label: "Note", mandatoryable: false, group: "Fields" },
  { key: "terms", label: "Terms & Conditions", mandatoryable: false, group: "Fields" },
  { key: "attachments", label: "Attachments / File Upload", mandatoryable: false, group: "Fields" },
];

export const DOC_SCREENS: DocScreen[] = [
  { key: "sales_order", label: "Sales Order", module: "sales", feature: "order", fields: [...salesFields, ...FEATURES] },
  { key: "sales_invoice", label: "Sales Invoice", module: "sales", feature: "invoice", fields: [...salesFields, ...FEATURES] },
  { key: "purchase_order", label: "Purchase Order", module: "purchase", feature: "order", fields: [...purchaseFields, ...FEATURES] },
  { key: "purchase_invoice", label: "Purchase Invoice", module: "purchase", feature: "invoice", fields: [...purchaseFields, ...FEATURES] },
];

/** Keys that are configurable meta-fields (everything else on a form always shows). */
export const CONFIGURABLE_FIELD_KEYS = ["salesperson", "buyer", "paymentTerms", "deliveryMethod", "customerNote", "note", "terms", "attachments"];

export interface FieldSetting { enabled: boolean; mandatory: boolean }
export type DocScreenConfig = Record<string, FieldSetting>;
export type DocFieldsConfig = Record<string, DocScreenConfig>;

function buildDefault(): DocFieldsConfig {
  const cfg: DocFieldsConfig = {};
  for (const s of DOC_SCREENS) {
    cfg[s.key] = {};
    for (const f of s.fields) {
      // sensible defaults: most enabled; mandatory off; composition/no-gst handled by company flag
      cfg[s.key][f.key] = { enabled: true, mandatory: false };
    }
  }
  return cfg;
}

export const DEFAULT_DOC_FIELDS_CONFIG: DocFieldsConfig = buildDefault();

/** Resolve a module + feature key to a configured screen key (or null if not configured). */
export function screenKeyFor(module: "sales" | "purchase", feature: string): string | null {
  const s = DOC_SCREENS.find((x) => x.module === module && x.feature === feature);
  return s ? s.key : null;
}
export function fieldOn(screen: string | null, key: string, fallback = true): boolean {
  if (!screen) return fallback;
  return DEFAULT_DOC_FIELDS_CONFIG[screen]?.[key]?.enabled ?? fallback;
}
export function fieldMust(screen: string | null, key: string, fallback = false): boolean {
  if (!screen) return fallback;
  return DEFAULT_DOC_FIELDS_CONFIG[screen]?.[key]?.mandatory ?? fallback;
}
export function setFieldSetting(screen: string, key: string, patch: Partial<FieldSetting>) {
  const sc = DEFAULT_DOC_FIELDS_CONFIG[screen] ?? (DEFAULT_DOC_FIELDS_CONFIG[screen] = {});
  sc[key] = { ...{ enabled: true, mandatory: false }, ...sc[key], ...patch };
}
