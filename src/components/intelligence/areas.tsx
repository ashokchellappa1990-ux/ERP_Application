"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, ChevronDown, AlertTriangle, Lightbulb, ClipboardCheck, Info, ArrowRight, ShieldAlert, Sparkles, Activity, History as HistoryIcon, Target } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { Gauge } from "@/components/dashboard/charts";
import { cn } from "@/lib/cn";
import { ForecastChart, fmtByUnit } from "./charts";
import { jget, inr, qs, SEV_TONE, BAND_COLOR, type PredictionT, type RiskT, type OppT, type RecT, type HealthT, type OverviewT } from "./api";

export interface AreaProps { period?: string; horizon: number; branchNote?: string }
const q = (p: AreaProps) => qs({ period: p.period, horizon: p.horizon });

// ------------------------------------------------------------------ shared cards
export function PredictionCard({ p }: { p: PredictionT }) {
  const [open, setOpen] = useState(false);
  const Icon = p.trendPct > 1 ? TrendingUp : p.trendPct < -1 ? TrendingDown : Minus;
  const favourable = (p.goodDirection === "up" && p.trendPct >= 0) || (p.goodDirection === "down" && p.trendPct <= 0) || p.goodDirection === "neutral";
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-2xs font-semibold text-muted">{p.label}</div>
          <div className="text-lg font-bold text-foreground">{p.formattedForecast}</div>
          <div className="text-[10px] text-subtle">from {p.formattedCurrent} · {p.horizonDays}d</div>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold", favourable ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}><Icon className="h-3 w-3" />{p.trendPct >= 0 ? "+" : ""}{p.trendPct}%</span>
      </div>
      <ForecastChart points={p.series} unit={p.unit} height={110} />
      <div className="mt-1 flex items-center justify-between text-[10px]">
        <span className="text-muted">Confidence <b className="text-foreground">{p.confidence}%</b></span>
        <span className="text-muted">Risk <b className={cn(p.riskScore >= 60 ? "text-danger" : p.riskScore >= 35 ? "text-warning" : "text-success")}>{p.riskScore}</b></span>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-0.5 font-semibold text-primary">Explain <ChevronDown className={cn("h-3 w-3 transition", open && "rotate-180")} /></button>
      </div>
      {open && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-surface-2/30 p-2 text-[10px] leading-relaxed">
          <p><b className="text-foreground">Why:</b> <span className="text-muted">{p.explain.why}</span></p>
          <p><b className="text-foreground">History:</b> <span className="text-muted">{p.explain.historicalComparison}</span></p>
          <p><b className="text-foreground">Impact:</b> <span className="text-muted">{p.explain.expectedImpact}</span></p>
          <p><b className="text-foreground">Sources:</b> <span className="text-muted">{p.explain.dataSources.join(", ")}</span></p>
          <p><b className="text-foreground">Rules:</b> <span className="text-muted">{p.explain.rulesApplied.join("; ")}</span></p>
        </div>
      )}
    </div>
  );
}

export function RiskCard({ r }: { r: RiskT }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-foreground"><ShieldAlert className="h-4 w-4 text-danger" /> {r.title}</span>
        <Badge tone={SEV_TONE[r.severity] ?? "neutral"}>{r.severity}</Badge>
      </div>
      <p className="mt-1 text-2xs text-muted">{r.explanation}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-muted">Probability {r.probability}%</span>
        {r.impact > 0 && <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger">Impact {r.impactLabel}</span>}
        <span className="text-subtle">·</span><span className="capitalize text-subtle">{r.module}</span>
      </div>
      <div className="mt-1.5 rounded-lg bg-primary-subtle/20 p-2 text-[10px]"><b className="text-foreground">Mitigation:</b> <span className="text-muted">{r.mitigation}</span></div>
      {r.href && <Link href={r.href} className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline">Take action <ArrowRight className="h-3 w-3" /></Link>}
    </div>
  );
}

export function OppCard({ o }: { o: OppT }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Lightbulb className="h-4 w-4 text-warning" /> {o.title}</span><span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">{o.benefitLabel}</span></div>
      <p className="mt-1 text-2xs text-muted">{o.rationale}</p>
      <div className="mt-1.5 flex items-center gap-2 text-[10px]"><span className="rounded bg-surface-2 px-1.5 py-0.5 text-muted">Confidence {o.confidence}%</span><span className="capitalize text-subtle">{o.module}</span>{o.href && <Link href={o.href} className="ml-auto inline-flex items-center gap-1 font-semibold text-primary hover:underline">Explore <ArrowRight className="h-3 w-3" /></Link>}</div>
    </div>
  );
}

