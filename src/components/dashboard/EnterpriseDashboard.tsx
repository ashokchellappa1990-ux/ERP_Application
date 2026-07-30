"use client";

/**
 * One ERP — Enterprise Dashboard & Business Intelligence Workspace.
 *
 * The default post-login home. Everything is LIVE, tenant/business/branch scoped
 * and role/permission gated: each section lazy-loads from /api/dashboard/<section>,
 * refreshes independently, and only renders data the user may see. Every metric is
 * clickable — a drill-down drawer explains HOW the value is generated (formula +
 * components + breakdown). The legacy onboarding/setup gate is preserved.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  IndianRupee, ReceiptText, TrendingUp, TrendingDown, Landmark, PiggyBank, Percent, Truck,
  PackageSearch, Boxes, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Wallet, Banknote, Coins,
  Users, Building2, ClipboardCheck, ShoppingCart, PackageCheck, UserPlus, RotateCcw, CreditCard,
  Gift, Sparkles, RefreshCw, Search, SlidersHorizontal, Eye, EyeOff, LayoutDashboard, Bell,
  Activity as ActivityIcon, Zap, HeartPulse, ListTodo, FileBarChart, ArrowRight, ArrowUpRight,
  Clock, X, Rocket, Circle, ChevronRight, CheckCircle2, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { useSession } from "@/components/auth/SessionProvider";
import { useScope } from "@/components/scope/ScopeProvider";
import { BranchSetupModal } from "@/components/dashboard/BranchSetupModal";
import { Bars, LineChart, Donut, DualBars, Gauge, type NameVal } from "@/components/dashboard/charts";

/* ------------------------------------------------------------------ types -- */
type Fmt = "money" | "int" | "pct";
interface Kpi { key: string; label: string; value: number; delta?: number; deltaLabel?: string; tone: "primary" | "success" | "warning" | "secondary" | "accent"; icon: string; href?: string; format: Fmt; group?: string; spotlight?: boolean }
interface QuickAction { label: string; href: string; icon: string }
interface Header { businessName: string; branchLabel: string; userName: string; roleName: string; fyLabel: string; today: string; plan: string; subscriptionStatus: string; subscriptionPlan: string | null; trialDaysLeft: number | null; showTrial: boolean; healthScore: number; healthBand: string; quickActions: QuickAction[]; reports: QuickAction[] }
interface ChartBlock { id: string; title: string; type: "line" | "bar" | "donut" | "dual"; data: NameVal[]; series?: { name: string; a: number; b: number }[]; aLabel?: string; bLabel?: string; format: "money" | "int" }
interface HealthMetric { key: string; label: string; value: number; unit: "pct" | "x" | "money"; tone: "success" | "warning" | "danger" | "primary" }
interface Health { score: number; band: string; metrics: HealthMetric[] }
interface PendingItem { key: string; label: string; count: number; href: string; tone: "primary" | "warning" | "danger" | "secondary" }
interface Notification { key: string; level: "info" | "warning" | "danger"; title: string; detail: string; count: number; href: string }
interface Insight { key: string; tone: "primary" | "success" | "warning" | "danger"; icon: string; title: string; text: string }
interface Activity { id: number; action: string; entity: string; summary: string; user: string; at: string }
interface SearchGroup { group: string; items: { label: string; sub: string; href: string }[] }
interface DetailComponent { label: string; value: number; format: Fmt; tone?: "success" | "danger" | "warning" | "muted" }
interface KpiDetail { key: string; label: string; value: number; format: Fmt; subtitle?: string; formula?: string; components: DetailComponent[]; breakdown?: { title: string; kind: "bar" | "line" | "list"; format: "money" | "int" | "pct"; data: NameVal[] }; links?: { label: string; href: string }[]; note?: string }

