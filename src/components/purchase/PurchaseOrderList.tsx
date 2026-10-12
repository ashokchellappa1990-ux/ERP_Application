"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag, Search, Plus, Eye, FileStack, Package, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { PurchaseOrderRow as Row } from "@/lib/contracts/purchaseOrder";

interface Stats { total: number; draft: number; issued: number; openValue: number }
const EMPTY: Stats = { total: 0, draft: 0, issued: 0, openValue: 0 };
const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info" | "primary"> = {
  Draft: "neutral", Approved: "info", Issued: "primary", "Partially Received": "warning", Received: "success", Cancelled: "danger", Closed: "neutral",
};
const FILTERS = ["All", "Draft", "Approved", "Issued", "Received", "Cancelled", "Closed"] as const;

export function PurchaseOrderList() {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("All");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const u = new URLSearchParams();
        if (status !== "All") u.set("status", status);
        if (query.trim()) u.set("q", query.trim());
        const res = await fetch(`/api/purchase/order?${u}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 401) { setNotAuthed(true); return; }
        const j = await res.json().catch(() => ({}));
        if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Purchase</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Purchase Order</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ShoppingBag className="h-5 w-5 text-primary" /> Purchase Order</h1>
          <p className="mt-0.5 text-sm text-muted">Supplier orders — the commitment that precedes the GRN and Purchase Invoice. Stock &amp; accounts are not affected.</p>
        </div>
        <Link href="/purchase/order/new"><Button size="md"><Plus className="h-4 w-4" /> New Purchase Order</Button></Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileStack} label="Total Orders" value={String(stats.total)} tone="primary" />
        <Stat icon={Package} label="Draft" value={String(stats.draft)} tone="neutral" />
        <Stat icon={Send} label="Issued" value={String(stats.issued)} tone="info" />
        <Stat icon={Wallet} label="Open Order Value" value={inr(stats.openValue)} tone="success" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search PO no, supplier or quotation…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
            {FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All statuses" : f}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">PO No</th>
                <th className="px-4 py-3">PO Date</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Net Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><Link href={`/purchase/order/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.poNo}</Link><div className="mt-0.5"><Badge tone="neutral">{r.purchaseType}</Badge></div></td>
                  <td className="px-4 py-3 text-2xs text-muted">{r.poDate || "—"}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.supplier || "—"}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{r.expectedDeliveryDate || "—"}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-muted">{r.itemCount}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{inr(r.netAmount)}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-4 py-3"><div className="flex items-center justify-end">
                    <Link href={`/purchase/order/${r.id}`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                  </div></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8"><AppLoader label="Loading purchase orders…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : <>No purchase orders yet. Click <Link href="/purchase/order/new" className="font-semibold text-primary hover:underline">New Purchase Order</Link>.</>}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TONES = { primary: "bg-primary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white", info: "bg-info text-white", neutral: "bg-surface-2 text-muted" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof FileStack; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
