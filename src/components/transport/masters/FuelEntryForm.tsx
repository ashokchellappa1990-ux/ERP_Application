"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fuel, ArrowLeft, Save, Plus, Trash2, X, FileText, Calculator } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { BankPicker, emptyBank, isNonCashMode, type BankValue } from "@/components/finance/BankPicker";
import { cn } from "@/lib/cn";
import { FUEL_TYPE_OPTS, USAGE_TYPE_OPTS, fuelEntryInput, type FuelEntryInput, type FuelEntryLineInput, type FuelEntryAttachmentInput } from "@/lib/contracts/fuelManagement";
import type { ExpenseHeadDto } from "@/lib/contracts/finance";

interface VehicleOption { id: number; vehicleNo: string }
interface DriverOption { id: number; name: string }
interface TripOption { id: number; tripNo: string; vehicleId: number }
interface StationOption { id: number; name: string }
interface TankOption { id: number; tankName: string; tankCode: string; status: string }
interface Pay { mode: string; amount: string; reference: string }

const PAY_MODES = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card", "Fuel Card"];
const n = (v: unknown) => Number(v) || 0;

const BLANK: FuelEntryInput = {
  entryDate: new Date().toISOString().slice(0, 10), usageType: "vehicle", vehicleId: null, driverId: null, tripId: null, tankId: null, fuelType: "Diesel",
  fuelStationId: null, quantity: 0, uom: "Litre", rate: 0, odometer: null,
  invoiceNo: "", invoiceDate: "", remarks: "", overrideOdometerWarning: false,
  headId: null, gstApplicable: false, gstPct: null, supplierGstin: "", postingType: "paynow",
  bankId: null, bankName: "", bankAccount: "", lines: [], payments: [], attachments: [],
};

/** New Fuel Purchase — external refuelling (or barrel/drum storage stock-up),
 * a real GL-posting expense document (Payment + Accounting sections, split
 * tenders, bill attachments — mirroring the Petty Cash Business Expense
 * screen). The model/route are still named "fuel entry" internally to avoid
 * a data migration — only the UI label changed. */
