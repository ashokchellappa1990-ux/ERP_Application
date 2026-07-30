import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ACC, ensureAccounts } from "@/lib/accounting/accounts";
import { postJournal } from "@/lib/accounting/post";
import { evaluateRule, loadProductMeta } from "@/lib/promotions/ruleEngine";
import type {
  PromoConfig, PromoConfigInput, PromoCampaignRow, PromoCampaignInput, PromoCodeRow, PromoGenerateInput,
  DistributionInput, PromoDistributionRow, ValidateInput, ValidateResult, RedeemInput, AccountRef,
  PromoDashboard, ReportType, ReportResult, RuleInput, RuleRow, CampaignSendInput, AudiencePreview,
} from "@/lib/contracts/promo";
import { AUDIENCE_LABELS } from "@/lib/contracts/promo";

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const rand = (n: number) => { let s = ""; const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };

export interface Scope { tenantId: number; businessId: number | null }
export interface Ctx extends Scope { branchId: number | null; userId: number; userName: string | null }
const bizWhere = (s: Scope) => (s.businessId != null ? { tenantId: s.tenantId, businessId: s.businessId } : { tenantId: s.tenantId });

async function audit(s: Scope, entityType: string, entityId: number | null, action: string, byUser: number | null, byName: string | null, note?: string) {
  try { await prisma.promoAudit.create({ data: { tenantId: s.tenantId, businessId: s.businessId, entityType, entityId, action, byUser, byName, note: note ?? null } }); } catch { /* audit never blocks */ }
}

// ----------------------------------------------------------------- configuration

const DEFAULT_CONFIG: PromoConfig = {
  enableModule: true, enableManualCode: true, enableAutoCode: true, enableBulkGen: true, enableCustomerMapping: true,
  customerMapping: "Public", enableApproval: false, enableAnalytics: true, enableExpiryNotify: false, enableUsageNotify: false,
  enableMultiPerInvoice: false, allowWithLoyalty: true, allowWithMembership: false, allowWithCoupon: false, allowWithManual: false, allowWithGiftVoucher: false,
  allowReturnRestore: true, allowCancelRestore: true, priority: 0, conflictResolution: "HighestDiscount",
  codeModel: "SameCode", codePrefix: "PROMO", codeLength: 10, runningNumber: 0, defaultStatus: "Active",
};
async function configRow(s: Scope) {
  return (await prisma.promoConfiguration.findFirst({ where: bizWhere(s) })) ?? prisma.promoConfiguration.create({ data: { tenantId: s.tenantId, businessId: s.businessId } });
}
export async function getConfig(s: Scope): Promise<PromoConfig> {
  const c = await configRow(s);
  return { ...DEFAULT_CONFIG, ...c, customerMapping: c.customerMapping as PromoConfig["customerMapping"], conflictResolution: c.conflictResolution as PromoConfig["conflictResolution"], codeModel: c.codeModel as PromoConfig["codeModel"] };
}
export async function saveConfig(s: Scope, input: PromoConfigInput): Promise<PromoConfig> {
  const c = await configRow(s);
  await prisma.promoConfiguration.update({ where: { id: c.id }, data: { ...input } });
  return getConfig(s);
}

export async function listAccounts(s: Scope): Promise<AccountRef[]> {
  await prisma.$transaction((tx) => ensureAccounts(tx, s.tenantId));
  const rows = await prisma.ledgerAccount.findMany({ where: { tenantId: s.tenantId }, orderBy: { code: "asc" }, select: { code: true, name: true, type: true } });
  return rows.map((a) => ({ code: a.code, name: a.name, type: a.type }));
}

// ------------------------------------------------------------------- campaigns

export async function listCampaigns(s: Scope, opts: { status?: string; q?: string }): Promise<PromoCampaignRow[]> {
  const where: Prisma.PromoCampaignWhereInput = { ...bizWhere(s) };
  if (opts.status && opts.status !== "All") where.status = opts.status;
  if (opts.q) where.OR = [{ code: { contains: opts.q } }, { name: { contains: opts.q } }];
  const rows = await prisma.promoCampaign.findMany({ where, orderBy: { id: "desc" }, take: 200, include: { _count: { select: { codes: true } } } });
  const ids = rows.map((r) => r.id);
  const reds = ids.length ? await prisma.promoRedemption.groupBy({ by: ["campaignId"], where: { tenantId: s.tenantId, campaignId: { in: ids } }, _count: true }) : [];
  const rmap = new Map(reds.map((x) => [x.campaignId, x._count]));
  return rows.map((c) => ({ id: c.id, code: c.code, name: c.name, campaignType: c.campaignType, priority: c.priority, campaignOwner: c.campaignOwner ?? "", status: c.status, startDate: c.startDate ?? "", endDate: c.endDate ?? "", marketingBudget: num(c.marketingBudget), codeCount: c._count.codes, redeemedCount: rmap.get(c.id) ?? 0, createdByName: c.createdByName ?? "" }));
}
export async function createCampaign(ctx: Ctx, input: PromoCampaignInput): Promise<number> {
  const c = await prisma.promoCampaign.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, code: input.code, name: input.name, description: input.description || null, campaignType: input.campaignType || "Digital", marketingBudget: r2(input.marketingBudget ?? 0), campaignOwner: input.campaignOwner || null, priority: input.priority ?? 0, startDate: input.startDate || null, endDate: input.endDate || null, status: input.status || "Draft", remarks: input.remarks || null, createdBy: ctx.userId, createdByName: ctx.userName } });
  await audit(ctx, "Campaign", c.id, "Campaign Created", ctx.userId, ctx.userName, `${input.code} — ${input.name}`);
  return c.id;
}
export async function updateCampaign(ctx: Ctx, id: number, input: PromoCampaignInput): Promise<void> {
  const ex = await prisma.promoCampaign.findFirst({ where: { id, ...bizWhere(ctx) } });
  if (!ex) throw new Error("Campaign not found.");
  await prisma.promoCampaign.update({ where: { id }, data: { code: input.code, name: input.name, description: input.description || null, campaignType: input.campaignType || "Digital", marketingBudget: r2(input.marketingBudget ?? 0), campaignOwner: input.campaignOwner || null, priority: input.priority ?? 0, startDate: input.startDate || null, endDate: input.endDate || null, status: input.status || ex.status, remarks: input.remarks || null } });
  await audit(ctx, "Campaign", id, "Campaign Modified", ctx.userId, ctx.userName);
}

