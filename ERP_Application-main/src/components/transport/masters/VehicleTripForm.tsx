"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Waypoints, ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { TRIP_TYPE_OPTS, TRIP_PURPOSE_OPTS, tripCreateInput, type TripCreateInput, type TripType } from "@/lib/contracts/vehicleTrip";

interface VehicleOption { id: number; vehicleNo: string }
interface DriverOption { id: number; name: string }
interface CompanyOption { id: number; name: string }

const BLANK: TripCreateInput = {
  tripType: "Other", tripPurpose: "", vehicleId: 0, driverId: null, transportCompanyId: null,
  sourceLocation: "", destinationLocation: "", materialName: "", plannedQty: null, uom: "", plannedStartAt: "", remarks: "",
};

export function VehicleTripForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [f, setF] = useState<TripCreateInput>(BLANK);
  const set = <K extends keyof TripCreateInput>(k: K, v: TripCreateInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    (async () => {
      const [v, d, c] = await Promise.all([
        fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/masters/driver?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/masters/transport-company", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (v?.ok) setVehicles(v.rows);
      if (d?.ok) setDrivers(d.rows);
      if (c?.ok) setCompanies(c.rows);
      setLoading(false);
    })();
  }, []);

  async function save() {
    const parsed = tripCreateInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/vehicle-trip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Trip created."); router.push(`/masters/transport/vehicle-trip/${j.id}`); }
    else toast.error(j.message || "Could not create the trip.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/vehicle-trip" className="hover:text-foreground">Vehicle Trip Management</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Waypoints className="h-5 w-5 text-primary" /> Create Trip</h1>
          <p className="mt-0.5 text-sm text-muted">Sales and Purchase trips normally appear automatically once a vehicle is gated in — use this for Other movements, or to backfill Sales/Purchase manually.</p>
        </div>
        <Link href="/masters/transport/vehicle-trip"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          <SectionCard icon={Waypoints} title="Trip Information">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Trip Type</label><select value={f.tripType} onChange={(e) => set("tripType", e.target.value as TripType)} className={inp}>{TRIP_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              {f.tripType === "Other" && <div><label className={lbl}>Trip Purpose</label><select value={f.tripPurpose ?? ""} onChange={(e) => set("tripPurpose", e.target.value)} className={inp}><option value="">— Select —</option>{TRIP_PURPOSE_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>}
              <div><label className={lbl}>Planned Start</label><input type="datetime-local" value={f.plannedStartAt ?? ""} onChange={(e) => set("plannedStartAt", e.target.value)} className={inp} /></div>
            </div>
          </SectionCard>

          <SectionCard icon={Waypoints} title="Vehicle & Driver">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Vehicle *</label><select value={f.vehicleId || ""} onChange={(e) => set("vehicleId", Number(e.target.value) || 0)} className={inp}><option value="">— Select —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}</select></div>
              <div><label className={lbl}>Driver</label><select value={f.driverId ?? ""} onChange={(e) => set("driverId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className={lbl}>Transporter</label><select value={f.transportCompanyId ?? ""} onChange={(e) => set("transportCompanyId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            </div>
          </SectionCard>

          <SectionCard icon={Waypoints} title="Route">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Source</label><input value={f.sourceLocation ?? ""} onChange={(e) => set("sourceLocation", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Destination</label><input value={f.destinationLocation ?? ""} onChange={(e) => set("destinationLocation", e.target.value)} className={inp} /></div>
            </div>
          </SectionCard>

          <SectionCard icon={Waypoints} title="Material (Optional)">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className={lbl}>Material</label><input value={f.materialName ?? ""} onChange={(e) => set("materialName", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Planned Qty</label><input type="number" min={0} value={f.plannedQty ?? ""} onChange={(e) => set("plannedQty", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
              <div><label className={lbl}>UOM</label><input value={f.uom ?? ""} onChange={(e) => set("uom", e.target.value)} className={inp} /></div>
            </div>
          </SectionCard>

          <SectionCard icon={Waypoints} title="Remarks">
            <textarea value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={3} className={inp + " h-auto py-2"} />
          </SectionCard>

          <div className="flex items-center justify-end gap-2">
            <Link href="/masters/transport/vehicle-trip"><Button variant="outline" size="md">Cancel</Button></Link>
            <Button size="md" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Creating…" : "Create Trip"}</Button>
          </div>
        </>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
