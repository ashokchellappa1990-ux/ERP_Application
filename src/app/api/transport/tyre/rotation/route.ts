import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { rotationInput, type RotationRow } from "@/lib/contracts/tyre";
import { getCurrentOdometer, resolveTyrePositionTemplate, logTyreMovement } from "@/lib/transport/tyre";

const PERM = "transport.tyre";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  const scope = await getActiveScope(user);
  const rows = await prisma.tyreRotation.findMany({ where: { ...scopeWhere(scope, { branch: true }), ...(vehicleId ? { vehicleId: Number(vehicleId) } : {}) }, orderBy: { id: "desc" }, take: 500 });
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const vehicles = vehicleIds.length ? await prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [];
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const lineCounts = await prisma.tyreRotationLine.groupBy({ by: ["rotationId"], where: { rotationId: { in: rows.map((r) => r.id) } }, _count: true });
  const lMap = new Map(lineCounts.map((l) => [l.rotationId, l._count]));

  const list: RotationRow[] = rows.map((r) => ({
    id: r.id, rotationNo: r.rotationNo, vehicleId: r.vehicleId, vehicleNo: vMap.get(r.vehicleId) ?? "—",
    rotationDate: r.rotationDate.toISOString(), odometer: r.odometer != null ? Number(r.odometer) : null,
    lineCount: lMap.get(r.id) ?? 0, remarks: r.remarks, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreRotation" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = rotationInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: b.vehicleId, tenantId: user.tenantId, deletedAt: null } });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 422 });

  const activeFittings = await prisma.tyreVehicleFitting.findMany({ where: { tenantId: user.tenantId, vehicleId: b.vehicleId, status: "Active", tyreId: { in: b.lines.map((l) => l.tyreId) } } });
  const fittingByTyre = new Map(activeFittings.map((f) => [f.tyreId, f]));
  for (const line of b.lines) {
    if (!fittingByTyre.has(line.tyreId)) return NextResponse.json({ ok: false, message: `Tyre ${line.tyreId} is not currently fitted to this vehicle.` }, { status: 422 });
  }
  const resolved = await resolveTyrePositionTemplate(user.tenantId, b.vehicleId);
  if (resolved) {
    for (const line of b.lines) {
      if (!resolved.codes.some((c) => c.positionCode === line.toPositionCode)) return NextResponse.json({ ok: false, message: `Position ${line.toPositionCode} is not valid for this vehicle's configuration.` }, { status: 422 });
    }
  }
  const toPositions = b.lines.map((l) => l.toPositionCode);
  if (new Set(toPositions).size !== toPositions.length) return NextResponse.json({ ok: false, message: "Two tyres cannot rotate into the same position." }, { status: 422 });

  const odometer = await getCurrentOdometer(user.tenantId, b.vehicleId);
  const scope = await getActiveScope(user);
  const seg = await resolveWriteScope(user);

  const rotation = await prisma.$transaction(async (tx) => {
    const rot = await tx.tyreRotation.create({
      data: { tenantId: user.tenantId, ...scopeData(scope, { branch: true }), businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined, rotationNo: "TMP", vehicleId: b.vehicleId, rotationDate: new Date(b.rotationDate), odometer, performedBy: b.performedBy ?? user.id, remarks: b.remarks ?? null, createdBy: user.id },
    });
    for (const line of b.lines) {
      const old = fittingByTyre.get(line.tyreId)!;
      await tx.tyreVehicleFitting.update({ where: { id: old.id }, data: { removedAt: new Date(b.rotationDate), removedOdometer: odometer, removalReason: "Rotation", removedBy: user.id, runningKm: old.fittedOdometer != null && odometer != null ? odometer - Number(old.fittedOdometer) : null, status: "Removed" } });
      await tx.tyreVehicleFitting.create({ data: { tenantId: user.tenantId, ...scopeData(scope, { branch: true }), businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined, tyreId: line.tyreId, vehicleId: b.vehicleId, positionCode: line.toPositionCode, fittedAt: new Date(b.rotationDate), fittedOdometer: odometer, fittedBy: user.id, status: "Active" } });
      await tx.tyreMaster.update({ where: { id: line.tyreId }, data: { currentPositionCode: line.toPositionCode, updatedBy: user.id } });
      await tx.tyreRotationLine.create({ data: { tenantId: user.tenantId, rotationId: rot.id, tyreId: line.tyreId, fromPositionCode: old.positionCode, toPositionCode: line.toPositionCode } });
    }
    const rotationNo = `ROT-${String(rot.id).padStart(6, "0")}`;
    await tx.tyreRotation.update({ where: { id: rot.id }, data: { rotationNo } });
    return { ...rot, rotationNo };
  });

  for (const line of b.lines) {
    await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, tyreId: line.tyreId, vehicleId: b.vehicleId, eventType: "Rotated", positionCode: line.toPositionCode, odometer, refEntity: "TyreRotation", refId: rotation.id, actorUserId: user.id, actorName: user.fullName ?? null });
  }
  await writeAudit(prisma, user, { action: "tyre.rotate", entity: "TyreRotation", entityId: rotation.id, summary: `Rotation ${rotation.rotationNo} on ${vehicle.vehicleNo} — ${b.lines.length} tyres`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: rotation.id, rotationNo: rotation.rotationNo, message: "Rotation recorded." }, { status: 201 });
}
