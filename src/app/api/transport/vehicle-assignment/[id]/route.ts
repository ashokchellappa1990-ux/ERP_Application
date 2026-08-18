import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { vehicleAssignmentInput, effectiveAssignmentStatus, type AssignmentDetail } from "@/lib/contracts/vehicleAssignment";
import { findDuplicateAssignment, findOverlappingPrimary } from "@/lib/transport/vehicleAssignment";
import { isVehicleUnderMaintenance } from "@/lib/transport/vehicleMaintenance";

const PERM = "masters.transport";

function toDate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

async function toDetail(r: NonNullable<Awaited<ReturnType<typeof prisma.vehicleDriverAssignment.findFirst>>>): Promise<AssignmentDetail> {
  const [vehicle, driver, createdByUser, updatedByUser, cancelledByUser] = await Promise.all([
    prisma.vehicleMaster.findFirst({ where: { id: r.vehicleId } }),
    prisma.driverMaster.findFirst({ where: { id: r.driverId } }),
    r.createdBy != null ? prisma.user.findFirst({ where: { id: r.createdBy }, select: { fullName: true } }) : null,
    r.updatedBy != null ? prisma.user.findFirst({ where: { id: r.updatedBy }, select: { fullName: true } }) : null,
    r.cancelledBy != null ? prisma.user.findFirst({ where: { id: r.cancelledBy }, select: { fullName: true } }) : null,
  ]);
  const transportCompany = vehicle?.transportCompanyId != null ? await prisma.transportCompany.findFirst({ where: { id: vehicle.transportCompanyId }, select: { name: true } }) : null;

  return {
    id: r.id, assignmentNo: r.assignmentNo,
    vehicleId: r.vehicleId, vehicleNo: vehicle?.vehicleNo ?? "—", vehicleType: vehicle?.vehicleType ?? null,
    driverId: r.driverId, driverName: driver?.name ?? "—", driverPhone: driver?.phone ?? null,
    assignmentType: r.assignmentType, isPrimary: r.isPrimary,
    fromDate: dateStr(r.fromDate) ?? "", toDate: dateStr(r.toDate),
    status: r.status, effectiveStatus: effectiveAssignmentStatus(r.status, r.toDate),
    remarks: r.remarks,
    createdByName: createdByUser?.fullName ?? null, createdAt: r.createdAt.toISOString(),
    updatedByName: updatedByUser?.fullName ?? null, updatedAt: r.updatedAt.toISOString(),
    cancelledByName: cancelledByUser?.fullName ?? null, cancelledAt: r.cancelledAt?.toISOString() ?? null, cancellationReason: r.cancellationReason,
    vehicle: vehicle ? {
      id: vehicle.id, vehicleNo: vehicle.vehicleNo, vehicleType: vehicle.vehicleType, vehicleCategory: vehicle.vehicleCategory,
      capacity: Number(vehicle.capacity), capacityUnit: vehicle.capacityUnit, ownerType: vehicle.ownerType,
      transportCompanyName: transportCompany?.name ?? null, status: vehicle.status,
    } : null,
    driver: driver ? {
      id: driver.id, driverCode: driver.driverCode, name: driver.name, phone: driver.phone,
      licenseNo: driver.licenseNo, licenseExpiry: driver.licenseExpiry, status: driver.status,
    } : null,
  };
}

// GET /api/transport/vehicle-assignment/[id] — full detail incl. joined
// vehicle/driver info (View screen).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.vehicleDriverAssignment.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Assignment not found." }, { status: 404 });
  return NextResponse.json({ ok: true, row: await toDetail(r) });
}

// PUT /api/transport/vehicle-assignment/[id] — edit an assignment. Only
// while it's still Active (not Completed-by-date, not Cancelled) — a closed
// record is edited via Reassign instead, so history stays intact.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleDriverAssignment.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, status: true, toDate: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Assignment not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDriverAssignment", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  if (effectiveAssignmentStatus(existing.status, existing.toDate) !== "Active") {
    return NextResponse.json({ ok: false, message: "Only an Active assignment can be edited — a completed or cancelled one is closed; use Reassign to start a new one." }, { status: 422 });
  }

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

  const dupe = await findDuplicateAssignment(user.tenantId, b.vehicleId, b.driverId, b.assignmentType, from, to, id);
  if (dupe) return NextResponse.json({ ok: false, message: "An identical assignment (same vehicle, driver, type and date range) already exists." }, { status: 409 });

  if (b.isPrimary) {
    const clash = await findOverlappingPrimary(user.tenantId, b.vehicleId, from, to, id);
    if (clash) return NextResponse.json({ ok: false, message: "Another Primary Driver is already assigned to this vehicle for an overlapping period." }, { status: 409 });
  }

  const updated = await prisma.vehicleDriverAssignment.update({
    where: { id },
    data: {
      vehicleId: b.vehicleId, driverId: b.driverId, assignmentType: b.assignmentType, isPrimary: b.isPrimary,
      fromDate: from, toDate: to, remarks: b.remarks ?? null, updatedBy: user.id,
    },
  });
  await writeAudit(prisma, user, {
    action: "vehicle_driver_assignment.update", entity: "VehicleDriverAssignment", entityId: id,
    summary: `Updated assignment ${updated.assignmentNo}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, row: await toDetail(updated), message: "Assignment updated." });
}
