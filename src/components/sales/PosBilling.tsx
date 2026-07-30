"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart, Search, Plus, Minus, Trash2, User, Wallet, Printer, CheckCircle2, X, Receipt, Boxes, PauseCircle, Gift, TicketPercent, Megaphone, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatMoneyWith } from "@/lib/settings/generalConfig";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";
import { cloneSalesConfig, type SalesConfigData } from "@/lib/settings/salesConfigDefaults";
import { cn } from "@/lib/cn";
import { UomConvert } from "@/components/uom/UomConvert";

/** New-customer capture fields the POS can collect — id matches the Sales
 * Settings → B2C "customerCapture" toggle; key maps to the customer record. */
type CustKey = "phone" | "gstin" | "email" | "dob" | "anniversary" | "address";
interface CaptureField { id: string; key: CustKey; label: string; placeholder?: string; type?: string; mandatoryFlag?: string; full?: boolean }
const CAPTURE_FIELDS: CaptureField[] = [
  { id: "mobile", key: "phone", label: "Phone", placeholder: "Mobile", mandatoryFlag: "mobileMandatoryB2c" },
  { id: "gst", key: "gstin", label: "GSTIN", placeholder: "GST number", mandatoryFlag: "gstMandatoryB2c" },
  { id: "email", key: "email", label: "Email", placeholder: "name@email.com", type: "email" },
  { id: "dob", key: "dob", label: "Date of Birth", type: "date" },
  { id: "anniversary", key: "anniversary", label: "Anniversary", type: "date" },
  { id: "address", key: "address", label: "Address", placeholder: "Address", full: true },
];

interface Hit { id: number; name: string; sku: string; barcode: string; hsn: string; uom: string; brand: string; mrp: number; purchaseRate: number; sellingRate: number; price: number; gst: number; stock: number;
  // Batch tracking — returned by /api/pos/products. batchNo/mfgDate/expiryDate are
  // populated only when `q` was a scanned QR that resolves to a specific batch.
  batchTracked?: boolean; invBatch?: boolean; invMfg?: boolean; invExpiry?: boolean; batchNo?: string | null; mfgDate?: string | null; expiryDate?: string | null;
  // Valuation policy — drives FEFO/FIFO batch priority and out-of-order validation.
  valuation?: string; batchSalesPolicy?: string;
  // Single-use QR — populated only when `q` was a scanned QR code. qrMode is
  // "unique" (single-use) or "shared"; qrSold is true if a unique code is already sold.
  qrCode?: string | null; qrMode?: string | null; qrSold?: boolean }
// Per-line GST. `incl` = price already contains tax (back-calculated); otherwise
// tax is added on top of the price (exclusive). Driven by POS Configuration.
const lineTaxAmt = (l: { qty: number; rate: number; gst: number; disc: number; discType: "pct" | "val" }, incl: boolean) => {
  const gross = l.qty * l.rate; const d = l.discType === "val" ? Math.min(l.disc || 0, gross) : gross * (l.disc || 0) / 100; const net = gross - d;
  if (!(l.gst > 0)) return 0;
  return incl ? +(net - net / (1 + l.gst / 100)).toFixed(2) : +(net * l.gst / 100).toFixed(2);
};
/** Material value (pre-tax) of a line — for inclusive rates the tax is stripped out. */
const lineMaterial = (l: { qty: number; rate: number; gst: number; disc: number; discType: "pct" | "val" }, incl: boolean) => {
  const gross = l.qty * l.rate; const d = l.discType === "val" ? Math.min(l.disc || 0, gross) : gross * (l.disc || 0) / 100; const net = gross - d;
  return incl && l.gst > 0 ? +(net / (1 + l.gst / 100)).toFixed(2) : net;
};
/** A pickable batch of a product (from inventory stock) for the billing screen. */
interface BatchOpt { priority: number; batchNo: string | null; mfgDate: string | null; expiryDate: string | null; qtyOnHand: number; sellingRate?: number; purchaseRate?: number }
interface Line { key: string; id: number; name: string; sku: string; uom: string; hsn: string; mrp: number; rate: number; gst: number; stock: number; qty: number; disc: number; discType: "pct" | "val";
  // Batch tracking — carried from the scanned/searched product. The sold batch is
  // sent to /api/sales so inventory consumes the exact batch. `batches` holds the
  // available batches in stock when the product was added by search (manual pick).
  batchTracked?: boolean; invBatch?: boolean; invMfg?: boolean; invExpiry?: boolean; batchNo?: string | null; mfgDate?: string | null; expiryDate?: string | null; batches?: BatchOpt[];
  // Valuation-aware batch picking. `batchOrder` is the FEFO/FIFO label; `enforce`
  // gates out-of-order validation; `batchPriority` is the selected batch's 1-based
  // priority (1 = recommended). `batchSalesPolicy` decides restrict vs warn.
  valuation?: string; batchSalesPolicy?: string; batchOrder?: string; enforce?: boolean; batchPriority?: number;
  // Single-use UNIQUE-QR codes scanned for this line. Each valid unique scan appends
  // one code here and increments qty by one; sent to /api/sales to mark them Sold.
  qrCodes?: string[] }
interface Customer { id: number; name: string; phone: string; gstin?: string; dob?: string; anniversary?: string; loyaltyPoints: number; totalSpent: number }
interface Bill { id: number; cart: Line[]; customer: Customer | null; billDisc: string; billDiscType: "pct" | "val"; redeemPoints: number; redeemValue: number; couponCode: string; couponDiscount: number; couponCampaign: string; promoCode: string; promoDiscount: number; promoCampaign: string; membershipApply: boolean; giftVoucherNo: string; giftVoucherAmount: number; giftVoucherBalance: number }
interface MemberCtx { isMember: boolean; levelName: string; membershipNumber: string; themeColor: string; billDiscountPct: number; maxDiscount: number; pointMultiplier: number }
interface Tender { mode: string; amount: string }
interface LoyaltyCtx { enabled: boolean; available: number; redemptionEnabled: boolean; pointValuePoints: number; pointValueAmount: number; minRedeemPoints: number; maxRedeemPoints: number | null; maxRedeemPercent: number | null; maxRedeemAmount: number | null }
const PAY_MODES = ["Cash", "Card", "UPI", "Wallet"];
let billSeq = 1;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
const newBill = (): Bill => ({ id: billSeq++, cart: [], customer: null, billDisc: "", billDiscType: "pct", redeemPoints: 0, redeemValue: 0, couponCode: "", couponDiscount: 0, couponCampaign: "", promoCode: "", promoDiscount: 0, promoCampaign: "", membershipApply: true, giftVoucherNo: "", giftVoucherAmount: 0, giftVoucherBalance: 0 });

const EMPTY_CUST = { name: "", phone: "", gstin: "", dob: "", anniversary: "", email: "", address: "" };

