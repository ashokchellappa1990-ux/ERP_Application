"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CalendarClock, ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { TRIGGER_TYPE_OPTS, SCHEDULE_STATUS_OPTS, scheduleInput, type ScheduleInput } from "@/lib/contracts/vehicleMaintenance";

interface VehicleOption { id: number; vehicleNo: string }
const BLANK: ScheduleInput = { vehicleId: 0, maintenanceType: "", triggerType: "KM", intervalKm: null, intervalMonths: null, lastServiceDate: "", lastServiceKm: null, nextDueDate: "", nextDueKm: null, alertBeforeDays: 7, alertBeforeKm: null, status: "Active", remarks: "" };
const SCHEDULE_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { Upcoming: "success", Due: "warning", Overdue: "danger", "Not Set": "neutral" };

export function MaintenanceScheduleForm({ mode }: { mode: "new" | "edit" }) {
  const params = useParams<{ id?: string }>();
  const id = mode === "edit" ? Number(params.id) : undefined;
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(mode === "edit");
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [f, setF] = useState<ScheduleInput>(BLANK);
  const [dueInfo, setDueInfo] = useState<{ dueStatus: string; dueInKm: number | null; dueInDays: number | null; currentKm: number | null } | null>(null);
  const set = <K extends keyof ScheduleInput>(k: K, v: ScheduleInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setVehicles(j.rows); }).catch(() => {});
    if (id) {
      fetch(`/api/transport/vehicle-maintenance-schedule/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
        if (j.ok) {
          setF({ vehicleId: j.row.vehicleId, maintenanceType: j.row.maintenanceType, triggerType: j.row.triggerType, intervalKm: j.row.intervalKm, intervalMonths: j.row.intervalMonths, lastServiceDate: j.row.lastServiceDate ?? "", lastServiceKm: j.row.lastServiceKm, nextDueDate: j.row.nextDueDate ?? "", nextDueKm: j.row.nextDueKm, alertBeforeDays: j.row.alertBeforeDays, alertBeforeKm: j.row.alertBeforeKm, status: j.row.status, remarks: j.row.remarks ?? "" });
          setDueInfo({ dueStatus: j.row.dueStatus, dueInKm: j.row.dueInKm, dueInDays: j.row.dueInDays, currentKm: j.row.currentKm });
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [id]);

  async function save() {
    const parsed = scheduleInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch(id ? `/api/transport/vehicle-maintenance-schedule/${id}` : "/api/transport/vehicle-maintenance-schedule", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); router.push("/masters/transport/vehicle-maintenance"); }
    else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/vehicle-maintenance" className="hover:text-foreground">Vehicle Maintenance</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{mode === "new" ? "New Schedule" : "Schedule"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><CalendarClock className="h-5 w-5 text-primary" /> {mode === "new" ? "New Maintenance Schedule" : "Maintenance Schedule"} {dueInfo && <Badge tone={SCHEDULE_TONE[dueInfo.dueStatus] ?? "neutral"}>{dueInfo.dueStatus}</Badge>}</h1>
        </div>
        <Link href="/masters/transport/vehicle-maintenance"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          {dueInfo && (
            <SectionCard icon={CalendarClock} title="Current Status">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><p className="text-2xs font-semibold text-muted">Current KM (from latest trip)</p><p className="text-sm text-foreground">{dueInfo.currentKm ?? "—"}</p></div>
                <div><p className="text-2xs font-semibold text-muted">Due In / Overdue By (KM)</p><p className="text-sm text-foreground">{dueInfo.dueInKm != null ? dueInfo.dueInKm : "—"}</p></div>
                <div><p className="text-2xs font-semibold text-muted">Due In / Overdue By (Days)</p><p className="text-sm text-foreground">{dueInfo.dueInDays != null ? dueInfo.dueInDays : "—"}</p></div>
              </div>
            </SectionCard>
          )}

          <SectionCard icon={CalendarClock} title="Schedule">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Vehicle *</label><select value={f.vehicleId || ""} onChange={(e) => set("vehicleId", Number(e.target.value) || 0)} className={inp}><option value="">— Select —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}</select></div>
              <div><label className={lbl}>Maintenance Type *</label><input list="maint-types" value={f.maintenanceType} onChange={(e) => set("maintenanceType", e.target.value)} placeholder="e.g. Periodic Service" className={inp} /></div>
              <div><label className={lbl}>Trigger Type</label><select value={f.triggerType} onChange={(e) => set("triggerType", e.target.value as ScheduleInput["triggerType"])} className={inp}>{TRIGGER_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            </div>
          </SectionCard>

          {(f.triggerType === "KM" || f.triggerType === "Both") && (
            <SectionCard icon={CalendarClock} title="KM Configuration">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className={lbl}>Interval KM</label><input type="number" min={0} value={f.intervalKm ?? ""} onChange={(e) => set("intervalKm", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
                <div><label className={lbl}>Last Service KM</label><input type="number" min={0} value={f.lastServiceKm ?? ""} onChange={(e) => set("lastServiceKm", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
                <div><label className={lbl}>Next Due KM</label><input type="number" min={0} value={f.nextDueKm ?? ""} onChange={(e) => set("nextDueKm", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
                <div><label className={lbl}>Alert Before (KM)</label><input type="number" min={0} value={f.alertBeforeKm ?? ""} onChange={(e) => set("alertBeforeKm", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
              </div>
            </SectionCard>
          )}

          {(f.triggerType === "Date" || f.triggerType === "Both") && (
            <SectionCard icon={CalendarClock} title="Date Configuration">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className={lbl}>Interval (Months)</label><input type="number" min={0} value={f.intervalMonths ?? ""} onChange={(e) => set("intervalMonths", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
                <div><label className={lbl}>Last Service Date</label><input type="date" value={f.lastServiceDate ?? ""} onChange={(e) => set("lastServiceDate", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Next Due Date</label><input type="date" value={f.nextDueDate ?? ""} onChange={(e) => set("nextDueDate", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Alert Before (Days)</label><input type="number" min={0} value={f.alertBeforeDays ?? ""} onChange={(e) => set("alertBeforeDays", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
              </div>
            </SectionCard>
          )}

          <SectionCard icon={CalendarClock} title="Status & Remarks">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className={lbl}>Status</label><select value={f.status} onChange={(e) => set("status", e.target.value as ScheduleInput["status"])} className={inp}>{SCHEDULE_STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="sm:col-span-2"><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
            </div>
          </SectionCard>

          <datalist id="maint-types">
            <option value="Periodic Service" /><option value="Engine Oil Change" /><option value="Oil Filter Replacement" /><option value="Air Filter Replacement" />
            <option value="Brake Inspection" /><option value="Brake Service" /><option value="Coolant Check" /><option value="Battery Check" /><option value="Greasing" /><option value="General Inspection" />
          </datalist>

          <div className="flex items-center justify-end gap-2">
            <Link href="/masters/transport/vehicle-maintenance"><Button variant="outline" size="md">Cancel</Button></Link>
            <Button size="md" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Schedule"}</Button>
          </div>
        </>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
