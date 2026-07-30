import Link from "next/link";
import { Users, Coins, ArrowDownCircle, Wallet, Gift, Share2, TrendingUp, Repeat, Settings2, ArrowRight, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LOYALTY_FEATURES, LOYALTY_STATS, TIER_DISTRIBUTION, LOYALTY_SETUP_FLOW } from "@/lib/loyalty/loyaltyData";
import { ly, lyFlag } from "@/lib/loyalty/loyaltyConfig";
import { formatNumber } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";

const num = (n: number) => formatNumber(n);
const lakh = (n: number) => `₹${(n / 100000).toFixed(1)}L`;
const STAT_TONES = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white", accent: "bg-accent text-accent-foreground" } as const;
const BAR_TONES = { neutral: "bg-slate-400", warning: "bg-warning", secondary: "bg-secondary", primary: "bg-primary", success: "bg-success" } as const;

export default function LoyaltyDashboardPage() {
  const features = LOYALTY_FEATURES.filter((f) => f.key !== "dashboard");
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Loyalty Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted">Customer rewards in real-time — points, cashback, wallet &amp; retention.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/loyalty/configuration"><Button variant="secondary" size="md"><Settings2 className="h-4 w-4" /> Configure</Button></Link>
          <Link href="/loyalty/ai"><Button size="md"><Sparkles className="h-4 w-4" /> AI Engine</Button></Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Policy:</span>
        {[lyFlag("enabled") ? "Loyalty ON" : "OFF", `₹100 = ${ly("pointsPer100")} pts`, `1 pt = ₹${ly("pointValue")}`, lyFlag("membershipBased") ? "Tiers ON" : "—", lyFlag("cashbackBased") ? "Cashback ON" : "—", lyFlag("autoUpgrade") ? "Auto-upgrade" : "—"].map((n) => <span key={n} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat icon={Users} label="Active Members" value={num(LOYALTY_STATS.activeMembers)} tone="primary" />
        <Stat icon={Coins} label="Points Issued" value={num(LOYALTY_STATS.pointsIssued)} tone="secondary" />
        <Stat icon={ArrowDownCircle} label="Points Redeemed" value={num(LOYALTY_STATS.pointsRedeemed)} tone="warning" />
        <Stat icon={Wallet} label="Wallet Balance" value={lakh(LOYALTY_STATS.walletBalance)} tone="success" />
        <Stat icon={Gift} label="Gift Cards" value={num(LOYALTY_STATS.giftCardsActive)} tone="accent" />
        <Stat icon={Share2} label="Referrals" value={num(LOYALTY_STATS.referrals)} tone="primary" />
        <Stat icon={TrendingUp} label="Retention Rate" value={`${LOYALTY_STATS.retentionRate}%`} tone="success" />
        <Stat icon={Repeat} label="Redemption Rate" value={`${LOYALTY_STATS.redemptionRate}%`} tone="secondary" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Membership Distribution</h2>
        <div className="space-y-3">
          {TIER_DISTRIBUTION.map((t) => (
            <div key={t.label}>
              <div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium text-foreground">{t.label}</span><span className="text-muted">{t.value}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", BAR_TONES[t.tone])} style={{ width: `${t.value}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Setup workflow — how to build a loyalty program, menu by menu */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" /> Build your loyalty program — step by step</h2>
          <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-2xs font-semibold text-primary">{LOYALTY_SETUP_FLOW.length} steps · ~10 min</span>
        </div>
        <p className="mb-4 text-xs text-muted">Follow the flow below — each step links to the screen to configure. Configure once, then loyalty runs automatically at billing.</p>
        <ol className="relative ml-1 space-y-3 border-l-2 border-dashed border-primary/25 pl-7">
          {LOYALTY_SETUP_FLOW.map((s, i) => {
            const newPhase = i === 0 || s.phase !== LOYALTY_SETUP_FLOW[i - 1].phase;
            return (
              <li key={s.title} className="relative">
                {newPhase && <p className="-ml-7 mb-1.5 mt-1 text-2xs font-bold uppercase tracking-wider text-primary">{s.phase}</p>}
                <span className="absolute -left-[2.4rem] top-3 grid h-7 w-7 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white ring-4 ring-card">{i + 1}</span>
                <Link href={s.href} className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5 transition hover:border-primary hover:shadow-sm">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary transition group-hover:bg-brand-gradient group-hover:text-white"><s.icon className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{s.title}</p>
                    <p className="text-2xs leading-relaxed text-muted">{s.todo}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 self-center rounded-md border border-primary/30 bg-primary-subtle px-2.5 py-1 text-2xs font-semibold text-primary transition group-hover:bg-primary group-hover:text-white">Open <ArrowRight className="h-3 w-3" /></span>
                </Link>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-success-subtle p-3 text-xs font-medium text-success"><Sparkles className="h-4 w-4" /> Once live, every bill auto-earns points & cashback, updates the wallet and upgrades membership — no manual work.</div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Loyalty Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((f) => (
            <Link key={f.key} href={f.href} className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary transition group-hover:bg-brand-gradient group-hover:text-white"><f.icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{f.label}</p><p className="text-2xs text-muted">{f.desc}</p></div>
              <ArrowRight className="h-4 w-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: keyof typeof STAT_TONES }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg shadow-sm", STAT_TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-base font-bold tracking-tight text-foreground">{value}</p></div>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}
