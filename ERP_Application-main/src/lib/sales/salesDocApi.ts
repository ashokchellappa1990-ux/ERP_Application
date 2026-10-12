import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { stampTerminal, getActiveTerminalContext } from "@/lib/pos/terminalContext";
import { nextSalesDocNumber } from "./salesDocNumber";
import { buildSalesDoc } from "./createSalesDoc";
import {
  SalesDocCreateSchema, SalesDocStatusSchema, nextMap, OPEN_STATUSES, DOC_LABEL,
  type SalesDocType, type SalesDocRow, type SalesDocDetail, type SalesDocItemDto,
} from "@/lib/contracts/salesDoc";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const perm = (t: SalesDocType) => (t === "order" ? "sales.order" : "sales.quotation");
const issuedStatus = (t: SalesDocType) => (t === "order" ? "Confirmed" : "Sent");
type Row = Prisma.SalesDocumentGetPayload<{ include: { items: true; attachments: true } }>;

function shapeItem(it: Row["items"][number]): SalesDocItemDto {
  return {
    id: it.id, productId: it.productId, productName: it.productName, sku: it.sku, hsn: it.hsn, uom: it.uom,
    qty: num(it.qty), mrp: it.mrp != null ? num(it.mrp) : null, rate: num(it.rate), discPct: it.discPct != null ? num(it.discPct) : null,
    discAmount: num(it.discAmount), taxPct: it.taxPct != null ? num(it.taxPct) : null, taxableValue: num(it.taxableValue),
    taxAmount: num(it.taxAmount), lineValue: num(it.lineValue), deliveredQty: num(it.deliveredQty), expectedDate: it.expectedDate ?? "", remarks: it.remarks ?? "",
  };
}

function toDetail(d: Row): SalesDocDetail {
  return {
    id: d.id, docType: d.docType as SalesDocType, docNo: d.docNo, docDate: d.docDate, status: d.status,
    customerId: d.customerId, customerName: d.customerName ?? "", customerPhone: d.customerPhone ?? "", customerGstin: d.customerGstin ?? "",
    customerContact: d.customerContact ?? "", customerRef: d.customerRef ?? "", salesperson: d.salesperson ?? "", enquiryNo: d.enquiryNo ?? "", enquiryDate: d.enquiryDate ?? "",
    validUntil: d.validUntil ?? "", expectedDeliveryDate: d.expectedDeliveryDate ?? "", warehouse: d.warehouse ?? "", deliveryAddress: d.deliveryAddress ?? "", shippingMode: d.shippingMode ?? "",
    paymentTerms: d.paymentTerms ?? "", creditDays: d.creditDays, dueDate: d.dueDate ?? "", currency: d.currency,
    gstApplicable: d.gstApplicable, reverseCharge: d.reverseCharge, interState: d.interState, gstMode: d.gstMode,
    subtotal: num(d.subtotal), itemDiscount: num(d.itemDiscount), additionalDiscount: num(d.additionalDiscount), taxableAmount: num(d.taxableAmount),
    cgst: num(d.cgst), sgst: num(d.sgst), igst: num(d.igst), gstAmount: num(d.gstAmount),
    freight: num(d.freight), loading: num(d.loading), packing: num(d.packing), insurance: num(d.insurance), otherCharges: num(d.otherCharges), roundOff: num(d.roundOff),
    totalValue: num(d.totalValue), netAmount: num(d.netAmount), itemCount: d.itemCount,
    sourceDocType: d.sourceDocType ?? "", sourceDocNo: d.sourceDocNo ?? "", convertedToType: d.convertedToType ?? "", convertedToId: d.convertedToId, convertedToNo: d.convertedToNo ?? "",
    approvalNote: d.approvalNote ?? "", cancelReason: d.cancelReason ?? "", remarks: d.remarks ?? "", internalNotes: d.internalNotes ?? "", termsConditions: d.termsConditions ?? "",
    createdByName: d.createdByName ?? "", createdAt: d.createdAt.toISOString(),
    items: d.items.sort((a, b) => a.id - b.id).map(shapeItem),
    attachments: d.attachments.map((a) => ({ id: a.id, fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType, size: a.size })),
  };
}

