"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Gift, Crown, Coins, Wallet, X, Check, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ly } from "@/lib/loyalty/loyaltyConfig";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

// Sample loyalty snapshot for the billed customer (would come from Customer Loyalty Profile).
const SNAP = { tier: "Platinum", points: 4200, wallet: 4200, cashback: 350 };
const HISTORY = [
  { date: "12-Jun-2026", ref: "INV-RT/CHN/26-27/8841", type: "Earned", pts: 84, bal: 4200 },
  { date: "10-Jun-2026", ref: "Redeemed at POS", type: "Redeemed", pts: -200, bal: 4116 },
  { date: "05-Jun-2026", ref: "Diwali 2× bonus", type: "Bonus", pts: 160, bal: 4316 },
  { date: "01-Jun-2026", ref: "Birthday reward", type: "Reward", pts: 200, bal: 4156 },
];

/** A button that opens the customer's loyalty details, history & redeem in a popup. */
export function LoyaltyRewardsButton({ billTotal, redeemedAmount, onRedeem, onClear, full }: {
  billTotal: number; redeemedAmount: number; onRedeem: (amount: number, points: number) => void; onClear: () => void; full?: boolean;
}) {
  const fmt = useFmt();
  const pointValue = Number(ly("pointValue")) || 0.25;
  const maxPct = Number(ly("maxRedeemPct")) || 20;
  const minRedeem = Number(ly("minRedeem")) || 100;
  const [open, setOpen] = useState(false);
  const [pts, setPts] = useState(0);
  const [asOn, setAsOn] = useState("");
  useEffect(() => { setAsOn(new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })); }, []);

  const maxByBill = Math.floor((billTotal * maxPct / 100) / pointValue);
  const maxPts = Math.max(0, Math.min(SNAP.points, maxByBill));
  const redeemValue = useMemo(() => Math.round((Number(pts) || 0) * pointValue), [pts, pointValue]);
  const canRedeem = pts >= minRedeem && pts <= maxPts && redeemedAmount === 0;

  function openModal() { setPts(Math.min(maxPts, SNAP.points)); setOpen(true); }
  function apply() { if (!canRedeem) return; onRedeem(redeemValue, pts); }

  return (
    <>
      <button type="button" onClick={openModal} className={cn("group inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition hover:border-accent hover:bg-accent/20", full && "w-full justify-between")}>
        <span className="inline-flex items-center gap-1.5"><Gift className="h-4 w-4" /> Loyalty &amp; Rewards</span>
        <span className="inline-flex items-center gap-1.5">
          <Badge tone="primary"><Crown className="mr-0.5 inline h-3 w-3" />{SNAP.tier}</Badge>
          <span className="rounded-full bg-surface px-2 py-0.5 text-2xs font-bold text-foreground">{SNAP.points.toLocaleString()} pts</span>
          {redeemedAmount > 0 && <span className="rounded-full bg-success/15 px-2 py-0.5 text-2xs font-bold text-success">−{fmt.money(redeemedAmount)}</span>}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center gap-2.5 border-b border-border bg-primary-subtle/40 px-5 py-3.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><Gift className="h-4 w-4" /></span>
              <div className="flex-1"><h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">Loyalty &amp; Rewards <Badge tone="primary">{SNAP.tier}</Badge></h3><p className="text-2xs text-muted">Balance as on {asOn || "today"}</p></div>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              {/* balances */}
              <div className="grid grid-cols-3 gap-3">
                <Stat icon={Coins} label="Points" value={SNAP.points.toLocaleString()} sub={`≈ ${fmt.money(Math.round(SNAP.points * pointValue))}`} />
                <Stat icon={Wallet} label="Wallet" value={fmt.money(SNAP.wallet)} sub="Loyalty" />
                <Stat icon={Coins} label="Cashback" value={fmt.money(SNAP.cashback)} sub="Available" />
              </div>

              {/* redeem */}
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-subtle">Redeem points</p>
                {redeemedAmount > 0 ? (
                  <div className="flex items-center justify-between rounded-lg bg-success-subtle px-3 py-2.5 text-sm font-semibold text-success"><span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Redeemed {fmt.money(redeemedAmount)}</span><button onClick={onClear} className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger"><X className="h-3.5 w-3.5" /> Remove</button></div>
                ) : maxPts < minRedeem ? (
                  <p className="text-2xs text-muted">Need at least {minRedeem} points to redeem (bill too small for the {maxPct}% cap).</p>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <input type="number" value={pts || ""} onChange={(e) => setPts(Math.max(0, Math.min(maxPts, Number(e.target.value))))} className="h-9 w-28 rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" />
                      <span className="text-2xs text-muted">of {maxPts.toLocaleString()} max</span>
                      <span className="ml-auto text-lg font-bold text-primary">{fmt.money(redeemValue)}</span>
                    </div>
                    <input type="range" min={0} max={maxPts} value={pts} onChange={(e) => setPts(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-primary)]" />
                    <div className="mt-2 flex items-center justify-between">
                      <p className="flex items-start gap-1.5 text-2xs text-muted"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> 1 pt = {fmt.money(pointValue)} · max {maxPct}% of bill · applied as discount.</p>
                      <Button size="md" onClick={apply} disabled={!canRedeem}><Check className="h-4 w-4" /> Apply</Button>
                    </div>
                  </>
                )}
              </div>

              {/* history */}
              <div>
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-subtle">Recent history</p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2 text-center">Type</th><th className="px-3 py-2 text-right">Points</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
                    <tbody>
                      {HISTORY.map((h, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-muted">{h.date}</td>
                          <td className="px-3 py-2 text-foreground">{h.ref}</td>
                          <td className="px-3 py-2 text-center"><Badge tone={h.type === "Redeemed" ? "warning" : "success"}>{h.type}</Badge></td>
                          <td className={cn("px-3 py-2 text-right font-semibold", h.pts < 0 ? "text-danger" : "text-success")}>{h.pts > 0 ? "+" : ""}{h.pts}</td>
                          <td className="px-3 py-2 text-right text-muted">{h.bal.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
              <Link href="/loyalty/profile" className="inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline">Full profile <ArrowRight className="h-3 w-3" /></Link>
              <Button size="md" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Coins; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon className="h-3.5 w-3.5" /></span><p className="text-sm font-bold text-foreground">{value}</p></div>
      <p className="mt-1 text-2xs font-medium text-muted">{label}</p>
      <p className="text-[10px] text-subtle">{sub}</p>
    </div>
  );
}
