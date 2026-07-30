"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Warehouse, Settings2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";

interface Row { branchId: number; name: string; code: string; entityType: string; business: string; category: string; status: string; progress: number; configured: boolean }
const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "info"> = { Pending: "warning", Configured: "info", Active: "success", Inactive: "neutral" };

export function WarehouseConfigList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { fetch("/api/warehouse/config", { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : [])); }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white"><Warehouse className="h-6 w-6" /></span><div><h1 className="text-lg font-bold text-foreground">Warehouse Configuration</h1><p className="text-xs text-muted">Configure warehouse branches (entity type Warehouse / Distribution / Dark Store). The Branch is the master.</p></div></div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {!rows ? <div className="p-10"><AppLoader label="Loading warehouses…" /></div> : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">No warehouse branches yet. Create a Branch with Entity Type = <span className="font-semibold text-foreground">Warehouse</span> (System › Organization) — it will appear here with status <span className="font-semibold text-warning">Pending</span>.</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2/50 text-left text-2xs font-semibold uppercase tracking-wide text-muted"><th className="px-3 py-2">Warehouse</th><th className="px-3 py-2">Branch Code</th><th className="px-3 py-2">Business</th><th className="px-3 py-2">Entity Type</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Config Status</th><th className="px-3 py-2 w-40">Progress</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.branchId} className="border-b border-border/50 last:border-0 hover:bg-surface-2/30">
                <td className="px-3 py-2 font-semibold text-foreground">{r.name}</td>
                <td className="px-3 py-2 tabular-nums text-muted">{r.code}</td>
                <td className="px-3 py-2 text-muted">{r.business || "—"}</td>
                <td className="px-3 py-2 text-muted">{r.entityType || "—"}</td>
                <td className="px-3 py-2">{r.category || <span className="text-2xs text-warning">Not set</span>}</td>
                <td className="px-3 py-2"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                <td className="px-3 py-2"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", r.progress >= 100 ? "bg-success" : "bg-primary")} style={{ width: `${r.progress}%` }} /></div><span className="w-9 text-right text-2xs tabular-nums text-muted">{r.progress}%</span></div></td>
                <td className="px-3 py-2 text-right"><Link href={`/warehouse/settings/configuration/${r.branchId}`} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-2xs font-semibold text-white hover:opacity-90"><Settings2 className="h-3.5 w-3.5" /> Configure <ArrowRight className="h-3 w-3" /></Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
