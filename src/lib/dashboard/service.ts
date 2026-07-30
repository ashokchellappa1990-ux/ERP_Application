/**
 * Enterprise Dashboard aggregation service — the single source of live,
 * tenant/business/branch-scoped, permission-gated business intelligence.
 *
 * Contract:
 *  - EVERY query is bounded by `scopeWhere(scope, { branch:true })`, so a user
 *    never sees another tenant's (or unpermitted branch's) data.
 *  - EVERY section is gated by `DashAccess` capabilities — a builder returns an
 *    empty payload when the caller isn't permitted, so the API can be dumb.
 *  - Money columns are Prisma Decimals → always coerced with `N()`.
 *  - Date columns are ISO `yyyy-mm-dd` strings → range filters are `{ gte, lte }`.
 *
 * Each exported `get*` is independently awaitable so the API/UI can lazy-load and
 * refresh widgets in isolation.
 */
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { scopeWhere, type ActiveScope } from "@/lib/auth/scope";
import type { DashAccess } from "@/lib/dashboard/access";
import { type Periods, pctChange, addDays } from "@/lib/dashboard/period";

const N = (x: unknown): number => Number(x ?? 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface DashCtx {
  scope: ActiveScope;
  access: DashAccess;
  periods: Periods;
}

/** Base scope fragment for a branch-partitioned model. */
function base(scope: ActiveScope): Prisma.SaleWhereInput {
  return scopeWhere(scope, { branch: true }) as Prisma.SaleWhereInput;
}

/* ------------------------------------------------------------------ sales -- */

async function salesAgg(scope: ActiveScope, from: string, to: string) {
  const r = await prisma.sale.aggregate({
    where: { ...base(scope), status: "Completed", saleDate: { gte: from, lte: to } } as Prisma.SaleWhereInput,
    _sum: { total: true, cost: true }, _count: true,
  });
  return { total: N(r._sum.total), cost: N(r._sum.cost), count: r._count, profit: N(r._sum.total) - N(r._sum.cost) };
}

async function grnAgg(scope: ActiveScope, from: string, to: string) {
  const r = await prisma.goodsReceiptNote.aggregate({
    where: { ...(scopeWhere(scope, { branch: true }) as Prisma.GoodsReceiptNoteWhereInput), status: "Posted", grnDate: { gte: from, lte: to } },
    _sum: { totalValue: true }, _count: true,
  });
  return { value: N(r._sum.totalValue), count: r._count };
}

/* --------------------------------------------------------------- header -- */

export interface QuickAction { label: string; href: string; icon: string }

export interface DashHeader {
  businessName: string;
  branchLabel: string;
  userName: string;
  roleName: string;
  fyLabel: string;
  today: string;
  plan: string;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  trialDaysLeft: number | null;
  showTrial: boolean; // platform-controlled: whether the trial status shows on the dashboard
  healthScore: number;
  healthBand: string;
  quickActions: QuickAction[];
  reports: QuickAction[];
}

/** Quick actions & report shortcuts, filtered to what the user's role permits. */
function buildShortcuts(a: DashAccess): { quickActions: QuickAction[]; reports: QuickAction[] } {
  const q: QuickAction[] = [];
  const push = (cond: boolean, label: string, href: string, icon: string) => { if (cond) q.push({ label, href, icon }); };
  push(a.sales || a.pos, "New Sale", "/sales/pos", "ShoppingCart");
  push(a.purchase, "New Purchase", "/purchase/invoice", "Truck");
  push(a.purchase, "New GRN", "/purchase/grn", "PackageCheck");
  push(a.customers, "New Customer", "/crm/customers", "UserPlus");
  push(a.suppliers, "New Supplier", "/masters/supplier", "Building2");
  push(a.inventory, "New Product", "/masters/product", "Boxes");
  push(a.finance, "Receipt", "/finance/receipt", "Wallet");
  push(a.finance, "Payment", "/finance/cash", "Banknote");
  push(a.sales, "Sales Return", "/sales/return", "RotateCcw");
  push(a.membership, "New Membership", "/crm/membership", "IdCard");
  push(a.giftVoucher, "Issue Gift Voucher", "/system/gift-voucher", "Gift");

  const rep: QuickAction[] = [];
  const rpush = (cond: boolean, label: string, href: string, icon: string) => { if (cond) rep.push({ label, href, icon }); };
  rpush(a.sales, "Sales Reports", "/sales/analytics", "TrendingUp");
  rpush(a.purchase, "Purchase Reports", "/purchase/invoice", "Truck");
  rpush(a.inventory, "Inventory Reports", "/inventory/tracking", "Boxes");
  rpush(a.finance, "Finance Reports", "/finance", "Landmark");
  rpush(a.gst, "GST Reports", "/finance/gst", "ReceiptText");
  rpush(a.customers, "CRM Reports", "/crm/customer-360", "Users");
  rpush(a.membership, "Membership Reports", "/crm/membership", "IdCard");
  rpush(a.giftVoucher, "Gift Voucher Reports", "/system/gift-voucher", "Gift");
  return { quickActions: q, reports: rep };
}

export async function getHeader(ctx: DashCtx, opts: { userName: string; roleName: string }): Promise<DashHeader> {
  const { scope, periods: p } = ctx;
  const [business, tenant, sub, health, platform] = await Promise.all([
    scope.businessId ? prisma.business.findUnique({ where: { id: scope.businessId }, select: { name: true } }) : Promise.resolve(null),
    prisma.tenant.findUnique({ where: { id: scope.tenantId }, select: { name: true, plan: true, platformStatus: true, trialEndsAt: true, expiresAt: true } }),
    prisma.tenantSubscription.findFirst({ where: { tenantId: scope.tenantId, status: "Active" }, include: { plan: { select: { name: true } } } }).catch(() => null),
    getHealthScore(ctx),
    prisma.platformSetting.findFirst({ select: { configJson: true } }).catch(() => null),
  ]);
  // Platform-controlled toggle — the trial status is hidden on customer dashboards
  // unless the platform explicitly enables it (Platform → Product Configuration).
  let showTrial = false;
  try { showTrial = !!(platform?.configJson ? JSON.parse(platform.configJson) : {}).showTrialBanner; } catch { showTrial = false; }

  // Branch label from the active scope.
  let branchLabel = "All branches";
  if (scope.branchIds && scope.branchIds.length === 1) {
    const b = await prisma.branch.findUnique({ where: { id: scope.branchIds[0] }, select: { name: true } });
    branchLabel = b?.name ?? "Branch";
  } else if (scope.branchIds && scope.branchIds.length > 1) {
    branchLabel = `${scope.branchIds.length} branches`;
  }

  const plan = tenant?.plan ?? "trial";
  const trialDaysLeft = plan === "trial" && tenant?.trialEndsAt ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - Date.now()) / 86400000)) : null;
  const subscriptionStatus = tenant?.platformStatus === "Active"
    ? (sub ? "Subscribed" : plan === "trial" ? "Trial" : "Active")
    : (tenant?.platformStatus ?? "Active");

  const shortcuts = buildShortcuts(ctx.access);

  return {
    businessName: business?.name ?? tenant?.name ?? "Your Business",
    branchLabel,
    userName: opts.userName,
    roleName: opts.roleName,
    fyLabel: p.fyLabel,
    today: p.today,
    plan,
    subscriptionStatus,
    subscriptionPlan: sub?.plan?.name ?? null,
    trialDaysLeft,
    showTrial,
    healthScore: health.score,
    healthBand: health.band,
    quickActions: shortcuts.quickActions,
    reports: shortcuts.reports,
  };
}

/* ------------------------------------------------------------- KPI cards -- */

export interface Kpi {
  key: string; label: string; value: number; delta?: number; deltaLabel?: string;
  tone: "primary" | "success" | "warning" | "secondary" | "accent"; icon: string;
  href?: string; format: "money" | "int" | "pct";
  group?: string; spotlight?: boolean;
}

