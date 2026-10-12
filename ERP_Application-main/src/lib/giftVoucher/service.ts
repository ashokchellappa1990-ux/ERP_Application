import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ACC, ensureAccounts } from "@/lib/accounting/accounts";
import { postJournal } from "@/lib/accounting/post";
import { renderCoupon, renderSheet, defaultLayout } from "@/lib/coupon/render";
import type {
  GvConfig, GvConfigInput, GenerateInput, SaleInput, RedeemInput, VoucherRow, VoucherDetail, ValidateResult,
  GvDashboard, ReportType, ReportResult, AccountRef, AuditRow,
} from "@/lib/contracts/giftVoucher";
import { VOUCHER_TYPE_LABELS, TEMPLATE_CATEGORIES } from "@/lib/contracts/giftVoucher";

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, days: number) => { const dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() + days); return dt.toISOString().slice(0, 10); };
const rand = (n: number) => { let s = ""; const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };

export interface Scope { tenantId: number; businessId: number | null }
export interface Ctx extends Scope { branchId: number | null; userId: number; userName: string | null }
const bizWhere = (s: Scope) => (s.businessId != null ? { tenantId: s.tenantId, businessId: s.businessId } : { tenantId: s.tenantId });

async function audit(s: Scope, entityType: string, entityId: number | null, action: string, byUser: number | null, byName: string | null, note?: string) {
  try { await prisma.giftVoucherAudit.create({ data: { tenantId: s.tenantId, businessId: s.businessId, entityType, entityId, action, byUser, byName, note: note ?? null } }); } catch { /* never blocks */ }
}
type TX = Prisma.TransactionClient;
async function history(tx: TX, tenantId: number, voucherId: number, from: string | null, to: string, action: string, ctx: Ctx, note?: string) {
  await tx.giftVoucherHistory.create({ data: { tenantId, voucherId, fromStatus: from, toStatus: to, action, byUser: ctx.userId, byName: ctx.userName, note: note ?? null } });
}
async function ledger(tx: TX, s: Scope, voucherId: number, txnType: string, direction: "CR" | "DR", amount: number, balanceAfter: number, refNo: string | null, date: string) {
  await tx.giftVoucherLedger.create({ data: { tenantId: s.tenantId, businessId: s.businessId, voucherId, txnType, direction, amount: r2(amount), balanceAfter: r2(balanceAfter), refNo, txnDate: date } });
}

export async function listAccounts(s: Scope): Promise<AccountRef[]> {
  await prisma.$transaction((tx) => ensureAccounts(tx, s.tenantId));
  const rows = await prisma.ledgerAccount.findMany({ where: { tenantId: s.tenantId }, orderBy: { code: "asc" }, select: { code: true, name: true, type: true } });
  return rows.map((a) => ({ code: a.code, name: a.name, type: a.type }));
}

// ----------------------------------------------------------------- config
const DEFAULTS: GvConfig = {
  enableModule: true, enableQr: true, enableBarcode: false, enableCustomerMapping: true, customerMapping: "Optional",
  enablePartialRedemption: true, enableMultipleRedemption: true, enableTransfer: false, enableRevalidation: true, enableExpiry: true,
  enableAutoExpiry: true, enableReissue: true, enableReplacement: true, autoActivateOnSale: true, approvalRequired: false, gstOnSale: false, gstPercentage: 0,
  numberPrefix: "GV", numberLength: 12, runningNumber: 0, securityLength: 6, defaultValidityDays: 365, liabilityAccount: "",
};
async function configRow(s: Scope) {
  return (await prisma.giftVoucherConfiguration.findFirst({ where: bizWhere(s) })) ?? prisma.giftVoucherConfiguration.create({ data: { tenantId: s.tenantId, businessId: s.businessId } });
}
export async function getConfig(s: Scope): Promise<GvConfig> {
  const c = await configRow(s);
  return { ...DEFAULTS, ...c, customerMapping: c.customerMapping as GvConfig["customerMapping"], gstPercentage: num(c.gstPercentage), liabilityAccount: c.liabilityAccount ?? "" };
}
export async function saveConfig(ctx: Ctx, input: GvConfigInput): Promise<GvConfig> {
  const c = await configRow(ctx);
  await prisma.giftVoucherConfiguration.update({ where: { id: c.id }, data: { ...input, gstPercentage: r2(input.gstPercentage), liabilityAccount: input.liabilityAccount || null } });
  await audit(ctx, "Config", c.id, "Configuration Modified", ctx.userId, ctx.userName, "Gift voucher configuration");
  return getConfig(ctx);
}
const liabilityCode = (cfg: GvConfig) => cfg.liabilityAccount || ACC.GIFT_VOUCHER_LIABILITY;

