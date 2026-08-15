"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, Search, Save, Send, ArrowLeft, Boxes, IndianRupee, ListChecks, Plus, Trash2, ChevronDown, Layers, Wallet, FileText, Info, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { GrnFlowStepper } from "@/components/purchase/GrnFlowStepper";
import { formatMoneyWith, formatQtyWith } from "@/lib/settings/generalConfig";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

interface Candidate { productId: number; productName: string; sku: string; uom: string; category: string; mrp: number; gst: number; invBatch: boolean; invMfg: boolean; invExpiry: boolean; invSerial: boolean; qrRequired: boolean }
interface Line extends Candidate {
  key: string; qty: string; rate: string; sellingPrice: string; profitPct: string; discPct: string; taxPct: string; mrpStr: string;
  batchNo: string; mfgDate: string; expiryDate: string; remarks: string; qrMode: "shared" | "unique"; expanded: boolean;
  serials: string[]; // manufacturer serials for serial-managed products
}
interface SupplierRow { id: number; name: string; gstin: string; contactPerson: string; phone: string }
interface VehicleHit { id: number; vehicleNo: string; transportCompanyId: number | null; transportCompanyName: string | null; ownerType: string | null }
interface PoHit { id: number; poNo: string; poDate: string; supplier: string; itemCount: number; netAmount: number }
interface PoLoad { id: number; poNo: string; supplier: string; supplierGstin: string; supplierContact: string; warehouse: string; lines: { productId: number | null; description: string; sku: string; hsn: string; uom: string; qty: number; rate: number; taxPct: number; discPct: number }[] }
const WAREHOUSES = ["Main Store", "Warehouse A", "Cold Storage", "Back Office"];
let keySeq = 1;
const parseGst = (v: unknown) => { const n = parseFloat(String(v ?? "").replace("%", "")); return Number.isFinite(n) ? n : 0; };

type TrackFlags = { invBatch?: boolean; invMfg?: boolean; invExpiry?: boolean; invSerial?: boolean };
function flatten(rows: Array<{ id: number; name: string; code: string; category: string; uom: string; mrp: number; gst: string; variantCount: number; qrRequired?: boolean; variants: ({ id: number; name: string; code: string; sku: string; mrp: number; qrRequired?: boolean } & TrackFlags)[] } & TrackFlags>): Candidate[] {
  const out: Candidate[] = [];
  for (const p of rows) {
    const gst = parseGst(p.gst);
    // Variants inherit the parent's tracking flags unless they carry their own.
    if (p.variantCount > 0) for (const v of p.variants) out.push({ productId: v.id, productName: v.name, sku: v.sku || v.code, uom: p.uom, category: p.category, mrp: v.mrp, gst, invBatch: !!(v.invBatch ?? p.invBatch), invMfg: !!(v.invMfg ?? p.invMfg), invExpiry: !!(v.invExpiry ?? p.invExpiry), invSerial: !!(v.invSerial ?? p.invSerial), qrRequired: !!(v.qrRequired ?? p.qrRequired) });
    else out.push({ productId: p.id, productName: p.name, sku: p.code, uom: p.uom, category: p.category, mrp: p.mrp, gst, invBatch: !!p.invBatch, invMfg: !!p.invMfg, invExpiry: !!p.invExpiry, invSerial: !!p.invSerial, qrRequired: !!p.qrRequired });
  }
  return out;
}
/** Truck-weight → line Qty. Same unit → as-is; Kg↔Ton converts; anything else is unconverted. */
function convertWeightToQty(netWeight: number, weightUom: string, productUom: string): number {
  const w = weightUom.trim().toLowerCase();
  const p = productUom.trim().toLowerCase();
  if (w === p) return netWeight;
  if (w === "kg" && p === "ton") return netWeight / 1000;
  if (w === "ton" && p === "kg") return netWeight * 1000;
  return netWeight;
}
const n = (v: unknown) => Number(v) || 0;
const lineNet = (l: Line) => { const q = n(l.qty), r = n(l.rate), d = n(l.discPct); return q * r * (1 - d / 100); };

/* ---- Selling-price ⇄ profit% ⇄ MRP, honouring the POS tax treatment ----
 * incl = selling price already contains GST (the price IS the MRP).
 * excl = selling price is the pre-tax base; GST is added on top to reach MRP.
 * Profit is always margin of the EX-TAX selling base over the purchase cost. */
const taxRate = (l: Line) => n(l.taxPct) || l.gst; // product GST drives selling tax
const exTaxSelling = (selling: number, tax: number, incl: boolean) => (incl && tax > 0 ? selling / (1 + tax / 100) : selling);
const profitFromSelling = (cost: number, selling: number, tax: number, incl: boolean) => {
  if (cost <= 0 || selling <= 0) return 0;
  const base = exTaxSelling(selling, tax, incl);
  return +(((base - cost) / cost) * 100).toFixed(2);
};
const sellingFromProfit = (cost: number, profit: number, tax: number, incl: boolean) => {
  const base = cost * (1 + profit / 100);
  return +(incl && tax > 0 ? base * (1 + tax / 100) : base).toFixed(2);
};
const mrpFromSelling = (selling: number, tax: number, incl: boolean) => +(incl ? selling : selling * (1 + (tax > 0 ? tax : 0) / 100)).toFixed(2);

interface Extra {
  gstPct: string; freightAmount: string; otherCharges: string; roundOff: string; totalInvoiceValue: string;
  paymentStatus: "Paid" | "Unpaid" | "Partial"; amountPaid: string; paymentMode: string; paymentRef: string; paymentDate: string;
  paymentTerms: string; creditDays: string; dueDate: string;
  transporterName: string; transportMode: string; transportType: string; vehicleNo: string; lrNo: string; ewayBillNo: string; freightPaidBy: string; numPackages: string; transportRemarks: string;
}
const EMPTY_EXTRA: Extra = { gstPct: "", freightAmount: "", otherCharges: "", roundOff: "", totalInvoiceValue: "", paymentStatus: "Unpaid", amountPaid: "", paymentMode: "", paymentRef: "", paymentDate: "", paymentTerms: "", creditDays: "", dueDate: "", transporterName: "", transportMode: "", transportType: "", vehicleNo: "", lrNo: "", ewayBillNo: "", freightPaidBy: "", numPackages: "", transportRemarks: "" };

