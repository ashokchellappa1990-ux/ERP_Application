"use client";

import { useState } from "react";
import Link from "next/link";
import { Scale, Settings2, type LucideIcon, IndianRupee, Clock, PackageX } from "lucide-react";
import { RadioCard } from "@/components/ui/RadioCard";
import { invNotesFor } from "@/lib/inventory/inventoryData";
import { inv } from "@/lib/inventory/inventoryConfig";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

const METHODS = [
  { value: "FIFO", label: "FIFO", desc: "Oldest cost layers consumed first." },
  { value: "WAVG", label: "Weighted Average", desc: "Moving average cost across receipts." },
  { value: "STD", label: "Standard Cost", desc: "Fixed cost; variance posted separately." },
];
const AGING = [
  { bucket: "0–30 days", value: 9820000, pct: 49 },
  { bucket: "31–60 days", value: 5240000, pct: 26 },
  { bucket: "61–90 days", value: 3110000, pct: 15 },
  { bucket: "90+ days (aging)", value: 2000000, pct: 10 },
];
const DEAD = [
  { name: "Designer Lamp", qty: 42, value: 84000, days: 210 },
  { name: "Premium Cookware Set", qty: 18, value: 54000, days: 180 },
  { name: "Winter Jacket XL", qty: 64, value: 96000, days: 240 },
];
const STAT_TONES = { primary: "bg-primary text-white", warning: "bg-warning text-white", danger: "bg-danger text-white" } as const;

export default function InventoryValuationPage() {
  const fmt = useFmt();
  const [method, setMethod] = useState(inv("valuationMethod"));
  const notes = invNotesFor("valuation");
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/inventory" className="hover:text-foreground">Inventory</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Inventory Valuation</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Scale className="h-5 w-5 text-primary" /> Inventory Valuation</h1>
        <p className="mt-0.5 text-sm text-muted">Valuation, aging &amp; dead-stock — posts to the inventory GL.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{METHODS.map((m) => <RadioCard key={m.value} selected={method === m.value} onSelect={() => setMethod(m.value)} title={m.label} description={m.desc} />)}</div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={IndianRupee} label="Inventory Value" value="₹201.7L" tone="primary" />
        <Stat icon={Clock} label="Aging > 90 days" value="₹20.0L" tone="warning" />
        <Stat icon={PackageX} label="Dead Stock" value="₹2.3L" tone="danger" />
        <Stat icon={IndianRupee} label="Avg Cost / Unit" value="₹70.85" tone="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Inventory Aging ({method})</h2>
          <div className="space-y-3">
            {AGING.map((a) => (
              <div key={a.bucket}>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium text-foreground">{a.bucket}</span><span className="text-muted">₹{(a.value / 100000).toFixed(1)}L · {a.pct}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", a.bucket.includes("90+") ? "bg-danger" : a.bucket.includes("61") ? "bg-warning" : "bg-primary")} style={{ width: `${a.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Dead Stock</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="py-2">Product</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Value</th><th className="py-2 text-right">Idle</th></tr></thead>
              <tbody>{DEAD.map((d) => <tr key={d.name} className="border-b border-border last:border-0"><td className="py-2 font-medium text-foreground">{d.name}</td><td className="py-2 text-right text-muted">{fmt.qty(d.qty)}</td><td className="py-2 text-right font-semibold text-foreground">{fmt.money(d.value)}</td><td className="py-2 text-right text-danger">{d.days}d</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: keyof typeof STAT_TONES }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg shadow-sm", STAT_TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}
