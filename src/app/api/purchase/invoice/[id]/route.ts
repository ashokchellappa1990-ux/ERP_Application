import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { PurchaseInvoiceEditSchema, type PurchaseInvoiceDetail } from "@/lib/contracts/purchaseInvoice";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

// GET /api/purchase/invoice/[id] — full detail incl. items, attachments, GRN map,
// the linked payable, and BOTH the GRN purchase voucher(s) + invoice adjustment.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "purchase.invoice");
  if (denied) return denied;

  const inv = await prisma.purchaseInvoice.findFirst({
    where: { id: Number(params.id), tenantId: user.tenantId },
    include: { items: { orderBy: { id: "asc" } }, attachments: true, grnMap: true },
  });
  if (!inv) return NextResponse.json({ ok: false, message: "Purchase invoice not found." }, { status: 404 });

  const payable = await prisma.payable.findFirst({ where: { tenantId: user.tenantId, sourceType: "PURCHASE_INVOICE", sourceId: inv.id }, select: { paidAmount: true, balanceAmount: true } });

  // Accounting: GRN purchase voucher(s) + the invoice adjustment voucher.
  const grnIds = inv.grnMap.map((m) => m.grnId);
  const entries = await prisma.journalEntry.findMany({
    where: { tenantId: user.tenantId, OR: [{ sourceType: "PURCHASE_INVOICE", sourceId: inv.id }, ...(grnIds.length ? [{ sourceType: "GRN", sourceId: { in: grnIds } }] : [])] },
    include: { lines: { include: { account: { select: { code: true, name: true } } } } }, orderBy: { id: "asc" },
  });
  const vouchers = entries.map((e) => ({
    id: e.id, voucherNo: e.voucherNo, voucherType: e.voucherType, date: e.date, narration: e.narration ?? "", totalDebit: num(e.totalDebit),
    lines: e.lines.map((l) => ({ account: `${l.account.code} · ${l.account.name}`, debit: num(l.debit), credit: num(l.credit), narration: l.narration ?? "" })),
  }));

  const paymentStatus = inv.status !== "Posted" ? "—" : !payable ? "Fully Paid" : num(payable.balanceAmount) <= 0.01 ? "Fully Paid" : num(payable.paidAmount) > 0 ? "Partially Paid" : "Unpaid";

  const data: PurchaseInvoiceDetail = {
    id: inv.id, invoiceNo: inv.invoiceNo, status: inv.status, invoiceType: inv.invoiceType, grnRef: inv.grnRef ?? "",
    supplierInvoiceNo: inv.supplierInvoiceNo ?? "", supplierInvoiceDate: inv.supplierInvoiceDate ?? "", supplierBillNo: inv.supplierBillNo ?? "", supplierBillDate: inv.supplierBillDate ?? "",
    dueDate: inv.dueDate ?? "", paymentTerms: inv.paymentTerms ?? "", creditDays: inv.creditDays, currency: inv.currency, supplierRef: inv.supplierRef ?? "",
    supplier: inv.supplier ?? "", supplierGstin: inv.supplierGstin ?? "", poNo: inv.poNo ?? "", warehouse: inv.warehouse ?? "", purchaseType: inv.purchaseType,
    grnAmount: num(inv.grnAmount), additionalDiscount: num(inv.additionalDiscount), freight: num(inv.freight), loading: num(inv.loading), packing: num(inv.packing), insurance: num(inv.insurance), otherCharges: num(inv.otherCharges), roundOff: num(inv.roundOff),
    taxableAmount: num(inv.taxableAmount), cgst: num(inv.cgst), sgst: num(inv.sgst), igst: num(inv.igst), cess: num(inv.cess), gstAmount: num(inv.gstAmount), gstApplicable: inv.gstApplicable, reverseCharge: inv.reverseCharge,
    totalInvoiceAmount: num(inv.totalInvoiceAmount), netPayable: num(inv.netPayable),
    accountsPosted: inv.accountsPosted, journalRef: inv.journalRef ?? "", payableId: inv.payableId,
    approvedBy: inv.approvedBy, approvedAt: inv.approvedAt ? inv.approvedAt.toISOString() : null, approvalNote: inv.approvalNote ?? "",
    remarks: inv.remarks ?? "", internalNotes: inv.internalNotes ?? "", itemCount: inv.itemCount, createdAt: inv.createdAt.toISOString(),
    grnNos: inv.grnMap.map((m) => m.grnNo).join(", "),
    paymentStatus, paidAmount: payable ? num(payable.paidAmount) : 0, balanceAmount: payable ? num(payable.balanceAmount) : (inv.status === "Posted" ? 0 : num(inv.netPayable)),
    items: inv.items.map((l) => ({ id: l.id, productName: l.productName, sku: l.sku ?? "", batchNo: l.batchNo ?? "", expiryDate: l.expiryDate ?? "", qty: num(l.qty), unitPrice: num(l.unitPrice), taxPct: num(l.taxPct), taxAmount: num(l.taxAmount), discAmount: num(l.discAmount), lineValue: num(l.lineValue) })),
    attachments: inv.attachments.map((a) => ({ id: a.id, docType: a.docType, fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType ?? "", size: a.size })),
    grns: inv.grnMap.map((m) => ({ grnId: m.grnId, grnNo: m.grnNo, grnAmount: num(m.grnAmount) })),
    vouchers,
  };
  return NextResponse.json({ ok: true, data });
}

