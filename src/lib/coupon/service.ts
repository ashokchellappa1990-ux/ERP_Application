import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ACC, ensureAccounts } from "@/lib/accounting/accounts";
import { postJournal } from "@/lib/accounting/post";
import type {
  CouponConfig, CouponConfigInput, CampaignRow, CampaignInput, RuleInput, RuleRow, GenerateInput, CouponRow,
  IssueInput, ValidateInput, ValidateResult, RedeemInput, AccountRef, CouponDashboard,
  CouponTemplateRow, TemplateLayout, TemplateSaveInput, CouponRenderData,
} from "@/lib/contracts/coupon";
import { renderCoupon, renderSheet, defaultLayout } from "@/lib/coupon/render";
import { evaluateRule, loadProductMeta } from "@/lib/promotions/ruleEngine";

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");
const today = () => new Date().toISOString().slice(0, 10);
const rand = (n: number) => { let s = ""; const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };

export interface Scope { tenantId: number; businessId: number | null }
export interface Ctx extends Scope { branchId: number | null; userId: number; userName: string | null }
const bizWhere = (s: Scope) => (s.businessId != null ? { tenantId: s.tenantId, businessId: s.businessId } : { tenantId: s.tenantId });

async function audit(s: Scope, entityType: string, entityId: number | null, action: string, byUser: number | null, byName: string | null, note?: string) {
  try { await prisma.couponAudit.create({ data: { tenantId: s.tenantId, businessId: s.businessId, entityType, entityId, action, byUser, byName, note: note ?? null } }); } catch { /* audit never blocks */ }
}

// ----------------------------------------------------------------- configuration

const DEFAULT_CONFIG: CouponConfig = {
  enableModule: true, enableGeneric: true, enableUnique: true, enableQr: true, enableBarcode: true, enableCustomerMapping: true,
  customerMapping: "Optional", enableMultiPerInvoice: false, allowWithLoyalty: false, allowWithMembership: false, allowWithPromo: false,
  allowWithManual: false, allowReturnRestore: true, allowCancelRestore: true, enableApproval: false, enablePrinting: true, enableDesigner: true, enableBatchGen: true,
  couponPrefix: "CPN", couponLength: 10, runningNumber: 0, qrSize: 120, barcodeType: "CODE128", defaultStatus: "Generated",
};
async function configRow(s: Scope) {
  return (await prisma.couponConfiguration.findFirst({ where: bizWhere(s) })) ?? prisma.couponConfiguration.create({ data: { tenantId: s.tenantId, businessId: s.businessId } });
}
export async function getConfig(s: Scope): Promise<CouponConfig> {
  const c = await configRow(s);
  return { ...DEFAULT_CONFIG, ...c, customerMapping: c.customerMapping as CouponConfig["customerMapping"] };
}
export async function saveConfig(s: Scope, input: CouponConfigInput): Promise<CouponConfig> {
  const c = await configRow(s);
  await prisma.couponConfiguration.update({ where: { id: c.id }, data: { ...input } });
  return getConfig(s);
}

export async function listAccounts(s: Scope): Promise<AccountRef[]> {
  await prisma.$transaction((tx) => ensureAccounts(tx, s.tenantId));
  const rows = await prisma.ledgerAccount.findMany({ where: { tenantId: s.tenantId }, orderBy: { code: "asc" }, select: { code: true, name: true, type: true } });
  return rows.map((a) => ({ code: a.code, name: a.name, type: a.type }));
}

// ------------------------------------------------------------------- campaigns