// --------------------------------------------------------------- templates
function tpl(name: string, category: string, color: string) {
  const l = defaultLayout();
  l.bg = "#ffffff"; l.border = color; l.borderWidth = 3; l.borderRadius = 14;
  l.objects = [
    { id: "co", type: "text", x: 24, y: 20, w: 300, h: 28, rotation: 0, text: "{CompanyName}", size: 20, bold: true, color },
    { id: "ti", type: "text", x: 24, y: 54, w: 300, h: 20, rotation: 0, text: "GIFT VOUCHER", size: 13, color: "#555", bold: true },
    { id: "amt", type: "text", x: 24, y: 110, w: 360, h: 46, rotation: 0, text: "{VoucherAmount}", size: 40, bold: true, color },
    { id: "no", type: "text", x: 24, y: 168, w: 300, h: 18, rotation: 0, text: "No: {VoucherNumber}", size: 12, color: "#333" },
    { id: "exp", type: "text", x: 24, y: 190, w: 300, h: 18, rotation: 0, text: "Valid till {ExpiryDate}", size: 11, color: "#777" },
    { id: "qr", type: "qr", x: 300, y: 150, w: 64, h: 64, rotation: 0 },
    { id: "terms", type: "text", x: 24, y: 216, w: 360, h: 16, rotation: 0, text: "{Terms}", size: 9, color: "#999" },
  ];
  return { name, category, layout: l };
}
function defaultTemplates() {
  const colors: Record<string, string> = { Retail: "#0369a1", Corporate: "#1e293b", Festival: "#b45309", Birthday: "#db2777", Luxury: "#7c3aed", Generic: "#4f46e5" };
  const out: { name: string; category: string; layout: ReturnType<typeof defaultLayout> }[] = [];
  for (const cat of TEMPLATE_CATEGORIES) for (let i = 1; i <= 4; i++) out.push(tpl(`${cat} Voucher ${i}`, cat, colors[cat] || "#4f46e5"));
  return out;
}
export interface TemplateRow { id: number; name: string; category: string; layout: unknown; isSystem: boolean; active: boolean }
export async function listTemplates(s: Scope): Promise<TemplateRow[]> {
  let rows = await prisma.giftVoucherTemplate.findMany({ where: bizWhere(s), orderBy: { id: "asc" } });
  if (!rows.length) {
    await prisma.giftVoucherTemplate.createMany({ data: defaultTemplates().map((t) => ({ tenantId: s.tenantId, businessId: s.businessId, name: t.name, category: t.category, layout: JSON.stringify(t.layout), isSystem: true })) });
    rows = await prisma.giftVoucherTemplate.findMany({ where: bizWhere(s), orderBy: { id: "asc" } });
  }
  return rows.map((r) => { let layout: unknown = {}; try { layout = JSON.parse(r.layout); } catch { layout = defaultLayout(); } return { id: r.id, name: r.name, category: r.category, layout, isSystem: r.isSystem, active: r.active }; });
}
export async function renderPrint(ctx: Ctx, voucherIds: number[], templateId?: number, perPage = 4): Promise<{ html: string; count: number }> {
  const templates = await listTemplates(ctx);
  const tplRow = templateId ? templates.find((t) => t.id === templateId) : templates[0];
  const layout = (tplRow?.layout as ReturnType<typeof defaultLayout>) ?? defaultLayout();
  const vouchers = await prisma.giftVoucher.findMany({ where: { id: { in: voucherIds }, ...bizWhere(ctx) } });
  const company = await prisma.companySetup.findFirst({ where: bizWhere(ctx), orderBy: { id: "desc" }, select: { legalName: true } });
  const companyName = company?.legalName || "Our Store";
  const cards = vouchers.map((v) => renderCoupon(layout, {
    CompanyName: companyName, BranchName: "", CampaignName: "", CouponNumber: v.voucherNo, CouponCode: v.securityCode ?? "",
    VoucherNumber: v.voucherNo, VoucherAmount: `₹${num(v.faceValue).toLocaleString("en-IN")}`, Discount: "", CustomerName: v.customerName ?? "",
    IssueDate: v.issueDate ?? "", ExpiryDate: v.expiryDate ?? "", Terms: "Non-refundable. Redeemable in-store until expiry.", GeneratedDate: today(),
    qrData: v.qrData ?? v.voucherNo, barcodeData: v.barcodeData ?? v.voucherNo, securityCode: v.securityCode ?? "",
  } as never));
  await audit(ctx, "Voucher", voucherIds[0] ?? null, "Voucher Printed", ctx.userId, ctx.userName, `${vouchers.length} voucher(s)`);
  return { html: renderSheet(cards, layout, perPage), count: vouchers.length };
}

// --------------------------------------------------------------- generation
async function genNumber(tx: TX, s: Scope, cfgId: number): Promise<{ no: string; security: string }> {
  const locked = await tx.$queryRawUnsafe<Array<{ runningNumber: number; numberPrefix: string; numberLength: number; securityLength: number }>>("SELECT `runningNumber`,`numberPrefix`,`numberLength`,`securityLength` FROM `gift_voucher_configuration` WHERE `id` = ? FOR UPDATE", cfgId);
  const c = locked[0]; const prefix = (c.numberPrefix || "GV").toUpperCase(); const pad = Math.max(1, (c.numberLength || 12) - prefix.length);
  const mx = await tx.$queryRawUnsafe<Array<{ mx: bigint | number | null }>>("SELECT MAX(CAST(SUBSTRING(`voucherNo`, ?) AS UNSIGNED)) AS mx FROM `gift_voucher_master` WHERE `tenantId` = ? AND `voucherNo` LIKE ?", prefix.length + 1, s.tenantId, `${prefix}%`);
  const n = Math.max(c.runningNumber, Number(mx[0]?.mx ?? 0) || 0) + 1;
  await tx.giftVoucherConfiguration.update({ where: { id: cfgId }, data: { runningNumber: n } });
  return { no: `${prefix}${String(n).padStart(pad, "0")}`, security: rand(c.securityLength || 6) };
}
export async function generate(ctx: Ctx, input: GenerateInput): Promise<{ count: number; firstNo: string; lastNo: string; batchNo: string }> {
  const cfg = await configRow(ctx);
  const expiry = input.expiryDate || (cfg.defaultValidityDays ? addDays(today(), cfg.defaultValidityDays) : null);
  const res = await prisma.$transaction(async (tx) => {
    const batch = await tx.giftVoucherBatch.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, batchNo: "TMP", voucherType: input.voucherType, faceValue: r2(input.faceValue), quantity: input.quantity, generatedCount: input.quantity, status: "Generated", generatedBy: ctx.userId, generatedByName: ctx.userName }, select: { id: true } });
    const batchNo = `GVB-${String(batch.id).padStart(6, "0")}`;
    await tx.giftVoucherBatch.update({ where: { id: batch.id }, data: { batchNo } });
    let firstNo = "", lastNo = "";
    for (let i = 0; i < input.quantity; i++) {
      const { no, security } = await genNumber(tx, ctx, cfg.id);
      if (!firstNo) firstNo = no; lastNo = no;
      await tx.giftVoucher.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, batchId: batch.id, voucherNo: no, voucherType: input.voucherType, faceValue: r2(input.faceValue), originalValue: r2(input.faceValue), redeemedValue: 0, availableBalance: r2(input.faceValue), securityCode: security, qrData: no, barcodeData: no, status: "Generated", issueDate: today(), expiryDate: expiry } });
    }
    return { batchNo, firstNo, lastNo };
  });
  await audit(ctx, "Batch", null, "Voucher Generated", ctx.userId, ctx.userName, `${res.batchNo} · ${input.quantity} × ₹${input.faceValue}`);
  return { count: input.quantity, firstNo: res.firstNo, lastNo: res.lastNo, batchNo: res.batchNo };
}