// ----------------------------------------------------------------------- rules
// Reuse the shared coupon_rule_master table via promoCampaignId (one rule engine).

const toRuleRow = (r: Prisma.CouponRuleGetPayload<{ include: { conditions: true; actions: true } }>): RuleRow => ({
  id: r.id, campaignId: r.promoCampaignId ?? 0, name: r.name, discountType: r.discountType, discountValue: num(r.discountValue), maxDiscount: num(r.maxDiscount),
  minBill: num(r.minBill), usageType: r.usageType, active: r.active,
  conditions: r.conditions.map((c) => ({ id: c.id, condType: c.condType, operator: c.operator, valueJson: c.valueJson })),
  actions: r.actions.map((a) => ({ id: a.id, actionType: a.actionType, valueJson: a.valueJson })),
  gstRule: r.gstRule, reduceTaxable: r.reduceTaxable, salesDiscountCode: r.salesDiscountCode ?? "", marketingExpenseCode: r.marketingExpenseCode ?? "",
  maxPerCustomer: r.maxPerCustomer, maxPerInvoice: r.maxPerInvoice, maxPerDay: r.maxPerDay, maxPerCampaign: r.maxPerCampaign,
  minQty: num(r.minQty), minProductCount: r.minProductCount,
});
export async function listRules(s: Scope, campaignId: number): Promise<RuleRow[]> {
  const rows = await prisma.couponRule.findMany({ where: { tenantId: s.tenantId, promoCampaignId: campaignId }, orderBy: { id: "asc" }, include: { conditions: true, actions: true } });
  return rows.map(toRuleRow);
}
export async function saveRule(ctx: Ctx, campaignId: number, ruleId: number | null, input: RuleInput): Promise<number> {
  const camp = await prisma.promoCampaign.findFirst({ where: { id: campaignId, ...bizWhere(ctx) } });
  if (!camp) throw new Error("Campaign not found.");
  const data: Prisma.CouponRuleUncheckedCreateInput = {
    tenantId: ctx.tenantId, promoCampaignId: campaignId, name: input.name, discountType: input.discountType, discountValue: r2(input.discountValue ?? 0), maxDiscount: r2(input.maxDiscount ?? 0), minDiscount: r2(input.minDiscount ?? 0),
    minBill: r2(input.minBill ?? 0), maxBill: r2(input.maxBill ?? 0), minQty: input.minQty ?? 0, maxQty: input.maxQty ?? 0, minProductCount: input.minProductCount ?? 0, maxProductCount: input.maxProductCount ?? 0,
    buyProductId: input.buyProductId ?? null, buyQty: input.buyQty ?? 0, getProductId: input.getProductId ?? null, getQty: input.getQty ?? 0, sameProduct: !!input.sameProduct,
    gstRule: input.gstRule || "AfterGST", reduceTaxable: input.reduceTaxable ?? true, salesDiscountCode: input.salesDiscountCode || null, marketingExpenseCode: input.marketingExpenseCode || null,
    costCenter: input.costCenter || null, department: input.department || null, project: input.project || null,
    maxPerCustomer: input.maxPerCustomer ?? 0, maxPerInvoice: input.maxPerInvoice ?? 1, maxPerDay: input.maxPerDay ?? 0, maxPerCampaign: input.maxPerCampaign ?? 0, usageType: input.usageType || "SingleUse",
    startTime: input.startTime || null, endTime: input.endTime || null, days: input.days || null, active: input.active ?? true,
  };
  let id: number;
  if (ruleId) {
    const ex = await prisma.couponRule.findFirst({ where: { id: ruleId, tenantId: ctx.tenantId, promoCampaignId: campaignId } });
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
  await audit(ctx, "Rule", id, ruleId ? "Rule Modified" : "Rule Created", ctx.userId, ctx.userName, input.name);
  return id;
}
export async function deleteRule(ctx: Ctx, ruleId: number): Promise<void> {
  const ex = await prisma.couponRule.findFirst({ where: { id: ruleId, tenantId: ctx.tenantId } });
  if (!ex) throw new Error("Rule not found.");
  await prisma.couponRule.delete({ where: { id: ruleId } });
  await audit(ctx, "Rule", ruleId, "Rule Deleted", ctx.userId, ctx.userName);
}

// ------------------------------------------------------------------- generation

/** Generate promo codes — a single manual code, or an auto / bulk sequence. */
export async function generateCodes(ctx: Ctx, input: PromoGenerateInput): Promise<{ count: number; firstCode: string; lastCode: string; batchNo: string }> {
  const camp = await prisma.promoCampaign.findFirst({ where: { id: input.campaignId, ...bizWhere(ctx) } });
  if (!camp) throw new Error("Campaign not found.");
  const cfg = await configRow(ctx);
  const cust = input.customerId ? await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: ctx.tenantId }, select: { id: true, name: true } }) : null;
  const manual = (input.generationType === "Manual") || !!input.manualCode;
  // Usage model: "SameCode" → one shared code redeemable once per customer (never
  // exhausts globally); "DifferentCodes" → a batch of unique single-use codes.
  const model = input.codeModel || (cfg.codeModel as string) || "SameCode";
  const oncePer = model === "SameCode";

  if (manual) {
    const code = (input.manualCode || "").trim().toUpperCase();
    if (!code) throw new Error("Enter the manual promo code.");
    const dup = await prisma.promoCode.findFirst({ where: { tenantId: ctx.tenantId, promoCode: code } });
    if (dup) throw new Error(`Promo code ${code} already exists.`);
    const created = await prisma.promoCode.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, campaignId: camp.id, promoCode: code, name: input.name || null, description: input.description || null, codeType: input.codeType || (cust ? "CustomerSpecific" : "Public"), generationType: "Manual", prefix: input.prefix || null, suffix: input.suffix || null, qrData: code, status: cfg.defaultStatus || "Active", customerId: cust?.id ?? null, customerName: cust?.name ?? null, expiryDate: input.expiryDate || camp.endDate || null, usageLimit: input.usageLimit ?? 0, oncePerCustomer: oncePer, createdBy: ctx.userId, createdByName: ctx.userName } });
    await audit(ctx, "Code", created.id, "Promo Generated", ctx.userId, ctx.userName, `${code} (manual, ${model})`);
    return { count: 1, firstCode: code, lastCode: code, batchNo: "-" };
  }

  // Same Code → always exactly one shared code; Different Codes → the entered quantity.
  const qty = oncePer ? 1 : Math.max(1, input.quantity ?? 1);
  const res = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRawUnsafe<Array<{ runningNumber: number; codePrefix: string; codeLength: number; defaultStatus: string }>>("SELECT `runningNumber`,`codePrefix`,`codeLength`,`defaultStatus` FROM `promo_configuration` WHERE `id` = ? FOR UPDATE", cfg.id);
    const c = locked[0];
    const prefix = (input.prefix || c.codePrefix || "PROMO").toUpperCase();
    const suffix = (input.suffix || "").toUpperCase();
    const pad = Math.max(1, (c.codeLength || 10) - prefix.length - suffix.length);
    // Anchor the serial to the tenant-wide max for this prefix (codes are unique per
    // tenant; the counter is per-business) so batches never collide across businesses.
    const mxRows = await tx.$queryRawUnsafe<Array<{ mx: bigint | number | null }>>(
      "SELECT MAX(CAST(SUBSTRING(`promoCode`, ?) AS UNSIGNED)) AS mx FROM `promo_code_master` WHERE `tenantId` = ? AND `promoCode` LIKE ?",
      prefix.length + 1, ctx.tenantId, `${prefix}%`,
    );
    const base = Math.max(c.runningNumber, Number(mxRows[0]?.mx ?? 0) || 0);
    const start = base + 1; const end = base + qty;
    await tx.promoConfiguration.update({ where: { id: cfg.id }, data: { runningNumber: end } });
    const batchNo = `PB-${String(start).padStart(6, "0")}`;
    const rows: Prisma.PromoCodeCreateManyInput[] = [];
    let firstCode = "", lastCode = "";
    for (let n = start; n <= end; n++) {
      const promoCode = `${prefix}${String(n).padStart(pad, "0")}${suffix}`;
      if (!firstCode) firstCode = promoCode; lastCode = promoCode;
      rows.push({ tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, campaignId: camp.id, promoCode, name: input.name || null, description: input.description || null, codeType: input.codeType || (cust ? "CustomerSpecific" : "Public"), generationType: "Auto", prefix, suffix: suffix || null, qrData: promoCode, status: c.defaultStatus || "Active", customerId: cust?.id ?? null, customerName: cust?.name ?? null, expiryDate: input.expiryDate || camp.endDate || null, generationBatch: batchNo, usageLimit: input.usageLimit ?? 0, oncePerCustomer: oncePer, createdBy: ctx.userId, createdByName: ctx.userName });
    }
    await tx.promoCode.createMany({ data: rows });
    return { firstCode, lastCode, batchNo };
  });
  await audit(ctx, "Code", null, "Promo Generated", ctx.userId, ctx.userName, `${res.batchNo} · ${qty} codes (${res.firstCode}…${res.lastCode}) · ${model}`);
  return { count: qty, firstCode: res.firstCode, lastCode: res.lastCode, batchNo: res.batchNo };
}

