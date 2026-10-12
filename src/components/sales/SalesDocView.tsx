"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, ClipboardList, CalendarClock, Truck, Wallet, User, CheckCircle2, XCircle, MessageSquare, Boxes, Paperclip, Printer, Send, Lock, Pencil, Trash2, RotateCcw, Clock, ArrowRightLeft, Receipt, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { DOC_LABEL, nextMap, type SalesDocDetail, type SalesDocType } from "@/lib/contracts/salesDoc";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const STATUS_TONE: Record<string, Tone> = {
  Draft: "neutral", Sent: "info", Accepted: "success", Rejected: "danger", Expired: "warning", Converted: "primary",
  Confirmed: "info", Delivered: "success", "Partially Delivered": "warning", Invoiced: "primary", Closed: "neutral", Cancelled: "danger",
};
const ACTION_META: Record<string, { label: string; icon: LucideIcon; variant?: "danger" | "outline" | "primary" }> = {
  send: { label: "Send", icon: Send }, accept: { label: "Accept", icon: CheckCircle2 }, reject: { label: "Reject", icon: XCircle, variant: "danger" },
  expire: { label: "Mark Expired", icon: Clock, variant: "outline" }, confirm: { label: "Confirm", icon: CheckCircle2 },
  deliver: { label: "Mark Delivered", icon: Truck }, invoice: { label: "Mark Invoiced", icon: FileText },
  close: { label: "Close", icon: Lock, variant: "outline" }, cancel: { label: "Cancel", icon: XCircle, variant: "danger" },
  reopen: { label: "Re-open", icon: RotateCcw, variant: "outline" },
};

