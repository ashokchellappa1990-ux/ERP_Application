"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Scale, ArrowLeft, Truck, Users, Save, Loader2, Plus, X, CheckCircle2, Printer, Search, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { FetchWeightButton } from "@/components/shared/FetchWeightButton";
import { WeighbridgeReadout } from "@/components/shared/WeighbridgeReadout";
import { useWeighbridgeContext } from "@/components/shared/WeighbridgeProvider";
import { WEIGHMENT_COPY, WeighmentTypeToggle, typeOfEntry, type WeighmentType } from "@/components/transport/weighmentType";

interface GateRow {
  id: number; gateEntryNo: string; vehicleId: number; vehicleNo: string; status: string; entryType: string;
  driverName: string | null; driverMobile: string | null; driverLicenseNo: string | null;
  transportCompanyId: number | null; transportCompanyName: string | null; vehicleType: string | null;
  customerName: string | null; dispatchType: string | null; referenceNo: string | null;
  supplierName: string | null; expectedMaterial: string | null; grossWeight: number | null; grnId: number | null;
}
interface Opt { id: number; label: string }
interface CustomerHit { id: number; name: string; phone: string }
interface ProductHit { id: number; name: string; sku?: string; uom?: string }

// Entry Weighment — Sales: empty (tare) weight before loading. Purchase: loaded
// (gross) weight before unloading, plus the GRN-prefill details (product,
// supplier slip net weight, weight slip ref, inventory area).
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

  const [type, setType] = useState<WeighmentType>(searchParams.get("type") === "Purchase" ? "Purchase" : "Sales");
  const isPurchase = type === "Purchase";
  const copy = WEIGHMENT_COPY[type];
  const backHref = fromGateEntry
    ? (isPurchase ? "/transport/gate-entry?entryType=RawMaterial" : "/transport/gate-entry")
    : `/transport/pre-weighment${isPurchase ? "?type=Purchase" : ""}`;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [eligibleByType, setEligibleByType] = useState<Record<WeighmentType, GateRow[]>>({ Sales: [], Purchase: [] });
  const eligible = eligibleByType[type];
  const [companies, setCompanies] = useState<Opt[]>([]);
  const [weighbridges, setWeighbridges] = useState<Opt[]>([]);
  const [areas, setAreas] = useState<{ id: number; name: string; code: string }[]>([]);
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

  // The one weight this weighment captures — tare for Sales, gross for Purchase.
  const [weight, setWeight] = useState("");
  const [operator, setOperator] = useState("");
  const [weighbridgeId, setWeighbridgeId] = useState<number | "">("");
  const [remarks, setRemarks] = useState("");
  // Purchase-only GRN-prefill details.
  const [billNetWeight, setBillNetWeight] = useState("");
  const [weightSlipRefNo, setWeightSlipRefNo] = useState("");
  const [areaId, setAreaId] = useState<number | "">("");
  const [product, setProduct] = useState<{ productId: number; productName: string; sku: string; uom: string } | null>(null);
  const [pq, setPq] = useState("");
  const [productHits, setProductHits] = useState<ProductHit[] | null>(null);
  const [searchingProduct, setSearchingProduct] = useState(false);

  const [enableWeighbridgeFetch, setEnableWeighbridgeFetch] = useState(false);
  const wb2 = useWeighbridgeContext();

  useEffect(() => {
    (async () => {
      const j = await fetch("/api/settings/purchase", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok && j.config) setEnableWeighbridgeFetch(!!j.config.flags?.enableWeighbridgeFetch);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [wt, geSales, gePurchase, wb, co, ar] = await Promise.all([
        fetch("/api/transport/pre-weighment", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/gate-entry?entryType=Dispatch", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/gate-entry?entryType=RawMaterial", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/masters/weighbridge?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/masters/transport-company?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/system/areas", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ]);
      const weighedGateIds = new Set((wt.ok ? wt.rows : []).map((r: { gateEntryId: number }) => r.gateEntryId));
      const open = (g: GateRow) => (g.status === "Waiting" || g.status === "Inside Factory") && !weighedGateIds.has(g.id);
      const sales: GateRow[] = (geSales.ok ? geSales.rows : []).filter(open);
      // A Raw Material entry already weighed through the old gate-entry "Update
      // Weight" step (grossWeight set) or already turned into a GRN is past this step.
      const purchase: GateRow[] = (gePurchase.ok ? gePurchase.rows : []).filter((g: GateRow) => open(g) && g.grossWeight == null && !g.grnId);
      setEligibleByType({ Sales: sales, Purchase: purchase });
      if (wb.ok) setWeighbridges(wb.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name })));
      if (co.ok) setCompanies(co.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name })));
      if (ar.ok) setAreas(ar.rows.map((a: { id: number; name: string; code: string }) => ({ id: a.id, name: a.name, code: a.code })));

      // A hand-off link decides the type from the gate entry itself.
      const pre = preselectId ? [...sales, ...purchase].find((r) => r.id === Number(preselectId)) : undefined;
      const initialType = pre ? typeOfEntry(pre.entryType) : type;
      if (pre) setType(initialType);
      const initial = pre ?? (initialType === "Purchase" ? purchase : sales)[0];
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

  function clearSelection() {
    setGateEntryId(""); setTransportCompanyId(""); setVehicleType(""); setCustomerName(""); setCustomerQuery(""); setDriverName(""); setDriverMobile(""); setDriverLicenseNo("");
  }

  function onSelectVehicle(id: number | "") {
    const g = eligible.find((x) => x.id === id);
    if (g) applyGateEntry(g); else clearSelection();
  }

  function switchType(t: WeighmentType) {
    if (t === type) return;
    setType(t);
    setWeight(""); setBillNetWeight(""); setWeightSlipRefNo(""); setAreaId(""); setProduct(null);
    const first = eligibleByType[t][0];
    if (first) applyGateEntry(first); else clearSelection();
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

  const prodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchProducts = async (q: string) => {
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
  const pickProduct = (p: ProductHit) => { setProduct({ productId: p.id, productName: p.name, sku: p.sku ?? "", uom: p.uom ?? "" }); setPq(""); setProductHits(null); };

  async function save() {
    if (!gateEntryId) { toast.error("Select a vehicle."); return; }
    const w = Number(weight);
    if (!weight || !Number.isFinite(w) || w < 0 || (isPurchase && w <= 0)) { toast.error(`Enter a valid ${copy.first.weight.toLowerCase()} weight.`); return; }
    setSaving(true);
    try {
      if (editingDetails) {
        await fetch(`/api/transport/gate-entry/${gateEntryId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transportCompanyId: transportCompanyId || null, driverName: driverName || null, driverMobile: driverMobile || null, driverLicenseNo: driverLicenseNo || null,
            ...(isPurchase ? {} : { customerName: customerName || null }),
          }),
        }).catch(() => {});
      }
      const res = await fetch("/api/transport/pre-weighment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateEntryId, operator: operator || null,
          weighbridgeId: weighbridgeId || null, weighDate: new Date().toISOString().slice(0, 10),
          weighTime: new Date().toTimeString().slice(0, 5), remarks: remarks || null,
          ...(isPurchase
            ? { grossWeight: w, billNetWeight: billNetWeight ? Number(billNetWeight) : null, weightSlipRefNo: weightSlipRefNo || null, areaId: areaId || null, productId: product?.productId ?? null }
            : { tareWeight: w }),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Entry weighment recorded."); setSavedId(j.id); }
      else { toast.error(j.message || "Could not save the weighment."); setSaving(false); }
    } catch { toast.error("Network error — could not save."); setSaving(false); }
  }

  function createGrnNow() {
    const g = eligible.find((x) => x.id === gateEntryId);
    if (!g) return;
    const p = new URLSearchParams({ gateEntryId: String(g.id), vehicleNo: g.vehicleNo });
    if (g.supplierName) p.set("supplier", g.supplierName);
    if (weight) p.set("grossWeight", weight);
    router.push(`/purchase/grn/new?${p}`);
  }

  const selected = gateEntryId !== "" ? eligible.find((x) => x.id === gateEntryId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href={backHref} className="hover:text-foreground">{fromGateEntry ? "Vehicle Gate Entry" : "Entry Weighment"}</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Scale className="h-5 w-5 text-primary" /> New Entry Weighment</h1>
          <p className="mt-0.5 text-sm text-muted">{copy.first.hint}</p>
        </div>
        <Link href={backHref}><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <WeighmentTypeToggle value={type} onChange={switchType} disabled={loading || fromGateEntry} />

      {loading && <AppLoader label="Loading vehicle & weighment details…" />}

      {!loading && eligible.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Scale className="mx-auto h-8 w-8 text-subtle" />
          <p className="mt-3 text-sm font-semibold text-foreground">No {type.toLowerCase()} vehicles are ready for entry weighment.</p>
          <p className="mt-1 text-sm text-muted">
            {isPurchase
              ? "A vehicle needs a Raw Material Gate Entry (Waiting or Inside Factory) that hasn't been weighed or turned into a GRN yet."
              : "A vehicle needs a Stock Dispatch Gate Entry (Waiting or Inside Factory) that hasn't been weighed yet."}
          </p>
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
              {selected && (isPurchase ? (
                <>
                  <Fld label="Supplier"><input value={selected.supplierName ?? "—"} disabled className={cn(inp, "text-subtle")} /></Fld>
                  <Fld label="Expected Material"><input value={selected.expectedMaterial ?? "—"} disabled className={cn(inp, "text-subtle")} /></Fld>
                </>
              ) : (
                <>
                  <Fld label="Dispatch Type"><input value={selected.dispatchType ?? "—"} disabled className={cn(inp, "text-subtle")} /></Fld>
                  <Fld label="Reference No"><input value={selected.referenceNo ?? "—"} disabled className={cn(inp, "text-subtle")} /></Fld>
                </>
              ))}
            </div>
          </SectionCard>

          <SectionCard icon={Users} title={isPurchase ? "Transport & Driver Details" : "Customer, Transport & Driver Details"} allowOverflow>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-2xs text-subtle">Loaded automatically from the vehicle&apos;s Gate Entry. Anything missing can be added here.</p>
              {!editingDetails && <button type="button" onClick={() => setEditingDetails(true)} className="text-2xs font-semibold text-primary hover:underline">Modify</button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {!isPurchase && (
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
              )}
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

          {isPurchase && (
            <SectionCard icon={Package} title="Material" allowOverflow>
              {!product ? (
                <div className="relative max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <input value={pq} onChange={(e) => onPq(e.target.value)} placeholder="Search product received…" className={cn(inp, "pl-9 pr-9")} />
                  {searchingProduct && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
                  {productHits !== null && (productHits.length ? (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                      {productHits.map((p) => (
                        <button key={p.id} type="button" onClick={() => pickProduct(p)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40">
                          <span className="min-w-0"><span className="block font-medium text-foreground">{p.name}</span><span className="block text-2xs text-subtle">{p.sku || "—"}</span></span>
                          <Plus className="h-3.5 w-3.5 text-primary" />
                        </button>
                      ))}
                    </div>
                  ) : <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No products matched.</div>)}
                </div>
              ) : (
                <div className="flex max-w-md items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{product.productName}</p><p className="font-mono text-2xs text-subtle">{product.sku || "—"} · {product.uom || "—"}</p></div>
                  <button type="button" onClick={() => setProduct(null)} className="text-subtle hover:text-danger"><X className="h-4 w-4" /></button>
                </div>
              )}
              <p className="mt-2 text-2xs text-subtle">Optional — carried into the GRN created from this gate entry.</p>
            </SectionCard>
          )}

          <SectionCard icon={Scale} title="Weighment Details" allowOverflow action={enableWeighbridgeFetch ? <WeighbridgeReadout state={wb2.state} liveWeight={wb2.liveWeight} /> : undefined}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fld label="Weighbridge"><select value={weighbridgeId} onChange={(e) => setWeighbridgeId(e.target.value ? Number(e.target.value) : "")} className={inp}><option value="">—</option>{weighbridges.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></Fld>
              <div>
                <label className="mb-1 block text-2xs font-semibold text-muted">{copy.first.label} *</label>
                <div className="flex gap-1.5">
                  <input type="number" min={0} step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} className={inp} />
                  {enableWeighbridgeFetch && <FetchWeightButton connected={wb2.state === "connected"} liveWeight={wb2.liveWeight} onFetch={(kg) => setWeight(String(kg))} />}
                </div>
              </div>
              <Fld label="Operator"><input value={operator} onChange={(e) => setOperator(e.target.value)} className={inp} /></Fld>
              {isPurchase && (
                <>
                  <Fld label="Net Weight as per Supplier Slip (Kg)"><input type="number" min={0} step="0.001" value={billNetWeight} onChange={(e) => setBillNetWeight(e.target.value)} placeholder="Optional" className={inp} /></Fld>
                  <Fld label="Weight Slip Ref Number"><input value={weightSlipRefNo} onChange={(e) => setWeightSlipRefNo(e.target.value)} placeholder="Optional" className={inp} /></Fld>
                  <Fld label="Inventory Movement Area">
                    <select value={areaId} onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : "")} className={inp}>
                      <option value="">— Select —</option>
                      {areas.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                  </Fld>
                </>
              )}
            </div>
            <div className="mt-3"><Fld label="Notes / Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld></div>
            {isPurchase && <p className="mt-2 text-2xs text-subtle">Tare and the calculated net weight are captured in the Exit Weighment, after the vehicle is unloaded and weighed empty.</p>}
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
              <p className="text-sm text-muted">{isPurchase ? "Print the weight slip, or create the GRN now?" : "Do you want to print the Pre Load Weight Slip?"}</p>
            </div>
            <div className="flex flex-col gap-2 border-t border-border bg-surface-2 px-5 py-4">
              <Button size="md" onClick={() => router.push(`/transport/pre-weighment/token?id=${savedId}&next=${encodeURIComponent(backHref)}`)}><Printer className="h-4 w-4" /> Preview &amp; Print</Button>
              {isPurchase && <Button variant="secondary" size="md" onClick={createGrnNow}><FileText className="h-4 w-4" /> Create GRN Now</Button>}
              <Button variant="outline" size="md" onClick={() => router.push(backHref)}>Do It Later</Button>
            </div>
          </div>
        </div>
      )}
      {/* Covers the gap between clicking "Record Weighment" and either the
          success popup (savedId set) or an error toast — same fullScreen
          treatment used on Vehicle Gate Entry's Record Gate Entry button. */}
      {saving && savedId == null && <AppLoader fullScreen label="Recording weighment…" />}
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
