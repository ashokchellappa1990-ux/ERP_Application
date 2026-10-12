import {
  LayoutDashboard, Settings2, Award, Crown, Coins, ArrowUpCircle, ArrowDownCircle,
  Wallet, Gift, Share2, Cake, Heart, Megaphone, GitBranch, BarChart3, UserCircle,
  ShoppingCart, Smartphone, Sparkles, FileBarChart, type LucideIcon,
} from "lucide-react";
import { ly, lyFlag } from "./loyaltyConfig";

/* ===================================================== feature catalog == */
export interface LyFeature { key: string; label: string; href: string; icon: LucideIcon; desc: string; group: string }
export const LOYALTY_FEATURES: LyFeature[] = [
  { key: "dashboard", label: "Loyalty Dashboard", href: "/loyalty", icon: LayoutDashboard, desc: "Members, points, redemptions & retention.", group: "Overview" },
  { key: "configuration", label: "Loyalty Configuration", href: "/loyalty/configuration", icon: Settings2, desc: "Enable programs & defaults.", group: "Overview" },
  { key: "program", label: "Loyalty Program Master", href: "/loyalty/program", icon: Award, desc: "Define loyalty programs.", group: "Setup" },
  { key: "tiers", label: "Membership Tiers", href: "/loyalty/tiers", icon: Crown, desc: "Silver → VIP tiers & benefits.", group: "Setup" },
  { key: "point-config", label: "Point Configuration", href: "/loyalty/point-config", icon: Coins, desc: "Calc method, value & expiry.", group: "Points" },
  { key: "earning", label: "Point Earning Rules", href: "/loyalty/earning", icon: ArrowUpCircle, desc: "Earn rules & multipliers.", group: "Points" },
  { key: "redemption", label: "Point Redemption Rules", href: "/loyalty/redemption", icon: ArrowDownCircle, desc: "Redeem as discount / voucher.", group: "Points" },
  { key: "cashback", label: "Cashback Configuration", href: "/loyalty/cashback", icon: Coins, desc: "Fixed / % cashback timing.", group: "Rewards" },
  { key: "wallet", label: "Customer Wallet", href: "/loyalty/wallet", icon: Wallet, desc: "Loyalty / cashback / gift wallets.", group: "Rewards" },
  { key: "gift-card", label: "Gift Card Management", href: "/loyalty/gift-card", icon: Gift, desc: "Physical & digital gift cards.", group: "Rewards" },
  { key: "referral", label: "Referral Program", href: "/loyalty/referral", icon: Share2, desc: "Referrer & referee rewards.", group: "Rewards" },
  { key: "birthday", label: "Birthday Rewards", href: "/loyalty/birthday", icon: Cake, desc: "Auto birthday rewards.", group: "Occasions" },
  { key: "anniversary", label: "Anniversary Rewards", href: "/loyalty/anniversary", icon: Heart, desc: "Auto anniversary rewards.", group: "Occasions" },
  { key: "campaign", label: "Campaign Loyalty", href: "/loyalty/campaign", icon: Megaphone, desc: "Festival & category campaigns.", group: "Occasions" },
  { key: "approval", label: "Approval Workflow", href: "/loyalty/approval", icon: GitBranch, desc: "Manual adjustments approval.", group: "Governance" },
  { key: "profile", label: "Customer Loyalty Profile", href: "/loyalty/profile", icon: UserCircle, desc: "360° loyalty per customer.", group: "Customers" },
  { key: "pos-integration", label: "POS Loyalty Integration", href: "/loyalty/pos-integration", icon: ShoppingCart, desc: "Earn & redeem at billing.", group: "Channels" },
  { key: "mobile-integration", label: "Mobile Integration", href: "/loyalty/mobile-integration", icon: Smartphone, desc: "App & customer portal.", group: "Channels" },
  { key: "ai", label: "AI Loyalty Engine", href: "/loyalty/ai", icon: Sparkles, desc: "Win-back, upsell & retention.", group: "Insights" },
  { key: "analytics", label: "Loyalty Analytics", href: "/loyalty/analytics", icon: BarChart3, desc: "Issued, redeemed & retention.", group: "Insights" },
  { key: "reports", label: "Loyalty Reports", href: "/loyalty/reports", icon: FileBarChart, desc: "Points, wallet, tier & campaign.", group: "Insights" },
];

