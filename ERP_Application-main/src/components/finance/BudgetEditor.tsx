"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Target, Save, CheckCircle2, Building2, GitBranch, RotateCcw, Play, Lock, Trash2, CalendarClock, Info, ArrowLeft, History, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import {
  MONTHS, QUARTERS, HALVES, PERIODS, PERIOD_LABEL, sumMonths, quarterTotal, halfTotal, quarterRange, halfRange,
  deriveMonthsFromAnnual, deriveQuarterMonths, deriveHalfMonths,
  type BudgetHeaderDto, type BudgetLineDto, type LastYearRef, type Months, type MonthKey, type BudgetPeriod,
} from "@/lib/contracts/budget";
import type { BudgetLogEntry } from "@/lib/contracts/budgetTxn";
import { BudgetTimeline } from "@/components/finance/budgetTxnShared";
import { ScrollText } from "lucide-react";

interface Branch { id: number; name: string }
interface Payload { ok: boolean; current: BudgetHeaderDto; lastYear: LastYearRef; branches: Branch[]; fyOptions: string[] }

const n = (v: unknown) => Number(v) || 0;
const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "info"> = { Draft: "neutral", Approved: "info", Active: "success", Closed: "warning" };
const PERIOD_NOUN: Record<BudgetPeriod, string> = { yearly: "annual", halfyearly: "half-yearly", quarterly: "quarterly", monthly: "monthly" };