export async function listCampaigns(s: Scope, opts: { status?: string; q?: string }): Promise<CampaignRow[]> {
  const where: Prisma.CouponCampaignWhereInput = { ...bizWhere(s) };
  if (opts.status && opts.status !== "All") where.status = opts.status;
  if (opts.q) where.OR = [{ code: { contains: opts.q } }, { name: { contains: opts.q } }];
  const rows = await prisma.couponCampaign.findMany({ where, orderBy: { id: "desc" }, take: 200, include: { _count: { select: { coupons: true } } } });
  const ids = rows.map((r) => r.id);
  const reds = ids.length ? await prisma.couponRedemption.groupBy({ by: ["campaignId"], where: { tenantId: s.tenantId, campaignId: { in: ids } }, _count: true }) : [];
  const rmap = new Map(reds.map((x) => [x.campaignId, x._count]));
  return rows.map((c) => ({ id: c.id, code: c.code, name: c.name, campaignType: c.campaignType, priority: c.priority, couponType: c.couponType, status: c.status, startDate: c.startDate ?? "", endDate: c.endDate ?? "", marketingBudget: num(c.marketingBudget), couponCount: c._count.coupons, redeemedCount: rmap.get(c.id) ?? 0, createdByName: c.createdByName ?? "" }));
}
export async function createCampaign(ctx: Ctx, input: CampaignInput): Promise<number> {
  const c = await prisma.couponCampaign.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, code: input.code, name: input.name, description: input.description || null, campaignType: input.campaignType || "Promotion", priority: input.priority ?? 0, couponType: input.couponType, status: input.status || "Draft", startDate: input.startDate || null, endDate: input.endDate || null, marketingBudget: r2(input.marketingBudget ?? 0), remarks: input.remarks || null, createdBy: ctx.userId, createdByName: ctx.userName } });
  await audit(ctx, "Campaign", c.id, "Campaign Created", ctx.userId, ctx.userName, `${input.code} — ${input.name}`);
  return c.id;
}
export async function updateCampaign(ctx: Ctx, id: number, input: CampaignInput): Promise<void> {
  const ex = await prisma.couponCampaign.findFirst({ where: { id, ...bizWhere(ctx) } });
  if (!ex) throw new Error("Campaign not found.");
  await prisma.couponCampaign.update({ where: { id }, data: { code: input.code, name: input.name, description: input.description || null, campaignType: input.campaignType || "Promotion", priority: input.priority ?? 0, couponType: input.couponType, status: input.status || ex.status, startDate: input.startDate || null, endDate: input.endDate || null, marketingBudget: r2(input.marketingBudget ?? 0), remarks: input.remarks || null } });
  await audit(ctx, "Campaign", id, "Campaign Modified", ctx.userId, ctx.userName);
}

// ----------------------------------------------------------------------- rules

const toRuleRow = (r: Prisma.CouponRuleGetPayload<{ include: { conditions: true; actions: true } }>): RuleRow => ({
  id: r.id, campaignId: r.campaignId ?? 0, name: r.name, discountType: r.discountType, discountValue: num(r.discountValue), maxDiscount: num(r.maxDiscount),
  minBill: num(r.minBill), usageType: r.usageType, active: r.active,
  conditions: r.conditions.map((c) => ({ id: c.id, condType: c.condType, operator: c.operator, valueJson: c.valueJson })),
  actions: r.actions.map((a) => ({ id: a.id, actionType: a.actionType, valueJson: a.valueJson })),
  gstRule: r.gstRule, reduceTaxable: r.reduceTaxable, salesDiscountCode: r.salesDiscountCode ?? "", marketingExpenseCode: r.marketingExpenseCode ?? "",
  maxPerCustomer: r.maxPerCustomer, maxPerInvoice: r.maxPerInvoice, maxPerDay: r.maxPerDay, maxPerCampaign: r.maxPerCampaign,
  minQty: num(r.minQty), minProductCount: r.minProductCount,
});
export async function listRules(s: Scope, campaignId: number): Promise<RuleRow[]> {
  const rows = await prisma.couponRule.findMany({ where: { tenantId: s.tenantId, campaignId }, orderBy: { id: "asc" }, include: { conditions: true, actions: true } });
  return rows.map(toRuleRow);
}
export async function saveRule(ctx: Ctx, campaignId: number, ruleId: number | null, input: RuleInput): Promise<number> {
  const camp = await prisma.couponCampaign.findFirst({ where: { id: campaignId, ...bizWhere(ctx) } });
  if (!camp) throw new Error("Campaign not found.");
  const data: Prisma.CouponRuleUncheckedCreateInput = {
    tenantId: ctx.tenantId, campaignId, name: input.name, discountType: input.discountType, discountValue: r2(input.discountValue ?? 0), maxDiscount: r2(input.maxDiscount ?? 0), minDiscount: r2(input.minDiscount ?? 0),
    minBill: r2(input.minBill ?? 0), maxBill: r2(input.maxBill ?? 0), minQty: input.minQty ?? 0, maxQty: input.maxQty ?? 0, minProductCount: input.minProductCount ?? 0, maxProductCount: input.maxProductCount ?? 0,
    buyProductId: input.buyProductId ?? null, buyQty: input.buyQty ?? 0, getProductId: input.getProductId ?? null, getQty: input.getQty ?? 0, sameProduct: !!input.sameProduct,
    gstRule: input.gstRule || "AfterGST", reduceTaxable: input.reduceTaxable ?? true, salesDiscountCode: input.salesDiscountCode || null, marketingExpenseCode: input.marketingExpenseCode || null,
    costCenter: input.costCenter || null, department: input.department || null, project: input.project || null,
    maxPerCustomer: input.maxPerCustomer ?? 0, maxPerInvoice: input.maxPerInvoice ?? 1, maxPerDay: input.maxPerDay ?? 0, maxPerCampaign: input.maxPerCampaign ?? 0, usageType: input.usageType || "SingleUse",
    startTime: input.startTime || null, endTime: input.endTime || null, days: input.days || null, active: input.active ?? true,
  };
  let id: number;
  if (ruleId) {
    const ex = await prisma.couponRule.findFirst({ where: { id: ruleId, tenantId: ctx.tenantId, campaignId } });
    if (!ex) throw new Error("Rule not found.");
    await prisma.$transaction(async (tx) => {
      await tx.couponRule.update({ where: { id: ruleId }, data });
      await tx.couponRuleCondition.deleteMany({ where: { ruleId } });
      await tx.couponRuleAction.deleteMany({ where: { ruleId } });
      if (input.conditions?.length) await tx.couponRuleCondition.createMany({ data: input.conditions.map((c) => ({ tenantId: ctx.tenantId, ruleId, condType: c.condType, operator: c.operator || "in", valueJson: c.valueJson })) });
      if (input.actions?.length) await tx.couponRuleAction.createMany({ data: input.actions.map((a) => ({ tenantId: ctx.tenantId, ruleId, actionType: a.actionType, valueJson: a.valueJson })) });
    });
    id = ruleId;
  } else {
    const rule = await prisma.couponRule.create({ data });
    if (input.conditions?.length) await prisma.couponRuleCondition.createMany({ data: input.conditions.map((c) => ({ tenantId: ctx.tenantId, ruleId: rule.id, condType: c.condType, operator: c.operator || "in", valueJson: c.valueJson })) });
    if (input.actions?.length) await prisma.couponRuleAction.createMany({ data: input.actions.map((a) => ({ tenantId: ctx.tenantId, ruleId: rule.id, actionType: a.actionType, valueJson: a.valueJson })) });
    id = rule.id;
  }
  await audit(ctx, "Rule", id, ruleId ? "Rules Modified" : "Rule Created", ctx.userId, ctx.userName, input.name);
  return id;
}
export async function deleteRule(ctx: Ctx, ruleId: number): Promise<void> {
  const ex = await prisma.couponRule.findFirst({ where: { id: ruleId, tenantId: ctx.tenantId } });
  if (!ex) throw new Error("Rule not found.");
  await prisma.couponRule.delete({ where: { id: ruleId } });
  await audit(ctx, "Rule", ruleId, "Rule Deleted", ctx.userId, ctx.userName);
}

