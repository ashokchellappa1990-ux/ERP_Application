"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Settings2, Layers, Filter, Wallet, Gift, CalendarClock, ArrowUpCircle, ArrowDownCircle, RefreshCw, UserCog, Landmark, Bell, CreditCard, ShieldCheck, FileText, ScrollText, Award, Plus, Save, Trash2, X, Download, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { downloadCsv, downloadExcel, printTable } from "@/lib/export/download";
import {
  MEMBERSHIP_TYPES, NUMBER_GENERATION, LEVEL_STATUS, EVAL_PERIODS, QUALIFICATION_METHODS, VALIDITY_TYPES, CARD_TYPES, COMBINE_LOGIC,
  UPGRADE_CRITERIA, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS, NOTIFICATION_EVENT_LABELS, CUSTOMER_FIELDS, CUSTOMER_FIELD_LABELS,
  COUPON_BENEFIT_KEYS, VOUCHER_BENEFIT_KEYS, SERVICE_BENEFIT_KEYS, SERVICE_BENEFIT_LABELS, APPROVAL_WORKFLOW, REPORT_TYPES, REPORT_LABELS,
  type AccountRef, type LevelRow, type QualificationRow, type ReportResult, type ReportType, type AuditRow,
} from "@/lib/contracts/membership";

const API = "/api/membership";
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
const APPROVAL_ROLES = ["marketing-manager", "crm-manager", "store-manager", "admin", "business-owner"];

/* ------------- generic field spec + renderer ------------- */
type Spec = { key: string; label: string; type: "bool" | "num" | "text" | "select" | "account" | "multi"; options?: readonly string[]; multiOptions?: readonly string[] };
type Val = Record<string, unknown>;
function Field({ spec, value, onChange, accounts }: { spec: Spec; value: Val; onChange: (k: string, v: unknown) => void; accounts: AccountRef[] }) {
  const v = value[spec.key];
  if (spec.type === "bool") return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm"><span className="text-foreground">{spec.label}</span><input type="checkbox" checked={!!v} onChange={(e) => onChange(spec.key, e.target.checked)} className="h-4 w-4 accent-primary" /></label>
  );
  return (
    <div>
      <label className={lbl}>{spec.label}</label>
      {spec.type === "num" ? <input type="number" value={v == null ? "" : String(v)} onChange={(e) => onChange(spec.key, Number(e.target.value))} className={inp} />
        : spec.type === "select" ? <select value={String(v ?? "")} onChange={(e) => onChange(spec.key, e.target.value)} className={inp}>{spec.options!.map((o) => <option key={o}>{o}</option>)}</select>
        : spec.type === "account" ? <select value={String(v ?? "")} onChange={(e) => onChange(spec.key, e.target.value)} className={inp}><option value="">Default</option>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select>
        : spec.type === "multi" ? <div className="flex flex-wrap gap-1.5">{spec.multiOptions!.map((o) => { const arr = Array.isArray(v) ? (v as string[]) : []; const on = arr.includes(o); return <button key={o} type="button" onClick={() => onChange(spec.key, on ? arr.filter((x) => x !== o) : [...arr, o])} className={cn("rounded-full border px-2.5 py-1 text-2xs font-semibold", on ? "border-primary bg-primary text-white" : "border-border bg-surface text-muted hover:border-primary")}>{o}</button>; })}</div>
        : <input value={String(v ?? "")} onChange={(e) => onChange(spec.key, e.target.value)} className={inp} />}
    </div>
  );
}
function SpecGrid({ specs, value, onChange, accounts }: { specs: Spec[]; value: Val; onChange: (k: string, v: unknown) => void; accounts: AccountRef[] }) {
  const bools = specs.filter((s) => s.type === "bool");
  const rest = specs.filter((s) => s.type !== "bool");
  return (
    <div className="space-y-3">
      {rest.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rest.map((s) => <Field key={s.key} spec={s} value={value} onChange={onChange} accounts={accounts} />)}</div>}
      {bools.length > 0 && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{bools.map((s) => <Field key={s.key} spec={s} value={value} onChange={onChange} accounts={accounts} />)}</div>}
    </div>
  );
}

