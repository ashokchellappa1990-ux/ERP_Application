"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageCheck, ArrowLeft, Pencil, Undo2, RotateCcw, Ban, Printer, Warehouse, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { ALLOC_STATUS_TONE, LINE_STATUS_TONE } from "@/lib/contracts/stockAllocation";

interface Lot { batchNo: string | null; expiryDate: string | null; serialNo: string | null; qty: number }
interface Line { id: number; productName: string; sku: string | null; uom: string | null; requestedQty: number; availableQty: number; reservedQty: number; allocatedQty: number; remainingQty: number; policy: string; allocationStatus: string; remarks: string | null; lots: Lot[] }
interface Header { id: number; allocationNo: string; allocationDate: string; requestNo: string; transferType: string | null; priority: string; status: string; approvalStatus: string; remarks: string | null; totalItems: number; totalRequestedQty: number; totalAllocatedQty: number; allocatedByName: string | null; createdByName: string | null; sourceName: string; sourceWarehouse: string | null; destinationName: string; destinationWarehouse: string | null }
interface Data { header: Header; lines: Line[]; editable: boolean; dispatched: boolean }
const PRIO_TONE: Record<string, "danger" | "warning" | "neutral"> = { Urgent: "danger", High: "warning" };

export function StockAllocationView({ id, autoPrint }: { id: number; autoPrint?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = () => fetch(`/api/warehouse/allocation/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setData(j.data); else setErr(j.message || "Not found"); });
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => { if (autoPrint && data) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); } }, [autoPrint, data]);

  async function action(a: string) {
    if (a === "cancel" && !window.confirm("Cancel this allocation and free reserved stock?")) return;
    if (a === "release" && !window.confirm("Release the reserved stock?")) return;
    setBusy(a); setErr("");
    const j = await fetch(`/api/warehouse/allocation/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: a }) }).then((r) => r.json());
    setBusy("");
    if (!j.ok) { setErr(j.message || "Action failed."); return; }
    if (a === "reallocate") router.push(`/warehouse/transfer/allocation/${id}/edit`); else load();
  }

  if (!data) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">{err ? <p className="text-center text-sm text-danger">{err}</p> : <AppLoader label="Loading allocation…" size="sm" />}</div>;
  const h = data.header;
  const active = h.status === "Allocated" || h.status === "Partially Allocated";

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/allocation" className="hover:text-foreground">Stock Allocation</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{h.allocationNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageCheck className="h-5 w-5 text-primary" /> {h.allocationNo} <Badge tone={ALLOC_STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/warehouse/transfer/allocation"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {data.editable && <Link href={`/warehouse/transfer/allocation/${id}/edit`}><Button variant="secondary" size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>}
          {active && <><Button variant="secondary" size="md" disabled={!!busy} onClick={() => action("reallocate")}><RotateCcw className="h-4 w-4" /> Reallocate</Button>
          <Button variant="outline" size="md" disabled={!!busy} onClick={() => action("release")}><Undo2 className="h-4 w-4" /> Release</Button></>}
          {h.status !== "Cancelled" && h.status !== "Released" && <Button variant="ghost" size="md" disabled={!!busy} onClick={() => action("cancel")}><Ban className="h-4 w-4" /> Cancel</Button>}
          <Button variant="outline" size="md" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      {err && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger print:hidden">{err}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="grid gap-4 border-b border-border p-5 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-subtle"><Warehouse className="h-3 w-3" /> Source (Requested From)</p>
              <p className="mt-1 font-bold text-foreground">{h.sourceName || "—"}</p>
              {h.sourceWarehouse && <p className="text-2xs text-muted">Warehouse: {h.sourceWarehouse}</p>}
              {h.allocatedByName && <p className="text-2xs text-muted">Allocated by: {h.allocatedByName}</p>}
            </div>
            <div>
              <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-subtle"><Building2 className="h-3 w-3" /> Destination (Reserve From)</p>
              <p className="mt-1 font-bold text-foreground">{h.destinationName || "—"}</p>
              {h.destinationWarehouse && <p className="text-2xs text-muted">Warehouse: {h.destinationWarehouse}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-border bg-surface-2/40 px-5 py-2.5 text-2xs">
            <span className="text-muted">Request: <strong className="text-foreground">{h.requestNo}</strong></span>
            <span className="text-muted">Date: <strong className="text-foreground">{h.allocationDate}</strong></span>
            <span className="text-muted">Type: <strong className="text-foreground">{h.transferType || "—"}</strong></span>
            <span className="text-muted">Priority: <strong className="text-foreground">{h.priority}</strong></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5">Policy</th><th className="px-4 py-2.5">UoM</th><th className="px-4 py-2.5 text-right">Requested</th><th className="px-4 py-2.5 text-right">Allocated</th><th className="px-4 py-2.5 text-right">Remaining</th><th className="px-4 py-2.5">Reserved (batch / serial)</th><th className="px-4 py-2.5 text-center">Status</th></tr></thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-2"><div className="font-medium text-foreground">{l.productName}</div>{l.sku && <div className="font-mono text-2xs text-subtle">{l.sku}</div>}</td>
                    <td className="px-4 py-2"><Badge tone="neutral">{l.policy}</Badge></td>
                    <td className="px-4 py-2 text-muted">{l.uom || "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{l.requestedQty}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-foreground">{l.allocatedQty}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{l.remainingQty}</td>
                    <td className="px-4 py-2 text-2xs text-muted">{l.lots.length === 0 ? "—" : l.lots.map((x, i) => <div key={i}>{x.serialNo ? <span className="font-mono">{x.serialNo}</span> : <>{x.batchNo || "No batch"}{x.expiryDate ? ` · exp ${x.expiryDate}` : ""} — {x.qty}</>}</div>)}</td>
                    <td className="px-4 py-2 text-center"><Badge tone={LINE_STATUS_TONE[l.allocationStatus] ?? "neutral"}>{l.allocationStatus}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {h.remarks && <div className="border-t border-border p-5 text-2xs"><p className="font-semibold uppercase tracking-wider text-subtle">Remarks</p><p className="mt-0.5 whitespace-pre-line text-muted">{h.remarks}</p></div>}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-foreground">Summary</span><Badge tone={ALLOC_STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge></div>
            <div className="space-y-1.5 text-sm">
              <Row k={`Items (${h.totalItems})`} v={String(h.totalItems)} />
              <Row k="Total Requested" v={String(h.totalRequestedQty)} />
              <Row k="Total Allocated" v={String(h.totalAllocatedQty)} />
              <div className="my-1.5 h-px bg-border" />
              <div className="flex items-center justify-between"><span className="text-muted">Priority</span><Badge tone={PRIO_TONE[h.priority] ?? "neutral"}>{h.priority}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-muted">Approval</span><Badge tone={ALLOC_STATUS_TONE[h.approvalStatus] ?? "neutral"}>{h.approvalStatus}</Badge></div>
              {h.allocatedByName && <Row k="Allocated By" v={h.allocatedByName} />}
            </div>
          </div>
          <p className="rounded-lg bg-info-subtle p-3 text-2xs text-info">Reservation only — physical stock is unchanged and no ledger or accounting entry is posted. Reserved quantity is freed on Release / Cancel and consumed at Dispatch.</p>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>;
}
