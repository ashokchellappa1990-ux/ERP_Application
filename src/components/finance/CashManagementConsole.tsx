"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet, ArrowRightLeft, HandCoins, Plus, Eye, X, Search, Banknote, Vault, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { RECEIPT_MODES, type BankRef, type CashEntryRow, type CashEntryDetail, type CashKpis } from "@/lib/contracts/cashManagement";
import type { MovementRow } from "@/lib/contracts/eodTransfer";

const API = "/api/finance/cash";
const FT_API = "/api/operations/day-close/fund-transfer";
const thisMonth = () => new Date().toISOString().slice(0, 7);

interface DisplayRow {
  key: string; kind: "FUND_TRANSFER" | "MISC_RECEIPT"; docNo: string; date: string; particulars: string;
  account: string; mode: string; amount: number; createdByName: string;
  source: "cash" | "move"; cashId?: number; move?: MovementRow;
}

export function CashManagementConsole({ initialAdd }: { initialAdd?: "MISC_RECEIPT" }) {
  const toast = useToast();
  const router = useRouter();
  const fmt = useFmt();
  const inr = (n: number) => fmt.money(n || 0);

  const [cashRows, setCashRows] = useState<CashEntryRow[]>([]);
  const [moves, setMoves] = useState<MovementRow[]>([]);
  const [safeBalance, setSafeBalance] = useState(0);
  const [banks, setBanks] = useState<BankRef[]>([]);
  const [kpis, setKpis] = useState<CashKpis | null>(null);
  const [filter, setFilter] = useState<"All" | "FUND_TRANSFER" | "MISC_RECEIPT">("All");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [addReceipt, setAddReceipt] = useState(!!initialAdd);
  const [view, setView] = useState<CashEntryDetail | null>(null);
  const [moveView, setMoveView] = useState<MovementRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ q, period: thisMonth() });
    const [cashJ, ftJ] = await Promise.all([
      fetch(`${API}?${params}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch(FT_API, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]);
    if (cashJ.ok) { setCashRows(cashJ.rows); setBanks(cashJ.banks); setKpis(cashJ.kpis); }
    if (ftJ.ok) { setMoves(ftJ.movements ?? []); setSafeBalance(ftJ.safeBalance ?? 0); }
    else setMoves([]);
    setLoading(false);
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const openView = async (id: number) => {
    const j = await fetch(`${API}/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setView(j.data); else toast.error("Could not load the entry.");
  };

  const rows = useMemo<DisplayRow[]>(() => {
    const ql = q.trim().toLowerCase();
    const cash: DisplayRow[] = cashRows.map((r) => ({
      key: `c-${r.id}`, kind: r.kind, docNo: r.docNo, date: r.date, particulars: r.particulars, account: r.account,
      mode: r.mode, amount: r.amount, createdByName: r.createdByName, source: "cash" as const, cashId: r.id,
    }));
    const mv: DisplayRow[] = moves.map((m) => ({
      key: `m-${m.id}`, kind: "FUND_TRANSFER" as const, docNo: m.id, date: (m.at || "").slice(0, 10), particulars: m.label,
      account: m.detail, mode: "Transfer", amount: m.amount, createdByName: "", source: "move" as const, move: m,
    })).filter((r) => !ql || [r.particulars, r.account, r.docNo].some((s) => s.toLowerCase().includes(ql)));
    let all = [...cash, ...mv];
    if (filter !== "All") all = all.filter((r) => r.kind === filter);
    return all.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [cashRows, moves, filter, q]);

  const transferCount = moves.length;
  const transferTotal = moves.reduce((s, m) => s + (m.amount || 0), 0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const paged = rows.slice((current - 1) * pageSize, current * pageSize);

  const FILTERS: { val: typeof filter; label: string }[] = [
    { val: "All", label: "All" }, { val: "FUND_TRANSFER", label: "Fund Transfers" }, { val: "MISC_RECEIPT", label: "Misc Receipts" },
  ];

  return (
    <div className="space-y-6">
      {/* Header + primary action (common design) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance" className="hover:text-foreground">Finance</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Fund Management</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wallet className="h-5 w-5 text-primary" /> Fund Management</h1>
          <p className="mt-0.5 text-sm text-muted">Fund transfers across bank, safe locker &amp; terminals — with automatic GL posting.</p>
        </div>
        <Button size="md" onClick={() => router.push("/finance/cash/fund-transfer")}><Plus className="h-4 w-4" /> Fund Transfer</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Safe Balance" value={inr(safeBalance)} tone="primary" icon={<Vault className="h-3.5 w-3.5" />} />
        <Kpi label="Cash Receipts (MTD)" value={inr(kpis?.cashIn ?? 0)} tone="success" />
        <Kpi label="Bank Receipts (MTD)" value={inr(kpis?.bankIn ?? 0)} tone="success" />
        <Kpi label="Receipts (MTD)" value={String(kpis?.receiptCount ?? 0)} tone="accent" />
        <Kpi label="Recent Transfers" value={String(transferCount)} tone="info" />
        <Kpi label="Transfer Value" value={inr(transferTotal)} tone="info" />
      </div>

      {/* List card (common design) */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => <button key={f.val} onClick={() => { setFilter(f.val); setPage(1); }} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", filter === f.val ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground")}>{f.label}</button>)}
            <button className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary" aria-label="More filters"><SlidersHorizontal className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Doc / Ref</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Particulars</th><th className="px-4 py-3">Account</th><th className="px-4 py-3 text-center">Mode</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">By</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">Loading…</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">No fund entries match your search.</td></tr>
              ) : paged.map((r) => (
                <tr key={r.key} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3 font-medium text-foreground">{r.docNo}</td>
                  <td className="px-4 py-3 text-muted">{r.date}</td>
                  <td className="px-4 py-3"><Badge tone={r.kind === "FUND_TRANSFER" ? "info" : "success"}>{r.kind === "FUND_TRANSFER" ? "Fund Transfer" : "Misc Receipt"}</Badge></td>
                  <td className="px-4 py-3 text-foreground">{r.particulars}</td>
                  <td className="px-4 py-3 text-muted">{r.account}</td>
                  <td className="px-4 py-3 text-center"><span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-muted">{r.mode}</span></td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{inr(r.amount)}</td>
                  <td className="px-4 py-3 text-muted">{r.createdByName || "—"}</td>
                  <td className="px-4 py-3"><div className="flex items-center justify-end"><button onClick={() => r.source === "cash" ? openView(r.cashId!) : setMoveView(r.move!)} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={current} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="entries" />
      </div>

      {addReceipt && <ReceiptModal banks={banks} onClose={() => setAddReceipt(false)} onSaved={() => { setAddReceipt(false); load(); }} />}
      {view && <ViewModal d={view} inr={inr} onClose={() => setView(null)} />}
      {moveView && <MoveViewModal m={moveView} inr={inr} onClose={() => setMoveView(null)} />}
    </div>
  );
}

function Kpi({ label, value, tone, icon }: { label: string; value: string; tone: string; icon?: React.ReactNode }) {
  const c: Record<string, string> = { success: "text-success", primary: "text-primary", info: "text-info", accent: "text-accent-foreground", warning: "text-warning" };
  return <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><p className="flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wider text-muted">{icon}{label}</p><p className={cn("mt-1 truncate text-[15px] font-bold", c[tone] || "text-foreground")}>{value}</p></div>;
}

// ------------------------------------------------------ miscellaneous receipt

function ReceiptModal({ banks, onClose, onSaved }: { banks: BankRef[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const fmt = useFmt();
  const [busy, setBusy] = useState(false);
  const [receivedIn, setReceivedIn] = useState<"Cash" | "Bank">("Cash");
  const [bankId, setBankId] = useState<string>(banks[0] ? String(banks[0].id) : "");
  const [bankName, setBankName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [payer, setPayer] = useState("");
  const [incomeHead, setIncomeHead] = useState("Miscellaneous Income");
  const [recMode, setRecMode] = useState<string>("Cash");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");

  const needsBank = receivedIn === "Bank";
  const chosenBank = banks.find((b) => String(b.id) === bankId);
  const bankLabel = chosenBank ? `${chosenBank.bankName}${chosenBank.account ? ` ••${chosenBank.account.slice(-4)}` : ""}` : bankName || "Bank";
  const amt = Number(amount) || 0;
  const glPreview = `Dr ${needsBank ? bankLabel : "Cash in Hand"} / Cr ${incomeHead || "Miscellaneous Income"}`;
  const canSave = amt > 0 && payer.trim().length > 0 && (!needsBank || !!chosenBank || !!bankName.trim());

  async function save() {
    if (!canSave) return;
    setBusy(true);
    const body = { kind: "MISC_RECEIPT", receivedIn, amount: amt, date, payer, incomeHead, mode: recMode, reference, remarks, ...(needsBank ? { bankId: chosenBank?.id, bankName: chosenBank?.bankName ?? bankName, bankAccount: chosenBank?.account } : {}) };
    const j = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (toast.result(j, "Receipt recorded.")) onSaved();
  }

  const inputCls = "h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none";
  const Field = ({ label, children, req }: { label: string; children: React.ReactNode; req?: boolean }) => (
    <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}{req && <span className="text-danger"> *</span>}</label>{children}</div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><HandCoins className="h-4 w-4 text-primary" /> New Miscellaneous Receipt</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <Field label="Received In" req>
            <div className="flex gap-2">
              {(["Cash", "Bank"] as const).map((t) => (
                <button key={t} onClick={() => setReceivedIn(t)} className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition", receivedIn === t ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:text-foreground")}>{t}</button>
              ))}
            </div>
          </Field>
          {needsBank && (
            <Field label="Bank Account" req>
              {banks.length ? (
                <select value={bankId} onChange={(e) => setBankId(e.target.value)} className={inputCls}><option value="">Select bank…</option>{banks.map((b) => <option key={b.id} value={b.id}>{b.bankName}{b.account ? ` ••${b.account.slice(-4)}` : ""}</option>)}</select>
              ) : <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" className={inputCls} />}
            </Field>
          )}
          <Field label="Received From" req><input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Payer / source" className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Income Head"><input value={incomeHead} onChange={(e) => setIncomeHead(e.target.value)} className={inputCls} /></Field>
            <Field label="Receipt Mode"><select value={recMode} onChange={(e) => setRecMode(e.target.value)} className={inputCls}>{RECEIPT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)" req><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls} /></Field>
            <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque / UTR / slip no." className={inputCls} /></Field>
          <Field label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inputCls, "h-auto py-2")} /></Field>
          <div className="rounded-lg border border-info/30 bg-info-subtle/40 px-3 py-2 text-xs text-info"><Banknote className="mr-1 inline h-3.5 w-3.5" /><b>GL posting:</b> {glPreview} — {fmt.money(amt)}</div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!canSave || busy} onClick={save}>{busy ? "Saving…" : "Record Receipt"}</Button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ view modals

function ViewModal({ d, inr, onClose }: { d: CashEntryDetail; inr: (n: number) => string; onClose: () => void }) {
  const KV = ({ k, v }: { k: string; v: string }) => v ? <div className="flex justify-between gap-3 py-1 text-sm"><span className="text-muted">{k}</span><span className="text-right font-medium text-foreground">{v}</span></div> : null;
  return (
    <Shell title={<><Eye className="h-4 w-4 text-primary" /> {d.docNo}<Badge tone={d.kind === "FUND_TRANSFER" ? "info" : "success"}>{d.kind === "FUND_TRANSFER" ? "Fund Transfer" : "Misc Receipt"}</Badge></>} onClose={onClose}>
      <div className="rounded-xl border border-border bg-surface-2/30 px-3 py-2">
        <KV k="Date" v={d.date} /><KV k="Amount" v={inr(d.amount)} />
        {d.kind === "FUND_TRANSFER" ? <><KV k="From" v={d.fromAccount} /><KV k="To" v={d.toAccount} /></> : <><KV k="Received In" v={d.receivedIn} /><KV k="Received From" v={d.payer} /><KV k="Income Head" v={d.incomeHead} /></>}
        <KV k="Mode" v={d.mode} /><KV k="Bank" v={d.bankName ? `${d.bankName}${d.bankAccount ? ` ••${d.bankAccount.slice(-4)}` : ""}` : ""} />
        <KV k="Reference" v={d.reference} /><KV k="Remarks" v={d.remarks} /><KV k="Recorded By" v={d.createdByName} />
      </div>
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><span className="h-3.5 w-1 rounded-full bg-primary" /> Account Posting {d.voucherNo ? `· ${d.voucherNo}` : ""}</p>
        {d.journal.length ? (
          <div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-left text-sm"><thead className="bg-surface-2/60 text-2xs uppercase tracking-wide text-subtle"><tr><th className="px-3 py-1.5">Account</th><th className="px-3 py-1.5 text-right">Debit</th><th className="px-3 py-1.5 text-right">Credit</th></tr></thead><tbody className="divide-y divide-border">{d.journal.map((l, i) => <tr key={i}><td className="px-3 py-1.5"><span className="font-mono text-2xs text-subtle">{l.code}</span> {l.account}</td><td className="px-3 py-1.5 text-right tabular-nums">{l.debit ? inr(l.debit) : ""}</td><td className="px-3 py-1.5 text-right tabular-nums">{l.credit ? inr(l.credit) : ""}</td></tr>)}</tbody></table></div>
        ) : <p className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-3 text-center text-xs text-muted">No GL voucher linked.</p>}
      </div>
    </Shell>
  );
}

function MoveViewModal({ m, inr, onClose }: { m: MovementRow; inr: (n: number) => string; onClose: () => void }) {
  const KV = ({ k, v }: { k: string; v: string }) => v ? <div className="flex justify-between gap-3 py-1 text-sm"><span className="text-muted">{k}</span><span className="text-right font-medium text-foreground">{v}</span></div> : null;
  return (
    <Shell title={<><ArrowRightLeft className="h-4 w-4 text-primary" /> {m.label}<Badge tone="info">Fund Transfer</Badge></>} onClose={onClose}>
      <div className="rounded-xl border border-border bg-surface-2/30 px-3 py-2">
        <KV k="Reference" v={m.id} /><KV k="Type" v={m.label} /><KV k="Detail" v={m.detail} /><KV k="Amount" v={inr(m.amount)} /><KV k="When" v={m.at ? new Date(m.at).toLocaleString() : ""} />
      </div>
      <p className="rounded-lg border border-info/30 bg-info-subtle/40 px-3 py-2 text-xs text-info">Recorded via the shared fund-transfer engine (safe locker / bank / terminal). Bank ↔ cash transfers post a contra GL voucher automatically.</p>
    </Shell>
  );
}

function Shell({ title, children, onClose }: { title: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h2 className="flex items-center gap-2 text-sm font-bold text-foreground">{title}</h2><button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end border-t border-border px-5 py-3"><Button size="sm" variant="outline" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}