/** Which category each KPI belongs to + which get the premium hero treatment. */
const KPI_META: Record<string, { group: string; spotlight?: boolean }> = {
  todaySales: { group: "Sales", spotlight: true }, monthSales: { group: "Sales", spotlight: true }, fyProfit: { group: "Sales", spotlight: true },
  todayInvoices: { group: "Sales" }, yearSales: { group: "Sales" }, grossMargin: { group: "Sales" },
  todayPurchase: { group: "Purchase" }, monthPurchase: { group: "Purchase" },
  inventoryValue: { group: "Inventory" }, lowStock: { group: "Inventory" },
  receivable: { group: "Finance" }, payable: { group: "Finance" }, todayCollection: { group: "Finance" }, todayPayments: { group: "Finance" }, cashBalance: { group: "Finance" }, bankBalance: { group: "Finance" },
  customers: { group: "Customers" }, suppliers: { group: "Customers" }, approvals: { group: "Action Center" },
};

export async function getKpis(ctx: DashCtx): Promise<Kpi[]> {
  const { scope, access, periods: p } = ctx;
  const kpis: Kpi[] = [];

  if (access.sales) {
    const [today, yest, month, prevMonth, fy, invToday] = await Promise.all([
      salesAgg(scope, p.today, p.today),
      salesAgg(scope, p.yesterday, p.yesterday),
      salesAgg(scope, p.monthStart, p.today),
      salesAgg(scope, p.prevMonthStart, p.prevMonthEnd),
      salesAgg(scope, p.fyStart, p.today),
      prisma.sale.count({ where: { ...base(scope), status: "Completed", saleDate: p.today } as Prisma.SaleWhereInput }),
    ]);
    kpis.push(
      { key: "todaySales", label: "Today's Sales", value: r2(today.total), delta: pctChange(today.total, yest.total), deltaLabel: "vs yesterday", tone: "success", icon: "IndianRupee", href: "/sales/invoices", format: "money" },
      { key: "todayInvoices", label: "Today's Invoices", value: invToday, tone: "primary", icon: "ReceiptText", href: "/sales/invoices", format: "int" },
      { key: "monthSales", label: "This Month's Sales", value: r2(month.total), delta: pctChange(month.total, prevMonth.total), deltaLabel: "vs last month", tone: "primary", icon: "TrendingUp", href: "/sales/analytics", format: "money" },
      { key: "yearSales", label: `Sales · ${p.fyLabel}`, value: r2(fy.total), tone: "secondary", icon: "Landmark", href: "/sales/analytics", format: "money" },
      { key: "fyProfit", label: `Profit · ${p.fyLabel}`, value: r2(fy.profit), tone: "success", icon: "PiggyBank", href: "/finance", format: "money" },
      { key: "grossMargin", label: "Gross Margin", value: fy.total ? r2((fy.profit / fy.total) * 100) : 0, tone: "accent", icon: "Percent", format: "pct" },
    );
  }

  if (access.purchase) {
    const [today, month] = await Promise.all([grnAgg(scope, p.today, p.today), grnAgg(scope, p.monthStart, p.today)]);
    kpis.push(
      { key: "todayPurchase", label: "Today's Purchase", value: r2(today.value), tone: "primary", icon: "Truck", href: "/purchase/grn", format: "money" },
      { key: "monthPurchase", label: "This Month's Purchase", value: r2(month.value), tone: "secondary", icon: "PackageSearch", href: "/purchase/invoice", format: "money" },
    );
  }

  if (access.inventory) {
    const [inv, low] = await Promise.all([
      prisma.inventoryBalance.aggregate({ where: scopeWhere(scope, { branch: true }) as Prisma.InventoryBalanceWhereInput, _sum: { purchaseValue: true } }),
      lowStockCount(scope),
    ]);
    kpis.push(
      { key: "inventoryValue", label: "Inventory Value", value: r2(N(inv._sum.purchaseValue)), tone: "primary", icon: "Boxes", href: "/inventory/tracking", format: "money" },
      { key: "lowStock", label: "Low-Stock Items", value: low, tone: "warning", icon: "AlertTriangle", href: "/inventory/tracking", format: "int" },
    );
  }

  if (access.finance || access.sales) {
    const recv = await receivable(scope);
    kpis.push({ key: "receivable", label: "Outstanding Receivable", value: r2(recv), tone: "warning", icon: "ArrowDownCircle", href: "/finance", format: "money" });
  }
  if (access.finance || access.purchase) {
    const pay = await prisma.payable.aggregate({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.PayableWhereInput), status: { in: ["Open", "Partial"] } }, _sum: { balanceAmount: true } });
    kpis.push({ key: "payable", label: "Outstanding Payable", value: r2(N(pay._sum.balanceAmount)), tone: "warning", icon: "ArrowUpCircle", href: "/finance", format: "money" });
  }

  if (access.finance) {
    const [coll, payd, cb] = await Promise.all([
      prisma.customerCollection.aggregate({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerCollectionWhereInput), status: "Completed", collectionDate: p.today }, _sum: { totalAmount: true } }),
      prisma.supplierPayment.aggregate({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.SupplierPaymentWhereInput), status: "Completed", paymentDate: p.today }, _sum: { totalAmount: true } }),
      cashBank(scope).catch(() => null),
    ]);
    kpis.push(
      { key: "todayCollection", label: "Today's Collection", value: r2(N(coll._sum.totalAmount)), tone: "success", icon: "Wallet", href: "/finance/cash", format: "money" },
      { key: "todayPayments", label: "Today's Payments", value: r2(N(payd._sum.totalAmount)), tone: "secondary", icon: "Banknote", href: "/finance/cash", format: "money" },
    );
    if (cb) {
      kpis.push(
        { key: "cashBalance", label: "Cash Balance", value: r2(cb.cash), tone: "success", icon: "Coins", href: "/finance", format: "money" },
        { key: "bankBalance", label: "Bank Balance", value: r2(cb.bank), tone: "primary", icon: "Landmark", href: "/finance", format: "money" },
      );
    }
  }

  if (access.customers) {
    const [total, newThis] = await Promise.all([
      prisma.customer.count({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerWhereInput), status: "Active" } }),
      prisma.customer.count({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerWhereInput), createdAt: { gte: new Date(p.monthStart + "T00:00:00.000Z") } } }),
    ]);
    kpis.push({ key: "customers", label: "Active Customers", value: total, delta: undefined, deltaLabel: `+${newThis} this month`, tone: "secondary", icon: "Users", href: "/crm/customers", format: "int" });
  }
  if (access.suppliers) {
    const total = await prisma.supplier.count({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.SupplierWhereInput), status: "Active" } });
    kpis.push({ key: "suppliers", label: "Suppliers", value: total, tone: "primary", icon: "Building2", href: "/masters/supplier", format: "int" });
  }

  if (access.approvals) {
    const pend = await pendingApprovalsCount(ctx);
    kpis.push({ key: "approvals", label: "Pending Approvals", value: pend, tone: "warning", icon: "ClipboardCheck", href: "/purchase/invoice", format: "int" });
  }

  // Decorate with grouping + spotlight so the UI can lay out attractively.
  for (const k of kpis) { const m = KPI_META[k.key]; if (m) { k.group = m.group; k.spotlight = m.spotlight; } else k.group = "Other"; }
  return kpis;
}

/* ------------------------------------------------------- KPI drill-down -- */

export interface DetailComponent { label: string; value: number; format: "money" | "int" | "pct"; tone?: "success" | "danger" | "warning" | "muted" }
export interface KpiDetail {
  key: string; label: string; value: number; format: "money" | "int" | "pct";
  subtitle?: string; formula?: string;
  components: DetailComponent[];
  breakdown?: { title: string; kind: "bar" | "line" | "list"; format: "money" | "int" | "pct"; data: NameVal[] };
  links?: { label: string; href: string }[];
  note?: string;
}

