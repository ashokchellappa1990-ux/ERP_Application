"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, ArrowLeft, ShieldCheck, FileText, Save, Loader2, Users, PackageSearch, ClipboardList, Plus, X, CheckCircle2, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { GATE_ENTRY_DISPATCH_TYPES } from "@/lib/contracts/transport";

const TRANSPORT_MODES = ["", "Road", "Rail", "Air", "Courier", "Own Vehicle", "Third Party"];

interface Opt { id: number; label: string }
interface SalesOrderHit { id: number; docNo: string; customerName: string }
interface TransferRequestHit { id: number; requestNo: string; sourceWarehouse: string | null; destinationWarehouse: string | null }
interface CustomerHit { id: number; name: string; phone: string | null; address: string | null }

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export function GateEntryEditor() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);

  // Masters for dropdowns.
  const [vehicles, setVehicles] = useState<Opt[]>([]);
  const [companies, setCompanies] = useState<Opt[]>([]);
  const [loadingBays, setLoadingBays] = useState<Opt[]>([]);
  const [driverMasters, setDriverMasters] = useState<{ id: number; name: string; phone: string | null; licenseNo: string | null }[]>([]);

  // Section 1 – Gate Information
  const [gateEntryNo, setGateEntryNo] = useState("");
  const [entryDateTime, setEntryDateTime] = useState(nowLocal());
  const [securityOfficer, setSecurityOfficer] = useState("");
  const [location, setLocation] = useState("");

  // Section 2 – Dispatch Information + Reference Document (merged into one card)
  const [dispatchType, setDispatchType] = useState("");
  const [referenceType, setReferenceType] = useState<"Sales Order" | "Direct Customer Dispatch" | "">("");
  const [soQuery, setSoQuery] = useState("");
  const [soHits, setSoHits] = useState<SalesOrderHit[] | null>(null);
  const [salesOrderId, setSalesOrderId] = useState<number | "">("");
  const [salesOrderNo, setSalesOrderNo] = useState("");
  const [customerId, setCustomerId] = useState<number | "">("");
  const [customerName, setCustomerName] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<CustomerHit[] | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryAddressLocked, setDeliveryAddressLocked] = useState(false);
  const [trQuery, setTrQuery] = useState("");
  const [trHits, setTrHits] = useState<TransferRequestHit[] | null>(null);
  const [transferRequestId, setTransferRequestId] = useState<number | "">("");
  const [transferRequestNo, setTransferRequestNo] = useState("");
  const [sourceWarehouse, setSourceWarehouse] = useState("");
  const [destinationWarehouse, setDestinationWarehouse] = useState("");

  // Section 4 – Transport Details
  const [transportCompanyId, setTransportCompanyId] = useState<number | "">("");
  const [transportMode, setTransportMode] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleId, setVehicleId] = useState<number | "">("");
  const [trailerNumber, setTrailerNumber] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);

  // Section 5 – Driver Details
  const [driverMasterId, setDriverMasterId] = useState<number | "">("");
  const [driverName, setDriverName] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [driverLicenseNo, setDriverLicenseNo] = useState("");
  const [helperName, setHelperName] = useState("");
  const [helperMobile, setHelperMobile] = useState("");

  // Section 6 – Vehicle Details (optional)
  const [vehicleCapacity, setVehicleCapacity] = useState("");
  const [expectedLoadWeight, setExpectedLoadWeight] = useState("");
  const [gpsAvailable, setGpsAvailable] = useState(false);
  const [sealNumber, setSealNumber] = useState("");

  // Section 7 – Entry Details (optional)
  const [purpose, setPurpose] = useState("");
  const [expectedExitTime, setExpectedExitTime] = useState("");
  const [loadingBayId, setLoadingBayId] = useState<number | "">("");
  const [remarks, setRemarks] = useState("");

  const loadMasters = () => {
    Promise.all([
      fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/transport/masters/transport-company?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]).then(([v, c]) => {
      if (v.ok) setVehicles(v.rows.map((x: { id: number; vehicleNo: string }) => ({ id: x.id, label: x.vehicleNo })));
      if (c.ok) setCompanies(c.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name })));
    });
  };

  useEffect(() => {
    loadMasters();
    fetch("/api/transport/masters/loading-bay?status=Active", { cache: "no-store" }).then((r) => r.json()).then((lb) => { if (lb.ok) setLoadingBays(lb.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name }))); }).catch(() => {});
    fetch("/api/transport/masters/driver?status=Active", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d.ok) setDriverMasters(d.rows.map((x: { id: number; name: string; phone: string | null; licenseNo: string | null }) => ({ id: x.id, name: x.name, phone: x.phone, licenseNo: x.licenseNo }))); }).catch(() => {});
    // Location — same source as the app's top bar (active business/branch scope).
    fetch("/api/system/scope", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      const branchIds: number[] | null = j.active?.branchIds ?? null;
      if (branchIds === null) { setLocation("All branches"); return; }
      if (branchIds.length === 1) {
        const b = (j.branches ?? []).find((x: { id: number; name: string }) => x.id === branchIds[0]);
        setLocation(b?.name ?? "");
      } else {
        setLocation(`${branchIds.length} branches`);
      }
    }).catch(() => {});
  }, []);

  const soTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSalesOrders = async (q: string) => {
    if (!q.trim()) { setSoHits(null); return; }
    const j = await fetch(`/api/sales/order/lookup?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setSoHits(j.rows);
  };
  const onSoQuery = (v: string) => { setSoQuery(v); if (soTimer.current) clearTimeout(soTimer.current); soTimer.current = setTimeout(() => searchSalesOrders(v), 250); };
  const pickSalesOrder = (hit: SalesOrderHit) => {
    setSalesOrderId(hit.id); setSalesOrderNo(hit.docNo); setCustomerName(hit.customerName); setSoHits(null); setSoQuery(hit.docNo);
    setDeliveryAddressLocked(true);
    fetch(`/api/sales/order/lookup/${hit.id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok) setDeliveryAddress(j.order?.customer?.address ?? "");
    }).catch(() => {});
  };

  const custTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCustomers = async (q: string) => {
    if (!q.trim()) { setCustomerHits(null); return; }
    const j = await fetch(`/api/masters/customers?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setCustomerHits((j.customers ?? []).slice(0, 20));
  };
  const onCustomerQuery = (v: string) => { setCustomerQuery(v); if (custTimer.current) clearTimeout(custTimer.current); custTimer.current = setTimeout(() => searchCustomers(v), 250); };
  const pickCustomer = (hit: CustomerHit) => {
    setCustomerId(hit.id); setCustomerName(hit.name); setCustomerQuery(hit.name); setCustomerHits(null);
    setDeliveryAddress(hit.address ?? ""); setDeliveryAddressLocked(false);
  };

  const trTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTransferRequests = async (q: string) => {
    const j = await fetch(`/api/warehouse/transfer/request?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setTrHits((j.rows ?? []).slice(0, 25));
  };
  const onTrQuery = (v: string) => { setTrQuery(v); if (trTimer.current) clearTimeout(trTimer.current); trTimer.current = setTimeout(() => searchTransferRequests(v), 250); };
  const pickTransferRequest = (hit: TransferRequestHit) => {
    setTransferRequestId(hit.id); setTransferRequestNo(hit.requestNo);
    setSourceWarehouse(hit.sourceWarehouse ?? ""); setDestinationWarehouse(hit.destinationWarehouse ?? "");
    setTrHits(null); setTrQuery(hit.requestNo);
  };

  const pickDriverMaster = (id: number | "") => {
    setDriverMasterId(id);
    const d = driverMasters.find((x) => x.id === id);
    if (d) { setDriverName(d.name); setDriverMobile(d.phone ?? ""); setDriverLicenseNo(d.licenseNo ?? ""); }
  };

  async function save() {
    if (!vehicleId) { toast.error("Vehicle Number is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/transport/gate-entry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateEntryNo: gateEntryNo || null,
          vehicleId, driverId: driverMasterId || null, transportCompanyId: transportCompanyId || null,
          dispatchType: dispatchType || null, arrivalTime: entryDateTime ? new Date(entryDateTime).toISOString() : null,
          securityOfficer: securityOfficer || null,
          referenceType: referenceType || null, salesOrderId: salesOrderId || null, referenceNo: salesOrderNo || transferRequestNo || null,
          customerId: customerId || null, deliveryAddress: deliveryAddress || null,
          transferRequestId: transferRequestId || null,
          transportMode: transportMode || null, vehicleType: vehicleType || null,
          trailerNumber: trailerNumber || null, containerNumber: containerNumber || null,
          driverName: driverName || null, driverMobile: driverMobile || null, driverLicenseNo: driverLicenseNo || null,
          helperName: helperName || null, helperMobile: helperMobile || null,
          vehicleCapacity: vehicleCapacity ? Number(vehicleCapacity) : null, expectedLoadWeight: expectedLoadWeight ? Number(expectedLoadWeight) : null,
          gpsAvailable, sealNumber: sealNumber || null,
          purpose: purpose || null, expectedExitTime: expectedExitTime ? new Date(expectedExitTime).toISOString() : null,
          loadingBayId: loadingBayId || null, remarks: remarks || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Gate entry recorded."); setSavedId(j.id); }
      else { toast.error(j.message || "Could not save the gate entry."); setSaving(false); }
    } catch { toast.error("Network error — could not save."); setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/transport/gate-entry" className="hover:text-foreground">Vehicle Gate Entry</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> New Vehicle Gate Entry</h1>
          <p className="mt-0.5 text-sm text-muted">Records the vehicle physically arriving at the premises.</p>
        </div>
        <Link href="/transport/gate-entry"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <SectionCard icon={ShieldCheck} title="Gate Information" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fld label="Gate Entry No"><input value={gateEntryNo} onChange={(e) => setGateEntryNo(e.target.value)} placeholder="Leave blank to auto-generate" className={inp} /></Fld>
          <Fld label="Entry Date &amp; Time"><input type="datetime-local" value={entryDateTime} onChange={(e) => setEntryDateTime(e.target.value)} className={inp} /></Fld>
          <Fld label="Security Officer"><input value={securityOfficer} onChange={(e) => setSecurityOfficer(e.target.value)} className={inp} /></Fld>
          <Fld label="Location"><input value={location} disabled placeholder="Loading…" className={cn(inp, "text-subtle")} /></Fld>
        </div>
      </SectionCard>

      <SectionCard icon={FileText} title="Dispatch Information &amp; Reference Document" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fld label="Dispatch Type (optional)">
            <select value={dispatchType} onChange={(e) => { setDispatchType(e.target.value); setReferenceType(""); }} className={inp}>
              <option value="">—</option>
              {GATE_ENTRY_DISPATCH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Fld>
          {dispatchType === "Customer" && (
            <Fld label="Reference Type">
              <select value={referenceType} onChange={(e) => setReferenceType(e.target.value as typeof referenceType)} className={inp}>
                <option value="">—</option>
                <option value="Sales Order">Sales Order</option>
                <option value="Direct Customer Dispatch">Direct Customer Dispatch</option>
              </select>
            </Fld>
          )}
        </div>

        {dispatchType === "Customer" && referenceType === "Sales Order" && (
          <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <div className="relative">
              <label className="mb-1 block text-2xs font-semibold text-muted">Sales Order No</label>
              <input value={soQuery} onChange={(e) => onSoQuery(e.target.value)} placeholder="Search sales order…" className={inp} />
              {soHits !== null && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {soHits.length ? soHits.map((h) => (
                    <button key={h.id} onClick={() => pickSalesOrder(h)} className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40">
                      <span className="font-medium text-foreground">{h.docNo}</span> <span className="text-2xs text-subtle">— {h.customerName}</span>
                    </button>
                  )) : <div className="px-3 py-2 text-sm text-muted">No matching sales orders.</div>}
                </div>
              )}
            </div>
            <Fld label="Customer"><input value={customerName} disabled className={cn(inp, "text-subtle")} /></Fld>
            <div className="sm:col-span-2"><Fld label="Delivery Address"><textarea value={deliveryAddress} disabled rows={2} className={cn(inp, "h-auto py-2 text-subtle")} /></Fld></div>
            <p className="text-2xs text-subtle sm:col-span-2">Customer and delivery address are loaded automatically from the selected Sales Order.</p>
          </div>
        )}

        {dispatchType === "Customer" && referenceType === "Direct Customer Dispatch" && (
          <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <div className="relative">
              <label className="mb-1 block text-2xs font-semibold text-muted">Customer</label>
              <input value={customerQuery} onChange={(e) => onCustomerQuery(e.target.value)} placeholder="Search customer master…" className={inp} />
              {customerHits !== null && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {customerHits.length ? customerHits.map((h) => (
                    <button key={h.id} onClick={() => pickCustomer(h)} className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40">
                      <span className="font-medium text-foreground">{h.name}</span>{h.phone ? <span className="text-2xs text-subtle"> — {h.phone}</span> : null}
                    </button>
                  )) : <div className="px-3 py-2 text-sm text-muted">No matching customers.</div>}
                </div>
              )}
            </div>
            <div><Fld label="Delivery Address"><textarea value={deliveryAddress} disabled={deliveryAddressLocked} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld></div>
          </div>
        )}

        {dispatchType === "StockTransfer" && (
          <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
            <div className="relative">
              <label className="mb-1 block text-2xs font-semibold text-muted">Transfer Request No</label>
              <input value={trQuery} onChange={(e) => onTrQuery(e.target.value)} placeholder="Search transfer request…" className={inp} />
              {trHits !== null && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {trHits.length ? trHits.map((h) => (
                    <button key={h.id} onClick={() => pickTransferRequest(h)} className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40">{h.requestNo}</button>
                  )) : <div className="px-3 py-2 text-sm text-muted">No matching transfer requests.</div>}
                </div>
              )}
            </div>
            <Fld label="Source Warehouse"><input value={sourceWarehouse} disabled className={cn(inp, "text-subtle")} /></Fld>
            <Fld label="Destination Warehouse"><input value={destinationWarehouse} disabled className={cn(inp, "text-subtle")} /></Fld>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Truck} title="Transport Details" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-2xs font-semibold text-muted">Transport Company</label>
            <div className="flex gap-1.5">
              <select value={transportCompanyId} onChange={(e) => setTransportCompanyId(e.target.value ? Number(e.target.value) : "")} className={inp}><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              <button type="button" title="Add new transport company" onClick={() => setAddCompanyOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border-strong bg-surface text-muted hover:border-primary hover:text-primary"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          <Fld label="Transport Mode"><select value={transportMode} onChange={(e) => setTransportMode(e.target.value)} className={inp}>{TRANSPORT_MODES.map((t) => <option key={t} value={t}>{t || "—"}</option>)}</select></Fld>
          <Fld label="Vehicle Type"><input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="e.g. Truck, Trailer" className={inp} /></Fld>
          <div>
            <label className="mb-1 block text-2xs font-semibold text-muted">Vehicle Number *</label>
            <div className="flex gap-1.5">
              <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value ? Number(e.target.value) : "")} className={inp}><option value="">Select vehicle…</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
              <button type="button" title="Add new vehicle" onClick={() => setAddVehicleOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border-strong bg-surface text-muted hover:border-primary hover:text-primary"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          <Fld label="Trailer Number (optional)"><input value={trailerNumber} onChange={(e) => setTrailerNumber(e.target.value)} className={inp} /></Fld>
          <Fld label="Container Number (optional)"><input value={containerNumber} onChange={(e) => setContainerNumber(e.target.value)} className={inp} /></Fld>
        </div>
      </SectionCard>

      <SectionCard icon={Users} title="Driver Details" allowOverflow>
        <p className="mb-3 text-2xs text-subtle">Captured fresh at the gate — the actual driver entering may differ from anyone planned earlier.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fld label="Known Driver (optional)"><select value={driverMasterId} onChange={(e) => pickDriverMaster(e.target.value ? Number(e.target.value) : "")} className={inp}><option value="">— Enter manually below —</option>{driverMasters.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Fld>
          <Fld label="Driver Name"><input value={driverName} onChange={(e) => setDriverName(e.target.value)} className={inp} /></Fld>
          <Fld label="Mobile Number (optional)"><input value={driverMobile} onChange={(e) => setDriverMobile(e.target.value)} className={inp} /></Fld>
          <Fld label="License Number (optional)"><input value={driverLicenseNo} onChange={(e) => setDriverLicenseNo(e.target.value)} className={inp} /></Fld>
          <Fld label="Helper Name (optional)"><input value={helperName} onChange={(e) => setHelperName(e.target.value)} className={inp} /></Fld>
          <Fld label="Helper Mobile (optional)"><input value={helperMobile} onChange={(e) => setHelperMobile(e.target.value)} className={inp} /></Fld>
        </div>
      </SectionCard>

      <SectionCard icon={PackageSearch} title="Vehicle Details (optional)" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fld label="Vehicle Capacity"><input type="number" value={vehicleCapacity} onChange={(e) => setVehicleCapacity(e.target.value)} className={inp} /></Fld>
          <Fld label="Expected Load Weight"><input type="number" value={expectedLoadWeight} onChange={(e) => setExpectedLoadWeight(e.target.value)} className={inp} /></Fld>
          <Fld label="Seal Number (if applicable)"><input value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} className={inp} /></Fld>
          <label className="flex items-end gap-2 pb-2 text-sm font-medium text-foreground"><input type="checkbox" checked={gpsAvailable} onChange={(e) => setGpsAvailable(e.target.checked)} className="h-4 w-4 rounded border-border-strong" /> GPS Available</label>
        </div>
      </SectionCard>

      <SectionCard icon={ClipboardList} title="Entry Details (optional)" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fld label="Purpose"><input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Loading, Delivery, Inspection" className={inp} /></Fld>
          <Fld label="Expected Exit Time"><input type="datetime-local" value={expectedExitTime} onChange={(e) => setExpectedExitTime(e.target.value)} className={inp} /></Fld>
          <Fld label="Loading Bay"><select value={loadingBayId} onChange={(e) => setLoadingBayId(e.target.value ? Number(e.target.value) : "")} className={inp}><option value="">—</option>{loadingBays.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></Fld>
        </div>
        <div className="mt-3"><Fld label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld></div>
      </SectionCard>

      <div className="flex items-center justify-end gap-2">
        <Button size="lg" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Record Gate Entry</Button>
      </div>

      {addCompanyOpen && <AddTransportCompanyModal onClose={() => setAddCompanyOpen(false)} onAdded={(row) => { setCompanies((p) => [{ id: row.id, label: row.name }, ...p]); setTransportCompanyId(row.id); setAddCompanyOpen(false); }} />}
      {addVehicleOpen && <AddVehicleModal onClose={() => setAddVehicleOpen(false)} onAdded={(row) => { setVehicles((p) => [{ id: row.id, label: row.vehicleNo }, ...p]); setVehicleId(row.id); setAddVehicleOpen(false); }} />}
      {savedId != null && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-6 w-6" /></span>
              <h2 className="text-sm font-bold text-foreground">Gate Entry Recorded</h2>
              <p className="text-sm text-muted">Would you like to continue with the Pre Loading Weighment now, or do it later?</p>
            </div>
            <div className="flex flex-col gap-2 border-t border-border bg-surface-2 px-5 py-4">
              <Button size="md" onClick={() => router.push(`/transport/pre-weighment/new?gateEntryId=${savedId}`)}><Scale className="h-4 w-4" /> Continue to Weighment Now</Button>
              <Button variant="outline" size="md" onClick={() => router.push("/transport/gate-entry")}>Do It Later</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------- quick-add modals ---- */
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

function AddVehicleModal({ onClose, onAdded }: { onClose: () => void; onAdded: (row: { id: number; vehicleNo: string }) => void }) {
  const toast = useToast();
  const [vehicleNo, setVehicleNo] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!vehicleNo.trim()) { toast.error("Vehicle number is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/transport/masters/vehicle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleNo, vehicleType: vehicleType || null, ownerType: "Own", status: "Active" }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success("Vehicle added."); onAdded(j.row); }
      else { toast.error(j.message || "Could not add the vehicle."); setSaving(false); }
    } catch { toast.error("Network error."); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <h2 className="text-sm font-bold text-foreground">Add Vehicle</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <Fld label="Vehicle Number *"><input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className={inp} /></Fld>
          <Fld label="Vehicle Type"><input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="e.g. Truck, Trailer" className={inp} /></Fld>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={save} disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
        </div>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
