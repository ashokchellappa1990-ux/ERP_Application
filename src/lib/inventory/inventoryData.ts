import {
  LayoutDashboard,
  ScanSearch,
  ScrollText,
  Layers,
  CalendarClock,
  Hash,
  Warehouse,
  Building2,
  MapPin,
  Lock,
  ArrowLeftRight,
  SlidersHorizontal,
  ClipboardCheck,
  ListChecks,
  Scale,
  PackagePlus,
  TrendingUp,
  BarChart3,
  Sparkles,
  FileBarChart,
  type LucideIcon,
} from "lucide-react";
import { inv, invFlag } from "./inventoryConfig";
export { POS_CATALOG as INV_CATALOG } from "@/lib/sales/salesData";
export type { PosProduct as InvProduct } from "@/lib/sales/salesData";

/* ===================================================== feature catalog == */
export interface InvFeature { key: string; label: string; href: string; icon: LucideIcon; desc: string; group: string }
export const INVENTORY_FEATURES: InvFeature[] = [
  { key: "dashboard", label: "Inventory Dashboard", href: "/inventory", icon: LayoutDashboard, desc: "Stock KPIs & control policy.", group: "Overview" },
  { key: "inquiry", label: "Stock Inquiry", href: "/inventory/inquiry", icon: ScanSearch, desc: "Search availability across stores.", group: "Overview" },
  { key: "ledger", label: "Inventory Ledger", href: "/inventory/ledger", icon: ScrollText, desc: "Every stock movement, in & out.", group: "Overview" },
  { key: "batch", label: "Batch Management", href: "/inventory/batch", icon: Layers, desc: "Batches with FIFO / FEFO.", group: "Tracking" },
  { key: "expiry", label: "Expiry Management", href: "/inventory/expiry", icon: CalendarClock, desc: "Near-expiry & expired actions.", group: "Tracking" },
  { key: "serial", label: "Serial Numbers", href: "/inventory/serial", icon: Hash, desc: "Serial / IMEI & warranty.", group: "Tracking" },
  { key: "warehouse", label: "Warehouse Inventory", href: "/inventory/warehouse", icon: Warehouse, desc: "Warehouse stock & capacity.", group: "Locations" },
  { key: "branch", label: "Branch Inventory", href: "/inventory/branch", icon: Building2, desc: "Branch-wise stock & value.", group: "Locations" },
  { key: "bin", label: "Bin Locations", href: "/inventory/bin", icon: MapPin, desc: "Rack / shelf / bin mapping.", group: "Locations" },
  { key: "reservation", label: "Stock Reservation", href: "/inventory/reservation", icon: Lock, desc: "Reserve against orders.", group: "Movement" },
  { key: "transfer", label: "Stock Transfer", href: "/inventory/transfer", icon: ArrowLeftRight, desc: "Branch / warehouse transfers.", group: "Movement" },
  { key: "adjustment", label: "Stock Adjustment", href: "/inventory/adjustment", icon: SlidersHorizontal, desc: "Excess / short / damage / theft.", group: "Movement" },
  { key: "verification", label: "Physical Verification", href: "/inventory/verification", icon: ClipboardCheck, desc: "System vs physical variance.", group: "Control" },
  { key: "cyclecount", label: "Cycle Count", href: "/inventory/cyclecount", icon: ListChecks, desc: "ABC periodic counting.", group: "Control" },
  { key: "valuation", label: "Inventory Valuation", href: "/inventory/valuation", icon: Scale, desc: "FIFO / WAVG / Std + aging.", group: "Finance" },
  { key: "reorder", label: "Reorder Planning", href: "/inventory/reorder", icon: PackagePlus, desc: "Min/max, ROP & suggestions.", group: "Planning" },
  { key: "ai", label: "AI Inventory Engine", href: "/inventory/ai", icon: Sparkles, desc: "Optimization & predictions.", group: "Planning" },
  { key: "forecasting", label: "Inventory Forecasting", href: "/inventory/forecasting", icon: TrendingUp, desc: "Demand & stock-out risk.", group: "Planning" },
  { key: "analytics", label: "Inventory Analytics", href: "/inventory/analytics", icon: BarChart3, desc: "Turnover, fast/slow, dead stock.", group: "Insights" },
  { key: "reports", label: "Inventory Reports", href: "/inventory/reports", icon: FileBarChart, desc: "Stock, batch, aging & more.", group: "Insights" },
];

