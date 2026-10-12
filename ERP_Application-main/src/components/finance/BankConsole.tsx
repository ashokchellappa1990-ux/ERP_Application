"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Landmark, RefreshCw, CheckCircle2, Ban, XCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

interface BalRow { bankId: number; bankName: string; account: string; opening: number; credit: number; debit: number; closing: number; unclearedIn: number; unclearedOut: number; bookBalance: number; pendingCount: number }
interface BookRow { id: number; date: string; direction: string; amount: number; mode: string | null; reference: string | null; sourceType: string; sourceNo: string | null; partyName: string | null; clearingStatus: string; clearingDate: string | null; running: number }
interface Book { opening: number; clearedBalance: number; unclearedIn: number; unclearedOut: number; bookBalance: number; rows: BookRow[] }
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const CLR_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { credited: "success", pending: "warning", bounced: "danger", cancelled: "neutral" };
const CLR_LABEL: Record<string, string> = { credited: "Credited", pending: "Not Cleared", bounced: "Bounced", cancelled: "Cancelled" };

export function BankConsole() {
  const fmt = useFmt();
  const money = (n: number) => fmt.money(n || 0);
  const [period, setPeriod] = useState(thisMonth);
  const [banks, setBanks] = useState<BalRow[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [dir, setDir] = useState<"" | "in" | "out">("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [edit, setEdit] = useState<number | null>(null);
  const [eDate, setEDate] = useState(today);
  const [eNote, setENote] = useState("");
  const [busy, setBusy] = useState(false);

  const loadBalances = useCallback(() => { setBanks(null); fetch(`/api/finance/bank/balances?period=${period}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { setBanks(j.banks); setSel((s) => s ?? j.banks[0]?.bankId ?? null); } }); }, [period]);
  useEffect(() => { loadBalances(); }, [loadBalances]);
  const loadBook = useCallback(() => {
    if (sel == null) return; setBook(null); setEdit(null);
    const p = new URLSearchParams({ bankId: String(sel) }); if (dir) p.set("direction", dir); if (from) p.set("from", from); if (to) p.set("to", to);
    fetch(`/api/finance/bank/book?${p}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setBook(j); });
  }, [sel, dir, from, to]);
  useEffect(() => { loadBook(); }, [loadBook]);

  const openEdit = (id: number) => { setEdit(edit === id ? null : id); setEDate(today()); setENote(""); };
  const apply = async (id: number, status: "credited" | "bounced" | "cancelled") => {
    setBusy(true);
    await fetch("/api/finance/bank/clear", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id], status, clearingDate: eDate, note: eNote }) });
    setBusy(false); setEdit(null); loadBook(); loadBalances();
  };

  const cur = banks?.find((b) => b.bankId === sel);
  const bt = (banks ?? []).reduce((a, b) => ({ opening: a.opening + b.opening, credit: a.credit + b.credit, debit: a.debit + b.debit, closing: a.closing + b.closing, ui: a.ui + b.unclearedIn, uo: a.uo + b.unclearedOut }), { opening: 0, credit: 0, debit: 0, closing: 0, ui: 0, uo: 0 });
  const totIn = (book?.rows ?? []).filter((r) => r.direction === "in").reduce((s, r) => s + r.amount, 0);
  const totOut = (book?.rows ?? []).filter((r) => r.direction === "out").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white"><Landmark className="h-6 w-6" /></span><div><h1 className="text-lg font-bold text-foreground">Bank Reconciliation</h1><p className="text-xs text-muted">Per-account monthly cash-book, driven by clearing date. Clear cheque / transfer / ECS as Credited, Bounced or Cancelled.</p></div></div>
        <div className="flex items-center gap-2"><label className="flex items-center gap-1.5 text-2xs font-semibold text-muted">Month<input type="month" value={period} onChange={(e) => setPeriod(e.target.value || thisMonth())} className={fInp} /></label><Button size="sm" variant="outline" onClick={loadBalances}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button></div>
      </div>

      {/* Balances per bank account — monthly opening / credit / debit / closing */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-primary-subtle/40 px-4 py-2 text-sm font-bold text-primary">Bank Accounts — {period}</div>
        {!banks ? <div className="p-8"><AppLoader label="Loading…" size="sm" /></div> : banks.length === 0 ? <p className="p-8 text-center text-sm text-muted">No bank accounts configured in Business/Branch Setup.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-left text-2xs font-semibold uppercase tracking-wide text-muted"><th className="px-3 py-2">Bank</th><th className="px-3 py-2">Account No.</th><th className="px-3 py-2 text-right">Opening</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Closing</th><th className="px-3 py-2 text-right">Uncleared In</th><th className="px-3 py-2 text-right">Uncleared Out</th><th className="px-3 py-2 text-center">Not Cleared</th></tr></thead>
            <tbody>{banks.map((b) => (
              <tr key={b.bankId} onClick={() => setSel(b.bankId)} className={cn("cursor-pointer border-b border-border/40 last:border-0", sel === b.bankId ? "bg-primary-subtle/40" : "hover:bg-surface-2/30")}>
                <td className="px-3 py-2 font-medium text-foreground">{b.bankName}</td><td className="px-3 py-2 tabular-nums text-muted">{b.account || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">{money(b.opening)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-success">{money(b.credit)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-danger">{money(b.debit)}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-foreground">{money(b.closing)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-warning">{b.unclearedIn ? money(b.unclearedIn) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-warning">{b.unclearedOut ? money(b.unclearedOut) : "—"}</td>
                <td className="px-3 py-2 text-center">{b.pendingCount > 0 ? <Badge tone="warning">{b.pendingCount}</Badge> : <span className="text-2xs text-subtle">0</span>}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr className="border-t-2 border-border bg-surface-2/60 text-2xs font-bold uppercase text-foreground"><td className="px-3 py-2" colSpan={2}>Total ({banks.length} account{banks.length > 1 ? "s" : ""})</td><td className="px-3 py-2 text-right tabular-nums">{money(bt.opening)}</td><td className="px-3 py-2 text-right tabular-nums text-success">{money(bt.credit)}</td><td className="px-3 py-2 text-right tabular-nums text-danger">{money(bt.debit)}</td><td className="px-3 py-2 text-right tabular-nums">{money(bt.closing)}</td><td className="px-3 py-2 text-right tabular-nums text-warning">{money(bt.ui)}</td><td className="px-3 py-2 text-right tabular-nums text-warning">{money(bt.uo)}</td><td /></tr></tfoot>
          </table></div>
        )}
      </div>

      {/* Ledger + clearing for the selected account — fixed header/footer, scrollable body */}
      {sel != null && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary-subtle/40 px-4 py-2">
            <h3 className="text-sm font-bold text-primary">{cur?.bankName} · {cur?.account}{book ? <span className="ml-2 font-normal text-muted">Cleared {money(book.clearedBalance)} · Book {money(book.bookBalance)}</span> : null}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">{([["", "All"], ["in", "Receipts"], ["out", "Payments"]] as const).map(([v, l]) => <button key={v} onClick={() => setDir(v)} className={cn("rounded px-2 py-0.5 text-2xs font-semibold", dir === v ? "bg-card text-primary shadow-sm" : "text-muted")}>{l}</button>)}</div>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From" className={fInp} />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To" className={fInp} />
              {(from || to || dir) && <button onClick={() => { setFrom(""); setTo(""); setDir(""); }} className="text-2xs font-semibold text-primary hover:underline">Clear</button>}
            </div>
          </div>

          {!book ? <div className="p-8"><AppLoader label="Loading ledger…" size="sm" /></div> : book.rows.length === 0 ? <p className="p-8 text-center text-sm text-muted">No bank movements for this account / filter.</p> : (
            <div className="max-h-[56vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10"><tr className="bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wide text-muted shadow-sm"><th className="px-3 py-2">Txn Date</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Party</th><th className="px-3 py-2">Instrument</th><th className="px-3 py-2 text-right">Receipt</th><th className="px-3 py-2 text-right">Payment</th><th className="px-3 py-2 text-center">Clearing</th><th className="px-3 py-2">Cleared On</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
                <tbody>{book.rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-b border-border/40">
                      <td className="px-3 py-1.5 tabular-nums text-muted">{r.date}</td>
                      <td className="px-3 py-1.5"><div className="font-medium text-foreground">{r.sourceNo || r.sourceType}</div><div className="text-2xs text-subtle">{r.sourceType}</div></td>
                      <td className="px-3 py-1.5 text-muted">{r.partyName || "—"}</td>
                      <td className="px-3 py-1.5 text-2xs text-muted">{r.mode}{r.reference ? ` · ${r.reference}` : ""}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-success">{r.direction === "in" ? money(r.amount) : ""}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-danger">{r.direction === "out" ? money(r.amount) : ""}</td>
                      <td className="px-3 py-1.5 text-center"><Badge tone={CLR_TONE[r.clearingStatus] ?? "neutral"}>{CLR_LABEL[r.clearingStatus] ?? r.clearingStatus}</Badge></td>
                      <td className="px-3 py-1.5 tabular-nums text-muted">{r.clearingDate || "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{r.clearingStatus === "credited" ? money(r.running) : "—"}</td>
                      <td className="px-3 py-1.5 text-right">{r.clearingStatus === "pending" ? <button onClick={() => openEdit(r.id)} className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-2xs font-semibold text-primary hover:bg-primary/10">Clear <ChevronDown className={cn("h-3 w-3 transition", edit === r.id && "rotate-180")} /></button> : <span className="text-2xs text-subtle">—</span>}</td>
                    </tr>
                    {edit === r.id && (
                      <tr className="border-b border-border/40 bg-warning/5">
                        <td colSpan={10} className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-2xs font-semibold text-muted">Clearing date</span>
                            <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className={fInp} />
                            <input value={eNote} onChange={(e) => setENote(e.target.value)} placeholder="Note (optional)" className={cn(fInp, "min-w-[14rem] flex-1")} />
                            <Button size="sm" disabled={busy} onClick={() => apply(r.id, "credited")}><CheckCircle2 className="h-3.5 w-3.5" /> Credited</Button>
                            <Button size="sm" variant="danger" disabled={busy} onClick={() => apply(r.id, "bounced")}><Ban className="h-3.5 w-3.5" /> Bounced</Button>
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => apply(r.id, "cancelled")}><XCircle className="h-3.5 w-3.5" /> Cancelled</Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}</tbody>
                <tfoot className="sticky bottom-0 z-10"><tr className="bg-surface-2 text-2xs font-bold uppercase text-foreground shadow-[0_-1px_0_var(--color-border)]"><td className="px-3 py-2" colSpan={4}>Total · {book.rows.length} txn</td><td className="px-3 py-2 text-right tabular-nums text-success">{money(totIn)}</td><td className="px-3 py-2 text-right tabular-nums text-danger">{money(totOut)}</td><td colSpan={2} /><td className="px-3 py-2 text-right tabular-nums">{money(book.clearedBalance)}</td><td /></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
const fInp = "h-8 rounded-md border border-border-strong bg-surface px-2 text-2xs focus:border-primary focus:outline-none";
