import type { SalesDocCreateInput } from "@/lib/contracts/salesDoc";

const n = (v: unknown) => Number(v) || 0;
const r2 = (x: number) => +(Number(x) || 0).toFixed(2);

export interface BuiltSalesDocLine {
  productId: number | null;
  productName: string;
  sku: string | null;
  hsn: string | null;
  uom: string | null;
  qty: number;
  mrp: number | null;
  rate: number;
  discPct: number | null;
  discAmount: number;
  taxPct: number | null;
  taxableValue: number;
  taxAmount: number;
  lineValue: number;
  expectedDate: string | null;
  remarks: string | null;
}

export interface BuiltSalesDoc {
  header: {
    gstMode: string;
    subtotal: number;
    itemDiscount: number;
    additionalDiscount: number;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    gstAmount: number;
    freight: number;
    loading: number;
    packing: number;
    insurance: number;
    otherCharges: number;
    roundOff: number;
    totalValue: number;
    netAmount: number;
    itemCount: number;
  };
  lines: BuiltSalesDocLine[];
}

/**
 * Pure calculation for a Sales Quotation / Order (mirrors the Purchase Order build
 * + the B2B invoice per-line tax math). GST inclusive vs exclusive per `gstMode`;
 * inter-state → IGST, intra-state → CGST + SGST. NO posting / stock.
 */
export function buildSalesDoc(input: SalesDocCreateInput): BuiltSalesDoc {
  const incl = (input.gstMode ?? "exclusive") === "inclusive";
  const gstApplicable = input.gstApplicable !== false;
  const interState = !!input.interState;

  let subtotal = 0, itemDiscount = 0, taxableAmount = 0, gstAmount = 0, itemCount = 0;
  const lines: BuiltSalesDocLine[] = (input.lines ?? []).map((l) => {
    const qty = n(l.qty);
    const rate = n(l.rate);
    const gross = qty * rate;
    const discPct = l.discPct != null && l.discPct !== "" ? n(l.discPct) : null;
    const discAmount = discPct ? r2(gross * (discPct / 100)) : 0;
    const net = r2(gross - discAmount);
    const pct = gstApplicable && l.taxPct != null && l.taxPct !== "" ? n(l.taxPct) : 0;
    const taxable = pct > 0 && incl ? r2(net / (1 + pct / 100)) : net;
    const tax = pct > 0 ? (incl ? r2(net - taxable) : r2(taxable * (pct / 100))) : 0;
    const lineValue = incl ? net : r2(net + tax);
    subtotal = r2(subtotal + gross);
    itemDiscount = r2(itemDiscount + discAmount);
    taxableAmount = r2(taxableAmount + taxable);
    gstAmount = r2(gstAmount + tax);
    itemCount += qty;
    return {
      productId: l.productId ?? null, productName: String(l.description).trim(), sku: l.sku || null, hsn: l.hsn || null, uom: l.uom || null,
      qty, mrp: l.mrp != null && l.mrp !== "" ? n(l.mrp) : null, rate, discPct, discAmount, taxPct: pct || null,
      taxableValue: taxable, taxAmount: tax, lineValue, expectedDate: l.expectedDate || null, remarks: l.remarks || null,
    };
  });

  const additionalDiscount = r2(n(input.additionalDiscount));
  const freight = r2(n(input.freight)), loading = r2(n(input.loading)), packing = r2(n(input.packing));
  const insurance = r2(n(input.insurance)), otherCharges = r2(n(input.otherCharges)), roundOff = r2(n(input.roundOff));
  const charges = r2(freight + loading + packing + insurance + otherCharges);
  const goods = r2(taxableAmount + gstAmount);
  const totalValue = r2(goods + charges - additionalDiscount + roundOff);
  const cgst = interState ? 0 : r2(gstAmount / 2);
  const sgst = interState ? 0 : r2(gstAmount - cgst);
  const igst = interState ? r2(gstAmount) : 0;

  return {
    header: {
      gstMode: incl ? "inclusive" : "exclusive",
      subtotal: r2(subtotal), itemDiscount: r2(itemDiscount), additionalDiscount, taxableAmount: r2(taxableAmount),
      cgst, sgst, igst, gstAmount: r2(gstAmount), freight, loading, packing, insurance, otherCharges, roundOff,
      totalValue, netAmount: totalValue, itemCount: Math.round(itemCount),
    },
    lines,
  };
}
