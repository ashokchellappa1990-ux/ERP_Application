/**
 * Discount Management service — CRUD, configuration, dashboard, usage, audit and
 * the sale-time evaluation entry point. All queries are tenant/business scoped.
 * This is the ONLY place discounts are created, validated, priced and recorded.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  DiscountInput, DiscountConfig, DiscountConfigInput, DiscountRow, DiscountDetail,
  SimulateInput, AccountRef,
} from "@/lib/contracts/discount";
import { PRIORITY_CHAIN } from "@/lib/contracts/discount";
import { evaluateDiscounts, type EngineDiscount, type EngineContext, type EngineResult } from "@/lib/discount/engine";

export interface Scope { tenantId: number; businessId: number | null }
export interface Ctx extends Scope { branchId: number | null; userId: number; userName: string | null }

const bizWhere = (s: Scope) => (s.businessId != null ? { tenantId: s.tenantId, businessId: s.businessId } : { tenantId: s.tenantId });
const num = (v: Prisma.Decimal | number | null | undefined) => (v == null ? 0 : Number(v));
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const parse = <T,>(j: string | null | undefined, fb: T): T => { if (!j) return fb; try { return JSON.parse(j) as T; } catch { return fb; } };

/** Discount-relevant ledger accounts for the Accounting tab dropdowns. */
export const DISCOUNT_ACCOUNTS: AccountRef[] = [
  { code: "3060", name: "Sales Discount (Contra-Revenue)" },
  { code: "4210", name: "Marketing / Promotion Expense" },
  { code: "4400", name: "Loyalty Expense" },
  { code: "4220", name: "Sales Promotion Expense" },
  { code: "4230", name: "Manufacturer Reimbursement" },
];

async function audit(s: Scope, entityType: string, entityId: number | null, action: string, byUser: number | null, byName: string | null, note?: string) {
  try {
    await prisma.discountAudit.create({ data: { tenantId: s.tenantId, businessId: s.businessId, entityType, entityId, action, byUser, byName, note: note ?? null } });
  } catch { /* audit never blocks */ }
}

/* --------------------------------------------------------- configuration */
export async function getConfig(s: Scope): Promise<DiscountConfig> {
  let row = await prisma.discountConfiguration.findFirst({ where: bizWhere(s) });
  if (!row) row = await prisma.discountConfiguration.create({ data: { tenantId: s.tenantId, businessId: s.businessId } });
  return {
    enableModule: row.enableModule, codePrefix: row.codePrefix, codeLength: row.codeLength, runningNumber: row.runningNumber,
    priorityOrder: parse<string[]>(row.priorityOrder, [...PRIORITY_CHAIN]), gstDefault: row.gstDefault, roundOff: row.roundOff,
    discountAccount: row.discountAccount, promoAccount: row.promoAccount, autoApply: row.autoApply,
  };
}

export async function saveConfig(s: Scope, input: DiscountConfigInput): Promise<DiscountConfig> {
  const existing = await prisma.discountConfiguration.findFirst({ where: bizWhere(s) });
  const data = {
    enableModule: input.enableModule, codePrefix: input.codePrefix, codeLength: input.codeLength,
    priorityOrder: JSON.stringify(input.priorityOrder), gstDefault: input.gstDefault, roundOff: input.roundOff,
    discountAccount: input.discountAccount, promoAccount: input.promoAccount, autoApply: input.autoApply,
  };
  if (existing) await prisma.discountConfiguration.update({ where: { id: existing.id }, data });
  else await prisma.discountConfiguration.create({ data: { tenantId: s.tenantId, businessId: s.businessId, ...data } });
  return getConfig(s);
}

async function nextCode(s: Scope): Promise<string> {
  const row = await prisma.discountConfiguration.findFirst({ where: bizWhere(s) }) ?? await prisma.discountConfiguration.create({ data: { tenantId: s.tenantId, businessId: s.businessId } });
  const n = row.runningNumber + 1;
  await prisma.discountConfiguration.update({ where: { id: row.id }, data: { runningNumber: n } });
  return `${row.codePrefix}-${String(n).padStart(row.codeLength, "0")}`;
}

/* ---------------------------------------------------------------- rows -- */
const toRow = (d: Prisma.DiscountMasterGetPayload<object>): DiscountRow => ({
  id: d.id, code: d.code, name: d.name, description: d.description ?? "", category: d.category,
  discountType: d.discountType, method: d.method, applyLevel: d.applyLevel, value: num(d.value),
  maxDiscount: num(d.maxDiscount), minDiscount: num(d.minDiscount), priority: d.priority, status: d.status,
  startDate: iso(d.startDate), endDate: iso(d.endDate), minBill: num(d.minBill), usageCount: d.usageCount,
  totalGiven: num(d.totalGiven), combinable: d.combinable, requiresApproval: d.requiresApproval,
  approvedByName: d.approvedByName ?? "", createdByName: d.createdByName ?? "",
});

