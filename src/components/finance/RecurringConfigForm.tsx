"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Repeat } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { AppLoader } from "@/components/ui/AppLoader";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  GEN_MODES, GEN_MODE_LABEL, EXPENSE_POSTING, INCOME_POSTING, POSTING_LABEL, FREQUENCIES, FREQ_LABEL,
  DEFAULT_EXEC_OPTIONS, DEFAULT_NOTIFICATIONS, type RecurringConfigDto, type ExecOptions, type Notifications, type Frequency, type GenMode, type TxnType, type ConfigLine,
} from "@/lib/contracts/recurring";
import { Plus, Trash2 } from "lucide-react";
import { useFmt } from "@/components/settings/GeneralConfigProvider";

interface Ctx { expenseHeads: { id: number; name: string; category: string | null }[]; incomeAccounts: { id: number; name: string }[]; branches: { id: number; name: string }[] }
const today = () => new Date().toISOString().slice(0, 10);

type Form = Omit<RecurringConfigDto, "id" | "configNo" | "nextExecution" | "lastExecution" | "status" | "branchName" | "businessId" | "headName" | "partyName"> & { partyName: string; headName: string | null };

const EMPTY_LINE: ConfigLine = { headId: null, headName: null, description: null, amount: 0, gstPct: 0 };
const BLANK: Form = {
  name: "", description: "", txnType: "expense", branchId: null, department: "", costCenter: "", project: "",
  generationMode: "manual", postingMethod: "ap", headId: null, headName: null, lines: [{ ...EMPTY_LINE }], partyId: null, partyName: "", partyType: "Supplier",
  gstApplicable: false, gstPct: 0, tdsRate: 0, tcsRate: 0, budgetValidation: false,
  amountType: "fixed", amount: 0, minAmount: 0, maxAmount: 0,
  startDate: today(), endDate: null, frequency: "monthly", customDays: null,
  execOptions: DEFAULT_EXEC_OPTIONS, notifications: DEFAULT_NOTIFICATIONS,
};

