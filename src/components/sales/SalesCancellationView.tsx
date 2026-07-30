"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { XCircle, ArrowLeft, Loader2, CheckCircle2, Ban, ReceiptText, ScrollText, BookOpen, CreditCard, Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { SalesCancellationDetail } from "@/lib/contracts/salesCancellation";

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { Approved: "success", "Pending Approval": "warning", Rejected: "danger", Cancelled: "danger", Draft: "neutral" };

export function SalesCancellationView({ id }: { id: number }) {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const [data, setData] = useState<SalesCancellationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showVoucher, setShowVoucher] = useState(false);

  async function load() {
    setLoading(true);
    const j = await fetch(`/api/sales/cancellations/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j); setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function act(kind: "approve" | "reject") {
    setBusy(true); setError(null);
    const j = await fetch(`/api/sales/cancellations/${id}/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()).catch(() => ({}));
    if (!j.ok) { setError(j.message || "Action failed."); setBusy(false); return; }
    await load(); setBusy(false);
  }

  if (loading) return <div className="py-20"><AppLoader label="Loading cancellation…" /></div>;
  if (!data) return <div className="py-20 text-center text-sm text-muted">Sales cancellation not found.</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales/cancellation" className="hover:text-foreground">Sales Cancellation</Link><span className="text-subtle">/</span><span className="font-mono font-medium text-foreground">{data.cancellationNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><XCircle className="h-5 w-5 text-primary" /> {data.cancellationNo}<Badge tone={TONE[data.status] ?? "neutral"}>{data.status}</Badge></h1>
        </div>
        <div className="flex items-center gap-2">
          {data.status === "Pending Approval" && <>
            <Button size="md" onClick={() => act("approve")} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve &amp; Post</Button>
            <Button size="md" variant="outline" onClick={() => act("reject")} disabled={busy}><Ban className="h-4 w-4" /> Reject</Button>
          </>}
          <Link href="/sales/cancellation"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        </div>
      </div>

      {error && <div className="flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger-subtle/50 px-3 py-2 text-2xs font-medium text-danger"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</div>}

      <SectionCard icon={ReceiptText} title="Cancellation Details">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info2 label="Date" value={data.cancellationDate} />
          <Info2 label="Invoice No" value={<span className="font-mono">{data.invoiceNo || "—"}</span>} />
          <Info2 label="Channel" value={data.channel || "—"} />
          <Info2 label="Customer" value={data.customerName || "—"} />
          <Info2 label="Invoice Amount" value={inr(data.invoiceAmount)} />
          <Info2 label="Refund Amount" value={<span className="font-semibold">{inr(data.refundAmount)}</span>} />
          <Info2 label="Refund Method" value={data.refundMethod || "—"} />
          <Info2 label="Reversal Voucher" value={data.journalRef || "—"} />
          <Info2 label="Reason" value={data.reason || "—"} />
          <div className="sm:col-span-2 lg:col-span-3"><Info2 label="Remarks" value={data.remarks || "—"} /></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <PostTag on={data.inventoryReversed} label="Inventory Restored" />
          <PostTag on={data.paymentReversed} label="Payment Reversed" />
          <PostTag on={data.accountingReversed} label="Accounting Reversed" />
          <PostTag on={data.customerLedgerReversed} label="Customer Ledger" />
          <PostTag on={data.loyaltyReversed} label="Loyalty Reversed" />
        </div>
        {data.approvedAt && <p className="mt-2 text-2xs text-subtle">{data.status} {new Date(data.approvedAt).toLocaleString()}{data.approvalNote ? ` — ${data.approvalNote}` : ""}</p>}
      </SectionCard>

      <SectionCard icon={XCircle} title="Cancelled Items">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Product</th><th className="px-3 py-2">Batch / Exp</th><th className="px-3 py-2">Serials</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Value</th></tr></thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div></td>
                  <td className="px-3 py-2 text-2xs text-muted">{l.batchNo || "—"}{l.expiryDate ? <div className="text-[10px] text-subtle">Exp {l.expiryDate}</div> : null}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted">{l.serials.length ? l.serials.join(", ") : "—"}</td>
                  <td className="px-3 py-2 text-right text-foreground">{fmt.qty(l.qty)}</td>
                  <td className="px-3 py-2 text-right text-muted">{inr(l.rate)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{inr(l.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Payment reversal */}
      <SectionCard icon={CreditCard} title="Payment Reversal">
        {data.payments.length ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Mode</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-center">Refund</th></tr></thead>
              <tbody>
                {data.payments.map((p, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{p.mode}</td>
                    <td className="px-3 py-2 text-2xs text-muted">{p.reference || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">{inr(p.amount)}</td>
                    <td className="px-3 py-2 text-center"><Badge tone={p.refundStatus === "Completed" ? "success" : "warning"}>{p.refundStatus}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted">No recorded payments (credit sale) — customer outstanding reversed.</p>}
      </SectionCard>

      {/* Inventory restoration log */}
      <SectionCard icon={ScrollText} title="Inventory Movement" action={<button onClick={() => setShowLedger((s) => !s)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{showLedger ? "Hide" : "View"}<ChevronDown className={cn("h-3.5 w-3.5 transition", showLedger && "rotate-180")} /></button>}>
        {!showLedger ? <p className="text-2xs text-muted">{data.ledger.length} restoration movement{data.ledger.length === 1 ? "" : "s"}. Click View to expand.</p> : (
          data.ledger.length ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Warehouse</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
                <tbody>
                  {data.ledger.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-muted">{m.txnDate}</td>
                      <td className="px-3 py-2"><div className="font-medium text-foreground">{m.productName}</div><div className="font-mono text-2xs text-subtle">{m.sku || "—"}</div></td>
                      <td className="px-3 py-2"><Badge tone="info">{m.txnType.replace(/_/g, " ")} {m.direction}</Badge></td>
                      <td className="px-3 py-2 text-muted">{m.warehouse || "—"}</td>
                      <td className="px-3 py-2 font-mono text-2xs text-muted">{m.batchNo || "—"}</td>
                      <td className="px-3 py-2 text-right font-medium text-success">+{fmt.qty(m.qty)}</td>
                      <td className="px-3 py-2 text-right text-foreground">{fmt.qty(m.balanceQty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">No inventory movements.</p>
        )}
      </SectionCard>

      {/* Accounting reversal voucher */}
      <SectionCard icon={BookOpen} title="Accounting Entry" action={<button onClick={() => setShowVoucher((s) => !s)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{showVoucher ? "Hide" : "View"}<ChevronDown className={cn("h-3.5 w-3.5 transition", showVoucher && "rotate-180")} /></button>}>
        {!showVoucher ? <p className="text-2xs text-muted">{data.voucher ? `Reversal voucher ${data.voucher.voucherNo}` : "Not posted"}. Click View to expand.</p> : (
          data.voucher ? (
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted"><span className="font-mono font-semibold text-foreground">{data.voucher.voucherNo}</span><span>·</span><span>{data.voucher.date}</span><span>·</span><span>{data.voucher.narration}</span></div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Account</th><th className="px-3 py-2">Narration</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th></tr></thead>
                  <tbody>
                    {data.voucher.lines.map((jl, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2"><span className="font-mono text-2xs text-subtle">{jl.code}</span> <span className="text-foreground">{jl.name}</span></td>
                        <td className="px-3 py-2 text-2xs text-muted">{jl.narration || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">{jl.debit ? inr(jl.debit) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">{jl.credit ? inr(jl.credit) : "—"}</td>
                      </tr>
                    ))}
                    <tr className="bg-surface-2 font-semibold"><td className="px-3 py-2" colSpan={2}>Total</td><td className="px-3 py-2 text-right tabular-nums">{inr(data.voucher.totalDebit)}</td><td className="px-3 py-2 text-right tabular-nums">{inr(data.voucher.totalCredit)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : <p className="text-sm text-muted">No accounting voucher (cancellation not approved yet).</p>
        )}
      </SectionCard>
    </div>
  );
}

function Info2({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</div><div className="mt-0.5 text-sm text-foreground">{value}</div></div>;
}
function PostTag({ on, label }: { on: boolean; label: string }) {
  return <Badge tone={on ? "success" : "neutral"}>{label}: {on ? "Yes" : "No"}</Badge>;
}
