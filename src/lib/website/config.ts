/**
 * Oasys ERP marketing website — the entire public site is driven by this
 * config object, which the Product Owner edits from the Website CMS (no code
 * changes). `DEFAULT_WEBSITE_CONFIG` is the seed/fallback so the site renders
 * beautifully out of the box; the CMS persists a draft + a published snapshot.
 */

export interface NavItem { label: string; href: string }
export interface CtaButton { label: string; href: string; style?: "primary" | "outline" | "ghost" }
export interface FeatureItem { icon: string; title: string; text: string }
export interface GroupSection { title: string; subtitle?: string; items: FeatureItem[] }
export interface PricingPlan { name: string; price: string; period: string; tagline: string; featured?: boolean; features: string[]; cta: CtaButton }
export interface Testimonial { quote: string; author: string; role: string; company: string }
export interface FaqItem { q: string; a: string }
export interface Stat { value: string; label: string; suffix?: string; icon?: string; tone?: string }
export interface IndustryItem { icon: string; name: string; blurb: string; color?: string; imageUrl?: string }
export interface ClientLogo { name: string; logoUrl?: string }
export interface Spotlight { badge?: string; title: string; subtitle: string; points: string[]; icon: string; imageUrl?: string; imageSide: "left" | "right"; cta?: CtaButton }
export interface TrustBadge { icon: string; title: string; subtitle: string; tone?: string }
export interface ShowcaseKpi { icon: string; label: string; value: string; delta: string; tone: string }
export interface FlowStep { icon: string; title: string; sub: string }
export interface QuickModule { icon: string; label: string; badge?: string; tone?: string; imageUrl?: string }
export interface BlogPost { category: string; title: string; date: string; readTime: string; imageUrl?: string; href?: string }
/** Per-section background image + layered overlay + text colour for readability/effect. */
export interface SectionBackground { imageUrl?: string; overlay?: string; textColor?: "auto" | "light" | "dark"; blur?: boolean; fixed?: boolean; dim?: number;
  /** Where the background image sits (leave the other side clear for content). */
  imageSide?: "full" | "left" | "right" | "center";
  /** Dynamic, theme-coloured decorative pattern drawn behind the section. */
  pattern?: "none" | "waves" | "dots" | "waves-dots" | "grid" | "rings" | "diagonal" | "mesh";
  /** Which part of the section the pattern covers (leave the other side for images). */
  patternSide?: "full" | "left" | "right";
  /** Animate the pattern (waves flow, dots drift). Defaults to on. */
  patternAnimate?: boolean; }

/** Colour presets the Product Owner can one-click apply in the CMS. */
export const THEME_PRESETS: { id: string; name: string; primary: string; secondary: string; accent: string }[] = [
  { id: "indigo", name: "Indigo / Cyan", primary: "#4338CA", secondary: "#06B6D4", accent: "#7AB317" },
  { id: "violet", name: "Violet / Pink", primary: "#7C3AED", secondary: "#EC4899", accent: "#F59E0B" },
  { id: "emerald", name: "Emerald / Teal", primary: "#059669", secondary: "#0D9488", accent: "#84CC16" },
  { id: "orange", name: "Sunset Orange", primary: "#EA580C", secondary: "#DB2777", accent: "#F59E0B" },
  { id: "blue", name: "Ocean Blue", primary: "#2563EB", secondary: "#0EA5E9", accent: "#22D3EE" },
  { id: "rose", name: "Rose / Fuchsia", primary: "#E11D48", secondary: "#C026D3", accent: "#FB7185" },
  { id: "slate", name: "Midnight Slate", primary: "#4F46E5", secondary: "#64748B", accent: "#38BDF8" },
];

/** A homepage section — the drag/reorder + enable/disable unit ("Homepage Builder"). */
export interface HomeSection { id: string; enabled: boolean }

