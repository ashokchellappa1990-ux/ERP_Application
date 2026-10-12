import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getUserPermissions } from "@/lib/auth/rbac";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { setUserTerminals } from "@/lib/pos/userTerminals";

async function canManage(user: { role?: string | null; roleId?: number | null }) {
  return (await getUserPermissions(user)).includes("organization.user-roles");
}

// PATCH /api/system/users/[id] — update role, business/branch, status or reset password.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, "organization.user-roles", { req, entity: "User", entityId: id });
  if (denied) return denied;
  if (!(await canManage(user))) return NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

  let b: { roleId?: number; businessId?: number | null; branchId?: number | null; status?: string; password?: string; fullName?: string; terminalIds?: number[] };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const target = await prisma.user.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!target) return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (b.fullName?.trim()) data.fullName = b.fullName.trim();
  if (b.status === "active" || b.status === "inactive" || b.status === "suspended") data.status = b.status;
  if (b.roleId) {
    const role = await prisma.role.findFirst({ where: { id: Number(b.roleId), tenantId: user.tenantId }, select: { id: true, slug: true } });
    if (!role) return NextResponse.json({ ok: false, message: "Invalid role." }, { status: 422 });
    data.roleId = role.id; data.role = role.slug;
  }
  if (b.businessId !== undefined) {
    data.businessId = b.businessId ? (await prisma.business.findFirst({ where: { id: Number(b.businessId), tenantId: user.tenantId }, select: { id: true } }))?.id ?? null : null;
  }
  if (b.branchId !== undefined) {
    data.branchId = b.branchId ? (await prisma.branch.findFirst({ where: { id: Number(b.branchId), tenantId: user.tenantId }, select: { id: true } }))?.id ?? null : null;
  }
  if (b.password) {
    if (b.password.length < 8) return NextResponse.json({ ok: false, message: "Password must be at least 8 characters." }, { status: 422 });
    data.passwordHash = await bcrypt.hash(b.password, 10);
  }

  await prisma.user.update({ where: { id: target.id }, data });
  if (Array.isArray(b.terminalIds)) await setUserTerminals(prisma, { tenantId: user.tenantId, userId: target.id, terminalIds: b.terminalIds, businessId: target.businessId, branchId: target.branchId, createdBy: user.id });
  await writeAudit(prisma, user, {
    action: "user.update", entity: "User", entityId: target.id,
    summary: `Updated user ${target.username}`,
    // Never log the password hash — record only that it was reset.
    meta: { fullName: data.fullName, status: data.status, roleId: data.roleId, role: data.role, businessId: data.businessId, branchId: data.branchId, passwordReset: !!data.passwordHash },
    businessId: target.businessId, branchId: target.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "User updated." });
}
