"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptText, Search, Plus, Trash2, ArrowLeft, Building2, Info, CheckCircle2, Save, X, Paperclip, FileText, Upload, Boxes, IndianRupee, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatMoneyWith, formatQtyWith } from "@/lib/settings/generalConfig";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { UomConvert } from "@/components/uom/UomConvert";
import { BankPicker, emptyBank } from "@/components/finance/BankPicker";

interface Hit { id: number; name: string; sku: string; hsn: string; uom: string; mrp: number; price: number; gst: number; stock: number;
  // Batch tracking — returned by /api/pos/products. batchNo/mfgDate/expiryDate are
  // populated only when `q` was a scanned QR that resolves to a specific batch.
  batchTracked?: boolean; invBatch?: boolean; invMfg?: boolean; invExpiry?: boolean; batchNo?: string | null; mfgDate?: string | null; expiryDate?: string | null;
  // Valuation policy — drives FEFO/FIFO batch priority and out-of-order validation.
  valuation?: string; batchSalesPolicy?: string;
  // Single-use QR — populated only when `q` was a scanned QR code. qrMode is
  // "unique" (single-use) or "shared"; qrSold is true if a unique code is already sold.
  qrCode?: string | null; qrMode?: string | null; qrSold?: boolean }
/** A pickable batch of a product (from inventory stock) for the billing screen.
 * `priority` is 1-based and ordered by valuation (FEFO/FIFO) — priority 1 = recommended. */
interface BatchOpt { priority: number; batchNo: string | null; mfgDate: string | null; expiryDate: string | null; qtyOnHand: number; sellingRate?: number; purchaseRate?: number }
interface Line { key: string; id: number; name: string; sku: string; hsn: string; uom: string; mrp: number; rate: number; gst: number; stock: number; qty: number; disc: number; discType: "pct" | "val";
  // Batch tracking — carried from the scanned/searched product. The sold batch is
  // sent to /api/sales/invoice so inventory consumes the exact batch. `batches` holds
  // the available batches in stock when the product was added by search (manual pick).
  batchTracked?: boolean; invBatch?: boolean; invMfg?: boolean; invExpiry?: boolean; batchNo?: string | null; mfgDate?: string | null; expiryDate?: string | null; batches?: BatchOpt[];
  // Valuation-aware batch picking. `batchPriority` = the 1-based priority of the picked
  // batch (1 = recommended); `enforce` is false for "notRequired" valuation; out-of-order
  // = enforce && batchPriority > 1 — restricted under "restrict", warned under "warn".
  valuation?: string; batchSalesPolicy?: string; batchOrder?: string; enforce?: boolean; batchPriority?: number;
  // Single-use UNIQUE QR codes scanned onto this line. One code per unit; each valid
  // scan appends a code and increments qty by one. Sent to /api/sales/invoice.
  qrCodes?: string[] }
interface Cust { id: number; name: string; gstin: string; phone: string; email?: string; contactPerson?: string; address?: string; city?: string; state: string; pincode?: string }
interface Attach { fileName: string; fileUrl: string; fileType: string | null; size: number }
type DiscLevel = "item" | "bill";
type PayCat = "full" | "partial" | "credit";
const n = (v: unknown) => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_CUST = { name: "", gstin: "", phone: "", email: "", contactPerson: "", address: "", city: "", state: "", pincode: "" };

// Field validators — return an error string or "" when valid.
const RE_GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_PHONE = /^[0-9]{10}$/;
const RE_PIN = /^[0-9]{6}$/;
function validateCust(c: typeof EMPTY_CUST, gstMandatory: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!c.name.trim()) e.name = "Business name is required.";
  const g = c.gstin.trim().toUpperCase();
  if (gstMandatory && !g) e.gstin = "GSTIN is required.";
  else if (g && !RE_GSTIN.test(g)) e.gstin = "Invalid GSTIN (15 chars, e.g. 29ABCDE1234F1Z5).";
  if (c.phone.trim() && !RE_PHONE.test(c.phone.trim())) e.phone = "Enter a 10-digit phone number.";
  if (c.email.trim() && !RE_EMAIL.test(c.email.trim())) e.email = "Enter a valid email address.";
  if (c.pincode.trim() && !RE_PIN.test(c.pincode.trim())) e.pincode = "Pincode must be 6 digits.";
  return e;
}

