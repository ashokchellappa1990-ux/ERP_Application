import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { ACC } from "@/lib/accounting/accounts";
import { periodFigures } from "@/lib/finance/gst/engine";
import { statutoryDef, periodWindow } from "./types";

/**
 * Statutory liability engine — derives the OUTSTANDING liability for a statutory head
 * and period straight from the General Ledger (and the source sub-ledgers for the
 * per-section / per-vendor / per-customer break-up). Nothing here is persisted: the
 * liability is always recomputed from live postings, exactly like the GST module.
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface LiabilityBreakupRow { key: string; label: string; amount: number }
export interface StatutoryLiability {
  type: string;
  period: string;
  liability: number;      // accrued liability for the period (>= 0)
  alreadyPaid: number;    // sum of Paid government payments for this head+period
  balance: number;        // liability - alreadyPaid (>= 0)
  receivable: number;     // GST only — net ITC/credit carried when input > output
  breakup: LiabilityBreakupRow[];
  gst?: { cgst: number; sgst: number; igst: number; cess: number; outputTax: number; itc: number };
}

/** CREDIT-minus-DEBIT balance of a GL account for a period, excluding the statutory
 *  payment vouchers themselves (so paying a prior period doesn't wipe this accrual). */
async function creditBalance(scope: ActiveScope, code: string, from: string, to: string): Promise<number> {
  const acct = await prisma.ledgerAccount.findFirst({ where: { tenantId: scope.tenantId, code }, select: { id: true } });
  if (!acct) return 0;
  const agg = await prisma.journalLine.aggregate({
    where: {
      tenantId: scope.tenantId, accountId: acct.id,
      ...(scope.businessId != null ? { businessId: scope.businessId } : {}),
      journal: { status: "Posted", date: { gte: from, lte: to }, sourceType: { not: "STATUTORY_PAYMENT" } },
    },
    _sum: { debit: true, credit: true },
  });
  return r2(num(agg._sum.credit) - num(agg._sum.debit));
}

async function alreadyPaidFor(scope: ActiveScope, type: string, period: string): Promise<number> {
  const agg = await prisma.statutoryPayment.aggregate({
    where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), statutoryType: type, taxPeriod: period, status: "Paid" },
    _sum: { paidAmount: true },
  });
  return r2(num(agg._sum.paidAmount));
}

/** TDS break-up — by section and by vendor — read from expense vouchers in the period. */
async function tdsBreakup(scope: ActiveScope, from: string, to: string): Promise<{ section: LiabilityBreakupRow[]; vendor: LiabilityBreakupRow[] }> {
  const rows = await prisma.pettyCashVoucher.findMany({
    where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), status: { not: "Cancelled" }, tdsAmount: { gt: 0 }, voucherDate: { gte: from, lte: to } },
    select: { tdsAmount: true, tdsSection: true, payeeName: true },
  });
  const bySection = new Map<string, number>();
  const byVendor = new Map<string, number>();
  for (const r of rows) {
    const sec = (r.tdsSection || "Unspecified").trim();
    const ven = (r.payeeName || "Unknown").trim();
    bySection.set(sec, r2((bySection.get(sec) ?? 0) + num(r.tdsAmount)));
    byVendor.set(ven, r2((byVendor.get(ven) ?? 0) + num(r.tdsAmount)));
  }
  const toRows = (m: Map<string, number>): LiabilityBreakupRow[] => [...m.entries()].map(([k, v]) => ({ key: k, label: k, amount: v })).sort((a, b) => b.amount - a.amount);
  return { section: toRows(bySection), vendor: toRows(byVendor) };
}

/** TCS break-up — by customer — read from sales that collected TCS in the period. */
async function tcsByCustomer(scope: ActiveScope, from: string, to: string): Promise<LiabilityBreakupRow[]> {
  const rows = await prisma.sale.findMany({
    where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), status: { not: "Cancelled" }, tcsAmount: { gt: 0 }, saleDate: { gte: from, lte: to } },
    select: { tcsAmount: true, customerName: true },
  });
  const m = new Map<string, number>();
  for (const r of rows) {
    const c = (r.customerName || "Walk-in / Cash").trim();
    m.set(c, r2((m.get(c) ?? 0) + num(r.tcsAmount)));
  }
  return [...m.entries()].map(([k, v]) => ({ key: k, label: k, amount: v })).sort((a, b) => b.amount - a.amount);
}

