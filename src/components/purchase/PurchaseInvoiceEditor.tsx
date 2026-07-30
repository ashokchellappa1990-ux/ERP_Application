"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptText, Search, ArrowLeft, Boxes, FileText, Landmark, Paperclip, IndianRupee, Loader2, CheckCircle2, Info, X, Truck, PackagePlus, Plus, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { UomConvert } from "@/components/uom/UomConvert";
import type { PendingGrnRow as GrnRow, PendingGrnDetail as Grn } from "@/lib/contracts/purchaseInvoice";

const n = (v: unknown) => Number(v) || 0;
const r2 = (x: number) => +x.toFixed(2);
const PURCHASE_TYPES = ["Inventory", "Expense", "Service", "Asset"];

interface PiConfig { flags: Record<string, boolean>; fields: Record<string, string> }
interface Attach { docType: string; fileName: string; fileUrl: string; fileType: string; size: number }
interface SupplierHit { id: number; name: string; gstin: string; paymentTerms: string; contactPerson?: string; phone?: string; email?: string; address?: string; city?: string; state?: string }
interface ProductHit { id: number; name: string; sku: string; price: number; gst: number; hsn: string; uom?: string }
interface DirectLine { id: string; productId: number | null; description: string; sku: string; hsn: string; uom: string; qty: string; rate: string; taxPct: string; discPct: string }
interface PoHit { id: number; poNo: string; poDate: string; supplier: string; itemCount: number; netAmount: number }
interface PoDetail { id: number; poNo: string; supplierId: number | null; supplier: string; supplierGstin: string; supplierContact: string; paymentTerms: string; creditDays: number | null; dueDate: string; purchaseType: string; lines: { productId: number | null; description: string; sku: string; hsn: string; qty: number; rate: number; taxPct: number; discPct: number }[] }

