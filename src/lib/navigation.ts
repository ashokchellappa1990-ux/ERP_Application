import {
  LayoutDashboard,
  LayoutGrid,
  Network,
  Monitor,
  Package,
  Boxes,
  Truck,
  Users,
  Gift,
  PiggyBank,
  IndianRupee,
  Calculator,
  ReceiptText,
  Bell,
  FileCog,
  Building2,
  UserCog,
  BarChart3,
  Sparkles,
  Settings,
  SlidersHorizontal,
  BookOpen,
  ShieldCheck,
  Percent,
  Warehouse,
  FileText,
  LayoutDashboard as LayoutDashboardIcon,
  ClipboardList,
  ShoppingCart as ShoppingCartIcon,
  Wallet,
  CreditCard,
  Undo2,
  Repeat,
  XCircle,
  HandCoins,
  AlertCircle,
  GitBranch,
  FileBarChart,
  GitCompare,
  ShoppingBag,
  PackageCheck,
  PackageOpen,
  Coins,
  Landmark,
  Banknote,
  Command,
  TrendingUp,
  ScanSearch,
  ScrollText,
  CalendarClock,
  MapPin,
  Lock,
  ArrowLeftRight,
  ClipboardCheck,
  ListChecks,
  Scale,
  PackagePlus,
  Workflow,
  NotebookPen,
  Target,
  PieChart,
  Award,
  QrCode,
  Palette,
  Megaphone,
  Rocket,
  Brain,
  Car,
  Factory,
  Contact,
  Route,
  LogIn,
  LogOut,
  History,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  badge?: string;
  /** Nested sub-menu items (renders an expandable parent). */
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Primary navigation for One ERP, grouped to match the ERP module map.
 * Routes are placeholders for the build-out; only /dashboard is live today.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Masters",
        icon: Package,
        children: [
          { label: "Products", href: "/masters/product", icon: Boxes },
          { label: "Suppliers", href: "/masters/supplier", icon: Truck },
          { label: "Customers", href: "/masters/customer", icon: Users },
          { label: "Discount Master", href: "/masters/discount", icon: Percent },
          { label: "Opening Stock Setup", href: "/masters/opening-stock", icon: Warehouse },
          { label: "Vehicle Master", href: "/masters/transport/vehicle", icon: Car },
          { label: "Driver Master", href: "/masters/transport/driver", icon: Contact },
          { label: "Transport Company Master", href: "/masters/transport/transport-company", icon: Truck },
          { label: "Route Master", href: "/masters/transport/route", icon: Route },
          { label: "Loading Bay Master", href: "/masters/transport/loading-bay", icon: Warehouse },
          { label: "Weighbridge Master", href: "/masters/transport/weighbridge", icon: Scale },
          { label: "Supplier Product PP Config", href: "/masters/purchase/supplier-product-price", icon: IndianRupee },
        ],
      },
      {
        label: "Accounting",
        icon: Calculator,
        children: [
          { label: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: BookOpen },
          { label: "Opening Balance", href: "/accounting/opening-balance", icon: Wallet },
          { label: "Dispatch & Sales Accounting", href: "/accounting/dispatch-sales-accounting", icon: Landmark },
          { label: "Petty Cash Configuration", href: "/accounting/petty-cash-config", icon: Coins },
          { label: "Recurring Transaction Configuration", href: "/system/recurring-config", icon: Repeat },
          { label: "Accounting Rule Engine", href: "/accounting/rule-engine", icon: Workflow },
          { label: "Financial Period", href: "/accounting/financial-period", icon: CalendarClock },
          { label: "Receipt Configuration", href: "/accounting/receipt-config", icon: ReceiptText },
          { label: "Cost Centre", href: "/system/cost-centre", icon: Building2 },
          { label: "Profit Centre", href: "/system/profit-centre", icon: PieChart },
          { label: "Advance Management", href: "/system/advance-config", icon: HandCoins },
        ],
      },
      {
        label: "User & Roles",
        icon: ShieldCheck,
        children: [
          { label: "Employees & Access", href: "/organization/user-roles", icon: UserCog },
        ],
      },
      {
        label: "Configuration",
        icon: SlidersHorizontal,
        children: [
          { label: "Account & Tenant", href: "/system/account", icon: Network },
          { label: "Business Setup", href: "/setup", icon: Building2 },
          { label: "Business Hierarchy", href: "/system/branches", icon: Network },
          { label: "Area Config", href: "/system/areas", icon: LayoutGrid },
          { label: "Warehouse Configuration", href: "/warehouse/settings/configuration", icon: Warehouse },
        ],
      },
      {
        label: "Settings",
        icon: Settings,
        children: [
          { label: "General Settings", href: "/settings/general", icon: SlidersHorizontal },
          { label: "Notification", href: "/settings/notifications", icon: Bell },
          { label: "Sales Settings", href: "/settings/sales", icon: ReceiptText },
          { label: "Purchase Configuration", href: "/settings/purchase", icon: Truck },
          { label: "Dispatch Configuration", href: "/settings/dispatch-config", icon: SlidersHorizontal },
          { label: "Invoice Template", href: "/settings/invoice-template", icon: FileText },
          { label: "Document Field Settings", href: "/settings/documents", icon: FileCog },
          { label: "QR Code Settings", href: "/settings/qr-code", icon: QrCode },
          { label: "Application Theme", href: "/settings/theme", icon: Palette },
          { label: "Subscription & Billing", href: "/settings/subscription", icon: Rocket },
          { label: "Manufacturing Process", href: "/manufacturing/processing-set", icon: Factory },
          { label: "Weighbridge Setting", href: "/settings/weighbridge", icon: Scale },
        ],
      },
      {
        label: "Terminal Settings",
        icon: Monitor,
        children: [
          { label: "POS Terminals", href: "/pos/terminals", icon: Monitor },
          { label: "Shifts", href: "/pos/shifts", icon: CalendarClock },
          { label: "Terminal-Shift Mapping", href: "/pos/terminal-shifts", icon: GitBranch },
          { label: "Terminal Sessions", href: "/pos/sessions", icon: Wallet },
        ],
      },
      {
        label: "Rewards & Benefits",
        icon: Award,
        children: [
          { label: "Loyalty Configuration", href: "/loyalty/configuration", icon: SlidersHorizontal },
          { label: "Coupon Configuration", href: "/system/coupon/config", icon: Gift },
          { label: "Promo Configuration", href: "/system/promo/config", icon: Megaphone },
          { label: "Membership Configuration", href: "/system/membership/config", icon: Award },
        ],
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Sales",
        icon: ReceiptText,
        children: [
          { label: "Sales Dashboard", href: "/sales", icon: LayoutDashboardIcon },
          { label: "Sales Target", href: "/sales/target", icon: Target },
          { label: "Sales Quotation", href: "/sales/quotation", icon: FileText },
          { label: "Sales Order", href: "/sales/order", icon: ClipboardList },
          { label: "POS Billing (B2C)", href: "/sales/pos", icon: ShoppingCartIcon },
          { label: "Sales History", href: "/sales/history", icon: ReceiptText },
          { label: "Sales Invoice (B2B)", href: "/sales/invoice", icon: ReceiptText },
          { label: "Gift Voucher Sales", href: "/sales/gift-voucher-sales", icon: Wallet },
          { label: "Credit Sales", href: "/sales/credit", icon: CreditCard },
          { label: "Sales Return", href: "/sales/return", icon: Undo2 },
          { label: "Sales Exchange", href: "/sales/exchange", icon: Repeat },
          { label: "Sales Cancellation", href: "/sales/cancellation", icon: XCircle },
          { label: "Sales Reports", href: "/sales/reports", icon: FileBarChart },
        ],
      },
      {
        label: "Purchase",
        icon: Truck,
        children: [
          { label: "Purchase Dashboard", href: "/purchase", icon: LayoutDashboardIcon },
          { label: "Purchase Order", href: "/purchase/order", icon: ShoppingBag },
          { label: "Goods Receipt Note", href: "/purchase/grn", icon: PackageCheck },
          { label: "Purchase Invoice", href: "/purchase/invoice", icon: ReceiptText },
          { label: "Purchase Return", href: "/purchase/return", icon: Undo2 },
          { label: "AI Purchase Planning", href: "/purchase/planning", icon: Sparkles },
          { label: "Demand Forecasting", href: "/purchase/forecasting", icon: TrendingUp },
          { label: "Purchase Reports", href: "/purchase/reports", icon: FileBarChart },
        ],
      },
      {
        label: "Inventory",
        icon: Boxes,
        children: [
          { label: "Inventory Dashboard", href: "/inventory", icon: LayoutDashboardIcon },
          { label: "Stock Inquiry", href: "/inventory/inquiry", icon: ScanSearch },
          { label: "Inventory Tracking", href: "/inventory/tracking", icon: ScanSearch },
          { label: "Inventory Ledger", href: "/inventory/ledger", icon: ScrollText },
          // Hidden — superseded by the unified "Inventory Tracking" screen (Batch / Expiry / Serial tabs).
          // { label: "Batch Management", href: "/inventory/batch", icon: Layers },
          // { label: "Expiry Management", href: "/inventory/expiry", icon: CalendarClock },
          // { label: "Serial Numbers", href: "/inventory/serial", icon: Hash },
          { label: "Warehouse Inventory", href: "/inventory/warehouse", icon: Warehouse },
          // Hidden per request.
          // { label: "Branch Inventory", href: "/inventory/branch", icon: Building2 },
          // { label: "Bin Locations", href: "/inventory/bin", icon: MapPin },
          // { label: "Stock Reservation", href: "/inventory/reservation", icon: Lock },
          // { label: "Stock Transfer", href: "/inventory/transfer", icon: ArrowLeftRight },
          // { label: "Stock Adjustment", href: "/inventory/adjustment", icon: SlidersHorizontal },
          // { label: "Physical Verification", href: "/inventory/verification", icon: ClipboardCheck },
          // { label: "Cycle Count", href: "/inventory/cyclecount", icon: ListChecks },
          // { label: "Inventory Valuation", href: "/inventory/valuation", icon: Scale },
          // { label: "Reorder Planning", href: "/inventory/reorder", icon: PackagePlus },
          // { label: "AI Inventory Engine", href: "/inventory/ai", icon: Sparkles },
          // { label: "Inventory Forecasting", href: "/inventory/forecasting", icon: TrendingUp },
          // { label: "Inventory Analytics", href: "/inventory/analytics", icon: BarChart3 },
          { label: "Inventory Reports", href: "/inventory/reports", icon: FileBarChart },
        ],
      },
      {
        label: "Manufacturing",
        icon: Factory,
        children: [
          { label: "Material Processing", href: "/manufacturing/material-processing", icon: Factory },
        ],
      },
      {
        label: "Stock Transfer Management",
        icon: Warehouse,
        children: [
          { label: "Dashboard", href: "/warehouse", icon: LayoutDashboardIcon },
          { label: "Stock Transfer Request", href: "/warehouse/transfer/request", icon: ArrowLeftRight },
          { label: "Stock Allocation", href: "/warehouse/transfer/allocation", icon: PackageCheck },
          { label: "Dispatch Planning", href: "/warehouse/transfer/dispatch-planning", icon: ClipboardList },
          { label: "Load & Dispatch", href: "/warehouse/transfer/load-dispatch", icon: Truck },
          { label: "Stock Transfer Receipt", href: "/warehouse/transfer/receipt", icon: PackageOpen },
          // Hidden per request.
          // { label: "Operations", href: "/warehouse/operations", icon: SlidersHorizontal },
          { label: "Reports", href: "/warehouse/reports", icon: FileBarChart },
        ],
      },
      {
        label: "Transport & Vehicle Operations",
        icon: Truck,
        children: [
          { label: "Dashboard", href: "/transport", icon: LayoutDashboardIcon },
          { label: "Vehicle Gate Entry", href: "/transport/gate-entry", icon: LogIn },
          { label: "Pre Loading Weighment", href: "/transport/pre-weighment", icon: Scale },
          { label: "Post Loading Weighment", href: "/transport/post-weighment", icon: Scale },
          { label: "Gate Exit", href: "/transport/gate-exit", icon: LogOut },
          { label: "Vehicle Movement History", href: "/transport/movement-history", icon: History },
        ],
      },
      { label: "Day Open / Close", href: "/operations/day-close", icon: Banknote },
    ],
  },
  {
    title: "Customers",
    items: [
      {
        label: "CRM",
        icon: Users,
        children: [
          { label: "CRM Dashboard", href: "/crm", icon: LayoutDashboardIcon },
          { label: "Customer 360 Dashboard", href: "/crm/customer-360", icon: Users },
        ],
      },
      {
        label: "Benefits Management",
        icon: Gift,
        children: [
          { label: "Loyalty Program Master", href: "/loyalty/program", icon: Coins },
          { label: "Reward Balance", href: "/loyalty/profile", icon: Coins },
          { label: "Membership Registration", href: "/crm/membership", icon: Award },
          { label: "Coupon Management", href: "/sales/coupon", icon: Gift },
          { label: "Promo Code Management", href: "/sales/promo", icon: Megaphone },
          { label: "Gift Voucher Management", href: "/system/gift-voucher", icon: Wallet },
        ],
      },
      // Hidden per request — kept in code for easy restore.
      // { label: "Chit Scheme", href: "/chit", icon: PiggyBank },
    ],
  },
  {
    title: "Finance & Compliance",
    items: [
      { label: "Finance Dashboard", href: "/finance", icon: LayoutDashboardIcon },
      {
        label: "Receivables Management", icon: HandCoins,
        children: [
          { label: "Customer Collection", href: "/sales/collections", icon: HandCoins },
          { label: "Receivables", href: "/finance/receivables", icon: HandCoins },
        ],
      },
      {
        label: "Payable Management", icon: Banknote,
        children: [
          { label: "Supplier Payment", href: "/purchase/payments", icon: Banknote },
          { label: "Payable", href: "/finance/payables", icon: AlertCircle },
        ],
      },
      { label: "Fund Management", href: "/finance/cash", icon: Wallet },
      { label: "Bank Reconciliation", href: "/finance/banking", icon: Landmark },
      { label: "Petty Cash / Expense", href: "/finance/petty-cash", icon: Coins },
      { label: "Income Receipt", href: "/finance/receipt", icon: ReceiptText },
      { label: "Recurring Transaction", href: "/finance/recurring", icon: Repeat },
      { label: "Journal Entry", href: "/finance/journal", icon: NotebookPen },
      {
        label: "Advance Management", icon: HandCoins,
        children: [
          { label: "Advance Transaction", href: "/finance/advance", icon: HandCoins },
          { label: "Advance Settlement", href: "/finance/advance/settlement", icon: Wallet },
          { label: "Advance Refund", href: "/finance/advance/refund", icon: Undo2 },
          { label: "Advance Register", href: "/finance/advance/register", icon: BookOpen },
          { label: "Approval Queue", href: "/finance/advance/approval", icon: ClipboardCheck },
        ],
      },
      {
        label: "Budget Management", icon: Target,
        children: [
          { label: "Budget Planning", href: "/finance/budget", icon: Target },
          { label: "Budget Revision", href: "/finance/budget/revision", icon: FileText },
          { label: "Budget Transfer", href: "/finance/budget/transfer", icon: Repeat },
        ],
      },
      { label: "Cost Centre", href: "/system/cost-centre", icon: Building2 },
      { label: "Profit Centre", href: "/system/profit-centre", icon: PieChart },
      { label: "GST Compliance", href: "/finance/gst-compliance", icon: ShieldCheck },
      { label: "Statutory Compliance", href: "/finance/statutory-compliance", icon: Landmark },
      {
        label: "Financial Statement", icon: ScrollText,
        children: [
          { label: "General Ledger", href: "/finance/gl", icon: ScrollText },
          { label: "Journal Entry", href: "/finance/journal", icon: NotebookPen },
          { label: "Trial Balance", href: "/finance/reports?report=trial-balance", icon: FileBarChart },
          { label: "Trading Account", href: "/finance/reports?report=trading", icon: ShoppingCartIcon },
          { label: "Profit & Loss A/C", href: "/finance/reports?report=profit-loss", icon: TrendingUp },
          { label: "Balance Sheet", href: "/finance/reports?report=balance-sheet", icon: Scale },
          { label: "Cash Flow Statement", href: "/finance/reports?report=cash-flow", icon: ArrowLeftRight },
          { label: "Fund Flow Statement", href: "/finance/reports?report=fund-flow", icon: GitCompare },
        ],
      },
      {
        label: "Book of Accounts", icon: BookOpen,
        children: [
          { label: "Day Book", href: "/finance/reports?report=day-book", icon: BookOpen },
          { label: "Cash Book", href: "/finance/reports?report=cash-book", icon: Wallet },
          { label: "Bank Book", href: "/finance/reports?report=bank-book", icon: Landmark },
        ],
      },
      {
        label: "Financial Reports", icon: FileBarChart,
        children: [
          { label: "GL Report", href: "/finance/reports?report=general-ledger", icon: ScrollText },
          { label: "JV Report", href: "/finance/reports?report=journal-register", icon: NotebookPen },
          { label: "Ledger Summary", href: "/finance/reports?report=ledger-summary", icon: ScrollText },
          { label: "Receivables Ageing", href: "/finance/reports?report=receivables-ageing", icon: CalendarClock },
          { label: "Payables Ageing", href: "/finance/reports?report=payables-ageing", icon: CalendarClock },
        ],
      },
    ],
  },
  {
    title: "AI",
    items: [
      { label: "AI Copilot", href: "/copilot", icon: Sparkles, badge: "Chat" },
      {
        label: "AI Command Center",
        icon: Command,
        children: [
          { label: "Command Center", href: "/ai/command", icon: Command, badge: "⌘K" },
          { label: "AI Draft Center", href: "/ai/drafts", icon: FileText },
          { label: "AI Task Center", href: "/ai/tasks", icon: ClipboardList },
          { label: "AI Action History", href: "/ai/actions", icon: ScrollText },
        ],
      },
    ],
  },
  {
    title: "Knowledge",
    items: [
      // Single hub — the Knowledge Center launches every document tool (Library, Search,
      // Chat, Summary, Compare, Translate, FAQ, OCR, Versions, Categories, Knowledge Base,
      // Analytics, Settings) from one screen, so no separate menu items are needed.
      { label: "Knowledge Center", href: "/ai/knowledge", icon: BookOpen, badge: "AI" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      // Single hub — Decision Intelligence launches all 18 areas (health, forecasts,
      // per-module intelligence, risk, opportunity, scenario, recommendations, history,
      // analytics, model manager, settings) from one screen.
      { label: "Decision Intelligence", href: "/intelligence/decision", icon: Brain, badge: "AI" },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
];
