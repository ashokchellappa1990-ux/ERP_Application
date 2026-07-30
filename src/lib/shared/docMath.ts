/**
 * Shared commercial-document math: line & transaction discounts (% or value),
 * GST (inclusive/exclusive), plus TDS, TCS and other charges.
 * Used by Sales (order/invoice…) and Purchase (PO/PI…) document forms.
 */
export type DiscType = "pct" | "val";
export interface DocLineInput { gross: number; taxPct: number; disc: number; discType: DiscType }
export interface TxnInput { discType: DiscType; disc: number; tds: number; tcs: number; other: number; otherLabel: string }

export const EMPTY_TXN: TxnInput = { discType: "pct", disc: 0, tds: 0, tcs: 0, other: 0, otherLabel: "Other Charges" };

export function lineDiscount(l: DocLineInput): number {
  return l.discType === "pct" ? l.gross * (l.disc || 0) / 100 : Math.min(l.disc || 0, l.gross);
}

export interface TaxRow { rate: number; taxable: number; tax: number; cgst: number; sgst: number; igst: number }

export function computeDoc(lines: DocLineInput[], txn: TxnInput, discLevel: "item" | "transaction", taxMethod: string, interState = false) {
  const byRate = new Map<number, { taxable: number; tax: number }>();
  let taxable = 0, tax = 0, lineDisc = 0;
  for (const l of lines) {
    const d = discLevel === "item" ? lineDiscount(l) : 0;
    lineDisc += d;
    const net = l.gross - d;
    let lTax: number, lTaxable: number;
    if (taxMethod === "inclusive") { lTax = net - net / (1 + l.taxPct / 100); lTaxable = net - lTax; }
    else { lTaxable = net; lTax = net * l.taxPct / 100; }
    taxable += lTaxable; tax += lTax;
    const cur = byRate.get(l.taxPct) ?? { taxable: 0, tax: 0 };
    cur.taxable += lTaxable; cur.tax += lTax;
    byRate.set(l.taxPct, cur);
  }
  let txnDisc = 0, ratio = 1;
  if (discLevel === "transaction" && taxable > 0) {
    txnDisc = txn.discType === "pct" ? taxable * (txn.disc || 0) / 100 : Math.min(txn.disc || 0, taxable);
    ratio = (taxable - txnDisc) / taxable;
    tax = tax * ratio;
    taxable = taxable - txnDisc;
  }
  // GST split by rate — intra-state CGST+SGST (each half), inter-state IGST (full)
  const taxBreakup: TaxRow[] = [];
  let cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
  for (const [rate, v] of Array.from(byRate.entries())) {
    if (rate <= 0) continue;
    const rTax = v.tax * ratio;
    const cgst = interState ? 0 : rTax / 2;
    const sgst = interState ? 0 : rTax / 2;
    const igst = interState ? rTax : 0;
    cgstTotal += cgst; sgstTotal += sgst; igstTotal += igst;
    taxBreakup.push({ rate, taxable: v.taxable * ratio, tax: rTax, cgst, sgst, igst });
  }
  taxBreakup.sort((a, b) => a.rate - b.rate);

  const tds = taxable * (Number(txn.tds) || 0) / 100;            // deducted
  const tcs = (taxable + tax) * (Number(txn.tcs) || 0) / 100;    // collected / added
  const other = Number(txn.other) || 0;                          // added
  const before = taxable + tax + tcs + other - tds;
  const total = Math.round(before);
  return { taxable, tax, lineDisc, txnDisc, tds, tcs, other, roundoff: total - before, total, taxBreakup, cgstTotal, sgstTotal, igstTotal, interState };
}

export const PAYMENT_TERMS = ["Advance", "On Delivery", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"];
export const DELIVERY_METHODS = ["Counter Pickup", "Home Delivery", "Courier", "Transport / LR", "Ex-Works", "FOB"];