/* ------------------------------------------------------------- icon lookup -- */
const ICONS: Record<string, LucideIcon> = {
  IndianRupee, ReceiptText, TrendingUp, TrendingDown, Landmark, PiggyBank, Percent, Truck, PackageSearch,
  Boxes, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Wallet, Banknote, Coins, Users, Building2,
  ClipboardCheck, ShoppingCart, PackageCheck, UserPlus, RotateCcw, CreditCard, IdCard: CreditCard, Gift, Sparkles,
};
const Ic = ({ name, className }: { name: string; className?: string }) => { const C = ICONS[name] ?? Circle; return <C className={className} />; };

const GROUP_ICON: Record<string, LucideIcon> = { Sales: TrendingUp, Purchase: Truck, Inventory: Boxes, Finance: Landmark, Customers: Users, "Action Center": ClipboardCheck, Other: Circle };

/** Per-panel heading colour scheme — literal class strings so Tailwind JIT keeps them. */
type Tone = "primary" | "success" | "warning" | "info" | "accent" | "secondary" | "danger";
const TONES: Record<Tone, { head: string; icon: string; title: string }> = {
  primary: { head: "bg-gradient-to-r from-primary-subtle to-card", icon: "text-primary", title: "text-primary" },
  success: { head: "bg-gradient-to-r from-success-subtle to-card", icon: "text-success", title: "text-success" },
  warning: { head: "bg-gradient-to-r from-warning-subtle to-card", icon: "text-warning", title: "text-warning" },
  info: { head: "bg-gradient-to-r from-info-subtle to-card", icon: "text-info", title: "text-info" },
  accent: { head: "bg-gradient-to-r from-accent/15 to-card", icon: "text-accent-foreground", title: "text-accent-foreground" },
  secondary: { head: "bg-gradient-to-r from-secondary-subtle to-card", icon: "text-secondary", title: "text-secondary" },
  danger: { head: "bg-gradient-to-r from-danger-subtle to-card", icon: "text-danger", title: "text-danger" },
};
const GROUP_TONE: Record<string, Tone> = { Sales: "success", Purchase: "primary", Inventory: "warning", Finance: "info", Customers: "secondary", "Action Center": "danger", Other: "primary" };
const SPOTLIGHT_GRADIENT: Record<string, string> = {
  todaySales: "from-emerald-500 to-teal-600", monthSales: "from-indigo-500 to-violet-600", fyProfit: "from-amber-500 to-orange-600",
};

const WIDGET_LABELS: Record<string, string> = { kpis: "KPI Metrics", charts: "Charts", health: "Business Health", pending: "Pending Activities", notifications: "Notifications", insights: "AI Insights", activity: "Recent Activity", quickActions: "Quick Actions", reports: "Report Shortcuts" };
const ALL_WIDGETS = Object.keys(WIDGET_LABELS);
const LS_HIDDEN = "oneerp.dash.hidden";
const LS_AUTO = "oneerp.dash.autorefresh";

