"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptText, Search, X, Eye, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/cn";
import { useFmt } from "@/components/settings/GeneralConfigProvider";

interface Row {
  id: number; gateEntryNo: string; vehicleNo: string;
  driverName: string | null; transportCompanyName: string | null;
  dispatchType: string | null; referenceNo: string | null; customerName: string | null;
  arrivalTime: string | null; remarks: string | null;
  loadDispatchId: number | null; loadDispatchStatus: string | null; dispatchDate: string | null;
  totalQty: number | null; totalValue: number | null;
  invoiceNo: string | null; paymentStatus: string | null;
  saleType: string | null; saleOutstanding: number | null;
}
interface HoverDetail {
  productName: string | null; preLoadWeight: number | null; postLoadWeight: number | null; netWeight: number | null;
}
const PAYMENT_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { Paid: "success", Full: "success", Partial: "warning", Credit: "danger", Pending: "neutral" };
// Same vocabulary as the Load & Dispatch list's Status column — capped at
// "Dispatched" since DC/Invoice facts get their own columns here too.
const DISPATCH_STATUS_LABEL: Record<string, string> = {
  Dispatched: "Dispatched", "Delivery Challan Generated": "Dispatched", "Sales Invoice Posted": "Dispatched",
};
const DISPATCH_STATUS_TONE: Record<string, "info"> = {
  Dispatched: "info", "Delivery Challan Generated": "info", "Sales Invoice Posted": "info",
};

/** "Sales (From DC)" — every dispatch that already has a Delivery Challan
 * generated, split by whether the Sales Invoice has been posted for it yet.
 * Pending = DC generated, invoice Not Posted (Manual posting mode still
 * needs the "Post Sales Invoice" step); Completed = invoice Posted. Drills
 * into the exact same Load & Dispatch view screen — that's where Post Sales
 * Invoice actually lives — this list is purely a work queue for it. */
