import { z } from "zod";

/**
 * Shared contract for the Finance module (receivables, payables, journal, GL,
 * petty-cash). Response DTOs are the source of truth for the list / detail shapes
 * shared by the server routes and the finance client pages / components.
 *
 * Request schemas are added (mirroring sale.ts) for the mutations that hand-parse
 * a JSON body without an existing domain validator: the receivables collection,
 * the petty-cash voucher, and the petty-cash expense-head + config writes.
 *
 * NOTE: the `/api/finance/reports` route returns polymorphic per-report `data`
 * (`unknown`) and the `/api/finance/journal` route is read-only (no mutation), so
 * neither gets a request schema here.
 */

const numOrStr = z.union([z.number(), z.string()]);

/* =============================================================== receivables */
export interface ReceivableRow {
  id: number;
  channel: string;
  refNo: string;
  customer: string;
  gstin: string;
  docDate: string;
  dueDate: string;
  paymentTerms: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  overdue: boolean;
  // "dispatch" rows are un-invoiced Load & Dispatch receivables recognized by
  // the Dispatch Accounting Voucher (Customer Receivable = On Dispatch) —
  // there's no Sale yet to collect against, so the UI points to posting the
  // invoice instead of the usual Collect flow. Omitted/"sale" = today's rows.
  source?: "sale" | "dispatch";
  loadDispatchId?: number;
}
/** Aging buckets by days past due (notDue = not yet due / no due date). */
export interface AgingBuckets { notDue: number; d1_30: number; d31_60: number; d61_90: number; d90: number }
/** One party (supplier/customer) summary with aging — the grouped view. */
export interface PartyGroup { party: string; gstin: string; count: number; billed: number; paid: number; balance: number; overdue: number; oldestDue: string | null; aging: AgingBuckets }

export interface ReceivableStats { open: number; outstanding: number; overdue: number; billed: number; collected: number; aging: AgingBuckets }
export interface ReceivableListResponse { ok: true; rows: ReceivableRow[]; groups: PartyGroup[]; stats: ReceivableStats }

export const ReceivableCollectSchema = z.object({
  saleId: z.coerce.number().int().optional(),
  amount: numOrStr.optional(),
  mode: z.string().optional(),
  reference: z.string().optional(),
  date: z.string().optional(),
});
export type ReceivableCollectInput = z.infer<typeof ReceivableCollectSchema>;

/* ================================================================= payables */
export interface PayableRow {
  id: number;
  sourceType: string;
  sourceId: number;
  refNo: string;
  supplier: string;
  docDate: string;
  dueDate: string;
  paymentTerms: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  overdue: boolean;
}
export interface PayableStats { open: number; outstanding: number; billed: number; paid: number; overdue: number; aging: AgingBuckets }
export interface PayableListResponse { ok: true; rows: PayableRow[]; groups: PartyGroup[]; stats: PayableStats }

/* ================================================================== journal */
export interface JournalLineRow { code: string; account: string; debit: number; credit: number; narration: string }
export interface JournalRow {
  id: number;
  voucherNo: string;
  voucherType: string;
  date: string;
  narration: string;
  refNo: string;
  sourceType: string;
  status: string;
  totalDebit: number;
  totalCredit: number;
  lines: JournalLineRow[];
}
export interface JournalStats { vouchers: number; totalPosted: number }
export interface JournalListResponse { ok: true; rows: JournalRow[]; stats: JournalStats }

/* ======================================================== general ledger / TB */
export interface GlAccountOption { id: number; code: string; name: string; type: string }
export interface TrialBalanceRow { id: number; code: string; name: string; type: string; group: string; debit: number; credit: number }
export interface GlLedgerRow {
  date: string;
  voucherNo: string;
  voucherType: string;
  narration: string;
  refNo: string;
  status: string;
  debit: number;
  credit: number;
  balance: number;
}
export interface TrialBalanceResponse {
  ok: true;
  mode: "trial";
  accounts: GlAccountOption[];
  rows: TrialBalanceRow[];
  totals: { debit: number; credit: number };
}
export interface GlLedgerResponse {
  ok: true;
  mode: "ledger";
  accounts: GlAccountOption[];
  account: { id: number; code: string; name: string; type: string; normalBalance: string };
  rows: GlLedgerRow[];
  totals: { debit: number; credit: number; balance: number };
}

/* =============================================================== petty cash */
export interface PettyCashRow {
  id: number;
  voucherNo: string;
  voucherDate: string;
  payeeType: string;
  payeeName: string;
  totalAmount: number;
  headCount: number;
  status: string;
}
export interface PettyCashStats { vouchers: number; thisMonth: number }
export interface PettyCashListResponse { ok: true; rows: PettyCashRow[]; stats: PettyCashStats }

export interface PettyCashDetailLine {
  headId: number | null;
  headName: string;
  description: string;
  hsn: string;
  gstPct: number | null;
  taxable: number | null;
  taxAmount: number | null;
  amount: number;
}
export interface PettyCashDetailPayment { mode: string; amount: number; reference: string }
export interface PettyCashDetail {
  id: number;
  voucherNo: string;
  voucherDate: string;
  payeeType: string;
  payeeName: string;
  gstApplicable: boolean;
  taxableTotal: number;
  cgst: number;
  sgst: number;
  taxTotal: number;
  totalAmount: number;
  notes: string;
  status: string;
  createdAt: Date;
  lines: PettyCashDetailLine[];
  payments: PettyCashDetailPayment[];
}