export function FuelEntryForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [tanks, setTanks] = useState<TankOption[]>([]);
  const [heads, setHeads] = useState<ExpenseHeadDto[]>([]);
  const [f, setF] = useState<FuelEntryInput>(BLANK);
  const [bank, setBank] = useState<BankValue>(emptyBank);
  const [payments, setPayments] = useState<Pay[]>([{ mode: "Cash", amount: "", reference: "" }]);
  const [attachments, setAttachments] = useState<FuelEntryAttachmentInput[]>([]);
  const [uploading, setUploading] = useState(false);
  const [odoWarning, setOdoWarning] = useState<string | null>(null);
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [addTankOpen, setAddTankOpen] = useState(false);
  const set = <K extends keyof FuelEntryInput>(k: K, v: FuelEntryInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    (async () => {
      const [v, d, t, s, tk, h] = await Promise.all([
        fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/masters/driver?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/vehicle-trip", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch(`/api/masters/suppliers?category=${encodeURIComponent("Fuel Station")}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/transport/fuel-tank?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/finance/petty-cash/config", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (v?.ok) setVehicles(v.rows);
      if (d?.ok) setDrivers(d.rows);
      if (t?.ok) setTrips(t.rows);
      if (s?.ok) setStations(s.suppliers);
      if (tk?.ok) setTanks(tk.rows);
      if (h?.ok) {
        setHeads(h.heads);
        // Default the Expense Head to whichever one is configured (in Expense
        // Head Config) as "Linked Feature: Fuel Purchase" — not a name match.
        const fuelHead = (h.heads as ExpenseHeadDto[]).find((x) => x.parentId != null && x.active && x.linkedFeature === "fuel_purchase");
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

  const amount = f.quantity * f.rate;
  const taxAmount = f.gstApplicable ? amount * ((f.gstPct ?? 0) / 100) : 0;
  const otherCost = f.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const total = +(amount + taxAmount + otherCost).toFixed(2);
  const vehicleTrips = trips.filter((t) => t.vehicleId === f.vehicleId);

  // Split payments — mirrors Petty Cash's Pay array exactly: single row
  // auto-fills to the full total; "+ Split" adds more, each removable.
  const setPay = (i: number, patch: Partial<Pay>) => setPayments((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addPay = () => setPayments((c) => [...c, { mode: "Bank Transfer", amount: "", reference: "" }]);
  const removePay = (i: number) => setPayments((c) => (c.length > 1 ? c.filter((_, j) => j !== i) : c));
  const tendered = +payments.reduce((s, p) => s + n(p.amount), 0).toFixed(2);
  const payDiff = +(total - tendered).toFixed(2);
  useEffect(() => { setPayments((p) => (p.length === 1 ? [{ ...p[0], amount: total > 0 ? String(total) : "" }] : p)); }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append("file", file);
      const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
      if (j?.ok) setAttachments((a) => [...a, j.file]); else toast.error(j?.message || "Upload failed.");
    }
    setUploading(false);
  }

  async function save(override = false) {
    if (f.postingType === "paynow" && Math.abs(payDiff) > 0.01) { toast.error(`Payments (₹${tendered}) must equal the total amount (₹${total}).`); return; }
    const payload = {
      ...f, overrideOdometerWarning: override, bankId: bank.bankId, bankName: bank.bankName, bankAccount: bank.bankAccount,
      payments: f.postingType === "ap" ? [] : payments.filter((p) => n(p.amount) > 0).map((p) => ({ mode: p.mode, amount: n(p.amount), reference: p.reference })),
      attachments,
    };
    const parsed = fuelEntryInput.safeParse(payload);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/fuel-entry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Created."); if (j.warnings?.length) j.warnings.forEach((w: string) => toast.warning(w)); router.push(`/masters/transport/fuel-management/entry/${j.id}`); }
    else if (j.requiresOverride) { setOdoWarning(j.message); }
    else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/fuel-management" className="hover:text-foreground">Fuel Management</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New Fuel Purchase</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Fuel className="h-5 w-5 text-primary" /> New Fuel Purchase</h1>
        </div>
        <Link href="/masters/transport/fuel-management"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          <SectionCard icon={Fuel} title="Basic Details">
            <div className="mb-3">
              <label className={lbl}>Purchased For</label>
              <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
                {(USAGE_TYPE_OPTS).map((u) => (
                  <button key={u} type="button" onClick={() => set("usageType", u)} className={cn("px-3 py-2 font-semibold transition", f.usageType === u ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>
                    {u === "vehicle" ? "Vehicle Usage" : "Storage (Barrel/Drum)"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Date *</label><input type="date" value={f.entryDate} onChange={(e) => set("entryDate", e.target.value)} className={inp} /></div>
              {f.usageType === "vehicle" && (
                <>
                  <div><label className={lbl}>Vehicle *</label><select value={f.vehicleId ?? ""} onChange={(e) => set("vehicleId", Number(e.target.value) || null)} className={inp}><option value="">— Select —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}</select></div>
                  <div><label className={lbl}>Driver</label><select value={f.driverId ?? ""} onChange={(e) => set("driverId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                  <div><label className={lbl}>Trip (optional)</label><select value={f.tripId ?? ""} onChange={(e) => set("tripId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{vehicleTrips.map((t) => <option key={t.id} value={t.id}>{t.tripNo}</option>)}</select></div>
                  <div><label className={lbl}>Odometer Reading (KM)</label><input type="number" min={0} value={f.odometer ?? ""} onChange={(e) => { set("odometer", e.target.value ? Number(e.target.value) : null); setOdoWarning(null); }} className={inp} /></div>
                </>
              )}
              {f.usageType === "storage" && (
                <div>
                  <label className={lbl}>Tank *</label>
                  <div className="flex gap-1.5">
                    <select value={f.tankId ?? ""} onChange={(e) => set("tankId", Number(e.target.value) || null)} className={inp}><option value="">— Select —</option>{tanks.map((t) => <option key={t.id} value={t.id}>{t.tankName} ({t.tankCode})</option>)}</select>
                    <button type="button" title="Add new tank" onClick={() => setAddTankOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border-strong bg-surface text-muted hover:border-primary hover:text-primary"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
              <div><label className={lbl}>Fuel Type</label><select value={f.fuelType} onChange={(e) => set("fuelType", e.target.value as FuelEntryInput["fuelType"])} className={inp}>{FUEL_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div>
                <label className={lbl}>Supplier / Vendor</label>
                <div className="flex gap-1.5">
                  <select value={f.fuelStationId ?? ""} onChange={(e) => set("fuelStationId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  <button type="button" title="Add new vendor" onClick={() => setAddVendorOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border-strong bg-surface text-muted hover:border-primary hover:text-primary"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={Fuel} title="Quantity & Cost">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Fuel Quantity *</label><input type="number" min={0} value={f.quantity || ""} onChange={(e) => set("quantity", Number(e.target.value) || 0)} className={inp} /></div>
              <div><label className={lbl}>UOM</label><input value="Litre" disabled className={inp} /></div>
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

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard icon={FileText} title="Accounting">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={lbl}>Invoice/Bill No.</label><input value={f.invoiceNo ?? ""} onChange={(e) => set("invoiceNo", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Invoice Date</label><input type="date" value={f.invoiceDate ?? ""} onChange={(e) => set("invoiceDate", e.target.value)} className={inp} /></div>
                <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm sm:col-span-2">
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

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className={lbl}>Bill / Invoice Copy</label>
                  <label className="cursor-pointer text-2xs font-semibold text-primary hover:underline">
                    <Plus className="mr-0.5 inline h-3.5 w-3.5" />{uploading ? "Uploading…" : "Upload"}
                    <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
                  </label>
                </div>
                {attachments.length === 0 ? <p className="text-2xs text-muted">No bill copy uploaded yet.</p> : (
                  <div className="space-y-1.5">
                    {attachments.map((a, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-1.5">
                        <a href={a.fileUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm text-foreground hover:text-primary"><FileText className="h-4 w-4 shrink-0 text-muted" /><span className="truncate">{a.fileName}</span>{a.size ? <span className="shrink-0 text-2xs text-subtle">{(a.size / 1024).toFixed(0)} KB</span> : null}</a>
                        <button type="button" onClick={() => setAttachments((c) => c.filter((_, j) => j !== i))} className="shrink-0 text-muted hover:text-danger"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard icon={Fuel} title="Payment">
              <div>
                <label className={lbl}>Posting</label>
                <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
                  <button type="button" onClick={() => set("postingType", "paynow")} className={cn("px-3 py-2 font-semibold transition", f.postingType === "paynow" ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>Pay Now</button>
                  <button type="button" onClick={() => set("postingType", "ap")} className={cn("px-3 py-2 font-semibold transition", f.postingType === "ap" ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>On Credit (Payable)</button>
                </div>
              </div>

              {f.postingType === "ap" ? (
                <div className="mt-3 rounded-lg border border-info/30 bg-info-subtle/40 p-3 text-2xs text-info">Post to Accounts Payable — no payment now. A supplier outstanding of ₹{total.toFixed(2)} will be created. Settle later in Finance › Payables.</div>
              ) : (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between"><label className={lbl}>Payment Mode(s)</label><button type="button" onClick={addPay} className="text-2xs font-semibold text-primary hover:underline">+ Split</button></div>
                  <div className="space-y-2">
                    {payments.map((p, i) => (
                      <div key={i} className="rounded-lg border border-border bg-surface-2/40 p-2">
                        <div className="flex items-center gap-1.5">
                          <select value={p.mode} onChange={(e) => setPay(i, { mode: e.target.value })} className="h-8 w-32 shrink-0 rounded-md border border-border-strong bg-surface px-2 text-xs focus:border-primary focus:outline-none">{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</select>
                          <input type="number" value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value })} placeholder="Amount" className="h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" />
                          {payments.length > 1 && <button type="button" onClick={() => removePay(i)} className="grid h-8 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-danger-subtle hover:text-danger"><X className="h-3.5 w-3.5" /></button>}
                        </div>
                        <input value={p.reference} onChange={(e) => setPay(i, { reference: e.target.value })} placeholder="Reference / UTR" className="mt-1.5 h-8 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm focus:border-primary focus:outline-none" />
                      </div>
                    ))}
                  </div>
                  {total > 0 && <div className="mt-1 flex items-center justify-between text-2xs"><span className="text-muted">Tendered ₹{tendered.toFixed(2)}</span>{Math.abs(payDiff) > 0.01 ? <span className="font-semibold text-danger">{payDiff > 0 ? `₹${payDiff.toFixed(2)} short` : `₹${(-payDiff).toFixed(2)} over`}</span> : <span className="font-semibold text-success">matches ✓</span>}</div>}
                  {payments.some((p) => isNonCashMode(p.mode)) && <div className="mt-2"><BankPicker mode={payments.find((p) => isNonCashMode(p.mode))?.mode} value={bank} onChange={setBank} required /></div>}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between rounded-lg bg-primary-subtle/40 px-3 py-2.5 text-sm">
                <span className="font-semibold text-foreground">Total Amount</span>
                <span className="text-lg font-bold text-primary">₹{total.toFixed(2)}</span>
              </div>
              {(otherCost > 0 || taxAmount > 0) && <p className="mt-1 text-2xs text-muted">₹{amount.toFixed(2)} fuel + ₹{taxAmount.toFixed(2)} GST + ₹{otherCost.toFixed(2)} other</p>}

              <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-2xs font-bold text-foreground"><Calculator className="h-3.5 w-3.5 text-primary" /> Accounting Posting Preview</div>
                <div className="space-y-0.5 text-2xs">
                  {[
                    { a: "Fuel / Expense Head", dr: amount + otherCost, cr: 0 },
                    { a: "Input GST (ITC)", dr: taxAmount, cr: 0 },
                    f.postingType === "ap" ? { a: "Supplier Payable", dr: 0, cr: total } : { a: "Cash / Bank", dr: 0, cr: total },
                  ].filter((x) => x.dr > 0.001 || x.cr > 0.001).map((x, i) => (
                    <div key={i} className="flex justify-between"><span className="text-muted">{x.a}</span><span className="tabular-nums text-foreground">{x.dr > 0 ? `Dr ₹${x.dr.toFixed(2)}` : `Cr ₹${x.cr.toFixed(2)}`}</span></div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

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

          {addVendorOpen && (
            <AddVendorModal
              onClose={() => setAddVendorOpen(false)}
              onAdded={(row) => { setStations((c) => [...c, row]); set("fuelStationId", row.id); setAddVendorOpen(false); }}
            />
          )}
          {addTankOpen && (
            <AddTankModal
              onClose={() => setAddTankOpen(false)}
              onAdded={(row) => { setTanks((c) => [...c, row]); set("tankId", row.id); setAddTankOpen(false); }}
            />
          )}
        </>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";

/** Quick-add a Supplier for the Fuel Purchase form — same modal convention as
 * GateEntryEditor's Add*Modal popups. Always stores category: "Fuel Station"
 * so it shows up in this screen's vendor list (filtered by that category)
 * without polluting other supplier pickers that filter by a different one. */
function AddVendorModal({ onClose, onAdded }: { onClose: () => void; onAdded: (row: { id: number; name: string }) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error("Vendor name is required."); return; }
    setSaving(true);
    const j = await fetch("/api/masters/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone: phone || null, category: "Fuel Station" }) }).then((r) => r.json()).catch(() => ({}));
    setSaving(false);
    if (j.ok && j.supplier) { toast.success(j.reused ? "Existing vendor selected." : "Vendor added."); onAdded(j.supplier); }
    else toast.error(j.message || "Could not add the vendor.");
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <h2 className="text-sm font-bold text-foreground">Add Vendor</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <div><label className={lbl}>Vendor Name *</label><input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} /></div>
          <p className="text-2xs text-subtle">Saved to Supplier Master under category &quot;Fuel Station&quot; — the same master used across Purchase, GRN, and other vendor pickers.</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={save} disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
        </div>
      </div>
    </div>
  );
}

/** Quick-add a Fuel Tank for the Fuel Purchase form — mirrors StationTankManager's
 * TankModal, minus the Station field (a tank/drum doesn't need one). */
function AddTankModal({ onClose, onAdded }: { onClose: () => void; onAdded: (row: TankOption) => void }) {
  const toast = useToast();
  const [tankCode, setTankCode] = useState("");
  const [tankName, setTankName] = useState("");
  const [fuelType, setFuelType] = useState<(typeof FUEL_TYPE_OPTS)[number]>("Diesel");
  const [capacity, setCapacity] = useState(0);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!tankCode.trim() || !tankName.trim()) { toast.error("Tank code and name are required."); return; }
    setSaving(true);
    const j = await fetch("/api/transport/fuel-tank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tankCode, tankName, stationId: null, fuelType, capacity, status: "Active" }) }).then((r) => r.json()).catch(() => ({}));
    setSaving(false);
    if (j.ok) { toast.success(j.message || "Tank added."); onAdded({ id: j.id, tankName, tankCode, status: "Active" }); }
    else toast.error(j.message || "Could not add the tank.");
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <h2 className="text-sm font-bold text-foreground">Add Fuel Tank</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <div><label className={lbl}>Tank Code *</label><input value={tankCode} onChange={(e) => setTankCode(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Tank Name *</label><input value={tankName} onChange={(e) => setTankName(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Fuel Type</label><select value={fuelType} onChange={(e) => setFuelType(e.target.value as typeof fuelType)} className={inp}>{FUEL_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className={lbl}>Capacity (L)</label><input type="number" min={0} value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 0)} className={inp} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={save} disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
        </div>
      </div>
    </div>
  );
}