export function RecCard({ r }: { r: RecT }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-sm font-bold text-foreground"><ClipboardCheck className="h-4 w-4 text-primary" /> {r.title}</span><span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">P{r.priority}</span></div>
      <p className="mt-1 text-2xs text-muted">{r.reason}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded bg-surface-2/50 px-2 py-1"><span className="text-subtle">Benefit</span><div className="font-semibold text-success">{r.estimatedBenefit}</div></div>
        <div className="rounded bg-surface-2/50 px-2 py-1"><span className="text-subtle">Risk if ignored</span><div className="font-semibold text-foreground">{r.estimatedRisk}</div></div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {r.nextAction && <Link href={r.nextAction.href} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-white hover:opacity-90">{r.nextAction.label} <ArrowRight className="h-3 w-3" /></Link>}
        {r.relatedReports.map((rp) => <Link key={rp.href} href={rp.href} className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted hover:text-primary">{rp.label}</Link>)}
      </div>
    </div>
  );
}

const useApi = <T,>(url: string, key: string) => {
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(() => { setData(null); jget<Record<string, unknown>>(url).then((j) => { if (j.ok) setData(j[key] as T); }); }, [url, key]);
  useEffect(() => { load(); }, [load]);
  return { data, reload: load };
};
export const Empty = ({ msg }: { msg: string }) => <p className="rounded-xl border border-dashed border-border p-6 text-center text-2xs text-muted">{msg}</p>;
const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;

// ------------------------------------------------------------------ Overview
export function OverviewDashboard({ p, onTab }: { p: AreaProps; onTab: (t: string) => void }) {
  const { data } = useApi<OverviewT>(`/api/ai/decision/overview?${q(p)}`, "overview");
  if (!data) return <AppLoader label="Analysing your business…" />;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
        <button onClick={() => onTab("health")} className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition hover:border-primary/40">
          <div className="text-2xs font-semibold text-muted">Business Health</div>
          <div className="mx-auto my-1 w-fit"><Gauge score={data.health.overall} size={96} /></div>
          <div className={cn("text-sm font-bold", BAND_COLOR[data.health.band])}>{data.health.band}</div>
          <div className="text-[10px] text-subtle">AI confidence {data.health.aiConfidence}%</div>
        </button>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.health.domains.map((d) => <div key={d.key} className="rounded-xl border border-border bg-card p-2.5 shadow-sm"><div className="flex items-center justify-between"><span className="text-[10px] text-muted">{d.label}</span><span className="text-2xs font-bold text-foreground">{d.score}</span></div><div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className={cn("h-1.5 rounded-full", d.score >= 70 ? "bg-success" : d.score >= 45 ? "bg-warning" : "bg-danger")} style={{ width: `${d.score}%` }} /></div><div className="mt-0.5 text-[9px] text-subtle">{d.note}</div></div>)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <TileBtn label="Predictions" value={data.predictions.length} tone="text-primary" onClick={() => onTab("finance")} />
        <TileBtn label="Risks" value={data.counts.risks} tone="text-danger" onClick={() => onTab("risk")} />
        <TileBtn label="Opportunities" value={data.counts.opportunities} tone="text-success" onClick={() => onTab("opportunity")} />
        <TileBtn label="Recommendations" value={data.counts.recommendations} tone="text-info" onClick={() => onTab("recommendation")} />
      </div>

      <Section title="Headline Forecasts" icon={Sparkles} more={() => onTab("finance")}>
        <Grid>{data.predictions.slice(0, 6).map((pr) => <PredictionCard key={pr.metric} p={pr} />)}</Grid>
      </Section>
      {data.risks.length > 0 && <Section title="Top Risks" icon={AlertTriangle} more={() => onTab("risk")}><Grid>{data.risks.slice(0, 3).map((r) => <RiskCard key={r.key} r={r} />)}</Grid></Section>}
      {data.recommendations.length > 0 && <Section title="Recommended Actions" icon={ClipboardCheck} more={() => onTab("recommendation")}><Grid>{data.recommendations.slice(0, 3).map((r) => <RecCard key={r.key} r={r} />)}</Grid></Section>}
    </div>
  );
}
const TileBtn = ({ label, value, tone, onClick }: { label: string; value: number; tone: string; onClick: () => void }) => <button onClick={onClick} className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40"><div className={cn("text-2xl font-bold", tone)}>{value}</div><div className="text-2xs text-muted">{label}</div></button>;
const Section = ({ title, icon: Icon, more, children }: { title: string; icon: typeof Sparkles; more?: () => void; children: React.ReactNode }) => <div><div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Icon className="h-4 w-4 text-primary" /> {title}</h3>{more && <button onClick={more} className="text-2xs font-semibold text-primary hover:underline">View all →</button>}</div>{children}</div>;

// ------------------------------------------------------------------ Health
export function HealthCenter({ p }: { p: AreaProps }) {
  const { data } = useApi<HealthT>(`/api/ai/decision/health?${q(p)}`, "health");
  if (!data) return <AppLoader label="Scoring business health…" />;
  const maxTrend = Math.max(...data.trend.map((t) => t.value), 100);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
          <Gauge score={data.overall} size={130} />
          <div className={cn("mt-1 text-lg font-bold", BAND_COLOR[data.band])}>{data.band}</div>
          <div className="text-2xs text-muted">Overall Business Health</div>
          <div className="mt-1 text-[10px] text-subtle">AI Confidence {data.aiConfidence}%</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {data.scores.map((s) => <div key={s.key} className="rounded-xl border border-border bg-card p-3 shadow-sm"><div className="flex items-center justify-between"><span className="text-2xs text-muted">{s.label}</span><span className="text-sm font-bold text-foreground">{s.score}</span></div><div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className={cn("h-1.5 rounded-full", s.score >= 70 ? "bg-success" : s.score >= 45 ? "bg-warning" : "bg-danger")} style={{ width: `${s.score}%` }} /></div><div className="mt-0.5 text-[10px] text-subtle">{s.note}</div></div>)}
        </div>
      </div>
      <Section title="Domain Health" icon={Activity}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{data.domains.map((d) => <div key={d.key} className="rounded-xl border border-border bg-card p-3 shadow-sm"><div className="flex items-center justify-between"><span className="text-2xs font-semibold text-foreground">{d.label}</span><span className={cn("text-sm font-bold", d.score >= 70 ? "text-success" : d.score >= 45 ? "text-warning" : "text-danger")}>{d.score}</span></div><div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className={cn("h-1.5 rounded-full", d.score >= 70 ? "bg-success" : d.score >= 45 ? "bg-warning" : "bg-danger")} style={{ width: `${d.score}%` }} /></div><div className="mt-0.5 text-[10px] text-subtle">{d.note}</div></div>)}</div>
      </Section>
      <Section title="Health Trend" icon={TrendingUp}>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex h-24 items-end gap-1">{data.trend.map((t, i) => <div key={i} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t bg-brand-gradient" style={{ height: `${(t.value / maxTrend) * 100}%` }} /><span className="text-[8px] text-subtle">{t.name}</span></div>)}</div>
          <p className="mt-1 text-center text-[10px] text-subtle">Overall health score over time (updates daily)</p>
        </div>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ Module intelligence (generic)
