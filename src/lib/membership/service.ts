import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ensureAccounts } from "@/lib/accounting/accounts";
import {
  CUSTOMER_FIELDS, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS, COUPON_BENEFIT_KEYS, VOUCHER_BENEFIT_KEYS, SERVICE_BENEFIT_KEYS,
  REPORT_LABELS, CUSTOMER_FIELD_LABELS, NOTIFICATION_EVENT_LABELS,
  type GeneralConfig, type GeneralConfigInput, type LevelInput, type LevelRow, type QualificationInput, type QualificationRow,
  type BenefitInput, type FeeInput, type ValidityInput, type UpgradeInput, type DowngradeInput, type RenewalInput,
  type CustomerConfigInput, type FinanceConfigInput, type NotificationConfigInput, type CardConfigInput, type ApprovalConfigInput,
  type AccountRef, type ReportType, type ReportResult, type AuditRow,
} from "@/lib/contracts/membership";

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const parseObj = (s: string | null | undefined): Record<string, unknown> => { if (!s) return {}; try { const v = JSON.parse(s); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
const parseArr = (s: string | null | undefined): string[] => { if (!s) return []; try { const v = JSON.parse(s); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };

export interface Scope { tenantId: number; businessId: number | null }
export interface Ctx extends Scope { branchId: number | null; userId: number; userName: string | null }
const bizWhere = (s: Scope) => (s.businessId != null ? { tenantId: s.tenantId, businessId: s.businessId } : { tenantId: s.tenantId });

async function audit(s: Scope, entityType: string, entityId: number | null, action: string, byUser: number | null, byName: string | null, note?: string) {
  try { await prisma.membershipAudit.create({ data: { tenantId: s.tenantId, businessId: s.businessId, entityType, entityId, action, byUser, byName, note: note ?? null } }); } catch { /* never blocks */ }
}

export async function listAccounts(s: Scope): Promise<AccountRef[]> {
  await prisma.$transaction((tx) => ensureAccounts(tx, s.tenantId));
  const rows = await prisma.ledgerAccount.findMany({ where: { tenantId: s.tenantId }, orderBy: { code: "asc" }, select: { code: true, name: true, type: true } });
  return rows.map((a) => ({ code: a.code, name: a.name, type: a.type }));
}

// ---------------------------------------------------------- 1. general config
async function generalRow(s: Scope) {
  return (await prisma.membershipConfiguration.findFirst({ where: bizWhere(s) })) ?? prisma.membershipConfiguration.create({ data: { tenantId: s.tenantId, businessId: s.businessId } });
}
export async function getGeneral(s: Scope): Promise<GeneralConfig> {
  const c = await generalRow(s);
  return {
    enableModule: c.enableModule, membershipType: c.membershipType as GeneralConfig["membershipType"], numberGeneration: c.numberGeneration as GeneralConfig["numberGeneration"],
    numberPrefix: c.numberPrefix, numberLength: c.numberLength, runningNumber: c.runningNumber, defaultStatus: c.defaultStatus,
    allowMultiple: c.allowMultiple, allowTransfer: c.allowTransfer, autoActivate: c.autoActivate, requireApproval: c.requireApproval,
    enableExpiry: c.enableExpiry, enableAutoRenewal: c.enableAutoRenewal, enableAutoUpgrade: c.enableAutoUpgrade, enableAutoDowngrade: c.enableAutoDowngrade,
    renewalReminderDays: c.renewalReminderDays, expiryReminderDays: c.expiryReminderDays, gracePeriodDays: c.gracePeriodDays,
  };
}
export async function saveGeneral(ctx: Ctx, input: GeneralConfigInput): Promise<GeneralConfig> {
  const c = await generalRow(ctx);
  await prisma.membershipConfiguration.update({ where: { id: c.id }, data: { ...input } });
  await audit(ctx, "Config", c.id, "Configuration Modified", ctx.userId, ctx.userName, "General configuration");
  return getGeneral(ctx);
}

// ------------------------------------------------------------- 2. levels
const toLevelRow = (l: Prisma.MembershipLevelGetPayload<object>): LevelRow => ({ id: l.id, code: l.code, name: l.name, description: l.description ?? "", priority: l.priority, displayOrder: l.displayOrder, themeColor: l.themeColor ?? "", icon: l.icon ?? "", status: l.status });
export async function listLevels(s: Scope): Promise<LevelRow[]> {
  const rows = await prisma.membershipLevel.findMany({ where: bizWhere(s), orderBy: [{ displayOrder: "asc" }, { priority: "asc" }, { id: "asc" }] });
  return rows.map(toLevelRow);
}
export async function createLevel(ctx: Ctx, input: LevelInput): Promise<number> {
  const l = await prisma.membershipLevel.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, code: input.code, name: input.name, description: input.description || null, priority: input.priority ?? 0, displayOrder: input.displayOrder ?? 0, themeColor: input.themeColor || null, icon: input.icon || null, status: input.status || "Active", createdBy: ctx.userId, createdByName: ctx.userName } });
  await audit(ctx, "Level", l.id, "Membership Level Added", ctx.userId, ctx.userName, `${input.code} — ${input.name}`);
  return l.id;
}
export async function updateLevel(ctx: Ctx, id: number, input: LevelInput): Promise<void> {
  const ex = await prisma.membershipLevel.findFirst({ where: { id, ...bizWhere(ctx) } });
  if (!ex) throw new Error("Level not found.");
  await prisma.membershipLevel.update({ where: { id }, data: { code: input.code, name: input.name, description: input.description || null, priority: input.priority ?? 0, displayOrder: input.displayOrder ?? 0, themeColor: input.themeColor || null, icon: input.icon || null, status: input.status || ex.status } });
  await audit(ctx, "Level", id, "Membership Level Modified", ctx.userId, ctx.userName, input.name);
}
export async function deleteLevel(ctx: Ctx, id: number): Promise<void> {
  const ex = await prisma.membershipLevel.findFirst({ where: { id, ...bizWhere(ctx) } });
  if (!ex) throw new Error("Level not found.");
  await prisma.membershipLevel.delete({ where: { id } }); // cascades benefit/fee/validity/upgrade/downgrade/qualification
  await audit(ctx, "Level", id, "Membership Level Deleted", ctx.userId, ctx.userName, ex.name);
}
async function assertLevel(ctx: Ctx, levelId: number) { const l = await prisma.membershipLevel.findFirst({ where: { id: levelId, ...bizWhere(ctx) } }); if (!l) throw new Error("Level not found."); return l; }

