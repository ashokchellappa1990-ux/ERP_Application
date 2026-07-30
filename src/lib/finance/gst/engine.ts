import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { bizWhere, txnWhere, monthRange, num, r2, isValidGstin, recentPeriods, periodLabel } from "./core";

/**
 * GST read-side engine — every figure is derived from the live transaction
 * tables (sales / purchase invoices / returns / cancellations). Nothing here
 * writes; persistence of returns/ITC/validation lives in store.ts.
 */

const ymOf = (d: string | null | undefined, fallback?: Date) =>
  (d && d.length >= 7 ? d.slice(0, 7) : fallback ? fallback.toISOString().slice(0, 7) : "");

// ----------------------------------------------------------------- raw fetches

async function fetchSales(scope: ActiveScope, from: string, to: string) {
  return prisma.sale.findMany({
    where: { ...txnWhere(scope), status: "Completed", saleDate: { gte: from, lte: to } },
    select: {
      id: true, invoiceNo: true, saleDate: true, channel: true, customerName: true, customerGstin: true,
      taxableValue: true, cgst: true, sgst: true, igst: true, taxTotal: true, total: true,
      customer: { select: { state: true, stateCode: true, gstin: true } },
    },
  });
}

async function fetchCreditNotes(scope: ActiveScope, from: string, to: string) {
  return prisma.salesReturn.findMany({
    where: { ...txnWhere(scope), status: { in: ["Approved", "Completed"] }, returnDate: { gte: from, lte: to } },
    select: {
      id: true, returnNo: true, returnDate: true, invoiceNo: true, customerName: true,
      grossAmount: true, discountAdj: true, taxAdj: true, refundAmount: true,
      sale: { select: { igst: true, customerGstin: true, customer: { select: { state: true } } } },
    },
  });
}

/** Posted purchase invoices for the business, filtered to a period by bill date. */
async function fetchPurchases(scope: ActiveScope, period: string) {
  const rows = await prisma.purchaseInvoice.findMany({
    where: { ...txnWhere(scope), status: "Posted" },
    select: {
      id: true, invoiceNo: true, supplier: true, supplierGstin: true, supplierInvoiceNo: true,
      supplierInvoiceDate: true, createdAt: true, purchaseType: true, gstApplicable: true, reverseCharge: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, cess: true, gstAmount: true, totalInvoiceAmount: true, netPayable: true,
    },
  });
  return rows.filter((r) => ymOf(r.supplierInvoiceDate, r.createdAt) === period);
}

async function fetchPurchaseReturns(scope: ActiveScope, from: string, to: string) {
  return prisma.purchaseReturn.findMany({
    where: { ...txnWhere(scope), status: "Approved", returnDate: { gte: from, lte: to } },
    select: { id: true, returnNo: true, returnDate: true, supplier: true, supplierGstin: true, invoiceNo: true, purchaseType: true, taxableAmount: true, taxAmount: true, returnAmount: true },
  });
}

// ----------------------------------------------------------- period aggregation

export interface GstFigures {
  salesCount: number; salesTaxable: number; outCgst: number; outSgst: number; outIgst: number; salesTotal: number;
  b2bCount: number; b2bTaxable: number; b2cCount: number; b2cTaxable: number;
  cnTaxable: number; cnCgst: number; cnSgst: number; cnIgst: number;
  purchaseCount: number; purTaxable: number; inCgst: number; inSgst: number; inIgst: number; inCess: number; purGst: number;
  eligibleItc: number; blockedItc: number; rcmGst: number;
  prTaxable: number; prGst: number;
  outputTax: number; itcNet: number; netLiability: number; gstPayable: number; gstReceivable: number;
}

