"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutDashboard, TrendingUp, HeartPulse, PieChart, RefreshCw, Printer, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { DrillProvider } from "@/components/dashboard/DrillModal";
import { useSection, type FiltersT } from "./command/api";
import { OverviewArea, MovementArea, HealthArea, AnalyticsArea } from "./command/areas";

interface Tab { id: string; label: string; icon: LucideIcon; sub: string }
const TABS: Tab[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, sub: "KPIs · health · insights · pending" },
  { id: "movement", label: "Stock Movement", icon: TrendingUp, sub: "In · out · trend by type" },
  { id: "health", label: "Stock Health", icon: HeartPulse, sub: "Low · out · expiry · damaged" },
  { id: "analytics", label: "Analytics", icon: PieChart, sub: "Category · branch · warehouse" },
];
const thisMonth = () => new Date().toISOString().slice(0, 7);
const fInp = "h-8 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none";

export function InventoryDashboard() {
  const params = useSearchParams();
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState(thisMonth);
  const [f, setF] = useState({ branch: "", warehouse: "", category: "", product: "" });
  const [refreshKey, setRefreshKey] = useState(0);

  const filters = useSection<FiltersT>("filters", `period=${period}`);
  useEffect(() => { const t = params.get("tab"); if (t && TABS.some((x) => x.id === t)) setTab(t); }, [params]);

  const qs = useMemo(() => { const p = new URLSearchParams({ period }); for (const [k, v] of Object.entries(f)) if (v) p.set(k, v); if (refreshKey) p.set("_r", String(refreshKey)); return p.toString(); }, [period, f, refreshKey]);
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  const opt = filters.data?.options;

  return (
    <div className="space-y-4">
      {/* Header + filters (Finance-dashboard style) */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><LayoutDashboard className="h-6 w-6" /></span>
            <div>
              <h1 className="text-lg font-bold text-foreground">Inventory Dashboard</h1>
              <p className="mt-0.5 text-xs text-muted">Inventory Control Center — real-time stock value, movement, health &amp; warehouse analytics across all branches.</p>
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
          <label className="flex items-center gap-1.5"><span className="text-2xs font-semibold text-muted">Branch</span>
            <select value={f.branch} onChange={(e) => set({ branch: e.target.value })} className={fInp}><option value="">All branches</option>{(opt?.branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </label>
          <label className="flex items-center gap-1.5"><span className="text-2xs font-semibold text-muted">Warehouse</span>
            <select value={f.warehouse} onChange={(e) => set({ warehouse: e.target.value })} className={fInp}><option value="">All warehouses</option>{(opt?.warehouses ?? []).map((w) => <option key={w} value={w}>{w}</option>)}</select>
          </label>
          <label className="flex items-center gap-1.5"><span className="text-2xs font-semibold text-muted">Category</span>
            <select value={f.category} onChange={(e) => set({ category: e.target.value })} className={fInp}><option value="">All categories</option>{(opt?.categories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </label>
          {Object.values(f).some(Boolean) && <button onClick={() => setF({ branch: "", warehouse: "", category: "", product: "" })} className="text-2xs font-semibold text-primary hover:underline">Clear</button>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {TABS.map((t) => { const Icon = t.icon; const active = tab === t.id; return (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition", active ? "border-primary bg-primary text-white shadow-md" : "border-border bg-card text-foreground hover:border-primary/40")}>
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", active ? "bg-white/20" : "bg-primary-subtle text-primary")}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0"><div className="text-sm font-bold">{t.label}</div><div className={cn("truncate text-2xs", active ? "text-white/80" : "text-muted")}>{t.sub}</div></div>
          </button>
        ); })}
      </div>

      {/* Active area (lazy) — DrillContext gives every widget a drill-down popup */}
      <DrillProvider base="/api/inventory/dashboard/drill" qs={qs}>
        <div className="min-w-0">
          {tab === "overview" && <OverviewArea qs={qs} />}
          {tab === "movement" && <MovementArea qs={qs} />}
          {tab === "health" && <HealthArea qs={qs} />}
          {tab === "analytics" && <AnalyticsArea qs={qs} />}
        </div>
      </DrillProvider>
    </div>
  );
}