export function SalesDocView({ docType, id }: { docType: SalesDocType; id: number }) {
  const L = DOC_LABEL[docType];
  const base = `/sales/${docType}`;
  const router = useRouter();
  const fmt = useFmt();
  const money = (x: number) => fmt.money(x);
  const toast = useToast();
  const [data, setData] = useState<SalesDocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const Icon = docType === "order" ? ClipboardList : FileText;

  const load = useCallback(async () => {
    const j = await fetch(`/api/sales/${docType}/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j.data);
    setLoading(false);
  }, [id, docType]);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!action) return;
    setBusy(true);
    const j = await fetch(`/api/sales/${docType}/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: note.trim() || undefined }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j?.ok) { toast.success(j.message); setAction(null); setNote(""); await load(); } else toast.error(j?.message || "Action failed.");
  }
  async function del() {
    if (!confirm(`Delete this draft ${L.short.toLowerCase()}?`)) return;
    setBusy(true);
    const j = await fetch(`/api/sales/${docType}/${id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j?.ok) { toast.success(j.message); router.push(base); } else toast.error(j?.message || "Delete failed.");
  }
  async function convert() {
    if (!confirm("Convert this quotation into a Sales Order?")) return;
    setBusy(true);
    const j = await fetch(`/api/sales/quotation/${id}/convert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j?.ok) { toast.success(j.message); router.push(`/sales/order/${j.id}`); } else toast.error(j?.message || "Convert failed.");
  }

  if (loading) return <div className="py-16"><AppLoader label={`Loading ${L.short.toLowerCase()}…`} /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">{L.short} not found. <Link href={base} className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const x = data;
  const charges = x.freight + x.loading + x.packing + x.insurance + x.otherCharges;
  const map = nextMap(docType);
  const available = Object.keys(map).filter((a) => map[a][x.status]);
  const canConvert = docType === "quotation" && ["Draft", "Sent", "Accepted"].includes(x.status) && !x.convertedToId;
  const canInvoice = docType === "order" && ["Confirmed", "Delivered", "Invoiced"].includes(x.status);

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between print:hidden">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href={base} className="hover:text-foreground">{L.title}</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{x.docNo}</span></div>
          <div className="flex flex-wrap items-center gap-2.5"><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> {x.docNo}</h1><Badge tone={STATUS_TONE[x.status] ?? "neutral"}>{x.status}</Badge></div>
          <p className="mt-1 text-xs text-subtle">{x.customerName || "—"}{x.customerGstin ? ` · ${x.customerGstin}` : ""} — {x.itemCount} item(s).{x.sourceDocNo ? ` From ${x.sourceDocNo}.` : ""}{x.convertedToNo ? ` Converted → ${x.convertedToNo}.` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={base}><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button variant="outline" size="md" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          {x.status === "Draft" && action === null && <Link href={`${base}/${id}/edit`}><Button variant="outline" size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>}
          {action === null && available.map((a) => { const m = ACTION_META[a]; const Ico = m.icon; return <Button key={a} variant={m.variant ?? "primary"} size="md" onClick={() => { setAction(a); setNote(""); }}><Ico className="h-4 w-4" /> {m.label}</Button>; })}
          {action === null && canConvert && <Button size="md" onClick={convert} disabled={busy}><ArrowRightLeft className="h-4 w-4" /> Convert to Order</Button>}
          {action === null && canInvoice && <Link href={`/sales/invoice/new?fromOrder=${id}`}><Button variant="outline" size="md"><Receipt className="h-4 w-4" /> Create Invoice</Button></Link>}
          {x.status === "Draft" && action === null && <Button variant="danger" size="md" onClick={del} disabled={busy}><Trash2 className="h-4 w-4" /> Delete</Button>}
        </div>
      </div>

      {action !== null && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm print:hidden">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">{ACTION_META[action]?.variant === "danger" ? <XCircle className="h-4 w-4 text-danger" /> : <CheckCircle2 className="h-4 w-4 text-success" />}{ACTION_META[action]?.label} this {L.short.toLowerCase()}</div>
          <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle"><MessageSquare className="h-3 w-3" /> Note{action === "cancel" || action === "reject" ? " (reason)" : " (optional)"}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => { setAction(null); setNote(""); }} disabled={busy}>Dismiss</Button>
            <Button variant={ACTION_META[action]?.variant === "danger" ? "danger" : "primary"} size="md" onClick={submit} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Working…" : `Confirm ${ACTION_META[action]?.label}`}</Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Customer" icon={User}>
          <KV k="Customer" v={x.customerName} />
          <KV k="GSTIN" v={x.customerGstin} />
          <KV k="Phone" v={x.customerPhone} />
          <KV k="Contact" v={x.customerContact} />
          <KV k="Customer Ref" v={x.customerRef} />
        </Card>
        <Card title={L.short} icon={FileText}>
          <KV k={`${L.short} Date`} v={x.docDate} />
          <KV k="Salesperson" v={x.salesperson} />
          <KV k="Enquiry No" v={x.enquiryNo} />
          <KV k="Enquiry Date" v={x.enquiryDate} />
          <KV k="From" v={x.sourceDocNo} />
        </Card>
        <Card title="Delivery & Terms" icon={CalendarClock}>
          <KV k={L.keyDate} v={docType === "order" ? x.expectedDeliveryDate : x.validUntil} />
          <KV k="Warehouse" v={x.warehouse} />
          <KV k="Shipping" v={x.shippingMode} />
          <KV k="Payment Terms" v={x.paymentTerms} />
          <KV k="Due Date" v={x.dueDate} />
        </Card>
        <Card title="Amounts" icon={Wallet}>
          <KV k="Taxable" v={money(x.taxableAmount)} />
          {charges > 0 && <KV k="Charges" v={money(charges)} />}
          {x.additionalDiscount > 0 && <KV k="Discount" v={`− ${money(x.additionalDiscount)}`} />}
          <KV k="GST" v={money(x.gstAmount)} />
          <div className="my-1 h-px bg-border" />
          <KV k="Net Value" v={money(x.netAmount)} strong />
        </Card>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-semibold text-foreground"><Boxes className="h-4 w-4 text-primary" /> {L.short} Items</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Product</th><th className="px-4 py-3">HSN</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Disc</th><th className="px-4 py-3 text-right">GST</th><th className="px-4 py-3 text-right">Taxable</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
            <tbody>
              {x.items.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}{l.uom ? ` · ${l.uom}` : ""}</div></td>
                  <td className="px-4 py-3 text-2xs text-muted">{l.hsn || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmt.qty(l.qty)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{money(l.rate)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{l.discPct ? `${l.discPct}%` : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{l.taxPct ? `${l.taxPct}%` : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{money(l.taxableValue)}</td>
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
            <div className="space-y-1.5">{x.attachments.map((a) => <a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs"><span className="truncate font-medium text-primary hover:underline">{a.fileName}</span><Paperclip className="h-3 w-3 shrink-0 text-subtle" /></a>)}</div>
          </div>
        )}
        {(x.remarks || x.internalNotes || x.termsConditions || x.cancelReason) && (
          <div className="space-y-3">
            {x.remarks && <NoteCard title="Remarks" body={x.remarks} />}
            {x.internalNotes && <NoteCard title="Internal Notes" body={x.internalNotes} />}
            {x.termsConditions && <NoteCard title="Terms & Conditions" body={x.termsConditions} />}
            {x.cancelReason && <NoteCard title="Cancellation Reason" body={x.cancelReason} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><Icon className="h-3.5 w-3.5" /> {title}</p><div className="space-y-1 text-xs">{children}</div></div>;
}
function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  if (!v) return null;
  return <div className="flex items-center justify-between gap-2"><span className="text-muted">{k}</span><span className={cn("text-right", strong ? "font-bold text-foreground" : "font-medium text-foreground")}>{v}</span></div>;
}
function NoteCard({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">{title}</p><p className="whitespace-pre-line text-xs text-muted">{body}</p></div>;
}