const ZERO: GstFigures = {
  salesCount: 0, salesTaxable: 0, outCgst: 0, outSgst: 0, outIgst: 0, salesTotal: 0,
  b2bCount: 0, b2bTaxable: 0, b2cCount: 0, b2cTaxable: 0,
  cnTaxable: 0, cnCgst: 0, cnSgst: 0, cnIgst: 0,
  purchaseCount: 0, purTaxable: 0, inCgst: 0, inSgst: 0, inIgst: 0, inCess: 0, purGst: 0,
  eligibleItc: 0, blockedItc: 0, rcmGst: 0, prTaxable: 0, prGst: 0,
  outputTax: 0, itcNet: 0, netLiability: 0, gstPayable: 0, gstReceivable: 0,
};

/** GST-taxed receipt lines (Receipt Transaction module) posted in the period — these
 *  are additional OUTWARD supplies (e.g. rental income + GST) for GST compliance. */
async function fetchReceiptGst(scope: ActiveScope, from: string, to: string) {
  return prisma.receiptTransactionDetail.findMany({
    where: { taxType: "GST", receipt: { ...bizWhere(scope), status: "Posted", voucherDate: { gte: from, lte: to } } },
    select: { taxable: true, cgst: true, sgst: true, receipt: { select: { partyGstin: true } } },
  });
}

export async function periodFigures(scope: ActiveScope, period: string): Promise<GstFigures> {
  const { from, to } = monthRange(period);
  const [sales, cns, purchases, prs, receipts] = await Promise.all([
    fetchSales(scope, from, to),
    fetchCreditNotes(scope, from, to),
    fetchPurchases(scope, period),
    fetchPurchaseReturns(scope, from, to),
    fetchReceiptGst(scope, from, to),
  ]);
  const f: GstFigures = { ...ZERO };

  for (const s of sales) {
    f.salesCount++;
    f.salesTaxable += num(s.taxableValue);
    f.outCgst += num(s.cgst); f.outSgst += num(s.sgst); f.outIgst += num(s.igst);
    f.salesTotal += num(s.total);
    const isB2b = !!(s.customerGstin && s.customerGstin.trim());
    if (isB2b) { f.b2bCount++; f.b2bTaxable += num(s.taxableValue); }
    else { f.b2cCount++; f.b2cTaxable += num(s.taxableValue); }
  }
  for (const c of cns) {
    const taxable = num(c.grossAmount) - num(c.discountAdj);
    const tax = num(c.taxAdj);
    f.cnTaxable += taxable;
    if (num(c.sale?.igst) > 0) f.cnIgst += tax;
    else { f.cnCgst += tax / 2; f.cnSgst += tax / 2; }
  }
  for (const p of purchases) {
    if (!p.gstApplicable) continue;
    f.purchaseCount++;
    f.purTaxable += num(p.taxableAmount);
    f.inCgst += num(p.cgst); f.inSgst += num(p.sgst); f.inIgst += num(p.igst); f.inCess += num(p.cess);
    f.purGst += num(p.gstAmount);
    f.eligibleItc += num(p.gstAmount);
    if (p.reverseCharge) f.rcmGst += num(p.gstAmount);
  }
  for (const r of prs) { f.prTaxable += num(r.taxableAmount); f.prGst += num(r.taxAmount); }
  // Receipt-module GST supplies (rental/commission/etc. with GST) count as output.
  for (const d of receipts) {
    const taxable = num(d.taxable);
    f.salesTaxable += taxable; f.salesTotal += r2(taxable + num(d.cgst) + num(d.sgst));
    f.outCgst += num(d.cgst); f.outSgst += num(d.sgst);
    if (d.receipt?.partyGstin && d.receipt.partyGstin.trim()) f.b2bTaxable += taxable; else f.b2cTaxable += taxable;
  }

  f.outputTax = r2(f.outCgst + f.outSgst + f.outIgst - (f.cnCgst + f.cnSgst + f.cnIgst));
  f.itcNet = r2(f.eligibleItc - f.blockedItc - f.prGst);
  f.netLiability = r2(f.outputTax + f.rcmGst - f.itcNet);
  f.gstPayable = r2(Math.max(0, f.netLiability));
  f.gstReceivable = r2(Math.max(0, -f.netLiability));

  // round display sums
  (Object.keys(f) as (keyof GstFigures)[]).forEach((k) => { f[k] = r2(f[k]); });
  return f;
}

