import { getUserPermissions } from "@/lib/auth/rbac";

/** Gift voucher access — management, the Sales screen, OR POS (cashiers redeem). */
export async function giftVoucherAllowed(user: { role?: string | null; roleId?: number | null }): Promise<boolean> {
  const perms = await getUserPermissions(user);
  return perms.includes("system.gift-voucher") || perms.includes("sales.gift-voucher-sales") || perms.includes("sales.pos");
}
