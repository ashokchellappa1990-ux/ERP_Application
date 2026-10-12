import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere } from "@/lib/auth/scope";
import { dimensionDef, targetTypeDef } from "@/lib/contracts/salesTarget";

/**
 * ACHIEVEMENT MEASUREMENT — the bridge from a target line (dimension + type) to REAL sales.
 * Reuses the sales-dashboard conventions (Sale.status="Completed", total/cost/subtotal, SaleLine,
 * SalesReturn, SalesDocument order). Cost/Profit-Centre + Net-Profit are planning-only → null.
 */

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface MeasureSpec { dimensionType: string; dimensionRefId?: number | null; dimensionValue?: string | null; targetType: string }
export interface MeasureResult { actual: number | null; computable: boolean }

async function geoBranchIds(scope: ActiveScope, field: "state" | "city", value: string): Promise<number[]> {
  const w: Prisma.BranchWhereInput = { tenantId: scope.tenantId, [field]: value, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(scope.readBranchIds?.length ? { id: { in: scope.readBranchIds } } : {}) };
  const rows = await prisma.branch.findMany({ where: w, select: { id: true } });
  return rows.map((r) => r.id);
}

/** Sale where: scope + Completed + date window + the line's dimension filter (branch/exec/customer/channel/geo). */
async function saleWhere(scope: ActiveScope, spec: MeasureSpec, from: string, to: string): Promise<Prisma.SaleWhereInput> {
  const w = { ...(scopeWhere(scope, { branch: true }) as Prisma.SaleWhereInput), status: "Completed", saleDate: { gte: from, lte: to } };
  const def = dimensionDef(spec.dimensionType);
  switch (spec.dimensionType) {
    case "branch": case "salesoffice": case "store": if (spec.dimensionRefId != null) w.branchId = spec.dimensionRefId; break;
    case "executive": if (spec.dimensionRefId != null) w.cashierUserId = spec.dimensionRefId; break;
    case "customer": if (spec.dimensionRefId != null) w.customerId = spec.dimensionRefId; break;
    case "customerCategory": if (spec.dimensionValue) w.customer = { is: { category: spec.dimensionValue } }; break;
    case "channel": if (spec.dimensionValue) w.channel = spec.dimensionValue; break;
    case "region": case "state": if (spec.dimensionValue) w.branchId = { in: await geoBranchIds(scope, "state", spec.dimensionValue) }; break;
    case "city": if (spec.dimensionValue) w.branchId = { in: await geoBranchIds(scope, "city", spec.dimensionValue) }; break;
    default: break; // business / product-ish handled elsewhere
  }
  void def;
  return w;
}

/** Product filter for line-based measurement (product / category / brand dimensions). */
function productFilter(spec: MeasureSpec): Prisma.ProductWhereInput | null {
  if (spec.dimensionType === "product" && spec.dimensionRefId != null) return { id: spec.dimensionRefId };
  if (spec.dimensionType === "productCategory" && spec.dimensionValue) return { category: spec.dimensionValue };
  if (spec.dimensionType === "brand" && spec.dimensionValue) return { brand: spec.dimensionValue };
  return null;
}

export async function measure(scope: ActiveScope, spec: MeasureSpec, from: string, to: string): Promise<MeasureResult> {
  const tdef = targetTypeDef(spec.targetType);
  const ddef = dimensionDef(spec.dimensionType);
  if (!tdef || !ddef || ddef.computable === false || tdef.computable === false) return { actual: null, computable: false };

  const isProductDim = ddef.kind === "product" || ddef.kind === "prodValue";
  const where = await saleWhere(scope, spec, from, to);

  // ---- line-based, OR any product-dimension (measure through SaleLine) ----
  if (tdef.base === "line" || isProductDim) {
    const pf = productFilter(spec);
    const lineWhere: Prisma.SaleLineWhereInput = { sale: { is: where }, ...(pf ? { product: { is: pf } } : {}) };
    const agg = await prisma.saleLine.aggregate({ where: lineWhere, _sum: { qty: true, value: true } });
    const val = tdef.unit === "qty" ? num(agg._sum.qty) : num(agg._sum.value);
    return { actual: r2(val), computable: true };
  }

  // ---- order-based (SalesDocument order) ----
  if (tdef.base === "order") {
    const ow: Prisma.SalesDocumentWhereInput = { ...(scopeWhere(scope, { branch: true }) as Prisma.SalesDocumentWhereInput), docType: "order", docDate: { gte: from, lte: to } };
    if ((spec.dimensionType === "branch" || spec.dimensionType === "salesoffice" || spec.dimensionType === "store") && spec.dimensionRefId != null) ow.branchId = spec.dimensionRefId;
    const agg = await prisma.salesDocument.aggregate({ where: ow, _count: true, _avg: { netAmount: true } });
    return { actual: r2(spec.targetType === "avgOrderValue" ? num(agg._avg.netAmount) : agg._count), computable: true };
  }

  // ---- customer-based ----
  if (tdef.base === "customer") {
    if (spec.targetType === "repeatCustomers") {
      const rows = await prisma.sale.groupBy({ by: ["customerId"], where: { ...where, customerId: { not: null } }, _count: true });
      return { actual: rows.filter((r) => r._count > 1).length, computable: true };
    }
    // newCustomers / customerAcquisition — Customer.createdAt in window
    const cw: Prisma.CustomerWhereInput = { tenantId: scope.tenantId, createdAt: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) }, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
    if (spec.dimensionType === "customerCategory" && spec.dimensionValue) cw.category = spec.dimensionValue;
    return { actual: await prisma.customer.count({ where: cw }), computable: true };
  }

  // ---- sale-based ----
  const agg = await prisma.sale.aggregate({ where, _sum: { total: true, cost: true, subtotal: true }, _count: true, _avg: { total: true } });
  const total = num(agg._sum.total);
  switch (spec.targetType) {
    case "salesValue": return { actual: r2(total), computable: true };
    case "grossSales": return { actual: r2(num(agg._sum.subtotal)), computable: true };
    case "grossProfit": case "netProfit": return { actual: r2(total - num(agg._sum.cost)), computable: true };
    case "marginPct": return { actual: total > 0 ? r2(((total - num(agg._sum.cost)) / total) * 100) : 0, computable: true };
    case "invoiceCount": return { actual: agg._count, computable: true };
    case "avgInvoiceValue": return { actual: r2(num(agg._avg.total)), computable: true };
    case "netSales": {
      const rw: Prisma.SalesReturnWhereInput = { ...(scopeWhere(scope, { branch: true }) as Prisma.SalesReturnWhereInput), returnDate: { gte: from, lte: to } };
      if ((spec.dimensionType === "branch" || spec.dimensionType === "salesoffice" || spec.dimensionType === "store") && spec.dimensionRefId != null) rw.branchId = spec.dimensionRefId;
      if (spec.dimensionType === "customer" && spec.dimensionRefId != null) rw.customerId = spec.dimensionRefId;
      const ret = await prisma.salesReturn.aggregate({ where: rw, _sum: { refundAmount: true } });
      return { actual: r2(total - num(ret._sum.refundAmount)), computable: true };
    }
    default: return { actual: r2(total), computable: true };
  }
}
