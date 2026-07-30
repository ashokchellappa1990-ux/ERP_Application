/**
 * Discount Rule Engine — the single, pure decision core for the whole ERP.
 *
 * Given the set of active discount definitions and a billing context, it filters
 * by applicability + validity + eligibility, computes each candidate's value,
 * then resolves priority + combination rules to produce the applied discount(s).
 * No DB / IO here so it is fully testable and reusable by Sales/POS, Simulation
 * and Reports. Sales must call this (via the service) instead of hardcoding logic.
 */

export interface EngineDiscount {
  id: number; code: string; name: string; discountType: string;
  method: string; applyLevel: string; value: number; maxDiscount: number; minDiscount: number;
  priority: number; combinable: boolean; reduceTaxable: boolean; gstTiming: string;
  discountBase: string; // "inclusive" (on MRP incl. tax) | "exclusive" (on material value, pre-tax)
  discountAccount: string;
  startDate: string | null; endDate: string | null; startTime: string | null; endTime: string | null;
  minBill: number; maxBill: number; minQty: number;
  buyProductId: number | null; buyQty: number; getProductId: number | null; getQty: number;
  applicability: Record<string, unknown>;
  eligibility: Record<string, unknown>;
  validity: Record<string, unknown>;
  combination: Record<string, unknown>;
}

export interface EngineItem { productId?: number | null; category?: string; brand?: string; qty: number; amount: number; taxable?: number }

export interface EngineContext {
  billAmount: number;   // net incl. tax (MRP basis)
  billTaxable?: number; // net material value, pre-tax (exclusive basis)
  items: EngineItem[];
  customerId?: number | null;
  customerGroup?: string;
  membershipLevel?: string;
  loyaltyTier?: string;
  channel: string;
  paymentMode?: string;
  date: string; // yyyy-mm-dd
  time?: string; // HH:MM
  flags?: Record<string, boolean>; // isMember, isFirstPurchase, isBirthday, isEmployee, isCorporate, …
}

