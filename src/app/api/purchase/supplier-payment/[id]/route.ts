import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/purchase/supplier-payment/[id] — a supplier payment with its allocations.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const pay = await prisma.supplierPayment.findFirst({
    where: { id: Number(params.id), tenantId: user.tenantId },
    include: { allocations: { orderBy: { id: "asc" } } },
  });
  if (!pay) return NextResponse.json({ ok: false, message: "Payment not found." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    payment: {
      id: pay.id, paymentNo: pay.paymentNo, supplier: pay.supplier ?? "", paymentDate: pay.paymentDate, mode: pay.mode,
      reference: pay.reference ?? "", totalAmount: num(pay.totalAmount), notes: pay.notes ?? "", status: pay.status, createdAt: pay.createdAt,
      allocations: pay.allocations.map((a) => ({ payableId: a.payableId, refNo: a.refNo ?? "", sourceType: a.sourceType ?? "", sourceId: a.sourceId, amount: num(a.amount) })),
    },
  });
}