/* ============================================ setup workflow (dashboard) */
export interface SetupStep { phase: string; title: string; href: string; icon: LucideIcon; todo: string }
export const LOYALTY_SETUP_FLOW: SetupStep[] = [
  { phase: "1 · Configure", title: "Loyalty Configuration", href: "/loyalty/configuration", icon: Settings2, todo: "Turn loyalty ON and pick the reward types — points, cashback, membership, referral, campaign." },
  { phase: "1 · Configure", title: "Point Configuration", href: "/loyalty/point-config", icon: Coins, todo: "Set the earn rate (₹100 = N points), the point value (₹/point) and expiry." },
  { phase: "2 · Build the program", title: "Loyalty Program Master", href: "/loyalty/program", icon: Award, todo: "Create the program (the container for rules) and mark one as default." },
  { phase: "2 · Build the program", title: "Membership Tiers", href: "/loyalty/tiers", icon: Crown, todo: "Define Silver → VIP tiers with spend thresholds, multipliers & benefits." },
  { phase: "2 · Build the program", title: "Point Earning Rules", href: "/loyalty/earning", icon: ArrowUpCircle, todo: "Add base earning + double / triple / festival multipliers." },
  { phase: "2 · Build the program", title: "Point Redemption Rules", href: "/loyalty/redemption", icon: ArrowDownCircle, todo: "Allow points to redeem as discount / voucher / cashback / wallet, with caps." },
  { phase: "3 · Add rewards (optional)", title: "Cashback / Gift Cards / Referral", href: "/loyalty/cashback", icon: Gift, todo: "Layer cashback %, issue gift cards and reward referrals." },
  { phase: "3 · Add rewards (optional)", title: "Occasion & Campaign Rewards", href: "/loyalty/campaign", icon: Megaphone, todo: "Auto birthday / anniversary rewards and festival campaigns." },
  { phase: "4 · Go live", title: "POS Loyalty Integration", href: "/loyalty/pos-integration", icon: ShoppingCart, todo: "Customers now earn & redeem automatically on every bill." },
  { phase: "5 · Operate & grow", title: "Wallet · Profile · Analytics · AI", href: "/loyalty/analytics", icon: BarChart3, todo: "Track wallets & 360° profiles, watch analytics and run AI win-back campaigns." },
];

/* ===================================================== dashboard ======= */
export const LOYALTY_STATS = {
  activeMembers: 8420, pointsIssued: 1284500, pointsRedeemed: 642300, walletBalance: 1860000,
  giftCardsActive: 320, referrals: 184, retentionRate: 78, redemptionRate: 50,
};
export const TIER_DISTRIBUTION = [
  { label: "Silver", value: 52, tone: "neutral" as const },
  { label: "Gold", value: 28, tone: "warning" as const },
  { label: "Platinum", value: 13, tone: "secondary" as const },
  { label: "Diamond", value: 5, tone: "primary" as const },
  { label: "VIP", value: 2, tone: "success" as const },
];

/* ===================================================== tiers =========== */
export interface Tier { name: string; qualify: string; pointMult: string; discount: string; benefits: string[] }
export const TIERS: Tier[] = [
  { name: "Silver", qualify: "₹0 – ₹25k / yr", pointMult: "1×", discount: "—", benefits: ["Base points"] },
  { name: "Gold", qualify: "₹25k – ₹75k / yr", pointMult: "1.5×", discount: "2%", benefits: ["1.5× points", "2% extra discount"] },
  { name: "Platinum", qualify: "₹75k – ₹2L / yr", pointMult: "2×", discount: "5%", benefits: ["2× points", "5% discount", "Free gift"] },
  { name: "Diamond", qualify: "₹2L – ₹5L / yr", pointMult: "2.5×", discount: "7%", benefits: ["2.5× points", "Priority service", "Cashback bonus"] },
  { name: "VIP", qualify: "₹5L+ / yr", pointMult: "3×", discount: "10%", benefits: ["3× points", "10% discount", "Dedicated manager"] },
];

/* ============================================= per-feature list config == */
export interface LColumn { key: string; label: string; align?: "right" | "center"; kind?: "status" | "amount" | "badge" }
export interface LKpi { label: string; value: string; tone: "primary" | "secondary" | "success" | "warning" | "danger" | "accent" }
export interface LyListConfig { title: string; desc: string; newLabel?: string; kpis: LKpi[]; columns: LColumn[]; statuses: string[]; rows: Record<string, string | number>[] }
const amt = (key: string, label: string): LColumn => ({ key, label, align: "right", kind: "amount" });
const st: LColumn = { key: "status", label: "Status", align: "center", kind: "status" };

