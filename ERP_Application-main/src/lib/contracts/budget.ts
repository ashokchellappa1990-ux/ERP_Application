import { z } from "zod";

/**
 * Shared contracts for the Expense Budget Planning module.
 *
 * A budget is a planning/control figure — it NEVER posts to the General Ledger.
 * Utilisation (Actual / Committed) is derived by reading the expense sub-ledger
 * (PettyCashLine, by head) and open Payables. See lib/finance/budgetService.ts.
 */

/** Indian financial year runs Apr → Mar. m1 = Apr … m12 = Mar. */
export const MONTHS = [
  { key: "m1", label: "Apr" }, { key: "m2", label: "May" }, { key: "m3", label: "Jun" },
  { key: "m4", label: "Jul" }, { key: "m5", label: "Aug" }, { key: "m6", label: "Sep" },
  { key: "m7", label: "Oct" }, { key: "m8", label: "Nov" }, { key: "m9", label: "Dec" },
  { key: "m10", label: "Jan" }, { key: "m11", label: "Feb" }, { key: "m12", label: "Mar" },
] as const;
export type MonthKey = (typeof MONTHS)[number]["key"];

/** Quarters group three FY months each (Q1 = Apr-Jun … Q4 = Jan-Mar). */
export const QUARTERS: { key: string; label: string; months: MonthKey[] }[] = [
  { key: "q1", label: "Q1", months: ["m1", "m2", "m3"] },
  { key: "q2", label: "Q2", months: ["m4", "m5", "m6"] },
  { key: "q3", label: "Q3", months: ["m7", "m8", "m9"] },
  { key: "q4", label: "Q4", months: ["m10", "m11", "m12"] },
];

/** Half-years (H1 = Apr-Sep, H2 = Oct-Mar). */
export const HALVES: { key: string; label: string; months: MonthKey[] }[] = [
  { key: "h1", label: "H1", months: ["m1", "m2", "m3", "m4", "m5", "m6"] },
  { key: "h2", label: "H2", months: ["m7", "m8", "m9", "m10", "m11", "m12"] },
];

export const PERIODS = ["yearly", "halfyearly", "quarterly", "monthly"] as const;
export type BudgetPeriod = (typeof PERIODS)[number];
export const PERIOD_LABEL: Record<BudgetPeriod, string> = { yearly: "Yearly", halfyearly: "Half-Yearly", quarterly: "Quarterly", monthly: "Monthly" };

export const BUDGET_STATUSES = ["Draft", "Approved", "Active", "Closed"] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];
export const BUDGET_CONTROLS = ["warning", "approval", "stop"] as const;
export type BudgetControl = (typeof BUDGET_CONTROLS)[number];

export type Months = Record<MonthKey, number>;

/** From–to month label for a bucket, e.g. Q1 → "Apr–Jun", H1 → "Apr–Sep". */
export const monthLabel = (k: MonthKey) => MONTHS.find((m) => m.key === k)!.label;
export const rangeLabel = (ks: MonthKey[]) => (ks.length === 1 ? monthLabel(ks[0]) : `${monthLabel(ks[0])}–${monthLabel(ks[ks.length - 1])}`);
export const quarterRange = (qi: number) => rangeLabel(QUARTERS[qi].months);
export const halfRange = (hi: number) => rangeLabel(HALVES[hi].months);
export const halfTotal = (m: Months, hi: number): number => HALVES[hi].months.reduce((s, k) => s + (Number(m[k]) || 0), 0);
export function deriveHalfMonths(m: Months, hi: number, total: number): Months {
  const out = { ...m }; const ks = HALVES[hi].months;
  const per = Math.floor((total / 6) * 100) / 100;
  ks.forEach((k) => (out[k] = per));
  const drift = +(total - per * 6).toFixed(2); out[ks[5]] = +(out[ks[5]] + drift).toFixed(2);
  return out;
}

/** A single expense-head row inside a budget plan, with live monitoring figures. */
export interface BudgetLineDto {
  headId: number;
  headName: string;
  categoryName: string | null;
  accountId: number | null;
  accountCode: string | null;
  budgetType: "annual" | "monthly";
  budgetRequired: boolean;
  trackBudget: boolean;
  allowExceed: boolean;
  approvalRequired: boolean;
  budgetControl: BudgetControl;
  annual: number;
  months: Months;
  // Monitoring (server-computed; 0 for Draft plans that were never posted against)
  actual: number;
  committed: number;
  available: number;
  utilization: number; // %
}