export function GrnEditor() {
  const router = useRouter();
  const toaster = useToast();
  const [grnId, setGrnId] = useState<number | null>(null);
  // Set only when arriving from a Raw Material Vehicle Gate Entry's "Create GRN"
  // link — forwarded on save so the server can back-link the gate entry to this GRN.
  const [sourceGateEntryId, setSourceGateEntryId] = useState<number | null>(null);
  const [grnNo, setGrnNo] = useState("");
  const [grnDate, setGrnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [supplierGstin, setSupplierGstin] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState("");
  const [poNo, setPoNo] = useState("");
  const [weightSlipRefNo, setWeightSlipRefNo] = useState("");
  const [inventoryMovement, setInventoryMovement] = useState("");
  const [areas, setAreas] = useState<{ id: number; name: string; code: string }[]>([]);
  const [areaId, setAreaId] = useState<number | "">("");
  const [vehicleOwnerType, setVehicleOwnerType] = useState("");
  const [poSource, setPoSource] = useState<"none" | "po">("none");
  const [poQuery, setPoQuery] = useState("");
  const [poMatches, setPoMatches] = useState<PoHit[] | null>(null);
  const [warehouse, setWarehouse] = useState(WAREHOUSES[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  // productId -> tracking flags, used to resolve required fields for lines loaded
  // from a saved GRN (those don't come through the picker which carries flags).
  const [trackMap, setTrackMap] = useState<Record<number, TrackFlags>>({});
  // Has the user attempted to save? Used to highlight missing required fields.
  const [attempted, setAttempted] = useState(false);
  // Resolve the effective tracking flags for a line: prefer flags on the line
  // itself (set when picked), fall back to the productId map (edit-load path).
  const reqFor = (l: Line) => {
    const m = trackMap[l.productId];
    return {
      batch: !!(l.invBatch || m?.invBatch),
      mfg: !!(l.invMfg || m?.invMfg),
      expiry: !!(l.invExpiry || m?.invExpiry),
      serial: !!(l.invSerial || m?.invSerial),
    };
  };
  const missingFor = (l: Line) => {
    const r = reqFor(l);
    return {
      batch: r.batch && !l.batchNo.trim(),
      mfg: r.mfg && !l.mfgDate.trim(),
      expiry: r.expiry && !l.expiryDate.trim(),
    };
  };
  const [gstApplicable, setGstApplicable] = useState(true);
  const [gstMode, setGstMode] = useState<"line" | "invoice">("line");
  // POS Configuration → Tax Treatment (inclusive = selling price already contains GST).
  const [taxIncl, setTaxIncl] = useState(true);
  // General Settings → number formatting (qty / amount decimals). Drives all the
  // qty + money displays below so the GRN respects the configured decimal places.
  const cfg = useGeneralConfig();
  const inr = (x: number) => formatMoneyWith(cfg, x); // money with amountDecimals
  const fmtQty = (x: number) => formatQtyWith(cfg, x); // qty with qtyDecimals
  const [extra, setExtra] = useState<Extra>(EMPTY_EXTRA);
  const setE = <K extends keyof Extra>(k: K, v: Extra[K]) => setExtra((p) => ({ ...p, [k]: v }));

  // Purchase Configuration — gates the invoice/PO fields and truck-weight capture below.
  const [enablePurchaseInvoice, setEnablePurchaseInvoice] = useState(true);
  const [enableTruckWeightGrn, setEnableTruckWeightGrn] = useState(false);
  const [truckWeightUom, setTruckWeightUom] = useState("Kg");
  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/settings/purchase", { cache: "no-store" }).then((r) => r.json());
        if (j.ok && j.config) {
          setEnablePurchaseInvoice(j.config.flags?.enablePurchaseInvoice !== false);
          setEnableTruckWeightGrn(!!j.config.flags?.enableTruckWeightGrn);
          setTruckWeightUom(j.config.fields?.truckWeightUom || "Kg");
        }
      } catch { /* keep defaults */ }
    })();
  }, []);
  // Vehicle Weighment — Tare/Gross captured inline; Net = Gross - Tare. Only ever
  // auto-fills Qty when the GRN has exactly one line (mirrors Direct Customer Dispatch).
  const [tareWeight, setTareWeight] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const netWeight = n(grossWeight) > 0 || n(tareWeight) > 0 ? +(n(grossWeight) - n(tareWeight)).toFixed(3) : null;
  // Supplier-stated net weight from their bill — stored separately from the
  // calculated netWeight above (never overwrites it), but drives Qty automatically
  // when present (falls back to the calculated netWeight when it's blank).
  const [billNetWeight, setBillNetWeight] = useState("");
  const effectiveNetWeight = n(billNetWeight) > 0 ? n(billNetWeight) : netWeight;
  useEffect(() => {
    if (!enableTruckWeightGrn || effectiveNetWeight == null || effectiveNetWeight <= 0) return;
    setLines((prev) => {
      if (prev.length !== 1 || !prev[0].productId) return prev;
      const qty = String(+convertWeightToQty(effectiveNetWeight, truckWeightUom, prev[0].uom).toFixed(3));
      return prev[0].qty === qty ? prev : [{ ...prev[0], qty }];
    });
    // Re-fires when a line is added/removed (lines.length) or the single line's
    // product changes (productId) — not just when the weight/config itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveNetWeight, enableTruckWeightGrn, truckWeightUom, lines.length, lines[0]?.productId]);

  // Supplier master (dropdown + inline add-new)
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSup, setNewSup] = useState({ name: "", gstin: "", contactPerson: "", phone: "" });
  const loadSuppliers = async () => {
    const j = await fetch("/api/masters/suppliers", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setSuppliers(j.suppliers);
  };
  useEffect(() => { loadSuppliers(); }, []);
  useEffect(() => {
    (async () => {
      const j = await fetch(`/api/system/areas?inventoryStorageType=${encodeURIComponent("Purchase of Material")}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) {
        const rows = j.rows.map((a: { id: number; name: string; code: string }) => ({ id: a.id, name: a.name, code: a.code }));
        setAreas(rows);
        if (rows.length === 1) setAreaId((cur) => (cur === "" ? rows[0].id : cur));
      }
    })();
  }, []);
  // Resolve supplierId once the supplier list arrives, for GRNs/POs loaded before it did.
  useEffect(() => {
    if (supplier && supplierId === "") {
      const sup = suppliers.find((s) => s.name === supplier);
      if (sup) setSupplierId(sup.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers, supplier]);
  // Resolve a supplier known by id (from a Raw Material Gate Entry prefill) once
  // the supplier list arrives — sets name/GSTIN/contact together, like pickSupplier.
  const [gatePrefillSupplierId, setGatePrefillSupplierId] = useState<number | null>(null);
  useEffect(() => {
    if (gatePrefillSupplierId == null) return;
    const sup = suppliers.find((s) => s.id === gatePrefillSupplierId);
    if (sup) {
      setSupplier(sup.name); setSupplierId(sup.id); setSupplierGstin(sup.gstin); setSupplierContact(sup.phone || sup.contactPerson);
      setGatePrefillSupplierId(null);
    }
  }, [suppliers, gatePrefillSupplierId]);
  useEffect(() => {
    (async () => {
      try { const p = await fetch("/api/settings/pos", { cache: "no-store" }).then((r) => r.json()); if (p.ok && p.config?.taxMethod) setTaxIncl(p.config.taxMethod !== "exclusive"); } catch { /* default inclusive */ }
    })();
  }, []);
  function pickSupplier(name: string) {
    setSupplier(name);
    const sup = suppliers.find((s) => s.name === name);
    setSupplierId(sup?.id ?? "");
    if (sup) { setSupplierGstin(sup.gstin); setSupplierContact(sup.phone || sup.contactPerson); }
  }
  async function saveSupplier() {
    const name = newSup.name.trim();
    if (!name) return;
    const j = await fetch("/api/masters/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newSup) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) {
      await loadSuppliers();
      setSupplier(name); setSupplierId(j.id ?? ""); setSupplierGstin(newSup.gstin); setSupplierContact(newSup.phone);
      setNewSup({ name: "", gstin: "", contactPerson: "", phone: "" });
      setAddingSupplier(false);
    }
  }

  // ---- Create-from-PO: search open POs and load supplier + lines ----
  const poTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function searchPOs(rawq: string) {
    try { const j = await fetch(`/api/purchase/order/lookup?q=${encodeURIComponent(rawq.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setPoMatches(j.rows ?? []); } catch { toaster.error("Could not search purchase orders."); }
  }
  function onPoQuery(v: string) { setPoQuery(v); if (poTimer.current) clearTimeout(poTimer.current); if (!v.trim()) { setPoMatches(null); return; } poTimer.current = setTimeout(() => searchPOs(v), 250); }
  async function pickPO(row: PoHit) {
    try {
      const j = await fetch(`/api/purchase/order/lookup/${row.id}`, { cache: "no-store" }).then((r) => r.json());
      if (!j.ok || !j.data) { toaster.error("Could not load that purchase order."); return; }
      const d: PoLoad = j.data;
      setPoNo(d.poNo); setPoMatches(null); setPoQuery(d.poNo);
      if (d.supplier) { setSupplier(d.supplier); setSupplierId(suppliers.find((s) => s.name === d.supplier)?.id ?? ""); }
      if (d.supplierGstin) setSupplierGstin(d.supplierGstin);
      if (d.supplierContact) setSupplierContact(d.supplierContact);
      if (d.warehouse && WAREHOUSES.includes(d.warehouse)) setWarehouse(d.warehouse);
      setLines(d.lines.map((l) => ({
        key: `k${keySeq++}`, productId: l.productId ?? 0, productName: l.description, sku: l.sku || "", uom: l.uom || "", category: "", mrp: 0, gst: l.taxPct || 0,
        invBatch: false, invMfg: false, invExpiry: false, invSerial: false, qrRequired: true,
        qty: String(l.qty || ""), rate: l.rate ? String(l.rate) : "", sellingPrice: "", profitPct: "",
        discPct: l.discPct ? String(l.discPct) : "", taxPct: l.taxPct ? String(l.taxPct) : "", mrpStr: "",
        batchNo: "", mfgDate: "", expiryDate: "", remarks: "", qrMode: "shared", expanded: false, serials: [],
      })));
      const ids = Array.from(new Set(d.lines.map((l) => l.productId).filter((x): x is number => !!x)));
      if (ids.length) loadTrackFlags(ids);
      toaster.success(`Loaded ${d.lines.length} line(s) from ${d.poNo}.`);
    } catch { toaster.error("Could not reach the server."); }
  }

  // ---- Vehicle No type-ahead (Transport & Logistics) — picking a vehicle from the
  // master auto-fills the Transporter Name from its linked transport company. ----
  const [vehicleHits, setVehicleHits] = useState<VehicleHit[] | null>(null);
  const vehicleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function searchVehicles(q: string) {
    try { const j = await fetch(`/api/transport/masters/vehicle?q=${encodeURIComponent(q.trim())}&status=Active`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setVehicleHits((j.rows ?? []).slice(0, 20)); } catch { /* ignore */ }
  }
  function onVehicleQuery(v: string) {
    setE("vehicleNo", v);
    if (vehicleTimer.current) clearTimeout(vehicleTimer.current);
    if (!v.trim()) { setVehicleHits(null); return; }
    vehicleTimer.current = setTimeout(() => searchVehicles(v), 250);
  }
  function pickVehicle(hit: VehicleHit) {
    setE("vehicleNo", hit.vehicleNo);
    if (hit.transportCompanyName) setE("transporterName", hit.transportCompanyName);
    setVehicleOwnerType(hit.ownerType ?? "");
    setVehicleHits(null);
  }

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [openPicker, setOpenPicker] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "post">(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showInvoiceWarn, setShowInvoiceWarn] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Prefill from a Raw Material Vehicle Gate Entry's "Create GRN" link — only
  // applies to a fresh GRN (never overwrites data loaded for an edit below).
  // Query params give an immediate minimal prefill; the gate entry's full detail
  // (fetched right after) fills in GSTIN, transporter and the item/brand line.
  // Guarded against React StrictMode's dev-mode double effect invocation, which
  // would otherwise fetch + addLine twice and leave a duplicate product line.
  const gatePrefillStarted = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("id")) return;
    const vNo = params.get("vehicleNo");
    const supName = params.get("supplier");
    const gw = params.get("grossWeight");
    const geId = Number(params.get("gateEntryId"));
    if (vNo) setE("vehicleNo", vNo);
    if (supName) setSupplier(supName);
    if (gw) setGrossWeight(gw);
    if (!geId || gatePrefillStarted.current) return;
    gatePrefillStarted.current = true;
    setSourceGateEntryId(geId);
    (async () => {
      try {
        const j = await fetch(`/api/transport/gate-entry/${geId}`, { cache: "no-store" }).then((r) => r.json());
        if (!j.ok || !j.data) return;
        const d = j.data;
        if (d.supplierId) setGatePrefillSupplierId(d.supplierId);
        else if (d.supplierName) setSupplier(d.supplierName);
        if (d.transportCompanyName) setE("transporterName", d.transportCompanyName);
        if (d.weightSlipRefNo) setWeightSlipRefNo(d.weightSlipRefNo);
        if (d.inventoryMovement) setInventoryMovement(d.inventoryMovement);
        if (d.areaId) setAreaId(d.areaId);
        if (d.vehicleOwnerType) setVehicleOwnerType(d.vehicleOwnerType);
        if (d.grossWeight != null) setGrossWeight(String(d.grossWeight));
        if (d.tareWeight != null) setTareWeight(String(d.tareWeight));
        // The gate-entry weighment's manually-entered Net Weight maps onto the
        // GRN's "Net Weight as per Bill" — a manually-stated figure separate
        // from the GRN's own calculated Net Weight (Gross − Tare).
        if (d.netWeight != null) setBillNetWeight(String(d.netWeight));
        const item = (d.items ?? [])[0];
        if (item?.productId) {
          const cj = await fetch(`/api/products?q=${encodeURIComponent(item.sku || item.productName)}&pageSize=20`, { cache: "no-store" }).then((r) => r.json());
          if (cj.ok) {
            const cand = flatten(cj.rows).find((c) => c.productId === item.productId);
            // Qty starts blank — the user applies the vehicle weight explicitly (Apply to
            // Qty), rather than a default "1" that looks like a real value if left alone.
            if (cand) addLine(cand, { qty: "", supplierIdOverride: d.supplierId || undefined });
          }
        }
      } catch { /* keep the minimal query-param prefill already applied */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("id"));
    if (!id) return;
    (async () => {
      const j = await fetch(`/api/purchase/grn/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (!j.ok) return;
      const d = j.data;
      setGrnId(d.id); setGrnNo(d.grnNo); setGrnDate(d.grnDate); setSupplier(d.supplier); setSupplierId(suppliers.find((s) => s.name === d.supplier)?.id ?? ""); setSupplierGstin(d.supplierGstin);
      setSupplierContact(d.supplierContact); setSupplierInvoiceNo(d.supplierInvoiceNo); setSupplierInvoiceDate(d.supplierInvoiceDate);
      setPoNo(d.poNo); setWarehouse(d.warehouse || WAREHOUSES[0]); setNotes(d.notes);
      setWeightSlipRefNo(d.weightSlipRefNo || ""); setInventoryMovement(d.inventoryMovement || "");
      setAreaId(d.areaId ?? "");
      setVehicleOwnerType(d.vehicleOwnerType || "");
      if (d.gateEntryId) setSourceGateEntryId(d.gateEntryId);
      const sv = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(v));
      setGstMode(d.gstMode === "invoice" ? "invoice" : "line");
      setGstApplicable(Number(d.taxTotal) > 0 || Number(d.gstPct) > 0 || (d.lines ?? []).some((l: Record<string, unknown>) => Number(l.taxPct) > 0));
      setExtra({
        gstPct: sv(d.gstPct), freightAmount: sv(d.freightAmount), otherCharges: sv(d.otherCharges), roundOff: sv(d.roundOff), totalInvoiceValue: sv(d.totalInvoiceValue),
        paymentStatus: (d.paymentStatus as Extra["paymentStatus"]) || "Unpaid", amountPaid: sv(d.amountPaid), paymentMode: d.paymentMode || "", paymentRef: d.paymentRef || "", paymentDate: d.paymentDate || "",
        paymentTerms: d.paymentTerms || "", creditDays: sv(d.creditDays), dueDate: d.dueDate || "",
        transporterName: d.transporterName || "", transportMode: d.transportMode || "", transportType: d.transportType || "", vehicleNo: d.vehicleNo || "", lrNo: d.lrNo || "", ewayBillNo: d.ewayBillNo || "", freightPaidBy: d.freightPaidBy || "", numPackages: sv(d.numPackages), transportRemarks: d.transportRemarks || "",
      });
      // Re-open a truck-weight GRN with its captured weighment values (net weight stays derived).
      if (d.weightUom) {
        setTareWeight(sv(d.tareWeight)); setGrossWeight(sv(d.grossWeight)); setTruckWeightUom(String(d.weightUom));
        setBillNetWeight(sv(d.billNetWeight));
      }
      setLines(d.lines.map((l: Record<string, unknown>) => ({
        key: `k${keySeq++}`, productId: l.productId as number, productName: l.productName as string, sku: (l.sku as string) || "",
        uom: (l.uom as string) || "", category: (l.category as string) || "", mrp: Number(l.mrp) || 0, gst: Number(l.taxPct) || 0,
        invBatch: !!l.invBatch, invMfg: !!l.invMfg, invExpiry: !!l.invExpiry, invSerial: !!l.invSerial, qrRequired: l.qrRequired !== false,
        qty: String(l.qty ?? ""), rate: l.rate === "" ? "" : String(l.rate), sellingPrice: l.sellingPrice === "" ? "" : String(l.sellingPrice),
        profitPct: l.sellingPrice && l.rate ? String(profitFromSelling(Number(l.rate), Number(l.sellingPrice), Number(l.taxPct) || 0, taxIncl)) : "",
        discPct: l.discPct === "" ? "" : String(l.discPct), taxPct: l.taxPct === "" ? "" : String(l.taxPct), mrpStr: l.mrp === "" ? "" : String(l.mrp),
        batchNo: (l.batchNo as string) || "", mfgDate: (l.mfgDate as string) || "", expiryDate: (l.expiryDate as string) || "",
        remarks: (l.remarks as string) || "", qrMode: (l.qrMode as "shared" | "unique") || "shared", expanded: false, serials: [],
      })));
      // Resolve tracking flags for the loaded products so required fields are known
      // even though these lines didn't come through the picker.
      const ids: number[] = Array.from(new Set((d.lines ?? []).map((l: Record<string, unknown>) => Number(l.productId)).filter(Boolean)));
      if (ids.length) loadTrackFlags(ids);
    })();
  }, []);

  // Look up tracking flags for a set of productIds via the product catalog and
  // merge them into trackMap. Used on edit-load; the picker path carries flags inline.
  async function loadTrackFlags(ids: number[]) {
    try {
      const results = await Promise.all(ids.map((id) =>
        fetch(`/api/products/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null)));
      const next: Record<number, TrackFlags> = {};
      results.forEach((j, i) => {
        if (!j?.ok) return;
        // /api/products/[id] returns data.toggles.inventoryTracking.{batch,mfg,expiry}.
        const t = j?.data?.toggles?.inventoryTracking ?? {};
        next[ids[i]] = { invBatch: !!t.batch, invMfg: !!t.mfg, invExpiry: !!t.expiry, invSerial: !!t.serial };
      });
      if (Object.keys(next).length) setTrackMap((m) => ({ ...m, ...next }));
    } catch { /* ignore — server still enforces 422 */ }
  }

  useEffect(() => {
    if (!query.trim()) { setCandidates([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const j = await fetch(`/api/products?q=${encodeURIComponent(query)}&pageSize=20`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json());
        if (j.ok) { setCandidates(flatten(j.rows)); setOpenPicker(true); }
      } catch { /* ignore */ }
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpenPicker(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // supplierIdOverride lets a caller that already knows the supplier (e.g. the
  // gate-entry prefill, which fires before the `supplierId` state has resolved)
  // look up the Supplier Product Price without waiting on that state to catch up.
  async function addLine(c: Candidate, opts?: { qty?: string; supplierIdOverride?: number }) {
    // Purchase price prefers the Supplier Product Price master (per-supplier rate);
    // falls back to the 70%-of-MRP heuristic when no supplier is picked or no match exists.
    let cost = c.mrp ? Math.round(c.mrp * 0.7) : 0;
    const sid = opts?.supplierIdOverride ?? supplierId;
    if (sid !== "" && sid != null) {
      try {
        const j = await fetch(`/api/masters/purchase/supplier-product-price?supplierId=${sid}&productId=${c.productId}`, { cache: "no-store" }).then((r) => r.json());
        const match = j.ok ? (j.rows ?? []).find((r: { status: string }) => r.status === "Active") ?? j.rows?.[0] : null;
        if (match) cost = Number(match.purchasePrice) || cost;
      } catch { /* fall back to the MRP heuristic */ }
    }
    const profit = cost > 0 && c.mrp ? String(profitFromSelling(cost, c.mrp, c.gst, taxIncl)) : "";
    // Auto-expand the batch section when the product is batch/mfg/expiry tracked so
    // the required fields are visible immediately.
    const tracked = !!(c.invBatch || c.invMfg || c.invExpiry || c.invSerial);
    const qty = opts?.qty ?? "1";
    setLines((p) => [...p, { ...c, key: `k${keySeq++}`, qty, rate: cost ? String(cost) : "", sellingPrice: c.mrp ? String(c.mrp) : "", profitPct: profit, discPct: "", taxPct: c.gst ? String(c.gst) : "", mrpStr: c.mrp ? String(c.mrp) : "", batchNo: "", mfgDate: "", expiryDate: "", remarks: "", qrMode: c.invSerial ? "unique" : "shared", expanded: tracked, serials: [] }]);
    // Keep trackMap in sync so validation works even if flags are read from the map.
    setTrackMap((m) => ({ ...m, [c.productId]: { invBatch: c.invBatch, invMfg: c.invMfg, invExpiry: c.invExpiry, invSerial: c.invSerial } }));
    setQuery(""); setCandidates([]); setOpenPicker(false);
  }
  const update = (key: string, patch: Partial<Line>) => setLines((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((p) => p.filter((l) => l.key !== key));

  // Selling price ⇄ profit% stay in sync per the POS tax treatment.
  const setSelling = (l: Line, v: string) => {
    const profit = v === "" ? "" : String(profitFromSelling(n(l.rate), n(v), taxRate(l), taxIncl));
    update(l.key, { sellingPrice: v, profitPct: profit });
  };
  const setProfit = (l: Line, v: string) => {
    const selling = v === "" ? "" : String(sellingFromProfit(n(l.rate), n(v), taxRate(l), taxIncl));
    update(l.key, { profitPct: v, sellingPrice: selling });
  };
  // Changing the purchase cost (or tax) keeps the selling price and re-derives profit %.
  const setRate = (l: Line, v: string) => {
    const profit = n(l.sellingPrice) > 0 ? String(profitFromSelling(n(v), n(l.sellingPrice), taxRate(l), taxIncl)) : l.profitPct;
    update(l.key, { rate: v, profitPct: profit });
  };
  const setTaxPct = (l: Line, v: string) => {
    const profit = n(l.sellingPrice) > 0 ? String(profitFromSelling(n(l.rate), n(l.sellingPrice), n(v) || l.gst, taxIncl)) : l.profitPct;
    update(l.key, { taxPct: v, profitPct: profit });
  };

  const valid = useMemo(() => lines.filter((l) => Number(l.qty) > 0), [lines]);
  // QR Code / Batch columns only show up when at least one line actually needs them
  // (product master's QR Code Required / batch-mfg-expiry-serial tracking).
  const showQrCol = lines.some((l) => l.qrRequired);
  const showBatchCol = lines.some((l) => { const r = reqFor(l); return r.batch || r.mfg || r.expiry || r.serial; });
  // Truck Weight Based GRNs receive bulk material valued by weight — Selling
  // Price/Profit %/Disc % aren't meaningful at receipt time for that flow.
  const hideSellingCols = enableTruckWeightGrn;
  const lineColSpan = (hideSellingCols ? 7 : 10) + (showQrCol ? 1 : 0) + (showBatchCol ? 1 : 0);
  const totalQty = valid.reduce((s, l) => s + Number(l.qty), 0);
  const lineTax = (l: Line) => (gstApplicable && gstMode === "line" ? (lineNet(l) * n(l.taxPct)) / 100 : 0);
  const lineDisplay = (l: Line) => +(lineNet(l) + lineTax(l)).toFixed(2);
  const subtotal = +valid.reduce((s, l) => s + lineNet(l), 0).toFixed(2);
  const taxTotal = +(!gstApplicable ? 0 : gstMode === "invoice" ? (subtotal * n(extra.gstPct)) / 100 : valid.reduce((s, l) => s + lineTax(l), 0)).toFixed(2);
  const grandTotal = +(subtotal + taxTotal + n(extra.freightAmount) + n(extra.otherCharges) + n(extra.roundOff)).toFixed(2);
  const amountPaid = extra.paymentStatus === "Paid" ? grandTotal : extra.paymentStatus === "Partial" ? Math.min(grandTotal, n(extra.amountPaid)) : 0;
  const balance = +(grandTotal - amountPaid).toFixed(2);
  const totalValue = grandTotal;

  async function save(status: "Draft" | "Posted", skipInvoiceWarn = false) {
    setError(""); setToast(""); setAttempted(true);
    if (!valid.length) { setError("Add at least one product line with a quantity."); return; }
    if (status === "Posted" && !supplier.trim()) { setError("Supplier is required to post a GRN."); return; }
    // Warn when posting without a supplier invoice — it books to GRN Clearing, not Payable.
    if (status === "Posted" && !supplierInvoiceNo.trim() && !grnId && !skipInvoiceWarn) {
      setShowInvoiceWarn(true);
      return;
    }
    // Client-side guard: tracked products must carry their required batch/mfg/expiry
    // values. The server also enforces this (422); this surfaces it early + clearly.
    for (const l of lines) {
      const miss = missingFor(l);
      const field = miss.batch ? { label: "Batch number", noun: "batch-tracked" }
        : miss.mfg ? { label: "Manufacturing date", noun: "manufacturing-date tracked" }
        : miss.expiry ? { label: "Expiry date", noun: "expiry-tracked" }
        : null;
      if (field) {
        const msg = `${field.label} is required for "${l.productName}" — it is ${field.noun}.`;
        setError(msg); toaster.error(msg);
        update(l.key, { expanded: true }); // reveal the batch section for this line
        return;
      }
      // Serial-managed: exactly qty non-empty serials required.
      if (reqFor(l).serial) {
        const filled = l.serials.map((s) => s.trim()).filter(Boolean);
        const qty = Math.round(n(l.qty));
        if (filled.length !== qty || new Set(filled.map((s) => s.toLowerCase())).size !== filled.length) {
          const msg = `Enter ${qty} unique serial number(s) for "${l.productName}".`;
          setError(msg); toaster.error(msg); update(l.key, { expanded: true });
          return;
        }
      }
    }
    setBusy(status === "Draft" ? "draft" : "post");
    const payload = {
      grnDate, supplier, supplierGstin, supplierContact, supplierInvoiceNo, supplierInvoiceDate, poNo, weightSlipRefNo, inventoryMovement, areaId: areaId === "" ? null : areaId, vehicleOwnerType, warehouse, notes, status,
      gstMode: gstApplicable ? gstMode : "line", ...extra,
      gstPct: gstApplicable && gstMode === "invoice" ? extra.gstPct : "",
      tareWeight: enableTruckWeightGrn ? tareWeight : "", grossWeight: enableTruckWeightGrn ? grossWeight : "",
      netWeight: enableTruckWeightGrn && netWeight != null ? String(netWeight) : "", weightUom: enableTruckWeightGrn ? truckWeightUom : "",
      billNetWeight: enableTruckWeightGrn ? billNetWeight : "",
      gateEntryId: !grnId && sourceGateEntryId ? sourceGateEntryId : undefined,
      lines: lines.map((l) => ({ productId: l.productId, productName: l.productName, sku: l.sku, uom: l.uom, category: l.category, qty: l.qty, rate: l.rate, sellingPrice: l.sellingPrice, discPct: l.discPct, taxPct: gstApplicable && gstMode === "line" ? l.taxPct : "", mrp: l.mrpStr, batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate, remarks: l.remarks, qrMode: reqFor(l).serial ? "unique" : l.qrMode, serials: reqFor(l).serial ? l.serials.map((s) => s.trim()).filter(Boolean) : undefined })),
    };
    try {
      const res = await fetch(grnId ? `/api/purchase/grn/${grnId}` : "/api/purchase/grn", { method: grnId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.message || "Could not save."); toaster.error(j?.message || "Could not save the GRN."); setBusy(null); return; }
      toaster.result(j, "Saved.", "Could not save the GRN.");
      // A GRN linked to a Vehicle Gate Entry returns to that list (it now
      // surfaces GRN/PI status, invoice number and full detail on hover) instead
      // of landing on the standalone GRN view page or staying on this editor.
      if (sourceGateEntryId) { router.push("/transport/gate-entry?entryType=RawMaterial"); return; }
      if (status === "Posted") { router.push(`/purchase/grn/${grnId ?? j.id}`); return; }
      if (!grnId && j.id) setGrnId(j.id);
      setToast(j.message || "Draft saved."); window.setTimeout(() => setToast(""), 2500);
    } catch { setError("Network error — could not save."); toaster.error("Could not reach the server. Please try again."); }
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase/grn" className="hover:text-foreground">Goods Receipt Note</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{grnId ? grnNo || "Edit" : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> {grnId ? "Edit Goods Receipt" : "New Goods Receipt"}</h1>
          <p className="mt-0.5 text-sm text-muted">Posting a GRN generates per-line QR labels and receives the stock into Inventory.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/purchase/grn"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button variant="secondary" size="md" onClick={() => save("Draft")} disabled={!!busy}>{busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {busy === "draft" ? "Saving…" : "Save Draft"}</Button>
          <Button size="md" onClick={() => save("Posted")} disabled={!!busy}>{busy === "post" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {busy === "post" ? "Posting…" : "Post GRN"}</Button>
        </div>
      </div>

      {sourceGateEntryId && (
        <GrnFlowStepper
          steps={[
            { label: "Vehicle Entry", done: true },
            { label: "Weight Update", done: n(grossWeight) > 0 },
            { label: "GRN Posted", done: false },
            { label: "Empty Vehicle Weight Update", done: false },
            { label: "Purchase Invoice Update", done: false },
          ]}
        />
      )}

      {/* Create from — a fresh receipt, or one loaded from an open Purchase Order. */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle"><ShoppingBag className="h-3.5 w-3.5" /> Create from</span>
          <div className="inline-flex rounded-lg border border-border bg-surface-2 p-1">
            {([["none", "Without PO"], ["po", "Purchase Order"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setPoSource(v)} className={cn("rounded-md px-3 py-1 text-xs font-semibold transition", poSource === v ? "bg-card text-primary shadow-sm" : "text-muted hover:text-foreground")}>{l}</button>)}
          </div>
          {poSource === "po" && (
            <div className="relative min-w-[260px] flex-1">
              <input value={poQuery} onChange={(e) => onPoQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchPOs(poQuery); } }} placeholder="Search open PO by number or supplier…" className={inp} />
              {poMatches !== null && (poMatches.length ? (
                <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {poMatches.map((m) => <button key={m.id} onClick={() => pickPO(m)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-primary-subtle/40"><span className="min-w-0"><span className="block font-mono font-semibold text-foreground">{m.poNo}</span><span className="block text-2xs text-subtle">{m.poDate} · {m.supplier} · {m.itemCount} item(s)</span></span><span className="shrink-0 text-sm font-semibold text-foreground">{inr(m.netAmount)}</span></button>)}
                </div>
              ) : <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No open purchase orders matched.</div>)}
            </div>
          )}
          {poNo && poSource === "po" && <span className="text-2xs font-medium text-success">Loaded from PO {poNo} — add batch/serial &amp; selling price, then post.</span>}
        </div>
      </div>

      {/* Supplier + document */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard icon={Truck} title="Supplier" action={<button type="button" onClick={() => setAddingSupplier((a) => !a)} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-surface px-2 py-1 text-2xs font-semibold text-primary transition hover:bg-primary hover:text-white"><Plus className="h-3.5 w-3.5" /> New supplier</button>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Supplier *">
              <select value={supplier} onChange={(e) => pickSupplier(e.target.value)} className={inp}>
                <option value="">Select supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                {supplier && !suppliers.some((s) => s.name === supplier) && <option value={supplier}>{supplier}</option>}
              </select>
            </Field>
            <Field label="Warehouse"><select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className={inp}>{WAREHOUSES.map((w) => <option key={w}>{w}</option>)}</select></Field>
            <Field label="GSTIN"><input value={supplierGstin} onChange={(e) => setSupplierGstin(e.target.value)} placeholder="GSTIN" className={inp} /></Field>
            <Field label="Contact"><input value={supplierContact} onChange={(e) => setSupplierContact(e.target.value)} placeholder="Phone / email" className={inp} /></Field>
          </div>
          {addingSupplier && (
            <div className="mt-3 grid gap-2.5 rounded-lg border border-primary/30 bg-primary-subtle/30 p-3 sm:grid-cols-2">
              <input value={newSup.name} onChange={(e) => setNewSup({ ...newSup, name: e.target.value })} placeholder="Supplier name *" className={inpSm} />
              <input value={newSup.gstin} onChange={(e) => setNewSup({ ...newSup, gstin: e.target.value })} placeholder="GSTIN" className={inpSm} />
              <input value={newSup.contactPerson} onChange={(e) => setNewSup({ ...newSup, contactPerson: e.target.value })} placeholder="Contact person" className={inpSm} />
              <input value={newSup.phone} onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })} placeholder="Phone / email" className={inpSm} />
              <div className="flex items-center gap-2 sm:col-span-2">
                <Button size="sm" onClick={saveSupplier} disabled={!newSup.name.trim()}>Save supplier</Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingSupplier(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </SectionCard>
        <SectionCard icon={FileText} title="GRN Details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="GRN No."><input readOnly value={grnNo || "Auto on save"} className={cn(inp, "bg-surface-2 font-mono text-primary")} /></Field>
            <Field label="GRN Date *"><input type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} className={inp} /></Field>
            {enableTruckWeightGrn && <Field label="Weight Slip Ref Number"><input value={weightSlipRefNo} onChange={(e) => setWeightSlipRefNo(e.target.value)} placeholder="Optional" className={inp} /></Field>}
            <Field label="Inventory Movement Area">
              <select value={areaId} onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : "")} className={inp}>
                <option value="">— Select —</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </Field>
            {enablePurchaseInvoice && !sourceGateEntryId && (
              <>
                <Field label="Supplier Invoice No."><input value={supplierInvoiceNo} onChange={(e) => setSupplierInvoiceNo(e.target.value)} placeholder="INV-1234" className={inp} /></Field>
                <Field label="Invoice Date"><input type="date" value={supplierInvoiceDate} onChange={(e) => setSupplierInvoiceDate(e.target.value)} className={inp} /></Field>
                <Field label="PO No."><input value={poNo} onChange={(e) => setPoNo(e.target.value)} placeholder="PO-0007" className={inp} /></Field>
              </>
            )}
            <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inp} /></Field>
          </div>
        </SectionCard>
      </div>

      {enableTruckWeightGrn && (
        <SectionCard icon={Truck} title="Vehicle Weighment">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={`Tare Weight (${truckWeightUom})`}><input type="number" min={0} value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} placeholder="0" className={inp} /></Field>
            <Field label={`Gross Weight (${truckWeightUom})`}><input readOnly value={grossWeight} placeholder="0" className={cn(inp, "bg-surface-2 text-subtle")} /></Field>
            <Field label={`Net Weight (${truckWeightUom})`}><input readOnly value={n(tareWeight) > 0 && netWeight != null ? String(netWeight) : ""} placeholder="Enter Tare Weight to calculate" className={cn(inp, "bg-surface-2 font-semibold text-primary placeholder:text-2xs placeholder:text-subtle")} /></Field>
            <Field label={`Net Weight as per Bill (${truckWeightUom})`}><input readOnly value={billNetWeight} placeholder="—" className={cn(inp, "bg-surface-2 text-subtle")} /></Field>
          </div>
          {lines.length === 1 && (
            <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-2xs text-muted">
              <span>{n(billNetWeight) > 0 ? "Net Weight as per Bill auto-fills the line's Qty below (converted to its own UOM) — the calculated Net Weight above is kept only for record." : "Net Weight auto-fills the line's Qty below (converted to its own UOM). Enter Net Weight as per Bill to bill against the supplier's stated weight instead."}</span>
              {effectiveNetWeight != null && lines[0].uom && <span className="font-semibold text-primary">{effectiveNetWeight} {truckWeightUom} = {+convertWeightToQty(effectiveNetWeight, truckWeightUom, lines[0].uom).toFixed(3)} {lines[0].uom}</span>}
            </p>
          )}
          {lines.length > 1 && <p className="mt-2 text-2xs text-warning">Qty auto-fill from weight only applies with a single product line — remove one line first.</p>}
        </SectionCard>
      )}

      {/* Product picker — visually distinct add bar. Truck-weight GRN is one product
          per receipt: once a line is added, the search hides until it's removed. */}
      {(!enableTruckWeightGrn || lines.length === 0) ? (
        <div ref={pickerRef} className="relative rounded-2xl border border-primary/30 bg-primary-subtle/25 p-3 shadow-sm">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary"><Plus className="h-3.5 w-3.5" /> Add Products to Receipt</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/60" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => candidates.length && setOpenPicker(true)} placeholder="Search product by name, code or SKU to add a line…" className="h-11 w-full rounded-lg border border-primary/40 bg-card pl-11 pr-3 text-sm shadow-sm placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus" />
          </div>
          {openPicker && candidates.length > 0 && (
            <div className="absolute left-3 right-3 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
              {candidates.map((c) => (
                <button key={c.productId} onClick={() => addLine(c)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-primary-subtle/50">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{c.productName}</span><span className="font-mono text-2xs text-subtle">{c.sku || "—"} · {c.category || "—"}</span></span>
                  <span className="flex items-center gap-2 text-2xs text-muted"><span>MRP {inr(c.mrp || 0)}</span><Plus className="h-4 w-4 text-primary" /></span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-2xs text-muted">Truck Weight Based GRN receives one product per document — remove the line below to pick a different product.</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini icon={Boxes} label="Lines" value={lines.length} />
        <Mini icon={ListChecks} label="With qty" value={valid.length} />
        <Mini icon={Boxes} label="Total qty" value={fmtQty(totalQty)} />
        <Mini icon={IndianRupee} label="GRN value" value={inr(totalValue)} />
      </div>

      {/* Lines */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground"><span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-white shadow-sm"><Boxes className="h-4 w-4" /></span>Items</p>
          <div className="flex flex-wrap items-center gap-2 text-2xs">
            <span className="font-medium text-muted">GST applicable:</span>
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              {([["yes", "Yes"], ["no", "No"]] as const).map(([v, lbl]) => (
                <button key={v} type="button" onClick={() => setGstApplicable(v === "yes")} className={cn("px-3 py-1 font-semibold transition", (gstApplicable ? "yes" : "no") === v ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2")}>{lbl}</button>
              ))}
            </div>
            {gstApplicable && gstMode === "invoice" && (
              <span className="ml-1 inline-flex items-center gap-1">GST %<input type="number" min={0} value={extra.gstPct} onChange={(e) => setE("gstPct", e.target.value)} placeholder="0" className="h-7 w-16 rounded border border-border-strong bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" /></span>
            )}
          </div>
        </div>
        {/* Selling-price tax-treatment info (from POS Configuration) */}
        <div className="flex items-start gap-1.5 border-b border-border bg-info-subtle/40 px-4 py-1.5 text-2xs text-info">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Selling price is <strong>{taxIncl ? "inclusive of GST" : "exclusive of GST"}</strong> (per <Link href="/settings/pos-configuration" className="font-semibold underline">POS Configuration → Tax Treatment</Link>).{" "}
            {taxIncl
              ? "The price you enter is the customer MRP — profit % is figured on the pre-GST portion."
              : "GST is added on top — the price you enter is the pre-tax base; the MRP shown includes GST."}{" "}
            Enter a <strong>Selling Price</strong> or a <strong>Profit %</strong> — each recalculates the other.
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="min-w-[220px] px-3 py-3">Product</th><th className="whitespace-nowrap px-3 py-3">UOM</th><th className="whitespace-nowrap px-3 py-3 text-right">Qty</th>
                <th className="whitespace-nowrap px-3 py-3 text-right">Purchase Price</th>
                {!hideSellingCols && <th className="whitespace-nowrap px-3 py-3 text-right">Selling Price</th>}
                {!hideSellingCols && <th className="whitespace-nowrap px-3 py-3 text-right">Profit %</th>}
                {!hideSellingCols && <th className="whitespace-nowrap px-3 py-3 text-right">Disc %</th>}
                <th className="whitespace-nowrap px-3 py-3 text-right">Tax %</th><th className="whitespace-nowrap px-3 py-3 text-right">Value</th>
                {showQrCol && <th className="px-3 py-3 text-center">QR Code</th>}{showBatchCol && <th className="px-3 py-3 text-center">Batch</th>}<th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <FragmentRow key={l.key}>
                  <tr className={cn("border-b border-border transition", Number(l.qty) > 0 ? "bg-primary-subtle/15" : "")}>
                    <td className="min-w-[220px] px-3 py-2.5"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-2xs text-muted">{l.uom || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right"><input type="number" min={0} value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} className={cellR(Number(l.qty) > 0)} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right"><input type="number" min={0} value={l.rate} onChange={(e) => setRate(l, e.target.value)} placeholder="0" className={cellR(false)} title="Purchase cost per unit" /></td>
                    {!hideSellingCols && (
                      <td className="px-3 py-2.5 text-right">
                        <input type="number" min={0} value={l.sellingPrice} onChange={(e) => setSelling(l, e.target.value)} placeholder="0" className={cellR(false)} />
                        {n(l.sellingPrice) > 0 && <div className="mt-0.5 text-[10px] text-subtle">MRP {inr(mrpFromSelling(n(l.sellingPrice), taxRate(l), taxIncl))}{taxIncl ? " (incl)" : " (+GST)"}</div>}
                      </td>
                    )}
                    {!hideSellingCols && (
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <div className="inline-flex items-center justify-end gap-0.5"><input type="number" value={l.profitPct} onChange={(e) => setProfit(l, e.target.value)} placeholder="0" className={cellR(n(l.profitPct) > 0, "w-16")} title="Margin on the pre-GST selling price over purchase cost" /><span className="text-2xs text-subtle">%</span></div>
                      </td>
                    )}
                    {!hideSellingCols && <td className="whitespace-nowrap px-3 py-2.5 text-right"><input type="number" min={0} value={l.discPct} onChange={(e) => update(l.key, { discPct: e.target.value })} placeholder="0" className={cellR(false, "w-16")} /></td>}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">{!gstApplicable ? <span className="text-2xs text-subtle">no GST</span> : gstMode === "invoice" ? <span className="text-2xs text-subtle">whole bill</span> : <input type="number" min={0} value={l.taxPct} onChange={(e) => setTaxPct(l, e.target.value)} placeholder="0" className={cellR(false, "w-16")} title="Loaded from product master GST" />}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-foreground">{inr(lineDisplay(l))}</td>
                    {showQrCol && (
                      <td className="px-3 py-2.5 text-center">
                        {!l.qrRequired ? null : reqFor(l).serial ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary-subtle px-2 py-1 text-2xs font-semibold text-primary" title="Serial-managed product — one unique code per piece">Serial</span>
                        ) : (
                          <div className="inline-flex w-[124px] overflow-hidden rounded-md border border-border align-middle">
                            {(["shared", "unique"] as const).map((m) => <button key={m} onClick={() => update(l.key, { qrMode: m })} className={cn("flex-1 px-2 py-1 text-center text-2xs font-semibold transition", l.qrMode === m ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2")}>{m === "shared" ? "Same" : "Unique"}</button>)}
                          </div>
                        )}
                      </td>
                    )}
                    {showBatchCol && (
                      <td className="px-3 py-2.5 text-center">{(() => {
                        const req = reqFor(l);
                        if (!req.batch && !req.mfg && !req.expiry && !req.serial) return null;
                        const m = missingFor(l); const anyMiss = m.batch || m.mfg || m.expiry; return (
                        <button onClick={() => update(l.key, { expanded: !l.expanded })} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-2xs font-semibold transition", attempted && anyMiss ? "border-danger bg-danger-subtle text-danger" : anyMiss ? "border-warning/50 bg-warning-subtle text-warning" : l.batchNo || l.expanded ? "border-primary/40 bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40")} title={anyMiss ? "Batch / Mfg / Expiry required for this tracked product" : undefined}><Layers className="h-3 w-3" />{anyMiss && <Req />}<ChevronDown className={cn("h-3 w-3 transition", l.expanded && "rotate-180")} /></button>
                      ); })()}</td>
                    )}
                    <td className="px-3 py-2.5 text-right"><button onClick={() => remove(l.key)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                  {l.expanded && (
                    <tr className="border-b border-border bg-surface-2/40"><td colSpan={lineColSpan} className="px-3 py-3">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {(() => { const req = reqFor(l); const miss = missingFor(l); return (<>
                        <Field label={<>Batch No{req.batch && <Req />}</>}><input value={l.batchNo} onChange={(e) => update(l.key, { batchNo: e.target.value })} placeholder="BATCH-001" className={cn(inpSm, attempted && miss.batch && "border-danger focus:border-danger")} /></Field>
                        <Field label={<>Mfg Date{req.mfg && <Req />}</>}><input type="date" value={l.mfgDate} onChange={(e) => update(l.key, { mfgDate: e.target.value })} className={cn(inpSm, attempted && miss.mfg && "border-danger focus:border-danger")} /></Field>
                        <Field label={<>Expiry Date{req.expiry && <Req />}</>}><input type="date" value={l.expiryDate} onChange={(e) => update(l.key, { expiryDate: e.target.value })} className={cn(inpSm, attempted && miss.expiry && "border-danger focus:border-danger")} /></Field>
                        </>); })()}
                        <Field label="MRP"><input type="number" value={l.mrpStr} onChange={(e) => update(l.key, { mrpStr: e.target.value })} className={inpSm} /></Field>
                        <div className="sm:col-span-2 lg:col-span-4"><Field label="Remarks"><input value={l.remarks} onChange={(e) => update(l.key, { remarks: e.target.value })} placeholder="Optional" className={inpSm} /></Field></div>
                      </div>
                      {reqFor(l).serial && (() => {
                        const qty = Math.max(0, Math.round(n(l.qty)));
                        const filled = l.serials.slice(0, qty).filter((s) => (s ?? "").trim()).length;
                        return (
                          <div className="mt-3 rounded-lg border border-primary/20 bg-primary-subtle/20 p-3">
                            <div className="mb-2 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-muted">
                              <ListChecks className="h-3.5 w-3.5 text-primary" /> Serial Numbers
                              <span className={cn("rounded-full px-1.5 py-0.5 font-bold", filled === qty && qty > 0 ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning")}>{filled}/{qty}</span>
                              <span className="font-normal normal-case text-subtle">— one per received unit (scan or type)</span>
                            </div>
                            {qty === 0 ? <p className="text-2xs text-subtle">Set the received quantity to enter serial numbers.</p> : (
                              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                                {Array.from({ length: qty }).map((_, i) => (
                                  <input key={i} value={l.serials[i] ?? ""} onChange={(e) => { const next = [...l.serials]; while (next.length < qty) next.push(""); next[i] = e.target.value; update(l.key, { serials: next }); }} placeholder={`Serial ${i + 1}`} className={cn(inpSm, "font-mono", attempted && !((l.serials[i] ?? "").trim()) && "border-danger focus:border-danger")} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td></tr>
                  )}
                </FragmentRow>
              ))}
              {lines.length === 0 && <tr><td colSpan={lineColSpan} className="px-4 py-12 text-center text-sm text-muted">Search a product above to add your first line.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment · Transport · Totals */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Payment */}
        <SectionCard icon={Wallet} title="Payment">
          <div className="mb-3 inline-flex overflow-hidden rounded-md border border-border">
            {(["Unpaid", "Partial", "Paid"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setE("paymentStatus", p)} className={cn("px-3 py-1.5 text-2xs font-semibold transition", extra.paymentStatus === p ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2")}>{p}</button>
            ))}
          </div>
          {extra.paymentStatus !== "Unpaid" && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {extra.paymentStatus === "Partial" && <Field label="Amount Paid"><input type="number" value={extra.amountPaid} onChange={(e) => setE("amountPaid", e.target.value)} placeholder="0" className={inpSm} /></Field>}
              <Field label="Payment Mode"><select value={extra.paymentMode} onChange={(e) => setE("paymentMode", e.target.value)} className={inpSm}><option value="">Select…</option>{["Cash", "Bank Transfer", "UPI", "Cheque", "Card", "Credit"].map((m) => <option key={m}>{m}</option>)}</select></Field>
              <Field label="Reference / Txn No"><input value={extra.paymentRef} onChange={(e) => setE("paymentRef", e.target.value)} placeholder="UTR / Cheque no" className={inpSm} /></Field>
              <Field label="Payment Date"><input type="date" value={extra.paymentDate} onChange={(e) => setE("paymentDate", e.target.value)} className={inpSm} /></Field>
            </div>
          )}
          {extra.paymentStatus !== "Paid" && (
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              <Field label="Payment Terms"><input value={extra.paymentTerms} onChange={(e) => setE("paymentTerms", e.target.value)} placeholder="e.g. Net 30" className={inpSm} /></Field>
              <Field label="Credit Days"><input type="number" value={extra.creditDays} onChange={(e) => setE("creditDays", e.target.value)} placeholder="30" className={inpSm} /></Field>
              <div className="sm:col-span-2"><Field label="Due Date (auto from credit days if blank)"><input type="date" value={extra.dueDate} onChange={(e) => setE("dueDate", e.target.value)} className={inpSm} /></Field></div>
              {balance > 0 && <div className="sm:col-span-2 rounded-lg bg-warning-subtle px-3 py-2 text-2xs font-medium text-warning">Balance {inr(balance)} will be recorded under <strong>Payables</strong>.</div>}
            </div>
          )}
        </SectionCard>

        {/* Transport */}
        <SectionCard icon={Truck} title="Transport & Logistics">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="relative">
              <Field label="Vehicle No"><input value={extra.vehicleNo} onChange={(e) => onVehicleQuery(e.target.value)} onFocus={() => vehicleHits?.length && setVehicleHits(vehicleHits)} placeholder="Search KA01AB1234…" className={inpSm} /></Field>
              {vehicleHits !== null && (vehicleHits.length ? (
                <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {vehicleHits.map((h) => <button key={h.id} type="button" onClick={() => pickVehicle(h)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-primary-subtle/40"><span className="font-mono font-semibold text-foreground">{h.vehicleNo}</span><span className="text-2xs text-subtle">{h.transportCompanyName || "—"}</span></button>)}
                </div>
              ) : <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-2xs text-muted shadow-lg">No vehicles matched.</div>)}
            </div>
            <Field label="Transporter"><input value={extra.transporterName} onChange={(e) => setE("transporterName", e.target.value)} placeholder="Transporter / courier" className={inpSm} /></Field>
            {vehicleOwnerType && <Field label="Vehicle Owner Type"><input readOnly value={vehicleOwnerType} className={cn(inpSm, "bg-surface-2 text-subtle")} /></Field>}
            {!enableTruckWeightGrn && <Field label="LR / Docket No"><input value={extra.lrNo} onChange={(e) => setE("lrNo", e.target.value)} placeholder="LR-0091" className={inpSm} /></Field>}
            {!enableTruckWeightGrn && <Field label="E-Way Bill No"><input value={extra.ewayBillNo} onChange={(e) => setE("ewayBillNo", e.target.value)} placeholder="EWB number" className={inpSm} /></Field>}
            <Field label="Freight Amount"><input type="number" value={extra.freightAmount} onChange={(e) => setE("freightAmount", e.target.value)} disabled={vehicleOwnerType === "Own"} placeholder="0" className={cn(inpSm, vehicleOwnerType === "Own" && "cursor-not-allowed bg-surface-2 text-subtle")} /></Field>
            <Field label="Freight Paid By"><select value={extra.freightPaidBy} onChange={(e) => setE("freightPaidBy", e.target.value)} disabled={vehicleOwnerType === "Own"} className={cn(inpSm, vehicleOwnerType === "Own" && "cursor-not-allowed bg-surface-2 text-subtle")}><option value="">Select…</option>{["Supplier", "Us", "To Pay", "Self"].map((m) => <option key={m}>{m}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label="Transport Remarks"><input value={extra.transportRemarks} onChange={(e) => setE("transportRemarks", e.target.value)} placeholder="Optional" className={inpSm} /></Field></div>
          </div>
        </SectionCard>

        {/* Totals */}
        <SectionCard icon={IndianRupee} title="Bill Summary">
          <div className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={inr(subtotal)} />
            <Row label={!gstApplicable ? "GST (not applicable)" : `GST ${gstMode === "invoice" ? `(@ ${n(extra.gstPct)}%)` : "(line-wise)"}`} value={inr(taxTotal)} />
            <Row label="Freight" value={inr(n(extra.freightAmount))} />
            <div className="flex items-center justify-between gap-2"><span className="text-muted">Other Charges</span><input type="number" value={extra.otherCharges} onChange={(e) => setE("otherCharges", e.target.value)} placeholder="0" className="h-7 w-24 rounded border border-border-strong bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" /></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted">Round Off</span><input type="number" value={extra.roundOff} onChange={(e) => setE("roundOff", e.target.value)} placeholder="0" className="h-7 w-24 rounded border border-border-strong bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" /></div>
            <div className="my-1.5 h-px bg-border" />
            <div className="flex items-center justify-between text-base font-bold text-foreground"><span>Grand Total</span><span>{inr(grandTotal)}</span></div>
            <Row label="Paid" value={inr(amountPaid)} />
            <div className="flex items-center justify-between font-semibold"><span className="text-muted">Balance Payable</span><span className={balance > 0 ? "text-danger" : "text-success"}>{inr(balance)}</span></div>
            <div className="mt-2"><Field label="Supplier Invoice Value (as per bill)"><input type="number" value={extra.totalInvoiceValue} onChange={(e) => setE("totalInvoiceValue", e.target.value)} placeholder={String(grandTotal)} className={inpSm} /></Field>
              {n(extra.totalInvoiceValue) > 0 && Math.abs(n(extra.totalInvoiceValue) - grandTotal) > 0.5 && <p className="mt-1 text-2xs font-medium text-warning">Differs from computed total by {inr(Math.abs(n(extra.totalInvoiceValue) - grandTotal))}</p>}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row">
        <div className="text-sm text-muted"><strong className="text-foreground">{valid.length}</strong> lines · qty <strong className="text-foreground">{fmtQty(totalQty)}</strong> · value <strong className="text-foreground">{inr(totalValue)}</strong>
          {error && <span className="ml-3 font-medium text-danger">{error}</span>}{toast && <span className="ml-3 font-medium text-success">{toast}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="lg" onClick={() => save("Draft")} disabled={!!busy}>{busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {busy === "draft" ? "Saving…" : "Save Draft"}</Button>
          <Button size="lg" onClick={() => save("Posted")} disabled={!!busy || !valid.length}>{busy === "post" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {busy === "post" ? "Posting…" : "Post GRN & Receive Stock"}</Button>
        </div>
      </div>

      {showInvoiceWarn && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowInvoiceWarn(false)} />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border bg-warning-subtle/40 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning"><Info className="h-5 w-5" /></span>
              <div><h3 className="text-base font-bold text-foreground">No supplier invoice entered</h3><p className="text-2xs text-muted">Accounting will go to GRN Clearing, not Payable.</p></div>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm text-muted">
              <p>You haven&apos;t entered the supplier purchase-invoice details. This GRN will <strong className="text-foreground">not</strong> be booked under Accounts Payable — the goods will sit in the <strong className="text-foreground">GRN Clearing</strong> account until the bill is recorded:</p>
              <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 font-mono text-xs text-foreground">
                <div className="flex justify-between"><span>Inventory A/c</span><span>Dr</span></div>
                <div className="flex justify-between pl-6 text-muted"><span>To GRN Clearing A/c</span><span></span></div>
              </div>
              <p className="text-2xs">You can record the supplier bill anytime from <strong className="text-foreground">Purchase Invoice → Find Pending GRN</strong>.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2/50 px-5 py-3">
              <Button variant="ghost" size="md" onClick={() => setShowInvoiceWarn(false)}>Go back &amp; add invoice</Button>
              <Button size="md" onClick={() => { setShowInvoiceWarn(false); save("Posted", true); }}><Send className="h-4 w-4" /> Post to GRN Clearing</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const inpSm = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const cellR = (active: boolean, w = "w-20") => cn("h-9 rounded-md border bg-surface px-2 text-right text-sm text-foreground focus:outline-none", w, active ? "border-primary font-semibold" : "border-border-strong focus:border-primary");

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>;
}
const Req = () => <span className="text-danger"> *</span>;
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{label}</span><span className="text-foreground">{value}</span></div>;
}

function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }
function Mini({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string | number }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon className="h-4 w-4" /></span><div><div className="text-base font-bold text-foreground">{value}</div><div className="text-2xs text-subtle">{label}</div></div></div>;
}