export const LOYALTY_LISTS: Record<string, LyListConfig> = {
  program: { title: "Loyalty Program Master", desc: "Define point / cashback / membership / referral / campaign programs.", newLabel: "New Program",
    kpis: [{ label: "Programs", value: "6", tone: "primary" }, { label: "Active", value: "5", tone: "success" }, { label: "Members", value: "8,420", tone: "secondary" }, { label: "Default", value: "ONE Rewards", tone: "accent" }],
    columns: [{ key: "code", label: "Code" }, { key: "name", label: "Program" }, { key: "type", label: "Type", align: "center", kind: "badge" }, { key: "valid", label: "Validity" }, st],
    statuses: ["Draft", "Active", "Inactive"],
    rows: [
      { code: "LP-001", name: "ONE Rewards", type: "Point Based", valid: "Ongoing", status: "Active" },
      { code: "LP-002", name: "Cashback Plus", type: "Cashback", valid: "Ongoing", status: "Active" },
      { code: "LP-003", name: "Elite Membership", type: "Membership", valid: "Ongoing", status: "Active" },
      { code: "LP-004", name: "Refer & Earn", type: "Referral", valid: "Ongoing", status: "Active" },
      { code: "LP-005", name: "Diwali Bonanza", type: "Campaign", valid: "20-Oct → 05-Nov", status: "Draft" },
    ] },
  tiers: { title: "Membership Tiers", desc: "Silver → VIP tiers with qualification & benefits.", newLabel: "New Tier",
    kpis: [{ label: "Tiers", value: "5", tone: "primary" }, { label: "Auto-Upgrade", value: "On", tone: "success" }, { label: "Top Tier Members", value: "168", tone: "secondary" }, { label: "Upgrades (MTD)", value: "94", tone: "warning" }],
    columns: [{ key: "name", label: "Tier" }, { key: "qualify", label: "Qualification" }, { key: "pointMult", label: "Points", align: "center", kind: "badge" }, { key: "discount", label: "Discount", align: "center" }, { key: "members", label: "Members", align: "right" }],
    statuses: ["Active"],
    rows: TIERS.map((t, i) => ({ name: t.name, qualify: t.qualify, pointMult: t.pointMult, discount: t.discount, members: [4380, 2360, 1090, 420, 170][i], status: "Active" })) },
  earning: { title: "Point Earning Rules", desc: "Earn rules by value / product / category / tier with multipliers.", newLabel: "New Earning Rule",
    kpis: [{ label: "Active Rules", value: "18", tone: "primary" }, { label: "Base Rate", value: "₹100 = 2pt", tone: "secondary" }, { label: "Multiplier Rules", value: "6", tone: "warning" }, { label: "Festival Live", value: "1", tone: "accent" }],
    columns: [{ key: "rule", label: "Rule" }, { key: "basis", label: "Basis", align: "center", kind: "badge" }, { key: "earn", label: "Earn" }, { key: "mult", label: "Multiplier", align: "center", kind: "badge" }, st],
    statuses: ["Active", "Scheduled", "Inactive"],
    rows: [
      { rule: "Base — Invoice Value", basis: "Invoice", earn: "₹100 = 2 pts", mult: "1×", status: "Active" },
      { rule: "Electronics Double Points", basis: "Category", earn: "₹100 = 2 pts", mult: "2×", status: "Active" },
      { rule: "Gold+ Tier Bonus", basis: "Tier", earn: "+50% points", mult: "1.5×", status: "Active" },
      { rule: "Diwali Triple Points", basis: "Promotion", earn: "₹100 = 2 pts", mult: "3×", status: "Scheduled" },
    ] },
  redemption: { title: "Point Redemption Rules", desc: "Redeem points as discount / voucher / cashback / wallet credit.", newLabel: "New Redemption Rule",
    kpis: [{ label: "Active Rules", value: "9", tone: "primary" }, { label: "Point Value", value: "₹0.25", tone: "secondary" }, { label: "Max Redeem", value: "20%", tone: "warning" }, { label: "Redeemed (MTD)", value: "₹1.6L", tone: "success" }],
    columns: [{ key: "rule", label: "Rule" }, { key: "type", label: "Redeem As", align: "center", kind: "badge" }, { key: "min", label: "Min Pts", align: "right" }, { key: "max", label: "Max", align: "center" }, st],
    statuses: ["Active", "Inactive"],
    rows: [
      { rule: "Cash Discount at POS", type: "Cash Discount", min: 100, max: "20% of bill", status: "Active" },
      { rule: "Gift Voucher", type: "Gift Voucher", min: 500, max: "₹2,000", status: "Active" },
      { rule: "Wallet Credit", type: "Wallet Credit", min: 200, max: "No cap", status: "Active" },
    ] },
  wallet: { title: "Customer Wallet", desc: "Loyalty / cashback / gift-card / promotional wallet balances.", newLabel: "Wallet Adjustment",
    kpis: [{ label: "Total Balance", value: "₹18.6L", tone: "primary" }, { label: "Loyalty Wallet", value: "₹9.2L", tone: "secondary" }, { label: "Cashback Wallet", value: "₹6.1L", tone: "success" }, { label: "Gift Wallet", value: "₹3.3L", tone: "accent" }],
    columns: [{ key: "customer", label: "Customer" }, { key: "type", label: "Wallet", align: "center", kind: "badge" }, amt("balance", "Balance"), amt("earned", "Earned"), amt("used", "Used"), st],
    statuses: ["Active", "Frozen"],
    rows: [
      { customer: "Anand Stores", type: "Loyalty", balance: 4200, earned: 8400, used: 4200, status: "Active" },
      { customer: "Priya R", type: "Cashback", balance: 1850, earned: 3200, used: 1350, status: "Active" },
      { customer: "MGB Hardware", type: "Gift Card", balance: 5000, earned: 5000, used: 0, status: "Active" },
    ] },
  "gift-card": { title: "Gift Card Management", desc: "Issue & track physical / digital gift cards.", newLabel: "Issue Gift Card",
    kpis: [{ label: "Active Cards", value: "320", tone: "primary" }, { label: "Value Loaded", value: "₹8.4L", tone: "secondary" }, { label: "Redeemed", value: "₹5.1L", tone: "success" }, { label: "Expiring Soon", value: "14", tone: "warning" }],
    columns: [{ key: "no", label: "Card No." }, { key: "type", label: "Type", align: "center", kind: "badge" }, amt("value", "Value"), amt("balance", "Balance"), { key: "expiry", label: "Expiry" }, st],
    statuses: ["Active", "Redeemed", "Expired", "Blocked"],
    rows: [
      { no: "GC-100231", type: "Digital", value: 1000, balance: 400, expiry: "31-Dec-2026", status: "Active" },
      { no: "GC-100230", type: "Physical", value: 5000, balance: 5000, expiry: "30-Jun-2027", status: "Active" },
      { no: "GC-100229", type: "Digital", value: 500, balance: 0, expiry: "31-Mar-2026", status: "Redeemed" },
    ] },
  campaign: { title: "Campaign Loyalty", desc: "Festival & category loyalty campaigns with bonus rewards.", newLabel: "New Campaign",
    kpis: [{ label: "Active Campaigns", value: "3", tone: "primary" }, { label: "Participants", value: "2,840", tone: "secondary" }, { label: "Bonus Points", value: "₹6.4L", tone: "warning" }, { label: "Upcoming", value: "2", tone: "accent" }],
    columns: [{ key: "name", label: "Campaign" }, { key: "type", label: "Type", align: "center", kind: "badge" }, { key: "reward", label: "Reward" }, { key: "period", label: "Period" }, st],
    statuses: ["Draft", "Scheduled", "Live", "Ended"],
    rows: [
      { name: "Diwali Bonanza", type: "Festival", reward: "Triple Points", period: "20-Oct → 05-Nov", status: "Scheduled" },
      { name: "Pharmacy Plus", type: "Category", reward: "Double Points", period: "01-Jun → 30-Jun", status: "Live" },
      { name: "New Year Cashback", type: "Festival", reward: "10% Cashback", period: "25-Dec → 05-Jan", status: "Draft" },
    ] },
  approval: { title: "Loyalty Approval Workflow", desc: "Manual point / wallet / cashback / membership / gift-card approvals.",
    kpis: [{ label: "Pending", value: "7", tone: "warning" }, { label: "Approved (MTD)", value: "142", tone: "success" }, { label: "Rejected", value: "9", tone: "danger" }, { label: "Avg TAT", value: "18 min", tone: "secondary" }],
    columns: [{ key: "no", label: "Request" }, { key: "type", label: "Type", align: "center", kind: "badge" }, { key: "customer", label: "Customer" }, amt("value", "Value"), { key: "by", label: "Raised By" }, st],
    statuses: ["Pending", "Approved", "Rejected"],
    rows: [
      { no: "APR/0231", type: "Point Adjustment", customer: "Anand Stores", value: 500, by: "cashier.meena", status: "Pending" },
      { no: "APR/0230", type: "Wallet Credit", customer: "Priya R", value: 1000, by: "store.mgr", status: "Pending" },
      { no: "APR/0229", type: "Gift Card Issue", customer: "MGB Hardware", value: 5000, by: "admin", status: "Approved" },
    ] },
  profile: { title: "Customer Loyalty Profile", desc: "360° loyalty — tier, points, wallet, LTV & referrals per customer.",
    kpis: [{ label: "Members", value: "8,420", tone: "primary" }, { label: "Avg LTV", value: "₹42k", tone: "secondary" }, { label: "Avg Points", value: "1,240", tone: "success" }, { label: "At-Risk", value: "186", tone: "danger" }],
    columns: [{ key: "customer", label: "Customer" }, { key: "tier", label: "Tier", align: "center", kind: "badge" }, { key: "points", label: "Points", align: "right" }, amt("wallet", "Wallet"), amt("ltv", "Lifetime Value"), { key: "referrals", label: "Referrals", align: "center" }],
    statuses: ["Active", "At-Risk", "Lapsed"],
    rows: [
      { customer: "Anand Stores", tier: "Platinum", points: 4200, wallet: 4200, ltv: 248000, referrals: 6, status: "Active" },
      { customer: "Priya R", tier: "Gold", points: 1850, wallet: 1850, ltv: 86000, referrals: 2, status: "Active" },
      { customer: "Kumar S", tier: "Silver", points: 240, wallet: 0, ltv: 18000, referrals: 0, status: "At-Risk" },
    ] },
};

