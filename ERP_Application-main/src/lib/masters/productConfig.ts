import {
  Info,
  Tag,
  Package,
  ScanLine,
  ReceiptText,
  Boxes,
  CalendarClock,
  Tags,
  Calculator,
  Layers,
  ShoppingCart,
  Truck,
  SlidersHorizontal,
  Image,
  Pill,
  GitPullRequestArrow,
  type LucideIcon,
} from "lucide-react";

/* ============================================================= types === */

export interface PField {
  name: string;
  label: string;
  icon?: LucideIcon;
  info?: string;
  sample?: string;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  full?: boolean;
  /** Master-data select that supports adding a new value inline. */
  creatable?: boolean;
}

export interface ToggleItem {
  id: string;
  label: string;
  desc?: string;
  /** Detailed "what & why" shown via the info (i) icon. */
  info?: string;
}

export interface ProductTab {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  conditional?: boolean; // pharmacy — shown only when relevant
}

/* ============================================================== tabs === */

export const PRODUCT_TABS: ProductTab[] = [
  { id: "general", label: "General Information", icon: Info, group: "Basics" },
  { id: "classification", label: "Classification", icon: Tag, group: "Basics" },
  { id: "uom", label: "Packaging & UOM", icon: Package, group: "Basics" },
  { id: "codes", label: "Product Codes", icon: ScanLine, group: "Identification" },
  { id: "tax", label: "Tax Configuration", icon: ReceiptText, group: "Compliance" },
  { id: "inventory", label: "Inventory", icon: Boxes, group: "Inventory" },
  { id: "expiry", label: "Expiry & Shelf Life", icon: CalendarClock, group: "Inventory" },
  { id: "stock", label: "Stock Control", icon: Layers, group: "Inventory" },
  { id: "pricing", label: "Pricing", icon: Tags, group: "Commercial" },
  { id: "accounting", label: "Accounting", icon: Calculator, group: "Commercial" },
  { id: "sales", label: "Sales Configuration", icon: ShoppingCart, group: "Commercial" },
  { id: "attributes", label: "Attributes & Variants", icon: SlidersHorizontal, group: "Advanced" },
  { id: "media", label: "Product Media", icon: Image, group: "Advanced" },
  { id: "pharmacy", label: "Pharmacy", icon: Pill, group: "Advanced", conditional: true },
  { id: "approval", label: "Approval Workflow", icon: GitPullRequestArrow, group: "Advanced" },
];

/* =========================================================== options === */

const opt = (arr: string[]) => arr.map((x) => ({ value: x, label: x }));

