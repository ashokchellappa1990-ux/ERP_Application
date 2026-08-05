"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Truck, ArrowLeft, Users, PackagePlus, Plus, X, Save, Loader2,
  IndianRupee, Scale, CheckCircle2, FileOutput, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { BankPicker, emptyBank, type BankValue } from "@/components/finance/BankPicker";
import { fieldOn, fieldMust } from "@/lib/settings/docFieldsConfig";
import { buildTaxInvoiceHtml, type TaxInvoiceData } from "@/lib/print/taxInvoiceHtml";
import { DEFAULT_RECEIPT } from "@/lib/settings/receiptTemplate";
import { roundTonQty } from "@/lib/settings/transportConfigDefaults";

const SCREEN = "load_dispatch";
const req = (key: string) => (fieldMust(SCREEN, key) ? " *" : "");
const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

interface CustomerHit { id: number; name: string; phone: string; address: string }
interface ProductHit {
  id: number; name: string; sku?: string; uom?: string; price?: number; gst?: number;
  batchTracked?: boolean; invBatch?: boolean; invMfg?: boolean; invExpiry?: boolean;
}
interface Opt { id: number; label: string }
interface VehicleOpt extends Opt { vehicleType: string | null }
interface GateHit {
  id: number; gateEntryNo: string; vehicleId: number; vehicleNo: string;
  driverName: string | null; driverMobile: string | null; driverLicenseNo: string | null;
  transportCompanyId: number | null; transportCompanyName: string | null;
  vehicleType: string | null; dispatchType: string | null; referenceNo: string | null; status: string;
}
interface PreWeighmentRow { id: number; tareWeight: number; weighDate: string | null; weighTime: string | null; operator: string | null }

// Item line — mirrors the invoice-grade grid in B2bInvoiceForm.tsx. Discount is
// captured as a PERCENTAGE only (kept simple for this screen, unlike the B2B
// invoice's %/value toggle) — server (createDirectCustomerDispatch) accepts
// either discPct or discAmount and this screen always sends discPct.
interface Line {
  id: string; productId: number | null; productName: string; sku: string; uom: string;
  batchTracked: boolean; batchNo: string; mfgDate: string; expiryDate: string;
  qty: string; rate: string; discPct: string; taxPct: string;
}
const blankLine = (i: number): Line => ({
  id: `l-${i}-${Math.random().toString(36).slice(2, 7)}`, productId: null, productName: "", sku: "", uom: "",
  batchTracked: false, batchNo: "", mfgDate: "", expiryDate: "", qty: "1", rate: "", discPct: "", taxPct: "",
});

function calcLine(l: Line) {
  const qty = n(l.qty), rate = n(l.rate);
  const gross = r2(qty * rate);
  const discPct = n(l.discPct);
  const discAmount = discPct ? r2(gross * (discPct / 100)) : 0;
  const taxable = r2(Math.max(0, gross - discAmount));
  const taxPct = n(l.taxPct);
  const taxAmount = taxPct ? r2(taxable * (taxPct / 100)) : 0;
  const net = r2(taxable + taxAmount);
  return { gross, discAmount, taxable, taxAmount, net };
}

type PayCat = "full" | "partial" | "credit";
type PostStage = "draft" | "dispatched" | "dc" | "invoiced";

