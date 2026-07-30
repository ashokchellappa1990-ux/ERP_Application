"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HandCoins, ArrowLeft, Save, CheckCircle2, User, FileText, Wallet, Paperclip, Upload, X, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { BankPicker, emptyBank } from "@/components/finance/BankPicker";
// Shared API contract — customer + open-invoice shapes from the collection lookup.
import type { CollectionCustomer as Cust, OpenInvoiceRow } from "@/lib/contracts/sale";

interface CustHit { id: number; name: string; phone: string; gstin: string }
// Open invoice row + the per-row "collect" amount the cashier types in (UI state).
interface Inv extends OpenInvoiceRow { collect: string }
interface Attach { fileName: string; fileUrl: string; fileType: string | null; size: number }
interface PayLine { mode: string; amount: string; reference: string }
const n = (v: unknown) => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const MODES = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card"];

export function CustomerCollectionForm() {
  const router = useRouter();
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const [custQuery, setCustQuery] = useState("");
  const [custHits, setCustHits] = useState<CustHit[]>([]);
  const [customer, setCustomer] = useState<Cust | null>(null);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loadingInv, setLoadingInv] = useState(false);

  const [collectionDate, setCollectionDate] = useState(today);
  const [payments, setPayments] = useState<PayLine[]>([{ mode: "Cash", amount: "", reference: "" }]);
  const [bank, setBank] = useState(emptyBank);
  const [notes, setNotes] = useState("");
  const [globalAmt, setGlobalAmt] = useState("");

  const [attachments, setAttachments] = useState<Attach[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!custQuery.trim() || customer) { setCustHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => { try { const j = await fetch(`/api/masters/customers?q=${encodeURIComponent(custQuery)}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); if (j.ok) setCustHits(j.customers); } catch { /* */ } }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [custQuery, customer]);

  async function pickCustomer(id: number) {
    setLoadingInv(true); setCustQuery(""); setCustHits([]);
    try {
      const j = await fetch(`/api/sales/collection/open?customerId=${id}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) { setCustomer(j.customer); setInvoices(j.rows.map((r: Omit<Inv, "collect">) => ({ ...r, collect: "" }))); setTotalBalance(j.totalBalance); }
    } catch { /* */ } finally { setLoadingInv(false); }
  }
  function changeCustomer() { setCustomer(null); setInvoices([]); setTotalBalance(0); setGlobalAmt(""); }

  const setCollect = (saleId: number, val: string) => setInvoices((c) => c.map((i) => (i.saleId === saleId ? { ...i, collect: capCollect(val, i.balanceAmount) } : i)));
  const payFull = () => setInvoices((c) => c.map((i) => ({ ...i, collect: String(i.balanceAmount) })));
  const clearAll = () => { setInvoices((c) => c.map((i) => ({ ...i, collect: "" }))); setGlobalAmt(""); };
  // Distribute a single global amount across invoices oldest-first (FIFO).
  // Compute the result purely (outside the state updater) so React StrictMode's
  // double-invocation can't decrement `remaining` twice.
  function autoAllocate() {
    let remaining = n(globalAmt);
    if (remaining <= 0) return;
    const next = invoices.map((i) => {
      if (remaining <= 0) return { ...i, collect: "" };
      const take = Math.min(remaining, i.balanceAmount);
      remaining = +(remaining - take).toFixed(2);
      return { ...i, collect: take > 0 ? String(+take.toFixed(2)) : "" };
    });
    setInvoices(next);
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append("file", f);
      const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) setAttachments((a) => [...a, j.file]); else setError(j.message || "Upload failed");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const total = useMemo(() => +invoices.reduce((s, i) => s + n(i.collect), 0).toFixed(2), [invoices]);
  const allocated = invoices.filter((i) => n(i.collect) > 0).length;

  // Multiple payment modes against this single collection.
  const setPay = (idx: number, patch: Partial<PayLine>) => setPayments((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const addPayLine = () => setPayments((p) => [...p, { mode: "Bank Transfer", amount: "", reference: "" }]);
  const removePayLine = (idx: number) => setPayments((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p));
  const tendered = useMemo(() => +payments.reduce((s, p) => s + n(p.amount), 0).toFixed(2), [payments]);
  const payDiff = +(total - tendered).toFixed(2);

  // With a single payment mode, keep its amount synced to the collection total.
  useEffect(() => {
    setPayments((p) => (p.length === 1 ? [{ ...p[0], amount: total > 0 ? String(total) : "" }] : p));
  }, [total]);

  async function save() {
    setError("");
    if (!customer) { setError("Select a customer."); return; }
    const allocations = invoices.filter((i) => n(i.collect) > 0).map((i) => ({ saleId: i.saleId, amount: n(i.collect) }));
    if (!allocations.length) { setError("Enter a collection amount against at least one invoice."); return; }
    const payLines = payments.filter((p) => n(p.amount) > 0).map((p) => ({ mode: p.mode, amount: n(p.amount), reference: p.reference }));
    if (!payLines.length) { setError("Enter at least one payment mode amount."); return; }
    if (Math.abs(payDiff) > 0.01) { setError(`Tendered (${inr(tendered)}) must equal the total collection (${inr(total)}).`); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/sales/collection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: customer.id, collectionDate, payments: payLines, notes, attachments, allocations, bankId: bank.bankId, bankName: bank.bankName, bankAccount: bank.bankAccount }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.message || "Could not record the collection."); setBusy(false); return; }
      router.push(`/sales/collections/${j.id}`);
    } catch { setError("Network error."); setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales/collections" className="hover:text-foreground">Customer Collections</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><HandCoins className="h-5 w-5 text-primary" /> New Collection</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/collections"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Record Collection"}</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          {/* Customer */}
          <SectionCard icon={User} title="Customer" allowOverflow action={customer && <button onClick={changeCustomer} className="text-2xs font-semibold text-danger hover:underline">Change</button>}>
            {customer ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="rounded-lg bg-primary-subtle/40 px-3 py-2 text-sm">
                  <div className="font-semibold text-foreground">{customer.name}{customer.contactPerson ? ` · ${customer.contactPerson}` : ""}</div>
                  <div className="text-2xs text-muted">{customer.gstin ? `GSTIN ${customer.gstin} · ` : ""}{customer.phone || "—"}{customer.email ? ` · ${customer.email}` : ""}</div>
                  {(customer.address || customer.city || customer.state || customer.pincode) && <div className="text-2xs text-muted">{[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ")}</div>}
                </div>
                <div className="flex flex-col items-end justify-center rounded-lg border border-warning/30 bg-warning-subtle/40 px-4 py-2"><span className="text-2xs font-semibold uppercase tracking-wider text-muted">Outstanding</span><span className="text-lg font-bold text-warning">{inr(totalBalance)}</span></div>
              </div>
            ) : (
              <div className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input value={custQuery} onChange={(e) => setCustQuery(e.target.value)} placeholder="Search customer by name / phone / email…" className="h-10 w-full rounded-md border border-border-strong bg-surface pl-10 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none" />
                {custQuery && custHits.length > 0 && (
                  <div className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
                    {custHits.map((c) => <button key={c.id} onClick={() => pickCustomer(c.id)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40"><span className="font-medium text-foreground">{c.name}</span><span className="font-mono text-2xs text-subtle">{c.gstin || c.phone}</span></button>)}
                  </div>
                )}
                {custQuery && custHits.length === 0 && <div className="absolute z-40 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-xl">No customer found.</div>}
              </div>
            )}
          </SectionCard>

          {/* Credit invoices */}
          <SectionCard icon={FileText} title="Credit Invoices" bodyClass=""
            action={invoices.length > 0 && (
              <div className="flex items-center gap-1.5 text-2xs">
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5">₹<input type="number" value={globalAmt} onChange={(e) => setGlobalAmt(e.target.value)} placeholder="amount" className="h-5 w-16 bg-transparent text-right text-2xs focus:outline-none" /><button onClick={autoAllocate} className="font-semibold text-primary" title="Allocate oldest-first (FIFO)">Auto</button></span>
                <button onClick={payFull} className="rounded-md border border-border bg-surface px-2 py-1 font-semibold text-primary hover:border-primary">Full</button>
                <button onClick={clearAll} className="rounded-md border border-border bg-surface px-2 py-1 font-semibold text-muted hover:text-danger">Clear</button>
              </div>
            )}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Invoice</th><th className="px-3 py-2.5">Date / Due</th><th className="px-3 py-2.5 text-right">Total</th><th className="px-3 py-2.5 text-right">Paid</th><th className="px-3 py-2.5 text-right">Balance</th><th className="px-3 py-2.5 text-right">Collect</th></tr></thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.saleId} className={cn("border-b border-border last:border-0", n(i.collect) > 0 && "bg-primary-subtle/15")}>
                      <td className="px-3 py-2"><Link href={i.channel === "B2B" ? `/sales/invoice/${i.saleId}` : "/sales/history"} className="font-mono text-2xs font-semibold text-primary hover:underline">{i.invoiceNo}</Link><div className="text-2xs text-subtle">{i.channel}{i.status === "Partial" ? " · Partial" : ""}</div></td>
                      <td className="px-3 py-2 text-2xs"><div className="text-foreground">{i.saleDate || "—"}</div><div className={cn(i.overdue ? "font-semibold text-danger" : "text-subtle")}>due {i.dueDate || "—"}</div></td>
                      <td className="px-3 py-2 text-right text-muted">{inr(i.totalAmount)}</td>
                      <td className="px-3 py-2 text-right text-muted">{inr(i.paidAmount)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-foreground">{inr(i.balanceAmount)}</td>
                      <td className="px-3 py-2 text-right"><div className="flex items-center justify-end gap-1"><input type="number" value={i.collect} onChange={(e) => setCollect(i.saleId, e.target.value)} placeholder="0" className="h-8 w-24 rounded border border-border bg-surface-2 px-2 text-right text-xs focus:border-primary focus:outline-none" /><button onClick={() => setCollect(i.saleId, String(i.balanceAmount))} title="Collect full balance" className="grid h-8 w-8 place-items-center rounded border border-border bg-surface text-2xs font-bold text-muted hover:text-primary">F</button></div></td>
                    </tr>
                  ))}
                  {loadingInv && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">Loading invoices…</td></tr>}
                  {!loadingInv && customer && invoices.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No outstanding credit invoices for this customer.</td></tr>}
                  {!customer && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">Select a customer to load their credit invoices.</td></tr>}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Documents */}
          <SectionCard icon={Paperclip} title="Documents">
            <label className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted transition hover:border-primary/40 hover:text-primary">
              {uploading ? <Upload className="h-4 w-4 animate-pulse" /> : <Paperclip className="h-4 w-4" />} {uploading ? "Uploading…" : "Upload cheque / receipt / proof (PDF, image — max 8 MB)"}
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            </label>
            {attachments.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary-subtle px-2 py-0.5 text-2xs font-medium text-primary"><FileText className="h-3 w-3" /><a href={a.fileUrl} target="_blank" className="hover:underline">{a.fileName}</a><button onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))} className="hover:text-danger"><X className="h-3 w-3" /></button></span>)}</div>}
          </SectionCard>
        </div>

        <aside>
          <SectionCard icon={Wallet} title="Collection Details">
            <div className="space-y-3">
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Collection Date</label><input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} className={inp} /></div>
              <BankPicker mode={payments.find((p) => !p.mode.toLowerCase().includes("cash"))?.mode} value={bank} onChange={setBank} label="Deposit Bank" required />

              <div>
                <div className="mb-1 flex items-center justify-between"><label className="block text-2xs font-semibold text-muted">Payment Mode(s)</label><button onClick={addPayLine} className="text-2xs font-semibold text-primary hover:underline">+ Add mode</button></div>
                <div className="space-y-2">
                  {payments.map((p, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-surface-2/40 p-2">
                      <div className="flex items-center gap-1.5">
                        <select value={p.mode} onChange={(e) => setPay(idx, { mode: e.target.value })} className="h-8 w-28 shrink-0 rounded-md border border-border-strong bg-surface px-2 text-xs focus:border-primary focus:outline-none">{MODES.map((m) => <option key={m}>{m}</option>)}</select>
                        <input type="number" value={p.amount} onChange={(e) => setPay(idx, { amount: e.target.value })} placeholder="Amount" className="h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" />
                        {payments.length > 1 && <button onClick={() => removePayLine(idx)} className="grid h-8 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-danger-subtle hover:text-danger"><X className="h-3.5 w-3.5" /></button>}
                      </div>
                      <input value={p.reference} onChange={(e) => setPay(idx, { reference: e.target.value })} placeholder="Reference / UTR / cheque no." className="mt-1.5 h-8 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm focus:border-primary focus:outline-none" />
                    </div>
                  ))}
                </div>
                {total > 0 && (
                  <div className="mt-1 flex items-center justify-between text-2xs"><span className="text-muted">Tendered {inr(tendered)}</span>{Math.abs(payDiff) > 0.01 ? <span className="font-semibold text-danger">{payDiff > 0 ? `${inr(payDiff)} short` : `${inr(-payDiff)} over`}</span> : <span className="font-semibold text-success">matches total ✓</span>}</div>
                )}
              </div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" className={cn(inp, "h-auto py-2")} /></div>
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <div className="flex items-center justify-between text-sm"><span className="text-muted">Invoices allocated</span><Badge tone={allocated > 0 ? "primary" : "neutral"}>{allocated}</Badge></div>
              <div className="mt-1 flex items-center justify-between text-lg font-bold text-foreground"><span>Total Collection</span><span>{inr(total)}</span></div>
            </div>
            {error && <p className="mt-2 rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{error}</p>}
            <Button size="lg" className="mt-3 w-full" onClick={save} disabled={busy || total <= 0}><CheckCircle2 className="h-4 w-4" /> {busy ? "Saving…" : `Collect ${inr(total)}`}</Button>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

function capCollect(val: string, balance: number) {
  if (val === "") return "";
  const v = Math.max(0, Number(val) || 0);
  return String(Math.min(v, balance));
}
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
