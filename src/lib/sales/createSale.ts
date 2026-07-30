import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import { collectQrCodes, validateQrCodes, markQrCodesSold } from "@/lib/sales/qrCodes";
import { postSaleLineMovements } from "@/lib/sales/postSaleLine";
import { nextInvoiceNumber } from "@/lib/sales/invoiceNumber";
import { postSalesJournal } from "@/lib/accounting/post";
import { recordBankMovement } from "@/lib/finance/bank";
import { getActiveScope, type ScopeUser } from "@/lib/auth/scope";
import { getEffectiveProgram, isCustomerEligible, validateRedeem } from "@/lib/loyalty/program";
import { earnOnSale, redeemOnSale } from "@/lib/loyalty/engine";
import { validateCoupon } from "@/lib/coupon/service";
import { validatePromo } from "@/lib/promo/service";
import { getMemberContext } from "@/lib/membership/registration";
import { getFinance } from "@/lib/membership/service";
import { validateVoucher, redeemInTx } from "@/lib/giftVoucher/service";
import { evaluateForSale } from "@/lib/discount/service";
import { ACC } from "@/lib/accounting/accounts";
import type { TerminalStamp } from "@/lib/pos/terminalContext";
import type { SaleCreateInput } from "@/lib/contracts/sale";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const dec = (v: unknown) => { const t = typeof v === "string" ? v.trim() : v; if (t === "" || t == null) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
const r2 = (n: number) => +n.toFixed(2);

/** Normalised, validated sale ready to be inserted + posted inside a transaction.
 * Produced by `prepareSale` (all reads/validation outside the tx); consumed by
 * `createSaleTx`. Shared by the POS sale route and the Sales Exchange new-item leg. */
export interface PreparedSale {
  saleDate: string;
  warehouse: string;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  lines: Prisma.SaleLineUncheckedCreateWithoutSaleInput[];
  lineCodes: string[][];
  scannedCodes: string[];
  fefoSet: Set<number>;
  payments: { mode: string; amount: number; reference: string | null }[];
  subtotal: number; itemDiscount: number; billDiscount: number; taxableValue: number;
  taxTotal: number; cgst: number; sgst: number; roundOff: number; total: number; itemCount: number;
  amountPaid: number; changeDue: number; paymentStatus: string; paymentMode: string;
  bankId?: number | null; bankName?: string | null; bankAccount?: string | null;
  // Loyalty (resolved in prepareSale; consumed in createSaleTx).
  loyaltyProgramId: number | null; loyaltyRedeemPoints: number; loyaltyRedeemValue: number;
  // Coupon (validated + discount recomputed server-side in prepareSale; the
  // redemption is recorded in createSaleTx). Applied like a bill-level discount.
  couponId: number | null; couponCode: string | null; couponDiscount: number; couponTaxableReduced: number;
  // Promo code — same treatment as coupon (shared promotion framework).
  promoId: number | null; promoCode: string | null; promoDiscount: number; promoTaxableReduced: number;
  // Membership benefit — auto bill discount for active members (from config).
  membershipDiscount: number; membershipLevelId: number | null; membershipDiscountCode: string;
  // Gift voucher tendered as payment (stored value).
  giftVoucherId: number | null; giftVoucherNo: string | null; giftVoucherAmount: number;
  // Central Discount Engine — automatic rule-based discounts from Discount Management.
  // `taxableReduction` = the pre-tax (ex-GST) discount posted as "Discount Allowed".
  engineDiscount: number; engineApplied: { id: number; code: string; name: string; discountAmount: number; taxableReduction: number; account: string }[];
}

/** Validate + compute a sale from a create request (no DB writes). Returns either a
 * ready-to-post `PreparedSale` or `{ error }` with a user-facing 422 message. */
export async function prepareSale(user: ScopeUser, body: SaleCreateInput): Promise<PreparedSale | { error: string }> {
  const saleDate = (body.saleDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const warehouse = body.warehouse || "Main Store";
  const rawLines = (body.lines ?? []).filter((l) => Number(l.productId) > 0 && Number(l.qty) > 0);
  if (!rawLines.length) return { error: "Add at least one item to bill." };

  const productIds = Array.from(new Set(rawLines.map((l) => Number(l.productId))));
  const prods = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: user.tenantId }, select: { id: true, invExpiry: true, valuation: true, category: true, brand: true } });
  if (prods.length !== productIds.length) return { error: "One or more items are not in your catalog." };
  const fefoSet = new Set(prods.filter((p) => p.valuation === "fefo" || (!p.valuation && p.invExpiry)).map((p) => p.id));
  const productMeta = new Map(prods.map((p) => [p.id, { category: p.category ?? undefined, brand: p.brand ?? undefined }]));

  const posSetting = await resolveScoped((where) => prisma.posSetting.findFirst({ where }), await settingScope(user));
  const taxIncl = ((posSetting?.config as { taxMethod?: string } | null)?.taxMethod ?? "inclusive") !== "exclusive";

  let subtotal = 0, itemDiscount = 0, taxableValue = 0, taxTotal = 0, itemCount = 0;
  const lines: Prisma.SaleLineUncheckedCreateWithoutSaleInput[] = rawLines.map((l) => {
    const qty = Number(l.qty) || 0;
    const rate = num(l.rate);
    const gst = num(l.taxPct);
    const gross = qty * rate;
    const discType = l.discType === "val" ? "val" : "pct";
    const discInput = num(l.disc);
    const discAmount = discType === "val" ? Math.min(r2(discInput), gross) : r2(gross * (discInput / 100));
    const discPct = discType === "pct" && discInput > 0 ? discInput : null;
    const net = gross - discAmount;
    const taxable = gst > 0 ? (taxIncl ? r2(net / (1 + gst / 100)) : net) : net;
    const tax = gst > 0 ? (taxIncl ? r2(net - taxable) : r2(net * (gst / 100))) : 0;
    const lineValue = taxIncl ? net : r2(net + tax);
    subtotal += gross; itemDiscount += discAmount; taxableValue += taxable; taxTotal += tax; itemCount += qty;
    return {
      productId: Number(l.productId), productName: String(l.productName ?? ""), sku: l.sku || null, hsn: l.hsn || null, uom: l.uom || null,
      qty, mrp: dec(l.mrp), rate, discPct, discAmount, taxPct: gst || null, taxableValue: taxable, taxAmount: tax, value: lineValue,
      batchNo: l.batchNo || null, mfgDate: l.mfgDate || null, expiryDate: l.expiryDate || null,
    };
  });
  const lineCodes: string[][] = rawLines.map((l) => [...new Set((Array.isArray(l.qrCodes) ? l.qrCodes : []).map((c) => String(c).trim()).filter(Boolean))]);

  const netOfItem = r2(subtotal - itemDiscount);
  const billInput = num(body.billDiscount);
  const billDiscount = body.billDiscType === "val" ? Math.min(r2(billInput), netOfItem) : r2(netOfItem * (billInput / 100));

  // Loyalty redemption — validated + clamped against the effective program, the
  // customer's available balance and the bill. Applied like a bill-level discount
  // (reduces the amount payable), consistent with how billDiscount works here.
  const customerId = body.customerId && Number(body.customerId) > 0 ? Number(body.customerId) : null;
  let loyaltyProgramId: number | null = null; let loyaltyRedeemPoints = 0; let loyaltyRedeemValue = 0;
  if (customerId) {
    const scope = await getActiveScope(user);
    const program = await getEffectiveProgram(prisma, user.tenantId, { businessId: scope.businessId ?? null, branchId: scope.branchId ?? null }, "POS", saleDate);
    if (program) {
      const cust = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, customerGroup: true, availableRewardPoints: true } });
      if (cust && isCustomerEligible(program, cust)) {
        loyaltyProgramId = program.id;
        const wantPoints = Math.max(0, Math.floor(num(body.loyaltyRedeemPoints)));
        if (wantPoints > 0) {
          const billBeforeRedeem = r2(netOfItem - billDiscount + (taxIncl ? 0 : taxTotal));
          const v = validateRedeem(program, wantPoints, billBeforeRedeem, num(cust.availableRewardPoints));
          if (v.error) return { error: v.error };
          loyaltyRedeemPoints = v.points; loyaltyRedeemValue = v.value;
        }
      }
    }
  }

  // Coupon — validate + recompute the discount server-side (never trust a client
  // amount). Applied like a bill-level discount, after item/bill/loyalty reductions.
  let couponId: number | null = null; let couponCode: string | null = null; let couponDiscount = 0; let couponTaxableReduced = 0;
  const rawCoupon = (body.couponCode ?? "").trim();
  if (rawCoupon) {
    const scope = await getActiveScope(user);
    const billForCoupon = r2(netOfItem - billDiscount - loyaltyRedeemValue + (taxIncl ? 0 : taxTotal));
    const cv = await validateCoupon(
      { tenantId: user.tenantId, businessId: scope.businessId ?? null },
      { couponCode: rawCoupon, billAmount: billForCoupon, customerId: customerId ?? undefined, channel: "POS", date: saleDate,
        items: lines.map((l) => ({ productId: Number(l.productId), qty: num(l.qty), amount: num(l.taxableValue) })) },
    );
    if (!cv.valid || !cv.couponId) return { error: cv.reason || "Coupon is not valid for this bill." };
    couponId = cv.couponId; couponCode = rawCoupon;
    couponDiscount = Math.min(r2(cv.discountAmount), billForCoupon);
    couponTaxableReduced = r2(cv.taxableReduced);
  }

  // Promo code — validated + discount recomputed server-side (like the coupon).
  // Applied after the coupon, as another bill-level reduction.
  let promoId: number | null = null; let promoCode: string | null = null; let promoDiscount = 0; let promoTaxableReduced = 0;
  const rawPromo = (body.promoCode ?? "").trim();
  if (rawPromo) {
    const scope = await getActiveScope(user);
    const billForPromo = r2(netOfItem - billDiscount - loyaltyRedeemValue - couponDiscount + (taxIncl ? 0 : taxTotal));
    const pv = await validatePromo(
      { tenantId: user.tenantId, businessId: scope.businessId ?? null },
      { promoCode: rawPromo, billAmount: billForPromo, customerId: customerId ?? undefined, channel: "POS", date: saleDate,
        items: lines.map((l) => ({ productId: Number(l.productId), qty: num(l.qty), amount: num(l.taxableValue) })) },
    );
    if (!pv.valid || !pv.promoCodeId) return { error: pv.reason || "Promo code is not valid for this bill." };
    promoId = pv.promoCodeId; promoCode = rawPromo;
    promoDiscount = Math.min(r2(pv.discountAmount), billForPromo);
    promoTaxableReduced = r2(pv.taxableReduced);
  }

  // Membership benefit — an automatic bill discount for active members, read from
  // the Membership Configuration (level benefit). Applied like a bill-level discount.
  let membershipDiscount = 0; let membershipLevelId: number | null = null; let membershipDiscountCode: string = ACC.SALES_DISCOUNT;
  const wantMembership = body.membershipApply === true || body.membershipApply === "true";
  if (wantMembership && customerId) {
    const scope = await getActiveScope(user);
    const mscope = { tenantId: user.tenantId, businessId: scope.businessId ?? null };
    const mc = await getMemberContext(mscope, customerId);
    if (mc.isMember && mc.billDiscountPct > 0) {
      const remaining = r2(netOfItem - billDiscount - loyaltyRedeemValue - couponDiscount - promoDiscount);
      let md = r2(netOfItem * mc.billDiscountPct / 100);
      if (mc.maxDiscount > 0) md = Math.min(md, mc.maxDiscount);
      membershipDiscount = r2(Math.max(0, Math.min(md, remaining)));
      membershipLevelId = mc.levelId;
      const fin = await getFinance(mscope);
      membershipDiscountCode = fin.discountAccount || ACC.SALES_DISCOUNT;
    }
  }

  // Central Discount Engine — automatic, rule-based discounts (category / festival /
  // quantity / bill-value / etc.) resolved dynamically from the Discount Management
  // module. Applied as an additional bill-level reduction, after every other discount.
  // POS/Sales holds NO discount logic itself; failures never block a sale.
  let engineDiscount = 0;       // display total (base) — recorded for reporting/usage
  let engineNetReduction = 0;   // tax-inclusive reduction — lowers the taxable so GST recomputes
  const engineApplied: PreparedSale["engineApplied"] = [];
  try {
    const remainingForEngine = r2(netOfItem - billDiscount - loyaltyRedeemValue - couponDiscount - promoDiscount - membershipDiscount);
    if (remainingForEngine > 0) {
      const scope = await getActiveScope(user);
      const res = await evaluateForSale(
        { tenantId: user.tenantId, businessId: scope.businessId ?? null },
        {
          billAmount: remainingForEngine, billTaxable: r2(taxableValue),
          items: lines.map((l) => { const m = productMeta.get(Number(l.productId)); return { productId: Number(l.productId), category: m?.category, brand: m?.brand, qty: num(l.qty), amount: r2(num(l.rate) * num(l.qty) - num(l.discAmount)), taxable: num(l.taxableValue) }; }),
          customerId: customerId ?? undefined, channel: "POS", date: saleDate,
          flags: { isMember: membershipLevelId != null },
        },
      );
      const blended = taxableValue > 0 ? (taxableValue + taxTotal) / taxableValue : 1; // incl/taxable (e.g. 1.18)
      let cap = remainingForEngine;
      for (const a of res.applied) {
        const red = r2(Math.min(a.netReduction, cap));
        if (red <= 0) continue;
        engineApplied.push({ id: a.id, code: a.code, name: a.name, discountAmount: r2(a.discountAmount), taxableReduction: r2(red / blended), account: a.account });
        engineDiscount = r2(engineDiscount + a.discountAmount);
        engineNetReduction = r2(engineNetReduction + red);
        cap = r2(cap - red);
      }
    }
  } catch (err) { console.error("[discount-engine] evaluate failed (sale continues)", err); }

  // The engine discount is netted into the invoice: it lowers the taxable value and GST is
  // recomputed on the discounted (material) value — not posted as a post-tax bill reduction.
  const inclusiveBase = r2(taxableValue + taxTotal);
  const engRatio = inclusiveBase > 0 ? Math.min(1, engineNetReduction / inclusiveBase) : 0;
  if (engRatio > 0) {
    for (const ln of lines) {
      ln.taxableValue = r2(num(ln.taxableValue) * (1 - engRatio));
      ln.taxAmount = r2(num(ln.taxAmount) * (1 - engRatio));
      ln.value = r2(num(ln.value) * (1 - engRatio));
    }
    taxableValue = r2(taxableValue * (1 - engRatio));
    taxTotal = r2(taxTotal * (1 - engRatio));
  }

  const preRound = r2(taxableValue + taxTotal - billDiscount - loyaltyRedeemValue - couponDiscount - promoDiscount - membershipDiscount);
  const total = Math.max(0, Math.round(preRound));
  const roundOff = r2(total - preRound);
  const cgst = r2(taxTotal / 2);
  const sgst = r2(taxTotal - cgst);

  const payments = (body.payments ?? []).filter((p) => Number(p.amount) > 0).map((p) => ({ mode: String(p.mode || "Cash"), amount: r2(num(p.amount)), reference: p.reference || null }));

  // Gift voucher tendered as payment (stored value). Validated server-side; the
  // applied amount is capped at the voucher balance and the bill total. It's added
  // as a payment line (mode "GiftVoucher") and released from the liability at posting.
  let giftVoucherId: number | null = null; let giftVoucherNo: string | null = null; let giftVoucherAmount = 0;
  const rawVoucher = (body.giftVoucherNo ?? "").trim();
  if (rawVoucher) {
    const scope = await getActiveScope(user);
    const gv = await validateVoucher({ tenantId: user.tenantId, businessId: scope.businessId ?? null }, rawVoucher, customerId ?? undefined);
    if (!gv.valid || !gv.voucherId) return { error: gv.reason || "Gift voucher is not valid." };
    const want = num(body.giftVoucherAmount) > 0 ? num(body.giftVoucherAmount) : gv.availableBalance;
    giftVoucherAmount = r2(Math.max(0, Math.min(want, gv.availableBalance, total)));
    if (giftVoucherAmount > 0) { giftVoucherId = gv.voucherId; giftVoucherNo = gv.voucherNo; payments.push({ mode: "GiftVoucher", amount: giftVoucherAmount, reference: gv.voucherNo }); }
  }

  const amountPaid = r2(payments.reduce((s, p) => s + p.amount, 0));
  const changeDue = r2(Math.max(0, amountPaid - total));
  const paymentStatus = amountPaid >= total ? "Paid" : amountPaid > 0 ? "Partial" : "Credit";
  const paymentMode = payments.length === 0 ? "Credit" : payments.length === 1 ? payments[0].mode : "Split";

  const scannedCodes = collectQrCodes(rawLines);
  const qrErr = await validateQrCodes(prisma, user.tenantId, scannedCodes, warehouse);
  if (qrErr) return { error: qrErr };

  return {
    saleDate, warehouse, customerId,
    customerName: body.customerName || (customerId ? null : "Walk-in"),
    customerPhone: body.customerPhone || null, notes: body.notes || null,
    lines, lineCodes, scannedCodes, fefoSet, payments,
    subtotal: r2(subtotal), itemDiscount: r2(itemDiscount), billDiscount, taxableValue: r2(taxableValue),
    taxTotal: r2(taxTotal), cgst, sgst, roundOff, total, itemCount: Math.round(itemCount),
    amountPaid, changeDue, paymentStatus, paymentMode,
    bankId: body.bankId ?? null, bankName: body.bankName ?? null, bankAccount: body.bankAccount ?? null,
    loyaltyProgramId, loyaltyRedeemPoints, loyaltyRedeemValue,
    couponId, couponCode, couponDiscount, couponTaxableReduced,
    promoId, promoCode, promoDiscount, promoTaxableReduced,
    membershipDiscount, membershipLevelId, membershipDiscountCode,
    giftVoucherId, giftVoucherNo, giftVoucherAmount,
    engineDiscount, engineApplied,
  };
}

