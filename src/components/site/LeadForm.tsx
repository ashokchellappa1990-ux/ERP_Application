"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles, CalendarClock, Mail } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { id: "trial", label: "Start Free Trial", icon: Sparkles, blurb: "Get your workspace and login — no credit card." },
  { id: "demo", label: "Book a Demo", icon: CalendarClock, blurb: "See One ERP live with our team." },
  { id: "contact", label: "Contact Us", icon: Mail, blurb: "Questions? We'll get back to you." },
];
const inp = "h-11 w-full rounded-lg border border-border bg-card px-3.5 text-sm text-foreground outline-none transition focus:border-primary";

export function LeadForm({ defaultType = "trial", defaultPlan }: { defaultType?: string; defaultPlan?: string }) {
  const [type, setType] = useState(TABS.some((t) => t.id === defaultType) ? defaultType : "trial");
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", industry: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/website/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, type, plan: defaultPlan, source: "website/contact" }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setDone(j.message); else setErr(j.message || "Please check your details and try again.");
    } catch { setErr("Network error. Please try again."); } finally { setBusy(false); }
  }

  if (done) return (
    <div className="rounded-2xl border border-success/40 bg-success-subtle/40 p-8 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-success text-white"><CheckCircle2 className="h-6 w-6" /></div>
      <h3 className="text-lg font-bold text-foreground">You're all set!</h3>
      <p className="mt-1.5 text-sm text-muted">{done}</p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 grid grid-cols-3 gap-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setType(t.id)} className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition", type === t.id ? "border-primary bg-primary-subtle text-primary" : "border-border text-muted hover:border-primary/50")}>
            <t.icon className="h-5 w-5" /><span className="text-2xs font-semibold leading-tight">{t.label}</span>
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-muted">{TABS.find((t) => t.id === type)?.blurb}</p>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inp} placeholder="Full name *" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          <input className={inp} type="email" placeholder="Work email *" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          <input className={inp} placeholder="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          <input className={inp} placeholder="Company" value={form.company} onChange={(e) => set("company", e.target.value)} />
        </div>
        <input className={inp} placeholder="Industry (e.g. Pharmacy, Supermarket)" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
        {type === "contact" && <textarea className={cn(inp, "h-24 py-2.5")} placeholder="How can we help?" value={form.message} onChange={(e) => set("message", e.target.value)} />}
        {err && <p className="text-sm text-danger">{err}</p>}
        <button type="submit" disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <TabIcon type={type} />}
          {type === "trial" ? "Start my free trial" : type === "demo" ? "Book my demo" : "Send message"}
        </button>
        <p className="text-center text-2xs text-subtle">By submitting, you agree to be contacted about One ERP.</p>
      </form>
    </div>
  );
}

function TabIcon({ type }: { type: string }) {
  const T = TABS.find((t) => t.id === type)?.icon ?? Sparkles;
  return <T className="h-4 w-4" />;
}