/* ================================================ form metas =========== */
export interface LFormField { key: string; label: string; type: "text" | "date" | "number" | "select" | "textarea"; options?: string[]; full?: boolean; required?: boolean }
export interface LyFormMeta { saveLabel: string; prefix: string; fields: LFormField[] }
export const LOYALTY_FORM_META: Record<string, LyFormMeta> = {
  program: { saveLabel: "Save Program", prefix: "LP", fields: [
    { key: "code", label: "Program Code", type: "text", required: true }, { key: "name", label: "Program Name", type: "text", required: true }, { key: "type", label: "Program Type", type: "select", options: ["Point Based", "Cashback", "Membership", "Referral", "Campaign"], required: true }, { key: "start", label: "Start Date", type: "date" }, { key: "end", label: "End Date", type: "date" }, { key: "status", label: "Status", type: "select", options: ["Draft", "Active", "Inactive"] }, { key: "description", label: "Description", type: "textarea", full: true } ] },
  tiers: { saveLabel: "Save Tier", prefix: "TIER", fields: [
    { key: "name", label: "Tier Name", type: "select", options: ["Silver", "Gold", "Platinum", "Diamond", "VIP"], required: true }, { key: "qualifyFrom", label: "Qualify From (₹/yr)", type: "number", required: true }, { key: "qualifyTo", label: "Qualify To (₹/yr)", type: "number" }, { key: "pointMult", label: "Point Multiplier", type: "number" }, { key: "discount", label: "Extra Discount %", type: "number" }, { key: "cashbackBonus", label: "Cashback Bonus %", type: "number" }, { key: "freeGift", label: "Free Gift", type: "text" }, { key: "validity", label: "Tier Validity (months)", type: "number" } ] },
  earning: { saveLabel: "Save Rule", prefix: "ER", fields: [
    { key: "name", label: "Rule Name", type: "text", required: true }, { key: "basis", label: "Basis", type: "select", options: ["Invoice Value", "Product", "Category", "Brand", "Customer Group", "Membership Tier", "Branch", "Promotion"], required: true }, { key: "target", label: "Applies To", type: "text" }, { key: "per100", label: "Points per ₹100", type: "number" }, { key: "multiplier", label: "Multiplier", type: "select", options: ["1×", "2× (Double)", "3× (Triple)", "Festival"] }, { key: "start", label: "Start", type: "date" }, { key: "end", label: "End", type: "date" } ] },
  redemption: { saveLabel: "Save Rule", prefix: "RR", fields: [
    { key: "name", label: "Rule Name", type: "text", required: true }, { key: "type", label: "Redeem As", type: "select", options: ["Cash Discount", "Free Product", "Gift Voucher", "Cashback", "Wallet Credit"], required: true }, { key: "minPoints", label: "Minimum Points", type: "number", required: true }, { key: "maxValue", label: "Maximum Value (₹ / %)", type: "text" }, { key: "redeemPct", label: "Redemption %", type: "number" } ] },
  wallet: { saveLabel: "Save Adjustment", prefix: "WAL", fields: [
    { key: "customer", label: "Customer", type: "text", required: true }, { key: "wallet", label: "Wallet", type: "select", options: ["Loyalty Wallet", "Cashback Wallet", "Gift Card Wallet", "Promotional Wallet"], required: true }, { key: "direction", label: "Credit / Debit", type: "select", options: ["Credit", "Debit"], required: true }, { key: "amount", label: "Amount (₹)", type: "number", required: true }, { key: "reason", label: "Reason", type: "textarea", full: true, required: true } ] },
  "gift-card": { saveLabel: "Issue Gift Card", prefix: "GC", fields: [
    { key: "type", label: "Card Type", type: "select", options: ["Digital", "Physical"], required: true }, { key: "value", label: "Value (₹)", type: "select", options: ["500", "1000", "2000", "5000", "10000"], required: true }, { key: "customer", label: "Issue To", type: "text" }, { key: "expiry", label: "Expiry Date", type: "date" }, { key: "rechargeable", label: "Rechargeable", type: "select", options: ["Yes", "No"] }, { key: "message", label: "Gift Message", type: "textarea", full: true } ] },
  campaign: { saveLabel: "Save Campaign", prefix: "LCMP", fields: [
    { key: "name", label: "Campaign Name", type: "text", required: true }, { key: "type", label: "Campaign Type", type: "select", options: ["Festival", "Category", "Branch", "Tier", "Win-back"], required: true }, { key: "reward", label: "Reward", type: "select", options: ["Double Points", "Triple Points", "Cashback", "Free Gift", "Bonus Voucher"], required: true }, { key: "start", label: "Start Date", type: "date", required: true }, { key: "end", label: "End Date", type: "date" }, { key: "target", label: "Target Segment", type: "text" }, { key: "description", label: "Description", type: "textarea", full: true } ] },
};

