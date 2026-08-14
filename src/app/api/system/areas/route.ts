import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { AreaSaveSchema, type AreaRow } from "@/lib/contracts/area";

// Must match the permission key auto-derived from the sidebar route
// (/system/areas → "system.areas") — see routeKey() in lib/auth/permissions.ts.
const PERM = "system.areas";

// GET /api/system/areas — area list (flat; UI renders the hierarchy), + branches
// for the filter bar / Add modal. Optional ?branchId=&type=&status=&q= filters.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId");
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const branchName = (id: number) => allowed.branches.find((b) => b.id === id)?.name ?? null;

  const where: Record<string, unknown> = { tenantId: user.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  if (branchId) where.branchId = Number(branchId);
  if (type) where.type = type;
  if (status) where.status = status;
  if (q) where.OR = [{ code: { contains: q } }, { name: { contains: q } }];

  const [rows, childCounts] = await Promise.all([
    prisma.area.findMany({ where, orderBy: [{ branchId: "asc" }, { code: "asc" }] }),
    prisma.area.groupBy({ by: ["parentAreaId"], where: { tenantId: user.tenantId, parentAreaId: { not: null } }, _count: true }),
  ]);
  const cc = new Map(childCounts.map((c) => [c.parentAreaId, c._count as number]));
  const parentNames = new Map(rows.map((r) => [r.id, r.name]));
  const list: AreaRow[] = rows.map((r) => ({
    id: r.id, code: r.code, name: r.name, branchId: r.branchId, branchName: branchName(r.branchId),
    type: r.type, parentAreaId: r.parentAreaId, parentAreaName: r.parentAreaId ? (parentNames.get(r.parentAreaId) ?? null) : null,
    childCount: cc.get(r.id) ?? 0, status: r.status as AreaRow["status"], createdAt: r.createdAt.toISOString(),
  }));
  const branches = allowed.branches.filter((b) => b.businessId === scope.businessId).map((b) => ({ id: b.id, name: b.name }));
  return NextResponse.json({ ok: true, rows: list, branches });
}

// POST /api/system/areas — create an area (auto code prefix not applied — the
// user supplies their own code, matching the spec's "RM-001"-style examples).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "Area" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = AreaSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const branch = allowed.branches.find((x) => x.id === b.branchId && x.businessId === scope.businessId);
  if (!branch) return NextResponse.json({ ok: false, message: "Selected branch was not found." }, { status: 422 });
  const branchRow = await prisma.branch.findFirst({ where: { id: b.branchId, tenantId: user.tenantId }, select: { status: true } });
  if (!branchRow || branchRow.status.toLowerCase() !== "active") return NextResponse.json({ ok: false, message: "Cannot add an area to an inactive branch." }, { status: 422 });

  const dupe = await prisma.area.findFirst({ where: { tenantId: user.tenantId, branchId: b.branchId, code: b.code } });
  if (dupe) return NextResponse.json({ ok: false, message: `Area code "${b.code}" already exists in this branch.` }, { status: 409 });

  if (b.parentAreaId) {
    const parent = await prisma.area.findFirst({ where: { id: b.parentAreaId, tenantId: user.tenantId }, select: { branchId: true } });
    if (!parent) return NextResponse.json({ ok: false, message: "Parent area not found." }, { status: 422 });
    if (parent.branchId !== b.branchId) return NextResponse.json({ ok: false, message: "Parent area must belong to the same branch." }, { status: 422 });
  }

  const created = await prisma.area.create({
    data: {
      tenantId: user.tenantId, businessId: scope.businessId ?? null, branchId: b.branchId,
      code: b.code, name: b.name, type: b.type, parentAreaId: b.parentAreaId ?? null,
      description: b.description ?? null, status: b.status, createdBy: user.id,
    },
  });
  await writeAudit(prisma, user, { action: "area.create", entity: "Area", entityId: created.id, summary: `Area ${created.code} — ${b.name}`, meta: { code: b.code, name: b.name, type: b.type, branchId: b.branchId }, businessId: scope.businessId ?? null, branchId: b.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, message: "Area created." }, { status: 201 });
}
