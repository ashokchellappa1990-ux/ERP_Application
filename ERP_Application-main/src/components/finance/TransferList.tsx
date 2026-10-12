"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Plus, Eye, Check, X, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import type { TransferRow } from "@/lib/contracts/budgetTxn";

const TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = { Pending: "warning", Approved: "success", Rejected: "danger" };

export function TransferList() {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const toast = useToast();
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch("/api/finance/budget/transfer", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) setRows(j.rows);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(r: TransferRow, action: "approve" | "reject") {
    if (action === "reject" && !window.confirm(`Reject ${r.transferNo}?`)) return;
    const rejectReason = action === "reject" ? window.prompt("Reason for rejection (optional):") ?? "" : undefined;
    const j = await fetch(`/api/finance/budget/transfer/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, rejectReason }) }).then((x) => x.json());
    if (j.ok) { toast.show(j.message || "Done.", { type: "success" }); load(); } else toast.show(j.message || "Action failed.", { type: "error" });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance/budget" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Budget Planning</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Budget Transfer</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ArrowLeftRight className="h-5 w-5 text-primary" /> Budget Transfer</h1>
          <p className="mt-0.5 text-sm text-muted">Move budget between expense heads — a separate transaction; the original plan never changes.</p>
        </div>
        <Link href="/finance/budget/transfer/new"><Button size="md"><Plus className="h-4 w-4" /> New Transfer</Button></Link>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>
        : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No transfers yet. <Link href="/finance/budget/transfer/new" className="font-semibold text-primary hover:underline">Create one →</Link></div>
        : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5 text-left">Transfer No</th><th className="px-3 py-2.5 text-left">Date</th><th className="px-3 py-2.5 text-left">FY</th><th className="px-3 py-2.5 text-left">Scope</th>
                <th className="px-3 py-2.5 text-left">From → To</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-left">Requested</th><th className="px-3 py-2.5 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                    <td className="px-3 py-2"><Link href={`/finance/budget/transfer/${r.id}`} className="font-semibold text-foreground hover:text-primary">{r.transferNo}</Link></td>
                    <td className="px-3 py-2 text-muted">{r.transferDate}</td>
                    <td className="px-3 py-2 text-muted">{r.fy}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.scope === "branch" ? r.branchName ?? "Branch" : "Company"}</td>
                    <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5 text-foreground">{r.fromHeadName} <ArrowRight className="h-3.5 w-3.5 text-muted" /> {r.toHeadName}</span></td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{inr(r.amount)}</td>
                    <td className="px-3 py-2 text-center"><Badge tone={TONE[r.status]}>{r.status}</Badge></td>
                    <td className="px-3 py-2 text-2xs text-muted">{r.requestedByName ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/finance/budget/transfer/${r.id}`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                        {r.status === "Pending" && <>
                          <button onClick={() => act(r, "approve")} title="Approve" className="grid h-8 w-8 place-items-center rounded-md border border-success/30 bg-success-subtle text-success transition hover:bg-success hover:text-white"><Check className="h-4 w-4" /></button>
                          <button onClick={() => act(r, "reject")} title="Reject" className="grid h-8 w-8 place-items-center rounded-md border border-danger/30 text-danger transition hover:bg-danger hover:text-white"><X className="h-4 w-4" /></button>
                        </>}
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
