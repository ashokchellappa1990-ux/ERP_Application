"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Target, Plus, Eye, Pencil, Trash2, Building2, GitBranch, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { PERIOD_LABEL, type BudgetPlanSummary } from "@/lib/contracts/budget";

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "info"> = { Draft: "neutral", Approved: "info", Active: "success", Closed: "warning" };

export function BudgetList() {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const toast = useToast();
  const [plans, setPlans] = useState<BudgetPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch("/api/finance/budget", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) setPlans(j.plans);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove(p: BudgetPlanSummary) {
    if (p.status === "Active") { toast.show("Close the plan before deleting.", { type: "error" }); return; }
    if (!window.confirm(`Delete the ${p.fy} ${p.scope} budget plan?`)) return;
    const j = await fetch(`/api/finance/budget/${p.id}`, { method: "DELETE" }).then((r) => r.json());
    if (j.ok) { toast.show("Deleted.", { type: "success" }); load(); } else toast.show(j.message || "Delete failed.", { type: "error" });
  }

  const totals = {
    plans: plans.length, active: plans.filter((p) => p.status === "Active").length,
    budget: plans.reduce((s, p) => s + p.totalBudget, 0), actual: plans.reduce((s, p) => s + p.actual, 0),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance" className="hover:text-foreground">Finance</Link><span className="text-subtle">/</span><span className="text-subtle">Budget</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Budget Planning</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Target className="h-5 w-5 text-primary" /> Budget Planning</h1>
          <p className="mt-0.5 text-sm text-muted">Plan and monitor expense budgets by financial year, company or branch.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/finance/budget/revision"><Button size="md" variant="secondary"><Pencil className="h-4 w-4" /> Budget Revision</Button></Link>
          <Link href="/finance/budget/transfer"><Button size="md" variant="secondary"><ArrowLeftRight className="h-4 w-4" /> Budget Transfer</Button></Link>
          <Link href="/finance/budget/new"><Button size="md"><Plus className="h-4 w-4" /> New Budget Plan</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Plans" value={String(totals.plans)} />
        <Stat label="Active" value={String(totals.active)} />
        <Stat label="Total Budget" value={inr(totals.budget)} />
        <Stat label="Actual Spend" value={inr(totals.actual)} />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading plans…" size="sm" /></div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center">
          <Target className="mx-auto mb-2 h-6 w-6 text-muted" />
          <p className="text-sm text-muted">No budget plans yet.</p>
          <Link href="/finance/budget/new" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">Create your first plan →</Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 text-left">Financial Year</th>
                  <th className="px-3 py-2.5 text-left">Scope</th>
                  <th className="px-3 py-2.5 text-left">Period</th>
                  <th className="px-3 py-2.5 text-center">Heads</th>
                  <th className="px-3 py-2.5 text-right">Budget</th>
                  <th className="px-3 py-2.5 text-right">Actual</th>
                  <th className="px-3 py-2.5 text-left">Utilization</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const over = p.utilization > 100;
                  return (
                    <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                      <td className="px-4 py-2.5"><Link href={`/finance/budget/${p.id}`} className="font-semibold text-foreground hover:text-primary">{p.fy}</Link></td>
                      <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5 text-xs text-foreground">{p.scope === "branch" ? <><GitBranch className="h-3.5 w-3.5 text-muted" /> {p.branchName ?? "Branch"}</> : <><Building2 className="h-3.5 w-3.5 text-muted" /> Company</>}</span></td>
                      <td className="px-3 py-2.5 text-xs text-muted">{PERIOD_LABEL[p.period]}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-muted">{p.lineCount}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-foreground">{inr(p.totalBudget)}</td>
                      <td className="px-3 py-2.5 text-right text-muted">{inr(p.actual)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", over ? "bg-danger" : p.utilization >= 80 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(100, p.utilization)}%` }} /></div>
                          <span className={cn("text-2xs font-bold", over ? "text-danger" : "text-muted")}>{p.utilization}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center"><Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/finance/budget/${p.id}?mode=view`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                          <Link href={`/finance/budget/${p.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></Link>
                          <button onClick={() => remove(p)} title="Delete" disabled={p.status === "Active"} className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-danger/30 hover:bg-danger-subtle hover:text-danger disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><p className="text-2xs font-medium text-muted">{label}</p><p className="mt-1 text-lg font-bold tracking-tight text-foreground">{value}</p></div>;
}
