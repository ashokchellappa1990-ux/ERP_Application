"use client";

import { useCallback, useEffect, useState } from "react";
import { Ticket, Save, Loader2, Plus, Pencil, X, Settings2, Megaphone, ListChecks, Trash2, Wand2 } from "lucide-react";
import { CouponDesigner } from "@/components/coupon/CouponDesigner";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  COUPON_TYPES, CAMPAIGN_STATUS, DISCOUNT_TYPES, USAGE_TYPES, GST_RULES, CUSTOMER_MAPPING, CONDITION_TYPES, CHANNELS, PAYMENT_MODES,
  type CouponConfig, type CampaignRow, type RuleRow, type AccountRef,
} from "@/lib/contracts/coupon";

const API = "/api/coupon";
const inputCls = "h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none";

const FLAGS: { key: keyof CouponConfig; label: string }[] = [
  { key: "enableModule", label: "Enable Coupon Module" }, { key: "enableGeneric", label: "Enable Generic Coupon" }, { key: "enableUnique", label: "Enable Unique Coupon" },
  { key: "enableQr", label: "Enable QR Code" }, { key: "enableBarcode", label: "Enable Barcode" }, { key: "enableCustomerMapping", label: "Enable Customer Mapping" },
  { key: "enableMultiPerInvoice", label: "Multiple Coupons Per Invoice" }, { key: "allowWithLoyalty", label: "Allow with Loyalty" }, { key: "allowWithMembership", label: "Allow with Membership Discount" },
  { key: "allowWithPromo", label: "Allow with Promotional Discount" }, { key: "allowWithManual", label: "Allow with Manual Discount" }, { key: "allowReturnRestore", label: "Restore on Sales Return" },
  { key: "allowCancelRestore", label: "Restore on Sales Cancellation" }, { key: "enableApproval", label: "Enable Coupon Approval" }, { key: "enablePrinting", label: "Enable Coupon Printing" },
  { key: "enableDesigner", label: "Enable Coupon Designer" }, { key: "enableBatchGen", label: "Enable Batch Generation" },
];

