import { z } from "zod";

/** Receipt Transaction module — miscellaneous (non-sales) receipts. Contracts. */

export const PAYMENT_MODES = ["Cash", "Bank", "UPI", "Card", "Cheque", "DD", "NEFT", "RTGS", "IMPS"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
/** Modes that settle into a bank account (vs. cash in hand). */
export const BANK_MODES: PaymentMode[] = ["Bank", "UPI", "Card", "Cheque", "DD", "NEFT", "RTGS", "IMPS"];

export const PARTY_TYPES = ["", "Supplier", "Customer", "Employee", "Owner", "Bank", "Other"] as const;
/** Party types you can quick-add from the receipt screen. Bank/Employee are select-only
 *  (you don't casually create a bank or an employee from a receipt). */
export const QUICK_ADD_PARTY_TYPES = ["Supplier", "Customer", "Owner", "Other"] as const;
export const VOUCHER_RESETS = ["Yearly", "Monthly", "Never"] as const;
export const TAX_TYPES = ["None", "GST", "TDS", "TCS"] as const;
export type TaxType = (typeof TAX_TYPES)[number];
export type ReceiptStatus = "Draft" | "Submitted" | "Approved" | "Posted" | "Cancelled";

// ---------------------------------------------------------------- configuration

export interface ReceiptConfig {
  enableModule: boolean; enableApproval: boolean; enableAttachment: boolean;
  enableCostCenter: boolean; enableDepartment: boolean; enableProject: boolean; enableMultiMode: boolean;
  enableSubHead: boolean; enableGst: boolean;
  autoVoucher: boolean; voucherPrefix: string; voucherPadding: number; voucherSeparator: string;
  voucherReset: (typeof VOUCHER_RESETS)[number]; voucherSeq: number; voucherSeqPeriod: string;
}

export const ReceiptConfigSchema = z.object({
  enableModule: z.boolean(), enableApproval: z.boolean(), enableAttachment: z.boolean(),
  enableCostCenter: z.boolean(), enableDepartment: z.boolean(), enableProject: z.boolean(), enableMultiMode: z.boolean(),
  enableSubHead: z.boolean(), enableGst: z.boolean(),
  autoVoucher: z.boolean(), voucherPrefix: z.string().trim().max(20), voucherPadding: z.coerce.number().int().min(1).max(10),
  voucherSeparator: z.string().max(4), voucherReset: z.enum(VOUCHER_RESETS),
});
export type ReceiptConfigInput = z.infer<typeof ReceiptConfigSchema>;

// ------------------------------------------------------------------- sub heads

export interface ReceiptSubHeadRow { id: number; categoryId: number; code: string; name: string; creditCode: string; creditName: string; taxType: TaxType; taxRate: number; active: boolean }

export const ReceiptSubHeadSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  code: z.string().trim().max(30).optional(),
  name: z.string().trim().min(1, "Sub-head name is required.").max(120),
  creditCode: z.string().trim().max(20).optional(),
  creditName: z.string().trim().max(120).optional(),
  taxType: z.enum(TAX_TYPES).optional(),
  taxRate: z.coerce.number().nonnegative().optional(),
  active: z.boolean().optional(),
});
export type ReceiptSubHeadInput = z.infer<typeof ReceiptSubHeadSchema>;

// ------------------------------------------------------------------- category

export interface ReceiptCategoryRow {
  id: number; code: string; name: string; description: string;
  debitCode: string; debitName: string; creditCode: string; creditName: string;
  approvalRequired: boolean; allowAttachment: boolean; active: boolean;
  subHeads: ReceiptSubHeadRow[];
}

export const ReceiptCategorySchema = z.object({
  code: z.string().trim().min(1, "Category code is required.").max(30),
  name: z.string().trim().min(1, "Category name is required.").max(120),
  description: z.string().trim().max(300).optional(),
  debitCode: z.string().trim().max(20).optional(),
  debitName: z.string().trim().max(120).optional(),
  creditCode: z.string().trim().max(20).optional(),
  creditName: z.string().trim().max(120).optional(),
  approvalRequired: z.boolean().optional(),
  allowAttachment: z.boolean().optional(),
  active: z.boolean().optional(),
});
export type ReceiptCategoryInput = z.infer<typeof ReceiptCategorySchema>;

// ----------------------------------------------------------------- transaction

/** One sub-head line: head + taxable amount + optional GST. */
export const ReceiptHeadLineSchema = z.object({
  subHeadId: z.coerce.number().int().positive().optional(),
  headName: z.string().trim().max(120).optional(),
  taxable: z.coerce.number().nonnegative(),
  taxType: z.enum(TAX_TYPES).optional(),
  gstRate: z.coerce.number().nonnegative().optional(),
  creditCode: z.string().trim().optional(),
  creditName: z.string().trim().optional(),
});

