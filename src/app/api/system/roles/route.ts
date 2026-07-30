import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { ensureRolesForTenant, getUserPermissions, setRolePermissions, slugifyRole } from "@/lib/auth/rbac";
import { ALL_PERMISSION_KEYS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

async function canManage(user: { role?: string | null; roleId?: number | null }) {
  const perms = await getUserPermissions(user);
  return perms.includes("organization.user-roles");
}

// GET /api/system/roles — roles with granted permission keys (+ user counts).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "organization.user-roles");
  if (denied) return denied;

  await ensureRolesForTenant(user.tenantId); // seed predefined roles on first access
  const roles = await prisma.role.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ isSystem: "desc" }, { id: "asc" }],
    include: { permissions: { include: { permission: { select: { key: true } } } }, _count: { select: { users: true } } },
  });

  return NextResponse.json({
    ok: true,
    roles: roles.map((r) => ({
      id: r.id, name: r.name, slug: r.slug, description: r.description ?? "", isSystem: r.isSystem, isAllAccess: r.isAllAccess,
      users: r._count.users,
      permissionKeys: r.isAllAccess ? [...ALL_PERMISSION_KEYS] : r.permissions.map((p) => p.permission.key),
    })),
  });
}

// POST /api/system/roles — create a custom role with a set of permission keys.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "organization.user-roles", { req, entity: "Role" });
  if (denied) return denied;
  if (!(await canManage(user))) return NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

  let b: { name?: string; description?: string; permissionKeys?: string[] };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const name = (b.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ ok: false, message: "Role name is required." }, { status: 422 });
  const slug = slugifyRole(name) || `role-${Date.now()}`;

  const exists = await prisma.role.findFirst({ where: { tenantId: user.tenantId, slug } });
  if (exists) return NextResponse.json({ ok: false, message: `A role named "${name}" already exists.` }, { status: 409 });

  const role = await prisma.role.create({
    data: { tenantId: user.tenantId, name, slug, description: b.description?.trim() || null, isSystem: false, isAllAccess: false },
  });
  const keys = (b.permissionKeys ?? []).filter((k) => ALL_PERMISSION_KEYS.includes(k));
  if (keys.length) await setRolePermissions(role.id, keys);

  await writeAudit(prisma, user, {
    action: "role.create", entity: "Role", entityId: role.id,
    summary: `Created role ${role.name} with ${keys.length} permission(s)`,
    meta: { name: role.name, slug: role.slug, description: role.description, permissionKeys: keys },
    ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, message: "Role created.", id: role.id }, { status: 201 });
}
