"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, UserX, Crown, RotateCcw, TrendingUp, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const RECS = [
  { icon: UserX, title: "Win back inactive customers", detail: "186 members inactive 90+ days — send 2× points offer. Est. recovery 22%.", tone: "danger" as const },
  { icon: Crown, title: "Near tier-upgrade nudge", detail: "94 customers ₹5k away from Gold/Platinum — nudge with a bonus to upgrade.", tone: "warning" as const },
  { icon: RotateCcw, title: "Win-back campaign", detail: "Lapsed high-LTV customers — personalised cashback to re-engage.", tone: "secondary" as const },
  { icon: ArrowUpRight, title: "Cross-sell campaign", detail: "Grocery buyers likely for Personal Care — bundle points offer.", tone: "primary" as const },
  { icon: TrendingUp, title: "Upsell to higher basket", detail: "Gold members: spend ₹500 more for 3× points this week.", tone: "success" as const },
];
const TONE = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white" } as const;

export default function AiLoyaltyPage() {
  const [phase, setPhase] = useState<"idle" | "run" | "done">("idle");
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/loyalty" className="hover:text-foreground">Loyalty</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">AI Loyalty Engine</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Sparkles className="h-5 w-5 text-primary" /> AI Loyalty Engine</h1>
        <p className="mt-0.5 text-sm text-muted">Retention predictions, win-back, cross/up-sell &amp; campaign suggestions.</p>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white"><Sparkles className="h-6 w-6 shrink-0" /><div><p className="text-sm font-bold">AI Retention Copilot</p><p className="text-xs text-white/85">Analyses RFM, tier movement, redemption & churn risk to recommend the next best action.</p></div></div>
      {phase === "idle" && <Button size="lg" onClick={() => { setPhase("run"); setTimeout(() => setPhase("done"), 1400); }}><Sparkles className="h-4 w-4" /> Generate Recommendations</Button>}
      {phase === "run" && <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium text-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Scoring churn risk, tier movement & campaign uplift…</div>}
      {phase === "done" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Predicted Retention", "+6.4%", "success"], ["At-Risk Members", "186", "danger"], ["Near Tier Upgrade", "94", "warning"]].map(([l, v, t]) => (
              <div key={l} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-2xs font-semibold uppercase tracking-wide text-muted">{l}</p><p className={cn("mt-1 text-2xl font-bold", t === "danger" ? "text-danger" : t === "warning" ? "text-warning" : "text-success")}>{v}</p></div>
            ))}
          </div>
          <h2 className="text-sm font-semibold text-foreground">Recommended Campaigns</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {RECS.map((r) => (
              <Link key={r.title} href="/loyalty/campaign/new" className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg shadow-sm", TONE[r.tone])}><r.icon className="h-5 w-5" /></span>
                <div><p className="text-sm font-semibold text-foreground">{r.title}</p><p className="text-2xs text-muted">{r.detail}</p></div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