// ------------------------------------------------------------------ generation

export async function generateCoupons(ctx: Ctx, input: GenerateInput): Promise<{ batchId: number; batchNo: string; count: number; firstNo: string; lastNo: string }> {
  const camp = await prisma.couponCampaign.findFirst({ where: { id: input.campaignId, ...bizWhere(ctx) } });
  if (!camp) throw new Error("Campaign not found.");
  const cfg = await configRow(ctx);
  const cust = input.customerId ? await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: ctx.tenantId }, select: { id: true, name: true } }) : null;

  const res = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRawUnsafe<Array<{ runningNumber: number; couponPrefix: string; couponLength: number; defaultStatus: string }>>("SELECT `runningNumber`,`couponPrefix`,`couponLength`,`defaultStatus` FROM `coupon_configuration` WHERE `id` = ? FOR UPDATE", cfg.id);
    const c = locked[0]; const prefix = c.couponPrefix || "CPN"; const pad = Math.max(1, (c.couponLength || 10) - prefix.length);
    // Coupon numbers are unique per TENANT, but the running counter lives on the
    // per-business config row — so a sibling business (or older data) may already own
    // numbers this counter hasn't reached. Anchor the next number to the tenant-wide
    // max serial for this prefix so the batch can never collide across businesses.
    const mxRows = await tx.$queryRawUnsafe<Array<{ mx: bigint | number | null }>>(
      "SELECT MAX(CAST(SUBSTRING(`couponNo`, ?) AS UNSIGNED)) AS mx FROM `coupon_master` WHERE `tenantId` = ? AND `couponNo` LIKE ?",
      prefix.length + 1, ctx.tenantId, `${prefix}%`,
    );
    const tenantMax = Number(mxRows[0]?.mx ?? 0) || 0;
    const base = Math.max(c.runningNumber, tenantMax);
    const start = base + 1; const end = base + input.quantity;
    await tx.couponConfiguration.update({ where: { id: cfg.id }, data: { runningNumber: end } });

    const batch = await tx.couponBatch.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, campaignId: camp.id, batchNo: "TMP", quantity: input.quantity, generatedCount: input.quantity, status: "Generated", generatedBy: ctx.userId, generatedByName: ctx.userName }, select: { id: true } });
    const batchNo = `BG-${String(batch.id).padStart(6, "0")}`;
    await tx.couponBatch.update({ where: { id: batch.id }, data: { batchNo } });

    const rows: Prisma.CouponCreateManyInput[] = [];
    let firstNo = "", lastNo = "";
    for (let n = start; n <= end; n++) {
      const couponNo = `${prefix}${String(n).padStart(pad, "0")}`;
      if (!firstNo) firstNo = couponNo; lastNo = couponNo;
      rows.push({ tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, campaignId: camp.id, batchId: batch.id, couponNo, couponCode: rand(8), qrData: couponNo, barcodeData: couponNo, securityCode: rand(6), status: c.defaultStatus || "Generated", customerId: cust?.id ?? null, customerName: cust?.name ?? null, expiryDate: input.expiryDate || camp.endDate || null });
    }
    await tx.coupon.createMany({ data: rows });
    return { batchId: batch.id, batchNo, firstNo, lastNo };
  });
  await audit(ctx, "Batch", res.batchId, "Coupon Generated", ctx.userId, ctx.userName, `${res.batchNo} · ${input.quantity} coupons (${res.firstNo}…${res.lastNo})`);
  return { batchId: res.batchId, batchNo: res.batchNo, count: input.quantity, firstNo: res.firstNo, lastNo: res.lastNo };
}

