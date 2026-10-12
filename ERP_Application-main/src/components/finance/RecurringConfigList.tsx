"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Repeat, Plus, Eye, Pencil, Copy, Play, Pause, XCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { FREQ_LABEL, GEN_MODE_LABEL, POSTING_LABEL, type RecurringConfigRow } from "@/lib/contracts/recurring";

const TONE: Record<string, "neutral" | "warning" | "success" | "danger" | "info"> = { Draft: "neutral", Active: "success", Paused: "warning", Cancelled: "danger", Completed: "info", Expired: "neutral" };

export function RecurringConfigList() {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const toast = useToast();
  const [rows, setRows] = useState<RecurringConfigRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch("/api/finance/recurring/config", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) setRows(j.rows);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(r: RecurringConfigRow, status: string) {
    const j = await fetch(`/api/finance/recurring/config/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then((x) => x.json());
    if (j.ok) { toast.show(j.message || "Updated.", { type: "success" }); load(); } else toast.show(j.message || "Failed.", { type: "error" });
  }
  async function clone(r: RecurringConfigRow) {
    const j = await fetch(`/api/finance/recurring/config/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clone" }) }).then((x) => x.json());
    if (j.ok) { toast.show("Cloned.", { type: "success" }); load(); } else toast.show(j.message || "Failed.", { type: "error" });
  }
  async function remove(r: RecurringConfigRow) {
    if (!window.confirm(`Delete ${r.configNo}?`)) return;
    const j = await fetch(`/api/finance/recurring/config/${r.id}`, { method: "DELETE" }).then((x) => x.json());
    if (j.ok) { toast.show("Deleted.", { type: "success" }); load(); } else toast.show(j.message || "Failed.", { type: "error" });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>System</span><span className="text-subtle">/</span><span>Account Configuration</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Recurring Transaction Configuration</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Repeat className="h-5 w-5 text-primary" /> Recurring Transaction Configuration</h1>
          <p className="mt-0.5 text-sm text-muted">Configure recurring expense &amp; income rules once. Daily operations run under <Link href="/finance/recurring" className="font-medium text-primary hover:underline">Finance → Recurring Transactions</Link>.</p>
        </div>
        <Link href="/system/recurring-config/new"><Button size="md"><Plus className="h-4 w-4" /> New Configuration</Button></Link>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>
        : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No configurations yet. <Link href="/system/recurring-config/new" className="font-semibold text-primary hover:underline">Create one →</Link></div>
        : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5 text-left">Config No</th><th className="px-3 py-2.5 text-left">Name</th><th className="px-3 py-2.5 text-left">Type</th><th className="px-3 py-2.5 text-left">Mode</th><th className="px-3 py-2.5 text-left">Posting</th><th className="px-3 py-2.5 text-left">Frequency</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5 text-left">Next Exec</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                    <td className="px-3 py-2"><Link href={`/system/recurring-config/${r.id}`} className="font-semibold text-foreground hover:text-primary">{r.configNo}</Link></td>
                    <td className="px-3 py-2 text-foreground">{r.name}<div className="text-2xs text-muted">{r.scope === "branch" ? r.branchName ?? "Branch" : "Company"}</div></td>
                    <td className="px-3 py-2"><Badge tone={r.txnType === "expense" ? "danger" : "success"}>{r.txnType}</Badge></td>
                    <td className="px-3 py-2 text-2xs text-muted">{GEN_MODE_LABEL[r.generationMode]}</td>
                    <td className="px-3 py-2 text-2xs text-muted">{POSTING_LABEL[r.postingMethod] ?? r.postingMethod}</td>
                    <td className="px-3 py-2 text-2xs text-muted">{FREQ_LABEL[r.frequency]}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground">{inr(r.amount)}</td>
                    <td className="px-3 py-2 text-2xs text-muted">{r.nextExecution ?? "—"}</td>
                    <td className="px-3 py-2 text-center"><Badge tone={TONE[r.status]}>{r.status}</Badge></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/system/recurring-config/${r.id}?mode=view`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                        {!["Cancelled", "Completed"].includes(r.status) && <Link href={`/system/recurring-config/${r.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></Link>}
                        <button onClick={() => clone(r)} title="Clone" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/40 hover:text-primary"><Copy className="h-4 w-4" /></button>
                        {(r.status === "Draft" || r.status === "Paused") && <button onClick={() => setStatus(r, "Active")} title="Activate" className="grid h-8 w-8 place-items-center rounded-md border border-success/30 bg-success-subtle text-success transition hover:bg-success hover:text-white"><Play className="h-4 w-4" /></button>}
                        {r.status === "Active" && <button onClick={() => setStatus(r, "Paused")} title="Pause" className="grid h-8 w-8 place-items-center rounded-md border border-warning/30 text-warning transition hover:bg-warning hover:text-white"><Pause className="h-4 w-4" /></button>}
                        {!["Cancelled", "Completed"].includes(r.status) && <button onClick={() => setStatus(r, "Cancelled")} title="Cancel" className="grid h-8 w-8 place-items-center rounded-md border border-danger/30 text-danger transition hover:bg-danger hover:text-white"><XCircle className="h-4 w-4" /></button>}
                        {r.status === "Draft" && <button onClick={() => remove(r)} title="Delete" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-danger/30 hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
