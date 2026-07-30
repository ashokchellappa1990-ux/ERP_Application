"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Search, ArrowLeft, Truck, FileText, Landmark, Paperclip, IndianRupee, Loader2, CheckCircle2, Save, X, PackagePlus, Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { UomConvert } from "@/components/uom/UomConvert";
import type { PurchaseOrderDetail } from "@/lib/contracts/purchaseOrder";

const n = (v: unknown) => Number(v) || 0;
const r2 = (x: number) => +x.toFixed(2);
const PURCHASE_TYPES = ["Inventory", "Expense", "Service", "Asset"];
const SHIP = ["", "Road", "Rail", "Air", "Courier", "Hand"];
const FREIGHT_BY = ["", "Supplier", "Us", "ToPay"];

interface SupplierHit { id: number; name: string; gstin?: string; paymentTerms?: string; contactPerson?: string; phone?: string; email?: string; address?: string; city?: string; state?: string }
interface ProductHit { id: number; name: string; sku?: string; price?: number; gst?: number; hsn?: string }
interface Line { id: string; productId: number | null; description: string; sku: string; hsn: string; uom: string; qty: string; rate: string; discPct: string; taxPct: string; expectedDate: string; remarks: string }
const blankLine = (i: number): Line => ({ id: `l-${i}-${Math.random().toString(36).slice(2, 7)}`, productId: null, description: "", sku: "", hsn: "", uom: "", qty: "1", rate: "", discPct: "", taxPct: "", expectedDate: "", remarks: "" });

