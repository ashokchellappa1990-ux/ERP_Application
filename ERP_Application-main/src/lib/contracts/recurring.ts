import { z } from "zod";

/** Recurring Transaction Management — config (System) + operations (Finance). */

export const TXN_TYPES = ["expense", "income"] as const;
export type TxnType = (typeof TXN_TYPES)[number];

export const GEN_MODES = ["automatic", "manual", "scheduler_approval", "reminder"] as const;
export type GenMode = (typeof GEN_MODES)[number];
export const GEN_MODE_LABEL: Record<GenMode, string> = { automatic: "Automatic (Scheduler)", manual: "Manual", scheduler_approval: "Scheduler + Approval", reminder: "Reminder Only" };

export const EXPENSE_POSTING = ["ap", "pay_now", "journal"] as const;
export const INCOME_POSTING = ["ar", "receive_now", "journal"] as const;
export const POSTING_LABEL: Record<string, string> = { ap: "Accounts Payable", pay_now: "Pay Immediately", journal: "Journal Voucher", ar: "Accounts Receivable", receive_now: "Receive Immediately" };

export const FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "halfyearly", "yearly", "custom"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export const FREQ_LABEL: Record<Frequency, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", halfyearly: "Half Yearly", yearly: "Yearly", custom: "Custom (days)" };

export const RECURRING_STATUSES = ["Draft", "Active", "Paused", "Cancelled", "Completed", "Expired"] as const;
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];
export const EXEC_STATUSES = ["Generated", "Posted", "PendingApproval", "Approved", "Rejected", "Skipped", "Failed"] as const;
export type ExecStatus = (typeof EXEC_STATUSES)[number];

export interface ExecOptions { executeOnHoliday: boolean; executeOnWeekend: boolean; retryFailed: boolean; retryCount: number; autoPauseAfterFailure: boolean }
export interface Notifications { beforeDue: boolean; onDue: boolean; afterExecution: boolean; failure: boolean; email: boolean; sms: boolean; whatsapp: boolean; push: boolean }
export const DEFAULT_EXEC_OPTIONS: ExecOptions = { executeOnHoliday: true, executeOnWeekend: true, retryFailed: false, retryCount: 0, autoPauseAfterFailure: false };
export const DEFAULT_NOTIFICATIONS: Notifications = { beforeDue: false, onDue: true, afterExecution: true, failure: true, email: true, sms: false, whatsapp: false, push: false };

export interface RecurringConfigRow {
  id: number; configNo: string; name: string; txnType: TxnType; scope: string; branchName: string | null;
  generationMode: GenMode; postingMethod: string; frequency: Frequency; startDate: string; endDate: string | null;
  nextExecution: string | null; lastExecution: string | null; amount: number; status: RecurringStatus;
}

/** A single head + amount line inside a recurring config (one voucher, many heads). */
export interface ConfigLine { headId: number | null; headName: string | null; description: string | null; amount: number; gstPct: number }

export interface RecurringConfigDto {
  id: number; businessId: number | null; branchId: number | null; branchName: string | null;
  configNo: string; name: string; description: string | null; txnType: TxnType;
  department: string | null; costCenter: string | null; project: string | null;
  generationMode: GenMode; postingMethod: string;
  headId: number | null; headName: string | null; lines: ConfigLine[]; partyId: number | null; partyName: string | null; partyType: string | null;
  gstApplicable: boolean; gstPct: number; tdsRate: number; tcsRate: number; budgetValidation: boolean;
  amountType: "fixed" | "variable"; amount: number; minAmount: number; maxAmount: number;
  startDate: string; endDate: string | null; frequency: Frequency; customDays: number | null;
  nextExecution: string | null; lastExecution: string | null;
  execOptions: ExecOptions; notifications: Notifications; status: RecurringStatus;
}

/** Payment (expense) / collection (income) status of a generated voucher. */
export interface Settlement { kind: "payment" | "collection"; label: string; tone: "success" | "warning" | "danger" | "neutral"; total: number; settled: number; balance: number }

export interface ExecutionRow {
  id: number; executionNo: string; configNo: string; configName: string; txnType: TxnType;
  executionDate: string; dueDate: string | null; amount: number; status: ExecStatus;
  voucherType: string | null; voucherNo: string | null; generatedBy: string; generatedByName: string | null; remarks: string | null;
  settlement: Settlement | null;
}

