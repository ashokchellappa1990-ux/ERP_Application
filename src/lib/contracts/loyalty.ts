import { z } from "zod";

/** Shared API contract for the Loyalty module (Phase 1). REQUEST = Zod; RESPONSE = interfaces. */

export const LOYALTY_CALC_METHODS = ["fixed", "amount", "percentage"] as const;
export const LOYALTY_ELIGIBILITY = ["all", "registered", "groups"] as const;
export const LOYALTY_VALIDITY = ["never", "days", "months"] as const;
export const LOYALTY_ROUNDOFF = ["floor", "round", "ceil"] as const;
export const LOYALTY_PROGRAM_STATUS = ["Draft", "Active", "Inactive"] as const;

const numOpt = z.coerce.number().optional();

export const LoyaltyProgramSchema = z.object({
  code: z.string().trim().min(1, "Program code is required.").optional(), // server auto-generates if blank
  name: z.string().trim().min(1, "Program name is required."),
  description: z.string().trim().optional(),
  effectiveFrom: z.string().trim().optional(),
  effectiveTo: z.string().trim().optional(),
  priority: numOpt,
  status: z.enum(LOYALTY_PROGRAM_STATUS).optional(),
  remarks: z.string().trim().optional(),
  eligibility: z.enum(LOYALTY_ELIGIBILITY).optional(),
  eligibleGroups: z.string().trim().optional(),
  applyPos: z.boolean().optional(), applyB2c: z.boolean().optional(), applyB2b: z.boolean().optional(), applyOnline: z.boolean().optional(),
  calcMethod: z.enum(LOYALTY_CALC_METHODS).optional(),
  fixedPoints: numOpt, amountPer: numOpt, amountPoints: numOpt, percentageRate: numOpt,
  minBillAmount: numOpt, maxPointsPerInvoice: numOpt.nullable(), maxDailyPoints: numOpt.nullable(), maxMonthlyPoints: numOpt.nullable(),
  roundOff: z.enum(LOYALTY_ROUNDOFF).optional(),
  redemptionEnabled: z.boolean().optional(), minRedeemPoints: numOpt, maxRedeemPoints: numOpt.nullable(),
  maxRedeemPercent: numOpt.nullable(), maxRedeemAmount: numOpt.nullable(), allowPartialRedeem: z.boolean().optional(),
  pointValuePoints: numOpt, pointValueAmount: numOpt,
  validityType: z.enum(LOYALTY_VALIDITY).optional(), validityDays: numOpt.nullable(), validityMonths: numOpt.nullable(),
  autoExpiry: z.boolean().optional(), expiryNotification: z.boolean().optional(),
});
export type LoyaltyProgramInput = z.infer<typeof LoyaltyProgramSchema>;

export const LoyaltySettingSchema = z.object({
  enabled: z.boolean(),
  defaultProgramId: z.coerce.number().int().nullable().optional(),
});
export type LoyaltySettingInput = z.infer<typeof LoyaltySettingSchema>;

export const ManualAdjustSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  type: z.enum(["credit", "debit"]),
  points: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1, "A reason is required."),
  remarks: z.string().trim().optional(),
});
export type ManualAdjustInput = z.infer<typeof ManualAdjustSchema>;

/* ---------------------------------------------------------- responses -- */

export interface LoyaltyProgramRow {
  id: number; code: string; name: string; status: string; priority: number;
  calcMethod: string; effectiveFrom: string; effectiveTo: string; redemptionEnabled: boolean; createdAt: string;
}
export interface LoyaltyProgramDetail extends LoyaltyProgramInput {
  id: number; code: string; createdAt: string;
}
export interface LoyaltyProgramListResponse { ok: true; rows: LoyaltyProgramRow[]; stats: { total: number; active: number }; }

export interface LoyaltySettingDTO { enabled: boolean; defaultProgramId: number | null; programs: { id: number; code: string; name: string; status: string }[]; }

export interface LoyaltyBalanceRow {
  customerId: number; customerName: string; phone: string;
  available: number; earned: number; redeemed: number; expired: number; lastTxnAt: string | null;
}
export interface LoyaltyBalanceResponse { ok: true; rows: LoyaltyBalanceRow[]; stats: { customers: number; available: number; earned: number; redeemed: number }; }

export interface LoyaltyLedgerRow {
  id: number; txnDate: string; customerId: number; customerName: string; invoiceNo: string;
  txnType: string; earned: number; redeemed: number; points: number; balanceAfter: number; remarks: string; createdAt: string;
}
