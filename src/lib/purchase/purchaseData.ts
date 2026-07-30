import {
  LayoutDashboard,
  ClipboardList,
  FileQuestion,
  GitCompare,
  ShoppingBag,
  GitBranch,
  PackageCheck,
  ReceiptText,
  Coins,
  Undo2,
  FileMinus,
  Banknote,
  Sparkles,
  TrendingUp,
  FileBarChart,
  type LucideIcon,
} from "lucide-react";
import { pf, pflag } from "./purchaseConfig";
export { POS_CATALOG as PURCHASE_CATALOG } from "@/lib/sales/salesData";
export type { PosProduct as PurchaseProduct } from "@/lib/sales/salesData";

/* ===================================================== feature catalog == */
export interface PurchaseFeature { key: string; label: string; href: string; icon: LucideIcon; desc: string; group: string }
export const PURCHASE_FEATURES: PurchaseFeature[] = [
  { key: "dashboard", label: "Purchase Dashboard", href: "/purchase", icon: LayoutDashboard, desc: "Procurement KPIs & policy.", group: "Overview" },
  { key: "requisition", label: "Purchase Requisition", href: "/purchase/requisition", icon: ClipboardList, desc: "Internal indents for procurement.", group: "Sourcing" },
  { key: "rfq", label: "RFQ Management", href: "/purchase/rfq", icon: FileQuestion, desc: "Request quotes from suppliers.", group: "Sourcing" },
  { key: "comparison", label: "Supplier Comparison", href: "/purchase/comparison", icon: GitCompare, desc: "Compare quotes & pick the best.", group: "Sourcing" },
  { key: "order", label: "Purchase Order", href: "/purchase/order", icon: ShoppingBag, desc: "Confirmed orders to suppliers.", group: "Ordering" },
  { key: "approval", label: "Purchase Approval", href: "/purchase/approval", icon: GitBranch, desc: "Threshold & multi-level approvals.", group: "Ordering" },
  { key: "grn", label: "Goods Receipt Note", href: "/purchase/grn", icon: PackageCheck, desc: "Receive & QC against PO.", group: "Receiving" },
  { key: "invoice", label: "Purchase Invoice", href: "/purchase/invoice", icon: ReceiptText, desc: "Supplier bills & 3-way match.", group: "Receiving" },
  { key: "landedcost", label: "Landed Cost", href: "/purchase/landedcost", icon: Coins, desc: "Allocate freight, duty & clearing.", group: "Receiving" },
  { key: "return", label: "Purchase Return", href: "/purchase/return", icon: Undo2, desc: "Return goods to supplier.", group: "Post-Purchase" },
  { key: "debitnote", label: "Debit Note", href: "/purchase/debitnote", icon: FileMinus, desc: "Debit supplier for returns/claims.", group: "Post-Purchase" },
  { key: "payments", label: "Supplier Payments", href: "/purchase/payments", icon: Banknote, desc: "Pay suppliers against bills.", group: "Payables" },
  { key: "planning", label: "AI Purchase Planning", href: "/purchase/planning", icon: Sparkles, desc: "AI reorder & buying suggestions.", group: "Intelligence" },
  { key: "forecasting", label: "Demand Forecasting", href: "/purchase/forecasting", icon: TrendingUp, desc: "Forecast demand & coverage.", group: "Intelligence" },
  { key: "reports", label: "Purchase Reports", href: "/purchase/reports", icon: FileBarChart, desc: "Procurement & payables reports.", group: "Intelligence" },
];

