import { getUserPermissions } from "@/lib/auth/rbac";

/** Anyone who can work with sales invoices, orders or quotations may read the SO lookup. */
const ANY = ["sales.invoice", "sales.order", "sales.quotation"];
export async function guardAnySales(user: { role?: string | null; roleId?: number | null }) {
  const perms = new Set(await getUserPermissions(user));
  return perms.has("*") || ANY.some((k) => perms.has(k));
}