/** Full execution detail — transaction, voucher, account posting, party, settlement. */
export interface PostingLine { code: string; name: string; debit: number; credit: number; narration: string | null }
export interface ExecutionDetail {
  execution: { executionNo: string; executionDate: string; dueDate: string | null; amount: number; status: ExecStatus; voucherType: string | null; voucherNo: string | null; generatedBy: string; generatedByName: string | null; remarks: string | null };
  config: { configNo: string; name: string; txnType: TxnType; postingMethod: string; partyName: string | null; partyType: string | null; department: string | null; costCenter: string | null; project: string | null; gstApplicable: boolean };
  lines: { headName: string | null; description: string | null; taxable: number; gst: number; amount: number }[];
  posting: PostingLine[];
  settlement: Settlement | null;
}

export interface PendingRow {
  configId: number; configNo: string; name: string; txnType: TxnType; scope: string; branchName: string | null;
  generationMode: GenMode; dueDate: string; amount: number; headName: string | null; partyName: string | null; overdue: boolean;
}

export const ConfigSaveSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().min(1, "Configuration name is required."),
  description: z.string().max(1000).nullish(),
  txnType: z.enum(TXN_TYPES),
  branchId: z.coerce.number().int().nullish(),
  department: z.string().max(120).nullish(),
  costCenter: z.string().max(120).nullish(),
  project: z.string().max(120).nullish(),
  generationMode: z.enum(GEN_MODES),
  postingMethod: z.string().min(1),
  headId: z.coerce.number().int().nullish(),
  lines: z.array(z.object({ headId: z.coerce.number().int().nullish(), headName: z.string().nullish(), description: z.string().max(300).nullish(), amount: z.coerce.number(), gstPct: z.coerce.number().default(0) })).optional(),
  partyId: z.coerce.number().int().nullish(),
  partyName: z.string().max(200).nullish(),
  partyType: z.string().max(20).nullish(),
  gstApplicable: z.boolean().default(false),
  gstPct: z.coerce.number().default(0),
  tdsRate: z.coerce.number().default(0),
  tcsRate: z.coerce.number().default(0),
  budgetValidation: z.boolean().default(false),
  amountType: z.enum(["fixed", "variable"]).default("fixed"),
  amount: z.coerce.number().default(0),
  minAmount: z.coerce.number().default(0),
  maxAmount: z.coerce.number().default(0),
  startDate: z.string().min(8),
  endDate: z.string().nullish(),
  frequency: z.enum(FREQUENCIES),
  customDays: z.coerce.number().int().nullish(),
  execOptions: z.object({ executeOnHoliday: z.boolean(), executeOnWeekend: z.boolean(), retryFailed: z.boolean(), retryCount: z.coerce.number(), autoPauseAfterFailure: z.boolean() }).partial().optional(),
  notifications: z.object({ beforeDue: z.boolean(), onDue: z.boolean(), afterExecution: z.boolean(), failure: z.boolean(), email: z.boolean(), sms: z.boolean(), whatsapp: z.boolean(), push: z.boolean() }).partial().optional(),
});
export type ConfigSaveInput = z.infer<typeof ConfigSaveSchema>;

export const StatusSchema = z.object({ status: z.enum(["Active", "Paused", "Cancelled", "Draft"]) });

/** Advance a date by one frequency period. Returns ISO yyyy-mm-dd (timezone-safe: all UTC). */
export function nextDate(fromIso: string, frequency: Frequency, customDays?: number | null): string {
  const [y, m, d] = (fromIso || new Date().toISOString().slice(0, 10)).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const addDays = (n: number) => dt.setUTCDate(dt.getUTCDate() + n);
  const addMonths = (n: number) => dt.setUTCMonth(dt.getUTCMonth() + n);
  switch (frequency) {
    case "daily": addDays(1); break;
    case "weekly": addDays(7); break;
    case "monthly": addMonths(1); break;
    case "quarterly": addMonths(3); break;
    case "halfyearly": addMonths(6); break;
    case "yearly": addMonths(12); break;
    case "custom": addDays(Math.max(1, customDays || 1)); break;
  }
  return dt.toISOString().slice(0, 10);
}
