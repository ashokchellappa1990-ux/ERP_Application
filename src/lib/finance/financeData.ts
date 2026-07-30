import {
  LayoutDashboard, CalendarRange, Workflow, BookOpen, ScrollText, NotebookPen,
  HandCoins, AlertCircle, Wallet, Landmark, GitCompareArrows, Coins, ReceiptText,
  Repeat, Target, Building, PieChart, Boxes, TrendingDown, Receipt, FileMinus2, Banknote,
  FileCheck2, FileText, Truck, Lock, Building2, ShieldCheck, BarChart3, FileBarChart,
  Sparkles, type LucideIcon,
} from "lucide-react";
import { fin, finFlag } from "./financeConfig";

/* ===================================================== feature catalog == */
export interface FinFeature { key: string; label: string; href: string; icon: LucideIcon; desc: string; group: string }
export const FINANCE_FEATURES: FinFeature[] = [
  { key: "dashboard", label: "Finance Dashboard", href: "/finance", icon: LayoutDashboard, desc: "Cash, bank, AR/AP, P&L at a glance.", group: "Overview" },
  { key: "period", label: "Financial Period", href: "/accounting/financial-period", icon: CalendarRange, desc: "FY, period open/close & locks.", group: "Overview" },
  { key: "rule-engine", label: "Accounting Rule Engine", href: "/accounting/rule-engine", icon: Workflow, desc: "Auto-journals for ERP transactions.", group: "Overview" },
  { key: "coa", label: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: BookOpen, desc: "Ledger account hierarchy.", group: "Ledgers" },
  { key: "gl", label: "General Ledger", href: "/finance/gl", icon: ScrollText, desc: "Account / sub / branch ledgers.", group: "Ledgers" },
  { key: "journal", label: "Journal Entry", href: "/finance/journal", icon: NotebookPen, desc: "Manual / adjustment / reversal.", group: "Ledgers" },
  { key: "receivables", label: "Receivables", href: "/finance/receivables", icon: HandCoins, desc: "Customer outstanding & collections.", group: "Working Capital" },
  { key: "payables", label: "Payables", href: "/finance/payables", icon: AlertCircle, desc: "Supplier dues & settlement.", group: "Working Capital" },
  { key: "cash", label: "Cash Management", href: "/finance/cash", icon: Wallet, desc: "Receipts, payments, day open/close.", group: "Treasury" },
  { key: "bank", label: "Bank Management", href: "/finance/bank", icon: Landmark, desc: "Accounts, deposits, charges.", group: "Treasury" },
  { key: "bank-recon", label: "Bank Reconciliation", href: "/finance/bank-recon", icon: GitCompareArrows, desc: "Statement match & exceptions.", group: "Treasury" },
  { key: "deposit", label: "Cash Deposit", href: "/finance/deposit", icon: Banknote, desc: "Deposit cash, cheques & settlements to bank.", group: "Treasury" },
  { key: "petty-cash", label: "Petty Cash", href: "/finance/petty-cash", icon: Coins, desc: "Allocation & reimbursement.", group: "Treasury" },
  { key: "expense", label: "Expense Management", href: "/finance/expense", icon: ReceiptText, desc: "One-time & recurring expenses.", group: "Income & Expense" },
  { key: "recurring-income", label: "Recurring Income", href: "/finance/recurring-income", icon: Repeat, desc: "Rent, AMC, subscriptions.", group: "Income & Expense" },
  { key: "recurring-expense", label: "Recurring Expense", href: "/finance/recurring-expense", icon: Repeat, desc: "Rent, EMI, subscriptions.", group: "Income & Expense" },
  { key: "budget", label: "Budget Management", href: "/finance/budget", icon: Target, desc: "Budget vs actual & variance.", group: "Control" },
  { key: "cost-center", label: "Cost Center", href: "/finance/cost-center", icon: Building, desc: "Dept / branch / project cost.", group: "Control" },
  { key: "profit-center", label: "Profit Center", href: "/finance/profit-center", icon: PieChart, desc: "Profitability by dimension.", group: "Control" },
  { key: "fixed-asset", label: "Fixed Assets", href: "/finance/fixed-asset", icon: Boxes, desc: "Asset register & life.", group: "Assets" },
  { key: "depreciation", label: "Depreciation", href: "/finance/depreciation", icon: TrendingDown, desc: "SLM / WDV auto-posting.", group: "Assets" },
  { key: "gst", label: "GST Management", href: "/finance/gst", icon: Receipt, desc: "GSTR-1/2B/3B/9 & reconcile.", group: "Taxation" },
  { key: "tds", label: "TDS Management", href: "/finance/tds", icon: FileMinus2, desc: "Deduction, payment, returns.", group: "Taxation" },
  { key: "tcs", label: "TCS Management", href: "/finance/tcs", icon: FileCheck2, desc: "Collection, payment, returns.", group: "Taxation" },
  { key: "einvoice", label: "E-Invoice", href: "/finance/einvoice", icon: FileText, desc: "IRN & QR generation.", group: "Taxation" },
  { key: "eway", label: "E-Way Bill", href: "/finance/eway", icon: Truck, desc: "E-way bill & validity.", group: "Taxation" },
  { key: "closing", label: "Financial Closing", href: "/finance/closing", icon: Lock, desc: "Daily/monthly/year close.", group: "Period" },
  { key: "multi-branch", label: "Multi-Branch Accounting", href: "/finance/multi-branch", icon: Building2, desc: "Branch & consolidated books.", group: "Period" },
  { key: "audit", label: "Audit Management", href: "/finance/audit", icon: ShieldCheck, desc: "Change & approval trail.", group: "Governance" },
  { key: "ai", label: "AI Finance Engine", href: "/finance/ai", icon: Sparkles, desc: "Forecasts, alerts, optimisation.", group: "Insights" },
  { key: "analytics", label: "Finance Analytics", href: "/finance/analytics", icon: BarChart3, desc: "Trends & ratios.", group: "Insights" },
  { key: "reports", label: "Financial Reports", href: "/finance/reports", icon: FileBarChart, desc: "TB, P&L, Balance Sheet & more.", group: "Insights" },
];

/* ===================================================== dashboard ======= */
export const FINANCE_STATS = {
  cash: 480000, bank: 6240000, receivable: 1860000, payable: 2640000,
  revenue: 4820000, expense: 1640000, recurringIncome: 320000, recurringExpense: 280000,
  gstLiability: 184000, workingCapital: 3920000, netProfit: 1340000,
};
export const PL_TREND = [
  { m: "Jan", rev: 72, exp: 41 }, { m: "Feb", rev: 68, exp: 39 }, { m: "Mar", rev: 84, exp: 46 },
  { m: "Apr", rev: 78, exp: 44 }, { m: "May", rev: 92, exp: 48 }, { m: "Jun", rev: 100, exp: 52 },
];

/* ============================================== accounting rule engine ==
 * This table is the human-readable MIRROR of the actual double-entry posting
 * code. It documents, per transaction, the exact Dr/Cr ledger accounts (with
 * Chart-of-Accounts codes) that the system posts. It is reference/audit data —
 * posting itself is done in code (see the source functions named below), NOT
 * driven by this table.
 *
 * `wired: true`  → the transaction IS auto-posted to the GL by the system today.
 * `wired: false` → documented mapping only; no auto-posting is wired yet (Planned).
 *
 * MAINTENANCE CONVENTION — when a new posting is added or an account changes in
 * the code, update the matching row here so the Rule Engine stays truthful:
 *   • Sales / Sales Return / Receipt / Supplier Payment / Purchase / Purchase
 *     Return / Loyalty  → src/lib/accounting/post.ts
 *   • Account codes/names                                   → src/lib/accounting/accounts.ts (ACC / SYSTEM_ACCOUNTS)
 *   • Advances (customer/supplier/employee, settle, refund) → src/lib/advance/engine.ts
 *   • Gift vouchers (sell / redeem)                         → src/lib/giftVoucher/service.ts
 *   • Coupons / Promo codes                                 → src/lib/coupon/service.ts
 *   • Membership fee                                        → src/lib/membership/registration.ts
 *   • Income Receipt Transaction                            → src/lib/finance/receipt.ts
 *   • Business / Petty-cash Expense                         → src/app/api/finance/petty-cash/route.ts
 *   • Recurring expense / income                            → src/lib/finance/recurring.ts
 *   • Statutory (GST/TDS/TCS) government payment            → src/lib/finance/statutory/service.ts
 *   • Sales Cancellation (full reversal)                    → src/lib/sales/postCancellation.ts
 */