// ------------------------------------------------------------------ dashboard

export async function getDashboard(scope: ActiveScope, period: string) {
  const months = recentPeriods(period, 6);
  const figs = await Promise.all(months.map((m) => periodFigures(scope, m)));
  const cur = figs[figs.length - 1];

  const [pendingRecon, mismatches, returnsRow, twoBcount] = await Promise.all([
    prisma.gstReconciliation.count({ where: { ...bizWhere(scope), period, status: { in: ["Pending", "PartiallyMatched", "MissingInErp", "SupplierNotFiled"] } } }),
    prisma.gstReconciliation.count({ where: { ...bizWhere(scope), period, status: "Mismatch" } }),
    prisma.gstReturn.findMany({ where: { ...bizWhere(scope), period }, select: { returnType: true, status: true } }),
    prisma.gstGstr2bImport.count({ where: { ...bizWhere(scope), period } }),
  ]);
  void twoBcount;
  const filed = returnsRow.filter((r) => r.status === "Filed").length;
  const expected = 2; // GSTR-1 + GSTR-3B
  const pending = Math.max(0, expected - filed);
  const filingStatus = filed >= expected ? "Filed" : filed > 0 ? "Partially Filed" : "Pending";

  const kpis = {
    totalSales: cur.salesTotal,
    totalPurchase: r2(cur.purTaxable + cur.purGst),
    taxableSales: cur.salesTaxable,
    taxablePurchase: cur.purTaxable,
    outputCgst: cur.outCgst, outputSgst: cur.outSgst, outputIgst: cur.outIgst,
    inputCgst: cur.inCgst, inputSgst: cur.inSgst, inputIgst: cur.inIgst,
    eligibleItc: cur.eligibleItc, blockedItc: cur.blockedItc,
    gstPayable: cur.gstPayable, gstReceivable: cur.gstReceivable,
    pendingReconciliation: pendingRecon, gstMismatches: mismatches,
    returnsPending: pending, returnsFiled: filed,
    returnDueDate: "", filingStatus,
  };

  const charts = {
    monthlyCollection: months.map((m, i) => ({ name: periodLabel(m).slice(0, 3), value: figs[i].outputTax })),
    monthlyItc: months.map((m, i) => ({ name: periodLabel(m).slice(0, 3), value: figs[i].itcNet })),
    outputVsInput: months.map((m, i) => ({ name: periodLabel(m).slice(0, 3), a: figs[i].outputTax, b: figs[i].itcNet })),
    liabilityTrend: months.map((m, i) => ({ name: periodLabel(m).slice(0, 3), value: figs[i].netLiability })),
    salesVsPurchaseGst: months.map((m, i) => ({ name: periodLabel(m).slice(0, 3), a: r2(figs[i].outCgst + figs[i].outSgst + figs[i].outIgst), b: figs[i].purGst })),
    filingStatus: [
      { name: "Filed", value: filed },
      { name: "Pending", value: pending },
    ],
  };

  const alerts: { type: string; severity: "Error" | "Warning" | "Information"; message: string }[] = [];
  if (pending > 0) alerts.push({ type: "Pending Return", severity: "Warning", message: `${pending} return(s) pending for ${periodLabel(period)}.` });
  if (mismatches > 0) alerts.push({ type: "GSTR-2B Mismatch", severity: "Error", message: `${mismatches} reconciliation mismatch(es) need review.` });
  if (pendingRecon > 0) alerts.push({ type: "Reconciliation", severity: "Warning", message: `${pendingRecon} invoice(s) pending reconciliation.` });
  return { kpis, charts, alerts };
}

