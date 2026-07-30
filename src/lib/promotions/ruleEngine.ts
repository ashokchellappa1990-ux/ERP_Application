/**
 * Shared Promotion Rule Engine.
 *
 * The single source of truth for evaluating a promotion rule (purchase rules,
 * metadata conditions, applicable days, usage limits) and computing the discount.
 * Used by BOTH the Coupon module (`validateCoupon`) and the Promo Code module
 * (`validatePromo`) so there is exactly ONE rule engine — the caller only supplies
 * the code/campaign-specific lookups (which redemption table to count, the product
 * metadata map) and this engine does the rest.
 *
 * Rules live in the shared `coupon_rule_master` table (a rule row may belong to a
 * coupon campaign OR a promo campaign); this engine is agnostic to which.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const parseArr = (json: string): (string | number)[] => {
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : [v]; }
  catch { return json.split(",").map((x) => x.trim()).filter(Boolean); }
};

/** The subset of a `coupon_rule_master` row (with conditions) the engine needs. */
export interface PromotionRule {
  discountType: string;
  discountValue: unknown; maxDiscount: unknown; minDiscount: unknown;
  minBill: unknown; maxBill: unknown; minQty: unknown; minProductCount: number;
  buyProductId: number | null; getProductId: number | null; getQty: unknown;
  reduceTaxable: boolean; gstRule: string; usageType: string; days: string | null;
  maxPerCustomer: number; maxPerInvoice: number; maxPerDay: number; maxPerCampaign: number;
  conditions: { condType: string; operator: string; valueJson: string }[];
}

/** The bill being evaluated (POS / online / B2B). */
export interface PromotionBillContext {
  billAmount: number;
  items: { productId?: number | null; qty?: unknown; amount: unknown }[];
  customerId?: number | null;
  channel?: string | null;
  paymentMode?: string | null;
  date: string; // yyyy-mm-dd
}

/** Redemption counts already fetched from the relevant table (coupon/promo). */
export interface UsageCounts { campaign: number; customer: number; day: number }

export interface RuleEvalResult {
  valid: boolean; reason: string; discountType: string; discountAmount: number;
  taxableReduced: number; gstRule: string; freeProductId: number | null; freeQty: number;
}

type Client = PrismaClient | Prisma.TransactionClient;
export type ProductMeta = Map<number, { category: string | null; brand: string | null }>;

/** Load the category/brand of the billed products (used by Product/Category/Brand rules). */
export async function loadProductMeta(client: Client, productIds: number[]): Promise<ProductMeta> {
  const ids = [...new Set(productIds.filter((x): x is number => !!x))];
  if (!ids.length) return new Map();
  const rows = await client.product.findMany({ where: { id: { in: ids } }, select: { id: true, category: true, brand: true } });
  return new Map(rows.map((p) => [p.id, { category: p.category, brand: p.brand }]));
}

/** Purchase rules: min/max bill, min qty, min product count. */
export function checkPurchase(rule: PromotionRule, ctx: PromotionBillContext): string | null {
  const items = ctx.items ?? [];
  const totalQty = items.reduce((a, i) => a + num(i.qty), 0);
  const productCount = items.filter((i) => num(i.amount) > 0).length;
  if (num(rule.minBill) > 0 && ctx.billAmount < num(rule.minBill)) return `Minimum bill ₹${num(rule.minBill)} required.`;
  if (num(rule.maxBill) > 0 && ctx.billAmount > num(rule.maxBill)) return `Bill exceeds the campaign maximum ₹${num(rule.maxBill)}.`;
  if (num(rule.minQty) > 0 && totalQty < num(rule.minQty)) return `Minimum quantity ${num(rule.minQty)} required.`;
  if (rule.minProductCount > 0 && productCount < rule.minProductCount) return `Minimum ${rule.minProductCount} products required.`;
  return null;
}

/** Metadata include/exclude conditions (channel, payment, customer, product/category/brand). */
export function checkConditions(rule: PromotionRule, ctx: PromotionBillContext, prodMeta: ProductMeta): string | null {
  const prodIds = (ctx.items ?? []).map((i) => i.productId).filter((x): x is number => !!x);
  for (const cond of rule.conditions) {
    const vals = parseArr(cond.valueJson).map(String);
    const inList = (x: unknown) => vals.includes(String(x));
    const not = cond.operator === "not_in";
    if (cond.condType === "Channel") { if (not ? inList(ctx.channel) : !inList(ctx.channel)) return "Not valid for this sales channel."; }
    else if (cond.condType === "Payment") { if (not ? inList(ctx.paymentMode) : !inList(ctx.paymentMode)) return "Not valid for this payment mode."; }
    else if (cond.condType === "Customer") { if (!inList(ctx.customerId)) return "Not valid for this customer."; }
    else if (cond.condType === "Product") { const match = prodIds.some(inList); if (not ? match : !match) return "Applicable products not in the bill."; }
    else if (cond.condType === "Category") { const match = prodIds.map((id) => prodMeta.get(id)?.category).some((c) => inList(c)); if (not ? match : !match) return "Applicable category not in the bill."; }
    else if (cond.condType === "Brand") { const match = prodIds.map((id) => prodMeta.get(id)?.brand).some((b) => inList(b)); if (not ? match : !match) return "Applicable brand not in the bill."; }
  }
  // Applicable days of week
  if (rule.days) {
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(ctx.date + "T00:00:00").getDay()];
    if (!rule.days.split(",").map((x) => x.trim()).includes(dow)) return "Not valid on this day.";
  }
  return null;
}