/** Per-month {sale, cost} across the trailing window (for growth/profit breakdowns). */
async function monthlySeries(scope: ActiveScope, p: Periods): Promise<{ label: string; sale: number; cost: number }[]> {
  const rows = await prisma.sale.groupBy({ by: ["saleDate"], where: { ...base(scope), status: "Completed", saleDate: { gte: p.lastMonths[0].start, lte: p.today } } as Prisma.SaleWhereInput, _sum: { total: true, cost: true } });
  const byMonth = new Map<string, { sale: number; cost: number }>();
  for (const r of rows) { const k = r.saleDate.slice(0, 7); const e = byMonth.get(k) ?? { sale: 0, cost: 0 }; e.sale += N(r._sum.total); e.cost += N(r._sum.cost); byMonth.set(k, e); }
  return p.lastMonths.map((m) => ({ label: m.label, sale: r2(byMonth.get(m.key)?.sale ?? 0), cost: r2(byMonth.get(m.key)?.cost ?? 0) }));
}

/** Explain how a KPI / health metric value is generated: formula + components + a supporting breakdown. */
export async function getKpiDetail(ctx: DashCtx, key: string): Promise<KpiDetail | null> {
  const { scope, periods: p } = ctx;
  const M: KpiDetail["format"] = "money", I: KpiDetail["format"] = "int", P: KpiDetail["format"] = "pct";

  switch (key) {
    case "todaySales": {
      const [today, yest, invoices] = await Promise.all([
        salesAgg(scope, p.today, p.today), salesAgg(scope, p.yesterday, p.yesterday),
        prisma.sale.findMany({ where: { ...base(scope), status: "Completed", saleDate: p.today } as Prisma.SaleWhereInput, select: { invoiceNo: true, total: true }, orderBy: { id: "desc" }, take: 8 }),
      ]);
      return {
        key, label: "Today's Sales", value: r2(today.total), format: M,
        subtitle: `${today.count} completed invoice(s) dated ${p.today}`,
        formula: "Σ invoice total where status = Completed and date = today",
        components: [
          { label: "Today", value: r2(today.total), format: M },
          { label: "Yesterday", value: r2(yest.total), format: M, tone: "muted" },
          { label: "Change", value: pctChange(today.total, yest.total), format: P, tone: today.total >= yest.total ? "success" : "danger" },
        ],
        breakdown: { title: "Today's invoices", kind: "list", format: M, data: invoices.map((i) => ({ name: i.invoiceNo, value: r2(N(i.total)) })) },
        links: [{ label: "Open Sales Invoices", href: "/sales/invoices" }],
      };
    }
    case "todayInvoices": {
      const counts = await Promise.all(p.lastDays.slice(-7).map((d) => prisma.sale.count({ where: { ...base(scope), status: "Completed", saleDate: d } as Prisma.SaleWhereInput }).then((c) => ({ name: d.slice(5), value: c }))));
      return { key, label: "Today's Invoices", value: counts[counts.length - 1]?.value ?? 0, format: I, formula: "Count of completed invoices dated today", subtitle: "Bill volume trend (last 7 days)", components: [{ label: "Today", value: counts[counts.length - 1]?.value ?? 0, format: I }], breakdown: { title: "Invoices per day", kind: "bar", format: I, data: counts }, links: [{ label: "Open Sales Invoices", href: "/sales/invoices" }] };
    }
    case "monthSales": case "salesGrowth": {
      const [month, prev, series] = await Promise.all([salesAgg(scope, p.monthStart, p.today), salesAgg(scope, p.prevMonthStart, p.prevMonthEnd), monthlySeries(scope, p)]);
      const growth = pctChange(month.total, prev.total);
      return {
        key, label: key === "salesGrowth" ? "Sales Growth (MoM)" : "This Month's Sales", value: key === "salesGrowth" ? growth : r2(month.total), format: key === "salesGrowth" ? P : M,
        subtitle: `${p.monthStart} → ${p.today} vs previous month`,
        formula: "Growth = (This month − Last month) ÷ Last month × 100",
        components: [
          { label: "This month", value: r2(month.total), format: M },
          { label: "Last month", value: r2(prev.total), format: M, tone: "muted" },
          { label: "Difference", value: r2(month.total - prev.total), format: M, tone: month.total >= prev.total ? "success" : "danger" },
          { label: "Growth", value: growth, format: P, tone: growth >= 0 ? "success" : "danger" },
        ],
        breakdown: { title: "Monthly sales trend", kind: "bar", format: M, data: series.map((s) => ({ name: s.label, value: s.sale })) },
        links: [{ label: "Sales Analytics", href: "/sales/analytics" }],
      };
    }
    case "yearSales": {
      const [fy, series] = await Promise.all([salesAgg(scope, p.fyStart, p.today), monthlySeries(scope, p)]);
      return { key, label: `Sales · ${p.fyLabel}`, value: r2(fy.total), format: M, formula: "Σ invoice total from financial-year start to today", subtitle: `${p.fyStart} → ${p.today}`, components: [{ label: `Sales ${p.fyLabel}`, value: r2(fy.total), format: M }, { label: "Invoices", value: fy.count, format: I, tone: "muted" }], breakdown: { title: "Monthly sales (last 6 months)", kind: "bar", format: M, data: series.map((s) => ({ name: s.label, value: s.sale })) }, links: [{ label: "Sales Analytics", href: "/sales/analytics" }] };
    }
    case "fyProfit": case "profitGrowth": case "grossMargin": case "margin": {
      const [fy, month, prev, series] = await Promise.all([salesAgg(scope, p.fyStart, p.today), salesAgg(scope, p.monthStart, p.today), salesAgg(scope, p.prevMonthStart, p.prevMonthEnd), monthlySeries(scope, p)]);
      const margin = fy.total ? r2((fy.profit / fy.total) * 100) : 0;
      const growth = pctChange(month.profit, prev.profit);
      const isMargin = key === "grossMargin" || key === "margin";
      const value = isMargin ? margin : key === "profitGrowth" ? growth : r2(fy.profit);
      const fmt = key === "fyProfit" ? M : P;
      return {
        key, label: isMargin ? "Gross Margin" : key === "profitGrowth" ? "Profit Growth (MoM)" : `Profit · ${p.fyLabel}`, value, format: fmt,
        subtitle: "Profit = Revenue − Cost of Goods Sold (FIFO)",
        formula: isMargin ? "Margin = Profit ÷ Revenue × 100" : key === "profitGrowth" ? "Growth = (This month profit − Last month profit) ÷ Last month profit × 100" : "Profit = Revenue − COGS",
        components: [
          { label: `Revenue ${p.fyLabel}`, value: r2(fy.total), format: M },
          { label: `COGS ${p.fyLabel}`, value: r2(fy.cost), format: M, tone: "muted" },
          { label: `Profit ${p.fyLabel}`, value: r2(fy.profit), format: M, tone: fy.profit >= 0 ? "success" : "danger" },
          { label: "Gross margin", value: margin, format: P, tone: margin >= 20 ? "success" : "warning" },
          { label: "This month profit", value: r2(month.profit), format: M },
          { label: "Last month profit", value: r2(prev.profit), format: M, tone: "muted" },
        ],
        breakdown: { title: "Monthly profit (Revenue − COGS)", kind: "bar", format: M, data: series.map((s) => ({ name: s.label, value: r2(s.sale - s.cost) })) },
        links: [{ label: "Finance", href: "/finance" }],
      };
    }
    case "todayPurchase": case "monthPurchase": {
      const [today, month, week] = await Promise.all([grnAgg(scope, p.today, p.today), grnAgg(scope, p.monthStart, p.today), Promise.all(p.lastDays.slice(-7).map((d) => grnAgg(scope, d, d).then((g) => ({ name: d.slice(5), value: r2(g.value) }))))]);
      return { key, label: key === "todayPurchase" ? "Today's Purchase" : "This Month's Purchase", value: key === "todayPurchase" ? r2(today.value) : r2(month.value), format: M, formula: "Σ posted GRN invoice value in the period", subtitle: "Goods received (posted GRNs)", components: [{ label: "Today", value: r2(today.value), format: M }, { label: "This month", value: r2(month.value), format: M }], breakdown: { title: "Purchases per day (last 7 days)", kind: "bar", format: M, data: week }, links: [{ label: "Purchase Invoices", href: "/purchase/invoice" }] };
    }
    case "inventoryValue": {
      const [agg, rows] = await Promise.all([
        prisma.inventoryBalance.aggregate({ where: scopeWhere(scope, { branch: true }) as Prisma.InventoryBalanceWhereInput, _sum: { purchaseValue: true, sellingValue: true }, _count: true }),
        prisma.inventoryBalance.groupBy({ by: ["productId"], where: scopeWhere(scope, { branch: true }) as Prisma.InventoryBalanceWhereInput, _sum: { purchaseValue: true }, orderBy: { _sum: { purchaseValue: "desc" } }, take: 8 }),
      ]);
      const ids = rows.map((r) => r.productId);
      const names = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
      const nameById = new Map(names.map((n) => [n.id, n.name]));
      return { key, label: "Inventory Value", value: r2(N(agg._sum.purchaseValue)), format: M, formula: "Σ (qty on hand × purchase rate) across all stock", subtitle: `${agg._count} stock record(s)`, components: [{ label: "At cost", value: r2(N(agg._sum.purchaseValue)), format: M }, { label: "At selling price", value: r2(N(agg._sum.sellingValue)), format: M, tone: "muted" }], breakdown: { title: "Top items by stock value", kind: "bar", format: M, data: rows.map((r) => ({ name: nameById.get(r.productId) ?? `#${r.productId}`, value: r2(N(r._sum.purchaseValue)) })) }, links: [{ label: "Inventory Tracking", href: "/inventory/tracking" }] };
    }
    case "lowStock": {
      const rows = await prisma.inventoryBalance.findMany({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.InventoryBalanceWhereInput), product: { is: { status: "Active", reorderLevel: { gt: 0 } } } }, select: { qtyOnHand: true, product: { select: { name: true, reorderLevel: true } } }, take: 8000 });
      const low = rows.filter((b) => N(b.qtyOnHand) <= N(b.product?.reorderLevel)).map((b) => ({ name: b.product?.name ?? "Item", value: Math.max(0, N(b.product?.reorderLevel) - N(b.qtyOnHand)) })).sort((a, b) => b.value - a.value).slice(0, 10);
      return { key, label: "Low-Stock Items", value: low.length, format: I, formula: "Count where qty on hand ≤ reorder level", subtitle: "Items to reorder (shortage vs reorder level)", components: [{ label: "Items below reorder", value: low.length, format: I, tone: "warning" }], breakdown: { title: "Shortfall by item", kind: "bar", format: I, data: low }, links: [{ label: "Inventory Tracking", href: "/inventory/tracking" }] };
    }
    case "receivable": {
      const [sales, opening, top] = await Promise.all([
        prisma.sale.aggregate({ where: { ...base(scope), status: "Completed", paymentStatus: { in: ["Credit", "Partial"] } } as Prisma.SaleWhereInput, _sum: { total: true, amountPaid: true } }),
        prisma.customer.aggregate({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerWhereInput), status: "Active" }, _sum: { openingReceivable: true } }),
        prisma.sale.findMany({ where: { ...base(scope), status: "Completed", paymentStatus: { in: ["Credit", "Partial"] } } as Prisma.SaleWhereInput, select: { invoiceNo: true, total: true, amountPaid: true }, orderBy: { total: "desc" }, take: 8 }),
      ]);
      const unpaid = Math.max(0, N(sales._sum.total) - N(sales._sum.amountPaid));
      return { key, label: "Outstanding Receivable", value: r2(unpaid + N(opening._sum.openingReceivable)), format: M, formula: "Unpaid credit/partial invoices + opening receivable", subtitle: "Money owed to you by customers", components: [{ label: "Unpaid invoices", value: r2(unpaid), format: M }, { label: "Opening receivable", value: r2(N(opening._sum.openingReceivable)), format: M, tone: "muted" }], breakdown: { title: "Largest unpaid invoices", kind: "list", format: M, data: top.map((s) => ({ name: s.invoiceNo, value: r2(N(s.total) - N(s.amountPaid)) })) }, links: [{ label: "Finance", href: "/finance" }] };
    }
    case "payable": {
      const [agg, top] = await Promise.all([
        prisma.payable.aggregate({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.PayableWhereInput), status: { in: ["Open", "Partial"] } }, _sum: { balanceAmount: true }, _count: true }),
        prisma.payable.groupBy({ by: ["supplier"], where: { ...(scopeWhere(scope, { branch: true }) as Prisma.PayableWhereInput), status: { in: ["Open", "Partial"] } }, _sum: { balanceAmount: true }, orderBy: { _sum: { balanceAmount: "desc" } }, take: 8 }),
      ]);
      return { key, label: "Outstanding Payable", value: r2(N(agg._sum.balanceAmount)), format: M, formula: "Σ balance of open/partial supplier bills", subtitle: `${agg._count} open bill(s)`, components: [{ label: "Total payable", value: r2(N(agg._sum.balanceAmount)), format: M }, { label: "Open bills", value: agg._count, format: I, tone: "muted" }], breakdown: { title: "By supplier", kind: "bar", format: M, data: top.map((r) => ({ name: r.supplier ?? "—", value: r2(N(r._sum.balanceAmount)) })) }, links: [{ label: "Finance", href: "/finance" }] };
    }
    case "todayCollection": case "todayPayments": {
      const isColl = key === "todayCollection";
      const rows = isColl
        ? await prisma.customerCollection.findMany({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerCollectionWhereInput), status: "Completed", collectionDate: p.today }, select: { collectionNo: true, totalAmount: true, mode: true }, take: 12 })
        : (await prisma.supplierPayment.findMany({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.SupplierPaymentWhereInput), status: "Completed", paymentDate: p.today }, select: { paymentNo: true, totalAmount: true, mode: true }, take: 12 })).map((r) => ({ collectionNo: r.paymentNo, totalAmount: r.totalAmount, mode: r.mode }));
      const total = rows.reduce((s, r) => s + N(r.totalAmount), 0);
      const byMode = new Map<string, number>();
      for (const r of rows) byMode.set(r.mode, (byMode.get(r.mode) ?? 0) + N(r.totalAmount));
      return { key, label: isColl ? "Today's Collection" : "Today's Payments", value: r2(total), format: M, formula: isColl ? "Σ customer collections received today" : "Σ supplier payments made today", subtitle: `${rows.length} transaction(s) on ${p.today}`, components: [...byMode].map(([mode, v]) => ({ label: mode, value: r2(v), format: M })), breakdown: { title: "Transactions today", kind: "list", format: M, data: rows.map((r) => ({ name: r.collectionNo, value: r2(N(r.totalAmount)) })) }, links: [{ label: "Fund Management", href: "/finance/cash" }] };
    }
    case "cashBalance": case "bankBalance": {
      const wantBank = key === "bankBalance";
      const accts = await prisma.ledgerAccount.findMany({ where: { tenantId: scope.tenantId, type: "Asset" }, select: { id: true, name: true } });
      const matched = accts.filter((a) => wantBank ? /bank/i.test(a.name) : /cash|petty/i.test(a.name));
      const rows = await Promise.all(matched.map(async (a) => { const r = await prisma.journalLine.aggregate({ where: { tenantId: scope.tenantId, accountId: a.id }, _sum: { debit: true, credit: true } }); return { name: a.name, value: r2(N(r._sum.debit) - N(r._sum.credit)) }; }));
      const total = rows.reduce((s, r) => s + r.value, 0);
      return { key, label: wantBank ? "Bank Balance" : "Cash Balance", value: r2(total), format: M, formula: "Σ (debit − credit) across " + (wantBank ? "bank" : "cash") + " ledger accounts", subtitle: "Live balance from the general ledger", components: rows.map((r) => ({ label: r.name, value: r.value, format: M })), breakdown: { title: "By account", kind: "bar", format: M, data: rows }, links: [{ label: "Finance", href: "/finance" }] };
    }
    case "customers": case "customerGrowth": {
      const [total, newThis, newPrev, recent] = await Promise.all([
        prisma.customer.count({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerWhereInput), status: "Active" } }),
        prisma.customer.count({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerWhereInput), createdAt: { gte: new Date(p.monthStart + "T00:00:00.000Z") } } }),
        prisma.customer.count({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerWhereInput), createdAt: { gte: new Date(p.prevMonthStart + "T00:00:00.000Z"), lt: new Date(p.monthStart + "T00:00:00.000Z") } } }),
        prisma.customer.findMany({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerWhereInput), createdAt: { gte: new Date(p.monthStart + "T00:00:00.000Z") } }, select: { name: true, totalSpent: true }, orderBy: { createdAt: "desc" }, take: 8 }),
      ]);
      const growth = pctChange(newThis, newPrev);
      return { key, label: key === "customerGrowth" ? "New Customers (MoM)" : "Active Customers", value: key === "customerGrowth" ? growth : total, format: key === "customerGrowth" ? P : I, formula: key === "customerGrowth" ? "(New this month − New last month) ÷ New last month × 100" : "Count of active customers", subtitle: "Customer base growth", components: [{ label: "Active total", value: total, format: I }, { label: "New this month", value: newThis, format: I, tone: "success" }, { label: "New last month", value: newPrev, format: I, tone: "muted" }], breakdown: { title: "New customers this month", kind: "list", format: M, data: recent.map((c) => ({ name: c.name, value: r2(N(c.totalSpent)) })) }, links: [{ label: "Customers", href: "/crm/customers" }] };
    }
    case "suppliers": {
      const [total, recent] = await Promise.all([
        prisma.supplier.count({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.SupplierWhereInput), status: "Active" } }),
        prisma.supplier.findMany({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.SupplierWhereInput), status: "Active" }, select: { name: true, openingPayable: true }, orderBy: { createdAt: "desc" }, take: 8 }),
      ]);
      return { key, label: "Suppliers", value: total, format: I, formula: "Count of active suppliers", components: [{ label: "Active suppliers", value: total, format: I }], breakdown: { title: "Recently added", kind: "list", format: M, data: recent.map((s) => ({ name: s.name, value: r2(N(s.openingPayable)) })) }, links: [{ label: "Suppliers", href: "/masters/supplier" }] };
    }
    case "approvals": {
      const w = scopeWhere(scope, { branch: true });
      const [pi, sr, sc, mem] = await Promise.all([
        prisma.purchaseInvoice.count({ where: { ...(w as Prisma.PurchaseInvoiceWhereInput), status: "Pending Approval" } }).catch(() => 0),
        prisma.salesReturn.count({ where: { ...(w as Prisma.SalesReturnWhereInput), status: { in: ["Pending", "Draft"] } } }).catch(() => 0),
        prisma.salesCancellation.count({ where: { ...(w as Prisma.SalesCancellationWhereInput), status: "Pending Approval" } }).catch(() => 0),
        prisma.membershipRegistration.count({ where: { ...(w as Prisma.MembershipRegistrationWhereInput), status: "PendingApproval" } }).catch(() => 0),
      ]);
      return { key, label: "Pending Approvals", value: pi + sr + sc + mem, format: I, formula: "Sum of items awaiting approval across modules", subtitle: "Your action queue", components: [{ label: "Purchase invoices", value: pi, format: I }, { label: "Sales returns", value: sr, format: I }, { label: "Sales cancellations", value: sc, format: I }, { label: "Memberships", value: mem, format: I }], breakdown: { title: "By type", kind: "bar", format: I, data: [{ name: "Purchase Inv", value: pi }, { name: "Sales Returns", value: sr }, { name: "Cancellations", value: sc }, { name: "Memberships", value: mem }].filter((d) => d.value > 0) }, links: [{ label: "Purchase Invoices", href: "/purchase/invoice" }] };
    }
    case "purchaseGrowth": {
      const [pm, ppm] = await Promise.all([grnAgg(scope, p.monthStart, p.today), grnAgg(scope, p.prevMonthStart, p.prevMonthEnd)]);
      return { key, label: "Purchase Growth (MoM)", value: pctChange(pm.value, ppm.value), format: P, formula: "(This month − Last month) ÷ Last month × 100", components: [{ label: "This month", value: r2(pm.value), format: M }, { label: "Last month", value: r2(ppm.value), format: M, tone: "muted" }] };
    }
    case "collectionEfficiency": {
      const [coll, recv] = await Promise.all([prisma.customerCollection.aggregate({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerCollectionWhereInput), status: "Completed", collectionDate: { gte: p.monthStart, lte: p.today } }, _sum: { totalAmount: true } }), receivable(scope)]);
      const c = N(coll._sum.totalAmount);
      const eff = c + recv > 0 ? r2((c / (c + recv)) * 100) : 0;
      return { key, label: "Collection Efficiency", value: eff, format: P, formula: "Collected ÷ (Collected + Outstanding) × 100", subtitle: "How much of what's due you're collecting", components: [{ label: "Collected this month", value: r2(c), format: M, tone: "success" }, { label: "Outstanding receivable", value: r2(recv), format: M, tone: "warning" }] };
    }
    case "turnover": {
      const [fy, inv] = await Promise.all([salesAgg(scope, p.fyStart, p.today), prisma.inventoryBalance.aggregate({ where: scopeWhere(scope, { branch: true }) as Prisma.InventoryBalanceWhereInput, _sum: { purchaseValue: true } })]);
      const invVal = N(inv._sum.purchaseValue);
      return { key, label: "Inventory Turnover", value: invVal ? r2(fy.cost / invVal) : 0, format: "int", formula: "COGS (FY) ÷ current inventory value", subtitle: "Higher = stock sells faster", components: [{ label: `COGS ${p.fyLabel}`, value: r2(fy.cost), format: M }, { label: "Inventory value", value: r2(invVal), format: M, tone: "muted" }] };
    }
    default:
      return null;
  }
}

