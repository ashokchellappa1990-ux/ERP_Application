import type { Prisma, LoyaltyProgram } from "@prisma/client";
import type { LoyaltyProgramDetail } from "@/lib/contracts/loyalty";

const dec = (v: unknown) => (v == null || v === "" ? null : Number(v));
const int = (v: unknown) => (v == null || v === "" ? null : Math.trunc(Number(v)));
const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Map a validated LoyaltyProgram input → Prisma data (only the keys present). */
export function toProgramData(b: Record<string, unknown>): Prisma.LoyaltyProgramUncheckedUpdateInput {
  const d: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) d[k] = v; };
  set("name", b.name); set("description", b.description ?? null);
  set("effectiveFrom", b.effectiveFrom ?? null); set("effectiveTo", b.effectiveTo ?? null);
  set("priority", b.priority === undefined ? undefined : (int(b.priority) ?? 0)); set("status", b.status); set("remarks", b.remarks ?? null);
  set("eligibility", b.eligibility); set("eligibleGroups", b.eligibleGroups ?? null);
  set("applyPos", b.applyPos); set("applyB2c", b.applyB2c); set("applyB2b", b.applyB2b); set("applyOnline", b.applyOnline);
  set("calcMethod", b.calcMethod);
  set("fixedPoints", b.fixedPoints === undefined ? undefined : (int(b.fixedPoints) ?? 0));
  set("amountPer", b.amountPer === undefined ? undefined : (dec(b.amountPer) ?? 100));
  set("amountPoints", b.amountPoints === undefined ? undefined : (int(b.amountPoints) ?? 1));
  set("percentageRate", b.percentageRate === undefined ? undefined : (dec(b.percentageRate) ?? 0));
  set("minBillAmount", b.minBillAmount === undefined ? undefined : (dec(b.minBillAmount) ?? 0));
  set("maxPointsPerInvoice", b.maxPointsPerInvoice === undefined ? undefined : int(b.maxPointsPerInvoice));
  set("maxDailyPoints", b.maxDailyPoints === undefined ? undefined : int(b.maxDailyPoints));
  set("maxMonthlyPoints", b.maxMonthlyPoints === undefined ? undefined : int(b.maxMonthlyPoints));
  set("roundOff", b.roundOff);
  set("redemptionEnabled", b.redemptionEnabled);
  set("minRedeemPoints", b.minRedeemPoints === undefined ? undefined : (int(b.minRedeemPoints) ?? 0));
  set("maxRedeemPoints", b.maxRedeemPoints === undefined ? undefined : int(b.maxRedeemPoints));
  set("maxRedeemPercent", b.maxRedeemPercent === undefined ? undefined : dec(b.maxRedeemPercent));
  set("maxRedeemAmount", b.maxRedeemAmount === undefined ? undefined : dec(b.maxRedeemAmount));
  set("allowPartialRedeem", b.allowPartialRedeem);
  set("pointValuePoints", b.pointValuePoints === undefined ? undefined : (int(b.pointValuePoints) ?? 1));
  set("pointValueAmount", b.pointValueAmount === undefined ? undefined : (dec(b.pointValueAmount) ?? 1));
  set("validityType", b.validityType); set("validityDays", b.validityDays === undefined ? undefined : int(b.validityDays)); set("validityMonths", b.validityMonths === undefined ? undefined : int(b.validityMonths));
  set("autoExpiry", b.autoExpiry); set("expiryNotification", b.expiryNotification);
  for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k];
  return d as Prisma.LoyaltyProgramUncheckedUpdateInput;
}

/** Shape a LoyaltyProgram row → the full detail DTO for the editor. */
export function toProgramDetail(p: LoyaltyProgram): LoyaltyProgramDetail {
  return {
    id: p.id, code: p.code, name: p.name, description: p.description ?? "", effectiveFrom: p.effectiveFrom ?? "", effectiveTo: p.effectiveTo ?? "",
    priority: p.priority, status: p.status as LoyaltyProgramDetail["status"], remarks: p.remarks ?? "",
    eligibility: p.eligibility as LoyaltyProgramDetail["eligibility"], eligibleGroups: p.eligibleGroups ?? "",
    applyPos: p.applyPos, applyB2c: p.applyB2c, applyB2b: p.applyB2b, applyOnline: p.applyOnline,
    calcMethod: p.calcMethod as LoyaltyProgramDetail["calcMethod"], fixedPoints: p.fixedPoints, amountPer: num(p.amountPer), amountPoints: p.amountPoints, percentageRate: num(p.percentageRate),
    minBillAmount: num(p.minBillAmount), maxPointsPerInvoice: p.maxPointsPerInvoice, maxDailyPoints: p.maxDailyPoints, maxMonthlyPoints: p.maxMonthlyPoints, roundOff: p.roundOff as LoyaltyProgramDetail["roundOff"],
    redemptionEnabled: p.redemptionEnabled, minRedeemPoints: p.minRedeemPoints, maxRedeemPoints: p.maxRedeemPoints, maxRedeemPercent: p.maxRedeemPercent == null ? null : num(p.maxRedeemPercent), maxRedeemAmount: p.maxRedeemAmount == null ? null : num(p.maxRedeemAmount), allowPartialRedeem: p.allowPartialRedeem,
    pointValuePoints: p.pointValuePoints, pointValueAmount: num(p.pointValueAmount),
    validityType: p.validityType as LoyaltyProgramDetail["validityType"], validityDays: p.validityDays, validityMonths: p.validityMonths, autoExpiry: p.autoExpiry, expiryNotification: p.expiryNotification,
    createdAt: p.createdAt.toISOString(),
  };
}
