"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, RotateCcw, CalendarClock, User, Wallet, FileText,
  CheckCircle2, XCircle, MessageSquare, ScrollText, BookOpen, Receipt, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
// Shared API contract — one source of truth for the response shapes.
import type { SalesReturnDetail as SalesReturn } from "@/lib/contracts/salesReturn";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const STATUS_TONE: Record<string, Tone> = {
  Completed: "success",
  Pending: "warning",
  Rejected: "danger",
  Draft: "neutral",
  Approved: "info",
};

const HANDLING_TONE: Record<string, Tone> = {
  Restock: "success",
  Damage: "danger",
  Damaged: "danger",
  Scrap: "danger",
  Quarantine: "warning",
};

export function SalesReturnView({ id }: { id: string }) {
  const fmt = useFmt();
  const money = (n: number) => fmt.money(n);
  const toast = useToast();
  const [data, setData] = useState<SalesReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [showVoucher, setShowVoucher] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch(`/api/sales/returns/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => ({}));
    if (j.ok) setData(j.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!action) return;
    setBusy(true);
    const j = await fetch(`/api/sales/returns/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note.trim() || undefined }),
    }).then((r) => r.json()).catch(() => ({}));
    const ok = toast.result(
      j,
      action === "approve" ? "Return approved." : "Return rejected.",
      action === "approve" ? "Could not approve return." : "Could not reject return.",
    );
    setBusy(false);
    if (ok) {
      setAction(null);
      setNote("");
      await load();
    }
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading return…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Sales return not found. <Link href="/sales/return" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const r = data;
  const isPending = r.status === "Pending";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales/return" className="hover:text-foreground">Sales Return</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{r.returnNo}</span></div>
          <div className="flex items-center gap-2.5"><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><RotateCcw className="h-5 w-5 text-primary" /> Sales Return {r.returnNo}</h1><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></div>
          <p className="mt-1 text-xs text-subtle">Against Invoice {r.invoiceNo || "—"}{r.customerName ? ` · ${r.customerName}` : ""} — {r.itemCount} item(s).</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/return"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {isPending && action === null && (
            <>
              <Button size="md" onClick={() => { setAction("approve"); setNote(""); }}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
              <Button variant="danger" size="md" onClick={() => { setAction("reject"); setNote(""); }}><XCircle className="h-4 w-4" /> Reject</Button>
            </>
          )}
        </div>
      </div>

      {/* Inline approve / reject note */}
      {isPending && action !== null && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            {action === "approve" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}
            {action === "approve" ? "Approve this return" : "Reject this return"}
          </div>
          <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle"><MessageSquare className="h-3 w-3" /> Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={action === "approve" ? "Reason for approval…" : "Reason for rejection…"}
            className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus"
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => { setAction(null); setNote(""); }} disabled={busy}>Cancel</Button>
            {action === "approve"
              ? <Button size="md" onClick={submit} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Approving…" : "Confirm Approve"}</Button>
              : <Button variant="danger" size="md" onClick={submit} disabled={busy}><XCircle className="h-4 w-4" /> {busy ? "Rejecting…" : "Confirm Reject"}</Button>}
          </div>
        </div>
      )}

      {/* Info cards */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Original Invoice" icon={FileText}>
          <KV k="Invoice No" v={r.invoiceNo} />
          <KV k="Return No" v={r.returnNo} />
          <KV k="Created" v={r.createdAt} />
        </Card>
        <Card title="Return Date" icon={CalendarClock}>
          <KV k="Return Date" v={r.returnDate} />
          <KV k="Status" v={r.status} tone={STATUS_TONE[r.status]} />
          <KV k="Items" v={String(r.itemCount)} />
        </Card>
        <Card title="Customer" icon={User}>
          <KV k="Name" v={r.customerName} />
          <KV k="Phone" v={r.customerPhone} />
        </Card>
        <Card title="Refund Summary" icon={Wallet}>
          <KV k="Gross" v={money(r.grossAmount)} />
          {!!r.discountAdj && <KV k="Discount Adj" v={money(r.discountAdj)} />}
          {!!r.taxAdj && <KV k="Tax Adj" v={money(r.taxAdj)} />}
          <div className="my-1 h-px bg-border" />
          <KV k="Refund Amount" v={money(r.refundAmount)} strong />
          <KV k="Refund Mode" v={r.refundMode} />
          {r.refundRef && <KV k="Refund Ref" v={r.refundRef} />}
        </Card>
      </div>

      {/* Lines table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Returned Items</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Sold Qty</th>
                <th className="px-4 py-3 text-right">Return Qty</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Tax</th>
                <th className="px-4 py-3 text-right">Return Value</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Inventory</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {r.lines.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{l.productName}</div>
                    <div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div>
                    {(l.batchNo || l.expiryDate) && <div className="mt-0.5 text-2xs text-subtle">{l.batchNo ? `Batch ${l.batchNo}` : ""}{l.batchNo && l.expiryDate ? " · " : ""}{l.expiryDate ? `exp ${l.expiryDate}` : ""}</div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{fmt.qty(l.soldQty)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{fmt.qty(l.returnQty)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{money(l.rate)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{l.taxAmount ? money(l.taxAmount) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{money(l.returnValue)}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{l.reason || "—"}</td>
                  <td className="px-4 py-3">{l.inventoryHandling ? <Badge tone={HANDLING_TONE[l.inventoryHandling] ?? "neutral"}>{l.inventoryHandling}</Badge> : <span className="text-subtle">—</span>}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{l.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Note / Store Credit issued for the refund */}
      {r.creditNote && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-foreground"><Receipt className="h-4 w-4 text-primary" /> {r.creditNote.type === "CreditNote" ? "Credit Note" : "Store Credit"} Details</div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <KV2 k="Credit No" v={r.creditNote.creditNo} mono />
            <KV2 k="Type" v={r.creditNote.type === "CreditNote" ? "Credit Note" : "Store Credit"} />
            <KV2 k="Issued Value" v={money(r.creditNote.amount)} />
            <KV2 k="Balance" v={money(r.creditNote.balance)} />
            <KV2 k="Status" v={<Badge tone={r.creditNote.status === "Active" ? "success" : "neutral"}>{r.creditNote.status}</Badge>} />
            <KV2 k="Issued On" v={new Date(r.creditNote.createdAt).toLocaleString()} />
          </div>
        </div>
      )}

      {/* Inventory restore log */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <button onClick={() => setShowLedger((s) => !s)} className="flex w-full items-center justify-between gap-2 border-b border-border px-4 py-3 text-left">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><ScrollText className="h-4 w-4 text-primary" /> Inventory Movement <span className="text-2xs font-normal text-muted">({r.ledger.length})</span></span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">{showLedger ? "Hide" : "View"}<ChevronDown className={cn("h-3.5 w-3.5 transition", showLedger && "rotate-180")} /></span>
        </button>
        {showLedger && (
          <div className="overflow-x-auto">
            {r.ledger.length ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Warehouse</th><th className="px-4 py-2.5">Batch</th><th className="px-4 py-2.5 text-right">Qty</th><th className="px-4 py-2.5 text-right">Balance</th></tr></thead>
                <tbody>
                  {r.ledger.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-muted">{m.txnDate}</td>
                      <td className="px-4 py-2.5"><div className="font-medium text-foreground">{m.productName}</div><div className="font-mono text-2xs text-subtle">{m.sku || "—"}</div></td>
                      <td className="px-4 py-2.5"><Badge tone="info">{m.txnType.replace(/_/g, " ")} {m.direction}</Badge></td>
                      <td className="px-4 py-2.5 text-muted">{m.warehouse || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-2xs text-muted">{m.batchNo || "—"}</td>
                      <td className={cn("px-4 py-2.5 text-right font-medium tabular-nums", m.direction === "IN" ? "text-success" : "text-danger")}>{m.direction === "IN" ? "+" : "-"}{fmt.qty(m.qty)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{fmt.qty(m.balanceQty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="px-4 py-4 text-sm text-muted">No inventory movement yet (return not approved, or value-only).</p>}
          </div>
        )}
      </div>

      {/* Accounting posting voucher */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <button onClick={() => setShowVoucher((s) => !s)} className="flex w-full items-center justify-between gap-2 border-b border-border px-4 py-3 text-left">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><BookOpen className="h-4 w-4 text-primary" /> Accounting Entry <span className="text-2xs font-normal text-muted">{r.voucher ? r.voucher.voucherNo : "(not posted)"}</span></span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">{showVoucher ? "Hide" : "View"}<ChevronDown className={cn("h-3.5 w-3.5 transition", showVoucher && "rotate-180")} /></span>
        </button>
        {showVoucher && (
          <div className="p-4">
            {r.voucher ? (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted"><span className="font-mono font-semibold text-foreground">{r.voucher.voucherNo}</span><span>·</span><span>{r.voucher.date}</span><span>·</span><span>{r.voucher.narration}</span></div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Account</th><th className="px-3 py-2">Narration</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th></tr></thead>
                    <tbody>
                      {r.voucher.lines.map((jl, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-2"><span className="font-mono text-2xs text-subtle">{jl.code}</span> <span className="text-foreground">{jl.name}</span></td>
                          <td className="px-3 py-2 text-2xs text-muted">{jl.narration || "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">{jl.debit ? money(jl.debit) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">{jl.credit ? money(jl.credit) : "—"}</td>
                        </tr>
                      ))}
                      <tr className="bg-surface-2 font-semibold"><td className="px-3 py-2" colSpan={2}>Total</td><td className="px-3 py-2 text-right tabular-nums">{money(r.voucher.totalDebit)}</td><td className="px-3 py-2 text-right tabular-nums">{money(r.voucher.totalCredit)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : <p className="text-sm text-muted">No accounting voucher posted yet (return is pending approval).</p>}
          </div>
        )}
      </div>

      {/* Notes / refund remarks / approval note */}
      {(r.notes || r.refundRemarks || r.approvalNote) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {r.notes && <NoteCard title="Notes" body={r.notes} />}
          {r.refundRemarks && <NoteCard title="Refund Remarks" body={r.refundRemarks} />}
          {r.approvalNote && <NoteCard title="Approval Note" body={r.approvalNote} />}
        </div>
      )}
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Wallet; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><Icon className="h-3.5 w-3.5" /> {title}</p>
      <div className="space-y-1 text-xs">{children}</div>
    </div>
  );
}

function KV({ k, v, tone, strong }: { k: string; v: string; tone?: Tone; strong?: boolean }) {
  if (!v) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{k}</span>
      {tone ? <Badge tone={tone}>{v}</Badge> : <span className={cn("text-right", strong ? "font-bold text-foreground" : "font-medium text-foreground")}>{v}</span>}
    </div>
  );
}

function KV2({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{k}</div><div className={cn("mt-0.5 text-sm text-foreground", mono && "font-mono")}>{v}</div></div>
  );
}

function NoteCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">{title}</p>
      <p className="whitespace-pre-line text-xs text-muted">{body}</p>
    </div>
  );
}