// header data (excluding docNo, terminal stamp) from a validated body + build result.
function headerData(docType: SalesDocType, body: import("@/lib/contracts/salesDoc").SalesDocCreateInput, built: ReturnType<typeof buildSalesDoc>, customer: { id: number; name: string | null; phone: string | null; gstin: string | null } | null) {
  return {
    docDate: (body.docDate || new Date().toISOString().slice(0, 10)).slice(0, 10),
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? (body.customerName?.trim() || null),
    customerPhone: customer?.phone ?? (body.customerPhone?.trim() || null),
    customerGstin: customer?.gstin ?? (body.customerGstin?.trim() || null),
    customerContact: body.customerContact?.trim() || null, customerRef: body.customerRef?.trim() || null,
    salesperson: body.salesperson?.trim() || null, enquiryNo: body.enquiryNo?.trim() || null, enquiryDate: body.enquiryDate || null,
    validUntil: docType === "quotation" ? (body.validUntil || null) : null,
    expectedDeliveryDate: docType === "order" ? (body.expectedDeliveryDate || null) : null,
    warehouse: body.warehouse?.trim() || null, deliveryAddress: body.deliveryAddress?.trim() || null, shippingMode: body.shippingMode || null,
    paymentTerms: body.paymentTerms?.trim() || null, creditDays: body.creditDays != null ? Number(body.creditDays) : null, dueDate: body.dueDate || null, currency: body.currency || "INR",
    gstApplicable: body.gstApplicable !== false, reverseCharge: !!body.reverseCharge, interState: !!body.interState,
    remarks: body.remarks?.trim() || null, internalNotes: body.internalNotes?.trim() || null, termsConditions: body.termsConditions?.trim() || null,
    ...built.header,
  };
}

/* =============================================================== LIST */
export async function listSalesDocs(docType: SalesDocType, req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, perm(docType));
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const base: Prisma.SalesDocumentWhereInput = { ...sw, docType };
  const where: Prisma.SalesDocumentWhereInput = { ...base };
  if (q) where.OR = [{ docNo: { contains: q } }, { customerName: { contains: q } }, { customerGstin: { contains: q } }, { customerRef: { contains: q } }];
  if (status !== "All") where.status = status;

  const open = OPEN_STATUSES[docType];
  const [rows, total, draft, openCount, openAgg] = await Promise.all([
    prisma.salesDocument.findMany({ where, orderBy: { id: "desc" }, take: 100 }),
    prisma.salesDocument.count({ where: base }),
    prisma.salesDocument.count({ where: { ...base, status: "Draft" } }),
    prisma.salesDocument.count({ where: { ...base, status: { in: open } } }),
    prisma.salesDocument.aggregate({ where: { ...base, status: { in: open } }, _sum: { totalValue: true } }),
  ]);
  const shaped: SalesDocRow[] = rows.map((r) => ({
    id: r.id, docNo: r.docNo, docDate: r.docDate, status: r.status, customerName: r.customerName ?? "", customerGstin: r.customerGstin ?? "",
    itemCount: r.itemCount, totalValue: num(r.totalValue), netAmount: num(r.netAmount),
    keyDate: (docType === "order" ? r.expectedDeliveryDate : r.validUntil) ?? "", convertedToNo: r.convertedToNo ?? "",
  }));
  return NextResponse.json({ ok: true, rows: shaped, stats: { total, draft, open: openCount, openValue: num(openAgg._sum.totalValue) } });
}

/* ============================================================= CREATE */
export async function createSalesDoc(docType: SalesDocType, req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, perm(docType), { req, entity: "SalesDocument" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = SalesDocCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const customer = body.customerId ? await prisma.customer.findFirst({ where: { id: Number(body.customerId), tenantId: user.tenantId }, select: { id: true, name: true, phone: true, gstin: true } }) : null;
  if (body.customerId && !customer) return NextResponse.json({ ok: false, message: "Customer not found." }, { status: 422 });

  const built = buildSalesDoc(body);
  const status = body.saveMode === "Issued" ? issuedStatus(docType) : "Draft";
  const seg = scopeData(await getActiveScope(user), { branch: true });
  const stamp = stampTerminal(await getActiveTerminalContext(user), "WEB_POS");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const docNo = await nextSalesDocNumber(tx, user.tenantId, docType, { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
      const doc = await tx.salesDocument.create({
        data: {
          tenantId: user.tenantId, ...seg, docType, docNo, status,
          ...headerData(docType, body, built, customer),
          createdBy: user.id, createdByName: user.fullName ?? null, ...stamp,
          items: { create: built.lines },
          attachments: { create: (body.attachments ?? []).filter((a) => a.fileUrl && a.fileName).slice(0, 10).map((a) => ({ docType: a.docType || "attachment", fileName: a.fileName.slice(0, 200), fileUrl: a.fileUrl, fileType: a.fileType ?? null, size: Number(a.size) || 0 })) },
        },
      });
      return { id: doc.id, docNo: doc.docNo };
    });
    await writeAudit(prisma, user, {
      action: `sales_${docType}.create`, entity: "SalesDocument", entityId: result.id,
      summary: `${DOC_LABEL[docType].short} ${result.docNo} — ${built.header.netAmount.toFixed(2)} (${status})`,
      meta: { docNo: result.docNo, docType, netAmount: built.header.netAmount, itemCount: built.header.itemCount, status },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: `${DOC_LABEL[docType].short} saved.`, ...result }, { status: 201 });
  } catch (err) {
    console.error(`[sales/${docType}] create error`, err);
    return NextResponse.json({ ok: false, message: `Could not create the ${DOC_LABEL[docType].short.toLowerCase()}.` }, { status: 500 });
  }
}

