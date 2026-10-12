import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { BUCKET_WAREHOUSES, BUCKET_WAREHOUSE, IN_TRANSIT_WAREHOUSE } from "@/lib/inventory/buckets";
import type { InvFilters } from "./service";

/** Live breakup for a clicked inventory widget — DrillData shape (title/columns/rows). */
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

interface DrillCol { key: string; label: string; type?: "money" | "number" | "percent" | "text" | "date"; align?: "left" | "right" | "center" }
interface DrillOut { title: string; subtitle?: string; summary?: { label: string; value: string; tone?: string }[]; columns: DrillCol[]; rows: Record<string, string | number>[] }

// A scope filter that is structurally valid for InventoryBalance / InventoryLedger /
// InventoryLot where-inputs (all share tenantId / businessId / branchId).
function biz(scope: ActiveScope, f: InvFilters): { tenantId: number; businessId?: number; branchId?: number | Prisma.IntFilter } {
  const branch = f.branch ? f.branch : scope.readBranchIds?.length ? { in: scope.readBranchIds } : undefined;
  return { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(branch != null ? { branchId: branch } : {}) };
}
const PROD_COLS: DrillCol[] = [{ key: "product", label: "Product", type: "text" }, { key: "sku", label: "SKU", type: "text" }, { key: "onHand", label: "On Hand", type: "number", align: "right" }, { key: "value", label: "Value", type: "money", align: "right" }];

async function productMap(ids: number[]) {
  if (!ids.length) return new Map<number, { name: string; sku: string; category: string; minStock: number; maxStock: number; reorder: number }>();
  const p = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, sku: true, code: true, category: true, minStock: true, maxStock: true, reorderLevel: true } });
  return new Map(p.map((x) => [x.id, { name: x.name, sku: x.sku ?? x.code ?? "", category: x.category ?? "Uncategorised", minStock: num(x.minStock), maxStock: num(x.maxStock), reorder: num(x.reorderLevel) || num(x.minStock) }]));
}