// ------------------------------------------------------------------ list
export async function listVouchers(s: Scope, opts: { status?: string; type?: string; q?: string }): Promise<VoucherRow[]> {
  const where: Prisma.GiftVoucherWhereInput = { ...bizWhere(s) };
  if (opts.status && opts.status !== "All") where.status = opts.status;
  if (opts.type && opts.type !== "All") where.voucherType = opts.type;
  if (opts.q) where.OR = [{ voucherNo: { contains: opts.q } }, { customerName: { contains: opts.q } }];
  const rows = await prisma.giftVoucher.findMany({ where, orderBy: { id: "desc" }, take: 400, include: { batch: { select: { batchNo: true } } } });
  return rows.map((v) => ({ id: v.id, voucherNo: v.voucherNo, voucherType: v.voucherType, faceValue: num(v.faceValue), availableBalance: num(v.availableBalance), redeemedValue: num(v.redeemedValue), status: v.status, customerName: v.customerName ?? "", issueDate: v.issueDate ?? "", expiryDate: v.expiryDate ?? "", batchNo: v.batch?.batchNo ?? "" }));
}
export async function getVoucher(s: Scope, id: number): Promise<VoucherDetail | null> {
  const v = await prisma.giftVoucher.findFirst({ where: { id, ...bizWhere(s) }, include: { batch: { select: { batchNo: true } }, redemptions: { orderBy: { id: "desc" } }, ledger: { orderBy: { id: "asc" } }, history: { orderBy: { id: "asc" } } } });
  if (!v) return null;
  return {
    id: v.id, voucherNo: v.voucherNo, voucherType: v.voucherType, faceValue: num(v.faceValue), availableBalance: num(v.availableBalance), redeemedValue: num(v.redeemedValue),
    status: v.status, customerName: v.customerName ?? "", issueDate: v.issueDate ?? "", expiryDate: v.expiryDate ?? "", batchNo: v.batch?.batchNo ?? "",
    originalValue: num(v.originalValue), securityCode: v.securityCode ?? "", qrData: v.qrData ?? "",
    redemptions: v.redemptions.map((r) => ({ redemptionNo: r.redemptionNo, date: r.redemptionDate, amount: num(r.amount), balanceAfter: num(r.balanceAfter), invoiceNo: r.invoiceNo ?? "" })),
    ledger: v.ledger.map((l) => ({ txnType: l.txnType, direction: l.direction, amount: num(l.amount), balanceAfter: num(l.balanceAfter), refNo: l.refNo ?? "", date: l.txnDate })),
    history: v.history.map((h) => ({ fromStatus: h.fromStatus ?? "", toStatus: h.toStatus, action: h.action, byName: h.byName ?? "", note: h.note ?? "", at: h.at.toISOString() })),
  };
}

