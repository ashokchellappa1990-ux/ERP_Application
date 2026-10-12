"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ClipboardList, Search, Plus, Eye, FileStack, Package, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { DOC_LABEL, type SalesDocRow as Row, type SalesDocType } from "@/lib/contracts/salesDoc";

interface Stats { total: number; draft: number; open: number; openValue: number }
const EMPTY: Stats = { total: 0, draft: 0, open: 0, openValue: 0 };
const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info" | "primary"> = {
  Draft: "neutral", Sent: "info", Accepted: "success", Rejected: "danger", Expired: "warning", Converted: "primary",
  Confirmed: "info", Delivered: "success", "Partially Delivered": "warning", Invoiced: "primary", Closed: "neutral", Cancelled: "danger",
};
const FILTERS: Record<SalesDocType, string[]> = {
  quotation: ["All", "Draft", "Sent", "Accepted", "Rejected", "Expired", "Converted", "Cancelled"],
  order: ["All", "Draft", "Confirmed", "Delivered", "Invoiced", "Closed", "Cancelled"],
};

export function SalesDocList({ docType }: { docType: SalesDocType }) {
  const L = DOC_LABEL[docType];
  const base = `/sales/${docType}`;
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const Icon = docType === "order" ? ClipboardList : FileText;

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const u = new URLSearchParams();
        if (status !== "All") u.set("status", status);
        if (query.trim()) u.set("q", query.trim());
        const res = await fetch(`/api/sales/${docType}?${u}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 401) { setNotAuthed(true); return; }
        const j = await res.json().catch(() => ({}));
        if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, status, docType]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Sales</span><span className="text-subtle">/</span><span className="font-medium text-foreground">{L.title}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> {L.title}</h1>
          <p className="mt-0.5 text-sm text-muted">{docType === "order" ? "Confirmed customer orders — the commitment that precedes the invoice. Stock & accounts are not affected until billing." : "Price quotes for customers — convert an accepted quotation into a sales order. No stock or accounting impact."}</p>
        </div>
        <Link href={`${base}/new`}><Button size="md"><Plus className="h-4 w-4" /> New {L.short}</Button></Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileStack} label={`Total ${L.short}s`} value={String(stats.total)} tone="primary" />
        <Stat icon={Package} label="Draft" value={String(stats.draft)} tone="neutral" />
        <Stat icon={Send} label="Open" value={String(stats.open)} tone="info" />
        <Stat icon={Wallet} label="Open Value" value={inr(stats.openValue)} tone="success" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${L.short.toLowerCase()} no, customer or GSTIN…`} className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
            {FILTERS[docType].map((f) => <option key={f} value={f}>{f === "All" ? "All statuses" : f}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">{L.number}</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">{L.keyDate}</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><Link href={`${base}/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.docNo}</Link>{r.convertedToNo && <div className="mt-0.5 text-[10px] text-subtle">→ {r.convertedToNo}</div>}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{r.docDate || "—"}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.customerName || "—"}{r.customerGstin && <div className="text-[10px] text-subtle">{r.customerGstin}</div>}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{r.keyDate || "—"}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-muted">{r.itemCount}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{inr(r.totalValue)}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-4 py-3"><div className="flex items-center justify-end">
                    <Link href={`${base}/${r.id}`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                  </div></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8"><AppLoader label={`Loading ${L.short.toLowerCase()}s…`} size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : <>No {L.short.toLowerCase()}s yet. Click <Link href={`${base}/new`} className="font-semibold text-primary hover:underline">New {L.short}</Link>.</>}</td></tr>}
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
