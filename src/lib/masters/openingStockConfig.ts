import {
  Package,
  Boxes,
  Layers,
  Warehouse,
  MapPin,
  Hash,
  IndianRupee,
  CalendarClock,
  Barcode,
  Ruler,
  Scale,
  Calculator,
  FileSpreadsheet,
  Sparkles,
  ShieldCheck,
  GitBranch,
  ScrollText,
  Tag,
  Building2,
  type LucideIcon,
} from "lucide-react";

/* ============================================================= types === */
export interface OField {
  name: string;
  label: string;
  icon?: LucideIcon;
  info?: string;
  sample?: string;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  full?: boolean;
  creatable?: boolean;
}
export interface OToggle { id: string; label: string; desc?: string; }
export interface OpeningStockTab { id: string; label: string; icon: LucideIcon; group: string; }

/* ================================================================ tabs == */
export const OPENING_STOCK_TABS: OpeningStockTab[] = [
  { id: "entry", label: "Stock Entry", icon: Package, group: "Capture" },
  { id: "batch", label: "Batch Info", icon: Layers, group: "Capture" },
  { id: "serial", label: "Serial Numbers", icon: Barcode, group: "Capture" },
  { id: "lot", label: "Lot Management", icon: Boxes, group: "Capture" },
  { id: "uom", label: "Multi UOM", icon: Ruler, group: "Capture" },
  { id: "valuation", label: "Valuation", icon: Scale, group: "Finance" },
  { id: "accounting", label: "Accounting", icon: Calculator, group: "Finance" },
  { id: "import", label: "Import", icon: FileSpreadsheet, group: "Migration" },
  { id: "ai", label: "AI Import Assistant", icon: Sparkles, group: "Migration" },
  { id: "verification", label: "Verification", icon: ShieldCheck, group: "Control" },
  { id: "approval", label: "Approval", icon: GitBranch, group: "Control" },
  { id: "audit", label: "Audit Trail", icon: ScrollText, group: "Control" },
];

