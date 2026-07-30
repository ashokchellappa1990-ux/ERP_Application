import {
  Layers,
  BookOpen,
  ReceiptText,
  Landmark,
  Wallet,
  Building2,
  Target,
  Coins,
  Sparkles,
  Upload,
  GitPullRequestArrow,
  FileBarChart,
  type LucideIcon,
} from "lucide-react";

export interface CoaTab {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
}

export const COA_TABS: CoaTab[] = [
  { id: "groups", label: "Account Groups", icon: Layers, group: "Structure" },
  { id: "ledgers", label: "Ledger Accounts", icon: BookOpen, group: "Structure" },
  { id: "gst", label: "GST & Tax Accounts", icon: ReceiptText, group: "Tax & Banking" },
  { id: "bank", label: "Bank Accounts", icon: Landmark, group: "Tax & Banking" },
  { id: "cash", label: "Cash Accounts", icon: Wallet, group: "Tax & Banking" },
  { id: "cost", label: "Cost Centers", icon: Building2, group: "Costing" },
  { id: "profit", label: "Profit Centers", icon: Target, group: "Costing" },
  { id: "opening", label: "Opening Balances", icon: Coins, group: "Setup" },
  { id: "ai", label: "AI COA Setup", icon: Sparkles, group: "Setup" },
  { id: "import", label: "Import COA", icon: Upload, group: "Setup" },
  { id: "approval", label: "Approval Workflow", icon: GitPullRequestArrow, group: "Setup" },
  { id: "reports", label: "Financial Reports", icon: FileBarChart, group: "Reports" },
];

export type AccountType = "Asset" | "Liability" | "Equity" | "Income" | "Expense";

export interface GroupRow { id: string; code: string; name: string; parent: string; type: AccountType; level: number; }
export const ACCOUNT_GROUPS: GroupRow[] = [
  { id: "g1", code: "1000", name: "Assets", parent: "—", type: "Asset", level: 0 },
  { id: "g2", code: "1100", name: "Current Assets", parent: "Assets", type: "Asset", level: 1 },
  { id: "g3", code: "1200", name: "Fixed Assets", parent: "Assets", type: "Asset", level: 1 },
  { id: "g4", code: "2000", name: "Liabilities", parent: "—", type: "Liability", level: 0 },
  { id: "g5", code: "2100", name: "Current Liabilities", parent: "Liabilities", type: "Liability", level: 1 },
  { id: "g6", code: "2200", name: "Long-Term Liabilities", parent: "Liabilities", type: "Liability", level: 1 },
  { id: "g7", code: "3000", name: "Equity", parent: "—", type: "Equity", level: 0 },
  { id: "g8", code: "3100", name: "Capital", parent: "Equity", type: "Equity", level: 1 },
  { id: "g9", code: "3200", name: "Reserves", parent: "Equity", type: "Equity", level: 1 },
  { id: "g10", code: "4000", name: "Income", parent: "—", type: "Income", level: 0 },
  { id: "g11", code: "4100", name: "Sales Income", parent: "Income", type: "Income", level: 1 },
  { id: "g12", code: "4200", name: "Other Income", parent: "Income", type: "Income", level: 1 },
  { id: "g13", code: "5000", name: "Cost of Goods Sold", parent: "—", type: "Expense", level: 0 },
  { id: "g14", code: "5100", name: "Purchase Cost", parent: "Cost of Goods Sold", type: "Expense", level: 1 },
  { id: "g15", code: "5200", name: "Freight Cost", parent: "Cost of Goods Sold", type: "Expense", level: 1 },
  { id: "g16", code: "6000", name: "Expenses", parent: "—", type: "Expense", level: 0 },
  { id: "g17", code: "6100", name: "Administrative Expenses", parent: "Expenses", type: "Expense", level: 1 },
  { id: "g18", code: "6200", name: "Selling Expenses", parent: "Expenses", type: "Expense", level: 1 },
  { id: "g19", code: "6300", name: "Financial Expenses", parent: "Expenses", type: "Expense", level: 1 },
];

export interface LedgerRow { id: string; code: string; name: string; type: AccountType; group: string; }
export const LEDGERS: LedgerRow[] = [
  { id: "l1", code: "1101", name: "Cash in Hand", type: "Asset", group: "Current Assets" },
  { id: "l2", code: "1102", name: "HDFC Bank A/c", type: "Asset", group: "Current Assets" },
  { id: "l3", code: "1103", name: "Sundry Debtors", type: "Asset", group: "Current Assets" },
  { id: "l4", code: "1110", name: "Inventory / Stock", type: "Asset", group: "Current Assets" },
  { id: "l5", code: "2101", name: "Sundry Creditors", type: "Liability", group: "Current Liabilities" },
  { id: "l6", code: "2110", name: "Output GST Payable", type: "Liability", group: "Current Liabilities" },
  { id: "l7", code: "3101", name: "Owner's Capital", type: "Equity", group: "Capital" },
  { id: "l8", code: "4101", name: "Retail Sales", type: "Income", group: "Sales Income" },
  { id: "l9", code: "4102", name: "Wholesale Sales", type: "Income", group: "Sales Income" },
  { id: "l10", code: "5101", name: "Purchases", type: "Expense", group: "Purchase Cost" },
  { id: "l11", code: "6101", name: "Rent", type: "Expense", group: "Administrative Expenses" },
  { id: "l12", code: "6102", name: "Salaries & Wages", type: "Expense", group: "Administrative Expenses" },
  { id: "l13", code: "6201", name: "Marketing & Advertising", type: "Expense", group: "Selling Expenses" },
];