export function B2bInvoiceForm() {
  const router = useRouter();
  const [taxIncl, setTaxIncl] = useState(true);
  const [custMandatory, setCustMandatory] = useState(true);
  const [gstMandatory, setGstMandatory] = useState(true);
  // Amount / quantity decimals follow General Settings.
  const gcfg = useGeneralConfig();
  const inr = (x: number) => formatMoneyWith(gcfg, x);
  const fq = (x: number) => formatQtyWith(gcfg, x);

  const [cust, setCust] = useState<Cust | null>(null);
  const [custQuery, setCustQuery] = useState("");
  const [custHits, setCustHits] = useState<Cust[]>([]);
  const [addingCust, setAddingCust] = useState(false);
  const [newCust, setNewCust] = useState({ ...EMPTY_CUST });

  const [saleDate, setSaleDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [soNumber, setSoNumber] = useState("");
  const [interState, setInterState] = useState(false);
  // Bill from an existing Sales Order (auto-fill customer + lines).
  const [billSource, setBillSource] = useState<"none" | "order">("none");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderHits, setOrderHits] = useState<{ id: number; docNo: string; customerName: string; customerGstin: string; netAmount: number; status: string }[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(false);
  // Customer advances available to apply against this invoice (Advance Management).
  const [avail, setAvail] = useState<{ id: number; advanceNo: string; advanceDate: string; advanceTypeName: string; balance: number }[]>([]);
  const [advAdj, setAdvAdj] = useState<Record<number, string>>({});
  const [custNote, setCustNote] = useState("");
  const [terms, setTerms] = useState("");

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [discLevel, setDiscLevel] = useState<DiscLevel>("item");
  const [billDisc, setBillDisc] = useState("");
  const [billDiscType, setBillDiscType] = useState<"pct" | "val">("pct");

  const [tdsInput, setTdsInput] = useState("");
  const [tdsMode, setTdsMode] = useState<"pct" | "val">("pct");
  const [tcsInput, setTcsInput] = useState("");
  const [tcsMode, setTcsMode] = useState<"pct" | "val">("pct");

  const [payCat, setPayCat] = useState<PayCat>("credit");
  const [amtPaid, setAmtPaid] = useState("");
  const [payMode, setPayMode] = useState("Bank Transfer");
  const [bank, setBank] = useState(emptyBank);

  const [custErr, setCustErr] = useState<Record<string, string>>({});

  const [attachments, setAttachments] = useState<Attach[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warn, setWarn] = useState("");
  const flash = (m: string) => { setWarn(m); window.setTimeout(() => setWarn(""), 2400); };

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([
          fetch("/api/settings/sales", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/settings/pos", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (s.ok && s.config?.flags) { setCustMandatory(s.config.flags.custMasterMandatory !== false); setGstMandatory(s.config.flags.gstMandatoryB2b !== false); }
        if (p.ok && p.config?.taxMethod) setTaxIncl(p.config.taxMethod !== "exclusive");
      } catch { /* defaults */ }
    })();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => { try { const j = await fetch(`/api/pos/products?q=${encodeURIComponent(query)}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); if (j.ok) setHits(j.products); } catch { /* */ } }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  useEffect(() => {
    if (!custQuery.trim()) { setCustHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => { try { const j = await fetch(`/api/masters/customers?q=${encodeURIComponent(custQuery)}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); if (j.ok) setCustHits(j.customers); } catch { /* */ } }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [custQuery]);

  // Sales-order lookup (empty query returns recent billable orders).
  useEffect(() => {
    if (billSource !== "order") { setOrderHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => { try { const j = await fetch(`/api/sales/order/lookup?q=${encodeURIComponent(orderQuery)}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); if (j.ok) setOrderHits(j.rows); } catch { /* */ } }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [orderQuery, billSource]);

  async function loadOrder(id: number) {
    setLoadingOrder(true);
    try {
      const j = await fetch(`/api/sales/order/lookup/${id}`, { cache: "no-store" }).then((r) => r.json());
      if (!j.ok) { setError(j.message || "Could not load the sales order."); return; }
      const o = j.order;
      const c = o.customer;
      setCust({ id: c.id, name: c.name, gstin: c.gstin, phone: c.phone, email: c.email, contactPerson: c.contactPerson, address: c.address, city: c.city, state: c.state, pincode: c.pincode });
      setCustQuery("");
      setSoNumber(o.soNumber);
      setInterState(!!o.interState);
      if (o.paymentTerms) setPaymentTerms(o.paymentTerms);
      if (o.dueDate) setDueDate(o.dueDate);
      if (o.termsConditions) setTerms(o.termsConditions);
      setLines((o.lines as Array<{ productId: number; name: string; sku: string; hsn: string; uom: string; mrp: number; rate: number; gst: number; qty: number; disc: number; discType: "pct" | "val" }>).map((l, i) => ({
        key: `so-${i}-${l.productId || 0}`, id: l.productId || 0, name: l.name, sku: l.sku || "", hsn: l.hsn || "", uom: l.uom || "", mrp: l.mrp || l.rate || 0, rate: l.rate || 0, gst: l.gst || 0, stock: 0, qty: l.qty || 1, disc: l.disc || 0, discType: l.discType || "pct",
      })));
      setOrderHits([]); setOrderQuery("");
      flash(`Loaded from ${o.soNumber}`);
    } finally { setLoadingOrder(false); }
  }

  // Deep-link from a Sales Order's "Create Invoice" button (?fromOrder=<id>).
  useEffect(() => {
    const fromOrder = new URLSearchParams(window.location.search).get("fromOrder");
    if (fromOrder && Number(fromOrder) > 0) { setBillSource("order"); loadOrder(Number(fromOrder)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addHit(h: Hit) {
    // Single-use UNIQUE QR — each code may be sold once. Block already-sold codes and
    // duplicate scans of the same code within this invoice; otherwise add/merge as
    // usual and record the code on the line (one code per unit). Shared-mode QR and
    // plain product-search hits keep the normal behaviour below.
    const isUnique = !!(h.qrCode && h.qrMode === "unique");
    if (isUnique) {
      if (h.qrSold) { setError(`QR code ${h.qrCode} has already been sold — it can't be used again.`); setQuery(""); setHits([]); return; }
      if (lines.some((l) => l.qrCodes?.includes(h.qrCode!))) { setError(`QR code ${h.qrCode} is already scanned in this invoice.`); setQuery(""); setHits([]); return; }
    }
    // A scanned QR carries the specific batch → merge only with a line of the same
    // product AND batch, so different batches of one product stay on separate lines.
    const batchNo = h.batchNo ?? null;
    const lineKey = batchNo ? `${h.id}::${batchNo}` : String(h.id);
    const existing = lines.find((l) => l.key === lineKey);
    const nextQty = (existing?.qty ?? 0) + 1;
    if (h.stock > 0 && nextQty > h.stock) { flash(`Only ${h.stock} ${h.uom} of "${h.name}" in stock`); setQuery(""); setHits([]); return; }
    if (h.stock <= 0) flash(`"${h.name}" is out of stock — added anyway`);
    // Record the scanned code for ANY mode (unique or shared) so every scan is stored
    // one-row-per-code server-side. Searched lines (no scan) carry no code.
    const code = h.qrCode ?? null;
    setLines((c) => { const i = c.findIndex((l) => l.key === lineKey); if (i >= 0) { const x = [...c]; x[i] = { ...x[i], qty: x[i].qty + 1, qrCodes: code ? [...(x[i].qrCodes ?? []), code] : x[i].qrCodes }; return x; } return [...c, { key: lineKey, id: h.id, name: h.name, sku: h.sku, hsn: h.hsn, uom: h.uom, mrp: h.mrp, rate: h.price, gst: h.gst, stock: h.stock, qty: 1, disc: 0, discType: "pct", batchTracked: h.batchTracked, invBatch: h.invBatch, invMfg: h.invMfg, invExpiry: h.invExpiry, batchNo, mfgDate: h.mfgDate ?? null, expiryDate: h.expiryDate ?? null, valuation: h.valuation, batchSalesPolicy: h.batchSalesPolicy, qrCodes: code ? [code] : undefined }]; });
    setQuery(""); setHits([]);
    // Batch-tracked product → load its in-stock batches so we know the FEFO/FIFO
    // priority order. For a SEARCHED product the user picks the batch; for a SCANNED
    // product (already carries batchNo) we still load to learn priority + validate.
    if (h.batchTracked) loadBatchesForLine(lineKey, h.id);
  }

  // Out-of-order = enforced valuation AND the picked batch is not priority 1. Returns
  // an error string (policy "restrict") or "" (allowed / warn / not enforced). The
  // banner names the product, the picked batch + its priority, and the priority-1 batch.
  function batchOrderError(l: Line): string {
    if (!(l.enforce && l.batchPriority && l.batchPriority > 1)) return "";
    if (l.batchSalesPolicy !== "restrict") return "";
    const p1 = l.batches?.find((b) => b.priority === 1);
    const ord = l.batchOrder ? `${l.batchOrder} ` : "";
    return `"${l.name}": batch ${l.batchNo || "(no batch)"} is priority ${l.batchPriority} — ${ord}rules require the priority-1 batch${p1?.batchNo ? ` "${p1.batchNo}"` : ""}.`;
  }

  // Fetch a product's available batches and attach them to its line, learning the
  // FEFO/FIFO order. Auto-selects priority 1 by default (single- AND multi-batch). If a
  // scanned batch was already on the line, keep it but stamp its priority + validate.
  // Uses a functional update keyed to the line so it never relies on a stale closure.
  async function loadBatchesForLine(key: string, productId: number) {
    try {
      const j = await fetch(`/api/pos/batches?productId=${productId}`, { cache: "no-store" }).then((r) => r.json());
      if (!j.ok) return;
      const batches: BatchOpt[] = j.batches ?? [];
      const enforce: boolean = !!j.enforce;
      const order: string | undefined = j.order ?? undefined;
      const valuation: string | undefined = j.valuation ?? undefined;
      const policy: string | undefined = j.batchSalesPolicy ?? undefined;
      setLines((c) => c.map((l) => {
        if (l.key !== key) return l;
        const base = { ...l, batches, enforce, batchOrder: order, valuation: valuation ?? l.valuation, batchSalesPolicy: policy ?? l.batchSalesPolicy };
        // Scanned line already carries a batch → keep it, stamp its priority for validation.
        if (l.batchNo) {
          const picked = batches.find((b) => (b.batchNo ?? "") === l.batchNo);
          return { ...base, batchPriority: picked?.priority };
        }
        // Otherwise auto-select the recommended priority-1 batch (single or multi).
        const p1 = batches.find((b) => b.priority === 1) ?? batches[0];
        if (p1) return { ...base, batchNo: p1.batchNo, mfgDate: p1.mfgDate, expiryDate: p1.expiryDate, batchPriority: p1.priority };
        return base;
      }));
    } catch { /* ignore */ }
  }

  // Manual batch selection from the in-line dropdown — stamp the chosen batch's
  // priority so the out-of-order chip / submit-block can validate it.
  function selectBatch(key: string, batchNo: string) {
    setLines((c) => c.map((l) => {
      if (l.key !== key) return l;
      const o = l.batches?.find((x) => (x.batchNo ?? "") === batchNo);
      return { ...l, batchNo: batchNo || null, mfgDate: o?.mfgDate ?? null, expiryDate: o?.expiryDate ?? null, batchPriority: o?.priority };
    }));
  }
  // Editing qty must never delete the line (clearing the field briefly makes it 0);
  // removal is only via the trash button.
  function setQty(key: string, q: number) {
    const l = lines.find((x) => x.key === key);
    if (l && l.stock > 0 && q > l.stock) { flash(`Only ${l.stock} ${l.uom} of "${l.name}" in stock`); q = l.stock; }
    setLines((c) => c.map((x) => (x.key === key ? { ...x, qty: Math.max(0, q) } : x)));
  }
  const upd = (key: string, patch: Partial<Line>) => setLines((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((c) => c.filter((l) => l.key !== key));

  async function saveCustomer() {
    const errs = validateCust(newCust, gstMandatory);
    setCustErr(errs);
    // Surface the first issue (e.g. "GSTIN is required") so the user knows what to fix.
    if (Object.keys(errs).length) { flash(Object.values(errs)[0]); return; }
    try {
      const res = await fetch("/api/masters/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newCust, gstin: newCust.gstin.trim().toUpperCase() }) });
      const j = await res.json().catch(() => ({}));
      if (j.ok) { setCust(j.customer); setAddingCust(false); setNewCust({ ...EMPTY_CUST }); setCustErr({}); }
      else { if (j.errors) setCustErr(j.errors); flash(j.message || "Could not save customer."); }
    } catch { flash("Could not reach the server. Please try again."); }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append("file", f);
      const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) setAttachments((a) => [...a, j.file]); else flash(j.message || "Upload failed");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Item-level discount only applies when the discount level is "item".
  const lineNet = (l: Line) => { const g = l.qty * l.rate; const d = discLevel === "item" ? (l.discType === "val" ? Math.min(l.disc || 0, g) : g * (l.disc || 0) / 100) : 0; return g - d; };
  const lineTax = (l: Line) => { if (!(l.gst > 0)) return 0; const net = lineNet(l); return taxIncl ? +(net - net / (1 + l.gst / 100)).toFixed(2) : +(net * l.gst / 100).toFixed(2); };

  const t = useMemo(() => {
    let subtotal = 0, itemDisc = 0, taxable = 0, tax = 0, qty = 0;
    for (const l of lines) {
      const gross = l.qty * l.rate, net = lineNet(l), disc = gross - net;
      const tv = taxIncl ? (l.gst > 0 ? net / (1 + l.gst / 100) : net) : net;
      subtotal += gross; itemDisc += disc; taxable += tv; tax += lineTax(l); qty += l.qty;
    }
    const netOfItem = subtotal - itemDisc;
    const bd = discLevel === "bill" ? n(billDisc) : 0;
    const billDiscount = discLevel === "bill" ? (billDiscType === "val" ? Math.min(bd, netOfItem) : netOfItem * bd / 100) : 0;
    const pre = netOfItem - billDiscount + (taxIncl ? 0 : tax);
    const total = Math.round(pre);
    return { subtotal, itemDisc, billDiscount, taxable: +taxable.toFixed(2), tax: +tax.toFixed(2), roundOff: +(total - pre).toFixed(2), total, qty };
  }, [lines, discLevel, billDisc, billDiscType, taxIncl]);

  // Fetch the customer's open advances when the customer changes.
  useEffect(() => {
    if (!cust?.id) { setAvail([]); setAdvAdj({}); return; }
    fetch(`/api/finance/advance/available?partyType=Customer&partyId=${cust.id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setAvail(j.rows); }).catch(() => {});
  }, [cust?.id]);
  const advanceTotal = +Object.entries(advAdj).reduce((s, [id, v]) => { const a = avail.find((x) => x.id === Number(id)); return s + Math.min(n(v), a?.balance ?? 0); }, 0).toFixed(2);

  const igst = interState ? t.tax : 0;
  const cgst = interState ? 0 : +(t.tax / 2).toFixed(2);
  const sgst = interState ? 0 : +(t.tax - cgst).toFixed(2);
  // TCS is added to the invoice; TDS is withheld by the customer at payment.
  // Each can be entered as a percentage of the sub-total OR a direct amount.
  const tcsAmt = +(tcsMode === "val" ? n(tcsInput) : t.total * (n(tcsInput) / 100)).toFixed(2);
  const tdsAmt = +(tdsMode === "val" ? n(tdsInput) : t.total * (n(tdsInput) / 100)).toFixed(2);
  const grandTotal = +(t.total + tcsAmt).toFixed(2);
  const payable = +(grandTotal - tdsAmt).toFixed(2);
  // Advance applied counts as already paid → the cash to collect is what's left.
  const netAfterAdvance = +Math.max(0, payable - advanceTotal).toFixed(2);
  const paidNow = payCat === "full" ? netAfterAdvance : payCat === "partial" ? n(amtPaid) : 0;
  const effectivePaid = +(paidNow + advanceTotal).toFixed(2);
  const payStatus = effectivePaid <= 0 ? "Credit" : effectivePaid >= payable ? "Paid" : "Partial";

  // Show the Batch / Mfg / Exp columns only when at least one line is batch-tracked or
  // carries a batchNo (mixed invoices — non-batch lines show "—").
  const showBatchCols = lines.some((l) => l.batchTracked || !!l.batchNo);

  async function save() {
    setError("");
    if (!lines.length) { setError("Add at least one line item."); return; }
    if (custMandatory && !cust) { setError("Select a business customer (required by Sales Settings → B2B)."); return; }
    if (gstMandatory && !(cust?.gstin && cust.gstin.trim())) { setError("Customer GSTIN is mandatory for a B2B invoice."); return; }
    if (payCat === "partial" && (paidNow <= 0 || paidNow >= netAfterAdvance)) { setError("Enter a partial amount greater than 0 and less than the balance after advance."); return; }
    if (advanceTotal > payable + 0.01) { setError("Advance applied exceeds the net payable."); return; }
    // A batch-tracked line must have a batch chosen before the invoice can be created.
    const noBatch = lines.find((l) => l.qty > 0 && l.batchTracked && !l.batchNo);
    if (noBatch) { setError(`Select a batch for "${noBatch.name}" before creating the invoice.`); return; }
    // Out-of-order under a "restrict" valuation policy blocks the invoice; "warn" does not.
    const blocked = lines.find((l) => l.qty > 0 && batchOrderError(l));
    if (blocked) { setError(batchOrderError(blocked)); return; }
    setBusy(true);
    const payload = {
      customerId: cust?.id, saleDate, dueDate, paymentTerms, soNumber, interState, notes: custNote, termsConditions: terms,
      billDiscount: discLevel === "bill" ? n(billDisc) : 0, billDiscType, tdsAmount: tdsAmt, tcsAmount: tcsAmt,
      lines: lines.filter((l) => l.qty > 0).map((l) => ({ productId: l.id, productName: l.name, sku: l.sku, hsn: l.hsn, uom: l.uom, qty: l.qty, mrp: l.mrp, rate: l.rate, disc: discLevel === "item" ? l.disc : 0, discType: l.discType, taxPct: l.gst, batchNo: l.batchNo ?? undefined, mfgDate: l.mfgDate ?? undefined, expiryDate: l.expiryDate ?? undefined, qrCodes: l.qrCodes && l.qrCodes.length ? l.qrCodes : undefined })),
      payments: paidNow > 0 ? [{ mode: payMode, amount: paidNow }] : [],
      bankId: paidNow > 0 && !payMode.toLowerCase().includes("cash") ? bank.bankId : null, bankName: bank.bankName, bankAccount: bank.bankAccount,
      attachments,
      advanceAdjustments: avail.map((a) => ({ advanceId: a.id, amount: Math.min(n(advAdj[a.id]), a.balance) })).filter((x) => x.amount > 0),
    };
    try {
      const res = await fetch("/api/sales/invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.message || "Could not create the invoice."); setBusy(false); return; }
      router.push(`/sales/invoice/${j.id}`);
    } catch { setError("Network error."); setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales/invoice" className="hover:text-foreground">Sales Invoice (B2B)</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ReceiptText className="h-5 w-5 text-primary" /> New B2B Invoice</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/invoice"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Create Invoice"}</Button>
        </div>
      </div>

      <div className="flex items-start gap-1.5 rounded-lg border border-info/30 bg-info-subtle/40 px-3 py-2 text-2xs text-info">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Selling price is <strong>{taxIncl ? "inclusive of GST" : "exclusive of GST"}</strong> (POS Configuration). Customer master is <strong>{custMandatory ? "required" : "optional"}</strong> and GSTIN is <strong>{gstMandatory ? "mandatory" : "optional"}</strong> (Sales Settings → B2B).</span>
      </div>

      {/* Bill from a new invoice or an existing Sales Order (auto-fill) */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-2xs font-bold uppercase tracking-wide text-subtle">Bill From</span>
          <div className="inline-flex rounded-md bg-surface-2 p-0.5">
            {([["none", "New Invoice"], ["order", "Sales Order"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => { setBillSource(v); if (v === "none") { setOrderHits([]); setOrderQuery(""); } }} className={cn("rounded px-3 py-1 text-xs font-semibold transition", billSource === v ? "bg-card text-primary shadow-sm" : "text-muted hover:text-foreground")}>{l}</button>
            ))}
          </div>
          {billSource === "order" && (
            <div className="relative min-w-[240px] flex-1">
              <input value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} placeholder="Search a confirmed sales order (SO no / customer)…" className={cn(inp, "w-full")} />
              {orderHits.length > 0 && (
                <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                  {orderHits.map((o) => <button key={o.id} onClick={() => loadOrder(o.id)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40"><span className="min-w-0"><span className="block font-mono text-xs font-semibold text-primary">{o.docNo}</span><span className="block text-2xs text-subtle">{o.customerName || "—"}{o.customerGstin ? ` · ${o.customerGstin}` : ""}</span></span><span className="shrink-0 text-right"><span className="block text-sm font-semibold text-foreground">{inr(o.netAmount)}</span><span className="block text-2xs text-subtle">{o.status}</span></span></button>)}
                </div>
              )}
            </div>
          )}
          {loadingOrder && <span className="text-2xs text-muted">Loading…</span>}
          {billSource === "order" && soNumber && !loadingOrder && <span className="text-2xs font-semibold text-success">✓ Loaded from {soNumber}</span>}
        </div>
        {billSource === "order" && <p className="mt-1.5 text-2xs text-subtle">Pick a confirmed sales order to auto-fill the customer and line items. You can still edit everything before saving.</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Customer */}
          <SectionCard icon={Building2} allowOverflow title={<>Business Customer{custMandatory && <span className="text-danger">*</span>}</>} action={cust && <button onClick={() => setCust(null)} className="text-2xs font-semibold text-danger hover:underline">Change</button>}>
            {cust ? (
              <div className="rounded-lg bg-primary-subtle/40 px-3 py-2 text-sm">
                <div className="font-semibold text-foreground">{cust.name}{cust.contactPerson ? ` · ${cust.contactPerson}` : ""}</div>
                <div className="text-2xs text-muted">{cust.gstin ? `GSTIN ${cust.gstin}` : <span className="text-danger">No GSTIN on file</span>}{cust.phone ? ` · ${cust.phone}` : ""}{cust.email ? ` · ${cust.email}` : ""}</div>
                {(cust.address || cust.city || cust.state || cust.pincode) && <div className="text-2xs text-muted">{[cust.address, cust.city, cust.state, cust.pincode].filter(Boolean).join(", ")}</div>}
              </div>
            ) : (
              <div className="relative">
                <div className="flex gap-2">
                  <input value={custQuery} onChange={(e) => setCustQuery(e.target.value)} placeholder="Search customer by name / phone / email…" className={cn(inp, "flex-1")} />
                  <Button size="sm" variant="outline" onClick={() => { setNewCust({ ...EMPTY_CUST, name: custQuery }); setAddingCust(true); }}><Plus className="h-3.5 w-3.5" /> New</Button>
                </div>
                {custQuery && custHits.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                    {custHits.map((c) => <button key={c.id} onClick={() => { setCust(c); setCustQuery(""); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary-subtle/40"><span className="font-medium text-foreground">{c.name}</span><span className="font-mono text-2xs text-subtle">{c.gstin || c.phone}</span></button>)}
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* Apply customer advance (Advance Management integration) */}
          {cust && avail.length > 0 && (
            <SectionCard icon={HandCoins} title={<>Apply Customer Advance <span className="text-2xs font-normal text-muted">({avail.length} available)</span></>}>
              <div className="space-y-2">
                {avail.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm">
                    <div className="min-w-0"><span className="font-mono text-xs font-semibold text-primary">{a.advanceNo}</span><span className="block text-2xs text-subtle">{a.advanceTypeName} · {a.advanceDate} · Balance {inr(a.balance)}</span></div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={advAdj[a.id] ?? ""} onChange={(e) => setAdvAdj((p) => ({ ...p, [a.id]: e.target.value }))} placeholder="0.00" className="h-8 w-24 rounded border border-border-strong bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" />
                      <button type="button" onClick={() => setAdvAdj((p) => ({ ...p, [a.id]: String(Math.max(0, Math.min(a.balance, payable - advanceTotal + Math.min(n(advAdj[a.id]), a.balance)))) }))} className="rounded border border-border bg-surface px-2 py-1 text-2xs font-semibold text-primary hover:border-primary">Max</button>
                    </div>
                  </div>
                ))}
                {advanceTotal > 0 && <div className="flex items-center justify-between pt-1 text-sm font-semibold"><span className="text-foreground">Total Advance Applied</span><span className="text-success">− {inr(advanceTotal)}</span></div>}
              </div>
              <p className="mt-1.5 text-2xs text-subtle">Applying an advance reduces the amount due and auto-posts a settlement against it.</p>
            </SectionCard>
          )}

          {/* Product search with stock */}
          <div className="relative rounded-2xl border border-primary/30 bg-primary-subtle/20 p-3 shadow-sm">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary"><Search className="h-3.5 w-3.5" /> Add product (name · SKU · barcode · QR)</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) addHit(hits[0]); }} placeholder="Type or scan…" className="h-10 w-full rounded-lg border border-primary/40 bg-card px-3 text-sm focus:border-primary focus:outline-none" />
            {query && hits.length > 0 && (
              <div className="absolute left-3 right-3 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
                {hits.map((h) => (
                  <button key={h.id} onClick={() => addHit(h)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-primary-subtle/50">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{h.name}</span><span className="font-mono text-2xs text-subtle">{h.sku} · {h.gst}% GST{h.mrp > h.price ? ` · MRP ${inr(h.mrp)}` : ""}</span></span>
                    <span className="flex shrink-0 flex-col items-end"><span className="text-sm font-bold text-foreground">{inr(h.price)}</span><span className={cn("rounded-full px-1.5 text-2xs font-semibold", h.stock > 0 ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger")}>{h.stock > 0 ? `In stock: ${h.stock} ${h.uom}` : "Out of stock"}</span></span>
                  </button>
                ))}
              </div>
            )}
            {query && hits.length === 0 && <div className="absolute left-3 right-3 z-30 mt-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted shadow-xl">No product found.</div>}
          </div>

          {/* Items */}
          <SectionCard icon={Boxes} title="Items" bodyClass=""
            action={
              <div className="flex items-center gap-1.5 text-2xs">
                <span className="font-medium text-muted">Discount:</span>
                <div className="inline-flex overflow-hidden rounded-md border border-border">
                  {([["item", "Item-wise"], ["bill", "Bill-wise"]] as const).map(([m, lbl]) => (
                    <button key={m} type="button" onClick={() => setDiscLevel(m)} className={cn("px-2.5 py-1 font-semibold transition", discLevel === m ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
                  ))}
                </div>
              </div>
            }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Item</th>{showBatchCols && <><th className="px-3 py-2.5">Batch No</th><th className="px-3 py-2.5">Mfg Date</th><th className="px-3 py-2.5">Exp Date</th></>}<th className="px-3 py-2.5 text-center">Qty</th><th className="px-3 py-2.5 text-right">Rate</th>{discLevel === "item" && <th className="px-3 py-2.5 text-right">Disc</th>}<th className="px-3 py-2.5 text-right">Taxable</th><th className="px-3 py-2.5 text-right">Tax</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5" /></tr></thead>
                <tbody>
                  {lines.map((l) => {
                    const over = l.stock > 0 && l.qty > l.stock;
                    return (
                    <tr key={l.key} className="border-b border-border last:border-0">
                      <td className="px-3 py-2"><div className="font-medium text-foreground">{l.name}</div><div className="font-mono text-2xs"><span className="text-subtle">{l.sku} · {l.gst}% · </span><span className={cn("font-semibold", l.stock <= 0 || over ? "text-danger" : "text-success")}>stock {l.stock}</span></div>{l.qrCodes && l.qrCodes.length > 0 && <div className="text-[10px] text-subtle">QR ×{l.qrCodes.length}</div>}</td>
                      {showBatchCols && (l.batchTracked ? (
                        <>
                          <td className="px-3 py-2 align-top">
                            {l.batches && l.batches.length > 1 ? (
                              <div className="flex w-44 flex-col gap-1">
                                <select value={l.batchNo ?? ""} onChange={(e) => selectBatch(l.key, e.target.value)} className={cn("h-8 w-full rounded-md border bg-surface-2 px-2 text-2xs font-medium text-foreground focus:outline-none", l.batchNo ? (batchOrderError(l) ? "border-danger focus:border-danger" : "border-border focus:border-primary") : "border-danger")}>
                                  <option value="">Select batch…</option>
                                  {l.batches.map((b, bi) => <option key={bi} value={b.batchNo ?? ""}>{`P${b.priority} · ${b.batchNo || "(no batch)"} · Exp ${b.expiryDate || "—"} · Qty ${b.qtyOnHand}`}{b.priority === 1 ? " (recommended)" : ""}</option>)}
                                </select>
                                {l.batchOrder && <span className="text-[10px] font-semibold uppercase tracking-wide text-subtle">{l.batchOrder} order</span>}
                                <BatchChip line={l} />
                              </div>
                            ) : (
                              <div className="flex w-44 flex-col gap-1">
                                <span className={cn("font-mono text-2xs", l.batchNo ? "text-foreground" : "text-subtle")}>{l.batchNo || (l.batches ? "—" : "loading…")}</span>
                                {l.batches && <BatchChip line={l} />}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-2xs text-muted">{l.mfgDate || "—"}</td>
                          <td className="px-3 py-2 text-2xs text-muted">{l.expiryDate || "—"}</td>
                        </>
                      ) : (
                        <><td className="px-3 py-2 text-2xs text-subtle">—</td><td className="px-3 py-2 text-2xs text-subtle">—</td><td className="px-3 py-2 text-2xs text-subtle">—</td></>
                      ))}
                      <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><input type="number" min={1} value={l.qty} onChange={(e) => setQty(l.key, n(e.target.value))} className={cn("h-8 w-16 rounded border bg-surface-2 text-center text-xs focus:outline-none", over ? "border-danger" : "border-border focus:border-primary")} /><UomConvert qty={l.qty} uom={l.uom} onChange={(v) => setQty(l.key, v)} /></div></td>
                      <td className="px-3 py-2 text-right"><input type="number" min={0} value={l.rate} onChange={(e) => upd(l.key, { rate: n(e.target.value) })} className="h-8 w-20 rounded border border-border bg-surface-2 px-1 text-right text-xs focus:border-primary focus:outline-none" /></td>
                      {discLevel === "item" && <td className="px-3 py-2"><div className="flex items-center justify-end gap-1"><input type="number" min={0} value={l.disc || ""} onChange={(e) => upd(l.key, { disc: Math.max(0, n(e.target.value)) })} placeholder="0" className="h-8 w-14 rounded border border-border bg-surface-2 px-1 text-right text-xs focus:border-primary focus:outline-none" /><button onClick={() => upd(l.key, { discType: l.discType === "pct" ? "val" : "pct" })} className="grid h-8 w-7 place-items-center rounded border border-border bg-surface text-2xs font-bold text-muted hover:text-primary">{l.discType === "pct" ? "%" : "₹"}</button></div></td>}
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{inr(taxIncl ? lineNet(l) - lineTax(l) : lineNet(l))}</td>
                      <td className="px-3 py-2 text-right text-2xs text-muted">{l.gst > 0 ? <><div className="font-medium text-foreground">{inr(lineTax(l))}</div><div className="text-[10px] text-subtle">@{l.gst}%</div></> : "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-foreground">{inr(lineNet(l) + (taxIncl ? 0 : lineTax(l)))}</td>
                      <td className="px-3 py-2 text-right"><button onClick={() => remove(l.key)} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );})}
                  {lines.length === 0 && <tr><td colSpan={(discLevel === "item" ? 8 : 7) + (showBatchCols ? 3 : 0)} className="px-4 py-12 text-center text-sm text-muted">Search a product above to add invoice lines.</td></tr>}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Sales Invoice Details & Terms */}
          <SectionCard icon={FileText} title="Sales Invoice Details & Terms" bodyClass="p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fld label="Sales Order No."><input value={soNumber} onChange={(e) => setSoNumber(e.target.value)} placeholder="SO-0001" className={inp2} /></Fld>
              <Fld label="Due Date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp2} /></Fld>
              <Fld label="Payment Terms"><input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Net 30" className={inp2} /></Fld>
              <Fld label="GST Supply Type"><select value={interState ? "inter" : "intra"} onChange={(e) => setInterState(e.target.value === "inter")} className={inp2}><option value="intra">Intra-state (CGST + SGST)</option><option value="inter">Inter-state (IGST)</option></select></Fld>
              <div className="sm:col-span-2 lg:col-span-3"><Fld label="Customer Note"><textarea value={custNote} onChange={(e) => setCustNote(e.target.value)} rows={2} placeholder="Visible note to the customer…" className={cn(inp2, "h-auto py-2")} /></Fld></div>
              <div className="sm:col-span-2 lg:col-span-3"><Fld label="Terms & Conditions"><textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} placeholder="Payment, warranty, jurisdiction…" className={cn(inp2, "h-auto py-2")} /></Fld></div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-2xs font-semibold text-muted">Documents</label>
                <label className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted transition hover:border-primary/40 hover:text-primary">
                  {uploading ? <Upload className="h-4 w-4 animate-pulse" /> : <Paperclip className="h-4 w-4" />} {uploading ? "Uploading…" : "Click to upload (PO copy, delivery note — PDF / image / doc, ≤ 8 MB)"}
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
                </label>
                {attachments.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {attachments.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary-subtle px-2 py-0.5 text-2xs font-medium text-primary"><FileText className="h-3 w-3" /><a href={a.fileUrl} target="_blank" className="hover:underline">{a.fileName}</a><button onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))} className="hover:text-danger"><X className="h-3 w-3" /></button></span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT */}
        <aside className="space-y-4">
          {/* Document: only invoice no + date */}
          <SectionCard icon={ReceiptText} title="Document">
            <div className="space-y-3">
              <Fld label="Invoice No."><input readOnly value="Auto on save" className={cn(inp2, "bg-surface-2 font-mono text-primary")} /></Fld>
              <Fld label="Invoice Date"><input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={inp2} /></Fld>
            </div>
          </SectionCard>

          {/* Summary + payment */}
          <SectionCard icon={IndianRupee} title="Summary">
            <div className="space-y-1.5 text-sm">
              <Row k={`Items (${t.qty})`} v={inr(t.subtotal)} />
              {discLevel === "item" && t.itemDisc > 0 && <Row k="Item Discount" v={`- ${inr(t.itemDisc)}`} />}
              {discLevel === "bill" && (
                <div className="flex items-center justify-between gap-2"><span className="text-muted">Bill Discount</span><div className="flex items-center gap-1"><input type="number" value={billDisc} onChange={(e) => setBillDisc(e.target.value)} placeholder="0" className="h-7 w-20 rounded border border-border-strong bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" /><button onClick={() => setBillDiscType(billDiscType === "pct" ? "val" : "pct")} className="grid h-7 w-7 place-items-center rounded border border-border bg-surface text-2xs font-bold text-muted hover:text-primary">{billDiscType === "pct" ? "%" : "₹"}</button></div></div>
              )}
              <Row k="Taxable Value" v={inr(t.taxable)} />
              {interState ? <Row k="IGST" v={inr(igst)} /> : <><Row k="CGST" v={inr(cgst)} /><Row k="SGST" v={inr(sgst)} /></>}
              {t.roundOff !== 0 && <Row k="Round Off" v={inr(t.roundOff)} />}
              <div className="flex items-center justify-between font-semibold text-foreground"><span>Sub Total</span><span>{inr(t.total)}</span></div>
              {advanceTotal > 0 && <div className="flex items-center justify-between"><span className="text-muted">Advance Applied</span><span className="text-success">− {inr(advanceTotal)}</span></div>}
              {/* TCS — added on top; enter % or direct amount */}
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-muted">TCS
                  <input type="number" value={tcsInput} onChange={(e) => setTcsInput(e.target.value)} placeholder="0" className="h-6 w-14 rounded border border-border-strong bg-surface px-1 text-right text-2xs focus:border-primary focus:outline-none" />
                  <button type="button" onClick={() => setTcsMode(tcsMode === "pct" ? "val" : "pct")} title="Toggle percentage / amount" className="grid h-6 w-6 place-items-center rounded border border-border bg-surface text-2xs font-bold text-muted hover:text-primary">{tcsMode === "pct" ? "%" : "₹"}</button>
                </span>
                <span className="text-foreground">{tcsAmt ? `+ ${inr(tcsAmt)}` : "—"}</span>
              </div>
              {/* TDS — deducted by buyer; enter % or direct amount */}
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-muted">TDS
                  <input type="number" value={tdsInput} onChange={(e) => setTdsInput(e.target.value)} placeholder="0" className="h-6 w-14 rounded border border-border-strong bg-surface px-1 text-right text-2xs focus:border-primary focus:outline-none" />
                  <button type="button" onClick={() => setTdsMode(tdsMode === "pct" ? "val" : "pct")} title="Toggle percentage / amount" className="grid h-6 w-6 place-items-center rounded border border-border bg-surface text-2xs font-bold text-muted hover:text-primary">{tdsMode === "pct" ? "%" : "₹"}</button>
                </span>
                <span className="text-danger">{tdsAmt ? `- ${inr(tdsAmt)}` : "—"}</span>
              </div>
              <div className="my-1.5 h-px bg-border" />
              <div className="flex items-center justify-between text-lg font-bold text-foreground"><span>Invoice Total</span><span>{inr(grandTotal)}</span></div>
              {tdsAmt > 0 && <div className="flex items-center justify-between text-sm font-semibold text-primary"><span>Net Payable (after TDS)</span><span>{inr(payable)}</span></div>}
            </div>

            {/* Payment category */}
            <div className="mt-3">
              <label className="mb-1 block text-2xs font-semibold text-muted">Payment</label>
              <div className="inline-flex w-full overflow-hidden rounded-md border border-border text-2xs">
                {([["full", "Full Collection"], ["partial", "Partial Collection"], ["credit", "Credit Due"]] as const).map(([m, lbl]) => (
                  <button key={m} type="button" onClick={() => setPayCat(m)} className={cn("flex-1 px-2 py-1.5 font-semibold transition", payCat === m ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
                ))}
              </div>
            </div>
            {payCat !== "credit" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Fld label="Amount Received"><input type="number" value={payCat === "full" ? String(netAfterAdvance) : amtPaid} readOnly={payCat === "full"} onChange={(e) => setAmtPaid(e.target.value)} placeholder="0.00" className={cn(inp2, payCat === "full" && "bg-surface-2")} /></Fld>
                <Fld label="Mode"><select value={payMode} onChange={(e) => setPayMode(e.target.value)} className={inp2}>{["Bank Transfer", "Cash", "UPI", "Cheque", "Card"].map((m) => <option key={m}>{m}</option>)}</select></Fld>
                <BankPicker mode={paidNow > 0 ? payMode : undefined} value={bank} onChange={setBank} required />

              </div>
            )}
            <div className="mt-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs"><span className="text-muted">Status</span><span className={cn("font-bold", payStatus === "Paid" ? "text-success" : payStatus === "Partial" ? "text-warning" : "text-danger")}>{payStatus}{payStatus !== "Paid" && payable > 0 ? ` · balance ${inr(payable - effectivePaid)}` : ""}</span></div>

            {error && <p className="mt-2 rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{error}</p>}
            <Button size="lg" className="mt-3 w-full" onClick={save} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Saving…" : `Create Invoice (${inr(grandTotal)})`}</Button>
          </SectionCard>
        </aside>
      </div>

      {/* Add customer popup */}
      {addingCust && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setAddingCust(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Building2 className="h-4 w-4 text-primary" /> New Business Customer</h3><button onClick={() => setAddingCust(false)} className="text-muted hover:text-foreground"><X className="h-4 w-4" /></button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><EFld label="Business Name *" err={custErr.name}><input value={newCust.name} autoFocus onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="Company / firm name" className={einp(custErr.name)} /></EFld></div>
              <EFld label={`GSTIN${gstMandatory ? " *" : ""}`} err={custErr.gstin}><input value={newCust.gstin} onChange={(e) => setNewCust({ ...newCust, gstin: e.target.value.toUpperCase() })} placeholder="29ABCDE1234F1Z5" maxLength={15} className={cn(einp(custErr.gstin), "font-mono")} /></EFld>
              <Fld label="Contact Person"><input value={newCust.contactPerson} onChange={(e) => setNewCust({ ...newCust, contactPerson: e.target.value })} placeholder="Name" className={inp2} /></Fld>
              <EFld label="Phone" err={custErr.phone}><input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} placeholder="10-digit mobile" maxLength={10} className={einp(custErr.phone)} /></EFld>
              <EFld label="Email" err={custErr.email}><input type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} placeholder="name@company.com" className={einp(custErr.email)} /></EFld>
              <div className="sm:col-span-2"><Fld label="Address"><input value={newCust.address} onChange={(e) => setNewCust({ ...newCust, address: e.target.value })} placeholder="Street, area" className={inp2} /></Fld></div>
              <Fld label="City"><input value={newCust.city} onChange={(e) => setNewCust({ ...newCust, city: e.target.value })} className={inp2} /></Fld>
              <Fld label="State"><input value={newCust.state} onChange={(e) => setNewCust({ ...newCust, state: e.target.value })} className={inp2} /></Fld>
              <EFld label="Pincode" err={custErr.pincode}><input value={newCust.pincode} onChange={(e) => setNewCust({ ...newCust, pincode: e.target.value })} placeholder="560001" maxLength={6} className={einp(custErr.pincode)} /></EFld>
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" size="md" onClick={() => setAddingCust(false)}>Cancel</Button><Button size="md" onClick={saveCustomer}><CheckCircle2 className="h-4 w-4" /> Save Customer</Button></div>
          </div>
        </div>
      )}

      {warn && <div className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-warning/40 bg-warning px-4 py-2.5 text-sm font-medium text-white shadow-lg">{warn}</div>}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const inp2 = "h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none";
const einp = (err?: string) => cn(inp2, err ? "border-danger focus:border-danger" : "");
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>;
}
function EFld({ label, err, children }: { label: string; err?: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}{err && <p className="mt-0.5 text-2xs font-medium text-danger">{err}</p>}</div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="text-foreground">{v}</span></div>;
}
// Per-line valuation status chip: priority-1 = OK, out-of-order = warn / restrict.
function BatchChip({ line: l }: { line: Line }) {
  if (!l.batchNo || !l.batchPriority) return null;
  if (l.batchPriority === 1) return <span className="inline-flex w-fit items-center rounded-full bg-success-subtle px-1.5 py-0.5 text-[10px] font-semibold text-success">✓ P1</span>;
  if (!l.enforce) return null; // not enforced → no out-of-order signalling
  if (l.batchSalesPolicy === "restrict") return <span className="inline-flex w-fit items-center rounded-full bg-danger-subtle px-1.5 py-0.5 text-[10px] font-semibold text-danger">✕ Restricted — pick P1</span>;
  return <span className="inline-flex w-fit items-center rounded-full bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold text-warning">⚠ P{l.batchPriority} — not recommended</span>;
}
