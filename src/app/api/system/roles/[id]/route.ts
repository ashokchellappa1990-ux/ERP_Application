import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getUserPermissions, setRolePermissions } from "@/lib/auth/rbac";
import { ALL_PERMISSION_KEYS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

async function canManage(user: { role?: string | null; roleId?: number | null }) {
  return (await getUserPermissions(user)).includes("organization.user-roles");
}

// PATCH /api/system/roles/[id] — rename / re-describe / set permission keys.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, "organization.user-roles", { req, entity: "Role", entityId: id });
  if (denied) return denied;
  if (!(await canManage(user))) return NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

  let b: { name?: string; description?: string; permissionKeys?: string[] };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const role = await prisma.role.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!role) return NextResponse.json({ ok: false, message: "Role not found." }, { status: 404 });

  await prisma.role.update({
    where: { id: role.id },
    data: {
      name: !role.isSystem && b.name?.trim() ? b.name.trim().slice(0, 80) : undefined, // system role names are fixed
      description: b.description !== undefined ? (b.description.trim() || null) : undefined,
    },
  });

  // All-access roles always have every permission — don't store a partial grant set.
  let permissionKeys: string[] | undefined;
  if (Array.isArray(b.permissionKeys) && !role.isAllAccess) {
    permissionKeys = b.permissionKeys.filter((k) => ALL_PERMISSION_KEYS.includes(k));
    await setRolePermissions(role.id, permissionKeys);
  }

  await writeAudit(prisma, user, {
    action: "role.update", entity: "Role", entityId: role.id,
    summary: `Updated role ${b.name?.trim() || role.name}${permissionKeys ? ` (${permissionKeys.length} permission(s))` : ""}`,
    meta: { name: b.name?.trim(), description: b.description, permissionKeys },
    ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, message: "Role updated." });
}

// DELETE /api/system/roles/[id] — remove a custom role (system roles are protected).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, "organization.user-roles", { req, entity: "Role", entityId: id });
  if (denied) return denied;
  if (!(await canManage(user))) return NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

  const role = await prisma.role.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!role) return NextResponse.json({ ok: false, message: "Role not found." }, { status: 404 });
  if (role.isSystem) return NextResponse.json({ ok: false, message: "Predefined system roles can't be deleted." }, { status: 422 });

  const assigned = await prisma.user.count({ where: { roleId: role.id } });
  if (assigned > 0) return NextResponse.json({ ok: false, message: `Reassign the ${assigned} user(s) on this role first.` }, { status: 422 });

  await prisma.role.delete({ where: { id: role.id } });
  await writeAudit(prisma, user, {
    action: "role.delete", entity: "Role", entityId: role.id,
    summary: `Deleted role ${role.name}`,
    meta: { name: role.name, slug: role.slug },
    ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Role deleted." });
}