export function RecurringConfigForm({ id, mode }: { id?: number; mode: "add" | "edit" | "view" }) {
  const toast = useToast();
  const router = useRouter();
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const readOnly = mode === "view";
  const [f, setF] = useState<Form>(BLANK);
  const [ctx, setCtx] = useState<Ctx>({ expenseHeads: [], incomeAccounts: [], branches: [] });
  const [status, setStatus] = useState("Draft");
  const [configNo, setConfigNo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partyQuery, setPartyQuery] = useState("");
  const [partyHits, setPartyHits] = useState<{ id: number; name: string }[]>([]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const setExec = (k: keyof ExecOptions, v: boolean | number) => setF((s) => ({ ...s, execOptions: { ...s.execOptions, [k]: v } }));
  const setNotif = (k: keyof Notifications, v: boolean) => setF((s) => ({ ...s, notifications: { ...s.notifications, [k]: v } }));
  const addLine = () => setF((s) => ({ ...s, lines: [...s.lines, { ...EMPTY_LINE }] }));
  const removeLine = (i: number) => setF((s) => ({ ...s, lines: s.lines.length > 1 ? s.lines.filter((_, j) => j !== i) : s.lines }));
  const setLine = (i: number, patch: Partial<ConfigLine>) => setF((s) => ({ ...s, lines: s.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const lineTotal = (l: ConfigLine) => Number(l.amount) || 0;
  const grandTotal = f.lines.reduce((s, l) => s + lineTotal(l) + (f.gstApplicable ? lineTotal(l) * (Number(l.gstPct) || 0) / 100 : 0), 0);

  const load = useCallback(async () => {
    setLoading(true);
    const cx = await fetch("/api/finance/recurring/context", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (cx?.ok) setCtx(cx);
    if (id) {
      const j = await fetch(`/api/finance/recurring/config/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (j?.ok) {
        const c: RecurringConfigDto = j.config;
        setF({ ...c, lines: c.lines?.length ? c.lines : [{ ...EMPTY_LINE }], partyName: c.partyName ?? "", description: c.description ?? "", department: c.department ?? "", costCenter: c.costCenter ?? "", project: c.project ?? "" });
        setStatus(c.status); setConfigNo(c.configNo);
      }
    }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Load party names from the master, filtered by Payee Type (expense) or the
  // customer master (income) — payee type is chosen first, then the name loads.
  useEffect(() => {
    const q = partyQuery.trim();
    if (!q) { setPartyHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const url = f.txnType === "expense"
        ? `/api/masters/suppliers?category=${encodeURIComponent(f.partyType ?? "Supplier")}&q=${encodeURIComponent(q)}`
        : `/api/masters/customers?q=${encodeURIComponent(q)}`;
      try { const j = await fetch(url, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); if (j.ok) setPartyHits(((j.suppliers ?? j.customers ?? []) as { id: number; name: string }[]).map((s) => ({ id: s.id, name: s.name }))); } catch { /* */ }
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [partyQuery, f.partyType, f.txnType]);

  // Reset posting method when the txn type flips.
  useEffect(() => { setF((s) => (s.txnType === "expense" && !EXPENSE_POSTING.includes(s.postingMethod as never)) || (s.txnType === "income" && !INCOME_POSTING.includes(s.postingMethod as never)) ? { ...s, postingMethod: s.txnType === "expense" ? "ap" : "ar", headId: null } : s); }, [f.txnType]);

  async function save() {
    if (!f.name.trim()) { toast.show("Enter a configuration name.", { type: "error" }); return; }
    setSaving(true);
    try {
      const body = { ...f, id };
      const j = await fetch(id ? `/api/finance/recurring/config/${id}` : "/api/finance/recurring/config", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (j.ok) { toast.show(j.message || "Saved.", { type: "success" }); router.push(id ? `/system/recurring-config/${id}?mode=view` : `/system/recurring-config/${j.id}?mode=view`); }
      else toast.show(j.message || "Could not save.", { type: "error" });
    } catch { toast.show("Could not save.", { type: "error" }); } finally { setSaving(false); }
  }

  if (loading) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>;
  const postingOpts = f.txnType === "expense" ? EXPENSE_POSTING : INCOME_POSTING;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/system/recurring-config" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Recurring Configuration</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{mode === "add" ? "New" : mode === "view" ? "View" : "Edit"}{configNo ? ` · ${configNo}` : ""}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Repeat className="h-5 w-5 text-primary" /> {f.name || "New Recurring Configuration"} {configNo && <Badge tone={status === "Active" ? "success" : status === "Paused" ? "warning" : "neutral"}>{status}</Badge>}</h1>
        </div>
        {!readOnly && <Button size="md" onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Configuration"}</Button>}
        {readOnly && !["Cancelled", "Completed"].includes(status) && <Link href={`/system/recurring-config/${id}`}><Button size="md" variant="secondary">Edit</Button></Link>}
      </div>

      <fieldset disabled={readOnly} className="space-y-5">
        <SectionCard title="General Information">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2"><label className={lbl}>Configuration Name *</label><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} placeholder="e.g. Monthly Office Rent" /></div>
            <div><label className={lbl}>Transaction Type</label>
              <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
                {(["expense", "income"] as TxnType[]).map((t) => <button key={t} type="button" onClick={() => set("txnType", t)} className={cn("px-4 py-2 font-semibold capitalize transition", f.txnType === t ? (t === "expense" ? "bg-danger text-white" : "bg-success text-white") : "bg-surface text-muted hover:text-foreground")}>{t}</button>)}
              </div>
            </div>
            <div className="lg:col-span-3"><label className={lbl}>Description</label><input value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} className={inp} placeholder="Optional" /></div>
            <div><label className={lbl}>Branch (blank = Company)</label><select value={f.branchId ?? ""} onChange={(e) => set("branchId", Number(e.target.value) || null)} className={inp}><option value="">Company (all branches)</option>{ctx.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className={lbl}>Department</label><input value={f.department ?? ""} onChange={(e) => set("department", e.target.value)} className={inp} placeholder="Optional" /></div>
            <div><label className={lbl}>Cost Center</label><input value={f.costCenter ?? ""} onChange={(e) => set("costCenter", e.target.value)} className={inp} placeholder="Optional" /></div>
            <div><label className={lbl}>Project</label><input value={f.project ?? ""} onChange={(e) => set("project", e.target.value)} className={inp} placeholder="Optional" /></div>
          </div>
        </SectionCard>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Generation Mode">
            <div className="space-y-1.5">
              {GEN_MODES.map((m) => <label key={m} className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"><input type="radio" name="genmode" checked={f.generationMode === m} onChange={() => set("generationMode", m as GenMode)} className="accent-[var(--color-primary)]" /> {GEN_MODE_LABEL[m]}</label>)}
            </div>
          </SectionCard>
          <SectionCard title="Posting Method">
            <div className="space-y-1.5">
              {postingOpts.map((p) => <label key={p} className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"><input type="radio" name="posting" checked={f.postingMethod === p} onChange={() => set("postingMethod", p)} className="accent-[var(--color-primary)]" /> {POSTING_LABEL[p]}</label>)}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Transaction Details">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {f.txnType === "expense" && <div><label className={lbl}>Payee Type</label><select value={f.partyType ?? "Supplier"} onChange={(e) => { set("partyType", e.target.value); set("partyName", ""); set("partyId", null); setPartyQuery(""); setPartyHits([]); }} className={inp}><option>Supplier</option><option>Vendor</option><option>Employee</option></select></div>}
            <div className="relative"><label className={lbl}>{f.txnType === "expense" ? `${f.partyType ?? "Supplier"} Name` : "Customer"}</label>
              <input value={f.partyName} onChange={(e) => { set("partyName", e.target.value); set("partyId", null); setPartyQuery(e.target.value); }} onBlur={() => setTimeout(() => setPartyHits([]), 150)} autoComplete="off" className={inp} placeholder={f.txnType === "expense" ? `Search ${(f.partyType ?? "supplier").toLowerCase()}…` : "Search customer…"} />
              {partyHits.length > 0 && partyQuery.trim() && (
                <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {partyHits.map((s) => <button key={s.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { set("partyName", s.name); set("partyId", s.id); setPartyQuery(""); setPartyHits([]); }} className="block w-full px-3 py-2 text-left text-sm text-foreground transition hover:bg-surface-2">{s.name}</button>)}
                </div>
              )}
            </div>
            <div><label className={lbl}>Amount Type</label><select value={f.amountType} onChange={(e) => set("amountType", e.target.value as "fixed" | "variable")} className={inp}><option value="fixed">Fixed Amount</option><option value="variable">Variable (adjust at generation)</option></select></div>
            <label className="flex items-center justify-between gap-2 self-end rounded-md border border-border bg-surface px-3 py-2 text-sm"><span>GST Applicable</span><Switch checked={f.gstApplicable} onChange={(v) => set("gstApplicable", v)} aria-label="gst" /></label>
            {f.txnType === "expense" && <><div><label className={lbl}>TDS %</label><input type="number" value={f.tdsRate || ""} onChange={(e) => set("tdsRate", Number(e.target.value) || 0)} className={inp} /></div>
            <div><label className={lbl}>TCS %</label><input type="number" value={f.tcsRate || ""} onChange={(e) => set("tcsRate", Number(e.target.value) || 0)} className={inp} /></div>
            <label className="flex items-center justify-between gap-2 self-end rounded-md border border-border bg-surface px-3 py-2 text-sm"><span>Budget Validation</span><Switch checked={f.budgetValidation} onChange={(v) => set("budgetValidation", v)} aria-label="budget" /></label></>}
          </div>

          {/* Heads & amounts — one voucher can carry multiple heads. */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-wide text-muted">{f.txnType === "expense" ? "Expense Heads" : "Income Heads"} &amp; Amounts{f.txnType === "income" && <span className="ml-1 normal-case font-normal text-subtle">(from Receipt Configuration → Category Master)</span>}</span>
              {!readOnly && <button type="button" onClick={addLine} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary-subtle px-2 text-2xs font-semibold text-primary transition hover:bg-primary hover:text-white"><Plus className="h-3.5 w-3.5" /> Add Head</button>}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase text-muted"><th className="px-2 py-2 text-left">Head</th><th className="px-2 py-2 text-left">Description</th>{f.gstApplicable && <th className="px-2 py-2 text-right">GST %</th>}<th className="px-2 py-2 text-right">Amount</th>{f.gstApplicable && <th className="px-2 py-2 text-right">+ GST</th>}<th className="px-2 py-2" /></tr></thead>
                <tbody>
                  {f.lines.map((l, i) => {
                    const g = f.gstApplicable ? lineTotal(l) * (Number(l.gstPct) || 0) / 100 : 0;
                    return (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="px-2 py-1.5"><select value={l.headId ?? ""} onChange={(e) => { const hid = Number(e.target.value) || null; const nm = f.txnType === "expense" ? ctx.expenseHeads.find((h) => h.id === hid)?.name ?? null : ctx.incomeAccounts.find((a) => a.id === hid)?.name ?? null; setLine(i, { headId: hid, headName: nm }); }} className="h-8 w-full min-w-[150px] rounded-md border border-border bg-surface px-2 text-xs focus:border-primary focus:outline-none"><option value="">Select head…</option>{f.txnType === "expense" ? ctx.expenseHeads.map((h) => <option key={h.id} value={h.id}>{h.category ? `${h.category} · ` : ""}{h.name}</option>) : ctx.incomeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></td>
                        <td className="px-2 py-1.5"><input value={l.description ?? ""} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Optional" className="h-8 w-full min-w-[110px] rounded-md border border-border bg-surface px-2 text-xs focus:border-primary focus:outline-none" /></td>
                        {f.gstApplicable && <td className="px-2 py-1.5 text-right"><input type="number" value={l.gstPct || ""} onChange={(e) => setLine(i, { gstPct: Number(e.target.value) || 0 })} className="h-8 w-16 rounded-md border border-border bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" /></td>}
                        <td className="px-2 py-1.5 text-right"><input type="number" value={l.amount || ""} onChange={(e) => setLine(i, { amount: Number(e.target.value) || 0 })} className="h-8 w-24 rounded-md border border-border bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" /></td>
                        {f.gstApplicable && <td className="px-2 py-1.5 text-right text-2xs text-muted">{inr(lineTotal(l) + g)}</td>}
                        <td className="px-2 py-1.5 text-right">{!readOnly && f.lines.length > 1 && <button type="button" onClick={() => removeLine(i)} className="text-danger hover:text-danger/70"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr className="border-t border-border bg-surface-2/40 text-xs font-bold"><td className="px-2 py-2" colSpan={f.gstApplicable ? 3 : 2}>Total</td><td className="px-2 py-2 text-right">{inr(f.lines.reduce((s, l) => s + lineTotal(l), 0))}</td>{f.gstApplicable && <td className="px-2 py-2 text-right text-primary">{inr(grandTotal)}</td>}<td /></tr></tfoot>
              </table>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Schedule">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Start Date</label><input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>End Date (optional)</label><input type="date" value={f.endDate ?? ""} onChange={(e) => set("endDate", e.target.value || null)} className={inp} /></div>
              <div><label className={lbl}>Frequency</label><select value={f.frequency} onChange={(e) => set("frequency", e.target.value as Frequency)} className={inp}>{FREQUENCIES.map((fr) => <option key={fr} value={fr}>{FREQ_LABEL[fr]}</option>)}</select></div>
              {f.frequency === "custom" && <div><label className={lbl}>Every N Days</label><input type="number" value={f.customDays ?? ""} onChange={(e) => set("customDays", Number(e.target.value) || null)} className={inp} /></div>}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Execution Options">
            <div className="space-y-1.5">
              {([["executeOnHoliday", "Execute on Holiday"], ["executeOnWeekend", "Execute on Weekend"], ["retryFailed", "Retry Failed Jobs"], ["autoPauseAfterFailure", "Auto Pause After Failure"]] as [keyof ExecOptions, string][]).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"><span>{label}</span><Switch checked={!!f.execOptions[k]} onChange={(v) => setExec(k, v)} aria-label={k} /></label>
              ))}
              {f.execOptions.retryFailed && <div><label className={lbl}>Retry Count</label><input type="number" value={f.execOptions.retryCount || ""} onChange={(e) => setExec("retryCount", Number(e.target.value) || 0)} className={inp} /></div>}
            </div>
          </SectionCard>
          <SectionCard title="Notifications">
            <p className="mb-1.5 text-2xs font-semibold text-muted">Triggers</p>
            <div className="grid grid-cols-2 gap-1.5">
              {([["beforeDue", "Before Due"], ["onDue", "On Due"], ["afterExecution", "After Execution"], ["failure", "On Failure"]] as [keyof Notifications, string][]).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-2xs"><span>{label}</span><Switch checked={!!f.notifications[k]} onChange={(v) => setNotif(k, v)} aria-label={k} /></label>
              ))}
            </div>
            <p className="mb-1.5 mt-3 text-2xs font-semibold text-muted">Channels</p>
            <div className="grid grid-cols-2 gap-1.5">
              {([["email", "Email"], ["sms", "SMS"], ["whatsapp", "WhatsApp"], ["push", "Push"]] as [keyof Notifications, string][]).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-2xs"><span>{label}</span><Switch checked={!!f.notifications[k]} onChange={(v) => setNotif(k, v)} aria-label={k} /></label>
              ))}
            </div>
          </SectionCard>
        </div>
      </fieldset>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
