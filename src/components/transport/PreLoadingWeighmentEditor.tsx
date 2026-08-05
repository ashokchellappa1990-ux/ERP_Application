"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Scale, ArrowLeft, Truck, Users, Save, Loader2, RadioTower, Plus, X, CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

interface GateRow {
  id: number; gateEntryNo: string; vehicleId: number; vehicleNo: string; status: string;
  driverName: string | null; driverMobile: string | null; driverLicenseNo: string | null;
  transportCompanyId: number | null; transportCompanyName: string | null; vehicleType: string | null;
  customerName: string | null; dispatchType: string | null; referenceNo: string | null;
}
interface Opt { id: number; label: string }
interface CustomerHit { id: number; name: string; phone: string }

export function PreLoadingWeighmentEditor() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const preselectId = searchParams.get("gateEntryId");
  // Reached from the Vehicle Gate Entry list/editor's "Continue to Weighment
  // Now" hand-off (?gateEntryId=) vs. navigated here directly — only in the
  // former case should Back / after-save return to the gate entry list
  // instead of this screen's own list.
  const fromGateEntry = !!preselectId;
  const backHref = fromGateEntry ? "/transport/gate-entry" : "/transport/pre-weighment";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [eligible, setEligible] = useState<GateRow[]>([]);
  const [companies, setCompanies] = useState<Opt[]>([]);
  const [weighbridges, setWeighbridges] = useState<Opt[]>([]);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);

  const [gateEntryId, setGateEntryId] = useState<number | "">("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [transportCompanyId, setTransportCompanyId] = useState<number | "">("");
  const [vehicleType, setVehicleType] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<CustomerHit[] | null>(null);
  const [driverName, setDriverName] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [driverLicenseNo, setDriverLicenseNo] = useState("");

  const [tareWeight, setTareWeight] = useState("");
  const [operator, setOperator] = useState("");
  const [weighbridgeId, setWeighbridgeId] = useState<number | "">("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    (async () => {
      const [wt, ge, wb, co] = await Promise.all([
        fetch("/api/transport/pre-weighment", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/gate-entry", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/masters/weighbridge?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/masters/transport-company?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ]);
      const weighedGateIds = new Set((wt.ok ? wt.rows : []).map((r: { gateEntryId: number }) => r.gateEntryId));
      const rows: GateRow[] = (ge.ok ? ge.rows : []).filter((g: { status: string; id: number }) => (g.status === "Waiting" || g.status === "Inside Factory") && !weighedGateIds.has(g.id));
      setEligible(rows);
      if (wb.ok) setWeighbridges(wb.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name })));
      if (co.ok) setCompanies(co.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name })));

      const initial = preselectId ? rows.find((r) => r.id === Number(preselectId)) : rows[0];
      if (initial) applyGateEntry(initial);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyGateEntry(g: GateRow) {
    setGateEntryId(g.id);
    setTransportCompanyId(g.transportCompanyId ?? "");
    setVehicleType(g.vehicleType ?? "");
    setCustomerName(g.customerName ?? "");
    setCustomerQuery(g.customerName ?? "");
    setDriverName(g.driverName ?? "");
    setDriverMobile(g.driverMobile ?? "");
    setDriverLicenseNo(g.driverLicenseNo ?? "");
    setEditingDetails(!g.transportCompanyId || !g.driverName);
  }

  function onSelectVehicle(id: number | "") {
    const g = eligible.find((x) => x.id === id);
    if (g) applyGateEntry(g);
    else { setGateEntryId(""); setTransportCompanyId(""); setVehicleType(""); setCustomerName(""); setCustomerQuery(""); setDriverName(""); setDriverMobile(""); setDriverLicenseNo(""); }
  }

  const custTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCustomers = async (q: string) => {
    if (!q.trim()) { setCustomerHits(null); return; }
    try {
      const j = await fetch(`/api/masters/customers?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) setCustomerHits((j.customers ?? []).slice(0, 20));
    } catch { toast.error("Could not search customers."); }
  };
  const onCustomerQuery = (v: string) => {
    setCustomerQuery(v); setCustomerName(v);
    if (custTimer.current) clearTimeout(custTimer.current);
    custTimer.current = setTimeout(() => searchCustomers(v), 250);
  };
  const pickCustomer = (hit: CustomerHit) => { setCustomerName(hit.name); setCustomerQuery(hit.name); setCustomerHits(null); };

  function fetchFromWeighbridge() {
    if (!weighbridgeId) { toast.error("Select a weighbridge first."); return; }
    // No hardware/serial integration is wired up yet — this button is a
    // placeholder for a future weighbridge feed. Never fabricate a reading.
    toast.warning("This weighbridge isn't connected yet — enter the reading manually for now.");
  }

  async function save() {
    if (!gateEntryId) { toast.error("Select a vehicle."); return; }
    if (!tareWeight || Number(tareWeight) < 0) { toast.error("Enter a valid tare (empty vehicle) weight."); return; }
    setSaving(true);
    try {
      if (editingDetails) {
        await fetch(`/api/transport/gate-entry/${gateEntryId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transportCompanyId: transportCompanyId || null, customerName: customerName || null, driverName: driverName || null, driverMobile: driverMobile || null, driverLicenseNo: driverLicenseNo || null }),
        }).catch(() => {});
      }
      const res = await fetch("/api/transport/pre-weighment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateEntryId, tareWeight: Number(tareWeight), operator: operator || null,
          weighbridgeId: weighbridgeId || null, weighDate: new Date().toISOString().slice(0, 10),
          weighTime: new Date().toTimeString().slice(0, 5), remarks: remarks || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Pre-loading weighment recorded."); setSavedId(j.id); }
      else { toast.error(j.message || "Could not save the weighment."); setSaving(false); }
    } catch { toast.error("Network error — could not save."); setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href={backHref} className="hover:text-foreground">{fromGateEntry ? "Vehicle Gate Entry" : "Pre Loading Weighment"}</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Scale className="h-5 w-5 text-primary" /> New Pre Loading Weighment</h1>
          <p className="mt-0.5 text-sm text-muted">Records the empty (tare) weight of a vehicle before loading begins.</p>
        </div>
        <Link href={backHref}><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {loading && <AppLoader label="Loading vehicle & weighment details…" />}

      {!loading && eligible.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Scale className="mx-auto h-8 w-8 text-subtle" />
          <p className="mt-3 text-sm font-semibold text-foreground">No vehicles are ready for weighment.</p>
          <p className="mt-1 text-sm text-muted">A vehicle must have a Gate Entry (Waiting or Inside Factory) that hasn&apos;t been weighed yet. Record a Gate Entry first.</p>
          <Link href="/transport/gate-entry/new"><Button size="md" className="mt-4">Go to New Gate Entry</Button></Link>
        </div>
      )}

      {!loading && eligible.length > 0 && (
        <>
          <SectionCard icon={Truck} title="Vehicle &amp; Gate Entry" allowOverflow>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fld label="Vehicle Number *">
                <select value={gateEntryId} onChange={(e) => onSelectVehicle(e.target.value ? Number(e.target.value) : "")} className={inp}>
                  <option value="">Select vehicle…</option>
                  {eligible.map((g) => <option key={g.id} value={g.id}>{g.vehicleNo} — {g.gateEntryNo} ({g.status})</option>)}
                </select>
              </Fld>
              {gateEntryId !== "" && (() => {
                const g = eligible.find((x) => x.id === gateEntryId);
                return g ? (
                  <>
                    <Fld label="Dispatch Type"><input value={g.dispatchType ?? "—"} disabled className={cn(inp, "text-subtle")} /></Fld>
                    <Fld label="Reference No"><input value={g.referenceNo ?? "—"} disabled className={cn(inp, "text-subtle")} /></Fld>
                  </>
                ) : null;
              })()}
            </div>
          </SectionCard>

          <SectionCard icon={Users} title="Customer, Transport &amp; Driver Details" allowOverflow>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-2xs text-subtle">Loaded automatically from the vehicle&apos;s Gate Entry. Anything missing can be added here.</p>
              {!editingDetails && <button type="button" onClick={() => setEditingDetails(true)} className="text-2xs font-semibold text-primary hover:underline">Modify</button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative">
                <label className="mb-1 block text-2xs font-semibold text-muted">Customer</label>
                <input
                  value={customerQuery} disabled={!editingDetails} placeholder="Search customer master…"
                  onChange={(e) => onCustomerQuery(e.target.value)}
                  className={cn(inp, !editingDetails && "text-subtle")}
                />
                {editingDetails && customerHits !== null && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                    {customerHits.length ? customerHits.map((h) => (
                      <button key={h.id} type="button" onClick={() => pickCustomer(h)} className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40">
                        <span className="font-medium text-foreground">{h.name}</span>{h.phone ? <span className="text-2xs text-subtle"> — {h.phone}</span> : null}
                      </button>
                    )) : <div className="px-3 py-2 text-sm text-muted">No matching customers — will be saved as free text.</div>}
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-2xs font-semibold text-muted">Transport Company</label>
                <div className="flex gap-1.5">
                  <select value={transportCompanyId} disabled={!editingDetails} onChange={(e) => setTransportCompanyId(e.target.value ? Number(e.target.value) : "")} className={cn(inp, !editingDetails && "text-subtle")}>
                    <option value="">—</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  {editingDetails && <button type="button" title="Add new transport company" onClick={() => setAddCompanyOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border-strong bg-surface text-muted hover:border-primary hover:text-primary"><Plus className="h-4 w-4" /></button>}
                </div>
              </div>
              <Fld label="Vehicle Type"><input value={vehicleType || "—"} disabled className={cn(inp, "cursor-not-allowed bg-surface-2 text-subtle")} /></Fld>
              <Fld label="Driver Name"><input value={driverName} disabled={!editingDetails} onChange={(e) => setDriverName(e.target.value)} placeholder="—" className={cn(inp, !editingDetails && "text-subtle")} /></Fld>
              <Fld label="Driver Mobile"><input value={driverMobile} disabled={!editingDetails} onChange={(e) => setDriverMobile(e.target.value)} placeholder="—" className={cn(inp, !editingDetails && "text-subtle")} /></Fld>
              <Fld label="Driver License No"><input value={driverLicenseNo} disabled={!editingDetails} onChange={(e) => setDriverLicenseNo(e.target.value)} placeholder="—" className={cn(inp, !editingDetails && "text-subtle")} /></Fld>
            </div>
          </SectionCard>

          <SectionCard icon={Scale} title="Weighment Details" allowOverflow>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fld label="Weighbridge"><select value={weighbridgeId} onChange={(e) => setWeighbridgeId(e.target.value ? Number(e.target.value) : "")} className={inp}><option value="">—</option>{weighbridges.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></Fld>
              <div>
                <label className="mb-1 block text-2xs font-semibold text-muted">Tare Weight (Empty Vehicle, In Kgs) *</label>
                <div className="flex gap-1.5">
                  <input type="number" min={0} step="0.001" value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} className={inp} />
                  <button type="button" title="Fetch from weighbridge" onClick={fetchFromWeighbridge} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border-strong bg-surface px-3 text-2xs font-semibold text-muted hover:border-primary hover:text-primary"><RadioTower className="h-3.5 w-3.5" /> Fetch</button>
                </div>
              </div>
              <Fld label="Operator"><input value={operator} onChange={(e) => setOperator(e.target.value)} className={inp} /></Fld>
            </div>
            <div className="mt-3"><Fld label="Notes / Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld></div>
          </SectionCard>

          <div className="flex items-center justify-end gap-2">
            <Button size="lg" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Record Weighment</Button>
          </div>
        </>
      )}

      {addCompanyOpen && <AddTransportCompanyModal onClose={() => setAddCompanyOpen(false)} onAdded={(row) => { setCompanies((p) => [{ id: row.id, label: row.name }, ...p]); setTransportCompanyId(row.id); setAddCompanyOpen(false); }} />}

      {savedId != null && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-6 w-6" /></span>
              <h2 className="text-sm font-bold text-foreground">Weight Submitted Successfully</h2>
              <p className="text-sm text-muted">Do you want to print the Pre Load Weight Slip?</p>
            </div>
            <div className="flex flex-col gap-2 border-t border-border bg-surface-2 px-5 py-4">
              <Button size="md" onClick={() => router.push(`/transport/pre-weighment/token?id=${savedId}&next=${encodeURIComponent(backHref)}`)}><Printer className="h-4 w-4" /> Preview &amp; Print</Button>
              <Button variant="outline" size="md" onClick={() => router.push(backHref)}>Do It Later</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddTransportCompanyModal({ onClose, onAdded }: { onClose: () => void; onAdded: (row: { id: number; name: string }) => void }) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!code.trim() || !name.trim()) { toast.error("Code and name are required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/transport/masters/transport-company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name, phone: phone || null, status: "Active" }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success("Transport company added."); onAdded(j.row); }
      else { toast.error(j.message || "Could not add the transport company."); setSaving(false); }
    } catch { toast.error("Network error."); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <h2 className="text-sm font-bold text-foreground">Add Transport Company</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <Fld label="Code *"><input value={code} onChange={(e) => setCode(e.target.value)} className={inp} /></Fld>
          <Fld label="Name *"><input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></Fld>
          <Fld label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} /></Fld>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={save} disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
        </div>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none disabled:opacity-70";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
