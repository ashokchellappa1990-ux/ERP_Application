import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { postPurchaseReturn } from "@/lib/purchase/postReturn";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";

// POST /api/purchase/returns/[id]/approve — approve a Pending Approval return and post it.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const id = Number(params.id);
  let body: { note?: string } = {};
  try { body = await req.json(); } catch { /* note optional */ }

  const ret = await prisma.purchaseReturn.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, status: true, returnNo: true, returnAmount: true, purchaseType: true, businessId: true, branchId: true } });
  if (!ret) return NextResponse.json({ ok: false, message: "Purchase return not found." }, { status: 404 });
  const denied = await requirePermission(user, "purchase.return", { req, entity: "PurchaseReturn", entityId: id, businessId: ret.businessId, branchId: ret.branchId });
  if (denied) return denied;
  if (ret.status !== "Pending Approval") return NextResponse.json({ ok: false, message: "Only a pending return can be approved." }, { status: 422 });

  try {
    await prisma.$transaction(async (tx) => {
      await postPurchaseReturn(tx, id, user.id);
      await tx.purchaseReturn.update({ where: { id }, data: { status: "Approved", approvedBy: user.id, approvedAt: new Date(), approvalNote: body.note || null } });
      await writeAudit(tx, user, {
        action: "purchase_return.approve", entity: "PurchaseReturn", entityId: id,
        summary: `Approved purchase return ${ret.returnNo} — ${ret.purchaseType} ${Number(ret.returnAmount).toFixed(2)}`,
        meta: { note: body.note || null, returnAmount: Number(ret.returnAmount), purchaseType: ret.purchaseType },
        businessId: ret.businessId, branchId: ret.branchId, ip: requestMeta(req).ip,
      });
    });
    return NextResponse.json({ ok: true, message: "Purchase return approved & posted." });
  } catch (err) {
    console.error("[purchase-return] approve error", err);
    return NextResponse.json({ ok: false, message: "Could not approve the return." }, { status: 500 });
  }
}