/* -------------------- tab definitions -------------------- */
const TABS = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "levels", label: "Levels", icon: Layers },
  { id: "qualification", label: "Qualification", icon: Filter },
  { id: "fee", label: "Fees", icon: Wallet },
  { id: "benefit", label: "Benefits", icon: Gift },
  { id: "validity", label: "Validity", icon: CalendarClock },
  { id: "upgrade", label: "Upgrade", icon: ArrowUpCircle },
  { id: "downgrade", label: "Downgrade", icon: ArrowDownCircle },
  { id: "renewal", label: "Renewal", icon: RefreshCw },
  { id: "customer", label: "Customer Info", icon: UserCog },
  { id: "finance", label: "Finance", icon: Landmark },
  { id: "notification", label: "Notification", icon: Bell },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "approval", label: "Approval", icon: ShieldCheck },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "audit", label: "Audit", icon: ScrollText },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function MembershipConfigConsole() {
  const [tab, setTab] = useState<TabId>("general");
  const [msg, setMsg] = useState("");
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2600); };
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Rewards &amp; Benefits</span><span className="text-subtle">/</span><span>Membership Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Configuration</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Award className="h-5 w-5 text-primary" /> Membership Configuration</h1>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => { const Icon = t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-semibold transition", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}><Icon className="h-4 w-4" /> {t.label}</button>; })}
      </div>

      {tab === "general" && <SingletonTab section="general" action="saveGeneral" specs={GENERAL_SPECS} flash={flash} />}
      {tab === "levels" && <LevelsTab flash={flash} />}
      {tab === "qualification" && <QualificationTab flash={flash} />}
      {tab === "fee" && <LevelConfigTab section="fee" action="saveFee" specs={FEE_SPECS} flash={flash} />}
      {tab === "benefit" && <LevelConfigTab section="benefit" action="saveBenefit" specs={BENEFIT_SPECS} extra="benefit" flash={flash} />}
      {tab === "validity" && <LevelConfigTab section="validity" action="saveValidity" specs={VALIDITY_SPECS} flash={flash} />}
      {tab === "upgrade" && <LevelConfigTab section="upgrade" action="saveUpgrade" specs={UPGRADE_SPECS} flash={flash} />}
      {tab === "downgrade" && <LevelConfigTab section="downgrade" action="saveDowngrade" specs={DOWNGRADE_SPECS} flash={flash} />}
      {tab === "renewal" && <SingletonTab section="renewal" action="saveRenewal" specs={RENEWAL_SPECS} flash={flash} />}
      {tab === "customer" && <CustomerTab flash={flash} />}
      {tab === "finance" && <SingletonTab section="finance" action="saveFinance" specs={FINANCE_SPECS} flash={flash} />}
      {tab === "notification" && <NotificationTab flash={flash} />}
      {tab === "card" && <SingletonTab section="card" action="saveCard" specs={CARD_SPECS} flash={flash} />}
      {tab === "approval" && <ApprovalTab flash={flash} />}
      {tab === "reports" && <ReportsTab />}
      {tab === "audit" && <AuditTab />}

      {msg && <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-primary/40 bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg">{msg}</div>}
    </div>
  );
}

