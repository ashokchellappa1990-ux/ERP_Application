import Link from "next/link";
import { TrendingUp, Settings2, ArrowRight, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { invNotesFor } from "@/lib/inventory/inventoryData";
import { invFlag } from "@/lib/inventory/inventoryConfig";
import { cn } from "@/lib/cn";

const TREND = [{ w: "W24", a: 62, f: 64 }, { w: "W25", a: 71, f: 70 }, { w: "W26", a: 0, f: 78 }, { w: "W27", a: 0, f: 92 }, { w: "W28", a: 0, f: 88 }, { w: "W29", a: 0, f: 74 }];
const RISK = [
  { name: "Surf Excel 1kg", cover: "3 days", risk: "High", tone: "danger" as const },
  { name: "Aashirvaad Atta 5kg", cover: "5 days", risk: "High", tone: "danger" as const },
  { name: "Amul Butter 500g", cover: "11 days", risk: "Medium", tone: "warning" as const },
  { name: "Tata Salt 1kg", cover: "28 days", risk: "Low", tone: "success" as const },
];
const STAT_TONES = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white" } as const;

export default function InventoryForecastingPage() {
  const notes = invNotesFor("forecasting");
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/inventory" className="hover:text-foreground">Inventory</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Inventory Forecasting</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><TrendingUp className="h-5 w-5 text-primary" /> Inventory Forecasting</h1>
        <p className="mt-0.5 text-sm text-muted">Demand projection, stock-cover &amp; stock-out risk.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Basis:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={TrendingUp} label="Forecast Accuracy" value="92%" tone="success" />
        <Stat icon={TrendingUp} label="Stock-out Risk" value="8 SKUs" tone="warning" />
        <Stat icon={TrendingUp} label="Avg Stock Cover" value="16 days" tone="secondary" />
        <Stat icon={TrendingUp} label="Festival Uplift" value="+22%" tone="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Demand — Actual vs Forecast</h2>
          <div className="flex h-44 items-end gap-3">
            {TREND.map((t) => (
              <div key={t.w} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end gap-0.5"><div className="w-1/2 rounded-t bg-primary" style={{ height: `${t.a}%` }} /><div className="w-1/2 rounded-t bg-primary/30" style={{ height: `${t.f}%` }} /></div>
                <span className="text-2xs text-muted">{t.w}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-2xs text-muted"><span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-primary" /> Actual</span><span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-primary/30" /> Forecast</span></div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Stock-out Risk</h2>
          <div className="space-y-2">
            {RISK.map((r) => <div key={r.name} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2.5"><div className="min-w-0"><p className="truncate text-xs font-medium text-foreground">{r.name}</p><p className="text-2xs text-muted">Cover {r.cover}</p></div><Badge tone={r.tone}>{r.risk}</Badge></div>)}
          </div>
          {invFlag("aiOptimization") && <Link href="/inventory/ai" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open AI Engine <ArrowRight className="h-3 w-3" /></Link>}
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
