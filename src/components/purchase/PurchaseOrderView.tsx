"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag, CalendarClock, Truck, Wallet, FileText, CheckCircle2, XCircle, MessageSquare, Boxes, Paperclip, Printer, Send, Lock, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { PurchaseOrderDetail as PO } from "@/lib/contracts/purchaseOrder";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const STATUS_TONE: Record<string, Tone> = { Draft: "neutral", Approved: "info", Issued: "primary", "Partially Received": "warning", Received: "success", Cancelled: "danger", Closed: "neutral" };

export function PurchaseOrderView({ id }: { id: number }) {
  const router = useRouter();
  const fmt = useFmt();
  const money = (x: number) => fmt.money(x);
  const toast = useToast();
  const [data, setData] = useState<PO | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<null | "approve" | "issue" | "close" | "cancel" | "reopen">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch(`/api/purchase/order/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j.data);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!action) return;
    setBusy(true);
    const j = await fetch(`/api/purchase/order/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: note.trim() || undefined }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j?.ok) { toast.success(j.message); setAction(null); setNote(""); await load(); } else toast.error(j?.message || "Action failed.");
  }
  async function del() {
    if (!confirm("Delete this draft purchase order?")) return;
    setBusy(true);
    const j = await fetch(`/api/purchase/order/${id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j?.ok) { toast.success(j.message); router.push("/purchase/order"); } else toast.error(j?.message || "Delete failed.");
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading purchase order…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Purchase order not found. <Link href="/purchase/order" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const x = data;
  const charges = x.freight + x.loading + x.packing + x.insurance + x.otherCharges;

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between print:hidden">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase/order" className="hover:text-foreground">Purchase Order</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{x.poNo}</span></div>
          <div className="flex flex-wrap items-center gap-2.5"><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ShoppingBag className="h-5 w-5 text-primary" /> {x.poNo}</h1><Badge tone={STATUS_TONE[x.status] ?? "neutral"}>{x.status}</Badge><Badge tone="neutral">{x.purchaseType}</Badge></div>
          <p className="mt-1 text-xs text-subtle">{x.supplier || "—"}{x.expectedDeliveryDate ? ` · expected ${x.expectedDeliveryDate}` : ""} — {x.itemCount} item(s).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/purchase/order"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button variant="outline" size="md" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          {x.status === "Draft" && action === null && <Link href={`/purchase/order/${id}/edit`}><Button variant="outline" size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>}
          {x.status === "Draft" && action === null && <Button size="md" onClick={() => { setAction("approve"); setNote(""); }}><CheckCircle2 className="h-4 w-4" /> Approve</Button>}
          {(x.status === "Draft" || x.status === "Approved") && action === null && <Button size="md" onClick={() => { setAction("issue"); setNote(""); }}><Send className="h-4 w-4" /> Issue</Button>}
          {(x.status === "Issued" || x.status === "Partially Received" || x.status === "Received") && action === null && <Button variant="outline" size="md" onClick={() => { setAction("close"); setNote(""); }}><Lock className="h-4 w-4" /> Close</Button>}
          {["Draft", "Approved", "Issued", "Partially Received"].includes(x.status) && action === null && <Button variant="danger" size="md" onClick={() => { setAction("cancel"); setNote(""); }}><XCircle className="h-4 w-4" /> Cancel</Button>}
          {x.status === "Draft" && action === null && <Button variant="danger" size="md" onClick={del} disabled={busy}><Trash2 className="h-4 w-4" /> Delete</Button>}
        </div>
      </div>

      {action !== null && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm print:hidden">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">{action === "cancel" ? <XCircle className="h-4 w-4 text-danger" /> : <CheckCircle2 className="h-4 w-4 text-success" />}{action === "approve" ? "Approve this order" : action === "issue" ? "Issue this order to the supplier" : action === "close" ? "Close this order" : action === "reopen" ? "Re-open this order" : "Cancel this order"}</div>
          <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle"><MessageSquare className="h-3 w-3" /> Note{action === "cancel" ? " (reason)" : " (optional)"}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => { setAction(null); setNote(""); }} disabled={busy}>Dismiss</Button>
            <Button variant={action === "cancel" ? "danger" : "primary"} size="md" onClick={submit} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Working…" : `Confirm ${action[0].toUpperCase()}${action.slice(1)}`}</Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Supplier" icon={Truck}>
          <KV k="Supplier" v={x.supplier} />
          <KV k="GSTIN" v={x.supplierGstin} />
          <KV k="Contact" v={x.supplierContact} />
          <KV k="Supplier Ref" v={x.supplierRef} />
        </Card>
        <Card title="Order" icon={FileText}>
          <KV k="PO Date" v={x.poDate} />
          <KV k="Type" v={x.purchaseType} />
          <KV k="Buyer" v={x.buyer} />
          <KV k="Quotation No" v={x.quotationNo} />
          <KV k="Quotation Date" v={x.quotationDate} />
        </Card>
        <Card title="Delivery & Terms" icon={CalendarClock}>
          <KV k="Expected" v={x.expectedDeliveryDate} />
          <KV k="Deliver To" v={x.warehouse} />
          <KV k="Shipping" v={x.shippingMode} />
          <KV k="Freight By" v={x.freightPaidBy} />
          <KV k="Payment Terms" v={x.paymentTerms} />
          <KV k="Due Date" v={x.dueDate} />
        </Card>
        <Card title="Amounts" icon={Wallet}>
          <KV k="Taxable" v={money(x.taxableAmount)} />
          {charges > 0 && <KV k="Charges" v={money(charges)} />}
          {x.additionalDiscount > 0 && <KV k="Discount" v={`− ${money(x.additionalDiscount)}`} />}
          <KV k="GST" v={money(x.gstAmount)} />
          <div className="my-1 h-px bg-border" />
          <KV k="Net Order Value" v={money(x.netAmount)} strong />
        </Card>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-semibold text-foreground"><Boxes className="h-4 w-4 text-primary" /> Order Items</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Product</th><th className="px-4 py-3">HSN</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Disc</th><th className="px-4 py-3 text-right">GST</th><th className="px-4 py-3">Expected</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
            <tbody>
              {x.items.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}{l.uom ? ` · ${l.uom}` : ""}</div></td>
                  <td className="px-4 py-3 text-2xs text-muted">{l.hsn || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmt.qty(l.qty)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{money(l.rate)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{l.discPct ? `${l.discPct}%` : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{l.taxPct ? `${l.taxPct}%` : "—"}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{l.expectedDate || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{money(l.lineValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 print:hidden">
        {x.attachments.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><Paperclip className="h-3.5 w-3.5" /> Attachments</p>
            <div className="space-y-1.5">{x.attachments.map((a) => <a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs"><span className="truncate font-medium text-primary hover:underline">{a.fileName}</span><span className="shrink-0 text-2xs text-subtle">{a.docType}</span></a>)}</div>
          </div>
        )}
        {(x.remarks || x.internalNotes || x.termsConditions || x.cancelReason || x.approvalNote) && (
          <div className="space-y-3">
            {x.remarks && <NoteCard title="Remarks" body={x.remarks} />}
            {x.internalNotes && <NoteCard title="Internal Notes" body={x.internalNotes} />}
            {x.termsConditions && <NoteCard title="Terms & Conditions" body={x.termsConditions} />}
            {x.approvalNote && <NoteCard title="Approval Note" body={x.approvalNote} />}
            {x.cancelReason && <NoteCard title="Cancellation Reason" body={x.cancelReason} />}
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