// ------------------------------------------------------------------ sale
export async function sellVoucher(ctx: Ctx, input: SaleInput): Promise<{ voucherId: number; saleNo: string; voucherNo: string; net: number }> {
  const cfg = await getConfig(ctx);
  const voucher = input.voucherId
    ? await prisma.giftVoucher.findFirst({ where: { id: input.voucherId, ...bizWhere(ctx) } })
    : await prisma.giftVoucher.findFirst({ where: { voucherNo: (input.voucherNo ?? "").trim(), ...bizWhere(ctx) } });
  if (!voucher) throw new Error("Voucher not found.");
  if (!["Generated", "Active"].includes(voucher.status)) throw new Error(`Cannot sell a ${voucher.status} voucher.`);
  if (cfg.customerMapping === "Mandatory" && !input.customerId) throw new Error("Customer is mandatory for voucher sale.");

  const face = num(voucher.faceValue);
  const salePrice = r2(input.salePrice && input.salePrice > 0 ? input.salePrice : face);
  const gst = cfg.gstOnSale ? r2(salePrice * cfg.gstPercentage / 100) : 0;
  const net = r2(salePrice + gst);
  const saleDate = input.saleDate || today();
  const expiry = input.expiryDate || voucher.expiryDate;
  const cust = input.customerId ? await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: ctx.tenantId }, select: { id: true, name: true } }) : null;

  await prisma.$transaction((tx) => ensureAccounts(tx, ctx.tenantId));
  const result = await prisma.$transaction(async (tx) => {
    const cashLike = /cash/i.test(input.paymentMode);
    const jid = await postJournal(tx, {
      tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, voucherType: "RECEIPT", prefix: "GVS", date: saleDate,
      narration: `Gift voucher sold — ${voucher.voucherNo}`, sourceType: "GIFT_VOUCHER_SALE", sourceId: voucher.id, refNo: voucher.voucherNo, createdBy: ctx.userId,
      lines: [
        { code: cashLike ? ACC.CASH : ACC.BANK, debit: net, narration: `Voucher sale received (${input.paymentMode})` },
        { code: liabilityCode(cfg), credit: face, narration: "Gift voucher liability raised" },
        { code: ACC.OUTPUT_GST, credit: gst, narration: "GST on voucher sale" },
      ],
    });
    const journalRef = jid ? `GVS-${String(jid).padStart(6, "0")}` : null;
    const sale = await tx.giftVoucherSale.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, voucherId: voucher.id, saleNo: "TMP", saleDate, buyerType: input.buyerType || (cust ? "Registered" : "WalkIn"), customerId: cust?.id ?? null, customerName: cust?.name ?? input.customerName ?? null, faceValue: face, salePrice, gstAmount: gst, netAmount: net, paymentMode: input.paymentMode, paymentRef: input.paymentRef ?? null, invoiceNo: input.invoiceNo ?? null, journalRef, remarks: input.remarks ?? null, createdBy: ctx.userId, createdByName: ctx.userName }, select: { id: true } });
    const saleNo = `GVS-${String(sale.id).padStart(6, "0")}`;
    await tx.giftVoucherSale.update({ where: { id: sale.id }, data: { saleNo } });
    // Sale raises the liability.
    await ledger(tx, ctx, voucher.id, "SALE", "CR", face, face, saleNo, saleDate);
    const active = cfg.autoActivateOnSale;
    await tx.giftVoucher.update({ where: { id: voucher.id }, data: { status: active ? "Active" : "Generated", customerId: cust?.id ?? voucher.customerId, customerName: cust?.name ?? input.customerName ?? voucher.customerName, issueDate: saleDate, expiryDate: expiry, activatedAt: active ? saleDate : null } });
    if (active) await tx.giftVoucherActivation.create({ data: { tenantId: ctx.tenantId, voucherId: voucher.id, activationDate: saleDate, method: "Auto", activatedBy: ctx.userId, activatedByName: ctx.userName } });
    await history(tx, ctx.tenantId, voucher.id, voucher.status, active ? "Active" : "Generated", "Voucher Sold", ctx, `${saleNo} · ₹${net}`);
    // Link customer's voucher to CRM
    if (cust) await tx.customer.update({ where: { id: cust.id }, data: {} }).catch(() => {});
    return { saleNo, voucherId: voucher.id, voucherNo: voucher.voucherNo, net };
  });
  await audit(ctx, "Voucher", result.voucherId, "Voucher Sold", ctx.userId, ctx.userName, `${result.saleNo} · ${result.voucherNo}`);
  return result;
}

// ------------------------------------------------------------- sales list
export interface SaleRow { id: number; saleNo: string; saleDate: string; voucherNo: string; voucherType: string; buyerType: string; customerName: string; faceValue: number; gstAmount: number; netAmount: number; paymentMode: string; journalRef: string }
export interface SaleDetail extends SaleRow { salePrice: number; paymentRef: string; invoiceNo: string; createdByName: string; remarks: string; voucherStatus: string; availableBalance: number; expiryDate: string }
export async function listSales(s: Scope, opts: { q?: string }): Promise<SaleRow[]> {
  const where: Prisma.GiftVoucherSaleWhereInput = { ...bizWhere(s) };
  if (opts.q) where.OR = [{ saleNo: { contains: opts.q } }, { customerName: { contains: opts.q } }, { voucher: { voucherNo: { contains: opts.q } } }];
  const rows = await prisma.giftVoucherSale.findMany({ where, orderBy: { id: "desc" }, take: 400, include: { voucher: { select: { voucherNo: true, voucherType: true } } } });
  return rows.map((x) => ({ id: x.id, saleNo: x.saleNo, saleDate: x.saleDate, voucherNo: x.voucher.voucherNo, voucherType: x.voucher.voucherType, buyerType: x.buyerType, customerName: x.customerName ?? "", faceValue: num(x.faceValue), gstAmount: num(x.gstAmount), netAmount: num(x.netAmount), paymentMode: x.paymentMode, journalRef: x.journalRef ?? "" }));
}
export async function getSale(s: Scope, id: number): Promise<SaleDetail | null> {
  const x = await prisma.giftVoucherSale.findFirst({ where: { id, ...bizWhere(s) }, include: { voucher: { select: { voucherNo: true, voucherType: true, status: true, availableBalance: true, expiryDate: true } } } });
  if (!x) return null;
  return { id: x.id, saleNo: x.saleNo, saleDate: x.saleDate, voucherNo: x.voucher.voucherNo, voucherType: x.voucher.voucherType, buyerType: x.buyerType, customerName: x.customerName ?? "", faceValue: num(x.faceValue), gstAmount: num(x.gstAmount), netAmount: num(x.netAmount), paymentMode: x.paymentMode, journalRef: x.journalRef ?? "", salePrice: num(x.salePrice), paymentRef: x.paymentRef ?? "", invoiceNo: x.invoiceNo ?? "", createdByName: x.createdByName ?? "", remarks: x.remarks ?? "", voucherStatus: x.voucher.status, availableBalance: num(x.voucher.availableBalance), expiryDate: x.voucher.expiryDate ?? "" };
}
/** Vouchers available to sell (Generated, not yet sold). */
export async function listSellable(s: Scope): Promise<{ id: number; voucherNo: string; voucherType: string; faceValue: number }[]> {
  const rows = await prisma.giftVoucher.findMany({ where: { ...bizWhere(s), status: "Generated" }, orderBy: { id: "asc" }, take: 500, select: { id: true, voucherNo: true, voucherType: true, faceValue: true } });
  return rows.map((v) => ({ id: v.id, voucherNo: v.voucherNo, voucherType: v.voucherType, faceValue: num(v.faceValue) }));
}

