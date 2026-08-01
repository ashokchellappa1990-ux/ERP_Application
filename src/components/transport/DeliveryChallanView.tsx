"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ArrowLeft, Printer, RefreshCw, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";
import { formatMoneyWith, formatQtyWith } from "@/lib/settings/generalConfig";

interface Item { id: number; productName: string; sku: string; uom: string; batchNo: string; dispatchedQty: number; rate: number; value: number }
interface Dc {
  id: number; dcNo: string; dcDate: string; dispatchExecutionId: number; customerId: number | null;
  customerName: string; deliveryAddress: string; totalQty: number; totalValue: number; status: string;
  printedCount: number; remarks: string;
  execution: { id: number; docNo: string; docType: string; docDate: string; warehouse: string } | null;
  items: Item[];
}

const STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "danger"> = {
  Draft: "neutral", Generated: "primary", Printed: "success", Cancelled: "danger",
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));

export function DeliveryChallanView({ id }: { id: number }) {
  const [data, setData] = useState<Dc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const gcfg = useGeneralConfig();
  const inr = (x: number) => formatMoneyWith(gcfg, x);
  const fq = (x: number) => formatQtyWith(gcfg, x);

  async function load() {
    setLoading(true);
    try {
      const j = await fetch(`/api/transport/delivery-challan/${id}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) setData(j.dc);
    } catch { /* */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  function openPrintWindow(dc: Dc) {
    const rows = dc.items.map((it) => `
      <tr>
        <td>${esc(it.productName)}${it.sku ? `<div class="sub">${esc(it.sku)}</div>` : ""}</td>
        <td>${esc(it.batchNo || "—")}</td>
        <td>${esc(it.uom || "—")}</td>
        <td class="r">${fq(it.dispatchedQty)}</td>
        <td class="r">${inr(it.rate)}</td>
        <td class="r">${inr(it.value)}</td>
      </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Delivery Challan ${esc(dc.dcNo)}</title><style>
      @page{margin:12mm}*{box-sizing:border-box}body{font-family:ui-sans-serif,system-ui,Arial;margin:0;color:#0f172a;font-size:12px}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:10px}
      .co{font-size:16px;font-weight:800}.doc{font-size:14px;font-weight:800;text-align:right}
      .meta{display:flex;justify-content:space-between;margin-bottom:10px;font-size:11px}
      .meta div{max-width:48%}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #cbd5e1;padding:5px 7px;font-size:11px;text-align:left}
      th{background:#f1f5f9;text-transform:uppercase;font-size:9px;letter-spacing:.04em}
      .r{text-align:right}.sub{font-size:9px;color:#64748b}
      tfoot td{font-weight:700;background:#f8fafc}
      .rmk{margin-top:10px;font-size:11px}
      </style></head><body>
      <div class="hdr"><div class="co">Company Name</div><div class="doc">DELIVERY CHALLAN<br/><span style="font-weight:600">${esc(dc.dcNo)}</span></div></div>
      <div class="meta">
        <div><strong>Customer:</strong> ${esc(dc.customerName || "—")}<br/>${esc(dc.deliveryAddress || "")}</div>
        <div style="text-align:right"><strong>Date:</strong> ${esc(dc.dcDate)}<br/>${dc.execution ? `<strong>Dispatch:</strong> ${esc(dc.execution.docNo)}` : ""}</div>
      </div>
      <table><thead><tr><th>Product</th><th>Batch</th><th>UOM</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Value</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="r">${fq(dc.totalQty)}</td><td></td><td class="r">${inr(dc.totalValue)}</td></tr></tfoot>
      </table>
      ${dc.remarks ? `<div class="rmk"><strong>Remarks:</strong> ${esc(dc.remarks)}</div>` : ""}
      <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
      </body></html>`;
    const w = window.open("", "_blank", "width=900,height=720");
    if (!w) return;
    w.document.write(html); w.document.close();
  }

  async function handlePrint() {
    if (!data || busy) return;
    setBusy(true);
    try {
      const j = await fetch(`/api/transport/delivery-challan/${id}/print`, { method: "POST" }).then((r) => r.json());
      if (j.ok) { setData(j.dc); openPrintWindow(j.dc); }
    } catch { /* */ } finally { setBusy(false); }
  }

  function handlePreview() { if (data) openPrintWindow(data); }

  if (loading) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading delivery challan…" size="sm" /></div>;
  if (!data) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted">Delivery challan not found. <Link href="/transport/delivery-challan" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const isPrinted = data.printedCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <Link href="/transport/delivery-challan" className="hover:text-foreground">Delivery Challan</Link>
            <span className="text-subtle">/</span><span className="font-medium text-foreground">{data.dcNo}</span>
          </div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileText className="h-5 w-5 text-primary" /> {data.dcNo} <Badge tone={STATUS_TONE[data.status] ?? "neutral"}>{data.status}</Badge></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/transport/delivery-challan"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button variant="outline" size="md" onClick={handlePreview}>Preview</Button>
          <Button size="md" onClick={handlePrint} disabled={busy}>{isPrinted ? <RefreshCw className="h-4 w-4" /> : <Printer className="h-4 w-4" />} {isPrinted ? "Reprint" : "Print"}</Button>
          <Button variant="outline" size="md" onClick={handlePrint} disabled={busy}><Printer className="h-4 w-4" /> PDF</Button>
          <span title="Coming in Phase 2"><Button variant="outline" size="md" disabled className="cursor-not-allowed opacity-50"><Mail className="h-4 w-4" /> Email</Button></span>
          <span title="Coming in Phase 2"><Button variant="outline" size="md" disabled className="cursor-not-allowed opacity-50"><MessageCircle className="h-4 w-4" /> WhatsApp</Button></span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid gap-4 border-b border-border p-5 sm:grid-cols-2">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">Customer</p>
            <p className="mt-1 font-bold text-foreground">{data.customerName || "—"}</p>
            {data.deliveryAddress && <p className="text-2xs text-muted">{data.deliveryAddress}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">Document</p>
            <p className="mt-1 text-sm text-muted">DC Date: <strong className="text-foreground">{data.dcDate}</strong></p>
            {data.execution && <p className="text-2xs text-muted">Dispatch Execution: <strong className="text-foreground">{data.execution.docNo}</strong></p>}
            <p className="text-2xs text-muted">Printed {data.printedCount} time{data.printedCount === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5">Batch</th><th className="px-4 py-2.5">UOM</th><th className="px-4 py-2.5 text-right">Qty</th><th className="px-4 py-2.5 text-right">Rate</th><th className="px-4 py-2.5 text-right">Value</th></tr></thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2"><div className="font-medium text-foreground">{it.productName}</div>{it.sku && <div className="font-mono text-2xs text-subtle">{it.sku}</div>}</td>
                  <td className="px-4 py-2 text-muted">{it.batchNo || "—"}</td>
                  <td className="px-4 py-2 text-muted">{it.uom || "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fq(it.dispatchedQty)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{inr(it.rate)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-foreground">{inr(it.value)}</td>
                </tr>
              ))}
              {data.items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">No linked dispatch items found.</td></tr>}
            </tbody>
            <tfoot><tr className="border-t-2 border-border bg-surface-2 font-bold text-foreground"><td className="px-4 py-3" colSpan={3}>Total</td><td className="px-4 py-3 text-right tabular-nums">{fq(data.totalQty)}</td><td className="px-4 py-3" /><td className="px-4 py-3 text-right tabular-nums">{inr(data.totalValue)}</td></tr></tfoot>
          </table>
        </div>
        {data.remarks && <div className="border-t border-border p-4 text-2xs"><p className="font-semibold uppercase tracking-wider text-subtle">Remarks</p><p className="mt-0.5 whitespace-pre-line text-muted">{data.remarks}</p></div>}
      </div>
    </div>
  );
}
