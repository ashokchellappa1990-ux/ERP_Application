import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";

// POST /api/sales/cancellations/[id]/reject — reject a Pending cancellation (no posting).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const id = Number(params.id);
  let body: { note?: string } = {};
  try { body = await req.json(); } catch { /* note optional */ }

  const c = await prisma.salesCancellation.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, status: true, cancellationNo: true, businessId: true, branchId: true } });
  if (!c) return NextResponse.json({ ok: false, message: "Sales cancellation not found." }, { status: 404 });
  const denied = await requirePermission(user, "sales.cancellation", { req, entity: "SalesCancellation", entityId: id, businessId: c.businessId, branchId: c.branchId });
  if (denied) return denied;
  if (c.status !== "Pending Approval") return NextResponse.json({ ok: false, message: "Only a pending cancellation can be rejected." }, { status: 422 });

  await prisma.salesCancellation.update({ where: { id }, data: { status: "Rejected", approvedBy: user.id, approvedAt: new Date(), approvalNote: body.note || null } });
  await writeAudit(prisma, user, { action: "sales_cancellation.reject", entity: "SalesCancellation", entityId: id, summary: `Rejected cancellation ${c.cancellationNo}`, meta: { note: body.note || null }, businessId: c.businessId, branchId: c.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Cancellation rejected." });
}
