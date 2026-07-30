"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Settings2, PackagePlus, TrendingDown, Trash2, CalendarClock, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { invNotesFor } from "@/lib/inventory/inventoryData";
import { cn } from "@/lib/cn";

const RECOMMENDATIONS = [
  { icon: PackagePlus, title: "Reorder 12 SKUs", detail: "Below ROP — suggested buy ₹3.6L from 4 suppliers.", tone: "primary" as const, href: "/inventory/reorder" },
  { icon: TrendingDown, title: "Reduce overstock", detail: "9 SKUs > 90 days cover — redistribute or promote.", tone: "secondary" as const, href: "/inventory/analytics" },
  { icon: Trash2, title: "Clear dead stock", detail: "₹2.3L idle 180+ days — clearance discount suggested.", tone: "danger" as const, href: "/inventory/valuation" },
  { icon: CalendarClock, title: "Near-expiry clearance", detail: "86 batches expiring ≤30 days — markdown or return.", tone: "warning" as const, href: "/inventory/expiry" },
  { icon: ArrowLeftRight, title: "Inter-branch transfer", detail: "Move 320 units from Chennai surplus to Bengaluru shortage.", tone: "success" as const, href: "/inventory/transfer/new" },
];
const PREDICTIONS = [
  { label: "Stock-out risk (7 days)", value: "8 SKUs", tone: "danger" as const },
  { label: "Inventory aging (next 30d)", value: "+₹4.2L", tone: "warning" as const },
  { label: "Seasonal demand (festival)", value: "+22%", tone: "secondary" as const },
];
const TONE = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white" } as const;

export default function AiInventoryPage() {
  const [phase, setPhase] = useState<"idle" | "run" | "done">("idle");
  const notes = invNotesFor("ai");
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/inventory" className="hover:text-foreground">Inventory</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">AI Inventory Engine</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Sparkles className="h-5 w-5 text-primary" /> AI Inventory Engine</h1>
        <p className="mt-0.5 text-sm text-muted">Optimization &amp; predictions across reorder, overstock, dead stock &amp; transfers.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white"><Sparkles className="h-6 w-6 shrink-0" /><div><p className="text-sm font-bold">AI Inventory Optimization</p><p className="text-xs text-white/85">Reads sales velocity, lead times, expiry, branch balances & seasonality to optimize stock.</p></div></div>

      {phase === "idle" && <Button size="lg" onClick={() => { setPhase("run"); setTimeout(() => setPhase("done"), 1400); }}><Sparkles className="h-4 w-4" /> Run AI Optimization</Button>}
      {phase === "run" && <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium text-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Analysing demand, aging, expiry & branch balances…</div>}

      {phase === "done" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {PREDICTIONS.map((p) => (
              <div key={p.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{p.label}</p>
                <p className={cn("mt-1 text-2xl font-bold", p.tone === "danger" ? "text-danger" : p.tone === "warning" ? "text-warning" : "text-secondary")}>{p.value}</p>
              </div>
            ))}
          </div>
          <h2 className="text-sm font-semibold text-foreground">Recommended Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {RECOMMENDATIONS.map((r) => (
              <Link key={r.title} href={r.href} className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg shadow-sm", TONE[r.tone])}><r.icon className="h-5 w-5" /></span>
                <div className="flex-1"><p className="text-sm font-semibold text-foreground">{r.title}</p><p className="text-2xs text-muted">{r.detail}</p></div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
