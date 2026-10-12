import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";

// POST /api/sales/returns/[id]/reject — reject a Pending return (no posting).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const id = Number(params.id);
  let body: { note?: string } = {};
  try { body = await req.json(); } catch { /* note optional */ }

  const ret = await prisma.salesReturn.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, status: true, returnNo: true, businessId: true, branchId: true } });
  if (!ret) return NextResponse.json({ ok: false, message: "Sales return not found." }, { status: 404 });
  const denied = await requirePermission(user, "sales.return", { req, entity: "SalesReturn", entityId: id, businessId: ret.businessId, branchId: ret.branchId });
  if (denied) return denied;
  if (ret.status !== "Pending") return NextResponse.json({ ok: false, message: "Only a pending return can be rejected." }, { status: 422 });

  await prisma.salesReturn.update({ where: { id }, data: { status: "Rejected", approvedBy: user.id, approvedAt: new Date(), approvalNote: body.note || null } });
  await writeAudit(prisma, user, {
    action: "sales_return.reject", entity: "SalesReturn", entityId: id,
    summary: `Rejected return ${ret.returnNo}`,
    meta: { note: body.note || null },
    businessId: ret.businessId, branchId: ret.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Return rejected." });
}
