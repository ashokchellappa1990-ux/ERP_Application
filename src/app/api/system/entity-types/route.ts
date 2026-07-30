import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ensureEntityTypesSeeded } from "@/lib/system/branchHierarchy";

// GET /api/system/entity-types — the entity-type master (org-node categories).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "setup", { entity: "EntityType" });
  if (denied) return denied;

  await ensureEntityTypesSeeded(prisma, user.tenantId); // brand-new tenant gets the 16 defaults
  const rows = await prisma.entityType.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });
  const usage = await prisma.branch.groupBy({ by: ["entityTypeId"], where: { tenantId: user.tenantId, entityTypeId: { not: null } }, _count: true });
  const used = new Map(usage.map((u) => [u.entityTypeId, u._count as number]));
  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
      id: r.id, code: r.code, name: r.name, description: r.description, icon: r.icon, color: r.color,
      allowChild: r.allowChild, displayOrder: r.displayOrder, status: r.status, branchCount: used.get(r.id) ?? 0,
    })),
  });
}

// POST /api/system/entity-types — add a new entity type.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "setup", { req, entity: "EntityType" });
  if (denied) return denied;

  let b: { code?: string; name?: string; description?: string; icon?: string; color?: string; allowChild?: boolean; displayOrder?: number };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const name = (b.name ?? "").trim().slice(0, 80);
  const code = (b.code ?? "").trim().slice(0, 40).toUpperCase().replace(/\s+/g, "_");
  if (!name) return NextResponse.json({ ok: false, message: "Entity type name is required." }, { status: 422 });
  if (!code) return NextResponse.json({ ok: false, message: "Entity type code is required." }, { status: 422 });

  const dupe = await prisma.entityType.findFirst({ where: { tenantId: user.tenantId, code } });
  if (dupe) return NextResponse.json({ ok: false, message: `Code "${code}" already exists.` }, { status: 409 });

  const max = await prisma.entityType.aggregate({ where: { tenantId: user.tenantId }, _max: { displayOrder: true } });
  const created = await prisma.entityType.create({
    data: {
      tenantId: user.tenantId, code, name,
      description: b.description?.trim().slice(0, 300) || null,
      icon: b.icon?.trim().slice(0, 40) || "Building",
      color: b.color?.trim().slice(0, 20) || "#64748b",
      allowChild: b.allowChild ?? true,
      displayOrder: b.displayOrder ?? (max._max.displayOrder ?? 0) + 1,
      status: "active",
    },
  });

  await writeAudit(prisma, user, {
    action: "entityType.create", entity: "EntityType", entityId: created.id,
    summary: `Added entity type ${created.name} (${created.code})`,
    meta: { code: created.code, name: created.name, allowChild: created.allowChild }, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Entity type added.", id: created.id }, { status: 201 });
}
