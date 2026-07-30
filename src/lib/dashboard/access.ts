/**
 * Dashboard capability gating.
 *
 * Every widget/KPI/chart on the enterprise dashboard is derived from the
 * logged-in user's RBAC permission keys (already the union of their role grants
 * and enabled features) plus the tenant's module flags. A capability is TRUE
 * only when the user is permitted to see that module's data — so the dashboard
 * automatically reshapes per role without any role-name switch statement.
 *
 * Permission keys are nav-derived `module.feature` strings (see
 * lib/auth/permissions.ts). All-access roles resolve to the full key set, so
 * they light up every capability.
 */

export interface TenantModuleFlags {
  moduleLoyalty?: boolean;
  modulePharmacy?: boolean;
  moduleEcommerce?: boolean;
}

export interface DashAccess {
  perms: string[];
  privileged: boolean;
  sales: boolean;
  purchase: boolean;
  inventory: boolean;
  finance: boolean;
  accounting: boolean;
  customers: boolean;
  suppliers: boolean;
  loyalty: boolean;
  membership: boolean;
  giftVoucher: boolean;
  coupon: boolean;
  promo: boolean;
  gst: boolean;
  pos: boolean;
  operations: boolean;
  /** May act on approvals (purchase/sales/finance approver). */
  approvals: boolean;
  /** Any module at all — a bare "dashboard"-only user still sees the shell. */
  any: boolean;
}

/** Build the capability map from permission keys + tenant module flags. */
export function buildAccess(perms: string[], flags: TenantModuleFlags = {}): DashAccess {
  const set = new Set(perms);
  const mods = new Set(perms.map((k) => k.split(".")[0]));
  const has = (key: string) => set.has(key);
  const mod = (m: string) => mods.has(m);
  const like = (needle: string) => perms.some((k) => k.includes(needle));

  const privileged = has("*") || perms.length > 60; // all-access roles expand to the full catalogue

  const sales = mod("sales") || mod("pos");
  const purchase = mod("purchase");
  const inventory = mod("inventory") || has("masters.product") || has("masters.opening-stock");
  const finance = mod("finance");
  const accounting = mod("accounting");
  const customers = mod("crm") || has("masters.customer") || sales;
  const suppliers = has("masters.supplier") || purchase;

  return {
    perms,
    privileged,
    sales,
    purchase,
    inventory,
    finance,
    accounting,
    customers,
    suppliers,
    // Engagement modules: permission-driven, and (where the tenant explicitly
    // toggles them) allowed by the module flag too. Flags only ADD, never hide,
    // because most tenants run these features via role grants, not the flag.
    loyalty: mod("loyalty") || like("loyalty") || !!flags.moduleLoyalty,
    membership: like("membership"),
    giftVoucher: like("gift-voucher"),
    coupon: like("coupon"),
    promo: like("promo"),
    gst: has("finance.gst") || like("gst"),
    pos: mod("pos"),
    operations: mod("operations"),
    approvals: purchase || finance || sales,
    any: perms.length > 0,
  };
}
