"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { BREAKDOWN_TYPE_OPTS, PRIORITY_OPTS, breakdownInput, type BreakdownInput } from "@/lib/contracts/vehicleMaintenance";

interface VehicleOption { id: number; vehicleNo: string }
interface DriverOption { id: number; name: string }
interface TripOption { id: number; tripNo: string; vehicleId: number }
interface WorkshopOption { id: number; name: string }

const BLANK: BreakdownInput = {
  vehicleId: 0, driverId: null, tripId: null, breakdownDate: new Date().toISOString().slice(0, 16),
  odometer: null, location: "", breakdownType: "", problemDescription: "", priority: "Normal",
  workshopId: null, workshopName: "", remarks: "",
};

export function BreakdownForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [f, setF] = useState<BreakdownInput>(BLANK);
  const set = <K extends keyof BreakdownInput>(k: K, v: BreakdownInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    (async () => {
      const [v, d, t, w] = await Promise.all([
        fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/masters/driver?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/vehicle-trip?status=STARTED", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch(`/api/masters/suppliers?category=${encodeURIComponent("Workshop")}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (v?.ok) setVehicles(v.rows);
      if (d?.ok) setDrivers(d.rows);
      if (t?.ok) setTrips(t.rows);
      if (w?.ok) setWorkshops(w.suppliers);
      setLoading(false);
    })();
  }, []);

  async function save() {
    const parsed = breakdownInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/vehicle-breakdown", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Reported."); router.push(`/masters/transport/vehicle-maintenance/breakdown/${j.id}`); }
    else toast.error(j.message || "Could not save.");
  }

  const vehicleTrips = trips.filter((t) => t.vehicleId === f.vehicleId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/vehicle-maintenance" className="hover:text-foreground">Vehicle Maintenance</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Report Breakdown</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><AlertTriangle className="h-5 w-5 text-danger" /> Report Breakdown</h1>
        </div>
        <Link href="/masters/transport/vehicle-maintenance"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          <SectionCard icon={AlertTriangle} title="Breakdown Details">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Vehicle *</label><select value={f.vehicleId || ""} onChange={(e) => set("vehicleId", Number(e.target.value) || 0)} className={inp}><option value="">— Select —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}</select></div>
              <div><label className={lbl}>Driver</label><select value={f.driverId ?? ""} onChange={(e) => set("driverId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className={lbl}>Active Trip (if applicable)</label><select value={f.tripId ?? ""} onChange={(e) => set("tripId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{vehicleTrips.map((t) => <option key={t.id} value={t.id}>{t.tripNo}</option>)}</select></div>
              <div><label className={lbl}>Breakdown Date/Time *</label><input type="datetime-local" value={f.breakdownDate} onChange={(e) => set("breakdownDate", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Odometer (KM)</label><input type="number" min={0} value={f.odometer ?? ""} onChange={(e) => set("odometer", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
              <div><label className={lbl}>Location</label><input value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Breakdown Type *</label><select value={f.breakdownType} onChange={(e) => set("breakdownType", e.target.value)} className={inp}><option value="">— Select —</option>{BREAKDOWN_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className={lbl}>Priority</label><select value={f.priority} onChange={(e) => set("priority", e.target.value as BreakdownInput["priority"])} className={inp}>{PRIORITY_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className={lbl}>Workshop</label><select value={f.workshopId ?? ""} onChange={(e) => set("workshopId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
            </div>
            <div className="mt-3"><label className={lbl}>Problem Description</label><textarea value={f.problemDescription ?? ""} onChange={(e) => set("problemDescription", e.target.value)} rows={3} className={inp + " h-auto py-2"} /></div>
            <div className="mt-3"><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
          </SectionCard>

          <div className="flex items-center justify-end gap-2">
            <Link href="/masters/transport/vehicle-maintenance"><Button variant="outline" size="md">Cancel</Button></Link>
            <Button size="md" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Reporting…" : "Report Breakdown"}</Button>
          </div>
        </>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