export async function listCoupons(s: Scope, opts: { campaignId?: number; status?: string; q?: string }): Promise<CouponRow[]> {
  const where: Prisma.CouponWhereInput = { ...bizWhere(s) };
  if (opts.campaignId) where.campaignId = opts.campaignId;
  if (opts.status && opts.status !== "All") where.status = opts.status;
  if (opts.q) where.OR = [{ couponNo: { contains: opts.q } }, { couponCode: { contains: opts.q } }, { customerName: { contains: opts.q } }];
  const rows = await prisma.coupon.findMany({ where, orderBy: { id: "desc" }, take: 300, include: { campaign: { select: { name: true } }, batch: { select: { batchNo: true } } } });
  return rows.map((c) => ({ id: c.id, couponNo: c.couponNo, couponCode: c.couponCode, campaignName: c.campaign.name, status: c.status, customerName: c.customerName ?? "", expiryDate: c.expiryDate ?? "", qrData: c.qrData ?? "", barcodeData: c.barcodeData ?? "", securityCode: c.securityCode ?? "", batchNo: c.batch?.batchNo ?? "" }));
}

// --------------------------------------------------------------------- issue

export async function issueCoupon(ctx: Ctx, input: IssueInput): Promise<void> {
  const coupon = input.couponId
    ? await prisma.coupon.findFirst({ where: { id: input.couponId, ...bizWhere(ctx) } })
    : await prisma.coupon.findFirst({ where: { couponNo: input.couponNo ?? "", ...bizWhere(ctx) } });
  if (!coupon) throw new Error("Coupon not found.");
  if (["Redeemed", "Cancelled", "Expired"].includes(coupon.status)) throw new Error(`Cannot issue a ${coupon.status} coupon.`);
  const cust = input.customerId ? await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: ctx.tenantId }, select: { id: true, name: true } }) : null;
  await prisma.$transaction(async (tx) => {
    await tx.coupon.update({ where: { id: coupon.id }, data: { status: "Issued", customerId: cust?.id ?? coupon.customerId, customerName: cust?.name ?? input.partyName ?? coupon.customerName } });
    await tx.couponIssue.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, couponId: coupon.id, campaignId: coupon.campaignId, issueTo: input.issueTo, customerId: cust?.id ?? null, partyName: cust?.name ?? input.partyName ?? null, issueDate: input.issueDate || today(), issuedBy: ctx.userId, issuedByName: ctx.userName, remarks: input.remarks || null } });
    if (cust) await tx.couponCustomerMap.create({ data: { tenantId: ctx.tenantId, couponId: coupon.id, customerId: cust.id, customerName: cust.name } });
  });
  await audit(ctx, "Coupon", coupon.id, "Coupon Issued", ctx.userId, ctx.userName, `${coupon.couponNo} → ${cust?.name ?? input.partyName ?? input.issueTo}`);
}

// --------------------------------------------------------------- redemption engine

const ACTIVE_STATUSES = ["Generated", "Printed", "Issued"];

