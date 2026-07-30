"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  LayoutDashboard, Building2, FlaskConical, RefreshCw, Boxes, KeyRound, Package, ToggleRight, Layers, Gauge, Receipt, CreditCard,
  LifeBuoy, Bell, ScrollText, FileText, Settings, LogOut, ShieldCheck, Download, Printer, Save, Plus, X, ChevronRight, Search, Globe, Sparkles,
} from "lucide-react";
import { downloadCsv, downloadExcel, printTable } from "@/lib/export/download";
import { useBrand } from "@/components/theme/ThemeProvider";
import { DEFAULT_PRODUCT_NAME } from "@/lib/brand";
import { WebsiteCms } from "@/components/platform/WebsiteCms";
import { AiPlatformConsole } from "@/components/platform/AiPlatformConsole";
import { PLAN_TIERS, BILLING_CYCLES, WORKSPACE_TYPES, CONVERSION_TYPES, MODULE_KEYS, TENANT_STATUS, PAYMENT_MODES, REPORT_TYPES, REPORT_LABELS, type ReportType } from "@/lib/platform/contracts";

const inp = "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-slate-500";
const btn = "inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50";
const btnO = "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-2xs font-semibold text-slate-700 transition hover:border-indigo-400";
const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";

/** Live product name from Website CMS identity (falls back to the central default). */
function useBrandName() { return useBrand().productName || DEFAULT_PRODUCT_NAME; }
const fm = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const api = (s: string) => `/api/platform/${s}`;
async function post(action: string, body: Record<string, unknown>) { return fetch(api("action"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) }).then((r) => r.json()).catch(() => ({ ok: false, message: "Network error." })); }

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" },
  { id: "tenants", label: "Tenant Management", icon: Building2, perm: "tenants" },
  { id: "trials", label: "Trial Management", icon: FlaskConical, perm: "tenants" },
  { id: "subscriptions", label: "Subscription Management", icon: RefreshCw, perm: "subscriptions" },
  { id: "workspaces", label: "Workspace Management", icon: Boxes, perm: "workspaces" },
  { id: "licenses", label: "License Management", icon: KeyRound, perm: "licenses" },
  { id: "plans", label: "Subscription Plans", icon: Package, perm: "plans" },
  { id: "trial-plans", label: "Trial Plans", icon: FlaskConical, perm: "trial-plans" },
  { id: "settings", label: "Product Configuration", icon: Settings, perm: "settings" },
  { id: "website", label: "Website CMS", icon: Globe, perm: "settings" },
  { id: "ai", label: "AI Platform", icon: Sparkles, perm: "settings" },
  { id: "features", label: "Feature Management", icon: ToggleRight, perm: "plans" },
  { id: "modules", label: "Module Management", icon: Layers, perm: "plans" },
  { id: "usage", label: "Usage Monitoring", icon: Gauge, perm: "usage" },
  { id: "billing", label: "Billing", icon: Receipt, perm: "billing" },
  { id: "payments", label: "Payments", icon: CreditCard, perm: "payments" },
  { id: "support", label: "Customer Support", icon: LifeBuoy, perm: "support" },
  { id: "notifications", label: "Notifications", icon: Bell, perm: "notifications" },
  { id: "audit", label: "Audit Logs", icon: ScrollText, perm: "audit" },
  { id: "reports", label: "Reports", icon: FileText, perm: "reports" },
  { id: "system", label: "System Settings", icon: Settings, perm: "settings" },
] as const;

interface Me { id: number; name: string; email: string; roleSlug: string; roleName: string; permissions: string[] }

