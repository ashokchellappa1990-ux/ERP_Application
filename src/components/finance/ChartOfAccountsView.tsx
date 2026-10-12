"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, Layers } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";
import type { LedgerAccountRow, ChartOfAccountsStats } from "@/lib/contracts/accounting";

const inr = (x: number) => formatMoney(x || 0);
const TYPE_TONE: Record<string, "primary" | "warning" | "success" | "info" | "neutral"> = { Asset: "primary", Liability: "warning", Income: "success", Expense: "info", Equity: "neutral" };

export function ChartOfAccountsView() {
  const [rows, setRows] = useState<LedgerAccountRow[]>([]);
  const [stats, setStats] = useState<ChartOfAccountsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");

  useEffect(() => {
    (async () => {
      try { const j = await fetch("/api/accounting/chart-of-accounts", { cache: "no-store" }).then((r) => r.json()); if (j.ok) { setRows(j.rows); setStats(j.stats); } } catch { /* */ } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (type === "All" || r.type === type) && (!q || `${r.code} ${r.name} ${r.group}`.toLowerCase().includes(q)));
  }, [rows, query, type]);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Accounting</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Chart of Accounts</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><BookOpen className="h-5 w-5 text-primary" /> Chart of Accounts</h1>
        <p className="mt-0.5 text-sm text-muted">Ledger accounts that purchase &amp; sales vouchers post to. Balances are live from the General Ledger.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label="Accounts" value={String(stats.accounts)} tone="neutral" />
          <Kpi label="Assets" value={inr(stats.assets)} tone="primary" />
          <Kpi label="Liabilities" value={inr(stats.liabilities)} tone="warning" />
          <Kpi label="Income" value={inr(stats.income)} tone="success" />
          <Kpi label="Expense" value={inr(stats.expense)} tone="info" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, name or group…" className="h-10 w-full rounded-xl border border-border-strong bg-card pl-10 pr-3 text-sm focus:border-primary focus:outline-none" />
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-border text-xs">
          {["All", "Asset", "Liability", "Income", "Expense"].map((t) => (
            <button key={t} onClick={() => setType(t)} className={cn("px-3 py-2 font-semibold transition", type === t ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2")}>{t}</button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Code</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Group</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Balance</th></tr></thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/10">
                  <td className="px-4 py-2.5 font-mono text-xs text-subtle">{a.code}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{a.name}</td>
                  <td className="px-4 py-2.5"><Badge tone={TYPE_TONE[a.type] ?? "neutral"}>{a.type}</Badge></td>
                  <td className="px-4 py-2.5 text-2xs text-muted">{a.group}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{a.debit ? inr(a.debit) : "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{a.credit ? inr(a.credit) : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{inr(a.balance)}</td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10"><AppLoader label="Loading accounts…" size="sm" /></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted"><Layers className="mx-auto mb-2 h-5 w-5 text-subtle" />No accounts match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "primary" | "warning" | "success" | "info" | "neutral" }) {
  const tones = { primary: "text-primary", warning: "text-warning", success: "text-success", info: "text-info", neutral: "text-foreground" };
  return <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><p className={cn("text-lg font-bold tabular-nums", tones[tone])}>{value}</p><p className="mt-0.5 text-2xs font-medium text-muted">{label}</p></div>;
}
