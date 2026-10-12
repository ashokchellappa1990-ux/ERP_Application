import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere } from "@/lib/auth/scope";

/**
 * Shared filters + scoped where-builders for the Procurement Command Center. Every section
 * query funnels through these so the global filter bar (period/supplier/buyer/warehouse/
 * category/purchaseType/status) applies consistently across PO / GRN / PI.
 */

export interface PurchaseFilters {
  period?: string;            // yyyy-mm
  from?: string; to?: string; // explicit date range (overrides period)
  fy?: string;
  supplier?: string; buyer?: string; category?: string; warehouse?: string; purchaseType?: string; status?: string;
  granularity?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
}

const lastDay = (period: string) => { const [y, m] = period.split("-").map(Number); return `${period}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`; };
export function periodRange(f: PurchaseFilters): { from: string; to: string } {
  if (f.from && f.to) return { from: f.from, to: f.to };
  const period = f.period || new Date().toISOString().slice(0, 7);
  return { from: `${period}-01`, to: lastDay(period) };
}
export function prevPeriodRange(f: PurchaseFilters): { from: string; to: string } {
  const period = f.period || new Date().toISOString().slice(0, 7);
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  const p = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { from: `${p}-01`, to: lastDay(p) };
}
export const readFilters = (u: URL): PurchaseFilters => ({
  period: u.searchParams.get("period") || undefined, from: u.searchParams.get("from") || undefined, to: u.searchParams.get("to") || undefined,
  fy: u.searchParams.get("fy") || undefined, supplier: u.searchParams.get("supplier") || undefined, buyer: u.searchParams.get("buyer") || undefined,
  category: u.searchParams.get("category") || undefined, warehouse: u.searchParams.get("warehouse") || undefined,
  purchaseType: u.searchParams.get("purchaseType") || undefined, status: u.searchParams.get("status") || undefined,
  granularity: (u.searchParams.get("granularity") as PurchaseFilters["granularity"]) || undefined,
});

// -- scoped where builders (dimension filters + optional date window) --
export function poWhere(scope: ActiveScope, f: PurchaseFilters, opts?: { date?: boolean }): Prisma.PurchaseOrderWhereInput {
  const w = scopeWhere(scope, { branch: true }) as Prisma.PurchaseOrderWhereInput;
  if (f.supplier) w.supplier = { contains: f.supplier };
  if (f.buyer) w.buyer = { contains: f.buyer };
  if (f.warehouse) w.warehouse = { contains: f.warehouse };
  if (f.purchaseType) w.purchaseType = f.purchaseType;
  if (f.status) w.status = f.status;
  if (opts?.date) { const { from, to } = periodRange(f); w.poDate = { gte: from, lte: to }; }
  return w;
}
export function piWhere(scope: ActiveScope, f: PurchaseFilters, opts?: { date?: boolean }): Prisma.PurchaseInvoiceWhereInput {
  const w = scopeWhere(scope, { branch: true }) as Prisma.PurchaseInvoiceWhereInput;
  if (f.supplier) w.supplier = { contains: f.supplier };
  if (f.warehouse) w.warehouse = { contains: f.warehouse };
  if (f.purchaseType) w.purchaseType = f.purchaseType;
  if (f.status) w.status = f.status;
  if (opts?.date) { const { from, to } = periodRange(f); w.supplierInvoiceDate = { gte: from, lte: to }; }
  return w;
}
export function grnWhere(scope: ActiveScope, f: PurchaseFilters, opts?: { date?: boolean }): Prisma.GoodsReceiptNoteWhereInput {
  const w = scopeWhere(scope, { branch: true }) as Prisma.GoodsReceiptNoteWhereInput;
  if (f.supplier) w.supplier = { contains: f.supplier };
  if (f.warehouse) w.warehouse = { contains: f.warehouse };
  if (opts?.date) { const { from, to } = periodRange(f); w.grnDate = { gte: from, lte: to }; }
  return w;
}
// Payable only shares scope + supplier (its `status` is Open/Partial/Paid — not a PO status).
export function payWhere(scope: ActiveScope, f: PurchaseFilters): Prisma.PayableWhereInput {
  const w = scopeWhere(scope, { branch: true }) as Prisma.PayableWhereInput;
  if (f.supplier) w.supplier = { contains: f.supplier };
  return w;
}
// PurchaseReturn shares scope + supplier + purchaseType + warehouse (its status differs from PO).
export function returnWhere(scope: ActiveScope, f: PurchaseFilters): Prisma.PurchaseReturnWhereInput {
  const w = scopeWhere(scope, { branch: true }) as Prisma.PurchaseReturnWhereInput;
  if (f.supplier) w.supplier = { contains: f.supplier };
  if (f.warehouse) w.warehouse = { contains: f.warehouse };
  if (f.purchaseType) w.purchaseType = f.purchaseType;
  return w;
}
// InventoryBalance shares scope + warehouse.
export function invWhere(scope: ActiveScope, f: PurchaseFilters): Prisma.InventoryBalanceWhereInput {
  const w = scopeWhere(scope, { branch: true }) as Prisma.InventoryBalanceWhereInput;
  if (f.warehouse) w.warehouse = { contains: f.warehouse };
  return w;
}
// Active suppliers (scope + name filter).
export function supplierWhere(scope: ActiveScope, f: PurchaseFilters): Prisma.SupplierWhereInput {
  const w = scopeWhere(scope, { branch: true }) as Prisma.SupplierWhereInput;
  w.status = "Active";
  if (f.supplier) w.name = { contains: f.supplier };
  return w;
}

