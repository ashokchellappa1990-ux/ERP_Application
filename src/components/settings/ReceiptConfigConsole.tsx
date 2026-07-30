"use client";

import { useEffect, useState } from "react";
import { ReceiptText, Save, Loader2, Plus, Pencil, Trash2, X, Tag, CreditCard, Hash, ListTree } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { PAYMENT_MODES, VOUCHER_RESETS, TAX_TYPES, type ReceiptConfig, type ReceiptCategoryRow, type ReceiptSubHeadRow, type AccountRef } from "@/lib/contracts/receipt";

const CFG_API = "/api/settings/receipt-config";
const SUB_API = "/api/settings/receipt-subheads";
const CAT_API = "/api/settings/receipt-categories";

const FLAGS: { key: keyof ReceiptConfig; label: string; desc: string }[] = [
  { key: "enableModule", label: "Enable Receipt Module", desc: "Turn the receipt transaction module on." },
  { key: "enableApproval", label: "Enable Approval", desc: "Require approval before posting." },
  { key: "enableAttachment", label: "Enable Attachment", desc: "Allow document uploads on receipts." },
  { key: "enableCostCenter", label: "Enable Cost Center", desc: "Capture a cost center per receipt." },
  { key: "enableDepartment", label: "Enable Department", desc: "Capture a department per receipt." },
  { key: "enableProject", label: "Enable Project", desc: "Capture a project per receipt." },
  { key: "enableMultiMode", label: "Enable Multiple Payment Modes", desc: "Split one receipt across modes." },
  { key: "enableSubHead", label: "Enable Sub Receipt Heads", desc: "Capture receipts head-wise under a category." },
  { key: "enableGst", label: "Enable GST", desc: "Capture GST against the party per line." },
  { key: "autoVoucher", label: "Auto Generate Voucher Number", desc: "Number receipts automatically." },
];

