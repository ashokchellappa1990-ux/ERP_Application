import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";
import { getPurchaseInvoiceConfig } from "@/lib/purchase/purchaseInvoiceConfig";
import { postExistingPurchaseInvoiceTx } from "@/lib/purchase/createPurchaseInvoice";

// POST /api/purchase/invoice/[id]/approve — approve a Pending invoice and post it.
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
  if (inv.status !== "Pending Approval") return NextResponse.json({ ok: false, message: "Only a pending invoice can be approved." }, { status: 422 });

  const cfg = await getPurchaseInvoiceConfig(user);
  try {
    await prisma.$transaction(async (tx) => {
      await postExistingPurchaseInvoiceTx(tx, user.tenantId, id, user.id, cfg, body.note || null);
      await writeAudit(tx, user, { action: "purchase_invoice.approve", entity: "PurchaseInvoice", entityId: id, summary: `Approved & posted purchase invoice ${inv.invoiceNo}`, meta: { note: body.note || null }, businessId: inv.businessId, branchId: inv.branchId, ip: requestMeta(req).ip });
    });
    return NextResponse.json({ ok: true, message: "Invoice approved & posted." });
  } catch (err) {
    console.error("[purchase-invoice] approve error", err);
    return NextResponse.json({ ok: false, message: "Could not approve the invoice." }, { status: 500 });
  }
}
