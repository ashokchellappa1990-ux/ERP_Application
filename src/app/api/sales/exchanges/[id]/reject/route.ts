import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";

// POST /api/sales/exchanges/[id]/reject — reject a Pending exchange (no posting).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const id = Number(params.id);
  let body: { note?: string } = {};
  try { body = await req.json(); } catch { /* note optional */ }

  const ex = await prisma.salesExchange.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, status: true, exchangeNo: true, businessId: true, branchId: true } });
  if (!ex) return NextResponse.json({ ok: false, message: "Sales exchange not found." }, { status: 404 });
  const denied = await requirePermission(user, "sales.exchange", { req, entity: "SalesExchange", entityId: id, businessId: ex.businessId, branchId: ex.branchId });
  if (denied) return denied;
  if (ex.status !== "Pending") return NextResponse.json({ ok: false, message: "Only a pending exchange can be rejected." }, { status: 422 });

  await prisma.$transaction(async (tx) => {
    await tx.salesExchange.update({ where: { id }, data: { status: "Rejected", approvedBy: user.id, approvedAt: new Date(), approvalNote: body.note || null } });
    await writeAudit(tx, user, {
      action: "sales_exchange.reject", entity: "SalesExchange", entityId: id,
      summary: `Rejected exchange ${ex.exchangeNo}`, meta: { note: body.note || null },
      businessId: ex.businessId, branchId: ex.branchId, ip: requestMeta(req).ip,
    });
  });
  return NextResponse.json({ ok: true, message: "Exchange rejected." });
}