export function CouponConfigConsole() {
  const [tab, setTab] = useState<"config" | "campaigns" | "designer">("config");
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>System</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Coupon Configuration</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Ticket className="h-5 w-5 text-primary" /> Coupon Configuration</h1>
        <p className="mt-0.5 text-sm text-muted">Metadata-driven coupon rules, campaigns &amp; numbering — the promotion engine.</p>
      </div>
      <div className="flex gap-1 border-b border-border">
        {([["config", "Configuration", Settings2], ["campaigns", "Campaigns & Rules", Megaphone], ["designer", "Coupon Designer", Wand2]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold transition", tab === id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}><Icon className="h-4 w-4" /> {label}</button>
        ))}
      </div>
      {tab === "config" ? <ConfigTab /> : tab === "campaigns" ? <CampaignsTab /> : <CouponDesigner />}
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-foreground">{title}</p>{action}</div>{children}</div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }

// -------------------------------------------------------------------- config tab

function ConfigTab() {
  const toast = useToast();
  const [cfg, setCfg] = useState<CouponConfig | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { fetch(`${API}/config`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setCfg(j.config); }).catch(() => {}); }, []);
  const set = (k: keyof CouponConfig, v: unknown) => setCfg((c) => (c ? { ...c, [k]: v } : c));
  async function save() {
    if (!cfg) return; setSaving(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveConfig", ...cfg }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setSaving(false); if (toast.result(j, "Configuration saved.") && j.config) setCfg(j.config);
  }
  if (!cfg) return <div className="py-16"><AppLoader label="Loading configuration…" /></div>;
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><Button size="md" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Configuration</Button></div>
      <Card title="General Configuration">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FLAGS.map((f) => <label key={f.key} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm"><span className="text-foreground">{f.label}</span><Switch checked={!!cfg[f.key]} onChange={(v) => set(f.key, v)} /></label>)}
        </div>
        <div className="mt-3"><F label="Customer Mapping"><select value={cfg.customerMapping} onChange={(e) => set("customerMapping", e.target.value)} className={cn(inputCls, "w-56")}>{CUSTOMER_MAPPING.map((m) => <option key={m} value={m}>{m}</option>)}</select></F></div>
      </Card>
      <Card title="Numbering & Codes">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <F label="Coupon Prefix"><input value={cfg.couponPrefix} onChange={(e) => set("couponPrefix", e.target.value)} className={inputCls} /></F>
          <F label="Coupon Number Length"><input type="number" value={cfg.couponLength} onChange={(e) => set("couponLength", Number(e.target.value) || 10)} className={inputCls} /></F>
          <F label="Running Number"><input readOnly value={cfg.runningNumber} className={cn(inputCls, "bg-surface text-muted")} /></F>
          <F label="Default Status"><input value={cfg.defaultStatus} onChange={(e) => set("defaultStatus", e.target.value)} className={inputCls} /></F>
          <F label="QR Code Size (px)"><input type="number" value={cfg.qrSize} onChange={(e) => set("qrSize", Number(e.target.value) || 120)} className={inputCls} /></F>
          <F label="Barcode Type"><input value={cfg.barcodeType} onChange={(e) => set("barcodeType", e.target.value)} className={inputCls} /></F>
        </div>
        <p className="mt-2 text-2xs text-muted">Next coupon: <span className="font-mono font-semibold text-foreground">{cfg.couponPrefix}{String(cfg.runningNumber + 1).padStart(Math.max(1, cfg.couponLength - cfg.couponPrefix.length), "0")}</span></p>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ campaigns tab

function CampaignsTab() {
  const toast = useToast();
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<CampaignRow | "new" | null>(null);
  const [rulesFor, setRulesFor] = useState<CampaignRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`${API}/campaigns`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setRows(j.rows); setAccounts(j.accounts); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><p className="text-sm text-muted">Marketing campaigns and their promotion rules.</p><Button size="sm" onClick={() => setEdit("new")}><Plus className="h-3.5 w-3.5" /> New Campaign</Button></div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-surface-2 text-2xs uppercase tracking-wide text-subtle"><tr><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5 text-center">Coupons</th><th className="px-3 py-2.5 text-center">Redeemed</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-border">
            {loading ? <tr><td colSpan={7} className="px-3 py-10 text-center text-muted">Loading…</td></tr>
              : !rows.length ? <tr><td colSpan={7} className="px-3 py-10 text-center text-muted">No campaigns yet.</td></tr>
              : rows.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2/30">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{c.code}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                  <td className="px-3 py-2 text-xs text-muted">{c.couponType} · {c.campaignType}</td>
                  <td className="px-3 py-2 text-center">{c.couponCount}</td>
                  <td className="px-3 py-2 text-center">{c.redeemedCount}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={c.status === "Active" ? "success" : c.status === "Cancelled" || c.status === "Expired" ? "danger" : c.status === "Paused" ? "warning" : "neutral"}>{c.status}</Badge></td>
                  <td className="px-3 py-2 text-right"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => setRulesFor(c)} title="Rules" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-2xs font-semibold text-muted hover:border-primary/40 hover:text-primary"><ListChecks className="h-3.5 w-3.5" /> Rules</button>
                    <button onClick={() => setEdit(c)} title="Edit" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted hover:border-primary/40 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                  </div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {edit && <CampaignModal campaign={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {rulesFor && <RulesDrawer campaign={rulesFor} accounts={accounts} onClose={() => setRulesFor(null)} />}
    </div>
  );
}

function CampaignModal({ campaign, onClose, onSaved }: { campaign: CampaignRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ code: campaign?.code ?? "", name: campaign?.name ?? "", campaignType: campaign?.campaignType ?? "Promotion", priority: campaign?.priority ?? 0, couponType: campaign?.couponType ?? "Unique", status: campaign?.status ?? "Draft", startDate: campaign?.startDate ?? "", endDate: campaign?.endDate ?? "", marketingBudget: campaign?.marketingBudget ?? 0, remarks: "" });
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    if (!f.code.trim() || !f.name.trim()) { toast.error("Code and name are required."); return; }
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveCampaign", ...(campaign ? { id: campaign.id } : {}), ...f }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false); if (toast.result(j, "Campaign saved.")) onSaved();
  }
  return (
    <Modal title={campaign ? "Edit Campaign" : "New Campaign"} onClose={onClose} onSave={save} busy={busy}>
      <div className="grid grid-cols-2 gap-3">
        <F label="Campaign Code"><input value={f.code} onChange={(e) => set("code", e.target.value)} className={inputCls} /></F>
        <F label="Campaign Name"><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></F>
        <F label="Coupon Type"><select value={f.couponType} onChange={(e) => set("couponType", e.target.value)} className={inputCls}>{COUPON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></F>
        <F label="Campaign Type"><input value={f.campaignType} onChange={(e) => set("campaignType", e.target.value)} className={inputCls} /></F>
        <F label="Priority"><input type="number" value={f.priority} onChange={(e) => set("priority", Number(e.target.value) || 0)} className={inputCls} /></F>
        <F label="Status"><select value={f.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>{CAMPAIGN_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></F>
        <F label="Start Date"><input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputCls} /></F>
        <F label="End Date"><input type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} className={inputCls} /></F>
        <F label="Marketing Budget (₹)"><input type="number" value={f.marketingBudget} onChange={(e) => set("marketingBudget", Number(e.target.value) || 0)} className={inputCls} /></F>
      </div>
    </Modal>
  );
}

function RulesDrawer({ campaign, accounts, onClose }: { campaign: CampaignRow; accounts: AccountRef[]; onClose: () => void }) {
  const toast = useToast();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [edit, setEdit] = useState<RuleRow | "new" | null>(null);
  const load = useCallback(async () => { const j = await fetch(`${API}/rules?campaignId=${campaign.id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setRules(j.rows); }, [campaign.id]);
  useEffect(() => { load(); }, [load]);
  const del = async (id: number) => { if (!window.confirm("Delete this rule?")) return; const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteRule", ruleId: id }) }).then((r) => r.json()); if (toast.result(j, "Rule deleted.")) load(); };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h2 className="text-sm font-bold text-foreground">Rules — {campaign.name}</h2><div className="flex gap-2"><Button size="sm" onClick={() => setEdit("new")}><Plus className="h-3.5 w-3.5" /> Add Rule</Button><button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div></div>
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {!rules.length ? <p className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-4 text-center text-sm text-muted">No rules. Add a discount rule to activate coupons.</p>
            : rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                <div><p className="text-sm font-semibold text-foreground">{r.name}</p><p className="text-2xs text-muted">{r.discountType} {r.discountValue}{r.discountType === "Percentage" ? "%" : ""}{r.maxDiscount ? ` · max ₹${r.maxDiscount}` : ""}{r.minBill ? ` · min bill ₹${r.minBill}` : ""} · {r.usageType} · {r.conditions.length} condition(s)</p></div>
                <div className="flex gap-1"><button onClick={() => setEdit(r)} className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted hover:border-primary/40 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => del(r.id)} className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted hover:border-danger/40 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></div>
              </div>
            ))}
        </div>
        {edit && <RuleModal campaignId={campaign.id} rule={edit === "new" ? null : edit} accounts={accounts} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      </div>
    </div>
  );
}

function RuleModal({ campaignId, rule, accounts, onClose, onSaved }: { campaignId: number; rule: RuleRow | null; accounts: AccountRef[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: rule?.name ?? "", discountType: rule?.discountType ?? "Percentage", discountValue: rule?.discountValue ?? 0, maxDiscount: rule?.maxDiscount ?? 0,
    minBill: rule?.minBill ?? 0, minQty: rule?.minQty ?? 0, minProductCount: rule?.minProductCount ?? 0, usageType: rule?.usageType ?? "SingleUse",
    maxPerCustomer: rule?.maxPerCustomer ?? 0, maxPerDay: rule?.maxPerDay ?? 0, maxPerCampaign: rule?.maxPerCampaign ?? 0,
    gstRule: rule?.gstRule ?? "AfterGST", reduceTaxable: rule?.reduceTaxable ?? true, salesDiscountCode: rule?.salesDiscountCode || "3060", marketingExpenseCode: rule?.marketingExpenseCode || "4210",
  });
  const [conditions, setConditions] = useState<{ condType: string; operator: string; valueJson: string }[]>(rule?.conditions.map((c) => ({ condType: c.condType, operator: c.operator, valueJson: c.valueJson })) ?? []);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const setCond = (i: number, patch: Partial<{ condType: string; operator: string; valueJson: string }>) => setConditions((cs) => cs.map((c, x) => (x === i ? { ...c, ...patch } : c)));

  async function save() {
    if (!f.name.trim()) { toast.error("Rule name is required."); return; }
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveRule", campaignId, ...(rule ? { ruleId: rule.id } : {}), ...f, conditions }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false); if (toast.result(j, "Rule saved.")) onSaved();
  }
  const condPlaceholder = (t: string) => t === "Channel" ? `e.g. ["POS"] from ${CHANNELS.join("/")}` : t === "Payment" ? `e.g. ["Cash"] from ${PAYMENT_MODES.join("/")}` : "comma / JSON list of ids or values";
  return (
    <Modal title={rule ? "Edit Rule" : "New Rule"} onClose={onClose} onSave={save} busy={busy} wide>
      <p className="mb-2 text-2xs text-muted">IF conditions match → THEN apply the discount. This is the metadata-driven rule (visual drag builder is Phase 2).</p>
      <div className="grid grid-cols-2 gap-3">
        <F label="Rule Name"><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></F>
        <F label="Discount Type"><select value={f.discountType} onChange={(e) => set("discountType", e.target.value)} className={inputCls}>{DISCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></F>
        <F label="Discount Value"><input type="number" value={f.discountValue} onChange={(e) => set("discountValue", Number(e.target.value) || 0)} className={inputCls} /></F>
        <F label="Max Discount (₹)"><input type="number" value={f.maxDiscount} onChange={(e) => set("maxDiscount", Number(e.target.value) || 0)} className={inputCls} /></F>
        <F label="Min Bill (₹)"><input type="number" value={f.minBill} onChange={(e) => set("minBill", Number(e.target.value) || 0)} className={inputCls} /></F>
        <F label="Min Quantity"><input type="number" value={f.minQty} onChange={(e) => set("minQty", Number(e.target.value) || 0)} className={inputCls} /></F>
        <F label="Min Product Count"><input type="number" value={f.minProductCount} onChange={(e) => set("minProductCount", Number(e.target.value) || 0)} className={inputCls} /></F>
        <F label="Usage Type"><select value={f.usageType} onChange={(e) => set("usageType", e.target.value)} className={inputCls}>{USAGE_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}</select></F>
        <F label="Max / Customer"><input type="number" value={f.maxPerCustomer} onChange={(e) => set("maxPerCustomer", Number(e.target.value) || 0)} className={inputCls} /></F>
        <F label="Max / Day"><input type="number" value={f.maxPerDay} onChange={(e) => set("maxPerDay", Number(e.target.value) || 0)} className={inputCls} /></F>
        <F label="Max / Campaign"><input type="number" value={f.maxPerCampaign} onChange={(e) => set("maxPerCampaign", Number(e.target.value) || 0)} className={inputCls} /></F>
        <F label="GST Rule"><select value={f.gstRule} onChange={(e) => set("gstRule", e.target.value)} className={inputCls}>{GST_RULES.map((g) => <option key={g} value={g}>{g}</option>)}</select></F>
        <F label="Sales Discount A/c"><select value={f.salesDiscountCode} onChange={(e) => set("salesDiscountCode", e.target.value)} className={inputCls}>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></F>
        <F label="Marketing Expense A/c"><select value={f.marketingExpenseCode} onChange={(e) => set("marketingExpenseCode", e.target.value)} className={inputCls}>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></F>
        <label className="flex items-center gap-2 self-end text-sm text-foreground"><Switch checked={f.reduceTaxable} onChange={(v) => set("reduceTaxable", v)} /> Reduce taxable value (GST)</label>
      </div>
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between"><p className="text-2xs font-bold uppercase tracking-wide text-subtle">Conditions</p><button onClick={() => setConditions((c) => [...c, { condType: "Channel", operator: "in", valueJson: "" }])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Plus className="h-3.5 w-3.5" /> Add condition</button></div>
        {conditions.map((c, i) => (
          <div key={i} className="mb-1.5 flex items-center gap-2">
            <select value={c.condType} onChange={(e) => setCond(i, { condType: e.target.value })} className={cn(inputCls, "w-36")}>{CONDITION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <select value={c.operator} onChange={(e) => setCond(i, { operator: e.target.value })} className={cn(inputCls, "w-24")}><option value="in">in</option><option value="not_in">not in</option></select>
            <input value={c.valueJson} onChange={(e) => setCond(i, { valueJson: e.target.value })} placeholder={condPlaceholder(c.condType)} className={inputCls} />
            <button onClick={() => setConditions((cs) => cs.filter((_, x) => x !== i))} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose, onSave, busy, wide }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void; busy: boolean; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative z-10 flex max-h-[88vh] w-full flex-col rounded-2xl border border-border bg-card shadow-2xl", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h2 className="text-sm font-bold text-foreground">{title}</h2><button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={busy} onClick={onSave}>{busy ? "Saving…" : "Save"}</Button></div>
      </div>
    </div>
  );
}
