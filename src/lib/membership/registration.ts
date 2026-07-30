import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ACC, ensureAccounts } from "@/lib/accounting/accounts";
import { postJournal } from "@/lib/accounting/post";
import {
  getGeneral, getFee, getValidity, getBenefit, listQualification, getFinance, getNotification, getCard,
} from "@/lib/membership/service";
import { SERVICE_BENEFIT_KEYS, SERVICE_BENEFIT_LABELS, NOTIFICATION_CHANNELS } from "@/lib/contracts/membership";
import type {
  RegisterInput, PlanRow, QualificationResult, QualificationCheck, RegistrationRow, RegistrationDetail, RegDashboard, RegReportType, ReportResult,
} from "@/lib/contracts/membershipRegistration";

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, days: number) => { const dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() + days); return dt.toISOString().slice(0, 10); };

export interface Scope { tenantId: number; businessId: number | null }
export interface Ctx extends Scope { branchId: number | null; userId: number; userName: string | null }
const bizWhere = (s: Scope) => (s.businessId != null ? { tenantId: s.tenantId, businessId: s.businessId } : { tenantId: s.tenantId });

async function audit(s: Scope, entityId: number | null, action: string, byUser: number | null, byName: string | null, note?: string) {
  try { await prisma.membershipAudit.create({ data: { tenantId: s.tenantId, businessId: s.businessId, entityType: "Registration", entityId, action, byUser, byName, note: note ?? null } }); } catch { /* never blocks */ }
}

// ---------------------------------------------------- POS member context
export interface MemberContext {
  isMember: boolean; levelId: number; levelName: string; themeColor: string; membershipNumber: string;
  billDiscountPct: number; maxDiscount: number; pointMultiplier: number; status: string;
}
/** Membership benefit context the POS needs for the selected customer. Returns
 *  isMember:false when the customer has no active membership. */
export async function getMemberContext(s: Scope, customerId: number): Promise<MemberContext> {
  const empty: MemberContext = { isMember: false, levelId: 0, levelName: "", themeColor: "", membershipNumber: "", billDiscountPct: 0, maxDiscount: 0, pointMultiplier: 1, status: "" };
  const c = await prisma.customer.findFirst({ where: { id: customerId, tenantId: s.tenantId }, select: { isMember: true, membershipLevelId: true, membershipStatus: true, membershipNumber: true } });
  if (!c?.isMember || !c.membershipLevelId || c.membershipStatus !== "Active") return empty;
  const level = await prisma.membershipLevel.findFirst({ where: { id: c.membershipLevelId, ...bizWhere(s) } });
  if (!level) return empty;
  const bn = await getBenefit(s, level.id);
  return { isMember: true, levelId: level.id, levelName: level.name, themeColor: level.themeColor ?? "#6366f1", membershipNumber: c.membershipNumber ?? "", billDiscountPct: bn.billDiscountPct, maxDiscount: bn.maxDiscount, pointMultiplier: bn.pointMultiplier, status: c.membershipStatus };
}

// -------------------------------------------------------------- plans
export async function listPlans(s: Scope): Promise<PlanRow[]> {
  const levels = await prisma.membershipLevel.findMany({ where: { ...bizWhere(s), status: "Active" }, orderBy: [{ displayOrder: "asc" }, { priority: "asc" }] });
  const out: PlanRow[] = [];
  for (const l of levels) {
    const fee = await getFee(s, l.id); const val = await getValidity(s, l.id); const bn = await getBenefit(s, l.id);
    const svc = SERVICE_BENEFIT_KEYS.filter((k) => (bn.serviceBenefits as Record<string, boolean>)[k]).map((k) => SERVICE_BENEFIT_LABELS[k]);
    out.push({ levelId: l.id, code: l.code, name: l.name, description: l.description ?? "", themeColor: l.themeColor ?? "", status: l.status, registrationFee: fee.registrationFee, gstApplicable: fee.gstApplicable, gstPercentage: fee.gstPercentage, currency: fee.currency, validityType: val.validityType, validityDays: val.validityDays, billDiscountPct: bn.billDiscountPct, pointMultiplier: bn.pointMultiplier, welcomePoints: bn.welcomePoints, serviceBenefits: svc });
  }
  return out;
}