// PATCH /api/purchase/invoice/[id] — edit header fields before posting (Draft / Pending Approval).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const inv = await prisma.purchaseInvoice.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, status: true, businessId: true, branchId: true, freight: true, loading: true, packing: true, insurance: true, otherCharges: true, additionalDiscount: true, roundOff: true, grnAmount: true } });
  if (!inv) return NextResponse.json({ ok: false, message: "Purchase invoice not found." }, { status: 404 });
  const denied = await requirePermission(user, "purchase.invoice", { req, entity: "PurchaseInvoice", entityId: id, businessId: inv.businessId, branchId: inv.branchId });
  if (denied) return denied;
  if (inv.status !== "Draft" && inv.status !== "Pending Approval") return NextResponse.json({ ok: false, message: "Only an unposted invoice can be edited." }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = PurchaseInvoiceEditSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const pick = (cur: unknown, v: unknown) => (v === undefined ? num(cur) : r2(num(v)));
  const freight = pick(inv.freight, b.freight), loading = pick(inv.loading, b.loading), packing = pick(inv.packing, b.packing), insurance = pick(inv.insurance, b.insurance), otherCharges = pick(inv.otherCharges, b.otherCharges), additionalDiscount = pick(inv.additionalDiscount, b.additionalDiscount), roundOff = pick(inv.roundOff, b.roundOff);
  const totalInvoiceAmount = r2(num(inv.grnAmount) + freight + loading + packing + insurance + otherCharges - additionalDiscount + roundOff);

  await prisma.purchaseInvoice.update({
    where: { id }, data: {
      supplierInvoiceNo: b.supplierInvoiceNo, supplierInvoiceDate: b.supplierInvoiceDate, supplierBillNo: b.supplierBillNo, supplierBillDate: b.supplierBillDate,
      dueDate: b.dueDate, paymentTerms: b.paymentTerms, creditDays: b.creditDays, currency: b.currency, supplierRef: b.supplierRef, purchaseType: b.purchaseType,
      freight, loading, packing, insurance, otherCharges, additionalDiscount, roundOff, totalInvoiceAmount, netPayable: totalInvoiceAmount,
      gstApplicable: b.gstApplicable, reverseCharge: b.reverseCharge, remarks: b.remarks, internalNotes: b.internalNotes,
    },
  });
  await writeAudit(prisma, user, { action: "purchase_invoice.update", entity: "PurchaseInvoice", entityId: id, summary: `Edited purchase invoice ${id}`, businessId: inv.businessId, branchId: inv.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Purchase invoice updated." });
}
