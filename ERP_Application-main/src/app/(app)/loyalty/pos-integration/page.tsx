import Link from "next/link";
import { ShoppingCart, Coins, Crown, Wallet, Ticket, Gift, Check, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";

const SHOWN = [
  { icon: Coins, label: "Customer Points", value: "4,200 pts" },
  { icon: Crown, label: "Membership Tier", value: "Platinum" },
  { icon: Wallet, label: "Wallet Balance", value: "₹4,200" },
  { icon: Ticket, label: "Available Coupons", value: "2" },
  { icon: Coins, label: "Available Cashback", value: "₹350" },
  { icon: Gift, label: "Gift Cards", value: "1 (₹400)" },
];
const ACTIONS = ["Redeem Points", "Redeem Wallet", "Apply Gift Card", "Apply Cashback"];

export default function PosIntegrationPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/loyalty" className="hover:text-foreground">Loyalty</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">POS Loyalty Integration</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ShoppingCart className="h-5 w-5 text-primary" /> POS Loyalty Integration</h1>
          <p className="mt-0.5 text-sm text-muted">What the cashier sees &amp; can do at billing — points earn &amp; redeem in real-time.</p>
        </div>
        <Link href="/sales/pos"><Button size="md"><ShoppingCart className="h-4 w-4" /> Open POS</Button></Link>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-subtle px-4 py-2.5 text-xs font-semibold text-success">
        <Zap className="h-4 w-4" /> No setup required — POS loyalty works automatically once the loyalty program is configured. This screen is a reference of what happens at billing.
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Displayed during billing</h2>
          <div className="grid grid-cols-2 gap-3">
            {SHOWN.map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface p-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-subtle text-primary"><s.icon className="h-4 w-4" /></span><div><p className="text-sm font-bold text-foreground">{s.value}</p><p className="text-2xs text-muted">{s.label}</p></div></div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Cashier actions</h2>
          <div className="space-y-2">{ACTIONS.map((a) => (<div key={a} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm font-medium text-foreground"><Check className="h-4 w-4 text-success" /> {a}</div>))}</div>
          <h2 className="mb-2 mt-4 text-sm font-semibold text-foreground">Auto at checkout</h2>
          <div className="flex flex-wrap gap-1.5">{["Auto point calc", "Auto cashback", "Auto wallet update", "Auto tier upgrade", "Auto reward trigger"].map((x) => <span key={x} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{x}</span>)}</div>
        </div>
      </div>
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">Integrated with POS Billing, Sales Order/Quotation &amp; B2B Invoice — points &amp; cashback post the moment a bill is saved. <Link href="/sales/pos" className="font-semibold hover:underline">Open POS <ArrowRight className="inline h-3 w-3" /></Link></p>
    </div>
  );
}