// ------------------------------------------------------- qualification
export async function verifyQualification(s: Scope, customerId: number, levelId: number): Promise<QualificationResult> {
  const rules = await listQualification(s, levelId);
  const general = await getGeneral(s);
  const cust = await prisma.customer.findFirst({ where: { id: customerId, tenantId: s.tenantId }, select: { totalSpent: true, availableRewardPoints: true, customerGroup: true } });
  const bills = await prisma.sale.count({ where: { tenantId: s.tenantId, customerId, status: "Completed" } });
  const spent = num(cust?.totalSpent); const points = num(cust?.availableRewardPoints); const group = cust?.customerGroup ?? "";
  const checks: QualificationCheck[] = [];
  let approvalRequired = general.requireApproval;
  for (const r of rules) {
    let passed = true; let required = ""; let actual = "";
    switch (r.method) {
      case "PurchaseValue": required = `₹${num(r.minPurchase)}`; actual = `₹${spent}`; passed = spent >= num(r.minPurchase); break;
      case "PurchaseFrequency": required = `${r.minFrequency ?? 0} bills`; actual = `${bills} bills`; passed = bills >= (r.minFrequency ?? 0); break;
      case "BillCount": required = `${r.minBills ?? 0} bills`; actual = `${bills} bills`; passed = bills >= (r.minBills ?? 0); break;
      case "LoyaltyPoints": required = `${r.minPoints ?? 0} pts`; actual = `${points} pts`; passed = points >= (r.minPoints ?? 0); break;
      case "MembershipFee": required = `Fee ₹${num(r.minFee)}`; actual = "Collected at registration"; passed = true; break;
      case "CustomerType": required = r.customerType ?? "—"; actual = group || "—"; passed = !r.customerType || group === r.customerType; break;
      case "ReferralCount": required = `${r.referralCount ?? 0} referrals`; actual = "0"; passed = (r.referralCount ?? 0) === 0; break;
      case "CampaignBased": required = "Campaign"; actual = "—"; passed = false; approvalRequired = true; break;
      case "ManualAssignment": required = "Manual approval"; actual = "—"; passed = false; approvalRequired = true; break;
      default: passed = true;
    }
    checks.push({ method: r.method, required, actual, passed });
  }
  const overallLogic = rules.some((r) => r.combineLogic === "AND") ? "AND" : "OR";
  const evalChecks = checks.filter((c) => !["CampaignBased", "ManualAssignment"].includes(c.method));
  const qualified = evalChecks.length === 0 ? true : (overallLogic === "AND" ? evalChecks.every((c) => c.passed) : evalChecks.some((c) => c.passed));
  const status = approvalRequired ? "ApprovalRequired" : qualified ? "Qualified" : "NotQualified";
  return { status, approvalRequired, checks, combineLogic: overallLogic };
}

// ------------------------------------------------------ number generation
async function generalConfigRow(ctx: Ctx) {
  return (await prisma.membershipConfiguration.findFirst({ where: bizWhere(ctx) })) ?? prisma.membershipConfiguration.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId } });
}
async function genMembershipNumber(tx: Prisma.TransactionClient, ctx: Ctx, cfgId: number): Promise<string> {
  const locked = await tx.$queryRawUnsafe<Array<{ runningNumber: number; numberPrefix: string; numberLength: number }>>("SELECT `runningNumber`,`numberPrefix`,`numberLength` FROM `membership_configuration` WHERE `id` = ? FOR UPDATE", cfgId);
  const c = locked[0]; const prefix = (c.numberPrefix || "MEM").toUpperCase(); const pad = Math.max(1, (c.numberLength || 10) - prefix.length);
  const mx = await tx.$queryRawUnsafe<Array<{ mx: bigint | number | null }>>("SELECT MAX(CAST(SUBSTRING(`membershipNumber`, ?) AS UNSIGNED)) AS mx FROM `membership_registration` WHERE `tenantId` = ? AND `membershipNumber` LIKE ?", prefix.length + 1, ctx.tenantId, `${prefix}%`);
  const n = Math.max(c.runningNumber, Number(mx[0]?.mx ?? 0) || 0) + 1;
  await tx.membershipConfiguration.update({ where: { id: cfgId }, data: { runningNumber: n } });
  return `${prefix}${String(n).padStart(pad, "0")}`;
}

