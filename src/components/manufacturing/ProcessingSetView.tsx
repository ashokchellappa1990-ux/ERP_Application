"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Factory, ArrowLeft, Pencil, Power, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { ProcessingSetDto } from "@/lib/contracts/processingSet";

export function ProcessingSetView() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const toast = useToast();
  const [data, setData] = useState<ProcessingSetDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const j = await fetch(`/api/manufacturing/processing-set/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j.data); else toast.error(j?.message || "Could not load the Processing Set.");
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleStatus() {
    if (!data) return;
    setBusy(true);
    const next = data.status === "Active" ? "Inactive" : "Active";
    const j = await fetch(`/api/manufacturing/processing-set/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false); setConfirmOpen(false);
    if (j.ok) { toast.success(j.message || "Updated."); load(); } else toast.error(j.message || "Could not update status.");
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading Processing Set…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Processing Set not found. <Link href="/manufacturing/processing-set" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const validPct = data.totalPercentage === 100;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/manufacturing/processing-set" className="hover:text-foreground">Processing Set Configuration</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{data.code}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Factory className="h-5 w-5 text-primary" /> {data.name}</h1>
          <p className="mt-0.5 text-sm text-muted font-mono">{data.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/manufacturing/processing-set"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Link href={`/manufacturing/processing-set/new?id=${data.id}`}><Button variant="outline" size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>
          <Button size="md" variant={data.status === "Active" ? "outline" : "primary"} onClick={() => setConfirmOpen(true)}><Power className="h-4 w-4" /> {data.status === "Active" ? "Deactivate" : "Activate"}</Button>
        </div>
      </div>

      <SectionCard icon={Factory} title="Processing Set">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KV k="Status" v="" custom={<Badge tone={data.status === "Active" ? "success" : "neutral"}>{data.status}</Badge>} />
          <KV k="Raw Material" v={data.rawMaterialName} sub={data.rawMaterialSku} />
          <KV k="Created" v={new Date(data.createdAt).toLocaleString()} />
          <KV k="Last Updated" v={new Date(data.updatedAt).toLocaleString()} />
        </div>
        {data.description && <div className="mt-3 border-t border-border pt-3"><p className="text-2xs font-semibold uppercase tracking-wide text-subtle">Description</p><p className="mt-1 text-sm text-foreground">{data.description}</p></div>}
      </SectionCard>

      <SectionCard icon={Factory} title="Output Configuration">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-2.5">Finished Good</th>
                <th className="px-4 py-2.5 text-right">Expected Output %</th>
                <th className="px-4 py-2.5">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {data.outputs.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5"><div className="font-medium text-foreground">{o.finishedGoodName}</div><div className="font-mono text-2xs text-subtle">{o.finishedGoodSku}</div></td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground">{o.expectedPercentage}%</td>
                  <td className="px-4 py-2.5 text-muted">{o.remarks || "—"}</td>
                </tr>
              ))}
              <tr className="border-b border-border bg-warning-subtle/20 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-foreground">Process Loss / Wastage</div>
                  <div className="text-2xs text-subtle">Not a product — posted to wastage, not output.</div>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-foreground">{data.processLossPercentage}%</td>
                <td className="px-4 py-2.5 text-muted">—</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-2">
                <td className="px-4 py-2.5 text-right text-sm font-bold text-foreground">Total (Finished Goods + Process Loss)</td>
                <td className={cn("px-4 py-2.5 text-right text-sm font-bold", validPct ? "text-success" : "text-warning")}>{data.totalPercentage}%</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className={cn("mt-3 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold", validPct ? "border-success/30 bg-success-subtle/40 text-success" : "border-warning/30 bg-warning-subtle/40 text-warning")}>
          {validPct ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {validPct ? "Output allocation is valid" : data.totalPercentage > 100 ? "Output allocation cannot exceed 100%." : "Output allocation is incomplete. Total must be 100%."}
        </div>
      </SectionCard>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => !busy && setConfirmOpen(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4">
              <h3 className="text-base font-bold text-foreground">{data.status === "Active" ? "Deactivate" : "Activate"} Processing Set</h3>
              <p className="mt-1.5 text-sm text-muted">
                {data.status === "Active"
                  ? "Are you sure you want to deactivate this Processing Set? It will no longer be available for new processing transactions — existing transactions remain unchanged."
                  : "Reactivate this Processing Set? It will become available for new processing transactions again."}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
              <Button variant="outline" size="md" disabled={busy} onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button size="md" disabled={busy} onClick={toggleStatus}>{busy ? "Please wait…" : data.status === "Active" ? "Deactivate" : "Activate"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ k, v, sub, custom }: { k: string; v: string; sub?: string; custom?: React.ReactNode }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-subtle">{k}</p>
      {custom ?? <p className="text-sm font-medium text-foreground">{v}</p>}
      {sub && <p className="font-mono text-2xs text-subtle">{sub}</p>}
    </div>
  );
}
