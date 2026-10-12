import { prisma } from "@/lib/db/prisma";
import type { ActiveScope, ScopeUser } from "@/lib/auth/scope";
import { resolveWriteScope } from "@/lib/auth/scope";
import { writeAudit } from "@/lib/audit/log";
import { bizWhere, getGstHeader, monthRange, periodLabel, recentPeriods, num, r2, isPeriodLocked } from "./core";
import { buildGstr1, buildGstr3b, computeVerification, type ReturnSectionRow } from "./engine";
import { buildGstr1Json, buildGstr3bJson, validateReturn } from "./json";
import type {
  GstReturnRow, GstReturnDetail, GstReturnSectionRow, GstValidationRow, GstVerificationSummary,
  GstJsonExportRow, GstFilingRow, GstPeriodRow,
} from "@/lib/contracts/gstCompliance";

type Actor = ScopeUser & { id: number; tenantId: number; fullName?: string | null };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");

// ------------------------------------------------------------------ returns

export async function generateReturn(scope: ActiveScope, user: Actor, returnType: "GSTR-1" | "GSTR-3B", period: string): Promise<number> {
  if (await isPeriodLocked(scope, period)) throw new Error("This GST period is locked. Reopen it before regenerating returns.");
  const header = await getGstHeader(scope, period);
  const { from, to } = monthRange(period);
  const seg = await resolveWriteScope(user, undefined);

  let rows: ReturnSectionRow[]; let totals: Record<string, number>;
  if (returnType === "GSTR-1") { const g = await buildGstr1(scope, period); rows = g.rows; totals = g.totals; }
  else { const g = await buildGstr3b(scope, period); rows = g.rows; totals = g.totals; }

  const headline = returnType === "GSTR-1"
    ? { taxableValue: totals.taxableValue ?? 0, cgst: totals.cgst ?? 0, sgst: totals.sgst ?? 0, igst: totals.igst ?? 0, cess: totals.cess ?? 0, outputTax: r2((totals.cgst ?? 0) + (totals.sgst ?? 0) + (totals.igst ?? 0)), itcTotal: 0, netLiability: r2((totals.cgst ?? 0) + (totals.sgst ?? 0) + (totals.igst ?? 0)) }
    : { taxableValue: totals.outwardTaxable ?? 0, cgst: totals.outputCgst ?? 0, sgst: totals.outputSgst ?? 0, igst: totals.outputIgst ?? 0, cess: 0, outputTax: totals.outputTax ?? 0, itcTotal: totals.itc ?? 0, netLiability: totals.netLiability ?? 0 };

  const existing = await prisma.gstReturn.findFirst({ where: { ...bizWhere(scope), returnType, period }, orderBy: { id: "desc" } });
  if (existing?.status === "Filed") throw new Error("This return is already filed. Reopen it to regenerate.");

  const data = {
    returnType, period, fromDate: from, toDate: to, gstin: header.gstin, legalName: header.legalName,
    ...headline, totals: JSON.stringify(totals),
  };

  let id: number;
  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.gstReturnItem.deleteMany({ where: { returnId: existing.id } });
      await tx.gstReturn.update({ where: { id: existing.id }, data: { ...data, status: existing.status === "Draft" ? "Draft" : "Draft" } });
      await tx.gstReturnItem.createMany({ data: rows.map((rw) => ({ tenantId: scope.tenantId, returnId: existing.id, ...itemData(rw) })) });
    });
    id = existing.id;
  } else {
    const created = await prisma.gstReturn.create({ data: { tenantId: scope.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, status: "Draft", createdBy: user.id, ...data } });
    await prisma.gstReturnItem.createMany({ data: rows.map((rw) => ({ tenantId: scope.tenantId, returnId: created.id, ...itemData(rw) })) });
    id = created.id;
  }

  await writeAudit(prisma, user, { action: "gst.return.generate", entity: "GstReturn", entityId: id, summary: `Generated ${returnType} for ${periodLabel(period)}`, meta: { returnType, period, ...headline }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
  return id;
}

function itemData(rw: ReturnSectionRow) {
  return {
    section: rw.section, refType: rw.refType || null, refId: rw.refId || null, invoiceNo: rw.invoiceNo || null, invoiceDate: rw.invoiceDate || null,
    partyGstin: rw.partyGstin || null, partyName: rw.partyName || null, placeOfSupply: rw.placeOfSupply || null,
    hsn: rw.hsn || null, description: rw.description || null, uom: rw.uom || null, qty: rw.qty, rate: rw.rate,
    taxableValue: rw.taxableValue, cgst: rw.cgst, sgst: rw.sgst, igst: rw.igst, cess: rw.cess, total: rw.total,
  };
}

type ReturnRecord = { id: number; returnType: string; period: string; gstin: string | null; status: string; taxableValue: unknown; outputTax: unknown; itcTotal: unknown; netLiability: unknown; jsonVersion: number; preparedByName: string | null; preparedAt: Date | null; verifiedByName: string | null; approvedByName: string | null; updatedAt: Date };

function toReturnRow(r: ReturnRecord): GstReturnRow {
  return {
    id: r.id, returnType: r.returnType as GstReturnRow["returnType"], period: r.period, gstin: r.gstin ?? "", status: r.status as GstReturnRow["status"],
    taxableValue: num(r.taxableValue), outputTax: num(r.outputTax), itcTotal: num(r.itcTotal), netLiability: num(r.netLiability),
    jsonVersion: r.jsonVersion, preparedByName: r.preparedByName ?? "", preparedAt: iso(r.preparedAt), verifiedByName: r.verifiedByName ?? "", approvedByName: r.approvedByName ?? "", updatedAt: iso(r.updatedAt),
  };
}

export async function listReturns(scope: ActiveScope, period?: string): Promise<GstReturnRow[]> {
  const rows = await prisma.gstReturn.findMany({ where: { ...bizWhere(scope), ...(period ? { period } : {}) }, orderBy: [{ period: "desc" }, { returnType: "asc" }], take: 200 });
  return rows.map(toReturnRow);
}

export async function getReturnDetail(scope: ActiveScope, id: number): Promise<GstReturnDetail | null> {
  const r = await prisma.gstReturn.findFirst({ where: { id, ...bizWhere(scope) }, include: { items: { orderBy: { id: "asc" } } } });
  if (!r) return null;
  const sections: Record<string, GstReturnSectionRow[]> = {};
  for (const it of r.items) {
    const sr: GstReturnSectionRow = {
      section: it.section, invoiceNo: it.invoiceNo ?? "", invoiceDate: it.invoiceDate ?? "", partyName: it.partyName ?? "", partyGstin: it.partyGstin ?? "", placeOfSupply: it.placeOfSupply ?? "",
      hsn: it.hsn ?? "", description: it.description ?? "", rate: num(it.rate), qty: num(it.qty), taxableValue: num(it.taxableValue), cgst: num(it.cgst), sgst: num(it.sgst), igst: num(it.igst), cess: num(it.cess), total: num(it.total),
    };
    (sections[it.section] ??= []).push(sr);
  }
  let totals: unknown = null; try { totals = r.totals ? JSON.parse(r.totals) : null; } catch { totals = null; }
  return {
    ...toReturnRow(r), fromDate: r.fromDate, toDate: r.toDate, legalName: r.legalName ?? "", cgst: num(r.cgst), sgst: num(r.sgst), igst: num(r.igst), cess: num(r.cess), remarks: r.remarks ?? "", totals, sections,
  };
}

const NEXT: Record<string, { from: string; set: Record<string, unknown> }> = {};

export async function transitionReturn(scope: ActiveScope, user: Actor, id: number, action: string, opts: { arn?: string; remarks?: string }): Promise<void> {
  const r = await prisma.gstReturn.findFirst({ where: { id, ...bizWhere(scope) } });
  if (!r) throw new Error("Return not found.");
  const now = new Date();
  const expect = (s: string) => { if (r.status !== s) throw new Error(`Action not allowed from status "${r.status}".`); };

  if (action === "prepare") { expect("Draft"); await prisma.gstReturn.update({ where: { id }, data: { status: "Prepared", preparedBy: user.id, preparedByName: user.fullName ?? null, preparedAt: now } }); }
  else if (action === "verify") { expect("Prepared"); await prisma.gstReturn.update({ where: { id }, data: { status: "Verified", verifiedBy: user.id, verifiedByName: user.fullName ?? null, verifiedAt: now } }); }
  else if (action === "approve") { expect("Verified"); await prisma.gstReturn.update({ where: { id }, data: { status: "Approved", approvedBy: user.id, approvedByName: user.fullName ?? null, approvedAt: now } }); }
  else if (action === "ready") { expect("Approved"); await prisma.gstReturn.update({ where: { id }, data: { status: "ReadyForFiling" } }); }
  else if (action === "file") {
    if (r.status !== "ReadyForFiling" && r.status !== "Approved") throw new Error(`Action not allowed from status "${r.status}".`);
    await prisma.$transaction(async (tx) => {
      await tx.gstReturn.update({ where: { id }, data: { status: "Filed", remarks: opts.remarks ?? r.remarks } });
      await tx.gstFilingHistory.create({ data: { tenantId: scope.tenantId, businessId: r.businessId, branchId: r.branchId, returnId: id, returnType: r.returnType, period: r.period, gstin: r.gstin, arn: opts.arn ?? null, filingDate: now.toISOString().slice(0, 10), jsonVersion: r.jsonVersion, status: "Filed", remarks: opts.remarks ?? null, filedBy: user.id, filedByName: user.fullName ?? null } });
    });
  } else if (action === "reopen") { if (r.status !== "Filed") throw new Error("Only a filed return can be reopened."); await prisma.gstReturn.update({ where: { id }, data: { status: "Approved" } }); }
  else throw new Error("Unknown action.");

  void NEXT;
  await writeAudit(prisma, user, { action: `gst.return.${action}`, entity: "GstReturn", entityId: id, summary: `${action} ${r.returnType} ${periodLabel(r.period)}`, meta: { action, arn: opts.arn }, businessId: r.businessId, branchId: r.branchId });
}

// --------------------------------------------------------------- JSON export

export async function generateJson(scope: ActiveScope, user: Actor, returnId: number): Promise<{ id: number; validationStatus: string }> {
  const r = await prisma.gstReturn.findFirst({ where: { id: returnId, ...bizWhere(scope) }, include: { items: true } });
  if (!r) throw new Error("Return not found.");
  const header = await getGstHeader(scope, r.period);
  let totals: Record<string, number> = {}; try { totals = r.totals ? JSON.parse(r.totals) : {}; } catch { totals = {}; }

  let payloadObj: Record<string, unknown>;
  if (r.returnType === "GSTR-1") {
    const rows: ReturnSectionRow[] = r.items.map((it) => ({
      section: it.section, refType: it.refType ?? "", refId: it.refId ?? 0, invoiceNo: it.invoiceNo ?? "", invoiceDate: it.invoiceDate ?? "",
      partyGstin: it.partyGstin ?? "", partyName: it.partyName ?? "", placeOfSupply: it.placeOfSupply ?? "", hsn: it.hsn ?? "", description: it.description ?? "",
      uom: it.uom ?? "", qty: num(it.qty), rate: num(it.rate), taxableValue: num(it.taxableValue), cgst: num(it.cgst), sgst: num(it.sgst), igst: num(it.igst), cess: num(it.cess), total: num(it.total),
    }));
    payloadObj = buildGstr1Json(header, rows, totals);
  } else payloadObj = buildGstr3bJson(header, totals);

  const validation = validateReturn(header, totals);
  const last = await prisma.gstJsonExport.findFirst({ where: { ...bizWhere(scope), returnId }, orderBy: { version: "desc" } });
  const version = (last?.version ?? 0) + 1;
  const fileName = `${r.returnType}_${header.gstin || "GSTIN"}_${r.period}_v${version}.json`;
  const seg = await resolveWriteScope(user, undefined);

  const created = await prisma.gstJsonExport.create({
    data: {
      tenantId: scope.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, returnId, returnType: r.returnType, period: r.period, gstin: r.gstin,
      version, fileName, payload: JSON.stringify(payloadObj, null, 2), validationStatus: validation.status, validationNotes: validation.notes.join(" "),
      generatedBy: user.id, generatedByName: user.fullName ?? null,
    },
  });
  await prisma.gstReturn.update({ where: { id: returnId }, data: { jsonVersion: version } });
  await writeAudit(prisma, user, { action: "gst.json.generate", entity: "GstJsonExport", entityId: created.id, summary: `Generated ${r.returnType} JSON v${version} for ${periodLabel(r.period)}`, meta: { returnType: r.returnType, period: r.period, version, validation: validation.status }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
  return { id: created.id, validationStatus: validation.status };
}

export async function listJsonExports(scope: ActiveScope, period?: string): Promise<GstJsonExportRow[]> {
  const rows = await prisma.gstJsonExport.findMany({ where: { ...bizWhere(scope), ...(period ? { period } : {}) }, orderBy: { id: "desc" }, take: 200 });
  return rows.map((e) => ({ id: e.id, returnType: e.returnType, period: e.period, gstin: e.gstin ?? "", version: e.version, fileName: e.fileName, validationStatus: e.validationStatus, validationNotes: e.validationNotes ?? "", generatedByName: e.generatedByName ?? "", generatedAt: iso(e.generatedAt), downloadCount: e.downloadCount }));
}

export async function getJsonPayload(scope: ActiveScope, user: Actor, id: number): Promise<{ fileName: string; payload: string } | null> {
  const e = await prisma.gstJsonExport.findFirst({ where: { id, ...bizWhere(scope) } });
  if (!e) return null;
  await prisma.gstJsonExport.update({ where: { id }, data: { downloadCount: { increment: 1 }, lastDownloadAt: new Date() } });
  await writeAudit(prisma, user, { action: "gst.json.download", entity: "GstJsonExport", entityId: id, summary: `Downloaded ${e.fileName}`, businessId: e.businessId, branchId: e.branchId });
  return { fileName: e.fileName, payload: e.payload };
}

// --------------------------------------------------------------- verification

export async function runVerification(scope: ActiveScope, user: Actor, period: string): Promise<GstVerificationSummary> {
  const findings = await computeVerification(scope, period);
  const batch = `${period}-${new Date().getTime()}`;
  const seg = await resolveWriteScope(user, undefined);
  await prisma.$transaction(async (tx) => {
    await tx.gstValidationLog.deleteMany({ where: { ...bizWhere(scope), period, status: "Open" } });
    if (findings.length) {
      await tx.gstValidationLog.createMany({
        data: findings.map((f) => ({ tenantId: scope.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, period, runBatch: batch, sourceType: f.sourceType, sourceId: f.sourceId, docNo: f.docNo, docDate: f.docDate, partyName: f.partyName, checkCode: f.checkCode, severity: f.severity, message: f.message, status: "Open", runBy: user.id, runByName: user.fullName ?? null })),
      });
    }
  });
  await writeAudit(prisma, user, { action: "gst.verify.run", entity: "GstValidationLog", entityId: period, summary: `Ran GST verification for ${periodLabel(period)} — ${findings.length} finding(s)`, meta: { period, count: findings.length }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
  return verificationSummary(scope, period);
}

export async function verificationSummary(scope: ActiveScope, period: string): Promise<GstVerificationSummary> {
  const rows = await prisma.gstValidationLog.findMany({ where: { ...bizWhere(scope), period }, orderBy: [{ severity: "asc" }, { id: "desc" }], take: 500 });
  const out: GstValidationRow[] = rows.map((v) => ({ id: v.id, sourceType: v.sourceType, sourceId: v.sourceId, docNo: v.docNo ?? "", docDate: v.docDate ?? "", partyName: v.partyName ?? "", checkCode: v.checkCode, severity: v.severity as GstValidationRow["severity"], message: v.message, status: v.status, resolvedByName: v.resolvedByName ?? "", resolvedAt: iso(v.resolvedAt) }));
  const last = rows.reduce((m, v) => (v.createdAt > m ? v.createdAt : m), rows[0]?.createdAt ?? null as Date | null);
  return {
    lastRunAt: iso(last),
    errors: out.filter((r) => r.severity === "Error").length,
    warnings: out.filter((r) => r.severity === "Warning").length,
    info: out.filter((r) => r.severity === "Information").length,
    open: out.filter((r) => r.status === "Open").length,
    resolved: out.filter((r) => r.status !== "Open").length,
    rows: out,
  };
}

export async function resolveValidation(scope: ActiveScope, user: Actor, id: number, status: string, note?: string): Promise<void> {
  const v = await prisma.gstValidationLog.findFirst({ where: { id, ...bizWhere(scope) } });
  if (!v) throw new Error("Validation row not found.");
  await prisma.gstValidationLog.update({ where: { id }, data: { status, resolvedBy: user.id, resolvedByName: user.fullName ?? null, resolvedAt: new Date(), resolutionNote: note ?? null } });
  await writeAudit(prisma, user, { action: "gst.verify.resolve", entity: "GstValidationLog", entityId: id, summary: `Marked validation ${v.checkCode} as ${status}`, businessId: v.businessId, branchId: v.branchId });
}

// ------------------------------------------------------------ period closing

export async function listPeriods(scope: ActiveScope, anchor: string): Promise<GstPeriodRow[]> {
  const periods = recentPeriods(anchor, 12).reverse();
  const closings = await prisma.gstPeriodClosing.findMany({ where: { ...bizWhere(scope), period: { in: periods } } });
  const filed = await prisma.gstReturn.findMany({ where: { ...bizWhere(scope), period: { in: periods } }, select: { period: true, status: true } });
  const cmap = new Map(closings.map((c) => [c.period, c]));
  return periods.map((p) => {
    const c = cmap.get(p);
    const { from, to } = monthRange(p);
    const fl = filed.filter((f) => f.period === p);
    const filedCount = fl.filter((f) => f.status === "Filed").length;
    return {
      id: c?.id ?? null, period: p, periodLabel: periodLabel(p), fromDate: from, toDate: to,
      filingStatus: filedCount >= 2 ? "Filed" : filedCount > 0 ? "Partially Filed" : "Pending",
      closingStatus: c?.closingStatus ?? "Open",
      lockedByName: c?.lockedByName ?? "", lockedAt: iso(c?.lockedAt), reopenedByName: c?.reopenedByName ?? "", reopenReason: c?.reopenReason ?? "",
    };
  });
}

export async function closePeriod(scope: ActiveScope, user: Actor, period: string, action: "verify" | "lock" | "reopen", reason?: string): Promise<void> {
  const { from, to } = monthRange(period);
  const seg = await resolveWriteScope(user, undefined);
  const existing = await prisma.gstPeriodClosing.findFirst({ where: { ...bizWhere(scope), period } });
  const now = new Date();

  const base = { tenantId: scope.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, period, fromDate: from, toDate: to };
  let data: Record<string, unknown>;
  if (action === "verify") data = { closingStatus: "Verified" };
  else if (action === "lock") data = { closingStatus: "Locked", lockedBy: user.id, lockedByName: user.fullName ?? null, lockedAt: now };
  else data = { closingStatus: "Open", reopenedBy: user.id, reopenedByName: user.fullName ?? null, reopenedAt: now, reopenReason: reason ?? null };

  if (existing) await prisma.gstPeriodClosing.update({ where: { id: existing.id }, data });
  else await prisma.gstPeriodClosing.create({ data: { ...base, ...data } });

  await writeAudit(prisma, user, { action: `gst.period.${action}`, entity: "GstPeriodClosing", entityId: period, summary: `${action === "lock" ? "Locked" : action === "reopen" ? "Reopened" : "Verified"} GST period ${periodLabel(period)}`, meta: { period, reason }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
}

// --------------------------------------------------------------------- filing

export async function listFiling(scope: ActiveScope, period?: string): Promise<GstFilingRow[]> {
  const rows = await prisma.gstFilingHistory.findMany({ where: { ...bizWhere(scope), ...(period ? { period } : {}) }, orderBy: { id: "desc" }, take: 200 });
  return rows.map((h) => ({ id: h.id, returnType: h.returnType, period: h.period, gstin: h.gstin ?? "", arn: h.arn ?? "", filingDate: h.filingDate ?? "", jsonVersion: h.jsonVersion, status: h.status, filedByName: h.filedByName ?? "", remarks: h.remarks ?? "" }));
}

// ----------------------------------------------------------------------- audit

export async function listAudit(scope: ActiveScope, period?: string) {
  const rows = await prisma.auditLog.findMany({
    where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), action: { startsWith: "gst." } },
    orderBy: { id: "desc" }, take: 200,
    select: { id: true, action: true, entity: true, summary: true, userName: true, createdAt: true },
  });
  void period;
  return rows.map((a) => ({ id: a.id, action: a.action, entity: a.entity, summary: a.summary ?? "", userName: a.userName ?? "", at: iso(a.createdAt) }));
}