// ----------------------------------------------------------- register
export async function register(ctx: Ctx, input: RegisterInput): Promise<{ id: number; registrationNo: string; status: string; membershipNumber: string | null; netAmount: number }> {
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: ctx.tenantId } });
  if (!customer) throw new Error("Customer not found.");
  const level = await prisma.membershipLevel.findFirst({ where: { id: input.levelId, ...bizWhere(ctx) } });
  if (!level) throw new Error("Membership level not found.");

  const general = await getGeneral(ctx);
  if (!general.enableModule) throw new Error("Membership module is disabled in configuration.");
  const feeCfg = await getFee(ctx, level.id);
  const validity = await getValidity(ctx, level.id);
  const finance = await getFinance(ctx);
  const qual = await verifyQualification(ctx, customer.id, level.id);

  // Fee computation from configuration.
  const base = r2(Math.max(0, feeCfg.registrationFee - (input.discountAmount ?? 0)));
  const gst = feeCfg.gstApplicable ? r2(base * feeCfg.gstPercentage / 100) : 0;
  const net = r2(base + gst);
  const feeBased = general.membershipType !== "Free" && net > 0;

  const regDate = input.registrationDate || today();
  const canActivate = qual.status === "Qualified" && !qual.approvalRequired && general.autoActivate;
  const initialStatus = qual.approvalRequired || general.requireApproval ? "PendingApproval" : canActivate ? "Active" : "Approved";

  const cfgRow = await generalConfigRow(ctx);
  await prisma.$transaction((tx) => ensureAccounts(tx, ctx.tenantId));

  const result = await prisma.$transaction(async (tx) => {
    const reg = await tx.membershipRegistration.create({ data: {
      tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, registrationNo: "TMP", customerId: customer.id, levelId: level.id,
      membershipType: general.membershipType, status: initialStatus, registrationDate: regDate, qualified: qual.status === "Qualified", qualificationNote: qual.checks.map((c) => `${c.method}:${c.passed ? "OK" : "X"}`).join(", "), approvalRequired: qual.approvalRequired,
      feeAmount: base, discountAmount: r2(input.discountAmount ?? 0), gstAmount: gst, netAmount: net, paymentMode: input.paymentMode ?? null, paymentRef: input.paymentRef ?? null,
      registeredBy: ctx.userId, registeredByName: ctx.userName, remarks: input.remarks ?? null,
    } });
    const registrationNo = `REG-${String(reg.id).padStart(6, "0")}`;
    await tx.membershipRegistration.update({ where: { id: reg.id }, data: { registrationNo } });
    await tx.membershipRegistrationHistory.create({ data: { tenantId: ctx.tenantId, registrationId: reg.id, fromStatus: null, toStatus: initialStatus, action: "Registration Created", byUser: ctx.userId, byName: ctx.userName, note: `${level.name} · ${general.membershipType}` } });

    // Fee receipt + finance posting.
    if (feeBased && input.collectFee) {
      const receiptNo = `MFR-${String(reg.id).padStart(6, "0")}`;
      const mode = (input.paymentMode || "Cash");
      const cashLike = /cash/i.test(mode);
      const jid = await postJournal(tx, {
        tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, voucherType: "RECEIPT", prefix: "MFR", date: regDate,
        narration: `Membership fee — ${registrationNo} — ${customer.name}`, sourceType: "MEMBERSHIP_FEE", sourceId: reg.id, refNo: receiptNo, createdBy: ctx.userId,
        lines: [
          { code: cashLike ? ACC.CASH : ACC.BANK, debit: net, narration: `Membership fee received (${mode})` },
          { code: finance.registrationFeeAccount || ACC.MEMBERSHIP_INCOME, credit: base, narration: "Membership registration income" },
          { code: ACC.OUTPUT_GST, credit: gst, narration: "Output GST on membership fee" },
        ],
      });
      const journalRef = jid ? `MFR-${String(jid).padStart(6, "0")}` : null;
      await tx.membershipFeeReceipt.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, registrationId: reg.id, receiptNo, receiptDate: regDate, customerId: customer.id, feeAmount: base, discountAmount: r2(input.discountAmount ?? 0), gstAmount: gst, netAmount: net, paymentMode: mode, paymentRef: input.paymentRef ?? null, journalRef, createdBy: ctx.userId, createdByName: ctx.userName } });
      await tx.customer.update({ where: { id: customer.id }, data: { totalSpent: { increment: net } } });
      await audit(ctx, reg.id, "Fee Collected", ctx.userId, ctx.userName, `${receiptNo} · ₹${net}`);
    }

    // Auto-activate when qualified + no approval + config allows.
    let membershipNumber: string | null = null;
    if (initialStatus === "Active") membershipNumber = await activateInTx(tx, ctx, reg.id, level.id, regDate, validity, cfgRow.id);

    return { id: reg.id, registrationNo, status: initialStatus, membershipNumber, netAmount: net };
  });
  await audit(ctx, result.id, "Registration", ctx.userId, ctx.userName, `${result.registrationNo} — ${level.name} (${initialStatus})`);
  return result;
}

