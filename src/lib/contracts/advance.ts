import { z } from "zod";

/**
 * Enterprise Advance Management — one common engine for Customer / Supplier /
 * Employee advances. `direction` drives the accounting: 'received' (money in →
 * liability control account) | 'paid' (money out → asset control account).
 */
export type AdvanceDirection = "received" | "paid";
const numOrStr = z.union([z.number(), z.string()]);

export const PARTY_TYPES = ["Customer", "Supplier", "Employee", "Project", "Vendor", "Contractor", "Others"] as const;
export const REF_DOC_TYPES = ["", "Sales Order", "Sales Invoice", "Purchase Order", "Purchase Invoice", "Expense Voucher", "Petty Cash Voucher", "Employee", "Project", "Contract", "Others"] as const;
export const PAYMENT_MODES = ["Cash", "Bank", "UPI", "Card", "Cheque"] as const;
export const REFUND_MODES = ["Cash", "Bank", "UPI", "Cheque"] as const;

// Default seeded advance types (admin can add more). accountCode = the GL control
// account; direction = received (liability) / paid (asset).
export const DEFAULT_ADVANCE_TYPES: { code: string; name: string; direction: AdvanceDirection; accountCode: string; partyType: string }[] = [
  { code: "CUST", name: "Customer Advance", direction: "received", accountCode: "2150", partyType: "Customer" },
  { code: "SUPP", name: "Supplier Advance", direction: "paid", accountCode: "1150", partyType: "Supplier" },
  { code: "EMP", name: "Employee Advance", direction: "paid", accountCode: "1160", partyType: "Employee" },
  { code: "TRAVEL", name: "Travel Advance", direction: "paid", accountCode: "1160", partyType: "Employee" },
  { code: "PURADV", name: "Purchase Advance", direction: "paid", accountCode: "1150", partyType: "Supplier" },
  { code: "SOADV", name: "Sales Order Advance", direction: "received", accountCode: "2150", partyType: "Customer" },
  { code: "PROJ", name: "Project Advance", direction: "paid", accountCode: "1150", partyType: "Project" },
  { code: "OFFEXP", name: "Office Expense Advance", direction: "paid", accountCode: "1160", partyType: "Employee" },
  { code: "SECDEP", name: "Security Deposit", direction: "received", accountCode: "2160", partyType: "Customer" },
  { code: "BOOK", name: "Booking Advance", direction: "received", accountCode: "2150", partyType: "Customer" },
  { code: "SAL", name: "Salary Advance", direction: "paid", accountCode: "1160", partyType: "Employee" },
  { code: "FEST", name: "Festival Advance", direction: "paid", accountCode: "1160", partyType: "Employee" },
  { code: "SITE", name: "Site Advance", direction: "paid", accountCode: "1150", partyType: "Contractor" },
  { code: "OTHER", name: "Others", direction: "received", accountCode: "2150", partyType: "Others" },
];

export interface AdvanceConfigData {
  enableCustomerAdvance: boolean;
  enableSupplierAdvance: boolean;
  enableEmployeeAdvance: boolean;
  enableSecurityDeposit: boolean;
  enableRefund: boolean;
  enablePartialSettlement: boolean;
  enableMultipleSettlement: boolean;
  allowWithoutOrder: boolean;
  enableAutoAdjustment: boolean;
  defaultAdjustmentMode: "Manual" | "Automatic" | "FIFO" | "Oldest First" | "Latest First";
  requireConfirmationBeforeSettlement: boolean;
  approvalRequiredAboveAmount: number; // 0 = no approval required (auto-approve)
  advanceExpiryDays: number;
  settlementReminderDays: number;
  separateSeriesPerType: boolean;
  allowNegativeAdjustment: boolean;
  advancePrefix: string;
  settlementPrefix: string;
  refundPrefix: string;
  // Approval matrix — rules evaluated on submit. A rule matches when the advance
  // type is the rule's type (or "any") AND its net amount ≥ minAmount; a matched
  // rule with requiresApproval routes the advance to the Approval Queue.
  approvalMatrix: { advanceType: string; minAmount: number; requiresApproval: boolean }[];
}
/** True when an advance must be approved (matrix rule OR the global threshold). */
export function needsAdvanceApproval(cfg: AdvanceConfigData, advanceTypeName: string, netAmount: number): boolean {
  const matrix = (cfg.approvalMatrix ?? []).some((r) => (r.advanceType === "any" || r.advanceType === advanceTypeName) && netAmount >= (Number(r.minAmount) || 0) && r.requiresApproval);
  const threshold = cfg.approvalRequiredAboveAmount > 0 && netAmount >= cfg.approvalRequiredAboveAmount;
  return matrix || threshold;
}
export const DEFAULT_ADVANCE_CONFIG: AdvanceConfigData = {
  enableCustomerAdvance: true, enableSupplierAdvance: true, enableEmployeeAdvance: true, enableSecurityDeposit: true,
  enableRefund: true, enablePartialSettlement: true, enableMultipleSettlement: true, allowWithoutOrder: true, enableAutoAdjustment: false,
  defaultAdjustmentMode: "Manual", requireConfirmationBeforeSettlement: true, approvalRequiredAboveAmount: 0,
  advanceExpiryDays: 0, settlementReminderDays: 0, separateSeriesPerType: false, allowNegativeAdjustment: false,
  advancePrefix: "ADV", settlementPrefix: "ASL", refundPrefix: "ARF", approvalMatrix: [],
};

