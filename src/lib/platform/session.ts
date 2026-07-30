import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

/**
 * Platform Portal auth — COMPLETELY SEPARATE from the customer ERP session
 * (`pos_session`). Own cookie, own user/role tables, cross-tenant scope. Used
 * only by platform staff at the Platform Administration Portal.
 */
export const PLATFORM_COOKIE = "oneerp_platform_session";
const DAY_MS = 24 * 60 * 60 * 1000;

export function platformCookieOptions(remember: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: (remember ? 30 : 1) * 24 * 60 * 60 };
}

export interface PlatformUser { id: number; name: string; email: string; roleSlug: string; roleName: string; permissions: string[] }

export async function createPlatformSession(platformUserId: number, opts: { ip?: string; userAgent?: string; remember?: boolean }) {
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + (opts.remember ? 30 : 1) * DAY_MS);
  await prisma.platformSession.create({ data: { token, platformUserId, ipAddress: opts.ip, userAgent: opts.userAgent, expiresAt } });
  return { token, expiresAt };
}

function parsePerms(raw: string): string[] {
  if (raw.trim() === "*") return ["*"];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}

/** Resolve the current platform user from the platform cookie (or null). */
export async function getPlatformUser(): Promise<PlatformUser | null> {
  const token = cookies().get(PLATFORM_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.platformSession.findUnique({ where: { token }, include: { user: { include: { role: true } } } });
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.active) return null;
  const u = session.user;
  return { id: u.id, name: u.name, email: u.email, roleSlug: u.role.slug, roleName: u.role.name, permissions: parsePerms(u.role.permissions) };
}

/** Does the platform user have access to a section? Owner/Admin have "*". */
export function platformCan(user: PlatformUser | null, section: string): boolean {
  if (!user) return false;
  return user.permissions.includes("*") || user.permissions.includes(section);
}

/** Verify email + password against a platform user. */
export async function verifyPlatformCredentials(email: string, password: string) {
  const u = await prisma.platformUser.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!u || !u.active || !(await bcrypt.compare(password, u.passwordHash))) return null;
  return u;
}

// --------------------------------------------------------------- bootstrap
export const PLATFORM_ROLES = [
  { slug: "platform-owner", name: "Platform Owner", description: "Complete access to the platform.", permissions: "*" },
  { slug: "platform-admin", name: "Platform Administrator", description: "Full platform administration.", permissions: "*" },
  { slug: "product-manager", name: "Product Manager", description: "Product config, plans, features, modules.", permissions: JSON.stringify(["dashboard", "product-config", "features", "modules", "plans", "trial-plans", "settings", "reports"]) },
  { slug: "sales-admin", name: "Sales Administrator", description: "Tenants, trials, subscriptions, plans.", permissions: JSON.stringify(["dashboard", "tenants", "trials", "subscriptions", "plans", "conversion", "reports"]) },
  { slug: "finance-admin", name: "Finance Administrator", description: "Billing, payments, subscriptions.", permissions: JSON.stringify(["dashboard", "billing", "payments", "subscriptions", "reports"]) },
  { slug: "customer-success", name: "Customer Success Manager", description: "Tenants, trials, subscriptions, support.", permissions: JSON.stringify(["dashboard", "tenants", "trials", "subscriptions", "support", "notifications", "reports"]) },
  { slug: "support-admin", name: "Support Administrator", description: "Support actions + tenants.", permissions: JSON.stringify(["dashboard", "tenants", "support", "notifications"]) },
  { slug: "viewer", name: "Viewer", description: "Read-only dashboards & reports.", permissions: JSON.stringify(["dashboard", "reports"]) },
] as const;

/** Seed the 8 platform roles + a bootstrap Platform Owner if none exist. Returns
 *  the default owner creds only when it was just created (for first-run display). */
export async function ensurePlatformBootstrap(): Promise<{ created: boolean; email: string; password: string }> {
  for (const r of PLATFORM_ROLES) {
    await prisma.platformRole.upsert({ where: { slug: r.slug }, create: { slug: r.slug, name: r.name, description: r.description, permissions: r.permissions, isSystem: true }, update: { name: r.name, permissions: r.permissions, isSystem: true } });
  }
  const count = await prisma.platformUser.count();
  const email = "owner@oneerp.example"; const password = "Platform@123";
  if (count === 0) {
    const owner = await prisma.platformRole.findUnique({ where: { slug: "platform-owner" } });
    await prisma.platformUser.create({ data: { name: "Platform Owner", email, passwordHash: await bcrypt.hash(password, 10), platformRoleId: owner!.id, active: true } });
    return { created: true, email, password };
  }
  return { created: false, email, password: "" };
}