export function ModuleIntelligence({ module, p }: { module: string; p: AreaProps }) {
  const { data } = useApi<{ predictions: PredictionT[]; risks: RiskT[]; opportunities: OppT[]; recommendations: RecT[] }>(`/api/ai/decision/module/${module}?${q(p)}`, undefined as never);
  const [full, setFull] = useState<{ predictions: PredictionT[]; risks: RiskT[]; opportunities: OppT[]; recommendations: RecT[] } | null>(null);
  useEffect(() => { setFull(null); jget<{ ok: boolean; predictions: PredictionT[]; risks: RiskT[]; opportunities: OppT[]; recommendations: RecT[] }>(`/api/ai/decision/module/${module}?${q(p)}`).then((j) => { if (j.ok) setFull({ predictions: j.predictions, risks: j.risks, opportunities: j.opportunities, recommendations: j.recommendations }); }); }, [module, p]);
  void data;
  if (!full) return <AppLoader label="Forecasting…" />;
  return (
    <div className="space-y-4">
      {full.predictions.length ? <Section title="Forecasts" icon={Sparkles}><Grid>{full.predictions.map((pr) => <PredictionCard key={pr.metric} p={pr} />)}</Grid></Section> : <Empty msg="No forecastable metrics for this module yet." />}
      {full.risks.length > 0 && <Section title="Risks" icon={AlertTriangle}><Grid>{full.risks.map((r) => <RiskCard key={r.key} r={r} />)}</Grid></Section>}
      {full.opportunities.length > 0 && <Section title="Opportunities" icon={Lightbulb}><Grid>{full.opportunities.map((o) => <OppCard key={o.key} o={o} />)}</Grid></Section>}
      {full.recommendations.length > 0 && <Section title="Recommendations" icon={ClipboardCheck}><Grid>{full.recommendations.map((r) => <RecCard key={r.key} r={r} />)}</Grid></Section>}
    </div>
  );
}

