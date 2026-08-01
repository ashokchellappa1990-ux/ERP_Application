import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { driverInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

function toRow(r: {
  id: number; name: string; licenseNo: string | null; licenseExpiry: string | null; phone: string | null;
  transportCompanyId: number | null; status: string; remarks: string | null;
}) {
  return {
    id: r.id, name: r.name, licenseNo: r.licenseNo, licenseExpiry: r.licenseExpiry, phone: r.phone,
    transportCompanyId: r.transportCompanyId, status: r.status, remarks: r.remarks,
  };
}

// GET /api/transport/masters/driver — list drivers (tenant/business/branch scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.DriverMasterWhereInput = { ...scopeWhere(scope, { branch: true }), deletedAt: null };
  if (q) where.OR = [{ name: { contains: q } }, { licenseNo: { contains: q } }, { phone: { contains: q } }];
  if (status && status !== "All") where.status = status;

  const rows = await prisma.driverMaster.findMany({ where, orderBy: { id: "desc" }, take: 500 });
  return NextResponse.json({ ok: true, rows: rows.map(toRow) });
}

// POST /api/transport/masters/driver — create a driver.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "DriverMaster" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = driverInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  try {
    const created = await prisma.driverMaster.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        name: b.name, licenseNo: b.licenseNo ?? null, licenseExpiry: b.licenseExpiry ?? null, phone: b.phone ?? null,
        transportCompanyId: b.transportCompanyId ?? null, status: b.status, remarks: b.remarks ?? null,
        createdBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_driver.create", entity: "DriverMaster", entityId: created.id,
      summary: `Created driver ${created.name}`, meta: { name: created.name },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, id: created.id, row: toRow(created), message: "Driver created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A driver with these details already exists." }, { status: 409 });
    }
    console.error("[transport/driver] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the driver." }, { status: 500 });
  }
}
