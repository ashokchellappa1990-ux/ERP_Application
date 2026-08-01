import { prisma } from "@/lib/db/prisma";
import type { ScopeFilter } from "@/lib/auth/scope";

const num = (v: unknown) => (v == null ? 0 : Number(v));

/** DC + its linked dispatch execution + items, read live (no separate DC-line table). */
export async function loadDeliveryChallanDetail(id: number, sw: ScopeFilter) {
  const dc = await prisma.deliveryChallan.findFirst({ where: { id, ...sw } });
  if (!dc) return null;
  // Superseded by Load & Dispatch (src/lib/transport/loadDispatch.ts) — this
  // legacy path only applies to DCs from the old (now unrouted) Dispatch
  // Execution screen, which is why dispatchExecutionId is nullable now.
  const execution = dc.dispatchExecutionId
    ? await prisma.dispatchExecution.findUnique({ where: { id: dc.dispatchExecutionId }, include: { items: true } })
    : null;
  return {
    id: dc.id, dcNo: dc.dcNo, dcDate: dc.dcDate, dispatchExecutionId: dc.dispatchExecutionId,
    customerId: dc.customerId, customerName: dc.customerName ?? "", deliveryAddress: dc.deliveryAddress ?? "",
    totalQty: num(dc.totalQty), totalValue: num(dc.totalValue), status: dc.status, printedCount: dc.printedCount,
    generatedAt: dc.generatedAt ? dc.generatedAt.toISOString() : null,
    cancelledAt: dc.cancelledAt ? dc.cancelledAt.toISOString() : null,
    remarks: dc.remarks ?? "",
    createdAt: dc.createdAt.toISOString(),
    execution: execution ? {
      id: execution.id, docNo: execution.docNo, docType: execution.docType, docDate: execution.docDate,
      warehouse: execution.warehouse ?? "", vehicleId: execution.vehicleId, driverId: execution.driverId,
    } : null,
    items: (execution?.items ?? []).map((it) => ({
      id: it.id, productName: it.productName, sku: it.sku ?? "", uom: it.uom ?? "", batchNo: it.batchNo ?? "",
      dispatchedQty: num(it.dispatchedQty), rate: num(it.rate), value: num(it.value),
    })),
  };
}

export type DeliveryChallanDetail = NonNullable<Awaited<ReturnType<typeof loadDeliveryChallanDetail>>>;
