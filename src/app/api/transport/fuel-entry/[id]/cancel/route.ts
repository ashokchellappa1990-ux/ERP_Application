import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { cancelInput } from "@/lib/contracts/fuelManagement";

const PERM = "masters.transport";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.fuelEntry.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Fuel entry not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "FuelEntry", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;
  if (existing.status === "Cancelled") return NextResponse.json({ ok: false, message: "Already cancelled." }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = cancelInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "A reason is required." }, { status: 422 });

  await prisma.fuelEntry.update({ where: { id }, data: { status: "Cancelled", cancelledBy: user.id, cancelledAt: new Date(), cancellationReason: parsed.data.cancellationReason, updatedBy: user.id } });
  await writeAudit(prisma, user, { action: "fuel_entry.cancel", entity: "FuelEntry", entityId: id, summary: `Cancelled fuel entry ${existing.entryNo}`, meta: { reason: parsed.data.cancellationReason }, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Fuel entry cancelled." });
}