export interface WebsiteConfig {
  identity: {
    productName: string; tagline: string; logoText: string; logoUrl?: string; faviconUrl?: string;
    /** Background photo for the sign-in screen's left brand panel (uploaded from the CMS). */
    loginImageUrl?: string;
    /** Sign-in screen left-panel content — all editable from Website CMS → Theme
     *  & Identity → "Login Screen Content" (no code change needed to redesign copy). */
    loginHeadlineLine1?: string;
    loginHeadlineLine2Before?: string;
    loginHeadlineHighlight?: string;
    loginHeadlineLine2After?: string;
    loginSubtitle?: string;
    loginShowModules?: boolean;
    loginModules?: { icon: string; label: string; sub: string }[];
    loginShowTrust?: boolean;
    loginTrustTitle?: string;
    loginTrustItems?: { icon: string; title: string; sub: string }[];
    loginShowCodeSnippet?: boolean;
    /** Animated "News & Updates" ticker — sits between the header and the
     *  image/content area, auto-rotating through these items. */
    loginShowNews?: boolean;
    loginNewsItems?: { tag?: string; title: string; text: string; date?: string; icon: string }[];
    /** Capability strip — a solid pill-shaped bar of icon+label chips, sitting
     *  right below the module cards grid (fills the space above the footer). */
    loginShowCapabilities?: boolean;
    loginCapabilityItems?: { icon: string; label: string }[];
    /** Left/right panel width split (left panel %, 30–70); right panel takes the remainder. */
    loginSplitPercent?: number;
    /** "content" = headline/modules/trust over the background (default); "image" =
     *  the left panel is ONLY the background image/pattern, no text at all. */
    loginLeftMode?: "content" | "image";
    /** Shape of the seam between the two panels — a plain line, or a decorative cut. */
    loginDividerStyle?: "straight" | "diagonal" | "notch" | "zigzag";
    /** Optional subtle background image behind the sign-in form (right panel). */
    loginRightBgImageUrl?: string;
    /** How visible that image is (0 = invisible/white, 100 = fully visible). */
    loginRightBgOpacity?: number;
    /** Decorative CSS pattern layer (same engine/options as the marketing site's
     *  section backgrounds) drawn behind the left-panel content, and a separate
     *  one behind the right (sign-in form) panel. Always follows the brand
     *  Primary/Secondary colours above — no separate colour field needed. */
    loginLeftPattern?: "none" | "waves" | "dots" | "waves-dots" | "grid" | "rings" | "diagonal" | "mesh";
    loginRightPattern?: "none" | "waves" | "dots" | "waves-dots" | "grid" | "rings" | "diagonal" | "mesh";
    /** Module-card icon appearance — shape, position relative to the text, and
     *  how strong the card's tinted background is. */
    loginModuleIconShape?: "square" | "circle";
    loginModuleIconPosition?: "top" | "left";
    loginModuleCardTint?: "subtle" | "medium" | "bold";
    /** Same idea for the footer trust/capability cards. */
    loginTrustIconShape?: "square" | "circle";
    loginTrustIconPosition?: "top" | "left";
    loginTrustCardTint?: "subtle" | "medium" | "bold";
    primaryColor: string; secondaryColor: string; accentColor: string; font: string; theme: "light" | "dark";
  };
  nav: NavItem[];
  headerCtas: CtaButton[];
  hero: {
    badge: string; titleLead: string; titleHighlight: string; titleTail: string; subtitle: string;
    primaryCta: CtaButton; secondaryCta: CtaButton; trustPoints: string[]; videoUrl?: string;
    style?: "gradient" | "image" | "split"; backgroundImage?: string; heroImage?: string; rotatingWords?: string[];
    trustBadges: TrustBadge[]; contentPanel?: "none" | "glass" | "dark" | "light";
  };
  stats: Stat[];
  logos: string[];
  clientsTitle: string;
  clients: ClientLogo[];
  spotlights: Spotlight[];
  retailShowcase: {
    badge: string; titleLead: string; titleHighlight: string; subtitle: string; imageUrl?: string;
    features: FeatureItem[]; kpis: ShowcaseKpi[]; badges: { icon: string; label: string }[];
    flowTitle: string; flow: FlowStep[];
  };
  everything: { title: string; subtitle: string; items: QuickModule[] };
  erpSolution: { title: string; subtitle: string; checklist: string[]; cta: CtaButton };
  realtime: { title: string; subtitle: string; points: string[]; cta: CtaButton; imageUrl?: string };
  customerApp: { title: string; highlight: string; subtitle: string; scanFeatures: FeatureItem[]; items: FeatureItem[]; cta: CtaButton; imageUrl?: string };
  aiCard: { title: string; subtitle: string; points: string[]; imageUrl?: string };
  marketingCard: { title: string; subtitle: string; points: string[]; imageUrl?: string };
  pricingIncludes: string[];
  blog: { title: string; subtitle: string; posts: BlogPost[] };
  integrationLogos: { title: string; subtitle: string; logos: string[] };
  /** Optional background image + layered overlay per section, keyed by section id. */
  backgrounds: Record<string, SectionBackground>;
  why: GroupSection & { pillars: FeatureItem[] };
  platform: GroupSection;
  finance: GroupSection;
  hr: GroupSection;
  cx: GroupSection;
  aiAssistant: GroupSection;
  marketing: GroupSection;
  benefits: GroupSection;
  ecommerce: GroupSection;
  integrations: GroupSection;
  ai: GroupSection;
  industries: { title: string; subtitle: string; items: IndustryItem[] };
  tech: { title: string; subtitle: string; items: string[] };
  testimonials: { title: string; subtitle: string; items: Testimonial[] };
  pricing: { title: string; subtitle: string; plans: PricingPlan[] };
  faq: { title: string; subtitle: string; items: FaqItem[] };
  cta: { title: string; subtitle: string; primaryCta: CtaButton; secondaryCta: CtaButton };
  footer: { about: string; columns: { title: string; links: NavItem[] }[]; social: { label: string; href: string }[]; contactEmail: string; contactPhone: string; address: string; copyright: string };
  seo: { title: string; description: string; keywords: string; ogImage?: string };
  homeSections: HomeSection[];
}

const F = (icon: string, title: string, text: string): FeatureItem => ({ icon, title, text });