/* --------------- specs --------------- */
const GENERAL_SPECS: Spec[] = [
  { key: "membershipType", label: "Membership Type", type: "select", options: MEMBERSHIP_TYPES },
  { key: "numberGeneration", label: "Number Generation", type: "select", options: NUMBER_GENERATION },
  { key: "numberPrefix", label: "Number Prefix", type: "text" },
  { key: "numberLength", label: "Number Length", type: "num" },
  { key: "defaultStatus", label: "Default Status", type: "text" },
  { key: "renewalReminderDays", label: "Renewal Reminder (days)", type: "num" },
  { key: "expiryReminderDays", label: "Expiry Reminder (days)", type: "num" },
  { key: "gracePeriodDays", label: "Grace Period (days)", type: "num" },
  { key: "enableModule", label: "Enable Membership Module", type: "bool" },
  { key: "allowMultiple", label: "Allow Multiple Memberships", type: "bool" },
  { key: "allowTransfer", label: "Allow Membership Transfer", type: "bool" },
  { key: "autoActivate", label: "Auto Activate Membership", type: "bool" },
  { key: "requireApproval", label: "Require Approval", type: "bool" },
  { key: "enableExpiry", label: "Enable Membership Expiry", type: "bool" },
  { key: "enableAutoRenewal", label: "Enable Auto Renewal", type: "bool" },
  { key: "enableAutoUpgrade", label: "Enable Auto Upgrade", type: "bool" },
  { key: "enableAutoDowngrade", label: "Enable Auto Downgrade", type: "bool" },
];
const FEE_SPECS: Spec[] = [
  { key: "registrationFee", label: "Registration Fee", type: "num" }, { key: "renewalFee", label: "Renewal Fee", type: "num" },
  { key: "securityDeposit", label: "Security Deposit", type: "num" }, { key: "currency", label: "Currency", type: "text" },
  { key: "gstPercentage", label: "GST %", type: "num" }, { key: "discountOnRenewal", label: "Discount on Renewal %", type: "num" },
  { key: "lateRenewalCharge", label: "Late Renewal Charge", type: "num" },
  { key: "refundable", label: "Deposit Refundable", type: "bool" }, { key: "gstApplicable", label: "GST Applicable", type: "bool" },
];
const BENEFIT_SPECS: Spec[] = [
  { key: "billDiscountPct", label: "Bill Discount %", type: "num" }, { key: "maxDiscount", label: "Maximum Discount", type: "num" },
  { key: "productDiscountPct", label: "Product Discount %", type: "num" }, { key: "categoryDiscountPct", label: "Category Discount %", type: "num" }, { key: "brandDiscountPct", label: "Brand Discount %", type: "num" },
  { key: "maxDiscountPerBill", label: "Max Discount / Bill", type: "num" }, { key: "maxDiscountPerDay", label: "Max Discount / Day", type: "num" }, { key: "maxDiscountPerMonth", label: "Max Discount / Month", type: "num" },
  { key: "pointMultiplier", label: "Point Multiplier", type: "num" }, { key: "welcomePoints", label: "Welcome Points", type: "num" }, { key: "birthdayPoints", label: "Birthday Points", type: "num" }, { key: "anniversaryPoints", label: "Anniversary Points", type: "num" }, { key: "bonusPoints", label: "Bonus Points", type: "num" },
  { key: "exclusivePromo", label: "Exclusive Promo Code", type: "bool" }, { key: "campaignEligible", label: "Campaign Eligibility", type: "bool" },
];
const VALIDITY_SPECS: Spec[] = [
  { key: "validityType", label: "Validity Type", type: "select", options: VALIDITY_TYPES }, { key: "validityDays", label: "Validity (days)", type: "num" },
  { key: "effectiveFrom", label: "Effective From", type: "text" }, { key: "effectiveTo", label: "Effective To", type: "text" }, { key: "gracePeriodDays", label: "Grace Period (days)", type: "num" },
];
const UPGRADE_SPECS: Spec[] = [
  { key: "upgradeBasedOn", label: "Upgrade Based On", type: "multi", multiOptions: UPGRADE_CRITERIA },
  { key: "minPurchase", label: "Minimum Purchase", type: "num" }, { key: "minBills", label: "Minimum Bills", type: "num" }, { key: "minPoints", label: "Minimum Points", type: "num" }, { key: "minFee", label: "Minimum Fee", type: "num" },
  { key: "evaluationPeriod", label: "Evaluation Period", type: "select", options: EVAL_PERIODS },
  { key: "autoUpgrade", label: "Auto Upgrade", type: "bool" }, { key: "manualUpgrade", label: "Manual Upgrade", type: "bool" }, { key: "approvalRequired", label: "Approval Required", type: "bool" }, { key: "active", label: "Active", type: "bool" },
];
const DOWNGRADE_SPECS: Spec[] = [
  { key: "purchaseThreshold", label: "Purchase Threshold", type: "num" }, { key: "billThreshold", label: "Bill Threshold", type: "num" }, { key: "pointThreshold", label: "Point Threshold", type: "num" }, { key: "gracePeriodDays", label: "Grace Period (days)", type: "num" },
  { key: "autoDowngrade", label: "Auto Downgrade", type: "bool" }, { key: "manualDowngrade", label: "Manual Downgrade", type: "bool" }, { key: "approvalRequired", label: "Approval Required", type: "bool" }, { key: "active", label: "Active", type: "bool" },
];
const RENEWAL_SPECS: Spec[] = [
  { key: "renewalFee", label: "Renewal Fee", type: "num" }, { key: "renewalValidityDays", label: "Renewal Validity (days)", type: "num" }, { key: "renewalReminderDays", label: "Renewal Reminder (days)", type: "num" }, { key: "renewalBonusPoints", label: "Renewal Bonus Points", type: "num" },
  { key: "autoRenewal", label: "Auto Renewal", type: "bool" }, { key: "manualRenewal", label: "Manual Renewal", type: "bool" }, { key: "renewalCoupon", label: "Renewal Coupon", type: "bool" }, { key: "renewalGiftVoucher", label: "Renewal Gift Voucher", type: "bool" },
];
const FINANCE_SPECS: Spec[] = [
  { key: "registrationFeeAccount", label: "Registration Fee Account", type: "account" }, { key: "renewalFeeAccount", label: "Renewal Fee Account", type: "account" },
  { key: "discountAccount", label: "Membership Discount Account", type: "account" }, { key: "refundAccount", label: "Membership Refund Account", type: "account" }, { key: "marketingExpenseAccount", label: "Marketing Expense Account", type: "account" },
  { key: "costCenter", label: "Cost Center", type: "text" }, { key: "department", label: "Department", type: "text" }, { key: "project", label: "Project", type: "text" },
];
const CARD_SPECS: Spec[] = [
  { key: "cardType", label: "Card Type", type: "select", options: CARD_TYPES }, { key: "theme", label: "Theme", type: "text" }, { key: "cardSize", label: "Card Size", type: "text" },
  { key: "enableCard", label: "Enable Membership Card", type: "bool" }, { key: "generateQr", label: "Generate QR Code", type: "bool" }, { key: "generateBarcode", label: "Generate Barcode", type: "bool" },
  { key: "showCardNumber", label: "Show Card Number", type: "bool" }, { key: "showLogo", label: "Company Logo", type: "bool" }, { key: "showPhoto", label: "Customer Photo", type: "bool" }, { key: "showLevel", label: "Membership Level", type: "bool" },
  { key: "showIssueDate", label: "Issue Date", type: "bool" }, { key: "showExpiryDate", label: "Expiry Date", type: "bool" }, { key: "showSignature", label: "Signature", type: "bool" }, { key: "allowReprint", label: "Allow Card Reprint", type: "bool" },
];

