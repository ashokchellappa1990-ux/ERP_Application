"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, Search, Plus, X, LogIn, PlayCircle, CheckCircle2, LogOut, ShieldCheck, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import type { GateEntryStatus } from "@/lib/contracts/transport";

interface Row {
  id: number; gateEntryNo: string; vehicleId: number; vehicleNo: string;
  driverId: number | null; driverName: string | null;
  transportCompanyId: number | null; transportCompanyName: string | null;
  dispatchPlanningId: number | null; dispatchExecutionId: number | null;
  dispatchType: string | null; referenceNo: string | null; customerName: string | null;
  arrivalTime: string | null; securityOfficer: string | null; remarks: string | null;
  status: GateEntryStatus; createdAt: string;
  // Once a Load & Dispatch has been submitted for this gate entry, ITS OWN
  // status drives the displayed status/action for the row instead of the raw
  // physical gate status — see the Actions/Status cells below.
  loadDispatchId: number | null; loadDispatchStatus: string | null; dispatchDate: string | null;
  totalQty: number | null; totalValue: number | null;
  invoiceNo: string | null; paymentStatus: string | null;
  productName: string | null;
  preLoadWeight: number | null; postLoadWeight: number | null; netWeight: number | null;
  saleType: string | null; saleOutstanding: number | null;
}
interface HoverDetail { productName: string | null; preLoadWeight: number | null; postLoadWeight: number | null; netWeight: number | null }
interface Stats { total: number; waiting: number; inside: number; completed: number; dcGenerated: number; invoicePosted: number }
const EMPTY: Stats = { total: 0, waiting: 0, inside: 0, completed: 0, dcGenerated: 0, invoicePosted: 0 };
const PAYMENT_STATUS_TONE: Record<string, "success" | "warning" | "danger"> = { Paid: "success", Partial: "warning", Credit: "danger" };
const STATUS_TONE: Record<GateEntryStatus, "neutral" | "info" | "warning" | "success" | "primary"> = {
  Waiting: "neutral", "Inside Factory": "info", Loading: "warning", Completed: "success", Exited: "primary",
};
// Display-only shorthand — the underlying stored/filtered value stays
// "Inside Factory" everywhere (status comparisons, the filter dropdown value,
// the API's status param); only the shown label is shortened.
const STATUS_DISPLAY_LABEL: Record<GateEntryStatus, string> = {
  Waiting: "Waiting", "Inside Factory": "Inside", Loading: "Loading", Completed: "Completed", Exited: "Exited",
};
// Load & Dispatch's own status → friendly label + tone shown on this list
// once one has been submitted for the gate entry (Draft/Ready/Loading kept
// as-is). The main Dispatch Status column deliberately CAPS at "Dispatched" —
// once truly dispatched it never advances to "DC Generated"/"Invoice Posted"
// in THIS column; those two facts get their own DC Status / Invoice Status
// columns instead (see dcStatus/invoiceStatus below).
const DISPATCH_STATUS_LABEL: Record<string, string> = {
  Draft: "Draft", Ready: "Ready", Loading: "Loading",
  Dispatched: "Dispatched", "Delivery Challan Generated": "Dispatched", "Sales Invoice Posted": "Dispatched",
  Cancelled: "Cancelled",
};
const DISPATCH_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "primary" | "danger"> = {
  Draft: "neutral", Ready: "primary", Loading: "warning",
  Dispatched: "info", "Delivery Challan Generated": "info", "Sales Invoice Posted": "info", Cancelled: "danger",
};
const DISPATCHED_OR_LATER = ["Dispatched", "Delivery Challan Generated", "Sales Invoice Posted"];
function dcStatus(loadDispatchStatus: string | null): { label: string; tone: "neutral" | "success" | "warning" } | null {
  if (!loadDispatchStatus || !DISPATCHED_OR_LATER.includes(loadDispatchStatus)) return null;
  return loadDispatchStatus === "Delivery Challan Generated" || loadDispatchStatus === "Sales Invoice Posted"
    ? { label: "Generated", tone: "success" } : { label: "Not Generated", tone: "warning" };
}
function invoiceStatus(loadDispatchStatus: string | null): { label: string; tone: "neutral" | "success" | "warning" } | null {
  if (!loadDispatchStatus || !DISPATCHED_OR_LATER.includes(loadDispatchStatus)) return null;
  return loadDispatchStatus === "Sales Invoice Posted"
    ? { label: "Posted", tone: "success" } : { label: "Not Posted", tone: "warning" };
}
const FILTERS = ["All", "Waiting", "Inside Factory", "Loading", "Completed", "Exited"] as const;
const DC_STATUS_FILTERS = ["All", "Generated", "NotGenerated"] as const;
const DC_STATUS_FILTER_LABEL: Record<(typeof DC_STATUS_FILTERS)[number], string> = { All: "All DC statuses", Generated: "DC Generated", NotGenerated: "DC Not Generated" };
const INVOICE_STATUS_FILTERS = ["All", "Posted", "NotPosted"] as const;
const INVOICE_STATUS_FILTER_LABEL: Record<(typeof INVOICE_STATUS_FILTERS)[number], string> = { All: "All invoice statuses", Posted: "Invoice Posted", NotPosted: "Invoice Not Posted" };