export interface AcctRule { txn: string; dr: string; cr: string; wired?: boolean }
export interface RuleGroup { module: string; autoFlag: string; rules: AcctRule[] }
export const ACCOUNTING_RULES: RuleGroup[] = [
  { module: "Sales", autoFlag: "autoPostSales", rules: [
    { txn: "Sales Invoice (POS / B2B)", dr: "Cash 1000 / Bank 1010 / Receivable 1100 + COGS 4000", cr: "Sales 3000 + Output GST 2100 + Inventory 1200 (+ TCS 2110, ± Round Off 5000)", wired: true },
    { txn: "Bill Discount / Loyalty / Coupon / Promo (on invoice)", dr: "Discount Allowed 3060 / Loyalty Expense 4400 / Marketing 4210", cr: "reduces Cash 1000 / Receivable 1100", wired: true },
    { txn: "Customer Advance applied on invoice", dr: "Advance from Customers 2150", cr: "reduces Receivable 1100", wired: true },
    { txn: "TDS deducted by customer", dr: "TDS Receivable 1310", cr: "reduces Receivable 1100", wired: true },
    { txn: "Gift Voucher tendered as payment", dr: "Gift Voucher Liability 2140", cr: "part of invoice receipt", wired: true },
    { txn: "Sales Return", dr: "Sales Returns 3050 + Output GST 2100 + Inventory 1200", cr: "Cash 1000 / Bank 1010 / Store Credit 2105 + COGS 4000", wired: true },
    { txn: "Sales Return — damaged / scrap write-off", dr: "Indirect Expenses 4200", cr: "Inventory 1200", wired: true },
    { txn: "Sales Cancellation", dr: "Full reversal of the original Sales voucher", cr: "(Dr/Cr of the original entry swapped)", wired: true },
    { txn: "Customer Collection (Receipt)", dr: "Cash 1000 / Bank 1010", cr: "Accounts Receivable 1100", wired: true },
  ] },
  { module: "Purchase", autoFlag: "autoPostPurchase", rules: [
    { txn: "GRN — goods received (no invoice)", dr: "Inventory 1200 (landed cost)", cr: "GRN Clearing 2050", wired: true },
    { txn: "GRN — with supplier invoice", dr: "Inventory 1200 + Input GST 1300", cr: "Cash 1000 / Bank 1010 + Accounts Payable 2000", wired: true },
    { txn: "Purchase Invoice (Inventory / Service / Expense / Asset)", dr: "Inventory 1200 / Service 4300 / Expense 4200 / Fixed Asset 1500 + Input GST 1300", cr: "Accounts Payable 2000", wired: true },
    { txn: "Purchase Return", dr: "Accounts Payable 2000", cr: "Inventory 1200 / Service 4300 / Expense 4200 / Fixed Asset 1500 + Input GST 1300 reversed", wired: true },
    { txn: "Supplier Payment", dr: "Accounts Payable 2000", cr: "Cash 1000 / Bank 1010", wired: true },
  ] },
  { module: "Finance (Expense / Income)", autoFlag: "autoPostBank", rules: [
    { txn: "Business / Petty-Cash Expense — Pay Now", dr: "Expense head (mapped, e.g. 4200) + Input GST 1300 + TCS Receivable 1320", cr: "Cash 1000 / Bank 1010 + TDS Payable 2120", wired: true },
    { txn: "Business Expense — On Credit", dr: "Expense head + Input GST 1300", cr: "Accounts Payable 2000 + TDS Payable 2120", wired: true },
    { txn: "Recurring Expense", dr: "Expense head + Input GST 1300 + TCS Receivable 1320", cr: "Cash 1000 (pay now) / Accounts Payable 2000 + TDS Payable 2120", wired: true },
    { txn: "Recurring Income", dr: "Cash 1000 / Receivable 1100", cr: "Income head (e.g. Misc 3200) + Output GST 2100", wired: true },
    { txn: "Manual Journal", dr: "As entered", cr: "As entered", wired: true },
  ] },
  { module: "Receipts", autoFlag: "autoPostBank", rules: [
    { txn: "Income Receipt (Rent / Commission / Interest / Scrap / Misc …)", dr: "Cash 1000 / Bank 1010 (+ TDS Receivable 1310)", cr: "Income head (Rent 3210 / Commission 3220 / Interest 3230 / Scrap 3240 / Misc 3200) + Output GST 2100 (+ TCS 2110)", wired: true },
  ] },
  { module: "Advances & Deposits", autoFlag: "autoPostBank", rules: [
    { txn: "Customer Advance received", dr: "Cash 1000 / Bank 1010", cr: "Advance from Customers 2150", wired: true },
    { txn: "Supplier Advance paid", dr: "Advance to Suppliers 1150", cr: "Cash 1000 / Bank 1010", wired: true },
    { txn: "Employee Advance paid", dr: "Advance to Employees 1160", cr: "Cash 1000 / Bank 1010", wired: true },
    { txn: "Security Deposit (received / paid)", dr: "Security Deposits Paid 1170 / Cash / Bank", cr: "Security Deposits Received 2160 / Cash / Bank", wired: true },
    { txn: "Advance Settlement — Customer", dr: "Advance from Customers 2150", cr: "Accounts Receivable 1100", wired: true },
    { txn: "Advance Settlement — Supplier", dr: "Accounts Payable 2000", cr: "Advance to Suppliers 1150", wired: true },
    { txn: "Advance Refund", dr: "Advance control ↔ Cash / Bank (reversed)", cr: "Advance control ↔ Cash / Bank (reversed)", wired: true },
  ] },
  { module: "Rewards & Loyalty", autoFlag: "autoPostSales", rules: [
    { txn: "Loyalty Points earned", dr: "Loyalty Points Expense 4400", cr: "Loyalty Points Liability 2130", wired: true },
    { txn: "Loyalty Points redeemed / reversed", dr: "Loyalty Points Liability 2130", cr: "Loyalty Points Expense 4400", wired: true },
    { txn: "Gift Voucher sold", dr: "Cash 1000 / Bank 1010", cr: "Gift Voucher Liability 2140 + Output GST 2100", wired: true },
    { txn: "Gift Voucher redeemed", dr: "Gift Voucher Liability 2140", cr: "Sales Revenue 3000", wired: true },
    { txn: "Coupon / Promo Code redeemed", dr: "Marketing & Promotion 4210", cr: "Discount Allowed 3060", wired: true },
    { txn: "Membership fee", dr: "Cash 1000 / Bank 1010", cr: "Membership Income 3210 + Output GST 2100", wired: true },
  ] },
  { module: "Taxation", autoFlag: "autoPostTax", rules: [
    { txn: "Output GST on sales", dr: "(part of Sales receipt)", cr: "Output GST Payable 2100", wired: true },
    { txn: "Input GST (ITC) on purchase / expense", dr: "Input GST 1300", cr: "(part of Purchase / Expense)", wired: true },
    { txn: "TDS deducted on expense bill", dr: "(Expense / Payable)", cr: "TDS Payable 2120", wired: true },
    { txn: "TCS collected on sale", dr: "(Receivable / Cash)", cr: "TCS Payable 2110", wired: true },
    { txn: "GST / TDS / TCS government payment", dr: "GST 2100 / TDS Payable 2120 / TCS Payable 2110 + Interest & Penalty 4250", cr: "Cash 1000 / Bank 1010", wired: true },
  ] },
  { module: "Assets", autoFlag: "autoPostDepreciation", rules: [
    { txn: "Asset Purchase (via Purchase — type Asset)", dr: "Fixed Assets 1500 + Input GST 1300", cr: "Accounts Payable 2000 / Bank 1010", wired: true },
    { txn: "Asset Disposal", dr: "Bank / Accumulated Depreciation / Loss on Sale", cr: "Fixed Asset / Profit on Sale", wired: false },
    { txn: "Depreciation", dr: "Depreciation Expense", cr: "Accumulated Depreciation", wired: false },
  ] },
  { module: "Inventory", autoFlag: "autoPostInventory", rules: [
    { txn: "Stock Adjustment (gain)", dr: "Inventory", cr: "Stock Adjustment (P&L)", wired: false },
    { txn: "Stock Adjustment (loss)", dr: "Stock Adjustment (P&L)", cr: "Inventory", wired: false },
    { txn: "Stock Transfer (branch → branch)", dr: "Inventory (In-Transit)", cr: "Inventory (Source)", wired: false },
    { txn: "Stock Write-Off", dr: "Inventory Write-Off (P&L)", cr: "Inventory", wired: false },
    { txn: "Inventory Revaluation", dr: "Inventory / Revaluation", cr: "Revaluation / Inventory", wired: false },
  ] },
  { module: "Banking", autoFlag: "autoPostBank", rules: [
    { txn: "Bank Charges", dr: "Bank Charges (P&L)", cr: "Bank 1010", wired: false },
    { txn: "Interest Income", dr: "Bank 1010", cr: "Interest Income 3230", wired: false },
    { txn: "Interest Expense", dr: "Interest Expense", cr: "Bank / Loan", wired: false },
  ] },
  { module: "Payroll", autoFlag: "autoPostPayroll", rules: [
    { txn: "Salary Processing", dr: "Salary Expense", cr: "Salary Payable + TDS + PF/ESI", wired: false },
    { txn: "Employee Reimbursement", dr: "Reimbursement Expense", cr: "Cash / Bank", wired: false },
  ] },
];

