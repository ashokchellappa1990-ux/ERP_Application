"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HandCoins, Search, Plus, Eye, CircleDollarSign, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { TerminalFilter } from "@/components/pos/TerminalFilter";
// Shared API contract — one source of truth for the collection list shape.
import type { CollectionRow as Row } from "@/lib/contracts/sale";

export function CustomerCollectionList() {
  const f = useFmt();
  const inr = (x: number) => f.money(x || 0);
  const fmt = (x: number) => (x >= 100000 ? `${f.money(x / 100000)}L` : inr(x));
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState({ collections: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [terminalId, setTerminalId] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try { const u = new URLSearchParams({ q: query }); if (terminalId) u.set("terminalId", terminalId); const j = await fetch(`/api/sales/collection?${u}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); if (j.ok) { setRows(j.rows); setStats(j.stats); } } catch { /* */ } finally { setLoading(false); }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, terminalId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Sales</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Customer Collections</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><HandCoins className="h-5 w-5 text-primary" /> Customer Collections</h1>
          <p className="mt-0.5 text-sm text-muted">Money collected from customers, settling one or more credit invoices.</p>
        </div>
        <Link href="/sales/collections/new"><Button size="md"><Plus className="h-4 w-4" /> New Collection</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Kpi icon={CircleDollarSign} label="Collected this month" value={fmt(stats.thisMonth)} />
        <Kpi icon={CalendarRange} label="Total collections" value={String(stats.collections)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search receipt, customer or reference…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" />
          </div>
          <TerminalFilter value={terminalId} onChange={setTerminalId} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Receipt No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3 text-center">Invoices</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                  <td className="px-4 py-3"><Link href={`/sales/collections/${p.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{p.collectionNo}</Link></td>
                  <td className="px-4 py-3 text-muted">{p.collectionDate}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{p.customerName || "—"}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{p.mode}{p.reference ? <div className="text-subtle">{p.reference}</div> : null}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-muted">{p.invoiceCount}</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">{inr(p.totalAmount)}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/sales/collections/${p.id}`} className="inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline"><Eye className="h-3.5 w-3.5" /> View</Link></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading collections…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">No collections yet. Click <strong>New Collection</strong> to collect against credit invoices.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof HandCoins; label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white shadow-sm"><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
