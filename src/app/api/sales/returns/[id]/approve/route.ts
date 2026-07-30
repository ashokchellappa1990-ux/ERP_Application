import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { postSalesReturn } from "@/lib/sales/postReturn";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";

// POST /api/sales/returns/[id]/approve — approve a Pending return and post it.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const id = Number(params.id);
  let body: { note?: string } = {};
  try { body = await req.json(); } catch { /* note optional */ }

  const ret = await prisma.salesReturn.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, status: true, returnNo: true, refundAmount: true, businessId: true, branchId: true } });
  if (!ret) return NextResponse.json({ ok: false, message: "Sales return not found." }, { status: 404 });
  const denied = await requirePermission(user, "sales.return", { req, entity: "SalesReturn", entityId: id, businessId: ret.businessId, branchId: ret.branchId });
  if (denied) return denied;
  if (ret.status !== "Pending") return NextResponse.json({ ok: false, message: "Only a pending return can be approved." }, { status: 422 });

  try {
    await prisma.$transaction(async (tx) => {
      await postSalesReturn(tx, id, user.id);
      await tx.salesReturn.update({ where: { id }, data: { status: "Completed", approvedBy: user.id, approvedAt: new Date(), approvalNote: body.note || null } });
      // Atomic with the approval: trail rolls back too if posting fails.
      await writeAudit(tx, user, {
        action: "sales_return.approve", entity: "SalesReturn", entityId: id,
        summary: `Approved return ${ret.returnNo} — refund ${Number(ret.refundAmount).toFixed(2)}`,
        meta: { note: body.note || null, refundAmount: Number(ret.refundAmount) },
        businessId: ret.businessId, branchId: ret.branchId, ip: requestMeta(req).ip,
      });
    });
    return NextResponse.json({ ok: true, message: "Return approved & posted." });
  } catch (err) {
    console.error("[sales-return] approve error", err);
    return NextResponse.json({ ok: false, message: "Could not approve the return." }, { status: 500 });
  }
}
