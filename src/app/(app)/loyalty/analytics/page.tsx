import Link from "next/link";
import { BarChart3, Settings2, type LucideIcon } from "lucide-react";
import { LOYALTY_STATS, TIER_DISTRIBUTION } from "@/lib/loyalty/loyaltyData";
import { formatNumber } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";

const TREND = [{ m: "Jan", i: 62, r: 31 }, { m: "Feb", i: 70, r: 36 }, { m: "Mar", i: 84, r: 42 }, { m: "Apr", i: 78, r: 40 }, { m: "May", i: 92, r: 48 }, { m: "Jun", i: 100, r: 50 }];
const STAT_TONES = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white" } as const;
const BAR = { neutral: "bg-slate-400", warning: "bg-warning", secondary: "bg-secondary", primary: "bg-primary", success: "bg-success" } as const;

export default function LoyaltyAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/loyalty" className="hover:text-foreground">Loyalty</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Analytics</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><BarChart3 className="h-5 w-5 text-primary" /> Loyalty Analytics</h1>
        <p className="mt-0.5 text-sm text-muted">Points issued vs redeemed, retention &amp; membership mix.</p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> KPIs across active members, points, wallet, campaigns &amp; referrals.</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={BarChart3} label="Active Members" value={formatNumber(LOYALTY_STATS.activeMembers)} tone="primary" />
        <Stat icon={BarChart3} label="Redemption Rate" value={`${LOYALTY_STATS.redemptionRate}%`} tone="secondary" />
        <Stat icon={BarChart3} label="Retention Rate" value={`${LOYALTY_STATS.retentionRate}%`} tone="success" />
        <Stat icon={BarChart3} label="Referral Success" value="62%" tone="warning" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Points Issued vs Redeemed</h2>
          <div className="flex h-44 items-end gap-4">
            {TREND.map((t) => (
              <div key={t.m} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end gap-1"><div className="w-1/2 rounded-t bg-primary" style={{ height: `${t.i}%` }} /><div className="w-1/2 rounded-t bg-warning" style={{ height: `${t.r}%` }} /></div>
                <span className="text-2xs text-muted">{t.m}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-2xs text-muted"><span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-primary" /> Issued</span><span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-warning" /> Redeemed</span></div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Membership Mix</h2>
          <div className="space-y-3">{TIER_DISTRIBUTION.map((t) => (<div key={t.label}><div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium text-foreground">{t.label}</span><span className="text-muted">{t.value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", BAR[t.tone])} style={{ width: `${t.value}%` }} /></div></div>))}</div>
        </div>
      </div>
    </div>
  );
}
function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: keyof typeof STAT_TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", STAT_TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
