"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, ClipboardList, ArrowLeft, Truck, Landmark, Paperclip, IndianRupee, Loader2, CheckCircle2, Save, X, Boxes, Plus, User, Search, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { UomConvert } from "@/components/uom/UomConvert";
import { DOC_LABEL, type SalesDocDetail, type SalesDocType } from "@/lib/contracts/salesDoc";

const n = (v: unknown) => Number(v) || 0;
const r2 = (x: number) => +x.toFixed(2);
const SHIP = ["", "Road", "Rail", "Air", "Courier", "Hand"];

interface CustomerHit { id: number; name: string; gstin?: string; phone?: string; contactPerson?: string; city?: string; state?: string }
interface ProductHit { id: number; name: string; sku?: string; price?: number; gst?: number; hsn?: string; uom?: string; mrp?: number; stock?: number }
interface Line { key: string; productId: number | null; description: string; sku: string; hsn: string; uom: string; qty: string; rate: string; discPct: string; taxPct: string; expectedDate: string; remarks: string }
const blankLine = (): Line => ({ key: `l-${Math.random().toString(36).slice(2, 8)}`, productId: null, description: "", sku: "", hsn: "", uom: "", qty: "1", rate: "", discPct: "", taxPct: "", expectedDate: "", remarks: "" });
const str = (x: number) => (x ? String(x) : "");

