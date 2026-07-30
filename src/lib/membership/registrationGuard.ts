import { getUserPermissions } from "@/lib/auth/rbac";

/** Membership Registration (CRM) access. */
export async function membershipRegAllowed(user: { role?: string | null; roleId?: number | null }): Promise<boolean> {
  const perms = await getUserPermissions(user);
  return perms.includes("crm.membership");
}
