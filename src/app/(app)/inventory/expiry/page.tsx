"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Settings2, Percent, Undo2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { invNotesFor } from "@/lib/inventory/inventoryData";
import { inv } from "@/lib/inventory/inventoryConfig";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

const PERIODS = ["7 Days", "15 Days", "30 Days", "60 Days", "90 Days"];
const ROWS = [
  { product: "Cough Syrup 100ml", batch: "BATCH-Q7741", exp: "2026-05-20", days: -23, qty: 12, value: 1440, state: "Expired" },
  { product: "Amul Butter 500g", batch: "BATCH-MN1188", exp: "2026-07-05", days: 23, qty: 64, value: 16640, state: "Near Expiry" },
  { product: "Paneer 200g", batch: "BATCH-PN5521", exp: "2026-06-25", days: 13, qty: 38, value: 3040, state: "Near Expiry" },
  { product: "Vitamin C Tablets", batch: "BATCH-VC9012", exp: "2026-07-30", days: 48, qty: 120, value: 9600, state: "Near Expiry" },
];

export default function ExpiryManagementPage() {
  const fmt = useFmt();
  const [period, setPeriod] = useState("30 Days");
  const notes = invNotesFor("expiry");
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/inventory" className="hover:text-foreground">Inventory</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Expiry Management</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><CalendarClock className="h-5 w-5 text-primary" /> Expiry Management</h1>
        <p className="mt-0.5 text-sm text-muted">Near-expiry &amp; expired stock with clearance actions.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Alert period:</span>
        {PERIODS.map((p) => <button key={p} onClick={() => setPeriod(p)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", period === p ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40")}>{p}</button>)}
        <span className="ml-2 text-2xs text-subtle">Default from policy: {inv("nearExpiryDays")} days</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Product / Batch</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3 text-center">Days</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3 text-center">State</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-primary-subtle/30">
                <td className="px-4 py-3"><p className="font-medium text-foreground">{r.product}</p><p className="text-2xs text-subtle">{r.batch}</p></td>
                <td className="px-4 py-3 text-muted">{r.exp}</td>
                <td className={cn("px-4 py-3 text-center font-semibold", r.days < 0 ? "text-danger" : r.days <= 15 ? "text-warning" : "text-muted")}>{r.days < 0 ? `${Math.abs(r.days)}d ago` : `${r.days}d`}</td>
                <td className="px-4 py-3 text-right font-medium text-foreground">{fmt.qty(r.qty)}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt.money(r.value)}</td>
                <td className="px-4 py-3 text-center"><Badge tone={r.state === "Expired" ? "danger" : "warning"}>{r.state}</Badge></td>
                <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
                  {r.state === "Near Expiry" ? <button title="Discount" className="grid h-8 w-8 place-items-center rounded-md border border-success/30 bg-success-subtle text-success hover:bg-success hover:text-white"><Percent className="h-4 w-4" /></button> : null}
                  <button title="Return to Supplier" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted hover:border-primary/40 hover:text-primary"><Undo2 className="h-4 w-4" /></button>
                  <button title="Write Off" className="grid h-8 w-8 place-items-center rounded-md border border-danger/30 bg-danger-subtle text-danger hover:bg-danger hover:text-white"><Trash2 className="h-4 w-4" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="md"><Percent className="h-4 w-4" /> Bulk Discount (near expiry)</Button>
        <Button variant="outline" size="md"><Undo2 className="h-4 w-4" /> Return to Supplier</Button>
        <Button variant="outline" size="md"><Trash2 className="h-4 w-4" /> Write Off Expired</Button>
      </div>
    </div>
  );
}