export function SalesDocEditor({ docType, docId }: { docType: SalesDocType; docId?: number }) {
  const L = DOC_LABEL[docType];
  const base = `/sales/${docType}`;
  const router = useRouter();
  const fmt = useFmt();
  const money = (x: number) => fmt.money(x);
  const toast = useToast();
  const Icon = docType === "order" ? ClipboardList : FileText;

  const [loadingDoc, setLoadingDoc] = useState(!!docId);
  // Tax mode is driven by POS Configuration (not a manual toggle), like the invoice.
  const [taxIncl, setTaxIncl] = useState(true);
  const [custQuery, setCustQuery] = useState(""); const [custMatches, setCustMatches] = useState<CustomerHit[] | null>(null); const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [pq, setPq] = useState(""); const [hits, setHits] = useState<ProductHit[]>([]);
  const [discountMode, setDiscountMode] = useState<"line" | "bill">("line");
  const [billDisc, setBillDisc] = useState(""); const [billDiscType, setBillDiscType] = useState<"pct" | "val">("pct");
  const [interState, setInterState] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // header fields
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [keyDate, setKeyDate] = useState(""); // validUntil (quotation) / expectedDeliveryDate (order)
  const [salesperson, setSalesperson] = useState(""); const [enquiryNo, setEnquiryNo] = useState(""); const [enquiryDate, setEnquiryDate] = useState("");
  const [customerRef, setCustomerRef] = useState(""); const [customerContact, setCustomerContact] = useState("");
  const [warehouse, setWarehouse] = useState(""); const [deliveryAddress, setDeliveryAddress] = useState(""); const [shippingMode, setShippingMode] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(""); const [creditDays, setCreditDays] = useState(""); const [dueDate, setDueDate] = useState(""); const [currency, setCurrency] = useState("INR");
  const [freight, setFreight] = useState(""); const [loading2, setLoading2] = useState(""); const [packing, setPacking] = useState(""); const [insurance, setInsurance] = useState(""); const [otherCharges, setOtherCharges] = useState(""); const [roundOff, setRoundOff] = useState("");
  const [remarks, setRemarks] = useState(""); const [internalNotes, setInternalNotes] = useState(""); const [termsConditions, setTermsConditions] = useState("");
  const [attachments, setAttachments] = useState<{ fileName: string; fileUrl: string; fileType?: string | null; size: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Tax method from POS Configuration (inclusive/exclusive) — same as the invoice.
  useEffect(() => {
    fetch("/api/settings/pos", { cache: "no-store" }).then((r) => r.json()).then((p) => { if (p.ok && p.config?.taxMethod) setTaxIncl(p.config.taxMethod !== "exclusive"); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!docId) return;
    fetch(`/api/sales/${docType}/${docId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.ok) { toast.error(j.message || "Could not load."); return; }
      const d: SalesDocDetail = j.data;
      setCustomer({ id: d.customerId ?? 0, name: d.customerName, gstin: d.customerGstin, phone: d.customerPhone, contactPerson: d.customerContact }); setCustQuery(d.customerName);
      setTaxIncl(d.gstMode === "inclusive"); // preserve the document's stored tax mode when editing
      setDocDate(d.docDate); setKeyDate(docType === "order" ? d.expectedDeliveryDate : d.validUntil);
      setSalesperson(d.salesperson); setEnquiryNo(d.enquiryNo); setEnquiryDate(d.enquiryDate); setCustomerRef(d.customerRef); setCustomerContact(d.customerContact);
      setWarehouse(d.warehouse); setDeliveryAddress(d.deliveryAddress); setShippingMode(d.shippingMode);
      setPaymentTerms(d.paymentTerms); setCreditDays(d.creditDays != null ? String(d.creditDays) : ""); setDueDate(d.dueDate); setCurrency(d.currency);
      setInterState(d.interState);
      setDiscountMode(d.additionalDiscount > 0 ? "bill" : "line");
      if (d.additionalDiscount > 0) { setBillDisc(str(d.additionalDiscount)); setBillDiscType("val"); }
      setFreight(str(d.freight)); setLoading2(str(d.loading)); setPacking(str(d.packing)); setInsurance(str(d.insurance)); setOtherCharges(str(d.otherCharges)); setRoundOff(str(d.roundOff));
      setRemarks(d.remarks); setInternalNotes(d.internalNotes); setTermsConditions(d.termsConditions);
      setLines(d.items.map((it) => ({ key: `e-${it.id}`, productId: it.productId, description: it.productName, sku: it.sku ?? "", hsn: it.hsn ?? "", uom: it.uom ?? "", qty: String(it.qty), rate: String(it.rate), discPct: it.discPct != null ? String(it.discPct) : "", taxPct: it.taxPct != null ? String(it.taxPct) : "", expectedDate: it.expectedDate ?? "", remarks: it.remarks ?? "" })));
      setAttachments(d.attachments.map((a) => ({ fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType, size: a.size })));
      setLoadingDoc(false);
    });
  }, [docId, docType, toast]);

  // customer search
  const custTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCustomers = async (q: string) => { try { const j = await fetch(`/api/masters/customers?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setCustMatches(j.customers ?? []); } catch { toast.error("Could not search customers."); } };
  const onCustQuery = (v: string) => { setCustQuery(v); setCustomer(null); if (custTimer.current) clearTimeout(custTimer.current); if (!v.trim()) { setCustMatches(null); return; } custTimer.current = setTimeout(() => searchCustomers(v), 250); };
  const pickCustomer = (s: CustomerHit) => { setCustomer(s); setCustMatches(null); setCustQuery(s.name); if (s.contactPerson) setCustomerContact(s.contactPerson); };

  // product search
  const prodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchProducts = async (q: string) => { if (!q.trim()) { setHits([]); return; } try { const j = await fetch(`/api/pos/products?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setHits(j.products ?? []); } catch { toast.error("Could not search products."); } };
  const onPq = (v: string) => { setPq(v); if (prodTimer.current) clearTimeout(prodTimer.current); if (!v.trim()) { setHits([]); return; } prodTimer.current = setTimeout(() => searchProducts(v), 220); };
  // Add a product: merge into the existing line for the same product (increment qty),
  // else append a new line — HSN, UOM, rate & GST auto-fill from the product master.
  const addProduct = (p: ProductHit) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id);
      if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], qty: String((n(c[i].qty) || 0) + 1) }; return c; }
      return [...prev, { ...blankLine(), productId: p.id, description: p.name, sku: p.sku ?? "", hsn: p.hsn ?? "", uom: p.uom ?? "", rate: String(p.price ?? 0), taxPct: String(p.gst ?? 0) }];
    });
    setHits([]); setPq("");
  };
  const addBlankLine = () => setLines((prev) => [...prev, blankLine()]);
  const updLine = (key: string, patch: Partial<Line>) => setLines((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((p) => p.filter((l) => l.key !== key));

  const upload = async (files: FileList | null) => { if (!files?.length) return; setUploading(true); for (const f of Array.from(files)) { const fd = new FormData(); fd.append("file", f); const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null); if (j?.ok) setAttachments((a) => [...a, j.file]); else toast.error(j?.message || "Upload failed."); } setUploading(false); };

  // Per-line taxable / tax (GST inclusive vs exclusive per POS config).
  const lineCalc = (l: Line) => {
    const gross = n(l.qty) * n(l.rate);
    const disc = discountMode === "line" && l.discPct ? r2(gross * (n(l.discPct) / 100)) : 0;
    const net = r2(gross - disc);
    const pct = n(l.taxPct);
    const taxable = pct > 0 && taxIncl ? r2(net / (1 + pct / 100)) : net;
    const tax = pct > 0 ? (taxIncl ? r2(net - taxable) : r2(taxable * (pct / 100))) : 0;
    const amount = taxIncl ? net : r2(net + tax);
    return { gross, disc, net, taxable, tax, amount };
  };

  const calc = useMemo(() => {
    let subtotal = 0, itemDisc = 0, taxableAmount = 0, gstAmount = 0, qty = 0;
    for (const l of lines) { const c = lineCalc(l); subtotal = r2(subtotal + c.gross); itemDisc = r2(itemDisc + c.disc); taxableAmount = r2(taxableAmount + c.taxable); gstAmount = r2(gstAmount + c.tax); qty += n(l.qty); }
    const goods = r2(taxableAmount + gstAmount);
    const billDiscAmount = discountMode === "bill" ? (billDiscType === "val" ? Math.min(r2(n(billDisc)), goods) : r2(goods * (n(billDisc) / 100))) : 0;
    const charges = r2(n(freight) + n(loading2) + n(packing) + n(insurance) + n(otherCharges));
    const total = r2(goods + charges - billDiscAmount + n(roundOff));
    const cgst = interState ? 0 : r2(gstAmount / 2); const sgst = interState ? 0 : r2(gstAmount - cgst); const igst = interState ? gstAmount : 0;
    return { subtotal, itemDisc, taxableAmount, gstAmount, goods, billDiscAmount, charges, total, cgst, sgst, igst, qty };
  }, [lines, discountMode, billDisc, billDiscType, interState, taxIncl, freight, loading2, packing, insurance, otherCharges, roundOff]);

  const save = async (saveMode: "Draft" | "Issued") => {
    if (!customer && !custQuery.trim()) { toast.error("Select a customer."); return; }
    const valid = lines.filter((l) => l.description.trim() && n(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one valid line item."); return; }
    setSubmitting(true);
    const payload = {
      customerId: customer?.id || undefined, customerName: customer?.name || custQuery.trim(), customerGstin: customer?.gstin || undefined, customerPhone: customer?.phone || undefined, customerContact: customerContact || undefined, customerRef: customerRef || undefined,
      salesperson: salesperson || undefined, enquiryNo: enquiryNo || undefined, enquiryDate: enquiryDate || undefined,
      docDate, validUntil: docType === "quotation" ? (keyDate || undefined) : undefined, expectedDeliveryDate: docType === "order" ? (keyDate || undefined) : undefined,
      warehouse: warehouse || undefined, deliveryAddress: deliveryAddress || undefined, shippingMode: shippingMode || undefined,
      paymentTerms: paymentTerms || undefined, creditDays: creditDays ? Number(creditDays) : undefined, dueDate: dueDate || undefined, currency: currency || "INR",
      gstMode: taxIncl ? "inclusive" : "exclusive", gstApplicable: true, reverseCharge: false, interState,
      additionalDiscount: discountMode === "bill" ? calc.billDiscAmount : undefined,
      freight: freight || undefined, loading: loading2 || undefined, packing: packing || undefined, insurance: insurance || undefined, otherCharges: otherCharges || undefined, roundOff: roundOff || undefined,
      remarks: remarks || undefined, internalNotes: internalNotes || undefined, termsConditions: termsConditions || undefined, saveMode,
      lines: valid.map((l) => ({ productId: l.productId || undefined, description: l.description.trim(), sku: l.sku || undefined, hsn: l.hsn || undefined, uom: l.uom || undefined, qty: n(l.qty), rate: n(l.rate), taxPct: l.taxPct ? n(l.taxPct) : undefined, discPct: discountMode === "line" && l.discPct ? n(l.discPct) : undefined, expectedDate: l.expectedDate || undefined, remarks: l.remarks || undefined })),
      attachments: attachments.map((a) => ({ fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType ?? undefined, size: a.size })),
    };
    try {
      const res = await fetch(docId ? `/api/sales/${docType}/${docId}` : `/api/sales/${docType}`, { method: docId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Saved."); router.push(`${base}/${docId ?? j.id}`); }
      else { toast.error(j.message || `Could not save the ${L.short.toLowerCase()}.`); setSubmitting(false); }
    } catch { toast.error("Network error — could not save."); setSubmitting(false); }
  };

  const issueLabel = docType === "order" ? (docId ? "Save & Confirm" : "Create & Confirm") : (docId ? "Save & Send" : "Create & Send");
  if (loadingDoc) return <div className="py-16"><AppLoader label={`Loading ${L.short.toLowerCase()}…`} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href={base} className="hover:text-foreground">{L.title}</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{docId ? "Edit" : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> {docId ? `Edit ${L.title}` : `New ${L.title}`}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={docId ? `${base}/${docId}` : base}><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={() => save("Issued")} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {issueLabel}</Button>
        </div>
      </div>

      <div className="flex items-start gap-1.5 rounded-lg border border-info/30 bg-info-subtle/40 px-3 py-2 text-2xs text-info">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Selling price is <strong>{taxIncl ? "inclusive of GST" : "exclusive of GST"}</strong> (POS Configuration). A {L.short.toLowerCase()} is a commitment only — stock &amp; accounts are not affected.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Customer */}
          <SectionCard icon={User} allowOverflow title={<>Customer<span className="text-danger">*</span></>} action={customer && <button onClick={() => { setCustomer(null); setCustQuery(""); }} className="text-2xs font-semibold text-danger hover:underline">Change</button>}>
            {customer && customer.id > 0 ? (
              <div className="rounded-lg bg-primary-subtle/40 px-3 py-2 text-sm">
                <div className="font-semibold text-foreground">{customer.name}{customer.contactPerson ? ` · ${customer.contactPerson}` : ""}</div>
                <div className="text-2xs text-muted">{customer.gstin ? `GSTIN ${customer.gstin}` : "No GSTIN on file"}{customer.phone ? ` · ${customer.phone}` : ""}</div>
              </div>
            ) : (
              <div className="relative">
                <input value={custQuery} onChange={(e) => onCustQuery(e.target.value)} placeholder="Search customer by name / phone…" className={cn(inp, "w-full")} />
                {custMatches !== null && (custMatches.length ? (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                    {custMatches.map((s) => <button key={s.id} onClick={() => pickCustomer(s)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-primary-subtle/40"><span className="font-medium text-foreground">{s.name}</span><span className="text-2xs text-subtle">{s.gstin || s.phone || ""}</span></button>)}
                  </div>
                ) : <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No customers matched.</div>)}
              </div>
            )}
          </SectionCard>

          {/* Product search (highlighted, like the invoice) */}
          <div className="relative rounded-2xl border border-primary/30 bg-primary-subtle/20 p-3 shadow-sm">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary"><Search className="h-3.5 w-3.5" /> Add product (name · SKU · barcode) — HSN, UOM, rate &amp; GST auto-load from master</label>
            <div className="flex gap-2">
              <input value={pq} onChange={(e) => onPq(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { e.preventDefault(); addProduct(hits[0]); } }} placeholder="Type or scan…" className="h-10 w-full rounded-lg border border-primary/40 bg-card px-3 text-sm focus:border-primary focus:outline-none" />
              <Button variant="outline" size="md" onClick={addBlankLine}><Plus className="h-4 w-4" /> Free-text</Button>
            </div>
            {pq && hits.length > 0 && (
              <div className="absolute left-3 right-3 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
                {hits.map((h) => (
                  <button key={h.id} onClick={() => addProduct(h)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-primary-subtle/50">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{h.name}</span><span className="font-mono text-2xs text-subtle">{h.sku || "—"}{h.hsn ? ` · HSN ${h.hsn}` : ""}{h.uom ? ` · ${h.uom}` : ""} · {h.gst ?? 0}% GST</span></span>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-foreground">{money(h.price ?? 0)} <Plus className="h-3.5 w-3.5 text-primary" /></span>
                  </button>
                ))}
              </div>
            )}
            {pq && hits.length === 0 && <div className="absolute left-3 right-3 z-30 mt-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted shadow-xl">No product found.</div>}
          </div>

          {/* Items */}
          <SectionCard icon={Boxes} title={`${L.short} Items`} bodyClass=""
            action={
              <div className="flex items-center gap-1.5 text-2xs">
                <span className="font-medium text-muted">Discount:</span>
                <div className="inline-flex overflow-hidden rounded-md border border-border">
                  {([["line", "Line-wise"], ["bill", "Whole bill"]] as const).map(([m, lbl]) => (
                    <button key={m} type="button" onClick={() => setDiscountMode(m)} className={cn("px-2.5 py-1 font-semibold transition", discountMode === m ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
                  ))}
                </div>
              </div>
            }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                  <th className="px-2 py-2.5">Item</th><th className="px-2 py-2.5">HSN</th><th className="px-2 py-2.5">UOM</th><th className="px-2 py-2.5 text-right">Qty</th><th className="px-2 py-2.5 text-right">Rate</th>{discountMode === "line" && <th className="px-2 py-2.5 text-right">Disc %</th>}<th className="px-2 py-2.5 text-right">GST %</th><th className="px-2 py-2.5 text-right">Taxable</th><th className="px-2 py-2.5 text-right">Amount</th><th className="px-2 py-2.5" />
                </tr></thead>
                <tbody>
                  {lines.map((l) => { const c = lineCalc(l); return (
                    <tr key={l.key} className="border-b border-border last:border-0 align-middle">
                      <td className="px-2 py-1.5"><input value={l.description} onChange={(e) => updLine(l.key, { description: e.target.value })} placeholder="Item description" className={cn(inpSm, "w-full min-w-[160px]")} />{l.productId ? <span className="ml-1 text-[10px] text-subtle">{l.sku}</span> : null}</td>
                      <td className="px-2 py-1.5"><input value={l.hsn} onChange={(e) => updLine(l.key, { hsn: e.target.value })} className={cn(inpSm, "w-16")} /></td>
                      <td className="px-2 py-1.5"><input value={l.uom} onChange={(e) => updLine(l.key, { uom: e.target.value })} className={cn(inpSm, "w-14")} /></td>
                      <td className="px-2 py-1.5"><div className="flex items-center justify-end gap-1"><input type="number" value={l.qty} onChange={(e) => updLine(l.key, { qty: e.target.value })} className={cn(inpSm, "w-16 text-right")} /><UomConvert qty={l.qty} uom={l.uom} onChange={(v) => updLine(l.key, { qty: String(v) })} /></div></td>
                      <td className="px-2 py-1.5"><input type="number" value={l.rate} onChange={(e) => updLine(l.key, { rate: e.target.value })} className={cn(inpSm, "w-20 text-right")} /></td>
                      {discountMode === "line" && <td className="px-2 py-1.5"><input type="number" value={l.discPct} onChange={(e) => updLine(l.key, { discPct: e.target.value })} className={cn(inpSm, "w-14 text-right")} /></td>}
                      <td className="px-2 py-1.5"><input type="number" value={l.taxPct} onChange={(e) => updLine(l.key, { taxPct: e.target.value })} className={cn(inpSm, "w-14 text-right")} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted">{money(c.taxable)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-foreground">{money(c.amount)}</td>
                      <td className="px-2 py-1.5 text-center"><button onClick={() => removeLine(l.key)} className="text-subtle hover:text-danger"><X className="h-4 w-4" /></button></td>
                    </tr>
                  ); })}
                  {lines.length === 0 && <tr><td colSpan={discountMode === "line" ? 10 : 9} className="px-4 py-12 text-center text-sm text-muted">Search a product above to add {L.short.toLowerCase()} lines.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 px-1 text-2xs text-subtle">GST is {taxIncl ? "included in" : "added on top of"} the rate. Discount is applied {discountMode === "line" ? "per line" : "on the whole bill (enter it in the Summary)"}. {interState ? "Inter-state — GST posts to IGST." : "Intra-state — GST splits into CGST + SGST."}</p>
          </SectionCard>

          {/* Details & Terms */}
          <SectionCard icon={FileText} title={`${L.title} Details & Terms`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fld label={L.keyDate}><input type="date" value={keyDate} onChange={(e) => setKeyDate(e.target.value)} className={inp} /></Fld>
              <Fld label="Salesperson"><input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className={inp} /></Fld>
              <Fld label="GST Supply Type"><select value={interState ? "inter" : "intra"} onChange={(e) => setInterState(e.target.value === "inter")} className={inp}><option value="intra">Intra-state (CGST + SGST)</option><option value="inter">Inter-state (IGST)</option></select></Fld>
              <Fld label="Enquiry / Ref No"><input value={enquiryNo} onChange={(e) => setEnquiryNo(e.target.value)} className={inp} /></Fld>
              <Fld label="Enquiry Date"><input type="date" value={enquiryDate} onChange={(e) => setEnquiryDate(e.target.value)} className={inp} /></Fld>
              <Fld label="Customer Ref / PO No"><input value={customerRef} onChange={(e) => setCustomerRef(e.target.value)} className={inp} /></Fld>
              <Fld label="Contact Person"><input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} className={inp} /></Fld>
              <Fld label="Deliver From (Warehouse)"><input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className={inp} /></Fld>
              <Fld label="Shipping Mode"><select value={shippingMode} onChange={(e) => setShippingMode(e.target.value)} className={inp}>{SHIP.map((s) => <option key={s} value={s}>{s || "—"}</option>)}</select></Fld>
              <Fld label="Delivery Address"><input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={inp} /></Fld>
              <Fld label="Payment Terms"><input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Net 30" className={inp} /></Fld>
              <Fld label="Credit Days"><input type="number" value={creditDays} onChange={(e) => setCreditDays(e.target.value)} className={inp} /></Fld>
              <Fld label="Due Date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} /></Fld>
              <Fld label="Currency"><input value={currency} onChange={(e) => setCurrency(e.target.value)} className={inp} /></Fld>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Fld label="Freight"><input type="number" value={freight} onChange={(e) => setFreight(e.target.value)} className={inp} placeholder="0.00" /></Fld>
              <Fld label="Loading"><input type="number" value={loading2} onChange={(e) => setLoading2(e.target.value)} className={inp} placeholder="0.00" /></Fld>
              <Fld label="Packing"><input type="number" value={packing} onChange={(e) => setPacking(e.target.value)} className={inp} placeholder="0.00" /></Fld>
              <Fld label="Insurance"><input type="number" value={insurance} onChange={(e) => setInsurance(e.target.value)} className={inp} placeholder="0.00" /></Fld>
              <Fld label="Other Charges"><input type="number" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} className={inp} placeholder="0.00" /></Fld>
              <Fld label="Round Off"><input type="number" value={roundOff} onChange={(e) => setRoundOff(e.target.value)} className={inp} placeholder="0.00" /></Fld>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Fld label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld>
              <Fld label="Internal Notes"><textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld>
              <div className="sm:col-span-2"><Fld label="Terms & Conditions"><textarea value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} placeholder="Validity, delivery, warranty clauses…" /></Fld></div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-2xs font-semibold text-muted">Attachments</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted transition hover:border-primary/40 hover:text-primary">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} Attach documents (PDF / image)
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
                </label>
                {attachments.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary-subtle px-2 py-0.5 text-2xs font-medium text-primary"><FileText className="h-3 w-3" /><a href={a.fileUrl} target="_blank" rel="noreferrer" className="hover:underline">{a.fileName}</a><button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="hover:text-danger"><X className="h-3 w-3" /></button></span>)}</div>}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT */}
        <aside className="space-y-4">
          <SectionCard icon={docType === "order" ? ClipboardList : FileText} title="Document">
            <div className="space-y-3">
              <Fld label={`${L.number}`}><input readOnly value="Auto on save" className={cn(inp, "bg-surface-2 font-mono text-primary")} /></Fld>
              <Fld label={`${L.short} Date`}><input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className={inp} /></Fld>
            </div>
          </SectionCard>

          <SectionCard icon={IndianRupee} title="Summary">
            <div className="space-y-1.5 text-sm">
              <Row k={`Items (${fmt.qty(calc.qty)})`} v={money(calc.subtotal)} />
              {discountMode === "line" && calc.itemDisc > 0 && <Row k="Item Discount" v={`− ${money(calc.itemDisc)}`} />}
              {discountMode === "bill" && (
                <div className="flex items-center justify-between gap-2"><span className="text-muted">Bill Discount</span><div className="flex items-center gap-1"><input type="number" value={billDisc} onChange={(e) => setBillDisc(e.target.value)} placeholder="0" className="h-7 w-20 rounded border border-border-strong bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" /><button onClick={() => setBillDiscType(billDiscType === "pct" ? "val" : "pct")} className="grid h-7 w-7 place-items-center rounded border border-border bg-surface text-2xs font-bold text-muted hover:text-primary">{billDiscType === "pct" ? "%" : "₹"}</button></div></div>
              )}
              {discountMode === "bill" && calc.billDiscAmount > 0 && <Row k="Discount Applied" v={`− ${money(calc.billDiscAmount)}`} />}
              <Row k="Taxable Value" v={money(calc.taxableAmount)} />
              {interState ? <Row k="IGST" v={money(calc.igst)} /> : <><Row k="CGST" v={money(calc.cgst)} /><Row k="SGST" v={money(calc.sgst)} /></>}
              {calc.charges > 0 && <Row k="Charges" v={money(calc.charges)} />}
              {n(roundOff) !== 0 && <Row k="Round Off" v={money(n(roundOff))} />}
              <div className="my-1.5 h-px bg-border" />
              <div className="flex items-center justify-between text-lg font-bold text-primary"><span>Net Value</span><span>{money(calc.total)}</span></div>
            </div>
            <div className="mt-3 space-y-2">
              <Button size="lg" className="w-full" onClick={() => save("Issued")} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {issueLabel}</Button>
              <Button variant="outline" size="lg" className="w-full" onClick={() => save("Draft")} disabled={submitting}><Save className="h-4 w-4" /> Save as Draft</Button>
            </div>
            <p className="mt-2 text-center text-2xs text-subtle">A {L.short.toLowerCase()} is a commitment — no stock or accounting impact.</p>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const inpSm = "h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
function Row({ k, v }: { k: string; v: string }) { return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="text-foreground">{v}</span></div>; }
