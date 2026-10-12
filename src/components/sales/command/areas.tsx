"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Coins, TrendingUp, TrendingDown, ReceiptText, ClipboardList, Clock, XCircle, Calculator,
  Wallet, Undo2, Percent, ShoppingBag, Target, Users, PieChart, Sparkles, Package, MapPin,
  UserPlus, Repeat, AlertTriangle, Lightbulb, type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { Bars, Donut, LineChart, Gauge, EmptyChart } from "@/components/dashboard/charts";
import { ForecastChart } from "@/components/intelligence/charts";
import { cn } from "@/lib/cn";
import { InfoButton } from "./info";
import {
  useSection, type KpiT, type TrendT, type ScorecardT, type InsightT, type BranchRow, type ExecRow,
  type RecentT, type ProductsT, type MixT, type ReturnsT, type CustomersT, type AnalyticsT, type RiskT, type RecT, type ForecastT,
} from "./api";

const compact = (n: number) => { const a = Math.abs(n); if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`; if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`; if (a >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`; return `₹${Math.round(n)}`; };
const TEXT_TONE: Record<string, string> = { primary: "text-foreground", secondary: "text-foreground", success: "text-success", warning: "text-warning", danger: "text-danger", info: "text-info", accent: "text-foreground" };
const KPI_ICON: Record<string, LucideIcon> = { salesToday: Coins, salesMonth: TrendingUp, salesYear: Calculator, grossSales: ShoppingBag, netSales: Wallet, grossProfit: Coins, marginPct: Percent, invoices: ReceiptText, orders: ClipboardList, pendingOrders: Clock, cancelled: XCircle, avgInvoice: Calculator, avgOrderValue: Calculator, avgDiscount: Percent, returnValue: Undo2, returnPct: Undo2 };

/* ---------------------------------------------------------------- primitives (match Finance/Purchase dashboards) */
export function Section({ title, info, children }: { title: string; info?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><h2 className="group flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm">{title}{info && <InfoButton id={info} light />}</h2>{children}</div>;
}
export function Panel({ title, action, icon: Icon, className, info, children }: { title: string; action?: React.ReactNode; icon?: LucideIcon; className?: string; info?: string; children: React.ReactNode }) {
  return (
    <div className={cn("group overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      <div className="flex items-center justify-between border-b border-border bg-primary-subtle/40 px-4 py-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary">{Icon && <Icon className="h-4 w-4" />}{title}{info && <InfoButton id={info} />}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
const Empty = ({ msg }: { msg: string }) => <div className="rounded-2xl border border-dashed border-border-strong bg-card p-8 text-center text-sm text-muted">{msg}</div>;
const Loading = ({ label }: { label: string }) => <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label={label} /></div>;
function useMoney() { const fmt = useFmt(); return (n: number) => fmt.money(n || 0); }

function ChartCard({ title, items, kind, icon, info }: { title: string; items: NV[]; kind?: "donut" | "primary" | "accent" | "danger" | "success"; icon?: LucideIcon; info?: string }) {
  return <Panel title={title} icon={icon ?? PieChart} info={info}>{items?.length ? (kind === "donut" ? <Donut items={items} fmt={compact} /> : <Bars items={items.slice(0, 8)} fmt={compact} tone={kind === "accent" ? "accent" : kind === "danger" ? "danger" : kind === "success" ? "success" : "primary"} />) : <EmptyChart msg="No data for the selected period." />}</Panel>;
}
type NV = { name: string; value: number };

// ============================================================ OVERVIEW
export function OverviewArea({ qs }: { qs: string }) {
  const money = useMoney();
  const kpi = useSection<{ kpis: KpiT[] }>("kpis", qs);
  const sc = useSection<ScorecardT>("scorecard", qs);
  const ins = useSection<{ insights: InsightT[] }>("ai-insights", qs);
  const tb = useSection<{ branches: BranchRow[] }>("top-branches", qs);
  const te = useSection<{ executives: ExecRow[] }>("top-executives", qs);
  const rc = useSection<RecentT>("recent", qs);
  if (!kpi.data) return <Loading label="Loading sales KPIs…" />;
  return (
    <div className="space-y-4">
      <Section title="Executive KPIs">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpi.data.kpis.map((k) => {
            const Icon = KPI_ICON[k.key] ?? Coins; const tone = TEXT_TONE[k.tone] ?? "text-foreground";
            const value = k.unit === "money" ? money(k.value) : k.unit === "percent" ? `${k.value}%` : String(k.value);
            const G = k.growthPct > 0 ? TrendingUp : k.growthPct < 0 ? TrendingDown : null;
            return (
              <div key={k.key} className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{k.label}</span><span className="flex items-center gap-0.5"><InfoButton id={k.key} /><Icon className={cn("h-4 w-4", tone)} /></span></div>
                <div className={cn("mt-1 text-xl font-bold tabular-nums", tone)}>{value}</div>
                {(k.prev > 0 || k.growthPct !== 0) && G ? <div className="mt-0.5 flex items-center gap-1 text-2xs"><span className={cn("inline-flex items-center gap-0.5 font-semibold", k.growthPct >= 0 ? "text-success" : "text-danger")}><G className="h-3 w-3" />{k.growthPct >= 0 ? "+" : ""}{k.growthPct}%</span><span className="text-subtle">vs {k.unit === "money" ? money(k.prev) : k.prev}</span></div> : <div className="mt-0.5 h-4" />}
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Sales Scorecard" icon={Target} info="scorecard">
          {!sc.data ? <div className="py-6"><AppLoader label="…" size="sm" /></div> : (
            <div className="flex flex-col items-center gap-3">
              <div className={cn(sc.data.overall >= 60 ? "text-success" : sc.data.overall >= 40 ? "text-warning" : "text-danger")}><Gauge score={sc.data.overall} size={120} /></div>
              <Badge tone={sc.data.overall >= 80 ? "success" : sc.data.overall >= 60 ? "info" : sc.data.overall >= 40 ? "warning" : "danger"}>{sc.data.band}</Badge>
              <div className="w-full space-y-1.5">{sc.data.subScores.map((s) => <div key={s.label}><div className="flex justify-between text-2xs"><span className="text-muted">{s.label}</span><span className="font-semibold text-foreground">{s.score}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", s.score >= 60 ? "bg-success" : s.score >= 40 ? "bg-warning" : "bg-danger")} style={{ width: `${s.score}%` }} /></div></div>)}</div>
            </div>
          )}
        </Panel>
        <Panel title="AI Sales Insights" icon={Sparkles} className="lg:col-span-2" info="insights">
          {!ins.data ? <div className="py-6"><AppLoader label="…" size="sm" /></div> : ins.data.insights.length ? (
            <div className="space-y-2">{ins.data.insights.map((i) => (
              <div key={i.key} className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/30 px-3 py-2 text-sm">
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", i.severity === "critical" || i.severity === "high" ? "bg-danger" : i.severity === "medium" ? "bg-warning" : "bg-info")} />
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-semibold text-foreground">{i.title}</span>{i.metric && <Badge tone={i.severity === "critical" || i.severity === "high" ? "danger" : i.severity === "medium" ? "warning" : "info"}>{i.metric}</Badge>}</div><p className="text-2xs text-muted">{i.detail}</p></div>
                {i.href && <Link href={i.href} className="shrink-0 text-2xs font-semibold text-primary hover:underline">View</Link>}
              </div>
            ))}</div>
          ) : <p className="py-6 text-center text-sm text-muted">No notable insights for the selected filters.</p>}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top 10 Branches" icon={ShoppingBag} info="topBranches">
          {!tb.data ? <div className="py-6"><AppLoader label="…" size="sm" /></div> : tb.data.branches.length ? (
            <div className="space-y-1.5">{tb.data.branches.map((b, i) => (
              <div key={b.name} className="flex items-center gap-2 text-sm">
                <span className="w-5 shrink-0 text-2xs font-bold text-subtle">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{b.name}</span>
                <span className="text-2xs text-subtle">{b.orders} inv</span>
                {b.growthPct !== 0 && <span className={cn("w-14 text-right text-2xs font-semibold", b.growthPct >= 0 ? "text-success" : "text-danger")}>{b.growthPct >= 0 ? "+" : ""}{b.growthPct}%</span>}
                <span className="w-24 text-right font-semibold tabular-nums text-foreground">{money(b.value)}</span>
              </div>
            ))}</div>
          ) : <EmptyChart msg="No branch sales in this period." />}
        </Panel>
        <Panel title="Top 10 Sales Executives" icon={Users} info="topExecutives" action={<span className="text-2xs text-subtle">cashier proxy</span>}>
          {!te.data ? <div className="py-6"><AppLoader label="…" size="sm" /></div> : te.data.executives.length ? (
            <div className="space-y-1.5">{te.data.executives.map((e, i) => (
              <div key={e.name + i} className="flex items-center gap-2 text-sm">
                <span className="w-5 shrink-0 text-2xs font-bold text-subtle">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{e.name}</span>
                <span className="text-2xs text-subtle">{e.orders} inv</span>
                <span className="w-24 text-right font-semibold tabular-nums text-foreground">{money(e.sales)}</span>
              </div>
            ))}</div>
          ) : <EmptyChart msg="No attributed sales in this period." />}
        </Panel>
      </div>

      <Section title="Recent Sales Activity">
        <div className="grid gap-4 lg:grid-cols-3">
          <RecentList title="Latest Orders" icon={ClipboardList} rows={rc.data?.orders} loading={!rc.data} money={money} info="recent" />
          <RecentList title="Latest Invoices" icon={ReceiptText} rows={rc.data?.invoices} loading={!rc.data} money={money} info="recent" />
          <RecentList title="Recent Returns" icon={Undo2} rows={rc.data?.returns} loading={!rc.data} money={money} info="recent" />
        </div>
      </Section>
    </div>
  );
}

function RecentList({ title, icon, rows, loading, money, info }: { title: string; icon: LucideIcon; rows?: RecentT["orders"]; loading: boolean; money: (n: number) => string; info?: string }) {
  return (
    <Panel title={title} icon={icon} info={info}>
      {loading ? <div className="py-6"><AppLoader label="…" size="sm" /></div> : rows && rows.length ? (
        <div className="space-y-1">{rows.map((r) => (
          <Link key={r.id} href={r.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2/50">
            <div className="min-w-0 flex-1"><div className="truncate font-medium text-foreground">{r.no}</div><div className="truncate text-2xs text-muted">{r.customer} · {r.date}</div></div>
            <div className="text-right"><div className="font-semibold tabular-nums text-foreground">{money(r.amount)}</div><div className="text-2xs text-subtle">{r.status}</div></div>
          </Link>
        ))}</div>
      ) : <EmptyChart msg="Nothing recent." />}
    </Panel>
  );
}

// ============================================================ TRENDS (Sales & Product)
export function TrendsArea({ qs }: { qs: string }) {
  const money = useMoney();
  const [gran, setGran] = useState("monthly");
  const [chart, setChart] = useState<"line" | "bar">("line");
  const tr = useSection<TrendT>("trend", `${qs}&granularity=${gran}`);
  const pp = useSection<ProductsT>("products", qs);
  const mx = useSection<MixT>("mix", qs);
  const rt = useSection<ReturnsT>("returns", qs);
  return (
    <div className="space-y-4">
      <Panel title="Sales Trend" icon={TrendingUp} info="trend" action={
        <div className="flex items-center gap-2">
          <select value={gran} onChange={(e) => setGran(e.target.value)} className="h-8 rounded-md border border-border-strong bg-surface px-2 text-2xs capitalize focus:border-primary focus:outline-none">{["daily", "weekly", "monthly", "quarterly", "yearly"].map((g) => <option key={g} value={g}>{g}</option>)}</select>
          <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">{(["line", "bar"] as const).map((c) => <button key={c} onClick={() => setChart(c)} className={cn("rounded px-2 py-0.5 text-2xs font-semibold capitalize", chart === c ? "bg-card text-primary shadow-sm" : "text-muted")}>{c}</button>)}</div>
        </div>
      }>
        {!tr.data ? <div className="py-8"><AppLoader label="Loading trend…" size="sm" /></div> : tr.data.points.some((p) => p.value) ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
              <div><div className="text-2xs uppercase tracking-wide text-muted">Total ({gran})</div><div className="text-lg font-bold tabular-nums text-foreground">{money(tr.data.currentTotal)}</div></div>
              <div><div className="text-2xs uppercase tracking-wide text-muted">Momentum</div><div className={cn("text-lg font-bold", tr.data.growthPct >= 0 ? "text-success" : "text-danger")}>{tr.data.growthPct >= 0 ? "+" : ""}{tr.data.growthPct}%</div></div>
            </div>
            {chart === "line" ? <LineChart items={tr.data.points} fmt={compact} /> : <Bars items={tr.data.points} fmt={compact} />}
          </>
        ) : <EmptyChart msg="No sales in this window." />}
      </Panel>

      <Section title="Product Performance">
        {pp.data && <div className="mb-2 flex flex-wrap gap-2 text-2xs">
          <Badge tone="success">{pp.data.movingCount} moving</Badge>
          <Badge tone={pp.data.nonMovingCount > 0 ? "warning" : "neutral"}>{pp.data.nonMovingCount} non-moving</Badge>
          <Badge tone="neutral">{pp.data.activeCount} active SKUs</Badge>
        </div>}
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <ChartCard title="Top Revenue Products" items={pp.data?.topRevenue ?? []} kind="primary" icon={Package} info="prodRevenue" />
          <ChartCard title="Top Quantity Sold" items={pp.data?.topQty ?? []} kind="success" icon={Package} info="prodQty" />
          <ChartCard title="Top Profit Products" items={pp.data?.topProfit ?? []} kind="accent" icon={Coins} info="prodProfit" />
          <ChartCard title="Slow Moving Products" items={pp.data?.slow ?? []} kind="danger" icon={TrendingDown} info="prodSlow" />
        </div>
      </Section>

      <Section title="Product Mix & Returns">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <ChartCard title="Category-wise Sales" items={mx.data?.byCategory ?? []} kind="donut" icon={PieChart} info="mixCategory" />
          <ChartCard title="Brand-wise Sales" items={mx.data?.byBrand ?? []} kind="accent" icon={PieChart} info="mixBrand" />
          <ChartCard title="Return Trend (6m)" items={rt.data?.trend ?? []} kind="danger" icon={Undo2} info="returnTrend" />
          <Panel title="Top Returned Products" icon={Undo2} info="returnTop">
            {rt.data ? (rt.data.topReturned.length ? <>
              <div className="mb-2 text-2xs text-muted">Return rate <span className="font-bold text-danger">{rt.data.returnPct}%</span> · {compact(rt.data.returnValue)}</div>
              <Bars items={rt.data.topReturned} fmt={compact} tone="danger" />
            </> : <EmptyChart msg="No returns in this period." />) : <div className="py-6"><AppLoader label="…" size="sm" /></div>}
          </Panel>
        </div>
      </Section>
    </div>
  );
}

// ============================================================ CUSTOMER
export function CustomerArea({ qs }: { qs: string }) {
  const money = useMoney();
  const { data } = useSection<CustomersT>("customers", qs);
  if (!data) return <Loading label="Analysing customers…" />;
  const t = data.totals;
  const cards: { label: string; value: number | string; icon: LucideIcon; tone: string }[] = [
    { label: "Total Customers", value: t.totalCustomers, icon: Users, tone: "text-foreground" },
    { label: "Active", value: t.activeCustomers, icon: Users, tone: "text-success" },
    { label: "Inactive", value: t.inactiveCustomers, icon: Users, tone: "text-muted" },
    { label: "New (period)", value: t.newCustomers, icon: UserPlus, tone: "text-primary" },
    { label: "Repeat Buyers", value: t.repeatCustomers, icon: Repeat, tone: "text-info" },
    { label: "Repeat Rate", value: `${t.repeatPct}%`, icon: Percent, tone: "text-accent" },
  ];
  return (
    <div className="space-y-4">
      <Section title="Customer Overview" info="custOverview">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map((c) => { const Icon = c.icon; return (
            <div key={c.label} className="group rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{c.label}</span><Icon className={cn("h-4 w-4", c.tone)} /></div>
              <div className={cn("mt-1 text-xl font-bold tabular-nums", c.tone)}>{c.value}</div>
            </div>
          ); })}
        </div>
      </Section>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Sales by Customer Type" items={data.byType} kind="donut" icon={Users} info="custType" />
        <ChartCard title="Sales by Customer Category" items={data.byCategory} kind="accent" icon={Users} info="custCategory" />
        <ChartCard title="Top Customers" items={data.topCustomers} kind="primary" icon={Users} info="custTop" />
        <ChartCard title="Customer Acquisition (6m)" items={data.acquisition} kind="success" icon={UserPlus} info="custAcq" />
        <ChartCard title="Sales by City" items={data.byCity} kind="primary" icon={MapPin} info="custCity" />
        <ChartCard title="Sales by State" items={data.byState} kind="accent" icon={MapPin} info="custState" />
      </div>
    </div>
  );
}

// ============================================================ ANALYTICS
export function AnalyticsArea({ qs }: { qs: string }) {
  const money = useMoney();
  const an = useSection<AnalyticsT>("analytics", qs);
  const risk = useSection<{ risks: RiskT[] }>("ai-risk", qs);
  const rec = useSection<{ recommendations: RecT[] }>("ai-recommendations", qs);
  const fc = useSection<{ forecasts: ForecastT[] }>("ai-forecast", qs);
  if (!an.data) return <Loading label="Crunching analytics…" />;
  const d = an.data;
  const Cmp = ({ title, cur, prev, growth, info }: { title: string; cur: number; prev: number; growth: number; info?: string }) => (
    <div className="group rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{title}</span>{info && <InfoButton id={info} />}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-foreground">{money(cur)}</div>
      <div className="mt-0.5 flex items-center gap-1 text-2xs"><span className={cn("font-semibold", growth >= 0 ? "text-success" : "text-danger")}>{growth >= 0 ? "+" : ""}{growth}%</span><span className="text-subtle">vs {money(prev)}</span></div>
    </div>
  );
  return (
    <div className="space-y-4">
      <Section title="Comparative & Performance">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cmp title="This Month vs Last" cur={d.comparativeMoM.current} prev={d.comparativeMoM.previous} growth={d.comparativeMoM.growthPct} info="cmpMoM" />
          <Cmp title="This Year vs Last" cur={d.comparativeYoY.current} prev={d.comparativeYoY.previous} growth={d.comparativeYoY.growthPct} info="cmpYoY" />
          <div className="group rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">Discount Given</span><InfoButton id="anDiscount" /></div><div className="mt-1 text-lg font-bold tabular-nums text-accent">{money(d.discount.total)}</div><div className="mt-0.5 text-2xs text-subtle">{d.discount.pct}% of gross</div></div>
          <div className="group rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">Cancellations</span><InfoButton id="anCancel" /></div><div className="mt-1 text-lg font-bold tabular-nums text-danger">{money(d.cancellation.value)}</div><div className="mt-0.5 text-2xs text-subtle">{d.cancellation.count} invoice(s)</div></div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RankCard title="Top Branch" row={d.ranking.topBranch} tone="success" money={money} info="rankTopBranch" />
          <RankCard title="Lowest Branch" row={d.ranking.lowBranch} tone="danger" money={money} info="rankLowBranch" />
          <RankCard title="Top Executive" row={d.ranking.topExec} tone="success" money={money} info="rankTopExec" />
          <RankCard title="Lowest Executive" row={d.ranking.lowExec} tone="danger" money={money} info="rankLowExec" />
        </div>
      </Section>

      <Section title="Sales Analytics">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <ChartCard title="Branch-wise Sales" items={d.byBranch} kind="primary" icon={ShoppingBag} info="anBranch" />
          <ChartCard title="Channel-wise Sales" items={d.byChannel} kind="donut" icon={PieChart} info="anChannel" />
          <ChartCard title="Category Analysis" items={d.byCategory} kind="accent" icon={PieChart} info="anCategory" />
          <ChartCard title="Brand Analysis" items={d.byBrand} kind="accent" icon={PieChart} info="anBrand" />
          <ChartCard title="State-wise Sales" items={d.byState} kind="primary" icon={MapPin} info="anState" />
          <ChartCard title="City-wise Sales" items={d.byCity} kind="primary" icon={MapPin} info="anCity" />
          <ChartCard title="By Customer Category" items={d.byCustomerCategory} kind="success" icon={Users} info="anCustCat" />
          <ChartCard title="By Customer Type" items={d.byCustomerType} kind="success" icon={Users} info="anCustType" />
        </div>
      </Section>

      <Section title="AI Sales Intelligence">
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Sales Forecast" icon={TrendingUp} info="aiForecast">
            {!fc.data ? <div className="py-6"><AppLoader label="…" size="sm" /></div> : fc.data.forecasts[0] ? (
              <div>
                <div className="mb-2 flex items-center justify-between text-sm"><span className="text-muted">{fc.data.forecasts[0].label}</span><span className="font-bold text-foreground">{money(fc.data.forecasts[0].forecast)}</span></div>
                <ForecastChart points={fc.data.forecasts[0].series} unit="money" height={150} />
                <div className="mt-1 flex items-center gap-2 text-2xs text-subtle"><span>Confidence {Math.round(fc.data.forecasts[0].confidence)}%</span><span className={cn("font-semibold", fc.data.forecasts[0].trendPct >= 0 ? "text-success" : "text-danger")}>{fc.data.forecasts[0].trendPct >= 0 ? "+" : ""}{fc.data.forecasts[0].trendPct}% trend</span></div>
              </div>
            ) : <EmptyChart msg="Not enough history to forecast." />}
          </Panel>
          <Panel title="Risk Radar" icon={AlertTriangle} info="aiRisk">
            {!risk.data ? <div className="py-6"><AppLoader label="…" size="sm" /></div> : risk.data.risks.length ? (
              <div className="space-y-2">{risk.data.risks.map((r) => (
                <div key={r.key} className="rounded-lg border border-border bg-surface-2/30 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2"><Badge tone={r.severity === "Critical" || r.severity === "High" ? "danger" : r.severity === "Medium" ? "warning" : "neutral"}>{r.severity}</Badge><span className="font-semibold text-foreground">{r.title}</span></div>
                  <p className="mt-0.5 text-2xs text-muted">{r.explanation}</p>
                  <p className="mt-0.5 text-2xs text-primary">→ {r.mitigation}</p>
                </div>
              ))}</div>
            ) : <p className="py-6 text-center text-sm text-muted">No material risks detected.</p>}
          </Panel>
          <Panel title="Recommendations" icon={Lightbulb} info="aiRec">
            {!rec.data ? <div className="py-6"><AppLoader label="…" size="sm" /></div> : rec.data.recommendations.length ? (
              <div className="space-y-2">{rec.data.recommendations.map((r) => (
                <div key={r.key} className="rounded-lg border border-border bg-surface-2/30 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold text-foreground">{r.title}</span><Link href={r.action.href} className="shrink-0 text-2xs font-semibold text-primary hover:underline">{r.action.label}</Link></div>
                  <p className="mt-0.5 text-2xs text-muted">{r.reason}</p>
                  <div className="mt-1 flex items-center gap-2 text-2xs"><Badge tone={r.riskLevel === "High" ? "danger" : r.riskLevel === "Medium" ? "warning" : "success"}>{r.riskLevel} risk</Badge><span className="text-subtle">{r.expectedBenefit}</span>{r.estimatedImpact !== "—" && <span className="font-semibold text-success">{r.estimatedImpact}</span>}</div>
                </div>
              ))}</div>
            ) : <p className="py-6 text-center text-sm text-muted">No recommendations right now.</p>}
          </Panel>
        </div>
      </Section>
    </div>
  );
}

function RankCard({ title, row, tone, money, info }: { title: string; row: NV | null; tone: string; money: (n: number) => string; info?: string }) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{title}</span>{info && <InfoButton id={info} />}</div>
      {row ? <><div className="mt-1 truncate text-sm font-bold text-foreground">{row.name}</div><div className={cn("text-lg font-bold tabular-nums", tone === "success" ? "text-success" : "text-danger")}>{money(row.value)}</div></> : <div className="mt-1 text-sm text-subtle">—</div>}
    </div>
  );
}
