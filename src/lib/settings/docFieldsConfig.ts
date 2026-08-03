/**
 * Screen-wise document field configuration: per document screen, which optional
 * fields/features are enabled and which are mandatory. The 4 commercial documents
 * (Sales Order/Invoice, Purchase Order/Invoice) read this to show/hide fields and
 * enforce required-ness. Mutable singleton (Settings screen edits it in-session).
 */
export interface DocFieldDef { key: string; label: string; mandatoryable: boolean; gst?: boolean; group: string }
export interface DocScreen { key: string; label: string; module: string; feature: string; fields: DocFieldDef[] }

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

// Vehicle Gate Entry — field keys match GateEntryEditor.tsx's own state names 1:1
// so the settings screen can drive that form's show/hide + required-ness directly.
// Core identifiers (Vehicle Number, Entry Date & Time, Location, Gate Entry No)
// aren't listed — those always show, mirroring how Vehicle Number/Buyer etc.
// aren't optional on the commercial docs above.
// Dispatch Type / Reference Type are NOT here — those are handled by Dispatch
// Configuration's own default-value + lock mechanism (a preload/changeability
// concern, not a show/hide one — hiding them would break this form's
// downstream conditional sections).
const vehicleGateEntryFields: DocFieldDef[] = [
  { key: "securityOfficer", label: "Security Officer", mandatoryable: true, group: "Gate Information" },
  { key: "location", label: "Location (Branch)", mandatoryable: false, group: "Gate Information" },
  { key: "deliveryAddress", label: "Delivery Address (Direct Customer Dispatch)", mandatoryable: true, group: "Dispatch & Reference" },
  { key: "transportCompany", label: "Transport Company", mandatoryable: true, group: "Transport Details" },
  { key: "transportMode", label: "Transport Mode", mandatoryable: true, group: "Transport Details" },
  { key: "vehicleType", label: "Vehicle Type", mandatoryable: true, group: "Transport Details" },
  { key: "trailerNumber", label: "Trailer Number", mandatoryable: false, group: "Transport Details" },
  { key: "containerNumber", label: "Container Number", mandatoryable: false, group: "Transport Details" },
  { key: "driverMaster", label: "Known Driver Picker", mandatoryable: false, group: "Driver Details" },
  { key: "driverMobile", label: "Driver Mobile", mandatoryable: true, group: "Driver Details" },
  { key: "driverLicenseNo", label: "Driver License No.", mandatoryable: true, group: "Driver Details" },
  { key: "helperName", label: "Helper Name", mandatoryable: false, group: "Driver Details" },
  { key: "helperMobile", label: "Helper Mobile", mandatoryable: false, group: "Driver Details" },
  { key: "vehicleCapacity", label: "Vehicle Capacity", mandatoryable: false, group: "Vehicle Details" },
  { key: "expectedLoadWeight", label: "Expected Load Weight", mandatoryable: false, group: "Vehicle Details" },
  { key: "gpsAvailable", label: "GPS Available", mandatoryable: false, group: "Vehicle Details" },
  { key: "sealNumber", label: "Seal Number", mandatoryable: false, group: "Vehicle Details" },
  { key: "purpose", label: "Purpose", mandatoryable: false, group: "Entry Details" },
  { key: "expectedExitTime", label: "Expected Exit Time", mandatoryable: false, group: "Entry Details" },
  { key: "loadingBay", label: "Loading Bay", mandatoryable: false, group: "Entry Details" },
  { key: "remarks", label: "Remarks", mandatoryable: false, group: "Entry Details" },
  { key: "itemDetails", label: "Item Details Section", mandatoryable: false, group: "Items" },
];

