import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { buildPurchaseOrder } from "@/lib/purchase/createPurchaseOrder";
import { PurchaseOrderCreateSchema, type PurchaseOrderDetail } from "@/lib/contracts/purchaseOrder";

const PERM = "purchase.order";
const n = (v: unknown) => (v == null ? 0 : Number(v));
const s = (v: unknown) => (v == null ? "" : String(v));

async function load(req: Request, id: number) {
  const user = await getSessionUser();
  if (!user) return { err: NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 }) };
  const denied = await requirePermission(user, PERM, { req, entity: "PurchaseOrder" });
  if (denied) return { err: denied };
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const order = await prisma.purchaseOrder.findFirst({ where: { ...sw, id }, include: { items: { orderBy: { id: "asc" } }, attachments: true } });
  if (!order) return { err: NextResponse.json({ ok: false, message: "Purchase order not found." }, { status: 404 }) };
  return { user, order };
}

// GET /api/purchase/order/[id] — full detail.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const r = await load(req, Number(params.id));
  if ("err" in r) return r.err;
  const o = r.order;
  const data: PurchaseOrderDetail = {
    id: o.id, poNo: o.poNo, poDate: o.poDate, status: o.status,
    supplierId: o.supplierId, supplier: s(o.supplier), supplierGstin: s(o.supplierGstin), supplierContact: s(o.supplierContact), supplierRef: s(o.supplierRef),
    quotationNo: s(o.quotationNo), quotationDate: s(o.quotationDate), buyer: s(o.buyer), purchaseType: o.purchaseType,
    expectedDeliveryDate: s(o.expectedDeliveryDate), warehouse: s(o.warehouse), deliveryAddress: s(o.deliveryAddress), shippingMode: s(o.shippingMode), freightPaidBy: s(o.freightPaidBy),
    paymentTerms: s(o.paymentTerms), creditDays: o.creditDays, dueDate: s(o.dueDate), currency: o.currency,
    gstApplicable: o.gstApplicable, reverseCharge: o.reverseCharge, interState: o.interState,
    taxableAmount: n(o.taxableAmount), cgst: n(o.cgst), sgst: n(o.sgst), igst: n(o.igst), cess: n(o.cess), gstAmount: n(o.gstAmount),
    additionalDiscount: n(o.additionalDiscount), freight: n(o.freight), loading: n(o.loading), packing: n(o.packing), insurance: n(o.insurance), otherCharges: n(o.otherCharges), roundOff: n(o.roundOff),
    totalOrderValue: n(o.totalOrderValue), netAmount: n(o.netAmount), itemCount: o.itemCount,
    approvedByName: s(o.approvedByName), approvedAt: o.approvedAt?.toISOString() ?? null, approvalNote: s(o.approvalNote), issuedAt: o.issuedAt?.toISOString() ?? null, cancelledAt: o.cancelledAt?.toISOString() ?? null, cancelReason: s(o.cancelReason),
    remarks: s(o.remarks), internalNotes: s(o.internalNotes), termsConditions: s(o.termsConditions), createdByName: s(o.createdByName), createdAt: o.createdAt.toISOString(),
    items: o.items.map((it) => ({ id: it.id, productId: it.productId, productName: it.productName, sku: it.sku, hsn: it.hsn, uom: it.uom, qty: n(it.qty), rate: n(it.rate), taxPct: it.taxPct == null ? null : n(it.taxPct), taxAmount: n(it.taxAmount), discPct: it.discPct == null ? null : n(it.discPct), discAmount: n(it.discAmount), lineValue: n(it.lineValue), expectedDate: it.expectedDate, receivedQty: n(it.receivedQty), remarks: it.remarks })),
    attachments: o.attachments.map((a) => ({ id: a.id, docType: a.docType, fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType, size: a.size })),
  };
  return NextResponse.json({ ok: true, data });
}

// PATCH /api/purchase/order/[id] — edit a Draft order (full replace of header + lines).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const r = await load(req, Number(params.id));
  if ("err" in r) return r.err;
  const { user, order } = r;
  if (order.status !== "Draft") return NextResponse.json({ ok: false, message: "Only draft orders can be edited." }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = PurchaseOrderCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;
  const built = buildPurchaseOrder(body);
  if ("error" in built) return NextResponse.json({ ok: false, message: built.error }, { status: 422 });

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: order.id } });
    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        poDate: body.poDate || order.poDate, supplierId: body.supplierId ?? null, supplier: built.supplier, supplierGstin: built.supplierGstin,
        supplierContact: body.supplierContact ?? null, supplierRef: body.supplierRef ?? null,
        quotationNo: body.quotationNo ?? null, quotationDate: body.quotationDate ?? null, buyer: body.buyer ?? null, purchaseType: built.purchaseType,
        expectedDeliveryDate: body.expectedDeliveryDate ?? null, warehouse: body.warehouse ?? null, deliveryAddress: body.deliveryAddress ?? null, shippingMode: body.shippingMode ?? null, freightPaidBy: body.freightPaidBy ?? null,
        paymentTerms: body.paymentTerms ?? null, creditDays: body.creditDays ?? null, dueDate: body.dueDate ?? null, currency: body.currency || "INR",
        gstApplicable: body.gstApplicable !== false, reverseCharge: body.reverseCharge === true, interState: body.interState === true,
        taxableAmount: built.taxableAmount, cgst: built.cgst, sgst: built.sgst, igst: built.igst, cess: built.cess, gstAmount: built.gstAmount,
        additionalDiscount: built.additionalDiscount, freight: built.freight, loading: built.loading, packing: built.packing, insurance: built.insurance, otherCharges: built.otherCharges, roundOff: built.roundOff,
        totalOrderValue: built.totalOrderValue, netAmount: built.netAmount, itemCount: built.itemCount,
        remarks: body.remarks ?? null, internalNotes: body.internalNotes ?? null, termsConditions: body.termsConditions ?? null,
        items: { create: built.items },
      },
    });
  });
  await writeAudit(prisma, user, { action: "purchase_order.update", entity: "PurchaseOrder", entityId: order.id, summary: `Edited purchase order ${order.poNo}`, businessId: order.businessId ?? null, branchId: order.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Purchase order updated.", id: order.id });
}

// DELETE /api/purchase/order/[id] — delete a Draft order.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const r = await load(req, Number(params.id));
  if ("err" in r) return r.err;
  const { user, order } = r;
  if (order.status !== "Draft") return NextResponse.json({ ok: false, message: "Only draft orders can be deleted. Cancel issued orders instead." }, { status: 422 });
  await prisma.purchaseOrder.delete({ where: { id: order.id } });
  await writeAudit(prisma, user, { action: "purchase_order.delete", entity: "PurchaseOrder", entityId: order.id, summary: `Deleted draft purchase order ${order.poNo}`, businessId: order.businessId ?? null, branchId: order.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Draft purchase order deleted." });
}