// -------------------------------------------------- activation (shared tx)
async function activateInTx(tx: Prisma.TransactionClient, ctx: Ctx, regId: number, levelId: number, fromDate: string, validity: { validityType: string; validityDays: number }, cfgId: number): Promise<string> {
  const reg = await tx.membershipRegistration.findFirst({ where: { id: regId, ...bizWhere(ctx) } });
  if (!reg) throw new Error("Registration not found.");
  const membershipNumber = reg.membershipNumber || await genMembershipNumber(tx, ctx, cfgId);
  const activationDate = today();
  const expiryDate = validity.validityType === "Lifetime" ? null : addDays(fromDate, validity.validityDays || 365);
  const cardNumber = `MC${membershipNumber}`;

  await tx.membershipRegistration.update({ where: { id: regId }, data: { status: "Active", membershipNumber, activationDate, expiryDate } });
  await tx.membershipActivation.create({ data: { tenantId: ctx.tenantId, registrationId: regId, membershipNumber, activationDate, expiryDate, activatedBy: ctx.userId, activatedByName: ctx.userName } });
  await tx.membershipCard.create({ data: { tenantId: ctx.tenantId, registrationId: regId, cardNumber, membershipNumber, levelId, qrData: membershipNumber, barcodeData: membershipNumber, issueDate: activationDate, expiryDate, status: "Active" } });
  await tx.membershipRegistrationHistory.create({ data: { tenantId: ctx.tenantId, registrationId: regId, fromStatus: reg.status, toStatus: "Active", action: "Membership Activated", byUser: ctx.userId, byName: ctx.userName, note: membershipNumber } });
  // Customer Master integration.
  await tx.customer.update({ where: { id: reg.customerId }, data: { isMember: true, membershipNumber, membershipLevelId: levelId, membershipStatus: "Active", membershipExpiry: expiryDate } });
  return membershipNumber;
}

