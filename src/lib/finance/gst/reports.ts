import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import type { GstReport } from "@/lib/contracts/gstCompliance";
import { bizWhere, txnWhere, monthRange, num, r2, recentPeriods, periodLabel } from "./core";
import { periodFigures, buildItc } from "./engine";

/** All GST statutory registers/reports, keyed. Each returns columns + rows + totals
 *  so the UI renders + the client exports to CSV / print uniformly. */

export const GST_REPORTS = [
  { key: "gst-sales-register", title: "GST Sales Register" },
  { key: "gst-purchase-register", title: "GST Purchase Register" },
  { key: "output-gst-register", title: "Output GST Register" },
  { key: "input-gst-register", title: "Input GST Register" },
  { key: "tax-summary", title: "Tax Summary (by rate)" },
  { key: "hsn-summary", title: "HSN Summary" },
  { key: "sac-summary", title: "SAC Summary" },
  { key: "itc-report", title: "ITC Report" },
  { key: "gst-ledger", title: "GST Ledger" },
  { key: "gst-difference", title: "GST Difference Report" },
  { key: "gst-reconciliation", title: "GST Reconciliation Report" },
  { key: "monthly-gst-summary", title: "Monthly GST Summary" },
] as const;

const M = (key: string, label: string) => ({ key, label, money: true });
const T = (key: string, label: string) => ({ key, label });
const Q = (key: string, label: string) => ({ key, label, qty: true });

function sumCols(rows: Record<string, string | number>[], keys: string[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const k of keys) t[k] = r2(rows.reduce((s, r) => s + num(r[k]), 0));
  return t;
}