// --------------------------------------------------------------- verification

export interface Finding { sourceType: string; sourceId: number; docNo: string; docDate: string; partyName: string; checkCode: string; severity: "Error" | "Warning" | "Information"; message: string }

/** Run all GST checks for a period; returns findings (store.ts persists them). */
export async function computeVerification(scope: ActiveScope, period: string): Promise<Finding[]> {
  const { from, to } = monthRange(period);
  const out: Finding[] = [];

  // Sales (B2C/B2B) with their lines for HSN + tax-math checks.
  const sales = await prisma.sale.findMany({
    where: { ...txnWhere(scope), status: "Completed", saleDate: { gte: from, lte: to } },
    select: {
      id: true, invoiceNo: true, saleDate: true, channel: true, customerName: true, customerGstin: true,
      taxableValue: true, cgst: true, sgst: true, igst: true, taxTotal: true, total: true,
      customer: { select: { state: true, gstin: true } },
      lines: { select: { productName: true, hsn: true, taxPct: true, taxableValue: true, taxAmount: true } },
    },
  });
  const seenInv = new Map<string, number>();
  for (const s of sales) {
    const docNo = s.invoiceNo; const party = s.customerName ?? "Walk-in";
    const add = (checkCode: string, severity: Finding["severity"], message: string) =>
      out.push({ sourceType: "Sale", sourceId: s.id, docNo, docDate: s.saleDate, partyName: party, checkCode, severity, message });

    // duplicate invoice number within the run
    const prev = seenInv.get(s.invoiceNo) ?? 0; seenInv.set(s.invoiceNo, prev + 1);
    if (prev === 1) add("DUPLICATE_INVOICE", "Error", `Duplicate invoice number ${s.invoiceNo}.`);

    if (s.channel === "B2B" || (s.customerGstin && s.customerGstin.trim())) {
      if (!s.customerGstin || !s.customerGstin.trim()) add("MISSING_GSTIN", "Error", "B2B invoice has no customer GSTIN.");
      else if (!isValidGstin(s.customerGstin)) add("INVALID_GSTIN", "Error", `Invalid customer GSTIN ${s.customerGstin}.`);
      if (!s.customer?.state) add("MISSING_POS", "Warning", "Place of supply (customer state) not set.");
    }
    for (const l of s.lines) {
      if (!l.hsn || !l.hsn.trim()) { add("MISSING_HSN", "Warning", `Line "${l.productName}" has no HSN/SAC.`); break; }
    }
    // tax math: cgst+sgst+igst vs taxTotal
    const sumTax = num(s.cgst) + num(s.sgst) + num(s.igst);
    if (Math.abs(sumTax - num(s.taxTotal)) > 1) add("TAX_DIFF", "Warning", `Tax split (${r2(sumTax)}) ≠ tax total (${r2(num(s.taxTotal))}).`);
    // intra vs inter consistency
    if (num(s.igst) > 0 && (num(s.cgst) > 0 || num(s.sgst) > 0)) add("INCORRECT_CGST_SGST", "Warning", "Both IGST and CGST/SGST present on one invoice.");
    // invoice value vs taxable+tax
    const expected = num(s.taxableValue) + sumTax;
    if (num(s.total) > 0 && Math.abs(expected - num(s.total)) > 2) add("INVOICE_VALUE_DIFF", "Information", `Invoice total ${r2(num(s.total))} ≠ taxable+tax ${r2(expected)} (discount/round-off).`);
  }

  // Purchase invoices (ITC source).
  const purchases = await fetchPurchases(scope, period);
  for (const p of purchases) {
    const docNo = p.supplierInvoiceNo || p.invoiceNo; const party = p.supplier ?? "Supplier";
    const add = (checkCode: string, severity: Finding["severity"], message: string) =>
      out.push({ sourceType: "PurchaseInvoice", sourceId: p.id, docNo, docDate: p.supplierInvoiceDate ?? "", partyName: party, checkCode, severity, message });
    if (p.gstApplicable) {
      if (!p.supplierGstin || !p.supplierGstin.trim()) add("MISSING_GSTIN", "Error", "Purchase with GST has no supplier GSTIN — ITC at risk.");
      else if (!isValidGstin(p.supplierGstin)) add("INVALID_GSTIN", "Error", `Invalid supplier GSTIN ${p.supplierGstin}.`);
      const split = num(p.cgst) + num(p.sgst) + num(p.igst);
      if (Math.abs(split - num(p.gstAmount)) > 1) add("TAX_DIFF", "Warning", `GST split (${r2(split)}) ≠ GST amount (${r2(num(p.gstAmount))}).`);
      if (num(p.igst) > 0 && (num(p.cgst) > 0 || num(p.sgst) > 0)) add("INCORRECT_IGST", "Warning", "Both IGST and CGST/SGST present.");
    }
  }
  return out;
}

