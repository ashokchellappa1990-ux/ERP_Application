import type { GstHeader } from "@/lib/contracts/gstCompliance";
import type { ReturnSectionRow } from "./engine";
import { r2 } from "./core";

/** GST-portal-compatible JSON builders + pre-export validation. */

const fp = (period: string) => { const [y, m] = period.split("-"); return `${m}${y}`; }; // MMYYYY

export function validateReturn(header: GstHeader, totals: Record<string, number>): { status: "Valid" | "Warning" | "Invalid"; notes: string[] } {
  const notes: string[] = [];
  let status: "Valid" | "Warning" | "Invalid" = "Valid";
  if (!header.gstin) { notes.push("GSTIN is not configured for this business."); status = "Invalid"; }
  else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(header.gstin.toUpperCase())) { notes.push("GSTIN format looks invalid."); status = "Warning"; }
  if ((totals.taxableValue ?? totals.outwardTaxable ?? 0) === 0 && (totals.itc ?? 0) === 0) { notes.push("Return has no taxable value — nothing to file."); if (status === "Valid") status = "Warning"; }
  return { status, notes };
}

export function buildGstr1Json(header: GstHeader, rows: ReturnSectionRow[], totals: Record<string, number>): Record<string, unknown> {
  const byParty = (section: string) => rows.filter((r) => r.section === section);
  // B2B grouped by counter-party GSTIN
  const b2bMap = new Map<string, { ctin: string; inv: unknown[] }>();
  for (const r of byParty("B2B")) {
    const g = (r.partyGstin || "URP").toUpperCase();
    const e = b2bMap.get(g) ?? { ctin: g, inv: [] };
    e.inv.push({ inum: r.invoiceNo, idt: r.invoiceDate, val: r.total, pos: (header.stateCode || "00"), rchrg: "N", inv_typ: "R", itms: [{ rt: r.rate, txval: r.taxableValue, camt: r.cgst, samt: r.sgst, iamt: r.igst, csamt: r.cess }] });
    b2bMap.set(g, e);
  }
  const cdnrMap = new Map<string, { ctin: string; nt: unknown[] }>();
  for (const r of byParty("CDNR")) {
    const g = (r.partyGstin || "URP").toUpperCase();
    const e = cdnrMap.get(g) ?? { ctin: g, nt: [] };
    e.nt.push({ nt_num: r.invoiceNo, nt_dt: r.invoiceDate, ntty: "C", val: Math.abs(r.total), itms: [{ rt: r.rate, txval: Math.abs(r.taxableValue), camt: Math.abs(r.cgst), samt: Math.abs(r.sgst), iamt: Math.abs(r.igst) }] });
    cdnrMap.set(g, e);
  }
  const b2cs = byParty("B2CS").map((r) => ({ sply_ty: r.igst ? "INTER" : "INTRA", pos: header.stateCode || "00", typ: "OE", rt: r.rate, txval: r.taxableValue, camt: r.cgst, samt: r.sgst, iamt: r.igst }));
  const hsn = rows.filter((r) => r.section === "HSN").map((r, i) => ({ num: i + 1, hsn_sc: r.hsn, desc: r.description, uqc: (r.uom || "NOS").toUpperCase().slice(0, 3), qty: r.qty, txval: r.taxableValue, camt: r.cgst, samt: r.sgst, iamt: r.igst, csamt: r.cess }));
  return {
    gstin: header.gstin, fp: fp(header.period), gt: r2(totals.total ?? 0), cur_gt: r2(totals.taxableValue ?? 0),
    b2b: [...b2bMap.values()], b2cl: byParty("B2CL").map((r) => ({ pos: header.stateCode || "00", inv: [{ inum: r.invoiceNo, idt: r.invoiceDate, val: r.total, itms: [{ rt: r.rate, txval: r.taxableValue, iamt: r.igst }] }] })),
    b2cs, cdnr: [...cdnrMap.values()], hsn: { data: hsn },
    doc_issue: { doc_det: [{ doc_num: 1, docs: [{ num: 1, from: "", to: "", totnum: totals.docs ?? 0, cancel: 0, net_issue: totals.docs ?? 0 }] }] },
  };
}

export function buildGstr3bJson(header: GstHeader, totals: Record<string, number>): Record<string, unknown> {
  return {
    gstin: header.gstin, ret_period: fp(header.period),
    sup_details: {
      osup_det: { txval: r2(totals.outwardTaxable ?? 0), camt: r2(totals.outputCgst ?? 0), samt: r2(totals.outputSgst ?? 0), iamt: r2(totals.outputIgst ?? 0), csamt: 0 },
      isup_rev: { txval: 0, iamt: r2(totals.rcm ?? 0), camt: 0, samt: 0, csamt: 0 },
    },
    itc_elg: { itc_avl: [{ ty: "OTH", iamt: 0, camt: 0, samt: 0, csamt: 0 }], itc_net: { itc: r2(totals.itc ?? 0) } },
    intr_ltfee: {},
    tx_pmt: { gst_payable: r2(totals.gstPayable ?? 0), gst_receivable: r2(totals.gstReceivable ?? 0), net_liability: r2(totals.netLiability ?? 0) },
  };
}
