"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Truck, CalendarClock, Boxes, FileText, CheckCircle2, XCircle, MessageSquare, Pencil, Trash2, Send, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { DispatchPlanningDetail as Plan } from "@/lib/contracts/transport";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const STATUS_TONE: Record<string, Tone> = { Draft: "neutral", Approved: "info", "Vehicle Pending": "warning", "Vehicle Assigned": "primary", Completed: "success", Cancelled: "danger" };

export function DispatchPlanningView({ id }: { id: number }) {
  const router = useRouter();
  const fmt = useFmt();
  const toast = useToast();
  const [data, setData] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<null | "approve" | "assign-vehicle" | "complete" | "cancel">(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch(`/api/transport/dispatch-planning/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j.data);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!action) return;
    setBusy(true);
    const j = await fetch(`/api/transport/dispatch-planning/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, remarks: remarks.trim() || undefined }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j?.ok) { toast.success(j.message); setAction(null); setRemarks(""); await load(); } else toast.error(j?.message || "Action failed.");
  }
  async function del() {
    if (!confirm("Delete this draft dispatch plan?")) return;
    setBusy(true);
    const j = await fetch(`/api/transport/dispatch-planning/${id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j?.ok) { toast.success(j.message); router.push("/warehouse/transfer/dispatch-planning"); } else toast.error(j?.message || "Delete failed.");
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading dispatch plan…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Dispatch plan not found. <Link href="/warehouse/transfer/dispatch-planning" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const x = data;
  const totalQty = x.items.reduce((s, it) => s + it.qty, 0);

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between print:hidden">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/dispatch-planning" className="hover:text-foreground">Dispatch Planning</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{x.planningNo}</span></div>
          <div className="flex flex-wrap items-center gap-2.5"><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> {x.planningNo}</h1><Badge tone={STATUS_TONE[x.status] ?? "neutral"}>{x.status}</Badge><Badge tone="neutral">{x.dispatchSource}</Badge></div>
          <p className="mt-1 text-xs text-subtle">{x.warehouse || "—"}{x.expectedDispatchDate ? ` · expected ${x.expectedDispatchDate}` : ""} — {x.items.length} item(s), {fmt.qty(totalQty)} qty.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/warehouse/transfer/dispatch-planning"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {x.status === "Draft" && action === null && <Link href={`/warehouse/transfer/dispatch-planning/${id}/edit`}><Button variant="outline" size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>}
          {x.status === "Draft" && action === null && <Button size="md" onClick={() => { setAction("approve"); setRemarks(""); }}><CheckCircle2 className="h-4 w-4" /> Approve</Button>}
          {x.status === "Approved" && action === null && <Button size="md" onClick={() => { setAction("assign-vehicle"); setRemarks(""); }}><Send className="h-4 w-4" /> Assign Vehicle</Button>}
          {x.status === "Vehicle Assigned" && action === null && <Button size="md" onClick={() => { setAction("complete"); setRemarks(""); }}><PackageCheck className="h-4 w-4" /> Complete</Button>}
          {["Draft", "Approved", "Vehicle Pending", "Vehicle Assigned"].includes(x.status) && action === null && <Button variant="danger" size="md" onClick={() => { setAction("cancel"); setRemarks(""); }}><XCircle className="h-4 w-4" /> Cancel</Button>}
          {x.status === "Draft" && action === null && <Button variant="danger" size="md" onClick={del} disabled={busy}><Trash2 className="h-4 w-4" /> Delete</Button>}
        </div>
      </div>

      {action !== null && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm print:hidden">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">{action === "cancel" ? <XCircle className="h-4 w-4 text-danger" /> : <CheckCircle2 className="h-4 w-4 text-success" />}{action === "approve" ? "Approve this dispatch plan" : action === "assign-vehicle" ? "Move to Vehicle Assigned" : action === "complete" ? "Mark this plan Completed" : "Cancel this dispatch plan"}</div>
          <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle"><MessageSquare className="h-3 w-3" /> Remarks{action === "cancel" ? " (reason)" : " (optional)"}</label>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => { setAction(null); setRemarks(""); }} disabled={busy}>Dismiss</Button>
            <Button variant={action === "cancel" ? "danger" : "primary"} size="md" onClick={submit} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Working…" : "Confirm"}</Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Plan" icon={FileText}>
          <KV k="Planning Date" v={x.planningDate} />
          <KV k="Dispatch Source" v={x.dispatchSource} />
          <KV k="Reference No" v={x.referenceNo ?? ""} />
          <KV k="Priority" v={x.priority} />
        </Card>
        <Card title="Delivery" icon={CalendarClock}>
          <KV k="Warehouse" v={x.warehouse ?? ""} />
          <KV k="Expected Dispatch" v={x.expectedDispatchDate ?? ""} />
          <KV k="Transport Mode" v={x.transportMode ?? ""} />
        </Card>
        <Card title="Estimates" icon={Boxes}>
          <KV k="Estimated Weight" v={x.estimatedWeight ? `${x.estimatedWeight} kg` : ""} />
          <KV k="Estimated Volume" v={x.estimatedVolume ? `${x.estimatedVolume} cft` : ""} />
          <KV k="Created By" v={x.createdByName ?? ""} />
        </Card>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-semibold text-foreground"><Boxes className="h-4 w-4 text-primary" /> Items</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Product</th><th className="px-4 py-3">Batch No</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3">UOM</th><th className="px-4 py-3">Remarks</th></tr></thead>
            <tbody>
              {x.items.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div></td>
                  <td className="px-4 py-3 text-2xs text-muted">{l.batchNo || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmt.qty(l.qty)}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{l.uom || "—"}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{l.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(x.remarks || x.cancelReason) && (
        <div className="grid gap-4 sm:grid-cols-2 print:hidden">
          {x.remarks && <NoteCard title="Remarks" body={x.remarks} />}
          {x.cancelReason && <NoteCard title="Cancellation Reason" body={x.cancelReason} />}
        </div>
      )}
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Boxes; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><Icon className="h-3.5 w-3.5" /> {title}</p><div className="space-y-1 text-xs">{children}</div></div>;
}
function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  if (!v) return null;
  return <div className="flex items-center justify-between gap-2"><span className="text-muted">{k}</span><span className={cn("text-right", strong ? "font-bold text-foreground" : "font-medium text-foreground")}>{v}</span></div>;
}
function NoteCard({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">{title}</p><p className="whitespace-pre-line text-xs text-muted">{body}</p></div>;
}