export function PurchaseOrderEditor({ orderId }: { orderId?: number }) {
  const router = useRouter();
  const fmt = useFmt();
  const money = (x: number) => fmt.money(x);
  const toast = useToast();

  const [loadingDoc, setLoadingDoc] = useState(!!orderId);
  const [supQuery, setSupQuery] = useState(""); const [supMatches, setSupMatches] = useState<SupplierHit[] | null>(null); const [supplier, setSupplier] = useState<SupplierHit | null>(null);
  const [lines, setLines] = useState<Line[]>([blankLine(0)]);
  const [pq, setPq] = useState(""); const [hits, setHits] = useState<ProductHit[] | null>(null);
  const [gstMode, setGstMode] = useState<"exclusive" | "inclusive">("exclusive");
  const [discountMode, setDiscountMode] = useState<"line" | "bill">("line");
  const [gstApplicable, setGstApplicable] = useState(true);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [interState, setInterState] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // header fields
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [purchaseType, setPurchaseType] = useState("Inventory");
  const [buyer, setBuyer] = useState(""); const [quotationNo, setQuotationNo] = useState(""); const [quotationDate, setQuotationDate] = useState("");
  const [supplierRef, setSupplierRef] = useState(""); const [supplierContact, setSupplierContact] = useState("");
  const [warehouse, setWarehouse] = useState(""); const [deliveryAddress, setDeliveryAddress] = useState(""); const [shippingMode, setShippingMode] = useState(""); const [freightPaidBy, setFreightPaidBy] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(""); const [creditDays, setCreditDays] = useState(""); const [dueDate, setDueDate] = useState(""); const [currency, setCurrency] = useState("INR");
  const [additionalDiscount, setAdditionalDiscount] = useState(""); const [freight, setFreight] = useState(""); const [loading2, setLoading2] = useState(""); const [packing, setPacking] = useState(""); const [insurance, setInsurance] = useState(""); const [otherCharges, setOtherCharges] = useState(""); const [roundOff, setRoundOff] = useState("");
  const [remarks, setRemarks] = useState(""); const [internalNotes, setInternalNotes] = useState(""); const [termsConditions, setTermsConditions] = useState("");
  const [attachments, setAttachments] = useState<{ fileName: string; fileUrl: string; fileType?: string | null; size: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // load draft for edit
  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/purchase/order/${orderId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.ok) { toast.error(j.message || "Could not load order."); return; }
      const d: PurchaseOrderDetail = j.data;
      setSupplier({ id: d.supplierId ?? 0, name: d.supplier, gstin: d.supplierGstin, contactPerson: d.supplierContact }); setSupQuery(d.supplier);
      setPoDate(d.poDate); setExpectedDeliveryDate(d.expectedDeliveryDate); setPurchaseType(d.purchaseType); setBuyer(d.buyer); setQuotationNo(d.quotationNo); setQuotationDate(d.quotationDate);
      setSupplierRef(d.supplierRef); setSupplierContact(d.supplierContact); setWarehouse(d.warehouse); setDeliveryAddress(d.deliveryAddress); setShippingMode(d.shippingMode); setFreightPaidBy(d.freightPaidBy);
      setPaymentTerms(d.paymentTerms); setCreditDays(d.creditDays != null ? String(d.creditDays) : ""); setDueDate(d.dueDate); setCurrency(d.currency);
      setGstApplicable(d.gstApplicable); setReverseCharge(d.reverseCharge); setInterState(d.interState);
      setDiscountMode(d.items.some((it) => it.discPct) ? "line" : (Number(d.additionalDiscount) > 0 ? "bill" : "line"));
      setAdditionalDiscount(num(d.additionalDiscount)); setFreight(num(d.freight)); setLoading2(num(d.loading)); setPacking(num(d.packing)); setInsurance(num(d.insurance)); setOtherCharges(num(d.otherCharges)); setRoundOff(num(d.roundOff));
      setRemarks(d.remarks); setInternalNotes(d.internalNotes); setTermsConditions(d.termsConditions);
      setLines(d.items.map((it, i) => ({ id: `e-${i}`, productId: it.productId, description: it.productName, sku: it.sku ?? "", hsn: it.hsn ?? "", uom: it.uom ?? "", qty: String(it.qty), rate: String(it.rate), discPct: it.discPct != null ? String(it.discPct) : "", taxPct: it.taxPct != null ? String(it.taxPct) : "", expectedDate: it.expectedDate ?? "", remarks: it.remarks ?? "" })));
      setAttachments(d.attachments.map((a) => ({ fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType, size: a.size })));
      setLoadingDoc(false);
    });
  }, [orderId, toast]);

  // supplier search
  const supTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSuppliers = async (q: string) => { try { const j = await fetch(`/api/masters/suppliers?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setSupMatches(j.suppliers ?? []); } catch { toast.error("Could not search suppliers."); } };
  const onSupQuery = (v: string) => { setSupQuery(v); setSupplier(null); if (supTimer.current) clearTimeout(supTimer.current); if (!v.trim()) { setSupMatches(null); return; } supTimer.current = setTimeout(() => searchSuppliers(v), 250); };
  const pickSupplier = (s: SupplierHit) => { setSupplier(s); setSupMatches(null); setSupQuery(s.name); if (s.paymentTerms) setPaymentTerms(s.paymentTerms); if (s.contactPerson) setSupplierContact(s.contactPerson); };

  // product search
  const prodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchProducts = async (q: string) => { if (!q.trim()) { setHits(null); return; } try { const j = await fetch(`/api/pos/products?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setHits(j.products ?? []); } catch { toast.error("Could not search products."); } };
  const onPq = (v: string) => { setPq(v); if (prodTimer.current) clearTimeout(prodTimer.current); if (!v.trim()) { setHits(null); return; } prodTimer.current = setTimeout(() => searchProducts(v), 250); };
  const addProductLine = (p: ProductHit) => { setLines((prev) => [...prev, { ...blankLine(prev.length), productId: p.id, description: p.name, sku: p.sku ?? "", hsn: p.hsn ?? "", rate: String(p.price ?? 0), taxPct: String(p.gst ?? 0) }]); setHits(null); setPq(""); };
  const addBlankLine = () => setLines((prev) => [...prev, blankLine(prev.length)]);
  const updLine = (id: string, patch: Partial<Line>) => setLines((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setLines((p) => (p.length > 1 ? p.filter((l) => l.id !== id) : p));

  const upload = async (files: FileList | null) => { if (!files?.length) return; setUploading(true); for (const f of Array.from(files)) { const fd = new FormData(); fd.append("file", f); const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null); if (j?.ok) setAttachments((a) => [...a, j.file]); else toast.error(j?.message || "Upload failed."); } setUploading(false); };

  const calc = useMemo(() => {
    const incl = gstMode === "inclusive"; let taxableAmount = 0, gstAmount = 0;
    for (const l of lines) { const gross = n(l.qty) * n(l.rate); const disc = discountMode === "line" && l.discPct ? r2(gross * (n(l.discPct) / 100)) : 0; const net = r2(gross - disc); const pct = gstApplicable ? n(l.taxPct) : 0; const taxable = pct > 0 && incl ? r2(net / (1 + pct / 100)) : net; const tax = pct > 0 ? (incl ? r2(net - taxable) : r2(taxable * (pct / 100))) : 0; taxableAmount = r2(taxableAmount + taxable); gstAmount = r2(gstAmount + tax); }
    const goods = r2(taxableAmount + gstAmount);
    const charges = r2(n(freight) + n(loading2) + n(packing) + n(insurance) + n(otherCharges));
    const total = r2(goods + charges - n(additionalDiscount) + n(roundOff));
    const effRate = taxableAmount > 0 ? r2((gstAmount / taxableAmount) * 100) : 0;
    const cgst = interState ? 0 : r2(gstAmount / 2); const sgst = interState ? 0 : r2(gstAmount - cgst); const igst = interState ? gstAmount : 0;
    return { taxableAmount, gstAmount, goods, charges, total, effRate, cgst, sgst, igst };
  }, [lines, gstApplicable, gstMode, discountMode, interState, freight, loading2, packing, insurance, otherCharges, additionalDiscount, roundOff]);

  const save = async (saveMode: "Draft" | "Issued") => {
    if (!supplier && !supQuery.trim()) { toast.error("Select a supplier."); return; }
    const valid = lines.filter((l) => l.description.trim() && n(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one valid line item."); return; }
    setSubmitting(true);
    const payload = {
      supplierId: supplier?.id || undefined, supplierName: supplier?.name || supQuery.trim(), supplierGstin: supplier?.gstin || undefined, supplierContact: supplierContact || undefined, supplierRef: supplierRef || undefined,
      poDate, quotationNo: quotationNo || undefined, quotationDate: quotationDate || undefined, buyer: buyer || undefined, purchaseType,
      expectedDeliveryDate: expectedDeliveryDate || undefined, warehouse: warehouse || undefined, deliveryAddress: deliveryAddress || undefined, shippingMode: shippingMode || undefined, freightPaidBy: freightPaidBy || undefined,
      paymentTerms: paymentTerms || undefined, creditDays: creditDays ? Number(creditDays) : undefined, dueDate: dueDate || undefined, currency: currency || "INR",
      gstMode, gstApplicable, reverseCharge, interState,
      additionalDiscount: additionalDiscount || undefined, freight: freight || undefined, loading: loading2 || undefined, packing: packing || undefined, insurance: insurance || undefined, otherCharges: otherCharges || undefined, roundOff: roundOff || undefined,
      remarks: remarks || undefined, internalNotes: internalNotes || undefined, termsConditions: termsConditions || undefined, saveMode,
      lines: valid.map((l) => ({ productId: l.productId || undefined, description: l.description.trim(), sku: l.sku || undefined, hsn: l.hsn || undefined, uom: l.uom || undefined, qty: n(l.qty), rate: n(l.rate), taxPct: l.taxPct ? n(l.taxPct) : undefined, discPct: discountMode === "line" && l.discPct ? n(l.discPct) : undefined, expectedDate: l.expectedDate || undefined, remarks: l.remarks || undefined })),
      attachments: attachments.map((a) => ({ docType: "quotation", fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType ?? undefined, size: a.size })),
    };
    try {
      const res = await fetch(orderId ? `/api/purchase/order/${orderId}` : "/api/purchase/order", { method: orderId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Saved."); router.push(`/purchase/order/${orderId ?? j.id}`); }
      else { toast.error(j.message || "Could not save the purchase order."); setSubmitting(false); }
    } catch { toast.error("Network error — could not save."); setSubmitting(false); }
  };

  if (loadingDoc) return <div className="py-16"><AppLoader label="Loading purchase order…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase/order" className="hover:text-foreground">Purchase Order</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{orderId ? "Edit" : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ShoppingBag className="h-5 w-5 text-primary" /> {orderId ? "Edit Purchase Order" : "New Purchase Order"}</h1>
          <p className="mt-0.5 text-sm text-muted">Raise a supplier order. It is a commitment only — stock &amp; accounts are not affected.</p>
        </div>
        <Link href={orderId ? `/purchase/order/${orderId}` : "/purchase/order"}><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {/* Supplier & order details */}
      <SectionCard icon={Building2} title="Purchase Order Details" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <label className="mb-1 block text-2xs font-semibold text-muted">Supplier *</label>
            <input value={supQuery} onChange={(e) => onSupQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchSuppliers(supQuery); } }} placeholder="Search supplier name / GSTIN…" className={inp} />
            {supMatches !== null && (supMatches.length ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                {supMatches.map((s) => <button key={s.id} onClick={() => pickSupplier(s)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-primary-subtle/40"><span className="font-medium text-foreground">{s.name}</span><span className="text-2xs text-subtle">{s.gstin || ""}</span></button>)}
              </div>
            ) : <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No suppliers matched.</div>)}
            {supplier && <p className="mt-1 text-2xs text-subtle">GSTIN {supplier.gstin || "—"}{supplier.contactPerson ? ` · ${supplier.contactPerson}` : ""}</p>}
          </div>
          <Fld label="Purchase Type"><select value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)} className={inp}>{PURCHASE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Fld>
          <Fld label="PO Date"><input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className={inp} /></Fld>
          <Fld label="Expected Delivery"><input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className={inp} /></Fld>
          <Fld label="Buyer / Requested By"><input value={buyer} onChange={(e) => setBuyer(e.target.value)} className={inp} /></Fld>
          <Fld label="Quotation No"><input value={quotationNo} onChange={(e) => setQuotationNo(e.target.value)} className={inp} /></Fld>
          <Fld label="Quotation Date"><input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} className={inp} /></Fld>
          <Fld label="Supplier Reference No"><input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} className={inp} /></Fld>
          <Fld label="Supplier Contact"><input value={supplierContact} onChange={(e) => setSupplierContact(e.target.value)} className={inp} /></Fld>
        </div>
      </SectionCard>

      {/* Line items */}
      <SectionCard icon={PackagePlus} title="Order Items" allowOverflow>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"><input type="checkbox" checked={gstApplicable} onChange={(e) => setGstApplicable(e.target.checked)} className="h-4 w-4 accent-primary" /> GST Applicable</label>
          <Seg label="GST" value={gstMode} onChange={(v) => setGstMode(v as "exclusive" | "inclusive")} options={[["exclusive", "Exclusive"], ["inclusive", "Inclusive"]]} disabled={!gstApplicable} />
          <Seg label="Discount" value={discountMode} onChange={(v) => setDiscountMode(v as "line" | "bill")} options={[["line", "Line-wise"], ["bill", "Whole bill"]]} />
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"><input type="checkbox" checked={interState} onChange={(e) => setInterState(e.target.checked)} className="h-4 w-4 accent-primary" /> Inter-State (IGST)</label>
        </div>
        <div className="relative mb-3 flex flex-wrap items-end gap-2">
          <div className="relative min-w-[240px] flex-1">
            <label className="mb-1 block text-2xs font-semibold text-muted">Add product (HSN, rate &amp; GST auto-load from master)</label>
            <input value={pq} onChange={(e) => onPq(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchProducts(pq); } }} placeholder="Search product to add…" className={inp} />
            {hits !== null && (hits.length ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                {hits.map((p) => <button key={p.id} onClick={() => addProductLine(p)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-primary-subtle/40"><span className="min-w-0"><span className="block font-medium text-foreground">{p.name}</span><span className="block text-2xs text-subtle">{p.sku || "—"}{p.hsn ? ` · HSN ${p.hsn}` : ""} · GST {p.gst ?? 0}%</span></span><span className="flex items-center gap-1 text-sm font-semibold text-foreground">{money(p.price ?? 0)} <Plus className="h-3.5 w-3.5 text-primary" /></span></button>)}
              </div>
            ) : <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No products matched.</div>)}
          </div>
          <Button variant="outline" size="md" onClick={addBlankLine}><Plus className="h-4 w-4" /> Add free-text line</Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <colgroup><col /><col className="w-20" /><col className="w-16" /><col className="w-16" /><col className="w-20" />{discountMode === "line" && <col className="w-16" />}<col className="w-16" /><col className="w-28" /><col className="w-24" /><col className="w-10" /></colgroup>
            <thead><tr className="border-b border-border bg-surface-2 text-2xs font-semibold uppercase tracking-wider text-subtle">
              <th className="px-2 py-2 text-left">Description</th><th className="px-2 py-2 text-left">HSN</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-left">UOM</th><th className="px-2 py-2 text-right">Rate</th>{discountMode === "line" && <th className="px-2 py-2 text-right">Disc %</th>}<th className="px-2 py-2 text-right">GST %</th><th className="px-2 py-2 text-left">Exp. Date</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2"></th>
            </tr></thead>
            <tbody>
              {lines.map((l) => {
                const gross = n(l.qty) * n(l.rate); const disc = discountMode === "line" && l.discPct ? gross * (n(l.discPct) / 100) : 0; const net = gross - disc;
                const pct = gstApplicable ? n(l.taxPct) : 0; const incl = gstMode === "inclusive";
                const taxable = pct > 0 && incl ? net / (1 + pct / 100) : net; const tax = pct > 0 ? (incl ? net - taxable : taxable * (pct / 100)) : 0;
                return (
                  <tr key={l.id} className="border-b border-border last:border-0 align-middle">
                    <td className="px-2 py-1.5"><input value={l.description} onChange={(e) => updLine(l.id, { description: e.target.value })} placeholder="Item description" className={cn(inpSm, "w-full min-w-[160px]")} />{l.productId ? <span className="ml-1 text-[10px] text-subtle">{l.sku}</span> : null}</td>
                    <td className="px-2 py-1.5"><input value={l.hsn} onChange={(e) => updLine(l.id, { hsn: e.target.value })} className={cn(inpSm, "w-full")} /></td>
                    <td className="px-2 py-1.5"><div className="flex items-center gap-1"><input type="number" value={l.qty} onChange={(e) => updLine(l.id, { qty: e.target.value })} className={cn(inpSm, "w-full text-right")} /><UomConvert qty={l.qty} uom={l.uom} onChange={(v) => updLine(l.id, { qty: String(v) })} /></div></td>
                    <td className="px-2 py-1.5"><input value={l.uom} onChange={(e) => updLine(l.id, { uom: e.target.value })} className={cn(inpSm, "w-full")} /></td>
                    <td className="px-2 py-1.5"><input type="number" value={l.rate} onChange={(e) => updLine(l.id, { rate: e.target.value })} className={cn(inpSm, "w-full text-right")} /></td>
                    {discountMode === "line" && <td className="px-2 py-1.5"><input type="number" value={l.discPct} onChange={(e) => updLine(l.id, { discPct: e.target.value })} className={cn(inpSm, "w-full text-right")} /></td>}
                    <td className="px-2 py-1.5"><input type="number" value={l.taxPct} onChange={(e) => updLine(l.id, { taxPct: e.target.value })} disabled={!gstApplicable} className={cn(inpSm, "w-full text-right disabled:opacity-50")} /></td>
                    <td className="px-2 py-1.5"><input type="date" value={l.expectedDate} onChange={(e) => updLine(l.id, { expectedDate: e.target.value })} className={cn(inpSm, "w-full")} /></td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-foreground">{money(r2(taxable + tax))}</td>
                    <td className="px-2 py-1.5 text-center"><button onClick={() => removeLine(l.id)} className="text-subtle hover:text-danger"><X className="h-4 w-4" /></button></td>
                  </tr>
                );
              })}
              {lines.length === 0 && <tr><td colSpan={discountMode === "line" ? 10 : 9} className="px-3 py-6 text-center text-sm text-muted">Search a product or add a free-text line.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-2xs text-subtle">GST is {gstMode === "inclusive" ? "included in" : "added on top of"} the rate. Discount is applied {discountMode === "line" ? "per line" : "on the whole bill (set Additional Discount below)"}. {interState ? "Inter-state — GST posts to IGST." : "Intra-state — GST splits into CGST + SGST."}</p>
      </SectionCard>

      {/* Delivery & terms */}
      <SectionCard icon={Truck} title="Delivery & Payment Terms">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fld label="Deliver To (Warehouse)"><input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className={inp} /></Fld>
          <Fld label="Shipping Mode"><select value={shippingMode} onChange={(e) => setShippingMode(e.target.value)} className={inp}>{SHIP.map((x) => <option key={x} value={x}>{x || "—"}</option>)}</select></Fld>
          <Fld label="Freight Paid By"><select value={freightPaidBy} onChange={(e) => setFreightPaidBy(e.target.value)} className={inp}>{FREIGHT_BY.map((x) => <option key={x} value={x}>{x || "—"}</option>)}</select></Fld>
          <Fld label="Delivery Address"><input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={inp} /></Fld>
          <Fld label="Payment Terms"><input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30" className={inp} /></Fld>
          <Fld label="Credit Days"><input type="number" value={creditDays} onChange={(e) => setCreditDays(e.target.value)} className={inp} /></Fld>
          <Fld label="Due Date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} /></Fld>
          <Fld label="Currency"><input value={currency} onChange={(e) => setCurrency(e.target.value)} className={inp} /></Fld>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <SectionCard icon={IndianRupee} title="Charges & Adjustments">
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
              <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={interState} onChange={(e) => setInterState(e.target.checked)} className="h-4 w-4 accent-primary" /> Inter-State (IGST)</label>
            </div>
            <div className="grid gap-3 rounded-lg bg-surface-2 p-3 sm:grid-cols-3 lg:grid-cols-5">
              <Tot label="GST Rate" value={`${calc.effRate || 0}%`} />
              <Tot label="CGST" value={money(calc.cgst)} />
              <Tot label="SGST" value={money(calc.sgst)} />
              <Tot label="IGST" value={money(calc.igst)} />
              <Tot label="GST Total" value={money(calc.gstAmount)} strong />
            </div>
          </SectionCard>

          <SectionCard icon={Paperclip} title="Attachments">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-3 text-sm text-muted hover:border-primary hover:text-primary">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} Attach quotation / documents (PDF, image)
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
            {attachments.length > 0 && <div className="mt-2 space-y-1.5">{attachments.map((a, i) => <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs"><a href={a.fileUrl} target="_blank" rel="noreferrer" className="truncate font-medium text-primary hover:underline">{a.fileName}</a><button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-subtle hover:text-danger"><X className="h-3.5 w-3.5" /></button></div>)}</div>}
          </SectionCard>

          <SectionCard icon={FileText} title="Remarks & Terms">
            <div className="grid gap-3 sm:grid-cols-2">
              <Fld label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld>
              <Fld label="Internal Notes"><textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld>
              <div className="sm:col-span-2"><Fld label="Terms & Conditions"><textarea value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} placeholder="Delivery, warranty, penalty clauses…" /></Fld></div>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <SectionCard icon={IndianRupee} title="Order Summary">
            <div className="space-y-1.5 text-sm">
              <Row k="Taxable Amount" v={money(calc.taxableAmount)} />
              <Row k={`GST${interState ? " (IGST)" : ""}`} v={money(calc.gstAmount)} />
              <Row k="Charges" v={money(calc.charges)} />
              {n(additionalDiscount) > 0 && <Row k="Less: Discount" v={`− ${money(n(additionalDiscount))}`} />}
              {n(roundOff) !== 0 && <Row k="Round Off" v={money(n(roundOff))} />}
              <div className="my-1.5 h-px bg-border" />
              <div className="flex items-center justify-between text-lg font-bold text-primary"><span>Net Order Value</span><span>{money(calc.total)}</span></div>
            </div>
            <div className="mt-3 space-y-2">
              <Button size="lg" className="w-full" onClick={() => save("Issued")} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {orderId ? "Save & Issue" : "Create & Issue"}</Button>
              <Button variant="outline" size="lg" className="w-full" onClick={() => save("Draft")} disabled={submitting}><Save className="h-4 w-4" /> Save as Draft</Button>
            </div>
            <p className="mt-2 text-center text-2xs text-subtle">A purchase order is a commitment — no stock or accounting impact.</p>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

const num = (n2: number) => (n2 ? String(n2) : "");
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const inpSm = "h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
function Tot({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</div><div className={cn("mt-0.5", strong ? "text-base font-bold text-foreground" : "text-sm font-medium text-foreground")}>{value}</div></div>; }
function Row({ k, v }: { k: string; v: string }) { return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="text-foreground">{v}</span></div>; }
function Seg({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; disabled?: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1", disabled && "opacity-50")}>
      <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</span>
      <div className="inline-flex rounded-md bg-surface-2 p-0.5">{options.map(([v, l]) => <button key={v} disabled={disabled} onClick={() => onChange(v)} className={cn("rounded px-2 py-0.5 text-xs font-semibold transition", value === v ? "bg-card text-primary shadow-sm" : "text-muted hover:text-foreground")}>{l}</button>)}</div>
    </div>
  );
}
