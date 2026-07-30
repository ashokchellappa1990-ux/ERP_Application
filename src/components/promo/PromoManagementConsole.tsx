"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Sparkles, ListChecks, Send, ScanLine, ScrollText, Megaphone, RefreshCw, Copy, CheckCircle2, XCircle, Image as ImageIcon, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  PROMO_CODE_TYPES, GENERATION_TYPES, MESSAGE_MODES, MESSAGE_TEMPLATES, MESSAGE_PLACEHOLDERS, AUDIENCE_TYPES, AUDIENCE_LABELS, CODE_MODELS, CODE_MODEL_LABELS,
  type PromoCampaignRow, type PromoCodeRow, type PromoDistributionRow, type PromoDashboard, type ValidateResult, type AudiencePreview,
} from "@/lib/contracts/promo";

const API = "/api/promo";
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
const fm = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "generate", label: "Generate", icon: Sparkles },
  { id: "codes", label: "Promo Codes", icon: ListChecks },
  { id: "distribution", label: "Distribution", icon: Send },
  { id: "redeem", label: "Redeem", icon: ScanLine },
  { id: "audit", label: "Audit", icon: ScrollText },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function PromoManagementConsole() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [campaigns, setCampaigns] = useState<PromoCampaignRow[]>([]);
  const [msg, setMsg] = useState("");
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2800); };
  useEffect(() => { (async () => { const j = await fetch(`${API}/campaigns`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setCampaigns(j.rows); })(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>CRM</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Promo Code Management</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Megaphone className="h-5 w-5 text-primary" /> Promo Code Management</h1>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => { const Icon = t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold transition", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}><Icon className="h-4 w-4" /> {t.label}</button>; })}
      </div>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "generate" && <GenerateTab campaigns={campaigns} flash={flash} />}
      {tab === "codes" && <CodesTab campaigns={campaigns} flash={flash} />}
      {tab === "distribution" && <DistributionTab campaigns={campaigns} flash={flash} />}
      {tab === "redeem" && <RedeemTab flash={flash} />}
      {tab === "audit" && <AuditTab />}
      {msg && <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-primary/40 bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg">{msg}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- dashboard */
function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><div className={cn("text-lg font-bold tabular-nums", tone || "text-foreground")}>{value}</div><div className="text-2xs font-medium text-muted">{label}</div></div>;
}
function DashboardTab() {
  const [d, setD] = useState<PromoDashboard | null>(null);
  useEffect(() => { (async () => { const j = await fetch(`${API}/dashboard`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setD(j.data); })(); }, []);
  if (!d) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
  const maxCh = Math.max(1, ...d.channelBreakup.map((c) => c.value));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Total Codes" value={d.totalCodes} />
        <Stat label="Active" value={d.activeCodes} tone="text-success" />
        <Stat label="Redeemed" value={d.redeemedCodes} tone="text-primary" />
        <Stat label="Expired" value={d.expiredCodes} tone="text-warning" />
        <Stat label="Distributed" value={d.distributedCount} />
        <Stat label="Active Campaigns" value={d.activeCampaigns} />
        <Stat label="Total Discount" value={fm(d.totalDiscount)} tone="text-danger" />
        <Stat label="Redemption %" value={`${d.redemptionRate}%`} />
        <Stat label="Distribution %" value={`${d.distributionRate}%`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top Campaigns (ROI)">
          <table className="w-full text-sm"><thead><tr className="text-left text-2xs uppercase text-subtle"><th className="pb-1.5">Campaign</th><th className="pb-1.5 text-right">Redeemed</th><th className="pb-1.5 text-right">Discount</th><th className="pb-1.5 text-right">ROI %</th></tr></thead>
            <tbody>{d.topCampaigns.map((c, i) => <tr key={i} className="border-t border-border"><td className="py-1.5 font-medium text-foreground">{c.name}</td><td className="py-1.5 text-right tabular-nums">{c.redeemed}</td><td className="py-1.5 text-right tabular-nums">{fm(c.discount)}</td><td className="py-1.5 text-right tabular-nums text-primary">{c.roi}%</td></tr>)}{!d.topCampaigns.length && <tr><td colSpan={4} className="py-4 text-center text-muted">No redemptions yet.</td></tr>}</tbody></table>
        </Card>
        <Card title="Distribution by Channel">
          <div className="space-y-1.5">{d.channelBreakup.map((c) => <div key={c.name} className="flex items-center gap-2 text-2xs"><span className="w-20 text-muted">{c.name}</span><div className="h-3 flex-1 rounded bg-surface-2"><div className="h-3 rounded bg-primary" style={{ width: `${(c.value / maxCh) * 100}%` }} /></div><span className="w-8 text-right tabular-nums font-semibold text-foreground">{c.value}</span></div>)}{!d.channelBreakup.length && <div className="py-4 text-center text-muted">No distributions yet.</div>}</div>
        </Card>
        <Card title="Top Customers"><MiniList rows={d.topCustomers.map((c) => [c.name, `${c.redeemed} · ${fm(c.discount)}`])} empty="No customer redemptions." /></Card>
        <Card title="Top Products"><MiniList rows={d.topProducts.map((p) => [p.name, String(p.count)])} empty="No product data." /></Card>
      </div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h3 className="mb-2 text-sm font-bold text-foreground">{title}</h3>{children}</div>; }
function MiniList({ rows, empty }: { rows: [string, string][]; empty: string }) { return <div className="space-y-1">{rows.map((r, i) => <div key={i} className="flex items-center justify-between border-b border-border py-1 text-sm last:border-0"><span className="truncate text-foreground">{r[0]}</span><span className="shrink-0 text-2xs font-semibold text-muted">{r[1]}</span></div>)}{!rows.length && <div className="py-4 text-center text-sm text-muted">{empty}</div>}</div>; }

/* ------------------------------------------------------------------ generate */
function GenerateTab({ campaigns, flash }: { campaigns: PromoCampaignRow[]; flash: (m: string) => void }) {
  const [f, setF] = useState({ campaignId: "", codeModel: "SameCode", generationType: "Auto", manualCode: "", quantity: "10", codeType: "Public", name: "", prefix: "", suffix: "", expiryDate: "", usageLimit: "0" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  // Default the usage model from the module configuration.
  useEffect(() => { (async () => { const j = await fetch(`${API}/config`, { cache: "no-store" }).then((r) => r.json()); if (j.ok && j.config?.codeModel) setF((p) => ({ ...p, codeModel: j.config.codeModel })); })(); }, []);
  async function gen() {
    if (!f.campaignId) { flash("Select a campaign."); return; }
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", ...f, campaignId: Number(f.campaignId) }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { setResult(j.message); flash(j.message); } else flash(j.message || "Could not generate.");
  }
  const manual = f.generationType === "Manual";
  const diff = f.codeModel === "DifferentCodes";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-foreground">Generate Promo Codes</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3"><label className={lbl}>Campaign *</label><select value={f.campaignId} onChange={(e) => set("campaignId", e.target.value)} className={inp}><option value="">Select campaign…</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></div>
        <div className="sm:col-span-2 lg:col-span-3"><label className={lbl}>Usage Model</label><select value={f.codeModel} onChange={(e) => set("codeModel", e.target.value)} className={inp}>{CODE_MODELS.map((m) => <option key={m} value={m}>{CODE_MODEL_LABELS[m]}</option>)}</select>
          <p className="mt-1 text-[10px] text-subtle">{diff ? "A batch of unique codes will be created — one code per customer (enter quantity)." : "A single shared code will be created — any customer can redeem it, but only once each."}</p></div>
        <div><label className={lbl}>Generation Type</label><select value={f.generationType} onChange={(e) => set("generationType", e.target.value)} className={inp}>{GENERATION_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className={lbl}>Code Type</label><select value={f.codeType} onChange={(e) => set("codeType", e.target.value)} className={inp}>{PROMO_CODE_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
        {manual ? (
          <div className="sm:col-span-2 lg:col-span-3"><label className={lbl}>Manual Code *</label><input value={f.manualCode} onChange={(e) => set("manualCode", e.target.value.toUpperCase())} placeholder="e.g. WELCOME50" className={inp} /></div>
        ) : (
          <>
            {diff && <div><label className={lbl}>Quantity (no. of codes)</label><input type="number" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} className={inp} /></div>}
            <div><label className={lbl}>Prefix (optional)</label><input value={f.prefix} onChange={(e) => set("prefix", e.target.value.toUpperCase())} placeholder="Config default" className={inp} /></div>
            <div><label className={lbl}>Suffix (optional)</label><input value={f.suffix} onChange={(e) => set("suffix", e.target.value.toUpperCase())} className={inp} /></div>
          </>
        )}
        <div><label className={lbl}>Name / Label</label><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Expiry Date</label><input type="date" value={f.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className={inp} /></div>
      </div>
      <div className="mt-4 flex items-center gap-3"><Button onClick={gen} disabled={busy}><Sparkles className="h-4 w-4" /> {busy ? "Generating…" : "Generate"}</Button>{result && <span className="text-2xs text-success">{result}</span>}</div>
      <p className="mt-2 text-2xs text-subtle">Digital codes — no printing needed. Distribute them via SMS / WhatsApp / Email in the Distribution tab.</p>
    </div>
  );
}

/* -------------------------------------------------------------------- codes */
function CodesTab({ campaigns, flash }: { campaigns: PromoCampaignRow[]; flash: (m: string) => void }) {
  const [rows, setRows] = useState<PromoCodeRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");
  const load = useCallback(async () => { const p = new URLSearchParams(); if (campaignId) p.set("campaignId", campaignId); if (status) p.set("status", status); if (q) p.set("q", q); const j = await fetch(`${API}/codes?${p}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, [campaignId, status, q]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={cn(inp, "w-52")}><option value="">All campaigns</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inp, "w-36")}>{["All", "Active", "Issued", "Redeemed", "Expired", "Cancelled"].map((x) => <option key={x}>{x}</option>)}</select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code / customer…" className={cn(inp, "w-56")} />
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        <span className="ml-auto text-2xs text-muted">{rows.length} code(s)</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Promo Code</th><th className="px-3 py-2.5">Campaign</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5">Expiry</th><th className="px-3 py-2.5 text-center">Distributed</th><th className="px-3 py-2.5 text-center">Redeemed</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2/40">
                <td className="px-3 py-2 font-mono font-semibold text-foreground">{c.promoCode}</td>
                <td className="px-3 py-2 text-muted">{c.campaignName}</td>
                <td className="px-3 py-2 text-2xs text-muted">{c.codeType} · {c.generationType}</td>
                <td className="px-3 py-2 text-muted">{c.customerName || "Public"}</td>
                <td className="px-3 py-2 text-2xs text-muted">{c.expiryDate || "—"}</td>
                <td className="px-3 py-2 text-center tabular-nums">{c.distributedCount}</td>
                <td className="px-3 py-2 text-center tabular-nums">{c.redeemedCount}</td>
                <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", c.status === "Active" || c.status === "Issued" ? "bg-success-subtle text-success" : c.status === "Redeemed" ? "bg-primary-subtle text-primary" : "bg-warning-subtle text-warning")}>{c.status}</span></td>
                <td className="px-3 py-2 text-right"><button onClick={() => { navigator.clipboard?.writeText(c.promoCode); flash(`Copied ${c.promoCode}`); }} className="text-muted hover:text-primary" title="Copy code"><Copy className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-muted">No codes. Generate promo codes first.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- distribution */
const SAMPLE = { CustomerName: "Rahul Sharma", CompanyName: "Oasys Retail", CampaignName: "Festive Offer" };
function fillMsg(body: string, code: string, discount: string, expiry: string) {
  return body
    .replaceAll("{CustomerName}", SAMPLE.CustomerName).replaceAll("{CompanyName}", SAMPLE.CompanyName)
    .replaceAll("{CampaignName}", SAMPLE.CampaignName).replaceAll("{PromoCode}", code || "PROMO0001")
    .replaceAll("{Discount}", discount || "10% OFF").replaceAll("{ExpiryDate}", expiry || "31 Dec 2026");
}
function DistributionTab({ campaigns, flash }: { campaigns: PromoCampaignRow[]; flash: (m: string) => void }) {
  const [rows, setRows] = useState<PromoDistributionRow[]>([]);
  const [codes, setCodes] = useState<PromoCodeRow[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [custQ, setCustQ] = useState("");
  const [custHits, setCustHits] = useState<{ id: number; name: string; phone?: string }[]>([]);
  const [picked, setPicked] = useState<{ id: number; name: string }[]>([]);
  const [view, setView] = useState<PromoDistributionRow | null>(null);
  const [f, setF] = useState({ campaignId: "", promoCodeId: "", channel: "WhatsApp" as (typeof MESSAGE_MODES)[number], audience: "All" as (typeof AUDIENCE_TYPES)[number], groupValue: "", highValueMin: "10000", messageBody: MESSAGE_TEMPLATES.WhatsApp, remarks: "" });
  const [banner, setBanner] = useState("");
  const [msgTouched, setMsgTouched] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => { const j = await fetch(`${API}/distributions`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, []);
  useEffect(() => { load(); (async () => { const j = await fetch(`${API}/customerGroups`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setGroups(j.groups); })(); }, [load]);
  useEffect(() => { (async () => { if (!f.campaignId) { setCodes([]); return; } const j = await fetch(`${API}/codes?campaignId=${f.campaignId}&status=All`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setCodes(j.rows); })(); }, [f.campaignId]);
  // Reset the message template when the channel changes (unless the user edited it).
  useEffect(() => { if (!msgTouched) setF((p) => ({ ...p, messageBody: MESSAGE_TEMPLATES[p.channel] })); }, [f.channel, msgTouched]);
  // Live audience preview.
  useEffect(() => {
    const p = new URLSearchParams({ audience: f.audience });
    if (f.audience === "Group") p.set("groupValue", f.groupValue);
    if (f.audience === "HighValue") p.set("highValueMin", f.highValueMin);
    if (f.audience === "Specific") p.set("customerIds", picked.map((c) => c.id).join(","));
    fetch(`${API}/audience?${p}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setPreview(j.data); }).catch(() => {});
  }, [f.audience, f.groupValue, f.highValueMin, picked]);
  // Customer search for the Specific audience.
  useEffect(() => { if (!custQ.trim()) { setCustHits([]); return; } const t = setTimeout(async () => { const j = await fetch(`/api/masters/customers?q=${encodeURIComponent(custQ)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setCustHits(j.customers); }, 220); return () => clearTimeout(t); }, [custQ]);

  function onBanner(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => setBanner(String(rd.result || "")); rd.readAsDataURL(file); }
  function insertPh(ph: string) { setMsgTouched(true); setF((p) => ({ ...p, messageBody: p.messageBody + ph })); }

  async function send() {
    if (!f.campaignId) { flash("Select a campaign."); return; }
    if (f.audience === "Specific" && !picked.length) { flash("Pick at least one customer."); return; }
    const body = { action: "sendMessage", campaignId: Number(f.campaignId), promoCodeId: f.promoCodeId ? Number(f.promoCodeId) : undefined, channel: f.channel, audience: f.audience, groupValue: f.audience === "Group" ? f.groupValue : undefined, highValueMin: f.audience === "HighValue" ? Number(f.highValueMin) : undefined, customerIds: f.audience === "Specific" ? picked.map((c) => c.id) : undefined, messageBody: f.messageBody, bannerImage: banner || undefined, remarks: f.remarks };
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { flash(j.message); setF((p) => ({ ...p, remarks: "" })); load(); } else flash(j.message || "Could not send.");
  }
  const selectedCode = codes.find((c) => String(c.id) === f.promoCodeId);
  const rendered = fillMsg(f.messageBody, selectedCode?.promoCode || "", "", selectedCode?.expiryDate || "");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Composer */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-foreground">Send Campaign Message</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Campaign *</label><select value={f.campaignId} onChange={(e) => set("campaignId", e.target.value)} className={inp}><option value="">Select…</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className={lbl}>Promo Code (shared)</label><select value={f.promoCodeId} onChange={(e) => set("promoCodeId", e.target.value)} className={inp}><option value="">Select code…</option>{codes.map((c) => <option key={c.id} value={c.id}>{c.promoCode}</option>)}</select></div>
              <div><label className={lbl}>Message Mode</label><select value={f.channel} onChange={(e) => { setMsgTouched(false); set("channel", e.target.value); }} className={inp}>{MESSAGE_MODES.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className={lbl}>Send To (Audience)</label><select value={f.audience} onChange={(e) => set("audience", e.target.value)} className={inp}>{AUDIENCE_TYPES.map((a) => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}</select></div>
              {f.audience === "HighValue" && <div><label className={lbl}>Min. Total Spent (₹)</label><input type="number" value={f.highValueMin} onChange={(e) => set("highValueMin", e.target.value)} className={inp} /></div>}
              {f.audience === "Group" && <div><label className={lbl}>Customer Group</label><select value={f.groupValue} onChange={(e) => set("groupValue", e.target.value)} className={inp}><option value="">Select group…</option>{groups.map((g) => <option key={g}>{g}</option>)}</select></div>}
            </div>

            {f.audience === "Specific" && (
              <div className="mt-3">
                <label className={lbl}>Pick Customers</label>
                <div className="relative">
                  <input value={custQ} onChange={(e) => setCustQ(e.target.value)} placeholder="Search by name / phone…" className={inp} />
                  {custHits.length > 0 && custQ && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                      {custHits.map((c) => <button key={c.id} onClick={() => { if (!picked.some((x) => x.id === c.id)) setPicked([...picked, { id: c.id, name: c.name }]); setCustQ(""); setCustHits([]); }} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-primary-subtle/40"><span>{c.name}</span><span className="text-2xs text-subtle">{c.phone}</span></button>)}
                    </div>
                  )}
                </div>
                {picked.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{picked.map((c) => <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-primary-subtle px-2 py-0.5 text-2xs font-semibold text-primary">{c.name}<button onClick={() => setPicked(picked.filter((x) => x.id !== c.id))}><XCircle className="h-3 w-3" /></button></span>)}</div>}
              </div>
            )}

            {preview && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary-subtle/20 px-3 py-2 text-2xs">
                <span className="font-bold text-primary">{preview.count.toLocaleString()}</span> <span className="text-muted">customer(s) will receive this message</span>
                {preview.sample.length > 0 && <span className="text-subtle"> · e.g. {preview.sample.slice(0, 4).map((s) => s.name).join(", ")}{preview.count > 4 ? "…" : ""}</span>}
              </div>
            )}

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between"><label className={lbl}>Message Content ({f.channel}) — editable</label><button onClick={() => { setMsgTouched(false); setF((p) => ({ ...p, messageBody: MESSAGE_TEMPLATES[p.channel] })); }} className="text-2xs font-semibold text-primary hover:underline">Reset to sample</button></div>
              <textarea value={f.messageBody} onChange={(e) => { setMsgTouched(true); set("messageBody", e.target.value); }} rows={6} className={cn(inp, "h-auto py-2 font-mono text-2xs leading-relaxed")} />
              <div className="mt-1.5 flex flex-wrap gap-1">{MESSAGE_PLACEHOLDERS.map((ph) => <button key={ph} onClick={() => insertPh(ph)} className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted hover:border-primary hover:text-primary">{ph}</button>)}</div>
            </div>

            <div className="mt-3">
              <label className={lbl}>Promo Design Banner</label>
              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-2xs font-semibold text-primary hover:border-primary"><ImageIcon className="h-3.5 w-3.5" /> Upload Banner<input type="file" accept="image/*" onChange={onBanner} className="hidden" /></label>
                {banner && <><img src={banner} alt="banner" className="h-10 rounded border border-border object-cover" /><button onClick={() => setBanner("")} className="text-2xs font-semibold text-danger hover:underline">Remove</button></>}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3"><Button onClick={send}><Send className="h-4 w-4" /> Send Message</Button><span className="text-2xs text-subtle">Delivery via SMS / WhatsApp / Email gateway (integration planned) — recorded now.</span></div>
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground"><Eye className="h-4 w-4 text-primary" /> Preview ({f.channel})</h3>
          <div className="rounded-xl border border-border bg-surface-2/40 p-3">
            {banner && <img src={banner} alt="banner" className="mb-2 w-full rounded-lg border border-border object-cover" />}
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{rendered}</div>
          </div>
          <p className="mt-2 text-2xs text-subtle">Placeholders are shown with sample values; each customer gets their own name &amp; details when sent.</p>
        </div>
      </div>

      {/* History */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Mode</th><th className="px-3 py-2.5">Campaign</th><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">Audience</th><th className="px-3 py-2.5 text-center">Recipients</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody>
            {rows.map((d) => <tr key={d.id} className="border-b border-border last:border-0"><td className="px-3 py-2 text-2xs text-muted">{d.distributionDate}</td><td className="px-3 py-2">{d.channel}</td><td className="px-3 py-2 text-muted">{d.campaignName}</td><td className="px-3 py-2 font-mono text-2xs">{d.promoCode || "—"}</td><td className="px-3 py-2 text-2xs">{d.audience || d.recipient || "—"}</td><td className="px-3 py-2 text-center tabular-nums">{d.recipientCount}</td><td className="px-3 py-2"><span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-semibold text-muted">{d.deliveryStatus}</span></td><td className="px-3 py-2 text-right">{(d.messageBody || d.bannerImage) && <button onClick={() => setView(d)} className="text-2xs font-semibold text-primary hover:underline">View</button>}</td></tr>)}
            {!rows.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">No messages sent yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {view && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => setView(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">{view.channel} · {view.audience || "—"} ({view.recipientCount})</h2><button onClick={() => setView(null)} className="text-muted hover:text-foreground"><XCircle className="h-4 w-4" /></button></div>
            <div className="p-4">{view.bannerImage && <img src={view.bannerImage} alt="banner" className="mb-3 w-full rounded-lg border border-border" />}<div className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{view.messageBody || "(no message content)"}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- redeem */
function RedeemTab({ flash }: { flash: (m: string) => void }) {
  const [code, setCode] = useState("");
  const [bill, setBill] = useState("");
  const [res, setRes] = useState<ValidateResult | null>(null);
  const [post, setPost] = useState(true);
  const [busy, setBusy] = useState(false);
  async function validate() {
    if (!code || !bill) { flash("Enter code and bill amount."); return; }
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "validate", promoCode: code.trim(), billAmount: Number(bill) }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) setRes(j.data); else flash(j.message || "Validation failed.");
  }
  async function redeem() {
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redeem", promoCode: code.trim(), billAmount: Number(bill), post }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { flash(j.message); setRes(null); setCode(""); setBill(""); } else flash(j.message || "Redeem failed.");
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-foreground">Validate &amp; Redeem</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><label className={lbl}>Promo Code</label><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={inp} /></div>
        <div><label className={lbl}>Bill Amount</label><input type="number" value={bill} onChange={(e) => setBill(e.target.value)} className={inp} /></div>
        <div className="flex items-end sm:col-span-1"><Button variant="outline" onClick={validate} disabled={busy} className="w-full"><ScanLine className="h-4 w-4" /> Validate</Button></div>
      </div>
      {res && (
        <div className={cn("mt-4 rounded-lg border p-3 text-sm sm:max-w-xl", res.valid ? "border-success/40 bg-success-subtle/40" : "border-danger/40 bg-danger-subtle/40")}>
          {res.valid ? (
            <>
              <div className="flex items-center gap-2 font-bold text-success"><CheckCircle2 className="h-4 w-4" /> Valid · {res.campaignName}</div>
              <div className="mt-1 text-foreground">Discount: <strong>{fm(res.discountAmount)}</strong> ({res.discountType})</div>
              <label className="mt-2 flex items-center gap-2 text-2xs"><input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} className="h-4 w-4 accent-primary" /> Post accounting voucher (Dr Marketing Expense / Cr Sales Discount)</label>
              <Button size="sm" className="mt-2" onClick={redeem} disabled={busy}><CheckCircle2 className="h-4 w-4" /> Redeem</Button>
            </>
          ) : <div className="flex items-center gap-2 font-semibold text-danger"><XCircle className="h-4 w-4" /> {res.reason}</div>}
        </div>
      )}
      <p className="mt-3 text-2xs text-subtle">Promo codes also apply automatically at POS Billing. This tab is for manual / phone-order redemption.</p>
    </div>
  );
}

/* -------------------------------------------------------------------- audit */
function AuditTab() {
  const [rows, setRows] = useState<{ id: number; entityType: string; action: string; byName: string; note: string; at: string }[]>([]);
  useEffect(() => { (async () => { const j = await fetch(`${API}/audit`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); })(); }, []);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">When</th><th className="px-3 py-2.5">Entity</th><th className="px-3 py-2.5">Action</th><th className="px-3 py-2.5">By</th><th className="px-3 py-2.5">Note</th></tr></thead>
        <tbody>
          {rows.map((a) => <tr key={a.id} className="border-b border-border last:border-0"><td className="px-3 py-2 text-2xs text-muted">{new Date(a.at).toLocaleString()}</td><td className="px-3 py-2">{a.entityType}</td><td className="px-3 py-2 font-medium text-foreground">{a.action}</td><td className="px-3 py-2 text-muted">{a.byName}</td><td className="px-3 py-2 text-2xs text-muted">{a.note}</td></tr>)}
          {!rows.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted">No audit entries yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