// -------------------------------------------------------------------- GSTR-1

export interface ReturnSectionRow {
  section: string; refType: string; refId: number; invoiceNo: string; invoiceDate: string;
  partyGstin: string; partyName: string; placeOfSupply: string; hsn: string; description: string;
  uom: string; qty: number; rate: number; taxableValue: number; cgst: number; sgst: number; igst: number; cess: number; total: number;
}

const row = (p: Partial<ReturnSectionRow> & { section: string }): ReturnSectionRow => ({
  section: p.section, refType: p.refType ?? "", refId: p.refId ?? 0, invoiceNo: p.invoiceNo ?? "", invoiceDate: p.invoiceDate ?? "",
  partyGstin: p.partyGstin ?? "", partyName: p.partyName ?? "", placeOfSupply: p.placeOfSupply ?? "", hsn: p.hsn ?? "", description: p.description ?? "",
  uom: p.uom ?? "", qty: r2(p.qty ?? 0), rate: r2(p.rate ?? 0), taxableValue: r2(p.taxableValue ?? 0), cgst: r2(p.cgst ?? 0), sgst: r2(p.sgst ?? 0), igst: r2(p.igst ?? 0), cess: r2(p.cess ?? 0), total: r2(p.total ?? 0),
});

export async function buildGstr1(scope: ActiveScope, period: string): Promise<{ rows: ReturnSectionRow[]; totals: Record<string, number> }> {
  const { from, to } = monthRange(period);
  const sales = await prisma.sale.findMany({
    where: { ...txnWhere(scope), status: "Completed", saleDate: { gte: from, lte: to } },
    select: {
      id: true, invoiceNo: true, saleDate: true, customerName: true, customerGstin: true, total: true,
      taxableValue: true, cgst: true, sgst: true, igst: true,
      customer: { select: { state: true, stateCode: true } },
      lines: { select: { productName: true, hsn: true, uom: true, qty: true, taxPct: true, taxableValue: true, taxAmount: true } },
    },
  });
  const cns = await fetchCreditNotes(scope, from, to);
  const rows: ReturnSectionRow[] = [];
  const hsnMap = new Map<string, ReturnSectionRow>();

  for (const s of sales) {
    const inter = num(s.igst) > 0;
    const pos = s.customer?.state ?? "";
    const b2b = !!(s.customerGstin && s.customerGstin.trim());
    const big = inter && num(s.total) > 250000;
    const section = b2b ? "B2B" : big ? "B2CL" : "B2CS";
    rows.push(row({
      section, refType: "Sale", refId: s.id, invoiceNo: s.invoiceNo, invoiceDate: s.saleDate,
      partyGstin: s.customerGstin ?? "", partyName: s.customerName ?? "Walk-in customer", placeOfSupply: pos,
      rate: 0, taxableValue: num(s.taxableValue), cgst: num(s.cgst), sgst: num(s.sgst), igst: num(s.igst), total: num(s.total),
    }));
    // HSN summary accumulation
    for (const l of s.lines) {
      const key = (l.hsn || "NA") + "|" + (l.taxPct ?? 0);
      const ex = hsnMap.get(key) ?? row({ section: "HSN", hsn: l.hsn || "NA", description: l.productName, uom: l.uom ?? "", rate: num(l.taxPct) });
      ex.qty += num(l.qty);
      ex.taxableValue += num(l.taxableValue);
      const lt = num(l.taxAmount);
      if (inter) ex.igst += lt; else { ex.cgst += lt / 2; ex.sgst += lt / 2; }
      ex.total += num(l.taxableValue) + lt;
      hsnMap.set(key, ex);
    }
  }
  for (const c of cns) {
    const inter = num(c.sale?.igst) > 0;
    const taxable = num(c.grossAmount) - num(c.discountAdj);
    const tax = num(c.taxAdj);
    const b2b = !!(c.sale?.customerGstin && c.sale.customerGstin.trim());
    rows.push(row({
      section: b2b ? "CDNR" : "CDNUR", refType: "SalesReturn", refId: c.id, invoiceNo: c.returnNo, invoiceDate: c.returnDate,
      partyGstin: c.sale?.customerGstin ?? "", partyName: c.customerName ?? "", placeOfSupply: c.sale?.customer?.state ?? "",
      taxableValue: -taxable, cgst: inter ? 0 : -tax / 2, sgst: inter ? 0 : -tax / 2, igst: inter ? -tax : 0, total: -(taxable + tax),
    }));
  }
  // Receipt-module GST supplies → B2B / B2C rows.
  const gstDetails = await prisma.receiptTransactionDetail.findMany({
    where: { taxType: "GST", receipt: { ...bizWhere(scope), status: "Posted", voucherDate: { gte: from, lte: to } } },
    select: { taxable: true, cgst: true, sgst: true, receipt: { select: { id: true, voucherNo: true, voucherDate: true, partyName: true, partyGstin: true } } },
  });
  const recMap = new Map<number, { id: number; voucherNo: string; voucherDate: string; partyName: string; partyGstin: string; taxable: number; cgst: number; sgst: number }>();
  for (const d of gstDetails) {
    const rc = d.receipt; const e = recMap.get(rc.id) ?? { id: rc.id, voucherNo: rc.voucherNo, voucherDate: rc.voucherDate, partyName: rc.partyName ?? "", partyGstin: rc.partyGstin ?? "", taxable: 0, cgst: 0, sgst: 0 };
    e.taxable += num(d.taxable); e.cgst += num(d.cgst); e.sgst += num(d.sgst); recMap.set(rc.id, e);
  }
  let receiptDocs = 0;
  for (const e of recMap.values()) {
    receiptDocs++;
    const b2b = !!e.partyGstin.trim();
    rows.push(row({ section: b2b ? "B2B" : "B2CS", refType: "Receipt", refId: e.id, invoiceNo: e.voucherNo, invoiceDate: e.voucherDate, partyGstin: e.partyGstin, partyName: e.partyName, taxableValue: e.taxable, cgst: e.cgst, sgst: e.sgst, total: r2(e.taxable + e.cgst + e.sgst) }));
  }
  for (const h of hsnMap.values()) rows.push(h);

  const totals: Record<string, number> = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0, b2b: 0, b2c: 0, cdn: 0, docs: sales.length + cns.length + receiptDocs };
  for (const r of rows) {
    if (r.section === "HSN") continue;
    totals.taxableValue += r.taxableValue; totals.cgst += r.cgst; totals.sgst += r.sgst; totals.igst += r.igst; totals.cess += r.cess; totals.total += r.total;
    if (r.section === "B2B") totals.b2b += r.taxableValue;
    else if (r.section.startsWith("B2C")) totals.b2c += r.taxableValue;
    else totals.cdn += r.taxableValue;
  }
  (Object.keys(totals)).forEach((k) => (totals[k] = r2(totals[k])));
  return { rows: rows.map((r) => ({ ...r, qty: r2(r.qty), taxableValue: r2(r.taxableValue), cgst: r2(r.cgst), sgst: r2(r.sgst), igst: r2(r.igst), total: r2(r.total) })), totals };
}

