import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { MovementHistoryRow } from "@/lib/contracts/tyre";

const PERM = "transport.tyre";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const tyreId = url.searchParams.get("tyreId");
  const vehicleId = url.searchParams.get("vehicleId");
  if (!tyreId && !vehicleId) return NextResponse.json({ ok: false, message: "tyreId or vehicleId is required." }, { status: 422 });

  const scope = await getActiveScope(user);
  const where: Prisma.TyreMovementHistoryWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (tyreId) where.tyreId = Number(tyreId);
  if (vehicleId) where.vehicleId = Number(vehicleId);

  const rows = await prisma.tyreMovementHistory.findMany({ where, orderBy: [{ eventAt: "desc" }, { id: "desc" }], take: 500 });
  const tyreIds = Array.from(new Set(rows.map((r) => r.tyreId)));
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId).filter((x): x is number => x != null)));
  const [tyres, vehicles] = await Promise.all([
    tyreIds.length ? prisma.tyreMaster.findMany({ where: { id: { in: tyreIds } }, select: { id: true, tyreCode: true } }) : [],
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
  ]);
  const tMap = new Map(tyres.map((t) => [t.id, t.tyreCode]));
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));

  const list: MovementHistoryRow[] = rows.map((r) => ({
    id: r.id, tyreId: r.tyreId, tyreCode: tMap.get(r.tyreId) ?? "—", vehicleId: r.vehicleId, vehicleNo: r.vehicleId != null ? vMap.get(r.vehicleId) ?? null : null,
    eventType: r.eventType, eventAt: r.eventAt.toISOString(), positionCode: r.positionCode, odometer: num(r.odometer), cost: num(r.cost),
    actorName: r.actorName, remarks: r.remarks,
  }));
  return NextResponse.json({ ok: true, rows: list });
}
