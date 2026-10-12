"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link2, Plus, Pencil, Eye, Ban, Repeat, History as HistoryIcon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  ASSIGNMENT_TYPE_OPTS, ASSIGNMENT_STATUS_OPTS, vehicleAssignmentInput, reassignInput,
  type AssignmentRow, type AssignmentDetail, type VehicleAssignmentInput, type ReassignInput,
} from "@/lib/contracts/vehicleAssignment";

interface VehicleOption { id: number; vehicleNo: string; vehicleType: string | null; vehicleCategory: string | null; capacity: number; capacityUnit: string | null; ownerType: string; transportCompanyName: string | null; status: string }
interface DriverOption { id: number; driverCode: string | null; name: string; phone: string | null; licenseNo: string | null; licenseExpiry: string | null; status: string }

const STATUS_TONE: Record<string, "success" | "neutral" | "danger"> = { Active: "success", Completed: "neutral", Cancelled: "danger" };

export function VehicleDriverAssignmentList({ vehicleFilter, driverFilter, embedded }: { vehicleFilter?: number; driverFilter?: number; embedded?: boolean } = {}) {
  const toast = useToast();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(embedded ? "All" : "Active");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [modal, setModal] = useState<{ mode: "add" | "edit" | "view"; id?: number } | null>(null);
  const [cancelRow, setCancelRow] = useState<AssignmentRow | null>(null);
  const [reassignRow, setReassignRow] = useState<AssignmentRow | null>(null);
  const [historyFor, setHistoryFor] = useState<{ kind: "vehicle" | "driver"; id: number; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (typeFilter) params.set("assignmentType", typeFilter);
    if (statusFilter && statusFilter !== "All") params.set("status", statusFilter);
    if (vehicleFilter) params.set("vehicleId", String(vehicleFilter));
    if (driverFilter) params.set("driverId", String(driverFilter));
    const [j, v, d] = await Promise.all([
      fetch(`/api/transport/vehicle-assignment?${params.toString()}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/transport/masters/driver?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    if (j?.ok) setRows(j.rows);
    if (v?.ok) setVehicles(v.rows);
    if (d?.ok) setDrivers(d.rows);
    setLoading(false);
  }, [q, typeFilter, statusFilter, vehicleFilter, driverFilter]);
  useEffect(() => { load(); }, [load]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Vehicle-Driver Assignment</span></div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Link2 className="h-5 w-5 text-primary" /> Vehicle-Driver Assignment</h1>
            <p className="mt-0.5 text-sm text-muted">Link vehicles to drivers over time — a driver can run several vehicles, a vehicle can have several drivers across periods.</p>
          </div>
          <Button size="md" onClick={() => setModal({ mode: "add" })}><Plus className="h-4 w-4" /> New Assignment</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search assignment no, vehicle, driver…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className={filterInp}><option value="">All Types</option>{ASSIGNMENT_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={filterInp}><option value="All">All Statuses</option>{ASSIGNMENT_STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>
        : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No assignments yet. {!embedded && <button onClick={() => setModal({ mode: "add" })} className="font-semibold text-primary hover:underline">Create one →</button>}</div>
        : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2.5 text-left">Assignment No.</th>
              <th className="px-3 py-2.5 text-left">Vehicle</th>
              <th className="px-3 py-2.5 text-left">Driver</th>
              <th className="px-3 py-2.5 text-left">Type</th>
              <th className="px-3 py-2.5 text-left">From</th>
              <th className="px-3 py-2.5 text-left">To</th>
              <th className="px-3 py-2.5 text-center">Status</th>
              <th className="px-3 py-2.5 text-center">Primary</th>
              <th className="px-3 py-2.5 text-left">Created By</th>
              <th className="px-3 py-2.5 text-left">Created</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.assignmentNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.driverName}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.assignmentType}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.fromDate}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.toDate ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={STATUS_TONE[r.effectiveStatus] ?? "neutral"}>{r.effectiveStatus}</Badge></td>
                  <td className="px-3 py-2 text-center">{r.isPrimary ? <Badge tone="info">Yes</Badge> : <span className="text-2xs text-subtle">No</span>}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.createdByName ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => setModal({ mode: "view", id: r.id })} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-primary/30 hover:bg-primary-subtle hover:text-primary"><Eye className="h-4 w-4" /></button>
                    {r.effectiveStatus === "Active" && <button onClick={() => setModal({ mode: "edit", id: r.id })} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></button>}
                    {r.effectiveStatus === "Active" && <button onClick={() => setReassignRow(r)} title="Reassign" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-info/30 hover:bg-info-subtle hover:text-info"><Repeat className="h-4 w-4" /></button>}
                    {r.effectiveStatus === "Active" && <button onClick={() => setCancelRow(r)} title="Cancel" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-danger/30 hover:bg-danger-subtle hover:text-danger"><Ban className="h-4 w-4" /></button>}
                    <button onClick={() => setHistoryFor({ kind: "vehicle", id: r.vehicleId, label: r.vehicleNo })} title="Vehicle History" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-border-strong hover:bg-surface-2"><HistoryIcon className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <Pagination page={page} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="assignments" />
        )}
        </div>
      )}

      {modal && (
        <AssignmentModal
          mode={modal.mode} id={modal.id} vehicles={vehicles} drivers={drivers}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }}
        />
      )}
      {cancelRow && <CancelModal row={cancelRow} onClose={() => setCancelRow(null)} onCancelled={() => { setCancelRow(null); load(); }} />}
      {reassignRow && <ReassignModal row={reassignRow} drivers={drivers} onClose={() => setReassignRow(null)} onReassigned={() => { setReassignRow(null); load(); }} />}
      {historyFor && <HistoryModal target={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------ modals */

function AssignmentModal({ mode, id, vehicles, drivers, onClose, onSaved }: { mode: "add" | "edit" | "view"; id?: number; vehicles: VehicleOption[]; drivers: DriverOption[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const readOnly = mode === "view";
  const BLANK: VehicleAssignmentInput = { vehicleId: 0, driverId: 0, assignmentType: "Primary", isPrimary: false, fromDate: "", toDate: "", remarks: "" };
  const [f, setF] = useState<VehicleAssignmentInput>(BLANK);
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof VehicleAssignmentInput>(k: K, v: VehicleAssignmentInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!id) return;
    fetch(`/api/transport/vehicle-assignment/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok) {
        setDetail(j.row);
        setF({ vehicleId: j.row.vehicleId, driverId: j.row.driverId, assignmentType: j.row.assignmentType, isPrimary: j.row.isPrimary, fromDate: j.row.fromDate, toDate: j.row.toDate ?? "", remarks: j.row.remarks ?? "" });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const selectedVehicle = vehicles.find((v) => v.id === f.vehicleId) ?? (detail?.vehicle ?? null);
  const selectedDriver = drivers.find((d) => d.id === f.driverId) ?? (detail?.driver ?? null);

  async function save() {
    const parsed = vehicleAssignmentInput.safeParse(f);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setErrors({});
    setBusy(true);
    const j = await fetch(id ? `/api/transport/vehicle-assignment/${id}` : "/api/transport/vehicle-assignment", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json());
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); onSaved(); } else { toast.error(j.message || "Could not save."); if (j.errors) setErrors(j.errors); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-base font-bold text-foreground">{mode === "add" ? "New" : mode === "view" ? "View" : "Edit"} Assignment{detail ? ` · ${detail.assignmentNo}` : ""}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading ? <AppLoader label="Loading…" size="sm" /> : (
            <div className="space-y-5">
              <Section title="Assignment Information">
                <div>
                  <label className={lbl}>Vehicle *</label>
                  <select disabled={readOnly} value={f.vehicleId || ""} onChange={(e) => set("vehicleId", Number(e.target.value) || 0)} className={inp}>
                    <option value="">— Select —</option>
                    {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}
                    {detail && !vehicles.some((v) => v.id === detail.vehicleId) && <option value={detail.vehicleId}>{detail.vehicleNo}</option>}
                  </select>
                  {errors.vehicleId && <p className={errTxt}>{errors.vehicleId}</p>}
                </div>
                <div>
                  <label className={lbl}>Driver *</label>
                  <select disabled={readOnly} value={f.driverId || ""} onChange={(e) => set("driverId", Number(e.target.value) || 0)} className={inp}>
                    <option value="">— Select —</option>
                    {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    {detail && !drivers.some((d) => d.id === detail.driverId) && <option value={detail.driverId}>{detail.driverName}</option>}
                  </select>
                  {errors.driverId && <p className={errTxt}>{errors.driverId}</p>}
                </div>
                <div><label className={lbl}>Assignment Type</label><select disabled={readOnly} value={f.assignmentType} onChange={(e) => set("assignmentType", e.target.value as VehicleAssignmentInput["assignmentType"])} className={inp}>{ASSIGNMENT_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className={lbl}>Primary Driver</label><select disabled={readOnly} value={f.isPrimary ? "yes" : "no"} onChange={(e) => set("isPrimary", e.target.value === "yes")} className={inp}><option value="no">No</option><option value="yes">Yes</option></select></div>
                <div><label className={lbl}>From Date *</label><input disabled={readOnly} type="date" value={f.fromDate} onChange={(e) => set("fromDate", e.target.value)} className={inp} />{errors.fromDate && <p className={errTxt}>{errors.fromDate}</p>}</div>
                <div><label className={lbl}>To Date</label><input disabled={readOnly} type="date" value={f.toDate ?? ""} onChange={(e) => set("toDate", e.target.value)} placeholder="Ongoing" className={inp} />{errors.toDate && <p className={errTxt}>{errors.toDate}</p>}</div>
                {detail && <div><label className={lbl}>Status</label><Badge tone={STATUS_TONE[detail.effectiveStatus] ?? "neutral"}>{detail.effectiveStatus}</Badge></div>}
                <div className="sm:col-span-3"><label className={lbl}>Remarks</label><input disabled={readOnly} value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
              </Section>

              {selectedVehicle && (
                <Section title="Vehicle Details">
                  <ReadKV k="Vehicle No" v={selectedVehicle.vehicleNo} />
                  <ReadKV k="Vehicle Type" v={selectedVehicle.vehicleType || "—"} />
                  <ReadKV k="Vehicle Category" v={selectedVehicle.vehicleCategory || "—"} />
                  <ReadKV k="Capacity" v={selectedVehicle.capacity ? `${selectedVehicle.capacity} ${selectedVehicle.capacityUnit ?? ""}` : "—"} />
                  <ReadKV k="Ownership Type" v={selectedVehicle.ownerType} />
                  <ReadKV k="Transporter" v={selectedVehicle.transportCompanyName || "—"} />
                  <ReadKV k="Vehicle Status" v={selectedVehicle.status} />
                </Section>
              )}

              {selectedDriver && (
                <Section title="Driver Details">
                  <ReadKV k="Driver Code" v={selectedDriver.driverCode || "—"} />
                  <ReadKV k="Driver Name" v={selectedDriver.name} />
                  <ReadKV k="Mobile Number" v={selectedDriver.phone || "—"} />
                  <ReadKV k="Licence Number" v={selectedDriver.licenseNo || "—"} />
                  <ReadKV k="Licence Expiry" v={selectedDriver.licenseExpiry || "—"} />
                  <ReadKV k="Driver Status" v={selectedDriver.status} />
                </Section>
              )}

              {detail && (mode === "view") && (
                <Section title="Audit">
                  <ReadKV k="Created By" v={detail.createdByName ? `${detail.createdByName} · ${new Date(detail.createdAt).toLocaleString()}` : "—"} />
                  <ReadKV k="Updated By" v={detail.updatedByName ? `${detail.updatedByName} · ${new Date(detail.updatedAt).toLocaleString()}` : "—"} />
                  {detail.cancelledAt && <ReadKV k="Cancelled" v={`${detail.cancelledByName ?? "—"} · ${new Date(detail.cancelledAt).toLocaleString()}${detail.cancellationReason ? ` — ${detail.cancellationReason}` : ""}`} />}
                </Section>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          {!readOnly && <Button size="sm" onClick={save} disabled={busy || loading}>{busy ? "Saving…" : "Save"}</Button>}
        </div>
      </div>
    </div>
  );
}

function CancelModal({ row, onClose, onCancelled }: { row: AssignmentRow; onClose: () => void; onCancelled: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason.trim()) { toast.error("Enter a cancellation reason."); return; }
    setBusy(true);
    const j = await fetch(`/api/transport/vehicle-assignment/${row.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancellationReason: reason }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Cancelled."); onCancelled(); } else toast.error(j.message || "Could not cancel.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <h2 className="text-sm font-bold text-foreground">Cancel Assignment {row.assignmentNo}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-xs text-muted">{row.driverName} · {row.vehicleNo} · {row.assignmentType}</p>
          <div><label className={lbl}>Cancellation Reason *</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={cn(inp, "h-auto py-2")} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <Button variant="danger" size="sm" onClick={submit} disabled={busy}>{busy ? "Cancelling…" : "Cancel Assignment"}</Button>
        </div>
      </div>
    </div>
  );
}

function ReassignModal({ row, drivers, onClose, onReassigned }: { row: AssignmentRow; drivers: DriverOption[]; onClose: () => void; onReassigned: () => void }) {
  const toast = useToast();
  const BLANK: ReassignInput = { driverId: 0, assignmentType: row.assignmentType as ReassignInput["assignmentType"], isPrimary: row.isPrimary, fromDate: "", toDate: "", remarks: "" };
  const [f, setF] = useState<ReassignInput>(BLANK);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ReassignInput>(k: K, v: ReassignInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    const parsed = reassignInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch(`/api/transport/vehicle-assignment/${row.id}/reassign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Reassigned."); onReassigned(); } else toast.error(j.message || "Could not reassign.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <h2 className="text-sm font-bold text-foreground">Reassign {row.vehicleNo}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-xs text-muted">Current: {row.driverName} ({row.assignmentType}) from {row.fromDate}. This will end that assignment and start a new one.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={lbl}>New Driver *</label><select value={f.driverId || ""} onChange={(e) => set("driverId", Number(e.target.value) || 0)} className={inp}><option value="">— Select —</option>{drivers.filter((d) => d.id !== row.driverId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className={lbl}>Assignment Type</label><select value={f.assignmentType} onChange={(e) => set("assignmentType", e.target.value as ReassignInput["assignmentType"])} className={inp}>{ASSIGNMENT_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className={lbl}>Primary Driver</label><select value={f.isPrimary ? "yes" : "no"} onChange={(e) => set("isPrimary", e.target.value === "yes")} className={inp}><option value="no">No</option><option value="yes">Yes</option></select></div>
            <div><label className={lbl}>From Date *</label><input type="date" value={f.fromDate} onChange={(e) => set("fromDate", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>To Date</label><input type="date" value={f.toDate ?? ""} onChange={(e) => set("toDate", e.target.value)} placeholder="Ongoing" className={inp} /></div>
            <div className="sm:col-span-2"><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" onClick={submit} disabled={busy}>{busy ? "Reassigning…" : "Reassign"}</Button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ target, onClose }: { target: { kind: "vehicle" | "driver"; id: number; label: string }; onClose: () => void }) {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(target.kind === "vehicle" ? { vehicleId: String(target.id) } : { driverId: String(target.id) });
    fetch(`/api/transport/vehicle-assignment?${p.toString()}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : [])).catch(() => setRows([]));
  }, [target]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <h2 className="text-sm font-bold text-foreground">{target.kind === "vehicle" ? "Vehicle" : "Driver"} History · {target.label}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-5">
          {rows === null ? <AppLoader label="Loading…" size="sm" /> : rows.length === 0 ? <p className="text-sm text-muted">No assignment history.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-2xs uppercase tracking-wide text-muted">
                <th className="py-2 text-left">{target.kind === "vehicle" ? "Driver" : "Vehicle"}</th>
                <th className="py-2 text-left">Type</th>
                <th className="py-2 text-left">From</th>
                <th className="py-2 text-left">To</th>
                <th className="py-2 text-center">Status</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 font-medium text-foreground">{target.kind === "vehicle" ? r.driverName : r.vehicleNo}</td>
                    <td className="py-2 text-2xs text-muted">{r.assignmentType}{r.isPrimary ? " · Primary" : ""}</td>
                    <td className="py-2 text-2xs text-muted">{r.fromDate}</td>
                    <td className="py-2 text-2xs text-muted">{r.toDate ?? "—"}</td>
                    <td className="py-2 text-center"><Badge tone={STATUS_TONE[r.effectiveStatus] ?? "neutral"}>{r.effectiveStatus}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <p className="text-xs font-bold uppercase tracking-wide text-primary">{title}</p>
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
    </div>
  );
}
function ReadKV({ k, v }: { k: string; v: string }) {
  return <div><p className="text-2xs font-semibold text-muted">{k}</p><p className="text-sm text-foreground">{v}</p></div>;
}

const filterInp = "h-9 rounded-md border border-border bg-surface-2 px-2.5 text-xs font-medium text-foreground focus:border-primary focus:bg-surface focus:outline-none";
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
const errTxt = "mt-1 text-2xs font-medium text-danger";
