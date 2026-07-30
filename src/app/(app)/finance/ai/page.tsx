"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, TrendingUp, TrendingDown, HandCoins, ShieldAlert, Scale, PiggyBank, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const FORECASTS = [
  { icon: TrendingUp, label: "Cash Flow (30d)", value: "+₹6.8L", tone: "success" as const, note: "Healthy; peak outflow around 7-Jul (GST + EMI)." },
  { icon: TrendingUp, label: "Revenue (next month)", value: "₹52L", tone: "primary" as const, note: "+8% MoM on festival uplift." },
  { icon: TrendingDown, label: "Expense (next month)", value: "₹17L", tone: "warning" as const, note: "Marketing trending above budget." },
  { icon: HandCoins, label: "Collection Prediction", value: "82%", tone: "secondary" as const, note: "₹3.4L likely to slip past due — follow up Crescent Pharma." },
];
const ALERTS = [
  { icon: ShieldAlert, title: "GST risk alert", detail: "ITC mismatch ₹4.2k vs GSTR-2B — reconcile before 3B.", tone: "danger" as const },
  { icon: Scale, title: "Working capital", detail: "WC ratio 1.48 — adequate; DSO 27d vs DPO 32d is favourable.", tone: "primary" as const },
  { icon: PiggyBank, title: "Expense optimisation", detail: "Switch 2 software subs to annual → save ₹38k/yr.", tone: "success" as const },
  { icon: TrendingDown, title: "Budget variance", detail: "Chennai branch +5% over budget — review discretionary spend.", tone: "warning" as const },
];
const TONE = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white" } as const;

export default function AiFinancePage() {
  const [phase, setPhase] = useState<"idle" | "run" | "done">("idle");
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance" className="hover:text-foreground">Finance</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">AI Finance Engine</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Sparkles className="h-5 w-5 text-primary" /> AI Finance Engine</h1>
        <p className="mt-0.5 text-sm text-muted">Forecasts, risk alerts, working-capital &amp; profitability analysis.</p>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white"><Sparkles className="h-6 w-6 shrink-0" /><div><p className="text-sm font-bold">AI CFO Copilot</p><p className="text-xs text-white/85">Reads ledgers, AR/AP, GST, budgets & cash to forecast and advise.</p></div></div>
      {phase === "idle" && <Button size="lg" onClick={() => { setPhase("run"); setTimeout(() => setPhase("done"), 1400); }}><Sparkles className="h-4 w-4" /> Run Financial Analysis</Button>}
      {phase === "run" && <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium text-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Forecasting cash flow, collections & variance…</div>}
      {phase === "done" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FORECASTS.map((f) => (
              <div key={f.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONE[f.tone])}><f.icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold text-foreground">{f.value}</p></div>
                <p className="mt-2 text-xs font-medium text-foreground">{f.label}</p>
                <p className="mt-0.5 text-2xs text-muted">{f.note}</p>
              </div>
            ))}
          </div>
          <h2 className="text-sm font-semibold text-foreground">Alerts &amp; Recommendations</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ALERTS.map((a) => (
              <div key={a.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg shadow-sm", TONE[a.tone])}><a.icon className="h-5 w-5" /></span>
                <div><p className="text-sm font-semibold text-foreground">{a.title}</p><p className="text-2xs text-muted">{a.detail}</p></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
