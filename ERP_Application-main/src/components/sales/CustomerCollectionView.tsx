"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HandCoins, ArrowLeft, Printer, User, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { SectionCard } from "@/components/ui/SectionCard";
import { useFmt } from "@/components/settings/GeneralConfigProvider";

interface Alloc { saleId: number; invoiceNo: string; amount: number }
interface Attach { fileName: string; fileUrl: string; fileType: string; size: number }
interface PayLine { mode: string; amount: number; reference: string | null }
interface Collection { id: number; collectionNo: string; customerName: string; collectionDate: string; mode: string; reference: string; totalAmount: number; notes: string; status: string; attachments: Attach[]; payments: PayLine[]; allocations: Alloc[] }
interface Tpl { title: string; headerNote: string; thankYouMessage: string; footerNote: string; showGstin: boolean; showCustomer: boolean }
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));

function buildReceipt(business: { name: string; phone: string; gstin: string }, tpl: Tpl, c: Collection, inr: (x: number) => string): string {
  const rows = c.allocations.map((a) => `<tr><td>${esc(a.invoiceNo)}</td><td class="r">${inr(a.amount)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.collectionNo)}</title>
  <style>*{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}body{width:320px;margin:0 auto;padding:12px;color:#111;font-size:12px}
  .c{text-align:center}h2{margin:0;font-size:16px}.dim{color:#555;font-size:11px}table{width:100%;border-collapse:collapse;margin-top:6px}td,th{padding:3px 0;text-align:left}.r{text-align:right}
  .line{border-top:1px dashed #999;margin:6px 0}.tot{font-weight:bold;font-size:14px}</style></head><body>
  <div class="c"><h2>${esc(business.name)}</h2>${tpl.headerNote ? `<div class="dim">${esc(tpl.headerNote)}</div>` : ""}${business.phone ? `<div class="dim">Ph: ${esc(business.phone)}</div>` : ""}${tpl.showGstin && business.gstin ? `<div class="dim">GSTIN: ${esc(business.gstin)}</div>` : ""}
  <div style="margin-top:4px;font-weight:bold">${esc(tpl.title || "COLLECTION RECEIPT")}</div></div>
  <div class="line"></div>
  <div>Receipt: ${esc(c.collectionNo)}</div><div>Date: ${esc(c.collectionDate)}</div>${tpl.showCustomer ? `<div>Customer: ${esc(c.customerName)}</div>` : ""}
  ${c.payments.length > 1
    ? `<div>Modes:</div>${c.payments.map((p) => `<div class="dim">&nbsp;&nbsp;${esc(p.mode)}${p.reference ? ` · ${esc(p.reference)}` : ""} — ${inr(p.amount)}</div>`).join("")}`
    : `<div>Mode: ${esc(c.mode)}${c.reference ? ` · Ref ${esc(c.reference)}` : ""}</div>`}
  <div class="line"></div>
  <table><thead><tr><th>Invoice</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="line"></div>
  <div class="r tot">Total Received: ${inr(c.totalAmount)}</div>
  <div class="line"></div>
  <div class="c dim" style="margin-top:8px">${esc(tpl.thankYouMessage || "Thank you — received with thanks.")}</div>${tpl.footerNote ? `<div class="c dim">${esc(tpl.footerNote)}</div>` : ""}
  </body></html>`;
}

export function CustomerCollectionView({ id }: { id: number }) {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const [data, setData] = useState<{ business: { name: string; phone: string; gstin: string }; template: Tpl; collection: Collection } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { try { const j = await fetch(`/api/sales/collection/${id}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setData(j); } catch { /* */ } finally { setLoading(false); } })();
  }, [id]);

  function print() {
    if (!data) return;
    const w = window.open("", "_blank", "width=420,height=640");
    if (w) { w.document.write(buildReceipt(data.business, data.template, data.collection, inr)); w.document.close(); w.focus(); w.print(); }
  }

  if (loading) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading collection…" size="sm" /></div>;
  if (!data) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted">Collection not found. <Link href="/sales/collections" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const c = data.collection;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales/collections" className="hover:text-foreground">Customer Collections</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{c.collectionNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><HandCoins className="h-5 w-5 text-primary" /> {c.collectionNo}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/collections"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={print}><Printer className="h-4 w-4" /> Print Receipt</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <SectionCard icon={FileText} title="Invoices Settled" bodyClass="">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Invoice</th><th className="px-4 py-2.5 text-right">Amount Collected</th></tr></thead>
              <tbody>
                {c.allocations.map((a, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5"><Link href={`/sales/invoice/${a.saleId}`} className="font-mono text-2xs font-semibold text-primary hover:underline">{a.invoiceNo}</Link></td>
                    <td className="px-4 py-2.5 text-right font-semibold text-foreground">{inr(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border bg-surface-2 font-bold text-foreground"><td className="px-4 py-3">Total Received</td><td className="px-4 py-3 text-right tabular-nums">{inr(c.totalAmount)}</td></tr></tfoot>
            </table>
          </div>
          {c.attachments.length > 0 && (
            <div className="border-t border-border p-4">
              <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-subtle">Documents</p>
              <div className="flex flex-wrap gap-2">{c.attachments.map((a, i) => <a key={i} href={a.fileUrl} target="_blank" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><FileText className="h-3.5 w-3.5" /> {a.fileName}</a>)}</div>
            </div>
          )}
        </SectionCard>

        <aside>
          <SectionCard icon={User} title="Collection Details">
            <div className="space-y-2 text-sm">
              <Row k="Customer" v={c.customerName || "—"} />
              <Row k="Date" v={c.collectionDate} />
              {c.payments.length > 1 ? (
                <div><div className="mb-1 text-muted">Payment Modes</div><div className="space-y-0.5">{c.payments.map((p, i) => <div key={i} className="flex items-center justify-between rounded bg-surface-2 px-2 py-1 text-2xs"><span className="text-foreground">{p.mode}{p.reference ? ` · ${p.reference}` : ""}</span><span className="font-semibold text-foreground">{inr(p.amount)}</span></div>)}</div></div>
              ) : (
                <Row k="Mode" v={c.mode} />
              )}
              {c.payments.length <= 1 && c.reference && <Row k="Reference" v={c.reference} />}
              <Row k="Status" v={c.status} />
              <div className="my-1.5 h-px bg-border" />
              <div className="flex items-center justify-between text-lg font-bold text-foreground"><span>Total</span><span>{inr(c.totalAmount)}</span></div>
              {c.notes && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-2xs text-muted">{c.notes}</p>}
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>;
}
