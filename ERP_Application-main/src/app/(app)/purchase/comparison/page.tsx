"use client";

import { useState } from "react";
import Link from "next/link";
import { GitCompare, Settings2, Check, Award } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { purchaseNotesFor } from "@/lib/purchase/purchaseData";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

const ITEMS = ["Surf Excel 1kg (×500)", "Tata Salt 1kg (×400)", "Colgate 200g (×300)"];
const QUOTES = [
  { supplier: "Hindustan Unilever Ltd", rates: [96, 27, 96], lead: 3, rating: 4.7, terms: "Net 30" },
  { supplier: "ITC Distributors", rates: [98, 26, 98], lead: 2, rating: 4.5, terms: "Net 15" },
  { supplier: "Metro Cash & Carry", rates: [95, 28, 99], lead: 5, rating: 4.2, terms: "Advance" },
];
const QTY = [500, 400, 300];

export default function SupplierComparisonPage() {
  const fmt = useFmt();
  const inr = (n: number) => fmt.money(n);
  const totals = QUOTES.map((q) => q.rates.reduce((s, r, i) => s + r * QTY[i], 0));
  const best = totals.indexOf(Math.min(...totals));
  const [picked, setPicked] = useState(best);
  const notes = purchaseNotesFor("comparison");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase" className="hover:text-foreground">Purchase</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Supplier Comparison</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><GitCompare className="h-5 w-5 text-primary" /> Supplier Comparison</h1>
          <p className="mt-0.5 text-sm text-muted">RFQ/CHN/26-27/0021 · Diwali Grocery Stock — 3 quotes received.</p>
        </div>
        <Link href="/purchase/order/new"><Button size="md"><Check className="h-4 w-4" /> Create PO from selected</Button></Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Procurement policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
              <th className="px-4 py-3">Item / Qty</th>
              {QUOTES.map((q, i) => <th key={q.supplier} className={cn("px-4 py-3 text-right", i === best && "bg-success-subtle/60")}>{q.supplier}{i === best && <span className="ml-1 inline-flex items-center gap-0.5 text-success"><Award className="h-3 w-3" /></span>}</th>)}
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((it, r) => (
              <tr key={it} className="border-b border-border">
                <td className="px-4 py-2.5 font-medium text-foreground">{it}</td>
                {QUOTES.map((q, i) => { const min = Math.min(...QUOTES.map((x) => x.rates[r])); return <td key={i} className={cn("px-4 py-2.5 text-right", i === best && "bg-success-subtle/30", q.rates[r] === min ? "font-bold text-success" : "text-muted")}>{inr(q.rates[r])}</td>; })}
              </tr>
            ))}
            <tr className="border-b border-border bg-surface-2/60">
              <td className="px-4 py-2.5 text-2xs font-semibold uppercase text-subtle">Order Total</td>
              {totals.map((t, i) => <td key={i} className={cn("px-4 py-2.5 text-right text-base font-bold", i === best ? "bg-success-subtle/40 text-success" : "text-foreground")}>{inr(t)}</td>)}
            </tr>
            <tr className="border-b border-border"><td className="px-4 py-2.5 text-muted">Lead Time</td>{QUOTES.map((q, i) => <td key={i} className="px-4 py-2.5 text-right text-muted">{q.lead} days</td>)}</tr>
            <tr className="border-b border-border"><td className="px-4 py-2.5 text-muted">Payment Terms</td>{QUOTES.map((q, i) => <td key={i} className="px-4 py-2.5 text-right text-muted">{q.terms}</td>)}</tr>
            <tr className="border-b border-border"><td className="px-4 py-2.5 text-muted">Rating</td>{QUOTES.map((q, i) => <td key={i} className="px-4 py-2.5 text-right"><Badge tone="success">{q.rating}★</Badge></td>)}</tr>
            <tr><td className="px-4 py-3 text-muted">Select</td>{QUOTES.map((q, i) => <td key={i} className="px-4 py-3 text-right"><button onClick={() => setPicked(i)} className={cn("inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition", picked === i ? "border-primary bg-primary text-white" : "border-border bg-surface text-muted hover:border-primary/40")}>{picked === i ? <><Check className="h-3.5 w-3.5" /> Selected</> : "Select"}</button></td>)}</tr>
          </tbody>
        </table>
      </div>
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">AI recommends <strong>{QUOTES[best].supplier}</strong> — lowest landed cost ({inr(totals[best])}) within policy. Lead time & rating factored in.</p>
    </div>
  );
}
