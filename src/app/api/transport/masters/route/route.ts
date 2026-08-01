import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { routeInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

function toRow(r: {
  id: number; code: string; name: string; sourceBranchId: number | null; destinationBranchId: number | null;
  distanceKm: Prisma.Decimal | null; estimatedHours: Prisma.Decimal | null; status: string; remarks: string | null;
}) {
  return {
    id: r.id, code: r.code, name: r.name, sourceBranchId: r.sourceBranchId, destinationBranchId: r.destinationBranchId,
    distanceKm: r.distanceKm == null ? null : Number(r.distanceKm), estimatedHours: r.estimatedHours == null ? null : Number(r.estimatedHours),
    status: r.status, remarks: r.remarks,
  };
}

// GET /api/transport/masters/route — list routes (tenant/business/branch scoped) + branch
// options for the source/destination selects (mirrors the Cost Centre master pattern).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.RouteMasterWhereInput = { ...scopeWhere(scope, { branch: true }), deletedAt: null };
  if (q) where.OR = [{ code: { contains: q } }, { name: { contains: q } }];
  if (status && status !== "All") where.status = status;

  const [rows, allowed] = await Promise.all([
    prisma.routeMaster.findMany({ where, orderBy: { id: "desc" }, take: 500 }),
    getAllowedScope(user),
  ]);
  const branches = allowed.branches.filter((b) => b.businessId === scope.businessId).map((b) => ({ id: b.id, name: b.name }));
  return NextResponse.json({ ok: true, rows: rows.map(toRow), branches });
}

// POST /api/transport/masters/route — create a route.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "RouteMaster" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = routeInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  try {
    const created = await prisma.routeMaster.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        code: b.code, name: b.name, sourceBranchId: b.sourceBranchId ?? null, destinationBranchId: b.destinationBranchId ?? null,
        distanceKm: b.distanceKm ?? null, estimatedHours: b.estimatedHours ?? null, status: b.status, remarks: b.remarks ?? null,
        createdBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_route.create", entity: "RouteMaster", entityId: created.id,
      summary: `Created route ${created.code} — ${created.name}`, meta: { code: created.code, name: created.name },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, id: created.id, row: toRow(created), message: "Route created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A route with this code already exists.", errors: { code: "Already in use." } }, { status: 409 });
    }
    console.error("[transport/route] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the route." }, { status: 500 });
  }
}
