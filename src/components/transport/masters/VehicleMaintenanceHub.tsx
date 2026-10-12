"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Plus, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import type { ScheduleRow, MaintenanceRow, BreakdownRow } from "@/lib/contracts/vehicleMaintenance";

interface Stats {
  totalVehicles: number; vehiclesUnderMaintenance: number; vehiclesAvailable: number;
  inProgress: number; completed: number; cancelled: number; breakdownVehicles: number;
  costThisMonth: number; costThisYear: number; partsCost: number; labourCost: number; workshopCost: number; otherCost: number;
}

const SCHEDULE_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { Upcoming: "success", Due: "warning", Overdue: "danger", "Not Set": "neutral" };
const SERVICE_TONE: Record<string, "neutral" | "info" | "success" | "danger"> = { Draft: "neutral", InProgress: "info", Completed: "success", Cancelled: "danger" };
const BREAKDOWN_TONE: Record<string, "warning" | "info" | "success" | "danger"> = { Reported: "warning", Inspection: "info", RepairInProgress: "info", Testing: "info", Completed: "success", Cancelled: "danger" };

export function VehicleMaintenanceHub({ vehicleFilter, embedded }: { vehicleFilter?: number; embedded?: boolean } = {}) {
  const router = useRouter();
  const [tab, setTab] = useState<"schedules" | "service" | "breakdown">(embedded ? "service" : "schedules");
  const [stats, setStats] = useState<Stats | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [services, setServices] = useState<MaintenanceRow[]>([]);
  const [breakdowns, setBreakdowns] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const vf = vehicleFilter ? `vehicleId=${vehicleFilter}&` : "";
    const [s, m, b] = await Promise.all([
      fetch(`/api/transport/vehicle-maintenance-schedule?${vf}${q ? `q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/transport/vehicle-maintenance?${vf}${q ? `q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/transport/vehicle-breakdown?${vf}${q ? `q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    if (s?.ok) setSchedules(s.rows);
    if (m?.ok) { setServices(m.rows); setStats(m.stats); }
    if (b?.ok) setBreakdowns(b.rows);
    setLoading(false);
  }, [q, vehicleFilter]);
  useEffect(() => { load(); }, [load]);

  const alerts = useMemo(() => ({
    dueToday: schedules.filter((s) => s.dueStatus === "Due").length,
    overdue: schedules.filter((s) => s.dueStatus === "Overdue").length,
  }), [schedules]);

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Vehicle Maintenance</span></div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wrench className="h-5 w-5 text-primary" /> Vehicle Maintenance</h1>
            <p className="mt-0.5 text-sm text-muted">Preventive schedules, service entries and breakdown repairs — vehicle-centric, referencing the existing Vehicle Master by id only.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="md" onClick={() => router.push("/masters/transport/vehicle-maintenance/schedule/new")}><Plus className="h-4 w-4" /> New Schedule</Button>
            <Button variant="outline" size="md" onClick={() => router.push("/masters/transport/vehicle-maintenance/service/new")}><Plus className="h-4 w-4" /> New Service Entry</Button>
            <Button size="md" onClick={() => router.push("/masters/transport/vehicle-maintenance/breakdown/new")}><Plus className="h-4 w-4" /> Report Breakdown</Button>
          </div>
        </div>
      )}

      {stats && !embedded && (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            <StatCard label="Total Vehicles" value={stats.totalVehicles} />
            <StatCard label="Under Maintenance" value={stats.vehiclesUnderMaintenance} tone="warning" />
            <StatCard label="Available" value={stats.vehiclesAvailable} tone="success" />
            <StatCard label="In Progress" value={stats.inProgress} tone="warning" />
            <StatCard label="Completed" value={stats.completed} tone="success" />
            <StatCard label="Breakdown Vehicles" value={stats.breakdownVehicles} tone="danger" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard label="Cost This Month" value={`₹${stats.costThisMonth.toLocaleString()}`} />
            <StatCard label="Cost This Year" value={`₹${stats.costThisYear.toLocaleString()}`} />
            <StatCard label="Due Alerts" value={alerts.dueToday} tone="warning" />
            <StatCard label="Overdue Alerts" value={alerts.overdue} tone="danger" />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
          {([["schedules", "Maintenance Schedule"], ["service", "Service Entries"], ["breakdown", "Breakdown Maintenance"]] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("px-3 py-1.5 font-semibold transition", tab === k ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
          ))}
        </div>
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
        </div>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          {tab === "schedules" && (
            <ListTable
              rows={schedules} empty="No maintenance schedules yet."
              columns={["Schedule No.", "Vehicle", "Type", "Trigger", "Next Due", "Status", ""]}
              renderRow={(r: ScheduleRow) => (
                <tr key={r.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2/20" onClick={() => router.push(`/masters/transport/vehicle-maintenance/schedule/${r.id}`)}>
                  <td className="px-3 py-2 font-medium text-foreground">{r.scheduleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.maintenanceType}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.triggerType}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.nextDueDate ?? "—"}{r.nextDueKm != null ? ` · ${r.nextDueKm} KM` : ""}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={SCHEDULE_TONE[r.dueStatus] ?? "neutral"}>{r.dueStatus}</Badge></td>
                  <td className="px-3 py-2 text-right"><button onClick={(e) => { e.stopPropagation(); router.push(`/masters/transport/vehicle-maintenance/schedule/${r.id}`); }} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:text-primary"><Eye className="h-4 w-4" /></button></td>
                </tr>
              )}
            />
          )}
          {tab === "service" && (
            <ListTable
              rows={services} empty="No service entries yet."
              columns={["Entry No.", "Vehicle", "Type", "Service Date", "Cost", "Status", ""]}
              renderRow={(r: MaintenanceRow) => (
                <tr key={r.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2/20" onClick={() => router.push(`/masters/transport/vehicle-maintenance/service/${r.id}`)}>
                  <td className="px-3 py-2 font-medium text-foreground">{r.maintenanceNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.maintenanceType}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.serviceDate}</td>
                  <td className="px-3 py-2 text-2xs text-muted">₹{r.totalCost.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={SERVICE_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-3 py-2 text-right"><button onClick={(e) => { e.stopPropagation(); router.push(`/masters/transport/vehicle-maintenance/service/${r.id}`); }} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:text-primary"><Eye className="h-4 w-4" /></button></td>
                </tr>
              )}
            />
          )}
          {tab === "breakdown" && (
            <ListTable
              rows={breakdowns} empty="No breakdowns reported yet."
              columns={["Breakdown No.", "Vehicle", "Type", "Priority", "Date", "Status", ""]}
              renderRow={(r: BreakdownRow) => (
                <tr key={r.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2/20" onClick={() => router.push(`/masters/transport/vehicle-maintenance/breakdown/${r.id}`)}>
                  <td className="px-3 py-2 font-medium text-foreground">{r.breakdownNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.breakdownType}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.priority}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{new Date(r.breakdownDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={BREAKDOWN_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-3 py-2 text-right"><button onClick={(e) => { e.stopPropagation(); router.push(`/masters/transport/vehicle-maintenance/breakdown/${r.id}`); }} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:text-primary"><Eye className="h-4 w-4" /></button></td>
                </tr>
              )}
            />
          )}
        </>
      )}
    </div>
  );
}

function ListTable<T>({ rows, columns, renderRow, empty }: { rows: T[]; columns: string[]; renderRow: (r: T) => React.ReactNode; empty: string }) {
  if (rows.length === 0) return <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">{empty}</div>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted">
          {columns.map((c, i) => <th key={i} className={cn("px-3 py-2.5", i === columns.length - 1 ? "text-right" : "text-left")}>{c}</th>)}
        </tr></thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div></div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: "success" | "warning" | "danger" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <p className={cn("text-xl font-bold tabular-nums", toneClass)}>{value}</p>
      <p className="mt-0.5 text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
    </div>
  );
}