export function PosBilling() {
  const cfg = useGeneralConfig();
  const fm = (n: number) => formatMoneyWith(cfg, n);

  // POS Configuration → Tax Treatment. Inclusive = price already contains GST.
  const [taxMethod, setTaxMethod] = useState("inclusive");
  const taxIncl = taxMethod !== "exclusive";

  // Sales rule-engine config — drives the B2C customer panel / capture fields.
  const [sales, setSales] = useState<SalesConfigData>(() => cloneSalesConfig());
  const salesFlag = (id: string) => !!sales.flags[id];
  const capOn = (id: string) => !!sales.toggles.customerCapture?.[id];
  const isMandatory = (flagId?: string) => !!flagId && salesFlag(flagId);
  // A customer must be picked/created before billing when registration is required
  // or walk-in is switched off in the B2C settings.
  const requireCustomer = salesFlag("custRegRequired") || !salesFlag("walkInAllowed");

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [bills, setBills] = useState<Bill[]>([newBill()]);
  const [activeId, setActiveId] = useState(() => bills[0].id);
  const active = bills.find((b) => b.id === activeId) ?? bills[0];
  const cart = active.cart;

  const [custQuery, setCustQuery] = useState("");
  const [custHits, setCustHits] = useState<Customer[]>([]);
  const [lyCtx, setLyCtx] = useState<LoyaltyCtx | null>(null);
  const [member, setMember] = useState<MemberCtx | null>(null);
  const [redeemInput, setRedeemInput] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [gvInput, setGvInput] = useState("");
  const [gvBusy, setGvBusy] = useState(false);
  const [addingCust, setAddingCust] = useState(false);
  const [newCust, setNewCust] = useState({ ...EMPTY_CUST });
  const [payOpen, setPayOpen] = useState(false);
  const [tenders, setTenders] = useState<Tender[]>([{ mode: "Cash", amount: "" }]);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ business: Record<string, string>; template: Record<string, unknown>; sale: Record<string, unknown> } | null>(null);
  const [stats, setStats] = useState({ todaySales: 0, todayBills: 0 });
  const [warn, setWarn] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  function flash(msg: string) { setWarn(msg); window.setTimeout(() => setWarn(""), 2200); }

  function patchActive(patch: Partial<Bill>) { setBills((bs) => bs.map((b) => (b.id === activeId ? { ...b, ...patch } : b))); }
  // Any change to the cart invalidates an applied coupon (its rules/discount depend on
  // the bill), so clear it — the cashier re-applies against the updated bill.
  const setCart = (fn: (c: Line[]) => Line[]) => patchActive({ cart: fn(active.cart), ...(active.couponDiscount ? { couponCode: "", couponDiscount: 0, couponCampaign: "" } : {}), ...(active.promoDiscount ? { promoCode: "", promoDiscount: 0, promoCampaign: "" } : {}), ...(active.giftVoucherAmount ? { giftVoucherNo: "", giftVoucherAmount: 0, giftVoucherBalance: 0 } : {}) });

  // Loyalty context for the active customer (drives the redeem control). Refetched
  // when the customer changes; clears any redemption when the customer is removed.
  useEffect(() => {
    const cid = active.customer?.id;
    if (!cid) { setLyCtx(null); setMember(null); setRedeemInput(""); if (active.redeemPoints) patchActive({ redeemPoints: 0, redeemValue: 0 }); return; }
    const ctrl = new AbortController();
    (async () => { try { const j = await fetch(`/api/loyalty/pos-context?customerId=${cid}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); setLyCtx(j.ok && j.enabled ? j : null); } catch { /**/ } })();
    (async () => { try { const j = await fetch(`/api/pos/membership?customerId=${cid}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); setMember(j.ok && j.isMember ? j : null); } catch { /**/ } })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, active.customer?.id]);

  useEffect(() => {
    (async () => { try { const s = await fetch("/api/settings/sales", { cache: "no-store" }).then((r) => r.json()); if (s.ok && s.config) setSales(s.config); } catch { /**/ } })();
    (async () => { try { const p = await fetch("/api/settings/pos", { cache: "no-store" }).then((r) => r.json()); if (p.ok && p.config?.taxMethod) setTaxMethod(p.config.taxMethod); } catch { /**/ } })();
    loadStats();
  }, []);
  async function loadStats() { try { const j = await fetch("/api/sales", { cache: "no-store" }).then((r) => r.json()); if (j.ok) setStats(j.stats); } catch { /**/ } }

  useEffect(() => {
    if (!query.trim()) { setHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => { try { const j = await fetch(`/api/pos/products?q=${encodeURIComponent(query)}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); if (j.ok) setHits(j.products); } catch { /**/ } }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  useEffect(() => {
    if (!custQuery.trim()) { setCustHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => { try { const j = await fetch(`/api/masters/customers?q=${encodeURIComponent(custQuery)}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); if (j.ok) setCustHits(j.customers); } catch { /**/ } }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [custQuery]);

  function addHit(h: Hit) {
    // A scanned QR carries the specific batch → merge only with a line of the same
    // product AND batch, so different batches of one product stay on separate lines.
    const batchNo = h.batchNo ?? null;
    const lineKey = batchNo ? `${h.id}::${batchNo}` : String(h.id);
    const existing = active.cart.find((l) => l.key === lineKey);
    const nextQty = (existing?.qty ?? 0) + 1;
    // Single-use UNIQUE-QR: each code may be billed exactly once, ever. Reject a code
    // already marked Sold by the backend, or one already scanned into this bill.
    const isUniqueQr = !!h.qrCode && h.qrMode === "unique";
    if (isUniqueQr) {
      if (h.qrSold) { flash(`QR code ${h.qrCode} has already been sold — it can't be used again.`); setQuery(""); setHits([]); searchRef.current?.focus(); return; }
      if (active.cart.some((l) => l.qrCodes?.includes(h.qrCode!))) { flash(`QR code ${h.qrCode} is already scanned in this bill.`); setQuery(""); setHits([]); searchRef.current?.focus(); return; }
    }
    if (h.stock > 0 && nextQty > h.stock) { flash(`Only ${h.stock} ${h.uom} of "${h.name}" in stock`); setQuery(""); setHits([]); searchRef.current?.focus(); return; }
    if (h.stock <= 0) flash(`"${h.name}" is out of stock — billed anyway`);
    // Record the scanned code for ANY mode (unique or shared) so every scan is stored
    // one-row-per-code server-side. Searched lines (no scan) carry no code.
    const code = h.qrCode ?? null;
    setCart((c) => { const i = c.findIndex((l) => l.key === lineKey); if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: n[i].qty + 1, qrCodes: code ? [...(n[i].qrCodes ?? []), code] : n[i].qrCodes }; return n; } return [...c, { key: lineKey, id: h.id, name: h.name, sku: h.sku, uom: h.uom, hsn: h.hsn, mrp: h.mrp, rate: h.price, gst: h.gst, stock: h.stock, qty: 1, disc: 0, discType: "pct", batchTracked: h.batchTracked, invBatch: h.invBatch, invMfg: h.invMfg, invExpiry: h.invExpiry, batchNo, mfgDate: h.mfgDate ?? null, expiryDate: h.expiryDate ?? null, valuation: h.valuation, batchSalesPolicy: h.batchSalesPolicy, qrCodes: code ? [code] : undefined }]; });
    setQuery(""); setHits([]); searchRef.current?.focus();
    // Batch-tracked product → load its in-stock batches (ordered by valuation, with
    // priority). For a searched line the user then picks; for a SCANNED line we still
    // load so the line learns the priority order and can validate the scanned batch.
    if (h.batchTracked) loadBatchesForLine(active.id, lineKey, h.id);
  }

  // A line is out of order when valuation is enforced and the picked batch is not the
  // priority-1 (recommended FEFO/FIFO) batch. Pure predicate, used for billing block.
  const isOutOfOrder = (l: Line) => !!(l.enforce && l.batchPriority && l.batchPriority > 1);
  // restrict-policy out-of-order lines hard-block billing; warn-policy lines only warn.
  const isRestricted = (l: Line) => isOutOfOrder(l) && l.batchSalesPolicy === "restrict";

  // Validate a line's picked/scanned batch against its valuation order and surface the
  // right message: ERROR for restrict, WARNING for warn, silent when not enforced.
  function validateBatch(l: Line) {
    if (!isOutOfOrder(l)) return;
    const order = l.batchOrder || "FEFO";
    const p1 = l.batches?.find((b) => b.priority === 1);
    const p1No = p1?.batchNo || "P1";
    const picked = l.batchNo || "(no batch)";
    if (l.batchSalesPolicy === "warn") {
      flash(`⚠ "${l.name}": ${picked} is priority ${l.batchPriority} — ${order} recommends priority 1 (${p1No}). Allowed.`);
    } else {
      flash(`${picked} is priority ${l.batchPriority} — ${order} requires priority 1 (${p1No}). Sales restricted for ${l.name}.`);
    }
  }

  // Fetch a product's available batches (valuation-ordered, 1-based priority) and
  // attach them to the cart line. Auto-select the recommended priority-1 batch by
  // default; if the line already has a scanned batch, keep it and tag its priority,
  // then validate. Single- or multi-batch products are treated the same way.
  async function loadBatchesForLine(billId: number, key: string, productId: number) {
    try {
      const j = await fetch(`/api/pos/batches?productId=${productId}`, { cache: "no-store" }).then((r) => r.json());
      if (!j.ok) return;
      const batches: BatchOpt[] = j.batches ?? [];
      const meta = { valuation: j.valuation as string | undefined, batchSalesPolicy: j.batchSalesPolicy as string | undefined, batchOrder: (j.order ?? undefined) as string | undefined, enforce: !!j.enforce };
      let toValidate: Line | null = null;
      setBills((bs) => bs.map((b) => (b.id !== billId ? b : { ...b, cart: b.cart.map((l) => {
        if (l.key !== key) return l;
        const base = { ...l, ...meta, batches };
        // Scanned line: a batch was already chosen before batches loaded — keep it and
        // tag its priority (match by batchNo), then validate.
        if (l.batchNo) {
          const match = batches.find((o) => (o.batchNo ?? "") === l.batchNo);
          const next = { ...base, batchPriority: match?.priority };
          toValidate = next;
          return next;
        }
        // Otherwise auto-select the recommended priority-1 (first/recommended) batch.
        const p1 = batches[0];
        if (p1) return { ...base, batchNo: p1.batchNo, mfgDate: p1.mfgDate, expiryDate: p1.expiryDate, batchPriority: p1.priority };
        return base;
      }) })));
      // Validate the scanned batch (computed above so no stale-state read is needed).
      if (toValidate) validateBatch(toValidate);
    } catch { /* ignore */ }
  }

  // Manual batch selection from the in-line dropdown. Sets the batch fields AND the
  // chosen batch's priority, then runs out-of-order validation.
  function selectBatch(key: string, batchNo: string) {
    let validated: Line | null = null;
    setCart((c) => c.map((l) => {
      if (l.key !== key) return l;
      const o = l.batches?.find((x) => (x.batchNo ?? "") === batchNo);
      const next = { ...l, batchNo: batchNo || null, mfgDate: o?.mfgDate ?? null, expiryDate: o?.expiryDate ?? null, batchPriority: o?.priority };
      validated = next;
      return next;
    }));
    if (validated) validateBatch(validated);
  }
  function setQty(key: string, q: number) {
    const l = active.cart.find((x) => x.key === key);
    if (l && l.stock > 0 && q > l.stock) { flash(`Only ${l.stock} ${l.uom} of "${l.name}" in stock`); q = l.stock; }
    setCart((c) => c.flatMap((x) => (x.key === key ? (q <= 0 ? [] : [{ ...x, qty: q }]) : [x])));
  }
  const setLine = (key: string, patch: Partial<Line>) => setCart((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setCart((c) => c.filter((l) => l.key !== key));

  // Bill tab actions
  function holdBill() { const b = newBill(); setBills((bs) => [...bs, b]); setActiveId(b.id); setQuery(""); searchRef.current?.focus(); }
  function discardBill(id: number) {
    setBills((bs) => { const next = bs.filter((b) => b.id !== id); if (!next.length) { const nb = newBill(); setActiveId(nb.id); return [nb]; } if (id === activeId) setActiveId(next[0].id); return next; });
  }

  const lineDisc = (l: Line) => { const g = l.qty * l.rate; return l.discType === "val" ? Math.min(l.disc || 0, g) : g * (l.disc || 0) / 100; };
  // Auto-discount resolved live by the central Discount Management engine.
  // `total` = display amount (on MRP or material value); `netReduction` = tax-inclusive
  // reduction that lowers the taxable value so GST recomputes correctly.
  const [autoDisc, setAutoDisc] = useState<{ total: number; netReduction: number; list: { code: string; name: string; discountAmount: number }[] }>({ total: 0, netReduction: 0, list: [] });

  const t = useMemo(() => {
    // Pass 1 — per-line base figures (before the auto-discount).
    const rows = cart.map((l) => {
      const gross = l.qty * l.rate, disc = lineDisc(l), net = gross - disc;
      const tv = taxIncl ? (l.gst > 0 ? net / (1 + l.gst / 100) : net) : net; // material value (pre-tax)
      return { key: l.key, id: l.id, qty: l.qty, gst: l.gst, net, tv };
    });
    const subtotal = cart.reduce((s, l) => s + l.qty * l.rate, 0);
    const itemDisc = cart.reduce((s, l) => s + lineDisc(l), 0);
    const qty = cart.reduce((s, l) => s + l.qty, 0);
    const netOfItem = subtotal - itemDisc;
    const engLines = rows.map((r) => ({ productId: r.id, qty: r.qty, amount: +r.net.toFixed(2), taxable: +r.tv.toFixed(2) }));
    const engineKey = netOfItem.toFixed(2) + "|" + engLines.map((l) => `${l.productId}:${l.qty}:${l.amount}`).join(",");

    const bdIn = Number(active.billDisc) || 0;
    const billDisc = active.billDiscType === "val" ? Math.min(bdIn, netOfItem) : netOfItem * bdIn / 100;
    const redeem = active.redeemValue || 0, coupon = active.couponDiscount || 0, promo = active.promoDiscount || 0;
    let membership = 0;
    if (member?.isMember && active.membershipApply && member.billDiscountPct > 0) {
      membership = +(netOfItem * member.billDiscountPct / 100).toFixed(2);
      if (member.maxDiscount > 0) membership = Math.min(membership, member.maxDiscount);
      membership = Math.max(0, Math.min(membership, netOfItem - billDisc - redeem - coupon - promo));
    }
    const engineBase = +(netOfItem - billDisc - redeem - coupon - promo - membership).toFixed(2);

    // Discount engine result — the tax-INCLUSIVE reduction lowers each line's value so the
    // GST recomputes on the discounted (material) value; `autoDiscount` is what we display.
    const autoDiscount = Math.max(0, Math.min(autoDisc.total, netOfItem));
    const netReduction = Math.max(0, Math.min(autoDisc.netReduction, netOfItem));

    // Pass 2 — apply the reduction per line (proportional to net) + recompute taxable/GST.
    let taxable = 0, tax = 0;
    const rateMap = new Map<number, { taxable: number; tax: number }>();
    const perLine: Record<string, { auto: number; material: number; amount: number; tax: number }> = {};
    for (const r of rows) {
      const share = netOfItem > 0 ? r.net / netOfItem : 0;
      const newNet = r.net - netReduction * share;
      const tv = taxIncl ? (r.gst > 0 ? newNet / (1 + r.gst / 100) : newNet) : newNet;
      const lt = r.gst > 0 ? (taxIncl ? newNet - tv : newNet * r.gst / 100) : 0;
      taxable += tv; tax += lt;
      if (r.gst > 0 && lt > 0) { const e = rateMap.get(r.gst) ?? { taxable: 0, tax: 0 }; e.taxable += tv; e.tax += lt; rateMap.set(r.gst, e); }
      perLine[r.key] = { auto: +(autoDiscount * share).toFixed(2), material: +tv.toFixed(2), tax: +lt.toFixed(2), amount: +(taxIncl ? newNet : newNet + lt).toFixed(2) };
    }
    const taxBreakup = [...rateMap.entries()].sort((a, b) => a[0] - b[0]).map(([rate, v]) => ({ rate, taxable: +v.taxable.toFixed(2), cgst: +(v.tax / 2).toFixed(2), sgst: +(v.tax - v.tax / 2).toFixed(2) }));

    const pre = taxable + tax - billDisc - redeem - coupon - promo - membership;
    const total = Math.max(0, Math.round(pre));
    const giftVoucher = Math.min(active.giftVoucherAmount || 0, total);
    const netDue = Math.max(0, +(total - giftVoucher).toFixed(2));
    return { subtotal, itemDisc, billDisc, redeem, coupon, promo, membership, autoDiscount, engineBase, engineLines: engLines, engineKey, perLine, giftVoucher, netDue, taxable: +taxable.toFixed(2), tax: +tax.toFixed(2), cgst: +(tax / 2).toFixed(2), sgst: +(tax - tax / 2).toFixed(2), taxBreakup, roundOff: +(total - pre).toFixed(2), total, qty };
  }, [cart, active.billDisc, active.billDiscType, active.redeemValue, active.couponDiscount, active.promoDiscount, active.membershipApply, active.giftVoucherAmount, member, taxIncl, autoDisc.total, autoDisc.netReduction]);

  // Live auto-discount preview — asks the Discount engine which rule(s) apply to the cart.
  useEffect(() => {
    if (!cart.length || t.engineBase <= 0) { setAutoDisc((a) => (a.total === 0 && a.list.length === 0 ? a : { total: 0, netReduction: 0, list: [] })); return; }
    const ctrl = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        // NOTE: do NOT send billTaxable here — the engineLines carry the pre-discount
        // material value and the server derives the taxable base from them. Sending the
        // post-discount t.taxable would gross-up on an already-reduced value (drift).
        const j = await fetch("/api/discount/action", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal, body: JSON.stringify({ action: "preview", channel: "POS", customerId: active.customer?.id, billAmount: t.engineBase, lines: t.engineLines }) }).then((r) => r.json());
        if (j.ok && j.result) setAutoDisc({ total: +(j.result.totalDiscount || 0), netReduction: +(j.result.netReductionTotal || 0), list: (j.result.applied || []).map((a: { code: string; name: string; discountAmount: number }) => ({ code: a.code, name: a.name, discountAmount: a.discountAmount })) });
        else setAutoDisc({ total: 0, netReduction: 0, list: [] });
      } catch { /* aborted / offline — no auto-discount */ }
    }, 350);
    return () => { clearTimeout(id); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.engineKey, active.customer?.id]);

  // Clamp a requested redemption against the program rules + available balance + bill.
  function computeRedeem(reqPoints: number): { points: number; value: number } {
    if (!lyCtx || !lyCtx.enabled || !lyCtx.redemptionEnabled) return { points: 0, value: 0 };
    const perPoint = lyCtx.pointValueAmount / (lyCtx.pointValuePoints || 1);
    let p = Math.min(Math.max(0, Math.floor(reqPoints)), lyCtx.available);
    if (lyCtx.maxRedeemPoints != null) p = Math.min(p, lyCtx.maxRedeemPoints);
    if (p <= 0) return { points: 0, value: 0 };
    let val = +(p * perPoint).toFixed(2);
    const billBefore = t.total + (t.redeem || 0);
    const caps = [val, billBefore];
    if (lyCtx.maxRedeemPercent != null) caps.push(+(billBefore * lyCtx.maxRedeemPercent / 100).toFixed(2));
    if (lyCtx.maxRedeemAmount != null) caps.push(lyCtx.maxRedeemAmount);
    const capped = Math.max(0, Math.min(...caps));
    if (capped < val) { p = Math.floor(capped / perPoint); val = +(p * perPoint).toFixed(2); }
    if (lyCtx.minRedeemPoints && p < lyCtx.minRedeemPoints) return { points: 0, value: 0 };
    return { points: p, value: val };
  }
  function applyRedeem() { const r = computeRedeem(Number(redeemInput) || 0); if (r.points <= 0) { flash(`Enter at least ${lyCtx?.minRedeemPoints || 1} redeemable points (within limits).`); return; } patchActive({ redeemPoints: r.points, redeemValue: r.value }); }
  function clearRedeem() { patchActive({ redeemPoints: 0, redeemValue: 0 }); setRedeemInput(""); }

  // Coupon — validate against the current bill; the server checks the campaign/rules
  // and returns the discount. Applied like a bill-level discount; re-validated + the
  // discount recomputed server-side at Complete Sale (client value is display-only).
  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    if (!cart.length) { flash("Add items to the cart before applying a coupon."); return; }
    setCouponBusy(true);
    try {
      const items = cart.map((l) => { const gross = l.qty * l.rate; const net = gross - lineDisc(l); const tv = taxIncl ? (l.gst > 0 ? net / (1 + l.gst / 100) : net) : net; return { productId: l.id, qty: l.qty, amount: +tv.toFixed(2) }; });
      const body = { action: "validate", couponCode: code, billAmount: t.total, customerId: active.customer?.id, channel: "POS", items };
      const j = await fetch("/api/coupon/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      const v = j?.data;
      if (!j?.ok || !v?.valid) { flash(v?.reason || j?.message || "Coupon is not valid for this bill."); setCouponBusy(false); return; }
      const disc = Math.min(Number(v.discountAmount) || 0, t.total);
      if (disc <= 0) { flash("This coupon gives no discount on the current bill."); setCouponBusy(false); return; }
      patchActive({ couponCode: code, couponDiscount: disc, couponCampaign: v.campaignName || "" });
      setCouponInput("");
    } catch { flash("Could not validate the coupon."); }
    setCouponBusy(false);
  }
  function clearCoupon() { patchActive({ couponCode: "", couponDiscount: 0, couponCampaign: "" }); setCouponInput(""); }

  // Promo code — digital promotion, same validate/apply flow as the coupon. The
  // server re-validates + recomputes the discount at Complete Sale.
  async function applyPromo() {
    const pc = promoInput.trim();
    if (!pc) return;
    if (!cart.length) { flash("Add items to the cart before applying a promo code."); return; }
    setPromoBusy(true);
    try {
      const items = cart.map((l) => { const gross = l.qty * l.rate; const net = gross - lineDisc(l); const tv = taxIncl ? (l.gst > 0 ? net / (1 + l.gst / 100) : net) : net; return { productId: l.id, qty: l.qty, amount: +tv.toFixed(2) }; });
      const body = { action: "validate", promoCode: pc, billAmount: t.total, customerId: active.customer?.id, channel: "POS", items };
      const j = await fetch("/api/promo/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      const v = j?.data;
      if (!j?.ok || !v?.valid) { flash(v?.reason || j?.message || "Promo code is not valid for this bill."); setPromoBusy(false); return; }
      const disc = Math.min(Number(v.discountAmount) || 0, t.total);
      if (disc <= 0) { flash("This promo code gives no discount on the current bill."); setPromoBusy(false); return; }
      patchActive({ promoCode: pc, promoDiscount: disc, promoCampaign: v.campaignName || "" });
      setPromoInput("");
    } catch { flash("Could not validate the promo code."); }
    setPromoBusy(false);
  }
  function clearPromo() { patchActive({ promoCode: "", promoDiscount: 0, promoCampaign: "" }); setPromoInput(""); }

  // Gift voucher — stored-value tender. Validates the voucher + applies up to
  // min(balance, amount due) as a payment (reduces the cash due, not the bill total).
  async function applyGiftVoucher() {
    const vno = gvInput.trim();
    if (!vno) return;
    if (!cart.length) { flash("Add items to the cart before applying a gift voucher."); return; }
    setGvBusy(true);
    try {
      const j = await fetch(`/api/gift-voucher/validate?voucherNo=${encodeURIComponent(vno)}&customerId=${active.customer?.id ?? ""}`, { cache: "no-store" }).then((r) => r.json());
      const v = j?.data;
      if (!j?.ok || !v?.valid) { flash(v?.reason || "Gift voucher is not valid."); setGvBusy(false); return; }
      const applied = Math.min(Number(v.availableBalance) || 0, t.total);
      if (applied <= 0) { flash("Voucher has no balance to apply."); setGvBusy(false); return; }
      patchActive({ giftVoucherNo: v.voucherNo, giftVoucherAmount: applied, giftVoucherBalance: Number(v.availableBalance) || 0 });
      setGvInput("");
    } catch { flash("Could not validate the gift voucher."); }
    setGvBusy(false);
  }
  function clearGiftVoucher() { patchActive({ giftVoucherNo: "", giftVoucherAmount: 0, giftVoucherBalance: 0 }); setGvInput(""); }

  const paid = tenders.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const change = Math.max(0, paid - t.netDue);
  function openPay() {
    if (!cart.length) return;
    if (requireCustomer && !active.customer) { flash("Select or add a customer before billing (required by Sales Settings → B2C)."); return; }
    // A batch-tracked line must have a batch chosen before it can be billed.
    const noBatch = cart.find((l) => l.batchTracked && !l.batchNo);
    if (noBatch) { flash(`Select a batch for "${noBatch.name}" before billing.`); return; }
    // Restrict-policy out-of-order lines block billing; warn-policy lines do not.
    const blocked = cart.find((l) => isRestricted(l));
    if (blocked) {
      const order = blocked.batchOrder || "FEFO";
      const p1No = blocked.batches?.find((b) => b.priority === 1)?.batchNo || "P1";
      flash(`${blocked.batchNo || "(no batch)"} is priority ${blocked.batchPriority} — ${order} requires priority 1 (${p1No}). Sales restricted for ${blocked.name}.`);
      return;
    }
    setTenders([{ mode: "Cash", amount: String(t.netDue) }]); setPayOpen(true);
  }
  // Show the Batch / Mfg / Exp columns only when the cart has a batch-tracked line
  // (incl. mixed carts — non-batch lines show "—").
  const showBatchCols = cart.some((l) => l.batchTracked || !!l.batchNo);

  // First unmet mandatory field per the B2C settings (also disables Save).
  function custMissing(): string | null {
    if (!newCust.name.trim()) return "Customer name is required.";
    if (isMandatory("mobileMandatoryB2c") && !newCust.phone.trim()) return "Mobile number is mandatory (Sales Settings → B2C).";
    if (isMandatory("gstMandatoryB2c") && !newCust.gstin.trim()) return "GST number is mandatory (Sales Settings → B2C).";
    return null;
  }
  async function saveCustomer() {
    const miss = custMissing();
    if (miss) { flash(miss); return; }
    const j = await fetch("/api/masters/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCust) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { patchActive({ customer: j.customer }); setAddingCust(false); setNewCust({ ...EMPTY_CUST }); }
  }

  async function complete() {
    setBusy(true);
    const payload = {
      saleDate: new Date().toISOString().slice(0, 10), warehouse: "Main Store",
      customerId: active.customer?.id, customerName: active.customer?.name, customerPhone: active.customer?.phone,
      billDiscount: Number(active.billDisc) || 0, billDiscType: active.billDiscType,
      loyaltyRedeemPoints: active.redeemPoints || 0,
      couponCode: active.couponCode || undefined,
      promoCode: active.promoCode || undefined,
      membershipApply: !!(member?.isMember && active.membershipApply),
      giftVoucherNo: active.giftVoucherNo || undefined,
      giftVoucherAmount: active.giftVoucherAmount || undefined,
      lines: cart.map((l) => ({ productId: l.id, productName: l.name, sku: l.sku, hsn: l.hsn, uom: l.uom, qty: l.qty, mrp: l.mrp, rate: l.rate, disc: l.disc, discType: l.discType, taxPct: l.gst, batchNo: l.batchNo ?? undefined, mfgDate: l.mfgDate ?? undefined, expiryDate: l.expiryDate ?? undefined, qrCodes: l.qrCodes && l.qrCodes.length ? l.qrCodes : undefined })),
      payments: tenders.filter((p) => Number(p.amount) > 0).map((p) => ({ mode: p.mode, amount: p.amount })),
    };
    try {
      const res = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { window.alert(j?.message || "Could not complete the sale."); setBusy(false); return; }
      const full = await fetch(`/api/sales/${j.id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (full.ok) setReceipt({ business: full.business, template: full.template, sale: full.sale });
      setPayOpen(false); loadStats();
    } catch { window.alert("Network error."); }
    setBusy(false);
  }

  function afterSale() { setReceipt(null); discardBill(activeId); setTenders([{ mode: "Cash", amount: "" }]); setQuery(""); searchRef.current?.focus(); }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Sales</span><span className="text-subtle">/</span><span className="font-medium text-foreground">POS Billing (B2C)</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ShoppingCart className="h-5 w-5 text-primary" /> POS Billing</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs shadow-sm">Today: <strong className="text-foreground">{fm(stats.todaySales)}</strong> · {stats.todayBills} bills</span>
          <Link href="/sales/history" className="text-xs font-semibold text-primary hover:underline">Sales History →</Link>
        </div>
      </div>

      {/* Multi-bill tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {bills.map((b, i) => (
          <button key={b.id} onClick={() => setActiveId(b.id)} className={cn("group inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition", b.id === activeId ? "border-primary bg-primary text-white" : "border-border bg-surface text-muted hover:border-primary/40")}>
            Bill {i + 1}{b.cart.length > 0 && <span className={cn("rounded-full px-1.5 text-[10px]", b.id === activeId ? "bg-white/25" : "bg-primary-subtle text-primary")}>{b.cart.length}</span>}
            {bills.length > 1 && <span onClick={(e) => { e.stopPropagation(); discardBill(b.id); }} className="ml-0.5 opacity-50 hover:opacity-100"><X className="h-3 w-3" /></span>}
          </button>
        ))}
        <button onClick={holdBill} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border-strong px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"><PauseCircle className="h-3.5 w-3.5" /> Hold / New</button>
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-[1fr_380px]">
        {/* LEFT — search + cart */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="relative shrink-0 rounded-2xl border border-primary/30 bg-primary-subtle/20 p-3 shadow-sm">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary"><Search className="h-3.5 w-3.5" /> Scan or search product (name · SKU · barcode · QR)</label>
            <input ref={searchRef} value={query} autoFocus onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) addHit(hits[0]); }} placeholder="Type or scan…" className="h-11 w-full rounded-lg border border-primary/40 bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:shadow-focus" />
            {query && hits.length > 0 && (
              <div className="absolute left-3 right-3 z-30 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
                {hits.map((h) => (
                  <button key={h.id} onClick={() => addHit(h)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-primary-subtle/50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{h.name}</span>
                      <span className="font-mono text-2xs text-subtle">{h.sku} · {h.gst}% GST{h.mrp > h.price ? ` · MRP ${fm(h.mrp)}` : ""}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="text-sm font-bold text-foreground">{fm(h.price)}</span>
                      <span className={cn("rounded-full px-1.5 text-2xs font-semibold", h.stock > 0 ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger")}>{h.stock > 0 ? `In stock: ${h.stock} ${h.uom}` : "Out of stock"}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {query && hits.length === 0 && <div className="absolute left-3 right-3 z-30 mt-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted shadow-xl">No product found.</div>}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5"><span className="flex items-center gap-2 text-sm font-bold text-foreground"><Boxes className="h-4 w-4 text-primary" /> Cart ({cart.length})</span><div className="flex items-center gap-2"><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", taxIncl ? "bg-primary-subtle text-primary" : "bg-amber-500/15 text-amber-600")}>{taxIncl ? "Rate incl. GST" : "Rate excl. GST"}</span>{cart.length > 0 && <button onClick={() => patchActive({ cart: [], couponCode: "", couponDiscount: 0, couponCampaign: "", promoCode: "", promoDiscount: 0, promoCampaign: "" })} className="text-2xs font-semibold text-danger hover:underline">Clear</button>}</div></div>
            <div className="min-h-[240px] flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Item</th>{showBatchCols && <><th className="px-3 py-2.5">Batch No</th><th className="px-3 py-2.5">Mfg Date</th><th className="px-3 py-2.5">Exp Date</th></>}<th className="px-3 py-2.5 text-center">Qty</th><th className="px-3 py-2.5 text-right">Rate</th><th className="px-3 py-2.5 text-right">Discount</th><th className="px-3 py-2.5 text-right">Taxable Value</th><th className="px-3 py-2.5 text-right">Tax</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5" /></tr></thead>
                <tbody>
                  {cart.map((l) => {
                    const over = l.stock > 0 && l.qty > l.stock;
                    return (
                    <tr key={l.key} className="border-b border-border last:border-0">
                      <td className="px-3 py-2"><div className="font-medium text-foreground">{l.name}</div><div className="font-mono text-2xs"><span className="text-subtle">{l.sku} · {l.gst}% · </span><span className={cn("font-semibold", l.stock <= 0 ? "text-danger" : over ? "text-danger" : "text-success")}>stock {l.stock}</span></div>{l.qrCodes && l.qrCodes.length > 0 && <div className="text-[10px] text-subtle">QR ×{l.qrCodes.length}</div>}</td>
                      {showBatchCols && (l.batchTracked ? (
                        <>
                          <td className="px-3 py-2 align-top">
                            {l.batches && l.batches.length > 1 ? (
                              <div className="flex w-44 flex-col gap-1">
                                {l.batchOrder && <span className="text-[10px] font-semibold uppercase tracking-wide text-subtle">{l.batchOrder} order</span>}
                                <select value={l.batchNo ?? ""} onChange={(e) => selectBatch(l.key, e.target.value)} className={cn("h-8 w-full rounded-md border bg-surface-2 px-2 text-2xs focus:outline-none", isRestricted(l) ? "border-danger focus:border-danger" : !l.batchNo ? "border-danger" : "border-border focus:border-primary")}>
                                  <option value="">Select batch…</option>
                                  {l.batches.map((b, bi) => <option key={bi} value={b.batchNo ?? ""}>{`P${b.priority} · ${b.batchNo || "(no batch)"} · Exp ${b.expiryDate || "—"} · Qty ${b.qtyOnHand}`}{b.priority === 1 ? " (recommended)" : ""}</option>)}
                                </select>
                                <BatchChip line={l} />
                              </div>
                            ) : (
                              <div className="flex w-32 flex-col gap-1">
                                <span className={cn("font-mono text-2xs", l.batchNo ? "text-foreground" : "text-subtle")}>{l.batchNo || (l.batches ? "—" : "loading…")}</span>
                                <BatchChip line={l} />
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 align-top text-2xs text-muted">{l.mfgDate || "—"}</td>
                          <td className="px-3 py-2 align-top text-2xs text-muted">{l.expiryDate || "—"}</td>
                        </>
                      ) : (
                        <><td className="px-3 py-2 text-2xs text-subtle">—</td><td className="px-3 py-2 text-2xs text-subtle">—</td><td className="px-3 py-2 text-2xs text-subtle">—</td></>
                      ))}
                      <td className="px-3 py-2"><div className="flex items-center justify-center gap-1"><button onClick={() => setQty(l.key, l.qty - 1)} className="grid h-6 w-6 place-items-center rounded border border-border text-muted hover:text-primary"><Minus className="h-3 w-3" /></button><input type="number" value={l.qty} onChange={(e) => setQty(l.key, Number(e.target.value))} className={cn("h-7 w-12 rounded border bg-surface-2 text-center text-xs focus:outline-none", over ? "border-danger" : "border-border focus:border-primary")} /><button onClick={() => setQty(l.key, l.qty + 1)} className="grid h-6 w-6 place-items-center rounded border border-border text-muted hover:text-primary"><Plus className="h-3 w-3" /></button><UomConvert qty={l.qty} uom={l.uom} onChange={(v) => setQty(l.key, v)} /></div></td>
                      <td className="px-3 py-2 text-right"><input type="number" value={l.rate} onChange={(e) => setLine(l.key, { rate: Number(e.target.value) })} className="h-7 w-20 rounded border border-border bg-surface-2 px-1 text-right text-xs focus:border-primary focus:outline-none" />{taxIncl && l.gst > 0 && <div className="mt-0.5 text-[10px] text-subtle">Material {fm(l.rate / (1 + l.gst / 100))}</div>}</td>
                      <td className="px-3 py-2"><div className="flex flex-col items-end gap-0.5"><div className="flex items-center justify-end gap-1"><input type="number" value={l.disc || ""} onChange={(e) => setLine(l.key, { disc: Math.max(0, Number(e.target.value)) })} placeholder="0" className="h-7 w-14 rounded border border-border bg-surface-2 px-1 text-right text-xs focus:border-primary focus:outline-none" /><button onClick={() => setLine(l.key, { discType: l.discType === "pct" ? "val" : "pct" })} className="grid h-7 w-7 place-items-center rounded border border-border bg-surface text-2xs font-bold text-muted hover:text-primary">{l.discType === "pct" ? "%" : "₹"}</button></div>{l.discType === "pct" && l.disc > 0 && <span className="text-[10px] font-medium text-success">= {fm(lineDisc(l))}</span>}{(t.perLine[l.key]?.auto ?? 0) > 0 && <span className="text-[10px] font-semibold text-primary">Offer − {fm(t.perLine[l.key].auto)}</span>}</div></td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-foreground">{fm(t.perLine[l.key]?.material ?? lineMaterial(l, taxIncl))}</td>
                      <td className="px-3 py-2 text-right text-2xs text-muted">{l.gst > 0 ? <><div className="font-medium text-foreground">{fm(t.perLine[l.key]?.tax ?? lineTaxAmt(l, taxIncl))}</div><div className="text-[10px] text-subtle">@{l.gst}%</div></> : "—"}</td>
                      <td className="px-3 py-2 text-right"><div className="font-semibold text-foreground">{fm(t.perLine[l.key]?.amount ?? (l.qty * l.rate - lineDisc(l) + (taxIncl ? 0 : lineTaxAmt(l, taxIncl))))}</div></td>
                      <td className="px-3 py-2 text-right"><button onClick={() => removeLine(l.key)} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );})}
                  {cart.length === 0 && <tr><td colSpan={showBatchCols ? 11 : 8} className="px-4 py-14 text-center text-sm text-muted">Scan or search a product to start billing.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Offer sections — within the left pane, aligned with the item table (4-up row, right-aligned; room for more) ── */}
          <div className="grid shrink-0 gap-3 grid-cols-2 lg:grid-cols-4">
            {/* Gift Voucher (stored-value payment tender) */}
            <div className="overflow-hidden rounded-2xl border border-amber-600/30 shadow-sm ring-1 ring-amber-600/10 lg:col-start-2">
              <div className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-700 px-3.5 py-2 text-2xs font-bold text-white"><Wallet className="h-3.5 w-3.5" /> Gift Voucher</div>
              <div className="bg-card p-3">
                {active.giftVoucherAmount > 0 ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-success/40 bg-success-subtle/40 px-2.5 py-1.5">
                    <span className="min-w-0 truncate text-2xs font-bold text-success"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{active.giftVoucherNo} · {fm(active.giftVoucherAmount)}</span>
                    <button onClick={clearGiftVoucher} className="shrink-0 text-2xs font-semibold text-danger hover:underline">Remove</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input value={gvInput} onChange={(e) => setGvInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") applyGiftVoucher(); }} placeholder="Gift voucher no." disabled={!cart.length || gvBusy} className={cn(inp, "w-full text-xs disabled:opacity-50")} />
                    <Button size="sm" className="w-full" onClick={applyGiftVoucher} disabled={!cart.length || gvBusy || !gvInput.trim()}><Wallet className="h-3.5 w-3.5" /> {gvBusy ? "…" : "Apply Voucher"}</Button>
                  </div>
                )}
              </div>
            </div>
            {/* Coupon */}
            <div className="overflow-hidden rounded-2xl border border-sky-600/30 shadow-sm ring-1 ring-sky-600/10 lg:col-start-3">
              <div className="flex items-center gap-2 bg-gradient-to-r from-sky-700 to-blue-800 px-3.5 py-2 text-2xs font-bold text-white"><TicketPercent className="h-3.5 w-3.5" /> Coupon</div>
              <div className="bg-card p-3">
                {active.couponDiscount > 0 ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-success/40 bg-success-subtle/40 px-2.5 py-1.5">
                    <span className="min-w-0 truncate text-2xs font-bold text-success"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{active.couponCode} · {fm(active.couponDiscount)}</span>
                    <button onClick={clearCoupon} className="shrink-0 text-2xs font-semibold text-danger hover:underline">Remove</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }} placeholder="Coupon number / code" disabled={!cart.length || couponBusy} className={cn(inp, "w-full text-xs disabled:opacity-50")} />
                    <Button size="sm" className="w-full" onClick={applyCoupon} disabled={!cart.length || couponBusy || !couponInput.trim()}><TicketPercent className="h-3.5 w-3.5" /> {couponBusy ? "…" : "Apply Coupon"}</Button>
                  </div>
                )}
              </div>
            </div>
            {/* Promo */}
            <div className="overflow-hidden rounded-2xl border border-primary/30 shadow-sm ring-1 ring-primary/10 lg:col-start-4">
              <div className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent px-3.5 py-2 text-2xs font-bold text-white"><Megaphone className="h-3.5 w-3.5" /> Promo Code</div>
              <div className="bg-card p-3">
                {active.promoDiscount > 0 ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-success/40 bg-success-subtle/40 px-2.5 py-1.5">
                    <span className="min-w-0 truncate text-2xs font-bold text-success"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{active.promoCode} · {fm(active.promoDiscount)}</span>
                    <button onClick={clearPromo} className="shrink-0 text-2xs font-semibold text-danger hover:underline">Remove</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") applyPromo(); }} placeholder="Promo code" disabled={!cart.length || promoBusy} className={cn(inp, "w-full text-xs disabled:opacity-50")} />
                    <Button size="sm" className="w-full" onClick={applyPromo} disabled={!cart.length || promoBusy || !promoInput.trim()}><Megaphone className="h-3.5 w-3.5" /> {promoBusy ? "…" : "Apply Promo"}</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — customer + totals + pay */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-bold text-foreground"><User className="h-4 w-4 text-primary" /> Customer</span>{active.customer && <button onClick={() => patchActive({ customer: null })} className="text-2xs font-semibold text-danger hover:underline">Remove</button>}</div>
            {active.customer ? (
              <div className="rounded-lg bg-primary-subtle/40 px-3 py-2"><div className="flex items-center gap-1.5"><span className="font-semibold text-foreground">{active.customer.name}</span>{member?.isMember && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: member.themeColor || "#b45309" }}><Crown className="h-3 w-3" /> {member.levelName}</span>}</div><div className="text-2xs text-muted">{active.customer.phone || "—"}{active.customer.gstin ? ` · GST ${active.customer.gstin}` : ""}{member?.isMember && member.membershipNumber ? ` · ${member.membershipNumber}` : ""}</div></div>
            ) : (
              <div className="relative">
                <div className="flex gap-2">
                  <input value={custQuery} onChange={(e) => setCustQuery(e.target.value)} placeholder="Search by phone / name…" className={cn(inp, "min-w-0 flex-1")} />
                  {salesFlag("allowQuickCustomer") && <Button size="sm" variant="outline" onClick={() => { setNewCust({ ...EMPTY_CUST, phone: custQuery }); setAddingCust(true); }}><Plus className="h-3.5 w-3.5" /> New</Button>}
                </div>
                {custQuery && custHits.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                    {custHits.map((c) => <button key={c.id} onClick={() => { patchActive({ customer: c }); setCustQuery(""); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary-subtle/40"><span className="font-medium text-foreground">{c.name}</span><span className="text-2xs text-subtle">{c.phone}</span></button>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Membership (highlighted, distinct section) ── */}
          {active.customer && member?.isMember && (
            <div className="overflow-hidden rounded-2xl border border-amber-500/40 shadow-sm ring-1 ring-amber-500/10">
              <div className="flex items-center justify-between px-4 py-2.5 text-white" style={{ background: `linear-gradient(135deg, ${member.themeColor || "#b45309"}, #78350f)` }}>
                <span className="flex items-center gap-2 text-sm font-bold"><Crown className="h-4 w-4" /> {member.levelName} Member</span>
                {member.membershipNumber && <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-2xs font-bold">{member.membershipNumber}</span>}
              </div>
              <div className="bg-card p-4">
                <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-surface-2/60 text-center">
                  <div className="px-2 py-2.5"><div className="text-base font-bold tabular-nums text-foreground">{member.billDiscountPct}%</div><div className="text-2xs font-medium text-muted">Bill Discount</div></div>
                  <div className="px-2 py-2.5"><div className="text-base font-bold tabular-nums text-primary">{member.pointMultiplier}×</div><div className="text-2xs font-medium text-muted">Points</div></div>
                  <div className="px-2 py-2.5"><div className="text-base font-bold tabular-nums text-success">{fm(t.membership)}</div><div className="text-2xs font-medium text-muted">This Bill</div></div>
                </div>
                {member.billDiscountPct > 0 ? (
                  active.membershipApply ? (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-success/40 bg-success-subtle/40 px-3 py-2">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-success"><CheckCircle2 className="h-4 w-4 shrink-0" /> {member.levelName} discount {member.billDiscountPct}% applied{t.membership > 0 ? ` · ${fm(t.membership)}` : ""}</span>
                      <button onClick={() => patchActive({ membershipApply: false })} className="text-2xs font-semibold text-danger hover:underline">Remove</button>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
                      <span className="text-2xs text-muted">Member discount not applied</span>
                      <button onClick={() => patchActive({ membershipApply: true })} className="text-2xs font-semibold text-primary hover:underline">Apply {member.billDiscountPct}%</button>
                    </div>
                  )
                ) : <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-center text-2xs text-muted">No bill-discount benefit configured for this level.</div>}
              </div>
            </div>
          )}

          {/* ── Loyalty Rewards (highlighted, distinct section) ── */}
          {active.customer && lyCtx?.enabled && (
            <div className="overflow-hidden rounded-2xl border border-primary/40 shadow-sm ring-1 ring-primary/10">
              <div className="flex items-center justify-between bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-white">
                <span className="flex items-center gap-2 text-sm font-bold"><Gift className="h-4 w-4" /> Loyalty Rewards</span>
                <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-2xs font-bold tabular-nums">{lyCtx.available.toLocaleString()} pts</span>
              </div>
              <div className="bg-card p-4">
                <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-surface-2/60 text-center">
                  <div className="px-2 py-2.5"><div className="text-base font-bold tabular-nums text-foreground">{lyCtx.available.toLocaleString()}</div><div className="text-2xs font-medium text-muted">Available</div></div>
                  <div className="px-2 py-2.5"><div className="text-base font-bold tabular-nums text-primary">{fm(lyCtx.available * lyCtx.pointValueAmount / (lyCtx.pointValuePoints || 1))}</div><div className="text-2xs font-medium text-muted">Value</div></div>
                  <div className="px-2 py-2.5"><div className="text-base font-bold tabular-nums text-success">{fm(computeRedeem(lyCtx.available).value)}</div><div className="text-2xs font-medium text-muted">Redeemable</div></div>
                </div>
                {lyCtx.redemptionEnabled ? (
                  active.redeemPoints > 0 ? (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-success/40 bg-success-subtle/40 px-3 py-2">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-success"><CheckCircle2 className="h-4 w-4 shrink-0" /> {active.redeemPoints} pts applied · {fm(active.redeemValue)}</span>
                      <button onClick={clearRedeem} className="text-2xs font-semibold text-danger hover:underline">Remove</button>
                    </div>
                  ) : lyCtx.available > 0 ? (
                    <>
                      <div className="mt-3 flex items-center gap-2">
                        <input type="number" value={redeemInput} onChange={(e) => setRedeemInput(e.target.value)} placeholder={`Points to redeem (min ${lyCtx.minRedeemPoints || 1})`} disabled={!cart.length} className="h-9 min-w-0 flex-1 rounded-lg border border-primary/40 bg-surface px-3 text-sm focus:border-primary focus:outline-none disabled:opacity-50" />
                        <Button size="md" onClick={applyRedeem} disabled={!cart.length}><Gift className="h-4 w-4" /> Redeem</Button>
                      </div>
                      {!cart.length && <p className="mt-1.5 text-2xs text-subtle">Add items to the cart to redeem points.</p>}
                    </>
                  ) : <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-center text-2xs text-muted">No points available to redeem yet.</div>
                ) : <div className="mt-3 text-center text-2xs text-subtle">Redemption is disabled for this program.</div>}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="space-y-1.5 text-sm">
              <Row k={`Items (${t.qty})`} v={fm(t.subtotal)} />
              {t.itemDisc > 0 && <Row k="Item Discount" v={`- ${fm(t.itemDisc)}`} tone="danger" />}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Bill Discount</span>
                <div className="flex items-center gap-1">
                  <input type="number" value={active.billDisc} onChange={(e) => patchActive({ billDisc: e.target.value })} placeholder="0" className="h-7 w-20 rounded border border-border-strong bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" />
                  <button onClick={() => patchActive({ billDiscType: active.billDiscType === "pct" ? "val" : "pct" })} className="grid h-7 w-7 place-items-center rounded border border-border bg-surface text-2xs font-bold text-muted hover:text-primary">{active.billDiscType === "pct" ? "%" : "₹"}</button>
                </div>
              </div>
              {t.billDisc > 0 && <Row k="" v={`- ${fm(t.billDisc)}`} tone="danger" />}
              {t.redeem > 0 && <Row k="Loyalty Redeemed" v={`- ${fm(t.redeem)}`} tone="danger" />}
              {t.coupon > 0 && <Row k={`Coupon${active.couponCode ? ` (${active.couponCode})` : ""}`} v={`- ${fm(t.coupon)}`} tone="danger" />}
              {t.promo > 0 && <Row k={`Promo${active.promoCode ? ` (${active.promoCode})` : ""}`} v={`- ${fm(t.promo)}`} tone="danger" />}
              {t.membership > 0 && <Row k={`Membership${member ? ` (${member.levelName} ${member.billDiscountPct}%)` : ""}`} v={`- ${fm(t.membership)}`} tone="danger" />}
              {t.autoDiscount > 0 && <Row k={`Discount${autoDisc.list.length === 1 ? ` (${autoDisc.list[0].name})` : autoDisc.list.length > 1 ? ` (${autoDisc.list.length} offers)` : ""}`} v={`- ${fm(t.autoDiscount)}`} tone="danger" />}
              <Row k="Taxable Value" v={fm(t.taxable)} />
              {t.taxBreakup.length
                ? t.taxBreakup.map((b) => (
                    <Fragment key={b.rate}>
                      <Row k={`CGST @${b.rate / 2}%`} v={fm(b.cgst)} />
                      <Row k={`SGST @${b.rate / 2}%`} v={fm(b.sgst)} />
                    </Fragment>
                  ))
                : (<><Row k="CGST" v={fm(t.cgst)} /><Row k="SGST" v={fm(t.sgst)} /></>)}
              {t.roundOff !== 0 && <Row k="Round Off" v={fm(t.roundOff)} />}
              <div className="my-1.5 h-px bg-border" />
              <div className="flex items-center justify-between text-lg font-bold text-foreground"><span>TOTAL</span><span>{fm(t.total)}</span></div>
              {t.giftVoucher > 0 && <><Row k={`Gift Voucher${active.giftVoucherNo ? ` (${active.giftVoucherNo})` : ""}`} v={`- ${fm(t.giftVoucher)}`} tone="danger" /><div className="flex items-center justify-between text-base font-bold text-primary"><span>To Pay</span><span>{fm(t.netDue)}</span></div></>}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="lg" onClick={holdBill} disabled={!cart.length} className="shrink-0"><PauseCircle className="h-4 w-4" /> Hold</Button>
              <Button size="lg" className="flex-1" onClick={openPay} disabled={!cart.length}><Wallet className="h-4 w-4" /> Pay {fm(t.netDue)}</Button>
            </div>
          </div>

        </aside>
      </div>

      {payOpen && (
        <Modal title="Payment" subtitle={`Total ${fm(t.total)}`} icon={Wallet} onClose={() => setPayOpen(false)}>
          <div className="space-y-3">
            {tenders.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={p.mode} onChange={(e) => setTenders((ts) => ts.map((x, j) => (j === i ? { ...x, mode: e.target.value } : x)))} className="h-10 w-32 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none">{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</select>
                <input type="number" value={p.amount} onChange={(e) => setTenders((ts) => ts.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} placeholder="0.00" className="h-10 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-3 text-right text-sm focus:border-primary focus:outline-none" />
                {tenders.length > 1 && <button onClick={() => setTenders((ts) => ts.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-danger-subtle hover:text-danger"><X className="h-4 w-4" /></button>}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setTenders((ts) => [...ts, { mode: "Card", amount: "" }])} className="rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-primary hover:border-primary"><Plus className="mr-1 inline h-3 w-3" /> Split</button>
              <button onClick={() => setTenders([{ mode: "Cash", amount: String(t.netDue) }])} className="rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-muted hover:border-primary hover:text-primary">Exact cash</button>
            </div>
            {t.giftVoucher > 0 && <div className="rounded-lg border border-primary/30 bg-primary-subtle/20 px-3 py-1.5 text-2xs text-foreground">Gift voucher {active.giftVoucherNo} covers {fm(t.giftVoucher)} · remaining to collect {fm(t.netDue)}</div>}
            <div className="rounded-lg bg-surface-2 p-3 text-sm"><Row k="Paid" v={fm(paid)} /><Row k="Balance" v={fm(Math.max(0, t.netDue - paid))} tone={paid >= t.netDue ? undefined : "danger"} /><div className="mt-1 flex items-center justify-between font-bold text-foreground"><span>Change to return</span><span className="text-success">{fm(change)}</span></div></div>
            <Button size="lg" className="w-full" onClick={complete} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Processing…" : `Complete Sale (${fm(t.netDue)})`}</Button>
            {paid < t.netDue && <p className="text-center text-2xs text-warning">Partial tender — the balance will be recorded as Credit.</p>}
          </div>
        </Modal>
      )}

      {/* Add customer — popup */}
      {addingCust && (
        <Modal title="Add Customer" subtitle="Fields follow Sales Settings → B2C" icon={User} onClose={() => setAddingCust(false)}>
          <div className="space-y-3">
            <Fld label="Customer Name *"><input value={newCust.name} autoFocus onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="Full name" className={inp} /></Fld>
            <div className="grid grid-cols-2 gap-3">
              {CAPTURE_FIELDS.filter((f) => capOn(f.id) || isMandatory(f.mandatoryFlag)).map((f) => (
                <Fld key={f.id} label={`${f.label}${isMandatory(f.mandatoryFlag) ? " *" : ""}`} className={f.full ? "col-span-2" : undefined}>
                  <input type={f.type ?? "text"} value={newCust[f.key]} onChange={(e) => setNewCust({ ...newCust, [f.key]: e.target.value })} placeholder={f.placeholder} className={inp} />
                </Fld>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1"><Button variant="ghost" size="md" onClick={() => setAddingCust(false)}>Cancel</Button><Button size="md" onClick={saveCustomer} disabled={!!custMissing()}><CheckCircle2 className="h-4 w-4" /> Save Customer</Button></div>
          </div>
        </Modal>
      )}

      {receipt && <ReceiptModal data={receipt} fm={fm} onNew={afterSale} onClose={() => setReceipt(null)} />}

      {warn && <div className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-warning/40 bg-warning px-4 py-2.5 text-sm font-medium text-white shadow-lg">{warn}</div>}
    </div>
  );
}

/** Per-line valuation status chip: green when on the recommended priority-1 batch,
 *  amber for a warn-policy out-of-order pick, red for a restrict-policy violation. */
function BatchChip({ line }: { line: Line }) {
  if (!line.batchTracked || !line.batchPriority) return null;
  const order = line.batchOrder || "FEFO";
  const out = !!(line.enforce && line.batchPriority > 1);
  if (!out) return <span className="inline-flex items-center rounded-full bg-success-subtle px-1.5 py-0.5 text-[10px] font-semibold text-success">✓ P1 ({order})</span>;
  if (line.batchSalesPolicy === "restrict") return <span className="inline-flex items-center rounded-full bg-danger-subtle px-1.5 py-0.5 text-[10px] font-semibold text-danger">✕ Restricted — pick P1</span>;
  return <span className="inline-flex items-center rounded-full bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold text-warning">⚠ P{line.batchPriority} — not recommended</span>;
}

function Fld({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>;
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none";
function Row({ k, v, tone }: { k: string; v: string; tone?: "danger" }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className={cn("font-medium", tone === "danger" ? "text-danger" : "text-foreground")}>{v}</span></div>;
}
function Modal({ title, subtitle, icon: Icon, children, onClose }: { title: string; subtitle?: string; icon: typeof Wallet; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><Icon className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-foreground">{title}</h2>{subtitle && <p className="text-2xs text-muted">{subtitle}</p>}</div></div><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Build a template-driven receipt and print it. */
export function buildReceiptHtml(business: Record<string, string>, tpl: Record<string, unknown>, s: Record<string, unknown>): string {
  const N = (v: unknown) => Number(v) || 0;
  const B = (v: unknown) => v === true || v === "true";
  const paper = String(tpl.paperSize || "80mm");
  const widthMm = paper === "58mm" ? 54 : paper === "80mm" ? 74 : paper === "A5" ? 138 : 188;
  const thermal = paper === "58mm" || paper === "80mm";
  const lines = (s.lines as Array<Record<string, unknown>>) ?? [];
  const pays = (s.payments as Array<Record<string, unknown>>) ?? [];
  const savings = lines.reduce((a, l) => a + Math.max(0, (N(l.mrp) - N(l.rate)) * N(l.qty)), 0);

  const rows = lines.map((l) => {
    const sub = `${N(l.qty)} x ${N(l.rate).toFixed(2)}${N(l.discAmount) ? ` (-${N(l.discAmount).toFixed(2)})` : ""}${B(tpl.showHsn) && l.hsn ? ` · HSN ${esc(String(l.hsn))}` : ""}${B(tpl.showItemTax) ? ` · ${N(l.taxPct)}%` : ""}${B(tpl.showMrp) && N(l.mrp) > N(l.rate) ? ` · MRP ${N(l.mrp).toFixed(2)}` : ""}`;
    return `<tr><td>${esc(String(l.productName))}<br><span class="dim">${sub}</span></td><td class="r">${N(l.value).toFixed(2)}</td></tr>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(String(s.invoiceNo))}</title><style>
    @page{size:${thermal ? `${paper === "58mm" ? 58 : 80}mm auto` : paper};margin:${thermal ? "3mm" : "10mm"}}*{box-sizing:border-box}
    body{font-family:${thermal ? 'ui-monospace,"Courier New",monospace' : "ui-sans-serif,system-ui,Arial"};font-size:${thermal ? 11 : 12}px;color:#000;width:${widthMm}mm;margin:0 auto}
    .c{text-align:center}.r{text-align:right}.dim{color:#555;font-size:${thermal ? 10 : 11}px}h2{margin:2px 0;font-size:${thermal ? 14 : 18}px}
    table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}.line{border-top:1px dashed #000;margin:4px 0}.big{font-size:${thermal ? 13 : 15}px;font-weight:bold}
  </style></head><body>
    <div class="c"><h2>${esc(business.name)}</h2>${tpl.headerNote ? `<div class="dim">${esc(String(tpl.headerNote))}</div>` : ""}${business.address ? `<div class="dim">${esc(business.address)}</div>` : ""}${business.phone ? `<div class="dim">Ph: ${esc(business.phone)}</div>` : ""}${B(tpl.showGstin) && business.gstin ? `<div class="dim">GSTIN: ${esc(business.gstin)}</div>` : ""}<div style="margin-top:3px;font-weight:bold">${esc(String(tpl.title || "Tax Invoice"))}</div></div>
    <div class="line"></div>
    <div>Bill: ${esc(String(s.invoiceNo))}</div><div>Date: ${esc(String(s.saleDate))}</div>${B(tpl.showCustomer) ? `<div>Customer: ${esc(String(s.customerName))}${s.customerPhone ? ` (${esc(String(s.customerPhone))})` : ""}</div>` : ""}
    <div class="line"></div>
    <table>${rows}</table>
    <div class="line"></div>
    <table class="tot">
      ${B(tpl.showTaxBreakup) ? `<tr><td>Taxable</td><td class="r">${N(s.taxableValue).toFixed(2)}</td></tr><tr><td>CGST</td><td class="r">${N(s.cgst).toFixed(2)}</td></tr><tr><td>SGST</td><td class="r">${N(s.sgst).toFixed(2)}</td></tr>` : ""}
      ${N(s.billDiscount) ? `<tr><td>Bill Disc</td><td class="r">-${N(s.billDiscount).toFixed(2)}</td></tr>` : ""}
      ${N(s.roundOff) ? `<tr><td>Round Off</td><td class="r">${N(s.roundOff).toFixed(2)}</td></tr>` : ""}
      <tr class="big"><td>TOTAL</td><td class="r">${N(s.total).toFixed(2)}</td></tr>
    </table>
    <div class="line"></div>
    <table>${pays.map((p) => `<tr><td>${esc(String(p.mode))}</td><td class="r">${N(p.amount).toFixed(2)}</td></tr>`).join("")}${N(s.changeDue) ? `<tr><td>Change</td><td class="r">${N(s.changeDue).toFixed(2)}</td></tr>` : ""}</table>
    <div class="line"></div>
    <div class="c">Items: ${N(s.itemCount)}${B(tpl.showSavings) && savings > 0 ? ` &nbsp; You saved ${savings.toFixed(2)}` : ""}</div>
    <div class="c" style="margin-top:4px">${esc(String(tpl.thankYouMessage || "Thank you!"))}</div>${tpl.footerNote ? `<div class="c dim" style="margin-top:3px">${esc(String(tpl.footerNote))}</div>` : ""}
    <script>window.onload=function(){setTimeout(function(){window.print()},150)}</script></body></html>`;
}

function ReceiptModal({ data, fm, onNew, onClose }: { data: { business: Record<string, string>; template: Record<string, unknown>; sale: Record<string, unknown> }; fm: (n: number) => string; onNew: () => void; onClose: () => void }) {
  const s = data.sale; const N = (v: unknown) => Number(v) || 0;
  const pays = (s.payments as Array<Record<string, unknown>>) ?? [];
  function print() { const html = buildReceiptHtml(data.business, data.template, s); const w = window.open("", "_blank", "width=420,height=680"); if (!w) return; w.document.write(html); w.document.close(); }
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-1 border-b border-border bg-success-subtle px-5 py-4 text-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-6 w-6" /></span><p className="text-sm font-bold text-foreground">Sale Completed</p><p className="font-mono text-2xs text-muted">{String(s.invoiceNo)} · {String(data.business.name)}</p></div>
        <div className="space-y-1 p-4 text-sm"><Row k="Items" v={String(N(s.itemCount))} /><Row k="Total" v={fm(N(s.total))} />{pays.map((p, i) => <Row key={i} k={String(p.mode)} v={fm(N(p.amount))} />)}{N(s.changeDue) > 0 && <div className="flex items-center justify-between font-bold text-success"><span>Change</span><span>{fm(N(s.changeDue))}</span></div>}</div>
        <div className="flex items-center gap-2 border-t border-border bg-surface-2 px-4 py-3"><Button variant="outline" size="md" className="flex-1" onClick={print}><Printer className="h-4 w-4" /> Print</Button><Button size="md" className="flex-1" onClick={onNew}><Receipt className="h-4 w-4" /> New Bill</Button></div>
      </div>
    </div>
  );
}