export const DEFAULT_WEBSITE_CONFIG: WebsiteConfig = {
  identity: {
    productName: "Oasys ERP", tagline: "The AI-Powered Unified Business Platform",
    logoText: "Oasys ERP", loginImageUrl: "",
    loginHeadlineLine1: "All Your Business.", loginHeadlineLine2Before: "One ", loginHeadlineHighlight: "Intelligent", loginHeadlineLine2After: " Platform.",
    loginSubtitle: "Unify operations, drive efficiency, and accelerate growth with a connected digital ecosystem.",
    loginShowModules: true,
    loginModules: [
      { icon: "Landmark", label: "Finance & GST", sub: "Accounting, GL, AP, AR, GST, TDS, E-Invoice" },
      { icon: "Users", label: "CRM & Sales", sub: "Lead Management, Sales Orders, Customer 360° View" },
      { icon: "Boxes", label: "Inventory", sub: "Stock, Batches, Serial No., Expiry, Multi-warehouse" },
      { icon: "ShoppingCart", label: "Purchase", sub: "PO, GRN, Vendor Mgmt, Procurement Control" },
      { icon: "BarChart3", label: "Reports & Analytics", sub: "Real-time Dashboards, KPIs & Actionable Insights" },
      { icon: "Wallet", label: "HR & Payroll", sub: "Employee, Payroll, Attendance, Leaves, Performance" },
      { icon: "Factory", label: "Manufacturing", sub: "Production Planning, BOM, Work Orders, Quality Control" },
      { icon: "Monitor", label: "POS", sub: "Fast Billing, Offers, Loyalty, Multiple Payment Modes" },
      { icon: "Store", label: "E-Commerce", sub: "Online Store, Orders, Payments, Customer Management" },
      { icon: "Brain", label: "Analytics & BI", sub: "Business Intelligence, Forecasting, Data Insights" },
    ],
    loginShowTrust: true,
    loginTrustTitle: "Why Businesses Choose Our Platform",
    loginTrustItems: [
      { icon: "ShieldCheck", title: "Secure & Reliable", sub: "Enterprise-grade security with role-based access and audit trails." },
      { icon: "RefreshCw", title: "Automated Workflows", sub: "Reduce manual work and improve operational efficiency." },
      { icon: "TrendingUp", title: "Scalable & Flexible", sub: "Built to grow with your business and adapt to future needs." },
      { icon: "BarChart3", title: "Data-Driven Decisions", sub: "Real-time insights to make smarter and faster decisions." },
      { icon: "Network", title: "Integrated Operations", sub: "All departments and processes on a single, unified platform." },
    ],
    loginShowCodeSnippet: true,
    loginShowNews: true,
    loginNewsItems: [
      { tag: "New", title: "AI Copilot 2.0 Released", text: "Smarter insights and faster answers, built into every module.", date: "Jul 2026", icon: "Sparkles" },
      { tag: "Update", title: "GST Compliance Enhanced", text: "Automated GSTR-2B reconciliation is now live for all businesses.", date: "Jun 2026", icon: "FileCheck" },
      { tag: "New", title: "Mobile App — Beta", text: "Manage sales, stock and approvals on the go. Join the beta today.", date: "Jun 2026", icon: "Smartphone" },
    ],
    loginShowCapabilities: true,
    loginCapabilityItems: [
      { icon: "Building2", label: "Multi-Branch & Multi-Location Management" },
      { icon: "ShieldCheck", label: "Role-Based Access & Security" },
      { icon: "Cloud", label: "Cloud Ready & Accessible Anywhere" },
      { icon: "GitBranch", label: "Workflow Automation Engine" },
      { icon: "ClipboardList", label: "Audit Trail & Compliance Management" },
      { icon: "Lock", label: "Backup & Data Protection" },
      { icon: "Plug", label: "API Integration & Third Party Connectivity" },
    ],
    loginSplitPercent: 58,
    loginLeftMode: "content",
    loginDividerStyle: "diagonal",
    loginRightBgImageUrl: "",
    loginRightBgOpacity: 12,
    loginLeftPattern: "waves-dots",
    loginRightPattern: "dots",
    loginModuleIconShape: "square",
    loginModuleIconPosition: "top",
    loginModuleCardTint: "medium",
    loginTrustIconShape: "circle",
    loginTrustIconPosition: "left",
    loginTrustCardTint: "subtle",
    primaryColor: "#7C3AED", secondaryColor: "#A855F7", accentColor: "#22C55E",
    font: "Inter", theme: "light",
  },
  nav: [
    { label: "Platform", href: "/#platform" },
    { label: "ERP Modules", href: "/modules" },
    { label: "Industries", href: "/#industries" },
    { label: "AI Platform", href: "/#ai" },
    { label: "Resources", href: "/#resources" },
    { label: "Pricing", href: "/#pricing" },
    { label: "About Us", href: "/contact" },
  ],
  headerCtas: [
    { label: "Sign in", href: "/login", style: "ghost" },
    { label: "Start Free Trial", href: "/contact?type=trial", style: "primary" },
  ],
  hero: {
    badge: "AI Powered Unified Business Platform",
    titleLead: "One Platform.\nEvery Process.",
    titleHighlight: "Limitless Growth.",
    titleTail: "",
    subtitle: "Oasys ERP unifies ERP, Finance, HR, Retail, E-Commerce and Customer Engagement on a single, AI-powered platform to streamline operations, delight customers and grow faster.",
    primaryCta: { label: "Start Free Trial", href: "/contact?type=trial", style: "primary" },
    secondaryCta: { label: "Book Live Demo", href: "/contact?type=demo", style: "outline" },
    trustPoints: ["No Credit Card", "No Setup Fee", "Cancel Anytime"],
    style: "split", backgroundImage: "", heroImage: "",
    rotatingWords: [],
    trustBadges: [
      { icon: "Brain", title: "AI Powered", subtitle: "Smarter Insights", tone: "violet" },
      { icon: "Cloud", title: "Cloud Native", subtitle: "Secure & Scalable", tone: "blue" },
      { icon: "Zap", title: "Real-Time", subtitle: "Live Data & Reports", tone: "emerald" },
      { icon: "Smartphone", title: "Mobile Ready", subtitle: "Anytime, Anywhere", tone: "rose" },
      { icon: "Users", title: "Multi-Tenant", subtitle: "Flexible & Secure", tone: "orange" },
      { icon: "Code", title: "API First", subtitle: "Seamless Integration", tone: "blue" },
      { icon: "ShieldCheck", title: "99.9% Uptime", subtitle: "Enterprise Grade", tone: "violet" },
    ],
  },
  stats: [
    { value: "500", suffix: "+", label: "Happy Customers", icon: "Users", tone: "violet" },
    { value: "50", suffix: "K+", label: "Businesses Trust Us", icon: "Building2", tone: "blue" },
    { value: "10", suffix: "M+", label: "Invoices Processed", icon: "ReceiptText", tone: "emerald" },
    { value: "99.9", suffix: "%", label: "System Uptime", icon: "Gauge", tone: "orange" },
    { value: "24", suffix: "/7", label: "Customer Support", icon: "ShieldCheck", tone: "violet" },
    { value: "15", suffix: "+", label: "Industries Served", icon: "Boxes", tone: "rose" },
  ],
  logos: ["Retail Co", "MediCare", "FreshMart", "TechBazaR", "UrbanStyle", "BuildPro"],
  clientsTitle: "Trusted by 500+ Businesses Worldwide",
  clients: [
    { name: "Reliance Retail" }, { name: "Apollo Pharmacy" }, { name: "DMart" }, { name: "Vishal Mega Mart" },
    { name: "MedPlus" }, { name: "FirstCry" }, { name: "Bajaj Electronics" }, { name: "Croma" },
  ],
  spotlights: [
    { badge: "Unified Platform", icon: "Boxes", title: "One platform, zero silos", subtitle: "Stop stitching together POS, accounting, inventory and CRM. Oasys ERP unifies your entire operation on a single real-time data model — so every module talks to every other.", points: ["Single source of truth across all modules", "Real-time stock, sales & finance sync", "Multi-company, multi-branch, multi-warehouse", "Role-based access with full audit trails"], imageSide: "right", imageUrl: "", cta: { label: "Explore the platform", href: "/#platform", style: "outline" } },
    { badge: "AI Built-In", icon: "Sparkles", title: "AI that runs your business smarter", subtitle: "Forecasting, reorder suggestions, dead-stock alerts and a business health score — intelligence woven into every screen, not bolted on as an afterthought.", points: ["Demand & sales forecasting", "Smart reorder & inventory optimization", "Business health score & anomaly alerts", "Natural-language reports & AI chatbot"], imageSide: "left", imageUrl: "", cta: { label: "See the AI platform", href: "/#ai", style: "outline" } },
    { badge: "Customer Experience", icon: "Smartphone", title: "Your brand, in every customer's pocket", subtitle: "A branded mobile app with orders, digital bills, loyalty, wallet and an AI shopping assistant — turning one-time buyers into loyal, repeat customers.", points: ["Branded customer mobile app", "Loyalty, membership, coupons & gift vouchers", "Order & delivery tracking", "AI shopping assistant & smart reorder"], imageSide: "right", imageUrl: "", cta: { label: "Discover the customer app", href: "/#cx", style: "outline" } },
  ],
  retailShowcase: {
    badge: "All-in-One Retail ERP", titleLead: "Run Your Retail Business", titleHighlight: "Smarter. Faster. Better.",
    subtitle: "Manage sales, inventory, customers, finance & more from one unified platform.",
    imageUrl: "/samples/retail-store.svg",
    features: [
      F("ShoppingCart", "Smart Sales & Billing", "Scan products, apply discounts, taxes & generate bills in seconds."),
      F("Boxes", "Real-time Inventory", "Live stock tracking, low stock alerts & multi-branch management."),
      F("Landmark", "Finance & Accounting", "Automatic entries, GST calculation, reports & profitability insights."),
      F("Users", "Customer Engagement", "Loyalty points, offers, SMS & notifications that bring customers back."),
      F("BarChart3", "Insights & Reports", "Real-time dashboards to track sales, profit, stock & business performance."),
    ],
    kpis: [
      { icon: "ShoppingCart", label: "Today's Sales", value: "₹45,680", delta: "13.6%", tone: "violet" },
      { icon: "ShoppingBag", label: "Total Orders", value: "320", delta: "8.7%", tone: "blue" },
      { icon: "TrendingUp", label: "Total Profit", value: "₹8,320", delta: "9.4%", tone: "emerald" },
      { icon: "Users", label: "New Customers", value: "28", delta: "12.5%", tone: "orange" },
    ],
    badges: [
      { icon: "FileCheck", label: "GST Compliant" },
      { icon: "Store", label: "Multi-Store Management" },
      { icon: "CreditCard", label: "Digital Payments & Reconciliation" },
      { icon: "Cloud", label: "Cloud Backup & Secure" },
      { icon: "ShieldCheck", label: "Role Based Access" },
      { icon: "Smartphone", label: "Mobile & Web Access" },
    ],
    flowTitle: "Complete Retail Flow",
    flow: [
      { icon: "Boxes", title: "Scan Products", sub: "Add to Cart" },
      { icon: "ReceiptText", title: "Generate Bill", sub: "Apply discounts & GST" },
      { icon: "Smartphone", title: "Accept Payment", sub: "UPI / Card / Cash" },
      { icon: "FileText", title: "Finance Entry", sub: "Automatic accounting & GST posting" },
      { icon: "PackageCheck", title: "Update Inventory", sub: "Stock updated in real-time" },
      { icon: "BellRing", title: "Notify Customer", sub: "Bill, points & offers via SMS / App" },
      { icon: "BarChart3", title: "Reports & Insights", sub: "Track & grow your business" },
    ],
  },
  everything: {
    title: "Everything You Need. All in One Platform.", subtitle: "Powerful modules to manage your entire business from one place.",
    items: [
      { icon: "ShoppingCart", label: "Sales Management", tone: "violet" },
      { icon: "Truck", label: "Purchase Management", tone: "blue" },
      { icon: "Boxes", label: "Inventory Management", tone: "emerald" },
      { icon: "Landmark", label: "Finance & GST", tone: "orange" },
      { icon: "Wallet", label: "HR & Payroll", tone: "violet" },
      { icon: "Smartphone", label: "Customer App", tone: "rose", badge: "New" },
      { icon: "Brain", label: "AI & Analytics", tone: "blue" },
      { icon: "Megaphone", label: "Marketing Automation", tone: "emerald" },
      { icon: "Gift", label: "Loyalty & Rewards", tone: "orange" },
      { icon: "Store", label: "E-Commerce", tone: "rose" },
      { icon: "Monitor", label: "POS", tone: "violet" },
      { icon: "Factory", label: "Manufacturing", tone: "blue" },
      { icon: "Users", label: "CRM", tone: "emerald" },
      { icon: "Network", label: "SCM & Logistics", tone: "orange" },
      { icon: "KanbanSquare", label: "Projects", tone: "violet" },
      { icon: "Wrench", label: "Service Management", tone: "rose" },
      { icon: "BarChart3", label: "Reports & BI", tone: "blue" },
      { icon: "FileText", label: "Document Management", tone: "emerald" },
      { icon: "ShieldCheck", label: "Settings & Security", tone: "orange" },
    ],
  },
  realtime: {
    title: "Real-Time Insights. Smarter Decisions.", subtitle: "Monitor sales, inventory, finance, customer engagement, GST compliance and business performance from a single AI-powered dashboard.",
    points: ["Live Business Dashboard", "Customer Intelligence", "AI Powered Analytics", "GST & Compliance Reports", "Sales Performance", "Predictive Forecasting", "Inventory Health", "Multi-Store Performance", "Financial Insights", "Customizable Reports"],
    cta: { label: "View Live Dashboard", href: "/modules/analytics", style: "primary" }, imageUrl: "",
  },
  erpSolution: {
    title: "Complete ERP Solution", subtitle: "Streamline every process and department with powerful, integrated modules.",
    checklist: ["Sales & CRM", "Purchase & SCM", "Inventory & Warehouse", "POS & Retail", "Finance & Accounting", "GST & Taxation", "Manufacturing", "Production & MRP", "HR & Payroll", "Asset Management", "Project Management", "Quality Management", "Service Management", "Document Management", "Approval Workflows", "Business Intelligence"],
    cta: { label: "Explore All Modules", href: "/modules", style: "primary" },
  },
  customerApp: {
    title: "Scan. Discover.", highlight: "Stay Rewarded.",
    subtitle: "Scan your bill QR code to get complete purchase details, earn loyalty points and unlock exciting rewards.",
    scanFeatures: [
      F("QrCode", "Instant Purchase Details", "View bill summary, items & amounts"),
      F("Award", "Earn Loyalty Points", "More purchases, more rewards"),
      F("Ticket", "Exclusive Offers", "Personalized deals just for you"),
      F("TrendingUp", "Smart Insights", "Track your spending & savings"),
    ],
    items: [
      F("History", "Purchase History", "View all past purchases & invoices"),
      F("Truck", "Order Tracking", "Track orders in real-time"),
      F("Bot", "AI Shopping Assistant", "Auto cart & reorder suggestions"),
      F("Gift", "Loyalty & Rewards", "Earn & redeem reward points"),
      F("Ticket", "Coupons & Offers", "Exclusive offers & discounts"),
      F("Wallet", "Digital Wallet", "Store cards, vouchers & balance"),
      F("BellRing", "Notifications", "Get real-time updates & alerts"),
      F("MessageSquare", "WhatsApp Integration", "Stay connected on WhatsApp"),
    ],
    cta: { label: "Explore Customer App", href: "/#cx", style: "primary" }, imageUrl: "/samples/cart.svg",
  },
  aiCard: {
    title: "AI That Works For You", subtitle: "Make smarter decisions with AI-driven insights.",
    points: ["Sales & Demand Forecasting", "Purchase Recommendations", "Inventory Optimization", "Business Health Score", "AI Chatbot Assistant", "Natural Language Reports"],
    imageUrl: "/samples/ai.svg",
  },
  marketingCard: {
    title: "Marketing Automation", subtitle: "Create campaigns, promotions and engage customers across multiple channels.",
    points: ["Campaign & Promotion Designer", "AI Message & Content Generation", "Email, SMS, WhatsApp, Push", "Customer Segmentation", "Coupon, Loyalty & Membership", "Campaign Analytics & ROI"],
    imageUrl: "/samples/marketing.svg",
  },
  pricingIncludes: ["Cloud Hosting", "Automatic Updates", "Data Security", "Regular Backups", "Mobile Apps", "API Access"],
  blog: {
    title: "Latest Insights & Updates", subtitle: "Stay updated with the latest trends and knowledge.",
    posts: [
      { category: "AI & ERP", title: "How AI is Revolutionizing the Future of ERP", date: "June 5, 2026", readTime: "5 min read", href: "/contact" },
      { category: "Marketing", title: "Top 10 Marketing Automation Strategies for 2026", date: "June 3, 2026", readTime: "6 min read", href: "/contact" },
      { category: "Retail", title: "Smart Retail: How Data Drives Customer Loyalty", date: "June 1, 2026", readTime: "4 min read", href: "/contact" },
      { category: "Finance", title: "GST Compliance Made Easy with Oasys ERP", date: "May 30, 2026", readTime: "7 min read", href: "/contact" },
    ],
  },
  integrationLogos: {
    title: "Seamless Integrations", subtitle: "Connect with your favorite tools and platforms.",
    logos: ["Tally", "Amazon", "Shopify", "WhatsApp Business", "Razorpay", "PayU", "Instamojo", "Shiprocket", "SMS Gateway", "Google Analytics"],
  },
  backgrounds: {
    customerApp: { imageUrl: "/samples/customer-bg.svg", overlay: "light", blur: false },
  },
  why: {
    title: "Why Oasys ERP", subtitle: "One platform, engineered for modern enterprises — intelligent, secure and built to scale.",
    items: [], pillars: [
      F("Sparkles", "AI-Powered", "Forecasting, insights and recommendations built into every module."),
      F("Cloud", "Cloud Native", "Zero-install, always-updated, accessible anywhere."),
      F("Building2", "Multi-Tenant", "Complete tenant isolation with enterprise-grade security."),
      F("Network", "Multi-Company", "Run multiple companies and GST entities from one account."),
      F("GitBranch", "Multi-Branch", "Every location, warehouse and franchise in one console."),
      F("ShieldCheck", "Role-Based", "Granular RBAC — users see only what they should."),
      F("Lock", "Secure", "Audit trails, encryption and compliance by default."),
      F("TrendingUp", "Scalable", "From a single counter to a national chain."),
      F("Plug", "API-Ready", "REST APIs to integrate with anything."),
      F("Smartphone", "Mobile-Ready", "Responsive web + native customer app."),
      F("Award", "Enterprise-Ready", "Approval workflows, document management and BI."),
    ],
  },
  platform: {
    title: "The Complete ERP Platform", subtitle: "Every capability your business needs — modular, so you switch on only what you use.",
    items: [
      F("ShoppingCart", "Sales Management", "Quotes, orders, invoicing, returns and exchanges."),
      F("Truck", "Purchase Management", "PO, GRN, supplier bills and purchase returns."),
      F("Boxes", "Inventory Management", "Batch, serial, expiry, barcode and valuation."),
      F("Warehouse", "Warehouse Management", "Multi-location stock, transfers and reconciliation."),
      F("Monitor", "POS", "Touch-ready billing with offline resilience."),
      F("Landmark", "Finance & Accounting", "Double-entry GL, AP/AR and financial statements."),
      F("ReceiptText", "GST Management", "GSTR-1/2B/3B/9, e-invoice and e-way bill."),
      F("Factory", "Manufacturing", "BOM, work orders and shop-floor control."),
      F("ClipboardList", "Production Planning", "Schedule, capacity and material planning."),
      F("Repeat", "MRP", "Demand-driven material requirement planning."),
      F("Users", "CRM", "360° customers, pipelines and service."),
      F("Network", "SCM", "End-to-end supply chain visibility."),
      F("UserCog", "HRMS", "Employees, attendance, leave and shifts."),
      F("Wallet", "Payroll", "Salary processing, loans, claims and compliance."),
      F("Building", "Asset Management", "Fixed-asset register, depreciation and AMC."),
      F("Wrench", "Service Management", "Tickets, warranty and field service."),
      F("KanbanSquare", "Project Management", "Tasks, milestones and costing."),
      F("BadgeCheck", "Quality Management", "Inspections, QC and compliance."),
      F("GitPullRequest", "Approval Workflow", "Configurable multi-level approvals."),
      F("FileText", "Document Management", "Attach, version and control documents."),
      F("BarChart3", "Analytics & BI", "Live dashboards and drill-down reports."),
    ],
  },
  finance: {
    title: "Finance & GST, done right", subtitle: "A complete finance suite with statutory GST compliance out of the box.",
    items: [
      F("BookOpen", "General Ledger", "Real-time double-entry accounting."),
      F("ArrowDownCircle", "Accounts Payable", "Supplier bills, ageing and payments."),
      F("ArrowUpCircle", "Accounts Receivable", "Customer outstanding and collections."),
      F("Wallet", "Cash & Bank", "Cash books, bank reconciliation and fund transfers."),
      F("CreditCard", "Payments & Receipts", "Every money movement, tracked."),
      F("Coins", "Expense & Budget", "Expense heads, petty cash and budgeting."),
      F("Building", "Fixed Assets", "Asset register and depreciation."),
      F("ReceiptText", "GST Returns", "GSTR-1, 2B, 3B and annual GSTR-9."),
      F("FileCheck", "E-Invoice & E-Way Bill", "IRN generation and transport docs."),
      F("Percent", "Input Tax Credit", "ITC reconciliation and matching."),
      F("FileBarChart", "Financial Statements", "P&L, Balance Sheet, Cash Flow, Trial Balance."),
      F("ShieldCheck", "Tax Reports", "Audit-ready statutory reporting."),
    ],
  },
  hr: {
    title: "HR & Payroll", subtitle: "Manage your people from hire to retire.",
    items: [
      F("Users", "Employee Management", "Complete employee lifecycle records."),
      F("Clock", "Attendance & Shift", "Biometric, shifts and rosters."),
      F("CalendarDays", "Leave & Holiday", "Policies, balances and approvals."),
      F("Wallet", "Payroll", "Automated salary processing and payslips."),
      F("HandCoins", "Loans & Advances", "Employee loans and recovery."),
      F("Receipt", "Claims & Reimbursement", "Expense claims and approvals."),
      F("TrendingUp", "Performance", "Goals, appraisals and reviews."),
      F("GraduationCap", "Training & Recruitment", "Hiring pipeline and L&D."),
      F("Smartphone", "Employee Self-Service", "Payslips, leave and requests on mobile."),
    ],
  },
  cx: {
    title: "Customer Experience Platform", subtitle: "A branded mobile app that turns customers into loyal fans.",
    items: [
      F("Smartphone", "Customer Mobile App", "Your brand, in your customers' pocket."),
      F("History", "Purchase History", "Every order, always accessible."),
      F("FileText", "Digital Bills & Invoices", "Paperless bills and downloads."),
      F("Truck", "Order & Delivery Tracking", "Live status from cart to doorstep."),
      F("ShieldCheck", "Warranty & Service", "Register warranty, raise service requests."),
      F("MessageSquareWarning", "Complaint Management", "Fast, tracked resolution."),
      F("Gift", "Loyalty & Membership", "Points, tiers and exclusive perks."),
      F("Ticket", "Coupons & Gift Vouchers", "Digital offers and stored value."),
      F("UserPlus", "Referrals", "Reward customers for growing your base."),
      F("Wallet", "Customer Wallet", "Prepaid balance and cashback."),
    ],
  },
  aiAssistant: {
    title: "AI Shopping Assistant", subtitle: "Predictive, personal shopping that drives repeat revenue.",
    items: [
      F("Brain", "Purchase Pattern Analysis", "Understands what each customer buys."),
      F("BellRing", "Auto Shopping Reminders", "Nudges before they run out."),
      F("ShoppingCart", "Auto Cart & Smart Reorder", "One-tap reorder of the usual basket."),
      F("Gauge", "Consumption Prediction", "Forecasts when items will deplete."),
      F("Sparkles", "Recommendations", "Cross-sell, up-sell and seasonal picks."),
      F("PiggyBank", "Budget & Insights", "Spend analysis and savings tips."),
      F("Mic", "Voice Assistant", "Shop and search by voice."),
    ],
  },
  marketing: {
    title: "Marketing Automation", subtitle: "Design, target and measure campaigns — with AI doing the heavy lifting.",
    items: [
      F("Megaphone", "Campaign Management", "Plan, launch and track campaigns."),
      F("Palette", "Campaign & Promotion Designer", "Visual builders for offers."),
      F("Ticket", "Coupon & Promo Campaigns", "Rule-driven discount engines."),
      F("Gift", "Loyalty & Membership Campaigns", "Grow retention programs."),
      F("Users", "Segmentation & Targeting", "Reach the right audience."),
      F("Sparkles", "AI Campaign & Message Creation", "Generate copy and creatives."),
      F("Mail", "Email · SMS · WhatsApp", "Omnichannel messaging."),
      F("BellRing", "Push & Social", "Notifications and social integration."),
      F("BarChart3", "Campaign Analytics & ROI", "Measure what works."),
    ],
  },
  benefits: {
    title: "Customer Benefits & Rewards", subtitle: "Everything you need to reward and retain customers.",
    items: [
      F("Star", "Loyalty & Reward Points", "Earn-and-burn points engine."),
      F("BadgeCheck", "Membership Tiers", "Paid and free membership levels."),
      F("Ticket", "Coupons & Promo Codes", "Targeted, trackable discounts."),
      F("Gift", "Gift Vouchers", "Stored-value prepaid instruments."),
      F("Wallet", "Cashback", "Instant and deferred cashback."),
      F("UserPlus", "Referral Rewards", "Turn customers into advocates."),
      F("Cake", "Birthday & Anniversary", "Automated milestone offers."),
      F("PartyPopper", "Festival Offers", "Seasonal campaign automation."),
    ],
  },
  ecommerce: {
    title: "E-Commerce, in sync", subtitle: "An online store and app that stay perfectly in sync with your ERP.",
    items: [
      F("Store", "Online Store & App", "Sell online with your branded storefront."),
      F("ShoppingCart", "Cart, Checkout & Wishlist", "Frictionless buying."),
      F("Truck", "Order Tracking", "Real-time fulfilment status."),
      F("RefreshCw", "Inventory & Price Sync", "Single source of truth."),
      F("Boxes", "Product Sync", "Catalog managed once, everywhere."),
      F("Users", "Customer Sync", "Unified customer across channels."),
      F("Ticket", "Coupon & Loyalty Sync", "Consistent offers online and in-store."),
    ],
  },
  integrations: {
    title: "Banking, Delivery & Communication", subtitle: "Connected to the services your business runs on.",
    items: [
      F("CreditCard", "Payment Gateway", "UPI, cards, net-banking and wallets."),
      F("Landmark", "Bank Integration", "Auto bank feeds and reconciliation."),
      F("Truck", "Delivery Integration", "3PL partners and internal delivery."),
      F("MapPin", "Route Planning & Live Tracking", "Optimised, tracked deliveries."),
      F("ShieldCheck", "Delivery OTP & POD", "Secure proof of delivery."),
      F("MessageSquare", "SMS · Email · WhatsApp", "Omnichannel communication."),
      F("Phone", "Voice & In-App", "Calls and in-app notifications."),
      F("Languages", "Multi-Language", "Reach customers in their language."),
    ],
  },
  ai: {
    title: "The AI Platform", subtitle: "Intelligence woven through the entire platform.",
    items: [
      F("LayoutDashboard", "AI Dashboard", "Live business command center."),
      F("Bot", "AI Chatbot", "Conversational help and actions."),
      F("BarChart3", "AI Analytics", "Automatic insight generation."),
      F("TrendingUp", "Demand & Sales Forecast", "Predict what sells, when."),
      F("Truck", "Purchase Forecast", "Buy the right stock at the right time."),
      F("Boxes", "Inventory Optimization", "Reduce dead stock and stock-outs."),
      F("HeartPulse", "Business Health Score", "One number for how you're doing."),
      F("Sparkles", "Smart Recommendations", "Next-best actions everywhere."),
      F("FileText", "Natural-Language Reports", "Ask questions, get answers."),
    ],
  },
  industries: {
    title: "Industries We Serve", subtitle: "Purpose-built for every retail vertical — with the right masters, taxes and workflows out of the box.",
    items: [
      { icon: "Store", name: "Supermarket & Hypermarket", blurb: "High-volume POS & fresh inventory.", color: "#6366f1" },
      { icon: "Pill", name: "Pharmacy & Medical Stores", blurb: "Batch, expiry & schedule compliance.", color: "#10b981" },
      { icon: "Smartphone", name: "Electronics & Mobile Stores", blurb: "Serial, IMEI & warranty tracking.", color: "#3b82f6" },
      { icon: "Shirt", name: "Garments & Fashion", blurb: "Size/colour matrix & seasons.", color: "#ec4899" },
      { icon: "ShoppingBag", name: "Footwear & Accessories", blurb: "Article-wise stock & offers.", color: "#f59e0b" },
      { icon: "Sofa", name: "Home Appliance & Furniture", blurb: "Made-to-order & delivery.", color: "#8b5cf6" },
      { icon: "ShoppingCart", name: "Grocery & Provision Stores", blurb: "Fast billing & loyalty.", color: "#22c55e" },
      { icon: "BookOpen", name: "Books, Stationery & Gifts", blurb: "Barcode catalog & bundles.", color: "#06b6d4" },
      { icon: "HeartPulse", name: "Sports & Fitness Stores", blurb: "Brand, size & membership.", color: "#ef4444" },
      { icon: "Sparkles", name: "Cosmetics & Beauty", blurb: "Batch, expiry & combos.", color: "#d946ef" },
      { icon: "Building2", name: "Department Stores & Lifestyle", blurb: "Multi-category & counters.", color: "#0ea5e9" },
    ],
  },
  tech: {
    title: "Built on modern technology", subtitle: "A fast, secure, cloud-native, API-first architecture.",
    items: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Prisma", "MySQL", "REST API", "Cloud Architecture", "Microservice-Ready", "AI-Ready"],
  },
  testimonials: {
    title: "Trusted by growing businesses", subtitle: "Teams run their whole operation on Oasys ERP.",
    items: [
      { quote: "We replaced five tools with Oasys ERP. Billing, GST, inventory and loyalty finally live in one place.", author: "Priya Sharma", role: "Director", company: "FreshMart Chain" },
      { quote: "The AI reorder suggestions cut our dead stock by 30% in the first quarter.", author: "Arjun Mehta", role: "Operations Head", company: "TechBazaR" },
      { quote: "GST returns that used to take days now take minutes. Our accountant loves it.", author: "Sunita Rao", role: "Finance Manager", company: "UrbanStyle" },
    ],
  },
  pricing: {
    title: "Trusted Pricing. Powerful Platform.", subtitle: "Choose the plan that's right for your business.",
    plans: [
      { name: "Starter", price: "₹999", period: "/month", tagline: "Perfect for small businesses", features: ["Up to 5 Users", "All Core Modules", "1 Branch", "Email Support"], cta: { label: "Start Free Trial", href: "/contact?type=trial&plan=Starter", style: "outline" } },
      { name: "Professional", price: "₹2,999", period: "/month", tagline: "For growing businesses", featured: true, features: ["Up to 20 Users", "All Modules", "5 Branches", "Priority Support"], cta: { label: "Start Free Trial", href: "/contact?type=trial&plan=Professional", style: "primary" } },
      { name: "Enterprise", price: "₹6,999", period: "/month", tagline: "For large organizations", features: ["Unlimited Users", "All Modules", "Unlimited Branches", "24/7 Premium Support"], cta: { label: "Start Free Trial", href: "/contact?type=trial&plan=Enterprise", style: "outline" } },
      { name: "Ultimate", price: "Custom", period: "Pricing", tagline: "For enterprises with custom needs", features: ["Unlimited Users", "All Modules", "Dedicated Support", "Custom Integrations"], cta: { label: "Contact Sales", href: "/contact?type=demo&plan=Ultimate", style: "outline" } },
    ],
  },
  faq: {
    title: "Frequently asked questions", subtitle: "Everything you need to know before you start.",
    items: [
      { q: "Is Oasys ERP cloud or on-premise?", a: "Both. Start in the cloud and move on-premise anytime — same product, same data model." },
      { q: "Do I need technical skills to set up?", a: "No. Guided setup gets you billing in minutes, and our team helps with onboarding." },
      { q: "Is GST and e-invoicing included?", a: "Yes. GSTR-1/2B/3B/9, e-invoice (IRN) and e-way bill are built in." },
      { q: "Can I manage multiple stores and companies?", a: "Yes — multi-company, multi-branch and multi-tenant are core to the platform." },
      { q: "Is there a customer mobile app?", a: "Yes, a branded customer app with orders, loyalty, wallet and an AI shopping assistant." },
      { q: "Can I try before I buy?", a: "Absolutely — start a 14-day free trial with no credit card required." },
    ],
  },
  cta: {
    title: "Ready to Transform Your Business?", subtitle: "Join thousands of businesses already growing with Oasys ERP.",
    primaryCta: { label: "Start Free Trial", href: "/contact?type=trial", style: "primary" },
    secondaryCta: { label: "Book Live Demo", href: "/contact?type=demo", style: "outline" },
  },
  footer: {
    about: "An AI-powered unified business platform to manage your entire business from one intelligent system.",
    columns: [
      { title: "Platform", links: [{ label: "ERP Modules", href: "/modules" }, { label: "AI Platform", href: "/modules/analytics" }, { label: "Customer App", href: "/#customerApp" }, { label: "E-Commerce", href: "/modules" }, { label: "Integrations", href: "/#integrationLogos" }, { label: "API", href: "/contact" }] },
      { title: "Solutions", links: [{ label: "Retail", href: "/#industries" }, { label: "Pharmacy", href: "/#industries" }, { label: "Manufacturing", href: "/#industries" }, { label: "Distribution", href: "/#industries" }, { label: "Healthcare", href: "/#industries" }, { label: "All Industries", href: "/#industries" }] },
      { title: "Resources", links: [{ label: "Documentation", href: "/contact" }, { label: "Blog", href: "/#blog" }, { label: "Case Studies", href: "/contact" }, { label: "Videos", href: "/contact" }, { label: "Help Center", href: "/contact" }, { label: "Community", href: "/contact" }] },
      { title: "Company", links: [{ label: "About Us", href: "/contact" }, { label: "Careers", href: "/contact" }, { label: "Partners", href: "/contact" }, { label: "Pricing", href: "/pricing" }, { label: "Privacy Policy", href: "/contact" }, { label: "Terms of Service", href: "/contact" }] },
    ],
    social: [{ label: "Facebook", href: "#" }, { label: "X", href: "#" }, { label: "LinkedIn", href: "#" }, { label: "Instagram", href: "#" }, { label: "YouTube", href: "#" }],
    contactEmail: "info@oasysorbit.com", contactPhone: "+91 98765 43210", address: "Chennai, India",
    copyright: "© 2026 Oasys ERP. Made with ❤ for Businesses Worldwide.",
  },
  seo: {
    title: "Oasys ERP — AI-Powered Unified Business Platform",
    description: "ERP, Finance, GST, HR & Payroll, Manufacturing, CRM, POS, E-Commerce, Customer App, Marketing Automation and AI — unified in one cloud-native platform.",
    keywords: "ERP, GST software, POS, retail ERP, cloud ERP, business platform, inventory, accounting, CRM, loyalty, e-commerce, AI",
  },
  homeSections: [
    { id: "hero", enabled: true },
    { id: "retailShowcase", enabled: true },
    { id: "everything", enabled: true },
    { id: "realtime", enabled: true },
    { id: "aiMarketing", enabled: true },
    { id: "customerApp", enabled: true },
    { id: "industries", enabled: true },
    { id: "trustedLogos", enabled: true },
    { id: "stats", enabled: true },
    { id: "integrationLogos", enabled: true },
    { id: "tech", enabled: true },
    { id: "cta", enabled: true },
    // Available but off by default (toggle on in the Homepage Builder):
    { id: "erpIndustries", enabled: false },
    { id: "pricing", enabled: false },
    { id: "blog", enabled: false },
    { id: "spotlights", enabled: false },
    { id: "why", enabled: false },
    { id: "finance", enabled: false },
    { id: "cx", enabled: false },
    { id: "ai", enabled: false },
    { id: "testimonials", enabled: false },
    { id: "faq", enabled: false },
  ],
};

