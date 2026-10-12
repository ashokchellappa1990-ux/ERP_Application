import { z } from "zod";

/** Gift Voucher Management — contracts. Stored-value payment instrument. */

export const VOUCHER_TYPES = ["FixedValue", "VariableValue", "Promotional", "Refund", "Compensation", "EmployeeReward", "CorporateGift"] as const;
export const VOUCHER_TYPE_LABELS: Record<string, string> = { FixedValue: "Fixed Value", VariableValue: "Variable Value", Promotional: "Promotional", Refund: "Refund Voucher", Compensation: "Compensation", EmployeeReward: "Employee Reward", CorporateGift: "Corporate Gift" };
export const VOUCHER_STATUS = ["Generated", "Active", "Redeemed", "Expired", "Cancelled", "Closed"] as const;
export const CUSTOMER_MAPPING = ["Mandatory", "Optional", "NotRequired"] as const;
export const BUYER_TYPES = ["WalkIn", "Registered", "Corporate"] as const;
export const SALE_PAYMENT_MODES = ["Cash", "UPI", "Card", "Cheque", "Bank", "Wallet"] as const;
export const TEMPLATE_CATEGORIES = ["Retail", "Corporate", "Festival", "Birthday", "Luxury", "Generic"] as const;

const b = z.boolean();
const nn = z.coerce.number().nonnegative();

// ------------------------------------------------------------ configuration
export interface GvConfig {
  enableModule: boolean; enableQr: boolean; enableBarcode: boolean; enableCustomerMapping: boolean;
  customerMapping: (typeof CUSTOMER_MAPPING)[number]; enablePartialRedemption: boolean; enableMultipleRedemption: boolean;
  enableTransfer: boolean; enableRevalidation: boolean; enableExpiry: boolean; enableAutoExpiry: boolean; enableReissue: boolean; enableReplacement: boolean;
  autoActivateOnSale: boolean; approvalRequired: boolean; gstOnSale: boolean; gstPercentage: number;
  numberPrefix: string; numberLength: number; runningNumber: number; securityLength: number; defaultValidityDays: number; liabilityAccount: string;
}
export const GvConfigSchema = z.object({
  enableModule: b, enableQr: b, enableBarcode: b, enableCustomerMapping: b, customerMapping: z.enum(CUSTOMER_MAPPING),
  enablePartialRedemption: b, enableMultipleRedemption: b, enableTransfer: b, enableRevalidation: b, enableExpiry: b, enableAutoExpiry: b, enableReissue: b, enableReplacement: b,
  autoActivateOnSale: b, approvalRequired: b, gstOnSale: b, gstPercentage: nn,
  numberPrefix: z.string().trim().max(20), numberLength: z.coerce.number().int().min(6).max(30), securityLength: z.coerce.number().int().min(0).max(12), defaultValidityDays: z.coerce.number().int().nonnegative(),
  liabilityAccount: z.string().trim().optional(),
});
export type GvConfigInput = z.infer<typeof GvConfigSchema>;

// ------------------------------------------------------------ generation
export const GenerateSchema = z.object({
  voucherType: z.enum(VOUCHER_TYPES),
  faceValue: z.coerce.number().positive(),
  quantity: z.coerce.number().int().min(1).max(50000),
  expiryDate: z.string().trim().optional(),
});
export type GenerateInput = z.infer<typeof GenerateSchema>;

// ------------------------------------------------------------ sale
export const SaleSchema = z.object({
  voucherId: z.coerce.number().int().positive().optional(),
  voucherNo: z.string().trim().optional(),
  buyerType: z.enum(BUYER_TYPES).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  customerName: z.string().trim().max(200).optional(),
  saleDate: z.string().trim().optional(),
  expiryDate: z.string().trim().optional(),
  salePrice: z.coerce.number().nonnegative().optional(),
  paymentMode: z.enum(SALE_PAYMENT_MODES),
  paymentRef: z.string().trim().max(80).optional(),
  invoiceNo: z.string().trim().max(40).optional(),
  remarks: z.string().trim().max(400).optional(),
});
export type SaleInput = z.infer<typeof SaleSchema>;