export async function listCodes(s: Scope, opts: { campaignId?: number; status?: string; q?: string }): Promise<PromoCodeRow[]> {
  const where: Prisma.PromoCodeWhereInput = { ...bizWhere(s) };
  if (opts.campaignId) where.campaignId = opts.campaignId;
  if (opts.status && opts.status !== "All") where.status = opts.status;
  if (opts.q) where.OR = [{ promoCode: { contains: opts.q } }, { name: { contains: opts.q } }, { customerName: { contains: opts.q } }];
  const rows = await prisma.promoCode.findMany({ where, orderBy: { id: "desc" }, take: 400, include: { campaign: { select: { name: true } } } });
  return rows.map((c) => ({ id: c.id, promoCode: c.promoCode, name: c.name ?? "", campaignName: c.campaign.name, codeType: c.codeType, generationType: c.generationType, status: c.status, customerName: c.customerName ?? "", expiryDate: c.expiryDate ?? "", redeemedCount: c.redeemedCount, distributedCount: c.distributedCount, batchNo: c.generationBatch ?? "" }));
}

// ---------------------------------------------------------------- distribution

export async function distribute(ctx: Ctx, input: DistributionInput): Promise<{ count: number }> {
  const camp = await prisma.promoCampaign.findFirst({ where: { id: input.campaignId, ...bizWhere(ctx) } });
  if (!camp) throw new Error("Campaign not found.");
  const date = input.distributionDate || today();
  const recipients = input.recipients?.length ? input.recipients : [{ name: input.recipient, contact: input.recipientContact, customerId: input.customerId }];
  let count = 0;
  await prisma.$transaction(async (tx) => {
    for (const rcp of recipients) {
      await tx.promoDistribution.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, campaignId: camp.id, promoCodeId: input.promoCodeId ?? null, distributionDate: date, channel: input.channel, recipient: rcp.name || null, recipientContact: rcp.contact || null, customerId: rcp.customerId ?? null, deliveryStatus: input.deliveryStatus || "Sent", remarks: input.remarks || null, sentBy: ctx.userId, sentByName: ctx.userName } });
      count++;
    }
    if (input.promoCodeId) await tx.promoCode.update({ where: { id: input.promoCodeId }, data: { distributedCount: { increment: recipients.length }, status: "Issued" } });
  });
  await audit(ctx, "Distribution", input.promoCodeId ?? camp.id, "Promo Distributed", ctx.userId, ctx.userName, `${count} via ${input.channel}`);
  return { count };
}
export async function listDistributions(s: Scope, opts: { campaignId?: number; channel?: string }): Promise<PromoDistributionRow[]> {
  const where: Prisma.PromoDistributionWhereInput = { ...bizWhere(s) };
  if (opts.campaignId) where.campaignId = opts.campaignId;
  if (opts.channel && opts.channel !== "All") where.channel = opts.channel;
  const rows = await prisma.promoDistribution.findMany({ where, orderBy: { id: "desc" }, take: 400, include: { campaign: { select: { name: true } }, promoCode: { select: { promoCode: true } } } });
  return rows.map((d) => ({ id: d.id, distributionDate: d.distributionDate, channel: d.channel, recipient: d.recipient ?? "", recipientContact: d.recipientContact ?? "", campaignName: d.campaign.name, promoCode: d.promoCode?.promoCode ?? "", deliveryStatus: d.deliveryStatus, remarks: d.remarks ?? "", sentByName: d.sentByName ?? "", audience: d.audience ?? "", recipientCount: d.recipientCount, messageBody: d.messageBody ?? "", bannerImage: d.bannerImage ?? "" }));
}

