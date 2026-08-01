import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { DispatchExecutionDetail } from "@/lib/contracts/transport";

const PERM = "transport";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/transport/dispatch-execution/[id] — full detail with items.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "DispatchExecution" });
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const e = await prisma.dispatchExecution.findFirst({ where: { ...sw, id: Number(params.id), deletedAt: null }, include: { items: { orderBy: { id: "asc" } } } });
  if (!e) return NextResponse.json({ ok: false, message: "Dispatch execution not found." }, { status: 404 });

  const data: DispatchExecutionDetail = {
    id: e.id, docNo: e.docNo, docType: e.docType, docDate: e.docDate,
    dispatchPlanningId: e.dispatchPlanningId, sourceRefType: e.sourceRefType, sourceRefId: e.sourceRefId, sourceRefNo: e.sourceRefNo,
    partyType: e.partyType, partyId: e.partyId, partyName: e.partyName, deliveryAddress: e.deliveryAddress,
    warehouse: e.warehouse, transportCompanyId: e.transportCompanyId, vehicleId: e.vehicleId, driverId: e.driverId,
    status: e.status, isPartial: e.isPartial, totalQty: num(e.totalQty), totalValue: num(e.totalValue), remarks: e.remarks,
    completedAt: e.completedAt?.toISOString() ?? null, cancelledAt: e.cancelledAt?.toISOString() ?? null, cancelReason: e.cancelReason,
    createdByName: e.createdByName, createdAt: e.createdAt.toISOString(),
    items: e.items.map((it) => ({
      id: it.id, productId: it.productId, productName: it.productName, sku: it.sku, uom: it.uom,
      batchNo: it.batchNo, mfgDate: it.mfgDate, expiryDate: it.expiryDate,
      orderedQty: num(it.orderedQty), dispatchedQty: num(it.dispatchedQty), rate: it.rate == null ? null : num(it.rate), value: num(it.value),
      qrCode: it.qrCode, remarks: it.remarks,
    })),
  };
  return NextResponse.json({ ok: true, data });
}
