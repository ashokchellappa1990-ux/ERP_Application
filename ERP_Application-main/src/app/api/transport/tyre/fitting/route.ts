import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { fittingInput, type FittingRow } from "@/lib/contracts/tyre";
import { getCurrentOdometer, resolveTyrePositionTemplate, logTyreMovement } from "@/lib/transport/tyre";

const PERM = "transport.tyre";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }
const FITTABLE_STATUS = "Available";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  const tyreId = url.searchParams.get("tyreId");
  const status = url.searchParams.get("status");

  const scope = await getActiveScope(user);
  const where: Prisma.TyreVehicleFittingWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (tyreId) where.tyreId = Number(tyreId);
  if (status && status !== "All") where.status = status;

  const rows = await prisma.tyreVehicleFitting.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const tyreIds = Array.from(new Set(rows.map((r) => r.tyreId)));
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const [tyres, vehicles] = await Promise.all([
    tyreIds.length ? prisma.tyreMaster.findMany({ where: { id: { in: tyreIds } }, select: { id: true, tyreCode: true } }) : [],
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
  ]);
  const tMap = new Map(tyres.map((t) => [t.id, t.tyreCode]));
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));

  const list: FittingRow[] = rows.map((r) => ({
    id: r.id, tyreId: r.tyreId, tyreCode: tMap.get(r.tyreId) ?? "—", vehicleId: r.vehicleId, vehicleNo: vMap.get(r.vehicleId) ?? "—", positionCode: r.positionCode,
    fittedAt: r.fittedAt.toISOString(), fittedOdometer: num(r.fittedOdometer),
    removedAt: r.removedAt?.toISOString() ?? null, removedOdometer: num(r.removedOdometer), removalReason: r.removalReason, runningKm: num(r.runningKm),
    status: r.status,
  }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreVehicleFitting" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = fittingInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const [tyre, vehicle] = await Promise.all([
    prisma.tyreMaster.findFirst({ where: { id: b.tyreId, tenantId: user.tenantId, deletedAt: null } }),
    prisma.vehicleMaster.findFirst({ where: { id: b.vehicleId, tenantId: user.tenantId, deletedAt: null } }),
  ]);
  if (!tyre) return NextResponse.json({ ok: false, message: "Tyre not found." }, { status: 422 });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 422 });

  // Rule: only Available tyres can be fitted — excludes Scrapped/Under Repair/
  // Under Retreading/Fitted/etc, and rule: a tyre can't be in two positions at once.
  if (tyre.status !== FITTABLE_STATUS) return NextResponse.json({ ok: false, message: `Tyre ${tyre.tyreCode} is ${tyre.status} and cannot be fitted.` }, { status: 422 });

  // Rule: position code must belong to the vehicle's resolved template.
  const resolved = await resolveTyrePositionTemplate(user.tenantId, b.vehicleId);
  if (resolved && !resolved.codes.some((c) => c.positionCode === b.positionCode)) {
    return NextResponse.json({ ok: false, message: `Position ${b.positionCode} is not valid for this vehicle's configuration.` }, { status: 422 });
  }

  // Rule: a vehicle position cannot have two active tyres.
  const occupied = await prisma.tyreVehicleFitting.findFirst({ where: { tenantId: user.tenantId, vehicleId: b.vehicleId, positionCode: b.positionCode, status: "Active" } });
  if (occupied) return NextResponse.json({ ok: false, message: `Position ${b.positionCode} on this vehicle is already occupied — remove the current tyre first.` }, { status: 422 });

  const odometer = await getCurrentOdometer(user.tenantId, b.vehicleId);
  const scope = await getActiveScope(user);
  const seg = await resolveWriteScope(user);

  const fitting = await prisma.$transaction(async (tx) => {
    const f = await tx.tyreVehicleFitting.create({
      data: {
        tenantId: user.tenantId, ...scopeData(scope, { branch: true }), businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        tyreId: b.tyreId, vehicleId: b.vehicleId, positionCode: b.positionCode,
        fittedAt: new Date(b.fittedAt), fittedOdometer: odometer, fittedBy: b.fittedBy ?? user.id, status: "Active", remarks: b.remarks ?? null,
      },
    });
    await tx.tyreMaster.update({ where: { id: b.tyreId }, data: { status: "Fitted", currentVehicleId: b.vehicleId, currentPositionCode: b.positionCode, updatedBy: user.id } });
    return f;
  });

  await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, tyreId: b.tyreId, vehicleId: b.vehicleId, eventType: "Fitted", positionCode: b.positionCode, odometer, refEntity: "TyreVehicleFitting", refId: fitting.id, actorUserId: user.id, actorName: user.fullName ?? null, remarks: b.remarks ?? null });
  await writeAudit(prisma, user, { action: "tyre.fit", entity: "TyreVehicleFitting", entityId: fitting.id, summary: `Tyre ${tyre.tyreCode} fitted to ${vehicle.vehicleNo} @ ${b.positionCode}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: fitting.id, message: "Tyre fitted." }, { status: 201 });
}