export const STATUS_OPTS = opt(["Active", "Inactive", "Blocked"]);
export const INDUSTRY_OPTS = opt(["Electronics", "Pharmaceuticals", "FMCG", "Garments & Apparel", "Cosmetics", "Footwear", "Grocery", "Hardware", "Other"]);
export const PRODUCT_TYPE_OPTS = opt(["Inventory Item", "Non-Inventory Item", "Service"]);
export const INVENTORY_CATEGORY_OPTS = opt(["Raw Material", "Finished Product"]);
export const CATEGORY_OPTS = opt(["Grocery", "Beverages", "Personal Care", "Household", "Pharmacy", "Electronics", "Textile", "Stationery"]);
export const SUBCATEGORY_OPTS = opt(["Biscuits", "Milk & Dairy", "Oral Care", "Detergents", "Tablets", "Mobiles", "Shirts", "Notebooks"]);
export const GROUP_OPTS = opt(["FMCG", "Durables", "Consumables", "Apparel"]);
export const BRAND_OPTS = opt(["Parle", "Amul", "Colgate", "Surf Excel", "Tata", "Samsung", "Nike", "Classmate"]);
export const MANUFACTURER_OPTS = opt(["Parle Products", "Amul (GCMMF)", "Colgate-Palmolive", "HUL", "Tata Consumer", "Samsung India"]);
export const UOM_OPTS = opt(["Piece", "Box", "Carton", "Packet", "Bottle", "Bag", "Kg", "Gram", "Ton", "Litre", "ml", "Dozen"]);
export const PACKAGE_TYPE_OPTS = opt(["Piece", "Box", "Carton", "Packet", "Bottle", "Bag", "Bundle"]);
export const WEIGHT_UNIT_OPTS = opt(["g", "kg", "ml", "L"]);
export const BARCODE_TYPE_OPTS = opt(["EAN13", "EAN8", "UPC", "Code128", "QR Code", "GS1 QR"]);
export const TAX_PREF_OPTS = opt(["Taxable", "Non-Taxable", "Exempt"]);
export const GST_RATE_OPTS = opt(["0%", "0.25%", "3%", "5%", "12%", "18%", "28%"]);
export const VALUATION_OPTS = [
  { value: "fifo", label: "FIFO — First In First Out" },
  { value: "fefo", label: "FEFO — First Expiry First Out" },
  { value: "notRequired", label: "Not Required" },
];
// When FIFO/FEFO is chosen, how a wrong-order batch pick at billing is handled.
export const BATCH_SALES_POLICY_OPTS = [
  { value: "restrict", label: "Sales Restricted — block out-of-order batch" },
  { value: "warn", label: "Sales Allowed — warning message only" },
];
export const SHELF_LIFE_TYPE_OPTS = opt(["Days", "Months", "Years"]);
export const ALERT_UNIT_OPTS = opt(["Days", "Months"]);
export const ACCOUNT_OPTS = opt(["Sales Revenue", "Sales Returns", "Purchase Expense", "Inventory Asset", "COGS", "Input GST", "Output GST"]);
export const SUPPLIER_OPTS = opt(["Metro Cash & Carry", "Reliance Distributors", "Local Wholesaler", "Direct from Brand"]);
export const ATTR_TYPE_OPTS = opt(["Text", "Number", "Dropdown", "Color", "Boolean"]);
export const QR_TEMPLATE_OPTS = opt(["Standard", "GS1 Digital Link", "Custom"]);

/* ====================================================== tab field defs == */

export const GENERAL_FIELDS: PField[] = [
  { name: "productType", label: "Product Type", icon: Boxes, info: "Inventory items are stock-tracked; services are not.", type: "select", options: PRODUCT_TYPE_OPTS },
  { name: "inventoryCategory", label: "Inventory Category", icon: Boxes, info: "Raw Material vs Finished Product — only applies to Inventory items.", type: "select", options: INVENTORY_CATEGORY_OPTS },
  { name: "code", label: "Product Code", icon: Tag, info: "Your internal product code — must be unique.", sample: "PRD-1001" },
  { name: "name", label: "Product Name *", icon: Package, info: "Primary display name on bills, lists and reports.", sample: "Parle-G Biscuit 100g" },
  { name: "shortName", label: "Product Short Name", icon: Tag, info: "Compact name for POS & receipts.", sample: "Parle-G 100g" },
  { name: "altName", label: "Alternate Product Name", icon: Tag, info: "Local / regional or secondary name.", sample: "Parle Glucose 100g" },
  { name: "status", label: "Product Status", icon: Info, info: "Active products are sellable; Blocked are hidden everywhere.", type: "select", options: STATUS_OPTS },
  { name: "launchDate", label: "Launch Date", icon: CalendarClock, info: "Date the product goes live for sale.", type: "date" },
  { name: "discontinuedDate", label: "Discontinued Date", icon: CalendarClock, info: "Date the product is retired (optional).", type: "date" },
  { name: "keywords", label: "Search Keywords", icon: ScanLine, info: "Comma-separated terms to find this product faster.", sample: "biscuit, glucose, parle", full: true },
  { name: "description", label: "Product Description", icon: Info, info: "Detailed description for catalog & e-commerce.", sample: "Glucose biscuits, 100g pack", type: "textarea", full: true },
];