/** The outstanding statutory liability for one head & period, with break-up. */
export async function computeLiability(scope: ActiveScope, type: string, period: string): Promise<StatutoryLiability> {
  const def = statutoryDef(type);
  const { from, to } = periodWindow(period);
  const alreadyPaid = await alreadyPaidFor(scope, type, period);

  if (type === "GST") {
    const f = await periodFigures(scope, period);
    const liability = r2(Math.max(0, f.netLiability));
    return {
      type, period, liability, alreadyPaid, balance: r2(Math.max(0, liability - alreadyPaid)), receivable: f.gstReceivable,
      gst: { cgst: f.outCgst, sgst: f.outSgst, igst: f.outIgst, cess: 0, outputTax: f.outputTax, itc: f.itcNet },
      breakup: [
        { key: "CGST", label: "CGST", amount: f.outCgst },
        { key: "SGST", label: "SGST", amount: f.outSgst },
        { key: "IGST", label: "IGST", amount: f.outIgst },
        { key: "ITC", label: "Less: Input Tax Credit", amount: -f.itcNet },
      ],
    };
  }

  if (type === "TDS") {
    const liability = await creditBalance(scope, ACC.TDS_PAYABLE, from, to);
    const { section } = await tdsBreakup(scope, from, to);
    return { type, period, liability, alreadyPaid, balance: r2(Math.max(0, liability - alreadyPaid)), receivable: 0, breakup: section };
  }

  if (type === "TCS") {
    const liability = await creditBalance(scope, ACC.TCS_PAYABLE, from, to);
    const breakup = await tcsByCustomer(scope, from, to);
    return { type, period, liability, alreadyPaid, balance: r2(Math.max(0, liability - alreadyPaid)), receivable: 0, breakup };
  }

  // Future heads — liability straight from the configured GL account, no break-up yet.
  const liability = def ? await creditBalance(scope, def.liabilityAccount, from, to) : 0;
  return { type, period, liability, alreadyPaid, balance: r2(Math.max(0, liability - alreadyPaid)), receivable: 0, breakup: [] };
}

/* ------------------------------------------------------------------ drill-down
 * Document-level detail behind a consolidated liability figure — every source
 * voucher / invoice / receipt that makes up the number, so it can be cross-verified.
 */
export interface StatDetailRow { docType: string; docNo: string; date: string; party: string; taxable: number; rate: number | null; section: string | null; tax: number }
export interface StatDetailGroup { key: string; label: string; note: string; sign: 1 | -1; count: number; taxable: number; tax: number; rows: StatDetailRow[] }
export interface StatLiabilityDetail { type: string; period: string; groups: StatDetailGroup[]; net: number }

const ymOf = (d: string | null | undefined, fallback?: Date) => (d && d.length >= 7 ? d.slice(0, 7) : fallback ? fallback.toISOString().slice(0, 7) : "");
function scoped(scope: ActiveScope) { return { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) }; }
function group(key: string, label: string, note: string, sign: 1 | -1, rows: StatDetailRow[]): StatDetailGroup {
  return { key, label, note, sign, count: rows.length, taxable: r2(rows.reduce((s, r) => s + r.taxable, 0)), tax: r2(rows.reduce((s, r) => s + r.tax, 0)), rows };
}