// ---------------------------------------------------------------- activation
export async function activate(ctx: Ctx, voucherId: number, method = "Manual"): Promise<void> {
  const v = await prisma.giftVoucher.findFirst({ where: { id: voucherId, ...bizWhere(ctx) } });
  if (!v) throw new Error("Voucher not found.");
  if (v.status === "Active") throw new Error("Voucher already active.");
  if (!["Generated"].includes(v.status)) throw new Error(`Cannot activate a ${v.status} voucher.`);
  await prisma.$transaction(async (tx) => {
    await tx.giftVoucher.update({ where: { id: v.id }, data: { status: "Active", activatedAt: today() } });
    await tx.giftVoucherActivation.create({ data: { tenantId: ctx.tenantId, voucherId: v.id, activationDate: today(), method, activatedBy: ctx.userId, activatedByName: ctx.userName } });
    await history(tx, ctx.tenantId, v.id, v.status, "Active", "Voucher Activated", ctx);
  });
  await audit(ctx, "Voucher", v.id, "Voucher Activated", ctx.userId, ctx.userName, v.voucherNo);
}

// ----------------------------------------------------------- balance adjust
export async function adjustBalance(ctx: Ctx, voucherId: number, adjType: string, amount: number, reason?: string): Promise<void> {
  const v = await prisma.giftVoucher.findFirst({ where: { id: voucherId, ...bizWhere(ctx) } });
  if (!v) throw new Error("Voucher not found.");
  const newBal = r2(num(v.availableBalance) + amount);
  if (newBal < 0) throw new Error("Adjustment would make the balance negative.");
  await prisma.$transaction(async (tx) => {
    await tx.giftVoucher.update({ where: { id: v.id }, data: { availableBalance: newBal } });
    await tx.giftVoucherBalanceAdj.create({ data: { tenantId: ctx.tenantId, voucherId: v.id, adjType: adjType || "Adjust", amount: r2(amount), balanceAfter: newBal, reason: reason ?? null, approvedBy: ctx.userId, approvedByName: ctx.userName } });
    await ledger(tx, ctx, v.id, "ADJUST", amount >= 0 ? "CR" : "DR", Math.abs(amount), newBal, null, today());
    await history(tx, ctx.tenantId, v.id, v.status, v.status, "Balance Adjusted", ctx, `${amount >= 0 ? "+" : ""}${amount} → ₹${newBal}`);
  });
  await audit(ctx, "Voucher", v.id, "Balance Adjusted", ctx.userId, ctx.userName, `${v.voucherNo} · ${amount}`);
}

// ---------------------------------------------------------------- validate
export async function validateVoucher(s: Scope, voucherNo: string, customerId?: number): Promise<ValidateResult> {
  const empty = (reason: string): ValidateResult => ({ valid: false, reason, voucherId: null, voucherNo, availableBalance: 0, faceValue: 0, status: "", customerName: "", expiryDate: "" });
  const v = await prisma.giftVoucher.findFirst({ where: { ...bizWhere(s), voucherNo: voucherNo.trim() } });
  if (!v) return empty("Voucher not found.");
  const cfg = await getConfig(s);
  if (v.status === "Generated") return empty("Voucher is not activated yet.");
  if (["Cancelled", "Closed"].includes(v.status)) return empty(`Voucher is ${v.status}.`);
  if (v.status === "Expired") return empty("Voucher has expired.");
  if (v.expiryDate && today() > v.expiryDate) return empty("Voucher has expired.");
  if (num(v.availableBalance) <= 0) return empty("Voucher has no balance.");
  if ((cfg.customerMapping === "Mandatory" || v.customerId) && v.customerId && v.customerId !== (customerId ?? -1)) return empty("This voucher belongs to another customer.");
  return { valid: true, reason: "Valid", voucherId: v.id, voucherNo: v.voucherNo, availableBalance: num(v.availableBalance), faceValue: num(v.faceValue), status: v.status, customerName: v.customerName ?? "", expiryDate: v.expiryDate ?? "" };
}