/** Usage limits vs already-fetched redemption counts. */
export function checkUsage(rule: PromotionRule, counts: UsageCounts, hasCustomer: boolean): string | null {
  if (rule.maxPerCampaign > 0 && counts.campaign >= rule.maxPerCampaign) return "Campaign redemption limit reached.";
  if (rule.maxPerCustomer > 0 && hasCustomer && counts.customer >= rule.maxPerCustomer) return "Customer redemption limit reached.";
  if (rule.maxPerDay > 0 && counts.day >= rule.maxPerDay) return "Daily redemption limit reached.";
  return null;
}

/** Compute the discount for a rule against the bill (after checks passed). */
export function computeDiscount(rule: PromotionRule, ctx: PromotionBillContext, prodMeta: ProductMeta): { discount: number; freeProductId: number | null; freeQty: number } {
  const bill = ctx.billAmount;
  const items = ctx.items ?? [];
  const condVals = (types: string[]) => rule.conditions.filter((c) => types.includes(c.condType)).flatMap((c) => parseArr(c.valueJson).map(String));
  const matchAmt = (predicate: (id: number) => boolean) => items.reduce((a, i) => a + (i.productId && predicate(i.productId) ? num(i.amount) : 0), 0);
  let discount = 0; let freeProductId: number | null = null; let freeQty = 0;
  switch (rule.discountType) {
    case "Flat": case "BillDiscount": discount = Math.min(num(rule.discountValue), bill); break;
    case "Percentage": case "Slab": discount = bill * num(rule.discountValue) / 100; break;
    case "ProductDiscount": { const ids = condVals(["Product"]).map(Number); discount = matchAmt((id) => ids.includes(id)) * num(rule.discountValue) / 100; break; }
    case "CategoryDiscount": { const cats = condVals(["Category"]); discount = matchAmt((id) => cats.includes(String(prodMeta.get(id)?.category))) * num(rule.discountValue) / 100; break; }
    case "BrandDiscount": { const brands = condVals(["Brand"]); discount = matchAmt((id) => brands.includes(String(prodMeta.get(id)?.brand))) * num(rule.discountValue) / 100; break; }
    case "BuyXGetY": case "BuyXGetSame": case "FreeProduct": case "FreeQuantity": case "Combo": case "Bundle":
      freeProductId = rule.getProductId ?? rule.buyProductId ?? null; freeQty = num(rule.getQty) || 1; break;
    default: discount = bill * num(rule.discountValue) / 100; break;
  }
  if (num(rule.maxDiscount) > 0) discount = Math.min(discount, num(rule.maxDiscount));
  if (num(rule.minDiscount) > 0 && discount > 0) discount = Math.max(discount, num(rule.minDiscount));
  discount = r2(Math.max(0, Math.min(discount, bill)));
  return { discount, freeProductId, freeQty };
}

/** Run the full rule evaluation (purchase → conditions → usage → discount). */
export function evaluateRule(rule: PromotionRule, ctx: PromotionBillContext, prodMeta: ProductMeta, counts: UsageCounts): RuleEvalResult {
  const fail = (reason: string): RuleEvalResult => ({ valid: false, reason, discountType: rule.discountType, discountAmount: 0, taxableReduced: 0, gstRule: rule.gstRule, freeProductId: null, freeQty: 0 });
  const pErr = checkPurchase(rule, ctx); if (pErr) return fail(pErr);
  const cErr = checkConditions(rule, ctx, prodMeta); if (cErr) return fail(cErr);
  const uErr = checkUsage(rule, counts, !!ctx.customerId); if (uErr) return fail(uErr);
  const { discount, freeProductId, freeQty } = computeDiscount(rule, ctx, prodMeta);
  return { valid: true, reason: "Valid", discountType: rule.discountType, discountAmount: discount, taxableReduced: rule.reduceTaxable ? discount : 0, gstRule: rule.gstRule, freeProductId, freeQty };
}