/* =============================================================== DETAIL */
export async function getSalesDoc(docType: SalesDocType, id: number) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, perm(docType));
  if (denied) return denied;
  const doc = await prisma.salesDocument.findFirst({ where: { id, tenantId: user.tenantId, docType }, include: { items: true, attachments: true } });
  if (!doc) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, data: toDetail(doc) });
}

/* ================================================================ EDIT */
export async function patchSalesDoc(docType: SalesDocType, id: number, req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, perm(docType), { req, entity: "SalesDocument", entityId: id });
  if (denied) return denied;

  const existing = await prisma.salesDocument.findFirst({ where: { id, tenantId: user.tenantId, docType } });
  if (!existing) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (existing.status !== "Draft") return NextResponse.json({ ok: false, message: `Only a Draft ${DOC_LABEL[docType].short.toLowerCase()} can be edited.` }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = SalesDocCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const customer = body.customerId ? await prisma.customer.findFirst({ where: { id: Number(body.customerId), tenantId: user.tenantId }, select: { id: true, name: true, phone: true, gstin: true } }) : null;
  if (body.customerId && !customer) return NextResponse.json({ ok: false, message: "Customer not found." }, { status: 422 });
  const built = buildSalesDoc(body);
  const status = body.saveMode === "Issued" ? issuedStatus(docType) : "Draft";

  await prisma.$transaction(async (tx) => {
    await tx.salesDocumentItem.deleteMany({ where: { salesDocumentId: id } });
    await tx.salesDocumentAttachment.deleteMany({ where: { salesDocumentId: id } });
    await tx.salesDocument.update({
      where: { id },
      data: {
        status, ...headerData(docType, body, built, customer),
        items: { create: built.lines },
        attachments: { create: (body.attachments ?? []).filter((a) => a.fileUrl && a.fileName).slice(0, 10).map((a) => ({ docType: a.docType || "attachment", fileName: a.fileName.slice(0, 200), fileUrl: a.fileUrl, fileType: a.fileType ?? null, size: Number(a.size) || 0 })) },
      },
    });
  });
  await writeAudit(prisma, user, {
    action: `sales_${docType}.update`, entity: "SalesDocument", entityId: id,
    summary: `Updated ${DOC_LABEL[docType].short} ${existing.docNo}`, meta: { docNo: existing.docNo, status },
    businessId: existing.businessId ?? null, branchId: existing.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: `${DOC_LABEL[docType].short} updated.`, id, docNo: existing.docNo });
}

/* ============================================================== DELETE */
export async function deleteSalesDoc(docType: SalesDocType, id: number, req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, perm(docType), { req, entity: "SalesDocument", entityId: id });
  if (denied) return denied;
  const existing = await prisma.salesDocument.findFirst({ where: { id, tenantId: user.tenantId, docType } });
  if (!existing) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (existing.status !== "Draft") return NextResponse.json({ ok: false, message: `Only a Draft ${DOC_LABEL[docType].short.toLowerCase()} can be deleted. Cancel it instead.` }, { status: 422 });
  await prisma.salesDocument.delete({ where: { id } });
  await writeAudit(prisma, user, {
    action: `sales_${docType}.delete`, entity: "SalesDocument", entityId: id,
    summary: `Deleted ${DOC_LABEL[docType].short} ${existing.docNo}`, meta: { docNo: existing.docNo },
    businessId: existing.businessId ?? null, branchId: existing.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: `${DOC_LABEL[docType].short} deleted.` });
}

