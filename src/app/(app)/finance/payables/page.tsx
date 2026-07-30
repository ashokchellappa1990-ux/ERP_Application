"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Search, FileText, Clock, CircleDollarSign, Wallet, ChevronRight, Building2, Banknote } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import type { PayableRow as Row, PayableStats as Stats, PartyGroup } from "@/lib/contracts/finance";

const EMPTY: Stats = { open: 0, outstanding: 0, billed: 0, paid: 0, overdue: 0, aging: { notDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 } };
const TONE: Record<string, "warning" | "info" | "success"> = { Open: "warning", Partial: "info", Paid: "success" };
const FILTERS = ["All", "Open", "Partial", "Paid"];
const fmt = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);
const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const AGE_COLS: [keyof PartyGroup["aging"], string][] = [["notDue", "Not Due"], ["d1_30", "1–30"], ["d31_60", "31–60"], ["d61_90", "61–90"], ["d90", "90+"]];

export default function PayablesPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [view, setView] = useState<"supplier" | "invoice" | "aging">("supplier");
  const [rows, setRows] = useState<Row[]>([]);
  const [groups, setGroups] = useState<PartyGroup[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/finance/payables?${new URLSearchParams({ q: query, status: filter })}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 401) { setNotAuthed(true); return; }
        const j = await res.json().catch(() => ({}));
        if (j.ok) { setNotAuthed(false); setRows(j.rows); setGroups(j.groups ?? []); setStats(j.stats); }
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, filter]);

  const shownGroups = useMemo(() => (query ? groups.filter((g) => g.party.toLowerCase().includes(query.toLowerCase())) : groups), [groups, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Finance</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Payables</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><AlertCircle className="h-5 w-5 text-primary" /> Supplier Payables</h1>
          <p className="mt-0.5 text-sm text-muted">Outstanding to suppliers — grouped by supplier; drill to invoice-wise details or view aging. Settle from <Link href="/purchase/payments" className="font-medium text-primary hover:underline">Supplier Payment</Link>.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={CircleDollarSign} label="Outstanding" value={fmt(stats.outstanding)} tone="warning" />
        <Stat icon={Clock} label="Overdue" value={fmt(stats.overdue)} tone="danger" />
        <Stat icon={Building2} label="Suppliers" value={String(groups.length)} tone="primary" />
        <Stat icon={Wallet} label="Paid to date" value={fmt(stats.paid)} tone="success" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
            {([["supplier", "By Supplier"], ["invoice", "By Invoice"], ["aging", "Aging"]] as const).map(([v, l]) => <button key={v} onClick={() => setView(v)} className={cn("px-3.5 py-1.5 font-semibold transition", view === v ? "bg-brand-gradient text-white" : "bg-surface text-muted hover:text-foreground")}>{l}</button>)}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative min-w-[180px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search supplier / reference…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" /></div>
            {view === "invoice" && <div className="flex items-center gap-1.5">{FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-2.5 py-1.5 text-2xs font-semibold transition", filter === f ? "bg-brand-gradient text-white" : "border border-border bg-surface text-muted hover:text-foreground")}>{f}</button>)}</div>}
          </div>
        </div>

        {loading && rows.length === 0 && groups.length === 0 ? <div className="p-8"><AppLoader label="Loading payables…" size="sm" /></div>
          : notAuthed ? <p className="px-4 py-10 text-center text-sm text-muted">Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</p>
          : (
          <div className="overflow-x-auto">
            {/* ---------------- BY SUPPLIER ---------------- */}
            {view === "supplier" && (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Supplier</th><th className="px-4 py-3 text-center">Bills</th><th className="px-4 py-3">Oldest Due</th><th className="px-4 py-3 text-right">Billed</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-right">Overdue</th><th className="px-4 py-3" /></tr></thead>
                <tbody>
                  {shownGroups.map((g) => {
                    const open = expanded === g.party;
                    const invoices = rows.filter((r) => (r.supplier || "—") === g.party);
                    return (
                      <FragmentRows key={g.party}>
                        <tr className="cursor-pointer border-b border-border hover:bg-primary-subtle/20" onClick={() => setExpanded(open ? null : g.party)}>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><ChevronRight className={cn("h-4 w-4 text-muted transition", open && "rotate-90")} /><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-subtle text-primary"><Building2 className="h-4 w-4" /></span><span className="font-semibold text-foreground">{g.party}</span></div></td>
                          <td className="px-4 py-3 text-center text-muted">{g.count}</td>
                          <td className="px-4 py-3 text-2xs text-muted">{g.oldestDue ?? "—"}</td>
                          <td className="px-4 py-3 text-right text-muted">{fmt(g.billed)}</td>
                          <td className="px-4 py-3 text-right text-muted">{fmt(g.paid)}</td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(g.balance)}</td>
                          <td className={cn("px-4 py-3 text-right font-semibold", g.overdue > 0 ? "text-danger" : "text-subtle")}>{g.overdue > 0 ? fmt(g.overdue) : "—"}</td>
                          <td className="px-4 py-3 text-right"><Link href="/purchase/payments" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary-subtle px-2.5 py-1 text-2xs font-semibold text-primary transition hover:bg-primary hover:text-white"><Banknote className="h-3.5 w-3.5" /> Pay</Link></td>
                        </tr>
                        {open && (
                          <tr><td colSpan={8} className="bg-surface-2/40 px-4 py-2">
                            <table className="w-full text-2xs"><thead><tr className="text-left uppercase text-subtle"><th className="py-1.5">Reference</th><th className="py-1.5">Doc / Due</th><th className="py-1.5 text-right">Total</th><th className="py-1.5 text-right">Paid</th><th className="py-1.5 text-right">Balance</th><th className="py-1.5 text-center">Status</th></tr></thead>
                            <tbody>{invoices.map((p) => (
                              <tr key={p.id} className="border-t border-border/60"><td className="py-1.5"><Link href={p.sourceType === "GRN" ? `/purchase/grn/${p.sourceId}` : "#"} className="font-mono text-primary hover:underline">{p.refNo}</Link> <span className="text-subtle">{p.sourceType}</span></td><td className="py-1.5"><span className="text-foreground">{p.docDate || "—"}</span> · <span className={cn(p.overdue ? "font-semibold text-danger" : "text-subtle")}>due {p.dueDate || "—"}</span></td><td className="py-1.5 text-right text-muted">{inr(p.totalAmount)}</td><td className="py-1.5 text-right text-muted">{inr(p.paidAmount)}</td><td className="py-1.5 text-right font-semibold text-foreground">{inr(p.balanceAmount)}</td><td className="py-1.5 text-center"><Badge tone={p.overdue && p.status !== "Paid" ? "danger" : TONE[p.status] ?? "neutral"}>{p.overdue && p.status !== "Paid" ? "Overdue" : p.status}</Badge></td></tr>
                            ))}{invoices.length === 0 && <tr><td colSpan={6} className="py-2 text-subtle">No invoice rows in the current filter.</td></tr>}</tbody></table>
                          </td></tr>
                        )}
                      </FragmentRows>
                    );
                  })}
                  {!loading && shownGroups.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">No outstanding payables.</td></tr>}
                </tbody>
              </table>
            )}

            {/* ---------------- BY INVOICE ---------------- */}
            {view === "invoice" && (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Doc / Due</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-center">Status</th></tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                      <td className="px-4 py-3 font-medium text-foreground">{p.supplier || "—"}</td>
                      <td className="px-4 py-3"><Link href={p.sourceType === "GRN" ? `/purchase/grn/${p.sourceId}` : "#"} className="font-mono text-2xs text-primary hover:underline">{p.refNo}</Link><div className="text-2xs text-subtle">{p.sourceType}</div></td>
                      <td className="px-4 py-3 text-2xs"><div className="text-foreground">{p.docDate || "—"}</div><div className={cn(p.overdue ? "font-semibold text-danger" : "text-subtle")}>due {p.dueDate || "—"}</div></td>
                      <td className="px-4 py-3 text-right text-muted">{fmt(p.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-muted">{fmt(p.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(p.balanceAmount)}</td>
                      <td className="px-4 py-3 text-center"><Badge tone={p.overdue && p.status !== "Paid" ? "danger" : TONE[p.status] ?? "neutral"}>{p.overdue && p.status !== "Paid" ? "Overdue" : p.status}</Badge></td>
                    </tr>
                  ))}
                  {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No outstanding payables.</td></tr>}
                </tbody>
              </table>
            )}

            {/* ---------------- AGING ---------------- */}
            {view === "aging" && (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Supplier</th>{AGE_COLS.map(([, l]) => <th key={l} className="px-4 py-3 text-right">{l}</th>)}<th className="px-4 py-3 text-right">Total</th></tr></thead>
                <tbody>
                  {shownGroups.map((g) => <tr key={g.party} className="border-b border-border last:border-0 hover:bg-primary-subtle/20"><td className="px-4 py-3 font-medium text-foreground">{g.party}</td>{AGE_COLS.map(([k]) => <td key={k} className={cn("px-4 py-3 text-right", k === "d90" && g.aging[k] > 0 ? "font-semibold text-danger" : g.aging[k] > 0 ? "text-foreground" : "text-subtle")}>{g.aging[k] > 0 ? inr(g.aging[k]) : "—"}</td>)}<td className="px-4 py-3 text-right font-bold text-foreground">{inr(g.balance)}</td></tr>)}
                  {shownGroups.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No outstanding payables.</td></tr>}
                </tbody>
                {shownGroups.length > 0 && <tfoot><tr className="border-t-2 border-border bg-surface-2 font-bold text-foreground"><td className="px-4 py-3">Total</td>{AGE_COLS.map(([k]) => <td key={k} className="px-4 py-3 text-right">{inr(stats.aging[k])}</td>)}<td className="px-4 py-3 text-right">{inr(stats.outstanding)}</td></tr></tfoot>}
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) { return <>{children}</>; }

const TONES = { primary: "bg-primary text-white", warning: "bg-warning text-white", danger: "bg-danger text-white", success: "bg-success text-white" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Wallet; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
