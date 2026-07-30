"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, ArrowLeft, Save, CheckCircle2, Truck, FileText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { cn } from "@/lib/cn";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { BankPicker, emptyBank } from "@/components/finance/BankPicker";

interface Supplier { id: number; name: string; gstin: string }
interface Inv { payableId: number; sourceType: string; sourceId: number; refNo: string; docDate: string; dueDate: string; paymentTerms: string; totalAmount: number; paidAmount: number; balanceAmount: number; status: string; overdue: boolean; pay: string }
const n = (v: unknown) => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const MODES = ["Bank Transfer", "Cash", "UPI", "Cheque", "Card"];

export function SupplierPaymentForm() {
  const router = useRouter();
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplier, setSupplier] = useState("");
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);

  const [paymentDate, setPaymentDate] = useState(today);
  const [mode, setMode] = useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [bank, setBank] = useState(emptyBank);
  const [notes, setNotes] = useState("");
  const [pct, setPct] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => { try { const j = await fetch("/api/masters/suppliers", { cache: "no-store" }).then((r) => r.json()); if (j.ok) setSuppliers(j.suppliers); } catch { /* */ } })();
  }, []);

  useEffect(() => {
    if (!supplier) { setInvoices([]); return; }
    setLoadingInv(true);
    (async () => {
      try {
        const j = await fetch(`/api/purchase/supplier-payment/open?supplier=${encodeURIComponent(supplier)}`, { cache: "no-store" }).then((r) => r.json());
        if (j.ok) setInvoices(j.rows.map((r: Omit<Inv, "pay">) => ({ ...r, pay: "" })));
      } catch { /* */ } finally { setLoadingInv(false); }
    })();
  }, [supplier]);

  const setPay = (payableId: number, val: string) => setInvoices((c) => c.map((i) => (i.payableId === payableId ? { ...i, pay: capPay(val, i.balanceAmount) } : i)));
  const payFull = () => setInvoices((c) => c.map((i) => ({ ...i, pay: String(i.balanceAmount) })));
  const applyPct = () => { const p = n(pct); if (p <= 0) return; setInvoices((c) => c.map((i) => ({ ...i, pay: String(+(i.balanceAmount * p / 100).toFixed(2)) }))); };
  const clearAll = () => setInvoices((c) => c.map((i) => ({ ...i, pay: "" })));

  const total = useMemo(() => +invoices.reduce((s, i) => s + n(i.pay), 0).toFixed(2), [invoices]);
  const allocated = invoices.filter((i) => n(i.pay) > 0).length;

  async function save() {
    setError("");
    if (!supplier) { setError("Select a supplier."); return; }
    const allocations = invoices.filter((i) => n(i.pay) > 0).map((i) => ({ payableId: i.payableId, amount: n(i.pay) }));
    if (!allocations.length) { setError("Enter a payment amount against at least one invoice."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/purchase/supplier-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplier, paymentDate, mode, reference, notes, allocations, bankId: bank.bankId, bankName: bank.bankName, bankAccount: bank.bankAccount }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.message || "Could not record the payment."); setBusy(false); return; }
      router.push(`/purchase/payments/${j.id}`);
    } catch { setError("Network error."); setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase/payments" className="hover:text-foreground">Supplier Payments</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Banknote className="h-5 w-5 text-primary" /> New Supplier Payment</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/purchase/payments"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Record Payment"}</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <SectionCard icon={Truck} title="Supplier">
            <div className="max-w-md">
              <label className="mb-1 block text-2xs font-semibold text-muted">Select Supplier *</label>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inp}>
                <option value="">Select supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}{s.gstin ? ` · ${s.gstin}` : ""}</option>)}
              </select>
            </div>
          </SectionCard>

          <SectionCard icon={FileText} title="Outstanding Invoices" bodyClass=""
            action={invoices.length > 0 && (
              <div className="flex items-center gap-1.5 text-2xs">
                <button onClick={payFull} className="rounded-md border border-border bg-surface px-2 py-1 font-semibold text-primary hover:border-primary">Pay Full</button>
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5"><input type="number" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="%" className="h-5 w-10 bg-transparent text-right text-2xs focus:outline-none" /><button onClick={applyPct} className="font-semibold text-primary">Apply</button></span>
                <button onClick={clearAll} className="rounded-md border border-border bg-surface px-2 py-1 font-semibold text-muted hover:text-danger">Clear</button>
              </div>
            )}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Invoice</th><th className="px-3 py-2.5">Doc / Due</th><th className="px-3 py-2.5 text-right">Total</th><th className="px-3 py-2.5 text-right">Paid</th><th className="px-3 py-2.5 text-right">Balance</th><th className="px-3 py-2.5 text-right">Pay Now</th></tr></thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.payableId} className={cn("border-b border-border last:border-0", n(i.pay) > 0 && "bg-primary-subtle/15")}>
                      <td className="px-3 py-2"><Link href={i.sourceType === "GRN" ? `/purchase/grn/${i.sourceId}` : "#"} className="font-mono text-2xs font-semibold text-primary hover:underline">{i.refNo}</Link><div className="text-2xs text-subtle">{i.sourceType}{i.status === "Partial" ? " · Partial" : ""}</div></td>
                      <td className="px-3 py-2 text-2xs"><div className="text-foreground">{i.docDate || "—"}</div><div className={cn(i.overdue ? "font-semibold text-danger" : "text-subtle")}>due {i.dueDate || "—"}</div></td>
                      <td className="px-3 py-2 text-right text-muted">{inr(i.totalAmount)}</td>
                      <td className="px-3 py-2 text-right text-muted">{inr(i.paidAmount)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-foreground">{inr(i.balanceAmount)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input type="number" value={i.pay} onChange={(e) => setPay(i.payableId, e.target.value)} placeholder="0" className="h-8 w-24 rounded border border-border bg-surface-2 px-2 text-right text-xs focus:border-primary focus:outline-none" />
                          <button onClick={() => setPay(i.payableId, String(i.balanceAmount))} title="Pay full balance" className="grid h-8 w-8 place-items-center rounded border border-border bg-surface text-2xs font-bold text-muted hover:text-primary">F</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {loadingInv && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">Loading invoices…</td></tr>}
                  {!loadingInv && supplier && invoices.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No outstanding invoices for this supplier.</td></tr>}
                  {!supplier && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">Select a supplier to load their outstanding invoices.</td></tr>}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <SectionCard icon={Wallet} title="Payment Details">
            <div className="space-y-3">
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Payment Date</label><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inp} /></div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Mode</label><select value={mode} onChange={(e) => setMode(e.target.value)} className={inp}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Reference</label><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no" className={inp} /></div>
              <BankPicker mode={mode} value={bank} onChange={setBank} required />

              <div><label className="mb-1 block text-2xs font-semibold text-muted">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" className={cn(inp, "h-auto py-2")} /></div>
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <div className="flex items-center justify-between text-sm"><span className="text-muted">Invoices allocated</span><Badge tone={allocated > 0 ? "primary" : "neutral"}>{allocated}</Badge></div>
              <div className="mt-1 flex items-center justify-between text-lg font-bold text-foreground"><span>Total Payment</span><span>{inr(total)}</span></div>
            </div>
            {error && <p className="mt-2 rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{error}</p>}
            <Button size="lg" className="mt-3 w-full" onClick={save} disabled={busy || total <= 0}><CheckCircle2 className="h-4 w-4" /> {busy ? "Saving…" : `Pay ${inr(total)}`}</Button>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

function capPay(val: string, balance: number) {
  if (val === "") return "";
  const v = Math.max(0, Number(val) || 0);
  return String(Math.min(v, balance));
}
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