export const CLASSIFICATION_FIELDS: PField[] = [
  { name: "industry", label: "Industry", icon: Boxes, info: "Business vertical this product belongs to (Electronics, Pharmaceuticals, FMCG, Garments, Cosmetics, Footwear…).", type: "select", options: INDUSTRY_OPTS, creatable: true },
  { name: "category", label: "Product Category", icon: Layers, info: "Top-level category for reporting & navigation.", type: "select", options: CATEGORY_OPTS, creatable: true },
  { name: "subCategory", label: "Product Sub Category", icon: Layers, info: "Finer grouping under the category.", type: "select", options: SUBCATEGORY_OPTS, creatable: true },
  { name: "group", label: "Product Group", icon: Layers, info: "Cross-category grouping (e.g. FMCG).", type: "select", options: GROUP_OPTS, creatable: true },
  { name: "brand", label: "Brand", icon: Tags, info: "Brand owner of the product.", type: "select", options: BRAND_OPTS, creatable: true },
  { name: "manufacturer", label: "Manufacturer", icon: Package, info: "Company that manufactures the product.", type: "select", options: MANUFACTURER_OPTS, creatable: true },
  { name: "family", label: "Product Family", icon: Tag, info: "Marketing/product family this belongs to.", sample: "Glucose Biscuits" },
  { name: "segment", label: "Product Segment", icon: Tag, info: "Market segment (mass, premium, etc.).", sample: "Mass" },
];

export const UOM_FIELDS: PField[] = [
  { name: "baseUom", label: "Base UOM", icon: Package, info: "The smallest unit stock is counted in.", type: "select", options: UOM_OPTS },
  { name: "purchaseUom", label: "Purchase UOM", icon: Truck, info: "Unit used when buying from suppliers.", type: "select", options: UOM_OPTS },
  { name: "salesUom", label: "Sales UOM", icon: ShoppingCart, info: "Unit used when selling to customers.", type: "select", options: UOM_OPTS },
  { name: "unitsPerCase", label: "Units Per Case", icon: Boxes, info: "How many base units in one case/carton.", sample: "24", type: "number" },
  { name: "packageType", label: "Package Type", icon: Package, info: "Physical packaging of the product.", type: "select", options: PACKAGE_TYPE_OPTS },
];
export const DIMENSION_FIELDS: PField[] = [
  { name: "height", label: "Height (cm)", icon: Package, info: "Package height.", sample: "12", type: "number" },
  { name: "width", label: "Width (cm)", icon: Package, info: "Package width.", sample: "8", type: "number" },
  { name: "length", label: "Length (cm)", icon: Package, info: "Package length.", sample: "3", type: "number" },
  { name: "volume", label: "Volume (cc)", icon: Package, info: "Package volume.", sample: "288", type: "number" },
];
export const WEIGHT_FIELDS: PField[] = [
  { name: "weightUnit", label: "Weight Unit", icon: Package, info: "Unit of measure for weight.", type: "select", options: WEIGHT_UNIT_OPTS },
  { name: "netWeight", label: "Net Weight", icon: Package, info: "Weight of the product without packaging.", sample: "100", type: "number" },
  { name: "grossWeight", label: "Gross Weight", icon: Package, info: "Weight including packaging.", sample: "108", type: "number" },
];

export const CODE_FIELDS: PField[] = [
  { name: "sku", label: "SKU", icon: ScanLine, info: "Stock Keeping Unit — unique per variant.", sample: "PARLE-G-100" },
  { name: "gtin", label: "GTIN", icon: ScanLine, info: "Global Trade Item Number.", sample: "8901234567890" },
  { name: "upc", label: "UPC", icon: ScanLine, info: "Universal Product Code (12 digits).", sample: "012345678905" },
  { name: "ean", label: "EAN", icon: ScanLine, info: "European Article Number (13 digits).", sample: "8901234567890" },
  { name: "isbn", label: "ISBN", icon: ScanLine, info: "For books & publications.", sample: "978-3-16-148410-0" },
  { name: "mpn", label: "MPN", icon: ScanLine, info: "Manufacturer Part Number.", sample: "PG-100-IN" },
  { name: "internalCode", label: "Internal Product Code", icon: Tag, info: "Your own internal reference code.", sample: "INT-1001" },
];
export const BARCODE_FIELDS: PField[] = [
  { name: "barcodeType", label: "Barcode Type", icon: ScanLine, info: "Symbology used to print/scan barcodes.", type: "select", options: BARCODE_TYPE_OPTS },
  { name: "barcodePrefix", label: "Barcode Prefix", icon: ScanLine, info: "Prefix for auto-generated barcodes.", sample: "200" },
  { name: "barcodeLength", label: "Barcode Length", icon: ScanLine, info: "Total digits in generated barcode.", sample: "13", type: "number" },
  { name: "qrTemplate", label: "QR Template", icon: ScanLine, info: "Template used when QR is required.", type: "select", options: QR_TEMPLATE_OPTS },
];

