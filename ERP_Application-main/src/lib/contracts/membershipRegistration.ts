import { z } from "zod";

/** Membership Registration (CRM) — contracts. Reuses Membership Configuration. */

export const REG_STATUS = ["Draft", "Submitted", "PendingApproval", "Approved", "Active", "Suspended", "Expired", "Cancelled"] as const;
export const FEE_PAYMENT_MODES = ["Cash", "UPI", "Card", "Cheque", "Bank", "Wallet"] as const;
export const DOC_TYPES = ["Application", "Card", "Receipt", "Agreement", "Certificate"] as const;

// ---- register (create) ----
export const RegisterSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  levelId: z.coerce.number().int().positive(),
  registrationDate: z.string().trim().optional(),
  collectFee: z.boolean().optional(),
  paymentMode: z.enum(FEE_PAYMENT_MODES).optional(),
  paymentRef: z.string().trim().max(80).optional(),
  discountAmount: z.coerce.number().nonnegative().optional(),
  remarks: z.string().trim().max(500).optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const ApproveSchema = z.object({ registrationId: z.coerce.number().int().positive(), approve: z.boolean(), note: z.string().trim().max(400).optional() });
export const ActivateSchema = z.object({ registrationId: z.coerce.number().int().positive() });
export const CancelSchema = z.object({ registrationId: z.coerce.number().int().positive(), reason: z.string().trim().max(400).optional() });

// ---- plan (level + fee + validity + benefit summary, read from config) ----
export interface PlanRow {
  levelId: number; code: string; name: string; description: string; themeColor: string; status: string;
  registrationFee: number; gstApplicable: boolean; gstPercentage: number; currency: string;
  validityType: string; validityDays: number;
  billDiscountPct: number; pointMultiplier: number; welcomePoints: number;
  serviceBenefits: string[]; // enabled service benefit labels
}

// ---- qualification ----
export interface QualificationCheck { method: string; required: string; actual: string; passed: boolean }
export interface QualificationResult { status: "Qualified" | "NotQualified" | "ApprovalRequired"; approvalRequired: boolean; checks: QualificationCheck[]; combineLogic: string }

// ---- list + detail ----
export interface RegistrationRow {
  id: number; registrationNo: string; membershipNumber: string; customerId: number; customerName: string; customerPhone: string;
  levelName: string; membershipType: string; status: string; registrationDate: string; activationDate: string; expiryDate: string;
  netAmount: number; qualified: boolean; registeredByName: string;
}
export interface RegistrationDetail extends RegistrationRow {
  levelId: number; feeAmount: number; gstAmount: number; discountAmount: number; paymentMode: string; paymentRef: string; approvalRequired: boolean; qualificationNote: string;
  card: { cardNumber: string; membershipNumber: string; qrData: string; barcodeData: string; issueDate: string; expiryDate: string } | null;
  receipt: { receiptNo: string; receiptDate: string; netAmount: number; paymentMode: string; journalRef: string } | null;
  history: { fromStatus: string; toStatus: string; action: string; byName: string; note: string; at: string }[];
}

// ---- dashboard ----
export interface RegDashboard {
  totalMembers: number; newToday: number; activeMembers: number; expiredMembers: number; pendingApproval: number;
  revenue: number; byLevel: { name: string; value: number }[]; byBranch: { name: string; value: number }[]; monthly: { name: string; value: number }[];
}

// ---- reports ----
export const REG_REPORT_TYPES = ["register", "new", "fee", "expiry", "status", "level", "branch", "customer"] as const;
export type RegReportType = (typeof REG_REPORT_TYPES)[number];
export const REG_REPORT_LABELS: Record<RegReportType, string> = {
  register: "Membership Register", new: "New Membership Report", fee: "Membership Fee Report", expiry: "Membership Expiry Report",
  status: "Membership Status Report", level: "Membership Level Report", branch: "Branch-wise Membership Report", customer: "Customer Membership Report",
};
export interface ReportResult { title: string; columns: string[]; rows: (string | number)[][] }
