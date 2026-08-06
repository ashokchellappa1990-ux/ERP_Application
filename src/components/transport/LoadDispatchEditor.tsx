"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Truck, FileText, Boxes, ScanLine, CheckCircle2, XCircle, PlayCircle,
  MessageSquare, PackageCheck, Wallet, Save, ClipboardList, Layers, Receipt, Printer, Scale, Ticket, IndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { LOAD_DISPATCH_DOC_TYPES } from "@/lib/contracts/loadDispatch";
import type { LoadDispatchDetail, LoadDispatchItemDto } from "@/lib/contracts/loadDispatch";
import type { TransportConfigData } from "@/lib/settings/transportConfigDefaults";
import { fieldOn, fieldMust } from "@/lib/settings/docFieldsConfig";
import { AccountingPostingDetails } from "@/components/transport/AccountingPostingDetails";

const SCREEN = "load_dispatch";
const req = (key: string) => (fieldMust(SCREEN, key) ? " *" : "");

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const STATUS_TONE: Record<string, Tone> = {
  Draft: "neutral", Ready: "primary", Loading: "warning", Dispatched: "info",
  "Delivery Challan Generated": "info", "Sales Invoice Posted": "success", Cancelled: "danger",
};
const STATUS_STEPS = ["Draft", "Ready", "Loading", "Dispatched", "Delivery Challan Generated", "Sales Invoice Posted"] as const;
const DOC_TYPE_LABEL: Record<string, string> = Object.fromEntries(LOAD_DISPATCH_DOC_TYPES.map((d) => [d.value, d.label]));
const EDITABLE_STATUSES = ["Draft", "Ready", "Loading"];

interface Opt { id: number; label: string }
interface EditableItem extends LoadDispatchItemDto { dispatchedQtyInput: string }

interface TransportCostState {
  transportCompanyId: number | ""; vehicleId: number | ""; distance: string;
  freightCharge: string; loadingCharge: string; unloadingCharge: string; fuelCharge: string; tollCharge: string;
  driverAllowance: string; helperAllowance: string; driverBatta: string; vehicleRent: string; transitPass: string;
  otherCharges: string; discount: string; gstAmount: string;
  remarks: string;
}
const EMPTY_TC: TransportCostState = {
  transportCompanyId: "", vehicleId: "", distance: "0",
  freightCharge: "0", loadingCharge: "0", unloadingCharge: "0", fuelCharge: "0", tollCharge: "0",
  driverAllowance: "0", helperAllowance: "0", driverBatta: "0", vehicleRent: "0", transitPass: "0",
  otherCharges: "0", discount: "0", gstAmount: "0", remarks: "",
};

