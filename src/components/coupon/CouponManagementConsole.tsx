"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ticket, LayoutDashboard, Sparkles, ListChecks, Send, ScanLine, ScrollText, Printer, Search, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { BATCH_SIZES, CHANNELS, PAYMENT_MODES, ISSUE_TO, COUPON_STATUS, type CampaignRow, type CouponRow, type CouponDashboard, type ValidateResult, type CouponAuditRow } from "@/lib/contracts/coupon";

const API = "/api/coupon";
const inputCls = "h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none";
const today = () => new Date().toISOString().slice(0, 10);

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "generate", label: "Generate", icon: Sparkles },
  { id: "coupons", label: "Coupons", icon: ListChecks },
  { id: "issue", label: "Issue", icon: Send },
  { id: "redeem", label: "Redeem", icon: ScanLine },
  { id: "audit", label: "Audit", icon: ScrollText },
] as const;

export function CouponManagementConsole() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("dashboard");
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const loadCampaigns = useCallback(async () => { const j = await fetch(`${API}/campaigns`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setCampaigns(j.rows); }, []);
  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/crm" className="hover:text-foreground">CRM</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Coupon Management</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Ticket className="h-5 w-5 text-primary" /> Coupon Campaign & Promotion Management</h1>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => { const Icon = t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold transition", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}><Icon className="h-4 w-4" /> {t.label}</button>; })}
      </div>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "generate" && <GenerateTab campaigns={campaigns} />}
      {tab === "coupons" && <CouponsTab campaigns={campaigns} />}
      {tab === "issue" && <IssueTab />}
      {tab === "redeem" && <RedeemTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  const c: Record<string, string> = { success: "text-success", primary: "text-primary", info: "text-info", warning: "text-warning", danger: "text-danger" };
  return <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p><p className={cn("mt-1 text-[15px] font-bold", tone ? c[tone] : "text-foreground")}>{value}</p></div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) { return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-foreground">{title}</p>{action}</div>{children}</div>; }

function DashboardTab() {
  const fmt = useFmt();
  const [d, setD] = useState<CouponDashboard | null>(null);
  useEffect(() => { fetch(`${API}/dashboard`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setD(j.data); }).catch(() => {}); }, []);
  if (!d) return <div className="py-10 text-center text-sm text-muted">Loading…</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Kpi label="Active Campaigns" value={d.activeCampaigns} tone="primary" />
        <Kpi label="Generated" value={d.generated} />
        <Kpi label="Printed" value={d.printed} tone="info" />
        <Kpi label="Issued" value={d.issued} tone="info" />
        <Kpi label="Redeemed" value={d.redeemed} tone="success" />
        <Kpi label="Expired" value={d.expired} tone="warning" />
        <Kpi label="Cancelled" value={d.cancelled} tone="danger" />
        <Kpi label="Total Discount" value={fmt.money(d.totalDiscount)} tone="danger" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Top Campaigns">
          {!d.topCampaigns.length ? <p className="py-4 text-center text-sm text-muted">No redemptions yet.</p> : d.topCampaigns.map((c, i) => <div key={i} className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-0"><span className="text-foreground">{c.name}</span><span className="text-muted">{c.redeemed} redeemed · {fmt.money(c.discount)}</span></div>)}
        </Card>
        <Card title="Monthly Redemption Trend">
          {!d.monthlyRedemption.length ? <p className="py-4 text-center text-sm text-muted">No data.</p> : (
            <div className="flex h-40 items-end justify-between gap-2">
              {d.monthlyRedemption.map((m, i) => { const max = Math.max(...d.monthlyRedemption.map((x) => x.value), 1); return <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1"><span className="text-2xs text-muted">{m.value}</span><div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(3, (m.value / max) * 120)}px` }} /><span className="text-2xs text-subtle">{m.name.slice(5)}</span></div>; })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function GenerateTab({ campaigns }: { campaigns: CampaignRow[] }) {
  const toast = useToast();
  const [campaignId, setCampaignId] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [expiryDate, setExpiryDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ batchNo: string; count: number; firstNo: string; lastNo: string } | null>(null);
  async function generate() {
    if (!campaignId) { toast.error("Select a campaign."); return; }
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", campaignId: Number(campaignId), quantity: Number(quantity) || 1, expiryDate: expiryDate || undefined }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false); if (toast.result(j)) setResult({ batchNo: j.batchNo, count: j.count, firstNo: j.firstNo, lastNo: j.lastNo });
  }
  return (
    <div className="space-y-4">
      <Card title="Generate Coupons">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <F label="Campaign"><select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={inputCls}><option value="">Select campaign…</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></F>
          <F label="Quantity"><input type="number" list="batch-sizes" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} /><datalist id="batch-sizes">{BATCH_SIZES.map((n) => <option key={n} value={n} />)}</datalist></F>
          <F label="Expiry Date (optional)"><input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputCls} /></F>
          <div className="flex items-end"><Button size="md" disabled={busy} onClick={generate}>{busy ? "Generating…" : "Generate"}</Button></div>
        </div>
        <p className="mt-2 text-2xs text-muted">Each coupon gets a unique number, coupon code, QR data, barcode data &amp; security code.</p>
      </Card>
      {result && <div className="rounded-xl border border-success/30 bg-success-subtle/30 px-4 py-3 text-sm text-success"><CheckCircle2 className="mr-1 inline h-4 w-4" /> Batch <b>{result.batchNo}</b> — {result.count} coupons generated ({result.firstNo} … {result.lastNo}).</div>}
    </div>
  );
}

function CouponsTab({ campaigns }: { campaigns: CampaignRow[] }) {
  const toast = useToast();
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [templates, setTemplates] = useState<{ id: number; name: string; category: string }[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [perPage, setPerPage] = useState("4");
  const [campaignId, setCampaignId] = useState("");
  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const load = useCallback(async () => {
    const params = new URLSearchParams({ status, q, ...(campaignId ? { campaignId } : {}) });
    const j = await fetch(`${API}/coupons?${params}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setRows(j.rows);
  }, [campaignId, status, q]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch(`${API}/templates`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setTemplates(j.rows.map((t: { id: number; name: string; category: string }) => ({ id: t.id, name: t.name, category: t.category }))); }).catch(() => {}); }, []);
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function printCoupons() {
    const chosen = rows.filter((r) => sel.has(r.id));
    if (!chosen.length) { toast.error("Select coupons to print."); return; }
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "renderPrint", couponIds: chosen.map((c) => c.id), templateId: templateId ? Number(templateId) : undefined, perPage: Number(perPage) || 4 }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    if (!j.ok) { toast.error(j.message || "Could not print."); return; }
    const w = window.open("", "_blank", "width=1000,height=1000"); if (w) { w.document.write(j.html); w.document.close(); }
    load();
  }
  const tone = (s: string) => s === "Redeemed" ? "success" : s === "Issued" ? "info" : s === "Printed" ? "info" : s === "Cancelled" || s === "Expired" ? "danger" : "neutral";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={cn(inputCls, "w-56")}><option value="">All campaigns</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inputCls, "w-40")}><option>All</option>{COUPON_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <div className="relative flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coupon…" className={cn(inputCls, "pl-8")} /></div>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={cn(inputCls, "w-44")} title="Print template"><option value="">Default template</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.category} · {t.name}</option>)}</select>
        <select value={perPage} onChange={(e) => setPerPage(e.target.value)} className={cn(inputCls, "w-24")} title="Per page">{[1, 2, 4, 8].map((n) => <option key={n} value={n}>{n}/page</option>)}</select>
        <Button size="sm" onClick={printCoupons} disabled={!sel.size}><Printer className="h-3.5 w-3.5" /> Print ({sel.size})</Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-surface-2 text-2xs uppercase tracking-wide text-subtle"><tr><th className="px-3 py-2.5"></th><th className="px-3 py-2.5">Coupon No</th><th className="px-3 py-2.5">Campaign</th><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5">Expiry</th><th className="px-3 py-2.5 text-center">Status</th></tr></thead>
          <tbody className="divide-y divide-border">
            {!rows.length ? <tr><td colSpan={6} className="px-3 py-10 text-center text-muted">No coupons.</td></tr>
              : rows.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2/30">
                  <td className="px-3 py-2"><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} /></td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{c.couponNo}</td>
                  <td className="px-3 py-2 text-foreground">{c.campaignName}</td>
                  <td className="px-3 py-2 text-muted">{c.customerName || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{c.expiryDate || "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={tone(c.status)}>{c.status}</Badge></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IssueTab() {
  const toast = useToast();
  const [couponNo, setCouponNo] = useState("");
  const [issueTo, setIssueTo] = useState("Customer");
  const [customerId, setCustomerId] = useState("");
  const [partyName, setPartyName] = useState("");
  const [busy, setBusy] = useState(false);
  async function issue() {
    if (!couponNo.trim()) { toast.error("Enter a coupon number."); return; }
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "issue", couponNo, issueTo, customerId: customerId ? Number(customerId) : undefined, partyName: partyName || undefined, issueDate: today() }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false); if (toast.result(j)) { setCouponNo(""); setPartyName(""); setCustomerId(""); }
  }
  return (
    <div className="space-y-4"><Card title="Issue Coupon">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <F label="Coupon Number"><input value={couponNo} onChange={(e) => setCouponNo(e.target.value)} placeholder="CPN…" className={inputCls} /></F>
        <F label="Issue To"><select value={issueTo} onChange={(e) => setIssueTo(e.target.value)} className={inputCls}>{ISSUE_TO.map((i) => <option key={i} value={i}>{i}</option>)}</select></F>
        <F label="Customer Id (optional)"><input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Customer id" className={inputCls} /></F>
        <F label="Party Name (optional)"><input value={partyName} onChange={(e) => setPartyName(e.target.value)} className={inputCls} /></F>
      </div>
      <div className="mt-3 flex justify-end"><Button size="md" disabled={busy} onClick={issue}><Send className="h-4 w-4" /> Issue Coupon</Button></div>
    </Card></div>
  );
}

function RedeemTab() {
  const toast = useToast();
  const fmt = useFmt();
  const [couponCode, setCouponCode] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [channel, setChannel] = useState("POS");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [customerId, setCustomerId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [post, setPost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ValidateResult | null>(null);
  const body = () => ({ couponCode, billAmount: Number(billAmount) || 0, channel, paymentMode, customerId: customerId ? Number(customerId) : undefined, invoiceNo: invoiceNo || undefined });
  async function validate() {
    if (!couponCode.trim()) { toast.error("Enter a coupon number/code."); return; }
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "validate", ...body() }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false); if (j.ok) setRes(j.data); else toast.error(j.message || "Failed.");
  }
  async function redeem() {
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redeem", ...body(), post }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false); if (toast.result(j)) { setRes(null); setCouponCode(""); setBillAmount(""); }
  }
  return (
    <div className="space-y-4">
      <Card title="Redeem / Validate Coupon">
        <p className="mb-3 text-2xs text-muted">Scan QR / barcode or enter the coupon number. The engine validates the campaign, customer mapping, purchase rules, usage limits &amp; expiry, then computes the discount. (POS billing calls this same engine.)</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <F label="Coupon No / Code"><input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="CPN… / code" className={inputCls} /></F>
          <F label="Bill Amount (₹)"><input type="number" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} className={inputCls} /></F>
          <F label="Channel"><select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>{CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</select></F>
          <F label="Payment Mode"><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={inputCls}>{PAYMENT_MODES.map((p) => <option key={p} value={p}>{p}</option>)}</select></F>
          <F label="Customer Id (optional)"><input value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls} /></F>
          <F label="Invoice No (optional)"><input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={inputCls} /></F>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button size="md" variant="outline" disabled={busy} onClick={validate}><ScanLine className="h-4 w-4" /> Validate</Button>
          <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} /> Post GL (Dr Marketing Expense / Cr Sales Discount)</label>
        </div>
      </Card>
      {res && (
        <div className={cn("rounded-2xl border p-4 shadow-sm", res.valid ? "border-success/30 bg-success-subtle/20" : "border-danger/30 bg-danger-subtle/20")}>
          {res.valid ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-bold text-success"><CheckCircle2 className="h-4 w-4" /> Valid — {res.campaignName}</p>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><p className="text-2xs text-muted">Discount Type</p><p className="font-semibold text-foreground">{res.discountType}</p></div>
                <div><p className="text-2xs text-muted">Discount</p><p className="font-semibold text-foreground">{fmt.money(res.discountAmount)}</p></div>
                <div><p className="text-2xs text-muted">Taxable Reduced</p><p className="font-semibold text-foreground">{fmt.money(res.taxableReduced)}</p></div>
                <div><p className="text-2xs text-muted">GST Rule</p><p className="font-semibold text-foreground">{res.gstRule}</p></div>
                {res.freeProductId ? <div><p className="text-2xs text-muted">Free Product</p><p className="font-semibold text-foreground">#{res.freeProductId} × {res.freeQty}</p></div> : null}
              </div>
              <div className="flex justify-end"><Button size="sm" disabled={busy} onClick={redeem}><CheckCircle2 className="h-3.5 w-3.5" /> Redeem</Button></div>
            </div>
          ) : <p className="text-sm font-semibold text-danger">✗ {res.reason}</p>}
        </div>
      )}
    </div>
  );
}

function AuditTab() {
  const [rows, setRows] = useState<CouponAuditRow[]>([]);
  useEffect(() => { fetch(`${API}/audit`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setRows(j.rows); }).catch(() => {}); }, []);
  return (
    <Card title="Coupon Audit Trail">
      {!rows.length ? <p className="py-6 text-center text-sm text-muted">No activity yet.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-2xs uppercase text-subtle"><tr><th className="py-1.5 pr-3">Action</th><th className="py-1.5 pr-3">Entity</th><th className="py-1.5 pr-3">Detail</th><th className="py-1.5 pr-3">By</th><th className="py-1.5">When</th></tr></thead><tbody className="divide-y divide-border">{rows.map((a) => <tr key={a.id}><td className="py-1.5 pr-3 font-medium text-primary">{a.action}</td><td className="py-1.5 pr-3 text-xs text-muted">{a.entityType}</td><td className="py-1.5 pr-3 text-muted">{a.note}</td><td className="py-1.5 pr-3 text-muted">{a.byName}</td><td className="py-1.5 text-2xs text-subtle">{a.at ? new Date(a.at).toLocaleString() : ""}</td></tr>)}</tbody></table></div>
      )}
    </Card>
  );
}
