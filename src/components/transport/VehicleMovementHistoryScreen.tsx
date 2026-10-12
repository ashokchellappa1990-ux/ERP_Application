"use client";

import { useEffect, useMemo, useState } from "react";
import { History, Truck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { Pagination } from "@/components/ui/Pagination";

interface Row {
  id: number;
  vehicleId: number;
  vehicleNo: string;
  dispatchExecutionId: number | null;
  dispatchDocNo: string;
  gateEntryId: number | null;
  gateEntryNo: string;
  eventType: string;
  eventAt: string;
  actorName: string;
  remarks: string;
}

const EVENT_TYPES = [
  "GateIn", "PreWeighment", "LoadingStart", "LoadingEnd", "PostWeighment", "GateOut",
  "TripCreated", "TripStart", "TripInTransit", "TripArrived", "TripCompleted", "TripOnHold", "TripResumed", "TripCancelled", "TripReturned",
];
const EVENT_TONE: Record<string, "info" | "warning" | "primary" | "success" | "neutral" | "danger"> = {
  GateIn: "info",
  PreWeighment: "warning",
  LoadingStart: "primary",
  LoadingEnd: "primary",
  PostWeighment: "warning",
  GateOut: "success",
  TripCreated: "neutral",
  TripStart: "primary",
  TripInTransit: "warning",
  TripArrived: "warning",
  TripCompleted: "success",
  TripOnHold: "warning",
  TripResumed: "primary",
  TripCancelled: "danger",
  TripReturned: "danger",
};

const fInp = "h-9 rounded-lg border border-border-strong bg-surface px-2.5 text-sm focus:border-primary focus:outline-none";

export function VehicleMovementHistoryScreen() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ vehicleId: "", eventType: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (f.vehicleId) p.set("vehicleId", f.vehicleId);
    if (f.eventType) p.set("eventType", f.eventType);
    if (f.dateFrom) p.set("dateFrom", f.dateFrom);
    if (f.dateTo) p.set("dateTo", f.dateTo);
    return p.toString();
  }, [f]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const j = await fetch(`/api/transport/movement-history?${qs}`, { cache: "no-store" }).then((r) => r.json());
        if (j.ok) setRows(j.rows);
      } catch { /* */ } finally { setLoading(false); }
    })();
  }, [qs]);

  useEffect(() => { setPage(1); }, [qs]);

  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  const total = rows?.length ?? 0;
  const paged = (rows ?? []).slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><History className="h-6 w-6" /></span>
        <div>
          <h1 className="text-lg font-bold text-foreground">Vehicle Movement History</h1>
          <p className="mt-0.5 text-xs text-muted">Read-only event trail — gate in, weighment, loading, gate out — recorded automatically by gate &amp; weighment operations.</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <label className="flex flex-col gap-1"><span className="text-2xs font-semibold text-muted">Vehicle ID</span>
          <input type="number" value={f.vehicleId} onChange={(e) => set({ vehicleId: e.target.value })} placeholder="Vehicle ID" className={`${fInp} w-32`} />
        </label>
        <label className="flex flex-col gap-1"><span className="text-2xs font-semibold text-muted">Event Type</span>
          <select value={f.eventType} onChange={(e) => set({ eventType: e.target.value })} className={fInp}>
            <option value="">All events</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1"><span className="text-2xs font-semibold text-muted">From</span>
          <input type="date" value={f.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} className={fInp} />
        </label>
        <label className="flex flex-col gap-1"><span className="text-2xs font-semibold text-muted">To</span>
          <input type="date" value={f.dateTo} onChange={(e) => set({ dateTo: e.target.value })} className={fInp} />
        </label>
        {(f.vehicleId || f.eventType || f.dateFrom || f.dateTo) && (
          <button onClick={() => setF({ vehicleId: "", eventType: "", dateFrom: "", dateTo: "" })} className="h-9 text-2xs font-semibold text-primary hover:underline">Clear filters</button>
        )}
      </div>

      {loading && <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading movement history…" size="sm" /></div>}

      {!loading && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                  <th className="px-4 py-3">Date / Time</th>
                  <th className="px-4 py-3">Vehicle No</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Dispatch Execution</th>
                  <th className="px-4 py-3">Gate Entry</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap text-foreground">{new Date(r.eventAt).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5 font-semibold text-foreground"><Truck className="h-3.5 w-3.5 text-muted" />{r.vehicleNo || `#${r.vehicleId}`}</span></td>
                    <td className="px-4 py-2.5"><Badge tone={EVENT_TONE[r.eventType] ?? "neutral"}>{r.eventType}</Badge></td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.dispatchDocNo || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.gateEntryNo || "—"}</td>
                    <td className="px-4 py-2.5 text-muted">{r.actorName || "—"}</td>
                    <td className="px-4 py-2.5 max-w-[280px] truncate text-muted">{r.remarks || "—"}</td>
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No movement events found for the selected filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="events" />
        </div>
      )}
    </div>
  );
}
