"use client";

import { useState } from "react";
import { PackageCheck, ClipboardList, History } from "lucide-react";
import { cn } from "@/lib/cn";
import { AllocationListView } from "./AllocationListView";
import { PendingAllocationList } from "./PendingAllocationList";

type TabKey = "allocations" | "pending" | "history";
const TABS: { key: TabKey; label: string; icon: typeof PackageCheck }[] = [
  { key: "allocations", label: "Stock Allocation", icon: PackageCheck },
  { key: "pending", label: "Pending Allocation", icon: ClipboardList },
  { key: "history", label: "Allocation History", icon: History },
];

export function StockAllocationTabs({ initialTab = "allocations" }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Warehouse Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Stock Allocation</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageCheck className="h-5 w-5 text-primary" /> Stock Allocation</h1>
        <p className="mt-0.5 text-sm text-muted">Reserve inventory against approved transfer requests before dispatch. Reservation only — no stock movement, ledger or accounting is posted.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition", active ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "allocations" && <AllocationListView mode="active" embedded onGoPending={() => setTab("pending")} />}
      {tab === "pending" && <PendingAllocationList embedded />}
      {tab === "history" && <AllocationListView mode="history" embedded />}
    </div>
  );
}
