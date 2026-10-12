"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, Plus, RefreshCw, ShoppingCart, Eye, XCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { VOUCHER_TYPE_LABELS, BUYER_TYPES, SALE_PAYMENT_MODES, type ValidateResult } from "@/lib/contracts/giftVoucher";

const API = "/api/gift-voucher";
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
const fm = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

interface SaleRow { id: number; saleNo: string; saleDate: string; voucherNo: string; voucherType: string; buyerType: string; customerName: string; faceValue: number; gstAmount: number; netAmount: number; paymentMode: string; journalRef: string }
interface SaleDetail extends SaleRow { salePrice: number; paymentRef: string; invoiceNo: string; createdByName: string; remarks: string; voucherStatus: string; availableBalance: number; expiryDate: string }
interface Sellable { id: number; voucherNo: string; voucherType: string; faceValue: number }

export function GiftVoucherSalesConsole() {
  const [mode, setMode] = useState<"list" | "add">("list");
  const [msg, setMsg] = useState("");
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2800); };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Sales</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Gift Voucher Sales</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wallet className="h-5 w-5 text-primary" /> Gift Voucher Sales</h1>
        </div>
        {mode === "list" ? <Button onClick={() => setMode("add")}><Plus className="h-4 w-4" /> New Sale</Button> : <Button variant="outline" onClick={() => setMode("list")}><ArrowLeft className="h-4 w-4" /> Back to list</Button>}
      </div>
      {mode === "list" ? <ListView flash={flash} /> : <AddView flash={flash} onDone={() => setMode("list")} />}
      {msg && <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-primary/40 bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg">{msg}</div>}
    </div>
  );
}