const toDetail = (d: Prisma.DiscountMasterGetPayload<object>): DiscountDetail => ({
  ...toRow(d),
  startTime: d.startTime ?? "", endTime: d.endTime ?? "", maxBill: num(d.maxBill), minQty: d.minQty,
  buyProductId: d.buyProductId, buyQty: d.buyQty, getProductId: d.getProductId, getQty: d.getQty,
  gstTiming: d.gstTiming, discountBase: d.discountBase, reduceTaxable: d.reduceTaxable, discountAccount: d.discountAccount ?? "", campaignId: d.campaignId,
  applicability: parse(d.applicabilityJson, {}), eligibility: parse(d.eligibilityJson, {}),
  validity: parse(d.validityJson, {}), combination: parse(d.combinationJson, {}), approval: parse(d.approvalJson, {}),
});

export async function listDiscounts(s: Scope, opts: { status?: string; q?: string; type?: string } = {}): Promise<DiscountRow[]> {
  const where: Prisma.DiscountMasterWhereInput = { ...bizWhere(s) };
  if (opts.status && opts.status !== "All") where.status = opts.status;
  if (opts.type && opts.type !== "All") where.discountType = opts.type;
  if (opts.q) where.OR = [{ code: { contains: opts.q } }, { name: { contains: opts.q } }, { discountType: { contains: opts.q } }];
  const rows = await prisma.discountMaster.findMany({ where, orderBy: [{ priority: "asc" }, { id: "desc" }], take: 500 });
  return rows.map(toRow);
}

export async function getDiscount(s: Scope, id: number): Promise<DiscountDetail | null> {
  const d = await prisma.discountMaster.findFirst({ where: { id, ...bizWhere(s) } });
  return d ? toDetail(d) : null;
}

function buildData(input: DiscountInput) {
  return {
    name: input.name, description: input.description ?? null, category: input.category, discountType: input.discountType,
    method: input.method, applyLevel: input.applyLevel, value: input.value, maxDiscount: input.maxDiscount, minDiscount: input.minDiscount,
    priority: input.priority, status: input.status,
    startDate: input.startDate ? new Date(input.startDate) : null, endDate: input.endDate ? new Date(input.endDate) : null,
    startTime: input.startTime || null, endTime: input.endTime || null,
    minBill: input.minBill, maxBill: input.maxBill, minQty: input.minQty,
    buyProductId: input.buyProductId ?? null, buyQty: input.buyQty, getProductId: input.getProductId ?? null, getQty: input.getQty,
    applicabilityJson: input.applicability ? JSON.stringify(input.applicability) : null,
    eligibilityJson: input.eligibility ? JSON.stringify(input.eligibility) : null,
    validityJson: input.validity ? JSON.stringify(input.validity) : null,
    combinationJson: input.combination ? JSON.stringify(input.combination) : null,
    approvalJson: input.approval ? JSON.stringify(input.approval) : null,
    discountAccount: input.discountAccount || null, gstTiming: input.gstTiming, discountBase: input.discountBase, reduceTaxable: input.reduceTaxable,
    combinable: input.combinable, requiresApproval: input.requiresApproval, campaignId: input.campaignId ?? null,
  };
}

export async function createDiscount(ctx: Ctx, input: DiscountInput): Promise<number> {
  const code = input.code?.trim() || (await nextCode(ctx));
  const d = await prisma.discountMaster.create({
    data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, code, ...buildData(input), createdBy: ctx.userId, createdByName: ctx.userName },
  });
  await audit(ctx, "Discount", d.id, "Created", ctx.userId, ctx.userName, `${code} — ${input.name}`);
  return d.id;
}

export async function updateDiscount(ctx: Ctx, id: number, input: DiscountInput): Promise<void> {
  const existing = await prisma.discountMaster.findFirst({ where: { id, ...bizWhere(ctx) } });
  if (!existing) throw new Error("Discount not found.");
  await prisma.discountMaster.update({ where: { id }, data: { ...buildData(input), updatedBy: ctx.userId } });
  await audit(ctx, "Discount", id, "Updated", ctx.userId, ctx.userName, `${existing.code} — ${input.name}`);
}

