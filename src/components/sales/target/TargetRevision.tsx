"use client";

import { useCallback, useEffect, useState } from "react";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fetchJson, useValueFmt } from "./shared";
import { Head, Section, Loading, Empty, StatusBadge } from "./TargetApproval";

interface RRow { id: number; revisionNo: string; revisionDate: string; dimensionLabel: string | null; revisionType: string; previousTarget: number; revisedTarget: number; difference: number; reason: string | null; status: string; requestedByName: string | null; target: { targetNo: string; targetType: string; fy: string } }

export function TargetRevision() {
  const vfmt = useValueFmt();
  const [status, setStatus] = useState("All");
  const [rows, setRows] = useState<RRow[] | null>(null);
  const [busy, setBusy] = useState(0);

  const load = useCallback(() => { setRows(null); const p = status !== "All" ? `?status=${status}` : ""; fetchJson<{ ok: boolean; rows: RRow[] }>(`/api/sales/target/revisions${p}`).then((j) => setRows(j.ok ? j.rows : [])); }, [status]);
  useEffect(() => { load(); }, [load]);
  const act = async (id: number, action: "approve" | "reject") => { setBusy(id); const remarks = action === "reject" ? prompt("Reason:") ?? "" : undefined; await fetchJson(`/api/sales/target/revision/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, remarks }) }); load(); setBusy(0); };

  return (
    <div className="space-y-4">
      <Head icon={GitCompare} title="Target Revision" sub="Every revision is a separate record — the original target is never overwritten." />
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <span className="text-2xs font-semibold uppercase text-muted">Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none">{["All", "Pending", "Approved", "Rejected"].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <Section title="Revisions">
        {!rows ? <Loading /> : rows.length === 0 ? <Empty msg="No revisions found." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2/40 text-left text-2xs font-semibold uppercase tracking-wide text-muted"><th className="px-3 py-2">Revision</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Dimension</th><th className="px-3 py-2 text-right">Previous</th><th className="px-3 py-2 text-right">Revised</th><th className="px-3 py-2 text-right">Δ</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 font-semibold text-foreground">{r.revisionNo}<div className="text-2xs font-normal text-muted">{r.revisionDate}</div></td>
                    <td className="px-3 py-2 text-muted">{r.target.targetNo}</td>
                    <td className="px-3 py-2">{r.dimensionLabel ?? "Overall"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{vfmt(Number(r.previousTarget), r.target.targetType)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{vfmt(Number(r.revisedTarget), r.target.targetType)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${Number(r.difference) >= 0 ? "text-success" : "text-danger"}`}>{Number(r.difference) >= 0 ? "+" : ""}{vfmt(Number(r.difference), r.target.targetType)}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2 text-right">{r.status === "Pending" ? <div className="flex justify-end gap-1.5"><Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, "approve")}>Approve</Button><Button size="sm" variant="danger" disabled={busy === r.id} onClick={() => act(r.id, "reject")}>Reject</Button></div> : <span className="text-2xs text-subtle">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
