import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { vehicleInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

/** "YYYY-MM-DD" (from a date input) <-> DateTime column. */
function toDate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function toDateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

type VehicleRow = Awaited<ReturnType<typeof prisma.vehicleMaster.findFirstOrThrow>>;

function toRow(r: VehicleRow) {
  return {
    id: r.id, vehicleNo: r.vehicleNo, vehicleType: r.vehicleType, capacity: Number(r.capacity),
    capacityUnit: r.capacityUnit, transportCompanyId: r.transportCompanyId, ownerType: r.ownerType,
    status: r.status, remarks: r.remarks,
    vehicleCategory: r.vehicleCategory, make: r.make, model: r.model, manufacturingYear: r.manufacturingYear,
    registrationDate: toDateStr(r.registrationDate),
    numberOfAxles: r.numberOfAxles, bodyType: r.bodyType, fuelType: r.fuelType, engineNo: r.engineNo, chassisNo: r.chassisNo, colour: r.colour,
    contractRef: r.contractRef, transporterEffectiveFrom: toDateStr(r.transporterEffectiveFrom), transporterEffectiveTo: toDateStr(r.transporterEffectiveTo),
    rfidTagNo: r.rfidTagNo, gpsDeviceId: r.gpsDeviceId, fastagId: r.fastagId,
    registrationCertNo: r.registrationCertNo, registrationValidUpto: toDateStr(r.registrationValidUpto),
    insuranceNo: r.insuranceNo, insuranceValidUpto: toDateStr(r.insuranceValidUpto),
    fitnessNo: r.fitnessNo, fitnessValidUpto: toDateStr(r.fitnessValidUpto),
    pollutionNo: r.pollutionNo, pollutionValidUpto: toDateStr(r.pollutionValidUpto),
    permitNo: r.permitNo, permitValidUpto: toDateStr(r.permitValidUpto),
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
        vehicleCategory: b.vehicleCategory ?? null, make: b.make ?? null, model: b.model ?? null, manufacturingYear: b.manufacturingYear ?? null,
        registrationDate: toDate(b.registrationDate),
        numberOfAxles: b.numberOfAxles ?? null, bodyType: b.bodyType ?? null, fuelType: b.fuelType ?? null,
        engineNo: b.engineNo ?? null, chassisNo: b.chassisNo ?? null, colour: b.colour ?? null,
        contractRef: b.contractRef ?? null, transporterEffectiveFrom: toDate(b.transporterEffectiveFrom), transporterEffectiveTo: toDate(b.transporterEffectiveTo),
        rfidTagNo: b.rfidTagNo ?? null, gpsDeviceId: b.gpsDeviceId ?? null, fastagId: b.fastagId ?? null,
        registrationCertNo: b.registrationCertNo ?? null, registrationValidUpto: toDate(b.registrationValidUpto),
        insuranceNo: b.insuranceNo ?? null, insuranceValidUpto: toDate(b.insuranceValidUpto),
        fitnessNo: b.fitnessNo ?? null, fitnessValidUpto: toDate(b.fitnessValidUpto),
        pollutionNo: b.pollutionNo ?? null, pollutionValidUpto: toDate(b.pollutionValidUpto),
        permitNo: b.permitNo ?? null, permitValidUpto: toDate(b.permitValidUpto),
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
