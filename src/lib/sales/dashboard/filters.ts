import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere } from "@/lib/auth/scope";

/**
 * Shared filters + scoped where-builders for the Sales Command Center. Every section query
 * funnels through these so the global filter bar (period / channel / branch / customer-category
 * / customer-type / product-category / brand / executive) applies consistently across
 * Sale (invoices) / SalesDocument (orders + quotations) / SalesReturn.
 *
 * NOTE on attribution (honest): the ERP does not store a Sales Executive on an invoice — only
 * `cashierUserId`. So "executive" here is the cashier-as-executive PROXY (mapped to User.fullName).
 * Region / State / City are DERIVED from the Branch (no territory master exists), surfaced as
 * analytics dimensions rather than filters.
 */

export interface SalesFilters {
  period?: string;             // yyyy-mm
  from?: string; to?: string;  // explicit date range (overrides period)
  fy?: string;
  channel?: string; branch?: string; customerCategory?: string; customerType?: string;
  category?: string; brand?: string; executive?: string;
  granularity?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
}

const lastDay = (period: string) => { const [y, m] = period.split("-").map(Number); return `${period}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`; };
export function periodRange(f: SalesFilters): { from: string; to: string } {
  if (f.from && f.to) return { from: f.from, to: f.to };
  const period = f.period || new Date().toISOString().slice(0, 7);
  return { from: `${period}-01`, to: lastDay(period) };
}
export function prevPeriodRange(f: SalesFilters): { from: string; to: string } {
  const period = f.period || new Date().toISOString().slice(0, 7);
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  const p = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { from: `${p}-01`, to: lastDay(p) };
}
export function yearRange(f: SalesFilters): { from: string; to: string } {
  const period = f.period || new Date().toISOString().slice(0, 7);
  const y = Number(period.split("-")[0]);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}