/* ===================================================== dashboard stats == */
export const PURCHASE_DASHBOARD_STATS = {
  openPR: 14, openPO: 28, poValue: 4820000, pendingGRN: 9, pendingInvoices: 12, payables: 2640000, pendingApprovals: 6, returns: 7,
};
export const TOP_SUPPLIERS = [
  { name: "Hindustan Unilever Ltd", spend: 1840000, orders: 42, rating: 4.7 },
  { name: "ITC Distributors", spend: 1210000, orders: 31, rating: 4.5 },
  { name: "Crescent Pharma Dist.", spend: 980000, orders: 28, rating: 4.2 },
  { name: "MGB Hardware Supplies", spend: 640000, orders: 19, rating: 4.0 },
  { name: "Amul Regional Depot", spend: 520000, orders: 24, rating: 4.6 },
];
/** Supplier master (sample) — selecting one prefills GSTIN, terms & tax method on PO/PI. */
export const SAMPLE_SUPPLIERS = [
  { name: "Hindustan Unilever Ltd", gst: "27AAACH1234A1Z5", contact: "+91 98200 11111", terms: "Net 30", taxMethod: "exclusive" },
  { name: "ITC Distributors", gst: "33AABCI5678B1Z2", contact: "+91 98400 22222", terms: "Net 15", taxMethod: "exclusive" },
  { name: "Crescent Pharma Dist.", gst: "36AAFCC9012C1Z8", contact: "+91 98660 33333", terms: "Net 45", taxMethod: "inclusive" },
  { name: "Amul Regional Depot", gst: "24AAACA3456D1Z1", contact: "+91 99250 44444", terms: "Advance", taxMethod: "exclusive" },
  { name: "MGB Hardware Supplies", gst: "33AAGFM7890E1Z6", contact: "+91 90030 55555", terms: "Net 30", taxMethod: "exclusive" },
];

export const SPEND_BY_CATEGORY = [
  { label: "Grocery", value: 46, tone: "primary" as const },
  { label: "Personal Care", value: 22, tone: "secondary" as const },
  { label: "Dairy", value: 18, tone: "success" as const },
  { label: "Beverages", value: 14, tone: "warning" as const },
];

/* ============================================= per-feature list config == */
export interface PColumn { key: string; label: string; align?: "right" | "center"; kind?: "status" | "amount" | "badge" }
export interface PKpi { label: string; value: string; tone: "primary" | "secondary" | "success" | "warning" | "danger" | "accent" }
export interface PurchaseListConfig { title: string; desc: string; newLabel?: string; kpis: PKpi[]; columns: PColumn[]; statuses: string[]; rows: Record<string, string | number>[] }

