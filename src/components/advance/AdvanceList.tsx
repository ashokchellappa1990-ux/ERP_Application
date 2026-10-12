"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HandCoins, Search, Plus, Eye, FileStack, Wallet, ClipboardCheck, CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { STATUS_TONE, APPROVAL_TONE, SettleModal, RefundModal } from "./shared";
import type { AdvanceRow as Row } from "@/lib/contracts/advance";

const FILTERS = ["All", "Draft", "Pending", "Collected", "Paid", "Partially Settled", "Fully Settled", "Refunded", "Cancelled"];

export function AdvanceList() {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("All");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, outstanding: 0, pendingApproval: 0 });
  const [loading, setLoading] = useState(true); const [notAuthed, setNotAuthed] = useState(false);
  const [settle, setSettle] = useState<Row | null>(null); const [refund, setRefund] = useState<Row | null>(null);

  const load = useCallback(() => {
    const ctrl = new AbortController(); setLoading(true);
    const t = setTimeout(async () => {
      try {
        const u = new URLSearchParams(); if (status !== "All") u.set("status", status); if (query.trim()) u.set("q", query.trim());
        const res = await fetch(`/api/finance/advance?${u}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 401) { setNotAuthed(true); return; }
        const j = await res.json().catch(() => ({}));
        if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
      } catch { /* */ } finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, status]);
  useEffect(() => load(), [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Finance</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Advance Management</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><HandCoins className="h-5 w-5 text-primary" /> Advance Transactions</h1>
          <p className="mt-0.5 text-sm text-muted">Customer, supplier & employee advances — one common engine. Approved advances post to the General Ledger.</p>
        </div>
        <Link href="/finance/advance/new"><Button size="md"><Plus className="h-4 w-4" /> New Advance</Button></Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileStack} label="Total Advances" value={String(stats.total)} tone="primary" />
        <Stat icon={CircleDollarSign} label="Open" value={String(stats.open)} tone="info" />
        <Stat icon={Wallet} label="Outstanding Balance" value={inr(stats.outstanding)} tone="success" />
        <Stat icon={ClipboardCheck} label="Pending Approval" value={String(stats.pendingApproval)} tone="warning" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search advance no, party or reference…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium focus:border-primary focus:outline-none">
            {FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All statuses" : f}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
              <th className="px-4 py-3">Advance No</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Party</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Settled</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Approval</th><th className="px-4 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><Link href={`/finance/advance/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.advanceNo}</Link><div className="mt-0.5"><Badge tone={r.direction === "received" ? "info" : "warning"}>{r.direction === "received" ? "Received" : "Paid"}</Badge></div></td>
                  <td className="px-4 py-3 text-2xs text-muted">{r.advanceDate}</td>
                  <td className="px-4 py-3 text-foreground">{r.advanceTypeName}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.partyName || "—"}<div className="text-[10px] text-subtle">{r.partyType}</div></td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{inr(r.netAmount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{inr(r.settledAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{inr(r.balanceAmount)}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-4 py-3 text-center"><Badge tone={APPROVAL_TONE[r.approvalStatus] ?? "neutral"}>{r.approvalStatus}</Badge></td>
                  <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
                    {r.balanceAmount > 0 && ["Collected", "Paid", "Partially Settled"].includes(r.status) && <button onClick={() => setSettle(r)} title="Settle" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted hover:border-primary/40 hover:text-primary"><HandCoins className="h-4 w-4" /></button>}
                    <Link href={`/finance/advance/${r.id}`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                  </div></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={10} className="px-4 py-8"><AppLoader label="Loading advances…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : <>No advances yet. Click <Link href="/finance/advance/new" className="font-semibold text-primary hover:underline">New Advance</Link>.</>}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {settle && <SettleModal advance={{ id: settle.id, advanceNo: settle.advanceNo, direction: settle.direction, partyName: settle.partyName, balanceAmount: settle.balanceAmount, advanceTypeName: settle.advanceTypeName }} onClose={() => setSettle(null)} onDone={load} />}
      {refund && <RefundModal advance={{ id: refund.id, advanceNo: refund.advanceNo, direction: refund.direction, partyName: refund.partyName, balanceAmount: refund.balanceAmount, advanceTypeName: refund.advanceTypeName }} onClose={() => setRefund(null)} onDone={load} />}
    </div>
  );
}

const TONES = { primary: "bg-primary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white", info: "bg-info text-white", neutral: "bg-surface-2 text-muted" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof FileStack; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
