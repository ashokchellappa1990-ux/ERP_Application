"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fuel, ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { FUEL_TYPE_OPTS, PAYMENT_MODE_OPTS, fuelEntryInput, type FuelEntryInput } from "@/lib/contracts/fuelManagement";

interface VehicleOption { id: number; vehicleNo: string }
interface DriverOption { id: number; name: string }
interface TripOption { id: number; tripNo: string; vehicleId: number }
interface StationOption { id: number; name: string }

const BLANK: FuelEntryInput = {
  entryDate: new Date().toISOString().slice(0, 10), vehicleId: 0, driverId: null, tripId: null, fuelType: "Diesel",
  fuelStationId: null, fuelStationName: "", quantity: 0, uom: "Litre", rate: 0, odometer: null,
  invoiceNo: "", invoiceDate: "", paymentMode: "", remarks: "", overrideOdometerWarning: false,
};

export function FuelEntryForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [f, setF] = useState<FuelEntryInput>(BLANK);
  const [odoWarning, setOdoWarning] = useState<string | null>(null);
  const set = <K extends keyof FuelEntryInput>(k: K, v: FuelEntryInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    (async () => {
      const [v, d, t, s] = await Promise.all([
        fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/masters/driver?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/vehicle-trip", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch(`/api/masters/suppliers?category=${encodeURIComponent("Fuel Station")}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (v?.ok) setVehicles(v.rows);
      if (d?.ok) setDrivers(d.rows);
      if (t?.ok) setTrips(t.rows);
      if (s?.ok) setStations(s.suppliers);
      setLoading(false);
    })();
  }, []);

  async function save(override = false) {
    const parsed = fuelEntryInput.safeParse({ ...f, overrideOdometerWarning: override });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/fuel-entry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Created."); if (j.warnings?.length) j.warnings.forEach((w: string) => toast.warning(w)); router.push(`/masters/transport/fuel-management/entry/${j.id}`); }
    else if (j.requiresOverride) { setOdoWarning(j.message); }
    else toast.error(j.message || "Could not save.");
  }

  const amount = f.quantity * f.rate;
  const vehicleTrips = trips.filter((t) => t.vehicleId === f.vehicleId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/fuel-management" className="hover:text-foreground">Fuel Management</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New Fuel Entry</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Fuel className="h-5 w-5 text-primary" /> New Fuel Entry (External)</h1>
        </div>
        <Link href="/masters/transport/fuel-management"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          <SectionCard icon={Fuel} title="Basic Details">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Date *</label><input type="date" value={f.entryDate} onChange={(e) => set("entryDate", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Vehicle *</label><select value={f.vehicleId || ""} onChange={(e) => set("vehicleId", Number(e.target.value) || 0)} className={inp}><option value="">— Select —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}</select></div>
              <div><label className={lbl}>Driver</label><select value={f.driverId ?? ""} onChange={(e) => set("driverId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className={lbl}>Trip (optional)</label><select value={f.tripId ?? ""} onChange={(e) => set("tripId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{vehicleTrips.map((t) => <option key={t.id} value={t.id}>{t.tripNo}</option>)}</select></div>
              <div><label className={lbl}>Fuel Type</label><select value={f.fuelType} onChange={(e) => set("fuelType", e.target.value as FuelEntryInput["fuelType"])} className={inp}>{FUEL_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className={lbl}>Fuel Station</label><select value={f.fuelStationId ?? ""} onChange={(e) => set("fuelStationId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className={lbl}>Fuel Station Name (if not listed)</label><input value={f.fuelStationName ?? ""} onChange={(e) => set("fuelStationName", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Odometer Reading (KM)</label><input type="number" min={0} value={f.odometer ?? ""} onChange={(e) => { set("odometer", e.target.value ? Number(e.target.value) : null); setOdoWarning(null); }} className={inp} /></div>
              <div><label className={lbl}>Payment Mode</label><select value={f.paymentMode ?? ""} onChange={(e) => set("paymentMode", e.target.value)} className={inp}><option value="">— Select —</option>{PAYMENT_MODE_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            </div>
          </SectionCard>

          <SectionCard icon={Fuel} title="Quantity & Cost">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Fuel Quantity *</label><input type="number" min={0} value={f.quantity || ""} onChange={(e) => set("quantity", Number(e.target.value) || 0)} className={inp} /></div>
              <div><label className={lbl}>Unit</label><input value={f.uom} onChange={(e) => set("uom", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Rate (₹/L)</label><input type="number" min={0} value={f.rate || ""} onChange={(e) => set("rate", Number(e.target.value) || 0)} className={inp} /></div>
              <div><label className={lbl}>Invoice/Bill No.</label><input value={f.invoiceNo ?? ""} onChange={(e) => set("invoiceNo", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Invoice Date</label><input type="date" value={f.invoiceDate ?? ""} onChange={(e) => set("invoiceDate", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"><span className="text-muted">Total Amount</span><span className="font-bold text-foreground">₹{amount.toFixed(2)}</span></div>
          </SectionCard>

          {odoWarning && (
            <div className="rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning">
              {odoWarning}
              <Button size="sm" variant="outline" className="ml-3" onClick={() => save(true)}>Save Anyway</Button>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Link href="/masters/transport/fuel-management"><Button variant="outline" size="md">Cancel</Button></Link>
            <Button size="md" onClick={() => save(false)} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Fuel Entry"}</Button>
          </div>
        </>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
