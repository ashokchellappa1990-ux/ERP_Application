import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { vehicleAssignmentInput, effectiveAssignmentStatus, type AssignmentRow } from "@/lib/contracts/vehicleAssignment";
import { findDuplicateAssignment, findOverlappingPrimary } from "@/lib/transport/vehicleAssignment";
import { isVehicleUnderMaintenance } from "@/lib/transport/vehicleMaintenance";

// Shares the Transport masters' permission key (routeKey derives
// "masters.transport" from this page's /masters/transport/... href) — same
// as Vehicle/Driver/Transport Company/Route/Loading Bay/Weighbridge masters,
// matching this app's one-key-per-module RBAC convention (no per-action
// granularity exists anywhere in the codebase to plug into).
const PERM = "masters.transport";

function toDate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

// GET /api/transport/vehicle-assignment — list, filterable by vehicleId,
// driverId, assignmentType, status, fromDate, toDate, q (assignment no / vehicle
// no / driver name). Also serves the History screen and Driver/Vehicle
// "assigned vehicles/drivers" views — same endpoint, different filters.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  const driverId = url.searchParams.get("driverId");
  const assignmentType = url.searchParams.get("assignmentType");
  const status = url.searchParams.get("status");
  const fromDate = url.searchParams.get("fromDate");
  const toDateParam = url.searchParams.get("toDate");
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.VehicleDriverAssignmentWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (driverId) where.driverId = Number(driverId);
  if (assignmentType) where.assignmentType = assignmentType;
  if (status && status !== "All") where.status = status;
  if (fromDate) where.fromDate = { gte: new Date(fromDate) };
  if (toDateParam) where.toDate = { lte: new Date(toDateParam) };
  if (q) where.assignmentNo = { contains: q };

  const rows = await prisma.vehicleDriverAssignment.findMany({ where, orderBy: { id: "desc" }, take: 1000 });

  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const driverIds = Array.from(new Set(rows.map((r) => r.driverId)));
  const createdByIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is number => x != null)));
  const [vehicles, drivers, users] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true, vehicleType: true } }) : [],
    driverIds.length ? prisma.driverMaster.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true, phone: true } }) : [],
    createdByIds.length ? prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v]));
  const dMap = new Map(drivers.map((d) => [d.id, d]));
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));

  // Filter by vehicleNo/driverName text search AFTER the join, since q may
  // target either (the DB-level `where` above only covers assignmentNo).
  let list: AssignmentRow[] = rows.map((r) => {
    const v = vMap.get(r.vehicleId);
    const d = dMap.get(r.driverId);
    return {
      id: r.id, assignmentNo: r.assignmentNo,
      vehicleId: r.vehicleId, vehicleNo: v?.vehicleNo ?? "—", vehicleType: v?.vehicleType ?? null,
      driverId: r.driverId, driverName: d?.name ?? "—", driverPhone: d?.phone ?? null,
      assignmentType: r.assignmentType, isPrimary: r.isPrimary,
      fromDate: dateStr(r.fromDate) ?? "", toDate: dateStr(r.toDate),
      status: r.status, effectiveStatus: effectiveAssignmentStatus(r.status, r.toDate),
      remarks: r.remarks,
      createdByName: r.createdBy != null ? uMap.get(r.createdBy) ?? null : null, createdAt: r.createdAt.toISOString(),
    };
  });
  if (q) {
    const qLower = q.toLowerCase();
    list = list.filter((r) => r.assignmentNo.toLowerCase().includes(qLower) || r.vehicleNo.toLowerCase().includes(qLower) || r.driverName.toLowerCase().includes(qLower));
  }

  return NextResponse.json({ ok: true, rows: list });
}

// POST /api/transport/vehicle-assignment — create a new assignment.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDriverAssignment" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = vehicleAssignmentInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: b.vehicleId, tenantId: user.tenantId, deletedAt: null } });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 422 });
  if (vehicle.status !== "Active") return NextResponse.json({ ok: false, message: "This vehicle is not Active and cannot be assigned." }, { status: 422 });
  if (await isVehicleUnderMaintenance(user.tenantId, b.vehicleId)) return NextResponse.json({ ok: false, message: "This vehicle is currently under maintenance and cannot be assigned." }, { status: 422 });

  const driver = await prisma.driverMaster.findFirst({ where: { id: b.driverId, tenantId: user.tenantId, deletedAt: null } });
  if (!driver) return NextResponse.json({ ok: false, message: "Driver not found." }, { status: 422 });
  if (driver.status !== "Active") return NextResponse.json({ ok: false, message: "This driver is not Active and cannot be assigned." }, { status: 422 });

  const from = toDate(b.fromDate)!;
  const to = toDate(b.toDate);

  const dupe = await findDuplicateAssignment(user.tenantId, b.vehicleId, b.driverId, b.assignmentType, from, to);
  if (dupe) return NextResponse.json({ ok: false, message: "An identical assignment (same vehicle, driver, type and date range) already exists." }, { status: 409 });

  if (b.isPrimary) {
    const clash = await findOverlappingPrimary(user.tenantId, b.vehicleId, from, to);
    if (clash) return NextResponse.json({ ok: false, message: "Another Primary Driver is already assigned to this vehicle for an overlapping period. End that assignment first, or choose non-overlapping dates." }, { status: 409 });
  }

  const seg = await resolveWriteScope(user);
  const created = await prisma.vehicleDriverAssignment.create({
    data: {
      tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
      assignmentNo: "TMP", vehicleId: b.vehicleId, driverId: b.driverId,
      assignmentType: b.assignmentType, isPrimary: b.isPrimary,
      fromDate: from, toDate: to, status: "Active", remarks: b.remarks ?? null,
      createdBy: user.id,
    },
  });
  const assignmentNo = `ASGN-${String(created.id).padStart(5, "0")}`;
  await prisma.vehicleDriverAssignment.update({ where: { id: created.id }, data: { assignmentNo } });

  await writeAudit(prisma, user, {
    action: "vehicle_driver_assignment.create", entity: "VehicleDriverAssignment", entityId: created.id,
    summary: `Assigned driver ${driver.name} to vehicle ${vehicle.vehicleNo} (${b.assignmentType})`,
    meta: { vehicleNo: vehicle.vehicleNo, driverName: driver.name, assignmentType: b.assignmentType, isPrimary: b.isPrimary },
    businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, id: created.id, assignmentNo, message: "Assignment created." }, { status: 201 });
}
