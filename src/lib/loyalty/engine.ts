import type { Prisma, LoyaltyProgram } from "@prisma/client";
import { computeEarnPoints, pointsToValue, getEffectiveProgram } from "@/lib/loyalty/program";
import { postLoyaltyJournal } from "@/lib/accounting/post";

const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface LoyaltyCtx {
  tenantId: number;
  businessId?: number | null;
  branchId?: number | null;
  createdBy?: number | null;
  txnDate: string; // YYYY-MM-DD
}

interface ApplyInput {
  customerId: number;
  programId?: number | null;
  points: number;        // signed change to AVAILABLE balance (+credit / -debit)
  value?: number;        // ₹ equivalent of the points moved (absolute; for reports + GL)
  earnedDelta?: number;  // roll-up deltas (keep available = earned - redeemed - expired)
  redeemedDelta?: number;
  expiredDelta?: number;
  txnType: string;       // Earn | Redeem | SalesReturn | SalesCancellation | ManualCredit | ManualDebit | Expired
  refType?: string | null;
  refId?: number | null;
  invoiceNo?: string | null;
  remarks?: string | null;
}

/**
 * The single low-level mutation: move points on a customer's balance, write the
 * ledger row (with running balance) and mirror the roll-ups onto the Customer
 * record. `loyalty_customer_balance` is the system of record; Customer columns +
 * the legacy `loyaltyPoints` field are kept in sync for fast POS lookup.
 * Invariant: available = earned − redeemed − expired (floored at 0).
 */
export async function applyPoints(tx: Prisma.TransactionClient, ctx: LoyaltyCtx, p: ApplyInput): Promise<number> {
  const seg = { businessId: ctx.businessId ?? null, branchId: ctx.branchId ?? null };
  const existing = await tx.loyaltyCustomerBalance.findUnique({ where: { tenantId_customerId: { tenantId: ctx.tenantId, customerId: p.customerId } } });
  const cur = existing ?? { available: 0, earned: 0, redeemed: 0, expired: 0 };

  const available = Math.max(0, cur.available + p.points);
  const earned = Math.max(0, cur.earned + (p.earnedDelta ?? 0));
  const redeemed = Math.max(0, cur.redeemed + (p.redeemedDelta ?? 0));
  const expired = Math.max(0, cur.expired + (p.expiredDelta ?? 0));

  if (existing) {
    await tx.loyaltyCustomerBalance.update({ where: { id: existing.id }, data: { available, earned, redeemed, expired, lastTxnAt: new Date() } });
  } else {
    await tx.loyaltyCustomerBalance.create({ data: { tenantId: ctx.tenantId, ...seg, customerId: p.customerId, available, earned, redeemed, expired, lastTxnAt: new Date() } });
  }

  await tx.loyaltyTransactionLedger.create({
    data: {
      tenantId: ctx.tenantId, ...seg, txnDate: ctx.txnDate, customerId: p.customerId, programId: p.programId ?? null,
      txnType: p.txnType, points: p.points, value: p.value ?? 0, balanceAfter: available,
      refType: p.refType ?? null, refId: p.refId ?? null, invoiceNo: p.invoiceNo ?? null, remarks: p.remarks ?? null, createdBy: ctx.createdBy ?? null,
    },
  });

  // Mirror the absolute roll-ups onto the Customer (and keep legacy loyaltyPoints aligned).
  await tx.customer.update({ where: { id: p.customerId }, data: { availableRewardPoints: available, loyaltyPoints: available, totalRewardPointsEarned: earned, totalRewardPointsRedeemed: redeemed, totalRewardPointsExpired: expired } });

  return available;
}

/** Points already earned by a customer within a date / month (for the daily &
 * monthly caps). Sums positive Earn ledger rows. */
async function earnedInWindow(tx: Prisma.TransactionClient, tenantId: number, customerId: number, prefix: string): Promise<number> {
  const rows = await tx.loyaltyTransactionLedger.aggregate({ where: { tenantId, customerId, txnType: "Earn", txnDate: { startsWith: prefix } }, _sum: { points: true } });
  return num(rows._sum.points);
}

const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

/** ₹ value per point for a sale — derived from its Earn ledger row (exact), else
 * the currently-effective program. Used to value reversals at the original rate. */