// ---------------------------------------------------- 3. qualification rules
export async function listQualification(s: Scope, levelId: number): Promise<QualificationRow[]> {
  const rows = await prisma.membershipQualificationRule.findMany({ where: { tenantId: s.tenantId, levelId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return rows.map((r) => ({ id: r.id, levelId: r.levelId, method: r.method as QualificationRow["method"], evaluationPeriod: r.evaluationPeriod as QualificationRow["evaluationPeriod"], minPurchase: num(r.minPurchase), minBills: r.minBills, minPoints: r.minPoints, minFee: num(r.minFee), minFrequency: r.minFrequency, referralCount: r.referralCount, customerType: r.customerType ?? "", campaignRef: r.campaignRef ?? "", combineLogic: r.combineLogic as QualificationRow["combineLogic"], sortOrder: r.sortOrder, active: r.active }));
}
export async function saveQualification(ctx: Ctx, levelId: number, ruleId: number | null, input: QualificationInput): Promise<number> {
  await assertLevel(ctx, levelId);
  const data = { tenantId: ctx.tenantId, levelId, method: input.method, evaluationPeriod: input.evaluationPeriod || "Yearly", minPurchase: r2(input.minPurchase ?? 0), minBills: input.minBills ?? 0, minPoints: input.minPoints ?? 0, minFee: r2(input.minFee ?? 0), minFrequency: input.minFrequency ?? 0, referralCount: input.referralCount ?? 0, customerType: input.customerType || null, campaignRef: input.campaignRef || null, combineLogic: input.combineLogic || "OR", sortOrder: input.sortOrder ?? 0, active: input.active ?? true };
  let id: number;
  if (ruleId) { const ex = await prisma.membershipQualificationRule.findFirst({ where: { id: ruleId, tenantId: ctx.tenantId, levelId } }); if (!ex) throw new Error("Rule not found."); await prisma.membershipQualificationRule.update({ where: { id: ruleId }, data }); id = ruleId; }
  else { const r = await prisma.membershipQualificationRule.create({ data }); id = r.id; }
  await audit(ctx, "Qualification", id, ruleId ? "Rule Modified" : "Rule Added", ctx.userId, ctx.userName, `${input.method} for level ${levelId}`);
  return id;
}
export async function deleteQualification(ctx: Ctx, ruleId: number): Promise<void> {
  const ex = await prisma.membershipQualificationRule.findFirst({ where: { id: ruleId, tenantId: ctx.tenantId } });
  if (!ex) throw new Error("Rule not found.");
  await prisma.membershipQualificationRule.delete({ where: { id: ruleId } });
  await audit(ctx, "Qualification", ruleId, "Rule Deleted", ctx.userId, ctx.userName);
}

// ------------------------------------------------------------- 4. benefit
const defBoolMap = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, false]));
export async function getBenefit(s: Scope, levelId: number) {
  const c = await prisma.membershipBenefit.findFirst({ where: { tenantId: s.tenantId, levelId } });
  return {
    billDiscountPct: num(c?.billDiscountPct), maxDiscount: num(c?.maxDiscount), productDiscountPct: num(c?.productDiscountPct), categoryDiscountPct: num(c?.categoryDiscountPct), brandDiscountPct: num(c?.brandDiscountPct),
    maxDiscountPerBill: num(c?.maxDiscountPerBill), maxDiscountPerDay: num(c?.maxDiscountPerDay), maxDiscountPerMonth: num(c?.maxDiscountPerMonth),
    pointMultiplier: c ? num(c.pointMultiplier) : 1, welcomePoints: c?.welcomePoints ?? 0, birthdayPoints: c?.birthdayPoints ?? 0, anniversaryPoints: c?.anniversaryPoints ?? 0, bonusPoints: c?.bonusPoints ?? 0,
    exclusivePromo: c?.exclusivePromo ?? false, campaignEligible: c?.campaignEligible ?? false,
    couponBenefits: { ...defBoolMap(COUPON_BENEFIT_KEYS), ...parseObj(c?.couponBenefits) },
    voucherBenefits: { ...defBoolMap(VOUCHER_BENEFIT_KEYS), ...parseObj(c?.voucherBenefits) },
    serviceBenefits: { ...defBoolMap(SERVICE_BENEFIT_KEYS), ...parseObj(c?.serviceBenefits) },
  };
}
export async function saveBenefit(ctx: Ctx, levelId: number, input: BenefitInput): Promise<void> {
  await assertLevel(ctx, levelId);
  const data = {
    billDiscountPct: r2(input.billDiscountPct ?? 0), maxDiscount: r2(input.maxDiscount ?? 0), productDiscountPct: r2(input.productDiscountPct ?? 0), categoryDiscountPct: r2(input.categoryDiscountPct ?? 0), brandDiscountPct: r2(input.brandDiscountPct ?? 0),
    maxDiscountPerBill: r2(input.maxDiscountPerBill ?? 0), maxDiscountPerDay: r2(input.maxDiscountPerDay ?? 0), maxDiscountPerMonth: r2(input.maxDiscountPerMonth ?? 0),
    pointMultiplier: r2(input.pointMultiplier ?? 1), welcomePoints: input.welcomePoints ?? 0, birthdayPoints: input.birthdayPoints ?? 0, anniversaryPoints: input.anniversaryPoints ?? 0, bonusPoints: input.bonusPoints ?? 0,
    exclusivePromo: input.exclusivePromo ?? false, campaignEligible: input.campaignEligible ?? false,
    couponBenefits: JSON.stringify(input.couponBenefits ?? {}), voucherBenefits: JSON.stringify(input.voucherBenefits ?? {}), serviceBenefits: JSON.stringify(input.serviceBenefits ?? {}),
  };
  await prisma.membershipBenefit.upsert({ where: { levelId }, create: { tenantId: ctx.tenantId, levelId, ...data }, update: data });
  await audit(ctx, "Benefit", levelId, "Benefit Modified", ctx.userId, ctx.userName, `Level ${levelId}`);
}

