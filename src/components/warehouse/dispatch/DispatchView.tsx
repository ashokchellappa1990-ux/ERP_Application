"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, ArrowLeft, CheckCircle2, Ban, Printer, FileCheck2, Warehouse, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { DISPATCH_STATUS_TONE } from "@/lib/contracts/stockDispatch";
import { buildChallanHtml } from "./challan";

interface Item { id: number; productName: string; sku: string | null; uom: string | null; batchNo: string | null; expiryDate: string | null; serials: string[]; availableQty: number; requestedQty: number; allocatedQty: number; dispatchQty: number; unitCost: number; stockValue: number; remarks: string | null }
interface Header { id: number; dispatchNo: string; dispatchDate: string; dispatchType: string; referenceType: string | null; referenceNo: string | null; priority: string; status: string; approvalStatus: string; remarks: string | null; vehicleNo: string | null; driverName: string | null; transportName: string | null; lrNumber: string | null; expectedDeliveryDate: string | null; challanNo: string | null; dispatchedAt: string | null; createdByName: string | null; totalItems: number; totalDispatchQty: number; totalValue: number; sourceName: string; sourceWarehouse: string | null; destinationName: string; destinationWarehouse: string | null }
interface Data { header: Header; items: Item[]; editable: boolean }
const PRIO_TONE: Record<string, "danger" | "warning" | "neutral"> = { Urgent: "danger", High: "warning" };