// ------------------------------------------------------------ activation / balance / redeem / closure
export const ActivateSchema = z.object({ voucherId: z.coerce.number().int().positive(), method: z.enum(["Auto", "Manual", "Approval"]).optional() });
export const AdjustSchema = z.object({ voucherId: z.coerce.number().int().positive(), adjType: z.enum(["Adjust", "Transfer"]).optional(), amount: z.coerce.number(), reason: z.string().trim().max(400).optional(), toVoucherNo: z.string().trim().optional() });
export const RedeemSchema = z.object({
  voucherNo: z.string().trim().min(1, "Enter the voucher number."),
  amount: z.coerce.number().positive(),
  customerId: z.coerce.number().int().positive().optional(),
  saleId: z.coerce.number().int().positive().optional(),
  invoiceNo: z.string().trim().max(40).optional(),
  post: z.boolean().optional(),
});
export type RedeemInput = z.infer<typeof RedeemSchema>;
export const ValidateSchema = z.object({ voucherNo: z.string().trim().min(1), customerId: z.coerce.number().int().positive().optional() });
export const CloseSchema = z.object({ voucherId: z.coerce.number().int().positive(), reason: z.string().trim().max(40).optional(), note: z.string().trim().max(400).optional() });
export const ReissueSchema = z.object({ voucherId: z.coerce.number().int().positive(), reason: z.string().trim().max(40).optional() });
export const ExtendSchema = z.object({ voucherId: z.coerce.number().int().positive(), expiryDate: z.string().trim().min(1) });

// ------------------------------------------------------------ DTOs
export interface VoucherRow {
  id: number; voucherNo: string; voucherType: string; faceValue: number; availableBalance: number; redeemedValue: number;
  status: string; customerName: string; issueDate: string; expiryDate: string; batchNo: string;
}
export interface ValidateResult {
  valid: boolean; reason: string; voucherId: number | null; voucherNo: string; availableBalance: number; faceValue: number; status: string; customerName: string; expiryDate: string;
}
export interface VoucherDetail extends VoucherRow {
  originalValue: number; securityCode: string; qrData: string;
  redemptions: { redemptionNo: string; date: string; amount: number; balanceAfter: number; invoiceNo: string }[];
  ledger: { txnType: string; direction: string; amount: number; balanceAfter: number; refNo: string; date: string }[];
  history: { fromStatus: string; toStatus: string; action: string; byName: string; note: string; at: string }[];
}

export interface GvDashboard {
  generated: number; sold: number; active: number; expired: number; redeemed: number; closed: number;
  outstandingLiability: number; salesValue: number; redemptionValue: number;
  topCustomers: { name: string; value: number }[]; topBranches: { name: string; value: number }[]; topTypes: { name: string; value: number }[]; monthly: { name: string; value: number }[];
}

export const REPORT_TYPES = ["register", "sale", "activation", "redemption", "balance", "expiry", "liability", "outstanding", "closure", "customer", "branch", "corporate"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export const REPORT_LABELS: Record<ReportType, string> = {
  register: "Voucher Register", sale: "Voucher Sale Report", activation: "Voucher Activation Report", redemption: "Voucher Redemption Report",
  balance: "Voucher Balance Report", expiry: "Voucher Expiry Report", liability: "Voucher Liability Report", outstanding: "Outstanding Voucher Report",
  closure: "Voucher Closure Report", customer: "Customer Voucher Report", branch: "Branch Voucher Report", corporate: "Corporate Voucher Report",
};
export interface ReportResult { title: string; columns: string[]; rows: (string | number)[][] }
export interface AccountRef { code: string; name: string; type: string }
export interface AuditRow { id: number; entityType: string; entityId: number | null; action: string; byName: string; note: string; at: string }