export const PURCHASE_LISTS: Record<string, PurchaseListConfig> = {
  requisition: {
    title: "Purchase Requisition", desc: "Internal indents raised by branches/departments for procurement.", newLabel: "New Requisition",
    kpis: [{ label: "Open PRs", value: "14", tone: "primary" }, { label: "Approved", value: "9", tone: "success" }, { label: "Converted to PO", value: "61%", tone: "secondary" }, { label: "Urgent", value: "3", tone: "danger" }],
    columns: [{ key: "no", label: "PR No." }, { key: "dept", label: "Department" }, { key: "date", label: "Date" }, { key: "items", label: "Items", align: "center" }, { key: "priority", label: "Priority", align: "center", kind: "badge" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "Pending", "Approved", "Converted", "Rejected"],
    rows: [
      { no: "PR/CHN/26-27/0014", dept: "Grocery Floor", date: "09-Jun-2026", items: 18, priority: "High", status: "Pending" },
      { no: "PR/CHN/26-27/0013", dept: "Pharmacy", date: "08-Jun-2026", items: 24, priority: "Urgent", status: "Approved" },
      { no: "PR/CHN/26-27/0012", dept: "Warehouse", date: "07-Jun-2026", items: 9, priority: "Normal", status: "Converted" },
      { no: "PR/CHN/26-27/0011", dept: "Cosmetics", date: "06-Jun-2026", items: 12, priority: "Normal", status: "Draft" },
    ],
  },
  rfq: {
    title: "RFQ Management", desc: "Request for Quotation sent to multiple suppliers for comparison.", newLabel: "New RFQ",
    kpis: [{ label: "Open RFQs", value: "8", tone: "primary" }, { label: "Quotes Received", value: "23", tone: "success" }, { label: "Avg Suppliers", value: "3.4", tone: "secondary" }, { label: "Awaiting Reply", value: "5", tone: "warning" }],
    columns: [{ key: "no", label: "RFQ No." }, { key: "title", label: "Requirement" }, { key: "suppliers", label: "Suppliers", align: "center" }, { key: "quotes", label: "Quotes", align: "center" }, { key: "due", label: "Reply By" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "Sent", "Quotes In", "Compared", "Closed"],
    rows: [
      { no: "RFQ/CHN/26-27/0021", title: "Diwali Grocery Stock", suppliers: 4, quotes: 3, due: "14-Jun-2026", status: "Quotes In" },
      { no: "RFQ/CHN/26-27/0020", title: "Pharma Restock", suppliers: 3, quotes: 3, due: "12-Jun-2026", status: "Compared" },
      { no: "RFQ/CHN/26-27/0019", title: "Hardware Bulk", suppliers: 5, quotes: 2, due: "16-Jun-2026", status: "Sent" },
    ],
  },
  order: {
    title: "Purchase Order", desc: "Confirmed orders issued to suppliers.", newLabel: "New Purchase Order",
    kpis: [{ label: "Open POs", value: "28", tone: "primary" }, { label: "PO Value", value: "₹48.2L", tone: "secondary" }, { label: "Partially Received", value: "11", tone: "warning" }, { label: "Awaiting Approval", value: "6", tone: "danger" }],
    columns: [{ key: "no", label: "PO No." }, { key: "supplier", label: "Supplier" }, { key: "date", label: "Date" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "receipt", label: "Receipt", align: "center", kind: "badge" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "Pending Approval", "Approved", "Partially Received", "Closed"],
    rows: [
      { no: "PO/CHN/26-27/0288", supplier: "Hindustan Unilever Ltd", date: "09-Jun-2026", value: 484000, receipt: "Pending", status: "Approved" },
      { no: "PO/CHN/26-27/0287", supplier: "ITC Distributors", date: "08-Jun-2026", value: 218400, receipt: "Partial", status: "Partially Received" },
      { no: "PO/CHN/26-27/0286", supplier: "Crescent Pharma Dist.", date: "08-Jun-2026", value: 312000, receipt: "Pending", status: "Pending Approval" },
      { no: "PO/CHN/26-27/0285", supplier: "Amul Regional Depot", date: "07-Jun-2026", value: 96000, receipt: "Done", status: "Closed" },
    ],
  },
  grn: {
    title: "Goods Receipt Note", desc: "Receive goods against a PO with QC, batch & expiry capture.", newLabel: "New GRN",
    kpis: [{ label: "Pending GRN", value: "9", tone: "primary" }, { label: "Received (MTD)", value: "184", tone: "success" }, { label: "QC Holds", value: "4", tone: "warning" }, { label: "Short/Excess", value: "6", tone: "danger" }],
    columns: [{ key: "no", label: "GRN No." }, { key: "po", label: "Against PO" }, { key: "supplier", label: "Supplier" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "qc", label: "QC", align: "center", kind: "badge" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "QC Pending", "Accepted", "Partially Accepted", "Rejected"],
    rows: [
      { no: "GRN/CHN/26-27/0192", po: "PO/0287", supplier: "ITC Distributors", value: 142000, qc: "Passed", status: "Accepted" },
      { no: "GRN/CHN/26-27/0191", po: "PO/0288", supplier: "Hindustan Unilever Ltd", value: 240000, qc: "Pending", status: "QC Pending" },
      { no: "GRN/CHN/26-27/0190", po: "PO/0286", supplier: "Crescent Pharma Dist.", value: 156000, qc: "Hold", status: "Partially Accepted" },
    ],
  },
  invoice: {
    title: "Purchase Invoice", desc: "Supplier bills booked with 3-way match (PO ↔ GRN ↔ Invoice).", newLabel: "New Purchase Invoice",
    kpis: [{ label: "Pending Invoices", value: "12", tone: "primary" }, { label: "Matched", value: "94%", tone: "success" }, { label: "Mismatch Held", value: "3", tone: "danger" }, { label: "Booked Value", value: "₹26.4L", tone: "secondary" }],
    columns: [{ key: "no", label: "Invoice" }, { key: "supplier", label: "Supplier" }, { key: "po", label: "PO / GRN" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "match", label: "3-Way", align: "center", kind: "badge" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "Matched", "Mismatch", "Approved", "Paid"],
    rows: [
      { no: "PINV/0312", supplier: "ITC Distributors", po: "PO/0287 · GRN/0192", value: 142000, match: "Matched", status: "Approved" },
      { no: "PINV/0311", supplier: "Hindustan Unilever Ltd", po: "PO/0288 · GRN/0191", value: 240000, match: "Pending", status: "Draft" },
      { no: "PINV/0310", supplier: "Crescent Pharma Dist.", po: "PO/0286 · GRN/0190", value: 312000, match: "Mismatch", status: "Mismatch" },
    ],
  },
  landedcost: {
    title: "Landed Cost", desc: "Allocate freight, duty, insurance & clearing onto item costs.", newLabel: "New Landed Cost",
    kpis: [{ label: "Open Allocations", value: "5", tone: "primary" }, { label: "Allocated (MTD)", value: "₹2.1L", tone: "secondary" }, { label: "Avg Uplift", value: "3.8%", tone: "warning" }, { label: "Pending", value: "2", tone: "danger" }],
    columns: [{ key: "no", label: "LC No." }, { key: "grn", label: "Against GRN" }, { key: "supplier", label: "Supplier" }, { key: "charges", label: "Charges", align: "right", kind: "amount" }, { key: "basis", label: "Basis", align: "center", kind: "badge" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "Allocated", "Posted"],
    rows: [
      { no: "LC/0044", grn: "GRN/0192", supplier: "ITC Distributors", charges: 8400, basis: "Value", status: "Allocated" },
      { no: "LC/0043", grn: "GRN/0190", supplier: "Crescent Pharma Dist.", charges: 12600, basis: "Qty", status: "Draft" },
    ],
  },
  return: {
    title: "Purchase Return", desc: "Return rejected / damaged / excess goods to the supplier.", newLabel: "New Purchase Return",
    kpis: [{ label: "Returns (MTD)", value: "7", tone: "primary" }, { label: "Return Value", value: "₹84k", tone: "secondary" }, { label: "Debit Notes", value: "6", tone: "success" }, { label: "Pending", value: "2", tone: "warning" }],
    columns: [{ key: "no", label: "Return No." }, { key: "grn", label: "Against GRN/Invoice" }, { key: "supplier", label: "Supplier" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "reason", label: "Reason" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Requested", "Approved", "Debit Note Issued", "Dispatched", "Rejected"],
    rows: [
      { no: "PRTN/0031", grn: "GRN/0190", supplier: "Crescent Pharma Dist.", value: 18600, reason: "Near expiry", status: "Debit Note Issued" },
      { no: "PRTN/0030", grn: "GRN/0188", supplier: "MGB Hardware Supplies", value: 9400, reason: "Damaged", status: "Approved" },
    ],
  },
  debitnote: {
    title: "Debit Note", desc: "Debit the supplier for returns, rate differences or claims.", newLabel: "New Debit Note",
    kpis: [{ label: "Debit Notes (MTD)", value: "6", tone: "primary" }, { label: "Debited Value", value: "₹62k", tone: "secondary" }, { label: "Adjusted", value: "4", tone: "success" }, { label: "Open", value: "2", tone: "warning" }],
    columns: [{ key: "no", label: "DN No." }, { key: "supplier", label: "Supplier" }, { key: "against", label: "Against" }, { key: "amount", label: "Amount", align: "right", kind: "amount" }, { key: "reason", label: "Reason" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "Issued", "Adjusted", "Settled"],
    rows: [
      { no: "DN/0028", supplier: "Crescent Pharma Dist.", against: "PRTN/0031", amount: 18600, reason: "Return", status: "Issued" },
      { no: "DN/0027", supplier: "ITC Distributors", against: "PINV/0309", amount: 4200, reason: "Rate diff", status: "Adjusted" },
    ],
  },
  payments: {
    title: "Supplier Payments", desc: "Pay suppliers against booked invoices within terms.", newLabel: "New Payment",
    kpis: [{ label: "Payables", value: "₹26.4L", tone: "danger" }, { label: "Paid (MTD)", value: "₹19.8L", tone: "success" }, { label: "Due This Week", value: "₹4.6L", tone: "warning" }, { label: "Overdue", value: "₹2.1L", tone: "primary" }],
    columns: [{ key: "no", label: "Payment No." }, { key: "supplier", label: "Supplier" }, { key: "mode", label: "Mode", align: "center", kind: "badge" }, { key: "amount", label: "Amount", align: "right", kind: "amount" }, { key: "against", label: "Against" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Scheduled", "Paid", "On Hold", "Cleared"],
    rows: [
      { no: "PAY/0512", supplier: "ITC Distributors", mode: "NEFT", amount: 142000, against: "PINV/0312", status: "Paid" },
      { no: "PAY/0511", supplier: "Hindustan Unilever Ltd", mode: "Cheque", amount: 240000, against: "PINV/0311", status: "Scheduled" },
      { no: "PAY/0510", supplier: "Amul Regional Depot", mode: "UPI", amount: 96000, against: "PINV/0308", status: "Cleared" },
    ],
  },
  approval: {
    title: "Purchase Approval", desc: "PRs, POs & invoices awaiting threshold / multi-level approval.",
    kpis: [{ label: "Pending", value: "6", tone: "warning" }, { label: "Approved (MTD)", value: "112", tone: "success" }, { label: "Rejected", value: "8", tone: "danger" }, { label: "Avg TAT", value: "3.4 hr", tone: "secondary" }],
    columns: [{ key: "no", label: "Document" }, { key: "type", label: "Type", align: "center", kind: "badge" }, { key: "supplier", label: "Supplier / Dept" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "level", label: "Level" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Pending", "Approved", "Rejected"],
    rows: [
      { no: "PO/0286", type: "PO", supplier: "Crescent Pharma Dist.", value: 312000, level: "Level 2 · Finance", status: "Pending" },
      { no: "PR/CHN/26-27/0014", type: "PR", supplier: "Grocery Floor", value: 84000, level: "Level 1 · Manager", status: "Pending" },
      { no: "PINV/0310", type: "Invoice", supplier: "Crescent Pharma Dist.", value: 312000, level: "Mismatch Review", status: "Pending" },
    ],
  },
};

/* ================================================ create-form metadata == */
export interface PFormField { key: string; label: string; type: "text" | "date" | "number" | "select" | "textarea" | "file"; options?: string[]; full?: boolean; required?: boolean }
export interface PurchaseFormMeta { kind: "items" | "reference"; saveLabel: string; party: "supplier" | "none"; docDate: string; prefix: string; fields: PFormField[] }
export const PURCHASE_FORM_META: Record<string, PurchaseFormMeta> = {
  requisition: { kind: "items", saveLabel: "Save Requisition", party: "none", docDate: "Requisition Date", prefix: "PR", fields: [
    { key: "department", label: "Requesting Department", type: "select", options: ["Grocery Floor", "Pharmacy", "Warehouse", "Cosmetics", "Hardware"], required: true }, { key: "neededBy", label: "Needed By", type: "date" }, { key: "priority", label: "Priority", type: "select", options: ["Normal", "High", "Urgent"] }, { key: "remarks", label: "Justification", type: "textarea", full: true } ] },
  rfq: { kind: "items", saveLabel: "Send RFQ", party: "none", docDate: "RFQ Date", prefix: "RFQ", fields: [
    { key: "title", label: "Requirement Title", type: "text", full: true, required: true }, { key: "suppliers", label: "Invite Suppliers (comma separated)", type: "text", full: true }, { key: "replyBy", label: "Reply By", type: "date" } ] },
  order: { kind: "items", saveLabel: "Save Purchase Order", party: "supplier", docDate: "PO Date", prefix: "PO", fields: [
    { key: "expectedDate", label: "Expected Delivery", type: "date" }, { key: "buyer", label: "Purchaser / Buyer", type: "text" }, { key: "paymentTerms", label: "Payment Terms", type: "select", options: ["Advance", "Net 7", "Net 15", "Net 30", "Net 45"] }, { key: "deliveryMethod", label: "Delivery Method", type: "select", options: ["Ex-Works", "FOB", "Delivered", "Courier", "Transport / LR"] }, { key: "deliveryTerms", label: "Delivery Terms", type: "select", options: ["Ex-Works", "FOB", "Delivered"] },
    { key: "note", label: "Note to Supplier", type: "textarea", full: true }, { key: "terms", label: "Terms & Conditions", type: "textarea", full: true }, { key: "attachments", label: "Attachments", type: "file", full: true } ] },
  grn: { kind: "items", saveLabel: "Save GRN", party: "supplier", docDate: "Receipt Date", prefix: "GRN", fields: [
    { key: "againstPO", label: "Against PO", type: "text", required: true }, { key: "supplierDC", label: "Supplier DC / Invoice No.", type: "text" }, { key: "gateEntry", label: "Gate Entry No.", type: "text" }, { key: "qc", label: "QC Result", type: "select", options: ["Passed", "Hold", "Partial"] } ] },
  invoice: { kind: "items", saveLabel: "Book Invoice", party: "supplier", docDate: "Invoice Date", prefix: "PINV", fields: [
    { key: "supplierInvNo", label: "Supplier Invoice No.", type: "text", required: true }, { key: "againstGRN", label: "Against GRN / PO", type: "text", required: true }, { key: "dueDate", label: "Due Date", type: "date" }, { key: "eWayBill", label: "E-Way Bill No.", type: "text" },
    { key: "paymentTerms", label: "Payment Terms", type: "select", options: ["Advance", "Net 7", "Net 15", "Net 30", "Net 45"] }, { key: "deliveryMethod", label: "Delivery Method", type: "select", options: ["Ex-Works", "FOB", "Delivered", "Courier", "Transport / LR"] },
    { key: "note", label: "Note", type: "textarea", full: true }, { key: "terms", label: "Terms & Conditions", type: "textarea", full: true }, { key: "attachments", label: "Attachments", type: "file", full: true } ] },
  landedcost: { kind: "reference", saveLabel: "Allocate Landed Cost", party: "supplier", docDate: "Date", prefix: "LC", fields: [
    { key: "againstGRN", label: "Against GRN", type: "text", required: true }, { key: "freight", label: "Freight (₹)", type: "number" }, { key: "duty", label: "Customs Duty (₹)", type: "number" }, { key: "insurance", label: "Insurance (₹)", type: "number" }, { key: "clearing", label: "Clearing / Other (₹)", type: "number" }, { key: "basis", label: "Allocation Basis", type: "select", options: ["By Value", "By Quantity", "By Weight"] } ] },
  return: { kind: "reference", saveLabel: "Save Return", party: "supplier", docDate: "Return Date", prefix: "PRTN", fields: [
    { key: "againstGRN", label: "Against GRN / Invoice", type: "text", required: true }, { key: "reason", label: "Reason", type: "select", options: ["Damaged", "Near Expiry", "Wrong Item", "Excess", "Quality"] }, { key: "amount", label: "Return Value (₹)", type: "number", required: true }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  debitnote: { kind: "reference", saveLabel: "Issue Debit Note", party: "supplier", docDate: "Date", prefix: "DN", fields: [
    { key: "against", label: "Against Return / Invoice", type: "text", required: true }, { key: "amount", label: "Debit Amount (₹)", type: "number", required: true }, { key: "reason", label: "Reason", type: "select", options: ["Return", "Rate Difference", "Short Supply", "Claim"] }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  payments: { kind: "reference", saveLabel: "Save Payment", party: "supplier", docDate: "Payment Date", prefix: "PAY", fields: [
    { key: "againstInvoice", label: "Against Invoice(s)", type: "text", required: true }, { key: "amount", label: "Amount (₹)", type: "number", required: true }, { key: "mode", label: "Mode", type: "select", options: ["NEFT", "RTGS", "UPI", "Cheque", "Cash"] }, { key: "ref", label: "UTR / Cheque No.", type: "text" }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
};

/* ===================================================== config-driven ==== */
export function purchaseNotesFor(key: string): string[] {
  const tax = pf("taxMethod") === "inclusive" ? "Tax inclusive" : "Tax exclusive";
  switch (key) {
    case "requisition": return ["Internal indent → RFQ/PO", pflag("autoReorderSuggestion") ? "Auto-reorder suggestions ON" : "—", `Approval > ₹${pf("approvalThreshold")}`];
    case "rfq":
    case "comparison": return ["Multi-supplier quotes", "Lowest landed-cost wins", tax];
    case "order": return [tax, `Approval > ₹${pf("approvalThreshold")}`, pflag("multiLevelApproval") ? `Multi-level (${pf("maxApprovalLevels")})` : "Single approval", `Costing: ${pf("costingMethod")}`];
    case "grn": return [pflag("qcOnReceipt") ? "QC on receipt" : "—", pflag("batchExpiryOnReceipt") ? "Batch & expiry capture" : "—", pflag("allowOverReceipt") ? "Over-receipt allowed" : `Tolerance ${pf("grnTolerancePct")}%`];
    case "invoice": return [pflag("threeWayMatch") ? "3-way match ON" : "2-way match", pflag("grnBeforeInvoice") ? "GRN required first" : "—", pflag("gstMandatorySupplier") ? "Supplier GSTIN required" : "—"];
    case "landedcost": return [pflag("landedCostEnabled") ? "Landed cost ON" : "OFF", `Default basis: ${pf("landedBasis")}`, `Costing: ${pf("costingMethod")}`];
    case "return":
    case "debitnote": return ["Auto debit note + stock reversal", pflag("gstMandatorySupplier") ? "GST credit reversed" : "—"];
    case "payments": return ["Posts to supplier ledger", `Within payment terms`, pflag("threeWayMatch") ? "Pay only matched bills" : "—"];
    case "approval": return [pflag("multiLevelApproval") ? `Multi-level (${pf("maxApprovalLevels")})` : "Single", `Threshold ₹${pf("approvalThreshold")}`];
    case "planning": return [pflag("autoReorderSuggestion") ? "Auto-reorder ON" : "OFF", "Reads stock, ROL & lead time", "AI demand forecast"];
    default: return [tax, `Costing: ${pf("costingMethod")}`];
  }
}

export const PURCHASE_REPORTS = [
  { id: "register", name: "Purchase Register", desc: "All purchases with tax split" },
  { id: "supplier", name: "Supplier-wise Purchase", desc: "Spend & dues per supplier" },
  { id: "gstr2", name: "GSTR-2 / ITC", desc: "Inward supplies & input tax credit" },
  { id: "grn", name: "GRN Register", desc: "Receipts, QC & short/excess" },
  { id: "pending", name: "Pending PO / GRN", desc: "Open orders & receipts" },
  { id: "payable", name: "Payables & Ageing", desc: "Outstanding to suppliers" },
  { id: "pricevar", name: "Price Variance", desc: "PO vs invoice rate variance" },
  { id: "landed", name: "Landed Cost Report", desc: "Cost uplift per receipt" },
  { id: "returns", name: "Purchase Return Register", desc: "Returns, reasons & debit notes" },
];
