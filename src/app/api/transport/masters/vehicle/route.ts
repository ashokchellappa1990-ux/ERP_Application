import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
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
  return NextResponse.json({ ok: true, rows: rows.map(toRow) });
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
        createdBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_vehicle.create", entity: "VehicleMaster", entityId: created.id,
      summary: `Created vehicle ${created.vehicleNo}`, meta: { vehicleNo: created.vehicleNo },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, id: created.id, row: toRow(created), message: "Vehicle created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A vehicle with this number already exists.", errors: { vehicleNo: "Already in use." } }, { status: 409 });
    }
    console.error("[transport/vehicle] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the vehicle." }, { status: 500 });
  }
}