// -------------------------------------------------------- approve / activate / cancel
export async function approve(ctx: Ctx, registrationId: number, ok: boolean, note?: string): Promise<{ status: string }> {
  const reg = await prisma.membershipRegistration.findFirst({ where: { id: registrationId, ...bizWhere(ctx) } });
  if (!reg) throw new Error("Registration not found.");
  if (!["Submitted", "PendingApproval", "Draft"].includes(reg.status)) throw new Error(`Cannot approve a ${reg.status} registration.`);
  const toStatus = ok ? "Approved" : "Cancelled";
  await prisma.$transaction(async (tx) => {
    await tx.membershipRegistration.update({ where: { id: reg.id }, data: { status: toStatus, approvedBy: ctx.userId, approvedByName: ctx.userName } });
    await tx.membershipRegistrationHistory.create({ data: { tenantId: ctx.tenantId, registrationId: reg.id, fromStatus: reg.status, toStatus, action: ok ? "Approved" : "Rejected", byUser: ctx.userId, byName: ctx.userName, note: note ?? null } });
  });
  await audit(ctx, reg.id, ok ? "Approval" : "Rejected", ctx.userId, ctx.userName, reg.registrationNo);
  return { status: toStatus };
}
export async function activate(ctx: Ctx, registrationId: number): Promise<{ membershipNumber: string }> {
  const reg = await prisma.membershipRegistration.findFirst({ where: { id: registrationId, ...bizWhere(ctx) } });
  if (!reg) throw new Error("Registration not found.");
  if (reg.status === "Active") throw new Error("Membership is already active.");
  if (!["Approved", "Submitted", "PendingApproval"].includes(reg.status)) throw new Error(`Cannot activate a ${reg.status} registration.`);
  const validity = await getValidity(ctx, reg.levelId);
  const cfgRow = await generalConfigRow(ctx);
  const membershipNumber = await prisma.$transaction((tx) => activateInTx(tx, ctx, reg.id, reg.levelId, reg.registrationDate, validity, cfgRow.id));
  await audit(ctx, reg.id, "Activation", ctx.userId, ctx.userName, `${reg.registrationNo} → ${membershipNumber}`);
  await recordNotifications(ctx, reg.id);
  return { membershipNumber };
}
export async function cancel(ctx: Ctx, registrationId: number, reason?: string): Promise<void> {
  const reg = await prisma.membershipRegistration.findFirst({ where: { id: registrationId, ...bizWhere(ctx) } });
  if (!reg) throw new Error("Registration not found.");
  await prisma.$transaction(async (tx) => {
    await tx.membershipRegistration.update({ where: { id: reg.id }, data: { status: "Cancelled" } });
    await tx.membershipRegistrationHistory.create({ data: { tenantId: ctx.tenantId, registrationId: reg.id, fromStatus: reg.status, toStatus: "Cancelled", action: "Cancelled", byUser: ctx.userId, byName: ctx.userName, note: reason ?? null } });
    if (reg.status === "Active") await tx.customer.update({ where: { id: reg.customerId }, data: { isMember: false, membershipStatus: "Cancelled" } });
  });
  await audit(ctx, reg.id, "Cancellation", ctx.userId, ctx.userName, `${reg.registrationNo} — ${reason ?? ""}`);
}

/** Record the configured welcome notifications (gateway send is handled elsewhere). */
async function recordNotifications(ctx: Ctx, regId: number) {
  const n = await getNotification(ctx);
  const chans = NOTIFICATION_CHANNELS.filter((ch) => n.events.welcomeSms?.[ch] || n.events.welcomeEmail?.[ch] || n.events.activation?.[ch]);
  if (chans.length) await audit(ctx, regId, "Notification", ctx.userId, ctx.userName, `Welcome via ${chans.join(", ")}`);
}

export async function reprintCard(ctx: Ctx, registrationId: number): Promise<void> {
  const card = await prisma.membershipCard.findFirst({ where: { tenantId: ctx.tenantId, registrationId } });
  if (!card) throw new Error("No card to reprint.");
  await prisma.membershipCard.update({ where: { id: card.id }, data: { reprintCount: { increment: 1 } } });
  await audit(ctx, registrationId, "Card Generation", ctx.userId, ctx.userName, "Reprint");
}
export async function recordDocument(ctx: Ctx, registrationId: number, docType: string): Promise<void> {
  await prisma.membershipDocument.create({ data: { tenantId: ctx.tenantId, registrationId, docType, generatedBy: ctx.userId, generatedByName: ctx.userName } });
  await audit(ctx, registrationId, "Card Generation", ctx.userId, ctx.userName, `${docType} printed`);
}

