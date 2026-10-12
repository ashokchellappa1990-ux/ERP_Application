"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Settings2, CheckCircle2, Save, Paperclip, Scale, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FINANCE_LISTS, FINANCE_FORM_META, FINANCE_FEATURES, financeNotesFor, type FFormField } from "@/lib/finance/financeData";
import { financeDocNo, finFlag } from "@/lib/finance/financeConfig";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";

const ACCOUNTS = ["Cash", "Bank - HDFC", "Sundry Debtors", "Sundry Creditors", "Sales", "Purchases", "Rent Expense", "Salary Expense", "Bank Charges", "Output GST Payable", "Input GST", "TDS Payable", "Depreciation Expense", "Fixed Asset", "Discount Allowed", "Discount Received", "Interest Income", "Interest Expense", "Suspense"];
interface JLine { account: string; debit: number; credit: number }
const inr = (n: number) => formatMoney(n);

export function FinanceVoucherForm({ featureKey, backHref: backHrefProp }: { featureKey: string; backHref?: string }) {
  const router = useRouter();
  const meta = FINANCE_FORM_META[featureKey];
  const list = FINANCE_LISTS[featureKey];
  const feature = FINANCE_FEATURES.find((f) => f.key === featureKey);
  const Icon = (feature?.icon ?? Scale) as LucideIcon;
  const title = list?.title ?? feature?.label ?? "Voucher";
  const notes = useMemo(() => financeNotesFor(featureKey), [featureKey]);
  const backHref = backHrefProp ?? `/finance/${featureKey}`;

  const [docFields, setDocFields] = useState<Record<string, string>>({});
  const [party, setParty] = useState("");
  const [jlines, setJlines] = useState<JLine[]>([{ account: "", debit: 0, credit: 0 }, { account: "", debit: 0, credit: 0 }]);
  const [saved, setSaved] = useState(false);

  if (!meta || !feature) return <div className="p-6 text-sm text-muted">Unknown finance document.</div>;
  const isJournal = meta.kind === "journal";
  const drTotal = jlines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const crTotal = jlines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = drTotal > 0 && Math.abs(drTotal - crTotal) < 0.01;

  const reqOk = meta.fields.filter((f) => f.required).every((f) => (docFields[f.key] ?? "").trim() !== "");
  const partyOk = !meta.partyLabel || party.trim() !== "";
  const canSave = isJournal ? balanced && reqOk : reqOk && partyOk;

  function save() { if (!canSave) return; setSaved(true); window.setTimeout(() => router.push(backHref), 1200); }
  const setJ = (i: number, patch: Partial<JLine>) => setJlines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const renderField = (f: FFormField) => (
    <div key={f.key} className={cn(f.full && "sm:col-span-2 lg:col-span-3")}>
      <label className="mb-1 block text-2xs font-semibold text-muted">{f.label}{f.required && <span className="text-danger"> *</span>}</label>
      {f.type === "select"
        ? <select value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:bg-surface focus:outline-none"><option value="">Select…</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        : f.type === "textarea"
          ? <textarea rows={2} value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} placeholder={f.label} className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
          : f.type === "file"
            ? <label className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted hover:border-primary/40 hover:text-primary"><Paperclip className="h-4 w-4" /> {docFields[f.key] || "Click to upload"}<input type="file" className="hidden" onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.files?.[0]?.name ?? "" })} /></label>
            : <input type={f.type} value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} placeholder={f.label} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />}
    </div>
  );

  const hasAmount = meta.fields.some((f) => f.key === "amount");
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance" className="hover:text-foreground">Finance</Link><span className="text-subtle">/</span><Link href={backHref} className="hover:text-foreground">{title}</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> New {title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={backHref}><Button variant="ghost" size="md">Cancel</Button></Link>
          <Button variant="outline" size="md" onClick={save} disabled={!canSave}><Save className="h-4 w-4" /> Save Draft</Button>
          <Button size="md" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> {meta.saveLabel}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Finance policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {meta.partyLabel && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-foreground">{meta.partyLabel} <span className="text-2xs font-normal text-danger">required</span></p>
              <input value={party} onChange={(e) => setParty(e.target.value)} placeholder={`${meta.partyLabel} name`} className="h-9 w-full max-w-sm rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" />
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-foreground">{title} Details</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{meta.fields.map(renderField)}</div>
          </div>

          {isJournal && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-foreground">Journal Lines (double-entry)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="py-2">Account</th><th className="py-2 text-right">Debit</th><th className="py-2 text-right">Credit</th><th></th></tr></thead>
                  <tbody>
                    {jlines.map((l, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2 pr-2"><select value={l.account} onChange={(e) => setJ(i, { account: e.target.value })} className="h-8 w-full rounded border border-border bg-surface-2 px-2 text-sm focus:border-primary focus:outline-none"><option value="">Select account…</option>{ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}</select></td>
                        <td className="py-2"><input type="number" value={l.debit || ""} onChange={(e) => setJ(i, { debit: Number(e.target.value), credit: 0 })} placeholder="0" className="h-8 w-28 rounded border border-border bg-surface-2 px-2 text-right text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="py-2"><input type="number" value={l.credit || ""} onChange={(e) => setJ(i, { credit: Number(e.target.value), debit: 0 })} placeholder="0" className="h-8 w-28 rounded border border-border bg-surface-2 px-2 text-right text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="py-2 text-right">{jlines.length > 2 && <button onClick={() => setJlines((ls) => ls.filter((_, idx) => idx !== i))} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setJlines((ls) => [...ls, { account: "", debit: 0, credit: 0 }])} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Plus className="h-3.5 w-3.5" /> Add line</button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Voucher</p>
            <div className="space-y-3">
              <div><label className="mb-1 block text-2xs font-semibold text-muted">{title} No.</label><input readOnly value={financeDocNo(meta.prefix, 1)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 font-mono text-sm text-primary" /></div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Date</label><input type="date" value={docFields.date ?? ""} onChange={(e) => setDocFields({ ...docFields, date: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Summary</p>
            {isJournal ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted">Total Debit</span><span className="font-semibold text-foreground">{inr(drTotal)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Total Credit</span><span className="font-semibold text-foreground">{inr(crTotal)}</span></div>
                <div className={cn("mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-bold", balanced ? "text-success" : "text-danger")}><span>{balanced ? "Balanced" : "Difference"}</span><span>{inr(Math.abs(drTotal - crTotal))}</span></div>
              </div>
            ) : hasAmount ? (
              <div className="flex items-center justify-between text-base font-bold text-foreground"><span>Amount</span><span>{inr(Number(docFields.amount) || 0)}</span></div>
            ) : (
              <p className="text-xs text-muted">Fill the details and save.</p>
            )}
            {finFlag(isJournal ? "journalApproval" : "expenseApproval") && <p className="mt-2 rounded bg-info-subtle p-2 text-2xs text-info">Routes for approval before posting.</p>}
            <Button size="lg" className="mt-3 w-full" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> {meta.saveLabel}</Button>
            {!canSave && <p className="mt-2 text-center text-2xs font-medium text-danger">{isJournal ? "Debit must equal Credit." : "Fill required fields."}</p>}
          </div>
        </aside>
      </div>

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">{title} saved</p><p className="text-2xs text-muted">Redirecting…</p>
          </div>
        </div>
      )}
    </div>
  );
}