/* ===================================================== dashboard stats == */
export const INVENTORY_STATS = {
  skuCount: 12480, totalQty: 284600, totalValue: 20170000, lowStock: 142, outOfStock: 38,
  nearExpiry: 86, expired: 14, reserved: 5240, available: 279360, damaged: 320,
};
export const STOCK_HEALTH = [
  { label: "Healthy", value: 72, tone: "success" as const },
  { label: "Low Stock", value: 14, tone: "warning" as const },
  { label: "Overstock", value: 9, tone: "secondary" as const },
  { label: "Dead / Expired", value: 5, tone: "danger" as const },
];
export const MOVERS = {
  fast: [{ name: "Surf Excel 1kg", turns: "12.4×" }, { name: "Aashirvaad Atta 5kg", turns: "10.1×" }, { name: "Amul Butter 500g", turns: "9.6×" }],
  slow: [{ name: "Winter Jacket XL", turns: "0.4×" }, { name: "Premium Cookware Set", turns: "0.6×" }, { name: "Designer Lamp", turns: "0.8×" }],
};

/* =================================================== inquiry / ledger == */
export const INQUIRY_SAMPLE = [
  { code: "SKU-1001", name: "Surf Excel 1kg", available: 240, reserved: 18, damaged: 2, warehouse: 180, branch: 60 },
  { code: "SKU-1002", name: "Aashirvaad Atta 5kg", available: 120, reserved: 10, damaged: 0, warehouse: 90, branch: 30 },
  { code: "SKU-1003", name: "Amul Butter 500g", available: 64, reserved: 6, damaged: 1, warehouse: 40, branch: 24 },
  { code: "SKU-1005", name: "Colgate 200g", available: 150, reserved: 0, damaged: 0, warehouse: 110, branch: 40 },
];
export const LEDGER_SAMPLE = [
  { date: "12-Jun-2026", ref: "PINV/0312", type: "Purchase", inQty: 500, outQty: 0, balance: 740 },
  { date: "12-Jun-2026", ref: "INV-RT/8841", type: "Sales", inQty: 0, outQty: 18, balance: 722 },
  { date: "11-Jun-2026", ref: "TRF/CHN/26-27/0042", type: "Stock Transfer", inQty: 0, outQty: 60, balance: 740 },
  { date: "11-Jun-2026", ref: "SR/0024", type: "Sales Return", inQty: 2, outQty: 0, balance: 800 },
  { date: "10-Jun-2026", ref: "ADJ/CHN/26-27/0031", type: "Stock Adjustment", inQty: 0, outQty: 4, balance: 798 },
  { date: "01-Apr-2026", ref: "OSB-1001", type: "Opening Stock", inQty: 802, outQty: 0, balance: 802 },
];

/* ============================================= per-feature list config == */
export interface IColumn { key: string; label: string; align?: "right" | "center"; kind?: "status" | "amount" | "badge" }
export interface IKpi { label: string; value: string; tone: "primary" | "secondary" | "success" | "warning" | "danger" | "accent" }
export interface InvListConfig { title: string; desc: string; newLabel?: string; kpis: IKpi[]; columns: IColumn[]; statuses: string[]; rows: Record<string, string | number>[] }

