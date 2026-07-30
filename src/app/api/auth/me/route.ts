import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { toPublicUser } from "@/lib/auth/user";
import { getUserPermissions } from "@/lib/auth/rbac";

// GET /api/auth/me — current session user + RBAC role & permissions (or 401).
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }
  const permissions = await getUserPermissions(user);
  let roleName = user.role;
  if (user.roleId) {
    const role = await prisma.role.findUnique({ where: { id: user.roleId }, select: { name: true } });
    if (role) roleName = role.name;
  }
  return NextResponse.json({ ok: true, user: toPublicUser(user), role: roleName, permissions });
}