/* ================================================ config screens ======= */
export interface CfgField { type: "toggle" | "select" | "number" | "text"; key: string; label: string; desc?: string; options?: string[] }
export interface CfgSection { heading: string; fields: CfgField[] }
export interface CfgPage { title: string; intro: string; sections: CfgSection[] }
export const CONFIG_PAGES: Record<string, CfgPage> = {
  configuration: { title: "Loyalty Configuration", intro: "Enable the loyalty program and choose which reward types are active.", sections: [
    { heading: "Program", fields: [
      { type: "toggle", key: "enabled", label: "Enable Loyalty Program", desc: "Master switch — loyalty runs in real-time at billing." },
      { type: "select", key: "defaultProgram", label: "Default Loyalty Program", options: ["ONE Rewards", "Cashback Plus", "Elite Membership"] },
      { type: "toggle", key: "allowMultiple", label: "Allow Multiple Loyalty Programs", desc: "Run several programs at once." },
    ] },
    { heading: "Program Types", fields: [
      { type: "toggle", key: "pointBased", label: "Point Based" }, { type: "toggle", key: "cashbackBased", label: "Cashback Based" }, { type: "toggle", key: "membershipBased", label: "Membership Based" }, { type: "toggle", key: "referralBased", label: "Referral Based" }, { type: "toggle", key: "campaignBased", label: "Campaign Based" },
    ] },
    { heading: "Channels", fields: [
      { type: "toggle", key: "posIntegration", label: "POS Integration" }, { type: "toggle", key: "mobileApp", label: "Mobile App" }, { type: "toggle", key: "customerPortal", label: "Customer Portal" }, { type: "toggle", key: "aiLoyalty", label: "AI Loyalty Engine" },
    ] },
  ] },
  "point-config": { title: "Point Configuration", intro: "How points are calculated, valued and expired.", sections: [
    { heading: "Calculation", fields: [
      { type: "select", key: "pointCalcMethod", label: "Point Calculation Method", options: ["invoice", "product", "category", "brand", "group"] },
      { type: "number", key: "pointsPer100", label: "Points per ₹100" },
      { type: "number", key: "pointValue", label: "Point Currency Value (₹ per point)" },
    ] },
    { heading: "Expiry & Carry Forward", fields: [
      { type: "toggle", key: "pointExpiry", label: "Points Expire" }, { type: "number", key: "pointExpiryMonths", label: "Expiry (months)" }, { type: "toggle", key: "carryForward", label: "Carry Forward Unused Points" },
    ] },
  ] },
  cashback: { title: "Cashback Configuration", intro: "Cashback method, rate and credit timing.", sections: [
    { heading: "Cashback", fields: [
      { type: "select", key: "cashbackMethod", label: "Method", options: ["percentage", "fixed"] }, { type: "number", key: "cashbackPct", label: "Cashback % (or ₹ if fixed)" }, { type: "select", key: "cashbackTiming", label: "Credit Timing", options: ["immediate", "after_7_days", "after_30_days"] },
    ] },
  ] },
  referral: { title: "Referral Program", intro: "Rewards for referrer and the new customer.", sections: [
    { heading: "Referral Rewards", fields: [
      { type: "toggle", key: "referralBased", label: "Enable Referral Program" }, { type: "number", key: "referrerReward", label: "Referrer Reward (points)" }, { type: "number", key: "newCustReward", label: "New Customer Reward (points)" }, { type: "number", key: "referralPoints", label: "Referral Bonus (points)" },
    ] },
  ] },
  birthday: { title: "Birthday Rewards", intro: "Automatic reward when a customer's birthday arrives.", sections: [
    { heading: "Birthday", fields: [
      { type: "toggle", key: "birthdayAuto", label: "Auto Birthday Reward" }, { type: "number", key: "birthdayReward", label: "Reward (points)" }, { type: "select", key: "birthdayType", label: "Reward Type", options: ["Points", "Cashback", "Coupon", "Free Gift"] },
    ] },
  ] },
  anniversary: { title: "Anniversary Rewards", intro: "Automatic reward on the customer's anniversary date.", sections: [
    { heading: "Anniversary", fields: [
      { type: "toggle", key: "anniversaryAuto", label: "Auto Anniversary Reward" }, { type: "number", key: "anniversaryReward", label: "Reward (points)" }, { type: "select", key: "anniversaryType", label: "Reward Type", options: ["Points", "Cashback", "Coupon", "Free Gift"] },
    ] },
  ] },
};