export function SalesFromDcList() {
  const router = useRouter();
  const fmt = useFmt();
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState("");
  const [dispatchFromDate, setDispatchFromDate] = useState("");
  const [dispatchToDate, setDispatchToDate] = useState("");
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hover, setHover] = useState<{ row: Row; x: number; y: number } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detailCache, setDetailCache] = useState<Record<number, HoverDetail | null>>({});
  const ensureDetail = useCallback((id: number) => {
    setDetailCache((cur) => {
      if (id in cur) return cur;
      fetch(`/api/transport/gate-entry/${id}/hover-detail`, { cache: "no-store" })
        .then((res) => res.json())
        .then((j) => { if (j.ok) setDetailCache((c) => ({ ...c, [id]: j.data })); })
        .catch(() => {});
      return { ...cur, [id]: null };
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = new URLSearchParams();
      u.set("entryType", "Dispatch");
      u.set("dcStatus", "Generated");
      if (query.trim()) u.set("q", query.trim());
      if (dispatchFromDate) u.set("dispatchFromDate", dispatchFromDate);
      if (dispatchToDate) u.set("dispatchToDate", dispatchToDate);
      if (product.trim()) u.set("product", product.trim());
      const res = await fetch(`/api/transport/gate-entry?${u}`, { cache: "no-store" });
      if (res.status === 401) { setNotAuthed(true); return; }
      const j = await res.json().catch(() => ({}));
      if (j.ok) { setNotAuthed(false); setAllRows(j.rows); setPage(1); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [query, dispatchFromDate, dispatchToDate, product]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const isPosted = (r: Row) => r.loadDispatchStatus === "Sales Invoice Posted";
  const rows = allRows.filter((r) => (tab === "completed" ? isPosted(r) : !isPosted(r)));
  const pendingCount = allRows.filter((r) => !isPosted(r)).length;
  const completedCount = allRows.length - pendingCount;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Sales</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Sales (From DC)</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ReceiptText className="h-5 w-5 text-primary" /> Sales (From DC)</h1>
          <p className="mt-0.5 text-sm text-muted">Every dispatch with a Delivery Challan already generated — post its Sales Invoice, or see it once posted.</p>
        </div>
      </div>

      <div className="inline-flex overflow-hidden rounded-lg border border-border bg-surface p-1 text-sm">
        <button type="button" onClick={() => { setTab("pending"); setPage(1); }} className={cn("flex items-center gap-1.5 rounded-md px-4 py-1.5 font-semibold transition", tab === "pending" ? "bg-brand-gradient text-white shadow-sm" : "text-muted hover:text-foreground")}><Clock className="h-4 w-4" /> Pending <Badge tone="neutral">{pendingCount}</Badge></button>
        <button type="button" onClick={() => { setTab("completed"); setPage(1); }} className={cn("flex items-center gap-1.5 rounded-md px-4 py-1.5 font-semibold transition", tab === "completed" ? "bg-brand-gradient text-white shadow-sm" : "text-muted hover:text-foreground")}><CheckCircle2 className="h-4 w-4" /> Completed <Badge tone="neutral">{completedCount}</Badge></button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search gate entry no or reference…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
            </div>
            <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Product name…" className="h-9 w-40 rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus" />
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1">
              <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Dispatch Date</span>
              <input type="date" value={dispatchFromDate} onChange={(e) => setDispatchFromDate(e.target.value)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
              <span className="text-2xs text-subtle">to</span>
              <input type="date" value={dispatchToDate} onChange={(e) => setDispatchToDate(e.target.value)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
            </div>
            <Button size="sm" variant="primary" onClick={load}><Search className="h-3.5 w-3.5" /> Search</Button>
            <Button size="sm" variant="outline" onClick={() => { setQuery(""); setDispatchFromDate(""); setDispatchToDate(""); setProduct(""); }}><X className="h-3.5 w-3.5" /> Clear</Button>
          </div>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="bg-surface-2 px-4 py-3">Gate Entry No</th>
                <th className="bg-surface-2 px-4 py-3">Vehicle No</th>
                <th className="bg-surface-2 px-4 py-3">In-Time</th>
                <th className="bg-surface-2 px-4 py-3">Customer Name</th>
                <th className="bg-surface-2 px-4 py-3">Dispatch Date</th>
                <th className="bg-surface-2 px-4 py-3 text-right">Total Qty</th>
                <th className="bg-surface-2 px-4 py-3 text-right">Total Value</th>
                <th className="bg-surface-2 px-4 py-3 text-center">Status</th>
                <th className="bg-surface-2 px-4 py-3 text-center">DC Status</th>
                <th className="bg-surface-2 px-4 py-3 text-center">Invoice Status</th>
                <th className="bg-surface-2 px-4 py-3 text-center">Payment Status</th>
                <th className="bg-surface-2 px-4 py-3 text-right min-w-[130px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <Fragment key={r.id}>
                <tr
                  className="cursor-pointer border-b border-border last:border-0 transition hover:bg-primary-subtle/30"
                  onClick={() => { setExpandedId((cur) => (cur === r.id ? null : r.id)); ensureDetail(r.id); }}
                  onMouseEnter={(e) => { setHover({ row: r, x: e.clientX, y: e.clientY }); ensureDetail(r.id); }}
                  onMouseMove={(e) => setHover({ row: r, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)}
                >
                  <td className="px-4 py-3"><span className="font-mono text-xs font-semibold text-foreground">{r.gateEntryNo}</span></td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.vehicleNo}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{r.arrivalTime ? new Date(r.arrivalTime).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{r.customerName ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{r.dispatchDate ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">{r.totalQty != null ? fmt.qty(r.totalQty) : "—"}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">{r.totalValue != null ? fmt.money(r.totalValue) : "—"}</td>
                  <td className="px-4 py-3 text-center">{r.loadDispatchStatus ? <Badge tone={DISPATCH_STATUS_TONE[r.loadDispatchStatus] ?? "neutral"}>{DISPATCH_STATUS_LABEL[r.loadDispatchStatus] ?? r.loadDispatchStatus}</Badge> : <span className="text-2xs text-subtle">—</span>}</td>
                  <td className="px-4 py-3 text-center"><Badge tone="success">Generated</Badge></td>
                  <td className="px-4 py-3 text-center"><Badge tone={isPosted(r) ? "success" : "warning"}>{isPosted(r) ? "Posted" : "Not Posted"}</Badge></td>
                  <td className="px-4 py-3 text-center">{r.paymentStatus ? <Badge tone={PAYMENT_STATUS_TONE[r.paymentStatus] ?? "neutral"}>{r.paymentStatus}</Badge> : <span className="text-2xs text-subtle">—</span>}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => router.push(`/warehouse/transfer/load-dispatch/${r.loadDispatchId}?from=sales-from-dc`)}><Eye className="h-3.5 w-3.5" /> View Details</Button>
                    </div>
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr className="border-b border-border bg-surface-2/60 last:border-0">
                    <td colSpan={12} className="px-4 py-3">
                      <RowDetailGrid row={r} fmt={fmt} detail={detailCache[r.id]} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={12} className="px-4 py-8"><AppLoader label="Loading…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-muted">
                  {notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : tab === "pending" ? "No dispatches waiting on a Sales Invoice." : "No invoices posted from a DC yet."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <Pagination page={currentPage} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="dispatches" />
        )}
      </div>

      {hover && <RowHoverPopover row={hover.row} x={hover.x} y={hover.y} fmt={fmt} detail={detailCache[hover.row.id]} />}

      {loading && rows.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <AppLoader label="Searching…" />
        </div>
      )}
    </div>
  );
}

function detailFields(row: Row, fmt: ReturnType<typeof useFmt>, detail: HoverDetail | null | undefined): { label: string; value: string; highlight?: boolean }[] {
  const loading = detail === null;
  const weight = (v: number | null | undefined) => (loading ? "…" : v != null ? `${v} kg` : "—");
  return [
    { label: "Driver", value: row.driverName ?? "—" },
    { label: "Transport Company", value: row.transportCompanyName ?? "—" },
    { label: "Dispatch Type", value: row.dispatchType ?? "—" },
    { label: "Reference No", value: row.referenceNo ?? "—" },
    { label: "Product", value: loading ? "…" : detail?.productName ?? "—", highlight: true },
    { label: "Empty Weight", value: weight(detail?.preLoadWeight) },
    { label: "Post Load Weight", value: weight(detail?.postLoadWeight) },
    { label: "Net Weight", value: weight(detail?.netWeight) },
    { label: "Sale Type", value: row.saleType ?? "—" },
    { label: "Outstanding Balance", value: row.saleOutstanding != null ? fmt.money(row.saleOutstanding) : "—" },
    { label: "Remarks", value: row.remarks ?? "—" },
  ];
}

function RowDetailGrid({ row, fmt, detail }: { row: Row; fmt: ReturnType<typeof useFmt>; detail: HoverDetail | null | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
      {detailFields(row, fmt, detail).map((f) => (
        <div key={f.label}>
          <p className="text-2xs font-semibold uppercase tracking-wide text-subtle">{f.label}</p>
          <p className={cn("text-xs font-medium", f.highlight ? "font-bold text-primary" : "text-foreground")}>{f.value}</p>
        </div>
      ))}
    </div>
  );
}

function RowHoverPopover({ row, x, y, fmt, detail }: { row: Row; x: number; y: number; fmt: ReturnType<typeof useFmt>; detail: HoverDetail | null | undefined }) {
  const width = 320, estHeight = 320, margin = 16;
  const flipLeft = typeof window !== "undefined" && x + width + margin > window.innerWidth;
  const flipUp = typeof window !== "undefined" && y + estHeight + margin > window.innerHeight;
  const left = flipLeft ? x - width - 14 : x + 14;
  const top = flipUp ? Math.max(margin, y - estHeight) : y + 14;
  return (
    <div className="pointer-events-none fixed z-50 rounded-xl border border-border bg-card p-4 shadow-2xl" style={{ left, top, width }}>
      <p className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-2 text-xs font-bold text-foreground">
        <span className="font-mono">{row.gateEntryNo}</span><span>{row.vehicleNo}</span>
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {detailFields(row, fmt, detail).map((f) => (
          <div key={f.label}>
            <p className="text-2xs font-semibold uppercase tracking-wide text-subtle">{f.label}</p>
            <p className={cn("truncate text-xs font-medium", f.highlight ? "font-bold text-primary" : "text-foreground")}>{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