export async function liabilityDetail(scope: ActiveScope, type: string, period: string, q?: string): Promise<StatLiabilityDetail> {
  const { from, to } = periodWindow(period);
  const where = scoped(scope);
  const groups: StatDetailGroup[] = [];

  if (type === "GST") {
    const [sales, receipts, creditNotes, purchases, purchaseReturns] = await Promise.all([
      prisma.sale.findMany({ where: { ...where, status: "Completed", saleDate: { gte: from, lte: to } }, select: { invoiceNo: true, saleDate: true, customerName: true, taxableValue: true, cgst: true, sgst: true, igst: true } }),
      prisma.receiptTransactionDetail.findMany({ where: { taxType: "GST", receipt: { ...where, status: "Posted", voucherDate: { gte: from, lte: to } } }, select: { taxable: true, cgst: true, sgst: true, gstAmount: true, receipt: { select: { voucherNo: true, voucherDate: true, partyName: true } } } }),
      prisma.salesReturn.findMany({ where: { ...where, status: { in: ["Approved", "Completed"] }, returnDate: { gte: from, lte: to } }, select: { returnNo: true, returnDate: true, invoiceNo: true, customerName: true, grossAmount: true, discountAdj: true, taxAdj: true } }),
      prisma.purchaseInvoice.findMany({ where: { ...where, status: "Posted", gstApplicable: true }, select: { invoiceNo: true, supplierInvoiceNo: true, supplierInvoiceDate: true, createdAt: true, supplier: true, taxableAmount: true, gstAmount: true } }),
      prisma.purchaseReturn.findMany({ where: { ...where, status: "Approved", returnDate: { gte: from, lte: to } }, select: { returnNo: true, returnDate: true, supplier: true, invoiceNo: true, taxableAmount: true, taxAmount: true } }),
    ]);
    groups.push(group("sales", "Output Tax — Sales Invoices", "GST charged on outward supplies", 1,
      sales.map((s) => ({ docType: "Sales Invoice", docNo: s.invoiceNo, date: s.saleDate, party: s.customerName || "Walk-in / Cash", taxable: num(s.taxableValue), rate: null, section: null, tax: r2(num(s.cgst) + num(s.sgst) + num(s.igst)) }))));
    if (receipts.length) groups.push(group("receipts", "Output Tax — GST Receipts", "GST on rental / commission / other receipts", 1,
      receipts.map((d) => ({ docType: "Receipt", docNo: d.receipt?.voucherNo ?? "—", date: d.receipt?.voucherDate ?? "", party: d.receipt?.partyName || "—", taxable: num(d.taxable), rate: null, section: null, tax: r2(num(d.gstAmount) || num(d.cgst) + num(d.sgst)) }))));
    groups.push(group("creditNotes", "Less: Output Tax — Credit Notes", "GST reversed on sales returns", -1,
      creditNotes.map((c) => ({ docType: "Credit Note", docNo: c.returnNo, date: c.returnDate, party: c.customerName || "—", taxable: r2(num(c.grossAmount) - num(c.discountAdj)), rate: null, section: null, tax: num(c.taxAdj) }))));
    groups.push(group("purchases", "Less: Input Tax Credit — Purchases", "ITC eligible on inward supplies", -1,
      purchases.filter((p) => ymOf(p.supplierInvoiceDate, p.createdAt) === period).map((p) => ({ docType: "Purchase Invoice", docNo: p.supplierInvoiceNo || p.invoiceNo, date: p.supplierInvoiceDate || "", party: p.supplier || "—", taxable: num(p.taxableAmount), rate: null, section: null, tax: num(p.gstAmount) }))));
    if (purchaseReturns.length) groups.push(group("purchaseReturns", "Add: ITC Reversal — Purchase Returns", "ITC reversed on purchase returns", 1,
      purchaseReturns.map((r) => ({ docType: "Purchase Return", docNo: r.returnNo, date: r.returnDate, party: r.supplier || "—", taxable: num(r.taxableAmount), rate: null, section: null, tax: num(r.taxAmount) }))));
  } else if (type === "TDS") {
    const rows = await prisma.pettyCashVoucher.findMany({ where: { ...where, status: { not: "Cancelled" }, tdsAmount: { gt: 0 }, voucherDate: { gte: from, lte: to } }, select: { voucherNo: true, voucherDate: true, payeeName: true, invoiceNo: true, taxableTotal: true, totalAmount: true, tdsSection: true, tdsRate: true, tdsAmount: true } });
    groups.push(group("tds", "TDS Deducted — Expense Vouchers", "TDS withheld on expense / vendor bills, payable to govt", 1,
      rows.map((v) => ({ docType: "Expense Voucher", docNo: v.voucherNo, date: v.voucherDate, party: v.payeeName || "—", taxable: num(v.taxableTotal) || num(v.totalAmount), rate: num(v.tdsRate) || null, section: v.tdsSection || "Unspecified", tax: num(v.tdsAmount) }))));
  } else if (type === "TCS") {
    const [sales, receipts] = await Promise.all([
      prisma.sale.findMany({ where: { ...where, status: { not: "Cancelled" }, tcsAmount: { gt: 0 }, saleDate: { gte: from, lte: to } }, select: { invoiceNo: true, saleDate: true, customerName: true, taxableValue: true, tcsAmount: true } }),
      prisma.receiptTransactionDetail.findMany({ where: { tcsAmount: { gt: 0 }, receipt: { ...where, status: "Posted", voucherDate: { gte: from, lte: to } } }, select: { taxable: true, tcsAmount: true, gstRate: true, receipt: { select: { voucherNo: true, voucherDate: true, partyName: true } } } }),
    ]);
    groups.push(group("tcs", "TCS Collected — Sales Invoices", "TCS collected from customers, payable to govt", 1,
      sales.map((s) => ({ docType: "Sales Invoice", docNo: s.invoiceNo, date: s.saleDate, party: s.customerName || "Walk-in / Cash", taxable: num(s.taxableValue), rate: null, section: null, tax: num(s.tcsAmount) }))));
    if (receipts.length) groups.push(group("tcsReceipts", "TCS Collected — Receipts", "TCS collected on income receipts, payable to govt", 1,
      receipts.map((d) => ({ docType: "Receipt", docNo: d.receipt?.voucherNo ?? "—", date: d.receipt?.voucherDate ?? "", party: d.receipt?.partyName || "—", taxable: num(d.taxable), rate: num(d.gstRate) || null, section: null, tax: num(d.tcsAmount) }))));
  }

  // Optional voucher/receipt-number (or party/section) search across all rows.
  let out = groups;
  const term = (q || "").trim().toLowerCase();
  if (term) {
    out = groups.map((g) => {
      const rows = g.rows.filter((r) => r.docNo.toLowerCase().includes(term) || r.party.toLowerCase().includes(term) || (r.section || "").toLowerCase().includes(term));
      return { ...g, rows, count: rows.length, taxable: r2(rows.reduce((s, r) => s + r.taxable, 0)), tax: r2(rows.reduce((s, r) => s + r.tax, 0)) };
    }).filter((g) => g.rows.length > 0);
  }
  const net = r2(out.reduce((s, g) => s + g.sign * g.tax, 0));
  return { type, period, groups: out, net };
}

/** Section-and-vendor detail for the TDS tab. */
export async function tdsDetail(scope: ActiveScope, period: string) {
  const { from, to } = periodWindow(period);
  return tdsBreakup(scope, from, to);
}

/** Customer detail for the TCS tab. */
export async function tcsDetail(scope: ActiveScope, period: string) {
  const { from, to } = periodWindow(period);
  return tcsByCustomer(scope, from, to);
}