/* ===================================================== reports ========= */
export const LOYALTY_REPORTS = [
  "Loyalty Summary", "Points Issued", "Points Redeemed", "Points Expiry", "Wallet Report",
  "Gift Card Report", "Referral Report", "Membership Report", "Campaign Report",
  "Customer Loyalty Report", "Tier Upgrade Report",
];

/* ===================================================== flow guides ===== */
export interface LoyaltyGuide { summary: string; flow: string[]; fields: { name: string; purpose: string }[] }
export const LOYALTY_GUIDES: Record<string, LoyaltyGuide> = {
  configuration: {
    summary: "The master switchboard. Turn the loyalty engine on and pick which reward types run. Everything else in Loyalty obeys these switches in real-time at billing.",
    flow: ["Enable Loyalty Program", "Choose active program types", "Set the default program", "POS / Sales apply it on every bill"],
    fields: [
      { name: "Enable Loyalty Program", purpose: "Master on/off. When off, no points/cashback/wallet run anywhere." },
      { name: "Default Loyalty Program", purpose: "The program auto-applied at billing when none is chosen." },
      { name: "Allow Multiple Programs", purpose: "Run several programs at once (e.g. Points + Cashback together)." },
      { name: "Program Types", purpose: "Activate each reward mechanism — Point / Cashback / Membership / Referral / Campaign." },
      { name: "Channels", purpose: "Where loyalty appears — POS, Mobile App, Customer Portal, AI engine." },
    ],
  },
  program: {
    summary: "A Loyalty Program is the container that holds the rules. You create one per mechanism (points, cashback, membership…) and attach earning/redemption rules to it.",
    flow: ["Create program & pick type", "Set validity & status", "Attach earning / redemption rules", "Default program runs at billing"],
    fields: [
      { name: "Program Code / Name", purpose: "Unique identity of the program." },
      { name: "Program Type", purpose: "The mechanism — Point Based, Cashback, Membership, Referral or Campaign." },
      { name: "Validity (Start / End)", purpose: "When the program is live (blank end = ongoing)." },
      { name: "Status", purpose: "Draft → Active → Inactive. Only Active programs reward customers." },
    ],
  },
  tiers: {
    summary: "Membership tiers are the ladder customers climb by spending. Higher tiers earn more points and bigger discounts — driving repeat purchases.",
    flow: ["Customer spends through the year", "Annual spend crosses a tier threshold", "Auto-upgrade to the higher tier", "Tier benefits apply on the next bill", "Validity lapses → downgrade"],
    fields: [
      { name: "Tier Name", purpose: "Silver → Gold → Platinum → Diamond → VIP." },
      { name: "Qualify From / To", purpose: "Annual spend band that places a customer in this tier." },
      { name: "Point Multiplier", purpose: "Points boost vs base (e.g. Platinum = 2×)." },
      { name: "Extra Discount / Cashback Bonus", purpose: "Additional benefits applied at billing for this tier." },
      { name: "Free Gift / Validity", purpose: "Perks and how long the tier stays valid before re-qualification." },
    ],
  },
  "point-config": {
    summary: "Defines the maths of points — how they're earned, what a point is worth in rupees, and when they expire.",
    flow: ["₹ spent at billing", "× points-per-₹100 × tier multiplier", "= points credited to the point wallet", "Expire after N months unless carried forward"],
    fields: [
      { name: "Point Calculation Method", purpose: "Earn on invoice value, or per product / category / brand / customer group." },
      { name: "Points per ₹100", purpose: "Base earn rate (e.g. ₹100 = 2 points)." },
      { name: "Point Currency Value", purpose: "What 1 point is worth when redeemed (e.g. ₹0.25)." },
      { name: "Expiry / Carry Forward", purpose: "How long points live, and whether unused points roll over." },
    ],
  },
  earning: {
    summary: "Earning rules decide how many points a transaction generates — including double/triple/festival multipliers for specific products, categories or tiers.",
    flow: ["Bill is saved", "Matching earning rules are evaluated", "Base points × multipliers applied", "Points credited in real-time"],
    fields: [
      { name: "Basis", purpose: "What the rule keys off — invoice value, product, category, brand, tier, branch or promotion." },
      { name: "Applies To", purpose: "The specific item/category/tier the rule targets." },
      { name: "Points per ₹100", purpose: "Earn rate for this rule." },
      { name: "Multiplier", purpose: "1× / Double / Triple / Festival boost." },
      { name: "Start / End", purpose: "Active window for time-bound (festival) rules." },
    ],
  },
  redemption: {
    summary: "Redemption rules convert points into value at billing — capped so customers can't over-redeem.",
    flow: ["Customer chooses to redeem at POS", "Points × point-value computed", "Capped by min / max & % of bill", "Applied as discount / voucher / cashback / wallet credit"],
    fields: [
      { name: "Redeem As", purpose: "Cash discount, free product, gift voucher, cashback or wallet credit." },
      { name: "Minimum Points", purpose: "Threshold before redemption is allowed." },
      { name: "Maximum Value", purpose: "Cap on the redemption (₹ or %)." },
      { name: "Redemption %", purpose: "Max share of the bill that points can cover." },
    ],
  },
  cashback: {
    summary: "Cashback returns part of the spend to the customer's wallet — instantly or after a holding period.",
    flow: ["Bill saved", "Cashback = % or fixed amount", "Credited immediately or after X days", "Lands in the cashback wallet"],
    fields: [
      { name: "Method", purpose: "Percentage of bill or a fixed ₹ amount." },
      { name: "Cashback % / Amount", purpose: "The rate or fixed value." },
      { name: "Credit Timing", purpose: "Immediate, or after 7 / 30 days (to deter returns abuse)." },
    ],
  },
  wallet: {
    summary: "The wallet holds the customer's spendable balances — loyalty, cashback, gift-card and promotional — used and topped up at billing.",
    flow: ["Earn (points / cashback / gift)", "Wallet credited", "Redeem at POS", "Wallet debited & history logged"],
    fields: [
      { name: "Wallet Type", purpose: "Loyalty / Cashback / Gift-card / Promotional balance." },
      { name: "Credit / Debit", purpose: "Direction of a manual adjustment." },
      { name: "Amount", purpose: "Value of the adjustment." },
      { name: "Reason", purpose: "Audit justification — manual credit routes for approval." },
    ],
  },
  "gift-card": {
    summary: "Issue and track prepaid gift cards (physical or digital) that customers redeem at billing.",
    flow: ["Issue card with a value", "Customer redeems at POS", "Balance reduces per use", "Expires or is recharged"],
    fields: [
      { name: "Card Type / Value", purpose: "Physical or digital; denomination loaded." },
      { name: "Issue To / Expiry", purpose: "Recipient and validity date." },
      { name: "Rechargeable", purpose: "Whether the card can be topped up again." },
      { name: "Gift Message", purpose: "Personal message for digital gifting." },
    ],
  },
  referral: {
    summary: "Referral turns happy customers into acquisition — both the referrer and the new customer get rewarded.",
    flow: ["Existing customer refers a friend", "Friend registers / makes first purchase", "Referrer rewarded", "New customer rewarded"],
    fields: [
      { name: "Referrer Reward", purpose: "Points the existing customer earns per successful referral." },
      { name: "New Customer Reward", purpose: "Welcome points for the referred customer." },
      { name: "Referral Bonus", purpose: "Extra bonus on qualifying milestones." },
    ],
  },
  birthday: {
    summary: "Automatically rewards a customer on their birthday — captured from the Customer Master — to build emotional loyalty.",
    flow: ["DOB captured at customer creation", "Birthday date arrives", "Reward auto-triggered", "Notification sent (SMS / WhatsApp / app)"],
    fields: [
      { name: "Auto Birthday Reward", purpose: "Enable automatic triggering." },
      { name: "Reward / Reward Type", purpose: "How much, and as Points / Cashback / Coupon / Free Gift." },
    ],
  },
  anniversary: {
    summary: "Automatically rewards a customer on their anniversary date (marriage / membership), mirroring the birthday flow.",
    flow: ["Anniversary date captured", "Date arrives", "Reward auto-triggered", "Notification sent"],
    fields: [
      { name: "Auto Anniversary Reward", purpose: "Enable automatic triggering." },
      { name: "Reward / Reward Type", purpose: "Value and reward form." },
    ],
  },
  campaign: {
    summary: "Time-bound campaigns layer bonus rewards (double/triple points, cashback) over festivals or categories.",
    flow: ["Create campaign with period & reward", "Goes live on the start date", "Qualifying bills get the bonus", "Ends automatically"],
    fields: [
      { name: "Campaign Type", purpose: "Festival, category, branch, tier or win-back." },
      { name: "Reward", purpose: "Double / Triple points, cashback, free gift or bonus voucher." },
      { name: "Period & Target", purpose: "Live window and the customer segment it applies to." },
    ],
  },
  approval: {
    summary: "Manual loyalty actions that change a customer's balance need sign-off — preventing fraud and errors.",
    flow: ["Staff raises a manual change", "Routed to the approver", "Approved / rejected", "Applied to the customer on approval"],
    fields: [
      { name: "Type", purpose: "Point adjustment, wallet credit, cashback credit, membership override or gift-card issue." },
      { name: "Value / Customer", purpose: "What's being changed and for whom." },
      { name: "Raised By / Status", purpose: "Who requested it and the approval state." },
    ],
  },
  profile: {
    summary: "A 360° loyalty view of each customer — used by staff and AI for service, targeting and retention.",
    flow: ["Aggregates tier, points, wallet & LTV", "Tracks referrals & campaign participation", "Flags at-risk / lapsed members", "Drives win-back & upsell"],
    fields: [
      { name: "Tier / Points / Wallet", purpose: "Current standing and spendable balances." },
      { name: "Lifetime Value", purpose: "Total contribution — prioritise high-value members." },
      { name: "Referrals / Status", purpose: "Advocacy and engagement health (Active / At-Risk / Lapsed)." },
    ],
  },
};

