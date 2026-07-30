import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { resolveWriteScope, type ScopeUser } from "@/lib/auth/scope";
import { bizWhere, num, r2 } from "./core";

/** GSTR-2B import + reconciliation against the ERP purchase register. */

export interface ParsedB2bLine {
  supplierGstin: string; supplierName: string; invoiceNo: string; invoiceDate: string;
  invoiceValue: number; taxableValue: number; cgst: number; sgst: number; igst: number; cess: number; itcStatus: string;
}

const n = (v: unknown) => (v == null ? 0 : Number(v) || 0);

/** Parse a GST-portal GSTR-2B JSON document OR a flat row array into B2B lines. */
export function parseGstr2b(raw: unknown): ParsedB2bLine[] {
  let doc: Record<string, unknown> = {};
  if (typeof raw === "string") { try { doc = JSON.parse(raw); } catch { return []; } }
  else if (raw && typeof raw === "object") doc = raw as Record<string, unknown>;

  // Flat array form (already-normalised rows from an Excel upload).
  const flat = (Array.isArray(raw) ? raw : (doc.rows as unknown[])) as Record<string, unknown>[] | undefined;
  if (Array.isArray(flat)) {
    return flat.map((r) => ({
      supplierGstin: String(r.supplierGstin ?? r.ctin ?? "").trim(),
      supplierName: String(r.supplierName ?? r.trdnm ?? "").trim(),
      invoiceNo: String(r.invoiceNo ?? r.inum ?? "").trim(),
      invoiceDate: String(r.invoiceDate ?? r.dt ?? "").trim(),
      invoiceValue: n(r.invoiceValue ?? r.val),
      taxableValue: n(r.taxableValue ?? r.txval),
      cgst: n(r.cgst ?? r.camt), sgst: n(r.sgst ?? r.samt), igst: n(r.igst ?? r.iamt), cess: n(r.cess ?? r.csamt),
      itcStatus: String(r.itcStatus ?? "Eligible"),
    })).filter((x) => x.invoiceNo || x.supplierGstin);
  }

  // GST portal nested form: data.docdata.b2b[].inv[] OR docdata.b2b[].inv[]
  const data = (doc.data ?? doc) as Record<string, unknown>;
  const docdata = (data.docdata ?? data) as Record<string, unknown>;
  const b2b = (docdata.b2b ?? []) as Record<string, unknown>[];
  const out: ParsedB2bLine[] = [];
  for (const sup of b2b) {
    const ctin = String(sup.ctin ?? "").trim();
    const trdnm = String(sup.trdnm ?? "").trim();
    const invs = (sup.inv ?? []) as Record<string, unknown>[];
    for (const inv of invs) {
      const items = (inv.items ?? []) as Record<string, unknown>[];
      let cgst = 0, sgst = 0, igst = 0, cess = 0, txval = 0;
      for (const it of items) { cgst += n(it.camt); sgst += n(it.samt); igst += n(it.iamt); cess += n(it.csamt); txval += n(it.txval); }
      out.push({
        supplierGstin: ctin, supplierName: trdnm, invoiceNo: String(inv.inum ?? "").trim(), invoiceDate: String(inv.dt ?? "").trim(),
        invoiceValue: n(inv.val), taxableValue: txval || n(inv.txval), cgst, sgst, igst, cess,
        itcStatus: String(inv.itcavl ?? "Y") === "N" ? "Ineligible" : "Eligible",
      });
    }
  }
  return out;
}

const key = (gstin?: string | null, inv?: string | null) =>
  `${(gstin ?? "").toUpperCase().trim()}|${(inv ?? "").toUpperCase().replace(/\s+/g, "").trim()}`;

/** Persist an import batch of parsed 2B lines. Returns the count imported. */
export async function importGstr2b(scope: ActiveScope, user: ScopeUser & { id: number; fullName?: string | null }, period: string, source: string, fileName: string | undefined, lines: ParsedB2bLine[]): Promise<number> {
  const seg = await resolveWriteScope(user, undefined);
  const batch = `${period}-${new Date().getTime()}`;
  if (!lines.length) return 0;
  await prisma.gstGstr2bImport.createMany({
    data: lines.map((l) => ({
      tenantId: scope.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null,
      importBatch: batch, period, source, fileName: fileName ?? null,
      supplierGstin: l.supplierGstin, supplierName: l.supplierName, invoiceNo: l.invoiceNo, invoiceDate: l.invoiceDate,
      invoiceValue: l.invoiceValue, taxableValue: l.taxableValue, cgst: l.cgst, sgst: l.sgst, igst: l.igst, cess: l.cess,
      gstAmount: r2(l.cgst + l.sgst + l.igst + l.cess), eligibleItc: l.itcStatus === "Ineligible" ? 0 : r2(l.cgst + l.sgst + l.igst), itcStatus: l.itcStatus,
      importedBy: user.id, importedByName: user.fullName ?? null,
    })),
  });
  return lines.length;
}