/** Validate a coupon against a bill context and compute the discount (no writes). */
export async function validateCoupon(s: Scope, input: ValidateInput): Promise<ValidateResult> {
  const empty = (reason: string): ValidateResult => ({ valid: false, reason, couponId: null, campaignName: "", discountType: "", discountAmount: 0, taxableReduced: 0, gstRule: "AfterGST", freeProductId: null, freeQty: 0 });
  const key = input.couponCode.trim();
  const coupon = await prisma.coupon.findFirst({ where: { ...bizWhere(s), OR: [{ couponNo: key }, { couponCode: key }] }, include: { campaign: { include: { rules: { where: { active: true }, include: { conditions: true, actions: true }, orderBy: { id: "asc" } } } } } });
  if (!coupon) return empty("Coupon not found.");
  const camp = coupon.campaign;
  const rule = camp.rules[0];
  const day = (input.date || today()).slice(0, 10);

  if (camp.status !== "Active") return empty(`Campaign is ${camp.status}.`);
  if (camp.startDate && day < camp.startDate) return empty("Campaign has not started.");
  if (camp.endDate && day > camp.endDate) return empty("Campaign has ended.");
  if (coupon.expiryDate && day > coupon.expiryDate) return empty("Coupon has expired.");
  const reusable = rule && (rule.usageType === "Reusable" || rule.usageType === "Unlimited" || rule.usageType === "MultipleUse");
  if (!ACTIVE_STATUSES.includes(coupon.status) && !(coupon.status === "Redeemed" && reusable)) return empty(`Coupon is ${coupon.status}.`);
  if (coupon.status === "Cancelled" || coupon.status === "Expired") return empty(`Coupon is ${coupon.status}.`);

  // Customer mapping
  const cfg = await getConfig(s);
  if ((cfg.customerMapping === "Mandatory" || coupon.customerId) && coupon.customerId && coupon.customerId !== (input.customerId ?? -1)) return empty("This coupon is assigned to another customer.");

  if (!rule) return empty("No active rule configured for this campaign.");

  // Purchase rules + metadata conditions + usage limits + discount computation are
  // all delegated to the SHARED promotion rule engine (also used by Promo Codes) —
  // this module only supplies the coupon-specific redemption counts + product meta.
  const items = input.items ?? [];
  const prodMeta = await loadProductMeta(prisma, items.map((i) => i.productId).filter((x): x is number => !!x));
  const dayStart = new Date(day + "T00:00:00"); const dayEnd = new Date(day + "T23:59:59");
  const [cCamp, cCust, cDay] = await Promise.all([
    rule.maxPerCampaign > 0 ? prisma.couponRedemption.count({ where: { tenantId: s.tenantId, campaignId: camp.id } }) : Promise.resolve(0),
    rule.maxPerCustomer > 0 && input.customerId ? prisma.couponRedemption.count({ where: { tenantId: s.tenantId, campaignId: camp.id, customerId: input.customerId } }) : Promise.resolve(0),
    rule.maxPerDay > 0 ? prisma.couponRedemption.count({ where: { tenantId: s.tenantId, campaignId: camp.id, redeemedAt: { gte: dayStart, lte: dayEnd } } }) : Promise.resolve(0),
  ]);
  const ev = evaluateRule(rule, { billAmount: input.billAmount, items, customerId: input.customerId, channel: input.channel, paymentMode: input.paymentMode, date: day }, prodMeta, { campaign: cCamp, customer: cCust, day: cDay });
  if (!ev.valid) return empty(ev.reason);

  return { valid: true, reason: "Valid", couponId: coupon.id, campaignName: camp.name, discountType: ev.discountType, discountAmount: ev.discountAmount, taxableReduced: ev.taxableReduced, gstRule: ev.gstRule, freeProductId: ev.freeProductId, freeQty: ev.freeQty };
}

/** Redeem a coupon (validate + record + mark redeemed + optional GL). */
export async function redeemCoupon(ctx: Ctx, input: RedeemInput): Promise<{ redemptionId: number; discountAmount: number; couponNo: string }> {
  const v = await validateCoupon(ctx, input);
  if (!v.valid || !v.couponId) throw new Error(v.reason);
  const coupon = await prisma.coupon.findFirst({ where: { id: v.couponId, ...bizWhere(ctx) }, include: { campaign: { include: { rules: { where: { active: true }, orderBy: { id: "asc" }, take: 1 } } } } });
  if (!coupon) throw new Error("Coupon not found.");
  const rule = coupon.campaign.rules[0];
  const single = !rule || rule.usageType === "SingleUse";

  const result = await prisma.$transaction(async (tx) => {
    let journalRef: string | null = null;
    if (input.post && v.discountAmount > 0) {
      const drCode = rule?.marketingExpenseCode || ACC.MARKETING_EXPENSE;
      const crCode = rule?.salesDiscountCode || ACC.SALES_DISCOUNT;
      const jid = await postJournal(tx, { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, voucherType: "JOURNAL", prefix: "CP", date: (input.date || today()).slice(0, 10), narration: `Coupon ${coupon.couponNo} — ${coupon.campaign.name}`, sourceType: "COUPON_REDEMPTION", sourceId: coupon.id, refNo: coupon.couponNo, createdBy: ctx.userId, lines: [{ code: drCode, debit: v.discountAmount, narration: "Promotion cost" }, { code: crCode, credit: v.discountAmount, narration: "Sales discount funded by campaign" }] });
      if (jid) journalRef = `CP-${String(jid).padStart(6, "0")}`;
    }
    const red = await tx.couponRedemption.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, couponId: coupon.id, campaignId: coupon.campaignId, saleId: input.saleId ?? null, invoiceNo: input.invoiceNo || null, customerId: input.customerId ?? coupon.customerId, customerName: coupon.customerName, channel: input.channel || null, billAmount: r2(input.billAmount), discountAmount: v.discountAmount, taxableReduced: v.taxableReduced, journalRef, redeemedBy: ctx.userId, redeemedByName: ctx.userName }, select: { id: true } });
    await tx.coupon.update({ where: { id: coupon.id }, data: { status: single ? "Redeemed" : coupon.status, redeemedCount: { increment: 1 } } });
    return red.id;
  });
  await audit(ctx, "Coupon", coupon.id, "Coupon Redeemed", ctx.userId, ctx.userName, `${coupon.couponNo} · discount ₹${v.discountAmount}`);
  return { redemptionId: result, discountAmount: v.discountAmount, couponNo: coupon.couponNo };
}

