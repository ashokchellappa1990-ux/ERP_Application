import { getUserPermissions } from "@/lib/auth/rbac";

/** Membership configuration access. */
export async function membershipAllowed(user: { role?: string | null; roleId?: number | null }): Promise<boolean> {
  const perms = await getUserPermissions(user);
  return perms.includes("system.membership");
}
