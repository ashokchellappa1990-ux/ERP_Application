"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageCheck, Search, Eye, FileStack, Package, Send, XCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { LOAD_DISPATCH_DOC_TYPES } from "@/lib/contracts/loadDispatch";
import type { LoadDispatchRow as Row, LoadDispatchStatus } from "@/lib/contracts/loadDispatch";

interface Stats { total: number; draft: number; dispatched: number; cancelled: number }
const EMPTY: Stats = { total: 0, draft: 0, dispatched: 0, cancelled: 0 };

const STATUS_TONE: Record<LoadDispatchStatus, "success" | "warning" | "danger" | "neutral" | "info" | "primary"> = {
  Draft: "neutral", Ready: "primary", Loading: "warning", Dispatched: "info",
  "Delivery Challan Generated": "info", "Sales Invoice Posted": "success", Cancelled: "danger",
};
const STATUS_FILTERS = ["All", "Draft", "Ready", "Loading", "Dispatched", "Delivery Challan Generated", "Sales Invoice Posted", "Cancelled"] as const;
const DOC_TYPE_FILTERS = ["All", ...LOAD_DISPATCH_DOC_TYPES.map((d) => d.value)] as const;
const TERMINAL_STATUSES: LoadDispatchStatus[] = ["Sales Invoice Posted", "Cancelled"];

export function LoadDispatchList() {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [docType, setDocType] = useState<(typeof DOC_TYPE_FILTERS)[number]>("All");
  const [warehouse, setWarehouse] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    const u = new URLSearchParams();
    if (status !== "All") u.set("status", status);
    if (docType !== "All") u.set("docType", docType);
    if (query.trim()) u.set("q", query.trim());
    if (warehouse.trim()) u.set("warehouse", warehouse.trim());
    if (dateFrom) u.set("dateFrom", dateFrom);
    if (dateTo) u.set("dateTo", dateTo);
    return fetch(`/api/warehouse/load-dispatch?${u}`, { cache: "no-store" })
      .then((res) => {
        if (res.status === 401 || res.status === 403) { setNotAuthed(true); return null; }
        return res.json();
      })
      .then((j) => { if (j?.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(load, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, docType, warehouse, dateFrom, dateTo]);

  async function cancelDispatch(id: number) {
    if (!confirm("Cancel this Load & Dispatch? This cannot be undone.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/warehouse/load-dispatch/${id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Dispatch cancelled."); load(); }
      else toast.error(j.message || "Could not cancel the dispatch.");
    } catch { toast.error("Network error — could not cancel."); }
    finally { setBusyId(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Warehouse Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Load &amp; Dispatch</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageCheck className="h-5 w-5 text-primary" /> Load &amp; Dispatch</h1>
          <p className="mt-0.5 text-sm text-muted">Warehouse-execution screen — loading, vehicle assignment and dispatch for every outbound movement.</p>
        </div>
        <Button size="md" onClick={() => router.push("/warehouse/transfer/load-dispatch/new")}><Send className="h-4 w-4" /> Start Load &amp; Dispatch</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileStack} label="Total" value={String(stats.total)} tone="primary" />
        <Stat icon={Package} label="Draft" value={String(stats.draft)} tone="neutral" />
        <Stat icon={Send} label="Dispatched" value={String(stats.dispatched)} tone="info" />
        <Stat icon={Ban} label="Cancelled" value={String(stats.cancelled)} tone="danger" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dispatch no, customer, vehicle, reference…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={docType} onChange={(e) => setDocType(e.target.value as (typeof DOC_TYPE_FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
                <option value="All">All dispatch types</option>
                {LOAD_DISPATCH_DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUS_FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
                {STATUS_FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All statuses" : f}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} placeholder="Warehouse" className="h-9 w-40 rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
            <span className="text-2xs text-subtle">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Dispatch No</th>
                <th className="px-4 py-3">Dispatch Type</th>
                <th className="px-4 py-3">Reference No</th>
                <th className="px-4 py-3">Customer / Destination</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">Vehicle Number</th>
                <th className="px-4 py-3">Dispatch Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const terminal = TERMINAL_STATUSES.includes(r.status);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                    <td className="px-4 py-3"><Link href={`/warehouse/transfer/load-dispatch/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.dispatchNo}</Link></td>
                    <td className="px-4 py-3"><Badge tone="neutral">{LOAD_DISPATCH_DOC_TYPES.find((d) => d.value === r.docType)?.label ?? r.docType}</Badge></td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.sourceRefNo || "—"}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{r.partyName || "—"}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.warehouse || "—"}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.vehicleNo || "—"}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.dispatchDate || "—"}</td>
                    <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.createdByName || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/warehouse/transfer/load-dispatch/${r.id}`} title="View / Edit" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                        {!terminal && (
                          <button
                            title="Cancel"
                            disabled={busyId === r.id}
                            onClick={() => cancelDispatch(r.id)}
                            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-danger/40 hover:text-danger disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {loading && rows.length === 0 && <tr><td colSpan={10} className="px-4 py-8"><AppLoader label="Loading dispatches…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">
                  {notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : <>No dispatches yet. Click <Link href="/warehouse/transfer/load-dispatch/new" className="font-semibold text-primary hover:underline">Start Load &amp; Dispatch</Link>.</>}
                </td></tr>
              )}
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