export interface CreateSaleOpts {
  user: { id: number; tenantId: number };
  seg: { businessId?: number; branchId?: number };
  stamp: TerminalStamp;
  channel?: string;            // "POS" | "B2B" — defaults to POS
  series?: "b2c" | "b2b";      // invoice number series — defaults to b2c
  status?: string;             // sale status — defaults to "Completed"
}

/** Insert a Sale (+ lines, payments), assign its invoice number, post inventory OUT
 * and the sales journal, and roll up the customer — all inside the caller's tx.
 * The single source of truth for creating a posted sale (POS route + exchange leg). */
export async function createSaleTx(
  tx: Prisma.TransactionClient,
  prepared: PreparedSale,
  opts: CreateSaleOpts,
): Promise<{ id: number; invoiceNo: string; total: number; changeDue: number }> {
  const { user, seg, stamp } = opts;
  const channel = opts.channel ?? "POS";
  const series = opts.series ?? "b2c";
  const p = prepared;

  const sale = await tx.sale.create({
    data: {
      tenantId: user.tenantId, ...seg, invoiceNo: "TMP", saleDate: p.saleDate, warehouse: p.warehouse, channel, status: opts.status ?? "Completed",
      customerId: p.customerId, customerName: p.customerName ?? undefined, customerPhone: p.customerPhone,
      subtotal: p.subtotal, itemDiscount: p.itemDiscount, billDiscount: p.billDiscount, taxableValue: p.taxableValue,
      cgst: p.cgst, sgst: p.sgst, igst: 0, taxTotal: p.taxTotal, roundOff: p.roundOff, total: p.total,
      amountPaid: p.amountPaid, changeDue: p.amountPaid >= p.total ? p.changeDue : 0, paymentMode: p.paymentMode, paymentStatus: p.paymentStatus, notes: p.notes,
      itemCount: p.itemCount, bankId: p.bankId ?? null, bankName: p.bankName ?? null, bankAccount: p.bankAccount ?? null, createdBy: user.id, ...stamp,
      lines: { create: p.lines },
      payments: { create: p.payments.map((pay) => ({ ...pay, ...seg })) },
    },
    include: { lines: true },
  });

  const invoiceNo = await nextInvoiceNumber(tx, user.tenantId, series, { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
  await tx.sale.update({ where: { id: sale.id }, data: { invoiceNo } });

  const orderedLines = [...sale.lines].sort((a, b) => a.id - b.id);
  const ctx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, warehouse: p.warehouse, saleId: sale.id, invoiceNo, saleDate: p.saleDate, createdBy: user.id };
  let totalCost = 0;
  for (let i = 0; i < orderedLines.length; i++) {
    const line = orderedLines[i];
    const res = await postSaleLineMovements(tx, ctx, { id: line.id, productId: line.productId, qty: line.qty, rate: line.rate, batchNo: line.batchNo }, p.lineCodes[i] ?? [], { fefo: p.fefoSet.has(line.productId) });
    await tx.saleLine.update({ where: { id: line.id }, data: { cost: res.cost, batchNo: res.batchNo, mfgDate: res.mfgDate, expiryDate: res.expiryDate } });
    totalCost += res.cost;
  }
  await markQrCodesSold(tx, user.tenantId, p.scannedCodes, sale.id, { invoiceNo, customerId: p.customerId, customerName: p.customerName, saleDate: p.saleDate });
  await tx.sale.update({ where: { id: sale.id }, data: { cost: r2(totalCost) } });

  const cashAmount = r2(p.payments.filter((pay) => pay.mode.toLowerCase().includes("cash")).reduce((s, pay) => s + pay.amount, 0));
  const bankAmount = r2(p.amountPaid - cashAmount - p.giftVoucherAmount);
  // Gross method for the rule-based discount: Sales is credited at the full ex-GST value,
  // the pre-tax discount is debited to "Discount Allowed", and GST is on the net taxable.
  const engineTaxableReduction = r2(p.engineApplied.reduce((s, e) => s + e.taxableReduction, 0));
  await postSalesJournal(tx, {
    tenantId: user.tenantId, ...seg, saleId: sale.id, invoiceNo, date: p.saleDate, customerName: p.customerName,
    taxableValue: r2(p.taxableValue + engineTaxableReduction), taxTotal: p.taxTotal, roundOff: p.roundOff, total: p.total, amountPaid: p.amountPaid, cost: r2(totalCost),
    cashAmount, bankAmount, billDiscount: p.billDiscount, loyaltyRedeem: p.loyaltyRedeemValue, couponDiscount: p.couponDiscount, promoDiscount: p.promoDiscount, membershipDiscount: p.membershipDiscount, membershipDiscountCode: p.membershipDiscountCode,
    engineDiscounts: p.engineApplied.filter((e) => e.taxableReduction > 0).map((e) => ({ code: e.account, amount: e.taxableReduction })),
    giftVoucher: p.giftVoucherAmount, createdBy: user.id,
  });
  if (bankAmount > 0 && p.bankId) await recordBankMovement(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: null }, { bankId: p.bankId, bankName: p.bankName, bankAccount: p.bankAccount, date: p.saleDate, direction: "in", amount: bankAmount, mode: p.paymentMode, reference: invoiceNo, sourceType: "Sale", sourceId: sale.id, sourceNo: invoiceNo, partyName: p.customerName, journalId: null, narration: `Sales ${invoiceNo}` });

  // Discount Management — record each rule-based discount applied (traceability +
  // analytics + usage caps), inside the sale tx so it's atomic with the bill.
  for (const e of p.engineApplied) {
    await tx.discountUsage.create({ data: { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, discountId: e.id, discountCode: e.code, discountName: e.name, saleId: sale.id, invoiceNo, customerId: p.customerId, customerName: p.customerName, billAmount: p.total, discountAmount: e.discountAmount, channel } });
    await tx.discountMaster.update({ where: { id: e.id }, data: { usageCount: { increment: 1 }, totalGiven: { increment: e.discountAmount } } });
  }

  // Gift voucher tender — deduct the balance + record the redemption (linked to the
  // sale). The liability was already released in the sales journal above.
  if (p.giftVoucherId && p.giftVoucherAmount > 0) {
    const gvCtx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: null };
    await redeemInTx(tx, gvCtx, p.giftVoucherId, p.giftVoucherAmount, { saleId: sale.id, invoiceNo, date: p.saleDate });
  }

  // Promo code redemption — record the usage + mark the code (single-use → Redeemed).
  // The discount is already booked by the sales journal (Dr Marketing Expense), so no
  // separate GL here (journalRef null) — mirrors the coupon handling above.
  if (p.promoId) {
    const promo = await tx.promoCode.findFirst({
      where: { id: p.promoId, tenantId: user.tenantId },
      include: { campaign: { include: { rules: { where: { active: true }, orderBy: { id: "asc" }, take: 1 } } } },
    });
    if (promo) {
      const rule = promo.campaign.rules[0];
      const single = !promo.oncePerCustomer && (!rule || rule.usageType === "SingleUse");
      await tx.promoRedemption.create({
        data: {
          tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null,
          promoCodeId: promo.id, campaignId: promo.campaignId, saleId: sale.id, invoiceNo,
          customerId: p.customerId ?? promo.customerId, customerName: p.customerName ?? promo.customerName, channel,
          billAmount: p.total, discountAmount: p.promoDiscount, taxableReduced: p.promoTaxableReduced, journalRef: null,
          redeemedBy: user.id, redeemedByName: null,
        },
      });
      await tx.promoCode.update({ where: { id: promo.id }, data: { status: single ? "Redeemed" : promo.status, redeemedCount: { increment: 1 } } });
    }
  }

  // Coupon redemption — record the usage + mark the coupon (single-use → Redeemed).
  // The discount is already booked by the sales journal (Dr Marketing Expense), so
  // no separate GL here (journalRef null) to avoid double-counting the promo cost.
  if (p.couponId) {
    const coupon = await tx.coupon.findFirst({
      where: { id: p.couponId, tenantId: user.tenantId },
      include: { campaign: { include: { rules: { where: { active: true }, orderBy: { id: "asc" }, take: 1 } } } },
    });
    if (coupon) {
      const rule = coupon.campaign.rules[0];
      const single = !rule || rule.usageType === "SingleUse";
      await tx.couponRedemption.create({
        data: {
          tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null,
          couponId: coupon.id, campaignId: coupon.campaignId, saleId: sale.id, invoiceNo,
          customerId: p.customerId ?? coupon.customerId, customerName: p.customerName ?? coupon.customerName, channel,
          billAmount: p.total, discountAmount: p.couponDiscount, taxableReduced: p.couponTaxableReduced, journalRef: null,
          redeemedBy: user.id, redeemedByName: null,
        },
      });
      await tx.coupon.update({ where: { id: coupon.id }, data: { status: single ? "Redeemed" : coupon.status, redeemedCount: { increment: 1 } } });
    }
  }

  if (p.customerId) {
    await tx.customer.update({ where: { id: p.customerId }, data: { totalSpent: { increment: p.total } } });

    // Loyalty engine: redeem first (points already discounted from the bill), then
    // credit earned points on the net total. Both write the ledger + balance.
    if (p.loyaltyProgramId) {
      const program = await tx.loyaltyProgram.findUnique({ where: { id: p.loyaltyProgramId } });
      if (program && program.status === "Active") {
        const lctx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, createdBy: user.id, txnDate: p.saleDate };
        if (p.loyaltyRedeemPoints > 0) await redeemOnSale(tx, lctx, { customerId: p.customerId, programId: program.id, points: p.loyaltyRedeemPoints, value: p.loyaltyRedeemValue, saleId: sale.id, invoiceNo });
        const earned = await earnOnSale(tx, lctx, program, { id: sale.id, invoiceNo, total: p.total, customerId: p.customerId });
        await tx.sale.update({ where: { id: sale.id }, data: { loyaltyEarned: earned, loyaltyRedeemed: p.loyaltyRedeemPoints, loyaltyRedeemValue: p.loyaltyRedeemValue } });
      }
    }
  }
  return { id: sale.id, invoiceNo, total: p.total, changeDue: p.changeDue };
}