// ----------------------------------------------------------------- 5. fee
export async function getFee(s: Scope, levelId: number) {
  const c = await prisma.membershipFeeConfig.findFirst({ where: { tenantId: s.tenantId, levelId } });
  return { registrationFee: num(c?.registrationFee), renewalFee: num(c?.renewalFee), securityDeposit: num(c?.securityDeposit), refundable: c?.refundable ?? false, currency: c?.currency ?? "INR", gstApplicable: c?.gstApplicable ?? false, gstPercentage: num(c?.gstPercentage), discountOnRenewal: num(c?.discountOnRenewal), lateRenewalCharge: num(c?.lateRenewalCharge) };
}
export async function saveFee(ctx: Ctx, levelId: number, input: FeeInput): Promise<void> {
  await assertLevel(ctx, levelId);
  const data = { registrationFee: r2(input.registrationFee ?? 0), renewalFee: r2(input.renewalFee ?? 0), securityDeposit: r2(input.securityDeposit ?? 0), refundable: input.refundable ?? false, currency: input.currency || "INR", gstApplicable: input.gstApplicable ?? false, gstPercentage: r2(input.gstPercentage ?? 0), discountOnRenewal: r2(input.discountOnRenewal ?? 0), lateRenewalCharge: r2(input.lateRenewalCharge ?? 0) };
  await prisma.membershipFeeConfig.upsert({ where: { levelId }, create: { tenantId: ctx.tenantId, levelId, ...data }, update: data });
  await audit(ctx, "Fee", levelId, "Fee Modified", ctx.userId, ctx.userName, `Level ${levelId}`);
}

