import { getUserPermissions } from "@/lib/auth/rbac";

/** Promo module access — any of system.promo / sales.promo / sales.pos (cashiers apply). */
export async function promoAllowed(user: { role?: string | null; roleId?: number | null }): Promise<boolean> {
  const perms = await getUserPermissions(user);
  return perms.includes("system.promo") || perms.includes("sales.promo") || perms.includes("sales.pos");
}
