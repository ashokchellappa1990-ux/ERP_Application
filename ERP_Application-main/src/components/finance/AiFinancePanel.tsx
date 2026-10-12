"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Brain, X, RefreshCw, Maximize2, Minimize2, Search, Star, ChevronDown, Download, ExternalLink, Check, EyeOff, CircleCheck, UserPlus, Info, AlertTriangle, ShieldAlert, Activity, Landmark, CalendarClock, Sparkles, HeartPulse, ListChecks, TrendingUp, Lightbulb, ScrollText, ServerCog, Gauge as GaugeIcon } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";
import { Gauge } from "@/components/dashboard/charts";
import type { AiHealth, AiInsight, AiAlert, AiAction, AiForecast, AiRecommendation, AiActivity, AiUpcoming, AiSystem } from "@/lib/finance/ai/engine";

const inr = (x: number) => formatMoney(x || 0);
const API = "/api/finance/ai";

interface PanelData {
  period: string; generatedAt: string; priorityScore: number;
  health: AiHealth; insights: AiInsight[]; alerts: AiAlert[]; actions: AiAction[]; forecast: AiForecast[];
  recommendations: AiRecommendation[];
  compliance: { gst: Record<string, number | string>; tds: Record<string, number | string>; tcs: Record<string, number | string>; future: { name: string; status: string }[] };
  recent: AiActivity[]; upcoming: AiUpcoming[]; system: AiSystem[];
  summary: { cash: number; receivable: number; payable: number; netProfit: number; budgetUtil: number };
}

const FAV_KEY = "oneerp.ai.fav";

