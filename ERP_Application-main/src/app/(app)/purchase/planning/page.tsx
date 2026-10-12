"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Settings2, ShoppingBag, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { purchaseNotesFor } from "@/lib/purchase/purchaseData";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

const SUGGESTIONS = [
  { product: "Surf Excel 1kg", stock: 42, rol: 200, suggest: 500, supplier: "Hindustan Unilever Ltd", reason: "Below ROL · 14-day demand", value: 48000, urgency: "High" },
  { product: "Aashirvaad Atta 5kg", stock: 18, rol: 80, suggest: 150, supplier: "ITC Distributors", reason: "Fast mover · festival uplift", value: 38700, urgency: "High" },
  { product: "Amul Butter 500g", stock: 64, rol: 60, suggest: 120, supplier: "Amul Regional Depot", reason: "Near ROL · short shelf life", value: 31200, urgency: "Medium" },
  { product: "Colgate 200g", stock: 150, rol: 100, suggest: 0, supplier: "—", reason: "Sufficient cover (22 days)", value: 0, urgency: "None" },
];

export default function PurchasePlanningPage() {
  const fmt = useFmt();
  const inr = (n: number) => fmt.money(n);
  const [phase, setPhase] = useState<"idle" | "run" | "done">("idle");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const notes = purchaseNotesFor("planning");
  const actionable = SUGGESTIONS.filter((s) => s.suggest > 0);
  const totalValue = actionable.filter((s) => picked[s.product]).reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase" className="hover:text-foreground">Purchase</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">AI Purchase Planning</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Sparkles className="h-5 w-5 text-primary" /> AI Purchase Planning</h1>
        <p className="mt-0.5 text-sm text-muted">AI reorder &amp; buying suggestions from stock, ROL, lead time &amp; demand forecast.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white"><Sparkles className="h-6 w-6 shrink-0" /><div><p className="text-sm font-bold">AI Reorder Engine</p><p className="text-xs text-white/85">Analyses sales velocity, lead times, seasonality &amp; supplier reliability to plan what to buy.</p></div></div>

      {phase === "idle" && <Button size="lg" onClick={() => { setPhase("run"); setTimeout(() => { setPhase("done"); setPicked(Object.fromEntries(actionable.map((s) => [s.product, true]))); }, 1400); }}><Sparkles className="h-4 w-4" /> Generate Purchase Plan</Button>}
      {phase === "run" && <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium text-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Analysing stock cover, demand &amp; supplier lead times…</div>}

      {phase === "done" && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-center">Stock</th><th className="px-4 py-3 text-center">ROL</th><th className="px-4 py-3 text-center">Suggested Qty</th><th className="px-4 py-3">Best Supplier</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3 text-center">Urgency</th><th className="px-4 py-3 text-center">Buy</th></tr></thead>
              <tbody>
                {SUGGESTIONS.map((s) => (
                  <tr key={s.product} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">{s.product}</td>
                    <td className={cn("px-4 py-2.5 text-center font-semibold", s.stock < s.rol ? "text-danger" : "text-muted")}>{s.stock}</td>
                    <td className="px-4 py-2.5 text-center text-muted">{s.rol}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-primary">{s.suggest || "—"}</td>
                    <td className="px-4 py-2.5 text-muted">{s.supplier}</td>
                    <td className="px-4 py-2.5 text-2xs text-muted">{s.reason}</td>
                    <td className="px-4 py-2.5 text-center"><Badge tone={s.urgency === "High" ? "danger" : s.urgency === "Medium" ? "warning" : "neutral"}>{s.urgency}</Badge></td>
                    <td className="px-4 py-2.5 text-center">{s.suggest > 0 ? <input type="checkbox" checked={!!picked[s.product]} onChange={(e) => setPicked({ ...picked, [s.product]: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" /> : <span className="text-subtle">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row">
            <p className="text-sm text-muted">Selected buy value: <span className="text-lg font-bold text-foreground">{inr(totalValue)}</span></p>
            <Link href="/purchase/order/new"><Button size="md"><ShoppingBag className="h-4 w-4" /> Create POs from selection</Button></Link>
          </div>
        </>
      )}
    </div>
  );
}