/** Deduct balance + record redemption inside a tx (used by POS + manual). Caller handles GL. */
export async function redeemInTx(tx: TX, ctx: Ctx, voucherId: number, amount: number, opts: { saleId?: number; invoiceNo?: string; journalRef?: string | null; date?: string }): Promise<{ redemptionId: number; balanceAfter: number }> {
  const v = await tx.giftVoucher.findFirst({ where: { id: voucherId, ...bizWhere(ctx) } });
  if (!v) throw new Error("Voucher not found.");
  const before = num(v.availableBalance);
  const amt = r2(Math.min(amount, before));
  if (amt <= 0) throw new Error("Voucher has no balance.");
  const after = r2(before - amt);
  const date = opts.date || today();
  const red = await tx.giftVoucherRedemption.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, voucherId: v.id, redemptionNo: "TMP", redemptionDate: date, saleId: opts.saleId ?? null, invoiceNo: opts.invoiceNo ?? null, customerId: v.customerId, amount: amt, balanceBefore: before, balanceAfter: after, journalRef: opts.journalRef ?? null, redeemedBy: ctx.userId, redeemedByName: ctx.userName }, select: { id: true } });
  await tx.giftVoucherRedemption.update({ where: { id: red.id }, data: { redemptionNo: `GVR-${String(red.id).padStart(6, "0")}` } });
  const zero = after <= 0;
  await tx.giftVoucher.update({ where: { id: v.id }, data: { availableBalance: after, redeemedValue: r2(num(v.redeemedValue) + amt), lastRedemptionDate: date, lastRedemptionBranchId: ctx.branchId, status: zero ? "Closed" : "Active" } });
  await ledger(tx, ctx, v.id, "REDEEM", "DR", amt, after, opts.invoiceNo ?? `GVR-${red.id}`, date);
  await history(tx, ctx.tenantId, v.id, v.status, zero ? "Closed" : "Active", "Voucher Redeemed", ctx, `₹${amt} → bal ₹${after}`);
  if (zero) await tx.giftVoucherClosure.create({ data: { tenantId: ctx.tenantId, voucherId: v.id, closureDate: date, reason: "ZeroBalance", closedBy: ctx.userId, closedByName: ctx.userName } });
  return { redemptionId: red.id, balanceAfter: after };
}

/** Standalone manual redemption (Redeem console). Optional GL: Dr Liability / Cr Sales. */
export async function redeemVoucher(ctx: Ctx, input: RedeemInput): Promise<{ balanceAfter: number; amount: number }> {
  const v = await validateVoucher(ctx, input.voucherNo, input.customerId);
  if (!v.valid || !v.voucherId) throw new Error(v.reason);
  const cfg = await getConfig(ctx);
  if (!cfg.enablePartialRedemption && input.amount < v.availableBalance) throw new Error("Partial redemption is disabled — redeem the full balance.");
  const amt = r2(Math.min(input.amount, v.availableBalance));
  await prisma.$transaction((tx) => ensureAccounts(tx, ctx.tenantId));
  const res = await prisma.$transaction(async (tx) => {
    let journalRef: string | null = null;
    if (input.post) {
      const jid = await postJournal(tx, { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, voucherType: "JOURNAL", prefix: "GVR", date: today(), narration: `Gift voucher redeemed — ${v.voucherNo}`, sourceType: "GV_REDEMPTION", sourceId: v.voucherId!, refNo: v.voucherNo, createdBy: ctx.userId, lines: [{ code: liabilityCode(cfg), debit: amt, narration: "Gift voucher liability released" }, { code: ACC.SALES, credit: amt, narration: "Revenue on voucher redemption" }] });
      if (jid) journalRef = `GVR-${String(jid).padStart(6, "0")}`;
    }
    return redeemInTx(tx, ctx, v.voucherId!, amt, { invoiceNo: input.invoiceNo, saleId: input.saleId, journalRef });
  });
  await audit(ctx, "Voucher", v.voucherId, "Voucher Redeemed", ctx.userId, ctx.userName, `${v.voucherNo} · ₹${amt}`);
  return { balanceAfter: res.balanceAfter, amount: amt };
}

