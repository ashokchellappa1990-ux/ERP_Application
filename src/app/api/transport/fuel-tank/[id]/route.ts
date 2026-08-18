import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { tankInput } from "@/lib/contracts/fuelManagement";

const PERM = "masters.transport";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.fuelTank.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, tankCode: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Fuel tank not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "FuelTank", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = tankInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const updated = await prisma.fuelTank.update({ where: { id }, data: { tankCode: b.tankCode, tankName: b.tankName, stationId: b.stationId, fuelType: b.fuelType, capacity: b.capacity, minLevel: b.minLevel ?? null, maxLevel: b.maxLevel ?? null, status: b.status, remarks: b.remarks ?? null, updatedBy: user.id } });
  await writeAudit(prisma, user, { action: "fuel_tank.update", entity: "FuelTank", entityId: id, summary: `Updated fuel tank ${updated.tankCode}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Fuel tank updated." });
}
