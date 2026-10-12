"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { XCircle, Search, ArrowLeft, Loader2, ReceiptText, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { CANCELLATION_REFUND_METHODS, type CancellationLookupSale, type CancellationInvoiceMatch } from "@/lib/contracts/salesCancellation";

const DEFAULT_REASONS = ["Wrong Customer", "Wrong Billing", "Duplicate Invoice", "Wrong Product", "Wrong Quantity", "Wrong Price", "Cashier Error", "System Error", "Customer Cancelled Purchase", "Other"];

export function SalesCancellationEditor() {
  const router = useRouter();
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<CancellationInvoiceMatch[] | null>(null);
  const [sale, setSale] = useState<CancellationLookupSale | null>(null);
  const [reasons, setReasons] = useState<string[]>(DEFAULT_REASONS);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [refundMethod, setRefundMethod] = useState("original");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/settings/sales", { cache: "no-store" }).then((r) => r.json());
        const f = j?.config?.fields ?? {};
        const arr = JSON.parse(f.cancellationReasons || "[]");
        if (Array.isArray(arr) && arr.length) setReasons(arr.map(String));
        if (f.defaultCancellationRefund) setRefundMethod(String(f.defaultCancellationRefund));
      } catch { /* keep defaults */ }
    })();
  }, []);

  async function search(qStr: string) {
    if (!qStr.trim()) return;
    setSearching(true); setError(null);
    try {
      const res = await fetch(`/api/sales/cancellations/lookup?q=${encodeURIComponent(qStr.trim())}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) { setError(j.message || "Lookup failed."); setMatches([]); return; }
      if (j.sale) { setSale(j.sale); setMatches(null); }
      else setMatches(j.matches ?? []);
    } catch { setError("Lookup failed."); } finally { setSearching(false); }
  }
  async function pick(id: number) {
    setSearching(true); setError(null);
    try {
      const res = await fetch(`/api/sales/cancellations/lookup?id=${id}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (j.ok && j.sale) { setSale(j.sale); setMatches(null); }
      else setError(j.message || "Could not load invoice.");
    } catch { setError("Could not load invoice."); } finally { setSearching(false); }
  }

  async function submit() {
    if (!sale) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/sales/cancellations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleId: sale.id, reason, remarks, refundMethod }) });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) { setError(j.message || "Could not cancel the invoice."); setSaving(false); return; }
      router.push(`/sales/cancellation/${j.id}`);
    } catch { setError("Could not cancel the invoice."); setSaving(false); }
  }

  const inp = "h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales/cancellation" className="hover:text-foreground">Sales Cancellation</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><XCircle className="h-5 w-5 text-primary" /> New Sales Cancellation</h1>
          <p className="mt-0.5 text-sm text-muted">Select an invoice — the entire sale will be reversed on approval.</p>
        </div>
        <Link href="/sales/cancellation"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {error && <div className="flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger-subtle/50 px-3 py-2 text-2xs font-medium text-danger"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</div>}

      {!sale && (
        <SectionCard icon={Search} title="Select Sales Invoice" allowOverflow>
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(query); } }} placeholder="Search invoice no, customer, mobile or scan QR…" className="h-11 w-full rounded-lg border border-primary/40 bg-card px-3 text-sm shadow-sm placeholder:text-subtle focus:border-primary focus:outline-none" />
            <Button size="md" onClick={() => search(query)} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find</Button>
          </div>
          {matches !== null && (matches.length ? (
            <div className="mt-2 overflow-hidden rounded-lg border border-border">
              <div className="bg-surface-2 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle">{matches.length} invoice{matches.length === 1 ? "" : "s"} — pick one</div>
              {matches.map((m) => (
                <button key={m.id} onClick={() => pick(m.id)} className="flex w-full items-center justify-between gap-3 border-t border-border px-3 py-2 text-left text-sm transition hover:bg-primary-subtle/40">
                  <span className="min-w-0"><span className="block font-mono text-sm font-semibold text-foreground">{m.invoiceNo}</span><span className="block text-2xs text-muted">{m.saleDate} · {m.customerName} · {m.itemCount} item{m.itemCount === 1 ? "" : "s"}</span></span>
                  <span className="flex shrink-0 items-center gap-2"><Badge tone={m.status === "Completed" ? "neutral" : "danger"}>{m.status}</Badge><span className="text-sm font-semibold text-foreground">{inr(m.total)}</span></span>
                </button>
              ))}
            </div>
          ) : <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">No invoices matched.</div>)}
        </SectionCard>
      )}

      {sale && (
        <>
          {!sale.cancellable && <div className="flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning-subtle/40 px-3 py-2 text-2xs font-medium text-warning"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{sale.blockReason}</div>}

          <SectionCard icon={ReceiptText} title="Invoice (read-only)" action={<div className="flex items-center gap-2"><Badge tone="neutral">{sale.channel}</Badge><Button variant="outline" size="sm" onClick={() => { setSale(null); setMatches(null); }}>Change</Button></div>}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info2 label="Invoice No" value={<span className="font-mono">{sale.invoiceNo}</span>} />
              <Info2 label="Sale Date" value={sale.saleDate} />
              <Info2 label="Customer" value={sale.customerName} />
              <Info2 label="Phone" value={sale.customerPhone || "—"} />
              <Info2 label="Warehouse" value={sale.warehouse} />
              <Info2 label="Payment" value={`${sale.paymentMode || "—"} · ${sale.paymentStatus || "—"}`} />
              <Info2 label="Paid" value={inr(sale.amountPaid)} />
              <Info2 label="Invoice Total" value={<span className="font-semibold">{inr(sale.total)}</span>} />
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Product</th><th className="px-3 py-2">Batch / Exp</th><th className="px-3 py-2">Serials</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Value</th></tr></thead>
                <tbody>
                  {sale.lines.map((l) => (
                    <tr key={l.saleLineId} className="border-b border-border last:border-0">
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
            {sale.payments.length > 0 && <div className="mt-2 flex flex-wrap gap-2 text-2xs">{sale.payments.map((p, i) => <Badge key={i} tone="info">{p.mode}: {inr(p.amount)}</Badge>)}</div>}
          </SectionCard>

          <SectionCard icon={XCircle} title="Cancellation Details">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="text-2xs font-semibold uppercase tracking-wide text-subtle">Reason *</label><select value={reason} onChange={(e) => setReason(e.target.value)} className={cn(inp, "mt-1")}><option value="">— Select reason —</option>{reasons.map((r) => <option key={r}>{r}</option>)}</select></div>
              <div><label className="text-2xs font-semibold uppercase tracking-wide text-subtle">Refund Method</label><select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className={cn(inp, "mt-1")}>{CANCELLATION_REFUND_METHODS.map((m) => <option key={m} value={m}>{m === "original" ? "Original Payment Method" : m === "storeCredit" ? "Store Credit" : m.charAt(0).toUpperCase() + m.slice(1)}</option>)}</select></div>
              <div className="sm:col-span-3"><label className="text-2xs font-semibold uppercase tracking-wide text-subtle">Remarks *</label><input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Why is this invoice being cancelled?" className={cn(inp, "mt-1")} /></div>
            </div>
            <div className="mt-4 flex flex-col items-stretch justify-between gap-3 border-t border-border pt-3 sm:flex-row sm:items-center">
              <div className="text-sm text-muted">Cancelling invoice <span className="font-semibold text-foreground">{sale.invoiceNo}</span> · Refund <span className="font-semibold text-foreground">{inr(sale.amountPaid)}</span></div>
              <Button size="md" onClick={submit} disabled={saving || !sale.cancellable}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Cancel Invoice</Button>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function Info2({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</div><div className="mt-0.5 text-sm text-foreground">{value}</div></div>;
}
