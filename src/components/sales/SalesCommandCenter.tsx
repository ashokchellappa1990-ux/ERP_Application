"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutDashboard, TrendingUp, Users, PieChart, RefreshCw, Printer, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { DrillProvider } from "@/components/dashboard/DrillModal";
import { useSection, type FiltersT } from "./command/api";
import { OverviewArea, TrendsArea, CustomerArea, AnalyticsArea } from "./command/areas";

interface Tab { id: string; label: string; icon: LucideIcon; sub: string }
const TABS: Tab[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, sub: "KPIs · scorecard · insights" },
  { id: "trends", label: "Sales & Product Trends", icon: TrendingUp, sub: "Trend · products · returns" },
  { id: "customer", label: "Customer", icon: Users, sub: "Segments & buying behaviour" },
  { id: "analytics", label: "Analytics", icon: PieChart, sub: "Deep analysis · AI intelligence" },
];
const thisMonth = () => new Date().toISOString().slice(0, 7);
const blankF = { channel: "", branch: "", customerCategory: "", customerType: "", category: "", brand: "", executive: "" };

export function SalesCommandCenter() {
  const params = useSearchParams();
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState(thisMonth);
  const [f, setF] = useState({ ...blankF });
  const [refreshKey, setRefreshKey] = useState(0);

  const filters = useSection<FiltersT>("filters", `period=${period}`);
  const allowed = filters.data?.tabs;
  const visibleTabs = useMemo(() => TABS.filter((t) => !allowed || allowed.includes(t.id)), [allowed]);
  useEffect(() => { const t = params.get("tab"); if (t && TABS.some((x) => x.id === t)) setTab(t); }, [params]);
  useEffect(() => { if (visibleTabs.length && !visibleTabs.some((t) => t.id === tab)) setTab(visibleTabs[0].id); }, [visibleTabs, tab]);

  const qs = useMemo(() => { const p = new URLSearchParams({ period }); for (const [k, v] of Object.entries(f)) if (v) p.set(k, v); if (refreshKey) p.set("_r", String(refreshKey)); return p.toString(); }, [period, f, refreshKey]);
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  const opt = filters.data?.options;

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><LayoutDashboard className="h-6 w-6" /></span>
            <div>
              <h1 className="text-lg font-bold text-foreground">Sales Command Center</h1>
              <p className="mt-0.5 text-xs text-muted">360° sales performance — KPIs, product &amp; customer analytics, targets-free performance ranking &amp; AI intelligence.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setRefreshKey((k) => k + 1)}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print</Button>
          </div>
        </div>

        {/* Global filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <label className="flex items-center gap-1.5"><span className="text-2xs font-semibold text-muted">Month</span><input type="month" value={period} onChange={(e) => setPeriod(e.target.value || thisMonth())} className={fInp} /></label>
          <Sel value={f.channel} onChange={(v) => set({ channel: v })} label="All channels">{opt?.channels.map((c) => <option key={c} value={c}>{c}</option>)}</Sel>
          <Sel value={f.branch} onChange={(v) => set({ branch: v })} label="All branches">{opt?.branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}</Sel>
          <Sel value={f.executive} onChange={(v) => set({ executive: v })} label="All executives">{opt?.executives.map((e) => <option key={e.id} value={String(e.id)}>{e.name}</option>)}</Sel>
          <Sel value={f.customerCategory} onChange={(v) => set({ customerCategory: v })} label="Cust. category">{opt?.customerCategories.map((c) => <option key={c} value={c}>{c}</option>)}</Sel>
          <Sel value={f.customerType} onChange={(v) => set({ customerType: v })} label="Cust. type">{opt?.customerTypes.map((c) => <option key={c} value={c}>{c}</option>)}</Sel>
          <Sel value={f.category} onChange={(v) => set({ category: v })} label="Prod. category">{opt?.categories.map((c) => <option key={c} value={c}>{c}</option>)}</Sel>
          <Sel value={f.brand} onChange={(v) => set({ brand: v })} label="All brands">{opt?.brands.map((b) => <option key={b} value={b}>{b}</option>)}</Sel>
          {Object.values(f).some(Boolean) && <button onClick={() => setF({ ...blankF })} className="text-2xs font-semibold text-primary hover:underline">Clear</button>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visibleTabs.map((t) => { const Icon = t.icon; const active = tab === t.id; return (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition", active ? "border-primary bg-primary text-white shadow-md" : "border-border bg-card text-foreground hover:border-primary/40")}>
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", active ? "bg-white/20" : "bg-primary-subtle text-primary")}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0"><div className="text-sm font-bold">{t.label}</div><div className={cn("truncate text-2xs", active ? "text-white/80" : "text-muted")}>{t.sub}</div></div>
          </button>
        ); })}
      </div>

      {/* Active area (lazy) — DrillContext gives every widget's icon a drill-down popup */}
      <DrillProvider base="/api/sales/command/drill" qs={qs}>
        <div className="min-w-0">
          {tab === "overview" && <OverviewArea qs={qs} />}
          {tab === "trends" && <TrendsArea qs={qs} />}
          {tab === "customer" && <CustomerArea qs={qs} />}
          {tab === "analytics" && <AnalyticsArea qs={qs} />}
        </div>
      </DrillProvider>
    </div>
  );
}

function Sel({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className={fInp}><option value="">{label}</option>{children}</select>;
}
const fInp = "h-8 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none";
