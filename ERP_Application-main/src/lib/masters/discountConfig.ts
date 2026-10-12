import {
  Info,
  Target,
  Percent,
  Layers,
  Boxes,
  Gift,
  Users,
  Ticket,
  Megaphone,
  CalendarClock,
  GitBranch,
  GitPullRequestArrow,
  ListOrdered,
  Sparkles,
  Calculator,
  ScrollText,
  Tag,
  IndianRupee,
  Hash,
  Star,
  type LucideIcon,
} from "lucide-react";

/* ============================================================= types === */
export interface DField {
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
export interface DToggle { id: string; label: string; desc?: string; }
export interface DiscountTab { id: string; label: string; icon: LucideIcon; group: string; }

export const DISCOUNT_TABS: DiscountTab[] = [
  { id: "general", label: "Discount Master", icon: Info, group: "Basics" },
  { id: "applicability", label: "Applicability Rules", icon: Target, group: "Basics" },
  { id: "value", label: "Discount Value", icon: Percent, group: "Value" },
  { id: "quantity", label: "Quantity & Slab", icon: Layers, group: "Value" },
  { id: "combo", label: "Combo Offers", icon: Boxes, group: "Offers" },
  { id: "buyget", label: "Buy X Get Y", icon: Gift, group: "Offers" },
  { id: "customer", label: "Customer & Loyalty", icon: Users, group: "Targeting" },
  { id: "coupon", label: "Coupon Management", icon: Ticket, group: "Offers" },
  { id: "promotion", label: "Promotion", icon: Megaphone, group: "Offers" },
  { id: "expiry", label: "Near Expiry & Clearance", icon: CalendarClock, group: "Targeting" },
  { id: "branch", label: "Branch Policy", icon: GitBranch, group: "Targeting" },
  { id: "approval", label: "Approval Workflow", icon: GitPullRequestArrow, group: "Engine" },
  { id: "priority", label: "Priority Rule Engine", icon: ListOrdered, group: "Engine" },
  { id: "ai", label: "AI Discount Engine", icon: Sparkles, group: "Engine" },
  { id: "accounting", label: "Accounting", icon: Calculator, group: "Engine" },
  { id: "audit", label: "Audit & Tracking", icon: ScrollText, group: "Engine" },
];

const opt = (a: string[]) => a.map((x) => ({ value: x, label: x }));

export const DISCOUNT_TYPE_OPTS = opt(["Flat Amount", "Percentage", "Coupon", "Combo", "Buy X Get Y", "Slab", "Loyalty", "Festival", "Custom"]);
export const STATUS_OPTS = opt(["Draft", "Active", "Inactive", "Expired"]);
export const PRIORITY_OPTS = opt(["High", "Medium", "Low"]);
export const METHOD_OPTS = opt(["Flat Amount", "Percentage"]);
export const COUPON_TYPE_OPTS = opt(["Flat", "Percentage"]);
export const COUPON_USAGE_OPTS = opt(["Single Use", "Multiple Use"]);
export const TIER_OPTS = opt(["Silver", "Gold", "Platinum", "Diamond"]);
export const ACCOUNT_OPTS = opt(["Discount Expense", "Promotion Expense", "Manufacturer Reimbursement", "Sales Returns"]);
export const CHANNELS: DToggle[] = [
  { id: "pos", label: "Retail POS" }, { id: "wholesale", label: "Wholesale" }, { id: "online", label: "Online Store" }, { id: "mobile", label: "Mobile App" }, { id: "marketplace", label: "Marketplace" },
];
export const APPLY_ON: DToggle[] = [
  { id: "product", label: "Product" }, { id: "category", label: "Product Category" }, { id: "brand", label: "Brand" }, { id: "customer", label: "Customer" }, { id: "customerGroup", label: "Customer Group" }, { id: "branch", label: "Branch" }, { id: "store", label: "Store" }, { id: "channel", label: "Sales Channel" },
];
export const PRIORITY_BEHAVIOR = ["Highest Discount Wins", "Lowest Discount Wins", "Stack Discounts", "Priority Based"];
export const PRIORITY_ORDER = ["Coupon", "Loyalty", "Product Discount", "Festival Discount"];

/* The 26 supported discount types (reference chips on the General tab). */
export const DISCOUNT_TYPES = [
  "Flat Amount", "Percentage", "Product", "Category", "Brand", "Customer", "Customer Group", "Loyalty", "Quantity", "Slab", "Bill Level", "Combo", "Bundle", "Buy X Get Y", "Coupon", "Promo Code", "Festival", "Happy Hour", "Weekend", "Branch", "Employee", "Corporate", "Manufacturer Sponsored", "Near Expiry", "Seasonal Clearance", "Dead Stock",
];

/* ======================================================= field defs ==== */
export const GENERAL_FIELDS: DField[] = [
  { name: "code", label: "Discount Code", icon: Tag, info: "Unique code for the discount.", sample: "DISC-1001" },
  { name: "name", label: "Discount Name *", icon: Percent, info: "Display name shown at billing.", sample: "Diwali 10% Off" },
  { name: "type", label: "Discount Type", icon: Tag, info: "Primary type of this discount.", type: "select", options: DISCOUNT_TYPE_OPTS },
  { name: "status", label: "Status", icon: Info, info: "Active discounts apply at billing.", type: "select", options: STATUS_OPTS },
  { name: "priority", label: "Priority Level", icon: ListOrdered, info: "Used when multiple discounts compete.", type: "select", options: PRIORITY_OPTS },
  { name: "start", label: "Start Date", icon: CalendarClock, info: "Effective from.", type: "date" },
  { name: "end", label: "End Date", icon: CalendarClock, info: "Effective until.", type: "date" },
  { name: "description", label: "Description", icon: Info, info: "Internal description.", sample: "Festival offer on all categories", type: "textarea", full: true },
];

export const VALUE_FIELDS: DField[] = [
  { name: "value", label: "Discount Value", icon: Percent, info: "% or ₹ amount based on method.", sample: "10", type: "number" },
  { name: "maxDiscount", label: "Maximum Discount Amount", icon: IndianRupee, info: "Cap on the discount value.", sample: "500", type: "number" },
  { name: "minDiscount", label: "Minimum Discount Amount", icon: IndianRupee, info: "Floor on the discount value.", sample: "0", type: "number" },
  { name: "minBill", label: "Minimum Bill Value", icon: IndianRupee, info: "Minimum cart value to qualify.", sample: "999", type: "number" },
];

export const COUPON_FIELDS: DField[] = [
  { name: "couponCode", label: "Coupon Code", icon: Ticket, info: "Code customers enter.", sample: "DIWALI10" },
  { name: "couponName", label: "Coupon Name", icon: Tag, info: "Display name.", sample: "Diwali Coupon" },
  { name: "couponType", label: "Coupon Type", icon: Percent, info: "Flat or percentage.", type: "select", options: COUPON_TYPE_OPTS },
  { name: "couponUsage", label: "Usage", icon: Hash, info: "Single or multiple use.", type: "select", options: COUPON_USAGE_OPTS },
  { name: "couponStart", label: "Valid From", icon: CalendarClock, info: "Coupon start.", type: "date" },
  { name: "couponEnd", label: "Valid Until", icon: CalendarClock, info: "Coupon end.", type: "date" },
  { name: "maxRedemption", label: "Maximum Redemption Count", icon: Hash, info: "Total redemptions allowed.", sample: "1000", type: "number" },
];

export const PROMO_FIELDS: DField[] = [
  { name: "campaignName", label: "Campaign Name", icon: Megaphone, info: "Promotion campaign name.", sample: "Diwali Offer" },
  { name: "campaignStart", label: "Campaign Start", icon: CalendarClock, info: "Start date.", type: "date" },
  { name: "campaignEnd", label: "Campaign End", icon: CalendarClock, info: "End date.", type: "date" },
  { name: "budget", label: "Campaign Budget", icon: IndianRupee, info: "Allocated budget.", sample: "200000", type: "number" },
  { name: "expectedIncrease", label: "Expected Sales Increase (%)", icon: Percent, info: "Target uplift.", sample: "25", type: "number" },
];

export const CUSTOMER_FIELDS: DField[] = [
  { name: "customerName", label: "Customer Name", icon: Users, info: "Specific customer (optional).", sample: "Kiran Stores" },
  { name: "customerGroup", label: "Customer Group", icon: Users, info: "Customer segment (optional).", sample: "Wholesale" },
];

export const BUYGET_FIELDS: DField[] = [
  { name: "buyProduct", label: "Buy Product", icon: Boxes, info: "Product to purchase.", sample: "Parle-G 100g" },
  { name: "buyQty", label: "Buy Quantity", icon: Hash, info: "Qty to buy.", sample: "2", type: "number" },
  { name: "freeProduct", label: "Free Product", icon: Gift, info: "Product given free.", sample: "Parle-G 100g" },
  { name: "freeQty", label: "Free Quantity", icon: Hash, info: "Qty given free.", sample: "1", type: "number" },
];

export const ACCOUNTING_FIELDS: DField[] = [
  { name: "discountExpense", label: "Discount Expense Account", icon: Calculator, info: "Ledger for discount cost.", type: "select", options: ACCOUNT_OPTS },
  { name: "promoExpense", label: "Promotion Expense Account", icon: Calculator, info: "Ledger for promotion spend.", type: "select", options: ACCOUNT_OPTS },
  { name: "mfgReimburse", label: "Manufacturer Reimbursement Account", icon: Calculator, info: "Ledger for sponsored discounts.", type: "select", options: ACCOUNT_OPTS },
];

/* loyalty tier discount inputs handled inline; branch roles too */
export const ROLE_LIMITS = [
  { role: "Cashier", sample: "5" },
  { role: "Store Manager", sample: "15" },
  { role: "Branch Manager", sample: "25" },
  { role: "Admin", sample: "100" },
];

export const AI_TARGETS = [
  { id: "slow", label: "Slow Moving Products" },
  { id: "dead", label: "Dead Stock" },
  { id: "expiry", label: "Near Expiry Products" },
  { id: "seasonal", label: "Seasonal Products" },
  { id: "overstock", label: "Overstocked Products" },
];

/* ----------------------------------------------- AI discount modes ---- */
export interface AiMode {
  id: "regular" | "special" | "festival";
  label: string;
  icon: LucideIcon;
  desc: string;
  fields: DField[];
}
/** Three AI-driven configuration profiles surfaced in the AI Engine tab. */
export const AI_MODES: AiMode[] = [
  {
    id: "regular",
    label: "Regular Discount",
    icon: Percent,
    desc: "Always-on AI markdowns for slow-moving, overstocked & near-expiry stock to protect margin.",
    fields: [
      { name: "aiReg_basis", label: "Optimization Basis", icon: Target, info: "What the engine optimizes markdowns against.", type: "select", options: [
        { value: "velocity", label: "Sales Velocity" }, { value: "ageing", label: "Stock Ageing" }, { value: "margin", label: "Margin Protection" }, { value: "expiry", label: "Expiry Risk" } ] },
      { name: "aiReg_slowDays", label: "Slow-Mover Threshold (days)", icon: CalendarClock, info: "No-sale days before a SKU is treated as slow-moving.", sample: "45", type: "number" },
      { name: "aiReg_maxDisc", label: "Max Discount %", icon: Percent, info: "Ceiling the AI may not exceed.", sample: "25", type: "number" },
      { name: "aiReg_marginFloor", label: "Min Margin Floor %", icon: IndianRupee, info: "Engine keeps net margin above this.", sample: "8", type: "number" },
    ],
  },
  {
    id: "special",
    label: "Special Discount",
    icon: Star,
    desc: "Targeted AI offers for segments, campaigns & clearance — tuned to uplift conversion.",
    fields: [
      { name: "aiSpec_occasion", label: "Occasion / Campaign", icon: Megaphone, info: "Reason for the special offer.", sample: "Anniversary Sale", type: "text" },
      { name: "aiSpec_segment", label: "Target Segment", icon: Users, info: "Customer group the AI focuses on.", type: "select", options: [
        { value: "all", label: "All Customers" }, { value: "loyal", label: "Loyalty Members" }, { value: "lapsed", label: "Lapsed Customers" }, { value: "new", label: "New Customers" }, { value: "b2b", label: "B2B / Wholesale" } ] },
      { name: "aiSpec_uplift", label: "Conversion Uplift Target %", icon: Target, info: "Goal the engine optimizes toward.", sample: "20", type: "number" },
      { name: "aiSpec_maxDisc", label: "Max Discount %", icon: Percent, info: "Ceiling the AI may not exceed.", sample: "35", type: "number" },
    ],
  },
  {
    id: "festival",
    label: "Festival Discount",
    icon: Gift,
    desc: "Event-aware AI offers timed to festivals with demand-uplift forecasting & bundle suggestions.",
    fields: [
      { name: "aiFest_name", label: "Festival", icon: CalendarClock, info: "Festival the campaign targets.", type: "select", creatable: true, options: [
        { value: "diwali", label: "Diwali" }, { value: "pongal", label: "Pongal" }, { value: "onam", label: "Onam" }, { value: "eid", label: "Eid" }, { value: "christmas", label: "Christmas" }, { value: "newyear", label: "New Year" } ] },
      { name: "aiFest_start", label: "Festival Period — From", icon: CalendarClock, info: "Campaign window start.", type: "date" },
      { name: "aiFest_end", label: "Festival Period — To", icon: CalendarClock, info: "Campaign window end.", type: "date" },
      { name: "aiFest_uplift", label: "Expected Demand Uplift %", icon: Target, info: "Forecast footfall/demand lift used to size offers.", sample: "60", type: "number" },
      { name: "aiFest_maxDisc", label: "Max Discount %", icon: Percent, info: "Ceiling the AI may not exceed.", sample: "30", type: "number" },
    ],
  },
];

export const REPORTS = [
  { id: "summary", name: "Discount Summary", desc: "All discounts, value & status" },
  { id: "utilization", name: "Discount Utilization", desc: "How often each discount applied" },
  { id: "coupon", name: "Coupon Usage", desc: "Redemptions per coupon" },
  { id: "promo", name: "Promotion Effectiveness", desc: "Uplift vs budget per campaign" },
  { id: "profit", name: "Discount Profitability", desc: "Margin impact of discounts" },
  { id: "expiry", name: "Near Expiry Discount", desc: "Markdowns on expiring stock" },
  { id: "branch", name: "Branch Discount", desc: "Discounts by branch & role" },
];

/* ====================================================== sample data ==== */
export type DiscountStatus = "Draft" | "Active" | "Inactive" | "Expired";
export interface DiscountRow {
  id: string; code: string; name: string; type: string; value: string; priority: string;
  start: string; end: string; used: number; status: DiscountStatus; approval: "Approved" | "Pending" | "Draft" | "Rejected";
}
export const SAMPLE_DISCOUNTS: DiscountRow[] = [
  { id: "D1", code: "DISC-1001", name: "Diwali 10% Off", type: "Festival", value: "10%", priority: "High", start: "2026-10-20", end: "2026-11-05", used: 1840, status: "Active", approval: "Approved" },
  { id: "D2", code: "DISC-1002", name: "Buy 2 Get 1 — Biscuits", type: "Buy X Get Y", value: "1 Free", priority: "Medium", start: "2026-06-01", end: "2026-06-30", used: 612, status: "Active", approval: "Approved" },
  { id: "D3", code: "DISC-1003", name: "FLAT100 Coupon", type: "Coupon", value: "₹100", priority: "Medium", start: "2026-06-01", end: "2026-06-15", used: 940, status: "Active", approval: "Approved" },
  { id: "D4", code: "DISC-1004", name: "Wholesale Slab Discount", type: "Slab", value: "5–15%", priority: "High", start: "2026-04-01", end: "2027-03-31", used: 320, status: "Active", approval: "Approved" },
  { id: "D5", code: "DISC-1005", name: "Platinum Loyalty 8%", type: "Loyalty", value: "8%", priority: "Medium", start: "2026-01-01", end: "2026-12-31", used: 210, status: "Active", approval: "Approved" },
  { id: "D6", code: "DISC-1006", name: "Near Expiry Clearance", type: "Near Expiry", value: "10–40%", priority: "Low", start: "2026-06-01", end: "2026-12-31", used: 88, status: "Active", approval: "Pending" },
  { id: "D7", code: "DISC-1007", name: "Pongal Combo Offer", type: "Combo", value: "Fixed", priority: "Medium", start: "2026-01-10", end: "2026-01-18", used: 0, status: "Draft", approval: "Draft" },
  { id: "D8", code: "DISC-1008", name: "New Year Sale 20%", type: "Percentage", value: "20%", priority: "High", start: "2025-12-25", end: "2026-01-05", used: 2750, status: "Expired", approval: "Approved" },
];

export const DISCOUNT_STATS = {
  active: 36, expired: 14, couponUsage: 12480, promoRevenue: 4820000, valueGiven: 1284500, pending: 4,
};
