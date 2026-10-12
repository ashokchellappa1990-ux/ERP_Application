import { getUserPermissions } from "@/lib/auth/rbac";
/** Anyone who can bill or expense may read available advances for a party. */
const ANY = ["finance.advance", "sales.invoice", "sales.pos", "purchase.invoice", "finance.petty-cash"];
export async function guardAnyAdvanceUse(user: { role?: string | null; roleId?: number | null }) {
  const perms = new Set(await getUserPermissions(user));
  return perms.has("*") || ANY.some((k) => perms.has(k));
}
