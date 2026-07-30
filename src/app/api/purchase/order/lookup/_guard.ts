import { getUserPermissions } from "@/lib/auth/rbac";

/** Anyone who can work with purchase orders, invoices or GRNs may read the PO lookup. */
const ANY = ["purchase.order", "purchase.invoice", "purchase.grn"];
export async function guardAnyPurchase(user: { role?: string | null; roleId?: number | null }) {
  const perms = new Set(await getUserPermissions(user));
  return perms.has("*") || ANY.some((k) => perms.has(k));
}
