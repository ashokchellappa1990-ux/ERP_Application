import {
  Info,
  Contact,
  MapPin,
  ReceiptText,
  CreditCard,
  Gift,
  Heart,
  MessageSquare,
  Calculator,
  FileText,
  BarChart3,
  Sparkles,
  Upload,
  GitPullRequestArrow,
  Tag,
  User,
  Users,
  Star,
  Phone,
  Mail,
  Hash,
  CalendarClock,
  Globe,
  Building2,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

/* ============================================================= types === */

export interface CField {
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

export interface CToggle {
  id: string;
  label: string;
  desc?: string;
}

export interface CustomerTab {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
}

export const CUSTOMER_TABS: CustomerTab[] = [
  { id: "general", label: "General Information", icon: Info, group: "Basics" },
  { id: "contact", label: "Contact Information", icon: Contact, group: "Basics" },
  { id: "address", label: "Address Information", icon: MapPin, group: "Basics" },
  { id: "gst", label: "GST & Tax", icon: ReceiptText, group: "Compliance" },
  { id: "credit", label: "Credit Management", icon: CreditCard, group: "Finance" },
  { id: "accounting", label: "Accounting", icon: Calculator, group: "Finance" },
  { id: "documents", label: "Documents", icon: FileText, group: "Records" },
  { id: "ai", label: "AI Smart Creation", icon: Sparkles, group: "Tools" },
  { id: "approval", label: "Approval Workflow", icon: GitPullRequestArrow, group: "Tools" },
];
// Hidden (kept in TAB_BODIES, just not shown): loyalty, preferences, crm, analytics, import.

/* =========================================================== options === */

const opt = (a: string[]) => a.map((x) => ({ value: x, label: x }));

export const CUSTOMER_TYPE_OPTS = opt(["Retail Customer", "Wholesale Customer", "Distributor", "Dealer", "Corporate Customer", "Walk-In Customer", "Online Customer"]);
export const CUSTOMER_CATEGORY_OPTS = opt(["Regular", "VIP", "Premium", "Corporate", "Loyalty Member"]);
export const STATUS_OPTS = opt(["Active", "Inactive", "Blocked"]);
export const GST_TYPE_OPTS = opt(["Registered", "Unregistered", "SEZ", "Export"]);
export const RISK_OPTS = opt(["Low", "Medium", "High"]);
export const TIER_OPTS = opt(["Silver", "Gold", "Platinum", "Diamond"]);
export const PAYMENT_OPTS = opt(["Cash", "Card", "UPI", "Credit"]);
export const BRANCH_OPTS = opt(["Main Store — MG Road", "Whitefield Branch", "Koramangala Branch"]);
export const LEDGER_OPTS = opt(["Sundry Debtors", "Trade Receivables", "Advance from Customers", "Loyalty Liability"]);
export const ADDRESS_TYPE_OPTS = opt(["Home", "Office", "Delivery", "Other"]);

/* ======================================================= field defs ==== */

export const GENERAL_FIELDS: CField[] = [
  { name: "code", label: "Customer Code", icon: Tag, info: "Internal customer code — must be unique.", sample: "CUST-1001" },
  { name: "name", label: "Customer Name *", icon: User, info: "Display name on bills & CRM.", sample: "Priya Sharma" },
  { name: "legalName", label: "Legal Name", icon: FileText, info: "Legal / business name (B2B).", sample: "Sharma Enterprises" },
  { name: "type", label: "Customer Type", icon: Users, info: "Nature of the customer.", type: "select", options: CUSTOMER_TYPE_OPTS },
  { name: "category", label: "Customer Category", icon: Star, info: "Segment for offers & pricing.", type: "select", options: CUSTOMER_CATEGORY_OPTS, creatable: true },
  { name: "status", label: "Status", icon: Info, info: "Active customers can transact.", type: "select", options: STATUS_OPTS },
  { name: "regDate", label: "Date of Registration", icon: CalendarClock, info: "When the customer was registered.", type: "date" },
  { name: "since", label: "Customer Since", icon: CalendarClock, info: "First became a customer.", type: "date" },
];

export const PRIMARY_CONTACT_FIELDS: CField[] = [
  { name: "c1Name", label: "Contact Person Name *", icon: User, info: "Primary contact.", sample: "Priya Sharma" },
  { name: "c1Mobile", label: "Mobile Number *", icon: Phone, info: "Primary mobile (used for OTP & loyalty).", sample: "+91 98765 43210" },
  { name: "c1AltMobile", label: "Alternate Mobile", icon: Phone, info: "Backup number.", sample: "+91 98765 43211" },
  { name: "c1Whatsapp", label: "WhatsApp Number", icon: Phone, info: "For WhatsApp notifications.", sample: "+91 98765 43210" },
  { name: "c1Email", label: "Email Address", icon: Mail, info: "Primary email.", sample: "priya@example.com" },
];
// B2C personal fields — shown only when enabled in Sales Settings → B2C Customer
// Fields (customerCapture toggles). Field `name` matches the toggle id.
export const GENDER_OPTS = [
  { value: "Male", label: "Male" }, { value: "Female", label: "Female" },
  { value: "Other", label: "Other" }, { value: "Prefer not to say", label: "Prefer not to say" },
];
export const PERSONAL_FIELDS: CField[] = [
  { name: "dob", label: "Date of Birth", icon: CalendarClock, info: "Birthday offers & greetings.", type: "date" },
  { name: "anniversary", label: "Marriage / Anniversary Date", icon: Heart, info: "Anniversary offers & greetings.", type: "date" },
  { name: "gender", label: "Gender", icon: User, info: "Targeted segmentation.", type: "select", options: GENDER_OPTS },
];

export const SECONDARY_CONTACT_FIELDS: CField[] = [
  { name: "c2Name", label: "Contact Person Name", icon: User, info: "Secondary contact.", sample: "Karan Sharma" },
  { name: "c2Mobile", label: "Mobile Number", icon: Phone, info: "Their mobile.", sample: "+91 98765 43212" },
  { name: "c2Email", label: "Email Address", icon: Mail, info: "Their email.", sample: "karan@example.com" },
];

export const BILL_ADDRESS_FIELDS: CField[] = [
  { name: "billLine1", label: "Address Line 1", icon: MapPin, info: "Building / street.", sample: "12, 4th Cross", full: true },
  { name: "billLine2", label: "Address Line 2", icon: MapPin, info: "Area / landmark.", sample: "Indiranagar", full: true },
  { name: "billCity", label: "City", icon: MapPin, info: "City.", sample: "Bengaluru" },
  { name: "billDistrict", label: "District", icon: MapPin, info: "District.", sample: "Bengaluru Urban" },
  { name: "billState", label: "State", icon: MapPin, info: "State / UT.", sample: "Karnataka" },
  { name: "billCountry", label: "Country", icon: Globe, info: "Country.", sample: "India" },
  { name: "billPincode", label: "Pincode", icon: Hash, info: "6-digit postal code.", sample: "560038" },
];
export const SHIP_ADDRESS_FIELDS: CField[] = [
  { name: "shipLine1", label: "Address Line 1", icon: MapPin, info: "Building / street.", full: true },
  { name: "shipCity", label: "City", icon: MapPin, info: "City." },
  { name: "shipState", label: "State", icon: MapPin, info: "State / UT." },
  { name: "shipPincode", label: "Pincode", icon: Hash, info: "6-digit postal code." },
];

export const GST_FIELDS: CField[] = [
  { name: "gstin", label: "GSTIN", icon: ReceiptText, info: "15-digit GST number (B2B).", sample: "29AABCS1234C1Z5" },
  { name: "pan", label: "PAN Number", icon: CreditCard, info: "10-character PAN.", sample: "AABCS1234C" },
  { name: "tan", label: "TAN Number", icon: Hash, info: "Tax deduction account number.", sample: "BLRS12345C" },
  { name: "businessName", label: "Business Name", icon: Building2, info: "Registered business name.", sample: "Sharma Enterprises" },
  { name: "stateCode", label: "State Code", icon: Hash, info: "2-digit GST state code.", sample: "29" },
];

export const CREDIT_FIELDS: CField[] = [
  { name: "creditLimit", label: "Credit Limit", icon: CreditCard, info: "Maximum outstanding allowed.", sample: "100000", type: "number" },
  { name: "creditPeriod", label: "Credit Period (Days)", icon: CalendarClock, info: "Days allowed to pay.", sample: "30", type: "number" },
];

export const LOYALTY_FIELDS: CField[] = [
  { name: "loyaltyNumber", label: "Loyalty Number", icon: Gift, info: "Membership number.", sample: "LOY-000123" },
  { name: "loyaltyTier", label: "Loyalty Tier", icon: Star, info: "Membership tier.", type: "select", options: TIER_OPTS },
  { name: "currentPoints", label: "Current Points", icon: Star, info: "Points earned to date.", sample: "1250", type: "number" },
  { name: "redeemedPoints", label: "Redeemed Points", icon: Star, info: "Points already redeemed.", sample: "400", type: "number" },
  { name: "availablePoints", label: "Available Points", icon: Star, info: "Points available to redeem.", sample: "850", type: "number" },
];

export const PREFERENCE_FIELDS: CField[] = [
  { name: "preferredBranch", label: "Preferred Branch", icon: Building2, info: "Default branch.", type: "select", options: BRANCH_OPTS },
  { name: "preferredSalesperson", label: "Preferred Salesperson", icon: User, info: "Assigned salesperson.", sample: "Arjun Rao" },
  { name: "preferredPayment", label: "Preferred Payment Method", icon: CreditCard, info: "Default payment mode.", type: "select", options: PAYMENT_OPTS },
];

export const CRM_FIELDS: CField[] = [
  { name: "visits", label: "Customer Visits", icon: ShoppingCart, info: "Total store visits.", sample: "42", type: "number" },
  { name: "lastPurchase", label: "Last Purchase Date", icon: CalendarClock, info: "Most recent purchase.", type: "date" },
  { name: "lastContact", label: "Last Contact Date", icon: CalendarClock, info: "Last interaction.", type: "date" },
  { name: "followUp", label: "Follow-Up Date", icon: CalendarClock, info: "Next planned follow-up.", type: "date" },
  { name: "interests", label: "Customer Interests", icon: Heart, info: "Categories / brands of interest.", sample: "Cosmetics, Footwear", full: true },
  { name: "notes", label: "Customer Notes", icon: MessageSquare, info: "Internal notes, complaints, service requests.", sample: "Prefers evening delivery", type: "textarea", full: true },
];

export const ACCOUNTING_FIELDS: CField[] = [
  { name: "ledger", label: "Customer Ledger Account", icon: Calculator, info: "Accounts-receivable ledger.", type: "select", options: LEDGER_OPTS },
  { name: "advanceAccount", label: "Advance Account", icon: Calculator, info: "Ledger for advances received.", type: "select", options: LEDGER_OPTS },
  { name: "openingReceivable", label: "Opening Receivable Amount", icon: CreditCard, info: "Amount owed by customer at go-live.", sample: "0", type: "number" },
  { name: "openingAdvance", label: "Opening Advance Amount", icon: CreditCard, info: "Advance received at go-live.", sample: "0", type: "number" },
];

export const ADDRESS_ROW_FIELDS: CField[] = [
  { name: "type", label: "Address Type", icon: MapPin, type: "select", options: ADDRESS_TYPE_OPTS },
  { name: "line1", label: "Address Line", sample: "Flat 3B, Lake View Apartments" },
  { name: "city", label: "City", sample: "Bengaluru" },
  { name: "pincode", label: "Pincode", sample: "560038" },
];

export const DOCUMENTS: CToggle[] = [
  { id: "pan", label: "PAN Card" },
  { id: "gst", label: "GST Certificate" },
  { id: "businessReg", label: "Business Registration" },
  { id: "agreement", label: "Customer Agreement" },
  { id: "creditApproval", label: "Credit Approval Documents" },
];

export const COMM_PREFS: CToggle[] = [
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "call", label: "Phone Call" },
];

export const PRODUCT_CATEGORY_PREFS: CToggle[] = [
  { id: "grocery", label: "Grocery" },
  { id: "personalcare", label: "Personal Care" },
  { id: "household", label: "Household" },
  { id: "electronics", label: "Electronics" },
  { id: "fashion", label: "Fashion" },
  { id: "pharmacy", label: "Pharmacy" },
];

/* ====================================================== sample data ==== */

export type CustomerStatus = "Active" | "Inactive" | "Blocked";

export interface CustomerRow {
  id: string;
  code: string;
  name: string;
  type: string;
  category: string;
  mobile: string;
  tier: string;
  points: number;
  outstanding: number;
  status: CustomerStatus;
  approval: "Approved" | "Pending" | "Draft" | "Rejected";
  loyalty: boolean;
  credit: boolean;
}

export const SAMPLE_CUSTOMERS: CustomerRow[] = [
  { id: "C1", code: "CUST-1001", name: "Priya Sharma", type: "Retail Customer", category: "VIP", mobile: "+91 98765 43210", tier: "Gold", points: 1250, outstanding: 0, status: "Active", approval: "Approved", loyalty: true, credit: false },
  { id: "C2", code: "CUST-1002", name: "Kiran Stores", type: "Wholesale Customer", category: "Corporate", mobile: "+91 98450 11223", tier: "Platinum", points: 8400, outstanding: 184500, status: "Active", approval: "Approved", loyalty: true, credit: true },
  { id: "C3", code: "CUST-1003", name: "M. Verma", type: "Retail Customer", category: "Regular", mobile: "+91 99001 22334", tier: "Silver", points: 320, outstanding: 0, status: "Active", approval: "Approved", loyalty: true, credit: false },
  { id: "C4", code: "CUST-1004", name: "TechZone Pvt Ltd", type: "Corporate Customer", category: "Corporate", mobile: "+91 80 4123 5566", tier: "Diamond", points: 15200, outstanding: 92300, status: "Active", approval: "Approved", loyalty: true, credit: true },
  { id: "C5", code: "CUST-1005", name: "Anita Reddy", type: "Retail Customer", category: "Premium", mobile: "+91 97411 55667", tier: "Gold", points: 2100, outstanding: 0, status: "Active", approval: "Pending", loyalty: true, credit: false },
  { id: "C6", code: "CUST-1006", name: "Walk-in Customer", type: "Walk-In Customer", category: "Regular", mobile: "—", tier: "—", points: 0, outstanding: 0, status: "Active", approval: "Approved", loyalty: false, credit: false },
  { id: "C7", code: "CUST-1007", name: "Sai Distributors", type: "Distributor", category: "Corporate", mobile: "+91 90080 99887", tier: "Platinum", points: 6300, outstanding: 56000, status: "Active", approval: "Approved", loyalty: true, credit: true },
  { id: "C8", code: "CUST-1008", name: "R. Khan", type: "Online Customer", category: "Regular", mobile: "+91 99012 33445", tier: "Silver", points: 150, outstanding: 0, status: "Inactive", approval: "Approved", loyalty: true, credit: false },
  { id: "C9", code: "CUST-1009", name: "Default Defaulter Co", type: "Wholesale Customer", category: "Corporate", mobile: "+91 70123 44556", tier: "—", points: 0, outstanding: 240000, status: "Blocked", approval: "Rejected", loyalty: false, credit: true },
];

export const CUSTOMER_STATS = {
  total: 1204,
  active: 1118,
  loyalty: 642,
  credit: 196,
  blocked: 14,
  outstanding: 1284500,
};