/* ============================================= per-feature list config == */
export interface FColumn { key: string; label: string; align?: "right" | "center"; kind?: "status" | "amount" | "badge" }
export interface FKpi { label: string; value: string; tone: "primary" | "secondary" | "success" | "warning" | "danger" | "accent" }
export interface FinListConfig { title: string; desc: string; newLabel?: string; kpis: FKpi[]; columns: FColumn[]; statuses: string[]; rows: Record<string, string | number>[] }

const amt = (key: string, label: string): FColumn => ({ key, label, align: "right", kind: "amount" });
const st: FColumn = { key: "status", label: "Status", align: "center", kind: "status" };

export const FINANCE_LISTS: Record<string, FinListConfig> = {
  period: { title: "Financial Period", desc: "Financial year, periods, open/close & locks.",
    kpis: [{ label: "Current Period", value: "Jun 2026", tone: "primary" }, { label: "Open Periods", value: "3", tone: "success" }, { label: "Locked", value: "9", tone: "warning" }, { label: "FY", value: "26-27", tone: "secondary" }],
    columns: [{ key: "period", label: "Period" }, { key: "from", label: "From" }, { key: "to", label: "To" }, { key: "type", label: "Type", align: "center", kind: "badge" }, st],
    statuses: ["Open", "Soft-Closed", "Locked", "Audit-Locked"],
    rows: [
      { period: "Jun 2026", from: "01-Jun", to: "30-Jun", type: "Monthly", status: "Open" },
      { period: "May 2026", from: "01-May", to: "31-May", type: "Monthly", status: "Soft-Closed" },
      { period: "Apr 2026", from: "01-Apr", to: "30-Apr", type: "Monthly", status: "Locked" },
      { period: "Q4 FY25-26", from: "01-Jan", to: "31-Mar", type: "Quarterly", status: "Audit-Locked" },
    ] },
  coa: { title: "Chart of Accounts", desc: "Ledger account hierarchy across all groups.", newLabel: "New Account",
    kpis: [{ label: "Accounts", value: "486", tone: "primary" }, { label: "Groups", value: "32", tone: "secondary" }, { label: "Active", value: "470", tone: "success" }, { label: "System", value: "64", tone: "accent" }],
    columns: [{ key: "code", label: "Code" }, { key: "name", label: "Account" }, { key: "group", label: "Group" }, { key: "type", label: "Type", align: "center", kind: "badge" }, amt("balance", "Balance"), st],
    statuses: ["Active", "Inactive"],
    rows: [
      { code: "1200", name: "Inventory Asset", group: "Current Assets", type: "Asset", balance: 20170000, status: "Active" },
      { code: "1100", name: "Sundry Debtors", group: "Current Assets", type: "Asset", balance: 1860000, status: "Active" },
      { code: "2100", name: "Sundry Creditors", group: "Current Liabilities", type: "Liability", balance: 2640000, status: "Active" },
      { code: "4000", name: "Sales", group: "Revenue", type: "Income", balance: 4820000, status: "Active" },
      { code: "5000", name: "Purchases", group: "Direct Cost", type: "Expense", balance: 3260000, status: "Active" },
      { code: "2300", name: "Output GST Payable", group: "Duties & Taxes", type: "Liability", balance: 184000, status: "Active" },
    ] },
  gl: { title: "General Ledger", desc: "Account, sub, branch & cost-center ledgers.",
    kpis: [{ label: "Ledgers", value: "486", tone: "primary" }, { label: "Postings (MTD)", value: "8,420", tone: "secondary" }, { label: "Auto-Posted", value: "98%", tone: "success" }, { label: "Unposted", value: "12", tone: "warning" }],
    columns: [{ key: "date", label: "Date" }, { key: "account", label: "Account" }, { key: "ref", label: "Voucher" }, amt("debit", "Debit"), amt("credit", "Credit"), amt("balance", "Balance")],
    statuses: ["Posted", "Draft"],
    rows: [
      { date: "15-Jun", account: "Sundry Debtors", ref: "INV-WS/0286", debit: 142000, credit: 0, balance: 1860000, status: "Posted" },
      { date: "15-Jun", account: "Sales", ref: "INV-WS/0286", debit: 0, credit: 120339, balance: 4820000, status: "Posted" },
      { date: "15-Jun", account: "Output GST Payable", ref: "INV-WS/0286", debit: 0, credit: 21661, balance: 184000, status: "Posted" },
      { date: "14-Jun", account: "Bank - HDFC", ref: "RCT/0512", debit: 142000, credit: 0, balance: 6240000, status: "Posted" },
    ] },
  journal: { title: "Journal Entry", desc: "Manual, adjustment, opening, closing & reversal journals.", newLabel: "New Journal",
    kpis: [{ label: "Journals (MTD)", value: "64", tone: "primary" }, { label: "Pending Approval", value: "5", tone: "warning" }, { label: "Auto vs Manual", value: "92:8", tone: "secondary" }, { label: "Reversals", value: "3", tone: "danger" }],
    columns: [{ key: "no", label: "JV No." }, { key: "date", label: "Date" }, { key: "narration", label: "Narration" }, { key: "type", label: "Type", align: "center", kind: "badge" }, amt("amount", "Amount"), st],
    statuses: ["Draft", "Pending Approval", "Posted", "Reversed"],
    rows: [
      { no: "JV/CHN/26-27/0064", date: "15-Jun", narration: "Provision for rent", type: "Adjustment", amount: 85000, status: "Pending Approval" },
      { no: "JV/CHN/26-27/0063", date: "14-Jun", narration: "Bank charges", type: "Manual", amount: 1180, status: "Posted" },
      { no: "JV/CHN/26-27/0062", date: "13-Jun", narration: "Depreciation Jun", type: "Adjustment", amount: 124000, status: "Posted" },
    ] },
  receivables: { title: "Receivables", desc: "Customer outstanding, due & overdue, collection performance.",
    kpis: [{ label: "Total AR", value: "₹18.6L", tone: "danger" }, { label: "Overdue", value: "₹6.2L", tone: "warning" }, { label: "Due This Week", value: "₹3.1L", tone: "primary" }, { label: "Avg Days (DSO)", value: "27", tone: "secondary" }],
    columns: [{ key: "customer", label: "Customer" }, amt("total", "Outstanding"), amt("overdue", "Overdue"), { key: "dso", label: "Days", align: "center" }, { key: "limit", label: "Limit Use", align: "center", kind: "badge" }, st],
    statuses: ["Current", "Due Soon", "Overdue", "Critical"],
    rows: [
      { customer: "Crescent Pharma", total: 218400, overdue: 218400, dso: 64, limit: "104%", status: "Critical" },
      { customer: "Sri Balaji Traders", total: 142000, overdue: 0, dso: 8, limit: "62%", status: "Current" },
      { customer: "MGB Hardware", total: 56800, overdue: 56800, dso: 41, limit: "48%", status: "Overdue" },
    ] },
  payables: { title: "Payables", desc: "Supplier outstanding, due payments & aging.",
    kpis: [{ label: "Total AP", value: "₹26.4L", tone: "danger" }, { label: "Overdue", value: "₹2.1L", tone: "warning" }, { label: "Due This Week", value: "₹4.6L", tone: "primary" }, { label: "Avg Days (DPO)", value: "32", tone: "secondary" }],
    columns: [{ key: "supplier", label: "Supplier" }, amt("total", "Outstanding"), amt("overdue", "Overdue"), { key: "dpo", label: "Days", align: "center" }, { key: "terms", label: "Terms", align: "center", kind: "badge" }, st],
    statuses: ["Current", "Due Soon", "Overdue"],
    rows: [
      { supplier: "Hindustan Unilever Ltd", total: 840000, overdue: 0, dpo: 12, terms: "Net 30", status: "Current" },
      { supplier: "Crescent Pharma Dist.", total: 312000, overdue: 312000, dpo: 52, terms: "Net 45", status: "Overdue" },
      { supplier: "ITC Distributors", total: 218400, overdue: 0, dpo: 9, terms: "Net 15", status: "Due Soon" },
    ] },
  cash: { title: "Cash Management", desc: "Cash receipts, payments, transfers, day open/close.", newLabel: "New Voucher",
    kpis: [{ label: "Cash Balance", value: "₹4.8L", tone: "success" }, { label: "Receipts Today", value: "₹2.4L", tone: "primary" }, { label: "Payments Today", value: "₹64k", tone: "warning" }, { label: "Day Status", value: "Open", tone: "secondary" }],
    columns: [{ key: "no", label: "Voucher" }, { key: "type", label: "Type", align: "center", kind: "badge" }, { key: "party", label: "Party / Head" }, amt("amount", "Amount"), { key: "mode", label: "Mode", align: "center", kind: "badge" }, st],
    statuses: ["Posted", "Pending", "Verified"],
    rows: [
      { no: "RCT/0512", type: "Receipt", party: "Sri Balaji Traders", amount: 142000, mode: "Cash", status: "Posted" },
      { no: "PMT/0188", type: "Payment", party: "Electricity Board", amount: 24000, mode: "Cash", status: "Posted" },
      { no: "DEP/0044", type: "Deposit", party: "HDFC Bank", amount: 200000, mode: "Cash", status: "Verified" },
    ] },
  bank: { title: "Bank Management", desc: "Bank accounts, deposits, withdrawals, charges & interest.", newLabel: "New Bank Txn",
    kpis: [{ label: "Bank Balance", value: "₹62.4L", tone: "success" }, { label: "Accounts", value: "4", tone: "primary" }, { label: "Charges (MTD)", value: "₹4.2k", tone: "warning" }, { label: "Interest (MTD)", value: "₹8.6k", tone: "secondary" }],
    columns: [{ key: "bank", label: "Account" }, { key: "type", label: "Type", align: "center", kind: "badge" }, amt("balance", "Balance"), amt("inflow", "Inflow"), amt("outflow", "Outflow"), st],
    statuses: ["Active", "Inactive"],
    rows: [
      { bank: "HDFC - Current ••4521", type: "Current", balance: 4820000, inflow: 2840000, outflow: 1640000, status: "Active" },
      { bank: "ICICI - Current ••8890", type: "Current", balance: 1140000, inflow: 640000, outflow: 420000, status: "Active" },
      { bank: "SBI - OD ••1122", type: "Overdraft", balance: 280000, inflow: 120000, outflow: 96000, status: "Active" },
    ] },
  "bank-recon": { title: "Bank Reconciliation", desc: "Match book vs statement — auto-match & exceptions.", newLabel: "Import Statement",
    kpis: [{ label: "Unreconciled", value: "18", tone: "warning" }, { label: "Auto-Matched", value: "96%", tone: "success" }, { label: "Exceptions", value: "4", tone: "danger" }, { label: "Last Synced", value: "Today", tone: "secondary" }],
    columns: [{ key: "date", label: "Date" }, { key: "particulars", label: "Particulars" }, amt("book", "Book"), amt("statement", "Statement"), { key: "match", label: "Match", align: "center", kind: "badge" }, st],
    statuses: ["Matched", "Unmatched", "Exception"],
    rows: [
      { date: "14-Jun", particulars: "NEFT - Sri Balaji", book: 142000, statement: 142000, match: "Auto", status: "Matched" },
      { date: "13-Jun", particulars: "Cheque 100231", book: 56800, statement: 0, match: "—", status: "Unmatched" },
      { date: "12-Jun", particulars: "Bank charges", book: 0, statement: 1180, match: "—", status: "Exception" },
    ] },
  deposit: { title: "Cash Deposit", desc: "Deposit collected cash, cheques & settlements to the bank.", newLabel: "New Deposit",
    kpis: [{ label: "Deposited (MTD)", value: "₹28.6L", tone: "success" }, { label: "Cash in Hand", value: "₹4.8L", tone: "primary" }, { label: "Cheques in Hand", value: "₹1.2L", tone: "warning" }, { label: "Pending Clearance", value: "₹86k", tone: "danger" }],
    columns: [{ key: "no", label: "Deposit Slip" }, { key: "bank", label: "To Bank" }, { key: "date", label: "Date" }, amt("cash", "Cash"), amt("cheque", "Cheques"), amt("total", "Total"), st],
    statuses: ["Draft", "Deposited", "Cleared", "Bounced"],
    rows: [
      { no: "DEP/CHN/26-27/0044", bank: "HDFC ••4521", date: "15-Jun", cash: 200000, cheque: 142000, total: 342000, status: "Deposited" },
      { no: "DEP/CHN/26-27/0043", bank: "ICICI ••8890", date: "14-Jun", cash: 64000, cheque: 0, total: 64000, status: "Cleared" },
      { no: "DEP/CHN/26-27/0042", bank: "HDFC ••4521", date: "12-Jun", cash: 0, cheque: 56800, total: 56800, status: "Bounced" },
    ] },
  "petty-cash": { title: "Petty Cash", desc: "Imprest allocation, utilisation & reimbursement.", newLabel: "New Petty Voucher",
    kpis: [{ label: "Imprest", value: "₹50k", tone: "primary" }, { label: "Spent (MTD)", value: "₹32k", tone: "warning" }, { label: "Balance", value: "₹18k", tone: "success" }, { label: "Pending Reimburse", value: "₹6k", tone: "danger" }],
    columns: [{ key: "no", label: "Voucher" }, { key: "head", label: "Expense Head" }, { key: "by", label: "Spent By" }, amt("amount", "Amount"), st],
    statuses: ["Submitted", "Approved", "Reimbursed", "Rejected"],
    rows: [
      { no: "PC/0231", head: "Office Supplies", by: "admin.meena", amount: 1240, status: "Approved" },
      { no: "PC/0230", head: "Courier", by: "store.ravi", amount: 480, status: "Reimbursed" },
      { no: "PC/0229", head: "Refreshments", by: "admin.meena", amount: 860, status: "Submitted" },
    ] },
  expense: { title: "Expense Management", desc: "One-time & recurring expenses with document upload.", newLabel: "New Expense",
    kpis: [{ label: "Expenses (MTD)", value: "₹16.4L", tone: "primary" }, { label: "Pending Approval", value: "7", tone: "warning" }, { label: "Recurring", value: "₹2.8L", tone: "secondary" }, { label: "Top Head", value: "Rent", tone: "accent" }],
    columns: [{ key: "no", label: "Expense No." }, { key: "category", label: "Category" }, { key: "vendor", label: "Vendor" }, amt("amount", "Amount"), { key: "date", label: "Date" }, st],
    statuses: ["Draft", "Pending Approval", "Approved", "Paid"],
    rows: [
      { no: "EXP/0312", category: "Rent", vendor: "Prime Estates", amount: 185000, date: "01-Jun", status: "Paid" },
      { no: "EXP/0311", category: "Electricity", vendor: "TNEB", amount: 64000, date: "05-Jun", status: "Approved" },
      { no: "EXP/0310", category: "Marketing", vendor: "AdWorks", amount: 42000, date: "08-Jun", status: "Pending Approval" },
    ] },
  "recurring-income": { title: "Recurring Income", desc: "Rent, AMC, subscription & service income with auto-invoice.", newLabel: "New Recurring Income",
    kpis: [{ label: "Active Schedules", value: "18", tone: "primary" }, { label: "Monthly Value", value: "₹3.2L", tone: "success" }, { label: "Due This Week", value: "4", tone: "warning" }, { label: "Auto-Invoiced", value: "On", tone: "secondary" }],
    columns: [{ key: "no", label: "Schedule" }, { key: "type", label: "Income Type" }, { key: "customer", label: "Customer" }, { key: "freq", label: "Frequency", align: "center", kind: "badge" }, amt("amount", "Amount"), st],
    statuses: ["Active", "Paused", "Ended"],
    rows: [
      { no: "RI/0021", type: "Rent Income", customer: "Cafe Aroma", freq: "Monthly", amount: 45000, status: "Active" },
      { no: "RI/0020", type: "AMC Income", customer: "MGB Hardware", freq: "Quarterly", amount: 18000, status: "Active" },
      { no: "RI/0019", type: "Subscription", customer: "Lakshmi Mart", freq: "Monthly", amount: 2999, status: "Active" },
    ] },
  "recurring-expense": { title: "Recurring Expense", desc: "Rent, EMI, subscription & utilities with auto-voucher.", newLabel: "New Recurring Expense",
    kpis: [{ label: "Active Schedules", value: "22", tone: "primary" }, { label: "Monthly Value", value: "₹2.8L", tone: "warning" }, { label: "Due This Week", value: "6", tone: "danger" }, { label: "Auto-Posted", value: "On", tone: "secondary" }],
    columns: [{ key: "no", label: "Schedule" }, { key: "type", label: "Expense Type" }, { key: "vendor", label: "Vendor" }, { key: "freq", label: "Frequency", align: "center", kind: "badge" }, amt("amount", "Amount"), st],
    statuses: ["Active", "Paused", "Ended"],
    rows: [
      { no: "RE/0031", type: "Rent", vendor: "Prime Estates", freq: "Monthly", amount: 185000, status: "Active" },
      { no: "RE/0030", type: "Loan EMI", vendor: "HDFC Bank", freq: "Monthly", amount: 64000, status: "Active" },
      { no: "RE/0029", type: "Software Subscription", vendor: "Microsoft", freq: "Yearly", amount: 96000, status: "Active" },
    ] },
  budget: { title: "Budget Management", desc: "Budget vs actual & variance by org / branch / dept / category.", newLabel: "New Budget",
    kpis: [{ label: "Budget (FY)", value: "₹1.2Cr", tone: "primary" }, { label: "Actual (YTD)", value: "₹38.6L", tone: "secondary" }, { label: "Utilised", value: "32%", tone: "success" }, { label: "Over Budget", value: "2", tone: "danger" }],
    columns: [{ key: "head", label: "Budget Head" }, { key: "level", label: "Level", align: "center", kind: "badge" }, amt("budget", "Budget"), amt("actual", "Actual"), { key: "variance", label: "Variance %", align: "center" }, st],
    statuses: ["On Track", "Watch", "Over Budget"],
    rows: [
      { head: "Marketing", level: "Department", budget: 600000, actual: 420000, variance: "-30%", status: "On Track" },
      { head: "Chennai Branch", level: "Branch", budget: 2400000, actual: 2520000, variance: "+5%", status: "Over Budget" },
      { head: "Salaries", level: "Organization", budget: 4800000, actual: 2200000, variance: "-54%", status: "On Track" },
    ] },
  "cost-center": { title: "Cost Center", desc: "Track cost by department, branch & project.",
    kpis: [{ label: "Cost Centers", value: "14", tone: "primary" }, { label: "Cost (MTD)", value: "₹16.4L", tone: "warning" }, { label: "Top Center", value: "Operations", tone: "secondary" }, { label: "Unallocated", value: "₹42k", tone: "danger" }],
    columns: [{ key: "code", label: "Code" }, { key: "name", label: "Cost Center" }, { key: "type", label: "Type", align: "center", kind: "badge" }, amt("cost", "Cost (MTD)"), amt("budget", "Budget"), st],
    statuses: ["Active", "Inactive"],
    rows: [
      { code: "CC-OPS", name: "Operations", type: "Department", cost: 640000, budget: 700000, status: "Active" },
      { code: "CC-CHN", name: "Chennai Branch", type: "Branch", cost: 480000, budget: 500000, status: "Active" },
      { code: "CC-MKT", name: "Marketing", type: "Department", cost: 420000, budget: 600000, status: "Active" },
    ] },
  "profit-center": { title: "Profit Center", desc: "Profitability by branch, category, brand & project.",
    kpis: [{ label: "Profit Centers", value: "12", tone: "primary" }, { label: "Net Profit (MTD)", value: "₹13.4L", tone: "success" }, { label: "Best", value: "Grocery", tone: "secondary" }, { label: "Loss-making", value: "1", tone: "danger" }],
    columns: [{ key: "name", label: "Profit Center" }, { key: "type", label: "Type", align: "center", kind: "badge" }, amt("revenue", "Revenue"), amt("cost", "Cost"), amt("profit", "Profit"), { key: "margin", label: "Margin", align: "center" }],
    statuses: ["Profit", "Loss"],
    rows: [
      { name: "Grocery", type: "Category", revenue: 2840000, cost: 2180000, profit: 660000, margin: "23%", status: "Profit" },
      { name: "Chennai Branch", type: "Branch", revenue: 4820000, cost: 3480000, profit: 1340000, margin: "28%", status: "Profit" },
      { name: "Furniture", type: "Category", revenue: 320000, cost: 360000, profit: -40000, margin: "-13%", status: "Loss" },
    ] },
  "fixed-asset": { title: "Fixed Assets", desc: "Asset register — value, life & location.", newLabel: "New Asset",
    kpis: [{ label: "Assets", value: "148", tone: "primary" }, { label: "Gross Value", value: "₹84L", tone: "secondary" }, { label: "Net Value", value: "₹61L", tone: "success" }, { label: "Due Disposal", value: "6", tone: "warning" }],
    columns: [{ key: "code", label: "Asset Code" }, { key: "name", label: "Asset" }, { key: "category", label: "Category", align: "center", kind: "badge" }, amt("gross", "Gross"), amt("net", "Net (WDV)"), st],
    statuses: ["In Use", "Idle", "Disposed"],
    rows: [
      { code: "FA-0042", name: "Delivery Van - TN09", category: "Vehicle", gross: 1200000, net: 840000, status: "In Use" },
      { code: "FA-0041", name: "Billing PCs (×12)", category: "Computer", gross: 480000, net: 288000, status: "In Use" },
      { code: "FA-0040", name: "Cold Storage Unit", category: "Machinery", gross: 950000, net: 712500, status: "In Use" },
    ] },
  depreciation: { title: "Depreciation", desc: "SLM / WDV auto-calculation & journal posting.",
    kpis: [{ label: "Method", value: "SLM", tone: "primary" }, { label: "Depreciation (MTD)", value: "₹1.24L", tone: "warning" }, { label: "YTD", value: "₹3.7L", tone: "secondary" }, { label: "Auto-Posted", value: "On", tone: "success" }],
    columns: [{ key: "asset", label: "Asset" }, { key: "method", label: "Method", align: "center", kind: "badge" }, { key: "rate", label: "Rate", align: "center" }, amt("opening", "Opening WDV"), amt("dep", "Depreciation"), amt("closing", "Closing WDV")],
    statuses: ["Posted", "Pending"],
    rows: [
      { asset: "Delivery Van - TN09", method: "WDV", rate: "15%", opening: 840000, dep: 10500, closing: 829500, status: "Posted" },
      { asset: "Billing PCs (×12)", method: "SLM", rate: "33%", opening: 288000, dep: 13200, closing: 274800, status: "Posted" },
      { asset: "Cold Storage Unit", method: "SLM", rate: "10%", opening: 712500, dep: 7917, closing: 704583, status: "Pending" },
    ] },
  tds: { title: "TDS Management", desc: "TDS deduction, payment, certificates & returns.", newLabel: "New TDS Entry",
    kpis: [{ label: "Deducted (MTD)", value: "₹84k", tone: "primary" }, { label: "Payable", value: "₹84k", tone: "danger" }, { label: "Paid (YTD)", value: "₹2.4L", tone: "success" }, { label: "Due Date", value: "07-Jul", tone: "warning" }],
    columns: [{ key: "section", label: "Section" }, { key: "deductee", label: "Deductee" }, amt("base", "Base"), { key: "rate", label: "Rate", align: "center" }, amt("tds", "TDS"), st],
    statuses: ["Deducted", "Paid", "Return Filed"],
    rows: [
      { section: "194C", deductee: "AdWorks (Contractor)", base: 42000, rate: "2%", tds: 840, status: "Deducted" },
      { section: "194J", deductee: "Auditor & Co.", base: 60000, rate: "10%", tds: 6000, status: "Paid" },
      { section: "194I", deductee: "Prime Estates (Rent)", base: 185000, rate: "10%", tds: 18500, status: "Deducted" },
    ] },
  tcs: { title: "TCS Management", desc: "TCS collection, payment & returns.", newLabel: "New TCS Entry",
    kpis: [{ label: "Collected (MTD)", value: "₹46k", tone: "primary" }, { label: "Payable", value: "₹46k", tone: "danger" }, { label: "Paid (YTD)", value: "₹1.8L", tone: "success" }, { label: "Due Date", value: "07-Jul", tone: "warning" }],
    columns: [{ key: "section", label: "Section" }, { key: "buyer", label: "Buyer" }, amt("base", "Base"), { key: "rate", label: "Rate", align: "center" }, amt("tcs", "TCS"), st],
    statuses: ["Collected", "Paid", "Return Filed"],
    rows: [
      { section: "206C(1H)", buyer: "Sri Balaji Traders", base: 4200000, rate: "0.1%", tcs: 4200, status: "Collected" },
      { section: "206C(1H)", buyer: "MGB Hardware", base: 1800000, rate: "0.1%", tcs: 1800, status: "Paid" },
    ] },
  einvoice: { title: "E-Invoice", desc: "IRN & QR generation, cancellation & status.",
    kpis: [{ label: "Generated (MTD)", value: "286", tone: "primary" }, { label: "Success", value: "100%", tone: "success" }, { label: "Cancelled", value: "3", tone: "warning" }, { label: "Pending", value: "0", tone: "secondary" }],
    columns: [{ key: "invoice", label: "Invoice" }, { key: "irn", label: "IRN" }, { key: "customer", label: "Customer" }, amt("value", "Value"), st],
    statuses: ["Generated", "Cancelled", "Pending"],
    rows: [
      { invoice: "INV-WS/0286", irn: "a1b2…f9e8", customer: "Sri Balaji Traders", value: 142000, status: "Generated" },
      { invoice: "INV-WS/0285", irn: "c3d4…1234", customer: "MGB Hardware", value: 56800, status: "Generated" },
      { invoice: "INV-WS/0279", irn: "—", customer: "Crescent Pharma", value: 218400, status: "Cancelled" },
    ] },
  eway: { title: "E-Way Bill", desc: "E-way bill & consolidated bill, validity & vehicle.",
    kpis: [{ label: "Active", value: "42", tone: "primary" }, { label: "Expiring Soon", value: "5", tone: "warning" }, { label: "Generated (MTD)", value: "184", tone: "success" }, { label: "Cancelled", value: "2", tone: "danger" }],
    columns: [{ key: "ewb", label: "EWB No." }, { key: "invoice", label: "Invoice" }, { key: "vehicle", label: "Vehicle" }, amt("value", "Value"), { key: "valid", label: "Valid Till" }, st],
    statuses: ["Active", "Expiring", "Expired", "Cancelled"],
    rows: [
      { ewb: "EWB-3310…", invoice: "INV-WS/0286", vehicle: "TN09 AB 1234", value: 142000, valid: "17-Jun", status: "Active" },
      { ewb: "EWB-3309…", invoice: "INV-WS/0285", vehicle: "TN09 CD 5678", value: 56800, valid: "16-Jun", status: "Expiring" },
    ] },
  closing: { title: "Financial Closing", desc: "Daily / monthly / quarterly / annual close with checklist.",
    kpis: [{ label: "Last Close", value: "May 2026", tone: "secondary" }, { label: "Open Tasks", value: "8", tone: "warning" }, { label: "Checklist", value: "12 items", tone: "primary" }, { label: "Approval", value: "Pending", tone: "danger" }],
    columns: [{ key: "task", label: "Checklist Task" }, { key: "owner", label: "Owner" }, { key: "type", label: "Type", align: "center", kind: "badge" }, st],
    statuses: ["Pending", "Done", "Blocked"],
    rows: [
      { task: "Reconcile all bank accounts", owner: "fin.exec", type: "Monthly", status: "Done" },
      { task: "Post depreciation", owner: "fin.mgr", type: "Monthly", status: "Done" },
      { task: "Provision expenses", owner: "fin.mgr", type: "Monthly", status: "Pending" },
      { task: "Lock period", owner: "controller", type: "Monthly", status: "Blocked" },
    ] },
  "multi-branch": { title: "Multi-Branch Accounting", desc: "Branch books, consolidated books & inter-branch.",
    kpis: [{ label: "Branches", value: "4", tone: "primary" }, { label: "Inter-Branch (MTD)", value: "₹3.2L", tone: "secondary" }, { label: "Consolidated NP", value: "₹13.4L", tone: "success" }, { label: "Unmatched IBT", value: "2", tone: "danger" }],
    columns: [{ key: "branch", label: "Branch" }, amt("revenue", "Revenue"), amt("expense", "Expense"), amt("profit", "Profit"), { key: "margin", label: "Margin", align: "center" }, st],
    statuses: ["Profit", "Loss"],
    rows: [
      { branch: "Chennai", revenue: 4820000, expense: 3480000, profit: 1340000, margin: "28%", status: "Profit" },
      { branch: "Bengaluru", revenue: 2640000, expense: 2210000, profit: 430000, margin: "16%", status: "Profit" },
      { branch: "Hyderabad", revenue: 1840000, expense: 1920000, profit: -80000, margin: "-4%", status: "Loss" },
    ] },
  audit: { title: "Audit Management", desc: "Trail of financial, voucher, approval & rule changes.",
    kpis: [{ label: "Events (MTD)", value: "1,240", tone: "primary" }, { label: "Rule Changes", value: "6", tone: "warning" }, { label: "Period Locks", value: "3", tone: "secondary" }, { label: "Flagged", value: "2", tone: "danger" }],
    columns: [{ key: "user", label: "User" }, { key: "action", label: "Action" }, { key: "module", label: "Module", align: "center", kind: "badge" }, { key: "at", label: "Date & Time" }],
    statuses: ["Info", "Warning", "Flagged"],
    rows: [
      { user: "controller", action: "Locked Apr 2026 period", module: "Period", at: "15-Jun 10:02", status: "Info" },
      { user: "fin.mgr", action: "Edited Sales auto-rule (Dr account)", module: "Rule Engine", at: "14-Jun 16:40", status: "Warning" },
      { user: "admin", action: "Approved JV/0064", module: "Journal", at: "14-Jun 11:20", status: "Info" },
    ] },
};