// ------------------------------------------------------------ 6. validity
export async function getValidity(s: Scope, levelId: number) {
  const c = await prisma.membershipValidityConfig.findFirst({ where: { tenantId: s.tenantId, levelId } });
  return { validityType: (c?.validityType ?? "Yearly"), validityDays: c?.validityDays ?? 365, effectiveFrom: c?.effectiveFrom ?? "", effectiveTo: c?.effectiveTo ?? "", gracePeriodDays: c?.gracePeriodDays ?? 0 };
}
export async function saveValidity(ctx: Ctx, levelId: number, input: ValidityInput): Promise<void> {
  await assertLevel(ctx, levelId);
  const data = { validityType: input.validityType || "Yearly", validityDays: input.validityDays ?? 365, effectiveFrom: input.effectiveFrom || null, effectiveTo: input.effectiveTo || null, gracePeriodDays: input.gracePeriodDays ?? 0 };
  await prisma.membershipValidityConfig.upsert({ where: { levelId }, create: { tenantId: ctx.tenantId, levelId, ...data }, update: data });
  await audit(ctx, "Validity", levelId, "Validity Modified", ctx.userId, ctx.userName, `Level ${levelId}`);
}

// ------------------------------------------------------------- 7. upgrade
export async function getUpgrade(s: Scope, levelId: number) {
  const c = await prisma.membershipUpgradeRule.findFirst({ where: { tenantId: s.tenantId, levelId } });
  return { autoUpgrade: c?.autoUpgrade ?? false, manualUpgrade: c?.manualUpgrade ?? true, approvalRequired: c?.approvalRequired ?? false, upgradeBasedOn: parseArr(c?.upgradeBasedOn), minPurchase: num(c?.minPurchase), minBills: c?.minBills ?? 0, minPoints: c?.minPoints ?? 0, minFee: num(c?.minFee), evaluationPeriod: (c?.evaluationPeriod ?? "Yearly"), active: c?.active ?? true };
}
export async function saveUpgrade(ctx: Ctx, levelId: number, input: UpgradeInput): Promise<void> {
  await assertLevel(ctx, levelId);
  const data = { autoUpgrade: input.autoUpgrade ?? false, manualUpgrade: input.manualUpgrade ?? true, approvalRequired: input.approvalRequired ?? false, upgradeBasedOn: JSON.stringify(input.upgradeBasedOn ?? []), minPurchase: r2(input.minPurchase ?? 0), minBills: input.minBills ?? 0, minPoints: input.minPoints ?? 0, minFee: r2(input.minFee ?? 0), evaluationPeriod: input.evaluationPeriod || "Yearly", active: input.active ?? true };
  await prisma.membershipUpgradeRule.upsert({ where: { levelId }, create: { tenantId: ctx.tenantId, levelId, ...data }, update: data });
  await audit(ctx, "Upgrade", levelId, "Rule Modified", ctx.userId, ctx.userName, `Level ${levelId}`);
}

