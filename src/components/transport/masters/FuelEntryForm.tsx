"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fuel, ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { BankPicker, emptyBank, isNonCashMode, type BankValue } from "@/components/finance/BankPicker";
import { cn } from "@/lib/cn";
import { FUEL_TYPE_OPTS, PAYMENT_MODE_OPTS, fuelEntryInput, type FuelEntryInput, type FuelEntryLineInput } from "@/lib/contracts/fuelManagement";
import type { ExpenseHeadDto } from "@/lib/contracts/finance";

interface VehicleOption { id: number; vehicleNo: string }
interface DriverOption { id: number; name: string }
interface TripOption { id: number; tripNo: string; vehicleId: number }
interface StationOption { id: number; name: string }

const BLANK: FuelEntryInput = {
  entryDate: new Date().toISOString().slice(0, 10), vehicleId: 0, driverId: null, tripId: null, fuelType: "Diesel",
  fuelStationId: null, fuelStationName: "", quantity: 0, uom: "Litre", rate: 0, odometer: null,
  invoiceNo: "", invoiceDate: "", paymentMode: "", remarks: "", overrideOdometerWarning: false,
  headId: null, gstApplicable: false, gstPct: null, supplierGstin: "", postingType: "paynow",
  bankId: null, bankName: "", bankAccount: "", lines: [],
};

/** New Fuel Purchase — external refuelling, now a real GL-posting expense
 * document (Payment + Accounting sections, mirroring the Petty Cash Business
 * Expense screen). The model/route are still named "fuel entry" internally
 * to avoid a data migration — only the UI label changed. */
