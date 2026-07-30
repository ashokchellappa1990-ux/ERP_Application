"use client";

import { useState } from "react";
import Link from "next/link";
import { PackagePlus, Settings2, ShoppingBag, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { invNotesFor } from "@/lib/inventory/inventoryData";
import { cn } from "@/lib/cn";

const METHODS = ["Minimum Level", "Maximum Level", "Reorder Point", "AI Recommendation"];
const ROWS = [
  { product: "Surf Excel 1kg", stock: 42, min: 100, max: 400, rop: 200, suggest: 360, action: "Purchase", supplier: "HUL", tone: "danger" as const },
  { product: "Aashirvaad Atta 5kg", stock: 18, min: 50, max: 200, rop: 80, suggest: 180, action: "Purchase", supplier: "ITC", tone: "danger" as const },
  { product: "Amul Butter 500g", stock: 64, min: 40, max: 150, rop: 60, suggest: 60, action: "Transfer", supplier: "WH-COLD", tone: "warning" as const },
  { product: "Colgate 200g", stock: 150, min: 60, max: 200, rop: 100, suggest: 0, action: "OK", supplier: "—", tone: "success" as const },
];

export default function ReorderPlanningPage() {
  const [method, setMethod] = useState("AI Recommendation");
  const notes = invNotesFor("reorder");
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/inventory" className="hover:text-foreground">Inventory</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Reorder Planning</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackagePlus className="h-5 w-5 text-primary" /> Reorder Planning</h1>
        <p className="mt-0.5 text-sm text-muted">Min/Max, reorder point &amp; AI suggestions → purchase or transfer.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Method:</span>
        {METHODS.map((m) => <button key={m} onClick={() => setMethod(m)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", method === m ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40")}>{m}</button>)}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-center">Stock</th><th className="px-4 py-3 text-center">Min</th><th className="px-4 py-3 text-center">ROP</th><th className="px-4 py-3 text-center">Max</th><th className="px-4 py-3 text-center">Suggested</th><th className="px-4 py-3">Source</th><th className="px-4 py-3 text-center">Action</th></tr></thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.product} className="border-b border-border last:border-0 hover:bg-primary-subtle/30">
                <td className="px-4 py-3 font-medium text-foreground">{r.product}</td>
                <td className={cn("px-4 py-3 text-center font-semibold", r.stock < r.rop ? "text-danger" : "text-muted")}>{r.stock}</td>
                <td className="px-4 py-3 text-center text-muted">{r.min}</td>
                <td className="px-4 py-3 text-center text-muted">{r.rop}</td>
                <td className="px-4 py-3 text-center text-muted">{r.max}</td>
                <td className="px-4 py-3 text-center font-bold text-primary">{r.suggest || "—"}</td>
                <td className="px-4 py-3 text-muted">{r.supplier}</td>
                <td className="px-4 py-3 text-center"><Badge tone={r.tone}>{r.action}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/purchase/order/new"><Button size="md"><ShoppingBag className="h-4 w-4" /> Generate Purchase Suggestions</Button></Link>
        <Link href="/inventory/transfer/new"><Button variant="outline" size="md"><ArrowLeftRight className="h-4 w-4" /> Generate Transfer Suggestions</Button></Link>
      </div>
    </div>
  );
}
