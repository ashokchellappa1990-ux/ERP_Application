import type { Prisma, LoyaltyProgram } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Db = Prisma.TransactionClient | typeof prisma;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

export type SaleChannel = "POS" | "B2C" | "B2B" | "Online";

/** Resolve the effective loyalty setting for a scope (branch → business → tenant). */
export async function getLoyaltySetting(db: Db, tenantId: number, scope: { businessId?: number | null; branchId?: number | null }) {
  const biz = scope.businessId ?? null; const br = scope.branchId ?? null;
  return (
    (br != null ? await db.loyaltySetting.findFirst({ where: { tenantId, businessId: biz, branchId: br } }) : null) ??
    (await db.loyaltySetting.findFirst({ where: { tenantId, businessId: biz, branchId: null } })) ??
    (await db.loyaltySetting.findFirst({ where: { tenantId, businessId: null, branchId: null } }))
  );
}

/** The single program that applies to a sale: loyalty must be enabled for the
 * scope, the program Active + within its effective dates + applicable to the
 * channel; highest priority wins (else the configured default program). */
export async function getEffectiveProgram(db: Db, tenantId: number, scope: { businessId?: number | null; branchId?: number | null }, channel: SaleChannel, date: string): Promise<LoyaltyProgram | null> {
  const setting = await getLoyaltySetting(db, tenantId, scope);
  if (!setting || !setting.enabled) return null;

  const biz = scope.businessId ?? null; const br = scope.branchId ?? null;
  const channelField = channel === "POS" ? "applyPos" : channel === "B2B" ? "applyB2b" : channel === "Online" ? "applyOnline" : "applyB2c";
  const programs = await db.loyaltyProgram.findMany({
    where: {
      tenantId, status: "Active",
      OR: [{ businessId: null }, { businessId: biz }],
      AND: [{ OR: [{ branchId: null }, { branchId: br }] }, { [channelField]: true } as Prisma.LoyaltyProgramWhereInput],
    },
    orderBy: [{ priority: "desc" }, { id: "asc" }],
  });
  const within = (p: LoyaltyProgram) => (!p.effectiveFrom || p.effectiveFrom <= date) && (!p.effectiveTo || p.effectiveTo >= date);
  const eligible = programs.filter(within);
  if (eligible.length) {
    if (setting.defaultProgramId) { const d = eligible.find((p) => p.id === setting.defaultProgramId); if (d) return d; }
    return eligible[0];
  }
  return null;
}

/** Is this customer eligible for the program? Walk-in = no customer id. */
export function isCustomerEligible(program: LoyaltyProgram, customer: { id: number | null; customerGroup?: string | null } | null): boolean {
  if (!customer || !customer.id) return false; // loyalty needs an identified customer
  if (program.eligibility === "registered") return true; // any saved customer
  if (program.eligibility === "groups") {
    const groups = (program.eligibleGroups ?? "").split(",").map((g) => g.trim().toLowerCase()).filter(Boolean);
    return !!customer.customerGroup && groups.includes(customer.customerGroup.toLowerCase());
  }
  return true; // "all"
}

const applyRound = (method: string, n: number) => method === "ceil" ? Math.ceil(n) : method === "round" ? Math.round(n) : Math.floor(n);

/** Base points earned for a bill under a program (before daily/monthly caps). */
export function computeEarnPoints(program: LoyaltyProgram, billAmount: number): number {
  if (billAmount < num(program.minBillAmount)) return 0;
  let raw = 0;
  if (program.calcMethod === "fixed") raw = num(program.fixedPoints);
  else if (program.calcMethod === "percentage") raw = billAmount * num(program.percentageRate) / 100;
  else raw = (billAmount / (num(program.amountPer) || 1)) * num(program.amountPoints); // "amount"
  let pts = Math.max(0, applyRound(program.roundOff, raw));
  if (program.maxPointsPerInvoice != null) pts = Math.min(pts, program.maxPointsPerInvoice);
  return pts;
}

/** ₹ value of N points under a program. */
export function pointsToValue(program: LoyaltyProgram, points: number): number {
  const per = num(program.pointValueAmount) / (program.pointValuePoints || 1);
  return r2(points * per);
}

export interface RedeemResult { points: number; value: number; error?: string }
/** Validate + clamp a redemption against the program rules + available balance +
 * bill amount. Returns the effective points/value (possibly reduced) or an error. */
export function validateRedeem(program: LoyaltyProgram, requestedPoints: number, billAmount: number, available: number): RedeemResult {
  if (!program.redemptionEnabled) return { points: 0, value: 0, error: "Redemption is disabled for this program." };
  let points = Math.max(0, Math.floor(requestedPoints));
  if (points <= 0) return { points: 0, value: 0 };
  points = Math.min(points, available); // never redeem more than the customer has
  if (program.minRedeemPoints && points < program.minRedeemPoints) return { points: 0, value: 0, error: `Minimum ${program.minRedeemPoints} points required to redeem.` };
  if (program.maxRedeemPoints != null && points > program.maxRedeemPoints) points = program.maxRedeemPoints;
  let value = pointsToValue(program, points);
  // Cap by % of bill and absolute amount, then re-derive the points actually used.
  const perPoint = num(program.pointValueAmount) / (program.pointValuePoints || 1);
  const caps: number[] = [value];
  if (program.maxRedeemPercent != null) caps.push(r2(billAmount * num(program.maxRedeemPercent) / 100));
  if (program.maxRedeemAmount != null) caps.push(num(program.maxRedeemAmount));
  caps.push(billAmount); // never exceed the bill
  const cappedValue = Math.max(0, Math.min(...caps));
  if (cappedValue < value) { points = perPoint > 0 ? Math.floor(cappedValue / perPoint) : 0; value = pointsToValue(program, points); }
  if (points <= 0) return { points: 0, value: 0, error: "Redemption amount is below the minimum point value." };
  return { points, value };
}
