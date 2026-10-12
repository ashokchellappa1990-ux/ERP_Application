import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/sales/collection/[id] — a collection with allocations + business (for the receipt).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.collections");
  if (denied) return denied;

  const col = await prisma.customerCollection.findFirst({
    where: { id: Number(params.id), tenantId: user.tenantId },
    include: { allocations: { orderBy: { id: "asc" } } },
  });
  if (!col) return NextResponse.json({ ok: false, message: "Collection not found." }, { status: 404 });

  const setup = await prisma.companySetup.findFirst({
    where: { tenantId: user.tenantId, NOT: { companyName: null } },
    orderBy: { updatedAt: "desc" },
    select: { companyName: true, companyPhone: true, gstNumber: true },
  });
  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } });
  const tpl = (await prisma.invoiceTemplate.findUnique({ where: { tenantId_type: { tenantId: user.tenantId, type: "COLLECTION" } } })) ?? (await prisma.invoiceTemplate.create({ data: { tenantId: user.tenantId, type: "COLLECTION", title: "Collection Receipt" } }));

  return NextResponse.json({
    ok: true,
    business: { name: setup?.companyName || tenant?.name || "My Store", phone: setup?.companyPhone || "", gstin: setup?.gstNumber || "" },
    template: { title: tpl.title, headerNote: tpl.headerNote ?? "", thankYouMessage: tpl.thankYouMessage, footerNote: tpl.footerNote ?? "", showGstin: tpl.showGstin, showCustomer: tpl.showCustomer },
    collection: {
      id: col.id, collectionNo: col.collectionNo, customerName: col.customerName ?? "", collectionDate: col.collectionDate,
      mode: col.mode, reference: col.reference ?? "", totalAmount: num(col.totalAmount), notes: col.notes ?? "", status: col.status,
      attachments: (col.attachments as Array<{ fileName: string; fileUrl: string; fileType: string; size: number }> | null) ?? [],
      payments: (col.payments as Array<{ mode: string; amount: number; reference: string | null }> | null) ?? [],
      allocations: col.allocations.map((a) => ({ saleId: a.saleId, invoiceNo: a.invoiceNo ?? "", amount: num(a.amount) })),
    },
  });
}