// ------------------------------------------------------------- list + detail
const levelName = async (s: Scope) => new Map((await prisma.membershipLevel.findMany({ where: bizWhere(s), select: { id: true, name: true } })).map((l) => [l.id, l.name]));
export async function listRegistrations(s: Scope, opts: { status?: string; levelId?: number; q?: string }): Promise<RegistrationRow[]> {
  const where: Prisma.MembershipRegistrationWhereInput = { ...bizWhere(s) };
  if (opts.status && opts.status !== "All") where.status = opts.status;
  if (opts.levelId) where.levelId = opts.levelId;
  if (opts.q) where.OR = [{ registrationNo: { contains: opts.q } }, { membershipNumber: { contains: opts.q } }];
  const rows = await prisma.membershipRegistration.findMany({ where, orderBy: { id: "desc" }, take: 400 });
  const lmap = await levelName(s);
  const custIds = [...new Set(rows.map((r) => r.customerId))];
  const custMap = new Map((await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, phone: true } })).map((c) => [c.id, c]));
  let filtered = rows;
  if (opts.q) { const ql = opts.q.toLowerCase(); filtered = rows.filter((r) => r.registrationNo.toLowerCase().includes(ql) || (r.membershipNumber ?? "").toLowerCase().includes(ql) || (custMap.get(r.customerId)?.name ?? "").toLowerCase().includes(ql) || (custMap.get(r.customerId)?.phone ?? "").includes(opts.q!)); }
  return filtered.map((r) => ({ id: r.id, registrationNo: r.registrationNo, membershipNumber: r.membershipNumber ?? "", customerId: r.customerId, customerName: custMap.get(r.customerId)?.name ?? "", customerPhone: custMap.get(r.customerId)?.phone ?? "", levelName: lmap.get(r.levelId) ?? "", membershipType: r.membershipType, status: r.status, registrationDate: r.registrationDate, activationDate: r.activationDate ?? "", expiryDate: r.expiryDate ?? "", netAmount: num(r.netAmount), qualified: r.qualified, registeredByName: r.registeredByName ?? "" }));
}
export async function getRegistration(s: Scope, id: number): Promise<RegistrationDetail | null> {
  const r = await prisma.membershipRegistration.findFirst({ where: { id, ...bizWhere(s) }, include: { cards: { orderBy: { id: "desc" }, take: 1 }, receipts: { orderBy: { id: "desc" }, take: 1 }, history: { orderBy: { id: "asc" } } } });
  if (!r) return null;
  const lmap = await levelName(s);
  const cust = await prisma.customer.findFirst({ where: { id: r.customerId }, select: { name: true, phone: true } });
  const card = r.cards[0]; const rec = r.receipts[0];
  return {
    id: r.id, registrationNo: r.registrationNo, membershipNumber: r.membershipNumber ?? "", customerId: r.customerId, customerName: cust?.name ?? "", customerPhone: cust?.phone ?? "",
    levelId: r.levelId, levelName: lmap.get(r.levelId) ?? "", membershipType: r.membershipType, status: r.status, registrationDate: r.registrationDate, activationDate: r.activationDate ?? "", expiryDate: r.expiryDate ?? "",
    feeAmount: num(r.feeAmount), gstAmount: num(r.gstAmount), discountAmount: num(r.discountAmount), netAmount: num(r.netAmount), paymentMode: r.paymentMode ?? "", paymentRef: r.paymentRef ?? "", qualified: r.qualified, approvalRequired: r.approvalRequired, qualificationNote: r.qualificationNote ?? "", registeredByName: r.registeredByName ?? "",
    card: card ? { cardNumber: card.cardNumber, membershipNumber: card.membershipNumber, qrData: card.qrData ?? "", barcodeData: card.barcodeData ?? "", issueDate: card.issueDate, expiryDate: card.expiryDate ?? "" } : null,
    receipt: rec ? { receiptNo: rec.receiptNo, receiptDate: rec.receiptDate, netAmount: num(rec.netAmount), paymentMode: rec.paymentMode, journalRef: rec.journalRef ?? "" } : null,
    history: r.history.map((h) => ({ fromStatus: h.fromStatus ?? "", toStatus: h.toStatus, action: h.action, byName: h.byName ?? "", note: h.note ?? "", at: h.at.toISOString() })),
  };
}