/** Receivable = unpaid portion of completed credit/partial sales + opening receivable. */
async function receivable(scope: ActiveScope): Promise<number> {
  const [sales, opening] = await Promise.all([
    prisma.sale.aggregate({ where: { ...base(scope), status: "Completed", paymentStatus: { in: ["Credit", "Partial"] } } as Prisma.SaleWhereInput, _sum: { total: true, amountPaid: true } }),
    prisma.customer.aggregate({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerWhereInput), status: "Active" }, _sum: { openingReceivable: true } }),
  ]);
  return Math.max(0, N(sales._sum.total) - N(sales._sum.amountPaid)) + N(opening._sum.openingReceivable);
}

async function lowStockCount(scope: ActiveScope): Promise<number> {
  const rows = await prisma.inventoryBalance.findMany({
    where: { ...(scopeWhere(scope, { branch: true }) as Prisma.InventoryBalanceWhereInput), product: { is: { status: "Active", reorderLevel: { gt: 0 } } } },
    select: { qtyOnHand: true, product: { select: { reorderLevel: true } } }, take: 8000,
  });
  return rows.filter((b) => N(b.qtyOnHand) <= N(b.product?.reorderLevel)).length;
}

/** Best-effort cash & bank position from the GL (nulls out if accounting unused). */
async function cashBank(scope: ActiveScope): Promise<{ cash: number; bank: number } | null> {
  const accts = await prisma.ledgerAccount.findMany({ where: { tenantId: scope.tenantId, type: "Asset" }, select: { id: true, name: true } });
  if (!accts.length) return null;
  const cashIds = accts.filter((a) => /cash|petty/i.test(a.name)).map((a) => a.id);
  const bankIds = accts.filter((a) => /bank/i.test(a.name)).map((a) => a.id);
  if (!cashIds.length && !bankIds.length) return null;
  const sum = async (ids: number[]) => {
    if (!ids.length) return 0;
    const r = await prisma.journalLine.aggregate({ where: { tenantId: scope.tenantId, accountId: { in: ids } }, _sum: { debit: true, credit: true } });
    return N(r._sum.debit) - N(r._sum.credit);
  };
  return { cash: await sum(cashIds), bank: await sum(bankIds) };
}

