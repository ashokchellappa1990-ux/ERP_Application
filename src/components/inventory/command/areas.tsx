"use client";

import { useState } from "react";
import Link from "next/link";
import { Boxes, Layers, ArrowDownToLine, ArrowUpFromLine, Truck, Lock, PackageCheck, Gauge as GaugeIcon, TrendingUp, TrendingDown, AlertTriangle, XCircle, PackagePlus, MinusCircle, CalendarClock, CalendarX2, ShieldAlert, Ban, PieChart, Building2, Warehouse, Sparkles, ClipboardCheck, ArrowRight, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { Bars, Donut, LineChart, DualBars, Gauge, EmptyChart } from "@/components/dashboard/charts";
import { DrillDot } from "@/components/dashboard/DrillModal";
import { cn } from "@/lib/cn";
import { useSection, type KpiT, type HealthCardT, type MovementT, type AnalyticsT, type OperationalT, type InsightT } from "./api";

const compact = (n: number) => { const a = Math.abs(n); if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`; if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`; if (a >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`; return `₹${Math.round(n)}`; };
const qtyFmt = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN");
const TEXT_TONE: Record<string, string> = { primary: "text-foreground", success: "text-success", warning: "text-warning", danger: "text-danger", info: "text-info", neutral: "text-muted" };
const KPI_ICON: Record<string, LucideIcon> = { invValue: Boxes, stockQty: Layers, stockIn: ArrowDownToLine, stockOut: ArrowUpFromLine, inTransit: Truck, reserved: Lock, available: PackageCheck, accuracy: GaugeIcon };
const HEALTH_ICON: Record<string, LucideIcon> = { lowStock: AlertTriangle, outOfStock: XCircle, overStock: PackagePlus, negativeStock: MinusCircle, nearExpiry: CalendarClock, expired: CalendarX2, damaged: ShieldAlert, blocked: Ban };
const OPS_ICON: Record<string, LucideIcon> = { grn: ArrowDownToLine, dispatch: Truck, receipt: PackageCheck, transfer: ArrowRight, allocation: Lock, verification: ClipboardCheck };

/* ---------------------------------------------------------------- primitives (match Finance/Purchase dashboards) */
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
const Loading = ({ label }: { label: string }) => <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label={label} /></div>;
function useMoney() { const fmt = useFmt(); return (n: number) => fmt.money(n || 0); }
const kpiValue = (money: (n: number) => string) => (k: KpiT) => k.unit === "money" ? money(k.value) : k.unit === "percent" ? `${k.value}%` : qtyFmt(k.value);

/* ============================================================ OVERVIEW */
export function OverviewArea({ qs }: { qs: string }) {
  const money = useMoney();
  const fv = kpiValue(money);
  const kpi = useSection<{ kpis: KpiT[] }>("kpis", qs);
  const health = useSection<{ cards: HealthCardT[]; score: number }>("health", qs);
  const ops = useSection<OperationalT>("operational", qs);
  const ins = useSection<{ insights: InsightT[] }>("ai-insights", qs);
  if (!kpi.data) return <Loading label="Loading inventory control center…" />;
  return (
    <div className="space-y-4">
      <Section title="Key Inventory Metrics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpi.data.kpis.map((k) => {
            const Icon = KPI_ICON[k.key] ?? Boxes; const tone = TEXT_TONE[k.tone] ?? "text-foreground";
            return (
              <div key={k.key} className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{k.label}</span><span className="flex items-center gap-0.5"><DrillDot id={k.key} title={k.label} /><Icon className={cn("h-4 w-4", tone)} /></span></div>
                <div className={cn("mt-1 text-xl font-bold tabular-nums", tone)}>{fv(k)}</div>
                <div className="mt-0.5 h-4" />
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Inventory Health Score" icon={GaugeIcon}>
          {!health.data ? <div className="py-6"><AppLoader label="…" size="sm" /></div> : (
            <div className="flex flex-col items-center gap-3">
              <div className={cn(health.data.score >= 70 ? "text-success" : health.data.score >= 45 ? "text-warning" : "text-danger")}><Gauge score={health.data.score} size={120} /></div>
              <Badge tone={health.data.score >= 80 ? "success" : health.data.score >= 60 ? "info" : health.data.score >= 40 ? "warning" : "danger"}>{health.data.score >= 80 ? "Healthy" : health.data.score >= 60 ? "Stable" : health.data.score >= 40 ? "At Risk" : "Critical"}</Badge>
              <p className="text-center text-2xs text-muted">Weighted from out-of-stock, negative, low &amp; expiring stock.</p>
            </div>
          )}
        </Panel>
        <Panel title="AI Inventory Insights" icon={Sparkles} className="lg:col-span-2" drill="">
          {!ins.data ? <div className="py-6"><AppLoader label="…" size="sm" /></div> : ins.data.insights.length ? (
            <div className="space-y-2">{ins.data.insights.map((i) => (
              <div key={i.key} className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/30 px-3 py-2 text-sm">
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", i.severity === "critical" || i.severity === "high" ? "bg-danger" : i.severity === "medium" ? "bg-warning" : "bg-info")} />
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-semibold text-foreground">{i.title}</span>{i.metric && <Badge tone={i.severity === "critical" || i.severity === "high" ? "danger" : i.severity === "medium" ? "warning" : "info"}>{i.metric}</Badge>}</div><p className="text-2xs text-muted">{i.detail}</p></div>
                {i.href && <Link href={i.href} className="shrink-0 text-2xs font-semibold text-primary hover:underline">Act</Link>}
              </div>
            ))}</div>
          ) : <p className="py-6 text-center text-sm text-muted">No notable insights for the selected filters.</p>}
        </Panel>
      </div>

      <Section title="Stock Health">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(health.data?.cards ?? []).map((c) => <HealthCard key={c.key} c={c} />)}
        </div>
      </Section>

      <Section title="Operational — Pending Actions">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {(ops.data?.items ?? []).map((o) => { const Icon = OPS_ICON[o.key] ?? Boxes; return (
            <Link key={o.key} href={o.href} className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{o.label}</span><Icon className="h-4 w-4 text-primary" /></div>
              <div className={cn("mt-1 text-2xl font-bold tabular-nums", o.count > 0 ? "text-foreground" : "text-muted")}>{o.count}</div>
              <div className="mt-0.5 flex items-center gap-0.5 text-2xs text-primary opacity-0 transition group-hover:opacity-100">Open <ArrowRight className="h-3 w-3" /></div>
            </Link>
          ); })}
        </div>
      </Section>
    </div>
  );
}

function HealthCard({ c }: { c: HealthCardT }) {
  const Icon = HEALTH_ICON[c.key] ?? AlertTriangle; const tone = TEXT_TONE[c.tone] ?? "text-foreground";
  return (
    <div className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{c.label}</span><span className="flex items-center gap-0.5"><DrillDot id={c.key} title={c.label} /><Icon className={cn("h-4 w-4", tone)} /></span></div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", c.count > 0 ? tone : "text-muted")}>{c.count}</div>
      <div className="mt-0.5 text-2xs text-subtle">{c.qty ? `${qtyFmt(c.qty)} units` : "—"}</div>
    </div>
  );
}

/* ============================================================ MOVEMENT */
export function MovementArea({ qs }: { qs: string }) {
  const [chart, setChart] = useState<"line" | "bar">("line");
  const { data } = useSection<MovementT>("movement", qs);
  if (!data) return <Loading label="Loading stock movement…" />;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Mini label="Stock In (period)" value={qtyFmt(data.totalIn)} tone="text-success" icon={ArrowDownToLine} />
        <Mini label="Stock Out (period)" value={qtyFmt(data.totalOut)} tone="text-danger" icon={ArrowUpFromLine} />
        <Mini label="Net Movement" value={qtyFmt(data.net)} tone={data.net >= 0 ? "text-success" : "text-danger"} icon={data.net >= 0 ? TrendingUp : TrendingDown} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Inventory Trend" icon={TrendingUp} drill="stockQty" action={
          <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">{(["line", "bar"] as const).map((c) => <button key={c} onClick={() => setChart(c)} className={cn("rounded px-2 py-0.5 text-2xs font-semibold capitalize", chart === c ? "bg-card text-primary shadow-sm" : "text-muted")}>{c}</button>)}</div>
        }>
          {data.trend.length ? (chart === "line" ? <LineChart items={data.trend} fmt={qtyFmt} /> : <Bars items={data.trend.slice(-12)} fmt={qtyFmt} />) : <EmptyChart msg="No movement in this window." />}
        </Panel>
        <Panel title="Stock Movement — In vs Out" icon={ArrowDownToLine} drill="stockIn">
          {data.inOut.length ? <DualBars series={data.inOut.slice(-12)} fmt={qtyFmt} aLabel="Stock In" bLabel="Stock Out" /> : <EmptyChart msg="No movement in this window." />}
        </Panel>
      </div>
      <Panel title="Movement by Type" icon={PieChart}>
        {data.typeMix.length ? <Donut items={data.typeMix} fmt={qtyFmt} /> : <EmptyChart msg="No movement in this window." />}
      </Panel>
    </div>
  );
}

/* ============================================================ HEALTH */
export function HealthArea({ qs }: { qs: string }) {
  const { data } = useSection<{ cards: HealthCardT[]; score: number }>("health", qs);
  if (!data) return <Loading label="Assessing stock health…" />;
  return (
    <div className="space-y-4">
      <Section title="Stock Health — click any card for the item list">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.cards.map((c) => <HealthCard key={c.key} c={c} />)}
        </div>
      </Section>
    </div>
  );
}

/* ============================================================ ANALYTICS */
export function AnalyticsArea({ qs }: { qs: string }) {
  const money = useMoney();
  const { data } = useSection<AnalyticsT>("analytics", qs);
  if (!data) return <Loading label="Crunching inventory analytics…" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Category-wise Inventory (value)" icon={PieChart} drill="byCategory">
        {data.byCategory.length ? <Donut items={data.byCategory} fmt={compact} /> : <EmptyChart />}
      </Panel>
      <Panel title="Branch-wise Inventory (value)" icon={Building2} drill="byBranch">
        {data.byBranch.length ? <Bars items={data.byBranch} fmt={compact} /> : <EmptyChart />}
      </Panel>
      <Panel title="Warehouse Utilization (qty)" icon={Warehouse} className="lg:col-span-2" drill="byWarehouse">
        {data.byWarehouse.length ? <Bars items={data.byWarehouse} fmt={qtyFmt} tone="success" /> : <EmptyChart />}
      </Panel>
    </div>
  );
}

function Mini({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</span><Icon className={cn("h-4 w-4", tone)} /></div>
      <div className={cn("mt-1 text-xl font-bold tabular-nums", tone)}>{value}</div>
    </div>
  );
}
