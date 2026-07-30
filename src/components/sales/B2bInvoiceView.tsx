"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReceiptText, ArrowLeft, Printer, Building2, FileText as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { buildReceiptHtml } from "@/components/sales/PosBilling";
import { formatMoneyWith, formatQtyWith } from "@/lib/settings/generalConfig";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";

const PAY_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { Paid: "success", Partial: "warning", Credit: "danger" };

interface SaleLine { productName: string; sku: string; hsn: string; uom: string; qty: number; mrp: number | null; rate: number; discAmount: number; taxPct: number; taxAmount: number; value: number }
interface Attach { fileName: string; fileUrl: string; fileType: string; size: number }
interface Sale {
  id: number; invoiceNo: string; saleDate: string; status: string; channel: string; customerName: string; customerPhone: string;
  customerGstin: string; customerAddress: string; customerCity: string; customerState: string; dueDate: string; paymentTerms: string;
  soNumber: string; termsConditions: string; notes: string; attachments: Attach[];
  subtotal: number; itemDiscount: number; billDiscount: number; taxableValue: number; cgst: number; sgst: number; igst: number; taxTotal: number;
  tdsAmount: number; tcsAmount: number;
  roundOff: number; total: number; amountPaid: number; paymentMode: string; paymentStatus: string; itemCount: number; lines: SaleLine[];
}

