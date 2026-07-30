"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, Plus, Trash2, Settings2, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { financeDocNo, finFlag } from "@/lib/finance/financeConfig";
import { financeNotesFor } from "@/lib/finance/financeData";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";

const inr = (n: number) => formatMoney(n);
const BANKS = ["HDFC - Current ••4521", "ICICI - Current ••8890", "SBI - OD ••1122"];
const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1];
interface Cheque { no: string; bank: string; date: string; amount: number }

export function CashDepositForm() {
  const router = useRouter();
  const notes = financeNotesFor("deposit");
  const [bank, setBank] = useState("");
  const [date, setDate] = useState("");
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [card, setCard] = useState(0);
  const [upi, setUpi] = useState(0);
  const [saved, setSaved] = useState(false);

  const cashTotal = useMemo(() => DENOMS.reduce((s, d) => s + d * (counts[d] || 0), 0), [counts]);
  const chequeTotal = useMemo(() => cheques.reduce((s, c) => s + (Number(c.amount) || 0), 0), [cheques]);
  const otherTotal = (Number(card) || 0) + (Number(upi) || 0);
  const total = cashTotal + chequeTotal + otherTotal;
  const canSave = !!bank && total > 0;

  const setCount = (d: number, v: number) => setCounts((c) => ({ ...c, [d]: Math.max(0, v) }));
  const addCheque = () => setCheques((c) => [...c, { no: "", bank: "", date: "", amount: 0 }]);
  const setCheque = (i: number, patch: Partial<Cheque>) => setCheques((c) => c.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removeCheque = (i: number) => setCheques((c) => c.filter((_, idx) => idx !== i));

  function save() { if (!canSave) return; setSaved(true); window.setTimeout(() => router.push("/finance/deposit"), 1200); }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance" className="hover:text-foreground">Finance</Link><span className="text-subtle">/</span><Link href="/finance/deposit" className="hover:text-foreground">Cash Deposit</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Banknote className="h-5 w-5 text-primary" /> New Cash Deposit</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/finance/deposit"><Button variant="ghost" size="md">Cancel</Button></Link>
          <Button variant="outline" size="md" onClick={save} disabled={!canSave}><Save className="h-4 w-4" /> Save Draft</Button>
          <Button size="md" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> Deposit to Bank</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Finance policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Cash denomination */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-foreground">Cash Collection (denomination count)</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {DENOMS.map((d) => (
                <div key={d} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2.5">
                  <span className="w-12 text-sm font-semibold text-foreground">₹{d}</span>
                  <span className="text-subtle">×</span>
                  <input type="number" value={counts[d] || ""} onChange={(e) => setCount(d, Number(e.target.value))} placeholder="0" className="h-8 w-14 rounded border border-border bg-surface-2 px-2 text-center text-sm focus:border-primary focus:outline-none" />
                  <span className="ml-auto text-2xs font-medium text-muted">{inr(d * (counts[d] || 0))}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm font-bold text-foreground"><span>Cash Total</span><span>{inr(cashTotal)}</span></div>
          </div>

          {/* Cheques */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-foreground">Cheques / DDs</p><button onClick={addCheque} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Plus className="h-3.5 w-3.5" /> Add cheque</button></div>
            {cheques.length === 0 ? <p className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-4 text-center text-sm text-muted">No cheques added.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="py-2">Cheque No.</th><th className="py-2">Drawee Bank</th><th className="py-2">Date</th><th className="py-2 text-right">Amount</th><th></th></tr></thead>
                  <tbody>
                    {cheques.map((c, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2 pr-2"><input value={c.no} onChange={(e) => setCheque(i, { no: e.target.value })} placeholder="000123" className="h-8 w-full rounded border border-border bg-surface-2 px-2 text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="py-2 pr-2"><input value={c.bank} onChange={(e) => setCheque(i, { bank: e.target.value })} placeholder="Bank" className="h-8 w-full rounded border border-border bg-surface-2 px-2 text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="py-2 pr-2"><input type="date" value={c.date} onChange={(e) => setCheque(i, { date: e.target.value })} className="h-8 w-full rounded border border-border bg-surface-2 px-2 text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="py-2"><input type="number" value={c.amount || ""} onChange={(e) => setCheque(i, { amount: Number(e.target.value) })} placeholder="0" className="h-8 w-28 rounded border border-border bg-surface-2 px-2 text-right text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="py-2 text-right"><button onClick={() => removeCheque(i)} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-sm font-semibold text-foreground"><span className="text-muted">Cheque Total</span><span>{inr(chequeTotal)}</span></div>
          </div>

          {/* Other settlements */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-foreground">Other Collections (card / UPI settlement)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Card Settlement (₹)</label><input type="number" value={card || ""} onChange={(e) => setCard(Number(e.target.value))} placeholder="0" className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">UPI Settlement (₹)</label><input type="number" value={upi || ""} onChange={(e) => setUpi(Number(e.target.value))} placeholder="0" className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Deposit Slip</p>
            <div className="space-y-3">
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Slip No.</label><input readOnly value={financeDocNo("DEP", 1)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 font-mono text-sm text-primary" /></div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Deposit To Bank <span className="text-danger">*</span></label><select value={bank} onChange={(e) => setBank(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none"><option value="">Select bank…</option>{BANKS.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Deposit Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Summary</p>
            <div className="space-y-1.5 text-sm">
              <Row k="Cash" v={inr(cashTotal)} />
              <Row k="Cheques" v={inr(chequeTotal)} />
              <Row k="Card + UPI" v={inr(otherTotal)} />
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-bold text-foreground"><span>Total Deposit</span><span>{inr(total)}</span></div>
            </div>
            {finFlag("autoPostBank") && <p className="mt-2 rounded bg-info-subtle p-2 text-2xs text-info">Auto-journal: Dr Bank / Cr Cash (+ Cheques-in-Hand for cheques).</p>}
            <Button size="lg" className="mt-3 w-full" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> Deposit to Bank</Button>
            {!canSave && <p className="mt-2 text-center text-2xs font-medium text-danger">Select a bank and add at least one collection.</p>}
          </div>
        </aside>
      </div>

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">Deposit of {inr(total)} recorded</p><p className="text-2xs text-muted">Posted to bank. Redirecting…</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-semibold text-foreground">{v}</span></div>;
}
