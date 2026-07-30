import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/purchase/supplier-payment/open?supplier=NAME — open payables for a
// supplier (balance > 0), to allocate a payment against.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const supplier = (new URL(req.url).searchParams.get("supplier") ?? "").trim();
  if (!supplier) return NextResponse.json({ ok: true, rows: [] });

  const rows = await prisma.payable.findMany({
    where: { tenantId: user.tenantId, supplier, status: { not: "Paid" }, balanceAmount: { gt: 0 } },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });

  const today = new Date().toISOString().slice(0, 10);
  return NextResponse.json({
    ok: true,
    rows: rows.map((p) => ({
      payableId: p.id, sourceType: p.sourceType, sourceId: p.sourceId, refNo: p.refNo ?? "",
      docDate: p.docDate ?? "", dueDate: p.dueDate ?? "", paymentTerms: p.paymentTerms ?? "",
      totalAmount: num(p.totalAmount), paidAmount: num(p.paidAmount), balanceAmount: num(p.balanceAmount),
      status: p.status, overdue: !!(p.dueDate && p.dueDate < today),
    })),
  });
}
