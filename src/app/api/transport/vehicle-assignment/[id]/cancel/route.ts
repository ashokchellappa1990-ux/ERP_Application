import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { assignmentCancelInput } from "@/lib/contracts/vehicleAssignment";

const PERM = "masters.transport";

// POST /api/transport/vehicle-assignment/[id]/cancel — soft-close (never
// deletes); requires a reason, stamps who/when.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleDriverAssignment.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, assignmentNo: true, status: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Assignment not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDriverAssignment", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  if (existing.status === "Cancelled") return NextResponse.json({ ok: false, message: "This assignment is already cancelled." }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = assignmentCancelInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Cancellation reason is required." }, { status: 422 });

  await prisma.vehicleDriverAssignment.update({
    where: { id },
    data: { status: "Cancelled", cancelledBy: user.id, cancelledAt: new Date(), cancellationReason: parsed.data.cancellationReason, updatedBy: user.id },
  });
  await writeAudit(prisma, user, {
    action: "vehicle_driver_assignment.cancel", entity: "VehicleDriverAssignment", entityId: id,
    summary: `Cancelled assignment ${existing.assignmentNo}`, meta: { reason: parsed.data.cancellationReason },
    businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Assignment cancelled." });
}