export async function setStatus(ctx: Ctx, id: number, status: string): Promise<void> {
  const d = await prisma.discountMaster.findFirst({ where: { id, ...bizWhere(ctx) } });
  if (!d) throw new Error("Discount not found.");
  await prisma.discountMaster.update({ where: { id }, data: { status } });
  await audit(ctx, "Discount", id, `Status → ${status}`, ctx.userId, ctx.userName, d.code);
}

export async function approveDiscount(ctx: Ctx, id: number, approved: boolean, note?: string): Promise<void> {
  const d = await prisma.discountMaster.findFirst({ where: { id, ...bizWhere(ctx) } });
  if (!d) throw new Error("Discount not found.");
  await prisma.discountMaster.update({
    where: { id },
    data: approved ? { status: "Active", approvedBy: ctx.userId, approvedByName: ctx.userName, approvedAt: new Date() } : { status: "Draft" },
  });
  await audit(ctx, "Discount", id, approved ? "Approved" : "Rejected", ctx.userId, ctx.userName, note ?? d.code);
}

export async function deleteDiscount(ctx: Ctx, id: number): Promise<void> {
  const d = await prisma.discountMaster.findFirst({ where: { id, ...bizWhere(ctx) } });
  if (!d) throw new Error("Discount not found.");
  await prisma.discountMaster.delete({ where: { id } });
  await audit(ctx, "Discount", id, "Deleted", ctx.userId, ctx.userName, d.code);
}

/* --------------------------------------------------------- engine bridge */
const toEngine = (d: Prisma.DiscountMasterGetPayload<object>): EngineDiscount => ({
  id: d.id, code: d.code, name: d.name, discountType: d.discountType, method: d.method, applyLevel: d.applyLevel,
  value: num(d.value), maxDiscount: num(d.maxDiscount), minDiscount: num(d.minDiscount), priority: d.priority,
  combinable: d.combinable, reduceTaxable: d.reduceTaxable, gstTiming: d.gstTiming, discountBase: d.discountBase, discountAccount: d.discountAccount ?? "3060",
  startDate: iso(d.startDate) || null, endDate: iso(d.endDate) || null, startTime: d.startTime, endTime: d.endTime,
  minBill: num(d.minBill), maxBill: num(d.maxBill), minQty: d.minQty,
  buyProductId: d.buyProductId, buyQty: d.buyQty, getProductId: d.getProductId, getQty: d.getQty,
  applicability: parse(d.applicabilityJson, {}), eligibility: parse(d.eligibilityJson, {}),
  validity: parse(d.validityJson, {}), combination: parse(d.combinationJson, {}),
});

async function loadActive(s: Scope): Promise<EngineDiscount[]> {
  const rows = await prisma.discountMaster.findMany({ where: { ...bizWhere(s), status: "Active" }, orderBy: { priority: "asc" } });
  return rows.map(toEngine);
}

/**
 * Sale-time entry point — Sales/POS calls this to resolve applicable discounts
 * dynamically from the module (never hardcoded). Returns the applied discount(s)
 * with the amounts and ledger accounts to post.
 */
export async function evaluateForSale(s: Scope, ctx: EngineContext): Promise<EngineResult> {
  const cfg = await getConfig(s);
  if (!cfg.enableModule) return { applied: [], skipped: [], totalDiscount: 0, netReductionTotal: 0, best: null };
  return evaluateDiscounts(await loadActive(s), ctx, { maxDiscounts: 3 });
}

/** Live POS cart preview — enriches cart lines with product category/brand (from the
 *  catalog) and resolves the applicable auto-discounts, matching the sale-time engine. */
export async function previewForCart(s: Scope, input: { channel?: string; customerId?: number | null; customerGroup?: string; membershipLevel?: string; paymentMode?: string; date?: string; billAmount: number; billTaxable?: number; flags?: Record<string, boolean>; lines: { productId: number; qty: number; amount: number; taxable?: number; category?: string; brand?: string }[] }): Promise<EngineResult> {
  const ids = Array.from(new Set(input.lines.map((l) => l.productId).filter((x) => x > 0)));
  const prods = ids.length ? await prisma.product.findMany({ where: { tenantId: s.tenantId, id: { in: ids } }, select: { id: true, category: true, brand: true } }) : [];
  const meta = new Map(prods.map((p) => [p.id, { category: p.category ?? undefined, brand: p.brand ?? undefined }]));
  const billTaxable = input.billTaxable ?? input.lines.reduce((sum, l) => sum + (l.taxable ?? l.amount), 0);
  const ctx: EngineContext = {
    billAmount: input.billAmount, billTaxable,
    items: input.lines.map((l) => { const m = meta.get(l.productId); return { productId: l.productId, category: l.category || m?.category, brand: l.brand || m?.brand, qty: l.qty, amount: l.amount, taxable: l.taxable ?? l.amount }; }),
    channel: input.channel || "POS", date: input.date || new Date().toISOString().slice(0, 10), customerId: input.customerId ?? null,
    customerGroup: input.customerGroup, membershipLevel: input.membershipLevel, paymentMode: input.paymentMode,
    flags: input.flags ?? { isMember: !!(input.customerId || input.membershipLevel) },
  };
  return evaluateForSale(s, ctx);
}