async function pendingApprovalsCount(ctx: DashCtx): Promise<number> {
  const { scope, access } = ctx;
  const w = scopeWhere(scope, { branch: true });
  const jobs: Promise<number>[] = [];
  if (access.purchase || access.finance) jobs.push(prisma.purchaseInvoice.count({ where: { ...(w as Prisma.PurchaseInvoiceWhereInput), status: "Pending Approval" } }));
  if (access.sales) jobs.push(prisma.salesReturn.count({ where: { ...(w as Prisma.SalesReturnWhereInput), status: { in: ["Pending", "Draft"] } } }));
  if (access.sales) jobs.push(prisma.salesCancellation.count({ where: { ...(w as Prisma.SalesCancellationWhereInput), status: "Pending Approval" } }).catch(() => 0));
  if (access.membership) jobs.push(prisma.membershipRegistration.count({ where: { ...(w as Prisma.MembershipRegistrationWhereInput), status: "PendingApproval" } }).catch(() => 0));
  const counts = await Promise.all(jobs);
  return counts.reduce((s, n) => s + n, 0);
}

/* --------------------------------------------------------------- charts -- */

export interface NameVal { name: string; value: number }
export interface ChartBlock { id: string; title: string; type: "line" | "bar" | "donut" | "dual"; data: NameVal[]; series?: { name: string; a: number; b: number }[]; aLabel?: string; bLabel?: string; format: "money" | "int" }