/* -------------------- list + view -------------------- */
function ListView({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState<SaleDetail | null>(null);
  const load = useCallback(async () => { const p = new URLSearchParams(); if (q) p.set("q", q); const j = await fetch(`${API}/sales?${p}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, [q]);
  useEffect(() => { load(); }, [load]);
  async function open(id: number) { const j = await fetch(`${API}/saleDetail?id=${id}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setView(j.data); else flash(j.message || "Could not load."); }
  const total = rows.reduce((a, r) => a + r.netAmount, 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sale no / voucher / customer…" className={cn(inp, "w-72")} />
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        <span className="ml-auto text-2xs text-muted">{rows.length} sale(s) · {fm(total)}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Sale No</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Voucher</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Buyer</th><th className="px-3 py-2.5 text-right">Face</th><th className="px-3 py-2.5 text-right">GST</th><th className="px-3 py-2.5 text-right">Net</th><th className="px-3 py-2.5">Mode</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2/40">
                <td className="px-3 py-2 font-mono text-2xs font-semibold text-foreground">{r.saleNo}</td>
                <td className="px-3 py-2 text-2xs text-muted">{r.saleDate}</td>
                <td className="px-3 py-2 font-mono text-2xs">{r.voucherNo}</td>
                <td className="px-3 py-2 text-2xs text-muted">{VOUCHER_TYPE_LABELS[r.voucherType] ?? r.voucherType}</td>
                <td className="px-3 py-2 text-muted">{r.customerName || r.buyerType}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fm(r.faceValue)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">{r.gstAmount ? fm(r.gstAmount) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{fm(r.netAmount)}</td>
                <td className="px-3 py-2 text-2xs">{r.paymentMode}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => open(r.id)} className="rounded-md border border-border px-2 py-1 text-2xs font-semibold text-muted hover:border-primary hover:text-primary"><Eye className="mr-1 inline h-3 w-3" />View</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-muted">No voucher sales yet. Click “New Sale” to sell a generated voucher.</td></tr>}
          </tbody>
        </table>
      </div>
      {view && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => setView(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><div><h2 className="font-mono text-sm font-bold text-foreground">{view.saleNo}</h2><p className="text-2xs text-muted">{view.saleDate} · {view.voucherNo}</p></div><button onClick={() => setView(null)} className="text-muted hover:text-foreground"><XCircle className="h-5 w-5" /></button></div>
            <div className="space-y-1.5 p-5 text-sm">
              <Row k="Voucher" v={`${view.voucherNo} (${VOUCHER_TYPE_LABELS[view.voucherType] ?? view.voucherType})`} />
              <Row k="Voucher Status" v={`${view.voucherStatus} · Balance ${fm(view.availableBalance)}`} />
              <Row k="Buyer" v={view.customerName || view.buyerType} />
              <Row k="Face Value" v={fm(view.faceValue)} />
              {view.gstAmount > 0 && <Row k="GST" v={fm(view.gstAmount)} />}
              <Row k="Net Amount" v={fm(view.netAmount)} />
              <Row k="Payment" v={`${view.paymentMode}${view.paymentRef ? ` · ${view.paymentRef}` : ""}`} />
              {view.invoiceNo && <Row k="Invoice" v={view.invoiceNo} />}
              <Row k="Journal" v={view.journalRef || "—"} />
              <Row k="Expiry" v={view.expiryDate || "—"} />
              <Row k="Sold By" v={view.createdByName || "—"} />
              {view.remarks && <Row k="Remarks" v={view.remarks} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- add (sell) -------------------- */
function AddView({ flash, onDone }: { flash: (m: string) => void; onDone: () => void }) {
  const [sellable, setSellable] = useState<Sellable[]>([]);
  const [f, setF] = useState({ voucherNo: "", buyerType: "WalkIn", customerName: "", saleDate: "", expiryDate: "", paymentMode: "Cash", paymentRef: "", invoiceNo: "", remarks: "" });
  const [chk, setChk] = useState<ValidateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  useEffect(() => { (async () => { const j = await fetch(`${API}/sellable`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setSellable(j.rows); })(); }, []);
  const selected = sellable.find((v) => v.voucherNo === f.voucherNo);
  async function check(no: string) { if (!no.trim()) { setChk(null); return; } const j = await fetch(`${API}/validate?voucherNo=${encodeURIComponent(no.trim())}`, { cache: "no-store" }).then((r) => r.json()); setChk(j.ok ? j.data : null); }
  async function sell() {
    if (!f.voucherNo.trim()) { flash("Select or enter a voucher number."); return; }
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sell", ...f }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { flash(j.message); onDone(); } else flash(j.message || "Could not complete the sale.");
  }
  return (
    <div className="max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground"><ShoppingCart className="h-4 w-4 text-primary" /> Sell a Gift Voucher</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-1"><label className={lbl}>Voucher (generated) *</label><select value={f.voucherNo} onChange={(e) => { set("voucherNo", e.target.value); check(e.target.value); }} className={inp}><option value="">Select voucher…</option>{sellable.map((v) => <option key={v.id} value={v.voucherNo}>{v.voucherNo} · {fm(v.faceValue)}</option>)}</select></div>
        <div className="lg:col-span-2"><label className={lbl}>…or enter Voucher Number</label><div className="flex gap-2"><input value={f.voucherNo} onChange={(e) => set("voucherNo", e.target.value.toUpperCase())} onBlur={(e) => check(e.target.value)} placeholder="GV…" className={inp} /><Button variant="outline" size="md" onClick={() => check(f.voucherNo)}>Check</Button></div>{chk && <p className={cn("mt-1 text-2xs", chk.voucherId ? "text-success" : "text-danger")}>{chk.voucherId ? `${chk.status} · Face ${fm(chk.faceValue)}` : chk.reason}</p>}</div>
        <div><label className={lbl}>Buyer Type</label><select value={f.buyerType} onChange={(e) => set("buyerType", e.target.value)} className={inp}>{BUYER_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className={lbl}>Customer Name</label><input value={f.customerName} onChange={(e) => set("customerName", e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Payment Mode</label><select value={f.paymentMode} onChange={(e) => set("paymentMode", e.target.value)} className={inp}>{SALE_PAYMENT_MODES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className={lbl}>Payment Reference</label><input value={f.paymentRef} onChange={(e) => set("paymentRef", e.target.value)} placeholder="UPI ref / cheque no" className={inp} /></div>
        <div><label className={lbl}>Invoice No (optional)</label><input value={f.invoiceNo} onChange={(e) => set("invoiceNo", e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Sale Date</label><input type="date" value={f.saleDate} onChange={(e) => set("saleDate", e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Expiry Date (override)</label><input type="date" value={f.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className={inp} /></div>
        <div className="lg:col-span-3"><label className={lbl}>Remarks</label><input value={f.remarks} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
      </div>
      {selected && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary-subtle/20 px-4 py-2.5 text-sm">
          <span className="text-muted">Amount to collect</span><span className="text-lg font-bold text-foreground">{fm(selected.faceValue)}</span>
        </div>
      )}
      <div className="mt-4 flex items-center gap-3"><Button onClick={sell} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Processing…" : "Complete Sale"}</Button><span className="text-2xs text-subtle">Posts Dr Cash/Bank / Cr Gift Voucher Liability and (per config) auto-activates the voucher.</span></div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) { return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>; }