export const ReceiptAttachmentSchema = z.object({
  docType: z.string().trim().max(20).optional(),
  fileName: z.string().trim().min(1).max(200),
  fileUrl: z.string().min(1),
  fileType: z.string().trim().max(80).optional(),
  size: z.coerce.number().int().nonnegative().optional(),
});

export const ReceiptCreateSchema = z.object({
  voucherDate: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive("Select a receipt category."),
  amount: z.coerce.number().positive("Receipt amount must be greater than zero."),
  gstApplicable: z.boolean().optional(),
  mode: z.enum(PAYMENT_MODES),
  bankName: z.string().trim().optional(),
  bankId: z.coerce.number().nullable().optional(),
  bankAccount: z.string().trim().optional(),
  partyType: z.string().trim().optional(),
  partyId: z.coerce.number().int().positive().optional(),
  partyName: z.string().trim().optional(),
  partyGstin: z.string().trim().max(20).optional(),
  referenceNo: z.string().trim().max(80).optional(),
  referenceDate: z.string().trim().optional(),
  narration: z.string().trim().max(400).optional(),
  debitCode: z.string().trim().optional(),
  debitName: z.string().trim().optional(),
  creditCode: z.string().trim().optional(),
  creditName: z.string().trim().optional(),
  costCenter: z.string().trim().max(80).optional(),
  department: z.string().trim().max(80).optional(),
  project: z.string().trim().max(80).optional(),
  remarks: z.string().trim().max(400).optional(),
  heads: z.array(ReceiptHeadLineSchema).optional(),       // sub-head lines
  attachments: z.array(ReceiptAttachmentSchema).optional(),
});
export type ReceiptCreateInput = z.infer<typeof ReceiptCreateSchema>;

export const ReceiptActionSchema = z.object({
  action: z.enum(["submit", "approve", "post", "cancel", "reverse"]),
  note: z.string().trim().max(300).optional(),
});

export interface ReceiptRow {
  id: number; voucherNo: string; voucherDate: string; categoryName: string; mode: string;
  amount: number; partyName: string; branchId: number | null; status: ReceiptStatus; createdByName: string;
}

export interface ReceiptHeadLine { subHeadId: number | null; headName: string; taxable: number; taxType: TaxType; gstRate: number; gstAmount: number; cgst: number; sgst: number; tdsAmount: number; tcsAmount: number; amount: number; creditCode: string; creditName: string }
export interface ReceiptAttachmentRow { id: number; docType: string; fileName: string; fileUrl: string; fileType: string; size: number }
export interface ReceiptJournalLine { account: string; code: string; debit: number; credit: number; narration: string }
export interface ReceiptAuditRow { id: number; action: string; byName: string; note: string; at: string }

export interface ReceiptDetail extends ReceiptRow {
  financialYear: string; accountingPeriod: string;
  categoryId: number | null; categoryCode: string;
  taxableAmount: number; gstApplicable: boolean; gstAmount: number; cgstAmount: number; sgstAmount: number; tdsAmount: number; tcsAmount: number; partyGstin: string;
  cashAccountCode: string; bankAccountCode: string; bankName: string;
  partyType: string; partyId: number | null; referenceNo: string; referenceDate: string; narration: string;
  debitCode: string; debitName: string; creditCode: string; creditName: string;
  costCenter: string; department: string; project: string; remarks: string;
  journalRef: string; voucherJournalNo: string;
  submittedByName: string; approvedByName: string; postedByName: string; cancelledByName: string;
  heads: ReceiptHeadLine[]; attachments: ReceiptAttachmentRow[]; journal: ReceiptJournalLine[]; audit: ReceiptAuditRow[];
}

export interface AccountRef { code: string; name: string; type: string }
export interface ReceiptMeta { config: ReceiptConfig; categories: ReceiptCategoryRow[]; accounts: AccountRef[] }

// --------------------------------------------------------------------- parties

export interface ReceiptPartyRow { id: number; name: string; gstin: string; phone: string; type: string; source: "supplier" | "customer" | "bank" | "employee" | "party" }

export const ReceiptPartySchema = z.object({
  type: z.string().trim().min(1, "Party type is required."),
  name: z.string().trim().min(1, "Party name is required.").max(200),
  gstin: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(150).optional(),
  address: z.string().trim().max(300).optional(),
});
export type ReceiptPartyInput = z.infer<typeof ReceiptPartySchema>;