export async function getCharts(ctx: DashCtx): Promise<ChartBlock[]> {
  const { scope, access, periods: p } = ctx;
  const out: ChartBlock[] = [];

  if (access.sales) {
    // Daily sales trend across the trailing window.
    const rows = await prisma.sale.groupBy({
      by: ["saleDate"],
      where: { ...base(scope), status: "Completed", saleDate: { gte: p.lastDays[0], lte: p.today } } as Prisma.SaleWhereInput,
      _sum: { total: true },
    });
    const byDay = new Map(rows.map((r) => [r.saleDate, N(r._sum.total)]));
    out.push({ id: "salesTrend", title: "Sales Trend", type: "line", format: "money", data: p.lastDays.map((d) => ({ name: d.slice(5), value: r2(byDay.get(d) ?? 0) })) });
  }

  // Sales vs Purchase + Profit trend across trailing months (bucket once).
  if (access.sales || access.purchase) {
    const winStart = p.lastMonths[0].start;
    const [saleRows, grnRows] = await Promise.all([
      access.sales ? prisma.sale.groupBy({ by: ["saleDate"], where: { ...base(scope), status: "Completed", saleDate: { gte: winStart, lte: p.today } } as Prisma.SaleWhereInput, _sum: { total: true, cost: true } }) : Promise.resolve([] as { saleDate: string; _sum: { total: unknown; cost: unknown } }[]),
      access.purchase ? prisma.goodsReceiptNote.groupBy({ by: ["grnDate"], where: { ...(scopeWhere(scope, { branch: true }) as Prisma.GoodsReceiptNoteWhereInput), status: "Posted", grnDate: { gte: winStart, lte: p.today } }, _sum: { totalValue: true } }) : Promise.resolve([] as { grnDate: string; _sum: { totalValue: unknown } }[]),
    ]);
    const salesByMonth = new Map<string, { sale: number; cost: number }>();
    for (const r of saleRows) { const k = r.saleDate.slice(0, 7); const e = salesByMonth.get(k) ?? { sale: 0, cost: 0 }; e.sale += N(r._sum.total); e.cost += N(r._sum.cost); salesByMonth.set(k, e); }
    const purchByMonth = new Map<string, number>();
    for (const r of grnRows) { const k = r.grnDate.slice(0, 7); purchByMonth.set(k, (purchByMonth.get(k) ?? 0) + N(r._sum.totalValue)); }

    if (access.sales && access.purchase) {
      out.push({ id: "salesVsPurchase", title: "Sales vs Purchase", type: "dual", format: "money", aLabel: "Sales", bLabel: "Purchase", data: [], series: p.lastMonths.map((m) => ({ name: m.label, a: r2(salesByMonth.get(m.key)?.sale ?? 0), b: r2(purchByMonth.get(m.key) ?? 0) })) });
    }
    if (access.sales) {
      out.push({ id: "profitTrend", title: "Profit Trend", type: "bar", format: "money", data: p.lastMonths.map((m) => { const e = salesByMonth.get(m.key); return { name: m.label, value: r2((e?.sale ?? 0) - (e?.cost ?? 0)) }; }) });
    }
  }

  if (access.sales) {
    // Top selling products (by value, FY-to-date).
    const lineRows = await prisma.saleLine.groupBy({
      by: ["productId"],
      where: { sale: { is: { ...base(scope), status: "Completed", saleDate: { gte: p.fyStart, lte: p.today } } as Prisma.SaleWhereInput } },
      _sum: { value: true }, orderBy: { _sum: { value: "desc" } }, take: 6,
    });
    const ids = lineRows.map((r) => r.productId).filter((x): x is number => x != null);
    const names = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const nameById = new Map(names.map((n) => [n.id, n.name]));
    out.push({ id: "topProducts", title: "Top Selling Products", type: "bar", format: "money", data: lineRows.map((r) => ({ name: nameById.get(r.productId!) ?? `#${r.productId}`, value: r2(N(r._sum.value)) })) });

    // Top customers (FY-to-date).
    const custRows = await prisma.sale.groupBy({
      by: ["customerId"],
      where: { ...base(scope), status: "Completed", customerId: { not: null }, saleDate: { gte: p.fyStart, lte: p.today } } as Prisma.SaleWhereInput,
      _sum: { total: true }, orderBy: { _sum: { total: "desc" } }, take: 6,
    });
    const cids = custRows.map((r) => r.customerId).filter((x): x is number => x != null);
    const cnames = cids.length ? await prisma.customer.findMany({ where: { id: { in: cids } }, select: { id: true, name: true } }) : [];
    const cById = new Map(cnames.map((n) => [n.id, n.name]));
    out.push({ id: "topCustomers", title: "Top Customers", type: "bar", format: "money", data: custRows.map((r) => ({ name: cById.get(r.customerId!) ?? "Walk-in", value: r2(N(r._sum.total)) })) });

    // Payment-method mix (this month).
    const payRows = await prisma.sale.groupBy({
      by: ["paymentMode"],
      where: { ...base(scope), status: "Completed", saleDate: { gte: p.monthStart, lte: p.today } } as Prisma.SaleWhereInput,
      _sum: { total: true },
    });
    out.push({ id: "paymentMix", title: "Payment Methods · This Month", type: "donut", format: "money", data: payRows.filter((r) => N(r._sum.total) > 0).map((r) => ({ name: r.paymentMode ?? "Other", value: r2(N(r._sum.total)) })) });
  }

  return out;
}

/* ------------------------------------------------------------- health -- */

export interface HealthMetric { key: string; label: string; value: number; unit: "pct" | "x" | "money"; tone: "success" | "warning" | "danger" | "primary" }
export interface HealthResult { score: number; band: string; metrics: HealthMetric[] }