// ------------------------------------------------------------- dashboard
export async function getDashboard(s: Scope): Promise<RegDashboard> {
  const [byStatus, revAgg, byLevelG, regs] = await Promise.all([
    prisma.membershipRegistration.groupBy({ by: ["status"], where: bizWhere(s), _count: true }),
    prisma.membershipFeeReceipt.aggregate({ where: bizWhere(s), _sum: { netAmount: true } }),
    prisma.membershipRegistration.groupBy({ by: ["levelId"], where: { ...bizWhere(s), status: "Active" }, _count: true }),
    prisma.membershipRegistration.findMany({ where: bizWhere(s), select: { status: true, registrationDate: true, activationDate: true, branchId: true } }),
  ]);
  const st = (k: string) => byStatus.find((x) => x.status === k)?._count ?? 0;
  const lmap = await levelName(s);
  const byLevel = byLevelG.map((g) => ({ name: lmap.get(g.levelId) ?? `#${g.levelId}`, value: g._count })).sort((a, b) => b.value - a.value);
  const brG = new Map<number, number>();
  for (const r of regs) { if (r.branchId == null) continue; brG.set(r.branchId, (brG.get(r.branchId) ?? 0) + 1); }
  const brIds = [...brG.keys()];
  const brNames = brIds.length ? new Map((await prisma.branch.findMany({ where: { id: { in: brIds } }, select: { id: true, name: true } })).map((x) => [x.id, x.name])) : new Map<number, string>();
  const byBranch = [...brG.entries()].map(([id, v]) => ({ name: brNames.get(id) ?? `Branch #${id}`, value: v })).sort((a, b) => b.value - a.value);
  const monthly = new Map<string, number>();
  for (const r of regs) { const k = (r.registrationDate || "").slice(0, 7); if (k) monthly.set(k, (monthly.get(k) ?? 0) + 1); }
  const monthlyArr = [...monthly.entries()].sort().slice(-6).map(([k, v]) => ({ name: k, value: v }));
  return { totalMembers: regs.length, newToday: regs.filter((r) => r.registrationDate === today()).length, activeMembers: st("Active"), expiredMembers: st("Expired"), pendingApproval: st("PendingApproval") + st("Submitted"), revenue: num(revAgg._sum.netAmount), byLevel, byBranch, monthly: monthlyArr };
}

// ------------------------------------------------------------- reports
export async function getReport(s: Scope, type: RegReportType): Promise<ReportResult> {
  const rows = await listRegistrations(s, {});
  const T = (t: string, columns: string[], data: (string | number)[][]): ReportResult => ({ title: t, columns, rows: data });
  switch (type) {
    case "register": return T("Membership Register", ["Reg No", "Membership No", "Customer", "Level", "Type", "Status", "Reg Date", "Expiry", "Net"], rows.map((r) => [r.registrationNo, r.membershipNumber || "—", r.customerName, r.levelName, r.membershipType, r.status, r.registrationDate, r.expiryDate || "—", r.netAmount]));
    case "new": { const t0 = today().slice(0, 7); return T("New Membership Report (this month)", ["Reg No", "Customer", "Level", "Reg Date", "Status"], rows.filter((r) => r.registrationDate.startsWith(t0)).map((r) => [r.registrationNo, r.customerName, r.levelName, r.registrationDate, r.status])); }
    case "fee": { const recs = await prisma.membershipFeeReceipt.findMany({ where: bizWhere(s), orderBy: { id: "desc" }, take: 2000 }); return T("Membership Fee Report", ["Receipt No", "Date", "Fee", "GST", "Net", "Mode", "Journal"], recs.map((r) => [r.receiptNo, r.receiptDate, num(r.feeAmount), num(r.gstAmount), num(r.netAmount), r.paymentMode, r.journalRef ?? ""])); }
    case "expiry": return T("Membership Expiry Report", ["Membership No", "Customer", "Level", "Expiry", "Status"], rows.filter((r) => r.expiryDate).map((r) => [r.membershipNumber, r.customerName, r.levelName, r.expiryDate, r.status]));
    case "status": return T("Membership Status Report", ["Reg No", "Customer", "Level", "Status"], rows.map((r) => [r.registrationNo, r.customerName, r.levelName, r.status]));
    case "level": { const m = new Map<string, number>(); rows.forEach((r) => m.set(r.levelName, (m.get(r.levelName) ?? 0) + 1)); return T("Membership Level Report", ["Level", "Members"], [...m.entries()].map(([k, v]) => [k, v])); }
    case "branch": { const d = await getDashboard(s); return T("Branch-wise Membership Report", ["Branch", "Active Members"], d.byBranch.map((b) => [b.name, b.value])); }
    case "customer": return T("Customer Membership Report", ["Customer", "Phone", "Membership No", "Level", "Status"], rows.map((r) => [r.customerName, r.customerPhone, r.membershipNumber || "—", r.levelName, r.status]));
    default: return T("Report", [], []);
  }
}