// ---------------------------------------------------------------- closure / expiry / reissue
export async function closeVoucher(ctx: Ctx, voucherId: number, reason = "Manual", note?: string): Promise<void> {
  const v = await prisma.giftVoucher.findFirst({ where: { id: voucherId, ...bizWhere(ctx) } });
  if (!v) throw new Error("Voucher not found.");
  const toStatus = reason === "Cancelled" ? "Cancelled" : "Closed";
  await prisma.$transaction(async (tx) => {
    await tx.giftVoucher.update({ where: { id: v.id }, data: { status: toStatus } });
    await tx.giftVoucherClosure.create({ data: { tenantId: ctx.tenantId, voucherId: v.id, closureDate: today(), reason, note: note ?? null, closedBy: ctx.userId, closedByName: ctx.userName } });
    await ledger(tx, ctx, v.id, "CLOSE", "DR", num(v.availableBalance), 0, null, today());
    await history(tx, ctx.tenantId, v.id, v.status, toStatus, reason === "Cancelled" ? "Voucher Cancelled" : "Voucher Closed", ctx, reason);
  });
  await audit(ctx, "Voucher", v.id, reason === "Cancelled" ? "Voucher Cancelled" : "Voucher Closed", ctx.userId, ctx.userName, v.voucherNo);
}
export async function extendExpiry(ctx: Ctx, voucherId: number, expiryDate: string): Promise<void> {
  const v = await prisma.giftVoucher.findFirst({ where: { id: voucherId, ...bizWhere(ctx) } });
  if (!v) throw new Error("Voucher not found.");
  await prisma.giftVoucher.update({ where: { id: v.id }, data: { expiryDate, status: v.status === "Expired" ? "Active" : v.status } });
  await audit(ctx, "Voucher", v.id, "Expiry Extended", ctx.userId, ctx.userName, `${v.voucherNo} → ${expiryDate}`);
}
export async function reissue(ctx: Ctx, voucherId: number, reason = "Lost"): Promise<{ voucherNo: string; balance: number }> {
  const old = await prisma.giftVoucher.findFirst({ where: { id: voucherId, ...bizWhere(ctx) } });
  if (!old) throw new Error("Voucher not found.");
  const cfg = await configRow(ctx);
  const bal = num(old.availableBalance);
  const created = await prisma.$transaction(async (tx) => {
    const { no, security } = await genNumber(tx, ctx, cfg.id);
    const nv = await tx.giftVoucher.create({ data: { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, voucherNo: no, voucherType: old.voucherType, faceValue: num(old.faceValue), originalValue: bal, redeemedValue: 0, availableBalance: bal, securityCode: security, qrData: no, barcodeData: no, status: "Active", customerId: old.customerId, customerName: old.customerName, issueDate: today(), expiryDate: old.expiryDate, activatedAt: today() } });
    await tx.giftVoucher.update({ where: { id: old.id }, data: { status: "Cancelled", availableBalance: 0 } });
    await tx.giftVoucherClosure.create({ data: { tenantId: ctx.tenantId, voucherId: old.id, closureDate: today(), reason: `Reissued(${reason})`, closedBy: ctx.userId, closedByName: ctx.userName } });
    await history(tx, ctx.tenantId, old.id, old.status, "Cancelled", "Voucher Reissued", ctx, `→ ${no}`);
    await history(tx, ctx.tenantId, nv.id, null, "Active", "Voucher Reissued", ctx, `from ${old.voucherNo}`);
    await ledger(tx, ctx, nv.id, "REISSUE", "CR", bal, bal, old.voucherNo, today());
    return { voucherNo: no, balance: bal };
  });
  await audit(ctx, "Voucher", old.id, "Voucher Reissued", ctx.userId, ctx.userName, `${old.voucherNo} → ${created.voucherNo}`);
  return created;
}
/** Expire vouchers past their expiry date (callable job). */
export async function runExpiry(ctx: Ctx): Promise<number> {
  const due = await prisma.giftVoucher.findMany({ where: { ...bizWhere(ctx), status: "Active", expiryDate: { lt: today(), not: null } }, select: { id: true, status: true } });
  for (const v of due) await prisma.$transaction(async (tx) => {
    await tx.giftVoucher.update({ where: { id: v.id }, data: { status: "Expired" } });
    await history(tx, ctx.tenantId, v.id, "Active", "Expired", "Voucher Expired", ctx);
  });
  if (due.length) await audit(ctx, "Voucher", null, "Voucher Expired", ctx.userId, ctx.userName, `${due.length} voucher(s)`);
  return due.length;
}

