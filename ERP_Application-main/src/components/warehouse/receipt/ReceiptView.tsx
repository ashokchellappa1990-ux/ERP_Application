"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageOpen, ArrowLeft, CheckCircle2, Ban, Printer, Warehouse, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { RECEIPT_STATUS_TONE } from "@/lib/contracts/stockReceipt";

interface Item { id: number; productName: string; sku: string | null; uom: string | null; batchNo: string | null; expiryDate: string | null; serials: string[]; dispatchQty: number; receivedQty: number; missingQty: number; damagedQty: number; acceptedQty: number; purchasePrice: number; sellingPrice: number; mrp: number; remarks: string | null }
interface Header { id: number; receiptNo: string; receiptDate: string; dispatchNo: string | null; dispatchDate: string | null; status: string; remarks: string | null; vehicleNo: string | null; driverName: string | null; transportName: string | null; totalItems: number; totalReceivedQty: number; totalAcceptedQty: number; totalDamagedQty: number; totalMissingQty: number; totalValue: number; createdByName: string | null; receivedByName: string | null; completedAt: string | null; sourceName: string; destinationName: string; destinationWarehouse: string | null }
interface Data { header: Header; items: Item[]; editable: boolean }

export function ReceiptView({ id, autoPrint }: { id: number; autoPrint?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = () => fetch(`/api/warehouse/receipt/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setData(j.data); else setErr(j.message || "Not found"); });
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => { if (autoPrint && data) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); } }, [autoPrint, data]);

  async function action(a: "receive" | "cancel") {
    if (a === "cancel" && !window.confirm("Cancel this draft receipt?")) return;
    if (a === "receive" && !window.confirm("Confirm receipt? This will add stock to your branch.")) return;
    setBusy(a); setErr("");
    const j = await fetch(`/api/warehouse/receipt/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: a }) }).then((r) => r.json());
    setBusy("");
    if (!j.ok) { setErr(j.message || "Action failed."); return; }
    a === "cancel" ? router.push("/warehouse/transfer/receipt") : load();
  }

  if (!data) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">{err ? <p className="text-center text-sm text-danger">{err}</p> : <AppLoader label="Loading receipt…" size="sm" />}</div>;
  const h = data.header;

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/receipt" className="hover:text-foreground">Stock Transfer Receipt</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{h.receiptNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageOpen className="h-5 w-5 text-primary" /> {h.receiptNo} <Badge tone={RECEIPT_STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/warehouse/transfer/receipt"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {data.editable && <><Button size="md" disabled={!!busy} onClick={() => action("receive")}><CheckCircle2 className="h-4 w-4" /> Receive</Button>
          <Button variant="ghost" size="md" disabled={!!busy} onClick={() => action("cancel")}><Ban className="h-4 w-4" /> Cancel</Button></>}
          <Button variant="outline" size="md" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Receipt</Button>
        </div>
      </div>

      {err && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger print:hidden">{err}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="grid gap-4 border-b border-border p-5 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-subtle"><Warehouse className="h-3 w-3" /> Received From (Source)</p>
              <p className="mt-1 font-bold text-foreground">{h.sourceName || "—"}</p>
              {h.dispatchNo && <p className="text-2xs text-muted">Dispatch: {h.dispatchNo} · {h.dispatchDate}</p>}
            </div>
            <div>
              <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-subtle"><Building2 className="h-3 w-3" /> Received At (Destination)</p>
              <p className="mt-1 font-bold text-foreground">{h.destinationName || "—"}</p>
              {h.destinationWarehouse && <p className="text-2xs text-muted">Warehouse: {h.destinationWarehouse}</p>}
              {h.receivedByName && <p className="text-2xs text-muted">Received by: {h.receivedByName}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-border bg-surface-2/40 px-5 py-2.5 text-2xs">
            <span className="text-muted">Receipt Date: <strong className="text-foreground">{h.receiptDate}</strong></span>
            {h.vehicleNo && <span className="text-muted">Vehicle: <strong className="text-foreground">{h.vehicleNo}</strong></span>}
            {h.driverName && <span className="text-muted">Driver: <strong className="text-foreground">{h.driverName}</strong></span>}
            {h.transportName && <span className="text-muted">Transport: <strong className="text-foreground">{h.transportName}</strong></span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5">Batch / Serial</th><th className="px-4 py-2.5 text-right">Dispatch</th><th className="px-4 py-2.5 text-right">Received</th><th className="px-4 py-2.5 text-right">Accepted</th><th className="px-4 py-2.5 text-right">Damaged</th><th className="px-4 py-2.5 text-right">Missing</th><th className="px-4 py-2.5 text-right">Sell. Price</th></tr></thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-2"><div className="font-medium text-foreground">{it.productName}</div>{it.sku && <div className="font-mono text-2xs text-subtle">{it.sku}</div>}</td>
                    <td className="px-4 py-2 text-2xs text-muted">{it.serials.length ? <span className="font-mono">{it.serials.join(", ")}</span> : it.batchNo ? <>{it.batchNo}{it.expiryDate ? ` · exp ${it.expiryDate}` : ""}</> : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{it.dispatchQty}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-foreground">{it.receivedQty}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-success">{it.acceptedQty}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-warning">{it.damagedQty || "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-danger">{it.missingQty || "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{it.sellingPrice ? it.sellingPrice.toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {h.remarks && <div className="border-t border-border p-5 text-2xs"><p className="font-semibold uppercase tracking-wider text-subtle">Remarks</p><p className="mt-0.5 whitespace-pre-line text-muted">{h.remarks}</p></div>}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-foreground">Summary</span><Badge tone={RECEIPT_STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge></div>
            <div className="space-y-1.5 text-sm">
              <Row k={`Items (${h.totalItems})`} v={String(h.totalItems)} />
              <Row k="Received" v={String(h.totalReceivedQty)} />
              <Row k="Accepted" v={String(h.totalAcceptedQty)} />
              <Row k="Damaged" v={String(h.totalDamagedQty)} />
              <Row k="Missing" v={String(h.totalMissingQty)} />
              <div className="my-1.5 h-px bg-border" />
              <Row k="Stock Value" v={`₹${(h.totalValue || 0).toLocaleString()}`} />
              {h.completedAt && <Row k="Completed" v={new Date(h.completedAt).toLocaleString()} />}
            </div>
          </div>
          <p className="rounded-lg bg-info-subtle p-3 text-2xs text-info">Posts internal accounting only: <strong>Inventory Dr / Inventory In-Transit Cr</strong>. Accepted stock is now sellable at this branch; damaged stock sits in Damage/Quality-Hold; missing qty remains in-transit. No purchase, supplier or GST entries.</p>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>;
}