// --------------------------------------------------------------------- print

export async function recordPrint(ctx: Ctx, couponIds: number[], opts: { batchId?: number; templateId?: number; format?: string; perPage?: number; reprint?: boolean }): Promise<void> {
  if (couponIds.length) {
    await prisma.coupon.updateMany({ where: { id: { in: couponIds }, ...bizWhere(ctx), status: "Generated" }, data: { status: "Printed" } });
    await prisma.coupon.updateMany({ where: { id: { in: couponIds }, ...bizWhere(ctx) }, data: { printedCount: { increment: 1 } } });
  }
  await prisma.couponPrintHistory.create({ data: { tenantId: ctx.tenantId, couponId: couponIds[0] ?? null, batchId: opts.batchId ?? null, templateId: opts.templateId ?? null, printType: opts.reprint ? "Reprint" : couponIds.length > 1 ? "Batch" : "Single", format: opts.format || "A4", copies: couponIds.length || 1, perPage: opts.perPage || 1, printedBy: ctx.userId, printedByName: ctx.userName } });
  await audit(ctx, "Coupon", couponIds[0] ?? null, "Coupon Printed", ctx.userId, ctx.userName, `${couponIds.length} coupon(s)`);
}

// ------------------------------------------------------------------- dashboard

export async function getDashboard(s: Scope): Promise<CouponDashboard> {
  const [active, byStatus, discAgg, camps] = await Promise.all([
    prisma.couponCampaign.count({ where: { ...bizWhere(s), status: "Active" } }),
    prisma.coupon.groupBy({ by: ["status"], where: bizWhere(s), _count: true }),
    prisma.couponRedemption.aggregate({ where: bizWhere(s), _sum: { discountAmount: true } }),
    prisma.couponRedemption.groupBy({ by: ["campaignId"], where: bizWhere(s), _count: true, _sum: { discountAmount: true } }),
  ]);
  const st = (k: string) => byStatus.find((x) => x.status === k)?._count ?? 0;
  const campIds = camps.map((c) => c.campaignId).filter((x): x is number => x != null);
  const names = campIds.length ? new Map((await prisma.couponCampaign.findMany({ where: { id: { in: campIds } }, select: { id: true, name: true } })).map((c) => [c.id, c.name])) : new Map<number, string>();
  const topCampaigns = camps.map((c) => ({ name: (c.campaignId != null ? names.get(c.campaignId) : null) ?? "—", redeemed: c._count, discount: num(c._sum.discountAmount) })).sort((a, b) => b.redeemed - a.redeemed).slice(0, 5);
  // monthly redemption (last 6 months)
  const reds = await prisma.couponRedemption.findMany({ where: bizWhere(s), select: { redeemedAt: true } });
  const monthly = new Map<string, number>();
  for (const r of reds) { const k = r.redeemedAt.toISOString().slice(0, 7); monthly.set(k, (monthly.get(k) ?? 0) + 1); }
  const months = [...monthly.entries()].sort().slice(-6).map(([k, v]) => ({ name: k, value: v }));
  return { activeCampaigns: active, generated: st("Generated"), printed: st("Printed"), issued: st("Issued"), redeemed: st("Redeemed"), expired: st("Expired"), cancelled: st("Cancelled"), totalDiscount: num(discAgg._sum.discountAmount), topCampaigns, monthlyRedemption: months };
}

export async function listAudit(s: Scope): Promise<{ id: number; entityType: string; action: string; byName: string; note: string; at: string }[]> {
  const rows = await prisma.couponAudit.findMany({ where: bizWhere(s), orderBy: { id: "desc" }, take: 200 });
  return rows.map((a) => ({ id: a.id, entityType: a.entityType, action: a.action, byName: a.byName ?? "", note: a.note ?? "", at: iso(a.at) }));
}

// -------------------------------------------------------------------- designer