// -------------------------------------------------------------------- GSTR-3B

export async function buildGstr3b(scope: ActiveScope, period: string): Promise<{ rows: ReturnSectionRow[]; totals: Record<string, number> }> {
  const f = await periodFigures(scope, period);
  const rows: ReturnSectionRow[] = [
    row({ section: "OUTWARD", description: "3.1(a) Outward taxable supplies", taxableValue: f.salesTaxable - f.cnTaxable, cgst: f.outCgst - f.cnCgst, sgst: f.outSgst - f.cnSgst, igst: f.outIgst - f.cnIgst, total: f.outputTax }),
    row({ section: "RCM", description: "3.1(d) Inward supplies (reverse charge)", igst: f.rcmGst, total: f.rcmGst }),
    row({ section: "ITC", description: "4(A) ITC available", cgst: f.inCgst, sgst: f.inSgst, igst: f.inIgst, cess: f.inCess, total: f.eligibleItc }),
    row({ section: "ITC_REV", description: "4(B) ITC reversed (purchase returns)", total: f.prGst }),
    row({ section: "NET", description: "Net tax payable", total: f.netLiability }),
  ];
  const totals: Record<string, number> = {
    outwardTaxable: r2(f.salesTaxable - f.cnTaxable), outputCgst: r2(f.outCgst - f.cnCgst), outputSgst: r2(f.outSgst - f.cnSgst), outputIgst: r2(f.outIgst - f.cnIgst),
    outputTax: f.outputTax, rcm: f.rcmGst, itc: f.itcNet, netLiability: f.netLiability, gstPayable: f.gstPayable, gstReceivable: f.gstReceivable,
    taxableValue: r2(f.salesTaxable - f.cnTaxable), cgst: r2(f.outCgst - f.cnCgst), sgst: r2(f.outSgst - f.cnSgst), igst: r2(f.outIgst - f.cnIgst), cess: 0, total: f.outputTax,
  };
  return { rows, totals };
}