export function AiFinancePanel({ open, onClose, period, costCenterId, profitCenterId }: { open: boolean; onClose: () => void; period: string; costCenterId?: string; profitCenterId?: string }) {
  const toast = useToast();
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [full, setFull] = useState(false);
  const [live, setLive] = useState(true);
  const [flash, setFlash] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [favs, setFavs] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ type: string; label: string; sub: string; href: string }[]>([]);
  const pulseRef = useRef<string>("");

  const qs = `period=${period}${costCenterId ? `&costCenterId=${costCenterId}` : ""}${profitCenterId ? `&profitCenterId=${profitCenterId}` : ""}`;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const j = await fetch(`${API}/panel?${qs}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) setData(j.data);
    setLoading(false);
  }, [qs]);

  useEffect(() => { try { setFavs(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch { /* */ } }, []);
  useEffect(() => { if (open) load(); }, [open, qs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: poll the cheap pulse signature; when a new financial event posts, refresh.
  useEffect(() => {
    if (!open || !live) return;
    let active = true;
    const tick = async () => {
      const j = await fetch(`${API}/pulse?${qs}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (!active || !j?.ok) return;
      if (pulseRef.current && j.pulse !== pulseRef.current) { setFlash(true); setTimeout(() => setFlash(false), 1200); load(true); }
      pulseRef.current = j.pulse;
    };
    const id = setInterval(tick, 15000); tick();
    return () => { active = false; clearInterval(id); };
  }, [open, live, qs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quick finance search (debounced).
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => { const j = await fetch(`${API}/search?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null); if (j?.ok) setResults(j.results); }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const toggleCollapse = (k: string) => setCollapsed((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleFav = (k: string) => setFavs((f) => { const n = f.includes(k) ? f.filter((x) => x !== k) : [...f, k]; localStorage.setItem(FAV_KEY, JSON.stringify(n)); return n; });

  async function act(itemType: "insight" | "alert", itemKey: string, status: string, assignedTo?: string) {
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemType, itemKey, status, assignedTo }) }).then((r) => r.json()).catch(() => null);
    if (j?.ok) { toast.show(j.message || "Done.", { type: "success" }); load(true); } else toast.show(j?.message || "Failed.", { type: "error" });
  }

  function exportCard(key: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `ai-finance-${key}.json`; a.click();
  }

  if (!open) return null;

  const prio = data?.priorityScore ?? 0;
  const prioTone = prio >= 60 ? "danger" : prio >= 30 ? "warning" : "success";

  // Card wrapper factory
  const Card = ({ ck, title, icon: Icon, count, payload, children, accent }: { ck: string; title: string; icon: typeof Brain; count?: number; payload?: unknown; children: React.ReactNode; accent?: string }) => {
    const isCollapsed = collapsed.has(ck); const faved = favs.includes(ck);
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className={cn("flex items-center justify-between border-b border-border px-3 py-2", accent ?? "bg-primary-subtle/40")}>
          <button onClick={() => toggleCollapse(ck)} className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-primary">
            <Icon className="h-4 w-4 shrink-0" /> <span className="truncate">{title}</span>{count != null && count > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-2xs">{count}</span>}
          </button>
          <div className="flex shrink-0 items-center gap-0.5">
            <button onClick={() => toggleFav(ck)} title="Favourite" className={cn("grid h-6 w-6 place-items-center rounded hover:bg-primary/10", faved ? "text-warning" : "text-subtle")}><Star className={cn("h-3.5 w-3.5", faved && "fill-current")} /></button>
            {payload != null && <button onClick={() => exportCard(ck, payload)} title="Export JSON" className="grid h-6 w-6 place-items-center rounded text-subtle hover:bg-primary/10 hover:text-primary"><Download className="h-3.5 w-3.5" /></button>}
            <button onClick={() => load()} title="Refresh" className="grid h-6 w-6 place-items-center rounded text-subtle hover:bg-primary/10 hover:text-primary"><RefreshCw className="h-3.5 w-3.5" /></button>
            <button onClick={() => toggleCollapse(ck)} title={isCollapsed ? "Expand" : "Collapse"} className="grid h-6 w-6 place-items-center rounded text-subtle hover:bg-primary/10 hover:text-primary"><ChevronDown className={cn("h-4 w-4 transition", !isCollapsed && "rotate-180")} /></button>
          </div>
        </div>
        {!isCollapsed && <div className="p-3">{children}</div>}
      </div>
    );
  };

  const ordered = <T,>(entries: [string, () => React.ReactNode][]) => entries.sort((a, b) => (favs.includes(b[0]) ? 1 : 0) - (favs.includes(a[0]) ? 1 : 0)).map(([, render]) => render());

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside className={cn("fixed right-0 top-0 z-50 flex h-full flex-col border-l border-border bg-surface shadow-2xl transition-all", full ? "w-full" : "w-full sm:w-[440px]")}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border bg-brand-gradient px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/20"><Brain className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold">AI Finance Intelligence</h2>
              <p className="truncate text-2xs text-white/80">{data ? `Period ${data.period} · updated ${new Date(data.generatedAt).toLocaleTimeString()}` : "Analysing…"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {flash && <span className="rounded bg-white/25 px-1.5 py-0.5 text-2xs font-semibold">Updated</span>}
            <button onClick={() => setLive((v) => !v)} title="Live updates" className={cn("grid h-8 w-8 place-items-center rounded-md hover:bg-white/15", live ? "text-white" : "text-white/50")}><Activity className={cn("h-4 w-4", live && "animate-pulse")} /></button>
            <button onClick={() => load()} title="Refresh" className="grid h-8 w-8 place-items-center rounded-md text-white/90 hover:bg-white/15"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
            <button onClick={() => setFull((v) => !v)} title="Full screen" className="grid h-8 w-8 place-items-center rounded-md text-white/90 hover:bg-white/15">{full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            <button onClick={onClose} title="Close" className="grid h-8 w-8 place-items-center rounded-md text-white/90 hover:bg-white/15"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Priority + search */}
        <div className="space-y-2 border-b border-border bg-card px-4 py-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted"><GaugeIcon className="h-3.5 w-3.5" /> Priority</span>
            <div className="flex items-center gap-2"><div className="h-2 w-28 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", prio >= 60 ? "bg-danger" : prio >= 30 ? "bg-warning" : "bg-success")} style={{ width: `${prio}%` }} /></div><Badge tone={prioTone}>{prio}</Badge></div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search voucher / customer / supplier / expense…" className="h-8 w-full rounded-md border border-border-strong bg-surface pl-8 pr-3 text-sm focus:border-primary focus:outline-none" />
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
                {results.map((r, i) => <Link key={i} href={r.href} onClick={() => { setQ(""); setResults([]); onClose(); }} className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5 text-sm last:border-0 hover:bg-primary-subtle/40"><span className="min-w-0"><span className="font-medium text-foreground">{r.label}</span><span className="ml-1 text-2xs text-muted">{r.sub}</span></span><Badge tone="neutral">{r.type}</Badge></Link>)}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className={cn("flex-1 space-y-3 overflow-y-auto p-3 transition", flash && "ring-2 ring-inset ring-success/40")}>
          {loading && !data ? <AppLoader label="Running AI analysis…" /> : !data ? <p className="py-10 text-center text-sm text-muted">No analysis available.</p> : (
            <div className={cn(full && "mx-auto grid max-w-6xl gap-3 lg:grid-cols-2", !full && "space-y-3")}>
              {ordered([
                ["health", () => (
                  <Card key="health" ck="health" title="Financial Health Score" icon={HeartPulse} payload={data.health}>
                    <div className="flex items-center gap-4">
                      <div className={cn(data.health.color === "green" ? "text-success" : data.health.color === "orange" ? "text-warning" : "text-danger")}><Gauge score={data.health.score} size={92} /></div>
                      <div className="min-w-0 flex-1">
                        <Badge tone={data.health.color === "green" ? "success" : data.health.color === "orange" ? "warning" : "danger"}>{data.health.status}</Badge>
                        <div className="mt-2 space-y-1">{data.health.factors.slice(0, 5).map((f) => <div key={f.name}><div className="flex justify-between text-2xs"><span className="truncate text-muted">{f.name}</span><span className="font-semibold text-foreground">{f.score}</span></div><div className="h-1 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", f.score >= 60 ? "bg-success" : f.score >= 40 ? "bg-warning" : "bg-danger")} style={{ width: `${f.score}%` }} /></div></div>)}</div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-border pt-2 text-center">{data.health.factors.slice(5).map((f) => <div key={f.name} className="rounded bg-surface-2/40 px-1 py-1"><div className={cn("text-sm font-bold", f.score >= 60 ? "text-success" : f.score >= 40 ? "text-warning" : "text-danger")}>{f.score}</div><div className="truncate text-[9px] text-muted">{f.name}</div></div>)}</div>
                  </Card>
                )],
                ["alerts", () => (
                  <Card key="alerts" ck="alerts" title="Financial Alerts" icon={ShieldAlert} count={data.alerts.filter((a) => a.type !== "clear").length} payload={data.alerts} accent="bg-danger-subtle/40">
                    <div className="space-y-1.5">{data.alerts.map((a) => <AlertRow key={a.key} a={a} onAct={act} />)}</div>
                  </Card>
                )],
                ["actions", () => (
                  <Card key="actions" ck="actions" title="Action Centre" icon={ListChecks} count={data.actions.reduce((s, a) => s + a.count, 0)} payload={data.actions}>
                    {data.actions.length === 0 ? <p className="py-2 text-center text-2xs text-muted">Nothing pending. 🎉</p> : <div className="space-y-1.5">{data.actions.map((a) => <div key={a.key} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/30 px-2.5 py-1.5"><span className="min-w-0"><span className="text-sm font-medium text-foreground">{a.label}</span><span className="ml-1 text-2xs text-subtle">· {a.group}</span></span><span className="flex shrink-0 items-center gap-1.5"><Badge tone="warning">{a.count}</Badge><Link href={a.href} onClick={onClose} className="rounded-md bg-primary px-2 py-0.5 text-2xs font-semibold text-white hover:opacity-90">Open</Link></span></div>)}</div>}
                  </Card>
                )],
                ["insights", () => (
                  <Card key="insights" ck="insights" title="AI Insights" icon={Sparkles} count={data.insights.filter((i) => i.category !== "all-good").length} payload={data.insights}>
                    <div className="space-y-1.5">{data.insights.map((i) => <InsightRow key={i.key} i={i} onAct={act} onClose={onClose} />)}</div>
                  </Card>
                )],
                ["forecast", () => (
                  <Card key="forecast" ck="forecast" title="Forecast" icon={TrendingUp} payload={data.forecast}>
                    <div className="overflow-x-auto"><table className="w-full text-2xs"><thead><tr className="border-b border-border text-muted"><th className="py-1 text-left">Metric</th>{data.forecast.map((f) => <th key={f.days} className="py-1 text-right">{f.days}d</th>)}</tr></thead><tbody>
                      {([["Cash Balance", "cashBalance"], ["Collections", "collections"], ["Payments", "payments"], ["Recur. Expense", "recurringExpense"], ["Recur. Income", "recurringIncome"], ["Working Capital", "workingCapital"], ["Profit", "profit"]] as [string, keyof AiForecast][]).map(([label, k]) => <tr key={label} className="border-b border-border/50 last:border-0"><td className="py-1 text-muted">{label}</td>{data.forecast.map((f) => <td key={f.days} className="py-1 text-right tabular-nums text-foreground">{inr(Number(f[k]))}</td>)}</tr>)}
                      <tr><td className="py-1 text-muted">Budget Util.</td>{data.forecast.map((f) => <td key={f.days} className="py-1 text-right tabular-nums text-foreground">{f.budgetUtilization}%</td>)}</tr>
                    </tbody></table></div>
                  </Card>
                )],
                ["recommendations", () => (
                  <Card key="recommendations" ck="recommendations" title="Recommendations" icon={Lightbulb} count={data.recommendations.length} payload={data.recommendations}>
                    <div className="space-y-2">{data.recommendations.map((r) => (
                      <div key={r.key} className="rounded-lg border border-border bg-surface-2/30 p-2.5">
                        <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-foreground">{r.title}</span><Badge tone={r.priority >= 80 ? "danger" : r.priority >= 60 ? "warning" : "neutral"}>P{r.priority}</Badge></div>
                        <div className="mt-1 space-y-0.5 text-2xs"><p><span className="font-semibold text-muted">Reason:</span> <span className="text-foreground">{r.reason}</span></p><p><span className="font-semibold text-muted">Impact:</span> <span className="text-foreground">{r.impact}</span></p><p><span className="font-semibold text-muted">Action:</span> <span className="text-foreground">{r.action}</span></p></div>
                        {r.href && <Link href={r.href} onClick={onClose} className="mt-1.5 inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline">Take action <ExternalLink className="h-3 w-3" /></Link>}
                      </div>
                    ))}</div>
                  </Card>
                )],
                ["compliance", () => (
                  <Card key="compliance" ck="compliance" title="Compliance" icon={Landmark} payload={data.compliance}>
                    <div className="space-y-2">
                      <CompBox title="GST" tone="text-primary" rows={[["Input", inr(Number(data.compliance.gst.input))], ["Output", inr(Number(data.compliance.gst.output))], ["Net", inr(Number(data.compliance.gst.net))], ["Payment Due", inr(Number(data.compliance.gst.paymentDue))], ["Return Due", String(data.compliance.gst.returnDue)]]} />
                      <CompBox title="TDS" tone="text-info" rows={[["Deducted", inr(Number(data.compliance.tds.deducted))], ["Paid", inr(Number(data.compliance.tds.paid))], ["Pending", inr(Number(data.compliance.tds.pending))], ["Return Due", String(data.compliance.tds.returnDue)]]} />
                      <CompBox title="TCS" tone="text-success" rows={[["Collected", inr(Number(data.compliance.tcs.collected))], ["Paid", inr(Number(data.compliance.tcs.paid))], ["Pending", inr(Number(data.compliance.tcs.pending))], ["Return Due", String(data.compliance.tcs.returnDue)]]} />
                      <div className="flex flex-wrap gap-1.5">{data.compliance.future.map((f) => <span key={f.name} className="rounded-full border border-border bg-surface-2/40 px-2 py-0.5 text-2xs text-muted">{f.name} · {f.status}</span>)}</div>
                    </div>
                  </Card>
                )],
                ["upcoming", () => (
                  <Card key="upcoming" ck="upcoming" title="Upcoming Activities" icon={CalendarClock} count={data.upcoming.length} payload={data.upcoming}>
                    {data.upcoming.length === 0 ? <p className="py-2 text-center text-2xs text-muted">Nothing scheduled.</p> : <div className="space-y-1">{data.upcoming.map((u) => <Link key={u.key} href={u.href ?? "#"} onClick={onClose} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/30 px-2.5 py-1.5 text-2xs hover:border-primary/40"><span className="flex min-w-0 items-center gap-1.5"><CalendarClock className={cn("h-3.5 w-3.5 shrink-0", u.overdue ? "text-danger" : "text-warning")} /><span className="truncate text-foreground">{u.label}</span></span><span className="shrink-0 text-right"><span className={cn("font-semibold", u.overdue ? "text-danger" : "text-muted")}>{u.due.slice(5)}</span>{u.amount != null && <span className="ml-1 font-semibold text-foreground">{inr(u.amount)}</span>}</span></Link>)}</div>}
                  </Card>
                )],
                ["recent", () => (
                  <Card key="recent" ck="recent" title="Recent Activities" icon={ScrollText} payload={data.recent}>
                    {data.recent.length === 0 ? <p className="py-2 text-center text-2xs text-muted">No recent activity.</p> : <div className="space-y-1">{data.recent.map((a, i) => <div key={i} className="flex items-center justify-between gap-2 border-b border-border/40 py-1 text-2xs last:border-0"><span className="min-w-0 truncate text-foreground">{a.summary}</span><span className="shrink-0 text-subtle">{a.user} · {new Date(a.at).toLocaleDateString()}</span></div>)}</div>}
                  </Card>
                )],
                ["system", () => (
                  <Card key="system" ck="system" title="System Status" icon={ServerCog} payload={data.system}>
                    <div className="grid grid-cols-2 gap-1.5">{data.system.map((s) => <div key={s.name} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/30 px-2 py-1.5"><span className={cn("h-2 w-2 shrink-0 rounded-full", s.ok ? "bg-success" : "bg-subtle")} /><span className="min-w-0"><span className="block truncate text-2xs font-semibold text-foreground">{s.name}</span><span className="block truncate text-[9px] text-muted">{s.detail}</span></span></div>)}</div>
                  </Card>
                )],
              ] as [string, () => React.ReactNode][])}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/* --------------------------------------------------------------- sub-rows */
const SEV_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = { critical: "danger", high: "warning", medium: "info", info: "neutral" };
function InsightRow({ i, onAct, onClose }: { i: AiInsight; onAct: (t: "insight", k: string, s: string) => void; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={cn("rounded-lg border border-border bg-surface-2/30 p-2", i.status === "reviewed" && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5"><Badge tone={SEV_TONE[i.severity]}>{i.severity}</Badge><span className="text-sm font-semibold text-foreground">{i.title}</span>{i.status === "reviewed" && <Check className="h-3.5 w-3.5 text-success" />}</div>
          {expanded && <p className="mt-1 text-2xs text-muted">{i.detail}</p>}
        </div>
        {i.metric && <span className="shrink-0 text-2xs font-bold text-primary">{i.metric}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-2xs">
        <button onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-0.5 rounded bg-surface px-1.5 py-0.5 font-semibold text-muted hover:text-primary"><Info className="h-3 w-3" /> {expanded ? "Hide" : "Details"}</button>
        {i.href && <Link href={i.href} onClick={onClose} className="inline-flex items-center gap-0.5 rounded bg-surface px-1.5 py-0.5 font-semibold text-primary hover:underline"><ExternalLink className="h-3 w-3" /> Open</Link>}
        <button onClick={() => onAct("insight", i.key, "reviewed")} className="inline-flex items-center gap-0.5 rounded bg-surface px-1.5 py-0.5 font-semibold text-success hover:underline"><CircleCheck className="h-3 w-3" /> Reviewed</button>
        <button onClick={() => onAct("insight", i.key, "dismissed")} className="inline-flex items-center gap-0.5 rounded bg-surface px-1.5 py-0.5 font-semibold text-muted hover:text-danger"><EyeOff className="h-3 w-3" /> Dismiss</button>
      </div>
    </div>
  );
}
function AlertRow({ a, onAct }: { a: AiAlert; onAct: (t: "alert", k: string, s: string, assignedTo?: string) => void }) {
  if (a.type === "clear") return <p className="py-2 text-center text-2xs text-muted">No active alerts. ✓</p>;
  const tone = a.level === "Critical" ? "danger" : a.level === "High" ? "warning" : a.level === "Medium" ? "info" : "neutral";
  const Icon = a.level === "Critical" ? ShieldAlert : a.level === "High" ? AlertTriangle : Info;
  return (
    <div className={cn("rounded-lg border p-2", a.level === "Critical" ? "border-danger/40 bg-danger-subtle/30" : "border-border bg-surface-2/30", a.status === "resolved" && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-1.5"><Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-muted")} /><span className="text-2xs text-foreground">{a.message}</span></span>
        <Badge tone={tone}>{a.level}</Badge>
      </div>
      {a.assignedTo && <p className="mt-1 text-[10px] text-info">Assigned to {a.assignedTo}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-2xs">
        {a.href && <Link href={a.href} className="inline-flex items-center gap-0.5 rounded bg-surface px-1.5 py-0.5 font-semibold text-primary hover:underline"><ExternalLink className="h-3 w-3" /> View</Link>}
        <button onClick={() => onAct("alert", a.key, "resolved")} className="inline-flex items-center gap-0.5 rounded bg-surface px-1.5 py-0.5 font-semibold text-success hover:underline"><CircleCheck className="h-3 w-3" /> Resolve</button>
        <button onClick={() => { const who = window.prompt("Assign to:") ?? ""; if (who.trim()) onAct("alert", a.key, "reviewed", who.trim()); }} className="inline-flex items-center gap-0.5 rounded bg-surface px-1.5 py-0.5 font-semibold text-info hover:underline"><UserPlus className="h-3 w-3" /> Assign</button>
        <button onClick={() => onAct("alert", a.key, "ignored")} className="inline-flex items-center gap-0.5 rounded bg-surface px-1.5 py-0.5 font-semibold text-muted hover:text-danger"><EyeOff className="h-3 w-3" /> Ignore</button>
      </div>
    </div>
  );
}
function CompBox({ title, tone, rows }: { title: string; tone: string; rows: [string, string][] }) {
  return <div className="rounded-lg border border-border bg-surface-2/30 p-2"><div className={cn("mb-1 text-2xs font-bold", tone)}>{title}</div><div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-2xs">{rows.map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-muted">{k}</span><span className="font-semibold tabular-nums text-foreground">{v}</span></div>)}</div></div>;
}