export interface AppliedDiscount {
  id: number; code: string; name: string; discountType: string; discountBase: string;
  discountAmount: number;    // the discount in its display base (on MRP incl. tax, or material value)
  netReduction: number;      // the tax-INCLUSIVE reduction (so GST recomputes correctly)
  account: string; reduceTaxable: boolean; combinable: boolean; priority: number;
}
export interface SkippedDiscount { id: number; code: string; name: string; reason: string }
export interface EngineResult {
  applied: AppliedDiscount[];
  skipped: SkippedDiscount[];
  totalDiscount: number;        // sum of display amounts
  netReductionTotal: number;    // sum of tax-inclusive reductions (drives the payable + GST recompute)
  best: AppliedDiscount | null;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
const asNum = (v: unknown, d = 0) => (v == null || v === "" ? d : Number(v) || d);
const asBool = (v: unknown) => v === true || v === "true" || v === 1;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Is `d` valid right now (date window, time window, weekday rules)? */
function checkValidity(d: EngineDiscount, ctx: EngineContext): string | null {
  if (d.startDate && ctx.date < d.startDate.slice(0, 10)) return "Not started yet";
  if (d.endDate && ctx.date > d.endDate.slice(0, 10)) return "Expired";
  if (ctx.time && d.startTime && ctx.time < d.startTime) return "Outside active hours";
  if (ctx.time && d.endTime && ctx.time > d.endTime) return "Outside active hours";
  const v = d.validity || {};
  const day = DOW[new Date(ctx.date + "T00:00:00").getDay()];
  const isWeekend = day === "Sat" || day === "Sun";
  if (asBool(v.weekendsOnly) && !isWeekend) return "Weekends only";
  if (asBool(v.weekdaysOnly) && isWeekend) return "Weekdays only";
  const days = arr(v.days);
  if (days.length && !days.includes(day)) return `Not active on ${day}`;
  return null;
}

/** Applicability: channel / payment / customer group / product-category-brand scope. */
function checkApplicability(d: EngineDiscount, ctx: EngineContext): string | null {
  const a = d.applicability || {};
  const ch = arr(a.channels);
  if (ch.length && !ch.includes(ctx.channel)) return `Not for ${ctx.channel}`;
  const pm = arr(a.paymentModes);
  if (pm.length && ctx.paymentMode && !pm.includes(ctx.paymentMode)) return `Not for ${ctx.paymentMode}`;
  const cg = arr(a.customerGroups);
  if (cg.length && (!ctx.customerGroup || !cg.includes(ctx.customerGroup))) return "Customer group not eligible";
  const ml = arr(a.membershipLevels);
  if (ml.length && (!ctx.membershipLevel || !ml.includes(ctx.membershipLevel))) return "Membership level not eligible";
  // product / category / brand scope — at least one line item must match
  const cats = arr(a.categories), brands = arr(a.brands), prods = arr(a.products);
  if (cats.length || brands.length || prods.length) {
    const hit = ctx.items.some((it) =>
      (cats.length && it.category && cats.includes(it.category)) ||
      (brands.length && it.brand && brands.includes(it.brand)) ||
      (prods.length && it.productId != null && prods.includes(String(it.productId))));
    if (!hit) return "No eligible product in cart";
  }
  return null;
}

/** Eligibility thresholds (bill/qty/item counts + segment flags). */
function checkEligibility(d: EngineDiscount, ctx: EngineContext): string | null {
  const totalQty = ctx.items.reduce((s, i) => s + (i.qty || 0), 0);
  if (d.minBill > 0 && ctx.billAmount < d.minBill) return `Minimum bill ₹${d.minBill}`;
  if (d.maxBill > 0 && ctx.billAmount > d.maxBill) return `Maximum bill ₹${d.maxBill}`;
  if (d.minQty > 0 && totalQty < d.minQty) return `Minimum quantity ${d.minQty}`;
  const e = d.eligibility || {};
  const minItems = asNum(e.minItems);
  if (minItems > 0 && ctx.items.length < minItems) return `Minimum ${minItems} items`;
  const f = ctx.flags || {};
  if (asBool(e.membershipRequired) && !f.isMember) return "Members only";
  if (asBool(e.firstPurchaseOnly) && !f.isFirstPurchase) return "First purchase only";
  if (asBool(e.birthdayOnly) && !f.isBirthday) return "Birthday only";
  if (asBool(e.anniversaryOnly) && !f.isAnniversary) return "Anniversary only";
  if (asBool(e.employeeOnly) && !f.isEmployee) return "Employees only";
  if (asBool(e.corporateOnly) && !f.isCorporate) return "Corporate only";
  return null;
}

/** Value of a discount for the current cart, capped by min/max and the bill. */
function computeAmount(d: EngineDiscount, ctx: EngineContext): number {
  const a = d.applicability || {};
  const cats = arr(a.categories), brands = arr(a.brands), prods = arr(a.products);
  const scoped = cats.length || brands.length || prods.length || d.applyLevel === "line";
  // "exclusive" computes on the material value (pre-tax); "inclusive" on the MRP incl. tax.
  const exclusive = d.discountBase === "exclusive";
  const itemBase = (it: EngineItem) => (exclusive ? (it.taxable ?? it.amount) : it.amount);
  const base = scoped
    ? ctx.items.filter((it) =>
        (!cats.length && !brands.length && !prods.length) ||
        (cats.length && it.category && cats.includes(it.category)) ||
        (brands.length && it.brand && brands.includes(it.brand)) ||
        (prods.length && it.productId != null && prods.includes(String(it.productId))))
        .reduce((s, i) => s + (itemBase(i) || 0), 0)
    : (exclusive ? (ctx.billTaxable ?? ctx.billAmount) : ctx.billAmount);

  let amt = 0;
  const type = d.discountType;
  if (type === "Buy X Get Y") {
    // free-goods value: buyer qualifies -> getQty units of the get-product's unit price
    const buyLine = ctx.items.find((i) => d.buyProductId != null && i.productId === d.buyProductId);
    const getLine = ctx.items.find((i) => d.getProductId != null && i.productId === d.getProductId) || buyLine;
    if (buyLine && (buyLine.qty || 0) >= (d.buyQty || 1) && getLine && getLine.qty) {
      const unit = (getLine.amount || 0) / (getLine.qty || 1);
      amt = unit * (d.getQty || 1);
    }
  } else if (d.method === "flat" || type === "Flat Amount" || type === "Cash") {
    amt = d.value;
  } else if (d.method === "fixed_price" || type === "Fixed Selling Price") {
    // markdown from current line value to a fixed selling price per unit
    amt = ctx.items.reduce((s, i) => s + Math.max(0, (i.amount || 0) - d.value * (i.qty || 0)), 0);
  } else {
    // percentage (default) — of the scoped base
    amt = base * (d.value / 100);
  }

  if (d.maxDiscount > 0) amt = Math.min(amt, d.maxDiscount);
  if (d.minDiscount > 0 && amt > 0) amt = Math.max(amt, d.minDiscount);
  amt = Math.max(0, Math.min(amt, ctx.billAmount));
  return r2(amt);
}

/** Evaluate a candidate set and resolve the applied discount(s). */
export function evaluateDiscounts(
  discounts: EngineDiscount[],
  ctx: EngineContext,
  opts: { maxDiscounts?: number } = {},
): EngineResult {
  const maxDiscounts = opts.maxDiscounts ?? 3;
  const skipped: SkippedDiscount[] = [];
  const candidates: AppliedDiscount[] = [];

  // Gross-up factor to convert an exclusive (material-value) discount into its
  // tax-INCLUSIVE reduction, so the recomputed GST + payable are correct.
  const grossUp = ctx.billTaxable && ctx.billTaxable > 0 ? ctx.billAmount / ctx.billTaxable : 1;
  for (const d of discounts) {
    const reason = checkValidity(d, ctx) || checkApplicability(d, ctx) || checkEligibility(d, ctx);
    if (reason) { skipped.push({ id: d.id, code: d.code, name: d.name, reason }); continue; }
    const discountAmount = computeAmount(d, ctx);
    if (discountAmount <= 0) { skipped.push({ id: d.id, code: d.code, name: d.name, reason: "No value for this cart" }); continue; }
    const netReduction = d.discountBase === "exclusive" ? r2(discountAmount * grossUp) : discountAmount;
    candidates.push({ id: d.id, code: d.code, name: d.name, discountType: d.discountType, discountBase: d.discountBase, discountAmount, netReduction, account: d.discountAccount, reduceTaxable: d.reduceTaxable, combinable: d.combinable, priority: d.priority });
  }

  // Priority engine: lower priority number wins; break ties by larger value.
  candidates.sort((a, b) => (a.priority - b.priority) || (b.discountAmount - a.discountAmount));

  const applied: AppliedDiscount[] = [];
  let remaining = ctx.billAmount; // tax-inclusive payable remaining
  for (const c of candidates) {
    if (applied.length === 0) { applied.push(c); remaining -= c.netReduction; continue; }
    const canStack = c.combinable && applied.every((x) => x.combinable) && applied.length < maxDiscounts;
    if (canStack && remaining - c.netReduction >= 0) { applied.push(c); remaining -= c.netReduction; }
    else skipped.push({ id: c.id, code: c.code, name: c.name, reason: "Superseded by higher-priority / non-combinable discount" });
  }

  const totalDiscount = r2(applied.reduce((s, a) => s + a.discountAmount, 0));
  const netReductionTotal = r2(applied.reduce((s, a) => s + a.netReduction, 0));
  return { applied, skipped, totalDiscount, netReductionTotal, best: applied[0] ?? null };
}
