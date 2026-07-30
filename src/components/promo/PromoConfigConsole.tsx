"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings2, Megaphone, Plus, X, Save, Trash2, SlidersHorizontal, Ticket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  PROMO_CUSTOMER_MAPPING, CONFLICT_RESOLUTION, PROMO_CAMPAIGN_STATUS, PROMO_CAMPAIGN_TYPES, CODE_MODELS, CODE_MODEL_LABELS,
  DISCOUNT_TYPES, USAGE_TYPES, GST_RULES, CONDITION_TYPES,
  type PromoConfig, type PromoCampaignRow, type RuleRow, type AccountRef,
} from "@/lib/contracts/promo";

const API = "/api/promo";
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
type Tab = "config" | "campaigns";

export function PromoConfigConsole() {
  const [tab, setTab] = useState<Tab>("config");
  const [msg, setMsg] = useState("");
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2600); };
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>System</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Promo Configuration</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Megaphone className="h-5 w-5 text-primary" /> Promo Code Configuration</h1>
      </div>
      <div className="flex gap-1 border-b border-border">
        {([["config", "Configuration", Settings2], ["campaigns", "Promo Campaigns", Ticket]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold transition", tab === id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}><Icon className="h-4 w-4" /> {label}</button>
        ))}
      </div>
      {tab === "config" ? <ConfigTab flash={flash} /> : <CampaignsTab flash={flash} />}
      {msg && <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-primary/40 bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg">{msg}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ config */
function ConfigTab({ flash }: { flash: (m: string) => void }) {
  const [cfg, setCfg] = useState<PromoConfig | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => { const j = await fetch(`${API}/config`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setCfg(j.config); })(); }, []);
  if (!cfg) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
  const set = (k: keyof PromoConfig, v: unknown) => setCfg({ ...cfg, [k]: v } as PromoConfig);
  async function save() {
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveConfig", ...cfg }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { setCfg(j.config); flash("Configuration saved."); } else flash(j.message || "Could not save.");
  }
  const FLAGS: [keyof PromoConfig, string][] = [
    ["enableModule", "Enable Promo Code"], ["enableManualCode", "Enable Manual Code"], ["enableAutoCode", "Enable Auto Generated Code"],
    ["enableBulkGen", "Enable Bulk Code Generation"], ["enableCustomerMapping", "Enable Customer Mapping"], ["enableApproval", "Enable Campaign Approval"],
    ["enableAnalytics", "Enable Promotion Analytics"], ["enableExpiryNotify", "Enable Expiry Notification"], ["enableUsageNotify", "Enable Usage Notification"],
    ["enableMultiPerInvoice", "Multiple Promo Codes / Invoice"], ["allowWithLoyalty", "Allow with Loyalty"], ["allowWithMembership", "Allow with Membership"],
    ["allowWithCoupon", "Allow with Coupon"], ["allowWithManual", "Allow with Manual Discount"], ["allowWithGiftVoucher", "Allow with Gift Voucher"],
    ["allowReturnRestore", "Restore on Sales Return"], ["allowCancelRestore", "Restore on Cancellation"],
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-foreground">Feature Flags</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FLAGS.map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm">
              <span className="text-foreground">{label}</span>
              <input type="checkbox" checked={!!cfg[k]} onChange={(e) => set(k, e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-foreground">Customer Mapping & Priority</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Customer Mapping</label><select value={cfg.customerMapping} onChange={(e) => set("customerMapping", e.target.value)} className={inp}>{PROMO_CUSTOMER_MAPPING.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className={lbl}>Conflict Resolution</label><select value={cfg.conflictResolution} onChange={(e) => set("conflictResolution", e.target.value)} className={inp}>{CONFLICT_RESOLUTION.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className={lbl}>Priority</label><input type="number" value={cfg.priority} onChange={(e) => set("priority", Number(e.target.value))} className={inp} /></div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-foreground">Code Model & Numbering</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={lbl}>Usage Model</label><select value={cfg.codeModel} onChange={(e) => set("codeModel", e.target.value)} className={inp}>{CODE_MODELS.map((m) => <option key={m} value={m}>{CODE_MODEL_LABELS[m]}</option>)}</select><p className="mt-1 text-[10px] text-subtle">{cfg.codeModel === "SameCode" ? "One shared code for everyone; each customer can redeem it only once." : "Generate a quantity of unique codes — one code per customer."}</p></div>
            <div><label className={lbl}>Prefix</label><input value={cfg.codePrefix} onChange={(e) => set("codePrefix", e.target.value.toUpperCase())} className={inp} /></div>
            <div><label className={lbl}>Code Length</label><input type="number" value={cfg.codeLength} onChange={(e) => set("codeLength", Number(e.target.value))} className={inp} /></div>
            <div><label className={lbl}>Running Number</label><input type="number" value={cfg.runningNumber} disabled className={cn(inp, "opacity-60")} /></div>
            <div><label className={lbl}>Default Status</label><input value={cfg.defaultStatus} onChange={(e) => set("defaultStatus", e.target.value)} className={inp} /></div>
          </div>
        </div>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Configuration"}</Button></div>
    </div>
  );
}

/* --------------------------------------------------------------- campaigns */
const EMPTY_CAMP = { code: "", name: "", description: "", campaignType: "Digital", marketingBudget: 0, campaignOwner: "", priority: 0, startDate: "", endDate: "", status: "Draft", remarks: "" };
function CampaignsTab({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<PromoCampaignRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRef[]>([]);
  const [modal, setModal] = useState<null | { id?: number; data: typeof EMPTY_CAMP }>(null);
  const [drawer, setDrawer] = useState<null | PromoCampaignRow>(null);
  const load = useCallback(async () => { const j = await fetch(`${API}/campaigns`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) { setRows(j.rows); setAccounts(j.accounts || []); } }, []);
  useEffect(() => { load(); }, [load]);

  async function saveCamp() {
    if (!modal) return;
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveCampaign", ...(modal.id ? { id: modal.id } : {}), ...modal.data }) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setModal(null); load(); flash("Campaign saved."); } else flash(j.message || "Could not save.");
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted">{rows.length} campaign(s)</span>
        <Button size="sm" onClick={() => setModal({ data: { ...EMPTY_CAMP } })}><Plus className="h-3.5 w-3.5" /> New Campaign</Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Owner</th><th className="px-3 py-2.5 text-right">Budget</th><th className="px-3 py-2.5 text-center">Codes</th><th className="px-3 py-2.5 text-center">Redeemed</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2/40">
                <td className="px-3 py-2 font-mono text-2xs text-foreground">{c.code}</td>
                <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                <td className="px-3 py-2 text-muted">{c.campaignType}</td>
                <td className="px-3 py-2 text-muted">{c.campaignOwner || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.marketingBudget.toLocaleString()}</td>
                <td className="px-3 py-2 text-center tabular-nums">{c.codeCount}</td>
                <td className="px-3 py-2 text-center tabular-nums">{c.redeemedCount}</td>
                <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", c.status === "Active" ? "bg-success-subtle text-success" : c.status === "Draft" ? "bg-surface-2 text-muted" : "bg-warning-subtle text-warning")}>{c.status}</span></td>
                <td className="px-3 py-2 text-right"><div className="flex justify-end gap-1">
                  <button onClick={() => setDrawer(c)} className="rounded-md border border-border px-2 py-1 text-2xs font-semibold text-primary hover:border-primary"><SlidersHorizontal className="mr-1 inline h-3 w-3" />Rules</button>
                  <button onClick={() => setModal({ id: c.id, data: { code: c.code, name: c.name, description: "", campaignType: c.campaignType, marketingBudget: c.marketingBudget, campaignOwner: c.campaignOwner, priority: c.priority, startDate: c.startDate, endDate: c.endDate, status: c.status, remarks: "" } })} className="rounded-md border border-border px-2 py-1 text-2xs font-semibold text-muted hover:border-primary hover:text-primary">Edit</button>
                </div></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-muted">No campaigns yet. Create one to start generating promo codes.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.id ? "Edit Campaign" : "New Campaign"} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Campaign Code *</label><input value={modal.data.code} onChange={(e) => setModal({ ...modal, data: { ...modal.data, code: e.target.value } })} className={inp} /></div>
            <div><label className={lbl}>Campaign Name *</label><input value={modal.data.name} onChange={(e) => setModal({ ...modal, data: { ...modal.data, name: e.target.value } })} className={inp} /></div>
            <div><label className={lbl}>Type</label><select value={modal.data.campaignType} onChange={(e) => setModal({ ...modal, data: { ...modal.data, campaignType: e.target.value } })} className={inp}>{PROMO_CAMPAIGN_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className={lbl}>Owner</label><input value={modal.data.campaignOwner} onChange={(e) => setModal({ ...modal, data: { ...modal.data, campaignOwner: e.target.value } })} className={inp} /></div>
            <div><label className={lbl}>Marketing Budget</label><input type="number" value={modal.data.marketingBudget} onChange={(e) => setModal({ ...modal, data: { ...modal.data, marketingBudget: Number(e.target.value) } })} className={inp} /></div>
            <div><label className={lbl}>Priority</label><input type="number" value={modal.data.priority} onChange={(e) => setModal({ ...modal, data: { ...modal.data, priority: Number(e.target.value) } })} className={inp} /></div>
            <div><label className={lbl}>Start Date</label><input type="date" value={modal.data.startDate} onChange={(e) => setModal({ ...modal, data: { ...modal.data, startDate: e.target.value } })} className={inp} /></div>
            <div><label className={lbl}>End Date</label><input type="date" value={modal.data.endDate} onChange={(e) => setModal({ ...modal, data: { ...modal.data, endDate: e.target.value } })} className={inp} /></div>
            <div><label className={lbl}>Status</label><select value={modal.data.status} onChange={(e) => setModal({ ...modal, data: { ...modal.data, status: e.target.value } })} className={inp}>{PROMO_CAMPAIGN_STATUS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="col-span-2"><label className={lbl}>Description</label><input value={modal.data.description} onChange={(e) => setModal({ ...modal, data: { ...modal.data, description: e.target.value } })} className={inp} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button onClick={saveCamp}><Save className="h-4 w-4" /> Save</Button></div>
        </Modal>
      )}
      {drawer && <RuleDrawer campaign={drawer} accounts={accounts} onClose={() => { setDrawer(null); load(); }} flash={flash} />}
    </div>
  );
}

/* ------------------------------------------------------------------- rules */
const EMPTY_RULE = { name: "", discountType: "Percentage", discountValue: 0, maxDiscount: 0, minBill: 0, maxBill: 0, minQty: 0, usageType: "SingleUse", maxPerCustomer: 0, maxPerCampaign: 0, maxPerDay: 0, gstRule: "AfterGST", reduceTaxable: true, salesDiscountCode: "", marketingExpenseCode: "", days: "", conditions: [] as { condType: string; operator: string; valueJson: string }[] };
function RuleDrawer({ campaign, accounts, onClose, flash }: { campaign: PromoCampaignRow; accounts: AccountRef[]; onClose: () => void; flash: (m: string) => void }) {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [form, setForm] = useState<typeof EMPTY_RULE & { ruleId?: number }>({ ...EMPTY_RULE });
  const load = useCallback(async () => { const j = await fetch(`${API}/rules?campaignId=${campaign.id}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRules(j.rows); }, [campaign.id]);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });

  async function save() {
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveRule", campaignId: campaign.id, ...(form.ruleId ? { ruleId: form.ruleId } : {}), ...form }) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setForm({ ...EMPTY_RULE }); load(); flash("Rule saved."); } else flash(j.message || "Could not save the rule.");
  }
  async function del(id: number) { const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteRule", ruleId: id }) }).then((r) => r.json()); if (j.ok) load(); }
  const addCond = () => set("conditions", [...form.conditions, { condType: "Product", operator: "in", valueJson: "" }]);
  const setCond = (i: number, patch: Partial<{ condType: string; operator: string; valueJson: string }>) => set("conditions", form.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="fixed inset-0 z-[95] flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <div><h2 className="text-sm font-bold text-foreground">Promotion Rules — {campaign.name}</h2><p className="text-2xs text-muted">Shared rule engine (same as Coupon)</p></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          {rules.length > 0 && (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm">
                  <div><span className="font-semibold text-foreground">{r.name}</span> <span className="text-2xs text-muted">· {r.discountType} {r.discountValue}{r.discountType === "Percentage" ? "%" : ""}{r.minBill ? ` · min ₹${r.minBill}` : ""} · {r.usageType}</span></div>
                  <div className="flex gap-1">
                    <button onClick={() => setForm({ ...EMPTY_RULE, ...r, ruleId: r.id, conditions: r.conditions.map((c) => ({ condType: c.condType, operator: c.operator, valueJson: c.valueJson })) } as never)} className="text-2xs font-semibold text-primary hover:underline">Edit</button>
                    <button onClick={() => del(r.id)} className="text-danger hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-xl border border-border bg-surface-2/30 p-4">
            <h3 className="mb-3 text-sm font-bold text-foreground">{form.ruleId ? "Edit Rule" : "Add Rule"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={lbl}>Rule Name *</label><input value={form.name} onChange={(e) => set("name", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Discount Type</label><select value={form.discountType} onChange={(e) => set("discountType", e.target.value)} className={inp}>{DISCOUNT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className={lbl}>Discount Value</label><input type="number" value={form.discountValue} onChange={(e) => set("discountValue", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Max Discount</label><input type="number" value={form.maxDiscount} onChange={(e) => set("maxDiscount", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Min Bill</label><input type="number" value={form.minBill} onChange={(e) => set("minBill", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Max Bill</label><input type="number" value={form.maxBill} onChange={(e) => set("maxBill", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Min Qty</label><input type="number" value={form.minQty} onChange={(e) => set("minQty", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Usage Type</label><select value={form.usageType} onChange={(e) => set("usageType", e.target.value)} className={inp}>{USAGE_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className={lbl}>Max / Customer</label><input type="number" value={form.maxPerCustomer} onChange={(e) => set("maxPerCustomer", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Max / Campaign</label><input type="number" value={form.maxPerCampaign} onChange={(e) => set("maxPerCampaign", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>GST Rule</label><select value={form.gstRule} onChange={(e) => set("gstRule", e.target.value)} className={inp}>{GST_RULES.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.reduceTaxable} onChange={(e) => set("reduceTaxable", e.target.checked)} className="h-4 w-4 accent-primary" /> Reduce Taxable Value</label></div>
              <div><label className={lbl}>Sales Discount A/C</label><select value={form.salesDiscountCode} onChange={(e) => set("salesDiscountCode", e.target.value)} className={inp}><option value="">Default</option>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></div>
              <div><label className={lbl}>Marketing Expense A/C</label><select value={form.marketingExpenseCode} onChange={(e) => set("marketingExpenseCode", e.target.value)} className={inp}><option value="">Default</option>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></div>
              <div className="col-span-2"><label className={lbl}>Applicable Days (CSV: Mon,Tue…)</label><input value={form.days} onChange={(e) => set("days", e.target.value)} placeholder="Leave blank for all days" className={inp} /></div>
            </div>
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between"><span className={lbl}>Conditions (products / categories / channels…)</span><button onClick={addCond} className="text-2xs font-semibold text-primary hover:underline">+ Add</button></div>
              {form.conditions.map((c, i) => (
                <div key={i} className="mb-1.5 flex items-center gap-2">
                  <select value={c.condType} onChange={(e) => setCond(i, { condType: e.target.value })} className={cn(inp, "w-40")}>{CONDITION_TYPES.map((x) => <option key={x}>{x}</option>)}</select>
                  <select value={c.operator} onChange={(e) => setCond(i, { operator: e.target.value })} className={cn(inp, "w-24")}><option value="in">in</option><option value="not_in">not in</option></select>
                  <input value={c.valueJson} onChange={(e) => setCond(i, { valueJson: e.target.value })} placeholder="Comma-separated values / ids" className={cn(inp, "flex-1")} />
                  <button onClick={() => set("conditions", form.conditions.filter((_, j) => j !== i))} className="text-danger"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">{form.ruleId && <Button variant="ghost" onClick={() => setForm({ ...EMPTY_RULE })}>Cancel Edit</Button>}<Button onClick={save}><Save className="h-4 w-4" /> {form.ruleId ? "Update Rule" : "Add Rule"}</Button></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">{title}</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface"><X className="h-4 w-4" /></button></div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