// ----------------------------------------------------------- 8. downgrade
export async function getDowngrade(s: Scope, levelId: number) {
  const c = await prisma.membershipDowngradeRule.findFirst({ where: { tenantId: s.tenantId, levelId } });
  return { autoDowngrade: c?.autoDowngrade ?? false, manualDowngrade: c?.manualDowngrade ?? true, approvalRequired: c?.approvalRequired ?? false, gracePeriodDays: c?.gracePeriodDays ?? 30, purchaseThreshold: num(c?.purchaseThreshold), billThreshold: c?.billThreshold ?? 0, pointThreshold: c?.pointThreshold ?? 0, active: c?.active ?? true };
}
export async function saveDowngrade(ctx: Ctx, levelId: number, input: DowngradeInput): Promise<void> {
  await assertLevel(ctx, levelId);
  const data = { autoDowngrade: input.autoDowngrade ?? false, manualDowngrade: input.manualDowngrade ?? true, approvalRequired: input.approvalRequired ?? false, gracePeriodDays: input.gracePeriodDays ?? 30, purchaseThreshold: r2(input.purchaseThreshold ?? 0), billThreshold: input.billThreshold ?? 0, pointThreshold: input.pointThreshold ?? 0, active: input.active ?? true };
  await prisma.membershipDowngradeRule.upsert({ where: { levelId }, create: { tenantId: ctx.tenantId, levelId, ...data }, update: data });
  await audit(ctx, "Downgrade", levelId, "Rule Modified", ctx.userId, ctx.userName, `Level ${levelId}`);
}

// ---------------------------------------- singleton config helper (9-14)
async function singletonRow<T extends { id: number }>(finder: () => Promise<T | null>, creator: () => Promise<T>): Promise<T> {
  return (await finder()) ?? creator();
}

// 9. renewal
export async function getRenewal(s: Scope) {
  const c = await singletonRow(() => prisma.membershipRenewalConfig.findFirst({ where: bizWhere(s) }), () => prisma.membershipRenewalConfig.create({ data: { tenantId: s.tenantId, businessId: s.businessId } }));
  return { autoRenewal: c.autoRenewal, manualRenewal: c.manualRenewal, renewalFee: num(c.renewalFee), renewalValidityDays: c.renewalValidityDays, renewalReminderDays: c.renewalReminderDays, renewalBonusPoints: c.renewalBonusPoints, renewalCoupon: c.renewalCoupon, renewalGiftVoucher: c.renewalGiftVoucher };
}
export async function saveRenewal(ctx: Ctx, input: RenewalInput) {
  const c = await singletonRow(() => prisma.membershipRenewalConfig.findFirst({ where: bizWhere(ctx) }), () => prisma.membershipRenewalConfig.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId } }));
  await prisma.membershipRenewalConfig.update({ where: { id: c.id }, data: { autoRenewal: input.autoRenewal, manualRenewal: input.manualRenewal, renewalFee: r2(input.renewalFee ?? 0), renewalValidityDays: input.renewalValidityDays ?? 365, renewalReminderDays: input.renewalReminderDays ?? 15, renewalBonusPoints: input.renewalBonusPoints ?? 0, renewalCoupon: input.renewalCoupon, renewalGiftVoucher: input.renewalGiftVoucher } });
  await audit(ctx, "Renewal", c.id, "Configuration Modified", ctx.userId, ctx.userName, "Renewal configuration");
  return getRenewal(ctx);
}

// 10. customer
export async function getCustomerConfig(s: Scope) {
  const c = await singletonRow(() => prisma.membershipCustomerConfig.findFirst({ where: bizWhere(s) }), () => prisma.membershipCustomerConfig.create({ data: { tenantId: s.tenantId, businessId: s.businessId } }));
  const saved = parseObj(c.fieldsJson) as Record<string, { visible?: boolean; mandatory?: boolean }>;
  const fields: Record<string, { visible: boolean; mandatory: boolean }> = {};
  for (const k of CUSTOMER_FIELDS) {
    const def = k === "customerName" || k === "mobileNumber";
    fields[k] = { visible: saved[k]?.visible ?? def, mandatory: saved[k]?.mandatory ?? def };
  }
  return { fields };
}
export async function saveCustomerConfig(ctx: Ctx, input: CustomerConfigInput) {
  const c = await singletonRow(() => prisma.membershipCustomerConfig.findFirst({ where: bizWhere(ctx) }), () => prisma.membershipCustomerConfig.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId } }));
  await prisma.membershipCustomerConfig.update({ where: { id: c.id }, data: { fieldsJson: JSON.stringify(input.fields ?? {}) } });
  await audit(ctx, "Customer", c.id, "Configuration Modified", ctx.userId, ctx.userName, "Customer information configuration");
  return getCustomerConfig(ctx);
}

