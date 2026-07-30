"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Undo2, ArrowLeft, Loader2, CheckCircle2, Boxes, Info, ScrollText, BookOpen, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { PurchaseReturnDetail } from "@/lib/contracts/purchaseReturn";

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { Approved: "success", "Pending Approval": "warning", Cancelled: "danger", Draft: "neutral" };
const TYPE_TONE: Record<string, "primary" | "info" | "warning" | "success"> = { Inventory: "primary", Service: "info", Expense: "warning", Asset: "success" };

export function PurchaseReturnView({ id }: { id: number }) {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const [data, setData] = useState<PurchaseReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showVoucher, setShowVoucher] = useState(false);

  async function load() {
    setLoading(true);
    const j = await fetch(`/api/purchase/returns/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j); setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function approve() {
    setApproving(true); setError(null);
    const j = await fetch(`/api/purchase/returns/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()).catch(() => ({}));
    if (!j.ok) { setError(j.message || "Could not approve."); setApproving(false); return; }
    await load(); setApproving(false);
  }

  if (loading) return <div className="py-20"><AppLoader label="Loading return…" /></div>;
  if (!data) return <div className="py-20 text-center text-sm text-muted">Purchase return not found.</div>;
  const isInventory = data.purchaseType === "Inventory";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase/return" className="hover:text-foreground">Purchase Return</Link><span className="text-subtle">/</span><span className="font-mono font-medium text-foreground">{data.returnNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Undo2 className="h-5 w-5 text-primary" /> {data.returnNo}
            <Badge tone={TYPE_TONE[data.purchaseType] ?? "neutral"}>{data.purchaseType}</Badge>
            <Badge tone={TONE[data.status] ?? "neutral"}>{data.status}</Badge>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {data.status === "Pending Approval" && <Button size="md" onClick={approve} disabled={approving}>{approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve &amp; Post</Button>}
          <Link href="/purchase/return"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        </div>
      </div>

      {error && <div className="flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger-subtle/50 px-3 py-2 text-2xs font-medium text-danger"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</div>}

      <SectionCard icon={Boxes} title="Return Details">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info2 label="Return Date" value={data.returnDate} />
          <Info2 label="Invoice No" value={<span className="font-mono">{data.invoiceNo || "—"}</span>} />
          <Info2 label="GRN No" value={data.grnNo || "—"} />
          <Info2 label="Supplier" value={data.supplier || "—"} />
          <Info2 label="Warehouse" value={data.warehouse || "—"} />
          <Info2 label="Reason" value={data.reason || "—"} />
          <Info2 label="Return Value" value={<span className="font-semibold">{inr(data.returnAmount)}</span>} />
          <Info2 label="Journal" value={data.journalRef || "—"} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <PostTag on={data.inventoryUpdated} label="Inventory Updated" muted={!isInventory} />
          <PostTag on={data.supplierOutstandingUpdated} label="Supplier Outstanding" />
          <PostTag on={data.accountingPosted} label="Accounting Posted" />
        </div>
        {data.remarks && <p className="mt-3 text-sm text-muted"><span className="font-semibold text-foreground">Remarks:</span> {data.remarks}</p>}
        {data.approvedAt && <p className="mt-1 text-2xs text-subtle">Approved {new Date(data.approvedAt).toLocaleString()}{data.approvalNote ? ` — ${data.approvalNote}` : ""}</p>}
      </SectionCard>

      <SectionCard icon={Undo2} title="Returned Items">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
              <th className="px-3 py-2">{isInventory ? "Product" : "Description"}</th>
              {isInventory && <th className="px-3 py-2">Batch / Exp</th>}
              {isInventory && <th className="px-3 py-2">Serials</th>}
              <th className="px-3 py-2 text-right">Return Qty</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Tax</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2">Reason</th>
            </tr></thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.id} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div></td>
                  {isInventory && <td className="px-3 py-2 text-2xs text-muted">{l.batchNo || "—"}{l.expiryDate ? <div className="text-[10px] text-subtle">Exp {l.expiryDate}</div> : null}</td>}
                  {isInventory && <td className="px-3 py-2 font-mono text-[10px] text-muted">{l.serials.length ? l.serials.join(", ") : "—"}</td>}
                  <td className="px-3 py-2 text-right text-foreground">{fmt.qty(l.returnQty)}</td>
                  <td className="px-3 py-2 text-right text-muted">{inr(l.rate)}</td>
                  <td className="px-3 py-2 text-right text-muted">{l.taxAmount ? inr(l.taxAmount) : "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{inr(l.returnValue)}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{l.reason || "—"}{l.remarks ? <div className="text-[10px] text-subtle">{l.remarks}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Debit Note — the purchase return IS the debit note (no separate module). */}
      <SectionCard icon={FileText} title="Debit Note">
        <p className="mb-3 text-2xs text-muted">This Purchase Return serves as the Debit Note raised on the supplier — no separate Debit Note document.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info2 label="Debit Note No" value={<span className="font-mono">{data.debitNote.debitNoteNo}</span>} />
          <Info2 label="Date" value={data.debitNote.date} />
          <Info2 label="Against Invoice" value={<span className="font-mono">{data.debitNote.invoiceNo || "—"}</span>} />
          <Info2 label="Supplier GSTIN" value={data.debitNote.supplierGstin || "—"} />
          <Info2 label="Taxable Amount" value={inr(data.debitNote.taxableAmount)} />
          <Info2 label="GST" value={inr(data.debitNote.taxAmount)} />
          <Info2 label="Total Debit" value={<span className="font-semibold">{inr(data.debitNote.totalDebit)}</span>} />
          <Info2 label="Supplier Outstanding" value={<Badge tone={data.debitNote.supplierOutstandingUpdated ? "success" : "neutral"}>{data.debitNote.supplierOutstandingUpdated ? "Reduced" : "Not posted"}</Badge>} />
        </div>
      </SectionCard>

      {/* Inventory reversal log (stock OUT raised to the supplier). */}
      <SectionCard icon={ScrollText} title="Inventory Reversal Log" action={<button onClick={() => setShowLedger((s) => !s)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{showLedger ? "Hide" : "View"}<ChevronDown className={cn("h-3.5 w-3.5 transition", showLedger && "rotate-180")} /></button>}>
        {!showLedger ? <p className="text-2xs text-muted">{data.ledger.length} inventory movement{data.ledger.length === 1 ? "" : "s"} raised by this return. Click View to expand.</p> : (
          data.ledger.length ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                  <th className="px-3 py-2">Date</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Warehouse</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Balance</th>
                </tr></thead>
                <tbody>
                  {data.ledger.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-muted">{m.txnDate}</td>
                      <td className="px-3 py-2"><div className="font-medium text-foreground">{m.productName}</div><div className="font-mono text-2xs text-subtle">{m.sku || "—"}</div></td>
                      <td className="px-3 py-2"><Badge tone="warning">{m.txnType.replace(/_/g, " ")} {m.direction}</Badge></td>
                      <td className="px-3 py-2 text-muted">{m.warehouse || "—"}</td>
                      <td className="px-3 py-2 font-mono text-2xs text-muted">{m.batchNo || "—"}</td>
                      <td className="px-3 py-2 text-right font-medium text-danger">-{fmt.qty(m.qty)}</td>
                      <td className="px-3 py-2 text-right text-foreground">{fmt.qty(m.balanceQty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">No inventory movements (value-only return for {data.purchaseType}).</p>
        )}
      </SectionCard>

      {/* Accounting posting (reversal) voucher. */}
      <SectionCard icon={BookOpen} title="Accounting Posting Log" action={<button onClick={() => setShowVoucher((s) => !s)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{showVoucher ? "Hide" : "View"}<ChevronDown className={cn("h-3.5 w-3.5 transition", showVoucher && "rotate-180")} /></button>}>
        {!showVoucher ? <p className="text-2xs text-muted">{data.voucher ? `Voucher ${data.voucher.voucherNo}` : "Not posted"}. Click View to expand.</p> : (
          data.voucher ? (
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted"><span className="font-mono font-semibold text-foreground">{data.voucher.voucherNo}</span><span>·</span><span>{data.voucher.date}</span><span>·</span><span>{data.voucher.narration}</span></div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                    <th className="px-3 py-2">Account</th><th className="px-3 py-2">Narration</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th>
                  </tr></thead>
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
          ) : <p className="text-sm text-muted">No accounting voucher posted yet (return not approved).</p>
        )}
      </SectionCard>
    </div>
  );
}

function Info2({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</div><div className="mt-0.5 text-sm text-foreground">{value}</div></div>;
}
function PostTag({ on, label, muted }: { on: boolean; label: string; muted?: boolean }) {
  if (muted) return <Badge tone="neutral">{label}: N/A</Badge>;
  return <Badge tone={on ? "success" : "neutral"}>{label}: {on ? "Yes" : "No"}</Badge>;
}
