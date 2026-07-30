"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Settings2, Sparkles, ListChecks, ScanLine, FileText, ScrollText, Wallet, RefreshCw, Save, Download, Printer, CheckCircle2, XCircle, Copy, Eye, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { downloadCsv, downloadExcel, printTable } from "@/lib/export/download";
import {
  VOUCHER_TYPES, VOUCHER_TYPE_LABELS, CUSTOMER_MAPPING, REPORT_TYPES, REPORT_LABELS,
  type GvConfig, type VoucherRow, type VoucherDetail, type ValidateResult, type GvDashboard, type ReportResult, type ReportType, type AccountRef, type AuditRow,
} from "@/lib/contracts/giftVoucher";

const API = "/api/gift-voucher";
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
const fm = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "config", label: "Configuration", icon: Settings2 },
  { id: "generate", label: "Generate", icon: Sparkles },
  { id: "vouchers", label: "Vouchers", icon: ListChecks },
  { id: "redeem", label: "Redeem", icon: ScanLine },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "audit", label: "Audit", icon: ScrollText },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function GiftVoucherConsole() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [msg, setMsg] = useState("");
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2800); };
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>CRM</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Gift Voucher Management</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wallet className="h-5 w-5 text-primary" /> Gift Voucher Management</h1>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => { const Icon = t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold transition", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}><Icon className="h-4 w-4" /> {t.label}</button>; })}
      </div>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "config" && <ConfigTab flash={flash} />}
      {tab === "generate" && <GenerateTab flash={flash} />}
      {tab === "vouchers" && <VouchersTab flash={flash} />}
      {tab === "redeem" && <RedeemTab flash={flash} />}
      {tab === "reports" && <ReportsTab />}
      {tab === "audit" && <AuditTab />}
      {msg && <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-primary/40 bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg">{msg}</div>}
    </div>
  );
}

