import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { SalesExchangeDetail } from "@/lib/contracts/salesExchange";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/sales/exchanges/[id] — one exchange with both item sides + linked legs.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.exchange");
  if (denied) return denied;

  const ex = await prisma.salesExchange.findFirst({
    where: { id: Number(params.id), tenantId: user.tenantId },
    include: { items: { orderBy: [{ side: "asc" }, { id: "asc" }] } },
  });
  if (!ex) return NextResponse.json({ ok: false, message: "Sales exchange not found." }, { status: 404 });

  const data: SalesExchangeDetail = {
    id: ex.id, exchangeNo: ex.exchangeNo, exchangeDate: ex.exchangeDate, status: ex.status,
    invoiceNo: ex.invoiceNo ?? "", originalSaleId: ex.originalSaleId, channel: ex.channel,
    customerName: ex.customerName ?? "", customerPhone: ex.customerPhone ?? "",
    returnId: ex.returnId, newSaleId: ex.newSaleId,
    returnValue: num(ex.returnValue), newSaleValue: num(ex.newSaleValue), priceDifference: num(ex.priceDifference),
    settlementType: ex.settlementType, settlementMode: ex.settlementMode ?? "", settlementRef: ex.settlementRef ?? "",
    reason: ex.reason ?? "", remarks: ex.remarks ?? "",
    approvedBy: ex.approvedBy, approvedAt: ex.approvedAt ? ex.approvedAt.toISOString() : null, approvalNote: ex.approvalNote ?? "",
    itemCount: ex.itemCount, createdAt: ex.createdAt.toISOString(),
    items: ex.items.map((l) => ({
      id: l.id, side: l.side, productName: l.productName, sku: l.sku ?? "", qty: num(l.qty), rate: num(l.rate),
      taxPct: num(l.taxPct), taxAmount: num(l.taxAmount), value: num(l.value), reason: l.reason ?? "", inventoryHandling: l.inventoryHandling ?? "",
      batchNo: l.batchNo ?? "", mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "",
    })),
  };
  return NextResponse.json({ ok: true, data });
}
