"use client";

import { useCallback, useEffect, useState } from "react";
import { Rocket, CheckCircle2, RefreshCw, Receipt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { BILLING_CYCLES } from "@/lib/platform/contracts";

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none";
const fm = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const cycleKey: Record<string, string> = { Monthly: "monthlyPrice", Quarterly: "quarterlyPrice", HalfYearly: "halfYearlyPrice", Yearly: "yearlyPrice", Lifetime: "lifetimePrice" };

interface Plan { id: number; name: string; tier: string; monthlyPrice: number; quarterlyPrice: number; halfYearlyPrice: number; yearlyPrice: number; lifetimePrice: number; maxUsers: number; maxStorageMb: number; modules: Record<string, boolean> }
interface Data { tenant: { name: string; plan: string; status: string; trialEndsAt: string; expiresAt: string } | null; subscription: { id: number; plan: string; tier: string; status: string; billingCycle: string; endDate: string; amount: number } | null; plans: Plan[]; invoices: { id: number; invoiceNo: string; invoiceType: string; invoiceDate: string; total: number; status: string }[] }

export function SubscriptionBilling() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [cycle, setCycle] = useState("Yearly");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 3000); };
  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/subscription", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setD(j);
      else setErr(j.message || (r.status === 403 ? "You don't have permission to view Subscription & Billing." : r.status === 401 ? "Your session has expired — please sign in again." : "Couldn't load subscription details."));
    } catch { setErr("Couldn't reach the server. Please try again."); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function act(body: Record<string, unknown>) { setBusy(true); const j = await fetch("/api/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false })); setBusy(false); if (j.ok) { flash(j.message); load(); } else flash(j.message || "Action failed."); }
  if (err) return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mb-2 text-sm font-semibold text-danger">Unable to load</div>
      <p className="mb-4 text-sm text-muted">{err}</p>
      <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
    </div>
  );
  if (!d) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
  const price = (p: Plan) => Number((p as unknown as Record<string, number>)[cycleKey[cycle]] ?? 0);
  const onTrial = d.tenant?.plan === "trial" || !d.subscription;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Subscription &amp; Billing</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Rocket className="h-5 w-5 text-primary" /> Subscription &amp; Billing</h1>
      </div>

      {/* Current status */}
      <div className={cn("overflow-hidden rounded-2xl border shadow-sm", d.subscription ? "border-success/40" : "border-warning/40")}>
        <div className={cn("flex items-center justify-between px-5 py-3 text-white", d.subscription ? "bg-gradient-to-r from-primary to-accent" : "bg-gradient-to-r from-amber-500 to-orange-600")}>
          <span className="flex items-center gap-2 text-sm font-bold">{d.subscription ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} {d.subscription ? `${d.subscription.plan} · ${d.subscription.status}` : "Trial"}</span>
          <span className="text-2xs font-semibold">{d.subscription ? `${d.subscription.billingCycle} · renews ${d.subscription.endDate || "Lifetime"}` : d.tenant?.trialEndsAt ? `Trial ends ${d.tenant.trialEndsAt}` : ""}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-card p-4 text-sm">
          {d.subscription ? <><span className="text-muted">You're on the <b className="text-foreground">{d.subscription.plan}</b> plan at <b>{fm(d.subscription.amount)}</b> / {d.subscription.billingCycle.toLowerCase()}.</span><Button size="sm" variant="outline" onClick={() => act({ action: "renew" })} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /> Renew now</Button></> : <span className="text-muted">You're on a free trial. Choose a plan below to subscribe — your data, users and login stay exactly the same.</span>}
        </div>
      </div>

      {/* Plans */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{onTrial ? "Choose a plan" : "Change plan"}</h3>
          <select value={cycle} onChange={(e) => setCycle(e.target.value)} className={cn(inp, "w-40")}>{BILLING_CYCLES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.plans.map((p) => { const current = d.subscription?.plan === p.name; return (
            <div key={p.id} className={cn("rounded-xl border-2 p-4", current ? "border-primary bg-primary-subtle/20" : "border-border")}>
              <div className="flex items-center justify-between"><span className="font-bold text-foreground">{p.name}</span><span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-semibold text-muted">{p.tier}</span></div>
              <div className="mt-2 text-lg font-bold text-foreground">{price(p) > 0 ? fm(price(p)) : "—"}<span className="text-2xs font-normal text-muted"> / {cycle.toLowerCase()}</span></div>
              <div className="mt-1 text-2xs text-muted">Up to {p.maxUsers} users · {(p.maxStorageMb / 1024).toFixed(0)} GB</div>
              <div className="mt-2 flex flex-wrap gap-1">{Object.keys(p.modules || {}).filter((k) => p.modules[k]).slice(0, 5).map((k) => <span key={k} className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{k}</span>)}</div>
              <Button size="sm" className="mt-3 w-full" disabled={busy || current} onClick={() => act({ action: "subscribe", planId: p.id, billingCycle: cycle })}>{current ? "Current plan" : onTrial ? "Subscribe" : "Switch to this plan"}</Button>
            </div>
          ); })}
          {!d.plans.length && <div className="col-span-full py-8 text-center text-sm text-muted">No plans available yet. Please contact OASYS sales.</div>}
        </div>
        <p className="mt-2 text-2xs text-subtle">Your Tenant ID, business administrator, users and data are always preserved through subscription and renewal.</p>
      </div>

      {/* Invoices */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-surface-2 px-4 py-2.5 text-sm font-bold text-foreground"><Receipt className="mr-1.5 inline h-4 w-4 text-primary" /> Invoices</div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2">Invoice</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Date</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2">Status</th></tr></thead>
          <tbody>{d.invoices.map((i) => <tr key={i.id} className="border-b border-border last:border-0"><td className="px-4 py-2 font-mono text-2xs">{i.invoiceNo}</td><td className="px-4 py-2 text-2xs">{i.invoiceType}</td><td className="px-4 py-2 text-2xs text-muted">{i.invoiceDate}</td><td className="px-4 py-2 text-right tabular-nums">{fm(i.total)}</td><td className="px-4 py-2"><span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", i.status === "Paid" ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning")}>{i.status}</span></td></tr>)}{!d.invoices.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">No invoices yet.</td></tr>}</tbody>
        </table>
      </div>

      {msg && <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-primary/40 bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg">{msg}</div>}
    </div>
  );
}