export function FuelEntryForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [heads, setHeads] = useState<ExpenseHeadDto[]>([]);
  const [f, setF] = useState<FuelEntryInput>(BLANK);
  const [bank, setBank] = useState<BankValue>(emptyBank);
  const [odoWarning, setOdoWarning] = useState<string | null>(null);
  const set = <K extends keyof FuelEntryInput>(k: K, v: FuelEntryInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    (async () => {
      const [v, d, t, s, h] = await Promise.all([
        fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/masters/driver?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/vehicle-trip", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch(`/api/masters/suppliers?category=${encodeURIComponent("Fuel Station")}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/finance/petty-cash/config", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (v?.ok) setVehicles(v.rows);
      if (d?.ok) setDrivers(d.rows);
      if (t?.ok) setTrips(t.rows);
      if (s?.ok) setStations(s.suppliers);
      if (h?.ok) {
        setHeads(h.heads);
        const fuelHead = (h.heads as ExpenseHeadDto[]).find((x) => x.parentId != null && x.active && x.name.trim().toLowerCase() === "fuel");
        if (fuelHead) set("headId", fuelHead.id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leafHeads = heads.filter((h) => h.parentId != null && h.active);
  const addLine = () => set("lines", [...f.lines, { headId: null, description: "", amount: 0 }]);
  const updLine = (i: number, patch: Partial<FuelEntryLineInput>) => set("lines", f.lines.map((l, li) => (li === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => set("lines", f.lines.filter((_, li) => li !== i));

  async function save(override = false) {
    const payload = { ...f, overrideOdometerWarning: override, bankId: bank.bankId, bankName: bank.bankName, bankAccount: bank.bankAccount };
    const parsed = fuelEntryInput.safeParse(payload);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/fuel-entry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Created."); if (j.warnings?.length) j.warnings.forEach((w: string) => toast.warning(w)); router.push(`/masters/transport/fuel-management/entry/${j.id}`); }
    else if (j.requiresOverride) { setOdoWarning(j.message); }
    else toast.error(j.message || "Could not save.");
  }

  const amount = f.quantity * f.rate;
  const taxAmount = f.gstApplicable ? amount * ((f.gstPct ?? 0) / 100) : 0;
  const otherCost = f.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const total = amount + taxAmount + otherCost;
  const vehicleTrips = trips.filter((t) => t.vehicleId === f.vehicleId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/fuel-management" className="hover:text-foreground">Fuel Management</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New Fuel Purchase</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Fuel className="h-5 w-5 text-primary" /> New Fuel Purchase (External)</h1>
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
            </div>
          </SectionCard>

          <SectionCard icon={Fuel} title="Quantity & Cost">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Fuel Quantity *</label><input type="number" min={0} value={f.quantity || ""} onChange={(e) => set("quantity", Number(e.target.value) || 0)} className={inp} /></div>
              <div><label className={lbl}>Unit</label><input value={f.uom} onChange={(e) => set("uom", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Rate (₹/L)</label><input type="number" min={0} value={f.rate || ""} onChange={(e) => set("rate", Number(e.target.value) || 0)} className={inp} /></div>
              <div><label className={lbl}>Expense Head</label><select value={f.headId ?? ""} onChange={(e) => set("headId", Number(e.target.value) || null)} className={inp}><option value="">— Default (Fuel Expense) —</option>{leafHeads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
              <div><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"><span className="text-muted">Fuel Amount</span><span className="font-bold text-foreground">₹{amount.toFixed(2)}</span></div>
          </SectionCard>

          <SectionCard icon={Fuel} title="Additional Costs (optional)">
            <p className="mb-2 text-2xs text-muted">Add any incidental cost for this trip — e.g. a helper's conveyance allowance — each posted to its own Expense Head.</p>
            <div className="space-y-2">
              {f.lines.map((l, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-2/30 p-2">
                  <div className="min-w-[160px] flex-1"><label className={lbl}>Expense Head</label><select value={l.headId ?? ""} onChange={(e) => updLine(i, { headId: Number(e.target.value) || null })} className={inp}><option value="">— Select —</option>{leafHeads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                  <div className="min-w-[180px] flex-1"><label className={lbl}>Description</label><input value={l.description ?? ""} onChange={(e) => updLine(i, { description: e.target.value })} placeholder="Helper conveyance" className={inp} /></div>
                  <div className="w-32"><label className={lbl}>Amount (₹)</label><input type="number" min={0} value={l.amount || ""} onChange={(e) => updLine(i, { amount: Number(e.target.value) || 0 })} className={inp} /></div>
                  <button type="button" onClick={() => removeLine(i)} className="mb-0.5 grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3.5 w-3.5" /> Add Cost Line</Button>
            </div>
          </SectionCard>

          <SectionCard icon={Fuel} title="Accounting">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Invoice/Bill No.</label><input value={f.invoiceNo ?? ""} onChange={(e) => set("invoiceNo", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Invoice Date</label><input type="date" value={f.invoiceDate ?? ""} onChange={(e) => set("invoiceDate", e.target.value)} className={inp} /></div>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                <span className="text-foreground">GST Applicable</span>
                <input type="checkbox" checked={f.gstApplicable} onChange={(e) => set("gstApplicable", e.target.checked)} className="h-4 w-4 accent-primary" />
              </label>
              {f.gstApplicable && (
                <>
                  <div><label className={lbl}>GST %</label><input type="number" min={0} max={100} value={f.gstPct ?? ""} onChange={(e) => set("gstPct", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
                  <div><label className={lbl}>Supplier GSTIN</label><input value={f.supplierGstin ?? ""} onChange={(e) => set("supplierGstin", e.target.value)} className={inp} /></div>
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard icon={Fuel} title="Payment">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={lbl}>Posting</label>
                <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
                  <button type="button" onClick={() => set("postingType", "paynow")} className={cn("px-3 py-2 font-semibold transition", f.postingType === "paynow" ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>Pay Now</button>
                  <button type="button" onClick={() => set("postingType", "ap")} className={cn("px-3 py-2 font-semibold transition", f.postingType === "ap" ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>On Credit (Payable)</button>
                </div>
              </div>
              {f.postingType === "paynow" && (
                <div><label className={lbl}>Payment Mode *</label><select value={f.paymentMode ?? ""} onChange={(e) => set("paymentMode", e.target.value)} className={inp}><option value="">— Select —</option>{PAYMENT_MODE_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              )}
              {f.postingType === "paynow" && isNonCashMode(f.paymentMode) && (
                <BankPicker mode={f.paymentMode} value={bank} onChange={setBank} required />
              )}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-primary-subtle/40 px-3 py-2.5 text-sm">
              <span className="font-semibold text-foreground">Total Amount {otherCost > 0 || taxAmount > 0 ? `(₹${amount.toFixed(2)} fuel + ₹${taxAmount.toFixed(2)} GST + ₹${otherCost.toFixed(2)} other)` : ""}</span>
              <span className="text-lg font-bold text-primary">₹{total.toFixed(2)}</span>
            </div>
          </SectionCard>

          {odoWarning && (
            <div className="rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning">
              {odoWarning}
              <Button size="sm" variant="outline" className="ml-3" onClick={() => save(true)}>Save Anyway</Button>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Link href="/masters/transport/fuel-management"><Button variant="outline" size="md">Cancel</Button></Link>
            <Button size="md" onClick={() => save(false)} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Fuel Purchase"}</Button>
          </div>
        </>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