/** Distinct dropdown options for the filter bar. */
export async function filterOptions(scope: ActiveScope) {
  const sw = scopeWhere(scope, { branch: true });
  const [suppliers, buyers, warehouses, categories] = await Promise.all([
    prisma.supplier.findMany({ where: { ...(sw as Prisma.SupplierWhereInput), status: "Active" }, select: { name: true }, orderBy: { name: "asc" }, take: 300 }),
    prisma.purchaseOrder.findMany({ where: { ...(sw as Prisma.PurchaseOrderWhereInput), buyer: { not: null } }, select: { buyer: true }, distinct: ["buyer"], take: 100 }),
    prisma.purchaseOrder.findMany({ where: { ...(sw as Prisma.PurchaseOrderWhereInput), warehouse: { not: null } }, select: { warehouse: true }, distinct: ["warehouse"], take: 100 }),
    prisma.product.findMany({ where: { tenantId: scope.tenantId, category: { not: null } }, select: { category: true }, distinct: ["category"], take: 200 }),
  ]);
  return {
    suppliers: suppliers.map((s) => s.name).filter(Boolean),
    buyers: [...new Set(buyers.map((b) => b.buyer).filter((x): x is string => !!x))],
    warehouses: [...new Set(warehouses.map((w) => w.warehouse).filter((x): x is string => !!x))],
    categories: [...new Set(categories.map((c) => c.category).filter((x): x is string => !!x))],
    purchaseTypes: ["Inventory", "Expense", "Service", "Asset"],
    statuses: ["Draft", "Approved", "Issued", "Partially Received", "Received", "Cancelled", "Closed"],
  };
}

/** Role → visible tabs (still bounded by the `purchase` RBAC key). */
export const ALL_TABS = ["overview", "pipeline", "trends", "suppliers", "analytics", "delivery", "budget", "ai", "approvals", "calendar", "reports", "notifications"] as const;
export type TabId = (typeof ALL_TABS)[number];
export function roleTabs(role: string | null | undefined): TabId[] {
  const r = (role ?? "").toLowerCase();
  const all = [...ALL_TABS];
  if (!r || /owner|admin|director|md\b|purchase.?manager|store.?manager/.test(r)) return all;
  if (/purchase.?executive|buyer/.test(r)) return ["overview", "pipeline", "trends", "delivery", "reports"];
  if (/account|finance/.test(r)) return ["overview", "budget", "approvals", "reports", "notifications"];
  if (/inventory|warehouse/.test(r)) return ["overview", "delivery", "analytics", "reports"];
  if (/branch/.test(r)) return ["overview", "pipeline", "trends", "suppliers", "analytics", "delivery"];
  return all; // any other permitted role sees everything
}
