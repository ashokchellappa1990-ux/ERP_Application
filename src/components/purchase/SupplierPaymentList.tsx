"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, Search, Plus, Eye, CircleDollarSign, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { useFmt } from "@/components/settings/GeneralConfigProvider";

interface Row { id: number; paymentNo: string; supplier: string; paymentDate: string; mode: string; reference: string; totalAmount: number; invoiceCount: number; status: string }

export function SupplierPaymentList() {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const compact = (n: number) => (n >= 100000 ? `${fmt.money(n / 100000)}L` : inr(n));
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState({ payments: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try { const j = await fetch(`/api/purchase/supplier-payment?${new URLSearchParams({ q: query })}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); if (j.ok) { setRows(j.rows); setStats(j.stats); } } catch { /* */ } finally { setLoading(false); }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Purchase</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Supplier Payments</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Banknote className="h-5 w-5 text-primary" /> Supplier Payments</h1>
          <p className="mt-0.5 text-sm text-muted">Payments made to suppliers, settling one or more purchase bills.</p>
        </div>
        <Link href="/purchase/payments/new"><Button size="md"><Plus className="h-4 w-4" /> New Payment</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Kpi icon={CircleDollarSign} label="Paid this month" value={compact(stats.thisMonth)} />
        <Kpi icon={CalendarRange} label="Total payments" value={String(stats.payments)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search payment, supplier or reference…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Payment No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3 text-center">Invoices</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                  <td className="px-4 py-3"><Link href={`/purchase/payments/${p.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{p.paymentNo}</Link></td>
                  <td className="px-4 py-3 text-muted">{p.paymentDate}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{p.supplier || "—"}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{p.mode}{p.reference ? <div className="text-subtle">{p.reference}</div> : null}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-muted">{p.invoiceCount}</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">{inr(p.totalAmount)}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/purchase/payments/${p.id}`} className="inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline"><Eye className="h-3.5 w-3.5" /> View</Link></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading payments…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">No supplier payments yet. Click <strong>New Payment</strong> to pay outstanding bills.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Banknote; label: string; value: string }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-3.5 shadow-sm")}><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white shadow-sm"><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