export interface GstLedger { code: string; name: string; kind: "Input" | "Output" | "Other"; }
export const GST_LEDGERS: GstLedger[] = [
  { code: "1151", name: "CGST Input", kind: "Input" },
  { code: "1152", name: "SGST Input", kind: "Input" },
  { code: "1153", name: "IGST Input", kind: "Input" },
  { code: "2151", name: "CGST Output", kind: "Output" },
  { code: "2152", name: "SGST Output", kind: "Output" },
  { code: "2153", name: "IGST Output", kind: "Output" },
  { code: "1160", name: "TDS Receivable", kind: "Other" },
  { code: "2160", name: "TDS Payable", kind: "Other" },
];

export interface BankRow { id: string; bank: string; account: string; branch: string; ifsc: string; type: string; isDefault: boolean; }
export const BANKS: BankRow[] = [
  { id: "b1", bank: "HDFC Bank", account: "50100123456789", branch: "MG Road", ifsc: "HDFC0000123", type: "Current", isDefault: true },
  { id: "b2", bank: "ICICI Bank", account: "00112233445566", branch: "Indiranagar", ifsc: "ICIC0000456", type: "OD", isDefault: false },
];

export const CASH_ACCOUNTS = [
  { code: "1101", name: "Cash in Hand", desc: "Main till / counter cash" },
  { code: "1105", name: "Petty Cash", desc: "Small day-to-day expenses" },
];

export interface CenterRow { id: string; code: string; name: string; desc: string; }
export const COST_CENTERS: CenterRow[] = [
  { id: "cc1", code: "CC-01", name: "Head Office", desc: "Corporate office overheads" },
  { id: "cc2", code: "CC-02", name: "Branch — Chennai", desc: "Chennai store" },
  { id: "cc3", code: "CC-03", name: "Branch — Madurai", desc: "Madurai store" },
  { id: "cc4", code: "CC-04", name: "Warehouse", desc: "Central warehouse" },
  { id: "cc5", code: "CC-05", name: "Online Business", desc: "E-commerce operations" },
];
export const PROFIT_CENTERS: CenterRow[] = [
  { id: "pc1", code: "PC-01", name: "Retail Sales", desc: "Walk-in retail revenue" },
  { id: "pc2", code: "PC-02", name: "Wholesale Sales", desc: "B2B / bulk revenue" },
  { id: "pc3", code: "PC-03", name: "Online Sales", desc: "E-commerce revenue" },
  { id: "pc4", code: "PC-04", name: "Pharmacy Division", desc: "Pharmacy revenue" },
];

export interface OpeningRow { id: string; account: string; debit: string; credit: string; }
export const OPENING_BALANCES: OpeningRow[] = [
  { id: "o1", account: "Cash in Hand", debit: "25000", credit: "" },
  { id: "o2", account: "HDFC Bank A/c", debit: "480000", credit: "" },
  { id: "o3", account: "Sundry Debtors (Receivable)", debit: "184500", credit: "" },
  { id: "o4", account: "Inventory / Stock", debit: "1275000", credit: "" },
  { id: "o5", account: "Sundry Creditors (Payable)", debit: "", credit: "342000" },
  { id: "o6", account: "Output GST Payable", debit: "", credit: "48200" },
  { id: "o7", account: "Owner's Capital", debit: "", credit: "1574300" },
];

export const REPORTS = [
  { id: "trial", name: "Trial Balance", desc: "Debits & credits of every ledger" },
  { id: "pl", name: "Profit & Loss", desc: "Income vs expenses for a period" },
  { id: "trading", name: "Trading Account", desc: "Gross profit from trading" },
  { id: "bs", name: "Balance Sheet", desc: "Assets, liabilities & equity" },
  { id: "cashflow", name: "Cash Flow Statement", desc: "Cash in & out by activity" },
  { id: "gst", name: "GST Reports", desc: "GSTR-1, 3B & reconciliation" },
  { id: "cost", name: "Cost Center Reports", desc: "Expense by cost center" },
  { id: "profit", name: "Profit Center Reports", desc: "Profit by center / division" },
];

export const IMPORT_SOURCES = ["Excel", "Tally", "Busy", "Zoho Books"];

/** AI COA templates — counts generated per business type. */
export const BUSINESS_TYPES = ["Grocery", "Pharmacy", "Textile", "Electronics", "Wholesale"];
export const AI_GENERATED = [
  { label: "Account Groups", count: 19 },
  { label: "Sales Accounts", count: 4 },
  { label: "Purchase Accounts", count: 3 },
  { label: "Inventory Accounts", count: 2 },
  { label: "GST Accounts", count: 8 },
  { label: "Expense Accounts", count: 12 },
  { label: "Bank Accounts", count: 1 },
];

export const COA_STATS = {
  groups: ACCOUNT_GROUPS.length,
  ledgers: LEDGERS.length,
  gst: GST_LEDGERS.length,
  cost: COST_CENTERS.length,
  profit: PROFIT_CENTERS.length,
  banks: BANKS.length,
};
