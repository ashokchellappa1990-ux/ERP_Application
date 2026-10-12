import Link from "next/link";
import { Smartphone, Settings2, Coins, Gift, Share2, Bell, Wallet, Crown, Check } from "lucide-react";
import { loyaltyNotesFor } from "@/lib/loyalty/loyaltyData";

const APP = [
  { icon: Coins, label: "View Points" }, { icon: Gift, label: "Redeem Rewards" }, { icon: Wallet, label: "Track Wallet" },
  { icon: Share2, label: "Refer Friends" }, { icon: Bell, label: "Loyalty Notifications" }, { icon: Crown, label: "Membership Tier" },
];
const PORTAL = ["Points", "Rewards", "Wallet", "Gift Cards", "Referral Status", "Membership Tier"];

export default function MobileIntegrationPage() {
  const notes = loyaltyNotesFor("mobile-integration");
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/loyalty" className="hover:text-foreground">Loyalty</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Mobile &amp; Portal Integration</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Smartphone className="h-5 w-5 text-primary" /> Mobile &amp; Customer Portal</h1>
        <p className="mt-0.5 text-sm text-muted">What customers can see &amp; do in the mobile app and self-service portal.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Smartphone className="h-4 w-4 text-primary" /> Mobile App</h2>
          <div className="grid grid-cols-2 gap-3">{APP.map((a) => (<div key={a.label} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface p-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-subtle text-primary"><a.icon className="h-4 w-4" /></span><span className="text-sm font-medium text-foreground">{a.label}</span></div>))}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Customer Portal</h2>
          <div className="space-y-2">{PORTAL.map((p) => (<div key={p} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm font-medium text-foreground"><Check className="h-4 w-4 text-success" /> {p}</div>))}</div>
        </div>
      </div>
    </div>
  );
}