const THEMES: Record<string, { color: string; accent: string; bg: string }[]> = {
  Retail: [{ color: "#4338ca", accent: "#dc2626", bg: "#ffffff" }, { color: "#0f766e", accent: "#ea580c", bg: "#f0fdfa" }, { color: "#9333ea", accent: "#db2777", bg: "#faf5ff" }, { color: "#1e293b", accent: "#f59e0b", bg: "#f8fafc" }],
  Pharmacy: [{ color: "#0e7490", accent: "#16a34a", bg: "#ecfeff" }, { color: "#166534", accent: "#0891b2", bg: "#f0fdf4" }, { color: "#0369a1", accent: "#22c55e", bg: "#f0f9ff" }, { color: "#065f46", accent: "#14b8a6", bg: "#ffffff" }],
  Supermarket: [{ color: "#b45309", accent: "#dc2626", bg: "#fffbeb" }, { color: "#15803d", accent: "#ca8a04", bg: "#f7fee7" }, { color: "#c2410c", accent: "#16a34a", bg: "#fff7ed" }, { color: "#a16207", accent: "#dc2626", bg: "#ffffff" }],
  Electronics: [{ color: "#1e40af", accent: "#06b6d4", bg: "#0b1220", }, { color: "#0891b2", accent: "#a855f7", bg: "#0f172a" }, { color: "#4f46e5", accent: "#22d3ee", bg: "#111827" }, { color: "#334155", accent: "#38bdf8", bg: "#020617" }],
  Fashion: [{ color: "#be185d", accent: "#111827", bg: "#fff1f2" }, { color: "#7c3aed", accent: "#f43f5e", bg: "#faf5ff" }, { color: "#0f172a", accent: "#d4af37", bg: "#ffffff" }, { color: "#9d174d", accent: "#fb7185", bg: "#fdf2f8" }],
  Generic: [{ color: "#4338ca", accent: "#dc2626", bg: "#ffffff" }, { color: "#0f766e", accent: "#f59e0b", bg: "#ffffff" }, { color: "#374151", accent: "#2563eb", bg: "#f9fafb" }, { color: "#7c3aed", accent: "#16a34a", bg: "#ffffff" }],
};
function tpl(name: string, category: string, t: { color: string; accent: string; bg: string }, variant: number): { name: string; category: string; layout: TemplateLayout } {
  const dark = ["Electronics"].includes(category);
  const text = dark ? "#e5e7eb" : "#111827";
  const sub = dark ? "#94a3b8" : "#6b7280";
  const base = defaultLayout();
  base.bg = t.bg; base.border = t.color;
  const o = Object.fromEntries(base.objects.map((x) => [x.id, x]));
  o.co.color = t.color; o.cn.color = sub; o.ds.color = t.accent; o.no.color = text; o.ex.color = sub; o.tm.color = sub;
  if (variant === 1) { o.qr.x = 258; o.qr.y = 30; o.bc.x = 244; o.bc.y = 122; }        // QR right
  else if (variant === 2) { o.ds.align = "center"; o.ds.x = 14; o.ds.w = 230; o.qr.x = 262; o.qr.y = 52; }   // discount emphasis
  else if (variant === 3) { o.qr.w = 70; o.qr.h = 70; o.qr.x = 270; o.qr.y = 20; o.bc.w = 120; o.bc.x = 120; o.bc.y = 150; o.tm.y = 174; }  // barcode band
  else { o.co.align = "center"; o.co.x = 14; o.co.w = 332; o.cn.align = "center"; o.cn.x = 14; o.cn.w = 332; o.qr.x = 138; o.qr.y = 60; o.ds.align = "center"; o.ds.x = 14; o.ds.w = 332; o.ds.y = 150; o.no.align = "center"; o.no.x = 14; o.no.w = 332; o.no.y = 118; o.bc.x = 200; o.bc.y = 20; o.ex.x = 14; o.ex.w = 332; o.ex.align = "center"; o.ex.y = 176; } // centered
  return { name, category, layout: { ...base, objects: Object.values(o) } };
}
function defaultTemplates(): { name: string; category: string; layout: TemplateLayout }[] {
  const out: { name: string; category: string; layout: TemplateLayout }[] = [];
  for (const cat of Object.keys(THEMES)) THEMES[cat].forEach((t, i) => out.push(tpl(`${cat} ${["Classic", "Bold", "Barcode", "Centered"][i]}`, cat, t, i + 1)));
  return out; // 24
}