async function perPointForSale(tx: Prisma.TransactionClient, ctx: LoyaltyCtx, customerId: number, invoiceNo: string): Promise<number> {
  const earn = await tx.loyaltyTransactionLedger.findFirst({ where: { tenantId: ctx.tenantId, customerId, invoiceNo, txnType: "Earn" }, orderBy: { id: "asc" } });
  if (earn && earn.points > 0 && num(earn.value) > 0) return num(earn.value) / earn.points;
  const program = await getEffectiveProgram(tx, ctx.tenantId, { businessId: ctx.businessId ?? null, branchId: ctx.branchId ?? null }, "POS", ctx.txnDate);
  return program ? pointsToValue(program, 1) : 0;
}

/** Credit earned points for a posted sale (applies daily/monthly caps) + post the
 * accounting accrual (Dr Loyalty Expense / Cr Loyalty Liability). Returns points. */
export async function earnOnSale(tx: Prisma.TransactionClient, ctx: LoyaltyCtx, program: LoyaltyProgram, sale: { id: number; invoiceNo: string; total: number; customerId: number }): Promise<number> {
  let pts = computeEarnPoints(program, sale.total);
  if (pts <= 0) return 0;
  if (program.maxDailyPoints != null) { const used = await earnedInWindow(tx, ctx.tenantId, sale.customerId, ctx.txnDate); pts = Math.min(pts, Math.max(0, program.maxDailyPoints - used)); }
  if (pts > 0 && program.maxMonthlyPoints != null) { const used = await earnedInWindow(tx, ctx.tenantId, sale.customerId, ctx.txnDate.slice(0, 7)); pts = Math.min(pts, Math.max(0, program.maxMonthlyPoints - used)); }
  if (pts <= 0) return 0;
  const value = pointsToValue(program, pts);
  await applyPoints(tx, ctx, { customerId: sale.customerId, programId: program.id, points: pts, value, earnedDelta: pts, txnType: "Earn", refType: "SALE", refId: sale.id, invoiceNo: sale.invoiceNo, remarks: "Points earned on sale" });
  await postLoyaltyJournal(tx, { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, date: ctx.txnDate, accrue: true, value, invoiceNo: sale.invoiceNo, saleId: sale.id, createdBy: ctx.createdBy, reason: `${pts} pts earned` });
  return pts;
}

/** Debit redeemed points for a sale + post the accounting release (Dr Loyalty
 * Liability / Cr Loyalty Expense). `value` = ₹ discount the points funded. */
export async function redeemOnSale(tx: Prisma.TransactionClient, ctx: LoyaltyCtx, p: { customerId: number; programId: number | null; points: number; value: number; saleId: number; invoiceNo: string }): Promise<void> {
  if (p.points <= 0) return;
  await applyPoints(tx, ctx, { customerId: p.customerId, programId: p.programId, points: -p.points, value: r2(p.value), redeemedDelta: p.points, txnType: "Redeem", refType: "SALE", refId: p.saleId, invoiceNo: p.invoiceNo, remarks: "Points redeemed on sale" });
  await postLoyaltyJournal(tx, { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, date: ctx.txnDate, accrue: false, value: r2(p.value), invoiceNo: p.invoiceNo, saleId: p.saleId, createdBy: ctx.createdBy, reason: `${p.points} pts redeemed` });
}

/** Reverse the points earned on the RETURNED portion of a sale (proportional) +
 * release the matching loyalty liability. */
export async function reverseForReturn(tx: Prisma.TransactionClient, ctx: LoyaltyCtx, p: { sale: { id: number; invoiceNo: string; total: number; loyaltyEarned: number; customerId: number | null }; returnId: number; returnValue: number }): Promise<number> {
  const { sale } = p;
  if (!sale.customerId || sale.loyaltyEarned <= 0 || num(sale.total) <= 0) return 0;
  const pts = Math.min(sale.loyaltyEarned, Math.floor(sale.loyaltyEarned * p.returnValue / num(sale.total)));
  if (pts <= 0) return 0;
  const value = r2(pts * await perPointForSale(tx, ctx, sale.customerId, sale.invoiceNo));
  await applyPoints(tx, ctx, { customerId: sale.customerId, points: -pts, value, earnedDelta: -pts, txnType: "SalesReturn", refType: "SALES_RETURN", refId: p.returnId, invoiceNo: sale.invoiceNo, remarks: "Points reversed on sales return" });
  await postLoyaltyJournal(tx, { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, date: ctx.txnDate, accrue: false, value, invoiceNo: sale.invoiceNo, saleId: p.returnId, createdBy: ctx.createdBy, reason: `${pts} pts reversed (return)` });
  return pts;
}

