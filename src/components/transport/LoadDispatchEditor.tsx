"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Truck, FileText, Boxes, ScanLine, CheckCircle2, XCircle, PlayCircle,
  MessageSquare, PackageCheck, Wallet, Save, ClipboardList, Layers, Receipt, Printer, Scale,
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
import { buildTaxInvoiceHtml, type TaxInvoiceData } from "@/lib/print/taxInvoiceHtml";
import { buildWeightSlipHtml, type WeightSlipData } from "@/lib/print/weightSlipHtml";
import { DEFAULT_RECEIPT } from "@/lib/settings/receiptTemplate";

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
  driverAllowance: string; helperAllowance: string; otherCharges: string; discount: string; gstAmount: string;
  remarks: string;
}
const EMPTY_TC: TransportCostState = {
  transportCompanyId: "", vehicleId: "", distance: "0",
  freightCharge: "0", loadingCharge: "0", unloadingCharge: "0", fuelCharge: "0", tollCharge: "0",
  driverAllowance: "0", helperAllowance: "0", otherCharges: "0", discount: "0", gstAmount: "0", remarks: "",
};

export function LoadDispatchEditor({ id }: { id: number }) {
  const fmt = useFmt();
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

  const [items, setItems] = useState<EditableItem[]>([]);
  const [scanCode, setScanCode] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [highlightItemId, setHighlightItemId] = useState<number | null>(null);

  const [savingDraft, setSavingDraft] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [printBusy, setPrintBusy] = useState<"invoice" | "weight-slip" | "dc" | null>(null);
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
          helperAllowance: String(r.helperAllowance), otherCharges: String(r.otherCharges), discount: String(r.discount),
          gstAmount: String(r.gstAmount), remarks: r.remarks ?? "",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.flags.enableTransportCost, id]);

  const canEdit = !!data && EDITABLE_STATUSES.includes(data.status);

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
      items: items.map((it) => ({
        productId: it.productId, productName: it.productName, sku: it.sku, uom: it.uom, batchNo: it.batchNo,
        mfgDate: it.mfgDate, expiryDate: it.expiryDate, serialNo: it.serialNo, allocationLotId: it.allocationLotId,
        allocatedQty: it.allocatedQty, dispatchedQty: Number(it.dispatchedQtyInput) || 0, rate: it.rate, qrCode: it.qrCode, remarks: it.remarks,
      })),
    };
    const res = await fetch(`/api/warehouse/load-dispatch/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
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

  // Template 2 Tax Invoice + Weight Slip — printed straight from this view,
  // reading the same data (Sale + Vehicle Gate Entry + weighments + transport
  // cost) assembled server-side by the print-data route. Both templates' saved
  // title/footerNote (Settings → Invoice Template) are fetched alongside.
  async function printDocument(kind: "invoice" | "weight-slip" | "dc") {
    setPrintBusy(kind);
    try {
      const [dataRes, tplRes] = await Promise.all([
        fetch(`/api/warehouse/load-dispatch/${id}/print-data`, { cache: "no-store" }).then((r) => r.json()),
        kind === "dc" ? Promise.resolve(null) : fetch(`/api/settings/invoice-template?type=${kind === "invoice" ? "B2B_T2" : "WEIGHT_SLIP"}`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (!dataRes?.ok) { toast.error(dataRes?.message || "Could not load print data."); return; }
      const tpl = tplRes?.ok ? { title: tplRes.template.title, footerNote: tplRes.template.footerNote } : DEFAULT_RECEIPT;
      const html = kind === "invoice"
        ? (dataRes.taxInvoice ? buildTaxInvoiceHtml(dataRes.taxInvoice as TaxInvoiceData, tpl) : null)
        : kind === "dc"
        ? (dataRes.deliveryNote ? buildTaxInvoiceHtml(dataRes.deliveryNote as TaxInvoiceData, { title: "Delivery Note", footerNote: DEFAULT_RECEIPT.footerNote }) : null)
        : (dataRes.weightSlip ? buildWeightSlipHtml(dataRes.weightSlip as WeightSlipData, tpl) : null);
      if (!html) { toast.error(kind === "invoice" ? "No Sales Invoice has been posted for this dispatch yet." : kind === "dc" ? "No Delivery Challan has been generated for this dispatch yet." : "No Vehicle Gate Entry / weighment is linked to this dispatch."); return; }
      const w = window.open("", "_blank", "width=900,height=800");
      if (!w) return;
      w.document.write(html); w.document.close();
    } catch { toast.error("Could not prepare the document — please try again."); }
    finally { setPrintBusy(null); }
  }

  const itemTotals = useMemo(() => {
    let taxable = 0, tax = 0;
    for (const it of items) { taxable += it.taxableValue || 0; tax += it.taxAmount || 0; }
    return { taxable, tax, grandTotal: taxable + tax };
  }, [items]);

  const tcTotal = useMemo(() => {
    const n = (v: string) => Number(v) || 0;
    return n(tc.freightCharge) + n(tc.loadingCharge) + n(tc.unloadingCharge) + n(tc.fuelCharge) + n(tc.tollCharge)
      + n(tc.driverAllowance) + n(tc.helperAllowance) + n(tc.otherCharges) - n(tc.discount) + n(tc.gstAmount);
  }, [tc]);

  async function saveTransportCost() {
    setTcSaving(true);
    const payload = {
      transportCompanyId: tc.transportCompanyId || null, vehicleId: tc.vehicleId || null, distance: Number(tc.distance) || 0,
      freightCharge: Number(tc.freightCharge) || 0, loadingCharge: Number(tc.loadingCharge) || 0, unloadingCharge: Number(tc.unloadingCharge) || 0,
      fuelCharge: Number(tc.fuelCharge) || 0, tollCharge: Number(tc.tollCharge) || 0, driverAllowance: Number(tc.driverAllowance) || 0,
      helperAllowance: Number(tc.helperAllowance) || 0, otherCharges: Number(tc.otherCharges) || 0, discount: Number(tc.discount) || 0,
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
          <Button variant="secondary" size="md" onClick={() => printDocument("dc")} disabled={printBusy != null || !x.deliveryChallanId} title={x.deliveryChallanId ? "Print the Delivery Challan" : "Available once a Delivery Challan has been generated"}>
            <FileText className="h-4 w-4" /> {printBusy === "dc" ? "Preparing…" : "Print DC"}
          </Button>
          <Button variant="accent" size="md" onClick={() => printDocument("weight-slip")} disabled={printBusy != null || !x.vehicleGateEntryId} title={x.vehicleGateEntryId ? "Print the Weight Slip" : "Available once a Vehicle Gate Entry is linked"}>
            <Scale className="h-4 w-4" /> {printBusy === "weight-slip" ? "Preparing…" : "Print Weight Slip"}
          </Button>
          <Button variant="primary" size="md" onClick={() => printDocument("invoice")} disabled={printBusy != null || !x.saleId} title={x.saleId ? "Print the Tax Invoice (Template 2)" : "Available once a Sales Invoice has been posted"}>
            <Printer className="h-4 w-4" /> {printBusy === "invoice" ? "Preparing…" : "Print Invoice"}
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
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          icon={Truck}
          title="Transport Information"
          action={x.vehicleGateEntryId && !editingTransport && canEdit ? <button type="button" onClick={() => setEditingTransport(true)} className="text-2xs font-semibold text-primary hover:underline">Modify</button> : undefined}
        >
          {x.vehicleGateEntryId && <p className="mb-3 text-2xs text-subtle">Auto-loaded from the linked Vehicle Gate Entry. Click Modify to edit.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Fld label="Transport Company">
              <select value={transportCompanyId} disabled={!canEdit || !editingTransport} onChange={(e) => setTransportCompanyId(e.target.value ? Number(e.target.value) : "")} className={cn(inp, (!canEdit || !editingTransport) && "text-subtle")}>
                <option value="">—</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Fld>
            <Fld label="Vehicle Number">
              <select value={vehicleId} disabled={!canEdit || !editingTransport} onChange={(e) => setVehicleId(e.target.value ? Number(e.target.value) : "")} className={cn(inp, (!canEdit || !editingTransport) && "text-subtle")}>
                <option value="">—</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}
              </select>
            </Fld>
            <Fld label="Vehicle Type"><input value={vehicleType} disabled={!canEdit || !editingTransport} onChange={(e) => setVehicleType(e.target.value)} className={cn(inp, (!canEdit || !editingTransport) && "text-subtle")} /></Fld>
            <Fld label="Route">
              <select value={routeId} disabled={!canEdit || !editingTransport} onChange={(e) => setRouteId(e.target.value ? Number(e.target.value) : "")} className={cn(inp, (!canEdit || !editingTransport) && "text-subtle")}>
                <option value="">—</option>
                {routes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </Fld>
            <Fld label="Trailer Number"><input value={trailerNumber} disabled={!canEdit} onChange={(e) => setTrailerNumber(e.target.value)} className={cn(inp, !canEdit && "text-subtle")} /></Fld>
            <Fld label="Container Number"><input value={containerNumber} disabled={!canEdit} onChange={(e) => setContainerNumber(e.target.value)} className={cn(inp, !canEdit && "text-subtle")} /></Fld>
            <Fld label="Seal Number"><input value={sealNumber} disabled={!canEdit || !editingTransport} onChange={(e) => setSealNumber(e.target.value)} className={cn(inp, (!canEdit || !editingTransport) && "text-subtle")} /></Fld>
          </div>
        </SectionCard>

        <SectionCard icon={ClipboardList} title="Driver Information">
          {x.vehicleGateEntryId && <p className="mb-3 text-2xs text-subtle">Auto-loaded from the linked Vehicle Gate Entry. Click Modify (Transport Information) to edit.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Fld label="Driver Name"><input value={driverName} disabled={!canEdit || !editingTransport} onChange={(e) => setDriverName(e.target.value)} className={cn(inp, (!canEdit || !editingTransport) && "text-subtle")} /></Fld>
            <Fld label="Driver Mobile"><input value={driverMobile} disabled={!canEdit || !editingTransport} onChange={(e) => setDriverMobile(e.target.value)} className={cn(inp, (!canEdit || !editingTransport) && "text-subtle")} /></Fld>
            <Fld label="License Number"><input value={driverLicenseNo} disabled={!canEdit || !editingTransport} onChange={(e) => setDriverLicenseNo(e.target.value)} className={cn(inp, (!canEdit || !editingTransport) && "text-subtle")} /></Fld>
            <Fld label="Helper Name"><input value={helperName} disabled={!canEdit || !editingTransport} onChange={(e) => setHelperName(e.target.value)} className={cn(inp, (!canEdit || !editingTransport) && "text-subtle")} /></Fld>
            <Fld label="Helper Mobile"><input value={helperMobile} disabled={!canEdit || !editingTransport} onChange={(e) => setHelperMobile(e.target.value)} className={cn(inp, (!canEdit || !editingTransport) && "text-subtle")} /></Fld>
          </div>
        </SectionCard>
      </div>

      {/* Weighment Details — read-only, from the linked Vehicle Gate Entry's
          Pre/Post-Loading Weighment (replaces the old Loading Details section,
          which tracked loading-bay/supervisor/start-end-time/packages/pallets
          — those fields still exist on the record but no longer have UI here). */}
      {x.vehicleGateEntryId && (
        <SectionCard icon={Scale} title="Weighment Details">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fld label="Tare Weight (Empty, In Kgs)"><input readOnly value={weighment.tare != null ? String(weighment.tare) : "Not yet weighed"} className={cn(inp, "cursor-not-allowed bg-surface-2")} /></Fld>
            <Fld label="Gross Weight (Post Load, In Kgs)"><input readOnly value={weighment.gross != null ? String(weighment.gross) : "Not yet weighed"} className={cn(inp, "cursor-not-allowed bg-surface-2")} /></Fld>
            <Fld label="Net Weight (In Kgs)"><input readOnly value={weighment.net != null ? String(weighment.net) : "—"} className={cn(inp, "cursor-not-allowed bg-surface-2 font-semibold text-foreground")} /></Fld>
          </div>
          {weighment.gross == null && (
            <p className="mt-2 text-2xs text-subtle">Post-Loading weight not captured yet — record it from Transport &amp; Vehicle Operations → Post Loading Weighment.</p>
          )}
        </SectionCard>
      )}

      {/* Transport Cost — only when the Dispatch Configuration flag is on. */}
      {config?.flags.enableTransportCost && (
        <SectionCard icon={Wallet} title="Transport Cost">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fld label="Freight Charge"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.freightCharge} onChange={(e) => setTc((p) => ({ ...p, freightCharge: e.target.value }))} className={inp} /></Fld>
            <Fld label="Loading Charge"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.loadingCharge} onChange={(e) => setTc((p) => ({ ...p, loadingCharge: e.target.value }))} className={inp} /></Fld>
            <Fld label="Unloading Charge"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.unloadingCharge} onChange={(e) => setTc((p) => ({ ...p, unloadingCharge: e.target.value }))} className={inp} /></Fld>
            <Fld label="Fuel Charge"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.fuelCharge} onChange={(e) => setTc((p) => ({ ...p, fuelCharge: e.target.value }))} className={inp} /></Fld>
            <Fld label="Toll Charge"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.tollCharge} onChange={(e) => setTc((p) => ({ ...p, tollCharge: e.target.value }))} className={inp} /></Fld>
            <Fld label="Driver Allowance"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.driverAllowance} onChange={(e) => setTc((p) => ({ ...p, driverAllowance: e.target.value }))} className={inp} /></Fld>
            <Fld label="Helper Allowance"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.helperAllowance} onChange={(e) => setTc((p) => ({ ...p, helperAllowance: e.target.value }))} className={inp} /></Fld>
            <Fld label="Other Charges"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.otherCharges} onChange={(e) => setTc((p) => ({ ...p, otherCharges: e.target.value }))} className={inp} /></Fld>
            <Fld label="Discount"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.discount} onChange={(e) => setTc((p) => ({ ...p, discount: e.target.value }))} className={inp} /></Fld>
            <Fld label="GST Amount"><input type="number" min={0} disabled={!config.flags.allowCostEditing} value={tc.gstAmount} onChange={(e) => setTc((p) => ({ ...p, gstAmount: e.target.value }))} className={inp} /></Fld>
            <Fld label="Total Transport Cost"><input value={fmt.money(tcTotal)} disabled className={cn(inp, "font-semibold text-foreground")} /></Fld>
          </div>
          <div className="mt-3"><Fld label="Remarks"><textarea value={tc.remarks} disabled={!config.flags.allowCostEditing} onChange={(e) => setTc((p) => ({ ...p, remarks: e.target.value }))} rows={2} className={cn(inp, "h-auto py-2")} /></Fld></div>
          {config.flags.allowCostEditing && (
            <div className="mt-3 flex justify-end"><Button variant="outline" size="md" onClick={saveTransportCost} disabled={tcSaving}><Save className="h-4 w-4" /> {tcSaving ? "Saving…" : "Save Transport Cost"}</Button></div>
          )}
        </SectionCard>
      )}

      {(x.remarks || x.cancelReason) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {x.remarks && <NoteCard title="Remarks" body={x.remarks} />}
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

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-70";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
function KV({ k, v, strong, custom }: { k: string; v: string; strong?: boolean; custom?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-subtle">{k}</div>
      {custom ?? <div className={cn("text-sm", strong ? "font-bold text-foreground" : "font-medium text-foreground")}>{v || "—"}</div>}
    </div>
  );
}
function NoteCard({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">{title}</p><p className="whitespace-pre-line text-xs text-muted">{body}</p></div>;
}
