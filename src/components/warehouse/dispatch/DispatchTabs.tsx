"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Truck, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { DispatchList } from "./DispatchList";

type TabKey = "dispatches" | "history";
interface Kpis { todayDispatch: number; pendingDispatch: number; inTransitQty: number; dispatchedQty: number; dispatchValue: number }

export function DispatchTabs({ initialTab = "dispatches" }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  useEffect(() => { fetch("/api/warehouse/dispatch/kpis", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setKpis(j); }); }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Warehouse Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Stock Transfer Dispatch</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> Stock Transfer Dispatch</h1>
          <p className="mt-0.5 text-sm text-muted">Physically dispatch inventory between branches. Reduces source stock, creates in-transit stock and posts only internal-movement accounting — no sales, GST or party ledgers.</p>
        </div>
        <Link href="/warehouse/transfer/dispatch/new"><Button size="md"><Plus className="h-4 w-4" /> New Dispatch</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Today's Dispatch" value={kpis?.todayDispatch} tone="primary" />
        <Kpi label="Pending (Draft)" value={kpis?.pendingDispatch} tone="warning" />
        <Kpi label="In-Transit Qty" value={kpis?.inTransitQty} tone="info" />
        <Kpi label="Dispatched Qty" value={kpis?.dispatchedQty} tone="success" />
        <Kpi label="Dispatch Value" value={kpis ? `₹${(kpis.dispatchValue || 0).toLocaleString()}` : undefined} tone="foreground" />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {([["dispatches", "Dispatches", Truck], ["history", "Dispatch History", History]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={cn("flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition", tab === key ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "dispatches" ? <DispatchList mode="active" embedded /> : <DispatchList mode="history" embedded />}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string | undefined; tone: "primary" | "warning" | "info" | "success" | "foreground" }) {
  const tones = { primary: "text-primary", warning: "text-warning", info: "text-info", success: "text-success", foreground: "text-foreground" };
  return <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><p className={cn("text-lg font-bold tabular-nums", tones[tone])}>{value ?? "—"}</p><p className="mt-0.5 text-2xs font-medium text-muted">{label}</p></div>;
}