export function prevYearRange(f: SalesFilters): { from: string; to: string } {
  const period = f.period || new Date().toISOString().slice(0, 7);
  const y = Number(period.split("-")[0]) - 1;
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export const readFilters = (u: URL): SalesFilters => ({
  period: u.searchParams.get("period") || undefined, from: u.searchParams.get("from") || undefined, to: u.searchParams.get("to") || undefined,
  fy: u.searchParams.get("fy") || undefined, channel: u.searchParams.get("channel") || undefined, branch: u.searchParams.get("branch") || undefined,
  customerCategory: u.searchParams.get("customerCategory") || undefined, customerType: u.searchParams.get("customerType") || undefined,
  category: u.searchParams.get("category") || undefined, brand: u.searchParams.get("brand") || undefined, executive: u.searchParams.get("executive") || undefined,
  granularity: (u.searchParams.get("granularity") as SalesFilters["granularity"]) || undefined,
});

// -- scoped where builders (dimension filters + optional date window) --
function customerRel(f: SalesFilters): Prisma.CustomerWhereInput | undefined {
  const c: Prisma.CustomerWhereInput = {};
  if (f.customerCategory) c.category = f.customerCategory;
  if (f.customerType) c.type = f.customerType;
  return Object.keys(c).length ? c : undefined;
}

/** Sale (B2C POS + B2B invoices). */
export function saleWhere(scope: ActiveScope, f: SalesFilters, opts?: { date?: boolean }): Prisma.SaleWhereInput {
  const w = scopeWhere(scope, { branch: true }) as Prisma.SaleWhereInput;
  if (f.channel) w.channel = f.channel;
  if (f.branch) w.branchId = Number(f.branch);
  if (f.executive) w.cashierUserId = Number(f.executive);
  const cr = customerRel(f); if (cr) w.customer = { is: cr };
  if (opts?.date) { const { from, to } = periodRange(f); w.saleDate = { gte: from, lte: to }; }
  return w;
}
/** SalesDocument — caller sets docType (order | quotation). */
export function docWhere(scope: ActiveScope, f: SalesFilters, opts?: { date?: boolean }): Prisma.SalesDocumentWhereInput {
  const w = scopeWhere(scope, { branch: true }) as Prisma.SalesDocumentWhereInput;
  if (f.branch) w.branchId = Number(f.branch);
  if (f.executive) w.salesperson = { not: null };
  if (opts?.date) { const { from, to } = periodRange(f); w.docDate = { gte: from, lte: to }; }
  return w;
}
/** SalesReturn. */
export function returnWhere(scope: ActiveScope, f: SalesFilters, opts?: { date?: boolean }): Prisma.SalesReturnWhereInput {
  const w = scopeWhere(scope, { branch: true }) as Prisma.SalesReturnWhereInput;
  if (f.branch) w.branchId = Number(f.branch);
  // (customer category/type is not filtered on returns — SalesReturn has no customer relation)
  if (opts?.date) { const { from, to } = periodRange(f); w.returnDate = { gte: from, lte: to }; }
  return w;
}
/** Customers (for customer analytics). */
export function customerWhere(scope: ActiveScope, f: SalesFilters): Prisma.CustomerWhereInput {
  const w = scopeWhere(scope, { branch: true }) as Prisma.CustomerWhereInput;
  if (f.customerCategory) w.category = f.customerCategory;
  if (f.customerType) w.type = f.customerType;
  return w;
}
/** Product filter (category / brand) — applied to product-join sections. */
export function productMatches(f: SalesFilters, p: { category?: string | null; brand?: string | null } | null | undefined): boolean {
  if (f.category && (p?.category || "") !== f.category) return false;
  if (f.brand && (p?.brand || "") !== f.brand) return false;
  return true;
}

/** Distinct dropdown options for the filter bar. */
export async function filterOptions(scope: ActiveScope) {
  const sw = scopeWhere(scope, { branch: true });
  const branchWhere: Prisma.BranchWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(scope.readBranchIds?.length ? { id: { in: scope.readBranchIds } } : {}) };
  const [branches, custCats, custTypes, categories, brands, cashiers] = await Promise.all([
    prisma.branch.findMany({ where: branchWhere, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 }),
    prisma.customer.findMany({ where: { ...(sw as Prisma.CustomerWhereInput), category: { not: null } }, select: { category: true }, distinct: ["category"], take: 100 }),
    prisma.customer.findMany({ where: { ...(sw as Prisma.CustomerWhereInput), type: { not: null } }, select: { type: true }, distinct: ["type"], take: 100 }),
    prisma.product.findMany({ where: { tenantId: scope.tenantId, category: { not: null } }, select: { category: true }, distinct: ["category"], take: 200 }),
    prisma.product.findMany({ where: { tenantId: scope.tenantId, brand: { not: null } }, select: { brand: true }, distinct: ["brand"], take: 200 }),
    prisma.sale.findMany({ where: { ...(sw as Prisma.SaleWhereInput), cashierUserId: { not: null } }, select: { cashierUserId: true }, distinct: ["cashierUserId"], take: 100 }),
  ]);
  const cashierIds = cashiers.map((c) => c.cashierUserId).filter((x): x is number => x != null);
  const users = cashierIds.length ? await prisma.user.findMany({ where: { id: { in: cashierIds } }, select: { id: true, fullName: true } }) : [];
  return {
    channels: ["POS", "B2B"],
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    customerCategories: [...new Set(custCats.map((c) => c.category).filter((x): x is string => !!x))],
    customerTypes: [...new Set(custTypes.map((c) => c.type).filter((x): x is string => !!x))],
    categories: [...new Set(categories.map((c) => c.category).filter((x): x is string => !!x))],
    brands: [...new Set(brands.map((b) => b.brand).filter((x): x is string => !!x))],
    executives: users.map((u) => ({ id: u.id, name: u.fullName || `User ${u.id}` })),
  };
}

/** Role → visible tabs (still bounded by the `sales` RBAC key). */
export const ALL_TABS = ["overview", "trends", "customer", "analytics"] as const;
export type TabId = (typeof ALL_TABS)[number];
export function roleTabs(role: string | null | undefined): TabId[] {
  const r = (role ?? "").toLowerCase();
  const all = [...ALL_TABS];
  if (!r || /owner|admin|director|md\b|business.?head|sales.?manager|store.?manager|regional|branch/.test(r)) return all;
  if (/sales.?executive|sales.?rep/.test(r)) return ["overview", "trends", "customer"];
  if (/cashier/.test(r)) return ["overview", "trends"];
  return all; // any other permitted role sees everything
}