// ---------------------------------------------------------------------- ITC

export async function buildItc(scope: ActiveScope, period: string) {
  const purchases = await fetchPurchases(scope, period);
  const rows = purchases.filter((p) => p.gstApplicable).map((p) => {
    const gst = num(p.gstAmount);
    const blocked = 0; const ineligible = 0;
    const eligible = r2(gst - blocked - ineligible);
    return {
      id: p.id, supplierName: p.supplier ?? "", supplierGstin: p.supplierGstin ?? "",
      invoiceNo: p.supplierInvoiceNo || p.invoiceNo, invoiceDate: p.supplierInvoiceDate ?? "", purchaseType: p.purchaseType,
      gstAmount: gst, eligibleAmount: eligible, ineligibleAmount: ineligible, blockedAmount: blocked,
      claimedAmount: 0, pendingAmount: eligible, reverseCharge: p.reverseCharge,
      itcStatus: p.reverseCharge ? "ReverseCharge" : "Eligible",
    };
  });
  const summary = {
    eligible: r2(rows.reduce((s, r) => s + r.eligibleAmount, 0)),
    ineligible: 0, blocked: 0,
    pending: r2(rows.reduce((s, r) => s + r.pendingAmount, 0)),
    reverseCharge: r2(rows.filter((r) => r.reverseCharge).reduce((s, r) => s + r.gstAmount, 0)),
    totalGst: r2(rows.reduce((s, r) => s + r.gstAmount, 0)),
  };
  return { summary, rows };
}
