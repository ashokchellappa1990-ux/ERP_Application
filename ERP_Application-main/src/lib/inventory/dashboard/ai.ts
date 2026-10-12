import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { BUCKET_WAREHOUSES } from "@/lib/inventory/buckets";
import { stockHealth, movement, type InvFilters } from "./service";

/**
 * Inventory AI insights — deterministic, data-driven recommendations (no external
 * model needed): replenishment, dead-stock prediction, demand forecasting and
 * warehouse-transfer suggestions. Matches the InsightT shape used by the other
 * dashboards' AI panels.
 */
const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface Insight { key: string; severity: "critical" | "high" | "medium" | "low"; title: string; detail: string; metric?: string; href?: string }

export async function inventoryInsights(scope: ActiveScope, f: InvFilters): Promise<Insight[]> {
  const out: Insight[] = [];
  const [{ cards }, mv] = await Promise.all([stockHealth(scope, f), movement(scope, f)]);
  const card = (k: string) => cards.find((c) => c.key === k);

  const low = card("lowStock")!, oos = card("outOfStock")!, exp = card("expired")!, near = card("nearExpiry")!, dmg = card("damaged")!;

  // 1) Replenishment
  if (low.count + oos.count > 0) out.push({ key: "replenish", severity: oos.count > 0 ? "high" : "medium", title: "Replenishment recommended", detail: `${oos.count} item(s) are out of stock and ${low.count} below reorder level. Raise purchase orders / stock transfers to avoid lost sales.`, metric: `${low.count + oos.count} SKUs`, href: "/purchase/order/new" });

  // 2) Dead-stock prediction — SKUs with stock but no outbound movement this period.
  const bizBranch = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(scope.readBranchIds?.length ? { branchId: { in: scope.readBranchIds } } : {}) };
  const [withStock, movedOut] = await Promise.all([
    prisma.inventoryBalance.findMany({ where: { ...bizBranch, qtyOnHand: { gt: 0 }, warehouse: { notIn: BUCKET_WAREHOUSES } }, select: { productId: true }, distinct: ["productId"], take: 5000 }),
    prisma.inventoryLedger.findMany({ where: { ...bizBranch, direction: "OUT", txnDate: { gte: `${f.period}-01` } }, select: { productId: true }, distinct: ["productId"], take: 5000 }),
  ]);
  const movedSet = new Set(movedOut.map((r) => r.productId));
  const dead = withStock.filter((r) => !movedSet.has(r.productId)).length;
  if (dead > 0) out.push({ key: "deadstock", severity: dead > 20 ? "high" : "medium", title: "Dead / slow-moving stock detected", detail: `${dead} SKU(s) hold stock but had no outbound movement this period. Consider promotions, liquidation or transfer to a higher-demand branch.`, metric: `${dead} SKUs`, href: "/inventory/ledger" });

  // 3) Near-expiry / expired
  if (exp.count > 0) out.push({ key: "expired", severity: "critical", title: "Expired stock on hand", detail: `${exp.count} SKU(s) (${exp.qty} units) have crossed their expiry date. Write off or return to supplier.`, metric: `${exp.qty} units`, href: "/inventory/tracking" });
  else if (near.count > 0) out.push({ key: "nearexpiry", severity: "high", title: "Demand forecast — clear near-expiry stock", detail: `${near.count} SKU(s) (${near.qty} units) expire within 30 days. Prioritise their sale/dispatch (FEFO) before they expire.`, metric: `${near.qty} units`, href: "/inventory/tracking" });

  // 4) Warehouse transfer suggestion — item short at one branch, surplus at another.
  const suggestion = await transferSuggestion(scope, f);
  if (suggestion) out.push(suggestion);

  // 5) Demand forecast — average daily outbound projected to 30 days.
  const { from, to } = { from: `${f.period}-01`, to: mv.trend.length ? mv.trend[mv.trend.length - 1].name : "" };
  void from; void to;
  if (mv.totalOut > 0 && mv.trend.length >= 3) {
    const perDay = mv.totalOut / mv.inOut.length;
    out.push({ key: "forecast", severity: "low", title: "Demand forecast (next 30 days)", detail: `At the current outbound run-rate (~${Math.round(perDay)} units/day) about ${Math.round(perDay * 30)} units will be consumed next month. Plan replenishment accordingly.`, metric: `${Math.round(perDay * 30)} units`, href: "/inventory/reorder" });
  }

  if (dmg.count > 0) out.push({ key: "damaged", severity: "medium", title: "Damaged / blocked stock to clear", detail: `${dmg.count} SKU(s) (${dmg.qty} units) sit in the damage bucket. Process write-offs or supplier returns to free space.`, metric: `${dmg.qty} units`, href: "/inventory/tracking" });

  return out.slice(0, 8);
}

/** Find one product that is low at some branch and surplus at another (rebalance). */
async function transferSuggestion(scope: ActiveScope, f: InvFilters): Promise<Insight | null> {
  if (!scope.readBranchIds || scope.readBranchIds.length < 2) return null;
  const bals = await prisma.inventoryBalance.groupBy({ by: ["productId", "branchId"], where: { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), branchId: { in: scope.readBranchIds }, warehouse: { notIn: BUCKET_WAREHOUSES }, ...(f.category ? { product: { is: { category: f.category } } } : {}) }, _sum: { qtyOnHand: true } });
  const byProd = new Map<number, { branchId: number; qty: number }[]>();
  for (const r of bals) { if (r.branchId == null) continue; const arr = byProd.get(r.productId) ?? []; arr.push({ branchId: r.branchId, qty: num(r._sum.qtyOnHand) }); byProd.set(r.productId, arr); }
  const products = await prisma.product.findMany({ where: { id: { in: [...byProd.keys()] } }, select: { id: true, name: true, reorderLevel: true, minStock: true } });
  for (const p of products) {
    const arr = byProd.get(p.id)!; const reorder = num(p.reorderLevel) || num(p.minStock) || 0;
    if (reorder <= 0) continue;
    const short = arr.find((x) => x.qty >= 0 && x.qty < reorder);
    const surplus = arr.find((x) => x.qty > reorder * 2);
    if (short && surplus && short.branchId !== surplus.branchId) {
      return { key: "rebalance", severity: "medium", title: "Warehouse transfer suggestion", detail: `"${p.name}" is low at one branch (${short.qty}) while another holds surplus (${surplus.qty}). Raise a stock transfer to rebalance.`, metric: p.name, href: "/warehouse/transfer/request/new" };
    }
  }
  return null;
}
