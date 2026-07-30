"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Brain, LayoutDashboard, HeartPulse, LineChart, ShoppingCart, Truck, Boxes, Users, Factory, PiggyBank, Building2, Landmark, AlertTriangle, Lightbulb, FlaskConical, ClipboardCheck, History as HistoryIcon, Target, Cpu, Bell, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { OverviewDashboard, HealthCenter, ModuleIntelligence, RiskCenter, OpportunityCenter, RecommendationCenter, DecisionHistory, PredictionAnalytics, type AreaProps } from "./areas";
import { ScenarioSimulator } from "./ScenarioSimulator";
import { ModelManager, DecisionSettings, NotificationsPanel } from "./admin";
import { jget } from "./api";

type Group = "Overview" | "Forecasts" | "Intelligence" | "Records" | "Admin";
interface Tab { id: string; label: string; icon: LucideIcon; group: Group; module?: string }
const TABS: Tab[] = [
  { id: "dashboard", label: "Decision Dashboard", icon: LayoutDashboard, group: "Overview" },
  { id: "health", label: "Business Health", icon: HeartPulse, group: "Overview" },
  { id: "finance", label: "Financial Forecast", icon: LineChart, group: "Forecasts", module: "finance" },
  { id: "sales", label: "Sales Intelligence", icon: ShoppingCart, group: "Forecasts", module: "sales" },
  { id: "purchase", label: "Purchase Intelligence", icon: Truck, group: "Forecasts", module: "purchase" },
  { id: "inventory", label: "Inventory Intelligence", icon: Boxes, group: "Forecasts", module: "inventory" },
  { id: "customer", label: "Customer Intelligence", icon: Users, group: "Forecasts", module: "customer" },
  { id: "supplier", label: "Supplier Intelligence", icon: Factory, group: "Forecasts", module: "supplier" },
  { id: "budget", label: "Budget Intelligence", icon: PiggyBank, group: "Forecasts", module: "budget" },
  { id: "costcentre", label: "Cost Centre Intelligence", icon: Building2, group: "Forecasts", module: "costcentre" },
  { id: "profitcentre", label: "Profit Centre Intelligence", icon: Landmark, group: "Forecasts", module: "profitcentre" },
  { id: "risk", label: "Risk Intelligence", icon: AlertTriangle, group: "Intelligence" },
  { id: "opportunity", label: "Opportunity Intelligence", icon: Lightbulb, group: "Intelligence" },
  { id: "scenario", label: "Scenario Simulator", icon: FlaskConical, group: "Intelligence" },
  { id: "recommendation", label: "Recommendation Center", icon: ClipboardCheck, group: "Intelligence" },
  { id: "history", label: "Decision History", icon: HistoryIcon, group: "Records" },
  { id: "analytics", label: "Prediction Analytics", icon: Target, group: "Records" },
  { id: "notifications", label: "Notification Center", icon: Bell, group: "Records" },
  { id: "model", label: "AI Model Manager", icon: Cpu, group: "Admin" },
  { id: "settings", label: "AI Settings", icon: SlidersHorizontal, group: "Admin" },
];
const GROUPS: Group[] = ["Overview", "Forecasts", "Intelligence", "Records", "Admin"];
const HORIZONS = [7, 30, 90, 180, 365];

export function DecisionIntelligence() {
  const params = useSearchParams();
  const [tab, setTab] = useState("dashboard");
  const [period, setPeriod] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [horizon, setHorizon] = useState(30);
  const [unread, setUnread] = useState(0);

  useEffect(() => { const t = params.get("tab"); if (t && TABS.some((x) => x.id === t)) setTab(t); }, [params]);
  useEffect(() => { jget<{ ok: boolean; unread: number }>("/api/ai/decision/notifications").then((j) => { if (j.ok) setUnread(j.unread); }); }, [tab]);

  const active = useMemo(() => TABS.find((t) => t.id === tab) ?? TABS[0], [tab]);
  const p: AreaProps = { period, horizon };

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><Brain className="h-5 w-5" /></span> Decision Intelligence</h1>
          <p className="mt-0.5 text-sm text-muted">Predict outcomes, detect risks, spot opportunities, recommend actions and simulate scenarios — across every module.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2 text-2xs outline-none" />
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="h-9 rounded-lg border border-border bg-surface px-2 text-2xs outline-none" title="Forecast horizon">{HORIZONS.map((h) => <option key={h} value={h}>{h} days</option>)}</select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Tab rail */}
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {GROUPS.map((gr) => (
            <div key={gr} className="lg:mb-1">
              <div className="hidden px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-subtle lg:block">{gr}</div>
              <div className="flex gap-1 lg:flex-col">
                {TABS.filter((t) => t.group === gr).map((t) => (
                  <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-2xs font-semibold transition", tab === t.id ? "bg-brand-gradient text-white shadow-sm" : "text-muted hover:bg-surface-2/50 hover:text-foreground")}>
                    <t.icon className="h-3.5 w-3.5 shrink-0" /> <span className="whitespace-nowrap lg:whitespace-normal">{t.label}</span>
                    {t.id === "notifications" && unread > 0 && <span className="ml-auto rounded-full bg-danger px-1.5 text-[9px] font-bold text-white">{unread}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Active area */}
        <div className="min-w-0">
          {tab === "dashboard" && <OverviewDashboard p={p} onTab={setTab} />}
          {tab === "health" && <HealthCenter p={p} />}
          {active.module && <ModuleIntelligence module={active.module} p={p} />}
          {tab === "risk" && <RiskCenter p={p} />}
          {tab === "opportunity" && <OpportunityCenter p={p} />}
          {tab === "scenario" && <ScenarioSimulator />}
          {tab === "recommendation" && <RecommendationCenter p={p} />}
          {tab === "history" && <DecisionHistory />}
          {tab === "analytics" && <PredictionAnalytics />}
          {tab === "notifications" && <NotificationsPanel />}
          {tab === "model" && <ModelManager />}
          {tab === "settings" && <DecisionSettings />}
        </div>
      </div>
    </div>
  );
}
