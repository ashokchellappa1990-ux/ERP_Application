import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { reassignInput, effectiveAssignmentStatus } from "@/lib/contracts/vehicleAssignment";
import { findDuplicateAssignment, findOverlappingPrimary } from "@/lib/transport/vehicleAssignment";

const PERM = "masters.transport";

function toDate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// POST /api/transport/vehicle-assignment/[id]/reassign — ends the current
// assignment (same vehicle) and starts a new one for a different driver, in
// one step. Both records are kept — nothing is overwritten or deleted, so
// history stays intact (see Assignment History / section 17-18 of the spec).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleDriverAssignment.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Assignment not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDriverAssignment", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  if (effectiveAssignmentStatus(existing.status, existing.toDate) !== "Active") {
    return NextResponse.json({ ok: false, message: "Only an Active assignment can be reassigned." }, { status: 422 });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = reassignInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const newFrom = toDate(b.fromDate)!;
  const newTo = toDate(b.toDate);
  if (newFrom.getTime() <= existing.fromDate.getTime()) {
    return NextResponse.json({ ok: false, message: "The new assignment's From Date must be after the current assignment's From Date." }, { status: 422 });
  }

  const driver = await prisma.driverMaster.findFirst({ where: { id: b.driverId, tenantId: user.tenantId, deletedAt: null } });
  if (!driver) return NextResponse.json({ ok: false, message: "Driver not found." }, { status: 422 });
  if (driver.status !== "Active") return NextResponse.json({ ok: false, message: "This driver is not Active and cannot be assigned." }, { status: 422 });

  const dupe = await findDuplicateAssignment(user.tenantId, existing.vehicleId, b.driverId, b.assignmentType, newFrom, newTo);
  if (dupe) return NextResponse.json({ ok: false, message: "An identical assignment already exists." }, { status: 409 });

  // Close the current one the day before the new one starts — unless it was
  // already scheduled to end earlier, in which case leave that end date alone.
  const closeOldAt = new Date(newFrom.getTime() - 86400000);
  const oldNewToDate = existing.toDate && existing.toDate.getTime() < closeOldAt.getTime() ? existing.toDate : closeOldAt;

  if (b.isPrimary) {
    const clash = await findOverlappingPrimary(user.tenantId, existing.vehicleId, newFrom, newTo, undefined);
    if (clash && clash.id !== existing.id) {
      return NextResponse.json({ ok: false, message: "Another Primary Driver is already assigned to this vehicle for an overlapping period." }, { status: 409 });
    }
  }

  const seg = await resolveWriteScope(user);
  const [, created] = await prisma.$transaction([
    prisma.vehicleDriverAssignment.update({ where: { id: existing.id }, data: { toDate: oldNewToDate, updatedBy: user.id } }),
    prisma.vehicleDriverAssignment.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        assignmentNo: "TMP", vehicleId: existing.vehicleId, driverId: b.driverId,
        assignmentType: b.assignmentType, isPrimary: b.isPrimary,
        fromDate: newFrom, toDate: newTo, status: "Active", remarks: b.remarks ?? null,
        createdBy: user.id,
      },
    }),
  ]);
  const assignmentNo = `ASGN-${String(created.id).padStart(5, "0")}`;
  await prisma.vehicleDriverAssignment.update({ where: { id: created.id }, data: { assignmentNo } });

  await writeAudit(prisma, user, {
    action: "vehicle_driver_assignment.reassign", entity: "VehicleDriverAssignment", entityId: created.id,
    summary: `Reassigned ${existing.assignmentNo} → ${assignmentNo} (driver #${b.driverId})`,
    meta: { fromAssignmentId: existing.id, toAssignmentId: created.id },
    businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, id: created.id, assignmentNo, message: "Reassigned." }, { status: 201 });
}
