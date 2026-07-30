import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserPermissions } from "@/lib/auth/rbac";
import { requestMeta } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";

/**
 * Server-side RBAC enforcement (Activity 7 of the platform roadmap).
 *
 * The client already filters menus/features by permission key (via /api/auth/me),
 * but until now nothing stopped a permitted-looking request from hitting an API
 * directly. `requirePermission` closes that hole at the route boundary.
 *
 * Non-breaking by design: owners / all-access roles and legacy users resolve to
 * the full key set in `getUserPermissions`, so anyone who can see a feature in the
 * sidebar can still use its API. It only blocks roles that were never granted it.
 *
 * Returns a ready-to-send 403 `NextResponse` when denied, or `null` when allowed:
 *   const denied = await requirePermission(user, "sales.return", { req, entity: "SalesReturn" });
 *   if (denied) return denied;
 */

export type GuardUser = {
  id: number;
  tenantId: number;
  fullName?: string | null;
  role?: string | null;
  roleId?: number | null;
};

interface GuardCtx {
  req?: Request; // supplies the client IP for the denial audit row
  entity?: string; // when set, the denial is recorded to the audit trail
  entityId?: string | number | null;
  businessId?: number | null;
  branchId?: number | null;
}

export async function requirePermission(user: GuardUser, key: string, ctx: GuardCtx = {}): Promise<NextResponse | null> {
  const perms = await getUserPermissions(user);
  if (perms.includes(key)) return null;

  // Record write-side denials to the audit trail (skipped for plain reads, which
  // pass no `entity` — avoids noise from unpermitted list polls).
  if (ctx.entity) {
    await writeAudit(prisma, user, {
      action: "rbac.denied", entity: ctx.entity, entityId: ctx.entityId ?? key,
      summary: `Permission denied: ${key}`,
      meta: { key, role: user.role ?? null, roleId: user.roleId ?? null },
      businessId: ctx.businessId ?? null, branchId: ctx.branchId ?? null,
      ip: ctx.req ? requestMeta(ctx.req).ip : null,
    });
  }
  return NextResponse.json({ ok: false, message: "You don't have permission to perform this action." }, { status: 403 });
}
