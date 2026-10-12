"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wrench, ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { ItemLinesEditor, LabourLinesEditor } from "@/components/transport/masters/MaintenanceLineEditors";
import { MAINTENANCE_CATEGORY_OPTS, maintenanceInput, type MaintenanceInput } from "@/lib/contracts/vehicleMaintenance";

interface VehicleOption { id: number; vehicleNo: string }
interface ScheduleOption { id: number; scheduleNo: string; maintenanceType: string; vehicleId: number }
interface WorkshopOption { id: number; name: string }

const BLANK: MaintenanceInput = {
  vehicleId: 0, scheduleId: null, maintenanceType: "", maintenanceCategory: "Preventive", serviceDate: new Date().toISOString().slice(0, 10),
  odometer: null, workshopId: null, workshopName: "", mechanic: "", description: "", workPerformed: "",
  workshopCost: 0, otherCost: 0, nextDueDate: "", nextDueKm: null, remarks: "", items: [], labour: [],
};

export function MaintenanceServiceForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [f, setF] = useState<MaintenanceInput>(BLANK);
  const set = <K extends keyof MaintenanceInput>(k: K, v: MaintenanceInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    (async () => {
      const [v, s, w] = await Promise.all([
        fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/vehicle-maintenance-schedule?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch(`/api/masters/suppliers?category=${encodeURIComponent("Workshop")}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (v?.ok) setVehicles(v.rows);
      if (s?.ok) setSchedules(s.rows);
      if (w?.ok) setWorkshops(w.suppliers);
      setLoading(false);
    })();
  }, []);

  const partsCost = f.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const labourCost = f.labour.reduce((s, l) => s + (l.hours ?? 1) * l.rate, 0);
  const totalCost = partsCost + labourCost + f.workshopCost + f.otherCost;

  async function save() {
    const parsed = maintenanceInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/vehicle-maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Created."); router.push(`/masters/transport/vehicle-maintenance/service/${j.id}`); }
    else toast.error(j.message || "Could not save.");
  }

  const vehicleSchedules = schedules.filter((s) => s.vehicleId === f.vehicleId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/vehicle-maintenance" className="hover:text-foreground">Vehicle Maintenance</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New Service Entry</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wrench className="h-5 w-5 text-primary" /> New Service Entry</h1>
        </div>
        <Link href="/masters/transport/vehicle-maintenance"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          <SectionCard icon={Wrench} title="Service Details">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Vehicle *</label><select value={f.vehicleId || ""} onChange={(e) => set("vehicleId", Number(e.target.value) || 0)} className={inp}><option value="">— Select —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}</select></div>
              <div><label className={lbl}>Schedule (optional)</label><select value={f.scheduleId ?? ""} onChange={(e) => set("scheduleId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{vehicleSchedules.map((s) => <option key={s.id} value={s.id}>{s.scheduleNo} · {s.maintenanceType}</option>)}</select></div>
              <div><label className={lbl}>Maintenance Category</label><select value={f.maintenanceCategory} onChange={(e) => set("maintenanceCategory", e.target.value as MaintenanceInput["maintenanceCategory"])} className={inp}>{MAINTENANCE_CATEGORY_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className={lbl}>Maintenance Type *</label><input list="maint-types" value={f.maintenanceType} onChange={(e) => set("maintenanceType", e.target.value)} placeholder="e.g. Periodic Service" className={inp} /></div>
              <div><label className={lbl}>Service Date *</label><input type="date" value={f.serviceDate} onChange={(e) => set("serviceDate", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Odometer (KM)</label><input type="number" min={0} value={f.odometer ?? ""} onChange={(e) => set("odometer", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
              <div><label className={lbl}>Workshop</label><select value={f.workshopId ?? ""} onChange={(e) => set("workshopId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
              <div><label className={lbl}>Workshop Name (if not listed)</label><input value={f.workshopName ?? ""} onChange={(e) => set("workshopName", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Mechanic</label><input value={f.mechanic ?? ""} onChange={(e) => set("mechanic", e.target.value)} className={inp} /></div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Description</label><textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} className={inp + " h-auto py-2"} /></div>
              <div><label className={lbl}>Work Performed</label><textarea value={f.workPerformed ?? ""} onChange={(e) => set("workPerformed", e.target.value)} rows={2} className={inp + " h-auto py-2"} /></div>
            </div>
          </SectionCard>

          <SectionCard icon={Wrench} title="Spare Parts">
            <ItemLinesEditor items={f.items} onChange={(rows) => set("items", rows)} />
          </SectionCard>

          <SectionCard icon={Wrench} title="Labour Charges">
            <LabourLinesEditor labour={f.labour} onChange={(rows) => set("labour", rows)} />
          </SectionCard>

          <SectionCard icon={Wrench} title="Other Charges & Cost Summary">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Workshop Charges</label><input type="number" min={0} value={f.workshopCost} onChange={(e) => set("workshopCost", Number(e.target.value) || 0)} className={inp} /></div>
              <div><label className={lbl}>Other Charges (towing/consumables/misc)</label><input type="number" min={0} value={f.otherCost} onChange={(e) => set("otherCost", Number(e.target.value) || 0)} className={inp} /></div>
            </div>
            <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
              <div className="flex justify-between text-muted"><span>Parts Cost</span><span>₹{partsCost.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted"><span>Labour Cost</span><span>₹{labourCost.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted"><span>Workshop Cost</span><span>₹{f.workshopCost.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted"><span>Other Cost</span><span>₹{f.otherCost.toFixed(2)}</span></div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-bold text-foreground"><span>Total Cost</span><span>₹{totalCost.toFixed(2)}</span></div>
            </div>
          </SectionCard>

          <SectionCard icon={Wrench} title="Next Due & Remarks">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className={lbl}>Next Due Date</label><input type="date" value={f.nextDueDate ?? ""} onChange={(e) => set("nextDueDate", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Next Due KM</label><input type="number" min={0} value={f.nextDueKm ?? ""} onChange={(e) => set("nextDueKm", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
              <div><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
            </div>
          </SectionCard>

          <datalist id="maint-types">
            <option value="Periodic Service" /><option value="Engine Oil Change" /><option value="Oil Filter Replacement" /><option value="Air Filter Replacement" />
            <option value="Brake Inspection" /><option value="Brake Service" /><option value="Coolant Check" /><option value="Battery Check" /><option value="Greasing" /><option value="General Inspection" /><option value="Repair" />
          </datalist>

          <div className="flex items-center justify-end gap-2">
            <Link href="/masters/transport/vehicle-maintenance"><Button variant="outline" size="md">Cancel</Button></Link>
            <Button size="md" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Create Service Entry"}</Button>
          </div>
        </>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
