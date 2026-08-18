import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { cancelInput } from "@/lib/contracts/vehicleMaintenance";

const PERM = "masters.transport";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleMaintenance.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Service entry not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleMaintenance", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;
  if (existing.status === "Completed" || existing.status === "Cancelled") return NextResponse.json({ ok: false, message: `Cannot cancel a service entry that is already ${existing.status}.` }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = cancelInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "A reason is required." }, { status: 422 });

  await prisma.vehicleMaintenance.update({ where: { id }, data: { status: "Cancelled", cancelledBy: user.id, cancelledAt: new Date(), cancellationReason: parsed.data.cancellationReason, updatedBy: user.id } });
  await writeAudit(prisma, user, { action: "vehicle_maintenance.cancel", entity: "VehicleMaintenance", entityId: id, summary: `Cancelled service entry ${existing.maintenanceNo}`, meta: { reason: parsed.data.cancellationReason }, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Service entry cancelled." });
}