export async function getHealth(ctx: DashCtx): Promise<HealthResult> {
  const { scope, access, periods: p } = ctx;
  const metrics: HealthMetric[] = [];

  const [month, prevMonth, fy, invBal] = await Promise.all([
    access.sales ? salesAgg(scope, p.monthStart, p.today) : null,
    access.sales ? salesAgg(scope, p.prevMonthStart, p.prevMonthEnd) : null,
    access.sales ? salesAgg(scope, p.fyStart, p.today) : null,
    access.inventory ? prisma.inventoryBalance.aggregate({ where: scopeWhere(scope, { branch: true }) as Prisma.InventoryBalanceWhereInput, _sum: { purchaseValue: true } }) : null,
  ]);

  let score = 55;
  if (month && prevMonth) {
    const salesGrowth = pctChange(month.total, prevMonth.total);
    const profitGrowth = pctChange(month.profit, prevMonth.profit);
    metrics.push({ key: "salesGrowth", label: "Sales Growth (MoM)", value: salesGrowth, unit: "pct", tone: salesGrowth >= 0 ? "success" : "danger" });
    metrics.push({ key: "profitGrowth", label: "Profit Growth (MoM)", value: profitGrowth, unit: "pct", tone: profitGrowth >= 0 ? "success" : "danger" });
    score += Math.max(-15, Math.min(15, salesGrowth * 0.6));
  }
  if (fy) {
    const margin = fy.total ? r2((fy.profit / fy.total) * 100) : 0;
    metrics.push({ key: "margin", label: `Gross Margin · ${p.fyLabel}`, value: margin, unit: "pct", tone: margin >= 20 ? "success" : margin >= 8 ? "warning" : "danger" });
    score += Math.max(0, Math.min(30, margin * 0.75));
    if (invBal) {
      const invVal = N(invBal._sum.purchaseValue);
      const turnover = invVal ? r2(fy.cost / invVal) : 0;
      metrics.push({ key: "turnover", label: "Inventory Turnover", value: turnover, unit: "x", tone: turnover >= 4 ? "success" : turnover >= 2 ? "warning" : "danger" });
    }
  }

  if (access.purchase) {
    const [pm, ppm] = await Promise.all([grnAgg(scope, p.monthStart, p.today), grnAgg(scope, p.prevMonthStart, p.prevMonthEnd)]);
    metrics.push({ key: "purchaseGrowth", label: "Purchase Growth (MoM)", value: pctChange(pm.value, ppm.value), unit: "pct", tone: "primary" });
  }

  if (access.finance) {
    const [collMonth, recv] = await Promise.all([
      prisma.customerCollection.aggregate({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerCollectionWhereInput), status: "Completed", collectionDate: { gte: p.monthStart, lte: p.today } }, _sum: { totalAmount: true } }),
      receivable(scope),
    ]);
    const coll = N(collMonth._sum.totalAmount);
    const eff = coll + recv > 0 ? r2((coll / (coll + recv)) * 100) : 0;
    metrics.push({ key: "collectionEfficiency", label: "Collection Efficiency", value: eff, unit: "pct", tone: eff >= 70 ? "success" : eff >= 40 ? "warning" : "danger" });
    score += Math.max(-10, Math.min(10, (eff - 50) * 0.2));
  }

  if (access.customers) {
    const [nowC, prevC] = await Promise.all([
      prisma.customer.count({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerWhereInput), createdAt: { gte: new Date(p.monthStart + "T00:00:00.000Z") } } }),
      prisma.customer.count({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.CustomerWhereInput), createdAt: { gte: new Date(p.prevMonthStart + "T00:00:00.000Z"), lt: new Date(p.monthStart + "T00:00:00.000Z") } } }),
    ]);
    metrics.push({ key: "customerGrowth", label: "New Customers (MoM)", value: pctChange(nowC, prevC), unit: "pct", tone: "primary" });
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const band = finalScore >= 75 ? "Healthy" : finalScore >= 50 ? "Stable" : finalScore >= 30 ? "Needs Attention" : "At Risk";
  return { score: finalScore, band, metrics };
}

/* Compact health score for the header (reuses getHealth). */
export async function getHealthScore(ctx: DashCtx): Promise<{ score: number; band: string }> {
  const h = await getHealth(ctx);
  return { score: h.score, band: h.band };
}

/* ------------------------------------------------------------- pending -- */

export interface PendingItem { key: string; label: string; count: number; href: string; tone: "primary" | "warning" | "danger" | "secondary" }

export async function getPending(ctx: DashCtx): Promise<PendingItem[]> {
  const { scope, access, periods: p } = ctx;
  const w = scopeWhere(scope, { branch: true });
  const items: PendingItem[] = [];
  const jobs: Promise<PendingItem | null>[] = [];
  const add = (cond: boolean, key: string, label: string, href: string, tone: PendingItem["tone"], q: () => Promise<number>) => {
    if (cond) jobs.push(q().then((count) => (count > 0 ? { key, label, count, href, tone } : null)).catch(() => null));
  };

  add(access.purchase, "grnDraft", "Draft GRNs", "/purchase/grn", "primary", () => prisma.goodsReceiptNote.count({ where: { ...(w as Prisma.GoodsReceiptNoteWhereInput), status: "Draft" } }));
  add(access.purchase || access.finance, "piApproval", "Purchase Invoices to Approve", "/purchase/invoice", "warning", () => prisma.purchaseInvoice.count({ where: { ...(w as Prisma.PurchaseInvoiceWhereInput), status: "Pending Approval" } }));
  add(access.purchase, "grnUninvoiced", "GRNs Awaiting Invoice", "/purchase/invoice", "secondary", () => prisma.goodsReceiptNote.count({ where: { ...(w as Prisma.GoodsReceiptNoteWhereInput), status: "Posted", invoiceRecorded: false } }));
  add(access.sales, "salesReturns", "Sales Returns Pending", "/sales/return", "warning", () => prisma.salesReturn.count({ where: { ...(w as Prisma.SalesReturnWhereInput), status: { in: ["Pending", "Draft"] } } }));
  add(access.sales || access.finance, "creditInvoices", "Unpaid Credit Invoices", "/sales/invoices", "danger", () => prisma.sale.count({ where: { ...(base(scope)), status: "Completed", paymentStatus: { in: ["Credit", "Partial"] } } as Prisma.SaleWhereInput }));
  add(access.finance || access.purchase, "openPayables", "Open Supplier Bills", "/finance", "warning", () => prisma.payable.count({ where: { ...(w as Prisma.PayableWhereInput), status: { in: ["Open", "Partial"] } } }));
  add(access.membership, "membershipRenewals", "Memberships Due for Renewal", "/crm/membership", "primary", () => prisma.membershipRegistration.count({ where: { ...(w as Prisma.MembershipRegistrationWhereInput), status: "Active", expiryDate: { gte: p.today, lte: addDays(p.today, 30) } } }));

  const resolved = await Promise.all(jobs);
  for (const it of resolved) if (it) items.push(it);
  return items;
}

/* --------------------------------------------------------- notifications -- */

export interface Notification { key: string; level: "info" | "warning" | "danger"; title: string; detail: string; count: number; href: string }

export async function getNotifications(ctx: DashCtx): Promise<Notification[]> {
  const { scope, access, periods: p } = ctx;
  const w = scopeWhere(scope, { branch: true });
  const notes: Notification[] = [];

  if (access.inventory) {
    const [low, neg, near, expired] = await Promise.all([
      lowStockCount(scope),
      prisma.inventoryBalance.count({ where: { ...(w as Prisma.InventoryBalanceWhereInput), qtyOnHand: { lt: 0 } } }),
      prisma.inventoryLot.count({ where: { ...(w as Prisma.InventoryLotWhereInput), qtyOnHand: { gt: 0 }, expiryDate: { gte: p.today, lte: addDays(p.today, 30) } } }),
      prisma.inventoryLot.count({ where: { ...(w as Prisma.InventoryLotWhereInput), qtyOnHand: { gt: 0 }, expiryDate: { not: null, lt: p.today } } }),
    ]);
    if (low) notes.push({ key: "lowStock", level: "warning", title: "Low stock", detail: `${low} item(s) at or below reorder level`, count: low, href: "/inventory/tracking" });
    if (neg) notes.push({ key: "negStock", level: "danger", title: "Negative stock", detail: `${neg} item(s) below zero — investigate`, count: neg, href: "/inventory/tracking" });
    if (near) notes.push({ key: "nearExpiry", level: "warning", title: "Near expiry", detail: `${near} lot(s) expiring within 30 days`, count: near, href: "/inventory/tracking" });
    if (expired) notes.push({ key: "expired", level: "danger", title: "Expired stock", detail: `${expired} lot(s) past expiry still on hand`, count: expired, href: "/inventory/tracking" });
  }

  if (access.customers) {
    const mmdd = `-${p.today.slice(5)}`; // "-MM-DD"
    const [bday, anniv] = await Promise.all([
      prisma.customer.count({ where: { ...(w as Prisma.CustomerWhereInput), status: "Active", dob: { contains: mmdd } } }),
      prisma.customer.count({ where: { ...(w as Prisma.CustomerWhereInput), status: "Active", anniversary: { contains: mmdd } } }),
    ]);
    if (bday) notes.push({ key: "birthday", level: "info", title: "Customer birthdays today", detail: `${bday} customer(s) — send a wish/offer`, count: bday, href: "/crm/customers" });
    if (anniv) notes.push({ key: "anniversary", level: "info", title: "Customer anniversaries today", detail: `${anniv} customer(s) celebrating`, count: anniv, href: "/crm/customers" });
  }

  if (access.membership) {
    const due = await prisma.membershipRegistration.count({ where: { ...(w as Prisma.MembershipRegistrationWhereInput), status: "Active", expiryDate: { gte: p.today, lte: addDays(p.today, 30) } } }).catch(() => 0);
    if (due) notes.push({ key: "membershipExpiry", level: "warning", title: "Memberships expiring", detail: `${due} expiring within 30 days`, count: due, href: "/crm/membership" });
  }
  if (access.giftVoucher) {
    const gv = await prisma.giftVoucher.count({ where: { ...(w as Prisma.GiftVoucherWhereInput), status: "Active", expiryDate: { gte: p.today, lte: addDays(p.today, 30) } } }).catch(() => 0);
    if (gv) notes.push({ key: "gvExpiry", level: "warning", title: "Gift vouchers expiring", detail: `${gv} active voucher(s) expiring within 30 days`, count: gv, href: "/system/gift-voucher" });
  }

  // Subscription expiry (own tenant) — visible to everyone; it's their account.
  const tenant = await prisma.tenant.findUnique({ where: { id: scope.tenantId }, select: { plan: true, trialEndsAt: true, expiresAt: true } });
  const end = tenant?.plan === "trial" ? tenant?.trialEndsAt : tenant?.expiresAt;
  if (end) {
    const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
    if (days <= 15) notes.push({ key: "subExpiry", level: days <= 5 ? "danger" : "warning", title: tenant?.plan === "trial" ? "Trial ending soon" : "Subscription renewal due", detail: days >= 0 ? `${days} day(s) remaining` : "Expired — renew to avoid interruption", count: 1, href: "/settings/subscription" });
  }

  return notes;
}