/* ===================================================== config notes ==== */
export function loyaltyNotesFor(key: string): string[] {
  const base = [lyFlag("enabled") ? "Loyalty ON" : "Loyalty OFF", `₹100 = ${ly("pointsPer100")} pts`, `1 pt = ₹${ly("pointValue")}`];
  switch (key) {
    case "earning": case "redemption": case "point-config": return base;
    case "wallet": return [lyFlag("approvalWalletCredit") ? "Wallet credit needs approval" : "Direct", "Real-time at billing", lyFlag("carryForward") ? "Carry-forward ON" : "—"];
    case "gift-card": return [lyFlag("approvalGiftCard") ? "Issue needs approval" : "Direct", "Physical & digital", "Expiry tracked"];
    case "tiers": return [lyFlag("membershipBased") ? "Membership ON" : "OFF", lyFlag("autoUpgrade") ? "Auto-upgrade ON" : "Manual"];
    case "cashback": return [lyFlag("cashbackBased") ? "Cashback ON" : "OFF", `${ly("cashbackPct")}% · ${ly("cashbackTiming")}`];
    case "referral": return [lyFlag("referralBased") ? "Referral ON" : "OFF", `Referrer ${ly("referrerReward")} pts`, `New cust ${ly("newCustReward")} pts`];
    case "campaign": return [lyFlag("campaignBased") ? "Campaign ON" : "OFF", "Double/Triple points", lyFlag("autoReward") ? "Auto reward trigger" : "—"];
    case "approval": return [lyFlag("approvalPointAdj") ? "Point adj approval" : "—", lyFlag("approvalCashback") ? "Cashback approval" : "—", lyFlag("approvalMembership") ? "Membership override approval" : "—"];
    case "program": return [lyFlag("allowMultiple") ? "Multiple programs ON" : "Single program", `Default: ${ly("defaultProgram")}`];
    default: return base;
  }
}
