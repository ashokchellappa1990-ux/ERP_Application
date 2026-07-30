import Link from "next/link";
import { BarChart3, Settings2, type LucideIcon } from "lucide-react";
import { MOVERS, invNotesFor } from "@/lib/inventory/inventoryData";
import { cn } from "@/lib/cn";

const STAT_TONES = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white" } as const;

export default function InventoryAnalyticsPage() {
  const notes = invNotesFor("analytics");
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/inventory" className="hover:text-foreground">Inventory</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Analytics</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><BarChart3 className="h-5 w-5 text-primary" /> Inventory Analytics</h1>
        <p className="mt-0.5 text-sm text-muted">Turnover, fast/slow movers, dead stock &amp; overstock.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Basis:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={BarChart3} label="Inventory Turnover" value="6.4×" tone="primary" />
        <Stat icon={BarChart3} label="Fast Movers" value="184" tone="success" />
        <Stat icon={BarChart3} label="Slow Movers" value="92" tone="warning" />
        <Stat icon={BarChart3} label="Dead Stock" value="38" tone="danger" />
        <Stat icon={BarChart3} label="Overstock Items" value="61" tone="secondary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-success">Fast Moving (high turnover)</h2>
          <div className="space-y-2">{MOVERS.fast.map((m) => <div key={m.name} className="flex items-center justify-between rounded-lg border border-border bg-surface p-2.5 text-sm"><span className="text-foreground">{m.name}</span><span className="font-bold text-success">{m.turns}</span></div>)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-danger">Slow Moving (low turnover)</h2>
          <div className="space-y-2">{MOVERS.slow.map((m) => <div key={m.name} className="flex items-center justify-between rounded-lg border border-border bg-surface p-2.5 text-sm"><span className="text-foreground">{m.name}</span><span className="font-bold text-danger">{m.turns}</span></div>)}</div>
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