export async function getReport(scope: ActiveScope, period: string, key: string): Promise<GstReport> {
  const { from, to } = monthRange(period);
  const meta = GST_REPORTS.find((r) => r.key === key);
  const title = meta?.title ?? key;

  switch (key) {
    case "gst-sales-register":
    case "output-gst-register": {
      const sales = await prisma.sale.findMany({
        where: { ...txnWhere(scope), status: "Completed", saleDate: { gte: from, lte: to } },
        orderBy: { saleDate: "asc" },
        select: { invoiceNo: true, saleDate: true, customerName: true, customerGstin: true, channel: true, taxableValue: true, cgst: true, sgst: true, igst: true, total: true, customer: { select: { state: true } } },
      });
      const rows = sales.map((s) => ({
        docNo: s.invoiceNo, docDate: s.saleDate, party: s.customerName ?? "Walk-in", gstin: s.customerGstin ?? "",
        pos: s.customer?.state ?? "", type: s.channel,
        taxableValue: num(s.taxableValue), cgst: num(s.cgst), sgst: num(s.sgst), igst: num(s.igst), total: num(s.total),
      }));
      return { key, title, columns: [T("docNo", "Invoice"), T("docDate", "Date"), T("party", "Customer"), T("gstin", "GSTIN"), T("type", "Type"), M("taxableValue", "Taxable"), M("cgst", "CGST"), M("sgst", "SGST"), M("igst", "IGST"), M("total", "Total")], rows, totals: sumCols(rows, ["taxableValue", "cgst", "sgst", "igst", "total"]) };
    }
    case "gst-purchase-register":
    case "input-gst-register": {
      const all = await prisma.purchaseInvoice.findMany({
        where: { ...txnWhere(scope), status: "Posted" },
        select: { invoiceNo: true, supplierInvoiceNo: true, supplierInvoiceDate: true, createdAt: true, supplier: true, supplierGstin: true, purchaseType: true, taxableAmount: true, cgst: true, sgst: true, igst: true, cess: true, gstAmount: true, totalInvoiceAmount: true },
      });
      const inP = all.filter((p) => (p.supplierInvoiceDate || p.createdAt.toISOString()).slice(0, 7) === period);
      const rows = inP.map((p) => ({
        docNo: p.supplierInvoiceNo || p.invoiceNo, docDate: p.supplierInvoiceDate ?? p.createdAt.toISOString().slice(0, 10), party: p.supplier ?? "", gstin: p.supplierGstin ?? "", type: p.purchaseType,
        taxableValue: num(p.taxableAmount), cgst: num(p.cgst), sgst: num(p.sgst), igst: num(p.igst), cess: num(p.cess), total: num(p.totalInvoiceAmount),
      }));
      return { key, title, columns: [T("docNo", "Invoice"), T("docDate", "Date"), T("party", "Supplier"), T("gstin", "GSTIN"), T("type", "Type"), M("taxableValue", "Taxable"), M("cgst", "CGST"), M("sgst", "SGST"), M("igst", "IGST"), M("cess", "Cess"), M("total", "Total")], rows, totals: sumCols(rows, ["taxableValue", "cgst", "sgst", "igst", "cess", "total"]) };
    }
    case "tax-summary": {
      const lines = await prisma.saleLine.findMany({
        where: { sale: { ...txnWhere(scope), status: "Completed", saleDate: { gte: from, lte: to } } },
        select: { taxPct: true, taxableValue: true, taxAmount: true, sale: { select: { igst: true } } },
      });
      const map = new Map<number, { rate: number; taxableValue: number; cgst: number; sgst: number; igst: number; total: number }>();
      for (const l of lines) {
        const rate = num(l.taxPct);
        const e = map.get(rate) ?? { rate, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
        e.taxableValue += num(l.taxableValue);
        const t = num(l.taxAmount);
        if (num(l.sale?.igst) > 0) e.igst += t; else { e.cgst += t / 2; e.sgst += t / 2; }
        e.total += num(l.taxableValue) + t;
        map.set(rate, e);
      }
      const rows = [...map.values()].sort((a, b) => a.rate - b.rate).map((e) => ({ rate: `${e.rate}%`, taxableValue: r2(e.taxableValue), cgst: r2(e.cgst), sgst: r2(e.sgst), igst: r2(e.igst), total: r2(e.total) }));
      return { key, title, columns: [T("rate", "Tax Rate"), M("taxableValue", "Taxable"), M("cgst", "CGST"), M("sgst", "SGST"), M("igst", "IGST"), M("total", "Total")], rows, totals: sumCols(rows, ["taxableValue", "cgst", "sgst", "igst", "total"]) };
    }
    case "hsn-summary":
    case "sac-summary": {
      const sac = key === "sac-summary";
      const lines = await prisma.saleLine.findMany({
        where: { sale: { ...txnWhere(scope), status: "Completed", saleDate: { gte: from, lte: to } } },
        select: { hsn: true, productName: true, uom: true, qty: true, taxPct: true, taxableValue: true, taxAmount: true, sale: { select: { igst: true } } },
      });
      const map = new Map<string, { hsn: string; description: string; uom: string; qty: number; rate: number; taxableValue: number; cgst: number; sgst: number; igst: number; total: number }>();
      for (const l of lines) {
        const code = (l.hsn || "").trim();
        const isSac = code.startsWith("99");
        if (sac ? !isSac : isSac) continue;
        const k = (code || "NA") + "|" + num(l.taxPct);
        const e = map.get(k) ?? { hsn: code || "NA", description: l.productName, uom: l.uom ?? "", qty: 0, rate: num(l.taxPct), taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
        e.qty += num(l.qty); e.taxableValue += num(l.taxableValue);
        const t = num(l.taxAmount);
        if (num(l.sale?.igst) > 0) e.igst += t; else { e.cgst += t / 2; e.sgst += t / 2; }
        e.total += num(l.taxableValue) + t;
        map.set(k, e);
      }
      const rows = [...map.values()].map((e) => ({ hsn: e.hsn, description: e.description, uom: e.uom, qty: r2(e.qty), rate: `${e.rate}%`, taxableValue: r2(e.taxableValue), cgst: r2(e.cgst), sgst: r2(e.sgst), igst: r2(e.igst), total: r2(e.total) }));
      return { key, title, columns: [T("hsn", sac ? "SAC" : "HSN"), T("description", "Description"), T("uom", "UOM"), Q("qty", "Qty"), T("rate", "Rate"), M("taxableValue", "Taxable"), M("cgst", "CGST"), M("sgst", "SGST"), M("igst", "IGST"), M("total", "Total")], rows, totals: sumCols(rows, ["qty", "taxableValue", "cgst", "sgst", "igst", "total"]) };
    }
    case "itc-report": {
      const itc = await buildItc(scope, period);
      const rows = itc.rows.map((r) => ({ docNo: r.invoiceNo, docDate: r.invoiceDate, party: r.supplierName, gstin: r.supplierGstin, type: r.purchaseType, gstAmount: r.gstAmount, eligibleAmount: r.eligibleAmount, pendingAmount: r.pendingAmount, status: r.itcStatus }));
      return { key, title, columns: [T("docNo", "Invoice"), T("docDate", "Date"), T("party", "Supplier"), T("gstin", "GSTIN"), T("type", "Type"), M("gstAmount", "GST"), M("eligibleAmount", "Eligible ITC"), M("pendingAmount", "Pending"), T("status", "Status")], rows, totals: sumCols(rows, ["gstAmount", "eligibleAmount", "pendingAmount"]) };
    }
    case "gst-ledger": {
      const f = await periodFigures(scope, period);
      const rows = [
        { particulars: "Output GST (sales)", debit: 0, credit: r2(f.outCgst + f.outSgst + f.outIgst) },
        { particulars: "Less: Credit Notes", debit: r2(f.cnCgst + f.cnSgst + f.cnIgst), credit: 0 },
        { particulars: "Input GST (ITC)", debit: f.eligibleItc, credit: 0 },
        { particulars: "Less: ITC reversed", debit: 0, credit: f.prGst },
        { particulars: "Reverse Charge (RCM)", debit: 0, credit: f.rcmGst },
        { particulars: "Net payable", debit: 0, credit: f.netLiability > 0 ? f.netLiability : 0 },
        { particulars: "Net receivable (carry fwd)", debit: f.netLiability < 0 ? r2(-f.netLiability) : 0, credit: 0 },
      ];
      return { key, title, columns: [T("particulars", "Particulars"), M("debit", "Debit"), M("credit", "Credit")], rows, totals: sumCols(rows, ["debit", "credit"]) };
    }
    case "gst-difference":
    case "gst-reconciliation": {
      const recs = await prisma.gstReconciliation.findMany({ where: { ...bizWhere(scope), period }, orderBy: { id: "asc" } });
      const filtered = key === "gst-difference" ? recs.filter((r) => num(r.gstDifference) !== 0 || num(r.taxDifference) !== 0 || r.status === "Mismatch") : recs;
      const rows = filtered.map((r) => ({ gstin: r.supplierGstin ?? "", party: r.supplierName ?? "", docNo: r.invoiceNo ?? "", docDate: r.invoiceDate ?? "", erpGst: num(r.erpGst), portalGst: num(r.portalGst), gstDifference: num(r.gstDifference), status: r.status }));
      return { key, title, columns: [T("docNo", "Invoice"), T("docDate", "Date"), T("party", "Supplier"), T("gstin", "GSTIN"), M("erpGst", "ERP GST"), M("portalGst", "Portal GST"), M("gstDifference", "Difference"), T("status", "Status")], rows, totals: sumCols(rows, ["erpGst", "portalGst", "gstDifference"]) };
    }
    case "monthly-gst-summary":
    default: {
      const months = recentPeriods(period, 6);
      const figs = await Promise.all(months.map((m) => periodFigures(scope, m)));
      const rows = months.map((m, i) => ({ month: periodLabel(m), taxableSales: figs[i].salesTaxable, outputTax: figs[i].outputTax, taxablePurchase: figs[i].purTaxable, itc: figs[i].itcNet, netLiability: figs[i].netLiability }));
      return { key: "monthly-gst-summary", title: "Monthly GST Summary", columns: [T("month", "Month"), M("taxableSales", "Taxable Sales"), M("outputTax", "Output Tax"), M("taxablePurchase", "Taxable Purchase"), M("itc", "ITC"), M("netLiability", "Net Liability")], rows, totals: sumCols(rows, ["taxableSales", "outputTax", "taxablePurchase", "itc", "netLiability"]) };
    }
  }
}