// Load & Dispatch — field keys match DirectLoadDispatchForm.tsx's state names
// (the "New Vehicle Entry → Dispatch" screen) where a matching field exists;
// LoadDispatchEditor.tsx (the full view/edit screen) doesn't consume this
// config yet — same enabled-by-default fallback applies there via fieldOn's
// default parameter, so nothing breaks, it's just not wired up as show/hide yet.
const loadDispatchFields: DocFieldDef[] = [
  { key: "transportCompany", label: "Transport Company", mandatoryable: true, group: "Transport Details" },
  { key: "vehicleType", label: "Vehicle Type", mandatoryable: true, group: "Transport Details" },
  { key: "route", label: "Route", mandatoryable: false, group: "Transport Details" },
  { key: "sealNumber", label: "Seal Number", mandatoryable: false, group: "Transport Details" },
  { key: "trailerNumber", label: "Trailer Number", mandatoryable: false, group: "Transport Details" },
  { key: "containerNumber", label: "Container Number", mandatoryable: false, group: "Transport Details" },
  { key: "driverName", label: "Driver Name", mandatoryable: false, group: "Driver Details" },
  { key: "driverMobile", label: "Driver Mobile", mandatoryable: true, group: "Driver Details" },
  { key: "driverLicenseNo", label: "Driver License No.", mandatoryable: true, group: "Driver Details" },
  { key: "helperName", label: "Helper Name", mandatoryable: false, group: "Driver Details" },
  { key: "helperMobile", label: "Helper Mobile", mandatoryable: false, group: "Driver Details" },
  { key: "weighmentManagement", label: "Weighment Management Section", mandatoryable: false, group: "Weighment" },
  { key: "loadingBay", label: "Loading Bay", mandatoryable: false, group: "Loading Details" },
  { key: "supervisor", label: "Supervisor", mandatoryable: false, group: "Loading Details" },
  { key: "packages", label: "Packages", mandatoryable: false, group: "Loading Details" },
  { key: "pallets", label: "Pallets", mandatoryable: false, group: "Loading Details" },
  { key: "transportCost", label: "Transport Cost Section", mandatoryable: false, group: "Other" },
  { key: "freightCharge", label: "Freight Charge", mandatoryable: false, group: "Transport Cost" },
  { key: "loadingCharge", label: "Loading Charge", mandatoryable: false, group: "Transport Cost" },
  { key: "unloadingCharge", label: "Unloading Charge", mandatoryable: false, group: "Transport Cost" },
  { key: "fuelCharge", label: "Fuel Charge", mandatoryable: false, group: "Transport Cost" },
  { key: "tollCharge", label: "Toll Charge", mandatoryable: false, group: "Transport Cost" },
  { key: "driverAllowance", label: "Driver Allowance (Bata)", mandatoryable: false, group: "Transport Cost" },
  { key: "helperAllowance", label: "Helper Allowance", mandatoryable: false, group: "Transport Cost" },
  { key: "driverBatta", label: "Driver Batta", mandatoryable: false, group: "Transport Cost" },
  { key: "vehicleRent", label: "Vehicle Rent", mandatoryable: false, group: "Transport Cost" },
  { key: "transitPass", label: "Transit Pass", mandatoryable: false, group: "Transport Cost" },
  { key: "otherTransportCharges", label: "Other Charges", mandatoryable: false, group: "Transport Cost" },
  { key: "transportDiscount", label: "Discount", mandatoryable: false, group: "Transport Cost" },
  { key: "transportGst", label: "GST Amount", mandatoryable: false, group: "Transport Cost" },
  { key: "paymentCollection", label: "Payment Collection Section", mandatoryable: false, group: "Other" },
  { key: "remarks", label: "Remarks", mandatoryable: false, group: "Other" },
];

export const DOC_SCREENS: DocScreen[] = [
  { key: "sales_order", label: "Sales Order", module: "sales", feature: "order", fields: [...salesFields, ...FEATURES] },
  { key: "sales_invoice", label: "Sales Invoice", module: "sales", feature: "invoice", fields: [...salesFields, ...FEATURES] },
  { key: "purchase_order", label: "Purchase Order", module: "purchase", feature: "order", fields: [...purchaseFields, ...FEATURES] },
  { key: "purchase_invoice", label: "Purchase Invoice", module: "purchase", feature: "invoice", fields: [...purchaseFields, ...FEATURES] },
  { key: "vehicle_gate_entry", label: "Vehicle Gate Entry", module: "transport", feature: "gate_entry", fields: vehicleGateEntryFields },
  { key: "load_dispatch", label: "Load & Dispatch", module: "transport", feature: "load_dispatch", fields: loadDispatchFields },
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

/** Hydrate the singleton from a persisted config (DB row) — merges onto the
 * current defaults per screen/field so newly-added screens/fields not present
 * in an older saved row still get sensible defaults, mirroring how
 * DispatchConfiguration's mergeConfig deep-merges onto DEFAULT_DISPATCH_CONFIG. */
export function applyDocFieldsConfig(stored: Partial<DocFieldsConfig> | null | undefined) {
  if (!stored) return;
  for (const s of DOC_SCREENS) {
    const storedScreen = stored[s.key];
    if (!storedScreen) continue;
    for (const f of s.fields) if (storedScreen[f.key]) setFieldSetting(s.key, f.key, storedScreen[f.key]);
  }
}