export function PurchaseInvoiceEditor() {
  const router = useRouter();
  const fmt = useFmt();
  const money = (x: number) => fmt.money(x);
  const toast = useToast();

  const [config, setConfig] = useState<PiConfig | null>(null);
  const [mode, setMode] = useState<"GRN" | "Direct">("GRN");

  // GRN mode
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<GrnRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [grn, setGrn] = useState<Grn | null>(null);

  // Direct mode
  const [directSource, setDirectSource] = useState<"manual" | "po">("manual");
  const [poNo, setPoNo] = useState("");
  const [poQuery, setPoQuery] = useState("");
  const [poMatches, setPoMatches] = useState<PoHit[] | null>(null);
  const [supQuery, setSupQuery] = useState("");
  const [supMatches, setSupMatches] = useState<SupplierHit[] | null>(null);
  const [supplier, setSupplier] = useState<SupplierHit | null>(null);
  // Supplier advances available to apply against this bill (Advance Management).
  const [avail, setAvail] = useState<{ id: number; advanceNo: string; advanceDate: string; advanceTypeName: string; balance: number }[]>([]);
  const [advAdj, setAdvAdj] = useState<Record<number, string>>({});
  const [lines, setLines] = useState<DirectLine[]>([]);
  const [gstMode, setGstMode] = useState<"exclusive" | "inclusive">("exclusive");
  const [discountMode, setDiscountMode] = useState<"line" | "bill">("line");
  const [pq, setPq] = useState("");
  const [hits, setHits] = useState<ProductHit[] | null>(null);

  // PI details
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState("");
  const [supplierBillNo, setSupplierBillNo] = useState("");
  const [supplierBillDate, setSupplierBillDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [creditDays, setCreditDays] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [supplierRef, setSupplierRef] = useState("");
  const [purchaseType, setPurchaseType] = useState("Inventory");

  // Charges
  const [additionalDiscount, setAdditionalDiscount] = useState("");
  const [freight, setFreight] = useState("");
  const [loading2, setLoading2] = useState("");
  const [packing, setPacking] = useState("");
  const [insurance, setInsurance] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [roundOff, setRoundOff] = useState("");

  const [gstApplicable, setGstApplicable] = useState(true);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [attachments, setAttachments] = useState<Attach[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/settings/purchase", { cache: "no-store" }).then((r) => r.json());
        if (j.ok && j.config) {
          setConfig(j.config);
          setCurrency(j.config.fields?.defaultCurrency || "INR");
          setPaymentTerms(j.config.fields?.defaultPaymentTerms || "");
          setCreditDays(String(j.config.fields?.defaultCreditDays || ""));
        }
      } catch { /* degrade */ }
    })();
  }, []);

  const flags = config?.flags ?? {};
  const enabled = flags.enablePurchaseInvoice !== false;
  const ready = mode === "GRN" ? !!grn : !!supplier;

  /* ---- GRN lookup ---- */
  async function search(rawq: string) {
    setSearching(true);
    try {
      const u = new URLSearchParams(); if (rawq.trim()) u.set("q", rawq.trim());
      const j = await fetch(`/api/purchase/invoice/pending-grn?${u}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) setMatches(j.rows ?? []);
    } catch { toast.error("Could not search GRNs."); }
    finally { setSearching(false); }
  }
  async function pickGrn(row: GrnRow) {
    try {
      const j = await fetch(`/api/purchase/invoice/pending-grn/${row.id}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok && j.data) {
        const g: Grn = j.data;
        setGrn(g); setMatches(null); setQuery(g.grnNo);
        if (g.paymentTerms) setPaymentTerms(g.paymentTerms);
        if (g.creditDays != null) setCreditDays(String(g.creditDays));
        if (g.dueDate) setDueDate(g.dueDate);
      } else toast.error("Could not load that GRN.");
    } catch { toast.error("Could not reach the server."); }
  }

  /* ---- supplier lookup (Direct) — live, debounced ---- */
  const supTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function searchSuppliers(rawq: string) {
    try {
      const u = new URLSearchParams(); if (rawq.trim()) u.set("q", rawq.trim());
      const j = await fetch(`/api/masters/suppliers?${u}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) setSupMatches(j.suppliers ?? []);
    } catch { toast.error("Could not search suppliers."); }
  }
  function onSupQuery(v: string) {
    setSupQuery(v); setSupplier(null);
    if (supTimer.current) clearTimeout(supTimer.current);
    if (!v.trim()) { setSupMatches(null); return; }
    supTimer.current = setTimeout(() => searchSuppliers(v), 250);
  }
  function pickSupplier(s: SupplierHit) {
    setSupplier(s); setSupMatches(null); setSupQuery(s.name);
    if (s.paymentTerms) setPaymentTerms(s.paymentTerms);
  }

  /* ---- purchase-order lookup (Direct → Based on PO) ---- */
  const poTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function searchPOs(rawq: string) {
    try { const j = await fetch(`/api/purchase/order/lookup?q=${encodeURIComponent(rawq.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setPoMatches(j.rows ?? []); }
    catch { toast.error("Could not search purchase orders."); }
  }
  function onPoQuery(v: string) {
    setPoQuery(v);
    if (poTimer.current) clearTimeout(poTimer.current);
    if (!v.trim()) { setPoMatches(null); return; }
    poTimer.current = setTimeout(() => searchPOs(v), 250);
  }
  async function pickPO(row: PoHit) {
    try {
      const j = await fetch(`/api/purchase/order/lookup/${row.id}`, { cache: "no-store" }).then((r) => r.json());
      if (!j.ok || !j.data) { toast.error("Could not load that purchase order."); return; }
      const d: PoDetail = j.data;
      setPoNo(d.poNo); setPoMatches(null); setPoQuery(d.poNo);
      setSupplier({ id: d.supplierId ?? 0, name: d.supplier, gstin: d.supplierGstin, paymentTerms: d.paymentTerms, contactPerson: d.supplierContact });
      setSupQuery(d.supplier);
      if (d.paymentTerms) setPaymentTerms(d.paymentTerms);
      if (d.creditDays != null) setCreditDays(String(d.creditDays));
      if (d.dueDate) setDueDate(d.dueDate);
      if (d.purchaseType && d.purchaseType !== "Inventory") setPurchaseType(d.purchaseType);
      setLines(d.lines.map((l, i) => ({ id: `po-${i}`, productId: l.productId, description: l.description, sku: l.sku, hsn: l.hsn, uom: "", qty: String(l.qty), rate: String(l.rate), taxPct: String(l.taxPct || 0), discPct: l.discPct ? String(l.discPct) : "" })));
      toast.success(`Loaded ${d.lines.length} line(s) from ${d.poNo}.`);
    } catch { toast.error("Could not reach the server."); }
  }

  /* ---- direct line items — live, debounced ---- */
  const prodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function searchProducts(rawq: string) {
    if (!rawq.trim()) { setHits(null); return; }
    try {
      const j = await fetch(`/api/pos/products?q=${encodeURIComponent(rawq.trim())}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) setHits(j.products ?? []);
    } catch { toast.error("Could not search products."); }
  }
  function onPq(v: string) {
    setPq(v);
    if (prodTimer.current) clearTimeout(prodTimer.current);
    if (!v.trim()) { setHits(null); return; }
    prodTimer.current = setTimeout(() => searchProducts(v), 250);
  }
  function addProductLine(p: ProductHit) {
    setLines((prev) => [...prev, { id: `${p.id}-${prev.length}`, productId: p.id, description: p.name, sku: p.sku, hsn: p.hsn || "", uom: p.uom || "", qty: "1", rate: String(p.price || 0), taxPct: String(p.gst || 0), discPct: "" }]);
    setHits(null); setPq("");
  }
  function addBlankLine() {
    setLines((prev) => [...prev, { id: `free-${prev.length}-${Math.round(prev.reduce((s, l) => s + l.id.length, 1))}`, productId: null, description: "", sku: "", hsn: "", uom: "", qty: "1", rate: "", taxPct: "", discPct: "" }]);
  }
  const updLine = (id: string, patch: Partial<DirectLine>) => setLines((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setLines((p) => p.filter((l) => l.id !== id));

  /* ---- amount calc ---- */
  const calc = useMemo(() => {
    let grnAmount = 0, taxableAmount = 0, gstAmount = 0;
    if (mode === "GRN" && grn) { grnAmount = grn.grnAmount; taxableAmount = grn.subtotal; gstAmount = grn.taxTotal; }
    else if (mode === "Direct") {
      const incl = gstMode === "inclusive";
      for (const l of lines) {
        const gross = n(l.qty) * n(l.rate);
        const disc = discountMode === "line" && l.discPct ? r2(gross * (n(l.discPct) / 100)) : 0;
        const net = r2(gross - disc);
        const pct = gstApplicable ? n(l.taxPct) : 0;
        const taxable = pct > 0 && incl ? r2(net / (1 + pct / 100)) : net;
        const tax = pct > 0 ? (incl ? r2(net - taxable) : r2(taxable * (pct / 100))) : 0;
        taxableAmount = r2(taxableAmount + taxable); gstAmount = r2(gstAmount + tax);
      }
      grnAmount = r2(taxableAmount + gstAmount);
    }
    const charges = r2(n(freight) + n(loading2) + n(packing) + n(insurance) + n(otherCharges));
    const total = r2(grnAmount + charges - n(additionalDiscount) + n(roundOff));
    const effRate = taxableAmount > 0 ? r2((gstAmount / taxableAmount) * 100) : 0;
    return { grnAmount, taxableAmount, gstAmount, cgst: r2(gstAmount / 2), sgst: r2(gstAmount - r2(gstAmount / 2)), charges, total, effRate };
  }, [mode, grn, lines, gstApplicable, gstMode, discountMode, freight, loading2, packing, insurance, otherCharges, additionalDiscount, roundOff]);

  // Fetch the supplier's open advances when the supplier changes (Direct bill).
  useEffect(() => {
    if (!supplier?.id) { setAvail([]); setAdvAdj({}); return; }
    fetch(`/api/finance/advance/available?partyType=Supplier&partyId=${supplier.id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setAvail(j.rows); }).catch(() => {});
  }, [supplier?.id]);
  const advanceTotal = r2(Object.entries(advAdj).reduce((s, [id, v]) => { const a = avail.find((x) => x.id === Number(id)); return s + Math.min(n(v), a?.balance ?? 0); }, 0));

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      const dataUrl: string = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
      setAttachments((p) => [...p, { docType: "invoice", fileName: f.name, fileUrl: dataUrl, fileType: f.type, size: f.size }]);
    }
  }

  function switchMode(m: "GRN" | "Direct") {
    setMode(m); setMatches(null); setSupMatches(null); setHits(null);
    // Against GRN is always an Inventory purchase; a direct vendor bill is for
    // Service / Expense / Asset (set a sensible default when leaving Inventory).
    setPurchaseType(m === "GRN" ? "Inventory" : (purchaseType === "Inventory" ? "Service" : purchaseType));
  }

  async function save() {
    if (mode === "GRN" && !grn) { toast.error("Select a GRN first."); return; }
    if (mode === "Direct") {
      if (!supplier) { toast.error("Select a supplier."); return; }
      if (!lines.length) { toast.error("Add at least one line item."); return; }
      if (lines.some((l) => !l.description.trim() || n(l.qty) <= 0)) { toast.error("Each line needs a description and quantity."); return; }
    }
    if (flags.invoiceNoMandatory !== false && !supplierInvoiceNo.trim()) { toast.error("Supplier invoice number is required."); return; }
    if (flags.invoiceDateMandatory !== false && !supplierInvoiceDate) { toast.error("Supplier invoice date is required."); return; }
    if (flags.billAttachmentMandatory && !attachments.length) { toast.error("A supplier bill attachment is required."); return; }
    setSubmitting(true);
    const common = {
      supplierInvoiceNo: supplierInvoiceNo.trim() || undefined, supplierInvoiceDate: supplierInvoiceDate || undefined,
      supplierBillNo: supplierBillNo.trim() || undefined, supplierBillDate: supplierBillDate || undefined, dueDate: dueDate || undefined,
      paymentTerms: paymentTerms || undefined, creditDays: creditDays ? Number(creditDays) : undefined, currency, supplierRef: supplierRef.trim() || undefined, purchaseType,
      additionalDiscount: n(additionalDiscount), freight: n(freight), loading: n(loading2), packing: n(packing), insurance: n(insurance), otherCharges: n(otherCharges), roundOff: n(roundOff),
      gstApplicable, reverseCharge, remarks: remarks.trim() || undefined, internalNotes: internalNotes.trim() || undefined, attachments,
      advanceAdjustments: avail.map((a) => ({ advanceId: a.id, amount: Math.min(n(advAdj[a.id]), a.balance) })).filter((x) => x.amount > 0),
    };
    const payload = mode === "GRN"
      ? { invoiceType: "GRN", grnIds: [grn!.id], ...common }
      : { invoiceType: "Direct", supplierId: supplier!.id, supplierName: supplier!.name, supplierGstin: supplier!.gstin || undefined, poNo: poNo || undefined, gstMode, lines: lines.map((l) => ({ productId: l.productId ?? undefined, description: l.description.trim(), sku: l.sku || undefined, hsn: l.hsn || undefined, qty: n(l.qty), rate: n(l.rate), taxPct: n(l.taxPct), discPct: discountMode === "line" && l.discPct ? n(l.discPct) : undefined })), ...common };
    try {
      const res = await fetch("/api/purchase/invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Purchase invoice recorded."); router.push(j.id ? `/purchase/invoice/${j.id}` : "/purchase/invoice"); }
      else { toast.error(j.message || "Could not record the invoice."); setSubmitting(false); }
    } catch { toast.error("Network error — could not save."); setSubmitting(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase/invoice" className="hover:text-foreground">Purchase Invoice</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ReceiptText className="h-5 w-5 text-primary" /> New Purchase Invoice</h1>
          <p className="mt-0.5 text-sm text-muted">Bill a GRN, or record a direct vendor bill with GST. Inventory is not affected.</p>
        </div>
        <Link href="/purchase/invoice"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {!enabled && <div className="flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger-subtle/50 px-3 py-2 text-2xs font-medium text-danger"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Purchase Invoice is turned off in <Link href="/settings/purchase" className="font-semibold underline">Purchase Configuration</Link>.</span></div>}

      {/* Invoice type toggle */}
      <div className="inline-flex rounded-lg border border-border bg-surface-2 p-1">
        <button onClick={() => switchMode("GRN")} className={cn("inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-semibold transition", mode === "GRN" ? "bg-card text-primary shadow-sm" : "text-muted hover:text-foreground")}><Boxes className="h-4 w-4" /> Against GRN</button>
        <button onClick={() => switchMode("Direct")} className={cn("inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-semibold transition", mode === "Direct" ? "bg-card text-primary shadow-sm" : "text-muted hover:text-foreground")}><Truck className="h-4 w-4" /> Direct Vendor Bill</button>
      </div>

      {/* ============ GRN MODE ============ */}
      {mode === "GRN" && (
        <SectionCard icon={Search} title="GRN Selection" allowOverflow>
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(query); } }} placeholder="Search pending GRN by number, supplier or PO…" className="h-11 w-full rounded-lg border border-primary/40 bg-card px-3 text-sm shadow-sm placeholder:text-subtle focus:border-primary focus:outline-none" />
            <Button size="md" onClick={() => search(query)} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find Pending GRNs</Button>
          </div>
          {matches !== null && (matches.length ? (
            <div className="mt-2 overflow-hidden rounded-lg border border-border">
              <div className="bg-surface-2 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle">{matches.length} pending GRN{matches.length === 1 ? "" : "s"} — pick one</div>
              {matches.map((m) => (
                <button key={m.id} onClick={() => pickGrn(m)} className="flex w-full items-center justify-between gap-3 border-t border-border px-3 py-2 text-left text-sm transition hover:bg-primary-subtle/40">
                  <span className="min-w-0"><span className="block font-mono text-sm font-semibold text-foreground">{m.grnNo}</span><span className="block text-2xs text-muted">{m.grnDate} · {m.supplier}{m.poNo ? ` · PO ${m.poNo}` : ""} · {m.lineCount} item{m.lineCount === 1 ? "" : "s"}</span></span>
                  <span className="shrink-0 text-sm font-semibold text-foreground">{money(m.grnAmount)}</span>
                </button>
              ))}
            </div>
          ) : <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">No pending GRNs matched.</div>)}
        </SectionCard>
      )}
      {mode === "GRN" && grn && (
        <SectionCard icon={Boxes} title="GRN Details (read-only)" action={<Badge tone="primary">{grn.warehouse || "—"}</Badge>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info2 label="GRN No" value={<span className="font-mono">{grn.grnNo}</span>} />
            <Info2 label="GRN Date" value={grn.grnDate} />
            <Info2 label="Supplier" value={grn.supplier} />
            <Info2 label="Supplier GSTIN" value={grn.supplierGstin || "—"} />
            <Info2 label="PO Number" value={grn.poNo || "—"} />
            <Info2 label="GRN Amount" value={money(grn.grnAmount)} />
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Product</th><th className="px-3 py-2">Batch / Exp</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit Price</th><th className="px-3 py-2 text-right">Disc</th><th className="px-3 py-2 text-right">Tax</th><th className="px-3 py-2 text-right">Value</th></tr></thead>
              <tbody>
                {grn.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div></td>
                    <td className="px-3 py-2 text-2xs text-muted">{l.batchNo || "—"}{l.expiryDate ? <div className="text-[10px] text-subtle">Exp {l.expiryDate}</div> : null}</td>
                    <td className="px-3 py-2 text-right text-foreground">{fmt.qty(l.qty)}</td>
                    <td className="px-3 py-2 text-right text-muted">{money(l.unitPrice)}</td>
                    <td className="px-3 py-2 text-right text-muted">{l.discAmount ? money(l.discAmount) : "—"}</td>
                    <td className="px-3 py-2 text-right text-muted">{l.taxAmount ? money(l.taxAmount) : "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{money(l.lineValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ============ DIRECT MODE ============ */}
      {mode === "Direct" && (
        <SectionCard icon={Truck} title="Direct Vendor Bill" allowOverflow>
          {/* Bill source — a fresh manual bill, or one loaded from an open Purchase Order. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Bill source</span>
            <div className="inline-flex rounded-lg border border-border bg-surface-2 p-1">
              {([["manual", "Without PO"], ["po", "Based on PO"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setDirectSource(v)} className={cn("rounded-md px-3 py-1 text-xs font-semibold transition", directSource === v ? "bg-card text-primary shadow-sm" : "text-muted hover:text-foreground")}>{l}</button>)}
            </div>
          </div>
          {directSource === "po" && (
            <div className="relative mb-3">
              <label className="mb-1 block text-2xs font-semibold text-muted">Select Purchase Order</label>
              <input value={poQuery} onChange={(e) => onPoQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchPOs(poQuery); } }} placeholder="Search open PO by number or supplier…" className={inp} />
              {poMatches !== null && (poMatches.length ? (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {poMatches.map((m) => <button key={m.id} onClick={() => pickPO(m)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-primary-subtle/40"><span className="min-w-0"><span className="block font-mono font-semibold text-foreground">{m.poNo}</span><span className="block text-2xs text-subtle">{m.poDate} · {m.supplier} · {m.itemCount} item(s)</span></span><span className="shrink-0 text-sm font-semibold text-foreground">{money(m.netAmount)}</span></button>)}
                </div>
              ) : <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No open purchase orders matched.</div>)}
              {poNo && <p className="mt-1 text-2xs font-medium text-success">Loaded from PO {poNo} — supplier &amp; lines are filled below. Adjust quantities/rates as billed, then record.</p>}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* 1) Purchase Type — chosen first, it drives the accounting. */}
            <div>
              <label className="mb-1 block text-2xs font-semibold text-muted">Purchase Type *</label>
              <select value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)} className={inp}>
                {PURCHASE_TYPES.filter((t) => t !== "Inventory").map((t) => <option key={t}>{t}</option>)}
              </select>
              <p className="mt-1 text-2xs text-subtle">Drives the accounting posting — Service → Service Expense, Expense → Expense A/c, Asset → Fixed Asset + Asset Register.</p>
            </div>
            {/* 2) Supplier — selected after the purchase type. */}
            <div className="relative">
              <label className="mb-1 block text-2xs font-semibold text-muted">Supplier *</label>
              <input value={supQuery} onChange={(e) => onSupQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchSuppliers(supQuery); } }} placeholder="Search supplier name / GSTIN…" className={inp} />
              {supMatches !== null && (supMatches.length ? (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {supMatches.map((s) => (
                    <button key={s.id} onClick={() => pickSupplier(s)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-primary-subtle/40"><span className="font-medium text-foreground">{s.name}</span><span className="text-2xs text-subtle">{s.gstin || ""}</span></button>
                  ))}
                </div>
              ) : <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No suppliers matched.</div>)}
            </div>
          </div>
          {supplier && (
            <div className="mt-3 grid gap-3 rounded-lg border border-border bg-surface-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info2 label="Supplier" value={supplier.name} />
              <Info2 label="GSTIN" value={supplier.gstin || "—"} />
              <Info2 label="Contact" value={supplier.contactPerson || "—"} />
              <Info2 label="Phone" value={supplier.phone || "—"} />
              {supplier.email && <Info2 label="Email" value={supplier.email} />}
              {(supplier.address || supplier.city || supplier.state) && <div className="sm:col-span-2 lg:col-span-3"><Info2 label="Address" value={[supplier.address, supplier.city, supplier.state].filter(Boolean).join(", ") || "—"} /></div>}
            </div>
          )}
        </SectionCard>
      )}
      {mode === "Direct" && supplier && (
        <SectionCard icon={PackagePlus} title="Bill Line Items" allowOverflow>
          {/* GST + discount options for the bill */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"><input type="checkbox" checked={gstApplicable} onChange={(e) => setGstApplicable(e.target.checked)} className="h-4 w-4 accent-primary" /> GST Applicable</label>
            <Seg label="GST" value={gstMode} onChange={(v) => setGstMode(v as "exclusive" | "inclusive")} options={[["exclusive", "Exclusive"], ["inclusive", "Inclusive"]]} disabled={!gstApplicable} />
            <Seg label="Discount" value={discountMode} onChange={(v) => setDiscountMode(v as "line" | "bill")} options={[["line", "Line-wise"], ["bill", "Whole bill"]]} />
          </div>
          <div className="relative mb-3 flex flex-wrap items-end gap-2">
            <div className="relative min-w-[240px] flex-1">
              <label className="mb-1 block text-2xs font-semibold text-muted">Add product (HSN, rate &amp; GST auto-load from master)</label>
              <input value={pq} onChange={(e) => onPq(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchProducts(pq); } }} placeholder="Search product to add…" className={inp} />
              {hits !== null && (hits.length ? (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {hits.map((p) => (<button key={p.id} onClick={() => addProductLine(p)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-primary-subtle/40"><span className="min-w-0"><span className="block font-medium text-foreground">{p.name}</span><span className="block text-2xs text-subtle">{p.sku || "—"}{p.hsn ? ` · HSN ${p.hsn}` : ""} · GST {p.gst}%</span></span><span className="flex items-center gap-1 text-sm font-semibold text-foreground">{money(p.price)} <Plus className="h-3.5 w-3.5 text-primary" /></span></button>))}
                </div>
              ) : <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No products matched.</div>)}
            </div>
            <Button variant="outline" size="md" onClick={addBlankLine}><Plus className="h-4 w-4" /> Add free-text line</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <colgroup><col /><col className="w-24" /><col className="w-20" /><col className="w-28" />{discountMode === "line" && <col className="w-20" />}<col className="w-20" /><col className="w-28" /><col className="w-10" /></colgroup>
              <thead><tr className="border-b border-border bg-surface-2 text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-left">HSN</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Rate</th>
                {discountMode === "line" && <th className="px-2 py-2 text-right">Disc %</th>}
                <th className="px-2 py-2 text-right">GST %</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-2 py-2"></th>
              </tr></thead>
              <tbody>
                {lines.map((l) => {
                  const gross = n(l.qty) * n(l.rate); const disc = discountMode === "line" && l.discPct ? gross * (n(l.discPct) / 100) : 0; const net = gross - disc;
                  const pct = gstApplicable ? n(l.taxPct) : 0; const incl = gstMode === "inclusive";
                  const taxable = pct > 0 && incl ? net / (1 + pct / 100) : net; const tax = pct > 0 ? (incl ? net - taxable : taxable * (pct / 100)) : 0;
                  return (
                    <tr key={l.id} className="border-b border-border last:border-0 align-middle">
                      <td className="px-2 py-1.5"><input value={l.description} onChange={(e) => updLine(l.id, { description: e.target.value })} placeholder="Item / service description" className={cn(inpSm, "w-full min-w-[160px]")} />{l.productId ? <span className="ml-1 text-[10px] text-subtle">{l.sku}</span> : null}</td>
                      <td className="px-2 py-1.5"><input value={l.hsn} onChange={(e) => updLine(l.id, { hsn: e.target.value })} className={cn(inpSm, "w-full")} /></td>
                      <td className="px-2 py-1.5"><div className="flex items-center gap-1"><input type="number" value={l.qty} onChange={(e) => updLine(l.id, { qty: e.target.value })} className={cn(inpSm, "w-full text-right")} /><UomConvert qty={l.qty} uom={l.uom} onChange={(v) => updLine(l.id, { qty: String(v) })} /></div></td>
                      <td className="px-2 py-1.5"><input type="number" value={l.rate} onChange={(e) => updLine(l.id, { rate: e.target.value })} className={cn(inpSm, "w-full text-right")} /></td>
                      {discountMode === "line" && <td className="px-2 py-1.5"><input type="number" value={l.discPct} onChange={(e) => updLine(l.id, { discPct: e.target.value })} className={cn(inpSm, "w-full text-right")} /></td>}
                      <td className="px-2 py-1.5"><input type="number" value={l.taxPct} onChange={(e) => updLine(l.id, { taxPct: e.target.value })} disabled={!gstApplicable} className={cn(inpSm, "w-full text-right disabled:opacity-50")} /></td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-foreground">{money(r2(taxable + tax))}</td>
                      <td className="px-2 py-1.5 text-center"><button onClick={() => removeLine(l.id)} className="text-subtle hover:text-danger"><X className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
                {lines.length === 0 && <tr><td colSpan={discountMode === "line" ? 8 : 7} className="px-3 py-6 text-center text-sm text-muted">Search a product or add a free-text line.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-2xs text-subtle">GST is {gstMode === "inclusive" ? "included in" : "added on top of"} the rate. Discount is applied {discountMode === "line" ? "per line" : "on the whole bill (set Additional Discount below)"}.</p>
        </SectionCard>
      )}

      {ready && (
        <>
          {/* PI Details */}
          <SectionCard icon={FileText} title="Purchase Invoice Details">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fld label={`Supplier Invoice No${flags.invoiceNoMandatory !== false ? " *" : ""}`}><input value={supplierInvoiceNo} onChange={(e) => setSupplierInvoiceNo(e.target.value)} className={inp} /></Fld>
              <Fld label={`Supplier Invoice Date${flags.invoiceDateMandatory !== false ? " *" : ""}`}><input type="date" value={supplierInvoiceDate} onChange={(e) => setSupplierInvoiceDate(e.target.value)} className={inp} /></Fld>
              <Fld label="Supplier Bill No"><input value={supplierBillNo} onChange={(e) => setSupplierBillNo(e.target.value)} className={inp} /></Fld>
              <Fld label="Supplier Bill Date"><input type="date" value={supplierBillDate} onChange={(e) => setSupplierBillDate(e.target.value)} className={inp} /></Fld>
              <Fld label={`Due Date${flags.dueDateMandatory ? " *" : ""}`}><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} /></Fld>
              <Fld label="Payment Terms"><input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inp} /></Fld>
              <Fld label="Credit Days"><input type="number" value={creditDays} onChange={(e) => setCreditDays(e.target.value)} className={inp} /></Fld>
              <Fld label="Currency"><input value={currency} onChange={(e) => setCurrency(e.target.value)} className={inp} /></Fld>
              <Fld label="Supplier Reference No"><input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} className={inp} /></Fld>
              <Fld label="Purchase Type"><input value={purchaseType} disabled readOnly className={cn(inp, "cursor-not-allowed opacity-70")} title={mode === "GRN" ? "GRN bills are always Inventory" : "Set in the Direct Vendor Bill section above"} /></Fld>
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <SectionCard icon={IndianRupee} title="Bill Amount Details">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Fld label="Additional Discount"><input type="number" value={additionalDiscount} onChange={(e) => setAdditionalDiscount(e.target.value)} className={inp} placeholder="0.00" /></Fld>
                  <Fld label="Freight Charges"><input type="number" value={freight} onChange={(e) => setFreight(e.target.value)} className={inp} placeholder="0.00" /></Fld>
                  <Fld label="Loading Charges"><input type="number" value={loading2} onChange={(e) => setLoading2(e.target.value)} className={inp} placeholder="0.00" /></Fld>
                  <Fld label="Packing Charges"><input type="number" value={packing} onChange={(e) => setPacking(e.target.value)} className={inp} placeholder="0.00" /></Fld>
                  <Fld label="Insurance Charges"><input type="number" value={insurance} onChange={(e) => setInsurance(e.target.value)} className={inp} placeholder="0.00" /></Fld>
                  <Fld label="Other Charges"><input type="number" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} className={inp} placeholder="0.00" /></Fld>
                  <Fld label="Round Off"><input type="number" value={roundOff} onChange={(e) => setRoundOff(e.target.value)} className={inp} placeholder="0.00" /></Fld>
                </div>
              </SectionCard>

              <SectionCard icon={Landmark} title="GST Details">
                <div className="mb-3 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={gstApplicable} onChange={(e) => setGstApplicable(e.target.checked)} className="h-4 w-4 accent-primary" /> GST Applicable</label>
                  <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={reverseCharge} onChange={(e) => setReverseCharge(e.target.checked)} className="h-4 w-4 accent-primary" /> Reverse Charge</label>
                </div>
                <div className="grid gap-3 rounded-lg bg-surface-2 p-3 sm:grid-cols-3 lg:grid-cols-5">
                  <Tot label="GST Rate" value={`${calc.effRate || 0}%`} />
                  <Tot label={`CGST (${r2((calc.effRate || 0) / 2)}%)`} value={money(calc.cgst)} />
                  <Tot label={`SGST (${r2((calc.effRate || 0) / 2)}%)`} value={money(calc.sgst)} />
                  <Tot label="IGST" value={money(0)} />
                  <Tot label="GST Total" value={money(calc.gstAmount)} strong />
                </div>
              </SectionCard>

              <SectionCard icon={Paperclip} title="Bill Attachment">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-3 text-sm text-muted hover:border-primary hover:text-primary">
                  <Paperclip className="h-4 w-4" /> Upload supplier invoice PDF / image / challan
                  <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => onFiles(e.target.files)} />
                </label>
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {attachments.map((a, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs">
                        <a href={a.fileUrl} target="_blank" rel="noreferrer" className="truncate font-medium text-primary hover:underline">{a.fileName}</a>
                        <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-subtle hover:text-danger"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard icon={FileText} title="Remarks">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fld label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld>
                  <Fld label="Internal Notes"><textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld>
                </div>
              </SectionCard>
            </div>

            <aside className="space-y-4">
              {supplier && avail.length > 0 && (
                <SectionCard icon={HandCoins} title={<>Apply Supplier Advance <span className="text-2xs font-normal text-muted">({avail.length})</span></>}>
                  <div className="space-y-2">
                    {avail.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-2.5 py-2 text-sm">
                        <div className="min-w-0"><span className="font-mono text-2xs font-semibold text-primary">{a.advanceNo}</span><span className="block text-[10px] text-subtle">Bal {money(a.balance)}</span></div>
                        <div className="flex items-center gap-1"><input type="number" value={advAdj[a.id] ?? ""} onChange={(e) => setAdvAdj((p) => ({ ...p, [a.id]: e.target.value }))} placeholder="0.00" className="h-7 w-20 rounded border border-border-strong bg-surface px-1.5 text-right text-xs focus:border-primary focus:outline-none" /><button type="button" onClick={() => setAdvAdj((p) => ({ ...p, [a.id]: String(Math.max(0, Math.min(a.balance, calc.total - advanceTotal + Math.min(n(advAdj[a.id]), a.balance)))) }))} className="rounded border border-border bg-surface px-1.5 py-1 text-[10px] font-semibold text-primary hover:border-primary">Max</button></div>
                      </div>
                    ))}
                    {advanceTotal > 0 && <div className="flex items-center justify-between pt-0.5 text-sm font-semibold"><span className="text-foreground">Applied</span><span className="text-success">− {money(advanceTotal)}</span></div>}
                  </div>
                  <p className="mt-1.5 text-[10px] text-subtle">Reduces the payable & auto-posts a settlement.</p>
                </SectionCard>
              )}
              <SectionCard icon={IndianRupee} title="Invoice Summary">
                <div className="space-y-1.5 text-sm">
                  <Row k={mode === "GRN" ? "GRN Amount" : "Goods / Service"} v={money(calc.grnAmount)} />
                  <Row k="Taxable Amount" v={money(calc.taxableAmount)} />
                  <Row k="GST Amount" v={money(calc.gstAmount)} />
                  <Row k="Charges" v={money(calc.charges)} />
                  {n(additionalDiscount) > 0 && <Row k="Less: Discount" v={`− ${money(n(additionalDiscount))}`} />}
                  {n(roundOff) !== 0 && <Row k="Round Off" v={money(n(roundOff))} />}
                  {advanceTotal > 0 && <Row k="Advance Applied" v={`− ${money(advanceTotal)}`} />}
                  <div className="my-1.5 h-px bg-border" />
                  <div className="flex items-center justify-between text-base font-bold text-foreground"><span>Total Invoice</span><span>{money(calc.total)}</span></div>
                  <div className="flex items-center justify-between text-lg font-bold text-primary"><span>Net Payable</span><span>{money(calc.total)}</span></div>
                </div>
                <Button size="lg" className="mt-3 w-full" onClick={save} disabled={!enabled || submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {submitting ? "Saving…" : flags.approvalRequired ? "Save (Pending Approval)" : "Record Invoice"}</Button>
                <p className="mt-2 text-center text-2xs text-subtle">Creates supplier outstanding & posts accounts. {mode === "GRN" ? "Inventory unaffected (already received)." : "Direct bill — no stock movement."}</p>
              </SectionCard>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const inpSm = "h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>;
}
function Info2({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</div><div className="mt-0.5 text-sm font-medium text-foreground">{value}</div></div>;
}
function Tot({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</div><div className={cn("mt-0.5", strong ? "text-base font-bold text-foreground" : "text-sm font-medium text-foreground")}>{value}</div></div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="text-foreground">{v}</span></div>;
}
function Seg({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; disabled?: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1", disabled && "opacity-50")}>
      <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</span>
      <div className="inline-flex rounded-md bg-surface-2 p-0.5">
        {options.map(([v, l]) => (
          <button key={v} disabled={disabled} onClick={() => onChange(v)} className={cn("rounded px-2 py-0.5 text-xs font-semibold transition", value === v ? "bg-card text-primary shadow-sm" : "text-muted hover:text-foreground")}>{l}</button>
        ))}
      </div>
    </div>
  );
}
