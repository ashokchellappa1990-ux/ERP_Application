import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

const PERM = "transport.movement-history";

/** GET /api/transport/movement-history — read-only vehicle event trail (scoped). */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleId = Number(url.searchParams.get("vehicleId")) || 0;
  const dispatchExecutionId = Number(url.searchParams.get("dispatchExecutionId")) || 0;
  const gateEntryId = Number(url.searchParams.get("gateEntryId")) || 0;
  const eventType = (url.searchParams.get("eventType") ?? "").trim();
  const dateFrom = (url.searchParams.get("dateFrom") ?? "").trim();
  const dateTo = (url.searchParams.get("dateTo") ?? "").trim();
  const take = Math.min(Number(url.searchParams.get("take")) || 200, 500);

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.VehicleMovementHistoryWhereInput = { ...sw };
  if (vehicleId) where.vehicleId = vehicleId;
  if (dispatchExecutionId) where.dispatchExecutionId = dispatchExecutionId;
  if (gateEntryId) where.gateEntryId = gateEntryId;
  if (eventType) where.eventType = eventType;
  if (dateFrom || dateTo) {
    where.eventAt = {};
    if (dateFrom) where.eventAt.gte = new Date(`${dateFrom}T00:00:00`);
    if (dateTo) where.eventAt.lte = new Date(`${dateTo}T23:59:59.999`);
  }

  const rows = await prisma.vehicleMovementHistory.findMany({ where, orderBy: { eventAt: "desc" }, take });

  // Enrich with vehicle no, dispatch execution doc no, gate entry no via separate lookups.
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId).filter(Boolean)));
  const execIds = Array.from(new Set(rows.map((r) => r.dispatchExecutionId).filter((x): x is number => !!x)));
  const gateIds = Array.from(new Set(rows.map((r) => r.gateEntryId).filter((x): x is number => !!x)));

  const [vehicles, execs, gates] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : Promise.resolve([]),
    execIds.length ? prisma.dispatchExecution.findMany({ where: { id: { in: execIds } }, select: { id: true, docNo: true } }) : Promise.resolve([]),
    gateIds.length ? prisma.vehicleGateEntry.findMany({ where: { id: { in: gateIds } }, select: { id: true, gateEntryNo: true } }) : Promise.resolve([]),
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const eMap = new Map(execs.map((e) => [e.id, e.docNo]));
  const gMap = new Map(gates.map((g) => [g.id, g.gateEntryNo]));

  const shaped = rows.map((r) => ({
    id: r.id,
    vehicleId: r.vehicleId,
    vehicleNo: vMap.get(r.vehicleId) ?? "",
    dispatchExecutionId: r.dispatchExecutionId,
    dispatchDocNo: r.dispatchExecutionId ? eMap.get(r.dispatchExecutionId) ?? "" : "",
    gateEntryId: r.gateEntryId,
    gateEntryNo: r.gateEntryId ? gMap.get(r.gateEntryId) ?? "" : "",
    eventType: r.eventType,
    eventAt: r.eventAt.toISOString(),
    actorName: r.actorName ?? "",
    remarks: r.remarks ?? "",
  }));

  return NextResponse.json({ ok: true, rows: shaped });
}
