import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
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

function toRow(r: VehicleRow, nameById: Map<number, string>) {
  return {
    id: r.id, vehicleNo: r.vehicleNo, vehicleType: r.vehicleType, capacity: Number(r.capacity),
    capacityUnit: r.capacityUnit, transportCompanyId: r.transportCompanyId, ownerType: r.ownerType,
    status: r.status, remarks: r.remarks, transportCompanyName: r.transportCompanyId != null ? nameById.get(r.transportCompanyId) ?? null : null,
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

// GET /api/transport/masters/vehicle — list vehicles (tenant/business/branch scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.VehicleMasterWhereInput = { ...scopeWhere(scope, { branch: true }), deletedAt: null };
  if (q) where.OR = [{ vehicleNo: { contains: q } }, { vehicleType: { contains: q } }, { remarks: { contains: q } }];
  if (status && status !== "All") where.status = status;

  const rows = await prisma.vehicleMaster.findMany({ where, orderBy: { id: "desc" }, take: 500 });
  const companyIds = Array.from(new Set(rows.map((r) => r.transportCompanyId).filter((id): id is number => id != null)));
  const companies = companyIds.length ? await prisma.transportCompany.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }) : [];
  const nameById = new Map(companies.map((c) => [c.id, c.name]));
  return NextResponse.json({ ok: true, rows: rows.map((r) => toRow(r, nameById)) });
}

// POST /api/transport/masters/vehicle — create a vehicle.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleMaster" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = vehicleInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  try {
    const created = await prisma.vehicleMaster.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
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
        createdBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_vehicle.create", entity: "VehicleMaster", entityId: created.id,
      summary: `Created vehicle ${created.vehicleNo}`, meta: { vehicleNo: created.vehicleNo },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    const companyName = created.transportCompanyId != null ? (await prisma.transportCompany.findUnique({ where: { id: created.transportCompanyId }, select: { name: true } }))?.name ?? null : null;
    return NextResponse.json({ ok: true, id: created.id, row: toRow(created, companyName != null ? new Map([[created.transportCompanyId!, companyName]]) : new Map()), message: "Vehicle created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A vehicle with this number already exists.", errors: { vehicleNo: "Already in use." } }, { status: 409 });
    }
    console.error("[transport/vehicle] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the vehicle." }, { status: 500 });
  }
}
