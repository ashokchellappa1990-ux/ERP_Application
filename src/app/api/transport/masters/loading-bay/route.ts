import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { loadingBayInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

function toRow(r: {
  id: number; code: string; name: string; warehouse: string | null; capacity: Prisma.Decimal | null;
  status: string; remarks: string | null;
}) {
  return {
    id: r.id, code: r.code, name: r.name, warehouse: r.warehouse,
    capacity: r.capacity == null ? null : Number(r.capacity), status: r.status, remarks: r.remarks,
  };
}

// GET /api/transport/masters/loading-bay — list loading bays (tenant/business/branch scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.LoadingBayWhereInput = { ...scopeWhere(scope, { branch: true }), deletedAt: null };
  if (q) where.OR = [{ code: { contains: q } }, { name: { contains: q } }, { warehouse: { contains: q } }];
  if (status && status !== "All") where.status = status;

  const rows = await prisma.loadingBay.findMany({ where, orderBy: { id: "desc" }, take: 500 });
  return NextResponse.json({ ok: true, rows: rows.map(toRow) });
}

// POST /api/transport/masters/loading-bay — create a loading bay.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoadingBay" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = loadingBayInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  try {
    const created = await prisma.loadingBay.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        code: b.code, name: b.name, warehouse: b.warehouse ?? null, capacity: b.capacity ?? null,
        status: b.status, remarks: b.remarks ?? null, createdBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_loading_bay.create", entity: "LoadingBay", entityId: created.id,
      summary: `Created loading bay ${created.code} — ${created.name}`, meta: { code: created.code, name: created.name },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, id: created.id, row: toRow(created), message: "Loading bay created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A loading bay with this code already exists.", errors: { code: "Already in use." } }, { status: 409 });
    }
    console.error("[transport/loading-bay] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the loading bay." }, { status: 500 });
  }
}