/** Reverse ALL points earned on a cancelled sale + restore any redeemed points,
 * with matching loyalty GL (release earned, re-accrue restored). */
export async function reverseForCancellation(tx: Prisma.TransactionClient, ctx: LoyaltyCtx, p: { sale: { id: number; invoiceNo: string; loyaltyEarned: number; loyaltyRedeemed: number; customerId: number | null }; cancellationId: number }): Promise<{ reversed: number; restored: number }> {
  const { sale } = p;
  if (!sale.customerId) return { reversed: 0, restored: 0 };
  const perPoint = await perPointForSale(tx, ctx, sale.customerId, sale.invoiceNo);
  let reversed = 0; let restored = 0;
  if (sale.loyaltyEarned > 0) {
    const value = r2(sale.loyaltyEarned * perPoint);
    await applyPoints(tx, ctx, { customerId: sale.customerId, points: -sale.loyaltyEarned, value, earnedDelta: -sale.loyaltyEarned, txnType: "SalesCancellation", refType: "SALES_CANCELLATION", refId: p.cancellationId, invoiceNo: sale.invoiceNo, remarks: "Earned points reversed on cancellation" });
    await postLoyaltyJournal(tx, { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, date: ctx.txnDate, accrue: false, value, invoiceNo: sale.invoiceNo, saleId: p.cancellationId, createdBy: ctx.createdBy, reason: "earned reversed (cancel)" });
    reversed = sale.loyaltyEarned;
  }
  if (sale.loyaltyRedeemed > 0) {
    const value = r2(sale.loyaltyRedeemed * perPoint);
    await applyPoints(tx, ctx, { customerId: sale.customerId, points: sale.loyaltyRedeemed, value, redeemedDelta: -sale.loyaltyRedeemed, txnType: "SalesCancellation", refType: "SALES_CANCELLATION", refId: p.cancellationId, invoiceNo: sale.invoiceNo, remarks: "Redeemed points restored on cancellation" });
    await postLoyaltyJournal(tx, { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, date: ctx.txnDate, accrue: true, value, invoiceNo: sale.invoiceNo, saleId: p.cancellationId, createdBy: ctx.createdBy, reason: "redeemed restored (cancel)" });
    restored = sale.loyaltyRedeemed;
  }
  return { reversed, restored };
}

/** Manual point adjustment by an authorised user. `points` signed (+credit/-debit).
 * Posts the matching loyalty GL using the effective program's point value. */
export async function manualAdjust(tx: Prisma.TransactionClient, ctx: LoyaltyCtx, p: { customerId: number; points: number; remarks?: string | null }): Promise<number> {
  if (p.points === 0) return 0;
  const program = await getEffectiveProgram(tx, ctx.tenantId, { businessId: ctx.businessId ?? null, branchId: ctx.branchId ?? null }, "POS", ctx.txnDate);
  const value = r2(Math.abs(p.points) * (program ? pointsToValue(program, 1) : 0));
  const balance = p.points > 0
    ? await applyPoints(tx, ctx, { customerId: p.customerId, points: p.points, value, earnedDelta: p.points, txnType: "ManualCredit", refType: "MANUAL", invoiceNo: null, remarks: p.remarks })
    : await applyPoints(tx, ctx, { customerId: p.customerId, points: p.points, value, redeemedDelta: -p.points, txnType: "ManualDebit", refType: "MANUAL", invoiceNo: null, remarks: p.remarks });
  if (value > 0) await postLoyaltyJournal(tx, { tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, date: ctx.txnDate, accrue: p.points > 0, value, invoiceNo: null, saleId: p.customerId, createdBy: ctx.createdBy, reason: `manual ${p.points > 0 ? "credit" : "debit"}` });
  return balance;
}