// ------------------------------------------------ audience-targeted broadcast

/** Build the customer filter for a targeted audience segment. */
function audienceWhere(s: Scope, input: { audience: string; groupValue?: string; highValueMin?: number; customerIds?: number[] }): Prisma.CustomerWhereInput {
  const base: Prisma.CustomerWhereInput = { ...bizWhere(s) };
  switch (input.audience) {
    case "HighValue": return { ...base, totalSpent: { gte: input.highValueMin && input.highValueMin > 0 ? input.highValueMin : 10000 } };
    case "Group": return { ...base, customerGroup: input.groupValue || undefined };
    case "Specific": return { ...base, id: { in: input.customerIds?.length ? input.customerIds : [-1] } };
    default: return base; // All
  }
}

/** Distinct customer groups (for the Group audience selector). */
export async function listCustomerGroups(s: Scope): Promise<string[]> {
  const rows = await prisma.customer.findMany({ where: { ...bizWhere(s), customerGroup: { not: null } }, select: { customerGroup: true }, distinct: ["customerGroup"], take: 100 });
  return rows.map((r) => r.customerGroup).filter((x): x is string => !!x).sort();
}

/** Preview a targeted audience — how many customers + a small sample + group list. */
export async function previewAudience(s: Scope, input: { audience: string; groupValue?: string; highValueMin?: number; customerIds?: number[] }): Promise<AudiencePreview> {
  const where = audienceWhere(s, input);
  const [count, sample, groups] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({ where, select: { id: true, name: true }, orderBy: input.audience === "HighValue" ? { totalSpent: "desc" } : { id: "asc" }, take: 8 }),
    listCustomerGroups(s),
  ]);
  return { audience: input.audience, count, groups, sample: sample.map((c) => ({ id: c.id, name: c.name })) };
}

/** Send a promo campaign message to a targeted audience. The message + banner + the
 *  resolved recipient count are recorded as a distribution event. Actual SMS / WhatsApp
 *  / Email delivery is handled by the gateway integration (planned) — this records the
 *  broadcast and updates the code's distributed count. */
export async function sendCampaignMessage(ctx: Ctx, input: CampaignSendInput): Promise<{ recipientCount: number }> {
  const camp = await prisma.promoCampaign.findFirst({ where: { id: input.campaignId, ...bizWhere(ctx) } });
  if (!camp) throw new Error("Campaign not found.");
  const where = audienceWhere(ctx, input);
  const recipientCount = await prisma.customer.count({ where });
  if (recipientCount <= 0) throw new Error("No customers match the selected audience.");
  const label = AUDIENCE_LABELS[input.audience as keyof typeof AUDIENCE_LABELS] ?? input.audience;

  await prisma.$transaction(async (tx) => {
    await tx.promoDistribution.create({ data: {
      tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, campaignId: camp.id, promoCodeId: input.promoCodeId ?? null,
      distributionDate: today(), channel: input.channel, recipient: label, audience: input.audience, recipientCount,
      deliveryStatus: "Sent", messageBody: input.messageBody || null, bannerImage: input.bannerImage || null, remarks: input.remarks || null,
      sentBy: ctx.userId, sentByName: ctx.userName,
    } });
    if (input.promoCodeId) await tx.promoCode.update({ where: { id: input.promoCodeId }, data: { distributedCount: { increment: recipientCount }, status: "Issued" } });
  });
  await audit(ctx, "Distribution", input.promoCodeId ?? camp.id, "Promo Distributed", ctx.userId, ctx.userName, `${input.channel} → ${label} (${recipientCount} recipients)`);
  return { recipientCount };
}

// --------------------------------------------------------------- redemption engine

const ACTIVE_STATUSES = ["Active", "Issued"];