export const TAX_FIELDS: PField[] = [
  { name: "taxPref", label: "Tax Preference", icon: ReceiptText, info: "Whether the product attracts GST.", type: "select", options: TAX_PREF_OPTS },
  { name: "gstRate", label: "GST Rate", icon: ReceiptText, info: "Applicable GST slab.", type: "select", options: GST_RATE_OPTS },
  { name: "hsn", label: "HSN Code", icon: ReceiptText, info: "Harmonized System code for goods.", sample: "1905" },
  { name: "sac", label: "SAC Code", icon: ReceiptText, info: "Service Accounting Code (for services).", sample: "998314" },
];

export const PRICING_PURCHASE: PField[] = [
  { name: "stdPurchasePrice", label: "Standard Purchase Price", icon: Truck, info: "Default buying price (excl. tax).", sample: "8.50", type: "number" },
  { name: "lastPurchasePrice", label: "Last Purchase Price", icon: Truck, info: "Most recent buying price.", sample: "8.75", type: "number" },
];
export const PRICING_SALES: PField[] = [
  { name: "mrp", label: "MRP", icon: Tags, info: "Maximum Retail Price printed on the pack.", sample: "10.00", type: "number" },
  { name: "retailPrice", label: "Retail Price", icon: Tags, info: "Selling price to walk-in customers.", sample: "10.00", type: "number" },
  { name: "wholesalePrice", label: "Wholesale Price", icon: Tags, info: "Price for wholesale buyers.", sample: "9.20", type: "number" },
  { name: "distributorPrice", label: "Distributor Price", icon: Tags, info: "Price for distributors.", sample: "8.90", type: "number" },
  { name: "dealerPrice", label: "Dealer Price", icon: Tags, info: "Price for dealers.", sample: "9.00", type: "number" },
  { name: "franchisePrice", label: "Franchise Price", icon: Tags, info: "Price for franchise outlets.", sample: "9.10", type: "number" },
  { name: "onlinePrice", label: "Online Selling Price", icon: Tags, info: "Price on e-commerce channels.", sample: "10.50", type: "number" },
];
export const PRICING_REGIONAL: PField[] = [
  { name: "localPrice", label: "Local Sales Price", icon: Tags, info: "Intra-state selling price.", sample: "10.00", type: "number" },
  { name: "interstatePrice", label: "Interstate Sales Price", icon: Tags, info: "Inter-state selling price.", sample: "10.20", type: "number" },
];

export const ACCOUNTING_FIELDS: PField[] = [
  { name: "salesRevenueAcct", label: "Sales Revenue Account", icon: Calculator, info: "Ledger credited on sale.", type: "select", options: ACCOUNT_OPTS },
  { name: "salesInventoryAcct", label: "Sales Inventory Account", icon: Calculator, info: "Inventory ledger reduced on sale.", type: "select", options: ACCOUNT_OPTS },
  { name: "purchaseExpenseAcct", label: "Purchase Expense Account", icon: Calculator, info: "Ledger debited on purchase.", type: "select", options: ACCOUNT_OPTS },
  { name: "purchaseInventoryAcct", label: "Purchase Inventory Account", icon: Calculator, info: "Inventory ledger increased on purchase.", type: "select", options: ACCOUNT_OPTS },
  { name: "costCenter", label: "Cost Center", icon: Layers, info: "Cost center for this product's expenses.", sample: "Main Store" },
  { name: "profitCenter", label: "Profit Center", icon: Layers, info: "Profit center for performance tracking.", sample: "Grocery" },
  { name: "salesDesc", label: "Sales Description", icon: Info, info: "Description shown on sales documents.", sample: "Parle-G Glucose Biscuit 100g", full: true },
  { name: "purchaseDesc", label: "Purchase Description", icon: Info, info: "Description shown on purchase documents.", sample: "Parle-G 100g — case of 24", full: true },
];