export async function drillInventory(scope: ActiveScope, f: InvFilters, widget: string): Promise<DrillOut> {
  const b = biz(scope, f);
  const goodWhere: Prisma.InventoryBalanceWhereInput = { ...b, warehouse: { notIn: BUCKET_WAREHOUSES }, ...(f.warehouse ? { warehouse: f.warehouse } : {}), ...(f.category || f.product ? { product: { is: { ...(f.category ? { category: f.category } : {}), ...(f.product ? { id: f.product } : {}) } } } : {}) };

  // Threshold-driven product widgets (low / out / over / negative / value / qty / available).
  const thresholdWidgets = ["lowStock", "outOfStock", "overStock", "negativeStock", "invValue", "stockQty", "available", "accuracy"];
  if (thresholdWidgets.includes(widget)) {
    const g = await prisma.inventoryBalance.groupBy({ by: ["productId"], where: goodWhere, _sum: { qtyOnHand: true, purchaseValue: true } });
    const pm = await productMap(g.map((x) => x.productId));
    let rows = g.map((x) => { const p = pm.get(x.productId); return { productId: x.productId, product: p?.name ?? `#${x.productId}`, sku: p?.sku ?? "", onHand: r2(num(x._sum.qtyOnHand)), value: r2(num(x._sum.purchaseValue)), reorder: p?.reorder ?? 0, max: p?.maxStock ?? 0 }; });
    if (widget === "lowStock") rows = rows.filter((r) => r.onHand > 0 && r.reorder > 0 && r.onHand < r.reorder);
    else if (widget === "outOfStock") rows = rows.filter((r) => r.onHand <= 0 && r.onHand === 0);
    else if (widget === "negativeStock") rows = rows.filter((r) => r.onHand < 0);
    else if (widget === "overStock") rows = rows.filter((r) => r.max > 0 && r.onHand > r.max);
    else if (widget === "accuracy") rows = rows.filter((r) => r.onHand < 0);
    rows.sort((a, b2) => (widget === "invValue" ? b2.value - a.value : Math.abs(b2.onHand) - Math.abs(a.onHand)));
    const cols = widget === "lowStock" || widget === "overStock"
      ? [...PROD_COLS.slice(0, 3), { key: widget === "overStock" ? "max" : "reorder", label: widget === "overStock" ? "Max" : "Reorder", type: "number" as const, align: "right" as const }, PROD_COLS[3]]
      : PROD_COLS;
    return { title: label(widget), subtitle: `${rows.length} product(s)`, summary: [{ label: "Products", value: String(rows.length) }, { label: "Total Value", value: `₹${r2(rows.reduce((s, r) => s + r.value, 0)).toLocaleString()}` }], columns: cols, rows: rows.slice(0, 200) };
  }

  if (widget === "stockIn" || widget === "stockOut") {
    const dir = widget === "stockIn" ? "IN" : "OUT";
    const led = await prisma.inventoryLedger.findMany({ where: { ...b, direction: dir, warehouse: { notIn: BUCKET_WAREHOUSES }, txnDate: { gte: `${f.period}-01` }, ...(f.warehouse ? { warehouse: f.warehouse } : {}) }, select: { txnDate: true, txnType: true, qty: true, productId: true, refNo: true }, orderBy: { id: "desc" }, take: 200 });
    const pm = await productMap([...new Set(led.map((l) => l.productId))]);
    const rows = led.map((l) => ({ date: l.txnDate, product: pm.get(l.productId)?.name ?? `#${l.productId}`, type: l.txnType.replace(/_/g, " "), ref: l.refNo ?? "—", qty: r2(num(l.qty)) }));
    return { title: label(widget), subtitle: `${rows.length} movement(s) this period`, columns: [{ key: "date", label: "Date", type: "date" }, { key: "product", label: "Product", type: "text" }, { key: "type", label: "Type", type: "text" }, { key: "ref", label: "Ref", type: "text" }, { key: "qty", label: "Qty", type: "number", align: "right" }], rows };
  }

  if (widget === "inTransit") {
    const g = await prisma.inventoryBalance.groupBy({ by: ["productId"], where: { ...b, warehouse: IN_TRANSIT_WAREHOUSE, qtyOnHand: { gt: 0 } }, _sum: { qtyOnHand: true } });
    const pm = await productMap(g.map((x) => x.productId));
    const rows = g.map((x) => ({ product: pm.get(x.productId)?.name ?? `#${x.productId}`, sku: pm.get(x.productId)?.sku ?? "", onHand: r2(num(x._sum.qtyOnHand)) })).sort((a, b2) => b2.onHand - a.onHand);
    return { title: "In Transit", subtitle: `${rows.length} product(s) in transit`, columns: [{ key: "product", label: "Product", type: "text" }, { key: "sku", label: "SKU", type: "text" }, { key: "onHand", label: "Qty", type: "number", align: "right" }], rows };
  }

  if (widget === "reserved") {
    const lots = await prisma.stockAllocationLot.groupBy({ by: ["productId"], where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: undefined } : {}), status: "Active", ...(scope.readBranchIds?.length ? { branchId: { in: scope.readBranchIds } } : {}) }, _sum: { qty: true } });
    const pm = await productMap(lots.map((x) => x.productId));
    const rows = lots.map((x) => ({ product: pm.get(x.productId)?.name ?? `#${x.productId}`, sku: pm.get(x.productId)?.sku ?? "", qty: r2(num(x._sum.qty)) })).sort((a, b2) => b2.qty - a.qty);
    return { title: "Reserved Stock", subtitle: `${rows.length} product(s) reserved`, columns: [{ key: "product", label: "Product", type: "text" }, { key: "sku", label: "SKU", type: "text" }, { key: "qty", label: "Reserved", type: "number", align: "right" }], rows };
  }

  if (widget === "nearExpiry" || widget === "expired") {
    const today = new Date().toISOString().slice(0, 10);
    const near = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const lots = await prisma.inventoryLot.findMany({ where: { ...b, qtyOnHand: { gt: 0 }, warehouse: { notIn: BUCKET_WAREHOUSES }, ...(widget === "expired" ? { expiryDate: { lt: today, not: null } } : { expiryDate: { gte: today, lte: near } }) }, select: { productId: true, batchNo: true, expiryDate: true, qtyOnHand: true }, orderBy: { expiryDate: "asc" }, take: 200 });
    const pm = await productMap([...new Set(lots.map((l) => l.productId))]);
    const rows = lots.map((l) => ({ product: pm.get(l.productId)?.name ?? `#${l.productId}`, batch: l.batchNo ?? "—", expiry: l.expiryDate ?? "—", qty: r2(num(l.qtyOnHand)) }));
    return { title: label(widget), subtitle: `${rows.length} batch(es)`, columns: [{ key: "product", label: "Product", type: "text" }, { key: "batch", label: "Batch", type: "text" }, { key: "expiry", label: "Expiry", type: "date" }, { key: "qty", label: "Qty", type: "number", align: "right" }], rows };
  }

  if (widget === "damaged" || widget === "blocked") {
    const wh = widget === "damaged" ? BUCKET_WAREHOUSE.damaged : BUCKET_WAREHOUSE.quarantine;
    const g = await prisma.inventoryBalance.groupBy({ by: ["productId"], where: { ...b, warehouse: wh, qtyOnHand: { gt: 0 } }, _sum: { qtyOnHand: true, purchaseValue: true } });
    const pm = await productMap(g.map((x) => x.productId));
    const rows = g.map((x) => ({ product: pm.get(x.productId)?.name ?? `#${x.productId}`, sku: pm.get(x.productId)?.sku ?? "", onHand: r2(num(x._sum.qtyOnHand)), value: r2(num(x._sum.purchaseValue)) })).sort((a, b2) => b2.value - a.value);
    return { title: label(widget), subtitle: `${rows.length} product(s) in ${wh}`, columns: PROD_COLS, rows };
  }

  // Analytics breakups (category / branch / warehouse) → drilled from a chart.
  if (widget === "byCategory" || widget === "byBranch" || widget === "byWarehouse") {
    const g = await prisma.inventoryBalance.findMany({ where: goodWhere, select: { qtyOnHand: true, purchaseValue: true, warehouse: true, branchId: true, productId: true } });
    const pm = await productMap([...new Set(g.map((x) => x.productId))]);
    const branches = await prisma.branch.findMany({ where: { tenantId: scope.tenantId }, select: { id: true, name: true } });
    const bn = new Map(branches.map((x) => [x.id, x.name]));
    const m = new Map<string, { qty: number; value: number }>();
    for (const x of g) {
      const key = widget === "byCategory" ? (pm.get(x.productId)?.category ?? "Uncategorised") : widget === "byBranch" ? (x.branchId != null ? bn.get(x.branchId) ?? `#${x.branchId}` : "—") : (x.warehouse || "Main Store");
      const cur = m.get(key) ?? { qty: 0, value: 0 }; cur.qty += num(x.qtyOnHand); cur.value += num(x.purchaseValue); m.set(key, cur);
    }
    const rows = [...m.entries()].map(([name, v]) => ({ name, qty: r2(v.qty), value: r2(v.value) })).sort((a, b2) => b2.value - a.value);
    return { title: label(widget), subtitle: `${rows.length} group(s)`, columns: [{ key: "name", label: widget === "byCategory" ? "Category" : widget === "byBranch" ? "Branch" : "Warehouse", type: "text" }, { key: "qty", label: "Qty", type: "number", align: "right" }, { key: "value", label: "Value", type: "money", align: "right" }], rows };
  }

  return { title: "Details", columns: [], rows: [] };
}

function label(w: string): string {
  const m: Record<string, string> = { lowStock: "Low Stock", outOfStock: "Out of Stock", overStock: "Over Stock", negativeStock: "Negative Stock", invValue: "Inventory Value — Top Products", stockQty: "Stock Quantity — Products", available: "Available Stock", accuracy: "Inventory Accuracy — Discrepancies", stockIn: "Stock In", stockOut: "Stock Out", nearExpiry: "Near Expiry", expired: "Expired Stock", damaged: "Damaged Stock", blocked: "Blocked Stock", byCategory: "Inventory by Category", byBranch: "Inventory by Branch", byWarehouse: "Warehouse Utilization" };
  return m[w] ?? w;
}
