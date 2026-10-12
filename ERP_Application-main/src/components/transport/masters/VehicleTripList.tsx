"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Waypoints, Plus, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/cn";
import { TRIP_TYPE_OPTS, TRIP_STATUS_LABEL, type TripRow } from "@/lib/contracts/vehicleTrip";

interface Stats {
  planned: number; assigned: number; started: number; inTransit: number; arrived: number; completed: number;
  completedToday: number; completedThisWeek: number; completedThisMonth: number;
  onHold: number; cancelled: number; returned: number; vehiclesOnTrip: number;
}

const ACTIVE_STATUSES = ["PLANNED", "ASSIGNED", "STARTED", "IN_TRANSIT", "ARRIVED"];
const EXCEPTION_STATUSES = ["ON_HOLD", "CANCELLED", "RETURNED"];
export const TRIP_STATUS_TONE: Record<string, "success" | "neutral" | "danger" | "warning" | "info"> = {
  PLANNED: "neutral", ASSIGNED: "info", STARTED: "info", IN_TRANSIT: "warning", ARRIVED: "warning",
  COMPLETED: "success", ON_HOLD: "warning", CANCELLED: "danger", RETURNED: "danger",
};

export function VehicleTripList() {
  const router = useRouter();
  const [rows, setRows] = useState<TripRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tab, setTab] = useState<"active" | "completed" | "exceptions" | "all">("active");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (typeFilter) params.set("tripType", typeFilter);
    const j = await fetch(`/api/transport/vehicle-trip?${params.toString()}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setRows(j.rows); setStats(j.stats); }
    setLoading(false);
  }, [q, typeFilter]);
  useEffect(() => { load(); }, [load]);

  const tabRows = useMemo(() => {
    if (tab === "active") return rows.filter((r) => ACTIVE_STATUSES.includes(r.status));
    if (tab === "completed") return rows.filter((r) => r.status === "COMPLETED");
    if (tab === "exceptions") return rows.filter((r) => EXCEPTION_STATUSES.includes(r.status));
    return rows;
  }, [rows, tab]);
  const pageRows = useMemo(() => { const start = (page - 1) * pageSize; return tabRows.slice(start, start + pageSize); }, [tabRows, page, pageSize]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Vehicle Trip Management</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Waypoints className="h-5 w-5 text-primary" /> Vehicle Trip Management</h1>
          <p className="mt-0.5 text-sm text-muted">The common operational-journey engine over Sales Dispatch and Purchase GRN — plus manual trips for everything else. Sales/Purchase trips appear here automatically the moment a vehicle is gated in.</p>
        </div>
        <Button size="md" onClick={() => router.push("/masters/transport/vehicle-trip/new")}><Plus className="h-4 w-4" /> Create Trip</Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          <StatCard label="Planned" value={stats.planned} />
          <StatCard label="Assigned" value={stats.assigned} />
          <StatCard label="Started" value={stats.started} />
          <StatCard label="In Transit" value={stats.inTransit} tone="warning" />
          <StatCard label="Arrived" value={stats.arrived} tone="warning" />
          <StatCard label="Completed" value={stats.completed} tone="success" />
          <StatCard label="Completed Today" value={stats.completedToday} tone="success" />
          <StatCard label="Completed This Week" value={stats.completedThisWeek} tone="success" />
          <StatCard label="On Hold" value={stats.onHold} tone="warning" />
          <StatCard label="Cancelled" value={stats.cancelled} tone="danger" />
          <StatCard label="Returned" value={stats.returned} tone="danger" />
          <StatCard label="Vehicles on Trip" value={stats.vehiclesOnTrip} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
          {([["active", "Active Trips"], ["completed", "Completed Trips"], ["exceptions", "Exceptions"], ["all", "Trip History"]] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => { setTab(k); setPage(1); }} className={cn("px-3 py-1.5 font-semibold transition", tab === k ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
          ))}
        </div>
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search trip no, material…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="h-9 rounded-md border border-border bg-surface-2 px-2.5 text-xs font-medium text-foreground focus:border-primary focus:bg-surface focus:outline-none"><option value="">All Types</option>{TRIP_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>
        : tabRows.length === 0 ? <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No trips here yet.</div>
        : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2.5 text-left">Trip No</th>
              <th className="px-3 py-2.5 text-left">Type</th>
              <th className="px-3 py-2.5 text-left">Vehicle</th>
              <th className="px-3 py-2.5 text-left">Driver</th>
              <th className="px-3 py-2.5 text-left">Source → Destination</th>
              <th className="px-3 py-2.5 text-left">Material</th>
              <th className="px-3 py-2.5 text-right">Planned Qty</th>
              <th className="px-3 py-2.5 text-right">Actual Qty</th>
              <th className="px-3 py-2.5 text-right">Trip KM</th>
              <th className="px-3 py-2.5 text-center">Status</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2/20" onClick={() => router.push(`/masters/transport/vehicle-trip/${r.id}`)}>
                  <td className="px-3 py-2 font-medium text-foreground">{r.tripNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.tripType}{r.tripPurpose ? ` · ${r.tripPurpose}` : ""}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.driverName ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.sourceLocation ?? "—"} → {r.destinationLocation ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.materialName ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-2xs text-muted">{r.plannedQty != null ? `${r.plannedQty} ${r.uom ?? ""}` : "—"}</td>
                  <td className="px-3 py-2 text-right text-2xs text-muted">{r.actualQty != null ? `${r.actualQty} ${r.uom ?? ""}` : "—"}</td>
                  <td className="px-3 py-2 text-right text-2xs text-muted">{r.tripDistance != null ? r.tripDistance : "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={TRIP_STATUS_TONE[r.status] ?? "neutral"}>{TRIP_STATUS_LABEL[r.status as keyof typeof TRIP_STATUS_LABEL] ?? r.status}</Badge></td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => router.push(`/masters/transport/vehicle-trip/${r.id}`)} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-primary/30 hover:bg-primary-subtle hover:text-primary"><Eye className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tabRows.length > 0 && <Pagination page={page} pageSize={pageSize} total={tabRows.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="trips" />}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <p className={cn("text-xl font-bold tabular-nums", toneClass)}>{value}</p>
      <p className="mt-0.5 text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
    </div>
  );
}