export const PettyCashLineInputSchema = z.object({
  headId: z.coerce.number().int().optional(),
  headName: z.string().optional(),
  description: z.string().optional(),
  hsn: z.string().optional(),
  gstPct: numOrStr.optional(),
  taxable: numOrStr.optional(),
  amount: numOrStr.optional(),
});
export const PettyCashPaymentInputSchema = z.object({
  mode: z.string().optional(),
  amount: numOrStr.optional(),
  reference: z.string().optional(),
});
export const PettyCashCreateSchema = z.object({
  voucherDate: z.string().optional(),
  payeeType: z.string().optional(),
  payeeId: z.coerce.number().int().optional(),
  payeeName: z.string().optional(),
  notes: z.string().optional(),
  gstApplicable: z.boolean().optional(),
  // Enterprise Expense — Business Expense fields (ignored for Petty Expense).
  expenseType: z.string().optional(),  // "petty" | "business"
  postingType: z.string().optional(),  // "ap" | "paynow"
  supplierGstin: z.string().optional(),
  invoiceNo: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  reverseCharge: z.boolean().optional(),
  tdsSection: z.string().optional(),
  tdsRate: z.coerce.number().optional(),
  tcsRate: z.coerce.number().optional(),
  // Financial dimensions captured on the journal for dimensional reporting.
  costCenterId: z.coerce.number().int().nullish(),
  profitCenterId: z.coerce.number().int().nullish(),
  department: z.string().optional(),
  project: z.string().optional(),
  attachments: z.array(z.object({ fileName: z.string(), fileUrl: z.string(), fileType: z.string().nullable().optional(), size: z.coerce.number().optional() })).optional(),
  lines: z.array(PettyCashLineInputSchema).default([]),
  payments: z.array(PettyCashPaymentInputSchema).default([]),
  // Payee (supplier/vendor/employee) advances applied against this expense.
  advanceAdjustments: z.array(z.object({ advanceId: z.coerce.number().int(), amount: z.union([z.number(), z.string()]) })).optional(),
});
export type PettyCashLineInput = z.infer<typeof PettyCashLineInputSchema>;
export type PettyCashPaymentInput = z.infer<typeof PettyCashPaymentInputSchema>;
export type PettyCashCreateInput = z.infer<typeof PettyCashCreateSchema>;

/* ---------------------------------------------------- petty-cash expense heads */
/** A head flagged with one of these has its own dedicated entry screen — the
 * Petty Cash Voucher form blocks picking it and redirects there instead,
 * since a generic expense line would lose that feature's structured data. */
export const LINKED_FEATURE_OPTS = [
  { value: "fuel_purchase", label: "Fuel Purchase", href: "/masters/transport/fuel-management/entry/new" },
] as const;
export type LinkedFeature = (typeof LINKED_FEATURE_OPTS)[number]["value"];
export const linkedFeatureHref = (v: string | null | undefined) => LINKED_FEATURE_OPTS.find((f) => f.value === v)?.href ?? null;
export const linkedFeatureLabel = (v: string | null | undefined) => LINKED_FEATURE_OPTS.find((f) => f.value === v)?.label ?? null;

export interface ExpenseHeadDto { id: number; name: string; parentId: number | null; active: boolean; accountId: number | null; accountCode: string | null; accountName: string | null; trackBudget: boolean; linkedFeature: string | null }

/** A selectable GL account for mapping an expense head. */
export interface ExpenseAccountDto { id: number; code: string; name: string; group: string | null }

export const ExpenseHeadCreateSchema = z.object({
  name: z.string().optional(),
  parentId: z.coerce.number().int().nullish(),
  accountId: z.coerce.number().int().nullish(),
});
export const ExpenseHeadUpdateSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().optional(),
  active: z.boolean().optional(),
  accountId: z.coerce.number().int().nullish(),
  trackBudget: z.boolean().optional(),
  linkedFeature: z.string().max(40).nullish(),
});
export type ExpenseHeadCreateInput = z.infer<typeof ExpenseHeadCreateSchema>;
export type ExpenseHeadUpdateInput = z.infer<typeof ExpenseHeadUpdateSchema>;

/* --------------------------------------------------------- petty-cash config */
export interface PettyCashConfigDto {
  budgetEnabled: boolean;
  budgetScope: string;
  partySource: string;
  gstEnabled: boolean;
  voucherPrefix: string;
  voucherPadding: number;
  voucherSeparator: string;
  voucherSeq: number;
  voucherIncludeYear: boolean;
  voucherIncludeMonth: boolean;
  voucherYearFormat: string;
  voucherResetFrequency: string;
}
export interface PettyCashConfigResponse {
  ok: true;
  config: PettyCashConfigDto;
  heads: ExpenseHeadDto[];
  accounts: ExpenseAccountDto[];
  budgets: Record<number, number>;
  actuals: Record<number, number>;
}

export const ExpenseBudgetInputSchema = z.object({
  headId: z.coerce.number().int(),
  amount: numOrStr,
});
export const PettyCashConfigSaveSchema = z.object({
  budgetEnabled: z.boolean().optional(),
  budgetScope: z.string().optional(),
  partySource: z.string().optional(),
  gstEnabled: z.boolean().optional(),
  voucherPrefix: z.string().optional(),
  voucherPadding: z.coerce.number().optional(),
  voucherSeparator: z.string().optional(),
  voucherIncludeYear: z.boolean().optional(),
  voucherIncludeMonth: z.boolean().optional(),
  voucherYearFormat: z.string().optional(),
  voucherResetFrequency: z.string().optional(),
  budgets: z.array(ExpenseBudgetInputSchema).default([]),
});
export type PettyCashConfigSaveInput = z.infer<typeof PettyCashConfigSaveSchema>;
