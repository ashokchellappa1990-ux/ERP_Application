"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageOpen, ClipboardCheck, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { ReceiptList } from "./ReceiptList";
import { PendingReceiptsList } from "./PendingReceiptsList";

type TabKey = "receipts" | "pending" | "history";
interface Kpis { pendingReceipts: number; receivedToday: number; damagedStock: number; missingStock: number; avgReceiptDays: number }

export function ReceiptTabs({ initialTab = "pending" }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  useEffect(() => { fetch("/api/warehouse/receipt/kpis", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setKpis(j); }); }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Warehouse Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Stock Transfer Receipt</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageOpen className="h-5 w-5 text-primary" /> Stock Transfer Receipt</h1>
          <p className="mt-0.5 text-sm text-muted">Acknowledge stock dispatched to your branch. Moves in-transit into real stock, records damage/shortage and posts only internal accounting (Inventory Dr / In-Transit Cr).</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Pending Receipts" value={kpis?.pendingReceipts} tone="warning" />
        <Kpi label="Received Today" value={kpis?.receivedToday} tone="success" />
        <Kpi label="Damaged Stock" value={kpis?.damagedStock} tone="danger" />
        <Kpi label="Missing Stock" value={kpis?.missingStock} tone="danger" />
        <Kpi label="Avg Receipt (days)" value={kpis?.avgReceiptDays} tone="foreground" />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {([["pending", "Pending Receipts", ClipboardCheck], ["receipts", "Receipts", PackageOpen], ["history", "Receipt History", History]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={cn("flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition", tab === key ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "pending" && <PendingReceiptsList embedded />}
      {tab === "receipts" && <ReceiptList mode="active" embedded />}
      {tab === "history" && <ReceiptList mode="history" embedded />}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | undefined; tone: "warning" | "success" | "danger" | "foreground" }) {
  const tones = { warning: "text-warning", success: "text-success", danger: "text-danger", foreground: "text-foreground" };
  return <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><p className={cn("text-lg font-bold tabular-nums", tones[tone])}>{value ?? "—"}</p><p className="mt-0.5 text-2xs font-medium text-muted">{label}</p></div>;
}