/* ================================================ voucher form metas === */
export interface FFormField { key: string; label: string; type: "text" | "date" | "number" | "select" | "textarea" | "file"; options?: string[]; full?: boolean; required?: boolean }
export interface FinFormMeta { kind: "journal" | "voucher"; saveLabel: string; prefix: string; partyLabel?: string; fields: FFormField[] }
export const EXPENSE_CATEGORIES = ["Rent", "Electricity", "Water", "Fuel", "Internet", "Telephone", "Marketing", "Repairs", "Maintenance", "Insurance", "Professional Fees", "Miscellaneous"];
export const INCOME_TYPES = ["Rent Income", "AMC Income", "Subscription Income", "Franchise Income", "Advertisement Income", "Service Income", "Commission Income", "Interest Income", "Other Income"];
export const FREQ = ["Monthly", "Quarterly", "Half-Yearly", "Yearly", "Weekly", "One-Time"];
export const FINANCE_FORM_META: Record<string, FinFormMeta> = {
  journal: { kind: "journal", saveLabel: "Post Journal", prefix: "JV", fields: [
    { key: "type", label: "Journal Type", type: "select", options: ["Manual", "Adjustment", "Opening", "Closing", "Reversal"], required: true }, { key: "narration", label: "Narration", type: "textarea", full: true, required: true }, { key: "costCenter", label: "Cost Center", type: "text" } ] },
  expense: { kind: "voucher", saveLabel: "Save Expense", prefix: "EXP", partyLabel: "Vendor", fields: [
    { key: "category", label: "Expense Category", type: "select", options: EXPENSE_CATEGORIES, required: true }, { key: "amount", label: "Amount (₹)", type: "number", required: true }, { key: "gst", label: "Input GST %", type: "number" }, { key: "tds", label: "TDS %", type: "number" }, { key: "payMode", label: "Pay Via", type: "select", options: ["Cash", "Bank", "Credit (Payable)"] }, { key: "costCenter", label: "Cost Center", type: "text" }, { key: "attachment", label: "Bill / Document", type: "file", full: true }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  "recurring-income": { kind: "voucher", saveLabel: "Save Schedule", prefix: "RI", partyLabel: "Customer", fields: [
    { key: "incomeType", label: "Income Type", type: "select", options: INCOME_TYPES, required: true }, { key: "amount", label: "Amount (₹)", type: "number", required: true }, { key: "frequency", label: "Frequency", type: "select", options: FREQ, required: true }, { key: "start", label: "Start Date", type: "date" }, { key: "end", label: "End Date", type: "date" }, { key: "gst", label: "GST %", type: "number" }, { key: "autoInvoice", label: "Auto Invoice", type: "select", options: ["Yes", "No"] }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  "recurring-expense": { kind: "voucher", saveLabel: "Save Schedule", prefix: "RE", partyLabel: "Vendor", fields: [
    { key: "expenseType", label: "Expense Type", type: "select", options: ["Rent", "Electricity", "Water", "Internet", "Cloud Hosting", "Software Subscription", "Security", "Housekeeping", "Vehicle EMI", "Loan EMI", "Insurance", "Maintenance"], required: true }, { key: "amount", label: "Amount (₹)", type: "number", required: true }, { key: "frequency", label: "Frequency", type: "select", options: FREQ, required: true }, { key: "start", label: "Start Date", type: "date" }, { key: "end", label: "End Date", type: "date" }, { key: "autoPost", label: "Auto Voucher", type: "select", options: ["Yes", "No"] }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  "fixed-asset": { kind: "voucher", saveLabel: "Save Asset", prefix: "FA", partyLabel: "Supplier", fields: [
    { key: "name", label: "Asset Name", type: "text", required: true }, { key: "category", label: "Category", type: "select", options: ["Furniture", "Computer", "Laptop", "Vehicle", "Machinery", "Equipment"], required: true }, { key: "amount", label: "Purchase Value (₹)", type: "number", required: true }, { key: "purchaseDate", label: "Purchase Date", type: "date" }, { key: "life", label: "Useful Life (yrs)", type: "number" }, { key: "depMethod", label: "Depreciation", type: "select", options: ["SLM", "WDV"] }, { key: "location", label: "Location", type: "text" }, { key: "attachment", label: "Invoice", type: "file", full: true } ] },
  coa: { kind: "voucher", saveLabel: "Save Account", prefix: "AC", fields: [
    { key: "code", label: "Account Code", type: "text", required: true }, { key: "name", label: "Account Name", type: "text", required: true }, { key: "group", label: "Account Group", type: "select", options: ["Current Assets", "Fixed Assets", "Current Liabilities", "Loans", "Capital", "Revenue", "Direct Cost", "Indirect Expense", "Duties & Taxes"], required: true }, { key: "type", label: "Type", type: "select", options: ["Asset", "Liability", "Income", "Expense", "Equity"], required: true }, { key: "opening", label: "Opening Balance (₹)", type: "number" }, { key: "drcr", label: "Dr / Cr", type: "select", options: ["Dr", "Cr"] }, { key: "remarks", label: "Description", type: "textarea", full: true } ] },
  cash: { kind: "voucher", saveLabel: "Save Voucher", prefix: "CSH", partyLabel: "Party / Head", fields: [
    { key: "type", label: "Voucher Type", type: "select", options: ["Receipt", "Payment", "Deposit", "Withdrawal", "Transfer"], required: true }, { key: "amount", label: "Amount (₹)", type: "number", required: true }, { key: "account", label: "Cash / Bank Account", type: "select", options: ["Cash", "Bank - HDFC", "Bank - ICICI"] }, { key: "against", label: "Against Reference", type: "text" }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  bank: { kind: "voucher", saveLabel: "Save Bank Txn", prefix: "BNK", fields: [
    { key: "bankAccount", label: "Bank Account", type: "select", options: ["HDFC - Current ••4521", "ICICI - Current ••8890", "SBI - OD ••1122"], required: true }, { key: "type", label: "Transaction Type", type: "select", options: ["Deposit", "Withdrawal", "Transfer", "Bank Charges", "Interest"], required: true }, { key: "amount", label: "Amount (₹)", type: "number", required: true }, { key: "ref", label: "Reference / UTR", type: "text" }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  "bank-recon": { kind: "voucher", saveLabel: "Import & Match", prefix: "REC", fields: [
    { key: "bankAccount", label: "Bank Account", type: "select", options: ["HDFC - Current ••4521", "ICICI - Current ••8890", "SBI - OD ••1122"], required: true }, { key: "format", label: "Statement Format", type: "select", options: ["Excel", "CSV", "PDF", "Direct API"], required: true }, { key: "statementDate", label: "Statement Date", type: "date" }, { key: "file", label: "Upload Statement", type: "file", full: true } ] },
  "petty-cash": { kind: "voucher", saveLabel: "Save Petty Voucher", prefix: "PC", partyLabel: "Spent By", fields: [
    { key: "head", label: "Expense Head", type: "select", options: ["Office Supplies", "Courier", "Refreshments", "Travel", "Conveyance", "Miscellaneous"], required: true }, { key: "amount", label: "Amount (₹)", type: "number", required: true }, { key: "attachment", label: "Bill / Document", type: "file", full: true }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  tds: { kind: "voucher", saveLabel: "Save TDS Entry", prefix: "TDS", partyLabel: "Deductee", fields: [
    { key: "section", label: "TDS Section", type: "select", options: ["194C", "194J", "194I", "194H", "194Q", "192"], required: true }, { key: "base", label: "Base Amount (₹)", type: "number", required: true }, { key: "rate", label: "Rate %", type: "number", required: true }, { key: "amount", label: "TDS Amount (₹)", type: "number" }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  tcs: { kind: "voucher", saveLabel: "Save TCS Entry", prefix: "TCS", partyLabel: "Buyer", fields: [
    { key: "section", label: "TCS Section", type: "select", options: ["206C(1H)", "206C(1)"], required: true }, { key: "base", label: "Base Amount (₹)", type: "number", required: true }, { key: "rate", label: "Rate %", type: "number", required: true }, { key: "amount", label: "TCS Amount (₹)", type: "number" }, { key: "remarks", label: "Remarks", type: "textarea", full: true } ] },
  budget: { kind: "voucher", saveLabel: "Save Budget", prefix: "BUD", fields: [
    { key: "head", label: "Budget Head", type: "text", required: true }, { key: "level", label: "Budget Level", type: "select", options: ["Organization", "Branch", "Department", "Category", "Project"], required: true }, { key: "period", label: "Period", type: "select", options: ["FY 26-27", "Q1", "Q2", "Q3", "Q4", "Monthly"], required: true }, { key: "amount", label: "Budget Amount (₹)", type: "number", required: true }, { key: "costCenter", label: "Cost Center", type: "text" }, { key: "remarks", label: "Notes", type: "textarea", full: true } ] },
};

/* ===================================================== reports ========= */
export const FINANCE_REPORTS = [
  { id: "tb", name: "Trial Balance", group: "Statutory" },
  { id: "pl", name: "Profit & Loss Statement", group: "Statutory" },
  { id: "bs", name: "Balance Sheet", group: "Statutory" },
  { id: "trading", name: "Trading Account", group: "Statutory" },
  { id: "cashflow", name: "Cash Flow Statement", group: "Statutory" },
  { id: "fundflow", name: "Fund Flow Statement", group: "Statutory" },
  { id: "gl", name: "General Ledger", group: "Books" },
  { id: "daybook", name: "Day Book", group: "Books" },
  { id: "cashbook", name: "Cash Book", group: "Books" },
  { id: "bankbook", name: "Bank Book", group: "Books" },
  { id: "journal", name: "Journal Register", group: "Books" },
  { id: "ar-aging", name: "Receivable Aging", group: "Working Capital" },
  { id: "ap-aging", name: "Payable Aging", group: "Working Capital" },
  { id: "rec-income", name: "Recurring Income Report", group: "Working Capital" },
  { id: "rec-expense", name: "Recurring Expense Report", group: "Working Capital" },
  { id: "gst", name: "GST Reports (R1/3B/9)", group: "Tax" },
  { id: "tds", name: "TDS Reports", group: "Tax" },
  { id: "tcs", name: "TCS Reports", group: "Tax" },
  { id: "budget", name: "Budget Reports", group: "Control" },
  { id: "far", name: "Fixed Asset Register", group: "Assets" },
  { id: "dep", name: "Depreciation Report", group: "Assets" },
  { id: "cc", name: "Cost Center Report", group: "Control" },
  { id: "pc", name: "Profit Center Report", group: "Control" },
  { id: "branch", name: "Branch-wise Profitability", group: "Control" },
];

/* ===================================================== config notes ==== */
export function financeNotesFor(key: string): string[] {
  const period = `${fin("currentPeriod")} · ${fin("periodStatus")}`;
  switch (key) {
    case "journal": return [period, finFlag("journalApproval") ? "Approval required" : "Direct post", finFlag("backdatedRestriction") ? "No backdated entries" : "Backdated allowed"];
    case "expense": case "recurring-expense": return [period, finFlag("expenseApproval") ? "Approval required" : "Direct", finFlag("autoPostBank") ? "Auto-journal ON" : "Manual journal"];
    case "recurring-income": return [period, "Auto-invoice + auto-journal", finFlag("autoPostSales") ? "Posts to Sales" : "—"];
    case "depreciation": return [`Method: ${fin("depreciationMethod")}`, finFlag("autoPostDepreciation") ? "Auto-posted monthly" : "Manual"];
    case "gst": case "tds": case "tcs": case "einvoice": case "eway": return [finFlag("autoPostTax") ? "Auto tax journals" : "Manual", finFlag("einvoiceAuto") ? "E-Invoice auto" : "—", finFlag("ewayAuto") ? "E-Way auto" : "—"];
    case "fixed-asset": return [finFlag("autoPostDepreciation") ? "Auto depreciation" : "Manual", `Default: ${fin("depreciationMethod")}`];
    case "closing": case "period": return [period, finFlag("periodLock") ? "Period lock ON" : "—", finFlag("closureApproval") ? "Closure approval" : "—", finFlag("auditLock") ? "Audit lock ON" : "—"];
    case "multi-branch": return [finFlag("multiBranch") ? "Multi-branch ON" : "Single", "Consolidated + branch books", finFlag("profitCenterTracking") ? "Profit centers ON" : "—"];
    case "cash": case "bank": case "bank-recon": case "petty-cash": case "deposit": return [period, finFlag("autoPostBank") ? "Auto bank journals" : "Manual", finFlag("paymentApproval") ? "Payment approval" : "—"];
    case "budget": return [`FY 26-27`, finFlag("closureApproval") ? "Budget approval" : "—", "Budget vs actual tracked live"];
    default: return [period, finFlag("multiBranch") ? "Multi-branch" : "Single", `Base: ${fin("baseCurrency")}`];
  }
}
