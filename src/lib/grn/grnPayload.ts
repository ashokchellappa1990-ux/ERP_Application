import { Prisma } from "@prisma/client";

interface GrnLineInput {
  productId?: number; productName?: string; sku?: string; uom?: string; category?: string;
  qty?: string | number; freeQty?: string | number; rate?: string | number; sellingPrice?: string | number;
  discPct?: string | number; taxPct?: string | number; mrp?: string | number;
  batchNo?: string; mfgDate?: string; expiryDate?: string; remarks?: string; qrMode?: string;
  serials?: string[]; // manufacturer serials (serial-managed products)
}

const s = (v: unknown) => { const t = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim(); return t ? t : null; };
const dec = (v: unknown) => { const t = typeof v === "string" ? v.trim() : v; if (t === "" || t == null) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
const n0 = (v: unknown) => dec(v) ?? 0;
const r2 = (n: number) => +n.toFixed(2);
function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface GrnHeader {
  grnDate: string;
  supplier: string | null; supplierGstin: string | null; supplierContact: string | null;
  supplierInvoiceNo: string | null; supplierInvoiceDate: string | null; poNo: string | null;
  warehouse: string | null; notes: string | null; status: string;
  gstMode: string; gstPct: number | null;
  subtotal: number; taxTotal: number; freightAmount: number; otherCharges: number; roundOff: number; totalInvoiceValue: number;
  paymentStatus: string; amountPaid: number; paymentMode: string | null; paymentRef: string | null; paymentDate: string | null;
  paymentTerms: string | null; creditDays: number | null; dueDate: string | null;
  transporterName: string | null; transportMode: string | null; vehicleNo: string | null;
  lrNo: string | null; ewayBillNo: string | null; freightPaidBy: string | null;
  numPackages: number | null; transportRemarks: string | null;
  totalQty: number; totalValue: number; lineCount: number;
}

export type BuiltGrn = {
  header: GrnHeader;
  lines: Prisma.GoodsReceiptLineCreateWithoutGrnInput[];
  lineSerials: string[][]; // serials per line, aligned to `lines` order
  post: boolean;
  productIds: number[];
  grandTotal: number;
  amountPaid: number;
};

/** Validate + normalise the GRN editor payload into header + line create data,
 * applying GST per-line or whole-invoice and computing totals + payment. */
export function buildGrnPayload(body: unknown): BuiltGrn | { error: string } {
  const b = (body ?? {}) as Record<string, unknown> & { lines?: GrnLineInput[] };
  const status = b.status === "Posted" ? "Posted" : "Draft";
  const post = status === "Posted";

  const grnDate = s(b.grnDate);
  if (!grnDate) return { error: "GRN date is required." };
  if (post && !s(b.supplier)) return { error: "Supplier is required to post a GRN." };

  const gstMode = b.gstMode === "invoice" ? "invoice" : "line";
  const gstPct = gstMode === "invoice" ? n0(b.gstPct) : null;

  const raw = (b.lines ?? []).filter((l) => Number(l.productId) > 0 && Number(l.qty) > 0);
  if (!raw.length) return { error: "Add at least one product line with a quantity." };

  let subtotal = 0;
  let lineTaxTotal = 0;
  let totalQty = 0;
  const productIds = new Set<number>();
  const lines: Prisma.GoodsReceiptLineCreateWithoutGrnInput[] = raw.map((l) => {
    const qty = Number(l.qty) || 0;
    const rate = dec(l.rate);
    const discPct = dec(l.discPct);
    const taxPct = gstMode === "line" ? dec(l.taxPct) : null;
    const gross = rate != null ? qty * rate : 0;
    const net = discPct != null ? gross * (1 - discPct / 100) : gross;
    const taxAmount = taxPct != null ? r2(net * (taxPct / 100)) : null;
    const value = r2(net + (taxAmount ?? 0));
    subtotal += net;
    lineTaxTotal += taxAmount ?? 0;
    totalQty += qty;
    productIds.add(Number(l.productId));
    return {
      product: { connect: { id: Number(l.productId) } },
      productName: s(l.productName) ?? "", sku: s(l.sku), uom: s(l.uom), category: s(l.category),
      qty, freeQty: dec(l.freeQty), rate, sellingPrice: dec(l.sellingPrice), discPct, taxPct, taxAmount, value, mrp: dec(l.mrp),
      batchNo: s(l.batchNo), mfgDate: s(l.mfgDate), expiryDate: s(l.expiryDate), remarks: s(l.remarks),
      qrMode: l.qrMode === "unique" ? "unique" : "shared",
    };
  });
  const lineSerials = raw.map((l) => (Array.isArray(l.serials) ? l.serials.map((x) => String(x).trim()).filter(Boolean) : []));

  subtotal = r2(subtotal);
  const taxTotal = gstMode === "invoice" ? r2(subtotal * (gstPct ?? 0) / 100) : r2(lineTaxTotal);
  const freightAmount = r2(n0(b.freightAmount));
  const otherCharges = r2(n0(b.otherCharges));
  const roundOff = r2(n0(b.roundOff));
  const grandTotal = r2(subtotal + taxTotal + freightAmount + otherCharges + roundOff);
  const totalInvoiceValue = dec(b.totalInvoiceValue) ?? grandTotal;

  // Payment
  const paymentStatus = ["Paid", "Partial", "Unpaid"].includes(String(b.paymentStatus)) ? String(b.paymentStatus) : "Unpaid";
  const amountPaid = paymentStatus === "Paid" ? grandTotal : paymentStatus === "Partial" ? Math.min(grandTotal, r2(n0(b.amountPaid))) : 0;
  const creditDays = b.creditDays != null && b.creditDays !== "" ? Math.max(0, Math.round(Number(b.creditDays))) : null;
  const dueDate = s(b.dueDate) ?? (creditDays ? addDays(grnDate, creditDays) || null : null);

  const header = {
    grnDate,
    supplier: s(b.supplier), supplierGstin: s(b.supplierGstin), supplierContact: s(b.supplierContact),
    supplierInvoiceNo: s(b.supplierInvoiceNo), supplierInvoiceDate: s(b.supplierInvoiceDate), poNo: s(b.poNo),
    warehouse: s(b.warehouse), notes: s(b.notes), status,
    gstMode, gstPct,
    subtotal, taxTotal, freightAmount, otherCharges, roundOff, totalInvoiceValue,
    paymentStatus, amountPaid, paymentMode: s(b.paymentMode), paymentRef: s(b.paymentRef), paymentDate: s(b.paymentDate),
    paymentTerms: s(b.paymentTerms), creditDays, dueDate,
    transporterName: s(b.transporterName), transportMode: s(b.transportMode), vehicleNo: s(b.vehicleNo),
    lrNo: s(b.lrNo), ewayBillNo: s(b.ewayBillNo), freightPaidBy: s(b.freightPaidBy),
    numPackages: b.numPackages != null && b.numPackages !== "" ? Math.max(0, Math.round(Number(b.numPackages))) : null,
    transportRemarks: s(b.transportRemarks),
    totalQty: r2(totalQty), totalValue: grandTotal, lineCount: lines.length,
  };

  return { header, lines, lineSerials, post, productIds: Array.from(productIds), grandTotal, amountPaid };
}

/** Per-product tracking flags from the Product master. */
export interface TrackFlags { invBatch: boolean; invMfg: boolean; invExpiry: boolean; invSerial?: boolean }

/**
 * Enforce serial capture on receipt lines for serial-managed products: each must
 * carry exactly `qty` non-empty serials with no duplicates within the document.
 * Returns the first violation message, or null when valid.
 */
export function validateSerialTracking(
  lines: Prisma.GoodsReceiptLineCreateWithoutGrnInput[],
  lineSerials: string[][],
  flags: Map<number, TrackFlags>,
): string | null {
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const pid = (l.product as { connect?: { id?: number } } | undefined)?.connect?.id;
    if (!pid || !flags.get(pid)?.invSerial) continue;
    const name = l.productName || `Product #${pid}`;
    const qty = Math.round(Number(l.qty) || 0);
    const serials = (lineSerials[i] ?? []).map((x) => x.trim()).filter(Boolean);
    if (serials.length !== qty) return `Enter ${qty} serial number(s) for "${name}" — it is serial-managed (entered ${serials.length}).`;
    for (const sn of serials) {
      const key = sn.toLowerCase();
      if (seen.has(key)) return `Duplicate serial number "${sn}" in this document.`;
      seen.add(key);
    }
  }
  return null;
}

/** Minimal shape shared by GRN & opening-stock create lines for batch validation. */
export interface BatchTrackableLine {
  productName?: string | null;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  product?: unknown;
}

/**
 * Enforce batch / mfg / expiry capture on receipt lines (GRN or opening stock) for
 * products whose master has the matching tracking flag ON. Returns the first
 * violation message, or null when every tracked line carries the required details.
 */
export function validateBatchTracking(
  lines: BatchTrackableLine[],
  flags: Map<number, TrackFlags>,
): string | null {
  for (const l of lines) {
    const pid = (l.product as { connect?: { id?: number } } | undefined)?.connect?.id;
    if (!pid) continue;
    const f = flags.get(pid);
    if (!f) continue;
    const name = l.productName || `Product #${pid}`;
    if (f.invBatch && !l.batchNo) return `Batch number is required for "${name}" — it is batch-tracked.`;
    if (f.invMfg && !l.mfgDate) return `Manufacturing date is required for "${name}" — it is mfg-date tracked.`;
    if (f.invExpiry && !l.expiryDate) return `Expiry date is required for "${name}" — it is expiry-date tracked.`;
  }
  return null;
}