export async function simulate(s: Scope, input: SimulateInput): Promise<EngineResult & { gst: { taxable: number; gst: number; total: number } }> {
  const ctx: EngineContext = {
    billAmount: input.billAmount, billTaxable: input.billAmount, items: input.items.map((i) => ({ productId: i.productId ?? null, category: i.category, brand: i.brand, qty: i.qty, amount: i.amount, taxable: i.amount })),
    customerId: input.customerId ?? null, customerGroup: input.customerGroup, membershipLevel: input.membershipLevel,
    channel: input.channel, paymentMode: input.paymentMode, date: input.date || new Date().toISOString().slice(0, 10), time: input.time,
    flags: input.flags,
  };
  const res = await evaluateForSale(s, ctx);
  // Payable after the tax-inclusive reduction; GST recomputed on the discounted value.
  const payable = Math.max(0, input.billAmount - res.netReductionTotal);
  const taxable = Math.round((payable / 1.18) * 100) / 100;
  const gst = Math.round((payable - taxable) * 100) / 100;
  return { ...res, gst: { taxable, gst, total: Math.round(payable * 100) / 100 } };
}

/** Record a discount application (called by Sales after a bill is posted). */
export async function recordUsage(s: Scope, u: { discountId: number; discountCode: string; discountName: string; saleId?: number; invoiceNo?: string; customerId?: number; customerName?: string; billAmount: number; discountAmount: number; channel?: string }): Promise<void> {
  await prisma.$transaction([
    prisma.discountUsage.create({ data: { tenantId: s.tenantId, businessId: s.businessId, discountId: u.discountId, discountCode: u.discountCode, discountName: u.discountName, saleId: u.saleId ?? null, invoiceNo: u.invoiceNo ?? null, customerId: u.customerId ?? null, customerName: u.customerName ?? null, billAmount: u.billAmount, discountAmount: u.discountAmount, channel: u.channel ?? null } }),
    prisma.discountMaster.update({ where: { id: u.discountId }, data: { usageCount: { increment: 1 }, totalGiven: { increment: u.discountAmount } } }),
  ]);
}

/* ---------------------------------------------- master option lists ----- */
/** Options for the Applicability multi-selects — loaded from the live masters. */
export async function listMasterOptions(s: Scope) {
  const t = { tenantId: s.tenantId }; // catalog masters are tenant-wide
  const [cats, brands, groups, levels, products, customers] = await Promise.all([
    prisma.product.findMany({ where: { ...t, category: { not: null } }, select: { category: true }, distinct: ["category"], take: 1000 }),
    prisma.product.findMany({ where: { ...t, brand: { not: null } }, select: { brand: true }, distinct: ["brand"], take: 1000 }),
    prisma.customer.findMany({ where: { ...t, customerGroup: { not: null } }, select: { customerGroup: true }, distinct: ["customerGroup"], take: 500 }),
    prisma.membershipLevel.findMany({ where: { ...t, status: "Active" }, select: { name: true }, orderBy: { name: "asc" } }).catch(() => [] as { name: string }[]),
    prisma.product.findMany({ where: t, select: { id: true, name: true, sku: true, retailPrice: true, gstRate: true, category: true, brand: true }, orderBy: { name: "asc" }, take: 2000 }),
    prisma.customer.findMany({ where: t, select: { id: true, name: true, phone: true }, orderBy: { name: "asc" }, take: 2000 }),
  ]);
  const clean = (xs: (string | null)[]) => Array.from(new Set(xs.filter((x): x is string => !!x && x.trim().length > 0))).sort();
  return {
    categories: clean(cats.map((c) => c.category)),
    brands: clean(brands.map((b) => b.brand)),
    customerGroups: clean(groups.map((g) => g.customerGroup)),
    membershipLevels: clean(levels.map((l) => l.name)),
    products: products.map((p) => ({ value: String(p.id), label: p.sku ? `${p.name} · ${p.sku}` : p.name, name: p.name, rate: Number(p.retailPrice) || 0, gst: Number(p.gstRate) || 0, category: p.category ?? "", brand: p.brand ?? "" })),
    customers: customers.map((c) => ({ value: String(c.id), label: c.phone ? `${c.name} · ${c.phone}` : c.name })),
  };
}

