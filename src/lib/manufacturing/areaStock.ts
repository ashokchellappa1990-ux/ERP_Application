import { prisma } from "@/lib/db/prisma";
import { BUCKET_WAREHOUSES } from "@/lib/inventory/buckets";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r3 = (n: number) => +n.toFixed(3);

export interface AreaWarehouseShare { warehouse: string; qty: number }

/**
 * Net available qty for a product tagged to a specific Area, broken down by
 * the underlying warehouse(s) that stock actually sits in.
 *
 * `InventoryBalance` (the on-hand snapshot) is warehouse-keyed only — it has
 * no `areaId` column, by design (see the schema comment on
 * `InventoryLedger.areaId`). `warehouse` and `areaId` are independent fields
 * set at receipt time (e.g. a GRN's "Warehouse" dropdown and its separate
 * "Inventory Movement Area" picker) — the same Area can end up holding stock
 * recorded under more than one warehouse string, or a warehouse the Area's
 * own name never matches at all.
 *
 * So Area-scoped on-hand can only be derived by aggregating the ledger
 * itself (IN − OUT per warehouse, filtered to this Area's tag) — the exact
 * same approach the Inventory Ledger page's Area filter already uses. This
 * returns the per-warehouse breakdown (largest first) so a caller can drain
 * each warehouse's real lots in turn when actually consuming stock.
 */
export async function getAreaStockBreakdown(tenantId: number, branchId: number | null, productId: number, areaId: number): Promise<AreaWarehouseShare[]> {
  const rows = await prisma.inventoryLedger.groupBy({
    by: ["warehouse", "direction"],
    where: { tenantId, ...(branchId ? { branchId } : {}), productId, areaId, warehouse: { notIn: BUCKET_WAREHOUSES } },
    _sum: { qty: true },
  });
  const byWarehouse = new Map<string, number>();
  for (const r of rows) {
    const wh = r.warehouse ?? "";
    if (!wh) continue;
    const q = num(r._sum.qty);
    byWarehouse.set(wh, (byWarehouse.get(wh) ?? 0) + (r.direction === "IN" ? q : -q));
  }
  return [...byWarehouse.entries()]
    .filter(([, qty]) => qty > 0.0005)
    .map(([warehouse, qty]) => ({ warehouse, qty: r3(qty) }))
    .sort((a, b) => b.qty - a.qty);
}

export async function getAreaAvailableQty(tenantId: number, branchId: number | null, productId: number, areaId: number): Promise<number> {
  const breakdown = await getAreaStockBreakdown(tenantId, branchId, productId, areaId);
  return r3(breakdown.reduce((s, b) => s + b.qty, 0));
}