export function B2bInvoiceView({ id }: { id: number }) {
  const [data, setData] = useState<{ business: Record<string, string>; template: Record<string, unknown>; sale: Sale } | null>(null);
  const gcfg = useGeneralConfig();
  const [loading, setLoading] = useState(true);
  const inr = (x: number) => formatMoneyWith(gcfg, x);
  const fq = (x: number) => formatQtyWith(gcfg, x);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch(`/api/sales/${id}`, { cache: "no-store" }).then((r) => r.json());
        if (j.ok) setData(j);
      } catch { /* */ } finally { setLoading(false); }
    })();
  }, [id]);

  function print() {
    if (!data) return;
    const html = buildReceiptHtml(data.business, data.template, data.sale as unknown as Record<string, unknown>);
    const w = window.open("", "_blank", "width=420,height=640");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  }

  if (loading) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading invoice…" size="sm" /></div>;
  if (!data) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted">Invoice not found. <Link href="/sales/invoice" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const s = data.sale;
  const payable = +(s.total - s.tdsAmount).toFixed(2); // TDS withheld by buyer
  const balance = +(payable - s.amountPaid).toFixed(2);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales/invoice" className="hover:text-foreground">Sales Invoice (B2B)</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{s.invoiceNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ReceiptText className="h-5 w-5 text-primary" /> {s.invoiceNo}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/invoice"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={print}><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Invoice body */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Parties */}
          <div className="grid gap-4 border-b border-border p-5 sm:grid-cols-2">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">Seller</p>
              <p className="mt-1 font-bold text-foreground">{data.business.name}</p>
              {data.business.gstin && <p className="text-2xs text-muted">GSTIN: {data.business.gstin}</p>}
              {data.business.phone && <p className="text-2xs text-muted">Ph: {data.business.phone}</p>}
            </div>
            <div>
              <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-subtle"><Building2 className="h-3 w-3" /> Bill To</p>
              <p className="mt-1 font-bold text-foreground">{s.customerName || "—"}</p>
              {s.customerGstin && <p className="text-2xs text-muted">GSTIN: {s.customerGstin}</p>}
              {(s.customerAddress || s.customerCity || s.customerState) && <p className="text-2xs text-muted">{[s.customerAddress, s.customerCity, s.customerState].filter(Boolean).join(", ")}</p>}
              {s.customerPhone && <p className="text-2xs text-muted">Ph: {s.customerPhone}</p>}
            </div>
          </div>
          {/* Meta */}
          <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-border bg-surface-2/40 px-5 py-2.5 text-2xs">
            <span className="text-muted">Date: <strong className="text-foreground">{s.saleDate}</strong></span>
            {s.dueDate && <span className="text-muted">Due: <strong className="text-foreground">{s.dueDate}</strong></span>}
            {s.soNumber && <span className="text-muted">SO No: <strong className="text-foreground">{s.soNumber}</strong></span>}
            {s.paymentTerms && <span className="text-muted">Terms: <strong className="text-foreground">{s.paymentTerms}</strong></span>}
            <span className="text-muted">Supply: <strong className="text-foreground">{s.igst > 0 ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}</strong></span>
          </div>
          {/* Lines */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Item</th><th className="px-4 py-2.5 text-right">Qty</th><th className="px-4 py-2.5 text-right">Rate</th><th className="px-4 py-2.5 text-right">Disc</th><th className="px-4 py-2.5 text-right">Tax</th><th className="px-4 py-2.5 text-right">Amount</th></tr></thead>
              <tbody>
                {s.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku}{l.hsn ? ` · HSN ${l.hsn}` : ""}</div></td>
                    <td className="px-4 py-2 text-right tabular-nums">{fq(l.qty)} {l.uom}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{inr(l.rate)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{l.discAmount ? inr(l.discAmount) : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{l.taxAmount ? `${inr(l.taxAmount)} @${l.taxPct}%` : "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-foreground">{inr(l.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Note / Terms / Documents */}
          {(s.notes || s.termsConditions || s.attachments.length > 0) && (
            <div className="grid gap-4 border-t border-border p-5 sm:grid-cols-2">
              {(s.notes || s.termsConditions) && (
                <div className="space-y-2 text-2xs">
                  {s.notes && <div><p className="font-semibold uppercase tracking-wider text-subtle">Customer Note</p><p className="mt-0.5 whitespace-pre-line text-muted">{s.notes}</p></div>}
                  {s.termsConditions && <div><p className="font-semibold uppercase tracking-wider text-subtle">Terms &amp; Conditions</p><p className="mt-0.5 whitespace-pre-line text-muted">{s.termsConditions}</p></div>}
                </div>
              )}
              {s.attachments.length > 0 && (
                <div>
                  <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-subtle"><FileIcon className="h-3 w-3" /> Documents</p>
                  <div className="mt-1 space-y-1.5">
                    {s.attachments.map((a, i) => <a key={i} href={a.fileUrl} target="_blank" className="flex items-center gap-1.5 text-xs text-primary hover:underline"><FileIcon className="h-3.5 w-3.5" /> {a.fileName}</a>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Totals + status */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-foreground">Summary</span><Badge tone={PAY_TONE[s.paymentStatus] ?? "neutral"}>{s.paymentStatus}</Badge></div>
            <div className="space-y-1.5 text-sm">
              <Row k={`Items (${s.itemCount})`} v={inr(s.subtotal)} />
              {s.itemDiscount > 0 && <Row k="Item Discount" v={`- ${inr(s.itemDiscount)}`} />}
              {s.billDiscount > 0 && <Row k="Bill Discount" v={`- ${inr(s.billDiscount)}`} />}
              <Row k="Taxable Value" v={inr(s.taxableValue)} />
              {s.igst > 0 ? <Row k="IGST" v={inr(s.igst)} /> : <><Row k="CGST" v={inr(s.cgst)} /><Row k="SGST" v={inr(s.sgst)} /></>}
              {s.roundOff !== 0 && <Row k="Round Off" v={inr(s.roundOff)} />}
              {s.tcsAmount > 0 && <Row k="TCS" v={`+ ${inr(s.tcsAmount)}`} />}
              <div className="my-1.5 h-px bg-border" />
              <div className="flex items-center justify-between text-lg font-bold text-foreground"><span>Invoice Total</span><span>{inr(s.total)}</span></div>
              {s.tdsAmount > 0 && <><Row k="Less: TDS" v={`- ${inr(s.tdsAmount)}`} /><div className="flex items-center justify-between font-semibold text-primary"><span>Net Payable</span><span>{inr(payable)}</span></div></>}
              <Row k="Paid" v={inr(s.amountPaid)} />
              <div className="flex items-center justify-between font-semibold"><span className="text-muted">Balance Due</span><span className={balance > 0 ? "text-danger" : "text-success"}>{inr(balance)}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="text-foreground">{v}</span></div>;
}