/* ============================================================ options === */
export const STATUS_OPTS = [
  { value: "Draft", label: "Draft" },
  { value: "Pending Verification", label: "Pending Verification" },
  { value: "Pending Approval", label: "Pending Approval" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];
export const CATEGORY_OPTS = [
  { value: "Grocery", label: "Grocery" }, { value: "Pharmacy", label: "Pharmacy" },
  { value: "Textile", label: "Textile" }, { value: "Electronics", label: "Electronics" },
  { value: "Hardware", label: "Hardware" }, { value: "Furniture", label: "Furniture" },
  { value: "Cosmetics", label: "Cosmetics" }, { value: "Auto Spares", label: "Auto Spares" },
];
export const BRANCH_OPTS = [
  { value: "HO", label: "Head Office" }, { value: "BR-CHN", label: "Chennai Branch" },
  { value: "BR-BLR", label: "Bengaluru Branch" }, { value: "BR-HYD", label: "Hyderabad Branch" },
];
export const WAREHOUSE_OPTS = [
  { value: "WH-MAIN", label: "Main Warehouse" }, { value: "WH-COLD", label: "Cold Storage" },
  { value: "WH-RETAIL", label: "Retail Floor" }, { value: "WH-BOND", label: "Bonded Store" },
];
export const UOM_OPTS = [
  { value: "PCS", label: "Pieces (PCS)" }, { value: "KG", label: "Kilogram (KG)" },
  { value: "GM", label: "Gram (GM)" }, { value: "LTR", label: "Litre (LTR)" },
  { value: "BOX", label: "Box" }, { value: "BAG", label: "Bag" },
  { value: "MTR", label: "Metre (MTR)" }, { value: "DOZ", label: "Dozen" },
];
export const VALUATION_METHODS = [
  { value: "FIFO", label: "FIFO", desc: "First-In First-Out — oldest cost layers consumed first." },
  { value: "WAVG", label: "Weighted Average", desc: "Single moving-average cost across all receipts." },
  { value: "STD", label: "Standard Cost", desc: "Fixed pre-set cost; variances posted separately." },
];
export const ACCOUNT_OPTS = [
  { value: "INV-1200", label: "1200 · Inventory Asset" },
  { value: "OB-3100", label: "3100 · Opening Balance Equity" },
  { value: "INV-1210", label: "1210 · Stock-in-Transit" },
  { value: "SUS-9900", label: "9900 · Migration Suspense" },
];
export const IMPORT_SOURCES = [
  { id: "excel", label: "Excel (.xlsx)" }, { id: "csv", label: "CSV" },
  { id: "tally", label: "Tally" }, { id: "busy", label: "Busy" },
  { id: "marg", label: "Marg" }, { id: "zoho", label: "Zoho" },
  { id: "erpnext", label: "ERPNext" },
];
export const STOCK_DIMENSIONS: OToggle[] = [
  { id: "branch", label: "Branch Wise", desc: "Track stock per branch." },
  { id: "warehouse", label: "Warehouse Wise", desc: "Track stock per warehouse/store." },
  { id: "batch", label: "Batch Wise", desc: "Batch-controlled (FMCG, pharma)." },
  { id: "expiry", label: "Expiry Wise", desc: "Capture & validate expiry dates." },
  { id: "serial", label: "Serial Wise", desc: "Serial-controlled (electronics)." },
  { id: "lot", label: "Lot Wise", desc: "Lot/consignment tracking." },
  { id: "multiuom", label: "Multi UOM", desc: "Base & alternate units." },
];

/* ====================================================== field groups === */
export const ENTRY_FIELDS: OField[] = [
  { name: "productCode", label: "Product Code", icon: Hash, info: "Existing SKU / item code.", sample: "SKU-100245", type: "text" },
  { name: "productName", label: "Product Name", icon: Package, info: "Item description.", sample: "Surf Excel 1kg", type: "text", full: true },
  { name: "category", label: "Product Category", icon: Tag, info: "Product category.", type: "select", options: CATEGORY_OPTS, creatable: true },
  { name: "brand", label: "Brand", icon: Tag, info: "Brand / manufacturer.", sample: "HUL", type: "text", creatable: true },
];
export const LOCATION_FIELDS: OField[] = [
  { name: "branch", label: "Branch", icon: Building2, info: "Owning branch.", type: "select", options: BRANCH_OPTS },
  { name: "warehouse", label: "Warehouse", icon: Warehouse, info: "Storage warehouse.", type: "select", options: WAREHOUSE_OPTS },
  { name: "bin", label: "Bin Location", icon: MapPin, info: "Rack / bin / shelf.", sample: "A-12-03", type: "text" },
];
export const INVENTORY_FIELDS: OField[] = [
  { name: "quantity", label: "Quantity", icon: Boxes, info: "Opening quantity (> 0).", sample: "120", type: "number" },
  { name: "uom", label: "UOM", icon: Ruler, info: "Stock unit of measure.", type: "select", options: UOM_OPTS },
  { name: "costPrice", label: "Cost Price", icon: IndianRupee, info: "Landed cost per unit (> 0).", sample: "82.50", type: "number" },
  { name: "mrp", label: "MRP", icon: IndianRupee, info: "Maximum retail price.", sample: "110.00", type: "number" },
  { name: "sellingPrice", label: "Selling Price", icon: IndianRupee, info: "Default selling price.", sample: "99.00", type: "number" },
];
export const STOCK_DATE_FIELD: OField = { name: "stockDate", label: "Stock Date (Go-Live)", icon: CalendarClock, info: "Opening balance date — defaults to Go-Live date.", type: "date" };

export const BATCH_FIELDS: OField[] = [
  { name: "batchNo", label: "Batch Number", type: "text", sample: "BATCH-AX2310" },
  { name: "mfgDate", label: "Mfg Date", type: "date" },
  { name: "expDate", label: "Expiry Date", type: "date" },
  { name: "qty", label: "Quantity", type: "number", sample: "60" },
  { name: "cost", label: "Cost Price", type: "number", sample: "82.50" },
  { name: "mrp", label: "MRP", type: "number", sample: "110.00" },
];
export const SERIAL_FIELDS: OField[] = [
  { name: "serialNo", label: "Serial Number", type: "text", sample: "IMEI-358240051111110" },
  { name: "product", label: "Product", type: "text", sample: "iPhone 15 128GB" },
  { name: "warehouse", label: "Warehouse", type: "text", sample: "Main Warehouse" },
  { name: "cost", label: "Cost Price", type: "number", sample: "62000" },
];
export const LOT_FIELDS: OField[] = [
  { name: "lotNo", label: "Lot Number", type: "text", sample: "LOT-2026-014" },
  { name: "qty", label: "Lot Quantity", type: "number", sample: "500" },
  { name: "mfgDate", label: "Mfg Date", type: "date" },
  { name: "expDate", label: "Expiry Date", type: "date" },
];
export const UOM_ROW_FIELDS: OField[] = [
  { name: "altUom", label: "Alternate UOM", type: "text", sample: "Bag" },
  { name: "baseUom", label: "Base UOM", type: "text", sample: "KG" },
  { name: "factor", label: "Conversion Factor", type: "number", sample: "25" },
  { name: "note", label: "Note", type: "text", sample: "1 Bag = 25 KG" },
];
export const ACCOUNTING_FIELDS: OField[] = [
  { name: "inventoryAccount", label: "Inventory Account (Dr)", icon: Calculator, info: "Asset ledger debited with opening value.", type: "select", options: ACCOUNT_OPTS },
  { name: "openingAccount", label: "Opening Balance Account (Cr)", icon: Calculator, info: "Equity/suspense ledger credited.", type: "select", options: ACCOUNT_OPTS },
  { name: "postingDate", label: "Posting Date", icon: CalendarClock, info: "GL posting date.", type: "date" },
];

/* =================================================== verification ====== */
export interface VerificationCheck { id: string; label: string; severity: "error" | "warning"; }
export const VERIFICATION_CHECKS: VerificationCheck[] = [
  { id: "duplicate", label: "Duplicate Products", severity: "error" },
  { id: "negative", label: "Negative Stock", severity: "error" },
  { id: "invalidBatch", label: "Invalid Batch Numbers", severity: "error" },
  { id: "invalidExpiry", label: "Invalid / Past Expiry Dates", severity: "warning" },
  { id: "missingWarehouse", label: "Missing Warehouses", severity: "error" },
  { id: "missingProduct", label: "Missing / Unmapped Products", severity: "error" },
  { id: "zeroCost", label: "Zero or Missing Cost", severity: "warning" },
];

/* ======================================================= AI checks ===== */
export const AI_VALIDATIONS = [
  "Identify columns", "Map products", "Map warehouses", "Detect duplicates",
  "Validate batch numbers", "Validate expiry dates", "Validate costing",
];

/* ================================================= approval workflow === */
export const APPROVAL_CHAIN = [
  { role: "Inventory Executive", action: "Enters / imports opening stock" },
  { role: "Store Manager", action: "Verifies physical stock & batches" },
  { role: "Finance Manager", action: "Approves valuation & accounting impact" },
  { role: "Admin", action: "Final sign-off & locks for Go-Live" },
];

/* =========================================================== reports === */
export const REPORTS = [
  { id: "summary", name: "Opening Stock Summary", desc: "All products, quantity & value" },
  { id: "branch", name: "Branch Wise Opening Stock", desc: "Stock grouped by branch" },
  { id: "warehouse", name: "Warehouse Wise Opening Stock", desc: "Stock grouped by warehouse" },
  { id: "batch", name: "Batch Wise Opening Stock", desc: "Batch quantities & costs" },
  { id: "expiry", name: "Expiry Wise Opening Stock", desc: "Stock by expiry ageing" },
  { id: "valuation", name: "Inventory Valuation Report", desc: "FIFO / WAVG / Standard value" },
  { id: "verification", name: "Stock Verification Report", desc: "Errors & warnings found" },
  { id: "accounting", name: "Accounting Impact Report", desc: "GL entries generated" },
];

/* ====================================================== sample data ==== */
export type OSStatus = "Draft" | "Pending Verification" | "Pending Approval" | "Approved" | "Rejected";
export interface OpeningStockRow {
  id: string; code: string; name: string; branch: string; warehouse: string;
  qty: number; uom: string; cost: number; value: number; batches: number;
  status: OSStatus; method: string;
}
export const SAMPLE_OPENING_STOCK: OpeningStockRow[] = [
  { id: "OS1", code: "OSB-1001", name: "Grocery — Chennai Go-Live", branch: "Chennai Branch", warehouse: "Main Warehouse", qty: 24850, uom: "Mixed", cost: 0, value: 4820000, batches: 412, status: "Approved", method: "Weighted Average" },
  { id: "OS2", code: "OSB-1002", name: "Pharmacy — Cold Storage", branch: "Hyderabad Branch", warehouse: "Cold Storage", qty: 8640, uom: "Mixed", cost: 0, value: 2140000, batches: 1280, status: "Pending Approval", method: "FIFO" },
  { id: "OS3", code: "OSB-1003", name: "Electronics — Serial Load", branch: "Bengaluru Branch", warehouse: "Bonded Store", qty: 1240, uom: "PCS", cost: 0, value: 6850000, batches: 0, status: "Pending Verification", method: "FIFO" },
  { id: "OS4", code: "OSB-1004", name: "Textile — Retail Floor", branch: "Chennai Branch", warehouse: "Retail Floor", qty: 5120, uom: "Mixed", cost: 0, value: 1980000, batches: 0, status: "Approved", method: "Weighted Average" },
  { id: "OS5", code: "OSB-1005", name: "Hardware — HO Migration", branch: "Head Office", warehouse: "Main Warehouse", qty: 14200, uom: "Mixed", cost: 0, value: 3260000, batches: 0, status: "Draft", method: "Standard Cost" },
  { id: "OS6", code: "OSB-1006", name: "Cosmetics — Marg Import", branch: "Bengaluru Branch", warehouse: "Retail Floor", qty: 3640, uom: "PCS", cost: 0, value: 1120000, batches: 540, status: "Pending Verification", method: "FIFO" },
];

export const OPENING_STOCK_STATS = {
  products: 12480, quantity: 57690, value: 20170000, batches: 2232,
  warehouses: 9, pendingValidation: 86, pendingApprovals: 3,
};