export function DirectLoadDispatchForm() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const prefillGateEntryId = searchParams.get("gateEntryId");
  // Reached from the Vehicle Gate Entry list's "Dispatch" action (?gateEntryId=)
  // vs. picked from the New Load & Dispatch source list directly — only the
  // former should send Back to the gate entry list instead of the source picker.
  const backHref = prefillGateEntryId ? "/transport/gate-entry" : "/warehouse/transfer/load-dispatch/new";
  const [submitting, setSubmitting] = useState(false);
  // Blocks the form until the Vehicle Gate Entry prefill (transport/driver
  // info + item lines + per-line rate/tax lookups) has fully finished, so the
  // user never sees a half-populated screen when arriving via "Start Loading".
  const [prefillLoading, setPrefillLoading] = useState(!!prefillGateEntryId);

  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  // Loading Unit — read-only, sourced from the logged-in user's own active
  // business/branch scope (same source GateEntryEditor.tsx uses for Location).
  const [loadingUnit, setLoadingUnit] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<CustomerHit[] | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [remarks, setRemarks] = useState("");

  // ---- Vehicle Gate Entry — auto-matched from the selected customer, no manual search ----
  const [vehicleGateEntryId, setVehicleGateEntryId] = useState<number | null>(null);
  const [linkedGateNo, setLinkedGateNo] = useState("");
  const [gateMatching, setGateMatching] = useState(false);
  const [preWeighment, setPreWeighment] = useState<PreWeighmentRow[] | null>(null);
  const [preWeighmentLoading, setPreWeighmentLoading] = useState(false);

  // ---- Transport & Driver details ----
  const [companies, setCompanies] = useState<Opt[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([]);
  const [transportCompanyId, setTransportCompanyId] = useState<number | "">("");
  const [vehicleId, setVehicleId] = useState<number | "">("");
  const [vehicleType, setVehicleType] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [driverLicenseNo, setDriverLicenseNo] = useState("");
  const [helperName, setHelperName] = useState("");
  const [helperMobile, setHelperMobile] = useState("");
  const [sealNumber, setSealNumber] = useState("");

  // ---- Items ----
  const [lines, setLines] = useState<Line[]>([blankLine(0)]);
  const [pq, setPq] = useState(""); const [hits, setHits] = useState<ProductHit[] | null>(null);
  const showBatchCols = lines.some((l) => l.batchTracked || !!l.batchNo);

  // ---- Weighment Management (Pre-Loading read-only + Post-Loading now/later) ----
  const [postWeightTiming, setPostWeightTiming] = useState<"now" | "later">("later");
  // Dispatch Configuration's Weighment Capture setting — "Both" keeps the
  // user-facing Later/Now toggle, "CaptureLater"/"CaptureNow" force one
  // behavior and hide the toggle (see the effect below that pins postWeightTiming).
  const [postWeightCaptureMode, setPostWeightCaptureMode] = useState<"Both" | "CaptureLater" | "CaptureNow">("Both");
  const [postGrossWeight, setPostGrossWeight] = useState("");
  const [postOperator, setPostOperator] = useState("");
  // Dispatch Configuration's "Require Weighment" flag — when on, a linked
  // Vehicle Gate Entry must already have a completed Pre-Loading Weighment
  // before this dispatch can be created (mirrors the same check the
  // completeLoadDispatch engine enforces server-side — see loadDispatch.ts).
  const [requireWeighment, setRequireWeighment] = useState(false);
  const tareWeight = preWeighment && preWeighment.length ? preWeighment[0].tareWeight : null;
  const postNetWeight = tareWeight != null ? r2(n(postGrossWeight) - tareWeight) : null;

  useEffect(() => {
    if (postWeightCaptureMode === "CaptureLater") setPostWeightTiming("later");
    else if (postWeightCaptureMode === "CaptureNow") setPostWeightTiming("now");
  }, [postWeightCaptureMode]);

  // Once the vehicle is actually weighed (Post-Loading Weight, "Capture Now"),
  // the resulting net weight (In Kgs) IS the dispatched quantity for a
  // single-item bulk-material load — push it into that item's qty so the
  // taxable/tax/net-amount totals below recalculate automatically. Only
  // applies to the common single-line case; multi-item dispatches are left
  // for manual entry since the net weight doesn't split across them.
  useEffect(() => {
    if (postWeightTiming !== "now" || postNetWeight == null) return;
    setLines((prev) => {
      if (prev.length !== 1 || !prev[0].productId) return prev;
      const isTon = (prev[0].uom || "").toLowerCase() === "ton";
      const qty = String(r2(isTon ? postNetWeight / 1000 : postNetWeight));
      if (prev[0].qty === qty) return prev;
      return [{ ...prev[0], qty }];
    });
  }, [postNetWeight, postWeightTiming]);

  // ---- Transport Cost (posted separately after create) ----
  const [freightCharge, setFreightCharge] = useState("");
  const [loadingCharge, setLoadingCharge] = useState("");
  const [unloadingCharge, setUnloadingCharge] = useState("");
  const [fuelCharge, setFuelCharge] = useState("");
  const [tollCharge, setTollCharge] = useState("");
  const [driverAllowance, setDriverAllowance] = useState("");
  const [helperAllowance, setHelperAllowance] = useState("");
  // Vehicle Rent is shared with the Payment Details section below (single
  // source — it's recovered from the customer as part of the invoice total,
  // not just an internal cost line). Driver Batta and Transit Pass used to be
  // free-text here too; they're now always auto-calculated (see
  // driverBattaAmount/transitPassAmount below) per Dispatch Configuration's
  // rates, so there's no separate manual input for them anymore.
  const [vehicleRent, setVehicleRent] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [tcDiscount, setTcDiscount] = useState("");
  const [tcGst, setTcGst] = useState("");

  // ---- Payment Details config (Dispatch Configuration > Transport Cost) ----
  const [driverBattaPerTon, setDriverBattaPerTon] = useState(10);
  const [driverBattaRounding, setDriverBattaRounding] = useState("floor");
  const [transitPassPerTon, setTransitPassPerTon] = useState(140);
  const [transitPassQtyMode, setTransitPassQtyMode] = useState<"Manual" | "AutoNetWeight">("Manual");
  const [transitPassQtyManual, setTransitPassQtyManual] = useState("");
  // Adjustment: Driver Batta is netted out of what's collected from the
  // customer (driver keeps it directly). Payment: the full invoice amount is
  // collected and the business pays the driver separately — captured below.
  const [driverBattaMode, setDriverBattaMode] = useState<"adjustment" | "payment">("adjustment");
  const [battaPaymentMode, setBattaPaymentMode] = useState("Cash");

  const totalTransportCost = r2(
    n(freightCharge) + n(loadingCharge) + n(unloadingCharge) + n(fuelCharge) + n(tollCharge) +
    n(driverAllowance) + n(helperAllowance) + n(otherCharges) - n(tcDiscount) + n(tcGst)
  );

  // ---- Payment Collection (mirrors B2bInvoiceForm) ----
  const [payCat, setPayCat] = useState<PayCat>("credit");
  const [amtPaid, setAmtPaid] = useState("");
  const [payMode, setPayMode] = useState("Bank Transfer");
  const [bank, setBank] = useState<BankValue>(emptyBank);
  const [splitLines, setSplitLines] = useState<{ mode: string; amount: string }[]>([{ mode: "Cash", amount: "" }]);

  // ---- Post-submit actions: Post Loading Weighment / Delivery Challan / Sales Invoice ----
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [postStage, setPostStage] = useState<PostStage>("draft");
  const [dcId, setDcId] = useState<number | null>(null);
  const [actionBusy, setActionBusy] = useState<"" | "dc" | "invoice">("");

  useEffect(() => {
    Promise.all([
      fetch("/api/transport/masters/transport-company?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]).then(([c, v]) => {
      if (c.ok) setCompanies(c.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name })));
      if (v.ok) setVehicles(v.rows.map((x: { id: number; vehicleNo: string; vehicleType: string | null }) => ({ id: x.id, label: x.vehicleNo, vehicleType: x.vehicleType })));
    });
    // Loading Unit — the logged-in user's own active business/branch scope.
    fetch("/api/system/scope", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      const branchIds: number[] | null = j.active?.branchIds ?? null;
      if (branchIds === null) { setLoadingUnit("All branches"); return; }
      if (branchIds.length === 1) {
        const b = (j.branches ?? []).find((x: { id: number; name: string }) => x.id === branchIds[0]);
        setLoadingUnit(b?.name ?? "");
      } else {
        setLoadingUnit(`${branchIds.length} branches`);
      }
    }).catch(() => {});
    // Weighment Capture mode — Dispatch Configuration's Post-Loading Weight setting.
    fetch("/api/settings/dispatch-config", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      const m = j.config?.fields?.postLoadWeightCaptureMode;
      if (m === "Both" || m === "CaptureLater" || m === "CaptureNow") setPostWeightCaptureMode(m);
      setRequireWeighment(!!j.config?.flags?.requireWeighment);
      if (j.config?.fields?.driverBattaPerTon != null) setDriverBattaPerTon(Number(j.config.fields.driverBattaPerTon) || 0);
      if (j.config?.fields?.driverBattaRounding) setDriverBattaRounding(j.config.fields.driverBattaRounding);
      if (j.config?.fields?.transitPassPerTon != null) setTransitPassPerTon(Number(j.config.fields.transitPassPerTon) || 0);
      const tpm = j.config?.fields?.transitPassQtyMode;
      if (tpm === "Manual" || tpm === "AutoNetWeight") setTransitPassQtyMode(tpm);
    }).catch(() => {});
  }, []);

  // ---- Prefill from a Vehicle Gate Entry passed in via ?gateEntryId= (e.g. the
  // "Start Loading" action on the Vehicle Gate Entry list jumps here directly).
  // Also prefills Items from whatever was captured on the gate entry itself
  // (product + qty), looking each one up for its current rate/tax so the
  // taxable/tax/net-amount calculations are already correct on arrival. ----
  useEffect(() => {
    if (!prefillGateEntryId) return;
    (async () => {
      try {
        const j = await fetch(`/api/transport/gate-entry/${prefillGateEntryId}`, { cache: "no-store" }).then((r) => r.json());
        if (!j.ok) return;
        const d = j.data;
        if (d.customerName) { setCustomerName(d.customerName); setCustomerQuery(d.customerName); }
        if (d.deliveryAddress) setDeliveryAddress(d.deliveryAddress);
        await applyGateEntry({
          id: d.id, gateEntryNo: d.gateEntryNo, vehicleId: d.vehicleId, vehicleNo: d.vehicleNo,
          driverName: d.driverName, driverMobile: d.driverMobile, driverLicenseNo: d.driverLicenseNo,
          transportCompanyId: d.transportCompanyId, transportCompanyName: d.transportCompanyName ?? null,
          vehicleType: d.vehicleTypeEntry ?? d.vehicleType, dispatchType: d.dispatchType, referenceNo: d.referenceNo, status: d.status,
        });

        const gateItems: { productId: number; productName: string; sku: string | null; uom: string | null; qty: number }[] = d.items ?? [];
        if (gateItems.length) {
          const prefilled = await Promise.all(gateItems.map(async (it, i): Promise<Line> => {
            let hit: ProductHit | undefined;
            try {
              const pj = await fetch(`/api/pos/products?q=${encodeURIComponent(it.sku || it.productName)}`, { cache: "no-store" }).then((r) => r.json());
              hit = pj.ok ? (pj.products as ProductHit[]).find((p) => p.id === it.productId) ?? pj.products?.[0] : undefined;
            } catch { /* best effort per line — falls back to product-only, rate/tax left blank */ }
            return {
              // Qty is no longer captured at the gate (Item Details there is
              // name-only) — left at 0 here; the Weighment Management "Capture
              // Now" net weight fills it in once the vehicle is actually weighed.
              ...blankLine(i), productId: it.productId, productName: it.productName, sku: it.sku || hit?.sku || "", uom: it.uom || hit?.uom || "",
              qty: "0", rate: hit?.price != null ? String(hit.price) : "", taxPct: hit?.gst != null ? String(hit.gst) : "",
              batchTracked: !!(hit?.batchTracked || hit?.invBatch || hit?.invMfg || hit?.invExpiry),
            };
          }));
          setLines(prefilled);
        }
      } catch { /* best effort */ }
      finally { setPrefillLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillGateEntryId]);

  const custTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCustomers = async (q: string) => {
    if (!q.trim()) { setCustomerHits(null); return; }
    try { const j = await fetch(`/api/masters/customers?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setCustomerHits((j.customers ?? []).slice(0, 20)); }
    catch { toast.error("Could not search customers."); }
  };
  const onCustomerQuery = (v: string) => { setCustomerQuery(v); setCustomerName(v); setCustomerId(null); if (custTimer.current) clearTimeout(custTimer.current); custTimer.current = setTimeout(() => searchCustomers(v), 250); };

  // ---- Auto-match a Vehicle Gate Entry for the selected customer's transport/driver details ----
  async function matchGateEntryForCustomer(name: string) {
    clearGateEntry();
    if (!name.trim()) return;
    setGateMatching(true);
    try {
      const j = await fetch(`/api/transport/gate-entry?customerName=${encodeURIComponent(name.trim())}`, { cache: "no-store" }).then((r) => r.json());
      const rows: GateHit[] = j.ok ? (j.rows ?? []).filter((r: GateHit) => r.status !== "Exited") : [];
      if (rows.length) await applyGateEntry(rows[0]);
    } catch { /* best effort — direct dispatch still works without a matched gate entry */ }
    setGateMatching(false);
  }

  // ---- Fallback match when the user picks a Vehicle Number manually instead of
  // a customer (e.g. Transport Company/Vehicle chosen by hand) — finds that
  // vehicle's own active gate entry so Weighment Management still has something
  // to show. Never overrides an already-linked gate entry. ----
  async function matchGateEntryForVehicle(id: number) {
    if (vehicleGateEntryId) return;
    setGateMatching(true);
    try {
      const j = await fetch(`/api/transport/gate-entry?vehicleId=${id}`, { cache: "no-store" }).then((r) => r.json());
      const rows: GateHit[] = j.ok ? (j.rows ?? []).filter((r: GateHit) => r.status !== "Exited") : [];
      if (rows.length) await applyGateEntry(rows[0]);
    } catch { /* best effort */ }
    setGateMatching(false);
  }

  const pickCustomer = (hit: CustomerHit) => {
    setCustomerId(hit.id); setCustomerName(hit.name); setCustomerQuery(hit.name); setCustomerHits(null);
    setDeliveryAddress(hit.address ?? "");
    matchGateEntryForCustomer(hit.name);
  };

  async function applyGateEntry(hit: GateHit) {
    setVehicleGateEntryId(hit.id); setLinkedGateNo(hit.gateEntryNo);
    // Best-effort auto-fill from the list row immediately for instant UI feedback.
    setTransportCompanyId(hit.transportCompanyId ?? "");
    setVehicleId(hit.vehicleId ?? "");
    setVehicleType(hit.vehicleType ?? "");
    setDriverName(hit.driverName ?? "");
    setDriverMobile(hit.driverMobile ?? "");
    setDriverLicenseNo(hit.driverLicenseNo ?? "");
    // Fetch the full detail for fields the list row doesn't carry (helper name/mobile).
    try {
      const j = await fetch(`/api/transport/gate-entry/${hit.id}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) {
        const d = j.data;
        setHelperName((p) => p || d.helperName || "");
        setHelperMobile((p) => p || d.helperMobile || "");
        setVehicleType((p) => p || d.vehicleTypeEntry || d.vehicleType || "");
      }
    } catch { /* best effort */ }
    // Pre-Loading Weighment for Weighment Management (tare weight reference).
    setPreWeighmentLoading(true);
    try {
      const j = await fetch(`/api/transport/pre-weighment?gateEntryId=${hit.id}`, { cache: "no-store" }).then((r) => r.json());
      setPreWeighment(j.ok ? j.rows : []);
    } catch { setPreWeighment([]); }
    setPreWeighmentLoading(false);
  }
  function clearGateEntry() {
    setVehicleGateEntryId(null); setLinkedGateNo(""); setPreWeighment(null);
  }

  const prodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchProducts = async (q: string) => { if (!q.trim()) { setHits(null); return; } try { const j = await fetch(`/api/pos/products?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setHits(j.products ?? []); } catch { toast.error("Could not search products."); } };
  const onPq = (v: string) => { setPq(v); if (prodTimer.current) clearTimeout(prodTimer.current); if (!v.trim()) { setHits(null); return; } prodTimer.current = setTimeout(() => searchProducts(v), 250); };
  const addProductLine = (p: ProductHit) => {
    setLines((prev) => {
      const filled: Line = {
        ...blankLine(prev.length), productId: p.id, productName: p.name, sku: p.sku ?? "", uom: p.uom ?? "",
        rate: p.price != null ? String(p.price) : "", taxPct: p.gst != null ? String(p.gst) : "",
        batchTracked: !!(p.batchTracked || p.invBatch || p.invMfg || p.invExpiry),
      };
      // Fill the first still-empty row (e.g. the initial blank line) instead of
      // leaving a dangling "Search & pick above" row behind every add.
      const idx = prev.findIndex((l) => l.productId === null);
      if (idx !== -1) { const next = [...prev]; next[idx] = { ...filled, id: prev[idx].id }; return next; }
      return [...prev, filled];
    });
    setHits(null); setPq("");
  };
  const updLine = (id: string, patch: Partial<Line>) => setLines((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setLines((p) => (p.length > 1 ? p.filter((l) => l.id !== id) : p));

  const vehicleTypeOpts = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.vehicleType).filter((t): t is string => !!t && t.trim() !== ""))).sort(),
    [vehicles],
  );

  // Driver Details as a whole only makes sense to show if at least one of its
  // fields is enabled — otherwise it'd render as an empty card.
  const driverDetailsVisible = fieldOn(SCREEN, "driverName") || fieldOn(SCREEN, "driverMobile") || fieldOn(SCREEN, "driverLicenseNo") || fieldOn(SCREEN, "helperName") || fieldOn(SCREEN, "helperMobile");

  const totals = useMemo(() => {
    let subtotal = 0, discTotal = 0, taxable = 0, tax = 0;
    for (const l of lines) {
      if (!l.productId || n(l.qty) <= 0) continue;
      const c = calcLine(l);
      subtotal += c.gross; discTotal += c.discAmount; taxable += c.taxable; tax += c.taxAmount;
    }
    const grandTotal = r2(taxable + tax);
    return { subtotal: r2(subtotal), discTotal: r2(discTotal), taxable: r2(taxable), tax: r2(tax), grandTotal };
  }, [lines]);

  // ---- Payment Details — Driver Batta / Transit Pass, both Ton-qty based ----
  // "Ton" matched case-insensitively against each line's uom, same convention
  // used for the Kg-to-Ton net-weight conversion above.
  const tonQty = useMemo(() => lines.reduce((s, l) => s + ((l.uom || "").toLowerCase() === "ton" ? n(l.qty) : 0), 0), [lines]);
  const roundedTonQty = roundTonQty(tonQty, driverBattaRounding);
  const driverBattaAmount = r2(roundedTonQty * driverBattaPerTon);
  const transitPassQty = transitPassQtyMode === "AutoNetWeight" ? tonQty : n(transitPassQtyManual);
  const transitPassAmount = r2(transitPassQty * transitPassPerTon);
  const totalInvoiceAmount = r2(totals.taxable + totals.tax + n(vehicleRent) + transitPassAmount);
  const totalAmountToCollect = r2(driverBattaMode === "adjustment" ? totalInvoiceAmount - driverBattaAmount : totalInvoiceAmount);

  // Split isn't its own collection category — it's a tender mode selectable
  // within Full or Partial (matching Sale.paymentMode already listing Split
  // as one mode value, not a category); when chosen, the split lines' own
  // sum becomes the amount actually collected.
  const splitTotal = r2(splitLines.reduce((s, l) => s + n(l.amount), 0));
  const isSplit = payMode === "Split" && payCat !== "credit";
  const paidNow = payCat === "credit" ? 0 : payCat === "full" ? totalAmountToCollect : isSplit ? splitTotal : n(amtPaid);
  const payStatus = paidNow <= 0 ? "Credit" : paidNow >= totalAmountToCollect ? "Paid" : "Partial";

  async function save() {
    const valid = lines.filter((l) => l.productId && n(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one item with a valid quantity."); return; }
    if (payCat === "partial" && (paidNow <= 0 || paidNow >= totalAmountToCollect)) { toast.error("Enter a partial amount greater than 0 and less than the total amount to be collected."); return; }
    if (isSplit && splitTotal <= 0) { toast.error("Enter at least one split payment line with an amount."); return; }
    if (isSplit && payCat === "full" && Math.abs(splitTotal - totalAmountToCollect) > 0.01) { toast.error("Split payment lines must add up to the full total amount to be collected."); return; }
    if (isSplit && payCat === "partial" && splitTotal >= totalAmountToCollect) { toast.error("Split payment lines must add up to less than the total amount to be collected for a partial collection."); return; }
    if (transitPassQtyMode === "Manual" && n(transitPassQtyManual) < 0) { toast.error("Enter a valid Transit Pass quantity."); return; }
    if (postWeightTiming === "now" && vehicleGateEntryId && n(postGrossWeight) <= 0) { toast.error("Enter a valid post-loading gross weight, or switch Weighment Management to “Later”."); return; }
    if (requireWeighment && vehicleGateEntryId && tareWeight == null) { toast.error("Pre-Loading Weighment must be completed for the linked Vehicle Gate Entry before this dispatch can be created (per Dispatch Configuration)."); return; }
    setSubmitting(true);
    const payload = {
      source: "DIRECT_CUSTOMER" as const,
      dispatchDate,
      customerId: customerId || null,
      customerName: customerName.trim() || null,
      deliveryAddress: deliveryAddress.trim() || null,
      warehouse: null,
      vehicleGateEntryId: vehicleGateEntryId || null,
      transportCompanyId: transportCompanyId || null,
      vehicleId: vehicleId || null,
      vehicleType: vehicleType.trim() || null,
      driverName: driverName.trim() || null,
      driverMobile: driverMobile.trim() || null,
      driverLicenseNo: driverLicenseNo.trim() || null,
      helperName: helperName.trim() || null,
      helperMobile: helperMobile.trim() || null,
      sealNumber: sealNumber.trim() || null,
      vehicleRent: n(vehicleRent),
      transitPassQty: transitPassQty,
      driverBattaMode: (driverBattaMode === "adjustment" ? "Adjustment" : "Payment") as "Adjustment" | "Payment",
      payment: {
        paymentMode: (payCat === "full" ? "Full" : payCat === "partial" ? "Partial" : "Credit") as "Full" | "Partial" | "Credit",
        paymentAmount: paidNow,
        paymentMethod: isSplit ? "Split" : paidNow > 0 ? payMode : null,
        bankId: isSplit ? null : paidNow > 0 ? bank.bankId : null,
        bankName: isSplit ? null : paidNow > 0 ? bank.bankName : null,
        bankAccount: isSplit ? null : paidNow > 0 ? bank.bankAccount : null,
        paymentSplits: isSplit ? splitLines.filter((l) => n(l.amount) > 0).map((l) => ({ mode: l.mode, amount: n(l.amount), reference: null })) : null,
      },
      remarks: remarks.trim() || null,
      items: valid.map((l) => ({
        productId: l.productId, productName: l.productName || undefined, sku: l.sku || undefined,
        uom: l.uom || undefined, batchNo: l.batchNo || undefined, mfgDate: l.mfgDate || undefined, expiryDate: l.expiryDate || undefined,
        dispatchedQty: n(l.qty), rate: l.rate ? n(l.rate) : undefined,
        discPct: l.discPct ? n(l.discPct) : undefined, taxPct: l.taxPct ? n(l.taxPct) : undefined,
      })),
    };
    try {
      const res = await fetch("/api/warehouse/load-dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { toast.error(j.message || "Could not create the dispatch."); setSubmitting(false); return; }
      const id = j.id as number;

      // Transport Cost — only fire a second request if at least one charge was
      // entered. Driver Batta / Vehicle Rent / Transit Pass are already stored
      // authoritatively on the dispatch itself (see payload above) — sent here
      // too so the Transport Cost report/screen shows the same figures.
      const tcHasValue = [freightCharge, loadingCharge, unloadingCharge, fuelCharge, tollCharge, driverAllowance, helperAllowance, vehicleRent, otherCharges, tcDiscount, tcGst].some((v) => n(v) > 0) || driverBattaAmount > 0 || transitPassAmount > 0;
      if (tcHasValue) {
        try {
          await fetch(`/api/warehouse/load-dispatch/${id}/transport-cost`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transportCompanyId: transportCompanyId || null, vehicleId: vehicleId || null,
              freightCharge: n(freightCharge), loadingCharge: n(loadingCharge), unloadingCharge: n(unloadingCharge),
              fuelCharge: n(fuelCharge), tollCharge: n(tollCharge), driverAllowance: n(driverAllowance),
              helperAllowance: n(helperAllowance), driverBatta: driverBattaAmount, vehicleRent: n(vehicleRent), transitPass: transitPassAmount, transitPassQty,
              otherCharges: n(otherCharges), discount: n(tcDiscount), gstAmount: n(tcGst),
              remarks: null,
            }),
          });
        } catch { /* best effort — dispatch itself already succeeded */ }
      }

      // Post-Loading Weighment captured "now" — fire immediately against the matched gate entry.
      if (postWeightTiming === "now" && vehicleGateEntryId && n(postGrossWeight) > 0) {
        try {
          await fetch("/api/transport/post-weighment", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gateEntryId: vehicleGateEntryId, grossWeight: n(postGrossWeight), operator: postOperator || null, weighDate: dispatchDate, remarks: null }),
          });
        } catch { /* best effort — dispatch itself already succeeded */ }
      }

      toast.success(j.message || "Direct customer dispatch created.");
      setCreatedId(id); setPostStage("draft"); setDcId(null);
    } catch { toast.error("Network error — could not save."); setSubmitting(false); }
  }

  // ---- Post-submit: Complete → Delivery Challan → Sales Invoice, reusing the same
  // status/DC/invoice engine endpoints the main Load & Dispatch editor uses. ----
  async function ensureDispatched(id: number) {
    if (postStage !== "draft") return;
    const res = await fetch(`/api/warehouse/load-dispatch/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.message || "Could not complete the dispatch.");
    setPostStage("dispatched");
  }
  async function ensureDeliveryChallan(id: number): Promise<number | null> {
    await ensureDispatched(id);
    if (postStage === "dc" || postStage === "invoiced") return dcId;
    const res = await fetch(`/api/warehouse/load-dispatch/${id}/delivery-challan`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.message || "Could not generate the Delivery Challan.");
    setPostStage(j.invoiceNo ? "invoiced" : "dc");
    setDcId(j.deliveryChallanId ?? null);
    return j.deliveryChallanId ?? null;
  }
  // Prints the same "Delivery Note" template as the Load & Dispatch view
  // page's own "Print DC" button (buildTaxInvoiceHtml + the print-data
  // route's deliveryNote) — previously this navigated to the old, plainer
  // /transport/delivery-challan/[id] page instead of matching that template.
  async function handlePrintDc() {
    if (createdId == null) return;
    setActionBusy("dc");
    try {
      await ensureDeliveryChallan(createdId);
      const dataRes = await fetch(`/api/warehouse/load-dispatch/${createdId}/print-data`, { cache: "no-store" }).then((r) => r.json());
      if (dataRes?.ok && dataRes.deliveryNote) {
        const html = buildTaxInvoiceHtml(dataRes.deliveryNote as TaxInvoiceData, { title: "Delivery Note", footerNote: DEFAULT_RECEIPT.footerNote });
        const w = window.open("", "_blank", "width=900,height=800");
        if (w) { w.document.write(html); w.document.close(); }
      } else {
        toast.success(postStage === "invoiced" ? "Delivery Challan generated — Sales Invoice was posted automatically." : "Delivery Challan generated.");
      }
      // Once the print window has opened (or there's nothing to print), the
      // popup's job is done — move on to the view page with the now-updated
      // status instead of leaving the "Dispatch Created" popup sitting open.
      router.push(`/warehouse/transfer/load-dispatch/${createdId}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not generate the Delivery Challan."); }
    setActionBusy("");
  }
  async function handlePostInvoice() {
    if (createdId == null) return;
    setActionBusy("invoice");
    try {
      await ensureDeliveryChallan(createdId);
      if (postStage === "invoiced") { toast.success("Sales Invoice already posted (Automatic mode)."); router.push(`/warehouse/transfer/load-dispatch/${createdId}`); setActionBusy(""); return; }
      const res = await fetch(`/api/warehouse/load-dispatch/${createdId}/post-invoice`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.message || "Could not post the Sales Invoice.");
      setPostStage("invoiced");
      toast.success(j.message || "Sales Invoice posted.");
      router.push(`/warehouse/transfer/load-dispatch/${createdId}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not post the Sales Invoice."); }
    setActionBusy("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/load-dispatch" className="hover:text-foreground">Load &amp; Dispatch</Link><span className="text-subtle">/</span><Link href="/warehouse/transfer/load-dispatch/new" className="hover:text-foreground">New</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Direct Customer Dispatch</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> Direct Customer Dispatch</h1>
          <p className="mt-0.5 text-sm text-muted">Manual dispatch to a customer without a Sales Order.</p>
        </div>
        <Link href={backHref}><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {prefillLoading ? (
        <div className="rounded-2xl border border-border bg-card py-16 shadow-sm">
          <AppLoader label="Loading vehicle gate entry details…" />
        </div>
      ) : (
      <>
      <SectionCard icon={Users} title="Customer &amp; Delivery" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fld label="Dispatch Date"><input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} className={inp} /></Fld>
          <Fld label="Loading Unit"><input readOnly value={loadingUnit || "—"} className={cn(inp, "cursor-not-allowed bg-surface-2")} /></Fld>
          <div className="relative">
            <label className="mb-1 block text-2xs font-semibold text-muted">Customer</label>
            <input value={customerQuery} onChange={(e) => onCustomerQuery(e.target.value)} placeholder="Search customer master…" className={inp} />
            {customerHits !== null && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                {customerHits.length ? customerHits.map((h) => (
                  <button key={h.id} onClick={() => pickCustomer(h)} className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40">
                    <span className="font-medium text-foreground">{h.name}</span>{h.phone ? <span className="text-2xs text-subtle"> — {h.phone}</span> : null}
                  </button>
                )) : <div className="px-3 py-2 text-sm text-muted">No matching customers — will be saved as free text.</div>}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3"><Fld label="Delivery Address"><textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld></div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard icon={Truck} title="Transport Details" allowOverflow>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fieldOn(SCREEN, "transportCompany") && <Fld label={`Transport Company${req("transportCompany")}`}><select value={transportCompanyId} onChange={(e) => setTransportCompanyId(e.target.value ? Number(e.target.value) : "")} className={inp}><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Fld>}
            <Fld label="Vehicle Number">
              <select
                value={vehicleId}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : "";
                  setVehicleId(id);
                  const v = vehicles.find((x) => x.id === id);
                  if (v?.vehicleType) setVehicleType(v.vehicleType);
                  if (id) matchGateEntryForVehicle(id);
                }}
                className={inp}
              >
                <option value="">Select vehicle…</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </Fld>
            <div>
              <label className="mb-1 block text-2xs font-semibold text-muted">Vehicle Gate Entry Reference</label>
              {gateMatching ? (
                <div className="flex h-9 items-center rounded-md border border-border-strong bg-surface-2 px-2.5 text-sm text-muted"><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Matching…</div>
              ) : vehicleGateEntryId ? (
                <div className="flex h-9 items-center justify-between rounded-md border border-border-strong bg-primary-subtle/40 px-2.5 text-sm">
                  <span className="font-mono font-semibold text-primary">{linkedGateNo}</span>
                  <button onClick={clearGateEntry} className="text-2xs font-semibold text-danger hover:underline">Unlink</button>
                </div>
              ) : (
                <div className="flex h-9 items-center rounded-md border border-dashed border-border bg-surface-2 px-2.5 text-2xs text-subtle">Select a customer to auto-load a gate entry, if any.</div>
              )}
            </div>
            {fieldOn(SCREEN, "vehicleType") && (
              <Fld label={`Vehicle Type${req("vehicleType")}`}>
                <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inp}>
                  <option value="">Select type…</option>
                  {vehicleTypeOpts.map((t) => <option key={t} value={t}>{t}</option>)}
                  {vehicleType && !vehicleTypeOpts.includes(vehicleType) && <option value={vehicleType}>{vehicleType}</option>}
                </select>
              </Fld>
            )}
            {fieldOn(SCREEN, "sealNumber") && <Fld label="Seal Number"><input value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} className={inp} /></Fld>}
          </div>
        </SectionCard>

        {fieldOn(SCREEN, "weighmentManagement") && (
        <SectionCard icon={Scale} title="Weighment Management" allowOverflow>
          {!vehicleGateEntryId ? (
            <p className="text-2xs text-subtle">No Vehicle Gate Entry matched for this customer yet — weighment capture becomes available once one is linked.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Fld label={`Pre-Loading Tare Weight (In Kgs)${requireWeighment ? " *" : ""}`}>
                  <input readOnly value={preWeighmentLoading ? "Loading…" : tareWeight != null ? String(tareWeight) : "Not yet weighed"} className={cn(inp, "cursor-not-allowed bg-surface-2 font-semibold", tareWeight == null && requireWeighment ? "text-danger" : "text-foreground")} />
                  {tareWeight == null && requireWeighment && !preWeighmentLoading && <p className="mt-1 text-2xs text-danger">Required by Dispatch Configuration — complete the Pre-Loading Weighment first.</p>}
                </Fld>
                <Fld label="Weighed On">
                  <input readOnly value={preWeighmentLoading ? "" : preWeighment?.[0] ? `${preWeighment[0].weighDate ?? "—"}${preWeighment[0].weighTime ? ` ${preWeighment[0].weighTime}` : ""}` : "—"} className={cn(inp, "cursor-not-allowed bg-surface-2")} />
                </Fld>
                <Fld label="Weighing Operator">
                  <input readOnly value={preWeighment?.[0]?.operator ?? "—"} className={cn(inp, "cursor-not-allowed bg-surface-2")} />
                </Fld>
                <Fld label="Gate Entry Reference">
                  <input readOnly value={linkedGateNo} className={cn(inp, "cursor-not-allowed bg-surface-2 font-mono")} />
                </Fld>
              </div>
              {postWeightCaptureMode === "Both" && (
                <div className="mt-3">
                  <label className="mb-1 block text-2xs font-semibold text-muted">Post-Loading Weight</label>
                  <div className="inline-flex w-full overflow-hidden rounded-md border border-border text-2xs">
                    {([["later", "Capture Later"], ["now", "Capture Now"]] as const).map(([m, lbl]) => (
                      <button key={m} type="button" onClick={() => setPostWeightTiming(m)} className={cn("flex-1 px-2 py-1.5 font-semibold transition", postWeightTiming === m ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
                    ))}
                  </div>
                </div>
              )}
              {postWeightTiming === "now" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Fld label="Post-Loading Gross Weight (In Kgs) *"><input type="number" min={0} step="0.001" value={postGrossWeight} onChange={(e) => setPostGrossWeight(e.target.value)} className={inp} /></Fld>
                  <Fld label="Operator"><input value={postOperator} onChange={(e) => setPostOperator(e.target.value)} className={inp} /></Fld>
                  <div className="sm:col-span-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs">
                    <span className="text-muted">Net Weight (In Kgs)</span>
                    <span className="font-bold tabular-nums text-primary">{postNetWeight != null ? postNetWeight.toLocaleString() : "—"}</span>
                  </div>
                  {postNetWeight != null && lines.length === 1 && lines[0].productId && (lines[0].uom || "").toLowerCase() === "ton" && (
                    <div className="sm:col-span-2 flex items-center justify-between rounded-lg bg-info-subtle px-3 py-2 text-xs text-info">
                      <span>Converted to {lines[0].uom} for {lines[0].productName || "the item"} (1 Ton = 1000 Kg)</span>
                      <span className="font-bold tabular-nums">{postNetWeight.toLocaleString()} Kg ÷ 1000 = {r2(postNetWeight / 1000)} Ton</span>
                    </div>
                  )}
                  <p className="sm:col-span-2 text-2xs text-subtle">Net weight is loaded into the item&apos;s quantity below automatically, and the taxable/tax/net-amount totals recalculate from it.</p>
                </div>
              )}
            </>
          )}
        </SectionCard>
        )}
      </div>

      <SectionCard icon={PackagePlus} title="Items" allowOverflow>
        <div className="relative mb-3">
          <label className="mb-1 block text-2xs font-semibold text-muted">Add product</label>
          <input value={pq} onChange={(e) => onPq(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchProducts(pq); } }} placeholder="Search product to add…" className={inp} />
          {hits !== null && (hits.length ? (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
              {hits.map((p) => <button key={p.id} onClick={() => addProductLine(p)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-primary-subtle/40"><span className="min-w-0"><span className="block font-medium text-foreground">{p.name}</span><span className="block text-2xs text-subtle">{p.sku || "—"}{(p.batchTracked || p.invBatch) ? " · batch tracked" : ""}</span></span><Plus className="h-3.5 w-3.5 text-primary" /></button>)}
            </div>
          ) : <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No products matched.</div>)}
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[900px] table-fixed text-sm">
            <colgroup>
              <col className="w-auto min-w-[110px] max-w-[150px]" />
              {showBatchCols && <><col className="w-28" /><col className="w-32" /><col className="w-32" /></>}
              <col className="w-24" />
              <col className="w-16" />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-24" />
              <col className="w-16" />
              <col className="w-24" />
              <col className="w-28" />
              <col className="w-9" />
            </colgroup>
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
              <th className="px-2 py-2">Product</th>
              {showBatchCols && <><th className="px-2 py-2">Batch No</th><th className="px-2 py-2">Mfg Date</th><th className="px-2 py-2">Exp Date</th></>}
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2">UOM</th>
              <th className="px-2 py-2 text-right">Rate</th>
              <th className="px-2 py-2 text-right">Disc %</th>
              <th className="px-2 py-2 text-right">Taxable</th>
              <th className="px-2 py-2 text-right">Tax %</th>
              <th className="px-2 py-2 text-right">Tax Amt</th>
              <th className="px-2 py-2 text-right">Net Amount</th>
              <th className="px-2 py-2" />
            </tr></thead>
            <tbody>
              {lines.map((l) => {
                const c = calcLine(l);
                const needsBatch = l.batchTracked && !l.batchNo;
                return (
                <tr key={l.id} className="border-b border-border last:border-0 align-middle">
                  <td className="px-2 py-1.5">
                    <div className="truncate font-medium text-foreground">{l.productName || <span className="text-subtle">Search &amp; pick above</span>}</div>
                    {l.sku ? <div className="text-2xs text-subtle">{l.sku}</div> : null}
                    {needsBatch && <div className="text-2xs font-semibold text-warning">Batch required</div>}
                  </td>
                  {showBatchCols && (
                    <>
                      <td className="px-2 py-1.5"><input value={l.batchNo} onChange={(e) => updLine(l.id, { batchNo: e.target.value })} className={cn(inpSm, "w-full", needsBatch && "border-warning focus:border-warning")} /></td>
                      <td className="px-2 py-1.5"><input type="date" value={l.mfgDate} onChange={(e) => updLine(l.id, { mfgDate: e.target.value })} className={cn(inpSm, "w-full")} /></td>
                      <td className="px-2 py-1.5"><input type="date" value={l.expiryDate} onChange={(e) => updLine(l.id, { expiryDate: e.target.value })} className={cn(inpSm, "w-full")} /></td>
                    </>
                  )}
                  <td className="px-2 py-1.5"><input type="number" value={l.qty} onChange={(e) => updLine(l.id, { qty: e.target.value.slice(0, 10) })} className={cn(inpSm, "w-full text-right")} /></td>
                  <td className="px-2 py-1.5 text-2xs text-muted">{l.uom || "—"}</td>
                  <td className="px-2 py-1.5"><input type="number" value={l.rate} onChange={(e) => updLine(l.id, { rate: e.target.value })} className={cn(inpSm, "w-full text-right")} /></td>
                  <td className="px-2 py-1.5"><input type="number" value={l.discPct} onChange={(e) => updLine(l.id, { discPct: e.target.value })} placeholder="0" className={cn(inpSm, "w-full text-right")} /></td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted">{c.taxable.toFixed(2)}</td>
                  <td className="px-2 py-1.5"><input type="number" value={l.taxPct} onChange={(e) => updLine(l.id, { taxPct: e.target.value })} placeholder="0" className={cn(inpSm, "w-full text-right")} /></td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted">{c.taxAmount.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-foreground">{c.net.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-center"><button onClick={() => removeLine(l.id)} className="text-subtle hover:text-danger"><X className="h-4 w-4" /></button></td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-3 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <Row k="Subtotal" v={totals.subtotal.toFixed(2)} />
            {totals.discTotal > 0 && <Row k="Total Discount" v={`- ${totals.discTotal.toFixed(2)}`} />}
            <Row k="Total Taxable Value" v={totals.taxable.toFixed(2)} />
            <Row k="Total Tax" v={totals.tax.toFixed(2)} />
            <div className="my-1 h-px bg-border" />
            <div className="flex items-center justify-between text-base font-bold text-foreground"><span>Grand Total</span><span>{totals.grandTotal.toFixed(2)}</span></div>
          </div>
        </div>
      </SectionCard>

      {driverDetailsVisible && (
      <SectionCard icon={Users} title="Driver Details" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fieldOn(SCREEN, "driverName") && <Fld label="Driver Name"><input value={driverName} onChange={(e) => setDriverName(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "driverMobile") && <Fld label={`Driver Mobile${req("driverMobile")}`}><input value={driverMobile} onChange={(e) => setDriverMobile(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "driverLicenseNo") && <Fld label={`License Number${req("driverLicenseNo")}`}><input value={driverLicenseNo} onChange={(e) => setDriverLicenseNo(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "helperName") && <Fld label="Helper Name"><input value={helperName} onChange={(e) => setHelperName(e.target.value)} className={inp} /></Fld>}
          {fieldOn(SCREEN, "helperMobile") && <Fld label="Helper Mobile"><input value={helperMobile} onChange={(e) => setHelperMobile(e.target.value)} className={inp} /></Fld>}
        </div>
      </SectionCard>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {fieldOn(SCREEN, "transportCost") && (
        <SectionCard icon={Truck} title="Transport Cost" allowOverflow>
          <div className="grid gap-3 sm:grid-cols-2">
            {fieldOn(SCREEN, "freightCharge") && <Fld label="Freight Charge"><input type="number" value={freightCharge} onChange={(e) => setFreightCharge(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "loadingCharge") && <Fld label="Loading Charge"><input type="number" value={loadingCharge} onChange={(e) => setLoadingCharge(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "unloadingCharge") && <Fld label="Unloading Charge"><input type="number" value={unloadingCharge} onChange={(e) => setUnloadingCharge(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "fuelCharge") && <Fld label="Fuel Charge"><input type="number" value={fuelCharge} onChange={(e) => setFuelCharge(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "tollCharge") && <Fld label="Toll Charge"><input type="number" value={tollCharge} onChange={(e) => setTollCharge(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "driverAllowance") && <Fld label="Driver Allowance (Bata)"><input type="number" value={driverAllowance} onChange={(e) => setDriverAllowance(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "helperAllowance") && <Fld label="Helper Allowance"><input type="number" value={helperAllowance} onChange={(e) => setHelperAllowance(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "driverBatta") && <Fld label="Driver Batta (auto)"><input readOnly value={driverBattaAmount.toFixed(2)} className={cn(inp, "bg-surface-2 font-semibold text-foreground")} /></Fld>}
            {fieldOn(SCREEN, "vehicleRent") && <Fld label="Vehicle Rent"><input type="number" value={vehicleRent} onChange={(e) => setVehicleRent(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "transitPass") && <Fld label="Transit Pass (auto)"><input readOnly value={transitPassAmount.toFixed(2)} className={cn(inp, "bg-surface-2 font-semibold text-foreground")} /></Fld>}
            {fieldOn(SCREEN, "otherTransportCharges") && <Fld label="Other Charges"><input type="number" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "transportDiscount") && <Fld label="Discount"><input type="number" value={tcDiscount} onChange={(e) => setTcDiscount(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "transportGst") && <Fld label="GST Amount"><input type="number" value={tcGst} onChange={(e) => setTcGst(e.target.value)} className={inp} /></Fld>}
            <Fld label="Total Transport Cost"><input readOnly value={r2(totalTransportCost + driverBattaAmount + transitPassAmount).toFixed(2)} className={cn(inp, "bg-surface-2 font-semibold text-foreground")} /></Fld>
          </div>
          <p className="mt-2 text-2xs text-subtle">Driver Batta &amp; Transit Pass are auto-calculated in Payment Details below (Dispatch Configuration rates) — not editable here. The rest is saved separately after the dispatch is created; left blank/zero, it won&apos;t be saved at all.</p>
        </SectionCard>
        )}

        <SectionCard icon={IndianRupee} title="Payment Details" allowOverflow>
          <div className="space-y-1.5 text-sm">
            <Row k="Total Material Value" v={totals.taxable.toFixed(2)} />
            <Row k="Total Tax Value" v={totals.tax.toFixed(2)} />
            <Row k="Rent (Amount to be Recovered)" v={n(vehicleRent).toFixed(2)} />
            <Row k="Transit Pass Amount" v={transitPassAmount.toFixed(2)} />
            {transitPassQtyMode === "Manual" ? (
              <div className="flex items-center justify-between gap-3">
                <span className="shrink-0 text-2xs text-subtle">Transit Pass Qty (Ton) — ₹{transitPassPerTon}/Ton</span>
                <input type="number" min={0} step="0.001" value={transitPassQtyManual} onChange={(e) => setTransitPassQtyManual(e.target.value)} className={cn(inp, "h-8 w-28 text-right")} />
              </div>
            ) : (
              <p className="text-2xs text-subtle">Transit Pass Qty auto-fills from Net Weight: {tonQty.toFixed(3)} Ton × ₹{transitPassPerTon}/Ton.</p>
            )}
            <div className="my-1 h-px bg-border" />
            <div className="flex items-center justify-between font-bold text-foreground"><span>Total Invoice Amount</span><span>{totalInvoiceAmount.toFixed(2)}</span></div>
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Driver Batta Amount</p>
                <p className="text-2xs text-subtle">{roundedTonQty} Ton (rounded) × ₹{driverBattaPerTon}/Ton</p>
              </div>
              <span className="text-lg font-bold tabular-nums text-foreground">{driverBattaAmount.toFixed(2)}</span>
            </div>
            <div className="mt-2 inline-flex w-full overflow-hidden rounded-md border border-border text-2xs">
              {([["adjustment", "Adjustment"], ["payment", "Payment"]] as const).map(([m, lbl]) => (
                <button key={m} type="button" onClick={() => setDriverBattaMode(m)} className={cn("flex-1 px-2 py-1.5 font-semibold transition", driverBattaMode === m ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
              ))}
            </div>
            <p className="mt-1 text-2xs text-subtle">
              {driverBattaMode === "adjustment"
                ? "Netted out of what's collected from the customer — the driver keeps this directly."
                : "Full invoice amount is collected from the customer; the business pays the driver separately below."}
            </p>
            {driverBattaMode === "payment" && (
              <div className="mt-2 max-w-xs"><Fld label="Batta Payment Mode"><select value={battaPaymentMode} onChange={(e) => setBattaPaymentMode(e.target.value)} className={inp}>{["Cash", "Bank Transfer", "UPI", "Cheque", "Card"].map((m) => <option key={m}>{m}</option>)}</select></Fld></div>
            )}
          </div>

          <div className="mt-3 rounded-lg bg-primary-subtle/40 px-3 py-2.5">
            <div className="flex items-center justify-between font-bold text-primary"><span>Total Amount to be Collected</span><span className="text-lg tabular-nums">{totalAmountToCollect.toFixed(2)}</span></div>
          </div>
        </SectionCard>

        <SectionCard icon={IndianRupee} title="Payment Collection" allowOverflow>
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-2xs font-semibold text-muted">Payment</label>
              <div className="inline-flex w-full overflow-hidden rounded-md border border-border text-2xs">
                {([["full", "Full Collection"], ["partial", "Partial Collection"], ["credit", "Credit Due"]] as const).map(([m, lbl]) => (
                  <button key={m} type="button" onClick={() => setPayCat(m)} className={cn("flex-1 px-2 py-1.5 font-semibold transition", payCat === m ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
                ))}
              </div>
            </div>
            {payCat !== "credit" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {!isSplit && <Fld label="Amount Received"><input type="number" value={payCat === "full" ? String(totalAmountToCollect) : amtPaid} readOnly={payCat === "full"} onChange={(e) => setAmtPaid(e.target.value)} placeholder="0.00" className={cn(inp, payCat === "full" && "bg-surface-2")} /></Fld>}
                <Fld label="Payment Mode"><select value={payMode} onChange={(e) => setPayMode(e.target.value)} className={inp}>{["Bank Transfer", "Cash", "UPI", "Cheque", "Card", "Split"].map((m) => <option key={m}>{m}</option>)}</select></Fld>
                {!isSplit && <div className="sm:col-span-2"><BankPicker mode={paidNow > 0 ? payMode : undefined} value={bank} onChange={setBank} required /></div>}
                {isSplit && (
                  <div className="sm:col-span-2 space-y-2">
                    {splitLines.map((l, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select value={l.mode} onChange={(e) => setSplitLines((p) => p.map((x, xi) => xi === i ? { ...x, mode: e.target.value } : x))} className={cn(inp, "flex-1")}>{["Cash", "Bank Transfer", "UPI", "Cheque", "Card"].map((m) => <option key={m}>{m}</option>)}</select>
                        <input type="number" value={l.amount} onChange={(e) => setSplitLines((p) => p.map((x, xi) => xi === i ? { ...x, amount: e.target.value } : x))} placeholder="0.00" className={cn(inp, "flex-1")} />
                        <button type="button" onClick={() => setSplitLines((p) => (p.length > 1 ? p.filter((_, xi) => xi !== i) : p))} className="shrink-0 text-subtle hover:text-danger"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setSplitLines((p) => [...p, { mode: "Cash", amount: "" }])} className="text-2xs font-semibold text-primary hover:underline">+ Add payment line</button>
                    <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-1.5 text-xs">
                      <span className="text-muted">Split Total {payCat === "full" ? `(must equal ${totalAmountToCollect.toFixed(2)})` : ""}</span>
                      <span className="font-semibold tabular-nums text-foreground">{splitTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-2 space-y-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs">
            <div className="flex items-center justify-between"><span className="text-muted">Total Amount to be Collected</span><span className="font-semibold tabular-nums text-foreground">{totalAmountToCollect.toFixed(2)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted">Balance Amount to be Collected</span><span className="font-semibold tabular-nums text-foreground">{Math.max(0, totalAmountToCollect - paidNow).toFixed(2)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted">Status</span><span className={cn("font-bold", payStatus === "Paid" ? "text-success" : payStatus === "Partial" ? "text-warning" : "text-danger")}>{payStatus}</span></div>
          </div>
        </SectionCard>
      </div>

      {fieldOn(SCREEN, "remarks") && (
      <SectionCard icon={PackagePlus} title="Remarks">
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} />
      </SectionCard>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button size="lg" onClick={save} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Create Dispatch</Button>
      </div>
      </>
      )}

      {/* Post-submit: complete + generate Delivery Challan / post the Sales Invoice, or continue later */}
      {createdId != null && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-6 w-6" /></span>
              <h2 className="text-sm font-bold text-foreground">Dispatch Created</h2>
              <p className="text-sm text-muted">Print the Delivery Challan, post the Sales Invoice, or continue with these steps later.</p>
            </div>
            <div className="flex flex-col gap-2 border-t border-border bg-surface-2 px-5 py-4">
              <Button size="md" onClick={handlePrintDc} disabled={actionBusy !== ""}>{actionBusy === "dc" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileOutput className="h-4 w-4" />} Complete &amp; Print Delivery Challan</Button>
              <Button size="md" variant="outline" onClick={handlePostInvoice} disabled={actionBusy !== ""}>{actionBusy === "invoice" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} Post Sales Invoice</Button>
              <Button variant="outline" size="md" onClick={() => router.push(`/warehouse/transfer/load-dispatch/${createdId}`)}>Do It Later</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const inpSm = "h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
function Row({ k, v }: { k: string; v: string }) { return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="text-foreground">{v}</span></div>; }
