"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, ArrowLeft, ShieldCheck, FileText, Save, Loader2, Users, PackageSearch, ClipboardList, Plus, X, CheckCircle2, Scale, Boxes } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { GATE_ENTRY_DISPATCH_TYPES, VEHICLE_TYPE_OPTS } from "@/lib/contracts/transport";
import { fieldOn, fieldMust } from "@/lib/settings/docFieldsConfig";

const SCREEN = "vehicle_gate_entry";
const req = (key: string) => (fieldMust(SCREEN, key) ? " *" : "");

const TRANSPORT_MODES = ["", "Road", "Rail", "Air", "Courier", "Own Vehicle", "Third Party"];

interface Opt { id: number; label: string }
interface VehicleOpt extends Opt { vehicleType: string | null }
interface ProductHit { id: number; name: string; sku?: string; uom?: string }
interface ItemLine { id: string; productId: number; productName: string; sku: string; uom: string; qty: string }
interface SalesOrderHit { id: number; docNo: string; customerName: string }
interface TransferRequestHit { id: number; requestNo: string; sourceWarehouse: string | null; destinationWarehouse: string | null }
interface CustomerHit { id: number; name: string; phone: string | null; address: string | null }

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export function GateEntryEditor() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  // Shown the instant "Continue to Weighment Now" is clicked, through the
  // client-side route change — otherwise there's a blank beat where nothing
  // on screen indicates the click registered.
  const [navigating, setNavigating] = useState(false);
  // Blocks the whole form until every initial fetch (masters, next gate entry
  // number, Dispatch Configuration preload, scope/location) has resolved —
  // avoids the page rendering with fields still saying "Loading…" one by one.
  const [pageLoading, setPageLoading] = useState(true);

  // Masters for dropdowns.
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([]);
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
  const [lockDispatchType, setLockDispatchType] = useState(false);
  const [lockReferenceType, setLockReferenceType] = useState(false);
  // Item Details capture mode + whether Qty is even asked for — configured in
  // Settings → Dispatch Configuration → Vehicle Gate Entry Defaults. Quantity
  // is off by default: for bulk-material dispatches it isn't known at gate
  // time, only once the vehicle is actually weighed on Load & Dispatch.
  const [itemCaptureMode, setItemCaptureMode] = useState<"None" | "Single" | "Multiple">("Multiple");
  const [captureQtyAtGate, setCaptureQtyAtGate] = useState(false);
  const [soQuery, setSoQuery] = useState("");
  const [soHits, setSoHits] = useState<SalesOrderHit[] | null>(null);
  const [salesOrderId, setSalesOrderId] = useState<number | "">("");
  const [salesOrderNo, setSalesOrderNo] = useState("");
  const [customerId, setCustomerId] = useState<number | "">("");
  const [customerName, setCustomerName] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<CustomerHit[] | null>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
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

  // Item Details (optional) — what the vehicle is expected to carry.
  const [items, setItems] = useState<ItemLine[]>([]);
  const [pq, setPq] = useState("");
  const [productHits, setProductHits] = useState<ProductHit[] | null>(null);
  const [searchingProduct, setSearchingProduct] = useState(false);

  const loadMasters = () => {
    return Promise.all([
      fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/transport/masters/transport-company?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]).then(([v, c]) => {
      if (v.ok) setVehicles(v.rows.map((x: { id: number; vehicleNo: string; vehicleType: string | null }) => ({ id: x.id, label: x.vehicleNo, vehicleType: x.vehicleType })));
      if (c.ok) setCompanies(c.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name })));
    });
  };

  useEffect(() => {
    const nextNumber = fetch("/api/transport/gate-entry/next-number", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setGateEntryNo(j.nextNo); }).catch(() => {});
    // Preload Dispatch Type / Reference Type from Dispatch Configuration so
    // most users never have to pick them; lock flags make the preload
    // non-changeable rather than just a starting value.
    const dispatchConfig = fetch("/api/settings/dispatch-config", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      const dt = j.config?.fields?.defaultDispatchType;
      const rt = j.config?.fields?.defaultReferenceType;
      if (dt) setDispatchType(dt);
      if (rt) setReferenceType(rt);
      setLockDispatchType(!!j.config?.flags?.lockDefaultDispatchType);
      setLockReferenceType(!!j.config?.flags?.lockDefaultReferenceType);
      const icm = j.config?.fields?.itemCaptureMode;
      if (icm === "None" || icm === "Single" || icm === "Multiple") setItemCaptureMode(icm);
      setCaptureQtyAtGate(!!j.config?.flags?.captureQtyAtGate);
    }).catch(() => {});
    const masters = loadMasters();
    const bays = fetch("/api/transport/masters/loading-bay?status=Active", { cache: "no-store" }).then((r) => r.json()).then((lb) => { if (lb.ok) setLoadingBays(lb.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name }))); }).catch(() => {});
    const drivers = fetch("/api/transport/masters/driver?status=Active", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d.ok) setDriverMasters(d.rows.map((x: { id: number; name: string; phone: string | null; licenseNo: string | null }) => ({ id: x.id, name: x.name, phone: x.phone, licenseNo: x.licenseNo }))); }).catch(() => {});
    // Location — same source as the app's top bar (active business/branch scope).
    const scope = fetch("/api/system/scope", { cache: "no-store" }).then((r) => r.json()).then((j) => {
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
    Promise.allSettled([nextNumber, dispatchConfig, masters, bays, drivers, scope]).finally(() => setPageLoading(false));
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
    if (!q.trim()) { setCustomerHits(null); setSearchingCustomer(false); return; }
    try {
      const j = await fetch(`/api/masters/customers?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) setCustomerHits((j.customers ?? []).slice(0, 20));
    } finally { setSearchingCustomer(false); }
  };
  // The spinner starts the moment typing pauses (not just once the debounce
  // fires the actual request) so the user immediately sees "your input was
  // registered" rather than a dead field for the full 250ms debounce window.
  const onCustomerQuery = (v: string) => {
    setCustomerQuery(v);
    if (custTimer.current) clearTimeout(custTimer.current);
    if (!v.trim()) { setCustomerHits(null); setSearchingCustomer(false); return; }
    setSearchingCustomer(true);
    custTimer.current = setTimeout(() => searchCustomers(v), 250);
  };
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

  const prodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchProducts = async (q: string) => {
    if (!q.trim()) { setProductHits(null); setSearchingProduct(false); return; }
    try {
      const j = await fetch(`/api/pos/products?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) setProductHits(j.products ?? []);
    } catch { setProductHits(null); } finally { setSearchingProduct(false); }
  };
  const onPq = (v: string) => {
    setPq(v);
    if (prodTimer.current) clearTimeout(prodTimer.current);
    if (!v.trim()) { setProductHits(null); setSearchingProduct(false); return; }
    setSearchingProduct(true);
    prodTimer.current = setTimeout(() => searchProducts(v), 250);
  };
  const addItem = (p: ProductHit) => {
    const line: ItemLine = { id: `${p.id}-${Math.random().toString(36).slice(2, 7)}`, productId: p.id, productName: p.name, sku: p.sku ?? "", uom: p.uom ?? "", qty: "1" };
    // Single mode: picking a product replaces whatever was there — the
    // section only ever tracks one item at a time.
    setItems((prev) => (itemCaptureMode === "Single" ? [line] : [...prev, line]));
    setPq(""); setProductHits(null);
  };
  const updItem = (id: string, qty: string) => setItems((p) => p.map((l) => (l.id === id ? { ...l, qty } : l)));
  const removeItem = (id: string) => setItems((p) => p.filter((l) => l.id !== id));

  const pickDriverMaster = (id: number | "") => {
    setDriverMasterId(id);
    const d = driverMasters.find((x) => x.id === id);
    if (d) { setDriverName(d.name); setDriverMobile(d.phone ?? ""); setDriverLicenseNo(d.licenseNo ?? ""); }
  };

  async function save() {
    // Vehicle Number is structurally required (the API rejects a missing one
    // regardless of this setting) — default true, but still routed through
    // the same configurable check as everything else per Document Field
    // Settings, rather than a separate hardcoded guard.
    const checks: [string, boolean, string, boolean?][] = [
      ["vehicleNumber", !vehicleId, "Vehicle Number", true],
      ["securityOfficer", !securityOfficer.trim(), "Security Officer"],
      ["transportCompany", !transportCompanyId, "Transport Company"],
      ["transportMode", !transportMode, "Transport Mode"],
      ["vehicleType", !vehicleType, "Vehicle Type"],
      ["driverMobile", !driverMobile.trim(), "Driver Mobile"],
      ["driverLicenseNo", !driverLicenseNo.trim(), "Driver License No."],
      ["deliveryAddress", dispatchType === "Customer" && referenceType === "Direct Customer Dispatch" && !deliveryAddress.trim(), "Delivery Address"],
      ["customer", dispatchType === "Customer" && referenceType === "Direct Customer Dispatch" && !customerId, "Customer"],
      ["product", fieldOn(SCREEN, "itemDetails") && items.length === 0, "At least one item"],
    ];
    for (const [key, missing, label, fallback] of checks) {
      if (fieldOn(SCREEN, key) && fieldMust(SCREEN, key, fallback) && missing) { toast.error(`${label} is required.`); return; }
    }
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
          // Qty is only meaningful when Capture Quantity at Gate is on — otherwise
          // this section captures product name only, and 1 is just a non-zero
          // placeholder the schema requires (no downstream use makes sense of it).
          items: items.map((l) => ({ productId: l.productId, productName: l.productName, sku: l.sku || null, uom: l.uom || null, qty: captureQtyAtGate ? Number(l.qty) || 0 : 1 })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Gate entry recorded."); setSavedId(j.id); }
      else { toast.error(j.message || "Could not save the gate entry."); setSaving(false); }
    } catch { toast.error("Network error — could not save."); setSaving(false); }
  }

  if (pageLoading) return <div className="py-16"><AppLoader label="Loading gate entry form…" /></div>;

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
          <Fld label="Gate Entry No"><input value={gateEntryNo} onChange={(e) => setGateEntryNo(e.target.value)} placeholder="Auto-generating…" className={inp} /></Fld>
          <Fld label="Entry Date &amp; Time"><input type="datetime-local" value={entryDateTime} onChange={(e) => setEntryDateTime(e.target.value)} className={inp} /></Fld>
          {fieldOn(SCREEN, "securityOfficer") && <Fld label={`Security Officer${req("securityOfficer")}`}><input value={securityOfficer} onChange={(e) => setSecurityOfficer(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "location") && <Fld label="Location"><input value={location} disabled placeholder="Loading…" className={cn(inp, "text-subtle")} /></Fld>}
        </div>
      </SectionCard>

      <SectionCard icon={FileText} title="Dispatch Information &amp; Reference Document" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fld label="Dispatch Type (optional)">
            <select value={dispatchType} disabled={lockDispatchType} onChange={(e) => { setDispatchType(e.target.value); setReferenceType(""); }} className={cn(inp, lockDispatchType && "cursor-not-allowed text-subtle")}>
              <option value="">—</option>
              {GATE_ENTRY_DISPATCH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {lockDispatchType && <p className="mt-1 text-2xs text-subtle">Locked by Dispatch Configuration.</p>}
          </Fld>
          {dispatchType === "Customer" && (
            <Fld label="Reference Type">
              <select value={referenceType} disabled={lockReferenceType} onChange={(e) => setReferenceType(e.target.value as typeof referenceType)} className={cn(inp, lockReferenceType && "cursor-not-allowed text-subtle")}>
                <option value="">—</option>
                <option value="Sales Order">Sales Order</option>
                <option value="Direct Customer Dispatch">Direct Customer Dispatch</option>
              </select>
              {lockReferenceType && <p className="mt-1 text-2xs text-subtle">Locked by Dispatch Configuration.</p>}
            </Fld>
          )}
          {dispatchType === "Customer" && referenceType === "Direct Customer Dispatch" && (
            <div className="relative">
              <label className="mb-1 block text-2xs font-semibold text-muted">Customer{req("customer")}</label>
              <div className="relative">
                <input value={customerQuery} onChange={(e) => onCustomerQuery(e.target.value)} placeholder="Search customer master…" className={cn(inp, searchingCustomer && "pr-9")} />
                {searchingCustomer && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
              </div>
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
            <p className="text-2xs text-subtle sm:col-span-2">Customer is loaded automatically from the selected Sales Order.</p>
          </div>
        )}

        {dispatchType === "Customer" && referenceType === "Direct Customer Dispatch" && fieldOn(SCREEN, "deliveryAddress") && (
          <div className="mt-3 border-t border-border pt-3">
            <Fld label={`Delivery Address${fieldMust(SCREEN, "deliveryAddress") ? " *" : " (optional)"}`}><textarea value={deliveryAddress} disabled={deliveryAddressLocked} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} placeholder="Only needed if delivery differs from the customer's usual address" className={cn(inp, "h-auto py-2 max-w-md")} /></Fld>
            {!fieldMust(SCREEN, "deliveryAddress") && <p className="mt-1 text-2xs text-subtle">Customer name is enough for a direct dispatch — address is optional.</p>}
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
          {fieldOn(SCREEN, "transportCompany") && (
          <div>
            <label className="mb-1 block text-2xs font-semibold text-muted">Transport Company{req("transportCompany")}</label>
            <div className="flex gap-1.5">
              <select value={transportCompanyId} onChange={(e) => setTransportCompanyId(e.target.value ? Number(e.target.value) : "")} className={inp}><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              <button type="button" title="Add new transport company" onClick={() => setAddCompanyOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border-strong bg-surface text-muted hover:border-primary hover:text-primary"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          )}
          {fieldOn(SCREEN, "transportMode") && <Fld label={`Transport Mode${req("transportMode")}`}><select value={transportMode} onChange={(e) => setTransportMode(e.target.value)} className={inp}>{TRANSPORT_MODES.map((t) => <option key={t} value={t}>{t || "—"}</option>)}</select></Fld>}
          <div>
            <label className="mb-1 block text-2xs font-semibold text-muted">Vehicle Number{req("vehicleNumber")}</label>
            <div className="flex gap-1.5">
              <select
                value={vehicleId}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : "";
                  setVehicleId(id);
                  const v = vehicles.find((x) => x.id === id);
                  if (v?.vehicleType) setVehicleType(v.vehicleType);
                }}
                className={inp}
              >
                <option value="">Select vehicle…</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <button type="button" title="Add new vehicle" onClick={() => setAddVehicleOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border-strong bg-surface text-muted hover:border-primary hover:text-primary"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          {fieldOn(SCREEN, "vehicleType") && <Fld label={`Vehicle Type${req("vehicleType")}`}><select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inp}><option value="">— Select —</option>{VEHICLE_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></Fld>}
          {fieldOn(SCREEN, "trailerNumber") && <Fld label="Trailer Number (optional)"><input value={trailerNumber} onChange={(e) => setTrailerNumber(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "containerNumber") && <Fld label="Container Number (optional)"><input value={containerNumber} onChange={(e) => setContainerNumber(e.target.value)} className={inp} /></Fld>}
        </div>
      </SectionCard>

      {fieldOn(SCREEN, "itemDetails") && itemCaptureMode !== "None" && (
      <SectionCard icon={Boxes} title={`Item Details${fieldMust(SCREEN, "product") ? " *" : " (optional)"}`} allowOverflow>
        <p className="mb-3 text-2xs text-subtle">
          {itemCaptureMode === "Single" ? "The single product " : "What the vehicle is expected to carry — "}
          {captureQtyAtGate ? "captured here, informational only at this stage — no stock/allocation impact." : "captured by name only — quantity is derived later from the Post-Loading Weighment's net weight on Load & Dispatch."}
        </p>
        {(itemCaptureMode !== "Single" || items.length === 0) && (
        <div className="relative mb-3 max-w-md">
          <input value={pq} onChange={(e) => onPq(e.target.value)} placeholder="Search product to add…" className={cn(inp, searchingProduct && "pr-9")} />
          {searchingProduct && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
          {productHits !== null && (productHits.length ? (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
              {productHits.map((p) => (
                <button key={p.id} onClick={() => addItem(p)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40">
                  <span className="min-w-0"><span className="block font-medium text-foreground">{p.name}</span><span className="block text-2xs text-subtle">{p.sku || "—"}</span></span>
                  <Plus className="h-3.5 w-3.5 text-primary" />
                </button>
              ))}
            </div>
          ) : <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No products matched.</div>)}
        </div>
        )}
        {items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-auto" />
                <col className="w-24" />
                {captureQtyAtGate && <col className="w-32" />}
                <col className="w-12" />
              </colgroup>
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-3 py-2">Product</th><th className="px-3 py-2">UOM</th>{captureQtyAtGate && <th className="px-3 py-2 text-right">Qty</th>}<th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5"><div className="truncate font-medium text-foreground">{l.productName}</div>{l.sku ? <div className="truncate text-2xs text-subtle">{l.sku}</div> : null}</td>
                    <td className="px-3 py-1.5 text-2xs text-muted">{l.uom || "—"}</td>
                    {captureQtyAtGate && <td className="px-3 py-1.5"><input type="number" min={0} value={l.qty} onChange={(e) => updItem(l.id, e.target.value.slice(0, 10))} className="h-8 w-full rounded-md border border-border-strong bg-surface px-2 text-right text-sm text-foreground focus:border-primary focus:outline-none" /></td>}
                    <td className="px-3 py-1.5 text-center"><button onClick={() => removeItem(l.id)} className="text-subtle hover:text-danger"><X className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      )}

      <SectionCard icon={Users} title="Driver Details" allowOverflow>
        <p className="mb-3 text-2xs text-subtle">Captured fresh at the gate — the actual driver entering may differ from anyone planned earlier.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fieldOn(SCREEN, "driverMaster") && <Fld label="Known Driver (optional)"><select value={driverMasterId} onChange={(e) => pickDriverMaster(e.target.value ? Number(e.target.value) : "")} className={inp}><option value="">— Enter manually below —</option>{driverMasters.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Fld>}
          <Fld label="Driver Name"><input value={driverName} onChange={(e) => setDriverName(e.target.value)} className={inp} /></Fld>
          {fieldOn(SCREEN, "driverMobile") && <Fld label={`Mobile Number${req("driverMobile")}`}><input value={driverMobile} onChange={(e) => setDriverMobile(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "driverLicenseNo") && <Fld label={`License Number${req("driverLicenseNo")}`}><input value={driverLicenseNo} onChange={(e) => setDriverLicenseNo(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "helperName") && <Fld label="Helper Name (optional)"><input value={helperName} onChange={(e) => setHelperName(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "helperMobile") && <Fld label="Helper Mobile (optional)"><input value={helperMobile} onChange={(e) => setHelperMobile(e.target.value)} className={inp} /></Fld>}
        </div>
      </SectionCard>

      {(fieldOn(SCREEN, "vehicleCapacity") || fieldOn(SCREEN, "expectedLoadWeight") || fieldOn(SCREEN, "sealNumber") || fieldOn(SCREEN, "gpsAvailable")) && (
      <SectionCard icon={PackageSearch} title="Vehicle Details (optional)" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fieldOn(SCREEN, "vehicleCapacity") && <Fld label="Vehicle Capacity"><input type="number" value={vehicleCapacity} onChange={(e) => setVehicleCapacity(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "expectedLoadWeight") && <Fld label="Expected Load Weight"><input type="number" value={expectedLoadWeight} onChange={(e) => setExpectedLoadWeight(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "sealNumber") && <Fld label="Seal Number (if applicable)"><input value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "gpsAvailable") && <label className="flex items-end gap-2 pb-2 text-sm font-medium text-foreground"><input type="checkbox" checked={gpsAvailable} onChange={(e) => setGpsAvailable(e.target.checked)} className="h-4 w-4 rounded border-border-strong" /> GPS Available</label>}
        </div>
      </SectionCard>
      )}

      {(fieldOn(SCREEN, "purpose") || fieldOn(SCREEN, "expectedExitTime") || fieldOn(SCREEN, "loadingBay") || fieldOn(SCREEN, "remarks")) && (
      <SectionCard icon={ClipboardList} title="Entry Details (optional)" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fieldOn(SCREEN, "purpose") && <Fld label="Purpose"><input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Loading, Delivery, Inspection" className={inp} /></Fld>}
          {fieldOn(SCREEN, "expectedExitTime") && <Fld label="Expected Exit Time"><input type="datetime-local" value={expectedExitTime} onChange={(e) => setExpectedExitTime(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "loadingBay") && <Fld label="Loading Bay"><select value={loadingBayId} onChange={(e) => setLoadingBayId(e.target.value ? Number(e.target.value) : "")} className={inp}><option value="">—</option>{loadingBays.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></Fld>}
        </div>
        {fieldOn(SCREEN, "remarks") && <div className="mt-3"><Fld label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld></div>}
      </SectionCard>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button size="lg" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Record Gate Entry</Button>
      </div>

      {addCompanyOpen && <AddTransportCompanyModal onClose={() => setAddCompanyOpen(false)} onAdded={(row) => { setCompanies((p) => [{ id: row.id, label: row.name }, ...p]); setTransportCompanyId(row.id); setAddCompanyOpen(false); }} />}
      {addVehicleOpen && <AddVehicleModal onClose={() => setAddVehicleOpen(false)} onAdded={(row) => { setVehicles((p) => [{ id: row.id, label: row.vehicleNo, vehicleType: row.vehicleType ?? null }, ...p]); setVehicleId(row.id); if (row.vehicleType) setVehicleType(row.vehicleType); setAddVehicleOpen(false); }} />}
      {savedId != null && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-6 w-6" /></span>
              <h2 className="text-sm font-bold text-foreground">Gate Entry Recorded</h2>
              <p className="text-sm text-muted">Would you like to continue with the Pre Loading Weighment now, or do it later?</p>
            </div>
            <div className="flex flex-col gap-2 border-t border-border bg-surface-2 px-5 py-4">
              <Button size="md" disabled={navigating} onClick={() => { setNavigating(true); router.push(`/transport/pre-weighment/new?gateEntryId=${savedId}`); }}>
                {navigating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />} Continue to Weighment Now
              </Button>
              <Button variant="outline" size="md" disabled={navigating} onClick={() => router.push("/transport/gate-entry")}>Do It Later</Button>
            </div>
          </div>
        </div>
      )}
      {navigating && <AppLoader fullScreen label="Opening Pre Loading Weighment" />}
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

function AddVehicleModal({ onClose, onAdded }: { onClose: () => void; onAdded: (row: { id: number; vehicleNo: string; vehicleType: string | null }) => void }) {
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
          <Fld label="Vehicle Type"><select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inp}><option value="">— Select —</option>{VEHICLE_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></Fld>
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