export function ReceiptConfigConsole() {
  const toast = useToast();
  const [cfg, setCfg] = useState<ReceiptConfig | null>(null);
  const [cats, setCats] = useState<ReceiptCategoryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<ReceiptCategoryRow | "new" | null>(null);
  const [subCatId, setSubCatId] = useState<number | null>(null);

  const loadCats = async () => {
    const j = await fetch(CAT_API, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setCats(j.categories); setAccounts(j.accounts); }
  };
  const delCat = async (c: ReceiptCategoryRow) => {
    if (!window.confirm(`Delete category "${c.name}" and its sub-heads? Posted receipts keep their snapshot.`)) return;
    const j = await fetch(`${CAT_API}/${c.id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({ ok: false }));
    if (toast.result(j, "Category deleted.")) { if (subCatId === c.id) setSubCatId(null); loadCats(); }
  };
  useEffect(() => {
    (async () => {
      const j = await fetch(CFG_API, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) setCfg(j.config);
      await loadCats();
      setLoading(false);
    })();
  }, []);

  const setFlag = (k: keyof ReceiptConfig, v: boolean | string | number) => setCfg((c) => (c ? { ...c, [k]: v } : c));

  async function save() {
    if (!cfg) return;
    setSaving(true);
    const body = { enableModule: cfg.enableModule, enableApproval: cfg.enableApproval, enableAttachment: cfg.enableAttachment, enableCostCenter: cfg.enableCostCenter, enableDepartment: cfg.enableDepartment, enableProject: cfg.enableProject, enableMultiMode: cfg.enableMultiMode, autoVoucher: cfg.autoVoucher, voucherPrefix: cfg.voucherPrefix, voucherPadding: cfg.voucherPadding, voucherSeparator: cfg.voucherSeparator, voucherReset: cfg.voucherReset };
    const j = await fetch(CFG_API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setSaving(false);
    if (toast.result(j, "Receipt configuration saved.") && j.config) setCfg(j.config);
  }

  if (loading || !cfg) return <div className="py-16"><AppLoader label="Loading receipt configuration…" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>System</span><span className="text-subtle">/</span><span>Account Config</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Receipt Configuration</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ReceiptText className="h-5 w-5 text-primary" /> Receipt Configuration</h1>
          <p className="mt-0.5 text-sm text-muted">Rules, voucher numbering, categories &amp; payment modes for miscellaneous receipts.</p>
        </div>
        <Button size="md" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Save Configuration"}</Button>
      </div>

      {/* Flags */}
      <Card icon={ReceiptText} title="Configuration">
        <div className="grid gap-2 sm:grid-cols-2">
          {FLAGS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
              <span><span className="block text-sm font-medium text-foreground">{f.label}</span><span className="block text-2xs text-muted">{f.desc}</span></span>
              <Switch checked={!!cfg[f.key]} onChange={(v) => setFlag(f.key, v)} />
            </label>
          ))}
        </div>
      </Card>

      {/* Voucher numbering */}
      <Card icon={Hash} title="Voucher Numbering">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Voucher Prefix"><input value={cfg.voucherPrefix} onChange={(e) => setFlag("voucherPrefix", e.target.value)} className={inputCls} /></Field>
          <Field label="Running Number Padding"><input type="number" value={cfg.voucherPadding} onChange={(e) => setFlag("voucherPadding", Number(e.target.value) || 1)} className={inputCls} /></Field>
          <Field label="Separator"><input value={cfg.voucherSeparator} onChange={(e) => setFlag("voucherSeparator", e.target.value)} className={inputCls} /></Field>
          <Field label="Reset"><select value={cfg.voucherReset} onChange={(e) => setFlag("voucherReset", e.target.value)} className={inputCls}>{VOUCHER_RESETS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
        </div>
        <p className="mt-2 text-2xs text-muted">Next voucher preview: <span className="font-mono font-semibold text-foreground">{cfg.voucherPrefix}{cfg.voucherSeparator}{String((cfg.voucherSeq || 0) + 1).padStart(cfg.voucherPadding, "0")}</span></p>
      </Card>

      {/* Payment modes (reference) */}
      <Card icon={CreditCard} title="Payment Modes">
        <div className="flex flex-wrap gap-2">{PAYMENT_MODES.map((m) => <span key={m} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted">{m}</span>)}</div>
      </Card>

      {/* Category master */}
      <Card icon={Tag} title="Receipt Category Master" action={<Button size="sm" onClick={() => setEdit("new")}><Plus className="h-3.5 w-3.5" /> Add Category</Button>}>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface-2 text-2xs uppercase tracking-wide text-subtle"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Credit</th><th className="px-3 py-2 text-center">Approval</th><th className="px-3 py-2 text-center">Active</th><th className="px-3 py-2 text-center">Sub-Heads</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">
              {cats.map((c) => (
                <tr key={c.id} className={cn("hover:bg-surface-2/30", subCatId === c.id && "bg-primary-subtle/30")}>
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{c.code}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                  <td className="px-3 py-2 text-xs text-muted">{c.creditName || c.creditCode || "—"}</td>
                  <td className="px-3 py-2 text-center">{c.approvalRequired ? "✓" : "—"}</td>
                  <td className="px-3 py-2 text-center">{c.active ? <span className="text-success">●</span> : <span className="text-subtle">●</span>}</td>
                  <td className="px-3 py-2 text-center"><button onClick={() => setSubCatId(subCatId === c.id ? null : c.id)} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-2xs font-semibold transition", subCatId === c.id ? "border-primary bg-primary text-white" : "border-border text-muted hover:border-primary/40 hover:text-primary")}><ListTree className="h-3.5 w-3.5" /> {c.subHeads.length} head{c.subHeads.length === 1 ? "" : "s"}</button></td>
                  <td className="px-3 py-2 text-right"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEdit(c)} title="Edit" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted hover:border-primary/40 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => delCat(c)} title="Delete" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted hover:border-danger/40 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {subCatId && <SubHeadPanel category={cats.find((c) => c.id === subCatId)!} accounts={accounts} onChanged={loadCats} />}
      </Card>

      {edit && <CategoryModal cat={edit === "new" ? null : edit} accounts={accounts} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); loadCats(); }} />}
    </div>
  );
}

function SubHeadPanel({ category, accounts, onChanged }: { category: ReceiptCategoryRow; accounts: AccountRef[]; onChanged: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [creditCode, setCreditCode] = useState(category.creditCode || "");
  const [taxType, setTaxType] = useState<string>("None");
  const [taxRate, setTaxRate] = useState("");
  const [busy, setBusy] = useState(false);
  const acc = (code: string) => accounts.find((a) => a.code === code);

  const add = async () => {
    if (!name.trim()) { toast.error("Sub-head name is required."); return; }
    setBusy(true);
    const j = await fetch(SUB_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryId: category.id, name, creditCode, creditName: acc(creditCode)?.name, taxType, taxRate: taxType === "None" ? 0 : Number(taxRate) || 0 }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (toast.result(j, "Sub-head added.")) { setName(""); setTaxRate(""); setTaxType("None"); onChanged(); }
  };
  const del = async (h: ReceiptSubHeadRow) => {
    if (!window.confirm(`Delete sub-head "${h.name}"?`)) return;
    const j = await fetch(`${SUB_API}/${h.id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({ ok: false }));
    if (toast.result(j, "Sub-head deleted.")) onChanged();
  };

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary-subtle/15 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground"><ListTree className="h-4 w-4 text-primary" /> Sub Heads under “{category.name}”</p>
      {category.subHeads.length === 0 ? <p className="mb-2 text-2xs text-muted">No sub-heads yet. Add the heads that fall under this category (e.g. Shop Rent, Maintenance).</p> : (
        <div className="mb-2 space-y-1">
          {category.subHeads.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs">
              <span className="flex items-center gap-2 text-foreground">{h.name}{h.taxType !== "None" && <span className="rounded-full bg-info-subtle px-1.5 py-0.5 text-2xs font-semibold text-info">{h.taxType} {h.taxRate}%</span>}</span>
              <span className="flex items-center gap-2"><span className="text-2xs text-muted">Cr: {h.creditName || h.creditCode || category.creditName || "—"}</span><button onClick={() => del(h)} className="text-danger hover:text-danger/70"><Trash2 className="h-3.5 w-3.5" /></button></span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1"><label className="mb-1 block text-2xs font-semibold text-muted">Sub-head name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shop Rent" className={inputCls} /></div>
        <div className="min-w-[180px] flex-1"><label className="mb-1 block text-2xs font-semibold text-muted">Credit Account</label><select value={creditCode} onChange={(e) => setCreditCode(e.target.value)} className={inputCls}><option value="">Use category default</option>{accounts.filter((a) => a.type === "Income" || a.type === "Liability" || a.type === "Equity").map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></div>
        <div className="w-28"><label className="mb-1 block text-2xs font-semibold text-muted">Tax Type</label><select value={taxType} onChange={(e) => setTaxType(e.target.value)} className={inputCls}>{TAX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        {taxType !== "None" && <div className="w-20"><label className="mb-1 block text-2xs font-semibold text-muted">Rate %</label><input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="0" className={inputCls} /></div>}
        <Button size="sm" disabled={busy} onClick={add}><Plus className="h-3.5 w-3.5" /> Add</Button>
      </div>
    </div>
  );
}

const inputCls = "h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
function Card({ icon: Icon, title, action, children }: { icon: typeof ReceiptText; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" /> {title}</p>{action}</div>{children}</div>;
}

function CategoryModal({ cat, accounts, onClose, onSaved }: { cat: ReceiptCategoryRow | null; accounts: AccountRef[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    code: cat?.code ?? "", name: cat?.name ?? "", description: cat?.description ?? "",
    debitCode: cat?.debitCode ?? "1000", creditCode: cat?.creditCode ?? "3200",
    approvalRequired: cat?.approvalRequired ?? false, allowAttachment: cat?.allowAttachment ?? true, active: cat?.active ?? true,
  });
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const acc = (code: string) => accounts.find((a) => a.code === code);

  async function save() {
    if (!f.code.trim() || !f.name.trim()) { toast.error("Code and name are required."); return; }
    setBusy(true);
    const body = { ...f, debitName: acc(f.debitCode)?.name, creditName: acc(f.creditCode)?.name };
    const url = cat ? `${CAT_API}/${cat.id}` : CAT_API;
    const j = await fetch(url, { method: cat ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (toast.result(j, cat ? "Category updated." : "Category added.")) onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Tag className="h-4 w-4 text-primary" /> {cat ? "Edit Category" : "New Category"}</h2><button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category Code"><input value={f.code} onChange={(e) => set("code", e.target.value)} className={inputCls} /></Field>
            <Field label="Category Name"><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Description"><input value={f.description} onChange={(e) => set("description", e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Default Debit Account"><select value={f.debitCode} onChange={(e) => set("debitCode", e.target.value)} className={inputCls}><option value="">—</option>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></Field>
            <Field label="Default Credit Account"><select value={f.creditCode} onChange={(e) => set("creditCode", e.target.value)} className={inputCls}><option value="">—</option>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground"><Switch checked={f.approvalRequired} onChange={(v) => set("approvalRequired", v)} /> Approval required</label>
            <label className="flex items-center gap-2 text-sm text-foreground"><Switch checked={f.allowAttachment} onChange={(v) => set("allowAttachment", v)} /> Allow attachment</label>
            <label className="flex items-center gap-2 text-sm text-foreground"><Switch checked={f.active} onChange={(v) => set("active", v)} /> Active</label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button></div>
      </div>
    </div>
  );
}
