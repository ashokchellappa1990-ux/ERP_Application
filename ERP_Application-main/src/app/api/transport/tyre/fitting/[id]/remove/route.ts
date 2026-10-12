import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { removalInput } from "@/lib/contracts/tyre";
import { getCurrentOdometer, logTyreMovement } from "@/lib/transport/tyre";

const PERM = "transport.tyre";
// Rule: removal reason drives the tyre's post-removal status.
const STATUS_AFTER: Record<string, string> = {
  Rotation: "Available", Puncture: "Under Repair", Wear: "Available", Damage: "Under Repair",
  Retreading: "Under Retreading", Warranty: "Warranty Claim", Scrap: "Scrapped", Other: "Removed",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const fitting = await prisma.tyreVehicleFitting.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!fitting) return NextResponse.json({ ok: false, message: "Fitting record not found." }, { status: 404 });
  if (fitting.status !== "Active") return NextResponse.json({ ok: false, message: "This tyre has already been removed." }, { status: 422 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreVehicleFitting", entityId: id, businessId: fitting.businessId, branchId: fitting.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = removalInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const tyre = await prisma.tyreMaster.findFirst({ where: { id: fitting.tyreId, tenantId: user.tenantId } });
  if (!tyre) return NextResponse.json({ ok: false, message: "Tyre not found." }, { status: 422 });

  // Rule: removal always snapshots current vehicle KM.
  const odometer = await getCurrentOdometer(user.tenantId, fitting.vehicleId);
  const fittedKm = fitting.fittedOdometer != null ? Number(fitting.fittedOdometer) : null;
  const runningKm = fittedKm != null && odometer != null ? odometer - fittedKm : null;
  const nextStatus = STATUS_AFTER[b.removalReason] ?? "Removed";

  await prisma.$transaction(async (tx) => {
    await tx.tyreVehicleFitting.update({ where: { id }, data: { removedAt: new Date(), removedOdometer: odometer, removalReason: b.removalReason, removedBy: b.removedBy ?? user.id, runningKm, status: "Removed" } });
    await tx.tyreMaster.update({ where: { id: fitting.tyreId }, data: { status: nextStatus, currentVehicleId: null, currentPositionCode: null, updatedBy: user.id } });
  });

  await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: fitting.businessId, branchId: fitting.branchId, tyreId: fitting.tyreId, vehicleId: fitting.vehicleId, eventType: "Removed", positionCode: fitting.positionCode, odometer, refEntity: "TyreVehicleFitting", refId: id, actorUserId: user.id, actorName: user.fullName ?? null, remarks: b.remarks ?? null });
  await writeAudit(prisma, user, { action: "tyre.remove", entity: "TyreVehicleFitting", entityId: id, summary: `Tyre ${tyre.tyreCode} removed (${b.removalReason}) — ${runningKm ?? "—"} km run`, meta: { runningKm, nextStatus }, businessId: fitting.businessId, branchId: fitting.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, runningKm, status: nextStatus, message: "Tyre removed." });
}