export const INVENTORY_LISTS: Record<string, InvListConfig> = {
  batch: {
    title: "Batch Management", desc: "Batch-wise stock with FIFO / FEFO issue & expiry.", newLabel: "Add Batch",
    kpis: [{ label: "Active Batches", value: "2,232", tone: "primary" }, { label: "FEFO Default", value: "On", tone: "success" }, { label: "Near Expiry", value: "86", tone: "warning" }, { label: "Expired", value: "14", tone: "danger" }],
    columns: [{ key: "batch", label: "Batch No." }, { key: "product", label: "Product" }, { key: "mfg", label: "Mfg" }, { key: "exp", label: "Expiry" }, { key: "qty", label: "Qty", align: "right" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Active", "Near Expiry", "Expired", "Quarantined"],
    rows: [
      { batch: "BATCH-AX2310", product: "Paracetamol 500mg", mfg: "2025-08", exp: "2026-08", qty: 1840, status: "Active" },
      { batch: "BATCH-MN1188", product: "Amul Butter 500g", mfg: "2026-04", exp: "2026-07", qty: 64, status: "Near Expiry" },
      { batch: "BATCH-Q7741", product: "Cough Syrup 100ml", mfg: "2024-05", exp: "2026-05", qty: 12, status: "Expired" },
    ],
  },
  serial: {
    title: "Serial Numbers", desc: "Serial / IMEI tracked units with warranty & status.", newLabel: "Add Serial",
    kpis: [{ label: "Serialised Units", value: "1,240", tone: "primary" }, { label: "In Stock", value: "980", tone: "success" }, { label: "Sold", value: "248", tone: "secondary" }, { label: "In Warranty", value: "612", tone: "warning" }],
    columns: [{ key: "serial", label: "Serial / IMEI" }, { key: "product", label: "Product" }, { key: "purchase", label: "Purchased" }, { key: "warranty", label: "Warranty Till" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["In Stock", "Sold", "Returned", "Defective"],
    rows: [
      { serial: "IMEI-358240051111110", product: "iPhone 15 128GB", purchase: "2026-03-10", warranty: "2027-03-09", status: "In Stock" },
      { serial: "SN-LP-2231", product: "Dell Inspiron 15", purchase: "2026-02-01", warranty: "2027-01-31", status: "Sold" },
      { serial: "SN-TV-8890", product: "Sony 43\" LED", purchase: "2026-01-15", warranty: "2028-01-14", status: "Returned" },
    ],
  },
  warehouse: {
    title: "Warehouse Inventory", desc: "Warehouse stock, capacity & availability.", newLabel: "Add Warehouse",
    kpis: [{ label: "Warehouses", value: "9", tone: "primary" }, { label: "Total Value", value: "₹148L", tone: "secondary" }, { label: "Avg Utilisation", value: "78%", tone: "warning" }, { label: "Reserved", value: "₹12L", tone: "success" }],
    columns: [{ key: "code", label: "Code" }, { key: "name", label: "Warehouse" }, { key: "location", label: "Location" }, { key: "util", label: "Utilisation", align: "center", kind: "badge" }, { key: "value", label: "Stock Value", align: "right", kind: "amount" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Active", "Near Full", "Inactive"],
    rows: [
      { code: "WH-MAIN", name: "Main Warehouse", location: "Chennai", util: "82%", value: 6850000, status: "Active" },
      { code: "WH-COLD", name: "Cold Storage", location: "Chennai", util: "91%", value: 2140000, status: "Near Full" },
      { code: "WH-RETAIL", name: "Retail Floor Store", location: "Bengaluru", util: "64%", value: 1980000, status: "Active" },
    ],
  },
  branch: {
    title: "Branch Inventory", desc: "Branch-wise stock, value & reorder levels.",
    kpis: [{ label: "Branches", value: "4", tone: "primary" }, { label: "Total Value", value: "₹201L", tone: "secondary" }, { label: "Below ROL", value: "23", tone: "danger" }, { label: "Overstock", value: "11", tone: "warning" }],
    columns: [{ key: "branch", label: "Branch" }, { key: "skus", label: "SKUs", align: "right" }, { key: "qty", label: "Quantity", align: "right" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "rol", label: "Below ROL", align: "center", kind: "badge" }, { key: "status", label: "Health", align: "center", kind: "status" }],
    statuses: ["Healthy", "Low", "Overstock"],
    rows: [
      { branch: "Chennai Branch", skus: 8420, qty: 124800, value: 9820000, rol: "8", status: "Healthy" },
      { branch: "Bengaluru Branch", skus: 6210, qty: 84200, value: 6260000, rol: "11", status: "Low" },
      { branch: "Hyderabad Branch", skus: 5640, qty: 75600, value: 4090000, rol: "4", status: "Healthy" },
    ],
  },
  bin: {
    title: "Bin Locations", desc: "Rack / shelf / bin mapping for products & batches.", newLabel: "Add Bin",
    kpis: [{ label: "Bins", value: "1,840", tone: "primary" }, { label: "Mapped SKUs", value: "11,920", tone: "success" }, { label: "Empty Bins", value: "214", tone: "warning" }, { label: "Mixed Bins", value: "62", tone: "secondary" }],
    columns: [{ key: "bin", label: "Bin" }, { key: "rack", label: "Rack" }, { key: "shelf", label: "Shelf" }, { key: "product", label: "Product / Batch" }, { key: "qty", label: "Qty", align: "right" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Occupied", "Empty", "Reserved"],
    rows: [
      { bin: "A-12-03", rack: "A", shelf: "12", product: "Surf Excel 1kg", qty: 120, status: "Occupied" },
      { bin: "B-04-01", rack: "B", shelf: "04", product: "Paracetamol · BATCH-AX2310", qty: 1840, status: "Occupied" },
      { bin: "C-09-07", rack: "C", shelf: "09", product: "—", qty: 0, status: "Empty" },
    ],
  },
  reservation: {
    title: "Stock Reservation", desc: "Stock reserved against orders & transfer requests.", newLabel: "New Reservation",
    kpis: [{ label: "Active Reservations", value: "62", tone: "primary" }, { label: "Reserved Qty", value: "5,240", tone: "secondary" }, { label: "Expiring Soon", value: "7", tone: "warning" }, { label: "Released (MTD)", value: "184", tone: "success" }],
    columns: [{ key: "no", label: "Reservation" }, { key: "product", label: "Product" }, { key: "qty", label: "Qty", align: "right" }, { key: "against", label: "Against" }, { key: "expires", label: "Expires" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Active", "Fulfilled", "Expired", "Released"],
    rows: [
      { no: "RES/0118", product: "Sony 43\" LED ×4", qty: 4, against: "SO/0210", expires: "14-Jun-2026", status: "Active" },
      { no: "RES/0117", product: "Aashirvaad Atta ×50", qty: 50, against: "TRF/0042", expires: "13-Jun-2026", status: "Active" },
      { no: "RES/0116", product: "iPhone 15 ×2", qty: 2, against: "Customer Order", expires: "12-Jun-2026", status: "Fulfilled" },
    ],
  },
  transfer: {
    title: "Stock Transfer", desc: "Branch ↔ warehouse transfers with dispatch / transit / receipt.", newLabel: "New Transfer",
    kpis: [{ label: "Open Transfers", value: "12", tone: "primary" }, { label: "In Transit", value: "5", tone: "warning" }, { label: "Transit Value", value: "₹3.2L", tone: "secondary" }, { label: "Received (MTD)", value: "96", tone: "success" }],
    columns: [{ key: "no", label: "Transfer No." }, { key: "from", label: "From" }, { key: "to", label: "To" }, { key: "qty", label: "Qty", align: "right" }, { key: "type", label: "Type", align: "center", kind: "badge" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "Dispatched", "In Transit", "Received", "Partially Received"],
    rows: [
      { no: "TRF/CHN/26-27/0042", from: "Main Warehouse", to: "Bengaluru Branch", qty: 320, type: "WH → Branch", status: "In Transit" },
      { no: "TRF/CHN/26-27/0041", from: "Chennai Branch", to: "Hyderabad Branch", qty: 140, type: "Branch → Branch", status: "Received" },
      { no: "TRF/CHN/26-27/0040", from: "Cold Storage", to: "Main Warehouse", qty: 80, type: "WH → WH", status: "Dispatched" },
    ],
  },
  adjustment: {
    title: "Stock Adjustment", desc: "Excess / short / damage / theft / expiry adjustments (approval required).", newLabel: "New Adjustment",
    kpis: [{ label: "Adjustments (MTD)", value: "31", tone: "primary" }, { label: "Approval Pending", value: "6", tone: "warning" }, { label: "Write-off Value", value: "₹74k", tone: "danger" }, { label: "Approved", value: "23", tone: "success" }],
    columns: [{ key: "no", label: "Adjustment No." }, { key: "product", label: "Product" }, { key: "type", label: "Type", align: "center", kind: "badge" }, { key: "qty", label: "Qty", align: "right" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "Pending Approval", "Approved", "Rejected"],
    rows: [
      { no: "ADJ/CHN/26-27/0031", product: "Cough Syrup (Expired)", type: "Expiry", qty: -12, value: 1440, status: "Pending Approval" },
      { no: "ADJ/CHN/26-27/0030", product: "Sony 43\" LED (Damaged)", type: "Damage", qty: -1, value: 32000, status: "Approved" },
      { no: "ADJ/CHN/26-27/0029", product: "Tata Salt (Excess)", type: "Excess", qty: 20, value: 560, status: "Approved" },
    ],
  },
  verification: {
    title: "Physical Verification", desc: "System vs physical stock count with variance report.", newLabel: "New Verification",
    kpis: [{ label: "Sessions (MTD)", value: "8", tone: "primary" }, { label: "Variance Items", value: "42", tone: "warning" }, { label: "Variance Value", value: "₹28k", tone: "danger" }, { label: "Accuracy", value: "98.4%", tone: "success" }],
    columns: [{ key: "no", label: "PV No." }, { key: "scope", label: "Scope" }, { key: "method", label: "Method", align: "center", kind: "badge" }, { key: "items", label: "Items", align: "right" }, { key: "variance", label: "Variance", align: "right" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "Counting", "Variance Review", "Completed"],
    rows: [
      { no: "PV/CHN/26-27/0012", scope: "Grocery Aisle A", method: "Barcode Scan", items: 420, variance: 6, status: "Variance Review" },
      { no: "PV/CHN/26-27/0011", scope: "Pharmacy Cold", method: "Mobile App", items: 180, variance: 2, status: "Completed" },
      { no: "PV/CHN/26-27/0010", scope: "Electronics", method: "Manual Count", items: 90, variance: 1, status: "Completed" },
    ],
  },
  cyclecount: {
    title: "Cycle Count", desc: "ABC-based periodic counting (daily / weekly / monthly).", newLabel: "New Cycle Count",
    kpis: [{ label: "Scheduled", value: "14", tone: "primary" }, { label: "A-items Daily", value: "On", tone: "success" }, { label: "Due Today", value: "3", tone: "warning" }, { label: "Accuracy", value: "99.1%", tone: "secondary" }],
    columns: [{ key: "no", label: "Count No." }, { key: "class", label: "ABC", align: "center", kind: "badge" }, { key: "freq", label: "Frequency" }, { key: "items", label: "Items", align: "right" }, { key: "due", label: "Due" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Scheduled", "Counting", "Completed", "Overdue"],
    rows: [
      { no: "CC/0088", class: "A", freq: "Daily", items: 120, due: "12-Jun-2026", status: "Counting" },
      { no: "CC/0087", class: "B", freq: "Weekly", items: 340, due: "14-Jun-2026", status: "Scheduled" },
      { no: "CC/0086", class: "C", freq: "Monthly", items: 1240, due: "30-Jun-2026", status: "Scheduled" },
    ],
  },
};

/* ================================================ create-form metadata == */
export interface IFormField { key: string; label: string; type: "text" | "date" | "number" | "select" | "textarea"; options?: string[]; full?: boolean; required?: boolean }
export interface InvFormMeta { kind: "items" | "reference"; saveLabel: string; docDate: string; prefix: string; fields: IFormField[] }
export const INVENTORY_FORM_META: Record<string, InvFormMeta> = {
  transfer: { kind: "items", saveLabel: "Create Transfer", docDate: "Transfer Date", prefix: "TRF", fields: [
    { key: "type", label: "Transfer Type", type: "select", options: ["Branch → Branch", "Warehouse → Branch", "Warehouse → Warehouse"], required: true }, { key: "from", label: "From Location", type: "text", required: true }, { key: "to", label: "To Location", type: "text", required: true }, { key: "transport", label: "Transport / Vehicle", type: "text" }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  adjustment: { kind: "items", saveLabel: "Submit for Approval", docDate: "Adjustment Date", prefix: "ADJ", fields: [
    { key: "type", label: "Adjustment Type", type: "select", options: ["Excess Stock", "Short Stock", "Damage", "Theft", "Expiry"], required: true }, { key: "warehouse", label: "Warehouse / Branch", type: "text", required: true }, { key: "reason", label: "Reason", type: "textarea", full: true, required: true } ] },
  reservation: { kind: "items", saveLabel: "Reserve Stock", docDate: "Reservation Date", prefix: "RES", fields: [
    { key: "against", label: "Reserve For", type: "select", options: ["Sales Order", "Customer Order", "Transfer Request"], required: true }, { key: "ref", label: "Reference No.", type: "text", required: true }, { key: "expires", label: "Reservation Expires", type: "date" } ] },
  verification: { kind: "items", saveLabel: "Start Verification", docDate: "Verification Date", prefix: "PV", fields: [
    { key: "scope", label: "Scope / Area", type: "text", required: true }, { key: "method", label: "Count Method", type: "select", options: ["Manual Count", "Barcode Scan", "QR Scan", "Mobile App Count"], required: true }, { key: "counter", label: "Counted By", type: "text" } ] },
  cyclecount: { kind: "items", saveLabel: "Schedule Count", docDate: "Count Date", prefix: "CC", fields: [
    { key: "class", label: "ABC Class", type: "select", options: ["A", "B", "C"], required: true }, { key: "freq", label: "Frequency", type: "select", options: ["Daily", "Weekly", "Monthly", "Quarterly"], required: true }, { key: "counter", label: "Assigned To", type: "text" } ] },
  warehouse: { kind: "reference", saveLabel: "Save Warehouse", docDate: "Created", prefix: "WH", fields: [
    { key: "code", label: "Warehouse Code", type: "text", required: true }, { key: "name", label: "Warehouse Name", type: "text", required: true }, { key: "location", label: "Location", type: "text" }, { key: "capacity", label: "Capacity (units)", type: "number" }, { key: "type", label: "Type", type: "select", options: ["General", "Cold Storage", "Bonded", "Retail Floor"] } ] },
  bin: { kind: "reference", saveLabel: "Save Bin", docDate: "Created", prefix: "BIN", fields: [
    { key: "rack", label: "Rack", type: "text", required: true }, { key: "shelf", label: "Shelf", type: "text", required: true }, { key: "bin", label: "Bin", type: "text", required: true }, { key: "warehouse", label: "Warehouse", type: "text" }, { key: "capacity", label: "Capacity", type: "number" } ] },
  batch: { kind: "reference", saveLabel: "Save Batch", docDate: "Created", prefix: "BATCH", fields: [
    { key: "batch", label: "Batch Number", type: "text", required: true }, { key: "product", label: "Product", type: "text", required: true }, { key: "mfg", label: "Mfg Date", type: "date" }, { key: "exp", label: "Expiry Date", type: "date" }, { key: "supplier", label: "Supplier", type: "text" }, { key: "qty", label: "Quantity", type: "number", required: true } ] },
  serial: { kind: "reference", saveLabel: "Save Serial", docDate: "Created", prefix: "SN", fields: [
    { key: "serial", label: "Serial / IMEI", type: "text", required: true }, { key: "product", label: "Product", type: "text", required: true }, { key: "purchase", label: "Purchase Date", type: "date" }, { key: "warranty", label: "Warranty Months", type: "number" } ] },
};

/* ===================================================== config-driven ==== */
export function invNotesFor(key: string): string[] {
  const valuation = inv("valuationMethod");
  const issue = inv("batchIssue");
  switch (key) {
    case "batch": return [invFlag("batchTracking") ? "Batch tracking ON" : "OFF", `Issue: ${issue}`, invFlag("expiryTracking") ? "Expiry tracked" : "—"];
    case "expiry": return [invFlag("expiryTracking") ? "Expiry tracking ON" : "OFF", `Near-expiry: ${inv("nearExpiryDays")} days`, "Discount / return / write-off"];
    case "serial": return [invFlag("serialTracking") ? "Serial tracking ON" : "OFF", "Warranty linked", "Duplicate serial blocked"];
    case "warehouse":
    case "branch":
    case "bin": return [invFlag("multiWarehouse") ? "Multi-warehouse ON" : "—", invFlag("multiBranch") ? "Multi-branch ON" : "—", invFlag("binTracking") ? "Bin tracking ON" : "—"];
    case "reservation": return [invFlag("reservationEnabled") ? "Reservation ON" : "OFF", "Reduces available stock", "Auto-release on expiry"];
    case "transfer": return [invFlag("transferApproval") ? "Approval required" : "Direct", "Dispatch → transit → receipt", invFlag("allowNegativeStock") ? "Negative allowed" : "No negative stock"];
    case "adjustment": return [invFlag("adjustmentApproval") ? "Approval required" : "Direct", "Posts write-off to accounting", invFlag("allowNegativeStock") ? "Negative allowed" : "No negative stock"];
    case "verification":
    case "cyclecount": return [`ABC: ${inv("cycleAbc")}`, `Frequency: ${inv("countFrequency")}`, "Variance → adjustment"];
    case "valuation": return [`Method: ${valuation}`, "Aging & dead-stock", "Posts to inventory GL"];
    case "reorder":
    case "ai":
    case "forecasting": return [invFlag("aiOptimization") ? "AI optimization ON" : "OFF", "Min/Max/ROP", "Reads sales velocity & lead time"];
    default: return [`Valuation: ${valuation}`, `Issue: ${issue}`];
  }
}

export const INVENTORY_REPORTS = [
  { id: "register", name: "Stock Register", desc: "SKU-wise stock & value" },
  { id: "ledger", name: "Inventory Ledger", desc: "All movements with balance" },
  { id: "batch", name: "Batch Report", desc: "Batch-wise stock & expiry" },
  { id: "expiry", name: "Expiry Report", desc: "Near-expiry & expired" },
  { id: "serial", name: "Serial Number Report", desc: "Serial status & warranty" },
  { id: "aging", name: "Stock Aging Report", desc: "Age buckets per SKU" },
  { id: "dead", name: "Dead Stock Report", desc: "Non-moving inventory" },
  { id: "fast", name: "Fast Moving Report", desc: "High-turnover items" },
  { id: "slow", name: "Slow Moving Report", desc: "Low-turnover items" },
  { id: "valuation", name: "Inventory Valuation", desc: "FIFO / WAVG / Std value" },
  { id: "reorder", name: "Reorder Report", desc: "Below ROL & suggestions" },
  { id: "transfer", name: "Stock Transfer Report", desc: "Transfers & transit" },
  { id: "pv", name: "Physical Verification", desc: "Variance & accuracy" },
];
