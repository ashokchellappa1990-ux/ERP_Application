import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { inspectionInput, type InspectionRow } from "@/lib/contracts/tyre";
import { getCurrentOdometer, logTyreMovement } from "@/lib/transport/tyre";

const PERM = "transport.tyre";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const tyreId = url.searchParams.get("tyreId");
  const scope = await getActiveScope(user);
  const where: Prisma.TyreInspectionWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (tyreId) where.tyreId = Number(tyreId);

  const rows = await prisma.tyreInspection.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const tyreIds = Array.from(new Set(rows.map((r) => r.tyreId)));
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId).filter((x): x is number => x != null)));
  const [tyres, vehicles] = await Promise.all([
    tyreIds.length ? prisma.tyreMaster.findMany({ where: { id: { in: tyreIds } }, select: { id: true, tyreCode: true } }) : [],
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
  ]);
  const tMap = new Map(tyres.map((t) => [t.id, t.tyreCode]));
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));

  const list: InspectionRow[] = rows.map((r) => ({
    id: r.id, inspectionNo: r.inspectionNo, tyreId: r.tyreId, tyreCode: tMap.get(r.tyreId) ?? "—",
    vehicleId: r.vehicleId, vehicleNo: r.vehicleId != null ? vMap.get(r.vehicleId) ?? null : null, positionCode: r.positionCode,
    inspectionDate: r.inspectionDate.toISOString(), odometer: num(r.odometer),
    treadDepthMm: num(r.treadDepthMm), pressurePsi: num(r.pressurePsi), condition: r.condition, defectType: r.defectType,
    recommendedAction: r.recommendedAction, remarks: r.remarks, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreInspection" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = inspectionInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const tyre = await prisma.tyreMaster.findFirst({ where: { id: b.tyreId, tenantId: user.tenantId, deletedAt: null } });
  if (!tyre) return NextResponse.json({ ok: false, message: "Tyre not found." }, { status: 422 });

  const vehicleId = b.vehicleId ?? tyre.currentVehicleId ?? null;
  const odometer = vehicleId ? await getCurrentOdometer(user.tenantId, vehicleId) : null;
  const scope = await getActiveScope(user);
  const seg = await resolveWriteScope(user);

  const created = await prisma.tyreInspection.create({
    data: {
      tenantId: user.tenantId, ...scopeData(scope, { branch: true }), businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
      inspectionNo: "TMP", tyreId: b.tyreId, vehicleId, positionCode: b.positionCode ?? tyre.currentPositionCode,
      inspectionDate: new Date(b.inspectionDate), odometer,
      treadDepthMm: b.treadDepthMm ?? null, pressurePsi: b.pressurePsi ?? null, condition: b.condition, defectType: b.defectType ?? null,
      inspectedBy: b.inspectedBy ?? user.id, recommendedAction: b.recommendedAction, remarks: b.remarks ?? null, createdBy: user.id,
    },
  });
  const inspectionNo = `INS-${String(created.id).padStart(6, "0")}`;
  await prisma.tyreInspection.update({ where: { id: created.id }, data: { inspectionNo } });

  await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, tyreId: b.tyreId, vehicleId, eventType: "Inspected", positionCode: b.positionCode ?? tyre.currentPositionCode, odometer, refEntity: "TyreInspection", refId: created.id, actorUserId: user.id, actorName: user.fullName ?? null, remarks: b.remarks ?? null });
  await writeAudit(prisma, user, { action: "tyre.inspect", entity: "TyreInspection", entityId: created.id, summary: `Tyre ${tyre.tyreCode} inspected — ${b.condition}${b.treadDepthMm != null ? `, tread ${b.treadDepthMm}mm` : ""}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, inspectionNo, message: "Inspection recorded." }, { status: 201 });
}