/* -------------------- dashboard -------------------- */
function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) { return <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><div className={cn("text-lg font-bold tabular-nums", tone || "text-foreground")}>{value}</div><div className="text-2xs font-medium text-muted">{label}</div></div>; }
function DashboardTab() {
  const [d, setD] = useState<GvDashboard | null>(null);
  useEffect(() => { (async () => { const j = await fetch(`${API}/dashboard`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setD(j.data); })(); }, []);
  if (!d) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
  const maxT = Math.max(1, ...d.topTypes.map((x) => x.value));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Generated" value={d.generated} /><Stat label="Sold" value={d.sold} tone="text-primary" /><Stat label="Active" value={d.active} tone="text-success" /><Stat label="Redeemed" value={d.redeemed} /><Stat label="Expired" value={d.expired} tone="text-warning" /><Stat label="Closed" value={d.closed} />
        <Stat label="Outstanding Liability" value={fm(d.outstandingLiability)} tone="text-danger" /><Stat label="Sales Value" value={fm(d.salesValue)} tone="text-primary" /><Stat label="Redemption Value" value={fm(d.redemptionValue)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h3 className="mb-2 text-sm font-bold text-foreground">Top Voucher Types</h3><div className="space-y-1.5">{d.topTypes.map((x) => <div key={x.name} className="flex items-center gap-2 text-2xs"><span className="w-28 truncate text-muted">{x.name}</span><div className="h-3 flex-1 rounded bg-surface-2"><div className="h-3 rounded bg-primary" style={{ width: `${(x.value / maxT) * 100}%` }} /></div><span className="w-8 text-right tabular-nums font-semibold">{x.value}</span></div>)}{!d.topTypes.length && <div className="py-4 text-center text-muted">No vouchers yet.</div>}</div></div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h3 className="mb-2 text-sm font-bold text-foreground">Top Customers (by sale value)</h3><div className="space-y-1">{d.topCustomers.map((c) => <div key={c.name} className="flex justify-between border-b border-border py-1 text-sm last:border-0"><span className="truncate text-foreground">{c.name}</span><span className="font-semibold text-muted">{fm(c.value)}</span></div>)}{!d.topCustomers.length && <div className="py-4 text-center text-sm text-muted">No sales yet.</div>}</div></div>
      </div>
    </div>
  );
}

/* -------------------- config -------------------- */
function ConfigTab({ flash }: { flash: (m: string) => void }) {
  const [cfg, setCfg] = useState<GvConfig | null>(null);
  const [accounts, setAccounts] = useState<AccountRef[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => { const j = await fetch(`${API}/config`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) { setCfg(j.config); setAccounts(j.accounts || []); } })(); }, []);
  if (!cfg) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
  const set = (k: keyof GvConfig, v: unknown) => setCfg({ ...cfg, [k]: v } as GvConfig);
  async function save() { setBusy(true); const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveConfig", ...cfg }) }).then((r) => r.json()).catch(() => ({})); setBusy(false); if (j.ok) { setCfg(j.config); flash("Configuration saved."); } else flash(j.message || "Could not save."); }
  const FLAGS: [keyof GvConfig, string][] = [["enableModule", "Enable Gift Voucher"], ["enableQr", "Enable QR Code"], ["enableBarcode", "Enable Barcode"], ["enableCustomerMapping", "Enable Customer Mapping"], ["enablePartialRedemption", "Partial Redemption"], ["enableMultipleRedemption", "Multiple Redemption"], ["enableTransfer", "Voucher Transfer"], ["enableRevalidation", "Revalidation"], ["enableExpiry", "Enable Expiry"], ["enableAutoExpiry", "Auto Expiry"], ["enableReissue", "Reissue"], ["enableReplacement", "Replacement"], ["autoActivateOnSale", "Auto Activate on Sale"], ["approvalRequired", "Approval Required"], ["gstOnSale", "GST on Voucher Sale"]];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h3 className="mb-3 text-sm font-bold text-foreground">Feature Flags</h3><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{FLAGS.map(([k, label]) => <label key={k} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm"><span className="text-foreground">{label}</span><input type="checkbox" checked={!!cfg[k]} onChange={(e) => set(k, e.target.checked)} className="h-4 w-4 accent-primary" /></label>)}</div></div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h3 className="mb-3 text-sm font-bold text-foreground">Numbering, Validity &amp; Finance</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className={lbl}>Customer Mapping</label><select value={cfg.customerMapping} onChange={(e) => set("customerMapping", e.target.value)} className={inp}>{CUSTOMER_MAPPING.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className={lbl}>Number Prefix</label><input value={cfg.numberPrefix} onChange={(e) => set("numberPrefix", e.target.value.toUpperCase())} className={inp} /></div>
        <div><label className={lbl}>Number Length</label><input type="number" value={cfg.numberLength} onChange={(e) => set("numberLength", Number(e.target.value))} className={inp} /></div>
        <div><label className={lbl}>Security Code Length</label><input type="number" value={cfg.securityLength} onChange={(e) => set("securityLength", Number(e.target.value))} className={inp} /></div>
        <div><label className={lbl}>Default Validity (days)</label><input type="number" value={cfg.defaultValidityDays} onChange={(e) => set("defaultValidityDays", Number(e.target.value))} className={inp} /></div>
        <div><label className={lbl}>GST %</label><input type="number" value={cfg.gstPercentage} onChange={(e) => set("gstPercentage", Number(e.target.value))} className={inp} /></div>
        <div className="lg:col-span-2"><label className={lbl}>Liability Account</label><select value={cfg.liabilityAccount} onChange={(e) => set("liabilityAccount", e.target.value)} className={inp}><option value="">Default (Gift Voucher Liability)</option>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></div>
      </div></div>
      <div className="flex justify-end"><Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Configuration"}</Button></div>
    </div>
  );
}

/* -------------------- generate -------------------- */
function GenerateTab({ flash }: { flash: (m: string) => void }) {
  const [f, setF] = useState({ voucherType: "FixedValue", faceValue: "1000", quantity: "10", expiryDate: "" });
  const [busy, setBusy] = useState(false); const [result, setResult] = useState("");
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  async function gen() { setBusy(true); const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", ...f, faceValue: Number(f.faceValue), quantity: Number(f.quantity) }) }).then((r) => r.json()).catch(() => ({})); setBusy(false); if (j.ok) { setResult(j.message); flash(j.message); } else flash(j.message || "Could not generate."); }
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-foreground">Generate Gift Vouchers</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className={lbl}>Voucher Type</label><select value={f.voucherType} onChange={(e) => set("voucherType", e.target.value)} className={inp}>{VOUCHER_TYPES.map((x) => <option key={x} value={x}>{VOUCHER_TYPE_LABELS[x]}</option>)}</select></div>
        <div><label className={lbl}>Face Value (₹)</label><input type="number" value={f.faceValue} onChange={(e) => set("faceValue", e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Quantity</label><input type="number" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Expiry Date</label><input type="date" value={f.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className={inp} /></div>
      </div>
      <div className="mt-4 flex items-center gap-3"><Button onClick={gen} disabled={busy}><Sparkles className="h-4 w-4" /> {busy ? "Generating…" : "Generate"}</Button>{result && <span className="text-2xs text-success">{result}</span>}</div>
      <p className="mt-2 text-2xs text-subtle">Each voucher gets a unique number, QR/barcode &amp; security code. Sell them in the Sale tab (posts Dr Cash / Cr Gift Voucher Liability).</p>
    </div>
  );
}

/* -------------------- vouchers -------------------- */
function VouchersTab({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [status, setStatus] = useState("All"); const [type, setType] = useState("All"); const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [view, setView] = useState<VoucherDetail | null>(null);
  const load = useCallback(async () => { const p = new URLSearchParams({ status, type }); if (q) p.set("q", q); const j = await fetch(`${API}/vouchers?${p}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, [status, type, q]);
  useEffect(() => { load(); }, [load]);
  async function act(action: string, extra: Record<string, unknown>) { const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) }).then((r) => r.json()).catch(() => ({})); if (j.ok) { flash(j.message); load(); if (view) openView(view.id); } else flash(j.message || "Action failed."); }
  async function openView(id: number) { const j = await fetch(`${API}/detail?id=${id}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setView(j.data); }
  async function print() { if (!sel.size) { flash("Select vouchers to print."); return; } const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "renderPrint", voucherIds: [...sel], perPage: 4 }) }).then((r) => r.json()).catch(() => ({})); if (j.ok) { const w = window.open("", "_blank"); if (w) { w.document.write(j.html); w.document.close(); } } else flash(j.message || "Could not print."); }
  const badge = (st: string) => cn("rounded-full px-2 py-0.5 text-2xs font-semibold", st === "Active" ? "bg-success-subtle text-success" : st === "Generated" ? "bg-surface-2 text-muted" : st === "Closed" || st === "Redeemed" ? "bg-primary-subtle text-primary" : "bg-danger-subtle text-danger");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inp, "w-36")}>{["All", "Generated", "Active", "Redeemed", "Expired", "Cancelled", "Closed"].map((x) => <option key={x}>{x}</option>)}</select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={cn(inp, "w-40")}><option value="All">All types</option>{VOUCHER_TYPES.map((x) => <option key={x} value={x}>{VOUCHER_TYPE_LABELS[x]}</option>)}</select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search voucher / customer…" className={cn(inp, "w-56")} />
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="outline" onClick={print} disabled={!sel.size}><Printer className="h-3.5 w-3.5" /> Print ({sel.size})</Button>
        <span className="ml-auto text-2xs text-muted">{rows.length} voucher(s)</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5 w-8" /><th className="px-3 py-2.5">Voucher No</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5 text-right">Face</th><th className="px-3 py-2.5 text-right">Balance</th><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5">Expiry</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-b border-border last:border-0 hover:bg-surface-2/40">
                <td className="px-3 py-2"><input type="checkbox" checked={sel.has(v.id)} onChange={(e) => setSel((s) => { const n = new Set(s); e.target.checked ? n.add(v.id) : n.delete(v.id); return n; })} className="h-4 w-4 accent-primary" /></td>
                <td className="px-3 py-2 font-mono font-semibold text-foreground">{v.voucherNo}</td>
                <td className="px-3 py-2 text-2xs text-muted">{VOUCHER_TYPE_LABELS[v.voucherType] ?? v.voucherType}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fm(v.faceValue)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{fm(v.availableBalance)}</td>
                <td className="px-3 py-2 text-muted">{v.customerName || "—"}</td>
                <td className="px-3 py-2 text-2xs text-muted">{v.expiryDate || "—"}</td>
                <td className="px-3 py-2"><span className={badge(v.status)}>{v.status}</span></td>
                <td className="px-3 py-2 text-right"><div className="flex justify-end gap-1">
                  <button onClick={() => openView(v.id)} className="rounded-md border border-border px-2 py-1 text-2xs font-semibold text-muted hover:border-primary hover:text-primary"><Eye className="mr-1 inline h-3 w-3" />View</button>
                  {v.status === "Generated" && <button onClick={() => act("activate", { voucherId: v.id })} className="rounded-md border border-success/40 px-2 py-1 text-2xs font-semibold text-success hover:bg-success-subtle">Activate</button>}
                  <button onClick={() => { navigator.clipboard?.writeText(v.voucherNo); flash(`Copied ${v.voucherNo}`); }} className="text-muted hover:text-primary" title="Copy"><Copy className="h-3.5 w-3.5" /></button>
                  {["Generated", "Active"].includes(v.status) && <button onClick={() => act("close", { voucherId: v.id, reason: "Cancelled" })} className="text-danger hover:opacity-70" title="Cancel"><Ban className="h-3.5 w-3.5" /></button>}
                </div></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-muted">No vouchers. Generate some in the Generate tab.</td></tr>}
          </tbody>
        </table>
      </div>
      {view && (
        <div className="fixed inset-0 z-[90] flex justify-end bg-black/40" onClick={() => setView(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><div><h2 className="font-mono text-sm font-bold text-foreground">{view.voucherNo}</h2><p className="text-2xs text-muted">{VOUCHER_TYPE_LABELS[view.voucherType] ?? view.voucherType} · {view.status}</p></div><button onClick={() => setView(null)} className="text-muted hover:text-foreground"><XCircle className="h-5 w-5" /></button></div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2 text-sm"><Row k="Face Value" v={fm(view.faceValue)} /><Row k="Original" v={fm(view.originalValue)} /><Row k="Redeemed" v={fm(view.redeemedValue)} /><Row k="Balance" v={fm(view.availableBalance)} /><Row k="Customer" v={view.customerName || "—"} /><Row k="Expiry" v={view.expiryDate || "—"} /></div>
              <div className="flex flex-wrap gap-2">
                {view.status === "Active" && <Button size="sm" variant="outline" onClick={() => { const a = prompt("Adjust balance by (₹, negative to reduce):"); if (a) act("adjust", { voucherId: view.id, amount: Number(a), reason: "Manual adjustment" }); }}>Adjust</Button>}
                {["Active", "Expired"].includes(view.status) && <Button size="sm" variant="outline" onClick={() => { const d = prompt("New expiry date (YYYY-MM-DD):", view.expiryDate); if (d) act("extend", { voucherId: view.id, expiryDate: d }); }}>Extend</Button>}
                {["Active", "Expired"].includes(view.status) && <Button size="sm" variant="outline" onClick={() => act("reissue", { voucherId: view.id, reason: "Lost" })}>Reissue</Button>}
              </div>
              {view.redemptions.length > 0 && <div><h4 className="mb-1.5 text-2xs font-bold uppercase text-subtle">Redemptions</h4><div className="space-y-1">{view.redemptions.map((r, i) => <div key={i} className="flex justify-between border-b border-border py-1 text-2xs last:border-0"><span>{r.redemptionNo} · {r.date}{r.invoiceNo ? ` · ${r.invoiceNo}` : ""}</span><span className="font-semibold">−{fm(r.amount)} → {fm(r.balanceAfter)}</span></div>)}</div></div>}
              <div><h4 className="mb-1.5 text-2xs font-bold uppercase text-subtle">Ledger</h4><div className="space-y-1">{view.ledger.map((l, i) => <div key={i} className="flex justify-between border-b border-border py-1 text-2xs last:border-0"><span>{l.txnType} · {l.date}</span><span className={l.direction === "CR" ? "text-success" : "text-danger"}>{l.direction} {fm(l.amount)} → {fm(l.balanceAfter)}</span></div>)}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- redeem -------------------- */
function RedeemTab({ flash }: { flash: (m: string) => void }) {
  const [code, setCode] = useState(""); const [amount, setAmount] = useState(""); const [res, setRes] = useState<ValidateResult | null>(null); const [post, setPost] = useState(true); const [busy, setBusy] = useState(false);
  async function check() { if (!code.trim()) return; setBusy(true); const j = await fetch(`${API}/validate?voucherNo=${encodeURIComponent(code.trim())}`, { cache: "no-store" }).then((r) => r.json()); setBusy(false); setRes(j.ok ? j.data : null); }
  async function redeem() { setBusy(true); const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redeem", voucherNo: code.trim(), amount: Number(amount), post }) }).then((r) => r.json()).catch(() => ({})); setBusy(false); if (j.ok) { flash(j.message); setRes(null); setCode(""); setAmount(""); } else flash(j.message || "Redeem failed."); }
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-foreground">Redeem Gift Voucher</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><label className={lbl}>Voucher Number</label><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onBlur={check} className={inp} /></div>
        <div className="flex items-end"><Button variant="outline" onClick={check} disabled={busy} className="w-full"><ScanLine className="h-4 w-4" /> Check Balance</Button></div>
      </div>
      {res && (res.valid ? (
        <div className="mt-4 space-y-2 rounded-lg border border-success/40 bg-success-subtle/40 p-3 text-sm">
          <div className="flex items-center gap-2 font-bold text-success"><CheckCircle2 className="h-4 w-4" /> Balance {fm(res.availableBalance)} · Face {fm(res.faceValue)}{res.customerName ? ` · ${res.customerName}` : ""}</div>
          <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>Redeem Amount (₹)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} /></div><div className="flex items-end"><Button className="w-full" onClick={redeem} disabled={busy || !amount}><CheckCircle2 className="h-4 w-4" /> Redeem</Button></div></div>
          <label className="flex items-center gap-2 text-2xs"><input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} className="h-4 w-4 accent-primary" /> Post accounting (Dr Gift Voucher Liability / Cr Sales)</label>
        </div>
      ) : <div className="mt-4 flex items-center gap-2 rounded-lg border border-danger/40 bg-danger-subtle/40 p-3 text-sm font-semibold text-danger"><XCircle className="h-4 w-4" /> {res.reason}</div>)}
      <p className="mt-3 text-2xs text-subtle">Gift vouchers also work as a payment tender at POS Billing. This tab is for manual redemption.</p>
    </div>
  );
}

/* -------------------- reports -------------------- */
function ReportsTab() {
  const [type, setType] = useState<ReportType>("register");
  const [data, setData] = useState<ReportResult | null>(null); const [busy, setBusy] = useState(false);
  const run = useCallback(async () => { setBusy(true); const j = await fetch(`${API}/report?report=${type}`, { cache: "no-store" }).then((r) => r.json()); setBusy(false); if (j.ok) setData(j.data); }, [type]);
  useEffect(() => { run(); }, [run]);
  const cols = data ? data.columns.map((c, i) => ({ key: String(i), label: c })) : [];
  const objRows = data ? data.rows.map((r) => Object.fromEntries(r.map((v, i) => [String(i), v]))) : [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as ReportType)} className={cn(inp, "w-60")}>{REPORT_TYPES.map((r) => <option key={r} value={r}>{REPORT_LABELS[r]}</option>)}</select>
        <Button size="sm" variant="outline" onClick={run}><RefreshCw className="h-3.5 w-3.5" /></Button>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => data && downloadCsv(cols, objRows, `${type}.csv`)} disabled={!data}><Download className="h-3.5 w-3.5" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => data && downloadExcel(cols, objRows, `${type}.xls`, { title: data.title })} disabled={!data}><Download className="h-3.5 w-3.5" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={() => data && printTable({ title: data.title, columns: cols, rows: objRows })} disabled={!data}><Printer className="h-3.5 w-3.5" /> PDF</Button>
        </div>
      </div>
      <div className="overflow-auto rounded-2xl border border-border bg-card shadow-sm">
        {busy ? <div className="py-16 text-center text-sm text-muted">Loading…</div> : data && (
          <table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">{data.columns.map((c, i) => <th key={i} className="px-3 py-2.5">{c}</th>)}</tr></thead>
            <tbody>{data.rows.map((r, i) => <tr key={i} className="border-b border-border last:border-0">{r.map((v, j) => <td key={j} className="px-3 py-2 text-foreground">{typeof v === "number" ? v.toLocaleString("en-IN") : v}</td>)}</tr>)}{!data.rows.length && <tr><td colSpan={data.columns.length || 1} className="px-4 py-12 text-center text-sm text-muted">No data.</td></tr>}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* -------------------- audit -------------------- */
function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  useEffect(() => { (async () => { const j = await fetch(`${API}/audit`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); })(); }, []);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">When</th><th className="px-3 py-2.5">Entity</th><th className="px-3 py-2.5">Action</th><th className="px-3 py-2.5">By</th><th className="px-3 py-2.5">Note</th></tr></thead>
        <tbody>{rows.map((a) => <tr key={a.id} className="border-b border-border last:border-0"><td className="px-3 py-2 text-2xs text-muted">{new Date(a.at).toLocaleString()}</td><td className="px-3 py-2">{a.entityType}</td><td className="px-3 py-2 font-medium text-foreground">{a.action}</td><td className="px-3 py-2 text-muted">{a.byName}</td><td className="px-3 py-2 text-2xs text-muted">{a.note}</td></tr>)}{!rows.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted">No audit entries yet.</td></tr>}</tbody>
      </table>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) { return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>; }