// 11. finance
export async function getFinance(s: Scope) {
  const c = await singletonRow(() => prisma.membershipFinanceConfig.findFirst({ where: bizWhere(s) }), () => prisma.membershipFinanceConfig.create({ data: { tenantId: s.tenantId, businessId: s.businessId } }));
  return { registrationFeeAccount: c.registrationFeeAccount ?? "", renewalFeeAccount: c.renewalFeeAccount ?? "", discountAccount: c.discountAccount ?? "", refundAccount: c.refundAccount ?? "", marketingExpenseAccount: c.marketingExpenseAccount ?? "", costCenter: c.costCenter ?? "", department: c.department ?? "", project: c.project ?? "" };
}
export async function saveFinance(ctx: Ctx, input: FinanceConfigInput) {
  const c = await singletonRow(() => prisma.membershipFinanceConfig.findFirst({ where: bizWhere(ctx) }), () => prisma.membershipFinanceConfig.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId } }));
  await prisma.membershipFinanceConfig.update({ where: { id: c.id }, data: { registrationFeeAccount: input.registrationFeeAccount || null, renewalFeeAccount: input.renewalFeeAccount || null, discountAccount: input.discountAccount || null, refundAccount: input.refundAccount || null, marketingExpenseAccount: input.marketingExpenseAccount || null, costCenter: input.costCenter || null, department: input.department || null, project: input.project || null } });
  await audit(ctx, "Finance", c.id, "Configuration Modified", ctx.userId, ctx.userName, "Finance configuration");
  return getFinance(ctx);
}

// 12. notification
export async function getNotification(s: Scope) {
  const c = await singletonRow(() => prisma.membershipNotificationConfig.findFirst({ where: bizWhere(s) }), () => prisma.membershipNotificationConfig.create({ data: { tenantId: s.tenantId, businessId: s.businessId } }));
  const saved = parseObj(c.eventsJson) as Record<string, Record<string, boolean>>;
  const events: Record<string, Record<string, boolean>> = {};
  for (const ev of NOTIFICATION_EVENTS) { events[ev] = {}; for (const ch of NOTIFICATION_CHANNELS) events[ev][ch] = saved[ev]?.[ch] ?? false; }
  return { events };
}
export async function saveNotification(ctx: Ctx, input: NotificationConfigInput) {
  const c = await singletonRow(() => prisma.membershipNotificationConfig.findFirst({ where: bizWhere(ctx) }), () => prisma.membershipNotificationConfig.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId } }));
  await prisma.membershipNotificationConfig.update({ where: { id: c.id }, data: { eventsJson: JSON.stringify(input.events ?? {}) } });
  await audit(ctx, "Notification", c.id, "Configuration Modified", ctx.userId, ctx.userName, "Notification configuration");
  return getNotification(ctx);
}

// 13. card
export async function getCard(s: Scope) {
  const c = await singletonRow(() => prisma.membershipCardConfig.findFirst({ where: bizWhere(s) }), () => prisma.membershipCardConfig.create({ data: { tenantId: s.tenantId, businessId: s.businessId } }));
  return { enableCard: c.enableCard, cardType: c.cardType as CardConfigInput["cardType"], generateQr: c.generateQr, generateBarcode: c.generateBarcode, showCardNumber: c.showCardNumber, showLogo: c.showLogo, showPhoto: c.showPhoto, showLevel: c.showLevel, showIssueDate: c.showIssueDate, showExpiryDate: c.showExpiryDate, showSignature: c.showSignature, theme: c.theme, cardSize: c.cardSize, allowReprint: c.allowReprint };
}
export async function saveCard(ctx: Ctx, input: CardConfigInput) {
  const c = await singletonRow(() => prisma.membershipCardConfig.findFirst({ where: bizWhere(ctx) }), () => prisma.membershipCardConfig.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId } }));
  await prisma.membershipCardConfig.update({ where: { id: c.id }, data: { ...input } });
  await audit(ctx, "Card", c.id, "Configuration Modified", ctx.userId, ctx.userName, "Membership card configuration");
  return getCard(ctx);
}