/** Validate a promo code against a bill (reuses the shared rule engine). */
export async function validatePromo(s: Scope, input: ValidateInput): Promise<ValidateResult> {
  const empty = (reason: string): ValidateResult => ({ valid: false, reason, promoCodeId: null, campaignName: "", discountType: "", discountAmount: 0, taxableReduced: 0, gstRule: "AfterGST", freeProductId: null, freeQty: 0 });
  const key = input.promoCode.trim();
  const code = await prisma.promoCode.findFirst({ where: { ...bizWhere(s), promoCode: key }, include: { campaign: { include: { rules: { where: { active: true }, include: { conditions: true, actions: true }, orderBy: { id: "asc" } } } } } });
  if (!code) return empty("Promo code not found.");
  const camp = code.campaign;
  const rule = camp.rules[0];
  const day = (input.date || today()).slice(0, 10);

  if (camp.status !== "Active") return empty(`Campaign is ${camp.status}.`);
  if (camp.startDate && day < camp.startDate) return empty("Campaign has not started.");
  if (camp.endDate && day > camp.endDate) return empty("Campaign has ended.");
  if (code.expiryDate && day > code.expiryDate) return empty("Promo code has expired.");
  const reusable = rule && (rule.usageType === "Reusable" || rule.usageType === "Unlimited" || rule.usageType === "MultipleUse");
  if (!ACTIVE_STATUSES.includes(code.status) && !(code.status === "Redeemed" && reusable)) return empty(`Promo code is ${code.status}.`);

  const cfg = await getConfig(s);
  if ((cfg.customerMapping === "Mandatory" || code.customerId) && code.customerId && code.customerId !== (input.customerId ?? -1)) return empty("This promo code is assigned to another customer.");
  // Shared "Same Code": one redemption per customer — same customer can't reuse it,
  // but different customers can. (Enforceable only when the customer is identified.)
  if (code.oncePerCustomer && input.customerId) {
    const used = await prisma.promoRedemption.count({ where: { tenantId: s.tenantId, promoCodeId: code.id, customerId: input.customerId, status: "Redeemed" } });
    if (used > 0) return empty("This customer has already used this promo code.");
  }
  if (!rule) return empty("No active rule configured for this campaign.");

  const items = input.items ?? [];
  const prodMeta = await loadProductMeta(prisma, items.map((i) => i.productId).filter((x): x is number => !!x));
  const dayStart = new Date(day + "T00:00:00"); const dayEnd = new Date(day + "T23:59:59");
  const [cCamp, cCust, cDay] = await Promise.all([
    rule.maxPerCampaign > 0 ? prisma.promoRedemption.count({ where: { tenantId: s.tenantId, campaignId: camp.id, status: "Redeemed" } }) : Promise.resolve(0),
    rule.maxPerCustomer > 0 && input.customerId ? prisma.promoRedemption.count({ where: { tenantId: s.tenantId, campaignId: camp.id, customerId: input.customerId, status: "Redeemed" } }) : Promise.resolve(0),
    rule.maxPerDay > 0 ? prisma.promoRedemption.count({ where: { tenantId: s.tenantId, campaignId: camp.id, status: "Redeemed", redeemedAt: { gte: dayStart, lte: dayEnd } } }) : Promise.resolve(0),
  ]);
  const ev = evaluateRule(rule, { billAmount: input.billAmount, items, customerId: input.customerId, channel: input.channel, paymentMode: input.paymentMode, date: day }, prodMeta, { campaign: cCamp, customer: cCust, day: cDay });
  if (!ev.valid) return empty(ev.reason);
  return { valid: true, reason: "Valid", promoCodeId: code.id, campaignName: camp.name, discountType: ev.discountType, discountAmount: ev.discountAmount, taxableReduced: ev.taxableReduced, gstRule: ev.gstRule, freeProductId: ev.freeProductId, freeQty: ev.freeQty };
}

/** Redeem a promo code (validate + record + mark redeemed + optional GL). */
export async function redeemPromo(ctx: Ctx, input: RedeemInput): Promise<{ redemptionId: number; discountAmount: number; promoCode: string }> {
  const v = await validatePromo(ctx, input);
  if (!v.valid || !v.promoCodeId) throw new Error(v.reason);
  const code = await prisma.promoCode.findFirst({ where: { id: v.promoCodeId, ...bizWhere(ctx) }, include: { campaign: { include: { rules: { where: { active: true }, orderBy: { id: "asc" }, take: 1 } } } } });
  if (!code) throw new Error("Promo code not found.");
  const rule = code.campaign.rules[0];
  // A shared once-per-customer code never exhausts globally; only a non-shared
  // SingleUse code flips to Redeemed after one use.
  const single = !code.oncePerCustomer && (!rule || rule.usageType === "SingleUse");

  const result = await prisma.$transaction(async (tx) => {
    let journalRef: string | null = null;
    if (input.post && v.discountAmount > 0) {
      const drCode = rule?.marketingExpenseCode || ACC.MARKETING_EXPENSE;
      const crCode = rule?.salesDiscountCode || ACC.SALES_DISCOUNT;
      const jid = await postJournal(tx, { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, voucherType: "JOURNAL", prefix: "PM", date: (input.date || today()).slice(0, 10), narration: `Promo ${code.promoCode} — ${code.campaign.name}`, sourceType: "PROMO_REDEMPTION", sourceId: code.id, refNo: code.promoCode, createdBy: ctx.userId, lines: [{ code: drCode, debit: v.discountAmount, narration: "Promotion cost" }, { code: crCode, credit: v.discountAmount, narration: "Sales discount funded by campaign" }] });
      if (jid) journalRef = `PM-${String(jid).padStart(6, "0")}`;
    }
    const red = await tx.promoRedemption.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, promoCodeId: code.id, campaignId: code.campaignId, saleId: input.saleId ?? null, invoiceNo: input.invoiceNo || null, customerId: input.customerId ?? code.customerId, customerName: code.customerName, channel: input.channel || null, billAmount: r2(input.billAmount), discountAmount: v.discountAmount, taxableReduced: v.taxableReduced, journalRef, redeemedBy: ctx.userId, redeemedByName: ctx.userName }, select: { id: true } });
    await tx.promoCode.update({ where: { id: code.id }, data: { status: single ? "Redeemed" : code.status, redeemedCount: { increment: 1 } } });
    return red.id;
  });
  await audit(ctx, "Redemption", code.id, "Promo Redeemed", ctx.userId, ctx.userName, `${code.promoCode} · discount ₹${v.discountAmount}`);
  return { redemptionId: result, discountAmount: v.discountAmount, promoCode: code.promoCode };
}

