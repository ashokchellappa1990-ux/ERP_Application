import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";
import { reversePurchaseInvoiceTx } from "@/lib/purchase/createPurchaseInvoice";

// POST /api/purchase/invoice/[id]/cancel — cancel an invoice: reverse the delta
// journal, drop its payable, restore the GRN payable(s) + invoice flags.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const id = Number(params.id);
  let body: { note?: string } = {};
  try { body = await req.json(); } catch { /* note optional */ }

  const inv = await prisma.purchaseInvoice.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, status: true, invoiceNo: true, businessId: true, branchId: true } });
  if (!inv) return NextResponse.json({ ok: false, message: "Purchase invoice not found." }, { status: 404 });
  const denied = await requirePermission(user, "purchase.invoice", { req, entity: "PurchaseInvoice", entityId: id, businessId: inv.businessId, branchId: inv.branchId });
  if (denied) return denied;
  if (inv.status === "Cancelled") return NextResponse.json({ ok: false, message: "Invoice is already cancelled." }, { status: 422 });

  // Block cancel if a payment has already been allocated against it.
  const payable = await prisma.payable.findFirst({ where: { tenantId: user.tenantId, sourceType: "PURCHASE_INVOICE", sourceId: id }, select: { paidAmount: true } });
  if (payable && Number(payable.paidAmount) > 0.005) return NextResponse.json({ ok: false, message: "Cannot cancel — a supplier payment is already allocated to this invoice." }, { status: 422 });

  try {
    await prisma.$transaction(async (tx) => {
      await reversePurchaseInvoiceTx(tx, user.tenantId, id, user.id);
      await writeAudit(tx, user, { action: "purchase_invoice.cancel", entity: "PurchaseInvoice", entityId: id, summary: `Cancelled purchase invoice ${inv.invoiceNo}`, meta: { note: body.note || null }, businessId: inv.businessId, branchId: inv.branchId, ip: requestMeta(req).ip });
    });
    return NextResponse.json({ ok: true, message: "Purchase invoice cancelled." });
  } catch (err) {
    console.error("[purchase-invoice] cancel error", err);
    return NextResponse.json({ ok: false, message: "Could not cancel the invoice." }, { status: 500 });
  }
}
