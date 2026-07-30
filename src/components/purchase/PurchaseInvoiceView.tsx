"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ReceiptText, CalendarClock, Truck, Wallet, FileText, CheckCircle2, XCircle, MessageSquare, Boxes, Landmark, Paperclip, Printer, Banknote } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { PurchaseInvoiceDetail as PI } from "@/lib/contracts/purchaseInvoice";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const STATUS_TONE: Record<string, Tone> = { Posted: "success", Approved: "info", "Pending Approval": "warning", Draft: "neutral", Cancelled: "danger" };
const PAY_TONE: Record<string, Tone> = { "Fully Paid": "success", "Partially Paid": "warning", Unpaid: "danger", "—": "neutral" };

export function PurchaseInvoiceView({ id }: { id: string }) {
  const fmt = useFmt();
  const money = (x: number) => fmt.money(x);
  const toast = useToast();
  const [data, setData] = useState<PI | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"approve" | "cancel" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch(`/api/purchase/invoice/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j.data);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!action) return;
    setBusy(true);
    const j = await fetch(`/api/purchase/invoice/${id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: note.trim() || undefined }) }).then((r) => r.json()).catch(() => ({}));
    const ok = toast.result(j, action === "approve" ? "Invoice approved & posted." : "Invoice cancelled.", action === "approve" ? "Could not approve." : "Could not cancel.");
    setBusy(false);
    if (ok) { setAction(null); setNote(""); await load(); }
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading purchase invoice…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Purchase invoice not found. <Link href="/purchase/invoice" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const x = data;
  const canApprove = x.status === "Pending Approval";
  const canCancel = x.status !== "Cancelled" && x.paidAmount <= 0.005;

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between print:hidden">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase/invoice" className="hover:text-foreground">Purchase Invoice</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{x.invoiceNo}</span></div>
          <div className="flex flex-wrap items-center gap-2.5"><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ReceiptText className="h-5 w-5 text-primary" /> {x.invoiceNo}</h1><Badge tone={x.invoiceType === "Direct" ? "info" : "primary"}>{x.invoiceType === "Direct" ? "Direct Bill" : "GRN-based"}</Badge><Badge tone={STATUS_TONE[x.status] ?? "neutral"}>{x.status}</Badge><Badge tone={PAY_TONE[x.paymentStatus] ?? "neutral"}>{x.paymentStatus}</Badge></div>
          <p className="mt-1 text-xs text-subtle">{x.invoiceType === "Direct" ? (x.grnRef ? `GRN ref ${x.grnRef}` : "Direct vendor bill") : `Against GRN ${x.grnNos || "—"}`}{x.supplier ? ` · ${x.supplier}` : ""} — {x.itemCount} item(s).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/purchase/invoice"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button variant="outline" size="md" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          {x.status === "Posted" && x.balanceAmount > 0.005 && <Link href="/purchase/payments/new"><Button variant="outline" size="md"><Banknote className="h-4 w-4" /> Pay Supplier</Button></Link>}
          {canApprove && action === null && <Button size="md" onClick={() => { setAction("approve"); setNote(""); }}><CheckCircle2 className="h-4 w-4" /> Approve</Button>}
          {canCancel && action === null && <Button variant="danger" size="md" onClick={() => { setAction("cancel"); setNote(""); }}><XCircle className="h-4 w-4" /> Cancel</Button>}
        </div>
      </div>

      {action !== null && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm print:hidden">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">{action === "approve" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}{action === "approve" ? "Approve & post this invoice" : "Cancel this invoice"}</div>
          <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle"><MessageSquare className="h-3 w-3" /> Note (optional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => { setAction(null); setNote(""); }} disabled={busy}>Dismiss</Button>
            {action === "approve"
              ? <Button size="md" onClick={submit} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Posting…" : "Confirm Approve"}</Button>
              : <Button variant="danger" size="md" onClick={submit} disabled={busy}><XCircle className="h-4 w-4" /> {busy ? "Cancelling…" : "Confirm Cancel"}</Button>}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Supplier Bill" icon={FileText}>
          <KV k="Supplier Invoice" v={x.supplierInvoiceNo} />
          <KV k="Invoice Date" v={x.supplierInvoiceDate} />
          <KV k="Bill No" v={x.supplierBillNo} />
          <KV k="Bill Date" v={x.supplierBillDate} />
          <KV k="Supplier Ref" v={x.supplierRef} />
        </Card>
        <Card title="Terms" icon={CalendarClock}>
          <KV k="Due Date" v={x.dueDate} />
          <KV k="Payment Terms" v={x.paymentTerms} />
          <KV k="Credit Days" v={x.creditDays != null ? String(x.creditDays) : ""} />
          <KV k="Currency" v={x.currency} />
          <KV k="Type" v={x.purchaseType} />
        </Card>
        <Card title="Supplier" icon={Truck}>
          <KV k="Supplier" v={x.supplier} />
          <KV k="GSTIN" v={x.supplierGstin} />
          <KV k="PO No" v={x.poNo} />
          <KV k="Warehouse" v={x.warehouse} />
          <KV k="GRN(s)" v={x.invoiceType === "Direct" ? x.grnRef : x.grnNos} />
        </Card>
        <Card title="Amounts" icon={Wallet}>
          <KV k="GRN Amount" v={money(x.grnAmount)} />
          {x.freight + x.loading + x.packing + x.insurance + x.otherCharges > 0 && <KV k="Charges" v={money(x.freight + x.loading + x.packing + x.insurance + x.otherCharges)} />}
          {x.additionalDiscount > 0 && <KV k="Discount" v={`− ${money(x.additionalDiscount)}`} />}
          <KV k="GST" v={money(x.gstAmount)} />
          <div className="my-1 h-px bg-border" />
          <KV k="Net Payable" v={money(x.netPayable)} strong />
          <KV k="Balance" v={money(x.balanceAmount)} />
        </Card>
      </div>

      {/* Items */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-semibold text-foreground"><Boxes className="h-4 w-4 text-primary" /> Invoiced Items</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Product</th><th className="px-4 py-3">Batch / Exp</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Unit Price</th><th className="px-4 py-3 text-right">Disc</th><th className="px-4 py-3 text-right">Tax</th><th className="px-4 py-3 text-right">Value</th></tr></thead>
            <tbody>
              {x.items.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div></td>
                  <td className="px-4 py-3 text-2xs text-muted">{l.batchNo || "—"}{l.expiryDate ? <div className="text-[10px] text-subtle">Exp {l.expiryDate}</div> : null}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmt.qty(l.qty)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{money(l.unitPrice)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{l.discAmount ? money(l.discAmount) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{l.taxAmount ? money(l.taxAmount) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{money(l.lineValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accounting entries */}
      {x.vouchers.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-semibold text-foreground"><Landmark className="h-4 w-4 text-primary" /> Accounting Entries</div>
          <div className="divide-y divide-border">
            {x.vouchers.map((v) => (
              <div key={v.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs"><span className="font-mono font-semibold text-primary">{v.voucherNo}</span><Badge tone="neutral">{v.voucherType}</Badge><span className="text-subtle">{v.date}</span><span className="text-muted">{v.narration}</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-2xs uppercase tracking-wide text-subtle"><th className="py-1 pr-3">Account</th><th className="py-1 pr-3 text-right">Debit</th><th className="py-1 text-right">Credit</th></tr></thead>
                    <tbody>
                      {v.lines.map((l, i) => (
                        <tr key={i} className="border-t border-border/60"><td className="py-1.5 pr-3 text-foreground">{l.account}</td><td className="py-1.5 pr-3 text-right tabular-nums text-muted">{l.debit ? money(l.debit) : ""}</td><td className="py-1.5 text-right tabular-nums text-muted">{l.credit ? money(l.credit) : ""}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments + remarks */}
      <div className="grid gap-4 sm:grid-cols-2 print:hidden">
        {x.attachments.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><Paperclip className="h-3.5 w-3.5" /> Attachments</p>
            <div className="space-y-1.5">
              {x.attachments.map((a) => (
                <a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs"><span className="truncate font-medium text-primary hover:underline">{a.fileName}</span><span className="shrink-0 text-2xs text-subtle">{a.docType}</span></a>
              ))}
            </div>
          </div>
        )}
        {(x.remarks || x.internalNotes || x.approvalNote) && (
          <div className="space-y-3">
            {x.remarks && <NoteCard title="Remarks" body={x.remarks} />}
            {x.internalNotes && <NoteCard title="Internal Notes" body={x.internalNotes} />}
            {x.approvalNote && <NoteCard title="Approval Note" body={x.approvalNote} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Wallet; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><Icon className="h-3.5 w-3.5" /> {title}</p><div className="space-y-1 text-xs">{children}</div></div>;
}
function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  if (!v) return null;
  return <div className="flex items-center justify-between gap-2"><span className="text-muted">{k}</span><span className={cn("text-right", strong ? "font-bold text-foreground" : "font-medium text-foreground")}>{v}</span></div>;
}
function NoteCard({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">{title}</p><p className="whitespace-pre-line text-xs text-muted">{body}</p></div>;
}
