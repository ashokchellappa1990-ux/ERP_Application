"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, ArrowLeft, Check, X, Ban, Pencil, Copy, Printer, RotateCcw, Building2, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { STATUS_TONE } from "@/lib/contracts/stockTransfer";

interface Line { id: number; productName: string; sku: string | null; uom: string | null; availableSource: number; availableDest: number; requestedQty: number; minStockQty: number | null; maxStockQty: number | null; dispatchedQty: number; remarks: string | null }
interface Header { id: number; requestNo: string; requestDate: string; transferType: string | null; priority: string; requiredDate: string | null; expectedDeliveryDate: string | null; referenceDoc: string | null; remarks: string | null; status: string; approvalStatus: string; createdByName: string | null; approvedByName: string | null; rejectReason: string | null; sourceName: string; sourceWarehouse: string | null; destinationName: string; destinationWarehouse: string | null }
interface Data { header: Header; lines: Line[]; canApprove: boolean; editable: boolean; nextActions: string[] }

const PRIO_TONE: Record<string, "danger" | "warning" | "neutral"> = { Urgent: "danger", High: "warning" };

export function StockTransferView({ data }: { data: Data }) {
  const router = useRouter();
  const { header: h } = data;
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const totalQty = data.lines.reduce((s, l) => s + (Number(l.requestedQty) || 0), 0);
  const totalDispatched = data.lines.reduce((s, l) => s + (Number(l.dispatchedQty) || 0), 0);

  async function act(action: string) {
    let remarks: string | undefined;
    if (action === "reject") { remarks = window.prompt("Reason for rejection?") || undefined; if (remarks == null) return; }
    if (action === "cancel" && !window.confirm("Cancel this transfer request?")) return;
    setBusy(action); setErr("");
    const j = await fetch(`/api/warehouse/transfer/request/${h.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, remarks }) }).then((r) => r.json());
    setBusy("");
    if (!j.ok) { setErr(j.message || "Action failed."); return; }
    router.refresh();
  }
  async function duplicate() {
    setBusy("duplicate"); setErr("");
    const j = await fetch(`/api/warehouse/transfer/request/${h.id}/duplicate`, { method: "POST" }).then((r) => r.json());
    setBusy("");
    if (!j.ok) { setErr(j.message || "Failed."); return; }
    router.push(`/warehouse/transfer/request/${j.id}`);
  }

  const canSubmit = data.nextActions.includes("submit");
  const canApprove = data.nextActions.includes("approve") && data.canApprove;
  const canReject = data.nextActions.includes("reject") && data.canApprove;
  const canReopen = data.nextActions.includes("reopen");
  const canCancel = data.nextActions.includes("cancel");

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/request" className="hover:text-foreground">Stock Transfer Request</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{h.requestNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ArrowLeftRight className="h-5 w-5 text-primary" /> {h.requestNo} <Badge tone={STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge>{h.approvalStatus === "Pending" && <Badge tone="warning">Approval Pending</Badge>}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/warehouse/transfer/request"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {data.editable && <Link href={`/warehouse/transfer/request/${h.id}/edit`}><Button variant="secondary" size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>}
          {canSubmit && <Button size="md" disabled={!!busy} onClick={() => act("submit")}><Check className="h-4 w-4" /> Submit</Button>}
          {canApprove && <Button size="md" disabled={!!busy} onClick={() => act("approve")}><Check className="h-4 w-4" /> Approve</Button>}
          {canReject && <Button size="md" variant="danger" disabled={!!busy} onClick={() => act("reject")}><X className="h-4 w-4" /> Reject</Button>}
          {canReopen && <Button size="md" variant="secondary" disabled={!!busy} onClick={() => act("reopen")}><RotateCcw className="h-4 w-4" /> Reopen</Button>}
          {canCancel && <Button size="md" variant="ghost" disabled={!!busy} onClick={() => act("cancel")}><Ban className="h-4 w-4" /> Cancel</Button>}
          <Button size="md" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          <Button size="md" variant="outline" disabled={!!busy} onClick={duplicate}><Copy className="h-4 w-4" /> Duplicate</Button>
        </div>
      </div>

      {err && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger print:hidden">{err}</div>}
      {h.approvalStatus === "Rejected" && h.rejectReason && <div className="rounded-lg border border-danger/30 bg-danger-subtle/60 px-3 py-2 text-2xs font-medium text-danger">Rejected: {h.rejectReason}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Document body */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Parties */}
          <div className="grid gap-4 border-b border-border p-5 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-subtle"><Warehouse className="h-3 w-3" /> Source (From)</p>
              <p className="mt-1 font-bold text-foreground">{h.sourceName || "—"}</p>
              {h.sourceWarehouse && <p className="text-2xs text-muted">Warehouse: {h.sourceWarehouse}</p>}
              {h.createdByName && <p className="text-2xs text-muted">Requested by: {h.createdByName}</p>}
            </div>
            <div>
              <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-subtle"><Building2 className="h-3 w-3" /> Destination (To)</p>
              <p className="mt-1 font-bold text-foreground">{h.destinationName || "—"}</p>
              {h.destinationWarehouse && <p className="text-2xs text-muted">Warehouse: {h.destinationWarehouse}</p>}
              {h.approvedByName && <p className="text-2xs text-muted">Approved by: {h.approvedByName}</p>}
            </div>
          </div>
          {/* Meta */}
          <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-border bg-surface-2/40 px-5 py-2.5 text-2xs">
            <span className="text-muted">Date: <strong className="text-foreground">{h.requestDate}</strong></span>
            <span className="text-muted">Type: <strong className="text-foreground">{h.transferType || "—"}</strong></span>
            <span className="text-muted">Priority: <strong className="text-foreground">{h.priority}</strong></span>
            {h.requiredDate && <span className="text-muted">Required: <strong className="text-foreground">{h.requiredDate}</strong></span>}
            {h.expectedDeliveryDate && <span className="text-muted">Expected: <strong className="text-foreground">{h.expectedDeliveryDate}</strong></span>}
            {h.referenceDoc && <span className="text-muted">Ref: <strong className="text-foreground">{h.referenceDoc}</strong></span>}
          </div>
          {/* Lines */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Item</th><th className="px-4 py-2.5">UoM</th><th className="px-4 py-2.5 text-right">Avail. Src</th><th className="px-4 py-2.5 text-right">Avail. Dest</th><th className="px-4 py-2.5 text-right">Min</th><th className="px-4 py-2.5 text-right">Max</th><th className="px-4 py-2.5 text-right">Requested</th><th className="px-4 py-2.5 text-right">Dispatched</th></tr></thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2"><div className="font-medium text-foreground">{l.productName}</div>{(l.sku || l.remarks) && <div className="font-mono text-2xs text-subtle">{l.sku}{l.remarks ? ` · ${l.remarks}` : ""}</div>}</td>
                    <td className="px-4 py-2 text-muted">{l.uom || "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{l.availableSource}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{l.availableDest}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-subtle">{l.minStockQty ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-subtle">{l.maxStockQty ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-foreground">{l.requestedQty}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{l.dispatchedQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {h.remarks && (
            <div className="border-t border-border p-5 text-2xs">
              <p className="font-semibold uppercase tracking-wider text-subtle">Remarks</p>
              <p className="mt-0.5 whitespace-pre-line text-muted">{h.remarks}</p>
            </div>
          )}
        </div>

        {/* Summary + status */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-foreground">Summary</span><Badge tone={STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge></div>
            <div className="space-y-1.5 text-sm">
              <Row k={`Items (${data.lines.length})`} v={String(data.lines.length)} />
              <Row k="Total Requested Qty" v={String(totalQty)} />
              <Row k="Total Dispatched Qty" v={String(totalDispatched)} />
              <div className="my-1.5 h-px bg-border" />
              <div className="flex items-center justify-between"><span className="text-muted">Priority</span><Badge tone={PRIO_TONE[h.priority] ?? "neutral"}>{h.priority}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-muted">Approval</span><Badge tone={STATUS_TONE[h.approvalStatus] ?? "neutral"}>{h.approvalStatus}</Badge></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>;
}
