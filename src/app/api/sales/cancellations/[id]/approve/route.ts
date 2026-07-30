import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { postSalesCancellation } from "@/lib/sales/postCancellation";
import { getCancellationConfig } from "@/lib/sales/cancellationConfig";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";

// POST /api/sales/cancellations/[id]/approve — approve a Pending cancellation and post it.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const id = Number(params.id);
  let body: { note?: string } = {};
  try { body = await req.json(); } catch { /* note optional */ }

  const c = await prisma.salesCancellation.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, status: true, cancellationNo: true, invoiceAmount: true, businessId: true, branchId: true } });
  if (!c) return NextResponse.json({ ok: false, message: "Sales cancellation not found." }, { status: 404 });
  const denied = await requirePermission(user, "sales.cancellation", { req, entity: "SalesCancellation", entityId: id, businessId: c.businessId, branchId: c.branchId });
  if (denied) return denied;
  if (c.status !== "Pending Approval") return NextResponse.json({ ok: false, message: "Only a pending cancellation can be approved." }, { status: 422 });

  const cfg = await getCancellationConfig(user);
  try {
    await prisma.$transaction(async (tx) => {
      await postSalesCancellation(tx, id, cfg, user.id);
      await tx.salesCancellation.update({ where: { id }, data: { status: "Approved", approvedBy: user.id, approvedAt: new Date(), approvalNote: body.note || null } });
      await writeAudit(tx, user, {
        action: "sales_cancellation.approve", entity: "SalesCancellation", entityId: id,
        summary: `Approved cancellation ${c.cancellationNo} — ${Number(c.invoiceAmount).toFixed(2)}`,
        meta: { note: body.note || null, invoiceAmount: Number(c.invoiceAmount) }, businessId: c.businessId, branchId: c.branchId, ip: requestMeta(req).ip,
      });
    });
    return NextResponse.json({ ok: true, message: "Cancellation approved & posted." });
  } catch (err) {
    console.error("[sales-cancellation] approve error", err);
    return NextResponse.json({ ok: false, message: "Could not approve the cancellation." }, { status: 500 });
  }
}
