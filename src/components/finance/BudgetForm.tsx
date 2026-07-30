"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Target, Plus, Trash2, Settings2, CheckCircle2, Save, MoveHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  BUDGET_HEADS, BUDGET_LEVELS, FY_OPTIONS, PERIOD_TYPES, periodsOf, headTotal,
  getBudget, saveBudget, newBudget, type Budget, type PeriodType,
} from "@/lib/finance/budgetStore";
import { financeNotesFor } from "@/lib/finance/financeData";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";

const inr = (n: number) => formatMoney(n);

export function BudgetForm({ budgetId }: { budgetId?: string }) {
  const router = useRouter();
  const isEdit = !!budgetId;
  const [b, setB] = useState<Budget>(() => (budgetId && getBudget(budgetId)) || newBudget());
  const [saved, setSaved] = useState(false);
  const notes = financeNotesFor("budget");
  const periods = periodsOf(b.periodType);

  const set = (patch: Partial<Budget>) => setB((x) => ({ ...x, ...patch }));
  function setPeriodType(t: PeriodType) {
    const len = periodsOf(t).length;
    setB((x) => ({ ...x, periodType: t, heads: x.heads.map((h) => ({ ...h, amounts: Array.from({ length: len }, (_, i) => h.amounts[i] ?? 0) })) }));
  }
  const setHead = (i: number, patch: Partial<Budget["heads"][number]>) => setB((x) => ({ ...x, heads: x.heads.map((h, idx) => idx === i ? { ...h, ...patch } : h) }));
  const setAmount = (i: number, p: number, v: number) => setB((x) => ({ ...x, heads: x.heads.map((h, idx) => idx === i ? { ...h, amounts: h.amounts.map((a, pi) => pi === p ? Math.max(0, v) : a) } : h) }));
  const spread = (i: number) => setB((x) => ({ ...x, heads: x.heads.map((h, idx) => { if (idx !== i) return h; const first = Number(h.amounts[0]) || 0; return { ...h, amounts: h.amounts.map(() => first) }; }) }));
  const addHead = () => setB((x) => ({ ...x, heads: [...x.heads, { head: BUDGET_HEADS.find((hd) => !x.heads.some((h) => h.head === hd)) ?? "Miscellaneous", amounts: Array.from({ length: periods.length }, () => 0), spent: 0 }] }));
  const removeHead = (i: number) => setB((x) => ({ ...x, heads: x.heads.filter((_, idx) => idx !== i) }));

  const grand = b.heads.reduce((s, h) => s + headTotal(h), 0);
  const colTotals = periods.map((_, p) => b.heads.reduce((s, h) => s + (Number(h.amounts[p]) || 0), 0));
  const canSave = b.name.trim() !== "" && b.heads.length > 0 && grand > 0;

  function save() { if (!canSave) return; saveBudget(b); setSaved(true); window.setTimeout(() => router.push("/finance/budget"), 1100); }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance" className="hover:text-foreground">Finance</Link><span className="text-subtle">/</span><Link href="/finance/budget" className="hover:text-foreground">Budget</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{isEdit ? "Edit" : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Target className="h-5 w-5 text-primary" /> {isEdit ? "Edit Budget" : "New Budget"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/finance/budget"><Button variant="ghost" size="md">Cancel</Button></Link>
          <Button size="md" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> {isEdit ? "Update Budget" : "Save Budget"}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Finance policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      {/* header */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2"><label className="mb-1 block text-2xs font-semibold text-muted">Budget Name <span className="text-danger">*</span></label><input value={b.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. FY 26-27 Operating Budget" className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
          <div><label className="mb-1 block text-2xs font-semibold text-muted">Level</label><select value={b.level} onChange={(e) => set({ level: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:outline-none">{BUDGET_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
          <div><label className="mb-1 block text-2xs font-semibold text-muted">Financial Year</label><select value={b.fy} onChange={(e) => set({ fy: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:outline-none">{FY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
          <div className="lg:col-span-4">
            <label className="mb-1 block text-2xs font-semibold text-muted">Period Granularity</label>
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              {PERIOD_TYPES.map((t) => <button key={t} type="button" onClick={() => setPeriodType(t)} className={cn("px-4 py-1.5 text-xs font-semibold transition", b.periodType === t ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{t}</button>)}
            </div>
            <span className="ml-3 text-2xs text-muted">Enter the head-wise budget across {b.periodType === "Annual" ? "the year" : b.periodType === "Quarterly" ? "4 quarters" : "12 months"}.</span>
          </div>
        </div>
      </div>

      {/* head-wise matrix */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-foreground">Head-wise Budget</p><button onClick={addHead} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Plus className="h-3.5 w-3.5" /> Add Head</button></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="py-2 pr-2">Budget Head</th>
                {periods.map((p) => <th key={p} className="px-1 py-2 text-right">{p}</th>)}
                <th className="px-2 py-2 text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {b.heads.map((h, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 pr-2">
                    <input list="budget-heads" value={h.head} onChange={(e) => setHead(i, { head: e.target.value })} placeholder="Head" className="h-8 w-40 rounded border border-border bg-surface-2 px-2 text-sm focus:border-primary focus:outline-none" />
                  </td>
                  {h.amounts.map((a, p) => (
                    <td key={p} className="px-1 py-2"><input type="number" value={a || ""} onChange={(e) => setAmount(i, p, Number(e.target.value))} placeholder="0" className="h-8 w-24 rounded border border-border bg-surface-2 px-2 text-right text-xs focus:border-primary focus:outline-none" /></td>
                  ))}
                  <td className="px-2 py-2 text-right font-semibold text-foreground">{inr(headTotal(h))}</td>
                  <td className="py-2 pl-1">
                    <div className="flex items-center gap-1">
                      {periods.length > 1 && <button onClick={() => spread(i)} title="Copy first cell across all periods" className="grid h-7 w-7 place-items-center rounded border border-border text-muted hover:text-primary"><MoveHorizontal className="h-3.5 w-3.5" /></button>}
                      {b.heads.length > 1 && <button onClick={() => removeHead(i)} className="grid h-7 w-7 place-items-center rounded text-danger hover:bg-danger-subtle"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-2/60 font-semibold text-foreground">
                <td className="py-2 pr-2 text-2xs uppercase text-subtle">Period Total</td>
                {colTotals.map((t, p) => <td key={p} className="px-1 py-2 text-right text-xs">{inr(t)}</td>)}
                <td className="px-2 py-2 text-right text-primary">{inr(grand)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <datalist id="budget-heads">{BUDGET_HEADS.map((hd) => <option key={hd} value={hd} />)}</datalist>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row">
        <p className="text-sm text-muted">Total Budget: <span className="text-lg font-bold text-foreground">{inr(grand)}</span> across {b.heads.length} heads · {periods.length} period{periods.length > 1 ? "s" : ""}</p>
        <Button size="md" onClick={save} disabled={!canSave}><Save className="h-4 w-4" /> {isEdit ? "Update Budget" : "Save Budget"}</Button>
      </div>
      {!canSave && <p className="text-center text-2xs font-medium text-danger">Enter a budget name and at least one head with an amount.</p>}

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">Budget {isEdit ? "updated" : "saved"}</p><p className="text-2xs text-muted">Redirecting…</p>
          </div>
        </div>
      )}
    </div>
  );
}