/** Restore promo redemptions for a sale inside an existing transaction — reverses the
 *  redemption record, decrements the count and re-activates single-use codes. Called
 *  by the Sales Cancellation / Return reversal (which run in their own tx). */
export async function restorePromoForSaleTx(tx: Prisma.TransactionClient, s: Scope, saleId: number): Promise<number> {
  const reds = await tx.promoRedemption.findMany({ where: { tenantId: s.tenantId, saleId, status: "Redeemed" } });
  for (const red of reds) {
    await tx.promoRedemption.update({ where: { id: red.id }, data: { status: "Reversed" } });
    const code = await tx.promoCode.findUnique({ where: { id: red.promoCodeId }, include: { campaign: { include: { rules: { where: { active: true }, orderBy: { id: "asc" }, take: 1 } } } } });
    if (code) {
      const single = !code.campaign.rules[0] || code.campaign.rules[0].usageType === "SingleUse";
      await tx.promoCode.update({ where: { id: code.id }, data: { redeemedCount: { decrement: 1 }, status: single && code.status === "Redeemed" ? "Active" : code.status } });
    }
  }
  return reds.length;
}

/** Standalone restore (Sales Return / manual reversal) — wraps the tx variant. */
export async function restorePromoForSale(ctx: Ctx, saleId: number, reason: string): Promise<{ restored: number }> {
  const restored = await prisma.$transaction((tx) => restorePromoForSaleTx(tx, ctx, saleId));
  if (restored) await audit(ctx, "Redemption", saleId, "Promo Restored", ctx.userId, ctx.userName, `${restored} code(s) — ${reason}`);
  return { restored };
}

// ------------------------------------------------------------------- dashboard

export async function getDashboard(s: Scope): Promise<PromoDashboard> {
  const [byStatus, activeCampaigns, redAgg, dist, camps, reds, budgetAgg] = await Promise.all([
    prisma.promoCode.groupBy({ by: ["status"], where: bizWhere(s), _count: true }),
    prisma.promoCampaign.count({ where: { ...bizWhere(s), status: "Active" } }),
    prisma.promoRedemption.aggregate({ where: { ...bizWhere(s), status: "Redeemed" }, _sum: { discountAmount: true }, _count: true }),
    prisma.promoDistribution.count({ where: bizWhere(s) }),
    prisma.promoRedemption.groupBy({ by: ["campaignId"], where: { ...bizWhere(s), status: "Redeemed" }, _count: true, _sum: { discountAmount: true } }),
    prisma.promoRedemption.findMany({ where: { ...bizWhere(s), status: "Redeemed" }, select: { redeemedAt: true, customerId: true, customerName: true, discountAmount: true, branchId: true } }),
    prisma.promoCampaign.aggregate({ where: bizWhere(s), _sum: { marketingBudget: true } }),
  ]);
  const st = (k: string) => byStatus.find((x) => x.status === k)?._count ?? 0;
  const totalCodes = byStatus.reduce((a, x) => a + x._count, 0);
  const redeemedCodes = st("Redeemed");
  const totalDiscount = num(redAgg._sum.discountAmount);

  const campIds = camps.map((c) => c.campaignId).filter((x): x is number => x != null);
  const names = campIds.length ? new Map((await prisma.promoCampaign.findMany({ where: { id: { in: campIds } }, select: { id: true, name: true, marketingBudget: true } })).map((c) => [c.id, { name: c.name, budget: num(c.marketingBudget) }])) : new Map<number, { name: string; budget: number }>();
  const topCampaigns = camps.map((c) => { const meta = c.campaignId != null ? names.get(c.campaignId) : null; const disc = num(c._sum.discountAmount); const budget = meta?.budget ?? 0; return { name: meta?.name ?? "—", redeemed: c._count, discount: disc, roi: budget > 0 ? r2((disc / budget) * 100) : 0 }; }).sort((a, b) => b.redeemed - a.redeemed).slice(0, 5);

  // Top customers
  const custMap = new Map<string, { name: string; redeemed: number; discount: number }>();
  for (const r of reds) { if (!r.customerId) continue; const k = String(r.customerId); const e = custMap.get(k) ?? { name: r.customerName ?? `#${r.customerId}`, redeemed: 0, discount: 0 }; e.redeemed++; e.discount += num(r.discountAmount); custMap.set(k, e); }
  const topCustomers = [...custMap.values()].sort((a, b) => b.discount - a.discount).slice(0, 5);

  // Top products (from redemptions' sales lines)
  const saleIds = (await prisma.promoRedemption.findMany({ where: { ...bizWhere(s), status: "Redeemed", saleId: { not: null } }, select: { saleId: true } })).map((r) => r.saleId).filter((x): x is number => !!x);
  let topProducts: { name: string; count: number }[] = [];
  if (saleIds.length) {
    const lines = await prisma.saleLine.groupBy({ by: ["productName"], where: { saleId: { in: saleIds } }, _sum: { qty: true } });
    topProducts = lines.map((l) => ({ name: l.productName, count: num(l._sum.qty) })).sort((a, b) => b.count - a.count).slice(0, 5);
  }

  // Channel breakup
  const distByChannel = await prisma.promoDistribution.groupBy({ by: ["channel"], where: bizWhere(s), _count: true });
  const channelBreakup = distByChannel.map((d) => ({ name: d.channel, value: d._count })).sort((a, b) => b.value - a.value);

  // Monthly redemption (last 6)
  const monthly = new Map<string, number>();
  for (const r of reds) { const k = r.redeemedAt.toISOString().slice(0, 7); monthly.set(k, (monthly.get(k) ?? 0) + 1); }
  const monthlyRedemption = [...monthly.entries()].sort().slice(-6).map(([k, v]) => ({ name: k, value: v }));

  // Top branches
  const brMap = new Map<number, number>();
  for (const r of reds) { if (r.branchId == null) continue; brMap.set(r.branchId, (brMap.get(r.branchId) ?? 0) + 1); }
  const brIds = [...brMap.keys()];
  const brNames = brIds.length ? new Map((await prisma.branch.findMany({ where: { id: { in: brIds } }, select: { id: true, name: true } })).map((x) => [x.id, x.name])) : new Map<number, string>();
  const topBranches = [...brMap.entries()].map(([id, n]) => ({ name: brNames.get(id) ?? `Branch #${id}`, redeemed: n })).sort((a, b) => b.redeemed - a.redeemed).slice(0, 5);

  const totalBudget = num(budgetAgg._sum.marketingBudget);
  return {
    totalCodes, activeCodes: st("Active") + st("Issued"), expiredCodes: st("Expired"), redeemedCodes, distributedCount: dist,
    activeCampaigns, totalDiscount, redemptionRate: totalCodes > 0 ? r2((redeemedCodes / totalCodes) * 100) : 0,
    distributionRate: totalCodes > 0 ? r2((dist / totalCodes) * 100) : 0,
    topCampaigns, topCustomers, topProducts, topBranches, channelBreakup, monthlyRedemption,
  };
  void totalBudget;
}