export function VehicleGateEntryScreen() {
  const toast = useToast();
  const router = useRouter();
  const fmt = useFmt();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dispatchFromDate, setDispatchFromDate] = useState("");
  const [dispatchToDate, setDispatchToDate] = useState("");
  const [product, setProduct] = useState("");
  const [dcStatusFilter, setDcStatusFilter] = useState<(typeof DC_STATUS_FILTERS)[number]>("All");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<(typeof INVOICE_STATUS_FILTERS)[number]>("All");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [exitRow, setExitRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hover, setHover] = useState<{ row: Row; x: number; y: number } | null>(null);
  // Product name + pre/post-loading weighment are only shown in the
  // hover popover / expand accordion — fetched lazily per row (once, cached
  // client-side) instead of eagerly joined for every row on every list load.
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
      if (status !== "All") u.set("status", status);
      if (query.trim()) u.set("q", query.trim());
      if (fromDate) u.set("fromDate", fromDate);
      if (toDate) u.set("toDate", toDate);
      if (dispatchFromDate) u.set("dispatchFromDate", dispatchFromDate);
      if (dispatchToDate) u.set("dispatchToDate", dispatchToDate);
      if (product.trim()) u.set("product", product.trim());
      if (dcStatusFilter !== "All") u.set("dcStatus", dcStatusFilter);
      if (invoiceStatusFilter !== "All") u.set("invoiceStatus", invoiceStatusFilter);
      const res = await fetch(`/api/transport/gate-entry?${u}`, { cache: "no-store" });
      if (res.status === 401) { setNotAuthed(true); return; }
      const j = await res.json().catch(() => ({}));
      if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [query, status, fromDate, toDate, dispatchFromDate, dispatchToDate, product, dcStatusFilter, invoiceStatusFilter]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function runAction(row: Row, action: "move-inside" | "complete") {
    setBusy(row.id);
    try {
      const res = await fetch(`/api/transport/gate-entry/${row.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await res.json().catch(() => ({}));
      toast.result(j, "Updated.", "Could not update the gate entry.");
      if (j.ok) load();
    } finally { setBusy(null); }
  }

  // "Start Load & Dispatch" hands off straight into Load & Dispatch, pre-filled
  // with this gate entry's vehicle/transport/driver details — it deliberately
  // does NOT flip the gate entry's own status first (unlike the other
  // actions): the action/status shown on this list must stay "Start Load &
  // Dispatch" until a Load & Dispatch document actually gets submitted, not
  // the moment this button is merely clicked (matches the physical reality —
  // clicking through then hitting Back shouldn't look like loading started).
  function startLoadDispatch(row: Row) {
    const path = row.dispatchType === "Customer"
      ? `/warehouse/transfer/load-dispatch/new/direct?gateEntryId=${row.id}`
      : `/warehouse/transfer/load-dispatch/new?gateEntryId=${row.id}`;
    router.push(path);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Vehicle Gate Entry</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> Vehicle Gate Entry</h1>
          <p className="mt-0.5 text-sm text-muted">First step of the physical vehicle flow — records arrival &amp; drives Move Inside → Start Load &amp; Dispatch → Exit (once submitted, status/actions follow the Load &amp; Dispatch document itself).</p>
        </div>
        <Button size="md" onClick={() => router.push("/transport/gate-entry/new")}><Plus className="h-4 w-4" /> New Gate Entry</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total" value={stats.total} tone="primary" />
        <Stat label="Waiting" value={stats.waiting} tone="neutral" />
        <Stat label="Inside" value={stats.inside} tone="info" />
        <Stat label="Load & Dispatch Completed" value={stats.completed} tone="warning" />
        <Stat label="DC Generated" value={stats.dcGenerated} tone="info" />
        <Stat label="Invoice Posted" value={stats.invoicePosted} tone="success" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search gate entry no or reference…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
            </div>
            <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Product name…" className="h-9 w-40 rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1">
              <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Entry Date</span>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
              <span className="text-2xs text-subtle">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1">
              <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Dispatch Date</span>
              <input type="date" value={dispatchFromDate} onChange={(e) => setDispatchFromDate(e.target.value)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
              <span className="text-2xs text-subtle">to</span>
              <input type="date" value={dispatchToDate} onChange={(e) => setDispatchToDate(e.target.value)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value as (typeof FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
              {FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All statuses" : (STATUS_DISPLAY_LABEL[f] ?? f)}</option>)}
            </select>
            <select value={dcStatusFilter} onChange={(e) => setDcStatusFilter(e.target.value as (typeof DC_STATUS_FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
              {DC_STATUS_FILTERS.map((f) => <option key={f} value={f}>{DC_STATUS_FILTER_LABEL[f]}</option>)}
            </select>
            <select value={invoiceStatusFilter} onChange={(e) => setInvoiceStatusFilter(e.target.value as (typeof INVOICE_STATUS_FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
              {INVOICE_STATUS_FILTERS.map((f) => <option key={f} value={f}>{INVOICE_STATUS_FILTER_LABEL[f]}</option>)}
            </select>
            <Button size="sm" variant="primary" onClick={load}><Search className="h-3.5 w-3.5" /> Search</Button>
            <Button size="sm" variant="outline" onClick={() => { setQuery(""); setStatus("All"); setFromDate(""); setToDate(""); setDispatchFromDate(""); setDispatchToDate(""); setProduct(""); setDcStatusFilter("All"); setInvoiceStatusFilter("All"); }}><X className="h-3.5 w-3.5" /> Clear</Button>
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
              {rows.map((r) => (
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
                  <td className="px-4 py-3 text-center">
                    {r.loadDispatchStatus ? (
                      <Badge tone={DISPATCH_STATUS_TONE[r.loadDispatchStatus] ?? "neutral"}>{DISPATCH_STATUS_LABEL[r.loadDispatchStatus] ?? r.loadDispatchStatus}</Badge>
                    ) : (
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_DISPLAY_LABEL[r.status] ?? r.status}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(() => { const d = dcStatus(r.loadDispatchStatus); return d ? <Badge tone={d.tone}>{d.label}</Badge> : <span className="text-2xs text-subtle">—</span>; })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(() => { const i = invoiceStatus(r.loadDispatchStatus); return i ? <Badge tone={i.tone}>{i.label}</Badge> : <span className="text-2xs text-subtle">—</span>; })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.paymentStatus ? <Badge tone={PAYMENT_STATUS_TONE[r.paymentStatus] ?? "neutral"}>{r.paymentStatus}</Badge> : <span className="text-2xs text-subtle">—</span>}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {r.loadDispatchId ? (
                        <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => router.push(`/warehouse/transfer/load-dispatch/${r.loadDispatchId}`)}><Eye className="h-3.5 w-3.5" /> View Details</Button>
                      ) : (
                        <>
                          {r.status === "Waiting" && <Button size="sm" variant="primary" className="whitespace-nowrap" disabled={busy === r.id} onClick={() => runAction(r, "move-inside")}><LogIn className="h-3.5 w-3.5" /> Move Inside</Button>}
                          {r.status === "Inside Factory" && <Button size="sm" variant="accent" className="whitespace-nowrap" disabled={busy === r.id} onClick={() => startLoadDispatch(r)}><PlayCircle className="h-3.5 w-3.5" /> Dispatch</Button>}
                          {r.status === "Loading" && <Button size="sm" variant="primary" className="whitespace-nowrap" disabled={busy === r.id} onClick={() => runAction(r, "complete")}><CheckCircle2 className="h-3.5 w-3.5" /> Complete</Button>}
                          {r.status === "Completed" && <Button size="sm" variant="danger" className="whitespace-nowrap" onClick={() => setExitRow(r)}><LogOut className="h-3.5 w-3.5" /> Exit</Button>}
                          {r.status === "Exited" && <Badge tone="success"><ShieldCheck className="h-3 w-3" /> Exited</Badge>}
                        </>
                      )}
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
              {loading && rows.length === 0 && <tr><td colSpan={12} className="px-4 py-8"><AppLoader label="Loading gate entries…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : "No gate entries yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {hover && <RowHoverPopover row={hover.row} x={hover.x} y={hover.y} fmt={fmt} detail={detailCache[hover.row.id]} />}

      {exitRow && <GateExitModal row={exitRow} onClose={() => setExitRow(null)} onSaved={(warning) => { setExitRow(null); load(); if (warning) toast.warning(warning); else toast.success("Vehicle exited."); }} />}

      {/* Full-page loader for every list-refreshing activity — initial load,
          live search-as-you-type, the explicit Search button, and Clear — not
          just the empty-state case the inline table spinner covers. */}
      {loading && rows.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <AppLoader label="Searching…" />
        </div>
      )}
    </div>
  );
}

export function GateExitModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: (warning: string | null) => void }) {
  const toast = useToast();
  const [securityOfficer, setSecurityOfficer] = useState("");
  const [sealVerified, setSealVerified] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/transport/gate-exit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateEntryId: row.id, securityOfficer: securityOfficer || null, sealVerified, remarks: remarks || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.ok) onSaved(j.warning ?? null);
      else toast.error(j.message || "Could not record the gate exit.");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><LogOut className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-foreground">Gate Exit</h2><p className="text-2xs text-muted">{row.gateEntryNo} — {row.vehicleNo}</p></div></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3.5 p-5">
          <Field label="Security Officer"><input value={securityOfficer} onChange={(e) => setSecurityOfficer(e.target.value)} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></Field>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground"><input type="checkbox" checked={sealVerified} onChange={(e) => setSealVerified(e.target.checked)} className="h-4 w-4 rounded border-border-strong" /> Seal verified</label>
          <Field label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={save} disabled={saving}>{saving ? "Recording…" : "Record Exit"}</Button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span>{children}</label>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "primary" | "neutral" | "info" | "warning" | "success" }) {
  const TONES = { primary: "bg-primary text-white", neutral: "bg-surface-2 text-muted", info: "bg-info text-white", warning: "bg-warning text-white", success: "bg-success text-white" } as const;
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Truck className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}

// Shared field list for both the hover popover and the click-to-expand
// accordion row — everything not already visible as its own table column.
// `detail` is undefined while it hasn't been requested yet, null while the
// lazy fetch is in flight, and the resolved object once loaded — see
// ensureDetail()/detailCache in VehicleGateEntryScreen.
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
    { label: "Invoice No", value: row.invoiceNo ?? "—" },
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

// Rich hover card following the cursor — flips to stay inside the viewport
// (left instead of right, above instead of below) near the window edges.
function RowHoverPopover({ row, x, y, fmt, detail }: { row: Row; x: number; y: number; fmt: ReturnType<typeof useFmt>; detail: HoverDetail | null | undefined }) {
  const width = 320, estHeight = 340, margin = 16;
  const flipLeft = typeof window !== "undefined" && x + width + margin > window.innerWidth;
  const flipUp = typeof window !== "undefined" && y + estHeight + margin > window.innerHeight;
  const left = flipLeft ? x - width - 14 : x + 14;
  const top = flipUp ? Math.max(margin, y - estHeight) : y + 14;
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-xl border border-border bg-card p-4 shadow-2xl"
      style={{ left, top, width }}
    >
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