export function LoadDispatchEditor({ id }: { id: number }) {
  const fmt = useFmt();
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<LoadDispatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<TransportConfigData | null>(null);

  const [companies, setCompanies] = useState<Opt[]>([]);
  const [vehicles, setVehicles] = useState<(Opt & { vehicleNo: string })[]>([]);
  const [routes, setRoutes] = useState<Opt[]>([]);
  const [bays, setBays] = useState<Opt[]>([]);

  // Section 3 — Transport Information. Auto-loaded from the linked Vehicle
  // Gate Entry (when vehicleGateEntryId is set) and shown read-only with a
  // "Modify" link to unlock, mirroring PreLoadingWeighmentEditor's pattern.
  // If there's no linked Gate Entry there's nothing auto-loaded to protect,
  // so the fields start unlocked.
  const [editingTransport, setEditingTransport] = useState(true);
  const [transportCompanyId, setTransportCompanyId] = useState<number | "">("");
  const [vehicleId, setVehicleId] = useState<number | "">("");
  const [vehicleType, setVehicleType] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [driverLicenseNo, setDriverLicenseNo] = useState("");
  const [helperName, setHelperName] = useState("");
  const [helperMobile, setHelperMobile] = useState("");
  const [routeId, setRouteId] = useState<number | "">("");
  const [sealNumber, setSealNumber] = useState("");

  // Loading Details — remaining loadDispatchUpdateInput fields (not
  // gate-entry-sourced, so always editable while the doc is Draft/Ready/Loading).
  const [loadingBayId, setLoadingBayId] = useState<number | "">("");
  const [supervisor, setSupervisor] = useState("");
  const [loadingStart, setLoadingStart] = useState("");
  const [loadingEnd, setLoadingEnd] = useState("");
  const [trailerNumber, setTrailerNumber] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [packages, setPackages] = useState("0");
  const [pallets, setPallets] = useState("0");
  const [remarks, setRemarks] = useState("");

  // Payment Details — Rent / Transit Pass Qty / Driver Batta mode stay
  // editable while the doc is still Draft/Ready/Loading (Driver Batta and
  // Transit Pass amounts themselves are always server-recomputed, never
  // accepted verbatim — same rule as at creation time).
  const [vehicleRentInput, setVehicleRentInput] = useState("0");
  const [transitPassQtyInput, setTransitPassQtyInput] = useState("0");
  const [driverBattaModeInput, setDriverBattaModeInput] = useState<"Adjustment" | "Payment">("Adjustment");

  const [items, setItems] = useState<EditableItem[]>([]);
  const [scanCode, setScanCode] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [highlightItemId, setHighlightItemId] = useState<number | null>(null);

  const [savingDraft, setSavingDraft] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [tc, setTc] = useState<TransportCostState>(EMPTY_TC);
  const [tcSaving, setTcSaving] = useState(false);

  // Weighment Details — read-only, sourced from the linked Vehicle Gate
  // Entry's Pre/Post-Loading Weighment records (same tables the physical
  // gate/weighbridge chain already writes to — nothing new is posted here).
  const [weighment, setWeighment] = useState<{ tare: number | null; gross: number | null; net: number | null; weighDate: string | null }>({ tare: null, gross: null, net: null, weighDate: null });
  // Blocks the whole page (not just the KPI tile) until the weighment lookup
  // — sourced from a linked Vehicle Gate Entry — has actually resolved, so the
  // page never briefly renders with a blank Weighment Details section.
  const [weighmentLoading, setWeighmentLoading] = useState(false);

  const applyDataToForm = useCallback((d: LoadDispatchDetail) => {
    setTransportCompanyId(d.transportCompanyId ?? "");
    setVehicleId(d.vehicleId ?? "");
    setVehicleType(d.vehicleType ?? "");
    setDriverName(d.driverName ?? "");
    setDriverMobile(d.driverMobile ?? "");
    setDriverLicenseNo(d.driverLicenseNo ?? "");
    setHelperName(d.helperName ?? "");
    setHelperMobile(d.helperMobile ?? "");
    setRouteId(d.routeId ?? "");
    setSealNumber(d.sealNumber ?? "");
    setEditingTransport(!d.vehicleGateEntryId);

    setLoadingBayId(d.loadingBayId ?? "");
    setSupervisor(d.supervisor ?? "");
    setLoadingStart(d.loadingStart ? d.loadingStart.slice(0, 16) : "");
    setLoadingEnd(d.loadingEnd ? d.loadingEnd.slice(0, 16) : "");
    setTrailerNumber(d.trailerNumber ?? "");
    setContainerNumber(d.containerNumber ?? "");
    setPackages(String(d.packages ?? 0));
    setPallets(String(d.pallets ?? 0));
    setRemarks(d.remarks ?? "");

    setVehicleRentInput(String(d.vehicleRent ?? 0));
    setTransitPassQtyInput(d.transitPassQty != null ? String(d.transitPassQty) : "0");
    setDriverBattaModeInput(d.driverBattaMode ?? "Adjustment");

    setItems(d.items.map((it) => ({ ...it, dispatchedQtyInput: String(it.dispatchedQty) })));
  }, []);

  const load = useCallback(async () => {
    const j = await fetch(`/api/warehouse/load-dispatch/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setData(j.data); applyDataToForm(j.data); }
    setLoading(false);
  }, [id, applyDataToForm]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const [co, ve, ro, ba, cfg] = await Promise.all([
        fetch("/api/transport/masters/transport-company?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/masters/route?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/masters/loading-bay?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/settings/dispatch-config", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ]);
      if (co.ok) setCompanies(co.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name })));
      if (ve.ok) setVehicles(ve.rows.map((x: { id: number; vehicleNo: string }) => ({ id: x.id, label: x.vehicleNo, vehicleNo: x.vehicleNo })));
      if (ro.ok) setRoutes(ro.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name })));
      if (ba.ok) setBays(ba.rows.map((x: { id: number; name: string }) => ({ id: x.id, label: x.name })));
      if (cfg.ok) setConfig(cfg.config);
    })();
  }, []);

  // Weighment Details — only if a Vehicle Gate Entry is linked.
  useEffect(() => {
    if (!data?.vehicleGateEntryId) return;
    const gateEntryId = data.vehicleGateEntryId;
    setWeighmentLoading(true);
    (async () => {
      try {
        const [preJ, postJ] = await Promise.all([
          fetch(`/api/transport/pre-weighment?gateEntryId=${gateEntryId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
          fetch(`/api/transport/post-weighment?gateEntryId=${gateEntryId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        ]);
        const pre = preJ.ok ? preJ.rows?.[0] : null;
        const post = postJ.ok ? postJ.rows?.[0] : null;
        setWeighment({
          tare: pre ? Number(pre.tareWeight) : (post ? Number(post.tareWeight) : null),
          gross: post ? Number(post.grossWeight) : null,
          net: post ? Number(post.netWeight) : null,
          weighDate: post?.weighDate ?? pre?.weighDate ?? null,
        });
      } catch { /* best effort */ } finally { setWeighmentLoading(false); }
    })();
  }, [data?.vehicleGateEntryId]);

  // Transport Cost — only relevant once the flag is known to be on.
  useEffect(() => {
    if (!config?.flags.enableTransportCost) return;
    (async () => {
      const j = await fetch(`/api/warehouse/load-dispatch/${id}/transport-cost`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok && j.data) {
        const r = j.data;
        setTc({
          transportCompanyId: r.transportCompanyId ?? "", vehicleId: r.vehicleId ?? "", distance: String(r.distance),
          freightCharge: String(r.freightCharge), loadingCharge: String(r.loadingCharge), unloadingCharge: String(r.unloadingCharge),
          fuelCharge: String(r.fuelCharge), tollCharge: String(r.tollCharge), driverAllowance: String(r.driverAllowance),
          helperAllowance: String(r.helperAllowance), driverBatta: String(r.driverBatta ?? 0), vehicleRent: String(r.vehicleRent ?? 0), transitPass: String(r.transitPass ?? 0),
          otherCharges: String(r.otherCharges), discount: String(r.discount),
          gstAmount: String(r.gstAmount), remarks: r.remarks ?? "",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.flags.enableTransportCost, id]);

  const canEdit = !!data && EDITABLE_STATUSES.includes(data.status);
  // Document Field Settings (Settings → Document Field Settings → Load &
  // Dispatch) — a SectionCard whose every field got disabled shouldn't
  // render as an empty shell.
  const transportInfoVisible = fieldOn(SCREEN, "transportCompany") || fieldOn(SCREEN, "vehicleType") || fieldOn(SCREEN, "route") || fieldOn(SCREEN, "sealNumber") || fieldOn(SCREEN, "trailerNumber") || fieldOn(SCREEN, "containerNumber");
  const driverInfoVisible = fieldOn(SCREEN, "driverName") || fieldOn(SCREEN, "driverMobile") || fieldOn(SCREEN, "driverLicenseNo") || fieldOn(SCREEN, "helperName") || fieldOn(SCREEN, "helperMobile");

  const itemErrors = useMemo(() => {
    const errs: Record<number, string> = {};
    for (const it of items) {
      const q = Number(it.dispatchedQtyInput);
      if (it.dispatchedQtyInput.trim() === "" || Number.isNaN(q) || q < 0) errs[it.id] = "Enter a valid quantity.";
      else if (q > it.allocatedQty + 0.001) errs[it.id] = "Cannot exceed the allocated quantity.";
    }
    return errs;
  }, [items]);
  const itemsValid = Object.keys(itemErrors).length === 0;

  function onItemQtyChange(itemId: number, value: string) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, dispatchedQtyInput: value } : it)));
  }

  async function scan() {
    if (!scanCode.trim()) return;
    setScanBusy(true);
    const j = await fetch(`/api/warehouse/load-dispatch/${id}/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: scanCode.trim() }) }).then((r) => r.json()).catch(() => ({}));
    setScanBusy(false);
    if (j?.ok && j.resolved) {
      setHighlightItemId(j.matchedItemId ?? null);
      toast.success(j.matchedItemId ? "Matched an item on this dispatch." : "Code resolved, but no matching item on this dispatch.");
    } else toast.error(j?.message || "Code not recognised.");
    setScanCode("");
  }

  async function saveDraft() {
    if (!itemsValid) { toast.error("Fix the highlighted item quantities before saving."); return; }
    setSavingDraft(true);
    const payload: Record<string, unknown> = {
      transportCompanyId: transportCompanyId || null, vehicleId: vehicleId || null, vehicleType: vehicleType || null,
      driverName: driverName || null, driverMobile: driverMobile || null, driverLicenseNo: driverLicenseNo || null,
      helperName: helperName || null, helperMobile: helperMobile || null, routeId: routeId || null, sealNumber: sealNumber || null,
      loadingBayId: loadingBayId || null, supervisor: supervisor || null,
      loadingStart: loadingStart || null, loadingEnd: loadingEnd || null,
      trailerNumber: trailerNumber || null, containerNumber: containerNumber || null,
      packages: Number(packages) || 0, pallets: Number(pallets) || 0, remarks: remarks || null,
      vehicleRent: Number(vehicleRentInput) || 0, transitPassQty: Math.max(0, Number(transitPassQtyInput) || 0), driverBattaMode: driverBattaModeInput,
      items: items.map((it) => ({
        productId: it.productId, productName: it.productName, sku: it.sku, uom: it.uom, batchNo: it.batchNo,
        mfgDate: it.mfgDate, expiryDate: it.expiryDate, serialNo: it.serialNo, allocationLotId: it.allocationLotId,
        allocatedQty: it.allocatedQty, dispatchedQty: Number(it.dispatchedQtyInput) || 0, rate: it.rate, qrCode: it.qrCode, remarks: it.remarks,
      })),
    };
    const res = await fetch(`/api/warehouse/load-dispatch/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.ok && config?.flags.enableTransportCost && config.flags.allowCostEditing) await saveTransportCost();
    setSavingDraft(false);
    if (res.ok && j.ok) { toast.success(j.message || "Saved."); await load(); }
    else toast.error(j.message || "Could not save.");
  }

  async function doAction(action: "start-loading" | "complete" | "cancel", remarksArg?: string) {
    setActionBusy(action);
    const j = await fetch(`/api/warehouse/load-dispatch/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, remarks: remarksArg }) }).then((r) => r.json()).catch(() => ({}));
    setActionBusy(null);
    if (j?.ok) { toast.success(j.message || "Done."); setCancelOpen(false); setCancelReason(""); await load(); }
    else toast.error(j?.message || "Action failed.");
  }

  async function doDeliveryChallan() {
    setActionBusy("delivery-challan");
    const j = await fetch(`/api/warehouse/load-dispatch/${id}/delivery-challan`, { method: "POST" }).then((r) => r.json()).catch(() => ({}));
    setActionBusy(null);
    if (j?.ok) {
      toast.success(j.invoiceNo ? `Delivery Challan generated — Sales Invoice ${j.invoiceNo} posted automatically.` : "Delivery Challan generated.");
      await load();
    } else toast.error(j?.message || "Could not generate the Delivery Challan.");
  }

  async function doPostInvoice() {
    setActionBusy("post-invoice");
    const j = await fetch(`/api/warehouse/load-dispatch/${id}/post-invoice`, { method: "POST" }).then((r) => r.json()).catch(() => ({}));
    setActionBusy(null);
    if (j?.ok) { toast.success(`Sales Invoice ${j.invoiceNo} posted.`); await load(); }
    else toast.error(j?.message || "Could not post the Sales Invoice.");
  }

  // DC / Weight Slip / Invoice — reviewed on an in-app preview page
  // (/warehouse/transfer/load-dispatch/print) before printing, same pattern
  // as the Pre Load Weight Slip (Token); see printPreview() below.
  function printPreview(kind: "invoice" | "weight-slip" | "dc") {
    router.push(`/warehouse/transfer/load-dispatch/print?id=${id}&kind=${kind}&next=${encodeURIComponent(`/warehouse/transfer/load-dispatch/${id}`)}`);
  }

  const itemTotals = useMemo(() => {
    let taxable = 0, tax = 0;
    for (const it of items) { taxable += it.taxableValue || 0; tax += it.taxAmount || 0; }
    return { taxable, tax, grandTotal: taxable + tax };
  }, [items]);

  const vehicleRentVal = data?.vehicleRent ?? 0;
  const transitPassAmountVal = data?.transitPassAmount ?? 0;
  const driverBattaAmountVal = data?.driverBattaAmount ?? 0;
  const preRoundInvoiceAmount = itemTotals.grandTotal + vehicleRentVal + transitPassAmountVal;
  const invoiceRoundOff = config?.flags.roundOffInvoiceTotal ? Math.round(preRoundInvoiceAmount / (Number(config.fields.roundOffNearest) || 10)) * (Number(config.fields.roundOffNearest) || 10) - preRoundInvoiceAmount : 0;
  const totalInvoiceAmount = preRoundInvoiceAmount + invoiceRoundOff;
  // Driver Batta always posts as "Payment" (full invoice collected from the
  // customer, business pays the driver separately) — Balance/Status work off
  // the full total; referenceAmountAfterBatta below is display-only.
  const totalAmountToCollect = totalInvoiceAmount;
  const referenceAmountAfterBatta = totalInvoiceAmount - driverBattaAmountVal;
  const amountCollected = data?.paymentAmount ?? 0;
  const balanceToCollect = Math.max(0, totalAmountToCollect - amountCollected);
  const payStatus = data?.paymentMode === "Credit" && amountCollected <= 0 ? "Credit" : amountCollected >= totalAmountToCollect - 0.01 ? "Paid" : amountCollected > 0 ? "Partial" : "Credit";

  // Driver Batta/Vehicle Rent/Transit Pass are deliberately excluded here —
  // those live on LoadDispatch itself (driverBattaAmountVal/vehicleRentVal/
  // transitPassAmountVal below are the authoritative source); the TransportCost
  // row's own same-named fields are legacy and would double-count/disagree.
  const tcTotal = useMemo(() => {
    const n = (v: string) => Number(v) || 0;
    return n(tc.freightCharge) + n(tc.loadingCharge) + n(tc.unloadingCharge) + n(tc.fuelCharge) + n(tc.tollCharge)
      + n(tc.driverAllowance) + n(tc.helperAllowance)
      + n(tc.otherCharges) - n(tc.discount) + n(tc.gstAmount);
  }, [tc]);

  async function saveTransportCost() {
    setTcSaving(true);
    const payload = {
      transportCompanyId: tc.transportCompanyId || null, vehicleId: tc.vehicleId || null, distance: Number(tc.distance) || 0,
      freightCharge: Number(tc.freightCharge) || 0, loadingCharge: Number(tc.loadingCharge) || 0, unloadingCharge: Number(tc.unloadingCharge) || 0,
      fuelCharge: Number(tc.fuelCharge) || 0, tollCharge: Number(tc.tollCharge) || 0, driverAllowance: Number(tc.driverAllowance) || 0,
      helperAllowance: Number(tc.helperAllowance) || 0, driverBatta: Number(tc.driverBatta) || 0, vehicleRent: Number(tc.vehicleRent) || 0, transitPass: Number(tc.transitPass) || 0,
      otherCharges: Number(tc.otherCharges) || 0, discount: Number(tc.discount) || 0,
      gstAmount: Number(tc.gstAmount) || 0, remarks: tc.remarks || null,
    };
    const res = await fetch(`/api/warehouse/load-dispatch/${id}/transport-cost`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
    setTcSaving(false);
    if (res.ok && j.ok) toast.success(j.message || "Transport cost saved.");
    else toast.error(j.message || "Could not save the transport cost.");
  }

  if (loading || weighmentLoading) return <div className="py-16"><AppLoader label="Loading dispatch…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Load & Dispatch not found. <Link href="/warehouse/transfer/load-dispatch" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const x = data;
  const cancellable = EDITABLE_STATUSES.includes(x.status);
  const showDeliveryChallan = x.status === "Dispatched" && x.docType === "Customer" && !x.deliveryChallanId;
  const showPostInvoice = !!x.deliveryChallanId && !x.saleId;
  const isCancelled = x.status === "Cancelled";

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/load-dispatch" className="hover:text-foreground">Load &amp; Dispatch</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{x.dispatchNo}</span></div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageCheck className="h-5 w-5 text-primary" /> {x.dispatchNo}</h1>
            <Badge tone={STATUS_TONE[x.status] ?? "neutral"}>{x.status}</Badge>
            <Badge tone="neutral">{DOC_TYPE_LABEL[x.docType] ?? x.docType}</Badge>
          </div>
          <p className="mt-1 text-xs text-subtle">{x.partyName || x.sourceRefNo || "—"}{x.warehouse ? ` · ${x.warehouse}` : ""} — {x.items.length} item(s), {fmt.qty(x.totalQty)} qty.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary" size="md"
            onClick={() => router.push(`/transport/pre-weighment/token?gateEntryId=${x.vehicleGateEntryId}&next=${encodeURIComponent(`/warehouse/transfer/load-dispatch/${id}`)}`)}
            disabled={!x.vehicleGateEntryId}
            title={x.vehicleGateEntryId ? "Preview & print the Pre Load Weight Slip" : "Available once a Vehicle Gate Entry is linked"}
          >
            <Ticket className="h-4 w-4" /> Print Pre Load
          </Button>
          <Button variant="secondary" size="md" onClick={() => printPreview("dc")} disabled={!x.deliveryChallanId} title={x.deliveryChallanId ? "Preview & print the Delivery Challan" : "Available once a Delivery Challan has been generated"}>
            <FileText className="h-4 w-4" /> Print DC
          </Button>
          <Button variant="accent" size="md" onClick={() => printPreview("weight-slip")} disabled={!x.vehicleGateEntryId} title={x.vehicleGateEntryId ? "Preview & print the Weight Slip" : "Available once a Vehicle Gate Entry is linked"}>
            <Scale className="h-4 w-4" /> Print Weight Slip
          </Button>
          <Button variant="primary" size="md" onClick={() => printPreview("invoice")} disabled={!x.saleId} title={x.saleId ? "Preview & print the Tax Invoice" : "Available once a Sales Invoice has been posted"}>
            <Printer className="h-4 w-4" /> Print Invoice
          </Button>
          <Link href="/warehouse/transfer/load-dispatch"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        </div>
      </div>

      <StatusTimeline status={x.status} />

      {/* Summary KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total Products" value={String(x.totalProducts)} icon={Boxes} />
        <Kpi label="Total Quantity" value={fmt.qty(x.totalQty)} icon={Layers} />
        <Kpi label="Total Value (Incl. GST)" value={fmt.money(itemTotals.grandTotal)} icon={Receipt} />
        <Kpi
          label="Net Weight"
          value={weighment.net != null ? `${weighment.net} kg` : "—"}
          icon={Scale}
          sub={weighment.tare != null || weighment.gross != null ? (
            <>
              {weighment.tare != null && <span>Empty {weighment.tare} kg</span>}
              {weighment.gross != null && <span>{weighment.tare != null ? " · " : ""}Post Load {weighment.gross} kg</span>}
            </>
          ) : undefined}
        />
      </div>

      {/* Section 1 — Dispatch Information */}
      <SectionCard icon={FileText} title="Dispatch Information">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KV k="Dispatch Number" v={x.dispatchNo} />
          <KV k="Dispatch Date" v={x.dispatchDate} />
          <KV k="Dispatch Type" v="" custom={<Badge tone="neutral">{DOC_TYPE_LABEL[x.docType] ?? x.docType}</Badge>} />
          <KV k="Reference Number" v={x.sourceRefNo ?? "—"} />
          <KV k="Warehouse" v={x.warehouse ?? "—"} />
          <KV k="Status" v="" custom={<Badge tone={STATUS_TONE[x.status] ?? "neutral"}>{x.status}</Badge>} />
          {x.saleId && (
            <>
              <KV k="Sale Type" v={x.saleType ?? "—"} />
              <KV
                k="Outstanding Balance"
                v=""
                custom={
                  x.saleOutstanding != null && x.saleOutstanding > 0.005
                    ? <span className="font-semibold text-danger">{fmt.money(x.saleOutstanding)}</span>
                    : <Badge tone="success">Fully Paid</Badge>
                }
              />
            </>
          )}
        </div>
      </SectionCard>

      {/* Section 2 — Customer / Destination (dynamic by docType) */}
      <SectionCard icon={Truck} title="Customer / Destination">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {x.docType === "Customer" && (
            <>
              <KV k="Customer" v={x.partyName ?? "—"} />
              <KV k="Delivery Address" v={x.deliveryAddress ?? "—"} />
            </>
          )}
          {x.docType === "StockTransfer" && (
            <>
              <KV k="Source Warehouse" v={x.warehouse ?? "—"} />
              <KV k="Destination Warehouse" v={x.destinationWarehouse ?? "—"} />
            </>
          )}
          {x.docType === "PurchaseReturn" && <KV k="Vendor" v={x.partyName ?? "—"} />}
          {!["Customer", "StockTransfer", "PurchaseReturn"].includes(x.docType) && <KV k="Party" v={x.partyName ?? "—"} />}
        </div>
      </SectionCard>

      {/* Product Load & Dispatch — right after Customer/Destination */}
      <SectionCard icon={Boxes} title="Product Load & Dispatch">
        {canEdit && (
          <div className="mb-3 rounded-xl border border-border bg-surface-2 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-subtle"><ScanLine className="h-3.5 w-3.5" /> Scan / Verify Item</p>
            <div className="flex items-center gap-2">
              <input value={scanCode} onChange={(e) => setScanCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") scan(); }} placeholder="Scan a barcode / QR code…" className="h-9 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none" />
              <Button size="md" onClick={scan} disabled={scanBusy}>{scanBusy ? "Checking…" : "Scan"}</Button>
            </div>
            <p className="mt-1.5 text-2xs text-subtle">Lookup only — scanning does not post or change quantities.</p>
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-3 py-3">Item</th><th className="px-3 py-3">Batch / Mfg / Exp</th>
                <th className="px-3 py-3 text-right">Allocated Qty</th><th className="px-3 py-3 text-right">Dispatch Qty</th><th className="px-3 py-3 text-right">Pending Qty</th>
                <th className="px-3 py-3 text-right">Rate</th><th className="px-3 py-3 text-right">Disc %</th>
                <th className="px-3 py-3 text-right">Taxable</th><th className="px-3 py-3 text-right">Tax %</th>
                <th className="px-3 py-3 text-right">Tax Amt</th><th className="px-3 py-3 text-right">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const pending = Math.max(0, it.allocatedQty - (Number(it.dispatchedQtyInput) || 0));
                const err = itemErrors[it.id];
                return (
                  <tr key={it.id} className={cn("border-b border-border last:border-0", highlightItemId === it.id && "bg-success-subtle/40")}>
                    <td className="px-3 py-3"><div className="font-medium text-foreground">{it.productName}</div><div className="font-mono text-2xs text-subtle">{it.sku || "—"}{it.uom ? ` · ${it.uom}` : ""}</div></td>
                    <td className="px-3 py-3 text-2xs text-muted">
                      {it.batchNo || "—"}
                      {(it.mfgDate || it.expiryDate) && <div className="text-2xs text-subtle">{it.mfgDate ?? "—"} → {it.expiryDate ?? "—"}</div>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{fmt.qty(it.allocatedQty)}</td>
                    <td className="px-3 py-3 text-right">
                      {canEdit ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <input type="number" min={0} step="any" value={it.dispatchedQtyInput} onChange={(e) => onItemQtyChange(it.id, e.target.value)} className={cn("h-8 w-24 rounded-md border bg-surface px-2 text-right text-sm text-foreground focus:outline-none", err ? "border-danger focus:border-danger" : "border-border-strong focus:border-primary")} />
                          {err && <span className="text-2xs text-danger">{err}</span>}
                        </div>
                      ) : <span className="tabular-nums text-foreground">{fmt.qty(it.dispatchedQty)}</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{fmt.qty(pending)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{it.rate != null ? fmt.money(it.rate) : "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{it.discPct != null ? `${it.discPct}%` : "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{fmt.money(it.taxableValue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{it.taxPct != null ? `${it.taxPct}%` : "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{fmt.money(it.taxAmount)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-foreground">{fmt.money(it.value)}</td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-subtle">No items on this dispatch.</td></tr>}
            </tbody>
          </table>
        </div>

        {items.length > 0 && (
          <div className="mt-3 flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted">Total Taxable Value</span><span className="text-foreground">{fmt.money(itemTotals.taxable)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted">Total Tax</span><span className="text-foreground">{fmt.money(itemTotals.tax)}</span></div>
              <div className="my-1 h-px bg-border" />
              <div className="flex items-center justify-between text-base font-bold text-foreground"><span>Grand Total</span><span>{fmt.money(itemTotals.grandTotal)}</span></div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Transport Information + Driver Information — paired side by side, matching the add page. */}
      {(transportInfoVisible || driverInfoVisible || (x.vehicleGateEntryId && fieldOn(SCREEN, "weighmentManagement"))) && (
      <div className="grid gap-4 lg:grid-cols-2">
        {transportInfoVisible && (
        <SectionCard
          icon={Truck}
          title="Transport Information"
          action={x.vehicleGateEntryId && !editingTransport && canEdit ? <button type="button" onClick={() => setEditingTransport(true)} className="text-2xs font-semibold text-primary hover:underline">Modify</button> : undefined}
        >
          {x.vehicleGateEntryId && <p className="mb-3 text-2xs text-subtle">Auto-loaded from the linked Vehicle Gate Entry. Click Modify to edit.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {fieldOn(SCREEN, "transportCompany") && (
              <Fld label={`Transport Company${req("transportCompany")}`}>
                <select value={transportCompanyId} disabled={!canEdit || !editingTransport} onChange={(e) => setTransportCompanyId(e.target.value ? Number(e.target.value) : "")} className={inp}>
                  <option value="">—</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Fld>
            )}
            <Fld label="Vehicle Number">
              <select value={vehicleId} disabled={!canEdit || !editingTransport} onChange={(e) => setVehicleId(e.target.value ? Number(e.target.value) : "")} className={inp}>
                <option value="">—</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}
              </select>
            </Fld>
            {fieldOn(SCREEN, "vehicleType") && <Fld label={`Vehicle Type${req("vehicleType")}`}><input value={vehicleType} disabled={!canEdit || !editingTransport} onChange={(e) => setVehicleType(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "route") && (
              <Fld label="Route">
                <select value={routeId} disabled={!canEdit || !editingTransport} onChange={(e) => setRouteId(e.target.value ? Number(e.target.value) : "")} className={inp}>
                  <option value="">—</option>
                  {routes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </Fld>
            )}
            {fieldOn(SCREEN, "trailerNumber") && <Fld label="Trailer Number"><input value={trailerNumber} disabled={!canEdit} onChange={(e) => setTrailerNumber(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "containerNumber") && <Fld label="Container Number"><input value={containerNumber} disabled={!canEdit} onChange={(e) => setContainerNumber(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "sealNumber") && <Fld label="Seal Number"><input value={sealNumber} disabled={!canEdit || !editingTransport} onChange={(e) => setSealNumber(e.target.value)} className={inp} /></Fld>}
          </div>
        </SectionCard>
        )}

        {driverInfoVisible && (
        <SectionCard icon={ClipboardList} title="Driver Information">
          {x.vehicleGateEntryId && <p className="mb-3 text-2xs text-subtle">Auto-loaded from the linked Vehicle Gate Entry. Click Modify (Transport Information) to edit.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {fieldOn(SCREEN, "driverName") && <Fld label="Driver Name"><input value={driverName} disabled={!canEdit || !editingTransport} onChange={(e) => setDriverName(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "driverMobile") && <Fld label={`Driver Mobile${req("driverMobile")}`}><input value={driverMobile} disabled={!canEdit || !editingTransport} onChange={(e) => setDriverMobile(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "driverLicenseNo") && <Fld label={`License Number${req("driverLicenseNo")}`}><input value={driverLicenseNo} disabled={!canEdit || !editingTransport} onChange={(e) => setDriverLicenseNo(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "helperName") && <Fld label="Helper Name"><input value={helperName} disabled={!canEdit || !editingTransport} onChange={(e) => setHelperName(e.target.value)} className={inp} /></Fld>}
            {fieldOn(SCREEN, "helperMobile") && <Fld label="Helper Mobile"><input value={helperMobile} disabled={!canEdit || !editingTransport} onChange={(e) => setHelperMobile(e.target.value)} className={inp} /></Fld>}
          </div>
        </SectionCard>
        )}

        {/* Weighment Details — read-only, from the linked Vehicle Gate Entry's
            Pre/Post-Loading Weighment. Placed alongside Transport/Driver
            Information so it lines up in the same row rather than sitting
            below as its own full-width block. */}
        {x.vehicleGateEntryId && fieldOn(SCREEN, "weighmentManagement") && (
          <SectionCard icon={Scale} title="Weighment Details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Fld label="Tare Weight (Empty, In Kgs)"><input readOnly value={weighment.tare != null ? String(weighment.tare) : "Not yet weighed"} className={cn(inp, "cursor-not-allowed bg-surface-2")} /></Fld>
              <Fld label="Gross Weight (Post Load, In Kgs)"><input readOnly value={weighment.gross != null ? String(weighment.gross) : "Not yet weighed"} className={cn(inp, "cursor-not-allowed bg-surface-2")} /></Fld>
              <Fld label="Net Weight (In Kgs)"><input readOnly value={weighment.net != null ? String(weighment.net) : "—"} className={cn(inp, "cursor-not-allowed bg-surface-2 font-semibold text-foreground")} /></Fld>
            </div>
            {weighment.gross == null && (
              <p className="mt-2 text-2xs text-subtle">Post-Loading weight not captured yet — record it from Transport &amp; Vehicle Operations → Post Loading Weighment.</p>
            )}
          </SectionCard>
        )}
      </div>
      )}

      {/* Transport Cost / Payment Details / Payment Collection — aligned in
          one row, matching the Direct Customer Dispatch create page's layout. */}
      <div className="grid gap-4 lg:grid-cols-3">
        {config?.flags.enableTransportCost && fieldOn(SCREEN, "transportCost") && (
          <SectionCard icon={Wallet} title="Transport Cost" allowOverflow>
            <div className="grid gap-3 sm:grid-cols-2">
              {fieldOn(SCREEN, "freightCharge") && <Fld label="Freight Charge"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.freightCharge} onChange={(e) => setTc((p) => ({ ...p, freightCharge: e.target.value }))} className={inp} /></Fld>}
              {fieldOn(SCREEN, "loadingCharge") && <Fld label="Loading Charge"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.loadingCharge} onChange={(e) => setTc((p) => ({ ...p, loadingCharge: e.target.value }))} className={inp} /></Fld>}
              {fieldOn(SCREEN, "unloadingCharge") && <Fld label="Unloading Charge"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.unloadingCharge} onChange={(e) => setTc((p) => ({ ...p, unloadingCharge: e.target.value }))} className={inp} /></Fld>}
              {fieldOn(SCREEN, "fuelCharge") && <Fld label="Fuel Charge"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.fuelCharge} onChange={(e) => setTc((p) => ({ ...p, fuelCharge: e.target.value }))} className={inp} /></Fld>}
              {fieldOn(SCREEN, "tollCharge") && <Fld label="Toll Charge"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.tollCharge} onChange={(e) => setTc((p) => ({ ...p, tollCharge: e.target.value }))} className={inp} /></Fld>}
              {fieldOn(SCREEN, "driverAllowance") && <Fld label="Driver Allowance"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.driverAllowance} onChange={(e) => setTc((p) => ({ ...p, driverAllowance: e.target.value }))} className={inp} /></Fld>}
              {fieldOn(SCREEN, "helperAllowance") && <Fld label="Helper Allowance"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.helperAllowance} onChange={(e) => setTc((p) => ({ ...p, helperAllowance: e.target.value }))} className={inp} /></Fld>}
              {fieldOn(SCREEN, "driverBatta") && <Fld label="Driver Batta (auto)"><input readOnly value={`₹${driverBattaAmountVal.toFixed(2)}`} className={cn(inp, "bg-surface-2 font-semibold text-foreground")} /></Fld>}
              {fieldOn(SCREEN, "vehicleRent") && <Fld label="Vehicle Rent"><input readOnly value={`₹${vehicleRentVal.toFixed(2)}`} className={cn(inp, "bg-surface-2 font-semibold text-foreground")} /></Fld>}
              {fieldOn(SCREEN, "transitPass") && <Fld label="Transit Pass (auto)"><input readOnly value={`₹${transitPassAmountVal.toFixed(2)}`} className={cn(inp, "bg-surface-2 font-semibold text-foreground")} /></Fld>}
              {fieldOn(SCREEN, "otherTransportCharges") && <Fld label="Other Charges"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.otherCharges} onChange={(e) => setTc((p) => ({ ...p, otherCharges: e.target.value }))} className={inp} /></Fld>}
              {fieldOn(SCREEN, "transportDiscount") && <Fld label="Discount"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.discount} onChange={(e) => setTc((p) => ({ ...p, discount: e.target.value }))} className={inp} /></Fld>}
              {fieldOn(SCREEN, "transportGst") && <Fld label="GST Amount"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.gstAmount} onChange={(e) => setTc((p) => ({ ...p, gstAmount: e.target.value }))} className={inp} /></Fld>}
              <Fld label="Total Transport Cost"><input value={fmt.money(tcTotal + driverBattaAmountVal + vehicleRentVal + transitPassAmountVal)} disabled className={cn(inp, "font-semibold text-foreground")} /></Fld>
            </div>
            {config.flags.allowCostEditing && <p className="mt-2 text-2xs text-subtle">Saves together with Save Draft below.</p>}
          </SectionCard>
        )}

        <SectionCard icon={IndianRupee} title="Payment Details" allowOverflow>
          <div className="space-y-2 text-base">
            <Row k="Total Material Value" v={itemTotals.taxable.toFixed(2)} big money />
            <Row k="Total Tax Value" v={itemTotals.tax.toFixed(2)} big money />
            {canEdit ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-base text-muted">Rent (Amount to be Recovered)</span>
                <input type="number" min={0} value={vehicleRentInput} onChange={(e) => setVehicleRentInput(e.target.value)} className={cn(inp, "h-8 w-28 text-right")} />
              </div>
            ) : (
              <Row k="Rent (Amount to be Recovered)" v={vehicleRentVal.toFixed(2)} big money />
            )}
            <Row k="Transit Pass Amount" v={transitPassAmountVal.toFixed(2)} big money />
            {canEdit ? (
              <div className="flex items-center justify-between gap-3">
                <span className="shrink-0 text-2xs text-subtle">Transit Pass Qty (Ton)</span>
                <input type="number" min={0} step="0.001" value={transitPassQtyInput} onChange={(e) => setTransitPassQtyInput(e.target.value)} className={cn(inp, "h-8 w-28 text-right")} />
              </div>
            ) : (
              x.transitPassQty != null && <p className="text-2xs text-subtle">Transit Pass Qty: {x.transitPassQty.toFixed(3)} Ton</p>
            )}
            {canEdit && <p className="text-2xs text-subtle">Rent / Transit Pass Qty save with Save Draft below — Driver Batta &amp; Transit Pass Amount are always recalculated server-side.</p>}
            <div className="my-1 h-px bg-border" />
            <Row k="Total" v={preRoundInvoiceAmount.toFixed(2)} big money />
            {invoiceRoundOff !== 0 && <Row k="Round Off" v={`${invoiceRoundOff > 0 ? "+" : ""}${invoiceRoundOff.toFixed(2)}`} money />}
            <div className="flex items-center justify-between text-lg font-bold text-foreground"><span>Total Invoice Amount</span><span>₹{totalInvoiceAmount.toFixed(2)}</span></div>
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-foreground">Driver Batta Amount</p>
                <p className="text-2xs text-subtle">{x.driverBattaMode ?? "—"} mode</p>
              </div>
              <span className="text-lg font-bold tabular-nums text-foreground">₹{driverBattaAmountVal.toFixed(2)}</span>
            </div>
            {canEdit && (
              <div className="mt-2 inline-flex w-full overflow-hidden rounded-md border border-border text-2xs">
                {([["Adjustment", "Adjustment"], ["Payment", "Payment"]] as const).map(([m, lbl]) => (
                  <button key={m} type="button" onClick={() => setDriverBattaModeInput(m)} className={cn("flex-1 px-2 py-1.5 font-semibold transition", driverBattaModeInput === m ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
                ))}
              </div>
            )}
            <p className="mt-1 text-2xs text-subtle">
              {x.driverBattaMode === "Adjustment"
                ? "Netted out of what's collected from the customer — the driver keeps this directly."
                : "Full invoice amount is collected from the customer; the business pays the driver separately."}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-warning-subtle px-3 py-2 text-sm"><span className="font-medium text-foreground">Reference Only— Amount If Batta Netted Out</span><span className="text-lg font-bold tabular-nums text-foreground">₹{referenceAmountAfterBatta.toFixed(2)}</span></div>
          </div>

          <div className="mt-3 rounded-lg bg-primary-subtle/40 px-3 py-2.5">
            <div className="flex items-center justify-between text-lg font-bold text-primary"><span>Total Amount to be Collected</span><span className="tabular-nums">₹{totalAmountToCollect.toFixed(2)}</span></div>
          </div>
        </SectionCard>

        <SectionCard icon={IndianRupee} title="Payment Collection" allowOverflow>
          <div className="space-y-2">
            <Row k="Payment Type" v={x.paymentMode ?? "—"} />
            <Row k="Amount Collected" v={amountCollected.toFixed(2)} money />
            {Array.isArray(x.paymentSplits) && x.paymentSplits.length > 0 ? (
              <div className="space-y-1.5 rounded-md border border-border p-2">
                <p className="text-2xs font-semibold uppercase tracking-wide text-subtle">Split Payment</p>
                {x.paymentSplits.map((l, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted">{l.mode}{l.reference ? ` · ${l.reference}` : ""}</span>
                    <span className="font-semibold tabular-nums text-foreground">₹{Number(l.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <Row k="Payment Mode" v={x.paymentMethod ?? "—"} />
                {x.bankName && <Row k="Bank" v={`${x.bankName}${x.bankAccount ? ` · ${x.bankAccount}` : ""}`} />}
              </>
            )}
          </div>
          <div className="mt-2 space-y-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs">
            <div className="flex items-center justify-between"><span className="text-muted">Total Amount to be Collected</span><span className="font-semibold tabular-nums text-foreground">₹{totalAmountToCollect.toFixed(2)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted">Balance Amount to be Collected</span><span className="font-semibold tabular-nums text-foreground">₹{balanceToCollect.toFixed(2)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted">Status</span><span className={cn("font-bold", payStatus === "Paid" ? "text-success" : payStatus === "Partial" ? "text-warning" : "text-danger")}>{payStatus}</span></div>
          </div>
        </SectionCard>
      </div>

      <AccountingPostingDetails
        taxableValue={itemTotals.taxable} taxTotal={itemTotals.tax} vehicleRent={vehicleRentVal} transitPassAmount={transitPassAmountVal}
        driverBattaAmount={driverBattaAmountVal} driverBattaMode={x.driverBattaMode}
        roundOff={invoiceRoundOff}
      />

      {((x.remarks && fieldOn(SCREEN, "remarks")) || x.cancelReason) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {x.remarks && fieldOn(SCREEN, "remarks") && <NoteCard title="Remarks" body={x.remarks} />}
          {x.cancelReason && <NoteCard title="Cancellation Reason" body={x.cancelReason} />}
        </div>
      )}

      {cancelOpen && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><XCircle className="h-4 w-4 text-danger" /> Cancel this Load &amp; Dispatch</div>
          <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle"><MessageSquare className="h-3 w-3" /> Reason</label>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => setCancelOpen(false)} disabled={actionBusy === "cancel"}>Dismiss</Button>
            <Button variant="danger" size="md" onClick={() => doAction("cancel", cancelReason.trim() || undefined)} disabled={actionBusy === "cancel"}><CheckCircle2 className="h-4 w-4" /> {actionBusy === "cancel" ? "Working…" : "Confirm Cancel"}</Button>
          </div>
        </div>
      )}

      {/* Sticky bottom action bar */}
      {!isCancelled && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] backdrop-blur lg:pl-[calc(var(--sidebar-w,0px)+1rem)]">
          <div className="mx-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            {canEdit && <Button variant="outline" size="md" onClick={saveDraft} disabled={savingDraft || !itemsValid}><Save className="h-4 w-4" /> {savingDraft ? "Saving…" : "Save Draft"}</Button>}
            {(x.status === "Draft" || x.status === "Ready") && <Button variant="secondary" size="md" onClick={() => doAction("start-loading")} disabled={!!actionBusy}><PlayCircle className="h-4 w-4" /> {actionBusy === "start-loading" ? "Working…" : "Start Loading"}</Button>}
            {canEdit && <Button size="md" onClick={() => doAction("complete")} disabled={!!actionBusy || !itemsValid}><CheckCircle2 className="h-4 w-4" /> {actionBusy === "complete" ? "Working…" : "Complete Load & Dispatch"}</Button>}
            {cancellable && !cancelOpen && <Button variant="danger" size="md" onClick={() => setCancelOpen(true)} disabled={!!actionBusy}><XCircle className="h-4 w-4" /> Cancel</Button>}
            {showDeliveryChallan && <Button size="md" onClick={doDeliveryChallan} disabled={!!actionBusy}><FileText className="h-4 w-4" /> {actionBusy === "delivery-challan" ? "Working…" : "Delivery Challan"}</Button>}
            {showPostInvoice && <Button size="md" onClick={doPostInvoice} disabled={!!actionBusy}><Receipt className="h-4 w-4" /> {actionBusy === "post-invoice" ? "Working…" : "Post Sales Invoice"}</Button>}
          </div>
        </div>
      )}

      {(actionBusy === "delivery-challan" || actionBusy === "post-invoice") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <AppLoader label={actionBusy === "delivery-challan" ? "Generating Delivery Challan…" : "Posting Sales Invoice…"} />
        </div>
      )}
    </div>
  );
}

function StatusTimeline({ status }: { status: string }) {
  if (status === "Cancelled") {
    return <div className="rounded-2xl border border-danger/40 bg-danger-subtle px-4 py-3 text-sm font-semibold text-danger">Cancelled</div>;
  }
  const idx = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);
  return (
    <div className="flex items-center overflow-x-auto rounded-2xl border border-border bg-card p-3 shadow-sm">
      {STATUS_STEPS.map((s, i) => (
        <div key={s} className="flex flex-1 items-center last:flex-none">
          <div className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-2xs font-semibold", i === idx ? "bg-primary text-white" : i < idx ? "bg-success-subtle text-success" : "bg-surface-2 text-subtle")}>
            {s}
          </div>
          {i < STATUS_STEPS.length - 1 && <div className={cn("mx-1.5 h-0.5 flex-1", i < idx ? "bg-success" : "bg-border")} />}
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, sub }: { label: string; value: string; icon: typeof Boxes; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-subtle"><Icon className="h-3.5 w-3.5 text-primary" /> {label}</div>
      <div className="text-lg font-bold tabular-nums text-foreground">{value}</div>
      {sub && <div className="mt-0.5 flex flex-wrap gap-x-1 text-2xs text-subtle">{sub}</div>}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
function KV({ k, v, strong, custom }: { k: string; v: string; strong?: boolean; custom?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-subtle">{k}</div>
      {custom ?? <div className={cn("text-sm", strong ? "font-bold text-foreground" : "font-medium text-foreground")}>{v || "—"}</div>}
    </div>
  );
}
function Row({ k, v, big, money }: { k: string; v: string; big?: boolean; money?: boolean }) {
  // Keeps a leading sign (Round Off's "+") ahead of the ₹ symbol, not in front of it.
  const sign = money && v.startsWith("+") ? "+" : "";
  const amount = money ? v.slice(sign.length) : v;
  return <div className="flex items-center justify-between"><span className={cn("text-muted", big && "text-base")}>{k}</span><span className={cn("text-foreground", big ? "text-base font-semibold" : "")}>{money ? `${sign}₹${amount}` : amount}</span></div>;
}
function NoteCard({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">{title}</p><p className="whitespace-pre-line text-xs text-muted">{body}</p></div>;
}
