"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Boxes, IndianRupee, CalendarClock, Truck, Pencil, Printer, X, Layers, Hash, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { QrCode } from "@/components/ui/QrCode";
import { qrSvgString } from "@/lib/masters/qr";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

// Shared API contract — one source of truth for the GRN detail shapes.
import type { GrnDetail as Grn, GrnDetailLine as GrnLine } from "@/lib/contracts/grn";

interface QrSettings { darkColor: string; lightColor: string; errorCorrection: "L" | "M" | "Q" | "H"; moduleStyle: "square" | "dots" | "rounded"; labelWidthMm: number; labelHeightMm: number; showName: boolean; showPrice: boolean; showCodeText: boolean }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));

export default function GrnViewPage() {
  const fmt = useFmt();
  const money = (n: number) => fmt.money(n);
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [grn, setGrn] = useState<Grn | null>(null);
  const [settings, setSettings] = useState<QrSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [printFor, setPrintFor] = useState<GrnLine | null>(null);

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([
      fetch(`/api/purchase/grn/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/settings/qr-code`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]);
    if (d.ok) setGrn(d.data);
    if (s.ok) setSettings(s.settings);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function cancelGrn() {
    if (!window.confirm("Cancel this GRN? Its received stock and any payable will be reversed. The record is kept with status Cancelled.")) return;
    const j = await fetch(`/api/purchase/grn/${id}/cancel`, { method: "POST" }).then((r) => r.json()).catch(() => ({}));
    if (!j.ok && j.message) window.alert(j.message);
    await load();
  }

  async function doPrint(line: GrnLine, count: number) {
    setBusy(line.id);
    const res = await fetch(`/api/purchase/grn/${id}/qr/print`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineId: line.id, count }) });
    const j = await res.json().catch(() => ({}));
    if (j.ok && settings) printSheet(j.codes as string[], j.line, settings);
    setPrintFor(null);
    await load();
    setBusy(null);
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading GRN…" /></div>;
  if (!grn) return <div className="py-16 text-center text-sm text-muted">GRN not found. <Link href="/purchase/grn" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase/grn" className="hover:text-foreground">Goods Receipt Note</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{grn.grnNo}</span></div>
          <div className="flex items-center gap-2.5"><h1 className="text-xl font-bold tracking-tight text-foreground">{grn.grnNo}</h1><Badge tone={grn.status === "Posted" ? "success" : grn.status === "Cancelled" ? "danger" : "warning"}>{grn.status}</Badge></div>
          <p className="mt-1 text-xs text-subtle">{grn.supplier || "—"}{grn.poNo ? ` · PO ${grn.poNo}` : ""} — QR labels per received line below.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/purchase/grn"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {grn.status !== "Cancelled" && <Link href={`/purchase/grn/new?id=${grn.id}`}><Button size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>}
          {grn.status === "Posted" && <Button variant="outline" size="md" onClick={cancelGrn}><XCircle className="h-4 w-4" /> Cancel GRN</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Meta icon={CalendarClock} label="GRN Date" value={grn.grnDate} />
        <Meta icon={Truck} label="Warehouse" value={grn.warehouse || "—"} />
        <Meta icon={Boxes} label="Total Qty" value={fmt.qty(grn.totalQty)} />
        <Meta icon={IndianRupee} label="Grand Total" value={money(grn.totalValue)} />
      </div>

      {/* Detail cards */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Supplier & Invoice">
          <KV k="Supplier" v={grn.supplier} /><KV k="GSTIN" v={grn.supplierGstin} /><KV k="Contact" v={grn.supplierContact} />
          <KV k="Invoice No" v={grn.supplierInvoiceNo} /><KV k="Invoice Date" v={grn.supplierInvoiceDate} /><KV k="PO No" v={grn.poNo} />
        </Card>
        <Card title="Payment">
          <KV k="Status" v={grn.paymentStatus} tone={grn.paymentStatus === "Paid" ? "success" : grn.paymentStatus === "Partial" ? "info" : "warning"} />
          <KV k="Paid" v={money(grn.amountPaid)} /><KV k="Balance" v={money(grn.totalValue - grn.amountPaid)} />
          {grn.paymentMode && <KV k="Mode" v={grn.paymentMode} />}{grn.paymentRef && <KV k="Ref" v={grn.paymentRef} />}{grn.paymentDate && <KV k="Paid On" v={grn.paymentDate} />}
          {grn.paymentTerms && <KV k="Terms" v={grn.paymentTerms} />}{grn.dueDate && <KV k="Due Date" v={grn.dueDate} />}
        </Card>
        <Card title="Transport">
          <KV k="Transporter" v={grn.transporterName} /><KV k="Mode" v={grn.transportMode} /><KV k="Vehicle" v={grn.vehicleNo} />
          <KV k="LR / Docket" v={grn.lrNo} /><KV k="E-Way Bill" v={grn.ewayBillNo} /><KV k="Packages" v={grn.numPackages ? String(grn.numPackages) : ""} />
          <KV k="Freight" v={grn.freightAmount ? money(grn.freightAmount) : ""} /><KV k="Freight By" v={grn.freightPaidBy} />
        </Card>
        <Card title="Bill Summary">
          <KV k="Subtotal" v={money(grn.subtotal)} />
          <KV k={`GST ${grn.gstMode === "invoice" ? `(@ ${grn.gstPct}%)` : "(line-wise)"}`} v={money(grn.taxTotal)} />
          <KV k="Freight" v={money(grn.freightAmount)} /><KV k="Other" v={money(grn.otherCharges)} />
          {!!grn.roundOff && <KV k="Round Off" v={money(grn.roundOff)} />}
          <div className="my-1 h-px bg-border" />
          <KV k="Grand Total" v={money(grn.totalValue)} strong />
          {!!grn.totalInvoiceValue && <KV k="Invoice Value" v={money(grn.totalInvoiceValue)} />}
        </Card>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Received Lines &amp; QR Labels</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Purchase</th><th className="px-4 py-3 text-right">Selling</th><th className="px-4 py-3">Batch</th><th className="px-4 py-3">QR Mode</th><th className="px-4 py-3 text-center">QR Status</th><th className="px-4 py-3 text-center">Printed</th><th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map((l) => {
                const generated = l.qrStatus === "Generated";
                return (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div></td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt.qty(l.qty)}</td>
                    <td className="px-4 py-3 text-right text-muted">{l.rate !== "" ? money(Number(l.rate)) : "—"}</td>
                    <td className="px-4 py-3 text-right text-muted">{l.sellingPrice !== "" ? money(Number(l.sellingPrice)) : "—"}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{l.batchNo || "—"}{l.expiryDate ? ` · exp ${l.expiryDate}` : ""}</td>
                    <td className="px-4 py-3"><Badge tone="neutral">{l.qrMode === "shared" ? "Same code" : "Unique"}</Badge></td>
                    <td className="px-4 py-3 text-center">{generated ? (l.printedQty > 0 ? <Badge tone="success">Code Generated &amp; Printed</Badge> : <Badge tone="warning">Code Generated, Not Printed</Badge>) : <Badge tone="neutral">Pending</Badge>}</td>
                    <td className="px-4 py-3 text-center text-2xs">{generated ? <span className={cn("font-semibold", l.printedQty >= l.qty ? "text-success" : "text-warning")}>{l.printedQty} / {l.qty}</span> : <span className="text-subtle">—</span>}</td>
                    <td className="px-4 py-3 text-right"><Button variant="secondary" size="sm" onClick={() => setPrintFor(l)} disabled={!generated || busy === l.id}><Printer className="h-3.5 w-3.5" /> Print</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {grn.status === "Draft" && <div className="border-t border-border px-4 py-3 text-2xs text-muted">This GRN is a <strong>Draft</strong> — QR codes &amp; inventory are created when you <strong>Post</strong> it (Edit → Post GRN).</div>}
      </div>

      {printFor && settings && <PrintDialog line={printFor} settings={settings} busy={busy === printFor.id} onClose={() => setPrintFor(null)} onPrint={(n) => doPrint(printFor, n)} />}
    </div>
  );
}

function printSheet(codes: string[], line: { name: string; sku: string; mrp: number | null }, s: QrSettings) {
  const cards = codes.map((code) => `<div class="lbl"><div class="qr">${qrSvgString(code, 150, { dark: s.darkColor, light: s.lightColor, ec: s.errorCorrection, style: s.moduleStyle })}</div><div class="meta">${s.showName ? `<div class="nm">${esc(line.name)}</div>` : ""}${s.showCodeText ? `<div class="cd">${esc(code)}</div>` : ""}${s.showPrice && line.mrp ? `<div class="pr">MRP ₹${esc(String(line.mrp))}</div>` : ""}</div></div>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>QR Labels — ${esc(line.name)}</title><style>@page{margin:8mm}*{box-sizing:border-box}body{font-family:ui-sans-serif,system-ui,Arial;margin:0;color:#0f172a}.sheet{display:grid;grid-template-columns:repeat(auto-fill,${s.labelWidthMm}mm);gap:3mm}.lbl{width:${s.labelWidthMm}mm;height:${s.labelHeightMm}mm;border:0.3mm dashed #cbd5e1;border-radius:1.5mm;padding:1.5mm;display:flex;gap:1.5mm;align-items:center;page-break-inside:avoid;overflow:hidden}.qr svg{width:${Math.min(s.labelHeightMm - 4, s.labelWidthMm * 0.45)}mm;height:${Math.min(s.labelHeightMm - 4, s.labelWidthMm * 0.45)}mm;display:block}.meta{min-width:0;flex:1}.nm{font-size:6.5pt;font-weight:700;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.cd{font-family:ui-monospace,monospace;font-size:5pt;color:#334155;margin-top:0.5mm;word-break:break-all}.pr{font-size:6.5pt;font-weight:700;margin-top:0.5mm}</style></head><body><div class="sheet">${cards}</div><script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body></html>`;
  const w = window.open("", "_blank", "width=920,height=720");
  if (!w) return;
  w.document.write(html); w.document.close();
}

function PrintDialog({ line, settings, busy, onClose, onPrint }: { line: GrnLine; settings: QrSettings; busy: boolean; onClose: () => void; onPrint: (n: number) => void }) {
  const remaining = Math.max(0, line.qty - line.printedQty);
  const [count, setCount] = useState<number>(remaining > 0 ? remaining : line.qty);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><Printer className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-foreground">Print QR Labels</h2><p className="text-2xs text-muted">{line.productName}</p></div></div><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <S label="Quantity" value={line.qty} icon={Boxes} />
            <S label={line.qrMode === "unique" ? "Unique codes" : "Shared code"} value={line.qrMode === "unique" ? line.qrGeneratedCount : 1} icon={line.qrMode === "unique" ? Hash : Layers} />
            <S label="Printed" value={line.printedQty} icon={Printer} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">How many labels to print now?</label>
            <input type="number" min={1} max={5000} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-2xs">
              {remaining > 0 && <button onClick={() => setCount(remaining)} className="rounded border border-border bg-surface px-2 py-0.5 text-muted hover:border-primary hover:text-primary">Remaining ({remaining})</button>}
              <button onClick={() => setCount(line.qty)} className="rounded border border-border bg-surface px-2 py-0.5 text-muted hover:border-primary hover:text-primary">All ({line.qty})</button>
            </div>
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-info-subtle px-3 py-2 text-2xs text-info"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />{line.qrMode === "unique" ? "Each label carries a different reference number; partial prints continue where you left off." : "Every label carries the same reference number; reprint any count, any time."}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button size="md" onClick={() => onPrint(Math.max(1, count))} disabled={busy}><Printer className="h-4 w-4" /> {busy ? "Printing…" : `Print ${Math.max(1, count)}`}</Button></div>
      </div>
    </div>
  );
}

function S({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Boxes }) {
  return <div className="rounded-lg border border-border bg-surface p-2"><Icon className="mx-auto h-3.5 w-3.5 text-muted" /><div className="mt-0.5 text-sm font-bold text-foreground">{value}</div><div className="text-[10px] text-subtle">{label}</div></div>;
}
function Meta({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0"><div className="truncate text-sm font-bold text-foreground">{value}</div><div className="text-2xs text-subtle">{label}</div></div></div>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-subtle">{title}</p><div className="space-y-1 text-xs">{children}</div></div>;
}
function KV({ k, v, tone, strong }: { k: string; v: string; tone?: "success" | "info" | "warning"; strong?: boolean }) {
  if (!v) return null;
  return <div className="flex items-center justify-between gap-2"><span className="text-muted">{k}</span>{tone ? <Badge tone={tone}>{v}</Badge> : <span className={cn("text-right", strong ? "font-bold text-foreground" : "font-medium text-foreground")}>{v}</span>}</div>;
}
