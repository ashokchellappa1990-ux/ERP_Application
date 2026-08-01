import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { weighbridgeInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

function toRow(r: {
  id: number; code: string; name: string; location: string | null; capacity: Prisma.Decimal | null;
  calibrationDueDate: string | null; status: string; remarks: string | null;
}) {
  return {
    id: r.id, code: r.code, name: r.name, location: r.location,
    capacity: r.capacity == null ? null : Number(r.capacity), calibrationDueDate: r.calibrationDueDate,
    status: r.status, remarks: r.remarks,
  };
}

// GET /api/transport/masters/weighbridge — list weighbridges (tenant/business/branch scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.WeighbridgeMasterWhereInput = { ...scopeWhere(scope, { branch: true }), deletedAt: null };
  if (q) where.OR = [{ code: { contains: q } }, { name: { contains: q } }, { location: { contains: q } }];
  if (status && status !== "All") where.status = status;

  const rows = await prisma.weighbridgeMaster.findMany({ where, orderBy: { id: "desc" }, take: 500 });
  return NextResponse.json({ ok: true, rows: rows.map(toRow) });
}

// POST /api/transport/masters/weighbridge — create a weighbridge.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "WeighbridgeMaster" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = weighbridgeInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  try {
    const created = await prisma.weighbridgeMaster.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        code: b.code, name: b.name, location: b.location ?? null, capacity: b.capacity ?? null,
        calibrationDueDate: b.calibrationDueDate ?? null, status: b.status, remarks: b.remarks ?? null,
        createdBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_weighbridge.create", entity: "WeighbridgeMaster", entityId: created.id,
      summary: `Created weighbridge ${created.code} — ${created.name}`, meta: { code: created.code, name: created.name },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, id: created.id, row: toRow(created), message: "Weighbridge created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A weighbridge with this code already exists.", errors: { code: "Already in use." } }, { status: 409 });
    }
    console.error("[transport/weighbridge] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the weighbridge." }, { status: 500 });
  }
}