/** Reconcile ERP purchase register vs the latest imported GSTR-2B for the period. */
export async function runReconciliation(scope: ActiveScope, period: string): Promise<{ imported: number; matched: number; partially: number; mismatch: number; missingInErp: number; missingInPortal: number }> {
  const seg = scope.businessId != null ? { businessId: scope.businessId } : {};
  // ERP purchases for the period
  const allPi = await prisma.purchaseInvoice.findMany({
    where: { ...bizWhere(scope), status: "Posted", gstApplicable: true },
    select: { id: true, supplier: true, supplierGstin: true, supplierInvoiceNo: true, invoiceNo: true, supplierInvoiceDate: true, createdAt: true, taxableAmount: true, gstAmount: true },
  });
  const erp = allPi.filter((p) => (p.supplierInvoiceDate || p.createdAt.toISOString()).slice(0, 7) === period);
  const portal = await prisma.gstGstr2bImport.findMany({ where: { ...bizWhere(scope), period } });

  const portalByKey = new Map<string, typeof portal[number]>();
  for (const p of portal) portalByKey.set(key(p.supplierGstin, p.invoiceNo), p);
  const usedPortal = new Set<number>();

  const recRows: { supplierGstin: string; supplierName: string; invoiceNo: string; invoiceDate: string; erpInvoiceId: number | null; portalRowId: number | null; erpTaxable: number; erpGst: number; portalTaxable: number; portalGst: number; status: string; issue: string }[] = [];
  let matched = 0, partially = 0, mismatch = 0, missingInPortal = 0, missingInErp = 0;

  for (const e of erp) {
    const k = key(e.supplierGstin, e.supplierInvoiceNo || e.invoiceNo);
    const p = portalByKey.get(k);
    const erpGst = num(e.gstAmount);
    if (!p) {
      missingInPortal++;
      recRows.push({ supplierGstin: e.supplierGstin ?? "", supplierName: e.supplier ?? "", invoiceNo: e.supplierInvoiceNo || e.invoiceNo, invoiceDate: e.supplierInvoiceDate ?? "", erpInvoiceId: e.id, portalRowId: null, erpTaxable: num(e.taxableAmount), erpGst, portalTaxable: 0, portalGst: 0, status: "SupplierNotFiled", issue: "In ERP but not in GSTR-2B (supplier may not have filed)." });
      continue;
    }
    usedPortal.add(p.id);
    const portalGst = num(p.gstAmount);
    const gstDiff = r2(erpGst - portalGst);
    const taxDiff = r2(num(e.taxableAmount) - num(p.taxableValue));
    let status = "Matched"; let issue = "";
    if (Math.abs(gstDiff) < 1 && Math.abs(taxDiff) < 1) { status = "Matched"; matched++; }
    else if (Math.abs(gstDiff) < 1 || Math.abs(taxDiff) < 1) { status = "PartiallyMatched"; partially++; issue = `Taxable diff ${taxDiff}, GST diff ${gstDiff}.`; }
    else { status = "Mismatch"; mismatch++; issue = `Taxable diff ${taxDiff}, GST diff ${gstDiff}.`; }
    recRows.push({ supplierGstin: e.supplierGstin ?? "", supplierName: e.supplier ?? "", invoiceNo: e.supplierInvoiceNo || e.invoiceNo, invoiceDate: e.supplierInvoiceDate ?? "", erpInvoiceId: e.id, portalRowId: p.id, erpTaxable: num(e.taxableAmount), erpGst, portalTaxable: num(p.taxableValue), portalGst, status, issue });
  }
  for (const p of portal) {
    if (usedPortal.has(p.id)) continue;
    missingInErp++;
    recRows.push({ supplierGstin: p.supplierGstin ?? "", supplierName: p.supplierName ?? "", invoiceNo: p.invoiceNo ?? "", invoiceDate: p.invoiceDate ?? "", erpInvoiceId: null, portalRowId: p.id, erpTaxable: 0, erpGst: 0, portalTaxable: num(p.taxableValue), portalGst: num(p.gstAmount), status: "MissingInErp", issue: "In GSTR-2B but no matching ERP purchase invoice." });
  }

  await prisma.$transaction(async (tx) => {
    await tx.gstReconciliation.deleteMany({ where: { ...bizWhere(scope), period } });
    if (recRows.length) {
      await tx.gstReconciliation.createMany({
        data: recRows.map((r) => ({ tenantId: scope.tenantId, ...seg, period, supplierGstin: r.supplierGstin, supplierName: r.supplierName, invoiceNo: r.invoiceNo, invoiceDate: r.invoiceDate, erpInvoiceId: r.erpInvoiceId, portalRowId: r.portalRowId, erpTaxable: r.erpTaxable, erpGst: r.erpGst, portalTaxable: r.portalTaxable, portalGst: r.portalGst, taxDifference: r2(r.erpTaxable - r.portalTaxable), gstDifference: r2(r.erpGst - r.portalGst), status: r.status, issue: r.issue })),
      });
    }
    // reflect match status back onto portal rows
    for (const r of recRows) {
      if (r.portalRowId) await tx.gstGstr2bImport.update({ where: { id: r.portalRowId }, data: { matchStatus: r.status === "MissingInErp" ? "MissingInErp" : r.status } });
    }
  });

  return { imported: portal.length, matched, partially, mismatch, missingInErp, missingInPortal };
}
