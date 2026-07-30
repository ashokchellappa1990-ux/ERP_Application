import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  ShoppingCart,
  ReceiptText,
  Wallet,
  CreditCard,
  Truck,
  Undo2,
  Repeat,
  XCircle,
  HandCoins,
  AlertCircle,
  GitBranch,
  BarChart3,
  FileBarChart,
  type LucideIcon,
} from "lucide-react";
import { DEFAULT_SALES_CONFIG, flag, field, enabledIds } from "@/lib/settings/salesConfigDefaults";
import { PRICE_SOURCES, TAX_METHOD_OPTS, CHANNELS } from "@/lib/settings/salesConfig";

/* ===================================================== feature catalog == */
export interface SalesFeature {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  desc: string;
  group: string;
  /** B2C / B2B / Both — drives which channel rules apply. */
  scope?: "B2C" | "B2B" | "Both";
}
export const SALES_FEATURES: SalesFeature[] = [
  { key: "dashboard", label: "Sales Dashboard", href: "/sales", icon: LayoutDashboard, desc: "Live sales KPIs & active configuration.", group: "Overview" },
  { key: "quotation", label: "Sales Quotation", href: "/sales/quotation", icon: FileText, desc: "Quotes that convert to orders / invoices.", group: "Pre-Sales", scope: "Both" },
  { key: "order", label: "Sales Order", href: "/sales/order", icon: ClipboardList, desc: "Confirmed orders awaiting fulfilment.", group: "Pre-Sales", scope: "Both" },
  { key: "pos", label: "POS Billing (B2C)", href: "/sales/pos", icon: ShoppingCart, desc: "Counter retail billing screen.", group: "Billing", scope: "B2C" },
  { key: "invoice", label: "Sales Invoice (B2B)", href: "/sales/invoice", icon: ReceiptText, desc: "Tax invoices for business customers.", group: "Billing", scope: "B2B" },
  { key: "advance", label: "Advance Sales", href: "/sales/advance", icon: Wallet, desc: "Advance receipts against future delivery.", group: "Billing", scope: "Both" },
  { key: "credit", label: "Credit Sales", href: "/sales/credit", icon: CreditCard, desc: "Pay-later sales within credit limits.", group: "Billing", scope: "Both" },
  { key: "delivery", label: "Delivery Management", href: "/sales/delivery", icon: Truck, desc: "Challans, scheduling & proof of delivery.", group: "Fulfilment", scope: "Both" },
  { key: "return", label: "Sales Return", href: "/sales/return", icon: Undo2, desc: "Returns with credit notes & restock.", group: "Post-Sales", scope: "Both" },
  { key: "exchange", label: "Sales Exchange", href: "/sales/exchange", icon: Repeat, desc: "Item exchanges with value adjustment.", group: "Post-Sales", scope: "Both" },
  { key: "cancellation", label: "Sales Cancellation", href: "/sales/cancellation", icon: XCircle, desc: "Cancel orders / invoices with reversal.", group: "Post-Sales", scope: "Both" },
  { key: "collections", label: "Customer Collections", href: "/sales/collections", icon: HandCoins, desc: "Receipts against outstanding bills.", group: "Receivables", scope: "Both" },
  { key: "outstanding", label: "Outstanding Management", href: "/sales/outstanding", icon: AlertCircle, desc: "Ageing & overdue receivables.", group: "Receivables", scope: "Both" },
  { key: "approval", label: "Sales Approval Workflow", href: "/sales/approval", icon: GitBranch, desc: "Override & threshold approvals.", group: "Governance", scope: "Both" },
  { key: "analytics", label: "Sales Analytics", href: "/sales/analytics", icon: BarChart3, desc: "Trends, mix & performance.", group: "Insights" },
  { key: "reports", label: "Sales Reports", href: "/sales/reports", icon: FileBarChart, desc: "Statutory & operational reports.", group: "Insights" },
];