/* ------------------------------------------------------------- insights -- */

export interface Insight { key: string; tone: "primary" | "success" | "warning" | "danger"; icon: string; title: string; text: string }

export async function getInsights(ctx: DashCtx): Promise<Insight[]> {
  const { scope, access, periods: p } = ctx;
  const insights: Insight[] = [];

  if (access.sales) {
    const [month, prevMonth] = await Promise.all([salesAgg(scope, p.monthStart, p.today), salesAgg(scope, p.prevMonthStart, p.prevMonthEnd)]);
    const g = pctChange(month.total, prevMonth.total);
    insights.push({ key: "salesTrend", tone: g >= 0 ? "success" : "warning", icon: g >= 0 ? "TrendingUp" : "TrendingDown", title: g >= 0 ? "Sales are trending up" : "Sales have softened", text: `This month is ${g >= 0 ? "up" : "down"} ${Math.abs(g)}% vs last month (${month.count} invoices).` });
    const margin = month.total ? Math.round((month.profit / month.total) * 100) : 0;
    if (month.total) insights.push({ key: "margin", tone: margin >= 20 ? "success" : "warning", icon: "Percent", title: `Gross margin ${margin}%`, text: margin >= 20 ? "Healthy margin this month — pricing and mix are working." : "Margin is thin — review discounts, purchase cost and product mix." });
  }

  if (access.inventory) {
    const cutoff = new Date(addDays(p.today, -90) + "T00:00:00.000Z");
    const [low, dead] = await Promise.all([
      lowStockCount(scope),
      prisma.inventoryBalance.aggregate({ where: { ...(scopeWhere(scope, { branch: true }) as Prisma.InventoryBalanceWhereInput), qtyOnHand: { gt: 0 }, OR: [{ lastMovementAt: null }, { lastMovementAt: { lt: cutoff } }] }, _sum: { purchaseValue: true }, _count: true }),
    ]);
    if (low) insights.push({ key: "reorder", tone: "warning", icon: "PackageSearch", title: "Reorder recommended", text: `${low} product(s) are at/below reorder level. Raise a purchase order to avoid stock-outs.` });
    const deadVal = N(dead._sum.purchaseValue);
    if (dead._count > 0 && deadVal > 0) insights.push({ key: "deadStock", tone: "danger", icon: "Boxes", title: "Dead stock detected", text: `${dead._count} item(s) worth ${r2(deadVal)} had no movement in 90 days. Consider a clearance offer.` });
  }

  if (access.finance || access.sales) {
    const recv = await receivable(scope);
    if (recv > 0) insights.push({ key: "receivable", tone: recv > 100000 ? "warning" : "primary", icon: "Wallet", title: "Collections opportunity", text: `${r2(recv)} is outstanding from customers. Prioritise follow-ups to improve cash flow.` });
  }

  if (!insights.length) insights.push({ key: "welcome", tone: "primary", icon: "Sparkles", title: "All quiet", text: "No urgent signals right now. Start billing and the dashboard will surface live insights." });
  return insights;
}

/* ------------------------------------------------------------- activity -- */

export interface Activity { id: number; action: string; entity: string; summary: string; user: string; at: string }

export async function getActivity(ctx: DashCtx): Promise<Activity[]> {
  const { scope } = ctx;
  const rows = await prisma.auditLog.findMany({
    where: { tenantId: scope.tenantId, ...(scope.businessId ? { businessId: scope.businessId } : {}) },
    orderBy: { createdAt: "desc" }, take: 14,
    select: { id: true, action: true, entity: true, summary: true, userName: true, createdAt: true },
  });
  return rows.map((r) => ({ id: r.id, action: r.action, entity: r.entity, summary: r.summary ?? r.action, user: r.userName ?? "System", at: r.createdAt.toISOString() }));
}

/* --------------------------------------------------------------- search -- */

export interface SearchGroup { group: string; items: { label: string; sub: string; href: string }[] }

export async function getSearch(ctx: DashCtx, q: string): Promise<SearchGroup[]> {
  const { scope, access } = ctx;
  const term = q.trim();
  if (term.length < 2) return [];
  const w = scopeWhere(scope, { branch: true });
  const groups: SearchGroup[] = [];

  const jobs: Promise<SearchGroup | null>[] = [];
  if (access.inventory || access.sales) jobs.push(prisma.product.findMany({ where: { tenantId: scope.tenantId, OR: [{ name: { contains: term } }, { sku: { contains: term } }] }, select: { id: true, name: true, sku: true }, take: 6 }).then((rows) => rows.length ? { group: "Products", items: rows.map((r) => ({ label: r.name, sub: r.sku ?? "", href: `/masters/product?id=${r.id}` })) } : null).catch(() => null));
  if (access.customers) jobs.push(prisma.customer.findMany({ where: { ...(w as Prisma.CustomerWhereInput), OR: [{ name: { contains: term } }, { phone: { contains: term } }] }, select: { id: true, name: true, phone: true }, take: 6 }).then((rows) => rows.length ? { group: "Customers", items: rows.map((r) => ({ label: r.name, sub: r.phone ?? "", href: `/crm/customer-360?id=${r.id}` })) } : null).catch(() => null));
  if (access.suppliers) jobs.push(prisma.supplier.findMany({ where: { ...(w as Prisma.SupplierWhereInput), OR: [{ name: { contains: term } }, { phone: { contains: term } }] }, select: { id: true, name: true, phone: true }, take: 6 }).then((rows) => rows.length ? { group: "Suppliers", items: rows.map((r) => ({ label: r.name, sub: r.phone ?? "", href: `/masters/supplier?id=${r.id}` })) } : null).catch(() => null));
  if (access.sales) jobs.push(prisma.sale.findMany({ where: { ...(base(scope)), invoiceNo: { contains: term } } as Prisma.SaleWhereInput, select: { id: true, invoiceNo: true, total: true }, take: 6, orderBy: { id: "desc" } }).then((rows) => rows.length ? { group: "Invoices", items: rows.map((r) => ({ label: r.invoiceNo, sub: String(r2(N(r.total))), href: `/sales/invoices?id=${r.id}` })) } : null).catch(() => null));

  for (const g of await Promise.all(jobs)) if (g) groups.push(g);
  return groups;
}