export interface BudgetHeaderDto {
  id: number;
  businessId: number | null;
  branchId: number | null;
  branchName: string | null;
  fy: string;
  scope: "company" | "branch";
  period: BudgetPeriod;
  status: BudgetStatus;
  remarks: string | null;
  createdBy: number | null;
  approvedBy: number | null;
  approvedAt: string | null;
  updatedAt: string;
  lines: BudgetLineDto[];
}

/** Reference figures from the previous FY (same scope), shown while planning. */
export interface LastYearRefLine { headId: number; headName: string; annual: number; actual: number }
export interface LastYearRef { fy: string; exists: boolean; totalBudget: number; totalActual: number; lines: LastYearRefLine[] }

/** Per-head budget snapshot for the current period — shown on the expense voucher. */
export interface BudgetUsageDto {
  headId: number; headName: string; hasBudget: boolean;
  period: BudgetPeriod; periodLabel: string; // e.g. "Q2 · Jul–Sep FY 26-27"
  budget: number; utilized: number; committed: number; balance: number;
  control: BudgetControl; allowExceed: boolean;
}

export interface BudgetPlanSummary {
  id: number;
  fy: string;
  scope: "company" | "branch";
  period: BudgetPeriod;
  branchId: number | null;
  branchName: string | null;
  status: BudgetStatus;
  lineCount: number;
  totalBudget: number;
  actual: number;
  committed: number;
  available: number;
  utilization: number;
  updatedAt: string;
}

const monthsSchema = z.object({
  m1: z.coerce.number(), m2: z.coerce.number(), m3: z.coerce.number(), m4: z.coerce.number(),
  m5: z.coerce.number(), m6: z.coerce.number(), m7: z.coerce.number(), m8: z.coerce.number(),
  m9: z.coerce.number(), m10: z.coerce.number(), m11: z.coerce.number(), m12: z.coerce.number(),
});

export const BudgetSaveSchema = z.object({
  id: z.coerce.number().int().optional(), // existing plan (update) or omitted (create)
  fy: z.string().min(2),
  scope: z.enum(["company", "branch"]),
  period: z.enum(PERIODS).default("quarterly"),
  branchId: z.coerce.number().int().nullish(),
  remarks: z.string().max(1000).nullish(),
  lines: z.array(z.object({
    headId: z.coerce.number().int(),
    budgetType: z.enum(["annual", "monthly"]).default("annual"),
    budgetRequired: z.boolean().default(true),
    trackBudget: z.boolean().default(true),
    allowExceed: z.boolean().default(false),
    approvalRequired: z.boolean().default(false),
    budgetControl: z.enum(BUDGET_CONTROLS).default("warning"),
    annual: z.coerce.number().default(0),
    months: monthsSchema,
  })),
});
export type BudgetSaveInput = z.infer<typeof BudgetSaveSchema>;

export const BudgetStatusSchema = z.object({ status: z.enum(BUDGET_STATUSES) });

/* --------------------------------------------------------------- helpers -- */

export const emptyMonths = (): Months => ({ m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0, m7: 0, m8: 0, m9: 0, m10: 0, m11: 0, m12: 0 });
export const sumMonths = (m: Months): number => MONTHS.reduce((s, k) => s + (Number(m[k.key]) || 0), 0);
export const quarterTotal = (m: Months, qi: number): number => QUARTERS[qi].months.reduce((s, k) => s + (Number(m[k]) || 0), 0);

/** Evenly split an annual figure into 12 months (remainder loaded onto the last month). */
export function deriveMonthsFromAnnual(annual: number): Months {
  const base = Math.floor((annual / 12) * 100) / 100;
  const m = emptyMonths();
  for (const k of MONTHS) m[k.key] = base;
  const drift = +(annual - base * 12).toFixed(2);
  m.m12 = +(m.m12 + drift).toFixed(2);
  return m;
}

/** Distribute a quarter total equally across its three months. */
export function deriveQuarterMonths(m: Months, qi: number, quarterTotalValue: number): Months {
  const out = { ...m };
  const per = Math.floor((quarterTotalValue / 3) * 100) / 100;
  const ks = QUARTERS[qi].months;
  ks.forEach((k) => (out[k] = per));
  const drift = +(quarterTotalValue - per * 3).toFixed(2);
  out[ks[2]] = +(out[ks[2]] + drift).toFixed(2);
  return out;
}
