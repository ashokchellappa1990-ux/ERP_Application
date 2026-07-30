"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Search, Plus, Eye, Settings2, CircleDollarSign, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { formatMoney } from "@/lib/settings/generalConfig";
import { TerminalFilter } from "@/components/pos/TerminalFilter";
import type { PettyCashRow as Row } from "@/lib/contracts/finance";

const inr = (x: number) => formatMoney(x || 0);
const fmt = (x: number) => (x >= 100000 ? `${formatMoney(x / 100000)}L` : inr(x));

export function PettyCashList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState({ vouchers: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [terminalId, setTerminalId] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try { const u = new URLSearchParams({ q: query }); if (terminalId) u.set("terminalId", terminalId); const j = await fetch(`/api/finance/petty-cash?${u}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); if (j.ok) { setRows(j.rows); setStats(j.stats); } } catch { /* */ } finally { setLoading(false); }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, terminalId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Finance</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Petty Cash</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Coins className="h-5 w-5 text-primary" /> Petty Cash / Expenses</h1>
          <p className="mt-0.5 text-sm text-muted">Expense payment vouchers — multiple heads &amp; split payment per voucher.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/accounting/petty-cash-config"><Button variant="outline" size="md"><Settings2 className="h-4 w-4" /> Configure</Button></Link>
          <Link href="/finance/petty-cash/new"><Button size="md"><Plus className="h-4 w-4" /> New Voucher</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Kpi icon={CircleDollarSign} label="Spent this month" value={fmt(stats.thisMonth)} />
        <Kpi icon={CalendarRange} label="Total vouchers" value={String(stats.vouchers)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search voucher, payee or note…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" />
          </div>
          <TerminalFilter value={terminalId} onChange={setTerminalId} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Voucher No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Payee</th><th className="px-4 py-3 text-center">Heads</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                  <td className="px-4 py-3"><Link href={`/finance/petty-cash/${p.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{p.voucherNo}</Link></td>
                  <td className="px-4 py-3 text-muted">{p.voucherDate}</td>
                  <td className="px-4 py-3"><span className="font-medium text-foreground">{p.payeeName || "—"}</span><Badge tone="neutral" className="ml-1.5">{p.payeeType}</Badge></td>
                  <td className="px-4 py-3 text-center tabular-nums text-muted">{p.headCount}</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">{inr(p.totalAmount)}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/finance/petty-cash/${p.id}`} className="inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline"><Eye className="h-3.5 w-3.5" /> View</Link></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8"><AppLoader label="Loading…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">No petty cash vouchers yet. Click <strong>New Voucher</strong>.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Coins; label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white shadow-sm"><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