// 14. approval
export async function getApproval(s: Scope) {
  const c = await singletonRow(() => prisma.membershipApprovalConfig.findFirst({ where: bizWhere(s) }), () => prisma.membershipApprovalConfig.create({ data: { tenantId: s.tenantId, businessId: s.businessId } }));
  return { approvalLevels: c.approvalLevels, approvalRoles: parseArr(c.approvalRolesJson), approvalNotifications: c.approvalNotifications };
}
export async function saveApproval(ctx: Ctx, input: ApprovalConfigInput) {
  const c = await singletonRow(() => prisma.membershipApprovalConfig.findFirst({ where: bizWhere(ctx) }), () => prisma.membershipApprovalConfig.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId } }));
  await prisma.membershipApprovalConfig.update({ where: { id: c.id }, data: { approvalLevels: input.approvalLevels, approvalRolesJson: JSON.stringify(input.approvalRoles ?? []), approvalNotifications: input.approvalNotifications } });
  await audit(ctx, "Approval", c.id, "Configuration Modified", ctx.userId, ctx.userName, "Approval configuration");
  return getApproval(ctx);
}

// ---------------------------------------------------------------- reports
export async function getReport(s: Scope, type: ReportType): Promise<ReportResult> {
  const title = REPORT_LABELS[type];
  const levels = await listLevels(s);
  const byId = (id: number) => levels.find((l) => l.id === id)?.name ?? `#${id}`;
  switch (type) {
    case "configuration": {
      const g = await getGeneral(s);
      const rows: (string | number)[][] = Object.entries(g).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)]);
      return { title, columns: ["Setting", "Value"], rows };
    }
    case "levels":
      return { title, columns: ["Code", "Name", "Priority", "Display Order", "Theme", "Status"], rows: levels.map((l) => [l.code, l.name, l.priority, l.displayOrder, l.themeColor, l.status]) };
    case "qualification": {
      const rows: (string | number)[][] = [];
      for (const l of levels) { for (const q of await listQualification(s, l.id)) rows.push([l.name, q.method, q.evaluationPeriod ?? "", q.minPurchase ?? 0, q.minBills ?? 0, q.minPoints ?? 0, q.combineLogic ?? "OR", q.active ? "Yes" : "No"]); }
      return { title, columns: ["Level", "Method", "Period", "Min Purchase", "Min Bills", "Min Points", "Logic", "Active"], rows };
    }
    case "benefit": {
      const rows: (string | number)[][] = [];
      for (const l of levels) { const bn = await getBenefit(s, l.id); rows.push([l.name, bn.billDiscountPct, bn.maxDiscount, bn.pointMultiplier, bn.welcomePoints, bn.birthdayPoints, bn.exclusivePromo ? "Yes" : "No"]); }
      return { title, columns: ["Level", "Bill Disc %", "Max Disc", "Point Multiplier", "Welcome Pts", "Birthday Pts", "Exclusive Promo"], rows };
    }
    case "fee": {
      const rows: (string | number)[][] = [];
      for (const l of levels) { const fe = await getFee(s, l.id); rows.push([l.name, fe.registrationFee, fe.renewalFee, fe.securityDeposit, fe.gstApplicable ? `${fe.gstPercentage}%` : "No", fe.lateRenewalCharge]); }
      return { title, columns: ["Level", "Registration", "Renewal", "Deposit", "GST", "Late Charge"], rows };
    }
    case "renewal": {
      const r = await getRenewal(s);
      return { title, columns: ["Setting", "Value"], rows: Object.entries(r).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)]) };
    }
    case "notification": {
      const n = await getNotification(s);
      return { title, columns: ["Event", ...NOTIFICATION_CHANNELS.map((c) => c.toUpperCase())], rows: NOTIFICATION_EVENTS.map((ev) => [NOTIFICATION_EVENT_LABELS[ev], ...NOTIFICATION_CHANNELS.map((ch) => (n.events[ev]?.[ch] ? "Yes" : "—"))]) };
    }
    case "finance": {
      const f = await getFinance(s);
      return { title, columns: ["Setting", "Account / Value"], rows: Object.entries(f).map(([k, v]) => [k, String(v || "—")]) };
    }
    default: return { title, columns: [], rows: [] };
  }
  void byId;
}

// ---------------------------------------------------------------- audit
export async function listAudit(s: Scope): Promise<AuditRow[]> {
  const rows = await prisma.membershipAudit.findMany({ where: { tenantId: s.tenantId }, orderBy: { id: "desc" }, take: 300 });
  return rows.map((a) => ({ id: a.id, entityType: a.entityType, entityId: a.entityId, action: a.action, byName: a.byName ?? "", note: a.note ?? "", at: a.at.toISOString() }));
}

export const CUSTOMER_FIELD_META = CUSTOMER_FIELDS.map((k) => ({ key: k, label: CUSTOMER_FIELD_LABELS[k] }));
