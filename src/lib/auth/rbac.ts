import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { PERMISSIONS, PREDEFINED_ROLES, ALL_PERMISSION_KEYS, expandGrants } from "@/lib/auth/permissions";

export const slugifyRole = (s: string) =>
  (s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Sync the global permission catalog: insert any keys from the nav-derived
 *  PERMISSIONS that aren't in the DB yet (idempotent & cheap — only upserts the
 *  missing ones). Must run before mapping keys→ids so newly-added features (e.g.
 *  operations.day-close, pos.*) are persistable on a role. */
export async function ensurePermissionCatalog(): Promise<void> {
  const existing = await prisma.permission.findMany({ select: { key: true } });
  const have = new Set(existing.map((p) => p.key));
  const missing = PERMISSIONS.filter((p) => !have.has(p.key));
  for (const p of missing) {
    await prisma.permission.upsert({ where: { key: p.key }, create: p, update: { module: p.module, label: p.label, sortOrder: p.sortOrder } });
  }
}

/** Seed the predefined roles + their grants for a tenant (only what's missing,
 *  so customised grants are preserved). Returns the owner role id. */
export async function ensureRolesForTenant(tenantId: number): Promise<number | null> {
  await ensurePermissionCatalog();
  const perms = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permByKey = new Map(perms.map((p) => [p.key, p.id]));

  let ownerRoleId: number | null = null;
  for (const r of PREDEFINED_ROLES) {
    let role = await prisma.role.findFirst({ where: { tenantId, slug: r.slug } });
    if (!role) {
      role = await prisma.role.create({
        data: { tenantId, slug: r.slug, name: r.name, description: r.description, isSystem: true, isAllAccess: r.grants === "*" },
      });
    }
    // Top-up: grant any grant-implied permissions this system role is still missing
    // (additive, skipDuplicates) so new features/modules under a role's grant prefix
    // become visible without manually re-editing every role. Customisations (extra
    // grants an admin added) are preserved; only missing defaults are added.
    if (!role.isAllAccess && r.grants !== "*") {
      const ids = expandGrants(r.grants).map((k) => permByKey.get(k)).filter((x): x is number => !!x);
      if (ids.length) await prisma.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: role!.id, permissionId })), skipDuplicates: true });
    }
    if (r.slug === "business-owner") ownerRoleId = role.id;
  }
  return ownerRoleId;
}

// getUserPermissions backs requirePermission(), which runs on essentially
// every API request (often more than once per page load) — the role+grants
// join it does was completely uncached, adding a fixed query to every single
// request regardless of what that request actually does. Role grants change
// rarely (an admin editing the permission matrix, not a per-second event), so
// a short TTL cache — same pattern as getAllowedScope in scope.ts — removes
// that fixed cost for the overwhelmingly common case of many requests per
// user within a few seconds, at the price of up to 30s staleness after a
// grant change (acceptable: RBAC guard checks still run, they just read a
// slightly-stale permission list for that window).
const PERMISSIONS_CACHE_TTL_MS = 30_000;
const permissionsCache = new Map<number, { data: string[]; expiresAt: number }>();

/** Resolve the effective permission keys for a user. */
export async function getUserPermissions(user: { role?: string | null; roleId?: number | null }): Promise<string[]> {
  if (user.roleId) {
    const cached = permissionsCache.get(user.roleId);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const role = await prisma.role.findUnique({
      where: { id: user.roleId },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });
    if (role) {
      const keys = role.isAllAccess ? [...ALL_PERMISSION_KEYS] : role.permissions.map((rp) => rp.permission.key);
      if (permissionsCache.size > 500) permissionsCache.clear();
      permissionsCache.set(user.roleId, { data: keys, expiresAt: Date.now() + PERMISSIONS_CACHE_TTL_MS });
      return keys;
    }
  }
  // Legacy fallback when no roleId is set (e.g. pre-RBAC users).
  const r = (user.role ?? "").toLowerCase();
  if (["owner", "admin", "super-admin", "business-owner"].includes(r)) return [...ALL_PERMISSION_KEYS];
  const pre = PREDEFINED_ROLES.find((p) => p.slug === slugifyRole(user.role ?? ""));
  if (pre) return expandGrants(pre.grants);
  return ["dashboard"];
}

/** Called after editing a role's grants so callers see the change immediately
 *  instead of waiting out the cache TTL. */
export function invalidateUserPermissionsCache(roleId?: number) {
  if (roleId != null) permissionsCache.delete(roleId);
  else permissionsCache.clear();
}

/** Replace a role's grants with the given permission keys (matrix save). */
export async function setRolePermissions(roleId: number, keys: string[]): Promise<void> {
  // Make sure every selected key exists in the catalog (covers newly-added
  // features that predate this tenant's last catalog sync) before mapping.
  await ensurePermissionCatalog();
  const perms = await prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true } });
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })), skipDuplicates: true }),
  ]);
  invalidateUserPermissionsCache(roleId);
}

export type { Prisma };