// -------------------------------------------------------------------- reports

export async function getReport(s: Scope, type: ReportType, opts: { campaignId?: number; from?: string; to?: string }): Promise<ReportResult> {
  const where = bizWhere(s);
  const dateBetween = (d: string) => (!opts.from || d >= opts.from) && (!opts.to || d <= opts.to);
  switch (type) {
    case "register": {
      const rows = await prisma.promoCode.findMany({ where: { ...where, ...(opts.campaignId ? { campaignId: opts.campaignId } : {}) }, orderBy: { id: "desc" }, take: 5000, include: { campaign: { select: { name: true } } } });
      return { title: "Promo Register", columns: ["Promo Code", "Name", "Campaign", "Type", "Generation", "Status", "Customer", "Expiry", "Redeemed", "Distributed"], rows: rows.map((c) => [c.promoCode, c.name ?? "", c.campaign.name, c.codeType, c.generationType, c.status, c.customerName ?? "", c.expiryDate ?? "", c.redeemedCount, c.distributedCount]) };
    }
    case "redemption": {
      const rows = await prisma.promoRedemption.findMany({ where: { ...where, ...(opts.campaignId ? { campaignId: opts.campaignId } : {}) }, orderBy: { id: "desc" }, take: 5000, include: { promoCodeRef: { select: { promoCode: true } }, campaign: { select: { name: true } } } });
      return { title: "Promo Redemption Report", columns: ["Date", "Promo Code", "Campaign", "Invoice", "Customer", "Channel", "Bill", "Discount", "Status"], rows: rows.filter((r) => dateBetween(r.redeemedAt.toISOString().slice(0, 10))).map((r) => [r.redeemedAt.toISOString().slice(0, 10), r.promoCodeRef.promoCode, r.campaign?.name ?? "", r.invoiceNo ?? "", r.customerName ?? "", r.channel ?? "", num(r.billAmount), num(r.discountAmount), r.status]) };
    }
    case "campaign": {
      const camps = await prisma.promoCampaign.findMany({ where, orderBy: { id: "desc" }, take: 1000, include: { _count: { select: { codes: true, redemptions: true, distributions: true } } } });
      const sums = await prisma.promoRedemption.groupBy({ by: ["campaignId"], where: { ...where, status: "Redeemed" }, _sum: { discountAmount: true } });
      const dmap = new Map(sums.map((x) => [x.campaignId, num(x._sum.discountAmount)]));
      return { title: "Campaign Performance", columns: ["Campaign", "Type", "Status", "Budget", "Codes", "Distributed", "Redeemed", "Discount", "ROI %"], rows: camps.map((c) => { const disc = dmap.get(c.id) ?? 0; const budget = num(c.marketingBudget); return [c.name, c.campaignType, c.status, budget, c._count.codes, c._count.distributions, c._count.redemptions, disc, budget > 0 ? r2((disc / budget) * 100) : 0]; }) };
    }
    case "distribution": {
      const rows = await prisma.promoDistribution.findMany({ where: { ...where, ...(opts.campaignId ? { campaignId: opts.campaignId } : {}) }, orderBy: { id: "desc" }, take: 5000, include: { campaign: { select: { name: true } }, promoCode: { select: { promoCode: true } } } });
      return { title: "Distribution Report", columns: ["Date", "Channel", "Campaign", "Promo Code", "Recipient", "Contact", "Status", "Remarks"], rows: rows.filter((r) => dateBetween(r.distributionDate)).map((d) => [d.distributionDate, d.channel, d.campaign.name, d.promoCode?.promoCode ?? "", d.recipient ?? "", d.recipientContact ?? "", d.deliveryStatus, d.remarks ?? ""]) };
    }
    case "customer": {
      const rows = await prisma.promoRedemption.groupBy({ by: ["customerId", "customerName"], where: { ...where, status: "Redeemed" }, _count: true, _sum: { discountAmount: true } });
      return { title: "Customer Redemption", columns: ["Customer", "Redemptions", "Total Discount"], rows: rows.filter((r) => r.customerId).map((r) => [r.customerName ?? `#${r.customerId}`, r._count, num(r._sum.discountAmount)]).sort((a, b) => Number(b[2]) - Number(a[2])) };
    }
    case "branch": {
      const rows = await prisma.promoRedemption.groupBy({ by: ["branchId"], where: { ...where, status: "Redeemed" }, _count: true, _sum: { discountAmount: true } });
      const ids = rows.map((r) => r.branchId).filter((x): x is number => x != null);
      const bnames = ids.length ? new Map((await prisma.branch.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((x) => [x.id, x.name])) : new Map<number, string>();
      return { title: "Branch Redemption", columns: ["Branch", "Redemptions", "Total Discount"], rows: rows.map((r) => [r.branchId != null ? (bnames.get(r.branchId) ?? `#${r.branchId}`) : "—", r._count, num(r._sum.discountAmount)]) };
    }
    case "product": case "category": {
      const saleIds = (await prisma.promoRedemption.findMany({ where: { ...where, status: "Redeemed", saleId: { not: null } }, select: { saleId: true } })).map((r) => r.saleId).filter((x): x is number => !!x);
      if (!saleIds.length) return { title: type === "product" ? "Product Redemption" : "Category Redemption", columns: [type === "product" ? "Product" : "Category", "Qty", "Value"], rows: [] };
      if (type === "product") {
        const lines = await prisma.saleLine.groupBy({ by: ["productName"], where: { saleId: { in: saleIds } }, _sum: { qty: true, value: true } });
        return { title: "Product Redemption", columns: ["Product", "Qty", "Value"], rows: lines.map((l) => [l.productName, num(l._sum.qty), num(l._sum.value)]).sort((a, b) => Number(b[2]) - Number(a[2])) };
      }
      const lines = await prisma.saleLine.findMany({ where: { saleId: { in: saleIds } }, select: { productId: true, qty: true, value: true } });
      const pids = [...new Set(lines.map((l) => l.productId))];
      const cats = new Map((await prisma.product.findMany({ where: { id: { in: pids } }, select: { id: true, category: true } })).map((p) => [p.id, p.category ?? "Uncategorised"]));
      const agg = new Map<string, { qty: number; value: number }>();
      for (const l of lines) { const c = cats.get(l.productId) ?? "Uncategorised"; const e = agg.get(c) ?? { qty: 0, value: 0 }; e.qty += num(l.qty); e.value += num(l.value); agg.set(c, e); }
      return { title: "Category Redemption", columns: ["Category", "Qty", "Value"], rows: [...agg.entries()].map(([k, v]) => [k, v.qty, v.value]).sort((a, b) => Number(b[2]) - Number(a[2])) };
    }
    case "expired": {
      const rows = await prisma.promoCode.findMany({ where: { ...where, OR: [{ status: "Expired" }, { expiryDate: { lt: today(), not: null } }] }, orderBy: { id: "desc" }, take: 5000, include: { campaign: { select: { name: true } } } });
      return { title: "Expired Promo Report", columns: ["Promo Code", "Campaign", "Status", "Expiry", "Redeemed"], rows: rows.map((c) => [c.promoCode, c.campaign.name, c.status, c.expiryDate ?? "", c.redeemedCount]) };
    }
    case "unused": {
      const rows = await prisma.promoCode.findMany({ where: { ...where, status: { in: ["Active", "Issued"] }, redeemedCount: 0 }, orderBy: { id: "desc" }, take: 5000, include: { campaign: { select: { name: true } } } });
      return { title: "Unused Promo Report", columns: ["Promo Code", "Campaign", "Status", "Customer", "Distributed", "Expiry"], rows: rows.map((c) => [c.promoCode, c.campaign.name, c.status, c.customerName ?? "", c.distributedCount, c.expiryDate ?? ""]) };
    }
    case "roi": {
      const camps = await prisma.promoCampaign.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
      const sums = await prisma.promoRedemption.groupBy({ by: ["campaignId"], where: { ...where, status: "Redeemed" }, _sum: { discountAmount: true }, _count: true });
      const dmap = new Map(sums.map((x) => [x.campaignId, { disc: num(x._sum.discountAmount), n: x._count }]));
      return { title: "Marketing ROI", columns: ["Campaign", "Budget", "Redemptions", "Discount Given", "ROI %", "Cost / Redemption"], rows: camps.map((c) => { const d = dmap.get(c.id) ?? { disc: 0, n: 0 }; const budget = num(c.marketingBudget); return [c.name, budget, d.n, d.disc, budget > 0 ? r2((d.disc / budget) * 100) : 0, d.n > 0 ? r2(budget / d.n) : 0]; }) };
    }
    default: return { title: "Report", columns: [], rows: [] };
  }
}

// ---------------------------------------------------------------------- audit

export interface AuditRow { id: number; entityType: string; entityId: number | null; action: string; byName: string; note: string; at: string }
export async function listAudit(s: Scope): Promise<AuditRow[]> {
  const rows = await prisma.promoAudit.findMany({ where: { tenantId: s.tenantId }, orderBy: { id: "desc" }, take: 300 });
  return rows.map((a) => ({ id: a.id, entityType: a.entityType, entityId: a.entityId, action: a.action, byName: a.byName ?? "", note: a.note ?? "", at: a.at.toISOString() }));
}
