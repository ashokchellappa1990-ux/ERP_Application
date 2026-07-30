import { getUserPermissions } from "@/lib/auth/rbac";

/** Discount module access — masters.discount, or the POS/sales roles that bill. */
export async function discountAllowed(user: { role?: string | null; roleId?: number | null }): Promise<boolean> {
  const perms = await getUserPermissions(user);
  return perms.includes("masters.discount") || perms.includes("system.discount") || perms.includes("sales.pos");
}