/* --------------- singleton tab --------------- */
function SingletonTab({ section, action, specs, flash }: { section: string; action: string; specs: Spec[]; flash: (m: string) => void }) {
  const [cfg, setCfg] = useState<Val | null>(null);
  const [accounts, setAccounts] = useState<AccountRef[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => { const j = await fetch(`${API}/${section}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) { setCfg(j.config); if (j.accounts) setAccounts(j.accounts); } })(); }, [section]);
  if (!cfg) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
  const onChange = (k: string, v: unknown) => setCfg({ ...cfg, [k]: v });
  async function save() { setBusy(true); const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...cfg }) }).then((r) => r.json()).catch(() => ({})); setBusy(false); if (j.ok) { setCfg(j.config); flash(j.message || "Saved."); } else flash(j.message || "Could not save."); }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><SpecGrid specs={specs} value={cfg} onChange={onChange} accounts={accounts} /></div>
      <div className="flex justify-end"><Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Configuration"}</Button></div>
    </div>
  );
}

/* --------------- levels tab --------------- */
const EMPTY_LEVEL = { code: "", name: "", description: "", priority: 0, displayOrder: 0, themeColor: "#6366f1", icon: "", status: "Active" };
function LevelsTab({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<LevelRow[]>([]);
  const [modal, setModal] = useState<null | { id?: number; data: typeof EMPTY_LEVEL }>(null);
  const load = useCallback(async () => { const j = await fetch(`${API}/levels`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, []);
  useEffect(() => { load(); }, [load]);
  async function save() { if (!modal) return; const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveLevel", ...(modal.id ? { id: modal.id } : {}), ...modal.data }) }).then((r) => r.json()).catch(() => ({})); if (j.ok) { setModal(null); load(); flash("Level saved."); } else flash(j.message || "Could not save."); }
  async function del(id: number) { const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteLevel", id }) }).then((r) => r.json()); if (j.ok) { load(); flash("Level deleted."); } else flash(j.message || "Could not delete."); }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><span className="text-sm font-semibold text-muted">{rows.length} membership level(s)</span><Button size="sm" onClick={() => setModal({ data: { ...EMPTY_LEVEL } })}><Plus className="h-3.5 w-3.5" /> New Level</Button></div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5 text-center">Priority</th><th className="px-3 py-2.5 text-center">Order</th><th className="px-3 py-2.5">Theme</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0 hover:bg-surface-2/40">
                <td className="px-3 py-2 font-mono text-2xs text-foreground">{l.code}</td>
                <td className="px-3 py-2 font-medium text-foreground">{l.name}</td>
                <td className="px-3 py-2 text-center tabular-nums">{l.priority}</td>
                <td className="px-3 py-2 text-center tabular-nums">{l.displayOrder}</td>
                <td className="px-3 py-2">{l.themeColor && <span className="inline-flex items-center gap-1.5"><span className="h-4 w-4 rounded-full border border-border" style={{ background: l.themeColor }} /><span className="text-2xs text-muted">{l.themeColor}</span></span>}</td>
                <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", l.status === "Active" ? "bg-success-subtle text-success" : "bg-surface-2 text-muted")}>{l.status}</span></td>
                <td className="px-3 py-2 text-right"><div className="flex justify-end gap-1"><button onClick={() => setModal({ id: l.id, data: { code: l.code, name: l.name, description: l.description, priority: l.priority, displayOrder: l.displayOrder, themeColor: l.themeColor || "#6366f1", icon: l.icon, status: l.status } })} className="rounded-md border border-border px-2 py-1 text-2xs font-semibold text-muted hover:border-primary hover:text-primary">Edit</button><button onClick={() => del(l.id)} className="text-danger hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">No levels yet. Add Regular / Silver / Gold / Platinum…</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={modal.id ? "Edit Level" : "New Level"} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Code *</label><input value={modal.data.code} onChange={(e) => setModal({ ...modal, data: { ...modal.data, code: e.target.value.toUpperCase() } })} className={inp} /></div>
            <div><label className={lbl}>Name *</label><input value={modal.data.name} onChange={(e) => setModal({ ...modal, data: { ...modal.data, name: e.target.value } })} className={inp} /></div>
            <div><label className={lbl}>Priority</label><input type="number" value={modal.data.priority} onChange={(e) => setModal({ ...modal, data: { ...modal.data, priority: Number(e.target.value) } })} className={inp} /></div>
            <div><label className={lbl}>Display Order</label><input type="number" value={modal.data.displayOrder} onChange={(e) => setModal({ ...modal, data: { ...modal.data, displayOrder: Number(e.target.value) } })} className={inp} /></div>
            <div><label className={lbl}>Theme Color</label><input type="color" value={modal.data.themeColor} onChange={(e) => setModal({ ...modal, data: { ...modal.data, themeColor: e.target.value } })} className="h-9 w-full rounded-md border border-border-strong bg-surface" /></div>
            <div><label className={lbl}>Icon</label><input value={modal.data.icon} onChange={(e) => setModal({ ...modal, data: { ...modal.data, icon: e.target.value } })} placeholder="e.g. crown" className={inp} /></div>
            <div><label className={lbl}>Status</label><select value={modal.data.status} onChange={(e) => setModal({ ...modal, data: { ...modal.data, status: e.target.value } })} className={inp}>{LEVEL_STATUS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="col-span-2"><label className={lbl}>Description</label><input value={modal.data.description} onChange={(e) => setModal({ ...modal, data: { ...modal.data, description: e.target.value } })} className={inp} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button onClick={save}><Save className="h-4 w-4" /> Save</Button></div>
        </Modal>
      )}
    </div>
  );
}

/* --------------- level selector hook --------------- */
function useLevels() {
  const [levels, setLevels] = useState<LevelRow[]>([]);
  useEffect(() => { (async () => { const j = await fetch(`${API}/levels`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setLevels(j.rows); })(); }, []);
  return levels;
}
function LevelPicker({ levels, value, onChange }: { levels: LevelRow[]; value: string; onChange: (v: string) => void }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inp, "w-56")}><option value="">Select level…</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}</select>;
}

/* --------------- per-level config tab --------------- */
function LevelConfigTab({ section, action, specs, extra, flash }: { section: string; action: string; specs: Spec[]; extra?: string; flash: (m: string) => void }) {
  const levels = useLevels();
  const [levelId, setLevelId] = useState("");
  const [cfg, setCfg] = useState<Val | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!levelId) { setCfg(null); return; } (async () => { const j = await fetch(`${API}/${section}?levelId=${levelId}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setCfg(j.config || {}); })(); }, [section, levelId]);
  const onChange = (k: string, v: unknown) => setCfg({ ...(cfg || {}), [k]: v });
  const onSub = (group: string, k: string, v: boolean) => { const g = { ...((cfg?.[group] as Record<string, boolean>) || {}), [k]: v }; setCfg({ ...(cfg || {}), [group]: g }); };
  async function save() { if (!levelId) return; setBusy(true); const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, levelId: Number(levelId), ...cfg }) }).then((r) => r.json()).catch(() => ({})); setBusy(false); if (j.ok) flash(j.message || "Saved."); else flash(j.message || "Could not save."); }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><span className="text-2xs font-semibold text-muted">Configure for level:</span><LevelPicker levels={levels} value={levelId} onChange={setLevelId} /></div>
      {!levelId ? <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted">Select a membership level to configure its {section}.</div>
        : !cfg ? <div className="py-16 text-center text-sm text-muted">Loading…</div>
        : (
          <>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
              <SpecGrid specs={specs} value={cfg} onChange={onChange} accounts={[]} />
              {extra === "benefit" && (
                <>
                  <SubToggles title="Coupon Benefits" group="couponBenefits" keys={COUPON_BENEFIT_KEYS} labels={Object.fromEntries(COUPON_BENEFIT_KEYS.map((k) => [k, k[0].toUpperCase() + k.slice(1) + " Coupon"]))} cfg={cfg} onSub={onSub} />
                  <SubToggles title="Gift Voucher Benefits" group="voucherBenefits" keys={VOUCHER_BENEFIT_KEYS} labels={Object.fromEntries(VOUCHER_BENEFIT_KEYS.map((k) => [k, k[0].toUpperCase() + k.slice(1) + " Voucher"]))} cfg={cfg} onSub={onSub} />
                  <SubToggles title="Service Benefits" group="serviceBenefits" keys={SERVICE_BENEFIT_KEYS} labels={SERVICE_BENEFIT_LABELS} cfg={cfg} onSub={onSub} />
                </>
              )}
            </div>
            <div className="flex justify-end"><Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}</Button></div>
          </>
        )}
    </div>
  );
}
function SubToggles({ title, group, keys, labels, cfg, onSub }: { title: string; group: string; keys: readonly string[]; labels: Record<string, string>; cfg: Val; onSub: (g: string, k: string, v: boolean) => void }) {
  const map = (cfg[group] as Record<string, boolean>) || {};
  return (
    <div>
      <h4 className="mb-2 text-2xs font-bold uppercase tracking-wide text-subtle">{title}</h4>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{keys.map((k) => <label key={k} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm"><span className="text-foreground">{labels[k] ?? k}</span><input type="checkbox" checked={!!map[k]} onChange={(e) => onSub(group, k, e.target.checked)} className="h-4 w-4 accent-primary" /></label>)}</div>
    </div>
  );
}

/* --------------- qualification tab --------------- */
const EMPTY_QUAL = { method: "PurchaseValue", evaluationPeriod: "Yearly", minPurchase: 0, minBills: 0, minPoints: 0, minFee: 0, minFrequency: 0, referralCount: 0, customerType: "", campaignRef: "", combineLogic: "OR", sortOrder: 0, active: true };
function QualificationTab({ flash }: { flash: (m: string) => void }) {
  const levels = useLevels();
  const [levelId, setLevelId] = useState("");
  const [rows, setRows] = useState<QualificationRow[]>([]);
  const [form, setForm] = useState<typeof EMPTY_QUAL & { ruleId?: number }>({ ...EMPTY_QUAL });
  const load = useCallback(async () => { if (!levelId) { setRows([]); return; } const j = await fetch(`${API}/qualification?levelId=${levelId}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, [levelId]);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });
  async function save() { if (!levelId) { flash("Select a level."); return; } const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveQualification", levelId: Number(levelId), ...(form.ruleId ? { ruleId: form.ruleId } : {}), ...form }) }).then((r) => r.json()).catch(() => ({})); if (j.ok) { setForm({ ...EMPTY_QUAL }); load(); flash("Rule saved."); } else flash(j.message || "Could not save."); }
  async function del(id: number) { const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteQualification", ruleId: id }) }).then((r) => r.json()); if (j.ok) load(); }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><span className="text-2xs font-semibold text-muted">Qualification rules for:</span><LevelPicker levels={levels} value={levelId} onChange={setLevelId} /></div>
      {!levelId ? <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted">Select a level to configure how customers qualify for it.</div> : (
        <>
          {rows.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Method</th><th className="px-3 py-2.5">Period</th><th className="px-3 py-2.5 text-right">Min Purchase</th><th className="px-3 py-2.5 text-right">Min Bills</th><th className="px-3 py-2.5 text-right">Min Points</th><th className="px-3 py-2.5">Logic</th><th className="px-3 py-2.5" /></tr></thead>
                <tbody>{rows.map((r) => <tr key={r.id} className="border-b border-border last:border-0"><td className="px-3 py-2 font-medium text-foreground">{r.method}</td><td className="px-3 py-2 text-muted">{r.evaluationPeriod}</td><td className="px-3 py-2 text-right tabular-nums">{r.minPurchase || "—"}</td><td className="px-3 py-2 text-right tabular-nums">{r.minBills || "—"}</td><td className="px-3 py-2 text-right tabular-nums">{r.minPoints || "—"}</td><td className="px-3 py-2"><span className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs font-semibold">{r.combineLogic}</span></td><td className="px-3 py-2 text-right"><div className="flex justify-end gap-1"><button onClick={() => setForm({ ...EMPTY_QUAL, ...r, ruleId: r.id } as never)} className="text-2xs font-semibold text-primary hover:underline">Edit</button><button onClick={() => del(r.id)} className="text-danger hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-foreground">{form.ruleId ? "Edit Rule" : "Add Qualification Rule"}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className={lbl}>Method</label><select value={form.method} onChange={(e) => set("method", e.target.value)} className={inp}>{QUALIFICATION_METHODS.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className={lbl}>Evaluation Period</label><select value={form.evaluationPeriod} onChange={(e) => set("evaluationPeriod", e.target.value)} className={inp}>{EVAL_PERIODS.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className={lbl}>Combine Logic</label><select value={form.combineLogic} onChange={(e) => set("combineLogic", e.target.value)} className={inp}>{COMBINE_LOGIC.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className={lbl}>Min Purchase</label><input type="number" value={form.minPurchase} onChange={(e) => set("minPurchase", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Min Bills</label><input type="number" value={form.minBills} onChange={(e) => set("minBills", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Min Points</label><input type="number" value={form.minPoints} onChange={(e) => set("minPoints", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Min Fee</label><input type="number" value={form.minFee} onChange={(e) => set("minFee", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Referral Count</label><input type="number" value={form.referralCount} onChange={(e) => set("referralCount", Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Customer Type</label><input value={form.customerType} onChange={(e) => set("customerType", e.target.value)} className={inp} /></div>
            </div>
            <div className="mt-4 flex justify-end gap-2">{form.ruleId && <Button variant="ghost" onClick={() => setForm({ ...EMPTY_QUAL })}>Cancel Edit</Button>}<Button onClick={save}><Save className="h-4 w-4" /> {form.ruleId ? "Update Rule" : "Add Rule"}</Button></div>
          </div>
        </>
      )}
    </div>
  );
}

/* --------------- customer tab --------------- */
function CustomerTab({ flash }: { flash: (m: string) => void }) {
  const [fields, setFields] = useState<Record<string, { visible: boolean; mandatory: boolean }> | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => { const j = await fetch(`${API}/customer`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setFields(j.config.fields); })(); }, []);
  if (!fields) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
  const set = (k: string, prop: "visible" | "mandatory", v: boolean) => setFields({ ...fields, [k]: { ...fields[k], [prop]: v, ...(prop === "mandatory" && v ? { visible: true } : {}) } });
  async function save() { setBusy(true); const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveCustomer", fields }) }).then((r) => r.json()).catch(() => ({})); setBusy(false); if (j.ok) { setFields(j.config.fields); flash("Saved."); } else flash(j.message || "Could not save."); }
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Field</th><th className="px-3 py-2.5 text-center">Visible</th><th className="px-3 py-2.5 text-center">Mandatory</th></tr></thead>
          <tbody>{CUSTOMER_FIELDS.map((k) => <tr key={k} className="border-b border-border last:border-0"><td className="px-3 py-2 text-foreground">{CUSTOMER_FIELD_LABELS[k]}</td><td className="px-3 py-2 text-center"><input type="checkbox" checked={!!fields[k]?.visible} onChange={(e) => set(k, "visible", e.target.checked)} className="h-4 w-4 accent-primary" /></td><td className="px-3 py-2 text-center"><input type="checkbox" checked={!!fields[k]?.mandatory} onChange={(e) => set(k, "mandatory", e.target.checked)} className="h-4 w-4 accent-primary" /></td></tr>)}</tbody>
        </table>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Configuration"}</Button></div>
    </div>
  );
}

/* --------------- notification tab --------------- */
function NotificationTab({ flash }: { flash: (m: string) => void }) {
  const [events, setEvents] = useState<Record<string, Record<string, boolean>> | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => { const j = await fetch(`${API}/notification`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setEvents(j.config.events); })(); }, []);
  if (!events) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
  const set = (ev: string, ch: string, v: boolean) => setEvents({ ...events, [ev]: { ...events[ev], [ch]: v } });
  async function save() { setBusy(true); const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveNotification", events }) }).then((r) => r.json()).catch(() => ({})); setBusy(false); if (j.ok) { setEvents(j.config.events); flash("Saved."); } else flash(j.message || "Could not save."); }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Event</th>{NOTIFICATION_CHANNELS.map((c) => <th key={c} className="px-3 py-2.5 text-center">{c.toUpperCase()}</th>)}</tr></thead>
          <tbody>{NOTIFICATION_EVENTS.map((ev) => <tr key={ev} className="border-b border-border last:border-0"><td className="px-3 py-2 text-foreground">{NOTIFICATION_EVENT_LABELS[ev]}</td>{NOTIFICATION_CHANNELS.map((ch) => <td key={ch} className="px-3 py-2 text-center"><input type="checkbox" checked={!!events[ev]?.[ch]} onChange={(e) => set(ev, ch, e.target.checked)} className="h-4 w-4 accent-primary" /></td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Configuration"}</Button></div>
    </div>
  );
}

/* --------------- approval tab --------------- */
function ApprovalTab({ flash }: { flash: (m: string) => void }) {
  const [cfg, setCfg] = useState<{ approvalLevels: number; approvalRoles: string[]; approvalNotifications: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => { const j = await fetch(`${API}/approval`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setCfg(j.config); })(); }, []);
  if (!cfg) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
  const toggleRole = (r: string) => setCfg({ ...cfg, approvalRoles: cfg.approvalRoles.includes(r) ? cfg.approvalRoles.filter((x) => x !== r) : [...cfg.approvalRoles, r] });
  async function save() { setBusy(true); const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveApproval", ...cfg }) }).then((r) => r.json()).catch(() => ({})); setBusy(false); if (j.ok) { setCfg(j.config); flash("Saved."); } else flash(j.message || "Could not save."); }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h4 className="mb-2 text-2xs font-bold uppercase tracking-wide text-subtle">Approval Workflow</h4>
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-2xs">{APPROVAL_WORKFLOW.map((w, i) => <span key={w} className="flex items-center gap-1.5"><span className="rounded-full bg-primary-subtle px-2.5 py-1 font-semibold text-primary">{w}</span>{i < APPROVAL_WORKFLOW.length - 1 && <span className="text-subtle">→</span>}</span>)}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className={lbl}>Approval Levels</label><input type="number" min={1} max={5} value={cfg.approvalLevels} onChange={(e) => setCfg({ ...cfg, approvalLevels: Number(e.target.value) })} className={inp} /></div>
          <label className="flex cursor-pointer items-center justify-between gap-2 self-end rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm"><span className="text-foreground">Approval Notifications</span><input type="checkbox" checked={cfg.approvalNotifications} onChange={(e) => setCfg({ ...cfg, approvalNotifications: e.target.checked })} className="h-4 w-4 accent-primary" /></label>
        </div>
        <div className="mt-3"><label className={lbl}>Approval Roles</label><div className="flex flex-wrap gap-1.5">{APPROVAL_ROLES.map((r) => { const on = cfg.approvalRoles.includes(r); return <button key={r} type="button" onClick={() => toggleRole(r)} className={cn("rounded-full border px-2.5 py-1 text-2xs font-semibold", on ? "border-primary bg-primary text-white" : "border-border bg-surface text-muted hover:border-primary")}>{r}</button>; })}</div></div>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Configuration"}</Button></div>
    </div>
  );
}

/* --------------- reports tab --------------- */
function ReportsTab() {
  const [type, setType] = useState<ReportType>("configuration");
  const [data, setData] = useState<ReportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => { setBusy(true); const j = await fetch(`${API}/report?report=${type}`, { cache: "no-store" }).then((r) => r.json()); setBusy(false); if (j.ok) setData(j.data); }, [type]);
  useEffect(() => { run(); }, [run]);
  const cols = data ? data.columns.map((c, i) => ({ key: String(i), label: c })) : [];
  const objRows = data ? data.rows.map((r) => Object.fromEntries(r.map((v, i) => [String(i), v]))) : [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as ReportType)} className={cn(inp, "w-64")}>{REPORT_TYPES.map((r) => <option key={r} value={r}>{REPORT_LABELS[r]}</option>)}</select>
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

/* --------------- audit tab --------------- */
function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  useEffect(() => { (async () => { const j = await fetch(`${API}/audit`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); })(); }, []);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">When</th><th className="px-3 py-2.5">Section</th><th className="px-3 py-2.5">Action</th><th className="px-3 py-2.5">By</th><th className="px-3 py-2.5">Note</th></tr></thead>
        <tbody>{rows.map((a) => <tr key={a.id} className="border-b border-border last:border-0"><td className="px-3 py-2 text-2xs text-muted">{new Date(a.at).toLocaleString()}</td><td className="px-3 py-2">{a.entityType}</td><td className="px-3 py-2 font-medium text-foreground">{a.action}</td><td className="px-3 py-2 text-muted">{a.byName}</td><td className="px-3 py-2 text-2xs text-muted">{a.note}</td></tr>)}{!rows.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted">No audit entries yet.</td></tr>}</tbody>
      </table>
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