export async function listTemplates(s: Scope): Promise<CouponTemplateRow[]> {
  let rows = await prisma.couponTemplate.findMany({ where: bizWhere(s), orderBy: { id: "asc" } });
  if (!rows.length) {
    await prisma.couponTemplate.createMany({ data: defaultTemplates().map((t) => ({ tenantId: s.tenantId, businessId: s.businessId, name: t.name, category: t.category, layout: JSON.stringify(t.layout), isSystem: true, active: true })) });
    rows = await prisma.couponTemplate.findMany({ where: bizWhere(s), orderBy: { id: "asc" } });
  }
  return rows.map((r) => ({ id: r.id, name: r.name, category: r.category, layout: safeLayout(r.layout), isSystem: r.isSystem, active: r.active }));
}
const safeLayout = (s: string): TemplateLayout => { try { return JSON.parse(s) as TemplateLayout; } catch { return defaultLayout(); } };

export async function saveTemplate(ctx: Ctx, input: TemplateSaveInput): Promise<number> {
  if (input.id) {
    const ex = await prisma.couponTemplate.findFirst({ where: { id: input.id, ...bizWhere(ctx) } });
    if (!ex) throw new Error("Template not found.");
    await prisma.couponTemplate.update({ where: { id: input.id }, data: { name: input.name, category: input.category || ex.category, layout: input.layout } });
    await audit(ctx, "Template", input.id, "Template Modified", ctx.userId, ctx.userName, input.name);
    return input.id;
  }
  const t = await prisma.couponTemplate.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, name: input.name, category: input.category || "Generic", layout: input.layout, isSystem: false, active: true } });
  await audit(ctx, "Template", t.id, "Template Created", ctx.userId, ctx.userName, input.name);
  return t.id;
}
export async function deleteTemplate(ctx: Ctx, id: number): Promise<void> {
  const ex = await prisma.couponTemplate.findFirst({ where: { id, ...bizWhere(ctx) } });
  if (!ex) throw new Error("Template not found.");
  await prisma.couponTemplate.delete({ where: { id } });
  await audit(ctx, "Template", id, "Template Deleted", ctx.userId, ctx.userName);
}

function discountLabel(rule: { discountType: string; discountValue: unknown } | undefined): string {
  if (!rule) return "SPECIAL OFFER";
  const v = num(rule.discountValue);
  if (rule.discountType === "Percentage" || rule.discountType === "Slab") return `${v}% OFF`;
  if (["Flat", "BillDiscount", "ProductDiscount", "CategoryDiscount", "BrandDiscount"].includes(rule.discountType)) return `₹${v} OFF`;
  return rule.discountType.replace(/([A-Z])/g, " $1").trim().toUpperCase();
}

async function companyNames(s: Scope, branchId: number | null): Promise<{ company: string; branch: string; terms: string }> {
  const setup = await prisma.companySetup.findFirst({ where: bizWhere(s), orderBy: { id: "desc" }, select: { legalName: true } });
  const biz = s.businessId ? await prisma.business.findFirst({ where: { id: s.businessId, tenantId: s.tenantId }, select: { name: true } }) : null;
  const br = branchId ? await prisma.branch.findFirst({ where: { id: branchId, tenantId: s.tenantId }, select: { name: true } }) : null;
  return { company: setup?.legalName || biz?.name || "Your Company", branch: br?.name || "", terms: "Terms & conditions apply. One coupon per bill. Non-transferable." };
}

/** Render coupons through a template → printable HTML sheet; records the print. */
export async function renderPrint(ctx: Ctx, couponIds: number[], templateId: number | undefined, perPage: number): Promise<{ html: string; count: number }> {
  const coupons = await prisma.coupon.findMany({ where: { id: { in: couponIds }, ...bizWhere(ctx) }, include: { campaign: { include: { rules: { where: { active: true }, orderBy: { id: "asc" }, take: 1 } } } } });
  if (!coupons.length) throw new Error("No coupons to print.");
  const layout = templateId ? (await prisma.couponTemplate.findFirst({ where: { id: templateId, ...bizWhere(ctx) } }).then((t) => (t ? safeLayout(t.layout) : defaultLayout()))) : defaultLayout();
  const cn = await companyNames(ctx, ctx.branchId);
  const gen = new Date().toISOString().slice(0, 10);
  const cards = coupons.map((c) => {
    const data: CouponRenderData = {
      CompanyName: cn.company, BranchName: cn.branch, CampaignName: c.campaign.name, CouponNumber: c.couponNo, CouponCode: c.couponCode,
      Discount: discountLabel(c.campaign.rules[0]), CustomerName: c.customerName ?? "", IssueDate: gen, ExpiryDate: c.expiryDate ?? "",
      Terms: cn.terms, GeneratedDate: c.createdAt.toISOString().slice(0, 10), qrData: c.qrData ?? c.couponNo, barcodeData: c.barcodeData ?? c.couponNo, securityCode: c.securityCode ?? "",
    };
    return renderCoupon(layout, data);
  });
  await recordPrint(ctx, couponIds, { templateId, format: "A4", perPage, reprint: coupons.some((c) => c.printedCount > 0) });
  return { html: renderSheet(cards, layout, perPage), count: coupons.length };
}
