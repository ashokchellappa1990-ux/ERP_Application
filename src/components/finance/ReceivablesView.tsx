"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HandCoins, Search, Clock, CircleDollarSign, Wallet, X, CheckCircle2, ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";
import type { ReceivableRow as Row, ReceivableStats as Stats, PartyGroup } from "@/lib/contracts/finance";

const EMPTY: Stats = { open: 0, outstanding: 0, overdue: 0, billed: 0, collected: 0, aging: { notDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 } };
const TONE: Record<string, "warning" | "info" | "success"> = { Credit: "warning", Partial: "info", Paid: "success" };
const FILTERS = ["All", "Credit", "Partial", "Paid"];
const fmt = (n: number) => (n >= 100000 ? `${formatMoney(n / 100000)}L` : formatMoney(n));
const inr = (n: number) => formatMoney(n || 0);
const MODES = ["Bank Transfer", "Cash", "UPI", "Cheque", "Card"];
const AGE_COLS: [keyof PartyGroup["aging"], string][] = [["notDue", "Not Due"], ["d1_30", "1–30"], ["d31_60", "31–60"], ["d61_90", "61–90"], ["d90", "90+"]];
function Frag({ children }: { children: React.ReactNode }) { return <>{children}</>; }

export function ReceivablesView() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [view, setView] = useState<"customer" | "invoice" | "aging">("customer");
  const [rows, setRows] = useState<Row[]>([]);
  const [groups, setGroups] = useState<PartyGroup[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collect, setCollect] = useState<Row | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/receivables?${new URLSearchParams({ q: query, status: filter })}`, { cache: "no-store", signal });
      const j = await res.json().catch(() => ({}));
      if (j.ok) { setRows(j.rows); setGroups(j.groups ?? []); setStats(j.stats); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [query, filter]);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => load(ctrl.signal), 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [load]);

  const shownGroups = useMemo(() => (query ? groups.filter((g) => g.party.toLowerCase().includes(query.toLowerCase())) : groups), [groups, query]);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Finance</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Receivables</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><HandCoins className="h-5 w-5 text-primary" /> Customer Receivables</h1>
        <p className="mt-0.5 text-sm text-muted">Owed by customers — grouped by customer; drill to invoice-wise details or view aging. Collect below or from <Link href="/sales/collections" className="font-medium text-primary hover:underline">Customer Collection</Link>.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={CircleDollarSign} label="Outstanding" value={fmt(stats.outstanding)} tone="warning" />
        <Stat icon={Clock} label="Overdue" value={fmt(stats.overdue)} tone="danger" />
        <Stat icon={Users} label="Customers" value={String(groups.length)} tone="primary" />
        <Stat icon={Wallet} label="Collected" value={fmt(stats.collected)} tone="success" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
            {([["customer", "By Customer"], ["invoice", "By Invoice"], ["aging", "Aging"]] as const).map(([v, l]) => <button key={v} onClick={() => setView(v)} className={cn("px-3.5 py-1.5 font-semibold transition", view === v ? "bg-brand-gradient text-white" : "bg-surface text-muted hover:text-foreground")}>{l}</button>)}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative min-w-[180px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer / invoice…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" /></div>
            {view === "invoice" && <div className="flex items-center gap-1.5">{FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-2.5 py-1.5 text-2xs font-semibold transition", filter === f ? "bg-brand-gradient text-white" : "border border-border bg-surface text-muted hover:text-foreground")}>{f}</button>)}</div>}
          </div>
        </div>

        {loading && rows.length === 0 && groups.length === 0 ? <div className="p-8"><AppLoader label="Loading receivables…" size="sm" /></div> : (
          <div className="overflow-x-auto">
            {/* BY CUSTOMER */}
            {view === "customer" && (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-center">Invoices</th><th className="px-4 py-3">Oldest Due</th><th className="px-4 py-3 text-right">Billed</th><th className="px-4 py-3 text-right">Collected</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-right">Overdue</th></tr></thead>
                <tbody>
                  {shownGroups.map((g) => {
                    const open = expanded === g.party;
                    const invoices = rows.filter((r) => r.customer === g.party);
                    return (
                      <Frag key={g.party}>
                        <tr className="cursor-pointer border-b border-border hover:bg-primary-subtle/20" onClick={() => setExpanded(open ? null : g.party)}>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><ChevronRight className={cn("h-4 w-4 text-muted transition", open && "rotate-90")} /><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-subtle text-primary"><Users className="h-4 w-4" /></span><div><div className="font-semibold text-foreground">{g.party}</div>{g.gstin && <div className="font-mono text-2xs text-subtle">{g.gstin}</div>}</div></div></td>
                          <td className="px-4 py-3 text-center text-muted">{g.count}</td>
                          <td className="px-4 py-3 text-2xs text-muted">{g.oldestDue ?? "—"}</td>
                          <td className="px-4 py-3 text-right text-muted">{fmt(g.billed)}</td>
                          <td className="px-4 py-3 text-right text-muted">{fmt(g.paid)}</td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(g.balance)}</td>
                          <td className={cn("px-4 py-3 text-right font-semibold", g.overdue > 0 ? "text-danger" : "text-subtle")}>{g.overdue > 0 ? fmt(g.overdue) : "—"}</td>
                        </tr>
                        {open && <tr><td colSpan={7} className="bg-surface-2/40 px-4 py-2">
                          <table className="w-full text-2xs"><thead><tr className="text-left uppercase text-subtle"><th className="py-1.5">Invoice</th><th className="py-1.5">Date / Due</th><th className="py-1.5 text-right">Total</th><th className="py-1.5 text-right">Collected</th><th className="py-1.5 text-right">Balance</th><th className="py-1.5 text-center">Status</th><th className="py-1.5" /></tr></thead>
                          <tbody>{invoices.map((p) => (
                            <tr key={p.id} className="border-t border-border/60"><td className="py-1.5"><Link href={p.channel === "B2B" ? `/sales/invoice/${p.id}` : "/sales/history"} className="font-mono text-primary hover:underline">{p.refNo}</Link> <span className="text-subtle">{p.channel}</span></td><td className="py-1.5"><span className="text-foreground">{p.docDate || "—"}</span> · <span className={cn(p.overdue ? "font-semibold text-danger" : "text-subtle")}>due {p.dueDate || "—"}</span></td><td className="py-1.5 text-right text-muted">{inr(p.totalAmount)}</td><td className="py-1.5 text-right text-muted">{inr(p.paidAmount)}</td><td className="py-1.5 text-right font-semibold text-foreground">{inr(p.balanceAmount)}</td><td className="py-1.5 text-center"><Badge tone={p.overdue && p.status !== "Paid" ? "danger" : TONE[p.status] ?? "neutral"}>{p.overdue && p.status !== "Paid" ? "Overdue" : p.status}</Badge></td><td className="py-1.5 text-right">{p.balanceAmount > 0 && <button onClick={() => setCollect(p)} className="rounded border border-primary/30 bg-primary-subtle px-2 py-0.5 font-semibold text-primary hover:bg-primary hover:text-white">Collect</button>}</td></tr>
                          ))}{invoices.length === 0 && <tr><td colSpan={7} className="py-2 text-subtle">No invoice rows in the current filter.</td></tr>}</tbody></table>
                        </td></tr>}
                      </Frag>
                    );
                  })}
                  {!loading && shownGroups.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No outstanding receivables.</td></tr>}
                </tbody>
              </table>
            )}

            {/* BY INVOICE */}
            {view === "invoice" && (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Date / Due</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Collected</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3" /></tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                      <td className="px-4 py-3"><div className="font-medium text-foreground">{p.customer}</div>{p.gstin && <div className="font-mono text-2xs text-subtle">{p.gstin}</div>}</td>
                      <td className="px-4 py-3"><Link href={p.channel === "B2B" ? `/sales/invoice/${p.id}` : "/sales/history"} className="font-mono text-2xs text-primary hover:underline">{p.refNo}</Link><div className="text-2xs text-subtle">{p.channel}</div></td>
                      <td className="px-4 py-3 text-2xs"><div className="text-foreground">{p.docDate || "—"}</div><div className={cn(p.overdue ? "font-semibold text-danger" : "text-subtle")}>due {p.dueDate || "—"}</div></td>
                      <td className="px-4 py-3 text-right text-muted">{fmt(p.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-muted">{fmt(p.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(p.balanceAmount)}</td>
                      <td className="px-4 py-3 text-center"><Badge tone={p.overdue && p.status !== "Paid" ? "danger" : TONE[p.status] ?? "neutral"}>{p.overdue && p.status !== "Paid" ? "Overdue" : p.status}</Badge></td>
                      <td className="px-4 py-3 text-right">{p.balanceAmount > 0 && <Button size="sm" variant="outline" onClick={() => setCollect(p)}><Wallet className="h-3.5 w-3.5" /> Collect</Button>}</td>
                    </tr>
                  ))}
                  {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">No outstanding receivables.</td></tr>}
                </tbody>
              </table>
            )}

            {/* AGING */}
            {view === "aging" && (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Customer</th>{AGE_COLS.map(([, l]) => <th key={l} className="px-4 py-3 text-right">{l}</th>)}<th className="px-4 py-3 text-right">Total</th></tr></thead>
                <tbody>
                  {shownGroups.map((g) => <tr key={g.party} className="border-b border-border last:border-0 hover:bg-primary-subtle/20"><td className="px-4 py-3 font-medium text-foreground">{g.party}</td>{AGE_COLS.map(([k]) => <td key={k} className={cn("px-4 py-3 text-right", k === "d90" && g.aging[k] > 0 ? "font-semibold text-danger" : g.aging[k] > 0 ? "text-foreground" : "text-subtle")}>{g.aging[k] > 0 ? inr(g.aging[k]) : "—"}</td>)}<td className="px-4 py-3 text-right font-bold text-foreground">{inr(g.balance)}</td></tr>)}
                  {shownGroups.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No outstanding receivables.</td></tr>}
                </tbody>
                {shownGroups.length > 0 && <tfoot><tr className="border-t-2 border-border bg-surface-2 font-bold text-foreground"><td className="px-4 py-3">Total</td>{AGE_COLS.map(([k]) => <td key={k} className="px-4 py-3 text-right">{inr(stats.aging[k])}</td>)}<td className="px-4 py-3 text-right">{inr(stats.outstanding)}</td></tr></tfoot>}
              </table>
            )}
          </div>
        )}
      </div>

      {collect && <CollectModal row={collect} onClose={() => setCollect(null)} onDone={() => { setCollect(null); load(); }} />}
    </div>
  );
}

function CollectModal({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(row.balanceAmount));
  const [mode, setMode] = useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const amt = Number(amount) || 0;

  async function submit() {
    setError("");
    if (amt <= 0 || amt > row.balanceAmount + 0.01) { setError(`Enter an amount between ₹1 and ${inr(row.balanceAmount)}.`); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/finance/receivables/collect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleId: row.id, amount: amt, mode, reference, date }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.message || "Could not record the collection."); setBusy(false); return; }
      onDone();
    } catch { setError("Network error."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Wallet className="h-4 w-4 text-primary" /> Record Collection</h3><button onClick={onClose} className="text-muted hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-xs"><div className="font-semibold text-foreground">{row.customer} · <span className="font-mono text-primary">{row.refNo}</span></div><div className="text-2xs text-muted">Outstanding balance: <strong className="text-danger">{inr(row.balanceAmount)}</strong></div></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-2xs font-semibold text-muted">Amount *</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} /></div>
          <div><label className="mb-1 block text-2xs font-semibold text-muted">Mode</label><select value={mode} onChange={(e) => setMode(e.target.value)} className={inp}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div><label className="mb-1 block text-2xs font-semibold text-muted">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          <div><label className="mb-1 block text-2xs font-semibold text-muted">Reference</label><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no" className={inp} /></div>
        </div>
        <div className="mt-2 flex gap-1.5">{[0.5, 1].map((f) => <button key={f} onClick={() => setAmount(String(+(row.balanceAmount * f).toFixed(2)))} className="rounded-md border border-border bg-surface px-2 py-1 text-2xs font-semibold text-muted hover:border-primary hover:text-primary">{f === 1 ? "Full" : "50%"}</button>)}</div>
        {error && <p className="mt-2 rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button size="md" onClick={submit} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Saving…" : `Collect ${inr(amt)}`}</Button></div>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const TONES = { primary: "bg-primary text-white", warning: "bg-warning text-white", danger: "bg-danger text-white", success: "bg-success text-white" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Wallet; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
