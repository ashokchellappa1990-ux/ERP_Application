import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, resolveWriteScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { replacementInput } from "@/lib/contracts/tyre";
import { getCurrentOdometer, logTyreMovement } from "@/lib/transport/tyre";

const PERM = "transport.tyre";
const STATUS_AFTER: Record<string, string> = {
  Rotation: "Available", Puncture: "Under Repair", Wear: "Available", Damage: "Under Repair",
  Retreading: "Under Retreading", Warranty: "Warranty Claim", Scrap: "Scrapped", Other: "Removed",
};

// Replacement = remove the old tyre's active fitting + fit a new tyre at the
// same position, in one call — the spec's "direct replacement linking old
// tyre removed -> new tyre fitted, with history linking the event".
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const oldFitting = await prisma.tyreVehicleFitting.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!oldFitting) return NextResponse.json({ ok: false, message: "Fitting record not found." }, { status: 404 });
  if (oldFitting.status !== "Active") return NextResponse.json({ ok: false, message: "This tyre has already been removed." }, { status: 422 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreVehicleFitting", entityId: id, businessId: oldFitting.businessId, branchId: oldFitting.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = replacementInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const [oldTyre, newTyre] = await Promise.all([
    prisma.tyreMaster.findFirst({ where: { id: oldFitting.tyreId, tenantId: user.tenantId } }),
    prisma.tyreMaster.findFirst({ where: { id: b.newTyreId, tenantId: user.tenantId, deletedAt: null } }),
  ]);
  if (!oldTyre) return NextResponse.json({ ok: false, message: "Existing tyre not found." }, { status: 422 });
  if (!newTyre) return NextResponse.json({ ok: false, message: "New tyre not found." }, { status: 422 });
  if (newTyre.status !== "Available") return NextResponse.json({ ok: false, message: `New tyre ${newTyre.tyreCode} is ${newTyre.status} and cannot be fitted.` }, { status: 422 });

  const odometer = await getCurrentOdometer(user.tenantId, oldFitting.vehicleId);
  const fittedKm = oldFitting.fittedOdometer != null ? Number(oldFitting.fittedOdometer) : null;
  const runningKm = fittedKm != null && odometer != null ? odometer - fittedKm : null;
  const nextOldStatus = STATUS_AFTER[b.removalReason] ?? "Removed";

  const scope = await getActiveScope(user);
  const seg = await resolveWriteScope(user);

  const newFitting = await prisma.$transaction(async (tx) => {
    await tx.tyreVehicleFitting.update({ where: { id }, data: { removedAt: new Date(), removedOdometer: odometer, removalReason: b.removalReason, removedBy: user.id, runningKm, status: "Removed" } });
    await tx.tyreMaster.update({ where: { id: oldFitting.tyreId }, data: { status: nextOldStatus, currentVehicleId: null, currentPositionCode: null, updatedBy: user.id } });
    const f = await tx.tyreVehicleFitting.create({
      data: {
        tenantId: user.tenantId, ...scopeData(scope, { branch: true }), businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        tyreId: b.newTyreId, vehicleId: oldFitting.vehicleId, positionCode: oldFitting.positionCode,
        fittedAt: new Date(b.fittedAt), fittedOdometer: odometer, fittedBy: user.id, status: "Active", remarks: b.remarks ?? null,
      },
    });
    await tx.tyreMaster.update({ where: { id: b.newTyreId }, data: { status: "Fitted", currentVehicleId: oldFitting.vehicleId, currentPositionCode: oldFitting.positionCode, updatedBy: user.id } });
    return f;
  });

  await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, tyreId: oldFitting.tyreId, vehicleId: oldFitting.vehicleId, eventType: "Removed", positionCode: oldFitting.positionCode, odometer, refEntity: "TyreVehicleFitting", refId: id, actorUserId: user.id, actorName: user.fullName ?? null, remarks: `Replaced by ${newTyre.tyreCode}` });
  await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, tyreId: b.newTyreId, vehicleId: oldFitting.vehicleId, eventType: "Fitted", positionCode: oldFitting.positionCode, odometer, refEntity: "TyreVehicleFitting", refId: newFitting.id, actorUserId: user.id, actorName: user.fullName ?? null, remarks: `Replaces ${oldTyre.tyreCode}` });
  await writeAudit(prisma, user, { action: "tyre.replace", entity: "TyreVehicleFitting", entityId: newFitting.id, summary: `Tyre ${oldTyre.tyreCode} replaced with ${newTyre.tyreCode} @ ${oldFitting.positionCode}`, meta: { oldTyreId: oldFitting.tyreId, newTyreId: b.newTyreId, runningKm }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: newFitting.id, message: "Tyre replaced." }, { status: 201 });
}
