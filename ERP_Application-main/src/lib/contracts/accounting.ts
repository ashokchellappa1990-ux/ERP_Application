import { z } from "zod";

/**
 * Shared contract for the Accounting module (Chart of Accounts, Opening
 * Balance, Rule Engine, Financial Period).
 *
 * Response DTOs are the source of truth for the JSON shapes shared by the
 * server routes and the accounting client pages. Mutations that hand-parse a
 * JSON body without an existing domain validator carry a Zod request schema +
 * inferred type here (Opening Balance, Rule Engine, Financial Period create /
 * status patch).
 */

/* ----------------------------------------------- chart of accounts */
export type AccountType = "Asset" | "Liability" | "Income" | "Expense" | "Equity";
export type NormalBalance = "Debit" | "Credit";

export interface LedgerAccountRow {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  group: string;
  normalBalance: NormalBalance;
  debit: number;
  credit: number;
  balance: number;
}
export interface ChartOfAccountsStats {
  accounts: number;
  assets: number;
  liabilities: number;
  income: number;
  expense: number;
}
export interface ChartOfAccountsResponse {
  ok: true;
  rows: LedgerAccountRow[];
  stats: ChartOfAccountsStats;
}

/* ------------------------------------------------- opening balance */
export interface OpeningBalanceBankRow {
  bankId: number;
  bankName: string;
  branch: string;
  accountNo: string;
  ifsc: string;
  amount: number;
}
export interface OpeningBalanceResponse {
  ok: true;
  asOfDate: string;
  cash: { amount: number };
  banks: OpeningBalanceBankRow[];
  hasBusinessBanks: boolean;
}

export const OpeningBalanceBankSchema = z.object({
  bankId: z.coerce.number().int().nullish(),
  bankName: z.string().optional(),
  branch: z.string().optional(),
  accountNo: z.string().optional(),
  ifsc: z.string().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
});
export const OpeningBalanceSaveSchema = z.object({
  asOfDate: z.string().optional(),
  cash: z.union([z.number(), z.string()]).optional(),
  banks: z.array(OpeningBalanceBankSchema).optional(),
});
export type OpeningBalanceSaveInput = z.infer<typeof OpeningBalanceSaveSchema>;
export interface OpeningBalanceSaveResponse {
  ok: true;
  message: string;
  total: number;
}

/* ----------------------------------------------------- rule engine */
export interface RuleEngineResponse {
  ok: true;
  config: unknown; // RuleGroup[] | null — validated client-side against rulesStore
}
export const RuleEngineSaveSchema = z.object({
  config: z.array(z.unknown()),
});
export type RuleEngineSaveInput = z.infer<typeof RuleEngineSaveSchema>;
export interface RuleEngineSaveResponse {
  ok: true;
  message: string;
  config: unknown;
}

/* ------------------------------------------------ financial period */
export type FinancialPeriodStatus = "Open" | "Soft-Closed" | "Locked" | "Audit-Locked";
export type FinancialPeriodType = "Monthly" | "Quarterly" | "Half-Yearly" | "Yearly";

export interface FinancialPeriodRow {
  id: number;
  name: string;
  fy: string;
  type: string;
  fromDate: string;
  toDate: string;
  status: FinancialPeriodStatus;
}
export interface FinancialPeriodStats {
  total: number;
  open: number;
  locked: number;
  current: string;
}
export interface FinancialPeriodListResponse {
  ok: true;
  rows: FinancialPeriodRow[];
  stats: FinancialPeriodStats;
}

export const FinancialPeriodCreateSchema = z.object({
  name: z.string().optional(),
  fy: z.string().optional(),
  type: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type FinancialPeriodCreateInput = z.infer<typeof FinancialPeriodCreateSchema>;

export const FinancialPeriodStatusSchema = z.object({
  status: z.string().optional(),
});
export type FinancialPeriodStatusInput = z.infer<typeof FinancialPeriodStatusSchema>;
