import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

const PERM = "transport";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const DISPATCH_CLOSED = ["Completed", "Cancelled"];

/**
 * GET /api/transport/dashboard/kpis — Phase 1 KPI tiles for the Transport &
 * Vehicle Operations dashboard, all scoped via scopeWhere.
 *
 * Transport Cost date-basis: TransportCost has no dispatch-date column of its
 * own and dispatchExecutionId is NOT NULL, so "today's transport cost" is
 * computed by joining to DispatchExecution.docDate = today (the cost belongs
 * to the dispatch it was incurred for) rather than TransportCost.createdAt —
 * a cost entered a day late for yesterday's dispatch should still count
 * against that dispatch's day, not the data-entry day.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const sw = scopeWhere(scope, { branch: true });
  const today = new Date().toISOString().slice(0, 10); // server local date, YYYY-MM-DD
  const startOfDay = new Date(`${today}T00:00:00`);
  const endOfDay = new Date(`${today}T23:59:59.999`);

  const [
    todaysDispatch,
    pendingDispatch,
    completedDispatchToday,
    vehicleInsideFactory,
    waitingVehicles,
    loadingVehicles,
    pendingGateExit,
    todaysWeightAgg,
    todaysDcCount,
    todaysInvoiceCount,
    todaysDispatchIdsForCost,
  ] = await Promise.all([
    prisma.dispatchExecution.count({ where: { ...sw, docDate: today } }),
    prisma.dispatchExecution.count({ where: { ...sw, status: { notIn: DISPATCH_CLOSED } } }),
    prisma.dispatchExecution.count({ where: { ...sw, status: "Completed", docDate: today } }),
    prisma.vehicleGateEntry.count({ where: { ...sw, status: "Inside Factory" } }),
    prisma.vehicleGateEntry.count({ where: { ...sw, status: "Waiting" } }),
    prisma.vehicleGateEntry.count({ where: { ...sw, status: "Loading" } }),
    prisma.vehicleGateEntry.count({ where: { ...sw, status: "Completed" } }),
    prisma.postLoadingWeighment.aggregate({ where: { tenantId: scope.tenantId, weighDate: today }, _sum: { netWeight: true } }),
    prisma.deliveryChallan.count({ where: { ...sw, dcDate: today } }),
    prisma.sale.count({ where: { ...sw, channel: "B2B", status: "Completed", saleDate: today } }),
    prisma.dispatchExecution.findMany({ where: { ...sw, docDate: today }, select: { id: true } }),
  ]);

  const dispatchIds = todaysDispatchIdsForCost.map((d) => d.id);
  const transportCostAgg = dispatchIds.length
    ? await prisma.transportCost.aggregate({ where: { tenantId: scope.tenantId, dispatchExecutionId: { in: dispatchIds } }, _sum: { totalCost: true } })
    : { _sum: { totalCost: null } };

  return NextResponse.json({
    ok: true,
    kpis: {
      todaysDispatch,
      pendingDispatch,
      completedDispatchToday,
      vehicleInsideFactory,
      waitingVehicles,
      loadingVehicles,
      pendingGateExit,
      todaysWeight: num(todaysWeightAgg._sum.netWeight),
      todaysDc: todaysDcCount,
      todaysInvoice: todaysInvoiceCount,
      transportCost: num(transportCostAgg._sum.totalCost),
    },
    asOf: { date: today, startOfDay: startOfDay.toISOString(), endOfDay: endOfDay.toISOString() },
  });
}