/* ===================================================== dashboard stats == */
export const SALES_DASHBOARD_STATS = {
  todaySales: 482000, todayBills: 318, b2bSales: 1240000, openOrders: 42,
  outstanding: 1860000, returns: 24, pendingApprovals: 6, avgBill: 1516,
};
export const CHANNEL_MIX = [
  { label: "B2C Counter", value: 58, tone: "primary" as const },
  { label: "B2B", value: 24, tone: "secondary" as const },
  { label: "Online", value: 12, tone: "success" as const },
  { label: "Mobile", value: 6, tone: "warning" as const },
];
export const TOP_PRODUCTS = [
  { name: "Surf Excel 1kg", qty: 1840, value: 182600 },
  { name: "Aashirvaad Atta 5kg", qty: 1210, value: 312400 },
  { name: "Amul Butter 500g", qty: 980, value: 254800 },
  { name: "Tata Salt 1kg", qty: 2410, value: 67480 },
  { name: "Colgate 200g", qty: 760, value: 76000 },
];

/* ============================================= per-feature list config == */
export interface SalesColumn { key: string; label: string; align?: "right" | "center"; kind?: "status" | "amount" | "badge" }
export interface SalesKpi { label: string; value: string; tone: "primary" | "secondary" | "success" | "warning" | "danger" | "accent" }
export interface SalesListConfig {
  title: string;
  desc: string;
  newLabel?: string;
  newHref?: string;
  kpis: SalesKpi[];
  columns: SalesColumn[];
  statuses: string[];
  rows: Record<string, string | number>[];
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const SALES_LISTS: Record<string, SalesListConfig> = {
  quotation: {
    title: "Sales Quotation", desc: "Quotes that can convert into a Sales Order or Invoice.",
    newLabel: "New Quotation",
    kpis: [
      { label: "Open Quotes", value: "38", tone: "primary" }, { label: "Converted (MTD)", value: "61%", tone: "success" },
      { label: "Value Quoted", value: "₹24.8L", tone: "secondary" }, { label: "Expiring Soon", value: "7", tone: "warning" },
    ],
    columns: [{ key: "no", label: "Quote No." }, { key: "customer", label: "Customer" }, { key: "date", label: "Date" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "valid", label: "Valid Till" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "Sent", "Accepted", "Converted", "Expired"],
    rows: [
      { no: "QTN/26-27/0042", customer: "Anand Stores", date: "08-Jun-2026", value: 84500, valid: "22-Jun-2026", status: "Sent" },
      { no: "QTN/26-27/0041", customer: "Sri Balaji Traders", date: "07-Jun-2026", value: 142000, valid: "21-Jun-2026", status: "Accepted" },
      { no: "QTN/26-27/0040", customer: "MGB Hardware", date: "06-Jun-2026", value: 56800, valid: "20-Jun-2026", status: "Converted" },
      { no: "QTN/26-27/0039", customer: "Walk-in (Ravi)", date: "05-Jun-2026", value: 12400, valid: "12-Jun-2026", status: "Draft" },
      { no: "QTN/26-27/0038", customer: "Lakshmi Mart", date: "01-Jun-2026", value: 98000, valid: "08-Jun-2026", status: "Expired" },
    ],
  },
  order: {
    title: "Sales Order", desc: "Confirmed orders awaiting billing & fulfilment.",
    newLabel: "New Order",
    kpis: [
      { label: "Open Orders", value: "42", tone: "primary" }, { label: "Partially Billed", value: "11", tone: "warning" },
      { label: "Order Value", value: "₹38.6L", tone: "secondary" }, { label: "Ready to Deliver", value: "18", tone: "success" },
    ],
    columns: [{ key: "no", label: "Order No." }, { key: "customer", label: "Customer" }, { key: "date", label: "Date" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "fulfil", label: "Fulfilment", align: "center", kind: "badge" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Pending", "Approved", "Partially Billed", "Completed", "Cancelled"],
    rows: [
      { no: "SO/26-27/0210", customer: "Sri Balaji Traders", date: "08-Jun-2026", value: 142000, fulfil: "Scheduled", status: "Approved" },
      { no: "SO/26-27/0209", customer: "MGB Hardware", date: "07-Jun-2026", value: 56800, fulfil: "Immediate", status: "Partially Billed" },
      { no: "SO/26-27/0208", customer: "Crescent Pharma", date: "07-Jun-2026", value: 218400, fulfil: "Scheduled", status: "Pending" },
      { no: "SO/26-27/0207", customer: "Anand Stores", date: "06-Jun-2026", value: 84500, fulfil: "Immediate", status: "Completed" },
    ],
  },
  invoice: {
    title: "Sales Invoice (B2B)", desc: "GST tax invoices for registered business customers.",
    newLabel: "New Invoice",
    kpis: [
      { label: "Invoices (MTD)", value: "286", tone: "primary" }, { label: "B2B Value", value: "₹12.4L", tone: "secondary" },
      { label: "E-Invoiced", value: "100%", tone: "success" }, { label: "Unpaid", value: "₹4.2L", tone: "danger" },
    ],
    columns: [{ key: "no", label: "Invoice No." }, { key: "customer", label: "Customer" }, { key: "gst", label: "GSTIN" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "pay", label: "Payment", align: "center", kind: "badge" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Draft", "Posted", "E-Invoiced", "Paid", "Overdue"],
    rows: [
      { no: "INV-WS/CHN/26-27/0286", customer: "Sri Balaji Traders", gst: "33ABCDE9876B1Z2", value: 142000, pay: "Credit", status: "E-Invoiced" },
      { no: "INV-WS/CHN/26-27/0285", customer: "MGB Hardware", gst: "33XYZAB1234C1Z9", value: 56800, pay: "Paid", status: "Paid" },
      { no: "INV-WS/CHN/26-27/0284", customer: "Crescent Pharma", gst: "36PQRST5678D1Z4", value: 218400, pay: "Credit", status: "Overdue" },
      { no: "INV-WS/CHN/26-27/0283", customer: "Lakshmi Mart", gst: "33LMNOP2345E1Z7", value: 98000, pay: "Paid", status: "Posted" },
    ],
  },
  advance: {
    title: "Advance Sales", desc: "Advance receipts collected against future delivery/booking.",
    newLabel: "New Advance",
    kpis: [
      { label: "Open Advances", value: "23", tone: "primary" }, { label: "Advance Held", value: "₹3.4L", tone: "secondary" },
      { label: "Adjusted (MTD)", value: "₹2.1L", tone: "success" }, { label: "Refundable", value: "₹40k", tone: "warning" },
    ],
    columns: [{ key: "no", label: "Receipt No." }, { key: "customer", label: "Customer" }, { key: "date", label: "Date" }, { key: "amount", label: "Advance", align: "right", kind: "amount" }, { key: "against", label: "Against" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Open", "Partly Adjusted", "Adjusted", "Refunded"],
    rows: [
      { no: "ADV/26-27/0023", customer: "Senthil Furniture", date: "08-Jun-2026", amount: 50000, against: "SO/0212 (Sofa Set)", status: "Open" },
      { no: "ADV/26-27/0022", customer: "Walk-in (Priya)", date: "06-Jun-2026", amount: 15000, against: "Booking — Refrigerator", status: "Partly Adjusted" },
      { no: "ADV/26-27/0021", customer: "Anand Stores", date: "03-Jun-2026", amount: 80000, against: "SO/0205", status: "Adjusted" },
    ],
  },
  credit: {
    title: "Credit Sales", desc: "Pay-later sales validated against customer credit limit & outstanding.",
    newLabel: "New Credit Bill",
    kpis: [
      { label: "Credit Bills (MTD)", value: "94", tone: "primary" }, { label: "Credit Outstanding", value: "₹18.6L", tone: "danger" },
      { label: "Within Limit", value: "92%", tone: "success" }, { label: "Over Limit (held)", value: "6", tone: "warning" },
    ],
    columns: [{ key: "no", label: "Bill No." }, { key: "customer", label: "Customer" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "due", label: "Due Date" }, { key: "limit", label: "Limit Use", align: "center", kind: "badge" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Within Limit", "Approval Pending", "Overdue", "Settled"],
    rows: [
      { no: "INV-WS/CHN/26-27/0286", customer: "Sri Balaji Traders", value: 142000, due: "08-Jul-2026", limit: "62%", status: "Within Limit" },
      { no: "INV-WS/CHN/26-27/0281", customer: "Crescent Pharma", value: 218400, due: "20-Jun-2026", limit: "104%", status: "Approval Pending" },
      { no: "INV-WS/CHN/26-27/0274", customer: "MGB Hardware", value: 56800, due: "01-Jun-2026", limit: "48%", status: "Overdue" },
    ],
  },
  delivery: {
    title: "Delivery Management", desc: "Challans, delivery scheduling & proof of delivery.",
    newLabel: "New Challan",
    kpis: [
      { label: "To Dispatch", value: "18", tone: "primary" }, { label: "In Transit", value: "9", tone: "warning" },
      { label: "Delivered (MTD)", value: "240", tone: "success" }, { label: "PoD Pending", value: "5", tone: "danger" },
    ],
    columns: [{ key: "no", label: "Challan No." }, { key: "customer", label: "Customer" }, { key: "order", label: "Order" }, { key: "mode", label: "Mode", align: "center", kind: "badge" }, { key: "eta", label: "ETA" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Ready", "Dispatched", "In Transit", "Delivered", "PoD Pending"],
    rows: [
      { no: "DC/26-27/0188", customer: "Sri Balaji Traders", order: "SO/0210", mode: "Scheduled", eta: "10-Jun-2026", status: "Ready" },
      { no: "DC/26-27/0187", customer: "MGB Hardware", order: "SO/0209", mode: "Immediate", eta: "09-Jun-2026", status: "In Transit" },
      { no: "DC/26-27/0186", customer: "Anand Stores", order: "SO/0207", mode: "Immediate", eta: "08-Jun-2026", status: "Delivered" },
    ],
  },
  return: {
    title: "Sales Return", desc: "Returns against invoices with credit note & stock restoration.",
    newLabel: "New Return",
    kpis: [
      { label: "Returns (MTD)", value: "24", tone: "primary" }, { label: "Return Value", value: "₹64k", tone: "secondary" },
      { label: "Credit Notes", value: "21", tone: "success" }, { label: "Approval Pending", value: "3", tone: "warning" },
    ],
    columns: [{ key: "no", label: "Return No." }, { key: "invoice", label: "Against Invoice" }, { key: "customer", label: "Customer" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "reason", label: "Reason" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Requested", "Approval Pending", "Credit Note Issued", "Restocked", "Rejected"],
    rows: [
      { no: "SR/26-27/0024", invoice: "INV-RT/CHN/26-27/8841", customer: "Walk-in (Kumar)", value: 1240, reason: "Damaged", status: "Credit Note Issued" },
      { no: "SR/26-27/0023", invoice: "INV-WS/CHN/26-27/0280", customer: "Lakshmi Mart", value: 18600, reason: "Wrong item", status: "Approval Pending" },
      { no: "SR/26-27/0022", invoice: "INV-RT/CHN/26-27/8810", customer: "Walk-in (Asha)", value: 540, reason: "Expired", status: "Restocked" },
    ],
  },
  exchange: {
    title: "Sales Exchange", desc: "Item exchange with value top-up or refund of the difference.",
    newLabel: "New Exchange",
    kpis: [
      { label: "Exchanges (MTD)", value: "16", tone: "primary" }, { label: "Net Top-up", value: "₹22k", tone: "success" },
      { label: "Net Refund", value: "₹9k", tone: "warning" }, { label: "Pending", value: "2", tone: "danger" },
    ],
    columns: [{ key: "no", label: "Exchange No." }, { key: "invoice", label: "Against Invoice" }, { key: "out", label: "Returned" }, { key: "in", label: "Issued" }, { key: "diff", label: "Difference", align: "right", kind: "amount" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Requested", "Approved", "Completed", "Rejected"],
    rows: [
      { no: "SE/26-27/0016", invoice: "INV-RT/CHN/26-27/8839", out: "Shirt M", in: "Shirt L", diff: 0, status: "Completed" },
      { no: "SE/26-27/0015", invoice: "INV-RT/CHN/26-27/8822", out: "Earphone A", in: "Earphone B", diff: 400, status: "Approved" },
      { no: "SE/26-27/0014", invoice: "INV-RT/CHN/26-27/8805", out: "Pan 24cm", in: "Pan 20cm", diff: -150, status: "Requested" },
    ],
  },
  cancellation: {
    title: "Sales Cancellation", desc: "Cancel orders / invoices with stock & accounting reversal.",
    newLabel: "New Cancellation",
    kpis: [
      { label: "Cancellations (MTD)", value: "12", tone: "primary" }, { label: "Reversed Value", value: "₹1.8L", tone: "secondary" },
      { label: "Approval Pending", value: "2", tone: "warning" }, { label: "Stock Restored", value: "10", tone: "success" },
    ],
    columns: [{ key: "no", label: "Document" }, { key: "type", label: "Type", align: "center", kind: "badge" }, { key: "customer", label: "Customer" }, { key: "value", label: "Value", align: "right", kind: "amount" }, { key: "reason", label: "Reason" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Requested", "Approval Pending", "Cancelled", "Rejected"],
    rows: [
      { no: "SO/26-27/0203", type: "Order", customer: "Senthil Furniture", value: 64000, reason: "Customer request", status: "Cancelled" },
      { no: "INV-WS/CHN/26-27/0279", type: "Invoice", customer: "Crescent Pharma", value: 218400, reason: "Duplicate", status: "Approval Pending" },
    ],
  },
  collections: {
    title: "Customer Collections", desc: "Receipts collected against outstanding invoices.",
    newLabel: "New Receipt",
    kpis: [
      { label: "Collected Today", value: "₹2.4L", tone: "success" }, { label: "Collected (MTD)", value: "₹28.6L", tone: "secondary" },
      { label: "Open Receipts", value: "7", tone: "primary" }, { label: "Cheques in Hand", value: "₹1.2L", tone: "warning" },
    ],
    columns: [{ key: "no", label: "Receipt No." }, { key: "customer", label: "Customer" }, { key: "mode", label: "Mode", align: "center", kind: "badge" }, { key: "amount", label: "Amount", align: "right", kind: "amount" }, { key: "against", label: "Against" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Received", "Cleared", "Bounced", "Allocated"],
    rows: [
      { no: "RCT/26-27/0512", customer: "Sri Balaji Traders", mode: "UPI", amount: 142000, against: "INV/0286", status: "Allocated" },
      { no: "RCT/26-27/0511", customer: "MGB Hardware", mode: "Cheque", amount: 56800, against: "INV/0285", status: "Received" },
      { no: "RCT/26-27/0510", customer: "Lakshmi Mart", mode: "Cash", amount: 98000, against: "INV/0283", status: "Cleared" },
    ],
  },
  outstanding: {
    title: "Outstanding Management", desc: "Receivables ageing & overdue follow-up.",
    kpis: [
      { label: "Total Outstanding", value: "₹18.6L", tone: "danger" }, { label: "Overdue", value: "₹6.2L", tone: "warning" },
      { label: "Due This Week", value: "₹3.1L", tone: "primary" }, { label: "Avg Days", value: "27", tone: "secondary" },
    ],
    columns: [{ key: "customer", label: "Customer" }, { key: "total", label: "Outstanding", align: "right", kind: "amount" }, { key: "d30", label: "0–30", align: "right", kind: "amount" }, { key: "d60", label: "31–60", align: "right", kind: "amount" }, { key: "d90", label: "60+", align: "right", kind: "amount" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Current", "Due Soon", "Overdue", "Critical"],
    rows: [
      { customer: "Crescent Pharma", total: 218400, d30: 0, d60: 0, d90: 218400, status: "Critical" },
      { customer: "Sri Balaji Traders", total: 142000, d30: 142000, d60: 0, d90: 0, status: "Current" },
      { customer: "MGB Hardware", total: 56800, d30: 0, d60: 56800, d90: 0, status: "Overdue" },
    ],
  },
  approval: {
    title: "Sales Approval Workflow", desc: "Overrides & thresholds awaiting authorisation.",
    kpis: [
      { label: "Pending", value: "6", tone: "warning" }, { label: "Approved (MTD)", value: "84", tone: "success" },
      { label: "Rejected (MTD)", value: "9", tone: "danger" }, { label: "Avg TAT", value: "12 min", tone: "secondary" },
    ],
    columns: [{ key: "no", label: "Request" }, { key: "type", label: "Type", align: "center", kind: "badge" }, { key: "raisedBy", label: "Raised By" }, { key: "value", label: "Impact", align: "right", kind: "amount" }, { key: "level", label: "Level" }, { key: "status", label: "Status", align: "center", kind: "status" }],
    statuses: ["Pending", "Approved", "Rejected"],
    rows: [
      { no: "APR/0331", type: "Discount", raisedBy: "cashier.meena", value: 4200, level: "Manager", status: "Pending" },
      { no: "APR/0330", type: "Credit", raisedBy: "ravi.k", value: 218400, level: "Finance Mgr", status: "Pending" },
      { no: "APR/0329", type: "Price", raisedBy: "cashier.arun", value: 1800, level: "Supervisor", status: "Approved" },
    ],
  },
};

/* ============================ config-driven notes (no hardcoded rules) === */
/** Returns the live rule strings (from DEFAULT_SALES_CONFIG) that govern a feature. */
export function configNotesFor(key: string): string[] {
  const priceLabel = PRICE_SOURCES.find((p) => p.value === field("priceSource"))?.label ?? "—";
  const taxLabel = TAX_METHOD_OPTS.find((t) => t.value === field("taxMethod"))?.label ?? "—";
  const channels = enabledIds("channels").map((id) => CHANNELS.find((c) => c.id === id)?.label ?? id);
  switch (key) {
    case "quotation":
    case "order":
      return [`Price source: ${priceLabel}`, `Tax: ${taxLabel}`, flag("soMandatory") ? "SO required before invoice" : "Direct invoice allowed", `Channels: ${channels.join(", ")}`];
    case "pos":
      return [`Default channel: B2C Counter`, `Price source: ${priceLabel}`, `Tax: ${taxLabel}`, flag("allowDiscounts") ? "Discounts ON" : "Discounts OFF", flag("enableLoyalty") ? "Loyalty ON" : "Loyalty OFF"];
    case "invoice":
      return [`Tax: ${taxLabel}`, flag("gstMandatoryB2b") ? "Buyer GSTIN mandatory" : "GSTIN optional", flag("eInvoice") ? "E-Invoice ON" : "E-Invoice OFF", flag("eWayBill") ? "E-Way Bill ON" : "E-Way Bill OFF"];
    case "credit":
      return [flag("allowCreditSales") ? "Credit sales ON" : "Credit sales OFF", flag("creditLimitCheck") ? "Limit check ON" : "Limit check OFF", flag("outstandingCheck") ? "Outstanding check ON" : "—", `Max credit: ${field("maxCreditDays")} days`];
    case "advance":
      return [`Tax: ${taxLabel}`, "Advance posts to Customer Advance ledger", flag("creditApprovalWorkflow") ? "Approval workflow ON" : "—"];
    case "delivery":
      return enabledIds("delivery").map((id) => ({ immediate: "Immediate delivery", partial: "Partial delivery", scheduled: "Scheduled delivery", challan: "Delivery challan", pod: "Proof of delivery" } as Record<string, string>)[id] ?? id);
    case "return":
    case "exchange":
    case "cancellation":
      return [flag("allowExpiredSales") ? "Expired sale allowed (override)" : "Expired sale blocked", "Auto credit note + stock reversal", flag("approvalRequired") || true ? "Routed via approval workflow" : "—"];
    case "collections":
    case "outstanding":
      return [flag("outstandingCheck") ? "Outstanding check ON" : "—", `Max credit: ${field("maxCreditDays")} days`, "Receipts post to customer ledger"];
    case "approval":
      return enabledIds("approvalFor").map((id) => ({ discount: "Discount override", price: "Price override", credit: "Credit override", stock: "Stock override", expired: "Expired sale" } as Record<string, string>)[id] ?? id);
    default:
      return [`Price source: ${priceLabel}`, `Tax: ${taxLabel}`];
  }
}

/* ================================================ create-form metadata == */
export interface SFormField { key: string; label: string; type: "text" | "date" | "number" | "select" | "textarea" | "file"; options?: string[]; full?: boolean; required?: boolean }
export interface SalesFormMeta { kind: "items" | "reference"; saveLabel: string; b2b?: boolean; docDate: string; fields: SFormField[] }
export const SALES_FORM_META: Record<string, SalesFormMeta> = {
  quotation: { kind: "items", saveLabel: "Save Quotation", docDate: "Quotation Date", fields: [
    { key: "validTill", label: "Valid Till", type: "date" }, { key: "salesperson", label: "Salesperson", type: "text" }, { key: "remarks", label: "Notes / Terms", type: "textarea", full: true } ] },
  order: { kind: "items", saveLabel: "Save Order", docDate: "Order Date", fields: [
    { key: "deliveryDate", label: "Expected Delivery", type: "date" }, { key: "poNo", label: "Customer PO No.", type: "text" },
    { key: "salesperson", label: "Salesperson", type: "text" }, { key: "paymentTerms", label: "Payment Terms", type: "select", options: ["Advance", "On Delivery", "Net 7", "Net 15", "Net 30", "Net 45"] }, { key: "deliveryMethod", label: "Delivery Method", type: "select", options: ["Counter Pickup", "Home Delivery", "Courier", "Transport / LR"] }, { key: "fulfilment", label: "Fulfilment", type: "select", options: ["Immediate", "Scheduled", "Partial"] },
    { key: "customerNote", label: "Customer Note", type: "textarea", full: true }, { key: "terms", label: "Terms & Conditions", type: "textarea", full: true }, { key: "attachments", label: "Attachments", type: "file", full: true } ] },
  invoice: { kind: "items", saveLabel: "Save Invoice", b2b: true, docDate: "Invoice Date", fields: [
    { key: "dueDate", label: "Due Date", type: "date" }, { key: "poNo", label: "Customer PO No.", type: "text" }, { key: "salesperson", label: "Salesperson", type: "text" },
    { key: "paymentTerms", label: "Payment Terms", type: "select", options: ["Advance", "On Delivery", "Net 7", "Net 15", "Net 30", "Net 45"] }, { key: "deliveryMethod", label: "Delivery Method", type: "select", options: ["Counter Pickup", "Home Delivery", "Courier", "Transport / LR"] },
    { key: "customerNote", label: "Customer Note", type: "textarea", full: true }, { key: "terms", label: "Terms & Conditions", type: "textarea", full: true }, { key: "attachments", label: "Attachments", type: "file", full: true } ] },
  credit: { kind: "items", saveLabel: "Save Credit Bill", b2b: true, docDate: "Bill Date", fields: [
    { key: "dueDate", label: "Due Date", type: "date" }, { key: "creditDays", label: "Credit Days", type: "number" } ] },
  advance: { kind: "reference", saveLabel: "Save Advance Receipt", docDate: "Receipt Date", fields: [
    { key: "against", label: "Against (Order / Booking)", type: "text", full: true, required: true }, { key: "amount", label: "Advance Amount (₹)", type: "number", required: true }, { key: "mode", label: "Payment Mode", type: "select", options: ["Cash", "Card", "UPI", "Bank Transfer", "Cheque"] }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  delivery: { kind: "reference", saveLabel: "Save Challan", docDate: "Challan Date", fields: [
    { key: "order", label: "Against Sales Order", type: "text", required: true }, { key: "mode", label: "Delivery Mode", type: "select", options: ["Immediate", "Scheduled", "Partial"] }, { key: "eta", label: "Expected Delivery", type: "date" }, { key: "vehicle", label: "Vehicle No.", type: "text" }, { key: "driver", label: "Driver / Transport", type: "text" } ] },
  return: { kind: "reference", saveLabel: "Save Return", docDate: "Return Date", fields: [
    { key: "invoice", label: "Against Invoice", type: "text", required: true }, { key: "reason", label: "Reason", type: "select", options: ["Damaged", "Wrong Item", "Expired", "Quality Issue", "Other"] }, { key: "amount", label: "Return Value (₹)", type: "number", required: true }, { key: "restock", label: "Restock to Inventory", type: "select", options: ["Yes", "No"] }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  exchange: { kind: "reference", saveLabel: "Save Exchange", docDate: "Exchange Date", fields: [
    { key: "invoice", label: "Against Invoice", type: "text", required: true }, { key: "returned", label: "Returned Item", type: "text", required: true }, { key: "issued", label: "Issued Item", type: "text", required: true }, { key: "difference", label: "Difference (₹)", type: "number" }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  cancellation: { kind: "reference", saveLabel: "Save Cancellation", docDate: "Cancellation Date", fields: [
    { key: "document", label: "Document No. (Order / Invoice)", type: "text", required: true }, { key: "type", label: "Type", type: "select", options: ["Order", "Invoice"] }, { key: "reason", label: "Reason", type: "select", options: ["Customer Request", "Duplicate", "Stock Issue", "Pricing Error", "Other"] }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  collections: { kind: "reference", saveLabel: "Save Receipt", docDate: "Receipt Date", fields: [
    { key: "invoice", label: "Against Invoice", type: "text", required: true }, { key: "amount", label: "Amount Received (₹)", type: "number", required: true }, { key: "mode", label: "Mode", type: "select", options: ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"] }, { key: "ref", label: "Reference / Cheque No.", type: "text" }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
};

/* ====================================================== POS catalog ===== */
/** Product Master is the Default Price Repository — the tiered prices live on the product. */
export interface ProductPrices { retail: number; wholesale: number; dealer: number; distributor: number; online: number }
export type PricingControl = "product" | "batch" | "variant" | "customer";
export interface PosProduct {
  code: string; name: string; price: number; mrp: number; tax: number; stock: number; category: string; hsn: string;
  prices: ProductPrices; pricingControl: PricingControl;
}
const _r = Math.round;
function _control(cat: string): PricingControl {
  if (/pharma|grocery|dairy|beverage|fmcg/i.test(cat)) return "batch";
  if (/electronic|mobile|appliance/i.test(cat)) return "product";
  if (/textile|apparel|footwear|garment/i.test(cat)) return "variant";
  if (/wholesale/i.test(cat)) return "customer";
  return "product";
}
const _RAW_CATALOG = [
  { code: "SKU-1001", name: "Surf Excel 1kg", price: 99, mrp: 110, tax: 18, stock: 240, category: "Grocery", hsn: "3402" },
  { code: "SKU-1002", name: "Aashirvaad Atta 5kg", price: 258, mrp: 275, tax: 5, stock: 120, category: "Grocery", hsn: "1101" },
  { code: "SKU-1003", name: "Amul Butter 500g", price: 260, mrp: 265, tax: 12, stock: 64, category: "Dairy", hsn: "0405" },
  { code: "SKU-1004", name: "Tata Salt 1kg", price: 28, mrp: 30, tax: 5, stock: 410, category: "Grocery", hsn: "2501" },
  { code: "SKU-1005", name: "Colgate 200g", price: 99, mrp: 105, tax: 18, stock: 150, category: "Personal Care", hsn: "3306" },
  { code: "SKU-1006", name: "Maggi 12-pack", price: 168, mrp: 180, tax: 18, stock: 88, category: "Grocery", hsn: "1902" },
  { code: "SKU-1007", name: "Dove Soap 100g", price: 62, mrp: 70, tax: 18, stock: 200, category: "Personal Care", hsn: "3401" },
  { code: "SKU-1008", name: "Red Bull 250ml", price: 125, mrp: 125, tax: 28, stock: 36, category: "Beverages", hsn: "2202" },
];
export const POS_CATALOG: PosProduct[] = _RAW_CATALOG.map((p) => ({
  ...p,
  prices: { retail: p.price, wholesale: _r(p.price * 0.92), dealer: _r(p.price * 0.88), distributor: _r(p.price * 0.85), online: _r(p.price * 1.02) },
  pricingControl: _control(p.category),
}));

export const REPORTS = [
  { id: "daysales", name: "Day-wise Sales", desc: "Sales by day with tax split" },
  { id: "gstr1", name: "GSTR-1 Summary", desc: "Outward supplies for GST filing" },
  { id: "itemwise", name: "Item-wise Sales", desc: "Quantity & value per product" },
  { id: "customer", name: "Customer-wise Sales", desc: "Sales & dues per customer" },
  { id: "channel", name: "Channel-wise Sales", desc: "B2C / B2B / Online split" },
  { id: "salesperson", name: "Salesperson Performance", desc: "Bills & value per user" },
  { id: "returns", name: "Sales Return Register", desc: "Returns, reasons & credit notes" },
  { id: "outstanding", name: "Outstanding & Ageing", desc: "Receivables ageing buckets" },
  { id: "profit", name: "Sales Profitability", desc: "Margin per bill / item" },
];

export { inr, DEFAULT_SALES_CONFIG };