/** Human labels for the Homepage Builder section list. */
export const SECTION_LABELS: Record<string, string> = {
  hero: "Hero Banner", retailShowcase: "Retail Showcase", everything: "Module Strip", realtime: "Real-Time Insights", erpIndustries: "ERP + Industries", customerApp: "Customer App",
  aiMarketing: "AI & Marketing", trustedLogos: "Trusted Logos", stats: "Stats Band", pricing: "Pricing", blog: "Blog / Insights",
  integrationLogos: "Integrations", cta: "Call to Action",
  logos: "Customer Logos", spotlights: "Feature Spotlights", why: "Why Oasys ERP", platform: "ERP Platform",
  finance: "Finance & GST", hr: "HR & Payroll", cx: "Customer Experience", aiAssistant: "AI Shopping Assistant",
  marketing: "Marketing Automation", benefits: "Customer Benefits", ecommerce: "E-Commerce",
  integrations: "Banking · Delivery · Communication", ai: "AI Platform", industries: "Industries",
  tech: "Technology", testimonials: "Customer Success", faq: "FAQ",
};

/** Shallow-merge a stored (possibly partial) config over the defaults so the site
 *  never breaks when the CMS has only edited some keys or the schema has grown. */
export function mergeConfig(stored: Partial<WebsiteConfig> | null | undefined): WebsiteConfig {
  if (!stored || typeof stored !== "object") return DEFAULT_WEBSITE_CONFIG;
  const d = DEFAULT_WEBSITE_CONFIG;
  const s = stored as Record<string, unknown>;
  const out = { ...d } as Record<string, unknown>;
  for (const k of Object.keys(d) as (keyof WebsiteConfig)[]) {
    const v = s[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) out[k] = v;
    else if (typeof v === "object" && typeof d[k] === "object" && !Array.isArray(d[k])) out[k] = { ...(d[k] as object), ...(v as object) };
    else out[k] = v;
  }
  // Reconcile the homepage section list so newly-shipped sections appear for
  // existing (already-published) configs, and removed sections drop out — while
  // preserving the owner's ordering/enabled choices for sections they still have.
  if (Array.isArray(s.homeSections)) {
    out.homeSections = reconcileSections(s.homeSections as HomeSection[], d.homeSections);
  }
  return out as unknown as WebsiteConfig;
}

function reconcileSections(stored: HomeSection[], def: HomeSection[]): HomeSection[] {
  const storedIds = new Set(stored.map((x) => x.id));
  const result = stored.filter((x) => def.some((y) => y.id === x.id)); // drop stale
  def.forEach((dSec, idx) => { if (!storedIds.has(dSec.id)) result.splice(Math.min(idx, result.length), 0, { ...dSec }); });
  return result;
}