export function PlatformPortal() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [section, setSection] = useState("dashboard");
  const [msg, setMsg] = useState("");
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 3200); };
  const loadMe = useCallback(async () => { const j = await fetch(api("auth/me"), { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); setMe(j.ok ? j.user : null); }, []);
  useEffect(() => { loadMe(); }, [loadMe]);
  if (me === undefined) return <div className="grid min-h-screen place-items-center bg-slate-100 text-slate-500">Loading…</div>;
  if (me === null) return <LoginView onDone={loadMe} />;
  const can = (p: string) => me.permissions.includes("*") || me.permissions.includes(p);
  const visible = SECTIONS.filter((s) => can(s.perm));
  const brandName = useBrandName();

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white"><ShieldCheck className="h-4.5 w-4.5" /></span><div><div className="text-sm font-bold text-white">{brandName}</div><div className="text-[10px] uppercase tracking-widest text-indigo-300">Platform Admin</div></div></div>
        <nav className="flex-1 overflow-y-auto py-2">{visible.map((s) => { const Icon = s.icon; return <button key={s.id} onClick={() => setSection(s.id)} className={cn("flex w-full items-center gap-2.5 px-4 py-2 text-2xs font-semibold transition", section === s.id ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white")}><Icon className="h-4 w-4 shrink-0" /> {s.label}</button>; })}</nav>
        <div className="border-t border-slate-800 px-4 py-3"><div className="mb-2 text-2xs"><div className="font-semibold text-white">{me.name}</div><div className="text-slate-500">{me.roleName}</div></div><button onClick={async () => { await fetch(api("auth/logout"), { method: "POST" }); loadMe(); }} className="inline-flex items-center gap-1.5 text-2xs font-semibold text-slate-400 hover:text-white"><LogOut className="h-3.5 w-3.5" /> Sign out</button></div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        {section === "dashboard" && <DashboardView />}
        {section === "tenants" && <TenantsView flash={flash} trialOnly={false} />}
        {section === "trials" && <TenantsView flash={flash} trialOnly />}
        {section === "subscriptions" && <SubscriptionsView flash={flash} />}
        {section === "workspaces" && <TenantPickerView flash={flash} kind="workspaces" />}
        {section === "licenses" && <TenantPickerView flash={flash} kind="license" />}
        {section === "plans" && <PlansView flash={flash} />}
        {(section === "features" || section === "modules") && <PlansView flash={flash} modulesOnly />}
        {section === "trial-plans" && <TrialPlansView flash={flash} />}
        {(section === "settings" || section === "system") && <SettingsView flash={flash} />}
        {section === "website" && <WebsiteCms flash={flash} />}
        {section === "ai" && <AiPlatformConsole flash={flash} />}
        {section === "usage" && <UsageView />}
        {section === "billing" && <BillingView flash={flash} />}
        {section === "payments" && <PaymentsView />}
        {section === "support" && <SupportView flash={flash} />}
        {section === "notifications" && <ListView title="Notifications" endpoint="notifications" cols={[["at", "When", "date"], ["tenantName", "Tenant"], ["event", "Event"], ["channel", "Channel"], ["recipient", "Recipient"], ["status", "Status"]]} />}
        {section === "audit" && <ListView title="Audit Logs" endpoint="audit" cols={[["at", "When", "date"], ["entityType", "Entity"], ["action", "Action"], ["byName", "By"], ["note", "Note"]]} />}
        {section === "reports" && <ReportsView />}
      </main>
      {msg && <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">{msg}</div>}
    </div>
  );
}

/* -------------------- login -------------------- */
function LoginView({ onDone }: { onDone: () => void }) {
  const brandName = useBrandName();
  const [email, setEmail] = useState("owner@oneerp.example"); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(""); const j = await fetch(api("auth/login"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, remember: true }) }).then((r) => r.json()).catch(() => ({ ok: false, message: "Network error." })); setBusy(false); if (j.ok) onDone(); else setErr(j.message || "Sign-in failed."); }
  return (
    <div className="grid min-h-screen place-items-center bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-600 text-white"><ShieldCheck className="h-5 w-5" /></span><div><div className="text-lg font-bold text-white">{brandName}</div><div className="text-[11px] uppercase tracking-widest text-indigo-300">Platform Administration</div></div></div>
        <label className="mb-1 block text-2xs font-semibold text-slate-400">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="mb-3 h-10 w-full rounded-md border border-slate-600 bg-slate-900 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none" />
        <label className="mb-1 block text-2xs font-semibold text-slate-400">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mb-4 h-10 w-full rounded-md border border-slate-600 bg-slate-900 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none" />
        {err && <p className="mb-3 text-2xs font-semibold text-rose-400">{err}</p>}
        <button type="submit" disabled={busy} className="h-10 w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
        <p className="mt-4 text-center text-[10px] text-slate-500">Separate portal for platform staff only.<br />First run seeds owner@oneerp.example / Platform@123</p>
      </form>
    </div>
  );
}

/* -------------------- shared bits -------------------- */
function Header({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) { return <div className="mb-4 flex items-center justify-between"><div><h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>{sub && <p className="text-2xs text-slate-500">{sub}</p>}</div>{action}</div>; }
function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) { return <div className={cn(card, "p-3")}><div className={cn("text-lg font-bold tabular-nums", tone || "text-slate-900")}>{value}</div><div className="text-2xs font-medium text-slate-500">{label}</div></div>; }
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) { return <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-700">{label}</span><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-indigo-600" /></label>; }

/* -------------------- dashboard -------------------- */
function DashboardView() {
  const brandName = useBrandName();
  const [d, setD] = useState<Record<string, number> & { growth?: { name: string; value: number }[] } | null>(null);
  useEffect(() => { fetch(api("dashboard"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setD(j.data); }); }, []);
  if (!d) return <div className="py-16 text-center text-sm text-slate-500">Loading…</div>;
  const g = d.growth ?? []; const maxG = Math.max(1, ...g.map((x) => x.value));
  return (
    <div className="space-y-4">
      <Header title="Platform Dashboard" sub={`${brandName} SaaS overview`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Total Tenants" value={d.totalTenants} /><Stat label="Trial Customers" value={d.trialCustomers} tone="text-amber-600" /><Stat label="Subscribed" value={d.subscribed} tone="text-emerald-600" />
        <Stat label="Active Licenses" value={d.activeLicenses} /><Stat label="Expired Licenses" value={d.expiredLicenses} tone="text-rose-600" /><Stat label="Invoices" value={d.invoices} />
        <Stat label="Revenue" value={fm(d.revenue)} tone="text-indigo-600" /><Stat label="MRR" value={fm(d.mrr)} tone="text-indigo-600" /><Stat label="ARR" value={fm(d.arr)} tone="text-indigo-600" />
        <Stat label="Conversion Rate" value={`${d.conversionRate}%`} /><Stat label="Renewal Rate" value={`${d.renewalRate}%`} /><Stat label="Upgrade Rate" value={`${d.upgradeRate}%`} />
      </div>
      <div className={cn(card, "p-4")}><h3 className="mb-2 text-sm font-bold text-slate-900">Customer Growth (last 6 months)</h3><div className="space-y-1.5">{g.map((x) => <div key={x.name} className="flex items-center gap-2 text-2xs"><span className="w-16 text-slate-500">{x.name}</span><div className="h-3 flex-1 rounded bg-slate-100"><div className="h-3 rounded bg-indigo-500" style={{ width: `${(x.value / maxG) * 100}%` }} /></div><span className="w-8 text-right font-semibold tabular-nums">{x.value}</span></div>)}{!g.length && <div className="py-4 text-center text-slate-400">No data.</div>}</div></div>
    </div>
  );
}

/* -------------------- tenants -------------------- */
interface TenantRow { id: number; name: string; businessAdminEmail: string; currentPlan: string; subscriptionStatus: string; platformStatus: string; trialEndsAt: string; createdAt: string; activeUsers: number }
function TenantsView({ flash, trialOnly }: { flash: (m: string) => void; trialOnly: boolean }) {
  const brandName = useBrandName();
  const [rows, setRows] = useState<TenantRow[]>([]); const [q, setQ] = useState(""); const [detail, setDetail] = useState<number | null>(null);
  const load = useCallback(async () => { const p = new URLSearchParams(); if (q) p.set("q", q); const j = await fetch(`${api("tenants")}?${p}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(trialOnly ? j.rows.filter((t: TenantRow) => t.subscriptionStatus === "Trial" || t.currentPlan === "Trial") : j.rows); }, [q, trialOnly]);
  useEffect(() => { load(); }, [load]);
  async function act(action: string, body: Record<string, unknown>) { const j = await post(action, body); if (j.ok) { flash(j.message); load(); } else flash(j.message || "Failed."); }
  const badge = (st: string) => cn("rounded-full px-2 py-0.5 text-2xs font-semibold", st === "Active" ? "bg-emerald-100 text-emerald-700" : st === "Suspended" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700");
  return (
    <div className="space-y-3">
      <Header title={trialOnly ? "Trial Management" : "Tenant Management"} sub={`Every ${brandName} customer`} />
      <div className="flex items-center gap-2"><div className="relative w-72"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business / admin…" className={cn(inp, "pl-8")} /></div><span className="ml-auto text-2xs text-slate-500">{rows.length} tenant(s)</span></div>
      <div className={cn(card, "overflow-hidden")}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500"><th className="px-3 py-2.5">ID</th><th className="px-3 py-2.5">Business</th><th className="px-3 py-2.5">Admin</th><th className="px-3 py-2.5">Plan</th><th className="px-3 py-2.5">Subscription</th><th className="px-3 py-2.5 text-center">Users</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-2xs text-slate-500">{t.id}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{t.name}</td>
                <td className="px-3 py-2 text-2xs text-slate-500">{t.businessAdminEmail || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{t.currentPlan}</td>
                <td className="px-3 py-2 text-2xs">{t.subscriptionStatus}{t.trialEndsAt ? ` · ends ${t.trialEndsAt}` : ""}</td>
                <td className="px-3 py-2 text-center tabular-nums">{t.activeUsers}</td>
                <td className="px-3 py-2"><span className={badge(t.platformStatus)}>{t.platformStatus}</span></td>
                <td className="px-3 py-2 text-right"><button onClick={() => setDetail(t.id)} className={btnO}>Manage <ChevronRight className="h-3 w-3" /></button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">No tenants.</td></tr>}
          </tbody>
        </table>
      </div>
      {detail && <TenantDrawer tenantId={detail} onClose={() => { setDetail(null); load(); }} flash={flash} onAction={act} />}
    </div>
  );
}

interface TenantDetail { id: number; name: string; plan: string; platformStatus: string; businessAdminEmail: string; trialEndsAt: string; subscription: { id: number; plan: string; status: string; billingCycle: string; endDate: string; amount: number } | null; workspaces: { id: number; code: string; name: string; type: string; status: string; isProduction: boolean }[]; usage: { activeUsers: number; products: number; transactions: number } }
function TenantDrawer({ tenantId, onClose, flash, onAction }: { tenantId: number; onClose: () => void; flash: (m: string) => void; onAction: (a: string, b: Record<string, unknown>) => void }) {
  const [d, setD] = useState<TenantDetail | null>(null);
  const [plans, setPlans] = useState<{ id: number; name: string }[]>([]);
  const [tab, setTab] = useState<"overview" | "subscription" | "workspaces" | "license">("overview");
  const [convType, setConvType] = useState("ContinueTrial"); const [planId, setPlanId] = useState(""); const [cycle, setCycle] = useState("Yearly");
  const load = useCallback(async () => { const j = await fetch(`${api("tenant")}?tenantId=${tenantId}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setD(j.data); }, [tenantId]);
  useEffect(() => { load(); fetch(api("plans"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setPlans(j.rows); }); }, [load]);
  async function run(action: string, body: Record<string, unknown>) { const j = await post(action, body); if (j.ok) { flash(j.message); load(); } else flash(j.message || "Failed."); }
  if (!d) return null;
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5"><div><h2 className="text-sm font-bold text-slate-900">{d.name} <span className="font-mono text-2xs text-slate-400">#{d.id}</span></h2><p className="text-2xs text-slate-500">{d.businessAdminEmail || "no admin email"} · {d.platformStatus}</p></div><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button></div>
        <div className="flex gap-1 border-b border-slate-200 px-4">{(["overview", "subscription", "workspaces", "license"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn("border-b-2 px-3 py-2 text-2xs font-semibold capitalize", tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500")}>{t}</button>)}</div>
        <div className="space-y-4 p-5 text-sm">
          {tab === "overview" && <>
            <div className="grid grid-cols-3 gap-2"><Stat label="Users" value={d.usage.activeUsers} /><Stat label="Products" value={d.usage.products} /><Stat label="Transactions" value={d.usage.transactions} /></div>
            <div><h4 className="mb-1.5 text-2xs font-bold uppercase text-slate-400">Tenant Status</h4><div className="flex flex-wrap gap-1.5">{TENANT_STATUS.map((s) => <button key={s} onClick={() => onAction("setTenantStatus", { tenantId: d.id, status: s })} className={cn(btnO, d.platformStatus === s && "border-indigo-500 bg-indigo-50 text-indigo-600")}>{s}</button>)}</div><p className="mt-1 text-[10px] text-slate-400">Tenant ID &amp; Business Administrator never change across the lifecycle.</p></div>
            <div><h4 className="mb-1.5 text-2xs font-bold uppercase text-slate-400">Trial</h4><div className="flex items-center gap-2"><span className="text-2xs text-slate-500">Ends {d.trialEndsAt || "—"}</span><button onClick={() => { const days = prompt("Extend trial by days:", "15"); if (days) run("extendTrial", { tenantId: d.id, days: Number(days) }); }} className={btnO}>Extend Trial</button></div></div>
          </>}
          {tab === "subscription" && <>
            {d.subscription ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><div className="font-bold text-emerald-700">{d.subscription.plan} · {d.subscription.status}</div><div className="text-2xs text-slate-600">{d.subscription.billingCycle} · {fm(d.subscription.amount)} · ends {d.subscription.endDate || "Lifetime"}</div><div className="mt-2 flex flex-wrap gap-1.5"><button onClick={() => run("renew", { subscriptionId: d.subscription!.id })} className={btnO}>Renew</button><button onClick={() => { const p = prompt("Upgrade to plan id:"); if (p) run("changePlan", { subscriptionId: d.subscription!.id, planId: Number(p), action: "Upgrade" }); }} className={btnO}>Upgrade</button><button onClick={() => run("lifecycle", { subscriptionId: d.subscription!.id, lifecycleAction: "Suspended" })} className={btnO}>Suspend</button><button onClick={() => run("lifecycle", { subscriptionId: d.subscription!.id, lifecycleAction: "Cancelled" })} className={btnO}>Cancel</button></div></div> : <p className="text-2xs text-slate-500">No active subscription — activate or convert below.</p>}
            <div className="rounded-lg border border-slate-200 p-3">
              <h4 className="mb-2 text-2xs font-bold uppercase text-slate-400">Trial → Subscription Conversion</h4>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Conversion Type</label><select value={convType} onChange={(e) => setConvType(e.target.value)} className={inp}>{CONVERSION_TYPES.map((c) => <option key={c} value={c}>{c === "ContinueTrial" ? "1 · Continue with Trial Data" : c === "StartFresh" ? "2 · Start Fresh (keep masters)" : "3 · Archive Trial + Fresh Production"}</option>)}</select></div>
                <div><label className={lbl}>Plan</label><select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inp}><option value="">Select…</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label className={lbl}>Billing Cycle</label><select value={cycle} onChange={(e) => setCycle(e.target.value)} className={inp}>{BILLING_CYCLES.map((c) => <option key={c}>{c}</option>)}</select></div>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">Trial data is archived read-only (never deleted). Tenant ID, login &amp; users are preserved.</p>
              <button onClick={() => { if (!planId) { flash("Select a plan."); return; } run("convert", { tenantId: d.id, conversionType: convType, planId: Number(planId), billingCycle: cycle }); }} className={cn(btn, "mt-2")}>Convert &amp; Activate</button>
            </div>
          </>}
          {tab === "workspaces" && <>
            <div className="flex items-center justify-between"><h4 className="text-2xs font-bold uppercase text-slate-400">Workspaces</h4><button onClick={() => { const n = prompt("Workspace name:"); const ty = prompt("Type (Production/Sandbox/Testing/Training/Demo):", "Sandbox"); if (n && ty) run("createWorkspace", { tenantId: d.id, name: n, type: ty }); }} className={btnO}><Plus className="h-3 w-3" /> New</button></div>
            <div className="space-y-1.5">{d.workspaces.map((w) => <div key={w.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"><span className="text-2xs"><b>{w.name}</b> · {w.type} · <span className={w.status === "Active" ? "text-emerald-600" : w.status === "Archived" ? "text-rose-600" : "text-amber-600"}>{w.status}</span>{w.isProduction ? " · PROD" : ""}</span><div className="flex gap-1">{w.status === "Active" && <button onClick={() => run("archiveWorkspace", { workspaceId: w.id, reason: "Manual archive" })} className={btnO}>Archive</button>}{w.status !== "Active" && <button onClick={() => run("restoreWorkspace", { workspaceId: w.id })} className={btnO}>Restore</button>}</div></div>)}{!d.workspaces.length && <p className="text-2xs text-slate-400">No workspaces.</p>}</div>
            <p className="text-[10px] text-slate-400">Archived workspaces are read-only &amp; restorable. Only one Production workspace should be active.</p>
          </>}
          {tab === "license" && <LicenseForm tenantId={d.id} flash={flash} />}
        </div>
      </div>
    </div>
  );
}
function LicenseForm({ tenantId, flash }: { tenantId: number; flash: (m: string) => void }) {
  const [l, setL] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { fetch(`${api("license")}?tenantId=${tenantId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setL(j.data); }); }, [tenantId]);
  if (!l) return <div className="py-6 text-center text-2xs text-slate-400">Loading…</div>;
  const set = (k: string, v: unknown) => setL({ ...l, [k]: v });
  const numFields: [string, string][] = [["maxUsers", "Max Users"], ["maxCompanies", "Max Companies"], ["maxBranches", "Max Branches"], ["maxWarehouses", "Max Warehouses"], ["maxProducts", "Max Products"], ["maxCustomers", "Max Customers"], ["maxSuppliers", "Max Suppliers"], ["maxStorageMb", "Max Storage (MB)"], ["maxApiCalls", "Max API Calls"], ["maxAiCredits", "Max AI Credits"], ["maxTransactions", "Max Transactions"]];
  const modFields: [string, string][] = [["aiEnabled", "AI"], ["analyticsEnabled", "Analytics"], ["manufacturingEnabled", "Manufacturing"], ["financeEnabled", "Finance"], ["crmEnabled", "CRM"], ["hrmsEnabled", "HRMS"], ["loyaltyEnabled", "Loyalty"], ["membershipEnabled", "Membership"], ["couponEnabled", "Coupon"], ["promoEnabled", "Promo Code"], ["giftVoucherEnabled", "Gift Voucher"]];
  async function save() { const j = await post("saveLicense", { tenantId, ...Object.fromEntries(numFields.map(([k]) => [k, Number(l![k]) || 0])), ...Object.fromEntries(modFields.map(([k]) => [k, !!l![k]])) }); if (j.ok) flash("License saved."); else flash(j.message || "Failed."); }
  return (
    <div className="space-y-3">
      <h4 className="text-2xs font-bold uppercase text-slate-400">Limits</h4>
      <div className="grid grid-cols-3 gap-2">{numFields.map(([k, lb]) => <div key={k}><label className={lbl}>{lb}</label><input type="number" value={String(l[k] ?? 0)} onChange={(e) => set(k, Number(e.target.value))} className={inp} /></div>)}</div>
      <h4 className="text-2xs font-bold uppercase text-slate-400">Module Entitlements</h4>
      <div className="grid grid-cols-2 gap-2">{modFields.map(([k, lb]) => <Toggle key={k} label={lb} on={!!l[k]} set={(v) => set(k, v)} />)}</div>
      <button onClick={save} className={btn}><Save className="h-4 w-4" /> Save License</button>
    </div>
  );
}

/* -------------------- subscriptions -------------------- */
function SubscriptionsView({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]); const [status, setStatus] = useState("All");
  const load = useCallback(async () => { const j = await fetch(`${api("subscriptions")}?status=${status}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, [status]);
  useEffect(() => { load(); }, [load]);
  async function act(action: string, body: Record<string, unknown>) { const j = await post(action, body); if (j.ok) { flash(j.message); load(); } else flash(j.message || "Failed."); }
  return (
    <div className="space-y-3">
      <Header title="Subscription Management" />
      <div className="flex items-center gap-2"><select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inp, "w-40")}>{["All", "Active", "Suspended", "Cancelled", "Expired"].map((x) => <option key={x}>{x}</option>)}</select><span className="ml-auto text-2xs text-slate-500">{rows.length}</span></div>
      <div className={cn(card, "overflow-hidden")}>
        <table className="w-full text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500"><th className="px-3 py-2.5">Tenant</th><th className="px-3 py-2.5">Plan</th><th className="px-3 py-2.5">Cycle</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5">Start</th><th className="px-3 py-2.5">End</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody>{rows.map((s) => <tr key={String(s.id)} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2 font-medium text-slate-900">{String(s.tenantName)}</td><td className="px-3 py-2">{String(s.plan)}</td><td className="px-3 py-2 text-2xs">{String(s.billingCycle)}</td><td className="px-3 py-2 text-right tabular-nums">{fm(Number(s.amount))}</td><td className="px-3 py-2 text-2xs text-slate-500">{String(s.startDate)}</td><td className="px-3 py-2 text-2xs text-slate-500">{String(s.endDate) || "—"}</td><td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", s.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>{String(s.status)}</span></td><td className="px-3 py-2 text-right"><div className="flex justify-end gap-1"><button onClick={() => act("renew", { subscriptionId: s.id })} className={btnO}>Renew</button>{s.status === "Active" ? <button onClick={() => act("lifecycle", { subscriptionId: s.id, lifecycleAction: "Suspended" })} className={btnO}>Suspend</button> : <button onClick={() => act("lifecycle", { subscriptionId: s.id, lifecycleAction: "Reactivated" })} className={btnO}>Reactivate</button>}</div></td></tr>)}{!rows.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">No subscriptions.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------- plans -------------------- */
const EMPTY_PLAN = { code: "", name: "", tier: "Standard", monthlyPrice: 0, quarterlyPrice: 0, halfYearlyPrice: 0, yearlyPrice: 0, lifetimePrice: 0, maxUsers: 5, maxProducts: 1000, maxStorageMb: 1024, active: true, modules: {} as Record<string, boolean> };
function PlansView({ flash, modulesOnly }: { flash: (m: string) => void; modulesOnly?: boolean }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]); const [edit, setEdit] = useState<(typeof EMPTY_PLAN & { id?: number }) | null>(null);
  const load = useCallback(async () => { const j = await fetch(api("plans"), { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, []);
  useEffect(() => { load(); }, [load]);
  async function save() { if (!edit) return; const j = await post("savePlan", edit); if (j.ok) { flash("Plan saved."); setEdit(null); load(); } else flash(j.message || "Failed."); }
  return (
    <div className="space-y-3">
      <Header title={modulesOnly ? "Feature / Module Management" : "Subscription Plans"} action={<button onClick={() => setEdit({ ...EMPTY_PLAN })} className={btn}><Plus className="h-4 w-4" /> New Plan</button>} />
      <div className={cn(card, "overflow-hidden")}>
        <table className="w-full text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500"><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Tier</th><th className="px-3 py-2.5 text-right">Monthly</th><th className="px-3 py-2.5 text-right">Yearly</th><th className="px-3 py-2.5 text-center">Users</th><th className="px-3 py-2.5">Modules</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody>{rows.map((p) => { const mods = p.modules as Record<string, boolean>; return <tr key={String(p.id)} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2 font-mono text-2xs">{String(p.code)}</td><td className="px-3 py-2 font-medium text-slate-900">{String(p.name)}</td><td className="px-3 py-2 text-2xs">{String(p.tier)}</td><td className="px-3 py-2 text-right tabular-nums">{fm(Number(p.monthlyPrice))}</td><td className="px-3 py-2 text-right tabular-nums">{fm(Number(p.yearlyPrice))}</td><td className="px-3 py-2 text-center tabular-nums">{String(p.maxUsers)}</td><td className="px-3 py-2 text-2xs text-slate-500">{MODULE_KEYS.filter((k) => mods?.[k]).length} on</td><td className="px-3 py-2 text-right"><button onClick={() => setEdit({ ...EMPTY_PLAN, ...(p as object), modules: mods } as never)} className={btnO}>Edit</button></td></tr>; })}{!rows.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">No plans yet.</td></tr>}</tbody>
        </table>
      </div>
      {edit && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => setEdit(null)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5"><h2 className="text-sm font-bold">{edit.id ? "Edit Plan" : "New Plan"}</h2><button onClick={() => setEdit(null)}><X className="h-4 w-4 text-slate-400" /></button></div>
            <div className="space-y-3 p-5">
              {!modulesOnly && <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Code *</label><input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} className={inp} /></div>
                <div><label className={lbl}>Name *</label><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inp} /></div>
                <div><label className={lbl}>Tier</label><select value={edit.tier} onChange={(e) => setEdit({ ...edit, tier: e.target.value })} className={inp}>{PLAN_TIERS.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div><label className={lbl}>Max Users</label><input type="number" value={edit.maxUsers} onChange={(e) => setEdit({ ...edit, maxUsers: Number(e.target.value) })} className={inp} /></div>
                <div><label className={lbl}>Monthly ₹</label><input type="number" value={edit.monthlyPrice} onChange={(e) => setEdit({ ...edit, monthlyPrice: Number(e.target.value) })} className={inp} /></div>
                <div><label className={lbl}>Quarterly ₹</label><input type="number" value={edit.quarterlyPrice} onChange={(e) => setEdit({ ...edit, quarterlyPrice: Number(e.target.value) })} className={inp} /></div>
                <div><label className={lbl}>Half-Yearly ₹</label><input type="number" value={edit.halfYearlyPrice} onChange={(e) => setEdit({ ...edit, halfYearlyPrice: Number(e.target.value) })} className={inp} /></div>
                <div><label className={lbl}>Yearly ₹</label><input type="number" value={edit.yearlyPrice} onChange={(e) => setEdit({ ...edit, yearlyPrice: Number(e.target.value) })} className={inp} /></div>
                <div><label className={lbl}>Lifetime ₹</label><input type="number" value={edit.lifetimePrice} onChange={(e) => setEdit({ ...edit, lifetimePrice: Number(e.target.value) })} className={inp} /></div>
                <div><label className={lbl}>Max Storage (MB)</label><input type="number" value={edit.maxStorageMb} onChange={(e) => setEdit({ ...edit, maxStorageMb: Number(e.target.value) })} className={inp} /></div>
              </div>}
              <div><h4 className="mb-2 text-2xs font-bold uppercase text-slate-400">Enabled Modules</h4><div className="grid grid-cols-3 gap-2">{MODULE_KEYS.map((k) => <Toggle key={k} label={k} on={!!edit.modules[k]} set={(v) => setEdit({ ...edit, modules: { ...edit.modules, [k]: v } })} />)}</div></div>
              <div className="flex justify-end gap-2"><button onClick={() => setEdit(null)} className={btnO}>Cancel</button><button onClick={save} className={btn}><Save className="h-4 w-4" /> Save</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- trial plans -------------------- */
const EMPTY_TRIAL = { name: "", durationDays: 15, maxUsers: 3, maxProducts: 500, maxStorageMb: 512, active: true, modules: {} as Record<string, boolean> };
function TrialPlansView({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]); const [edit, setEdit] = useState<(typeof EMPTY_TRIAL & { id?: number }) | null>(null);
  const load = useCallback(async () => { const j = await fetch(api("trial-plans"), { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, []);
  useEffect(() => { load(); }, [load]);
  async function save() { if (!edit) return; const j = await post("saveTrialConfig", edit); if (j.ok) { flash("Trial plan saved."); setEdit(null); load(); } else flash(j.message || "Failed."); }
  return (
    <div className="space-y-3">
      <Header title="Trial Plans" action={<button onClick={() => setEdit({ ...EMPTY_TRIAL })} className={btn}><Plus className="h-4 w-4" /> New Trial Plan</button>} />
      <div className={cn(card, "overflow-hidden")}>
        <table className="w-full text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500"><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5 text-center">Duration</th><th className="px-3 py-2.5 text-center">Max Users</th><th className="px-3 py-2.5 text-center">Max Products</th><th className="px-3 py-2.5">Active</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody>{rows.map((t) => <tr key={String(t.id)} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2 font-medium text-slate-900">{String(t.name)}</td><td className="px-3 py-2 text-center">{String(t.durationDays)} days</td><td className="px-3 py-2 text-center">{String(t.maxUsers)}</td><td className="px-3 py-2 text-center">{String(t.maxProducts)}</td><td className="px-3 py-2">{t.active ? "Yes" : "No"}</td><td className="px-3 py-2 text-right"><button onClick={() => setEdit({ ...EMPTY_TRIAL, ...(t as object) } as never)} className={btnO}>Edit</button></td></tr>)}{!rows.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">No trial plans.</td></tr>}</tbody>
        </table>
      </div>
      {edit && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5"><h2 className="text-sm font-bold">{edit.id ? "Edit" : "New"} Trial Plan</h2><button onClick={() => setEdit(null)}><X className="h-4 w-4 text-slate-400" /></button></div>
            <div className="space-y-3 p-5"><div className="grid grid-cols-2 gap-3"><div><label className={lbl}>Name *</label><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inp} /></div><div><label className={lbl}>Duration (days)</label><input type="number" value={edit.durationDays} onChange={(e) => setEdit({ ...edit, durationDays: Number(e.target.value) })} className={inp} /></div><div><label className={lbl}>Max Users</label><input type="number" value={edit.maxUsers} onChange={(e) => setEdit({ ...edit, maxUsers: Number(e.target.value) })} className={inp} /></div><div><label className={lbl}>Max Products</label><input type="number" value={edit.maxProducts} onChange={(e) => setEdit({ ...edit, maxProducts: Number(e.target.value) })} className={inp} /></div><div><label className={lbl}>Max Storage (MB)</label><input type="number" value={edit.maxStorageMb} onChange={(e) => setEdit({ ...edit, maxStorageMb: Number(e.target.value) })} className={inp} /></div></div><div className="flex justify-end gap-2"><button onClick={() => setEdit(null)} className={btnO}>Cancel</button><button onClick={save} className={btn}><Save className="h-4 w-4" /> Save</button></div></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- tenant-picker (workspaces / license) -------------------- */
function TenantPickerView({ flash, kind }: { flash: (m: string) => void; kind: "workspaces" | "license" }) {
  const [tenants, setTenants] = useState<{ id: number; name: string }[]>([]); const [tid, setTid] = useState("");
  useEffect(() => { fetch(api("tenants"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setTenants(j.rows); }); }, []);
  return (
    <div className="space-y-3">
      <Header title={kind === "workspaces" ? "Workspace Management" : "License Management"} />
      <div className="flex items-center gap-2"><label className={cn(lbl, "mb-0")}>Tenant:</label><select value={tid} onChange={(e) => setTid(e.target.value)} className={cn(inp, "w-72")}><option value="">Select a tenant…</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      {tid ? (kind === "license" ? <div className={cn(card, "p-4")}><LicenseForm tenantId={Number(tid)} flash={flash} /></div> : <WorkspacesInline tenantId={Number(tid)} flash={flash} />) : <div className={cn(card, "py-16 text-center text-sm text-slate-400")}>Select a tenant to continue.</div>}
    </div>
  );
}
function WorkspacesInline({ tenantId, flash }: { tenantId: number; flash: (m: string) => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const load = useCallback(async () => { const j = await fetch(`${api("workspaces")}?tenantId=${tenantId}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, [tenantId]);
  useEffect(() => { load(); }, [load]);
  async function act(a: string, b: Record<string, unknown>) { const j = await post(a, b); if (j.ok) { flash(j.message); load(); } else flash(j.message || "Failed."); }
  return (
    <div className={cn(card, "p-4")}>
      <div className="mb-2 flex justify-end"><button onClick={() => { const n = prompt("Workspace name:"); const ty = prompt("Type:", "Sandbox"); if (n && ty) act("createWorkspace", { tenantId, name: n, type: ty }); }} className={btnO}><Plus className="h-3 w-3" /> New Workspace</button></div>
      <div className="space-y-1.5">{rows.map((w) => <div key={String(w.id)} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-2xs"><span><b>{String(w.name)}</b> · {String(w.type)} · <span className={w.status === "Active" ? "text-emerald-600" : "text-rose-600"}>{String(w.status)}</span></span><div className="flex gap-1">{w.status === "Active" ? <button onClick={() => act("archiveWorkspace", { workspaceId: w.id })} className={btnO}>Archive</button> : <button onClick={() => act("restoreWorkspace", { workspaceId: w.id })} className={btnO}>Restore</button>}</div></div>)}{!rows.length && <p className="py-6 text-center text-slate-400">No workspaces.</p>}</div>
    </div>
  );
}

/* -------------------- usage / billing / payments / support / settings -------------------- */
function UsageView() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => { fetch(api("usage"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setRows(j.rows); }); }, []);
  return <div className="space-y-3"><Header title="Usage Monitoring" /><div className={cn(card, "overflow-hidden")}><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500"><th className="px-3 py-2.5">Tenant</th><th className="px-3 py-2.5 text-right">Users</th><th className="px-3 py-2.5 text-right">Products</th><th className="px-3 py-2.5 text-right">Transactions</th><th className="px-3 py-2.5 text-right">Storage MB</th><th className="px-3 py-2.5 text-right">API Usage</th></tr></thead><tbody>{rows.map((u, i) => <tr key={i} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2 font-medium text-slate-900">{String(u.tenantName)}</td><td className="px-3 py-2 text-right tabular-nums">{String(u.userCount)}</td><td className="px-3 py-2 text-right tabular-nums">{String(u.products)}</td><td className="px-3 py-2 text-right tabular-nums">{String(u.transactions)}</td><td className="px-3 py-2 text-right tabular-nums">{String(u.storageMb)}</td><td className="px-3 py-2 text-right tabular-nums">{String(u.apiUsage)}</td></tr>)}</tbody></table></div></div>;
}
function BillingView({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const load = useCallback(async () => { const j = await fetch(api("invoices"), { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, []);
  useEffect(() => { load(); }, [load]);
  async function pay(id: number, total: number) { const j = await post("recordPayment", { invoiceId: id, amount: total, mode: "Bank" }); if (j.ok) { flash(j.message); load(); } else flash(j.message || "Failed."); }
  return <div className="space-y-3"><Header title="Billing" sub="Subscription invoices, renewals, credit/debit notes" /><div className={cn(card, "overflow-hidden")}><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500"><th className="px-3 py-2.5">Invoice</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Tenant</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5 text-right">Total</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr></thead><tbody>{rows.map((i) => <tr key={String(i.id)} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2 font-mono text-2xs">{String(i.invoiceNo)}</td><td className="px-3 py-2 text-2xs">{String(i.invoiceType)}</td><td className="px-3 py-2">{String(i.tenantName)}</td><td className="px-3 py-2 text-2xs text-slate-500">{String(i.invoiceDate)}</td><td className="px-3 py-2 text-right tabular-nums">{fm(Number(i.total))}</td><td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", i.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{String(i.status)}</span></td><td className="px-3 py-2 text-right">{i.status !== "Paid" && <button onClick={() => pay(Number(i.id), Number(i.total))} className={btnO}>Record Payment</button>}</td></tr>)}{!rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">No invoices.</td></tr>}</tbody></table></div></div>;
}
function PaymentsView() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => { fetch(api("payments"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setRows(j.rows); }); }, []);
  return <div className="space-y-3"><Header title="Payments" /><div className={cn(card, "overflow-hidden")}><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500"><th className="px-3 py-2.5">Payment</th><th className="px-3 py-2.5">Invoice</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Mode</th><th className="px-3 py-2.5">Reference</th><th className="px-3 py-2.5 text-right">Amount</th></tr></thead><tbody>{rows.map((p) => <tr key={String(p.id)} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2 font-mono text-2xs">{String(p.paymentNo)}</td><td className="px-3 py-2 font-mono text-2xs">{String(p.invoiceNo)}</td><td className="px-3 py-2 text-2xs text-slate-500">{String(p.paymentDate)}</td><td className="px-3 py-2">{String(p.mode)}</td><td className="px-3 py-2 text-2xs">{String(p.reference)}</td><td className="px-3 py-2 text-right tabular-nums">{fm(Number(p.amount))}</td></tr>)}{!rows.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">No payments.</td></tr>}</tbody></table></div></div>;
}
function SupportView({ flash }: { flash: (m: string) => void }) {
  const [email, setEmail] = useState(""); const [tid, setTid] = useState(""); const [tenants, setTenants] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => { fetch(api("tenants"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setTenants(j.rows); }); }, []);
  async function run(a: string, b: Record<string, unknown>) { const j = await post(a, b); flash(j.ok ? j.message : (j.message || "Failed.")); }
  return (
    <div className="space-y-4">
      <Header title="Customer Support" sub="Password reset, unlock, extend trial, restore, sandbox" />
      <div className={cn(card, "space-y-3 p-4")}>
        <h4 className="text-2xs font-bold uppercase text-slate-400">User</h4>
        <div className="flex gap-2"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user email" className={inp} /><button onClick={() => run("resetPassword", { email })} className={btnO}>Reset Password</button><button onClick={() => run("unlockUser", { email })} className={btnO}>Unlock User</button></div>
      </div>
      <div className={cn(card, "space-y-3 p-4")}>
        <h4 className="text-2xs font-bold uppercase text-slate-400">Tenant</h4>
        <select value={tid} onChange={(e) => setTid(e.target.value)} className={cn(inp, "w-72")}><option value="">Select tenant…</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <div className="flex flex-wrap gap-2"><button disabled={!tid} onClick={() => { const d = prompt("Extend trial days:", "15"); if (d) run("extendTrial", { tenantId: Number(tid), days: Number(d) }); }} className={btnO}>Extend Trial</button><button disabled={!tid} onClick={() => run("activateLicense", { tenantId: Number(tid) })} className={btnO}>Activate License</button><button disabled={!tid} onClick={() => run("createSandbox", { tenantId: Number(tid) })} className={btnO}>Create Sandbox</button></div>
      </div>
    </div>
  );
}
function SettingsView({ flash }: { flash: (m: string) => void }) {
  const [c, setC] = useState<Record<string, unknown> | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(api("settings"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setC(j.config); }); }, []);
  if (!c) return <div className="py-16 text-center text-sm text-slate-500">Loading…</div>;
  const set = (k: string, v: unknown) => setC({ ...c, [k]: v });
  const fields: [string, string][] = [["productName", "Product Name"], ["theme", "Theme"], ["defaultLanguage", "Default Language"], ["defaultCurrency", "Default Currency"], ["timezone", "Timezone"], ["emailProvider", "Email Provider"], ["smsProvider", "SMS Provider"], ["whatsappProvider", "WhatsApp Provider"], ["paymentGateway", "Payment Gateway"], ["aiProvider", "AI Provider"], ["licensePolicy", "License Policy"]];
  async function save() { setBusy(true); const j = await post("saveSettings", { config: c }); setBusy(false); if (j.ok) { setC(j.config); flash("Settings saved."); } else flash(j.message || "Failed."); }
  return <div className="space-y-3"><Header title="Product &amp; System Configuration" /><div className={cn(card, "p-4")}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([k, l]) => <div key={k}><label className={lbl}>{l}</label><input value={String(c[k] ?? "")} onChange={(e) => set(k, e.target.value)} className={inp} /></div>)}</div></div><div className={cn(card, "p-4")}><h4 className="mb-2 text-2xs font-bold uppercase text-slate-400">Customer App</h4><Toggle label="Show trial status on customer dashboard" on={!!c.showTrialBanner} set={(v) => set("showTrialBanner", v)} /></div><div className="flex justify-end"><button onClick={save} disabled={busy} className={btn}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Configuration"}</button></div></div>;
}

/* -------------------- generic list + reports -------------------- */
function ListView({ title, endpoint, cols }: { title: string; endpoint: string; cols: [string, string, ("date")?][] }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => { fetch(api(endpoint), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setRows(j.rows); }); }, [endpoint]);
  return <div className="space-y-3"><Header title={title} /><div className={cn(card, "overflow-hidden")}><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500">{cols.map(([, l]) => <th key={l} className="px-3 py-2.5">{l}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-b border-slate-100 last:border-0">{cols.map(([k, , fmt]) => <td key={k} className="px-3 py-2 text-2xs text-slate-700">{fmt === "date" ? new Date(String(r[k])).toLocaleString() : String(r[k] ?? "")}</td>)}</tr>)}{!rows.length && <tr><td colSpan={cols.length} className="px-4 py-12 text-center text-sm text-slate-400">No entries.</td></tr>}</tbody></table></div></div>;
}
function ReportsView() {
  const [type, setType] = useState<ReportType>("tenants"); const [data, setData] = useState<{ title: string; columns: string[]; rows: (string | number)[][] } | null>(null);
  const run = useCallback(async () => { const j = await fetch(`${api("report")}?report=${type}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setData(j.data); }, [type]);
  useEffect(() => { run(); }, [run]);
  const cols = data ? data.columns.map((c, i) => ({ key: String(i), label: c })) : [];
  const objRows = data ? data.rows.map((r) => Object.fromEntries(r.map((v, i) => [String(i), v]))) : [];
  return (
    <div className="space-y-3">
      <Header title="Reports" action={<div className="flex gap-1.5"><button onClick={() => data && downloadCsv(cols, objRows, `${type}.csv`)} className={btnO}><Download className="h-3.5 w-3.5" /> CSV</button><button onClick={() => data && downloadExcel(cols, objRows, `${type}.xls`, { title: data.title })} className={btnO}><Download className="h-3.5 w-3.5" /> Excel</button><button onClick={() => data && printTable({ title: data.title, columns: cols, rows: objRows })} className={btnO}><Printer className="h-3.5 w-3.5" /> PDF</button></div>} />
      <select value={type} onChange={(e) => setType(e.target.value as ReportType)} className={cn(inp, "w-64")}>{REPORT_TYPES.map((r) => <option key={r} value={r}>{REPORT_LABELS[r]}</option>)}</select>
      <div className={cn(card, "overflow-auto")}>{data && <table className="w-full text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500">{data.columns.map((c, i) => <th key={i} className="px-3 py-2.5">{c}</th>)}</tr></thead><tbody>{data.rows.map((r, i) => <tr key={i} className="border-b border-slate-100 last:border-0">{r.map((v, j) => <td key={j} className="px-3 py-2 text-slate-700">{typeof v === "number" ? v.toLocaleString("en-IN") : v}</td>)}</tr>)}{!data.rows.length && <tr><td colSpan={data.columns.length || 1} className="px-4 py-12 text-center text-sm text-slate-400">No data.</td></tr>}</tbody></table>}</div>
    </div>
  );
}