export const STOCK_OPENING: PField[] = [
  { name: "openingQty", label: "Opening Quantity", icon: Boxes, info: "Stock on hand at go-live.", sample: "500", type: "number" },
  { name: "openingValue", label: "Opening Stock Value", icon: Calculator, info: "Total value of opening stock.", sample: "4250", type: "number" },
];
export const STOCK_REORDER: PField[] = [
  { name: "minStock", label: "Minimum Stock Level", icon: Layers, info: "Floor below which stock is critical.", sample: "50", type: "number" },
  { name: "maxStock", label: "Maximum Stock Level", icon: Layers, info: "Ceiling to avoid overstocking.", sample: "1000", type: "number" },
  { name: "reorderLevel", label: "Reorder Level", icon: Layers, info: "Level that triggers a reorder.", sample: "120", type: "number" },
  { name: "safetyStock", label: "Safety Stock", icon: Layers, info: "Buffer for demand/lead-time variation.", sample: "30", type: "number" },
  { name: "leadTime", label: "Lead Time (Days)", icon: CalendarClock, info: "Days from order to receipt.", sample: "3", type: "number" },
];

export const EXPIRY_FIELDS: PField[] = [
  { name: "shelfLifeType", label: "Shelf Life Type", icon: CalendarClock, info: "Unit for the shelf-life value.", type: "select", options: SHELF_LIFE_TYPE_OPTS },
  { name: "shelfLifeValue", label: "Shelf Life Value", icon: CalendarClock, info: "How long the product stays good.", sample: "12", type: "number" },
  { name: "alertUnit", label: "Alert Before Expiry (Unit)", icon: CalendarClock, info: "Unit for the near-expiry alert.", type: "select", options: ALERT_UNIT_OPTS },
  { name: "alertValue", label: "Alert Value", icon: CalendarClock, info: "How far ahead to warn of expiry.", sample: "60", type: "number" },
];

export const PURCHASE_FIELDS: PField[] = [
  { name: "preferredSupplier", label: "Preferred Supplier", icon: Truck, info: "Default supplier for reordering.", type: "select", options: SUPPLIER_OPTS },
  { name: "purchaseLeadTime", label: "Purchase Lead Time (Days)", icon: CalendarClock, info: "Expected delivery time from this supplier.", sample: "3", type: "number" },
];

/* ===================================================== toggle groups === */

export const INVENTORY_TRACKING: ToggleItem[] = [
  { id: "stockMaintenance", label: "Stock Maintenance Required", desc: "Track quantity on hand", info: "When ON, the system counts stock for this product — it goes up on purchase/GRN and down on sale, and shows in stock reports. Turn OFF for services or non-stock items that aren't counted." },
  { id: "batch", label: "Batch Tracking", info: "Track stock by batch number. Every receipt creates a batch, so you know which batch was sold and can recall or report a specific batch. Common for FMCG, food, cosmetics & pharma." },
  { id: "lot", label: "Lot Tracking", info: "Group received stock into lots for quality control and traceability — similar to batch, typically used for manufacturing/production lots." },
  { id: "serial", label: "Serial Number Tracking", info: "Assign a unique serial number to every single unit (e.g. phones, TVs, appliances). Enables per-unit tracking and warranty lookup at sale & service." },
  { id: "mfg", label: "Manufacturing Date Tracking", info: "Capture the manufacturing date when stock is received. Combined with shelf life it computes expiry and drives FEFO (first-expiry-first-out) picking." },
  { id: "expiry", label: "Expiry Date Tracking", info: "Track an expiry date per batch and warn or block the sale of near-expiry / expired stock. Essential for pharmacy, grocery & cosmetics." },
  { id: "warranty", label: "Warranty Tracking", info: "Record the warranty period so claims can be validated from the sale or serial number. Use for electronics, appliances & durables." },
  { id: "trace", label: "Product Traceability", info: "Full forward & backward traceability — links supplier → batch → customer so you can trace any unit for recalls and audits." },
];
export const INVENTORY_CONTROLS: ToggleItem[] = [
  { id: "negative", label: "Negative Stock Allowed", info: "Allow billing/issuing even when on-hand stock is zero or would go negative. Convenient at busy counters but can hide stock errors — keep OFF for strict control." },
  { id: "backorder", label: "Back Order Allowed", info: "Accept orders for out-of-stock items and fulfil them automatically when new stock arrives, instead of rejecting the sale." },
  { id: "reservation", label: "Stock Reservation Allowed", info: "Let stock be reserved for a specific order or customer so it can't be sold to anyone else until released or invoiced." },
  { id: "blocking", label: "Stock Blocking Allowed", info: "Let stock be put on hold (e.g. damaged, QC-pending, expiry hold) so it is excluded from available-for-sale quantity." },
];
export const SALES_TOGGLES: ToggleItem[] = [
  { id: "salesAllowed", label: "Sales Allowed" },
  { id: "salesReturn", label: "Sales Return Allowed" },
  { id: "bulkSales", label: "Bulk Sales Allowed" },
  { id: "creditSales", label: "Credit Sales Allowed" },
  { id: "discountAllowed", label: "Discount Allowed" },
];
export const SALES_CONTROLS: ToggleItem[] = [
  { id: "ageRestricted", label: "Age Restricted Product", desc: "Requires age verification at POS" },
  { id: "specialApproval", label: "Special Approval Required" },
];
export const PHARMACY_TOGGLES: ToggleItem[] = [
  { id: "prescription", label: "Prescription Required" },
  { id: "schedule", label: "Schedule Drug", desc: "Schedule H / H1 / X control" },
  { id: "batchMandatory", label: "Batch Mandatory" },
  { id: "expiryMandatory", label: "Expiry Mandatory" },
  { id: "drugLicense", label: "Drug License Compliance" },
];

