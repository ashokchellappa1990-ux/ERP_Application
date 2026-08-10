"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Truck, Search, X, Plus, Eye, FileStack, Send, PencilRuler, IndianRupee, Boxes } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { Pagination } from "@/components/ui/Pagination";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { TerminalFilter } from "@/components/pos/TerminalFilter";
import { cn } from "@/lib/cn";
// Shared API contract — one source of truth for the GRN list shapes.
import type { GrnRow, GrnListStats as Stats } from "@/lib/contracts/grn";

const EMPTY: Stats = { total: 0, draft: 0, posted: 0, totalValue: 0, totalQty: 0, scope: "today" };
const STATUS_TONE: Record<GrnRow["status"], "success" | "warning" | "danger"> = { Posted: "success", Draft: "warning", Cancelled: "danger" };
const STATUS_FILTERS = ["All", "Draft", "Posted", "Cancelled"] as const;
// "GRN Status" is a business-friendly label for the same workflow state shown in Status —
// Draft hasn't received stock yet, Posted has, Cancelled reversed it.
const GRN_STATUS: Record<GrnRow["status"], { label: string; tone: "success" | "warning" | "danger" }> = {
  Draft: { label: "Pending", tone: "warning" },
  Posted: { label: "Stock Received", tone: "success" },
  Cancelled: { label: "Reversed", tone: "danger" },
};
const PAYMENT_TONE: Record<string, "success" | "info" | "warning"> = { Paid: "success", Partial: "info", Unpaid: "warning" };
const INVOICE_STATUS_FILTERS = ["All", "Posted", "NotPosted"] as const;
const INVOICE_STATUS_FILTER_LABEL: Record<(typeof INVOICE_STATUS_FILTERS)[number], string> = { All: "All invoice statuses", Posted: "Invoice Posted", NotPosted: "Invoice Not Posted" };

export default function GrnListPage() {
  const fmt = useFmt();
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<(typeof INVOICE_STATUS_FILTERS)[number]>("All");
  const [terminalId, setTerminalId] = useState("");
  const [rows, setRows] = useState<GrnRow[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (product.trim()) params.set("product", product.trim());
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (invoiceStatusFilter !== "All") params.set("invoiceStatus", invoiceStatusFilter);
      if (terminalId) params.set("terminalId", terminalId);
      const res = await fetch(`/api/purchase/grn?${params}`, { cache: "no-store" });
      if (res.status === 401) { setNotAuthed(true); return; }
      const j = await res.json().catch(() => ({}));
      if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); setPage(1); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [query, product, fromDate, toDate, statusFilter, invoiceStatusFilter, terminalId]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  function clearFilters() {
    setQuery(""); setProduct(""); setFromDate(""); setToDate(""); setStatusFilter("All"); setInvoiceStatusFilter("All");
  }

  const compact = (n: number) => (n >= 100000 ? `${fmt.money(n / 100000)}L` : fmt.money(n));
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Purchase</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Goods Receipt Note</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> Goods Receipt Note</h1>
          <p className="mt-0.5 text-sm text-muted">Receive stock against suppliers — posting generates QR labels &amp; updates inventory.</p>
        </div>
        <Link href="/purchase/grn/new"><Button size="md"><Plus className="h-4 w-4" /> New GRN</Button></Link>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-2xs font-medium text-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", stats.scope === "today" ? "bg-primary" : "bg-accent")} />
          {stats.scope === "today" ? "Showing today's activity — apply a filter below to update these cards." : "Showing totals for your applied filters."}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
          <Stat icon={FileStack} label="Total GRNs" value={String(stats.total)} tone="primary" />
          <Stat icon={PencilRuler} label="Drafts" value={String(stats.draft)} tone="warning" />
          <Stat icon={Send} label="Posted" value={String(stats.posted)} tone="success" />
          <Stat icon={Boxes} label="Qty Received" value={fmt.qty(stats.totalQty)} tone="secondary" />
          <Stat icon={IndianRupee} label="Receipt Value" value={compact(stats.totalValue)} tone="accent" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search GRN, supplier, PO or invoice…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
            </div>
            <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Product name…" className="h-9 w-40 rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus" />
            <TerminalFilter value={terminalId} onChange={setTerminalId} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1">
              <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">GRN Date</span>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
              <span className="text-2xs text-subtle">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
              {STATUS_FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All statuses" : f}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus" title="GRN Status mirrors Status — Draft/Posted/Cancelled">
              {STATUS_FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All GRN statuses" : GRN_STATUS[f].label}</option>)}
            </select>
            <select value={invoiceStatusFilter} onChange={(e) => setInvoiceStatusFilter(e.target.value as (typeof INVOICE_STATUS_FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
              {INVOICE_STATUS_FILTERS.map((f) => <option key={f} value={f}>{INVOICE_STATUS_FILTER_LABEL[f]}</option>)}
            </select>
            <Button size="sm" variant="primary" onClick={load}><Search className="h-3.5 w-3.5" /> Search</Button>
            <Button size="sm" variant="outline" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Clear</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="whitespace-nowrap px-3 py-3">GRN Number</th>
                <th className="whitespace-nowrap px-3 py-3">GRN Date</th>
                <th className="whitespace-nowrap px-3 py-3">Invoice No</th>
                <th className="px-3 py-3">Supplier Name</th>
                <th className="whitespace-nowrap px-3 py-3">Vehicle No</th>
                <th className="whitespace-nowrap px-3 py-3 text-right">Qty</th>
                <th className="whitespace-nowrap px-3 py-3 text-right">Value</th>
                <th className="whitespace-nowrap px-3 py-3 text-center">Status</th>
                <th className="whitespace-nowrap px-3 py-3 text-center">GRN Status</th>
                <th className="whitespace-nowrap px-3 py-3 text-center">PI Status</th>
                <th className="whitespace-nowrap px-3 py-3 text-center">Payment</th>
                <th className="whitespace-nowrap px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-foreground">{d.grnNo}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-foreground">{d.grnDate}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-foreground">{d.supplierInvoiceNo || "—"}</td>
                  <td className="px-3 py-3 text-foreground">{d.supplier || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-foreground">{d.vehicleNo || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-foreground">{fmt.qty(d.totalQty)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-foreground">{compact(d.totalValue)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-center"><Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-3 text-center"><Badge tone={GRN_STATUS[d.status].tone}>{GRN_STATUS[d.status].label}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">{d.status === "Draft" ? <span className="text-subtle">—</span> : <Badge tone={d.invoiceRecorded ? "success" : "warning"}>{d.invoiceRecorded ? "Posted" : "Not Posted"}</Badge>}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-center"><Badge tone={PAYMENT_TONE[d.paymentStatus] ?? "warning"}>{d.paymentStatus}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <Link href={`/purchase/grn/${d.id}`}><Button size="sm" variant="secondary" className="whitespace-nowrap"><Eye className="h-3.5 w-3.5" /> View</Button></Link>
                  </td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={12} className="px-4 py-8"><AppLoader label="Loading GRNs…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : <>No GRNs yet. Click <Link href="/purchase/grn/new" className="font-semibold text-primary hover:underline">New GRN</Link> to receive stock.</>}</td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && <Pagination page={page} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="GRNs" />}
      </div>

      {loading && rows.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <AppLoader label="Searching…" />
        </div>
      )}
    </div>
  );
}

const TONES = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white", accent: "bg-accent text-accent-foreground" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Boxes; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
