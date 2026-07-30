"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Coins, ClipboardList, Clock, PackageCheck, AlertCircle, XCircle, Calculator, Wallet, Undo2, Truck, Target, TrendingUp, TrendingDown, Users, PieChart, Sparkles, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { Bars, Donut, LineChart, Gauge, EmptyChart } from "@/components/dashboard/charts";
import { DrillDot } from "@/components/dashboard/DrillModal";
import { cn } from "@/lib/cn";
import { useSection, type KpiT, type TrendT, type SupplierT, type AnalyticsT, type ScorecardT, type InsightT } from "./api";

const compact = (n: number) => { const a = Math.abs(n); if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`; if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`; if (a >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`; return `₹${Math.round(n)}`; };
const TEXT_TONE: Record<string, string> = { primary: "text-foreground", secondary: "text-foreground", success: "text-success", warning: "text-warning", danger: "text-danger", info: "text-info", accent: "text-foreground" };
const KPI_ICON: Record<string, LucideIcon> = { poToday: ShoppingBag, poMonth: ShoppingBag, valToday: Coins, valMonth: Coins, pendingPO: ClipboardList, pendingAppr: Clock, partRecv: PackageCheck, fullRecv: PackageCheck, late: AlertCircle, cancelled: XCircle, avgVal: Calculator, openCommit: Wallet, retValue: Undo2, avgLead: Truck, budgetUtil: Target, payable: AlertCircle };

/* ---------------------------------------------------------------- primitives (match Finance Dashboard) */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-2"><h2 className="rounded-lg bg-brand-gradient px-3 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm">{title}</h2>{children}</div>;
}
export function Panel({ title, action, icon: Icon, className, drill, children }: { title: string; action?: React.ReactNode; icon?: LucideIcon; className?: string; drill?: string; children: React.ReactNode }) {
  return (
    <div className={cn("group overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      <div className="flex items-center justify-between border-b border-border bg-primary-subtle/40 px-4 py-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary">{Icon && <Icon className="h-4 w-4" />}{title}{drill && <DrillDot id={drill} title={title} />}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
const Empty = ({ msg }: { msg: string }) => <div className="rounded-2xl border border-dashed border-border-strong bg-card p-8 text-center text-sm text-muted">{msg}</div>;
const Loading = ({ label }: { label: string }) => <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label={label} /></div>;
function useMoney() { const fmt = useFmt(); return (n: number) => fmt.money(n || 0); }

// ============================================================ OVERVIEW
export function OverviewArea({ qs }: { qs: string; onTab?: (t: string) => void }) {
  const money = useMoney();
  const kpi = useSection<{ kpis: KpiT[] }>("kpis", qs);
  const sc = useSection<ScorecardT>("scorecard", qs);
  const ins = useSection<{ insights: InsightT[] }>("ai-insights", qs);
  if (!kpi.data) return <Loading label="Loading procurement KPIs…" />;
  return (
    <div className="space-y-4">
      <Section title="Executive KPIs">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
          {kpi.data.kpis.map((k) => {
            const Icon = KPI_ICON[k.key] ?? Coins; const tone = TEXT_TONE[k.tone] ?? "text-foreground";
            const value = k.unit === "money" ? money(k.value) : k.unit === "percent" ? `${k.value}%` : k.unit === "days" ? `${k.value}d` : String(k.value);
            const G = k.growthPct > 0 ? TrendingUp : k.growthPct < 0 ? TrendingDown : null;
            return (
              <div key={k.key} className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{k.label}</span><span className="flex items-center gap-0.5"><DrillDot id={k.key} title={k.label} /><Icon className={cn("h-4 w-4", tone)} /></span></div>
                <div className={cn("mt-1 text-xl font-bold tabular-nums", tone)}>{value}</div>
                {(k.prev > 0 || k.growthPct !== 0) && G ? <div className="mt-0.5 flex items-center gap-1 text-2xs"><span className={cn("inline-flex items-center gap-0.5 font-semibold", k.growthPct >= 0 ? "text-success" : "text-danger")}><G className="h-3 w-3" />{k.growthPct >= 0 ? "+" : ""}{k.growthPct}%</span><span className="text-subtle">vs {k.unit === "money" ? money(k.prev) : k.prev}</span></div> : <div className="mt-0.5 h-4" />}
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Procurement Scorecard" icon={Target} drill="scorecard">
          {!sc.data ? <div className="py-6"><AppLoader label="…" size="sm" /></div> : (
            <div className="flex flex-col items-center gap-3">
              <div className={cn(sc.data.overall >= 60 ? "text-success" : sc.data.overall >= 40 ? "text-warning" : "text-danger")}><Gauge score={sc.data.overall} size={120} /></div>
              <Badge tone={sc.data.overall >= 80 ? "success" : sc.data.overall >= 60 ? "info" : sc.data.overall >= 40 ? "warning" : "danger"}>{sc.data.band}</Badge>
              <div className="w-full space-y-1.5">{sc.data.subScores.map((s) => <div key={s.label}><div className="flex justify-between text-2xs"><span className="text-muted">{s.label}</span><span className="font-semibold text-foreground">{s.score}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", s.score >= 60 ? "bg-success" : s.score >= 40 ? "bg-warning" : "bg-danger")} style={{ width: `${s.score}%` }} /></div></div>)}</div>
            </div>
          )}
        </Panel>
        <Panel title="AI Procurement Insights" icon={Sparkles} className="lg:col-span-2" drill="insights">
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
    </div>
  );
}

// ============================================================ TRENDS
export function TrendsArea({ qs }: { qs: string }) {
  const money = useMoney();
  const [gran, setGran] = useState("monthly");
  const [chart, setChart] = useState<"line" | "bar">("line");
  const { data } = useSection<TrendT>("trend", `${qs}&granularity=${gran}`);
  return (
    <Panel title="Purchase Trend" icon={TrendingUp} drill="trend" action={
      <div className="flex items-center gap-2">
        <select value={gran} onChange={(e) => setGran(e.target.value)} className="h-8 rounded-md border border-border-strong bg-surface px-2 text-2xs capitalize focus:border-primary focus:outline-none">{["daily", "weekly", "monthly", "quarterly", "yearly"].map((g) => <option key={g} value={g}>{g}</option>)}</select>
        <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">{(["line", "bar"] as const).map((c) => <button key={c} onClick={() => setChart(c)} className={cn("rounded px-2 py-0.5 text-2xs font-semibold capitalize", chart === c ? "bg-card text-primary shadow-sm" : "text-muted")}>{c}</button>)}</div>
      </div>
    }>
      {!data ? <div className="py-8"><AppLoader label="Loading trend…" size="sm" /></div> : data.points.some((p) => p.value) ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
            <div><div className="text-2xs uppercase tracking-wide text-muted">Total ({gran})</div><div className="text-lg font-bold tabular-nums text-foreground">{money(data.currentTotal)}</div></div>
            <div><div className="text-2xs uppercase tracking-wide text-muted">Momentum</div><div className={cn("text-lg font-bold", data.growthPct >= 0 ? "text-success" : "text-danger")}>{data.growthPct >= 0 ? "+" : ""}{data.growthPct}%</div></div>
          </div>
          {chart === "line" ? <LineChart items={data.points} fmt={compact} /> : <Bars items={data.points} fmt={compact} />}
        </>
      ) : <EmptyChart msg="No purchases in this window." />}
    </Panel>
  );
}

// ============================================================ SUPPLIERS
export function SuppliersArea({ qs }: { qs: string }) {
  const money = useMoney();
  const { data } = useSection<{ suppliers: SupplierT[] }>("suppliers", qs);
  if (!data) return <Loading label="Analysing suppliers…" />;
  if (!data.suppliers.length) return <Empty msg="No supplier spend recorded for the selected filters." />;
  return (
    <Panel title="Supplier Performance" icon={Users} drill="suppliers">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2/50 text-left text-2xs font-semibold uppercase tracking-wide text-muted"><th className="px-3 py-2">Supplier</th><th className="px-3 py-2 text-right">Spend</th><th className="px-3 py-2 text-center">Rating</th><th className="px-3 py-2 text-center">On-Time</th><th className="px-3 py-2 text-center">Lead</th><th className="px-3 py-2 text-center">Return%</th><th className="px-3 py-2 text-center">Risk</th><th className="px-3 py-2 text-right">Outstanding</th><th className="px-3 py-2">AI</th></tr></thead>
          <tbody>
            {data.suppliers.map((s) => (
              <tr key={s.name} className="border-b border-border/50 last:border-0">
                <td className="px-3 py-1.5 font-medium text-foreground">{s.name}</td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-foreground">{money(s.spend)}</td>
                <td className="px-3 py-1.5 text-center"><span className="text-warning">{"★".repeat(s.rating)}<span className="text-subtle">{"★".repeat(5 - s.rating)}</span></span></td>
                <td className="px-3 py-1.5 text-center tabular-nums">{s.onTimePct != null ? <span className={cn(s.onTimePct >= 90 ? "text-success" : s.onTimePct >= 70 ? "text-warning" : "text-danger")}>{s.onTimePct}%</span> : <span className="text-subtle">—</span>}</td>
                <td className="px-3 py-1.5 text-center tabular-nums text-muted">{s.avgLeadDays != null ? `${s.avgLeadDays}d` : "—"}</td>
                <td className="px-3 py-1.5 text-center tabular-nums text-muted">{s.returnPct}%</td>
                <td className="px-3 py-1.5 text-center"><span className={cn("rounded-full px-1.5 py-0.5 text-2xs font-bold", s.riskScore >= 60 ? "bg-danger/15 text-danger" : s.riskScore >= 35 ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>{s.riskScore}</span></td>
                <td className={cn("px-3 py-1.5 text-right tabular-nums", s.outstanding > 0 ? "text-danger" : "text-muted")}>{money(s.outstanding)}</td>
                <td className="px-3 py-1.5 text-2xs text-muted">{s.tag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ============================================================ ANALYTICS
export function AnalyticsArea({ qs }: { qs: string }) {
  const { data } = useSection<AnalyticsT>("analytics", qs);
  if (!data) return <Loading label="Crunching analytics…" />;
  const C = ({ title, items, kind, dk }: { title: string; items: { name: string; value: number }[]; kind?: "donut" | "accent" | "danger" | "success"; dk?: string }) => (
    <Panel title={title} icon={PieChart} drill={dk}>{items.length ? (kind === "donut" ? <Donut items={items} fmt={compact} /> : <Bars items={items.slice(0, 8)} fmt={compact} tone={kind === "accent" ? "accent" : kind === "danger" ? "danger" : kind === "success" ? "success" : "primary"} />) : <EmptyChart msg="No data for the selected period." />}</Panel>
  );
  return (
    <Section title="Purchase Analytics">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <C title="By Purchase Type" items={data.byType} kind="donut" dk="an-type" />
        <C title="By Category" items={data.byCategory} kind="accent" dk="an-category" />
        <C title="By Supplier" items={data.bySupplier} dk="an-supplier" />
        <C title="By Buyer" items={data.byBuyer} kind="success" dk="an-buyer" />
        <C title="By Warehouse" items={data.byWarehouse} dk="an-warehouse" />
        <C title="By Brand" items={data.byBrand} kind="accent" dk="an-brand" />
        <C title="Top Purchased Products" items={data.topProducts} kind="success" dk="an-topProducts" />
        <C title="Least Purchased Products" items={data.leastProducts} kind="danger" dk="an-leastProducts" />
      </div>
    </Section>
  );
}