/* ====================================================== sample data ==== */

export type ProductStatus = "Active" | "Inactive" | "Blocked";

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string;
  uom: string;
  mrp: number;
  stock: number;
  reorder: number;
  status: ProductStatus;
  gst: string;
  expiry?: string;
}

export const SAMPLE_PRODUCTS: ProductRow[] = [
  { id: "P1", code: "PRD-1001", name: "Parle-G Biscuit 100g", category: "Grocery", brand: "Parle", uom: "Packet", mrp: 10, stock: 540, reorder: 120, status: "Active", gst: "18%" },
  { id: "P2", code: "PRD-1002", name: "Amul Gold Milk 500ml", category: "Grocery", brand: "Amul", uom: "Bottle", mrp: 33, stock: 18, reorder: 50, status: "Active", gst: "5%", expiry: "2026-06-12" },
  { id: "P3", code: "PRD-1003", name: "Colgate MaxFresh 150g", category: "Personal Care", brand: "Colgate", uom: "Piece", mrp: 99, stock: 11, reorder: 40, status: "Active", gst: "18%" },
  { id: "P4", code: "PRD-1004", name: "Surf Excel Matic 1kg", category: "Household", brand: "Surf Excel", uom: "Packet", mrp: 145, stock: 9, reorder: 30, status: "Active", gst: "18%" },
  { id: "P5", code: "PRD-1005", name: "Tata Salt 1kg", category: "Grocery", brand: "Tata", uom: "Packet", mrp: 28, stock: 4, reorder: 60, status: "Active", gst: "5%" },
  { id: "P6", code: "PRD-1006", name: "Samsung 25W Charger", category: "Electronics", brand: "Samsung", uom: "Piece", mrp: 1499, stock: 22, reorder: 10, status: "Active", gst: "18%" },
  { id: "P7", code: "PRD-1007", name: "Paracetamol 500mg Strip", category: "Pharmacy", brand: "Tata", uom: "Strip", mrp: 30, stock: 6, reorder: 80, status: "Active", gst: "12%", expiry: "2026-07-01" },
  { id: "P8", code: "PRD-1008", name: "Classmate Notebook 200pg", category: "Stationery", brand: "Classmate", uom: "Piece", mrp: 65, stock: 0, reorder: 50, status: "Inactive", gst: "12%" },
  { id: "P9", code: "PRD-1009", name: "Old Spice Deo 150ml", category: "Personal Care", brand: "Colgate", uom: "Bottle", mrp: 220, stock: 320, reorder: 40, status: "Blocked", gst: "18%" },
];

export const DASHBOARD_STATS = {
  total: 1248,
  active: 1180,
  inactive: 68,
  lowStock: 27,
  nearExpiry: 14,
  newAdded: 32,
};
