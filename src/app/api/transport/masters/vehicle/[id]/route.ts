import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { vehicleInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

function toRow(r: {
  id: number; vehicleNo: string; vehicleType: string | null; capacity: Prisma.Decimal;
  capacityUnit: string | null; transportCompanyId: number | null; ownerType: string;
  status: string; remarks: string | null;
}) {
  return {
    id: r.id, vehicleNo: r.vehicleNo, vehicleType: r.vehicleType, capacity: Number(r.capacity),
    capacityUnit: r.capacityUnit, transportCompanyId: r.transportCompanyId, ownerType: r.ownerType,
    status: r.status, remarks: r.remarks,
  };
}

// GET /api/transport/masters/vehicle/[id] — single vehicle.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.vehicleMaster.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId, deletedAt: null } });
  if (!r) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 404 });
  return NextResponse.json({ ok: true, row: toRow(r) });
}

// PUT /api/transport/masters/vehicle/[id] — update a vehicle.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleMaster.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: { id: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleMaster", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = vehicleInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  try {
    const updated = await prisma.vehicleMaster.update({
      where: { id },
      data: {
        vehicleNo: b.vehicleNo, vehicleType: b.vehicleType ?? null, capacity: b.capacity, capacityUnit: b.capacityUnit ?? null,
        transportCompanyId: b.transportCompanyId ?? null, ownerType: b.ownerType, status: b.status, remarks: b.remarks ?? null,
        updatedBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_vehicle.update", entity: "VehicleMaster", entityId: id,
      summary: `Updated vehicle ${updated.vehicleNo}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, row: toRow(updated), message: "Vehicle updated." });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A vehicle with this number already exists.", errors: { vehicleNo: "Already in use." } }, { status: 409 });
    }
    console.error("[transport/vehicle] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the vehicle." }, { status: 500 });
  }
}

// DELETE /api/transport/masters/vehicle/[id] — soft delete.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleMaster.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: { id: true, vehicleNo: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleMaster", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  await prisma.vehicleMaster.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: user.id } });
  await writeAudit(prisma, user, {
    action: "transport_vehicle.delete", entity: "VehicleMaster", entityId: id,
    summary: `Deleted vehicle ${existing.vehicleNo}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Vehicle deleted." });
}