/* ------------------------------------------------------------- reads ---- */
export async function dashboard(s: Scope) {
  const today = new Date().toISOString().slice(0, 10);
  const [all, usageAgg, todayAgg, byType, topRows] = await Promise.all([
    prisma.discountMaster.findMany({ where: bizWhere(s), select: { status: true, totalGiven: true, usageCount: true } }),
    prisma.discountUsage.aggregate({ where: bizWhere(s), _sum: { discountAmount: true }, _count: true }),
    prisma.discountUsage.aggregate({ where: { ...bizWhere(s), usedAt: { gte: new Date(today + "T00:00:00") } }, _sum: { discountAmount: true } }),
    prisma.discountMaster.groupBy({ by: ["discountType"], where: bizWhere(s), _sum: { totalGiven: true }, _count: true, orderBy: { _sum: { totalGiven: "desc" } }, take: 8 }),
    prisma.discountMaster.findMany({ where: bizWhere(s), orderBy: { totalGiven: "desc" }, take: 5, select: { code: true, name: true, totalGiven: true, usageCount: true, discountType: true } }),
  ]);
  const now = new Date();
  const active = all.filter((d) => d.status === "Active").length;
  const scheduled = await prisma.discountMaster.count({ where: { ...bizWhere(s), status: "Active", startDate: { gt: now } } });
  const expired = all.filter((d) => d.status === "Expired").length;
  const totalGiven = all.reduce((a, d) => a + num(d.totalGiven), 0);
  return {
    kpis: {
      active, scheduled, expired,
      todayValue: num(todayAgg._sum.discountAmount), totalGiven,
      usage: usageAgg._count, avg: usageAgg._count ? Math.round((num(usageAgg._sum.discountAmount) / usageAgg._count) * 100) / 100 : 0,
      draft: all.filter((d) => d.status === "Draft").length, total: all.length,
    },
    byType: byType.map((t) => ({ label: t.discountType, value: num(t._sum.totalGiven), count: t._count })),
    top: topRows.map((t) => ({ code: t.code, name: t.name, type: t.discountType, given: num(t.totalGiven), used: t.usageCount })),
  };
}

export async function listUsage(s: Scope, opts: { q?: string } = {}) {
  const where: Prisma.DiscountUsageWhereInput = { ...bizWhere(s) };
  if (opts.q) where.OR = [{ discountCode: { contains: opts.q } }, { discountName: { contains: opts.q } }, { invoiceNo: { contains: opts.q } }, { customerName: { contains: opts.q } }];
  const rows = await prisma.discountUsage.findMany({ where, orderBy: { usedAt: "desc" }, take: 300 });
  return rows.map((u) => ({ id: u.id, discountCode: u.discountCode, discountName: u.discountName, invoiceNo: u.invoiceNo ?? "", customerName: u.customerName ?? "", billAmount: num(u.billAmount), discountAmount: num(u.discountAmount), channel: u.channel ?? "", at: u.usedAt.toISOString() }));
}

export async function listAudit(s: Scope) {
  const rows = await prisma.discountAudit.findMany({ where: bizWhere(s), orderBy: { id: "desc" }, take: 300 });
  return rows.map((a) => ({ id: a.id, entityType: a.entityType, entityId: a.entityId, action: a.action, byName: a.byName ?? "System", note: a.note ?? "", at: a.createdAt.toISOString() }));
}

export async function analytics(s: Scope) {
  const [top, unused, expiringSoon] = await Promise.all([
    prisma.discountMaster.findMany({ where: bizWhere(s), orderBy: { usageCount: "desc" }, take: 5, select: { code: true, name: true, usageCount: true, totalGiven: true } }),
    prisma.discountMaster.findMany({ where: { ...bizWhere(s), usageCount: 0, status: "Active" }, take: 10, select: { code: true, name: true, discountType: true } }),
    prisma.discountMaster.findMany({ where: { ...bizWhere(s), status: "Active", endDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 864e5) } }, take: 10, select: { code: true, name: true, endDate: true } }),
  ]);
  return {
    topUsed: top.map((t) => ({ code: t.code, name: t.name, used: t.usageCount, given: num(t.totalGiven) })),
    unused: unused.map((u) => ({ code: u.code, name: u.name, type: u.discountType })),
    expiringSoon: expiringSoon.map((e) => ({ code: e.code, name: e.name, endDate: iso(e.endDate) })),
  };
}