/* ------------------------------------------------------------- schemas */
export const AdvanceCreateSchema = z.object({
  advanceDate: z.string().optional(),
  department: z.string().optional(),
  costCenterId: z.coerce.number().optional(),
  profitCenterId: z.coerce.number().optional(),
  advanceTypeId: z.coerce.number().int().positive("Select an advance type."),
  partyType: z.string().optional(),
  partyId: z.coerce.number().optional(),
  partyName: z.string().optional(),
  refDocType: z.string().optional(),
  refDocId: z.coerce.number().optional(),
  refNo: z.string().optional(),
  currency: z.string().optional(),
  exchangeRate: numOrStr.optional(),
  advanceAmount: numOrStr.refine((v) => Number(v) > 0, "Advance amount must be greater than 0."),
  taxAmount: numOrStr.optional(),
  paymentMode: z.string().optional(),
  paymentRef: z.string().optional(),
  bankId: z.coerce.number().nullable().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  narration: z.string().optional(),
  attachments: z.array(z.object({ fileName: z.string(), fileUrl: z.string(), fileType: z.string().nullable().optional(), size: z.coerce.number().optional() })).optional(),
  saveMode: z.enum(["Draft", "Submit"]).optional(),
});
export type AdvanceCreateInput = z.infer<typeof AdvanceCreateSchema>;

export const SettlementCreateSchema = z.object({
  advanceId: z.coerce.number().int().positive(),
  settlementDate: z.string().optional(),
  refDocType: z.string().optional(),
  refDocId: z.coerce.number().optional(),
  refNo: z.string().optional(),
  refInvoice: z.string().optional(),
  settlementAmount: numOrStr.refine((v) => Number(v) > 0, "Settlement amount must be greater than 0."),
  method: z.string().optional(),
  expenseAccountCode: z.string().optional(),
  remarks: z.string().optional(),
  autoApprove: z.boolean().optional(),
});
export type SettlementCreateInput = z.infer<typeof SettlementCreateSchema>;

export const RefundCreateSchema = z.object({
  advanceId: z.coerce.number().int().positive(),
  refundDate: z.string().optional(),
  refundAmount: numOrStr.refine((v) => Number(v) > 0, "Refund amount must be greater than 0."),
  refundMode: z.string().optional(),
  reason: z.string().optional(),
  narration: z.string().optional(),
  autoApprove: z.boolean().optional(),
});
export type RefundCreateInput = z.infer<typeof RefundCreateSchema>;

export const StatusActionSchema = z.object({ action: z.string(), note: z.string().optional() });
export const AdvanceTypeCreateSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "Name is required."),
  direction: z.enum(["received", "paid"]),
  accountCode: z.string().min(1, "GL account code is required."),
  partyType: z.string().optional(),
  description: z.string().optional(),
  allowRefund: z.boolean().optional(),
  allowPartial: z.boolean().optional(),
  displayOrder: z.coerce.number().optional(),
  status: z.string().optional(),
});

/* ---------------------------------------------------------------- DTOs */
export interface AdvanceRow {
  id: number; advanceNo: string; advanceDate: string; advanceTypeName: string; direction: AdvanceDirection;
  partyType: string; partyName: string; refNo: string; netAmount: number; settledAmount: number; refundedAmount: number; balanceAmount: number;
  status: string; approvalStatus: string;
}
export interface AdvanceListStats { total: number; open: number; outstanding: number; pendingApproval: number }

export interface SettlementRow {
  id: number; settlementNo: string; settlementDate: string; advanceNo: string; partyName: string; refInvoice: string;
  settlementAmount: number; method: string; status: string; approvalStatus: string;
}
export interface RefundRow {
  id: number; refundNo: string; refundDate: string; advanceNo: string; partyName: string; refundAmount: number; refundMode: string; status: string; approvalStatus: string;
}
export interface AdvanceTypeRow {
  id: number; code: string; name: string; direction: AdvanceDirection; accountCode: string; partyType: string; allowRefund: boolean; allowPartial: boolean; displayOrder: number; status: string; usage: number;
}

export interface AdvanceDetail extends AdvanceRow {
  businessId: number | null; department: string; costCenterId: number | null; profitCenterId: number | null;
  advanceTypeId: number | null; partyId: number | null; refDocType: string; refDocId: number | null;
  currency: string; exchangeRate: number; advanceAmount: number; taxAmount: number; accountCode: string;
  paymentMode: string; paymentRef: string; narration: string; approvalNote: string; cancelReason: string;
  journalId: number | null; createdByName: string; createdAt: string;
  attachments: { fileName: string; fileUrl: string; fileType: string | null; size: number }[];
  settlements: (SettlementRow & { refNo: string; remarks: string })[];
  refundList: (RefundRow & { reason: string })[];
}

/* --------------------------------------------------------- status maps */
// action -> { fromStatus: toStatus } for the advance voucher.
export const ADVANCE_NEXT: Record<string, Record<string, string>> = {
  approve: { Draft: "Approved", Pending: "Approved" }, // posts GL
  reject: { Pending: "Rejected" },
  cancel: { Draft: "Cancelled", Pending: "Cancelled", Collected: "Cancelled", Paid: "Cancelled" }, // reverses GL if posted
  reopen: { Rejected: "Draft", Cancelled: "Draft" },
  close: { "Fully Settled": "Closed", Refunded: "Closed" },
};
export const isPosted = (status: string) => ["Collected", "Paid", "Partially Settled", "Fully Settled", "Refunded"].includes(status);
export const OPEN_ADVANCE = ["Collected", "Paid", "Partially Settled"];
export const dirAccountLabel = (dir: AdvanceDirection) => (dir === "received" ? "Advance (Liability)" : "Advance (Asset)");