export function BudgetEditor({ headerId, forceView = false }: { headerId?: number; forceView?: boolean }) {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const toast = useToast();
  const router = useRouter();
  const isNew = !headerId;

  const [data, setData] = useState<Payload | null>(null);
  const [lines, setLines] = useState<BudgetLineDto[]>([]);
  const [fy, setFy] = useState("");
  const [scope, setScope] = useState<"company" | "branch">("company");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [period, setPeriod] = useState<BudgetPeriod>("quarterly");
  const [remarks, setRemarks] = useState("");
  const [showLastYear, setShowLastYear] = useState(false);
  const [lyOpen, setLyOpen] = useState<number | null>(null); // per-line last-year reference (headId)
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<BudgetLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const header = data?.current;
  const status = header?.status ?? "Draft";
  const readOnly = forceView || status === "Active" || status === "Closed";

  const load = useCallback(async (opts?: { fy?: string; scope?: "company" | "branch"; branchId?: number | null }) => {
    setLoading(true);
    let url: string;
    if (headerId) url = `/api/finance/budget/${headerId}`;
    else {
      const q = new URLSearchParams();
      q.set("fy", opts?.fy ?? fy);
      q.set("scope", opts?.scope ?? scope);
      const b = opts?.branchId !== undefined ? opts.branchId : branchId;
      if ((opts?.scope ?? scope) === "branch" && b) q.set("branchId", String(b));
      url = `/api/finance/budget/plan?${q}`;
    }
    const j: Payload = await fetch(url, { cache: "no-store" }).then((r) => r.json()).catch(() => null as unknown as Payload);
    if (j?.ok) {
      setData(j); setLines(j.current.lines); setRemarks(j.current.remarks ?? "");
      setFy(j.current.fy); setScope(j.current.scope); setBranchId(j.current.branchId); setPeriod(j.current.period);
    }
    setLoading(false);
  }, [headerId, fy, scope, branchId]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lastByHead = useMemo(() => new Map((data?.lastYear.lines ?? []).map((l) => [l.headId, l])), [data]);

  function patchLine(headId: number, mut: (l: BudgetLineDto) => BudgetLineDto) { setLines((ls) => ls.map((l) => (l.headId === headId ? mut(l) : l))); }
  const recompute = (l: BudgetLineDto, months: Months): BudgetLineDto => {
    const annual = +sumMonths(months).toFixed(2);
    return { ...l, months, annual, available: +(annual - l.actual - l.committed).toFixed(2), utilization: annual > 0 ? Math.round((l.actual / annual) * 100) : 0 };
  };
  const setAnnual = (id: number, v: number) => patchLine(id, (l) => recompute(l, deriveMonthsFromAnnual(v)));
  const setQuarter = (id: number, qi: number, v: number) => patchLine(id, (l) => recompute(l, deriveQuarterMonths(l.months, qi, v)));
  const setHalf = (id: number, hi: number, v: number) => patchLine(id, (l) => recompute(l, deriveHalfMonths(l.months, hi, v)));
  const setMonth = (id: number, key: MonthKey, v: number) => patchLine(id, (l) => recompute(l, { ...l.months, [key]: v }));

  const prefill = (src: "annual" | "actual") => {
    setLines((ls) => ls.map((l) => { const ref = lastByHead.get(l.headId); const v = ref ? (src === "annual" ? ref.annual : ref.actual) : 0; return recompute(l, deriveMonthsFromAnnual(v)); }));
    toast.show(`Prefilled from last year's ${src === "annual" ? "budget" : "actual"}.`, { type: "success" });
  };

  const totals = useMemo(() => {
    const budget = lines.reduce((s, l) => s + l.annual, 0), actual = lines.reduce((s, l) => s + l.actual, 0), committed = lines.reduce((s, l) => s + l.committed, 0);
    return { budget, actual, committed, available: budget - actual - committed, util: budget > 0 ? Math.round((actual / budget) * 100) : 0 };
  }, [lines]);

  // Grid buckets for the selected period (yearly → none; just Annual).
  const buckets = useMemo(() => {
    if (period === "monthly") return MONTHS.map((m, i) => ({ key: m.key as string, label: m.label, range: "", get: (l: BudgetLineDto) => l.months[m.key], set: (id: number, v: number) => setMonth(id, m.key, v), idx: i }));
    if (period === "quarterly") return QUARTERS.map((q, i) => ({ key: q.key, label: q.label, range: quarterRange(i), get: (l: BudgetLineDto) => quarterTotal(l.months, i), set: (id: number, v: number) => setQuarter(id, i, v), idx: i }));
    if (period === "halfyearly") return HALVES.map((h, i) => ({ key: h.key, label: h.label, range: halfRange(i), get: (l: BudgetLineDto) => halfTotal(l.months, i), set: (id: number, v: number) => setHalf(id, i, v), idx: i }));
    return [];
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(): Promise<number | null> {
    setSaving(true);
    try {
      const body = { id: header?.id || undefined, fy, scope, period, branchId: scope === "branch" ? branchId : null, remarks,
        lines: lines.map((l) => ({ headId: l.headId, budgetType: l.budgetType, budgetRequired: l.budgetRequired, trackBudget: l.trackBudget, allowExceed: l.allowExceed, approvalRequired: l.approvalRequired, budgetControl: l.budgetControl, annual: l.annual, months: l.months })) };
      const j = await fetch("/api/finance/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (j.ok) { toast.show("Budget plan saved.", { type: "success" }); if (isNew && j.id) { router.push(`/finance/budget/${j.id}`); } else await load(); return j.id as number; }
      toast.show(j.message || "Could not save.", { type: "error" }); return null;
    } catch { toast.show("Could not save.", { type: "error" }); return null; } finally { setSaving(false); }
  }
  async function setStatus(next: string) {
    let id = header?.id ?? 0;
    if (!id) { const saved = await save(); if (!saved) return; id = saved; }
    setBusy(true);
    try {
      const j = await fetch(`/api/finance/budget/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }).then((r) => r.json());
      if (j.ok) { toast.show(j.message || `Budget ${next}.`, { type: "success" }); await load(); } else toast.show(j.message || "Action failed.", { type: "error" });
    } catch { toast.show("Action failed.", { type: "error" }); } finally { setBusy(false); }
  }

  const changeScope = (s: "company" | "branch") => { setScope(s); const b = s === "branch" ? (data?.branches[0]?.id ?? null) : null; setBranchId(b); load({ scope: s, branchId: b }); };
  const ly = data?.lastYear;

  async function toggleLog() {
    const next = !showLog; setShowLog(next);
    if (next && header?.id && log.length === 0) {
      const j = await fetch(`/api/finance/budget/${header.id}/log`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (j?.ok) setLog(j.log);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance/budget" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Budget Planning</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{isNew ? "New Plan" : forceView ? "View Plan" : "Edit Plan"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Target className="h-5 w-5 text-primary" /> {fy || "Budget"} <span className="text-sm font-normal text-muted">· {scope === "branch" ? header?.branchName ?? "Branch" : "Company"} · {PERIOD_LABEL[period]}</span></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[status]}>{status}</Badge>
          {!readOnly && <Button size="md" variant="secondary" onClick={save} disabled={saving || loading}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}</Button>}
          {!forceView && status === "Draft" && <Button size="md" onClick={() => setStatus("Approved")} disabled={busy || !lines.length}><CheckCircle2 className="h-4 w-4" /> Approve</Button>}
          {!forceView && status === "Approved" && <><Button size="md" variant="ghost" onClick={() => setStatus("Draft")} disabled={busy}><RotateCcw className="h-4 w-4" /> Revert</Button><Button size="md" onClick={() => setStatus("Active")} disabled={busy}><Play className="h-4 w-4" /> Activate</Button></>}
          {!forceView && status === "Active" && <Button size="md" variant="ghost" onClick={() => setStatus("Closed")} disabled={busy}><Lock className="h-4 w-4" /> Close</Button>}
        </div>
      </div>

      {/* Plan setup */}
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted"><CalendarClock className="mr-1 inline h-3.5 w-3.5" />Financial Year</label>
          {isNew ? <select value={fy} onChange={(e) => { setFy(e.target.value); load({ fy: e.target.value }); }} className={inp}>{(data?.fyOptions ?? [fy]).map((o) => <option key={o} value={o}>{o}</option>)}</select>
            : <div className={ro}>{fy}</div>}
        </div>
        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">Budget Scope</label>
          {isNew ? (
            <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
              {([["company", "Company", Building2], ["branch", "Branch", GitBranch]] as const).map(([v, lbl, Icon]) => <button key={v} onClick={() => changeScope(v)} className={cn("inline-flex items-center gap-1.5 px-3 py-2 font-semibold transition", scope === v ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}><Icon className="h-3.5 w-3.5" /> {lbl}</button>)}
            </div>
          ) : <div className={ro}>{scope === "branch" ? `Branch — ${header?.branchName ?? ""}` : "Company"}</div>}
        </div>
        {isNew && scope === "branch" && (
          <div>
            <label className="mb-1 block text-2xs font-semibold text-muted">Branch</label>
            <select value={branchId ?? ""} onChange={(e) => { const b = Number(e.target.value) || null; setBranchId(b); load({ branchId: b }); }} className={inp}>{(data?.branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">Planning Period</label>
          <select value={period} disabled={readOnly} onChange={(e) => setPeriod(e.target.value as BudgetPeriod)} className={inp}>{PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}</select>
        </div>
        <div className={cn(isNew && scope === "branch" ? "sm:col-span-2 lg:col-span-4" : "sm:col-span-2")}>
          <label className="mb-1 block text-2xs font-semibold text-muted">Remarks</label>
          <input value={remarks} disabled={readOnly} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional note…" className={inp} />
        </div>
      </div>

      {/* Note about tracking + scope */}
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-3 text-xs text-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>Based on the selected period (<b>{PERIOD_LABEL[period]}</b>), each expense voucher is checked against its <b>{PERIOD_NOUN[period]}</b> budget for the head when posted. If the spend would exceed budget, the head's <b>Budget Control</b> action fires — <b>Warning</b> (allow &amp; alert), <b>Approval</b> (needs budget approval) or <b>Stop</b> (block posting). {scope === "branch" ? <>This is a <b>Branch</b> plan — tracking &amp; utilisation use this branch's expense data only.</> : <>This is a <b>Company</b> plan — tracking &amp; utilisation use expense data across all branches of the business.</>}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Total Budget" value={inr(totals.budget)} tone="primary" />
        <Kpi label="Actual (FY)" value={inr(totals.actual)} tone="info" />
        <Kpi label="Committed" value={inr(totals.committed)} tone="warning" />
        <Kpi label="Available" value={inr(totals.available)} tone={totals.available < 0 ? "danger" : "success"} />
        <Kpi label="Utilization" value={`${totals.util}%`} tone={totals.util > 100 ? "danger" : totals.util >= 80 ? "warning" : "success"} />
      </div>

      {/* Last-year reference */}
      {ly && (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <button onClick={() => setShowLastYear((s) => !s)} className="flex w-full items-center justify-between px-4 py-2.5 text-left">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"><History className="h-4 w-4 text-primary" /> Last Year Reference · {ly.fy}</span>
            <span className="text-2xs text-muted">Budget {inr(ly.totalBudget)} · Actual {inr(ly.totalActual)} {showLastYear ? "▲" : "▼"}</span>
          </button>
          {showLastYear && (
            <div className="border-t border-border px-4 py-3">
              {!readOnly && <div className="mb-2 flex flex-wrap gap-2"><button onClick={() => prefill("annual")} className={chip}><Copy className="h-3 w-3" /> Prefill from LY Budget</button><button onClick={() => prefill("actual")} className={chip}><Copy className="h-3 w-3" /> Prefill from LY Actual</button></div>}
              <div className="max-h-52 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-2xs uppercase text-muted"><th className="py-1 text-left">Head</th><th className="py-1 text-right">LY Budget</th><th className="py-1 text-right">LY Actual</th></tr></thead><tbody>{ly.lines.map((l) => <tr key={l.headId} className="border-t border-border/50"><td className="py-1 text-foreground">{l.headName}</td><td className="py-1 text-right text-muted">{inr(l.annual)}</td><td className="py-1 text-right text-muted">{inr(l.actual)}</td></tr>)}</tbody></table></div>
              {!ly.exists && <p className="mt-1 text-2xs text-muted">No budget plan existed for {ly.fy}; LY Budget shows 0. LY Actual reflects actual expenses that year.</p>}
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>
      ) : lines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center">
          <Info className="mx-auto mb-2 h-6 w-6 text-muted" />
          <p className="text-sm text-muted">No expense heads found for this business.</p>
          <p className="mt-1 text-2xs text-muted">Add expense categories &amp; heads in <Link href="/accounting/petty-cash-config" className="font-semibold text-primary hover:underline">Expense Configuration</Link>, then plan their budgets here.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted">
                  <th className="sticky left-0 z-10 bg-surface-2/40 px-3 py-2 text-left">Expense Head</th>
                  <th className="px-2 py-2 text-right">Annual</th>
                  {buckets.map((b) => <th key={b.key} className="px-2 py-2 text-right"><div>{b.label}</div>{b.range && <div className="text-[9px] font-normal normal-case text-subtle">{b.range}</div>}</th>)}
                  <th className="px-2 py-2 text-right">Actual</th>
                  <th className="px-2 py-2 text-right">Available</th>
                  <th className="px-2 py-2 text-center">Util</th>
                  <th className="px-2 py-2 text-center">Track</th>
                  <th className="px-2 py-2 text-left">Control</th>
                  <th className="px-2 py-2 text-center">Exceed</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const overUsed = l.annual > 0 && l.actual > l.annual;
                  return (
                    <tr key={l.headId} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                      <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                        <div className="flex items-start gap-1.5">
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{l.headName}</div>
                            <div className="text-2xs text-muted">{l.categoryName ?? "—"}{l.accountCode ? ` · ${l.accountCode}` : ""}</div>
                          </div>
                          {ly && <button type="button" onClick={() => setLyOpen(lyOpen === l.headId ? null : l.headId)} title={`Last year (${ly.fy}) reference for this head`} className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border transition", lyOpen === l.headId ? "border-primary bg-primary-subtle text-primary" : "border-border text-muted hover:border-primary/40 hover:text-primary")}><History className="h-3.5 w-3.5" /></button>}
                        </div>
                        {ly && lyOpen === l.headId && (() => {
                          const ref = lastByHead.get(l.headId); const lb = ref?.annual ?? 0; const la = ref?.actual ?? 0;
                          return (
                            <div className="mt-1.5 rounded-md border border-primary/20 bg-primary-subtle/20 px-2 py-1 text-2xs">
                              <div className="font-semibold text-foreground">{ly.fy} reference</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-muted"><span>Budget <b className="text-foreground">{inr(lb)}</b></span><span>Actual <b className="text-foreground">{inr(la)}</b></span></div>
                              {!readOnly && <div className="mt-1 flex gap-1"><button type="button" onClick={() => setAnnual(l.headId, lb)} className="rounded border border-border bg-surface px-1.5 py-0.5 font-medium text-primary transition hover:bg-primary hover:text-white">Use Budget</button><button type="button" onClick={() => setAnnual(l.headId, la)} className="rounded border border-border bg-surface px-1.5 py-0.5 font-medium text-primary transition hover:bg-primary hover:text-white">Use Actual</button></div>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1.5 text-right"><input type="number" value={l.annual || ""} disabled={readOnly} onChange={(e) => setAnnual(l.headId, n(e.target.value))} className={cn(cellNum, "font-semibold")} title="Type the annual budget to split it evenly across the period; editing any bucket updates the annual" /></td>
                      {buckets.map((b) => <td key={b.key} className="px-2 py-1.5 text-right"><input type="number" value={b.get(l) || ""} disabled={readOnly} onChange={(e) => b.set(l.headId, n(e.target.value))} className={cellNum} /></td>)}
                      <td className="px-2 py-1.5 text-right text-muted">{inr(l.actual)}</td>
                      <td className={cn("px-2 py-1.5 text-right font-semibold", l.available < 0 ? "text-danger" : "text-foreground")}>{inr(l.available)}</td>
                      <td className={cn("px-2 py-1.5 text-center text-2xs font-bold", overUsed ? "text-danger" : l.utilization >= 80 ? "text-warning" : "text-success")}>{l.utilization}%</td>
                      <td className="px-2 py-1.5 text-center"><Switch checked={l.trackBudget} disabled={readOnly} onChange={(v) => patchLine(l.headId, (x) => ({ ...x, trackBudget: v }))} aria-label="track against budget" /></td>
                      <td className="px-2 py-1.5">
                        <select value={l.budgetControl} disabled={readOnly || !l.trackBudget} onChange={(e) => patchLine(l.headId, (x) => ({ ...x, budgetControl: e.target.value as BudgetLineDto["budgetControl"] }))} className={cn(cellSel, !l.trackBudget ? "text-subtle" : l.budgetControl === "stop" ? "text-danger" : l.budgetControl === "approval" ? "text-warning" : "text-muted")}>
                          <option value="warning">Warning</option><option value="approval">Approval</option><option value="stop">Stop</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-center"><Switch checked={l.allowExceed} disabled={readOnly || !l.trackBudget} onChange={(v) => patchLine(l.headId, (x) => ({ ...x, allowExceed: v }))} aria-label="allow exceed" /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-2/40 text-sm font-bold">
                  <td className="sticky left-0 z-10 bg-surface-2/40 px-3 py-2 text-foreground">Total</td>
                  <td className="px-2 py-2 text-right text-foreground">{inr(totals.budget)}</td>
                  {buckets.map((b) => <td key={b.key} className="px-2 py-2 text-right text-foreground">{inr(lines.reduce((s, l) => s + b.get(l), 0))}</td>)}
                  <td className="px-2 py-2 text-right text-muted">{inr(totals.actual)}</td>
                  <td className={cn("px-2 py-2 text-right", totals.available < 0 ? "text-danger" : "text-foreground")}>{inr(totals.available)}</td>
                  <td className="px-2 py-2 text-center text-2xs">{totals.util}%</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-2xs text-muted">Type <b>Annual</b> to split it evenly across the period, or edit any bucket to update the Annual — both stay in sync (Annual = Σ buckets). Use the <History className="inline h-3 w-3" /> icon on a head for its last-year reference. <b>Actual</b> = posted expenses per head (FY); <b>Committed</b> = open payables. Turn on <b>Track</b> for a head to enforce its <b>Control</b> (Warning / Approval / Stop) when an expense voucher is posted — untracked heads are shown for planning only. A budget never posts to the ledger.</p>
        </div>
      )}

      {/* Budget Log (read-only movement history: planning + revisions + transfers) */}
      {header?.id ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <button onClick={toggleLog} className="flex w-full items-center justify-between px-4 py-2.5 text-left">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"><ScrollText className="h-4 w-4 text-primary" /> Budget Log &amp; Timeline</span>
            <span className="flex items-center gap-3 text-2xs text-muted"><Link href="/finance/budget/revision" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>Revisions</Link><Link href="/finance/budget/transfer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>Transfers</Link>{showLog ? "▲" : "▼"}</span>
          </button>
          {showLog && <div className="border-t border-border px-4 py-3"><BudgetTimeline entries={log} inr={inr} /><p className="mt-2 text-2xs text-muted">Read-only. Current budget = Original + approved Revisions ± Transfers; the original plan is never modified.</p></div>}
        </div>
      ) : null}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const ro = "flex h-9 items-center rounded-md border border-border bg-surface-2/40 px-3 text-sm font-medium text-foreground";
const cellNum = "h-8 w-20 rounded-md border border-border bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none disabled:bg-surface-2/50 disabled:text-muted";
const cellSel = "h-8 rounded-md border border-border bg-surface px-1.5 text-xs focus:border-primary focus:outline-none disabled:text-muted";
const chip = "inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary-subtle px-2.5 py-1 text-2xs font-semibold text-primary transition hover:bg-primary hover:text-white";

function Kpi({ label, value, tone }: { label: string; value: string; tone: "primary" | "info" | "warning" | "success" | "danger" }) {
  const tones = { primary: "text-primary", info: "text-info", warning: "text-warning", success: "text-success", danger: "text-danger" } as const;
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><p className="text-2xs font-medium text-muted">{label}</p><p className={cn("mt-1 text-lg font-bold tracking-tight", tones[tone])}>{value}</p></div>;
}
