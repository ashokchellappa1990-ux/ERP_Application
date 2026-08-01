import { NAV_SECTIONS, type NavItem } from "@/lib/navigation";

/**
 * Permission catalog + predefined roles for RBAC.
 *
 * A permission is a single feature/menu key derived from a navigation route
 * (e.g. "/masters/product" -> "masters.product"). After login the sidebar and
 * features are filtered to the keys the user's role grants, so a user only sees
 * what they're permitted to. The catalog is generated from the navigation so it
 * always covers every feature without a hand-maintained list.
 */

export interface PermissionDef { key: string; module: string; label: string; sortOrder: number }

/** Route -> permission key: first two path segments joined by a dot. Query strings
 *  and hashes are stripped so deep-links (e.g. /finance/reports?report=x) still map
 *  to their base permission (finance.reports). */
export function routeKey(href: string): string {
  const parts = href.split(/[?#]/)[0].replace(/^\/+/, "").split("/").filter(Boolean);
  return parts.slice(0, 2).join(".") || "dashboard";
}

export const PERMISSIONS: PermissionDef[] = (() => {
  const seen = new Map<string, PermissionDef>();
  let i = 0;
  const walk = (items: NavItem[], moduleLabel: string) => {
    for (const it of items) {
      if (it.href) {
        const key = routeKey(it.href);
        if (!seen.has(key)) seen.set(key, { key, module: moduleLabel, label: it.label, sortOrder: i++ });
      }
      if (it.children) walk(it.children, moduleLabel);
    }
  };
  for (const section of NAV_SECTIONS) walk(section.items, section.title);
  return Array.from(seen.values());
})();

export const ALL_PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key);

/** Permissions grouped by module — for the permission matrix UI. */
export function permissionsByModule(): { module: string; items: PermissionDef[] }[] {
  const groups = new Map<string, PermissionDef[]>();
  for (const p of PERMISSIONS) (groups.get(p.module) ?? groups.set(p.module, []).get(p.module)!).push(p);
  return Array.from(groups, ([module, items]) => ({ module, items }));
}

export interface PredefinedRole {
  slug: string;
  name: string;
  description: string;
  /** "*" = all permissions; else a list of key prefixes (first segment or exact key). */
  grants: "*" | string[];
}

export const PREDEFINED_ROLES: PredefinedRole[] = [
  { slug: "business-owner", name: "Business Owner", description: "Full access to everything.", grants: "*" },
  { slug: "admin", name: "Administrator", description: "Full administrative access.", grants: "*" },
  { slug: "store-manager", name: "Store Manager", description: "Day-to-day operations across modules.", grants: ["dashboard", "masters", "purchase", "inventory", "warehouse", "sales", "finance", "crm", "loyalty", "pos", "operations", "system.membership", "system.gift-voucher"] },
  { slug: "branch-manager", name: "Branch Manager", description: "Branch operations: sales, inventory, purchase.", grants: ["dashboard", "masters", "inventory", "warehouse", "sales", "purchase", "crm", "pos", "operations"] },
  { slug: "accountant", name: "Accountant", description: "Finance, accounting, supplier bills, gift voucher sales & reports.", grants: ["dashboard", "finance", "accounting", "operations.day-close", "purchase.invoice", "purchase.payments", "sales.gift-voucher-sales", "system.gift-voucher"] },
  { slug: "marketing-manager", name: "Marketing Manager", description: "Loyalty, coupon & promo campaigns, membership, gift vouchers, customers & CRM.", grants: ["dashboard", "loyalty", "crm", "masters.customer", "system.coupon", "sales.coupon", "system.promo", "sales.promo", "system.membership", "system.gift-voucher"] },
  { slug: "cashier", name: "Cashier", description: "POS billing and customers.", grants: ["dashboard", "sales", "masters.customer", "pos.sessions", "operations.day-close"] },
  { slug: "sales-executive", name: "Sales Executive", description: "Sales, customers & products.", grants: ["dashboard", "sales", "masters.customer", "masters.product"] },
  { slug: "purchase-executive", name: "Purchase Executive", description: "Purchase, suppliers & stock.", grants: ["dashboard", "purchase", "masters.supplier", "masters.product", "inventory"] },
  { slug: "inventory-manager", name: "Inventory Manager", description: "Inventory, stock & products.", grants: ["dashboard", "inventory", "warehouse", "masters.product", "masters.opening-stock", "purchase"] },
  { slug: "auditor", name: "Auditor", description: "Read access to finance, accounting & reports.", grants: ["dashboard", "finance", "accounting"] },
  { slug: "logistics-manager", name: "Logistics Manager", description: "Full transport & dispatch operations, masters and warehouse dispatch.", grants: ["dashboard", "transport", "masters.transport", "warehouse"] },
  { slug: "transport-manager", name: "Transport Manager", description: "Vehicle/driver/transport-company masters and transport operations.", grants: ["dashboard", "transport", "masters.transport"] },
  { slug: "dispatch-planner", name: "Dispatch Planner", description: "Plans dispatches and coordinates stock allocation/transfer.", grants: ["dashboard", "transport", "warehouse"] },
  { slug: "gate-security", name: "Gate Security", description: "Vehicle gate entry and gate exit only.", grants: ["transport.gate-entry", "transport.gate-exit"] },
  { slug: "weighbridge-operator", name: "Weighbridge Operator", description: "Pre and post loading weighment only.", grants: ["transport.pre-weighment", "transport.post-weighment"] },
  { slug: "loading-supervisor", name: "Loading Supervisor", description: "Load & Dispatch (loading, product confirmation) only.", grants: ["warehouse.transfer"] },
];

/** Expand a role's grants to concrete permission keys. */
export function expandGrants(grants: "*" | string[]): string[] {
  if (grants === "*") return [...ALL_PERMISSION_KEYS];
  return ALL_PERMISSION_KEYS.filter((k) => grants.some((g) => k === g || k.startsWith(g + ".") || k.split(".")[0] === g));
}

const ALL_SET = new Set(ALL_PERMISSION_KEYS);
/** Does the permission set allow this route? Unknown routes default to allowed. */
export function canAccessRoute(href: string, perms: Set<string>): boolean {
  const key = routeKey(href);
  if (!ALL_SET.has(key)) return true; // not a gated feature
  return perms.has(key);
}
