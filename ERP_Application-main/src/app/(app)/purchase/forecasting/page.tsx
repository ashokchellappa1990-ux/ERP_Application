import Link from "next/link";
import { TrendingUp, Settings2, ArrowRight, Sparkles, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { pf, pflag } from "@/lib/purchase/purchaseConfig";
import { cn } from "@/lib/cn";

const FORECAST = [
  { week: "W24", actual: 62, forecast: 64 }, { week: "W25", actual: 71, forecast: 70 }, { week: "W26", actual: 0, forecast: 78 }, { week: "W27", actual: 0, forecast: 92 }, { week: "W28", actual: 0, forecast: 88 }, { week: "W29", actual: 0, forecast: 74 },
];
const ITEMS = [
  { name: "Surf Excel 1kg", trend: "+18%", cover: "9 days", reorder: "Now", tone: "danger" as const },
  { name: "Aashirvaad Atta 5kg", trend: "+24%", cover: "6 days", reorder: "Now", tone: "danger" as const },
  { name: "Amul Butter 500g", trend: "+9%", cover: "14 days", reorder: "This week", tone: "warning" as const },
  { name: "Tata Salt 1kg", trend: "+2%", cover: "31 days", reorder: "Scheduled", tone: "success" as const },
  { name: "Colgate 200g", trend: "-4%", cover: "22 days", reorder: "Hold", tone: "neutral" as const },
];
const STAT_TONES = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white" } as const;

export default function DemandForecastPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase" className="hover:text-foreground">Purchase</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Demand Forecasting</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><TrendingUp className="h-5 w-5 text-primary" /> Demand Forecasting</h1>
        <p className="mt-0.5 text-sm text-muted">AI demand projection &amp; stock-cover to drive proactive procurement.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Basis:</span>
        {[`Costing: ${pf("costingMethod")}`, pflag("autoReorderSuggestion") ? "Auto-reorder ON" : "OFF", "52-week seasonality"].map((n) => <span key={n} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium capitalize text-muted">{n}</span>)}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={TrendingUp} label="Forecast Accuracy" value="92%" tone="success" />
        <Stat icon={Sparkles} label="Items to Reorder" value="2" tone="primary" />
        <Stat icon={TrendingUp} label="Demand Uplift (Festival)" value="+22%" tone="warning" />
        <Stat icon={TrendingUp} label="Avg Stock Cover" value="16 days" tone="secondary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Demand — Actual vs Forecast</h2>
          <div className="flex h-44 items-end gap-3">
            {FORECAST.map((f) => (
              <div key={f.week} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end gap-0.5">
                  <div className="w-1/2 rounded-t bg-primary" style={{ height: `${f.actual}%` }} title={`Actual ${f.actual}`} />
                  <div className="w-1/2 rounded-t bg-primary/30" style={{ height: `${f.forecast}%` }} title={`Forecast ${f.forecast}`} />
                </div>
                <span className="text-2xs text-muted">{f.week}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-2xs text-muted"><span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-primary" /> Actual</span><span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-primary/30" /> Forecast</span></div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Reorder Signals</h2>
          <div className="space-y-2">
            {ITEMS.map((it) => (
              <div key={it.name} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2.5">
                <div className="min-w-0"><p className="truncate text-xs font-medium text-foreground">{it.name}</p><p className="text-2xs text-muted">Trend {it.trend} · cover {it.cover}</p></div>
                <Badge tone={it.tone}>{it.reorder}</Badge>
              </div>
            ))}
          </div>
          <Link href="/purchase/planning" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open AI Planning <ArrowRight className="h-3 w-3" /></Link>
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
