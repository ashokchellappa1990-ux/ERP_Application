import {
  Building2,
  BriefcaseBusiness,
  Contact,
  GitBranch,
  Warehouse,
  Network,
  Landmark,
  Banknote,
  ReceiptText,
  Users,
  Boxes,
  ShoppingCart,
  CreditCard,
  Bell,
  Printer,
  Blocks,
  Sparkles,
  DatabaseZap,
  ShieldCheck,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

/* =========================================================== modes ===== */

export type SetupMode = "quick" | "standard" | "advanced";

export interface ModeMeta {
  id: SetupMode;
  name: string;
  tagline: string;
  points: string[];
  badge?: string;
  minutes: string;
}

export const MODES: ModeMeta[] = [
  {
    id: "quick",
    name: "Quick Setup",
    tagline: "Get billing in minutes",
    points: ["Basic configuration", "Single store", "Essential steps only"],
    minutes: "~5 min",
  },
  {
    id: "standard",
    name: "Standard Setup",
    tagline: "Complete business configuration",
    points: [
      "Full company & GST setup",
      "Finance, users & inventory",
      "POS, payments & modules",
    ],
    badge: "Recommended",
    minutes: "~15 min",
  },
  {
    id: "advanced",
    name: "Advanced Setup",
    tagline: "Enterprise configuration",
    points: [
      "Multi-branch & multi-warehouse",
      "Multi-user & roles",
      "Data migration & security",
    ],
    minutes: "~25 min",
  },
];

/* =========================================================== steps ===== */

export type StepId =
  | "company"
  | "profile"
  | "contact"
  | "branch"
  | "warehouse"
  | "organization"
  | "financial"
  | "banking"
  | "gst"
  | "users"
  | "inventory"
  | "pos"
  | "payment"
  | "notification"
  | "hardware"
  | "modules"
  | "industry"
  | "migration"
  | "security"
  | "review";

export interface StepMeta {
  id: StepId;
  title: string;
  group: string;
  icon: LucideIcon;
}

// Branch Setup is captured here (before Business Modules) and saved to the
// branches table. User & Roles, Inventory/POS/Payment Configuration, Notifications
// and Industry Configuration live in their own System menus, so they are no longer
// steps in this wizard.
export const STEPS: StepMeta[] = [
  { id: "company", title: "Company Information", group: "Business", icon: Building2 },
  { id: "profile", title: "Business Profile", group: "Business", icon: BriefcaseBusiness },
  { id: "contact", title: "Contact Information", group: "Business", icon: Contact },
  { id: "branch", title: "Branch Setup", group: "Locations", icon: GitBranch },
  { id: "warehouse", title: "Warehouse Setup", group: "Locations", icon: Warehouse },
  { id: "organization", title: "Organization Structure", group: "Locations", icon: Network },
  { id: "banking", title: "Banking Setup", group: "Finance", icon: Banknote },
  { id: "hardware", title: "Hardware Configuration", group: "Operations", icon: Printer },
  { id: "migration", title: "Data Migration", group: "Modules", icon: DatabaseZap },
  { id: "security", title: "Security Configuration", group: "Modules", icon: ShieldCheck },
  { id: "review", title: "Review & Complete", group: "Finish", icon: ClipboardCheck },
];

/** Which steps each mode includes. */
export const MODE_STEPS: Record<SetupMode, StepId[]> = {
  quick: ["company", "review"],
  standard: [
    "company",
    "profile",
    "contact",
    "branch",
    "organization",
    "banking",
    "review",
  ],
  advanced: STEPS.map((s) => s.id),
};

/* ========================================================= options ===== */

export const INDUSTRIES = [
  "Grocery & Supermarket",
  "Pharmacy & Medical",
  "Textile & Garments",
  "Footwear",
  "Electronics & Mobile",
  "Furniture",
  "Hardware & Building Material",
  "Cosmetics & Personal Care",
  "Automobile Spare Parts",
  "Agricultural Retail",
  "Stationery & Books",
  "Gift & Fancy",
  "Sports & Fitness",
  "Wholesale Distribution",
  "Multi-Store Retail Chain",
].map((x) => ({ value: x, label: x }));

export const OWNERSHIP_TYPES = [
  "Proprietorship",
  "Partnership",
  "LLP",
  "Private Limited",
  "Public Limited",
  "Trust",
  "Society",
].map((x) => ({ value: x, label: x }));

export const TURNOVER_RANGES = [
  "Below ₹40 Lakh",
  "₹40 Lakh – ₹1.5 Cr",
  "₹1.5 Cr – ₹5 Cr",
  "₹5 Cr – ₹25 Cr",
  "Above ₹25 Cr",
].map((x) => ({ value: x, label: x }));

export const EMPLOYEE_RANGES = ["1–10", "11–50", "51–200", "201–500", "500+"].map(
  (x) => ({ value: x, label: x })
);

export const BRANCH_TYPES = ["Retail Outlet", "Warehouse Outlet", "Head Office", "Franchise"].map(
  (x) => ({ value: x, label: x })
);
export const WAREHOUSE_TYPES = ["Main", "Transit", "Cold Storage", "Bonded", "Returns"].map(
  (x) => ({ value: x, label: x })
);
export const ACCOUNT_TYPES = ["Savings", "Current", "OD / CC", "Cash Credit"].map((x) => ({
  value: x,
  label: x,
}));
export const ROLES = [
  "Admin",
  "Branch Manager",
  "Store Manager",
  "Cashier",
  "Accountant",
  "Inventory Manager",
  "Purchase Manager",
  "Sales Manager",
  "Pharmacist",
  "HR Manager",
].map((x) => ({ value: x, label: x }));

export const MIGRATION_SOURCES = ["Excel", "Tally", "Busy", "Marg", "Zoho", "Other"].map(
  (x) => ({ value: x, label: x })
);

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* =================================================== toggle groups ===== */
/** Reusable definition for the many enable/disable feature lists. */
export interface ToggleItem {
  id: string;
  label: string;
  desc?: string;
}

export const INVENTORY_TOGGLES: ToggleItem[] = [
  { id: "batch", label: "Batch Tracking", desc: "Track stock by batch number" },
  { id: "lot", label: "Lot Tracking" },
  { id: "serial", label: "Serial Number Tracking", desc: "For electronics, appliances" },
  { id: "expiry", label: "Expiry Date Tracking", desc: "Pharmacy, grocery, cosmetics" },
  { id: "mfg", label: "Manufacturing Date Tracking" },
  { id: "warranty", label: "Warranty Tracking" },
  { id: "trace", label: "Product Traceability" },
];
export const INVENTORY_RULES: ToggleItem[] = [
  { id: "negative", label: "Negative Stock Allowed" },
  { id: "reservation", label: "Stock Reservation" },
  { id: "blocking", label: "Stock Blocking" },
  { id: "reorder", label: "Reorder Level Monitoring" },
];

export const POS_TOGGLES: ToggleItem[] = [
  { id: "barcode", label: "Barcode Billing" },
  { id: "qr", label: "QR Billing" },
  { id: "quick", label: "Quick Billing" },
  { id: "touch", label: "Touch POS" },
  { id: "credit", label: "Credit Sales" },
  { id: "hold", label: "Hold Bill" },
  { id: "recall", label: "Recall Bill" },
  { id: "split", label: "Split Billing" },
  { id: "delivery", label: "Home Delivery" },
];
export const RECEIPT_TOGGLES: ToggleItem[] = [
  { id: "print", label: "Auto Print Receipt" },
  { id: "email", label: "Email Receipt" },
  { id: "sms", label: "SMS Receipt" },
  { id: "whatsapp", label: "WhatsApp Receipt" },
];

export const PAYMENT_MODES: ToggleItem[] = [
  { id: "cash", label: "Cash" },
  { id: "debit", label: "Debit Card" },
  { id: "credit", label: "Credit Card" },
  { id: "upi", label: "UPI" },
  { id: "wallet", label: "Wallet" },
  { id: "giftcard", label: "Gift Card" },
  { id: "loyalty", label: "Loyalty Redemption" },
  { id: "bank", label: "Bank Transfer" },
];

export const NOTIFY_CHANNELS: ToggleItem[] = [
  { id: "email", label: "Email Notifications" },
  { id: "sms", label: "SMS Notifications" },
  { id: "whatsapp", label: "WhatsApp Notifications" },
  { id: "push", label: "Push Notifications" },
];
export const NOTIFY_EVENTS: ToggleItem[] = [
  { id: "sales", label: "Sales Invoice" },
  { id: "purchase", label: "Purchase Invoice" },
  { id: "payment", label: "Payment Received" },
  { id: "lowstock", label: "Low Stock Alert" },
  { id: "expiry", label: "Expiry Alert" },
  { id: "promo", label: "Customer Promotions" },
];

export const HARDWARE_TOGGLES: ToggleItem[] = [
  { id: "thermal", label: "Thermal Printer" },
  { id: "barcode", label: "Barcode Scanner" },
  { id: "qr", label: "QR Scanner" },
  { id: "drawer", label: "Cash Drawer" },
  { id: "display", label: "Customer Display" },
  { id: "scale", label: "Weighing Scale" },
  { id: "biometric", label: "Biometric Device" },
];

export const MODULE_TOGGLES: ToggleItem[] = [
  { id: "masters", label: "Master Management" },
  { id: "purchase", label: "Purchase Management" },
  { id: "inventory", label: "Inventory Management" },
  { id: "sales", label: "Sales & POS" },
  { id: "crm", label: "CRM" },
  { id: "loyalty", label: "Loyalty Program" },
  { id: "chit", label: "Chit Scheme" },
  { id: "accounting", label: "Accounting" },
  { id: "gst", label: "GST" },
  { id: "einvoice", label: "E-Invoice" },
  { id: "eway", label: "E-Way Bill" },
  { id: "hrms", label: "HRMS" },
  { id: "reports", label: "Reports & Analytics" },
  { id: "ai", label: "AI Assistant" },
  { id: "pharmacy", label: "Pharmacy Module" },
];

export const SECURITY_TOGGLES: ToggleItem[] = [
  { id: "otp", label: "OTP Login", desc: "One-time password on sign-in" },
  { id: "2fa", label: "Two-Factor Authentication" },
  { id: "pwexpiry", label: "Password Expiry Policy" },
  { id: "session", label: "Session Timeout" },
  { id: "audit", label: "Login Audit Trail" },
];

export const MIGRATION_IMPORTS: ToggleItem[] = [
  { id: "products", label: "Product Master" },
  { id: "customers", label: "Customer Master" },
  { id: "suppliers", label: "Supplier Master" },
  { id: "stock", label: "Opening Stock" },
  { id: "balances", label: "Outstanding Balances" },
];

/** Items enabled by default when the wizard initializes. */
export const DEFAULT_ENABLED: Partial<Record<string, string[]>> = {
  inventory: ["reorder"],
  pos: ["barcode", "quick", "touch", "hold", "recall"],
  receipt: ["print"],
  payment: ["cash", "upi", "credit", "debit"],
  notifyChannels: ["email", "sms"],
  notifyEvents: ["sales", "payment", "lowstock"],
  hardware: ["thermal", "barcode", "drawer"],
  modules: [
    "masters",
    "purchase",
    "inventory",
    "sales",
    "accounting",
    "gst",
    "reports",
  ],
  security: ["otp", "audit", "session"],
};
