import {
  Info,
  Contact,
  MapPin,
  ReceiptText,
  Landmark,
  CreditCard,
  Boxes,
  FileText,
  Gauge,
  Calculator,
  Sparkles,
  GitPullRequestArrow,
  Tag,
  Building2,
  Globe,
  Truck,
  Layers,
  Phone,
  Mail,
  User,
  Briefcase,
  Hash,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

/* ============================================================= types === */

export interface SField {
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

export interface SToggle {
  id: string;
  label: string;
  desc?: string;
}

export interface SupplierTab {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
}

export const SUPPLIER_TABS: SupplierTab[] = [
  { id: "general", label: "General Information", icon: Info, group: "Basics" },
  { id: "contact", label: "Contact Information", icon: Contact, group: "Basics" },
  { id: "address", label: "Address Information", icon: MapPin, group: "Basics" },
  { id: "gst", label: "GST & Tax", icon: ReceiptText, group: "Compliance" },
  { id: "banking", label: "Banking", icon: Landmark, group: "Finance" },
  { id: "credit", label: "Credit & Payment", icon: CreditCard, group: "Finance" },
  { id: "documents", label: "Documents", icon: FileText, group: "Records" },
  { id: "accounting", label: "Accounting", icon: Calculator, group: "Finance" },
  { id: "ai", label: "AI Smart Setup", icon: Sparkles, group: "Tools" },
  { id: "approval", label: "Approval Workflow", icon: GitPullRequestArrow, group: "Tools" },
];
// Hidden (kept in TAB_BODIES, just not shown): purchase (Purchase Config), products
// (Product Mapping), branch (Branch Mapping — branch is set in step 1), performance, import.

/* =========================================================== options === */

const opt = (a: string[]) => a.map((x) => ({ value: x, label: x }));

export const SUPPLIER_TYPE_OPTS = opt(["Manufacturer", "Distributor", "Wholesaler", "Retail Supplier", "Service Provider"]);
export const SUPPLIER_CATEGORY_OPTS = opt(["Raw Material", "Packaging", "Finished Goods", "Services", "Logistics", "General"]);
export const STATUS_OPTS = opt(["Active", "Inactive", "Blocked"]);
export const ACCOUNT_TYPE_OPTS = opt(["Savings", "Current", "OD / CC"]);
export const PAYMENT_TERM_OPTS = opt(["Immediate", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days", "Custom"]);
export const LEDGER_OPTS = opt(["Sundry Creditors", "Trade Payables", "Advance to Suppliers", "Purchase Account", "Input GST"]);
export const YES_NO = opt(["Yes", "No"]);
export const RATING_OPTS = opt(["5 - Excellent", "4 - Good", "3 - Average", "2 - Poor", "1 - Bad"]);

/* ======================================================= field defs ==== */

export const GENERAL_FIELDS: SField[] = [
  { name: "code", label: "Supplier Code", icon: Tag, info: "Internal supplier code — must be unique.", sample: "SUP-1001" },
  { name: "name", label: "Supplier Name *", icon: Building2, info: "Trading name shown on POs & reports.", sample: "Metro Cash & Carry" },
  { name: "legalName", label: "Legal Entity Name", icon: FileText, info: "Full legal name as registered.", sample: "Metro Wholesale India Pvt Ltd" },
  { name: "type", label: "Supplier Type", icon: Truck, info: "Nature of the supplier.", type: "select", options: SUPPLIER_TYPE_OPTS },
  { name: "category", label: "Supplier Category", icon: Layers, info: "Procurement category.", type: "select", options: SUPPLIER_CATEGORY_OPTS, creatable: true },
  { name: "status", label: "Supplier Status", icon: Info, info: "Active suppliers can be transacted with.", type: "select", options: STATUS_OPTS },
  { name: "website", label: "Website", icon: Globe, info: "Public website (optional).", sample: "https://metro.co.in" },
  { name: "description", label: "Business Description", icon: Info, info: "Short description of the supplier.", sample: "Wholesale cash & carry distributor", type: "textarea", full: true },
];

export const PRIMARY_CONTACT_FIELDS: SField[] = [
  { name: "c1Name", label: "Contact Person Name *", icon: User, info: "Primary point of contact.", sample: "Rakesh Mehta" },
  { name: "c1Designation", label: "Designation", icon: Briefcase, info: "Their role.", sample: "Sales Manager" },
  { name: "c1Mobile", label: "Mobile Number *", icon: Phone, info: "Primary mobile.", sample: "+91 98765 43210" },
  { name: "c1AltMobile", label: "Alternate Mobile", icon: Phone, info: "Backup number.", sample: "+91 98765 43211" },
  { name: "c1Email", label: "Email Address", icon: Mail, info: "Primary email.", sample: "rakesh@metro.co.in", type: "text" },
];
export const SECONDARY_CONTACT_FIELDS: SField[] = [
  { name: "c2Name", label: "Contact Person Name", icon: User, info: "Secondary contact.", sample: "Anita Shah" },
  { name: "c2Designation", label: "Designation", icon: Briefcase, info: "Their role.", sample: "Accounts" },
  { name: "c2Mobile", label: "Mobile Number", icon: Phone, info: "Their mobile.", sample: "+91 98765 43212" },
  { name: "c2Email", label: "Email Address", icon: Mail, info: "Their email.", sample: "anita@metro.co.in" },
];

export const REG_ADDRESS_FIELDS: SField[] = [
  { name: "regLine1", label: "Address Line 1", icon: MapPin, info: "Building / street.", sample: "Plot 21, Industrial Estate", full: true },
  { name: "regLine2", label: "Address Line 2", icon: MapPin, info: "Area / landmark.", sample: "Phase II", full: true },
  { name: "regCity", label: "City", icon: MapPin, info: "City.", sample: "Bengaluru" },
  { name: "regDistrict", label: "District", icon: MapPin, info: "District.", sample: "Bengaluru Urban" },
  { name: "regState", label: "State", icon: MapPin, info: "State / UT.", sample: "Karnataka" },
  { name: "regCountry", label: "Country", icon: Globe, info: "Country.", sample: "India" },
  { name: "regPincode", label: "Pincode", icon: Hash, info: "6-digit postal code.", sample: "560058" },
];
export const COMM_ADDRESS_FIELDS: SField[] = [
  { name: "commLine1", label: "Address Line 1", icon: MapPin, info: "Building / street.", full: true },
  { name: "commCity", label: "City", icon: MapPin, info: "City." },
  { name: "commState", label: "State", icon: MapPin, info: "State / UT." },
  { name: "commPincode", label: "Pincode", icon: Hash, info: "6-digit postal code." },
];

export const GST_FIELDS: SField[] = [
  { name: "gstin", label: "GSTIN", icon: ReceiptText, info: "15-digit GST number.", sample: "29AABCM1234C1Z5" },
  { name: "pan", label: "PAN Number", icon: CreditCard, info: "10-character PAN.", sample: "AABCM1234C" },
  { name: "tan", label: "TAN Number", icon: Hash, info: "Tax deduction account number.", sample: "BLRM12345C" },
  { name: "stateCode", label: "State Code", icon: Hash, info: "2-digit GST state code.", sample: "29" },
  { name: "placeOfSupply", label: "Place of Supply", icon: MapPin, info: "Default place of supply.", sample: "Karnataka" },
  { name: "tdsPct", label: "TDS Percentage", icon: ReceiptText, info: "TDS rate if applicable.", sample: "2", type: "number" },
];

export const BANK_FIELDS: SField[] = [
  { name: "bankName", label: "Bank Name", icon: Landmark, info: "Bank name.", sample: "HDFC Bank" },
  { name: "branch", label: "Branch Name", icon: Building2, info: "Branch.", sample: "MG Road" },
  { name: "holder", label: "Account Holder Name", icon: User, info: "As per bank records.", sample: "Metro Wholesale India Pvt Ltd" },
  { name: "account", label: "Account Number", icon: Hash, info: "Bank account number.", sample: "50100123456789" },
  { name: "ifsc", label: "IFSC Code", icon: Hash, info: "11-character IFSC.", sample: "HDFC0000123" },
  { name: "type", label: "Account Type", icon: CreditCard, info: "Type of account.", type: "select", options: ACCOUNT_TYPE_OPTS },
  { name: "upi", label: "UPI ID", icon: Phone, info: "UPI handle.", sample: "metro@hdfcbank" },
];

export const PURCHASE_FIELDS: SField[] = [
  { name: "leadTime", label: "Purchase Lead Time (Days)", icon: CalendarClock, info: "Days from PO to delivery.", sample: "3", type: "number" },
  { name: "minOrderQty", label: "Minimum Order Quantity", icon: Boxes, info: "Smallest order accepted.", sample: "10", type: "number" },
  { name: "maxOrderQty", label: "Maximum Order Quantity", icon: Boxes, info: "Largest order per PO.", sample: "1000", type: "number" },
];

export const CREDIT_FIELDS: SField[] = [
  { name: "creditLimit", label: "Credit Limit", icon: CreditCard, info: "Maximum outstanding allowed.", sample: "500000", type: "number" },
  { name: "creditPeriod", label: "Credit Period (Days)", icon: CalendarClock, info: "Days allowed to pay.", sample: "30", type: "number" },
];

export const PRODUCT_MAP_FIELDS: SField[] = [
  { name: "productCode", label: "Product Code", icon: Tag, info: "Your product code.", sample: "PRD-1001" },
  { name: "supplierProductCode", label: "Supplier Product Code", icon: Hash, info: "Supplier's code for it.", sample: "MET-PG-100" },
  { name: "supplierProductName", label: "Supplier Product Name", icon: Boxes, info: "Supplier's product name.", sample: "Parle-G 100g (Case)" },
  { name: "lastPurchasePrice", label: "Last Purchase Price", icon: CreditCard, info: "Most recent buy price.", sample: "8.50", type: "number" },
  { name: "preferred", label: "Preferred", icon: Info, info: "Preferred supplier for this item.", type: "select", options: YES_NO },
];

export const ACCOUNTING_FIELDS: SField[] = [
  { name: "ledger", label: "Supplier Ledger Account", icon: Calculator, info: "Accounts-payable ledger.", type: "select", options: LEDGER_OPTS },
  { name: "advanceAccount", label: "Advance Account", icon: Calculator, info: "Ledger for advances paid.", type: "select", options: LEDGER_OPTS },
  { name: "purchaseAccount", label: "Purchase Account", icon: Calculator, info: "Default purchase ledger.", type: "select", options: LEDGER_OPTS },
  { name: "openingPayable", label: "Opening Payable Amount", icon: CreditCard, info: "Amount owed at go-live.", sample: "0", type: "number" },
  { name: "openingAdvance", label: "Opening Advance Amount", icon: CreditCard, info: "Advance paid at go-live.", sample: "0", type: "number" },
];

export const RATING_FIELDS: SField[] = [
  { name: "rateQuality", label: "Quality", icon: Gauge, info: "Product quality rating.", type: "select", options: RATING_OPTS },
  { name: "rateDelivery", label: "Delivery", icon: Truck, info: "On-time delivery rating.", type: "select", options: RATING_OPTS },
  { name: "ratePricing", label: "Pricing", icon: CreditCard, info: "Competitiveness of pricing.", type: "select", options: RATING_OPTS },
  { name: "rateSupport", label: "Support", icon: Contact, info: "Responsiveness & support.", type: "select", options: RATING_OPTS },
];

/* ===================================================== toggle groups === */

export const COMM_PREFS: SToggle[] = [
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
];
export const PAYMENT_MODES: SToggle[] = [
  { id: "bank", label: "Bank Transfer" },
  { id: "upi", label: "UPI" },
  { id: "cheque", label: "Cheque" },
  { id: "cash", label: "Cash" },
];
export const DOCUMENTS: SToggle[] = [
  { id: "gst", label: "GST Certificate" },
  { id: "pan", label: "PAN Card" },
  { id: "msme", label: "MSME Certificate" },
  { id: "fssai", label: "FSSAI Certificate" },
  { id: "drug", label: "Drug License" },
  { id: "bank", label: "Bank Proof" },
  { id: "agreement", label: "Agreement Copy" },
];

/* ====================================================== sample data ==== */

export type SupplierStatus = "Active" | "Inactive" | "Blocked";

export interface SupplierRow {
  id: string;
  code: string;
  name: string;
  type: string;
  category: string;
  gstin: string;
  state: string;
  outstanding: number;
  status: SupplierStatus;
  preferred: boolean;
  approval: "Approved" | "Pending" | "Draft" | "Rejected";
  rating: number;
}

export const SAMPLE_SUPPLIERS: SupplierRow[] = [
  { id: "S1", code: "SUP-1001", name: "Metro Cash & Carry", type: "Wholesaler", category: "Finished Goods", gstin: "29AABCM1234C1Z5", state: "Karnataka", outstanding: 184500, status: "Active", preferred: true, approval: "Approved", rating: 5 },
  { id: "S2", code: "SUP-1002", name: "Reliance Distributors", type: "Distributor", category: "Finished Goods", gstin: "27AAACR5055K1Z2", state: "Maharashtra", outstanding: 92300, status: "Active", preferred: true, approval: "Approved", rating: 4 },
  { id: "S3", code: "SUP-1003", name: "Parle Products Pvt Ltd", type: "Manufacturer", category: "Finished Goods", gstin: "27AAACP1234M1Z9", state: "Maharashtra", outstanding: 56000, status: "Active", preferred: false, approval: "Approved", rating: 5 },
  { id: "S4", code: "SUP-1004", name: "HUL Distributor", type: "Distributor", category: "Finished Goods", gstin: "29AAACH1234U1Z3", state: "Karnataka", outstanding: 0, status: "Active", preferred: true, approval: "Approved", rating: 4 },
  { id: "S5", code: "SUP-1005", name: "Sunrise Packaging", type: "Manufacturer", category: "Packaging", gstin: "29AAFCS1234P1Z1", state: "Karnataka", outstanding: 12750, status: "Active", preferred: false, approval: "Pending", rating: 3 },
  { id: "S6", code: "SUP-1006", name: "Apex Logistics", type: "Service Provider", category: "Logistics", gstin: "29AAGCA1234L1Z7", state: "Karnataka", outstanding: 8400, status: "Inactive", preferred: false, approval: "Approved", rating: 3 },
  { id: "S7", code: "SUP-1007", name: "Global Imports Co", type: "Wholesaler", category: "General", gstin: "07AAHCG1234G1Z5", state: "Delhi", outstanding: 0, status: "Blocked", preferred: false, approval: "Rejected", rating: 2 },
];

export const SUPPLIER_STATS = {
  total: 342,
  active: 298,
  blocked: 9,
  preferred: 64,
  pending: 11,
  outstanding: 1842500,
};