/* --------------------------------------------------------- section hook -- */
function useSection<T>(name: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setError(false);
    try {
      const r = await fetch(`/api/dashboard/${name}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setData(j.data); else setError(true);
    } catch { setError(true); } finally { setLoading(false); }
  }, [name, enabled]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

/* --------------------------------------------------------------- shell -- */
export function EnterpriseDashboard() {
  const { user } = useSession();
  const { lockBranch: isBranchUser } = useScope();
  const fmt = useFmt();
  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [customizing, setCustomizing] = useState(false);
  const [auto, setAuto] = useState(false);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  useEffect(() => {
    try { const h = JSON.parse(localStorage.getItem(LS_HIDDEN) || "[]"); if (Array.isArray(h)) setHidden(new Set(h)); } catch { /* ignore */ }
    setAuto(localStorage.getItem(LS_AUTO) === "1");
  }, []);
  const toggleWidget = (k: string) => setHidden((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); localStorage.setItem(LS_HIDDEN, JSON.stringify([...n])); return n; });
  const show = (k: string) => !hidden.has(k);

  const [setupDone, setSetupDone] = useState<boolean | null>(null);
  const [showBranch, setShowBranch] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try { const res = await fetch("/api/company-setup", { cache: "no-store" }); const j = await res.json().catch(() => ({})); if (active) setSetupDone(!!(res.ok && j.exists && j.status === "completed")); }
      catch { if (active) setSetupDone(false); }
    })();
    return () => { active = false; };
  }, []);

  const header = useSection<Header>("header");
  const kpis = useSection<Kpi[]>("kpis", show("kpis"));
  const charts = useSection<ChartBlock[]>("charts", show("charts"));
  const health = useSection<Health>("health", show("health"));
  const pending = useSection<PendingItem[]>("pending", show("pending"));
  const notifications = useSection<Notification[]>("notifications", show("notifications"));
  const insights = useSection<Insight[]>("insights", show("insights"));
  const activity = useSection<Activity[]>("activity", show("activity"));

  const refreshAll = useCallback(() => { header.reload(); kpis.reload(); charts.reload(); health.reload(); pending.reload(); notifications.reload(); insights.reload(); activity.reload(); }, [header, kpis, charts, health, pending, notifications, insights, activity]);
  const refRefresh = useRef(refreshAll); refRefresh.current = refreshAll;
  useEffect(() => { if (!auto) return; const id = window.setInterval(() => refRefresh.current(), 90_000); return () => window.clearInterval(id); }, [auto]);
  const toggleAuto = () => setAuto((a) => { const n = !a; localStorage.setItem(LS_AUTO, n ? "1" : "0"); return n; });

  const money = (n: number) => fmt.money(n);
  const fmtVal = (v: number, f: Fmt) => f === "money" ? fmt.money(v) : f === "pct" ? `${fmt.num(v, 1)}%` : fmt.num(v, 0);

  const spotlight = useMemo(() => (kpis.data ?? []).filter((k) => k.spotlight), [kpis.data]);
  const grouped = useMemo(() => {
    const rest = (kpis.data ?? []).filter((k) => !k.spotlight);
    const map = new Map<string, Kpi[]>();
    for (const k of rest) { const g = k.group ?? "Other"; if (!map.has(g)) map.set(g, []); map.get(g)!.push(k); }
    return [...map.entries()];
  }, [kpis.data]);

  return (
    <div className="space-y-5">
      <HeaderBand header={header.data} loading={header.loading} firstName={firstName} onHealth={() => setDetailKey("margin")} setupPending={!!user && setupDone === false} isBranchUser={isBranchUser} onViewBranch={() => setShowBranch(true)} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GlobalSearch />
        <div className="flex items-center gap-2">
          <Button variant={auto ? "primary" : "outline"} size="sm" onClick={toggleAuto} title="Auto-refresh every 90s"><Zap className="h-4 w-4" /> Auto</Button>
          <Button variant="outline" size="sm" onClick={refreshAll}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          <Button variant="outline" size="sm" onClick={() => setCustomizing((v) => !v)}><SlidersHorizontal className="h-4 w-4" /> Customize</Button>
        </div>
      </div>

      {customizing && (
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground"><SlidersHorizontal className="h-3.5 w-3.5" /> Show / hide sections</div>
          <div className="flex flex-wrap gap-2">
            {ALL_WIDGETS.map((w) => (
              <button key={w} onClick={() => toggleWidget(w)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition", show(w) ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted")}>
                {show(w) ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {WIDGET_LABELS[w]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- Spotlight hero cards ---- */}
      {show("kpis") && (
        <Section loading={kpis.loading} error={kpis.error} onRetry={kpis.reload} empty={!kpis.data?.length} emptyMsg="No KPIs available for your role yet.">
          {spotlight.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {spotlight.map((k) => <Spotlight key={k.key} k={k} fmtVal={fmtVal} onClick={() => setDetailKey(k.key)} />)}
              {health.data && (
                <button onClick={() => setDetailKey("margin")} className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-indigo-500 to-violet-700 p-5 text-left text-white shadow-md transition hover:shadow-lg">
                  <div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15"><HeartPulse className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-white/50 transition group-hover:text-white" /></div>
                  <div className="mt-3 flex items-center gap-3"><Gauge score={health.data.score} size={56} /><div><p className="text-2xs uppercase tracking-wider text-white/70">Business Health</p><p className="text-lg font-bold">{health.data.band}</p></div></div>
                </button>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ---- Quick actions ---- */}
      {show("quickActions") && header.data && header.data.quickActions.length > 0 && (
        <Panel title="Quick Actions" icon={Zap} tone="accent" onHide={() => toggleWidget("quickActions")}>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {header.data.quickActions.map((a) => (
              <Link key={a.label} href={a.href} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-3 text-center transition hover:-translate-y-0.5 hover:border-primary hover:bg-primary-subtle">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-subtle text-primary"><Ic name={a.icon} className="h-5 w-5" /></span>
                <span className="text-2xs font-medium leading-tight text-foreground">{a.label}</span>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {/* ---- Grouped compact metrics (no more card soup) ---- */}
      {show("kpis") && grouped.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {grouped.map(([group, items]) => { const gt = TONES[GROUP_TONE[group] ?? "primary"]; const G = GROUP_ICON[group] ?? Circle; return (
            <div key={group} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className={cn("flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider", gt.head, gt.title)}>
                <span className={cn("grid h-6 w-6 place-items-center rounded-md bg-card/70 shadow-sm", gt.icon)}><G className="h-3.5 w-3.5" /></span> {group}
              </div>
              <div className="divide-y divide-border/70">
                {items.map((k) => (
                  <button key={k.key} onClick={() => setDetailKey(k.key)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", toneBg(k.tone))}><Ic name={k.icon} className="h-4 w-4" /></span>
                      <span className="truncate text-xs font-medium text-foreground">{k.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-foreground">{fmtVal(k.value, k.format)}</span>
                      {k.delta !== undefined && <DeltaChip delta={k.delta} />}
                      <ChevronRight className="h-3.5 w-3.5 text-subtle" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ); })}
        </div>
      )}

      {/* ---- Charts + Health ---- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {show("charts") && (
          <div className="xl:col-span-2">
            <Panel title="Performance Analytics" icon={TrendingUp} tone="primary" onHide={() => toggleWidget("charts")} onRefresh={charts.reload}>
              {charts.loading && !charts.data ? <AppLoader label="Loading charts" /> : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {charts.data?.map((c) => (
                    <div key={c.id} className="rounded-xl border border-border bg-surface/40 p-3">
                      <div className="mb-2 text-xs font-semibold text-foreground">{c.title}</div>
                      {c.type === "line" && <LineChart items={c.data} fmt={money} />}
                      {c.type === "bar" && <Bars items={c.data} fmt={money} />}
                      {c.type === "donut" && <Donut items={c.data} fmt={money} />}
                      {c.type === "dual" && <DualBars series={c.series ?? []} fmt={money} aLabel={c.aLabel ?? "A"} bLabel={c.bLabel ?? "B"} />}
                    </div>
                  ))}
                  {!charts.data?.length && <div className="py-8 text-center text-sm text-muted md:col-span-2">No chart data available.</div>}
                </div>
              )}
            </Panel>
          </div>
        )}
        {show("health") && (
          <Panel title="Business Health" icon={HeartPulse} tone="success" onHide={() => toggleWidget("health")} onRefresh={health.reload}>
            {health.loading && !health.data ? <AppLoader label="Scoring" /> : health.data ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-xl border border-border bg-surface/40 p-3">
                  <Gauge score={health.data.score} />
                  <div><div className="text-sm font-bold text-foreground">{health.data.band}</div><div className="text-2xs text-muted">Composite of growth, margin &amp; collections</div></div>
                </div>
                <div className="space-y-1">
                  {health.data.metrics.map((m) => (
                    <button key={m.key} onClick={() => setDetailKey(m.key)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-surface-2">
                      <span className="text-muted">{m.label}</span>
                      <span className="flex items-center gap-1.5">
                        <span className={cn("font-semibold tabular-nums", m.tone === "success" ? "text-success" : m.tone === "danger" ? "text-danger" : m.tone === "warning" ? "text-warning" : "text-foreground")}>{m.unit === "money" ? money(m.value) : m.unit === "x" ? `${fmt.num(m.value, 2)}×` : `${fmt.num(m.value, 1)}%`}</span>
                        <ChevronRight className="h-3 w-3 text-subtle" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : <div className="py-6 text-center text-xs text-subtle">Health unavailable.</div>}
          </Panel>
        )}
      </div>

      {/* ---- Pending + Notifications + Insights ---- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {show("pending") && (
          <Panel title="Pending Activities" icon={ListTodo} tone="warning" onHide={() => toggleWidget("pending")} onRefresh={pending.reload}>
            {pending.loading && !pending.data ? <AppLoader label="Loading" /> : pending.data?.length ? (
              <div className="space-y-2">
                {pending.data.map((it) => (
                  <Link key={it.key} href={it.href} className="flex items-center justify-between rounded-lg border border-border bg-surface/50 px-3 py-2 transition hover:border-primary hover:bg-primary-subtle">
                    <span className="text-xs text-foreground">{it.label}</span>
                    <Badge tone={it.tone === "danger" ? "danger" : it.tone === "warning" ? "warning" : it.tone === "secondary" ? "neutral" : "primary"}>{it.count}</Badge>
                  </Link>
                ))}
              </div>
            ) : <AllClear msg="Nothing pending — you're all caught up." />}
          </Panel>
        )}
        {show("notifications") && (
          <Panel title="Notifications" icon={Bell} tone="info" onHide={() => toggleWidget("notifications")} onRefresh={notifications.reload}>
            {notifications.loading && !notifications.data ? <AppLoader label="Loading" /> : notifications.data?.length ? (
              <div className="space-y-2">
                {notifications.data.map((n) => (
                  <Link key={n.key} href={n.href} className="flex items-start gap-2.5 rounded-lg border border-border bg-surface/50 px-3 py-2 transition hover:bg-surface-2">
                    <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", n.level === "danger" ? "bg-danger" : n.level === "warning" ? "bg-warning" : "bg-info")} />
                    <span className="min-w-0"><span className="block text-xs font-semibold text-foreground">{n.title}</span><span className="block text-2xs text-muted">{n.detail}</span></span>
                  </Link>
                ))}
              </div>
            ) : <AllClear msg="No alerts right now." />}
          </Panel>
        )}
        {show("insights") && (
          <Panel title="AI Insights" icon={Sparkles} tone="accent" onHide={() => toggleWidget("insights")} onRefresh={insights.reload}>
            {insights.loading && !insights.data ? <AppLoader label="Analysing" /> : insights.data?.length ? (
              <div className="space-y-2.5">
                {insights.data.map((i) => (
                  <div key={i.key} className={cn("rounded-lg border p-3", i.tone === "danger" ? "border-danger/30 bg-danger-subtle/40" : i.tone === "warning" ? "border-warning/30 bg-warning-subtle/40" : i.tone === "success" ? "border-success/30 bg-success-subtle/40" : "border-primary/25 bg-primary-subtle/40")}>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground"><Ic name={i.icon} className="h-3.5 w-3.5" /> {i.title}</div>
                    <p className="mt-1 text-2xs leading-relaxed text-muted">{i.text}</p>
                  </div>
                ))}
              </div>
            ) : <AllClear msg="No insights yet." />}
          </Panel>
        )}
      </div>

      {/* ---- Recent activity + Report shortcuts ---- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {show("activity") && (
          <div className="lg:col-span-2">
            <Panel title="Recent Activity" icon={ActivityIcon} tone="secondary" onHide={() => toggleWidget("activity")} onRefresh={activity.reload}>
              {activity.loading && !activity.data ? <AppLoader label="Loading" /> : activity.data?.length ? (
                <div className="divide-y divide-border">
                  {activity.data.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0"><div className="truncate text-xs font-medium text-foreground">{a.summary}</div><div className="text-2xs text-subtle">{a.entity} · {a.user}</div></div>
                      <span className="flex shrink-0 items-center gap-1 text-2xs text-subtle"><Clock className="h-3 w-3" /><Ago iso={a.at} /></span>
                    </div>
                  ))}
                </div>
              ) : <AllClear msg="No recent activity." />}
            </Panel>
          </div>
        )}
        {show("reports") && header.data && header.data.reports.length > 0 && (
          <Panel title="Report Shortcuts" icon={FileBarChart} tone="primary" onHide={() => toggleWidget("reports")}>
            <div className="grid grid-cols-1 gap-2">
              {header.data.reports.map((rp) => (
                <Link key={rp.label} href={rp.href} className="flex items-center justify-between rounded-lg border border-border bg-surface/50 px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary hover:bg-primary-subtle">
                  <span className="flex items-center gap-2"><Ic name={rp.icon} className="h-4 w-4 text-primary" /> {rp.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-subtle" />
                </Link>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {showBranch && <BranchSetupModal onClose={() => setShowBranch(false)} />}
      {detailKey && <KpiDetailDrawer metricKey={detailKey} onClose={() => setDetailKey(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------ sub-parts -- */

function toneBg(tone: Kpi["tone"]): string {
  return { primary: "bg-primary-subtle text-primary", success: "bg-success-subtle text-success", warning: "bg-warning-subtle text-warning", secondary: "bg-secondary-subtle text-secondary", accent: "bg-accent/15 text-accent-foreground" }[tone];
}

function DeltaChip({ delta }: { delta: number }) {
  const up = delta >= 0;
  return <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", up ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger")}>{up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(delta)}%</span>;
}

function Spotlight({ k, fmtVal, onClick }: { k: Kpi; fmtVal: (v: number, f: Fmt) => string; onClick: () => void }) {
  const grad = SPOTLIGHT_GRADIENT[k.key] ?? "from-primary to-accent";
  return (
    <button onClick={onClick} className={cn("group relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-left text-white shadow-md transition hover:shadow-lg", grad)}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15"><Ic name={k.icon} className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-white/50 transition group-hover:text-white" /></div>
      <p className="relative mt-3 text-2xs font-medium uppercase tracking-wider text-white/80">{k.label}</p>
      <p className="relative mt-1 text-2xl font-bold tracking-tight">{fmtVal(k.value, k.format)}</p>
      {k.delta !== undefined && <p className="relative mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-2xs font-semibold">{k.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(k.delta)}% <span className="font-normal text-white/70">{k.deltaLabel}</span></p>}
    </button>
  );
}

function HeaderBand({ header, loading, firstName, onHealth, setupPending, isBranchUser, onViewBranch }: { header: Header | null; loading: boolean; firstName: string; onHealth: () => void; setupPending: boolean; isBranchUser: boolean; onViewBranch: () => void }) {
  const time = header?.today ? new Date(header.today + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-brand-gradient p-5 text-white shadow-sm">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-white/80"><LayoutDashboard className="h-3.5 w-3.5" /> {header?.businessName ?? "Loading…"} · {header?.branchLabel ?? ""}</div>
          <h1 className="mt-1.5 text-xl font-bold leading-snug">Welcome back, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-white/85">{header ? `${header.roleName} · ${header.fyLabel}` : ""}{time ? ` · ${time}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {header?.showTrial && header.plan === "trial" && header.trialDaysLeft != null && <Chip><Rocket className="h-3.5 w-3.5" /> Trial · {header.trialDaysLeft}d left</Chip>}
          {/* Hide the plan chip when it would only read "Trial" and the platform has the trial banner off. */}
          {(header?.subscriptionPlan || (header?.subscriptionStatus && header.subscriptionStatus !== "Trial") || header?.showTrial) && <Chip><CreditCard className="h-3.5 w-3.5" /> {header?.subscriptionPlan ?? header?.subscriptionStatus ?? "—"}</Chip>}
          {setupPending && (
            isBranchUser
              ? <Button variant="accent" size="md" className="shrink-0" onClick={onViewBranch}><Building2 className="h-4 w-4" /> View Branch Setup</Button>
              : <Link href="/setup"><Button variant="accent" size="md" className="shrink-0"><Building2 className="h-4 w-4" /> Start Business Setup <ArrowRight className="h-4 w-4" /></Button></Link>
          )}
          {header && (
            <button onClick={onHealth} className="flex items-center gap-2 rounded-xl bg-white/12 px-3 py-2 transition hover:bg-white/20">
              <Gauge score={header.healthScore} size={44} />
              <div className="text-left"><div className="text-2xs uppercase tracking-wider text-white/70">Health</div><div className="text-sm font-bold">{header.healthBand}</div></div>
            </button>
          )}
        </div>
      </div>
      {loading && !header && <div className="relative mt-2 text-2xs text-white/70">Loading live data…</div>}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) { return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-2xs font-semibold">{children}</span>; }

function Panel({ title, icon: Icon, children, onHide, onRefresh, tone = "primary" }: { title: string; icon: LucideIcon; children: React.ReactNode; onHide?: () => void; onRefresh?: () => void; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className={cn("flex items-center justify-between border-b border-border px-4 py-3", t.head)}>
        <h3 className={cn("flex items-center gap-2 text-sm font-bold tracking-tight", t.title)}>
          <span className={cn("grid h-7 w-7 place-items-center rounded-lg bg-card/70 shadow-sm", t.icon)}><Icon className="h-4 w-4" /></span>
          {title}
        </h3>
        <div className="flex items-center gap-1">
          {onRefresh && <button onClick={onRefresh} title="Refresh" className="grid h-6 w-6 place-items-center rounded text-subtle transition hover:bg-card/60 hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>}
          {onHide && <button onClick={onHide} title="Hide" className="grid h-6 w-6 place-items-center rounded text-subtle transition hover:bg-card/60 hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Section({ loading, error, onRetry, empty, emptyMsg, children }: { loading: boolean; error: boolean; onRetry: () => void; empty?: boolean; emptyMsg?: string; children: React.ReactNode }) {
  if (error) return <div className="rounded-xl border border-danger/30 bg-danger-subtle/30 p-6 text-center text-sm"><p className="mb-2 text-danger">Couldn't load this section.</p><Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button></div>;
  if (loading && empty) return <AppLoader label="Loading live data" />;
  if (empty) return <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted">{emptyMsg ?? "No data."}</div>;
  return <>{children}</>;
}

function AllClear({ msg }: { msg: string }) { return <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center text-xs text-subtle"><span className="grid h-8 w-8 place-items-center rounded-full bg-success-subtle text-success"><CheckCircle2 className="h-4 w-4" /></span>{msg}</div>; }

function Ago({ iso }: { iso: string }) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  return <>{m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`}</>;
}

/* --------------------------------------------------------- detail drawer -- */
function KpiDetailDrawer({ metricKey, onClose }: { metricKey: string; onClose: () => void }) {
  const fmt = useFmt();
  const [d, setD] = useState<KpiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    (async () => {
      try { const r = await fetch(`/api/dashboard/detail?key=${encodeURIComponent(metricKey)}`, { cache: "no-store" }); const j = await r.json().catch(() => ({})); if (active) { if (r.ok && j.ok) setD(j.data); else setError(true); } }
      catch { if (active) setError(true); } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [metricKey]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, [onClose]);

  const fmtVal = (v: number, f: Fmt) => f === "money" ? fmt.money(v) : f === "pct" ? `${fmt.num(v, 1)}%` : fmt.num(v, 0);
  const money = (n: number) => fmt.money(n);
  const bd = d?.breakdown;
  const bdFmt = (v: number) => bd?.format === "money" ? fmt.money(v) : bd?.format === "pct" ? `${fmt.num(v, 1)}%` : fmt.num(v, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fade-in_0.15s_ease]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl animate-[slide-in_0.2s_ease]">
        <div className="flex items-center justify-between border-b border-border bg-brand-gradient px-4 py-3 text-white">
          <h3 className="text-sm font-bold">{d?.label ?? "Details"}</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg bg-white/15 transition hover:bg-white/25"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && <AppLoader label="Computing breakdown" />}
          {error && <div className="py-10 text-center text-sm text-danger">Couldn't load this metric's detail.</div>}
          {d && !loading && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface/50 p-4">
                <p className="text-3xl font-bold tracking-tight text-foreground">{fmtVal(d.value, d.format)}</p>
                {d.subtitle && <p className="mt-1 text-xs text-muted">{d.subtitle}</p>}
              </div>

              {d.formula && (
                <div className="rounded-xl border border-primary/25 bg-primary-subtle/40 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-primary"><Percent className="h-3.5 w-3.5" /> How it's calculated</div>
                  <p className="font-mono text-xs text-foreground">{d.formula}</p>
                </div>
              )}

              {d.components.length > 0 && (
                <div>
                  <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-subtle">Components</div>
                  <div className="space-y-1.5">
                    {d.components.map((c, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm">
                        <span className="text-muted">{c.label}</span>
                        <span className={cn("font-semibold tabular-nums", c.tone === "success" ? "text-success" : c.tone === "danger" ? "text-danger" : c.tone === "warning" ? "text-warning" : c.tone === "muted" ? "text-subtle" : "text-foreground")}>{fmtVal(c.value, c.format)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bd && bd.data.length > 0 && (
                <div>
                  <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-subtle">{bd.title}</div>
                  {bd.kind === "line" ? <LineChart items={bd.data} fmt={bd.format === "money" ? money : bdFmt} />
                    : bd.kind === "bar" ? <Bars items={bd.data} fmt={bd.format === "money" ? money : bdFmt} />
                    : (
                      <div className="divide-y divide-border rounded-xl border border-border">
                        {bd.data.map((it, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 text-xs"><span className="truncate pr-2 text-muted">{it.name}</span><span className="shrink-0 font-semibold tabular-nums text-foreground">{bdFmt(it.value)}</span></div>
                        ))}
                      </div>
                    )}
                </div>
              )}

              {d.links && d.links.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {d.links.map((l) => <Link key={l.href} href={l.href} onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary hover:bg-primary-subtle">{l.label} <ArrowRight className="h-3.5 w-3.5" /></Link>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setGroups([]); return; }
    const t = window.setTimeout(async () => {
      setLoading(true);
      try { const r = await fetch(`/api/dashboard/search?q=${encodeURIComponent(q)}`, { cache: "no-store" }); const j = await r.json().catch(() => ({})); setGroups(j.ok ? j.data : []); }
      catch { setGroups([]); } finally { setLoading(false); }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => { const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", onClick); return () => document.removeEventListener("mousedown", onClick); }, []);
  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 shadow-sm focus-within:border-primary">
        <Search className="h-4 w-4 text-subtle" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search products, customers, suppliers, invoices…" className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-subtle" />
        {q && <button onClick={() => { setQ(""); setGroups([]); }} className="text-subtle hover:text-foreground"><X className="h-4 w-4" /></button>}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {loading && <div className="px-3 py-4 text-center text-xs text-subtle">Searching…</div>}
          {!loading && !groups.length && <div className="px-3 py-4 text-center text-xs text-subtle">No matches.</div>}
          {!loading && groups.map((g) => (
            <div key={g.group} className="border-b border-border last:border-0">
              <div className="bg-surface-2 px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-subtle">{g.group}</div>
              {g.items.map((it, i) => (
                <Link key={i} href={it.href} onClick={() => setOpen(false)} className="flex items-center justify-between px-3 py-2 text-xs transition hover:bg-surface-2"><span className="truncate font-medium text-foreground">{it.label}</span><span className="ml-2 shrink-0 text-2xs text-subtle">{it.sub}</span></Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