/* ========================================================= STATUS/TRANSITION */
export async function transitionSalesDoc(docType: SalesDocType, id: number, req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, perm(docType), { req, entity: "SalesDocument", entityId: id });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = SalesDocStatusSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 422 });
  const { action, note } = parsed.data;

  const existing = await prisma.salesDocument.findFirst({ where: { id, tenantId: user.tenantId, docType } });
  if (!existing) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });

  const to = nextMap(docType)[action]?.[existing.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${action} a ${existing.status} ${DOC_LABEL[docType].short.toLowerCase()}.` }, { status: 422 });

  const data: Prisma.SalesDocumentUpdateInput = { status: to };
  if (action === "cancel") { data.cancelledAt = new Date(); data.cancelReason = note ?? null; }
  if (to === "Sent" || to === "Confirmed") data.issuedAt = new Date();
  await prisma.salesDocument.update({ where: { id }, data });
  await writeAudit(prisma, user, {
    action: `sales_${docType}.${action}`, entity: "SalesDocument", entityId: id,
    summary: `${DOC_LABEL[docType].short} ${existing.docNo}: ${existing.status} → ${to}`, meta: { docNo: existing.docNo, from: existing.status, to, note },
    businessId: existing.businessId ?? null, branchId: existing.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: `${DOC_LABEL[docType].short} ${to.toLowerCase()}.`, status: to });
}

/* =============================================== CONVERT quotation → order */
export async function convertQuotationToOrder(id: number, req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.order", { req, entity: "SalesDocument", entityId: id });
  if (denied) return denied;

  const q = await prisma.salesDocument.findFirst({ where: { id, tenantId: user.tenantId, docType: "quotation" }, include: { items: true } });
  if (!q) return NextResponse.json({ ok: false, message: "Quotation not found." }, { status: 404 });
  if (["Cancelled", "Converted", "Rejected", "Expired"].includes(q.status)) return NextResponse.json({ ok: false, message: `A ${q.status} quotation cannot be converted.` }, { status: 422 });
  if (q.convertedToId) return NextResponse.json({ ok: false, message: `Already converted to ${q.convertedToNo}.` }, { status: 422 });

  const seg = scopeData(await getActiveScope(user), { branch: true });
  const stamp = stampTerminal(await getActiveTerminalContext(user), "WEB_POS");
  const result = await prisma.$transaction(async (tx) => {
    const docNo = await nextSalesDocNumber(tx, user.tenantId, "order", { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
    const order = await tx.salesDocument.create({
      data: {
        tenantId: user.tenantId, ...seg, docType: "order", docNo, status: "Draft", docDate: new Date().toISOString().slice(0, 10),
        customerId: q.customerId, customerName: q.customerName, customerPhone: q.customerPhone, customerGstin: q.customerGstin, customerContact: q.customerContact, customerRef: q.customerRef,
        salesperson: q.salesperson, warehouse: q.warehouse, deliveryAddress: q.deliveryAddress, shippingMode: q.shippingMode,
        paymentTerms: q.paymentTerms, creditDays: q.creditDays, currency: q.currency,
        gstApplicable: q.gstApplicable, reverseCharge: q.reverseCharge, interState: q.interState, gstMode: q.gstMode,
        subtotal: q.subtotal, itemDiscount: q.itemDiscount, additionalDiscount: q.additionalDiscount, taxableAmount: q.taxableAmount,
        cgst: q.cgst, sgst: q.sgst, igst: q.igst, gstAmount: q.gstAmount, freight: q.freight, loading: q.loading, packing: q.packing, insurance: q.insurance, otherCharges: q.otherCharges, roundOff: q.roundOff,
        totalValue: q.totalValue, netAmount: q.netAmount, itemCount: q.itemCount,
        remarks: q.remarks, termsConditions: q.termsConditions,
        sourceDocType: "quotation", sourceDocId: q.id, sourceDocNo: q.docNo,
        createdBy: user.id, createdByName: user.fullName ?? null, ...stamp,
        items: { create: q.items.map((it) => ({ productId: it.productId, productName: it.productName, sku: it.sku, hsn: it.hsn, uom: it.uom, qty: it.qty, mrp: it.mrp, rate: it.rate, discPct: it.discPct, discAmount: it.discAmount, taxPct: it.taxPct, taxableValue: it.taxableValue, taxAmount: it.taxAmount, lineValue: it.lineValue, expectedDate: it.expectedDate, remarks: it.remarks })) },
      },
    });
    await tx.salesDocument.update({ where: { id: q.id }, data: { status: "Converted", convertedToType: "order", convertedToId: order.id, convertedToNo: order.docNo } });
    return { id: order.id, docNo: order.docNo };
  });
  await writeAudit(prisma, user, {
    action: "sales_quotation.convert", entity: "SalesDocument", entityId: id,
    summary: `Quotation ${q.docNo} converted to order ${result.docNo}`, meta: { quotationNo: q.docNo, orderNo: result.docNo },
    businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: `Converted to order ${result.docNo}.`, ...result }, { status: 201 });
}