export function DispatchView({ id, autoPrint }: { id: number; autoPrint?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = () => fetch(`/api/warehouse/dispatch/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setData(j.data); else setErr(j.message || "Not found"); });
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => { if (autoPrint && data) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); } }, [autoPrint, data]);

  async function action(a: "dispatch" | "cancel") {
    if (a === "cancel" && !window.confirm("Cancel this draft dispatch?")) return;
    if (a === "dispatch" && !window.confirm("Dispatch now? This will reduce stock and post the transfer.")) return;
    setBusy(a); setErr("");
    const j = await fetch(`/api/warehouse/dispatch/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: a }) }).then((r) => r.json());
    setBusy("");
    if (!j.ok) { setErr(j.message || "Action failed."); return; }
    a === "cancel" ? router.push("/warehouse/transfer/dispatch") : load();
  }
  async function challan() {
    setBusy("challan"); setErr("");
    const j = await fetch(`/api/warehouse/dispatch/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "challan" }) }).then((r) => r.json());
    setBusy("");
    if (!j.ok) { setErr(j.message || "Failed."); return; }
    await load();
    printChallan(j.challanNo);
  }
  function printChallan(challanNo?: string | null) {
    if (!data) return;
    const html = buildChallanHtml(data.header, data.items, challanNo ?? data.header.challanNo);
    const w = window.open("", "_blank", "width=820,height=900");
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); }
  }

  if (!data) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">{err ? <p className="text-center text-sm text-danger">{err}</p> : <AppLoader label="Loading dispatch…" size="sm" />}</div>;
  const h = data.header;

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/dispatch" className="hover:text-foreground">Stock Transfer Dispatch</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{h.dispatchNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> {h.dispatchNo} <Badge tone={DISPATCH_STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge>{h.challanNo && <Badge tone="info">DC {h.challanNo}</Badge>}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/warehouse/transfer/dispatch"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {data.editable && <><Button size="md" disabled={!!busy} onClick={() => action("dispatch")}><CheckCircle2 className="h-4 w-4" /> Dispatch</Button>
          <Button variant="ghost" size="md" disabled={!!busy} onClick={() => action("cancel")}><Ban className="h-4 w-4" /> Cancel</Button></>}
          {(h.status === "Dispatched" || h.status === "Partially Dispatched") && <Button variant="secondary" size="md" disabled={!!busy} onClick={h.challanNo ? () => printChallan() : challan}><FileCheck2 className="h-4 w-4" /> {h.challanNo ? "Print Delivery Challan" : "Generate Delivery Challan"}</Button>}
          <Button variant="outline" size="md" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Note</Button>
        </div>
      </div>

      {err && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger print:hidden">{err}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="grid gap-4 border-b border-border p-5 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-subtle"><Warehouse className="h-3 w-3" /> Dispatch From (Source)</p>
              <p className="mt-1 font-bold text-foreground">{h.sourceName || "—"}</p>
              {h.sourceWarehouse && <p className="text-2xs text-muted">Warehouse: {h.sourceWarehouse}</p>}
              {h.createdByName && <p className="text-2xs text-muted">By: {h.createdByName}</p>}
            </div>
            <div>
              <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-subtle"><Building2 className="h-3 w-3" /> Dispatch To (Destination)</p>
              <p className="mt-1 font-bold text-foreground">{h.destinationName || "—"}</p>
              {h.destinationWarehouse && <p className="text-2xs text-muted">Warehouse: {h.destinationWarehouse}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-border bg-surface-2/40 px-5 py-2.5 text-2xs">
            <span className="text-muted">Date: <strong className="text-foreground">{h.dispatchDate}</strong></span>
            <span className="text-muted">Type: <strong className="text-foreground">{h.dispatchType}</strong></span>
            {h.referenceNo && <span className="text-muted">Ref: <strong className="text-foreground">{h.referenceNo}</strong></span>}
            <span className="text-muted">Priority: <strong className="text-foreground">{h.priority}</strong></span>
            {h.vehicleNo && <span className="text-muted">Vehicle: <strong className="text-foreground">{h.vehicleNo}</strong></span>}
            {h.driverName && <span className="text-muted">Driver: <strong className="text-foreground">{h.driverName}</strong></span>}
            {h.lrNumber && <span className="text-muted">LR: <strong className="text-foreground">{h.lrNumber}</strong></span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5">Batch / Serial</th><th className="px-4 py-2.5">UoM</th><th className="px-4 py-2.5 text-right">Dispatch Qty</th><th className="px-4 py-2.5 text-right">Unit Cost</th><th className="px-4 py-2.5 text-right">Stock Value</th></tr></thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-2"><div className="font-medium text-foreground">{it.productName}</div>{it.sku && <div className="font-mono text-2xs text-subtle">{it.sku}</div>}</td>
                    <td className="px-4 py-2 text-2xs text-muted">{it.serials.length ? <span className="font-mono">{it.serials.join(", ")}</span> : it.batchNo ? <>{it.batchNo}{it.expiryDate ? ` · exp ${it.expiryDate}` : ""}</> : "—"}</td>
                    <td className="px-4 py-2 text-muted">{it.uom || "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-foreground">{it.dispatchQty}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{it.unitCost ? it.unitCost.toLocaleString() : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{it.stockValue ? it.stockValue.toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {h.remarks && <div className="border-t border-border p-5 text-2xs"><p className="font-semibold uppercase tracking-wider text-subtle">Remarks</p><p className="mt-0.5 whitespace-pre-line text-muted">{h.remarks}</p></div>}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-foreground">Summary</span><Badge tone={DISPATCH_STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge></div>
            <div className="space-y-1.5 text-sm">
              <Row k={`Items (${h.totalItems})`} v={String(h.totalItems)} />
              <Row k="Total Dispatch Qty" v={String(h.totalDispatchQty)} />
              <Row k="Total Stock Value" v={`₹${(h.totalValue || 0).toLocaleString()}`} />
              <div className="my-1.5 h-px bg-border" />
              <div className="flex items-center justify-between"><span className="text-muted">Priority</span><Badge tone={PRIO_TONE[h.priority] ?? "neutral"}>{h.priority}</Badge></div>
              {h.dispatchedAt && <Row k="Dispatched" v={new Date(h.dispatchedAt).toLocaleString()} />}
            </div>
          </div>
          <p className="rounded-lg bg-info-subtle p-3 text-2xs text-info">Posts internal-movement accounting only: <strong>Inventory In-Transit Dr / Inventory Cr</strong>. Stock moves to the destination&apos;s In-Transit and is released to real stock at Transfer Receipt. No sales, GST or party ledgers.</p>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>;
}