// ---------------------------------------------------------------- dashboard
export async function getDashboard(s: Scope): Promise<GvDashboard> {
  const [byStatus, faceAgg, redAgg, saleAgg, reds, sales, byType] = await Promise.all([
    prisma.giftVoucher.groupBy({ by: ["status"], where: bizWhere(s), _count: true }),
    prisma.giftVoucher.aggregate({ where: { ...bizWhere(s), status: { in: ["Active"] } }, _sum: { availableBalance: true } }),
    prisma.giftVoucherRedemption.aggregate({ where: { ...bizWhere(s), status: "Redeemed" }, _sum: { amount: true } }),
    prisma.giftVoucherSale.aggregate({ where: bizWhere(s), _sum: { netAmount: true } }),
    prisma.giftVoucherRedemption.findMany({ where: { ...bizWhere(s), status: "Redeemed" }, select: { redemptionDate: true, branchId: true, customerId: true, amount: true } }),
    prisma.giftVoucherSale.findMany({ where: bizWhere(s), select: { customerId: true, customerName: true, netAmount: true } }),
    prisma.giftVoucher.groupBy({ by: ["voucherType"], where: bizWhere(s), _count: true, _sum: { faceValue: true } }),
  ]);
  const st = (k: string) => byStatus.find((x) => x.status === k)?._count ?? 0;
  const custMap = new Map<string, number>();
  for (const sl of sales) { if (!sl.customerId) continue; const k = sl.customerName ?? `#${sl.customerId}`; custMap.set(k, (custMap.get(k) ?? 0) + num(sl.netAmount)); }
  const topCustomers = [...custMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  const brMap = new Map<number, number>();
  for (const r of reds) { if (r.branchId == null) continue; brMap.set(r.branchId, (brMap.get(r.branchId) ?? 0) + num(r.amount)); }
  const brIds = [...brMap.keys()];
  const brNames = brIds.length ? new Map((await prisma.branch.findMany({ where: { id: { in: brIds } }, select: { id: true, name: true } })).map((x) => [x.id, x.name])) : new Map<number, string>();
  const topBranches = [...brMap.entries()].map(([id, v]) => ({ name: brNames.get(id) ?? `Branch #${id}`, value: v })).sort((a, b) => b.value - a.value).slice(0, 5);
  const topTypes = byType.map((t) => ({ name: VOUCHER_TYPE_LABELS[t.voucherType] ?? t.voucherType, value: t._count })).sort((a, b) => b.value - a.value);
  const monthly = new Map<string, number>();
  for (const r of reds) { const k = (r.redemptionDate || "").slice(0, 7); if (k) monthly.set(k, (monthly.get(k) ?? 0) + num(r.amount)); }
  const monthlyArr = [...monthly.entries()].sort().slice(-6).map(([k, v]) => ({ name: k, value: v }));
  return {
    generated: byStatus.reduce((a, x) => a + x._count, 0), sold: st("Active") + st("Redeemed") + st("Closed") + st("Expired"), active: st("Active"), expired: st("Expired"), redeemed: st("Redeemed") + st("Closed"), closed: st("Closed"),
    outstandingLiability: num(faceAgg._sum.availableBalance), salesValue: num(saleAgg._sum.netAmount), redemptionValue: num(redAgg._sum.amount),
    topCustomers, topBranches, topTypes, monthly: monthlyArr,
  };
}

// ---------------------------------------------------------------- reports
export async function getReport(s: Scope, type: ReportType): Promise<ReportResult> {
  const rows = await listVouchers(s, {});
  const T = (title: string, columns: string[], data: (string | number)[][]): ReportResult => ({ title, columns, rows: data });
  switch (type) {
    case "register": return T("Voucher Register", ["Voucher No", "Type", "Face", "Balance", "Status", "Customer", "Issue", "Expiry", "Batch"], rows.map((v) => [v.voucherNo, VOUCHER_TYPE_LABELS[v.voucherType] ?? v.voucherType, v.faceValue, v.availableBalance, v.status, v.customerName || "—", v.issueDate || "—", v.expiryDate || "—", v.batchNo]));
    case "sale": { const sl = await prisma.giftVoucherSale.findMany({ where: bizWhere(s), orderBy: { id: "desc" }, take: 5000 }); return T("Voucher Sale Report", ["Sale No", "Date", "Customer", "Face", "GST", "Net", "Mode", "Journal"], sl.map((x) => [x.saleNo, x.saleDate, x.customerName ?? "—", num(x.faceValue), num(x.gstAmount), num(x.netAmount), x.paymentMode, x.journalRef ?? ""])); }
    case "activation": { const a = await prisma.giftVoucherActivation.findMany({ where: { tenantId: s.tenantId }, orderBy: { id: "desc" }, take: 5000, include: { voucher: { select: { voucherNo: true } } } }); return T("Voucher Activation Report", ["Voucher No", "Date", "Method", "By"], a.map((x) => [x.voucher.voucherNo, x.activationDate, x.method, x.activatedByName ?? ""])); }
    case "redemption": { const rd = await prisma.giftVoucherRedemption.findMany({ where: bizWhere(s), orderBy: { id: "desc" }, take: 5000, include: { voucher: { select: { voucherNo: true } } } }); return T("Voucher Redemption Report", ["Redemption No", "Date", "Voucher", "Invoice", "Amount", "Balance After", "Status"], rd.map((x) => [x.redemptionNo, x.redemptionDate, x.voucher.voucherNo, x.invoiceNo ?? "", num(x.amount), num(x.balanceAfter), x.status])); }
    case "balance": return T("Voucher Balance Report", ["Voucher No", "Face", "Redeemed", "Balance", "Status"], rows.filter((v) => ["Active"].includes(v.status)).map((v) => [v.voucherNo, v.faceValue, v.redeemedValue, v.availableBalance, v.status]));
    case "expiry": return T("Voucher Expiry Report", ["Voucher No", "Customer", "Balance", "Expiry", "Status"], rows.filter((v) => v.expiryDate).map((v) => [v.voucherNo, v.customerName || "—", v.availableBalance, v.expiryDate, v.status]));
    case "liability": case "outstanding": {
      const active = rows.filter((v) => v.status === "Active");
      const total = active.reduce((a, v) => a + v.availableBalance, 0);
      return T(type === "liability" ? "Voucher Liability Report" : "Outstanding Voucher Report", ["Voucher No", "Customer", "Face", "Outstanding Balance", "Expiry"], [...active.map((v) => [v.voucherNo, v.customerName || "—", v.faceValue, v.availableBalance, v.expiryDate || "—"]), ["", "", "TOTAL LIABILITY", r2(total), ""]]);
    }
    case "closure": { const cl = await prisma.giftVoucherClosure.findMany({ where: { tenantId: s.tenantId }, orderBy: { id: "desc" }, take: 5000, include: { voucher: { select: { voucherNo: true } } } }); return T("Voucher Closure Report", ["Voucher No", "Date", "Reason", "By"], cl.map((x) => [x.voucher.voucherNo, x.closureDate, x.reason, x.closedByName ?? ""])); }
    case "customer": return T("Customer Voucher Report", ["Customer", "Voucher No", "Face", "Balance", "Status"], rows.filter((v) => v.customerName).map((v) => [v.customerName, v.voucherNo, v.faceValue, v.availableBalance, v.status]));
    case "branch": { const d = await getDashboard(s); return T("Branch Voucher Report", ["Branch", "Redemption Value"], d.topBranches.map((b) => [b.name, b.value])); }
    case "corporate": return T("Corporate Voucher Report", ["Voucher No", "Customer", "Face", "Balance", "Status"], rows.filter((v) => v.voucherType === "CorporateGift").map((v) => [v.voucherNo, v.customerName || "—", v.faceValue, v.availableBalance, v.status]));
    default: return T("Report", [], []);
  }
}

// ---------------------------------------------------------------- audit
export async function listAudit(s: Scope): Promise<AuditRow[]> {
  const rows = await prisma.giftVoucherAudit.findMany({ where: { tenantId: s.tenantId }, orderBy: { id: "desc" }, take: 300 });
  return rows.map((a) => ({ id: a.id, entityType: a.entityType, entityId: a.entityId, action: a.action, byName: a.byName ?? "", note: a.note ?? "", at: a.at.toISOString() }));
}
