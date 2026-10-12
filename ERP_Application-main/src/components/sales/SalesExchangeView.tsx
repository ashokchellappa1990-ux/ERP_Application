"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Repeat, CalendarClock, User, Wallet, FileText, CheckCircle2, XCircle, MessageSquare, Boxes, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { SalesExchangeDetail as Exchange } from "@/lib/contracts/salesExchange";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const STATUS_TONE: Record<string, Tone> = { Completed: "success", Pending: "warning", Rejected: "danger", Draft: "neutral", Approved: "info" };

export function SalesExchangeView({ id }: { id: string }) {
  const fmt = useFmt();
  const money = (n: number) => fmt.money(n);
  const toast = useToast();
  const [data, setData] = useState<Exchange | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch(`/api/sales/exchanges/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j.data);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!action) return;
    setBusy(true);
    const j = await fetch(`/api/sales/exchanges/${id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: note.trim() || undefined }) }).then((r) => r.json()).catch(() => ({}));
    const ok = toast.result(j, action === "approve" ? "Exchange approved." : "Exchange rejected.", action === "approve" ? "Could not approve exchange." : "Could not reject exchange.");
    setBusy(false);
    if (ok) { setAction(null); setNote(""); await load(); }
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading exchange…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Sales exchange not found. <Link href="/sales/exchange" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const x = data;
  const isPending = x.status === "Pending";
  const retItems = x.items.filter((i) => i.side === "RETURN");
  const newItems = x.items.filter((i) => i.side === "NEW");
  const diffTone = x.settlementType === "collect" ? "text-success" : x.settlementType === "refund" ? "text-danger" : "text-foreground";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales/exchange" className="hover:text-foreground">Sales Exchange</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{x.exchangeNo}</span></div>
          <div className="flex items-center gap-2.5"><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Repeat className="h-5 w-5 text-primary" /> Exchange {x.exchangeNo}</h1><Badge tone={STATUS_TONE[x.status] ?? "neutral"}>{x.status}</Badge></div>
          <p className="mt-1 text-xs text-subtle">Against Invoice {x.invoiceNo || "—"}{x.customerName ? ` · ${x.customerName}` : ""} — {x.itemCount} item(s).</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/exchange"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {isPending && action === null && (
            <>
              <Button size="md" onClick={() => { setAction("approve"); setNote(""); }}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
              <Button variant="danger" size="md" onClick={() => { setAction("reject"); setNote(""); }}><XCircle className="h-4 w-4" /> Reject</Button>
            </>
          )}
        </div>
      </div>

      {isPending && action !== null && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">{action === "approve" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}{action === "approve" ? "Approve this exchange" : "Reject this exchange"}</div>
          <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle"><MessageSquare className="h-3 w-3" /> Note (optional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={action === "approve" ? "Reason for approval…" : "Reason for rejection…"} className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => { setAction(null); setNote(""); }} disabled={busy}>Cancel</Button>
            {action === "approve"
              ? <Button size="md" onClick={submit} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Approving…" : "Confirm Approve"}</Button>
              : <Button variant="danger" size="md" onClick={submit} disabled={busy}><XCircle className="h-4 w-4" /> {busy ? "Rejecting…" : "Confirm Reject"}</Button>}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Original Invoice" icon={FileText}>
          <KV k="Invoice No" v={x.invoiceNo} />
          <KV k="Exchange No" v={x.exchangeNo} />
          <KV k="Created" v={x.createdAt} />
        </Card>
        <Card title="Exchange Date" icon={CalendarClock}>
          <KV k="Date" v={x.exchangeDate} />
          <KV k="Status" v={x.status} tone={STATUS_TONE[x.status]} />
          <KV k="Channel" v={x.channel} />
        </Card>
        <Card title="Customer" icon={User}>
          <KV k="Name" v={x.customerName} />
          <KV k="Phone" v={x.customerPhone} />
        </Card>
        <Card title="Settlement" icon={Wallet}>
          <KV k="Returned" v={money(x.returnValue)} />
          <KV k="New Item" v={money(x.newSaleValue)} />
          <div className="my-1 h-px bg-border" />
          <div className="flex items-center justify-between gap-2"><span className="text-muted">{x.settlementType === "collect" ? "Collect" : x.settlementType === "refund" ? "Refund" : "Even"}</span><span className={cn("font-bold", diffTone)}>{money(Math.abs(x.priceDifference))}</span></div>
          <KV k="Mode" v={x.settlementMode} />
          {x.settlementRef && <KV k="Reference" v={x.settlementRef} />}
        </Card>
      </div>

      <ItemsTable title="Returned Items" icon={Boxes} items={retItems} money={money} qty={fmt.qty} showHandling />
      <ItemsTable title="Issued Items" icon={PackagePlus} items={newItems} money={money} qty={fmt.qty} />

      {(x.reason || x.remarks || x.approvalNote) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {x.reason && <NoteCard title="Exchange Reason" body={x.reason} />}
          {x.remarks && <NoteCard title="Remarks" body={x.remarks} />}
          {x.approvalNote && <NoteCard title="Approval Note" body={x.approvalNote} />}
        </div>
      )}
    </div>
  );
}

function ItemsTable({ title, icon: Icon, items, money, qty, showHandling }: { title: string; icon: typeof Boxes; items: Exchange["items"]; money: (n: number) => string; qty: (n: number) => string; showHandling?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" /> {title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
            <th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Tax</th><th className="px-4 py-3 text-right">Value</th>
            {showHandling && <th className="px-4 py-3">Reason / Handling</th>}
          </tr></thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0 align-top">
                <td className="px-4 py-3"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}{l.batchNo ? ` · ${l.batchNo}` : ""}</div></td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">{qty(l.qty)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">{money(l.rate)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">{l.taxAmount ? money(l.taxAmount) : "—"}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{money(l.value)}</td>
                {showHandling && <td className="px-4 py-3 text-2xs text-muted">{l.reason || "—"}{l.inventoryHandling ? <Badge tone="neutral" className="ml-1">{l.inventoryHandling}</Badge> : null}</td>}
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={showHandling ? 6 : 5} className="px-4 py-8 text-center text-sm text-muted">No items.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Wallet; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><Icon className="h-3.5 w-3.5" /> {title}</p><div className="space-y-1 text-xs">{children}</div></div>;
}
function KV({ k, v, tone, strong }: { k: string; v: string; tone?: Tone; strong?: boolean }) {
  if (!v) return null;
  return <div className="flex items-center justify-between gap-2"><span className="text-muted">{k}</span>{tone ? <Badge tone={tone}>{v}</Badge> : <span className={cn("text-right", strong ? "font-bold text-foreground" : "font-medium text-foreground")}>{v}</span>}</div>;
}
function NoteCard({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">{title}</p><p className="whitespace-pre-line text-xs text-muted">{body}</p></div>;
}