// ------------------------------------------------------------------ Risk / Opportunity / Recommendation centers
export function RiskCenter({ p }: { p: AreaProps }) {
  const { data } = useApi<RiskT[]>(`/api/ai/decision/risks?${q(p)}`, "risks");
  if (!data) return <AppLoader label="Detecting risks…" />;
  return data.length ? <Grid>{data.map((r) => <RiskCard key={r.key} r={r} />)}</Grid> : <Empty msg="No material risks detected — cash, budget, inventory, compliance and receivables are within limits." />;
}
export function OpportunityCenter({ p }: { p: AreaProps }) {
  const { data } = useApi<OppT[]>(`/api/ai/decision/opportunities?${q(p)}`, "opportunities");
  if (!data) return <AppLoader label="Finding opportunities…" />;
  return data.length ? <Grid>{data.map((o) => <OppCard key={o.key} o={o} />)}</Grid> : <Empty msg="No standout opportunities right now." />;
}
export function RecommendationCenter({ p }: { p: AreaProps }) {
  const { data } = useApi<RecT[]>(`/api/ai/decision/recommendations?${q(p)}`, "recommendations");
  if (!data) return <AppLoader label="Building recommendations…" />;
  return data.length ? <Grid>{data.map((r) => <RecCard key={r.key} r={r} />)}</Grid> : <Empty msg="No recommendations at the moment." />;
}

// ------------------------------------------------------------------ Prediction Analytics
export function PredictionAnalytics() {
  const { data } = useApi<{ total: number; pending: number; avgAccuracy: number; metrics: { metric: string; label: string; module: string; accuracy: number; n: number }[]; recent: { label: string; forecastValue: number; actualValue: number; accuracyPct: number }[] }>(`/api/ai/decision/analytics`, "analytics");
  if (!data) return <AppLoader label="Loading accuracy…" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Predictions Scored" value={data.total} /><Stat label="Avg Accuracy" value={`${data.avgAccuracy}%`} /><Stat label="Awaiting Actuals" value={data.pending} />
      </div>
      {data.metrics.length ? (
        <Section title="Accuracy by Metric" icon={Target}>
          <div className="space-y-1.5">{data.metrics.map((m) => <div key={m.metric} className="rounded-xl border border-border bg-card p-3 shadow-sm"><div className="flex items-center justify-between text-2xs"><span className="font-semibold text-foreground">{m.label} <span className="text-subtle">· {m.module} · {m.n} scored</span></span><span className="font-bold text-foreground">{m.accuracy}%</span></div><div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className={cn("h-1.5 rounded-full", m.accuracy >= 80 ? "bg-success" : m.accuracy >= 60 ? "bg-warning" : "bg-danger")} style={{ width: `${m.accuracy}%` }} /></div></div>)}</div>
        </Section>
      ) : <Empty msg="No scored predictions yet. As forecasts mature and actuals are recorded, accuracy appears here — this is how the platform learns." />}
    </div>
  );
}
const Stat = ({ label, value }: { label: string; value: number | string }) => <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="text-2xl font-bold text-foreground">{value}</div><div className="text-2xs text-muted">{label}</div></div>;

// ------------------------------------------------------------------ Decision History
export function DecisionHistory() {
  const { data } = useApi<{ id: number; source: string; title: string; module: string | null; decisionTaken: string; takenByName: string | null; actualResult: string | null; accuracy: number | null; createdAt: string }[]>(`/api/ai/decision/history`, "decisions");
  if (!data) return <AppLoader label="Loading decision history…" />;
  if (!data.length) return <Empty msg="No decisions logged yet. Accept or reject a recommendation and it's tracked here with its outcome and accuracy — the platform's learning record." />;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full text-2xs">
        <thead className="border-b border-border bg-surface-2/40 text-left text-[10px] uppercase text-subtle"><tr><th className="px-3 py-2">Decision</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">By</th></tr></thead>
        <tbody className="divide-y divide-border">{data.map((d) => <tr key={d.id}><td className="px-3 py-2 font-medium text-foreground">{d.title}</td><td className="px-3 py-2 capitalize text-muted">{d.source}</td><td className="px-3 py-2"><Badge tone={d.decisionTaken === "Accepted" ? "success" : d.decisionTaken === "Rejected" ? "danger" : "neutral"}>{d.decisionTaken}</Badge></td><td className="px-3 py-2 text-muted">{d.actualResult ?? (d.accuracy != null ? `${d.accuracy}%` : "—")}</td><td className="px-3 py-2 text-muted">{d.takenByName ?? "—"}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
