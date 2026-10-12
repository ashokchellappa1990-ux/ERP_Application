import { getUserPermissions } from "@/lib/auth/rbac";

/** Coupon module access — any of system.coupon / sales.coupon / sales.pos (cashiers redeem). */
export async function couponAllowed(user: { role?: string | null; roleId?: number | null }): Promise<boolean> {
  const perms = await getUserPermissions(user);
  return perms.includes("system.coupon") || perms.includes("sales.coupon") || perms.includes("sales.pos");
}
