import { z } from "zod";

/** Statutory Compliance & Government Payment — shared contracts. */

export const PAYMENT_STATUSES = ["Draft", "Submitted", "Approved", "Paid", "Cancelled"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const RETURN_STATUSES = ["Pending", "Prepared", "Filed"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export interface StatutoryPaymentRow {
  id: number; paymentNo: string; paymentDate: string; statutoryType: string; financialYear: string; taxPeriod: string;
  liabilityAmount: number; paidAmount: number; interest: number; penalty: number; totalPayable: number;
  status: PaymentStatus; referenceNo: string | null; challanNo: string | null; challanStatus: string;
  paymentMode: string | null; approvedByName: string | null;
}

export interface StatutoryPaymentDto extends StatutoryPaymentRow {
  businessId: number | null; branchId: number | null; alreadyPaid: number; balanceAmount: number;
  breakupJson: string | null; bankAccount: string | null; transactionNo: string | null; remarks: string | null;
  cpin: string | null; cin: string | null; bsrCode: string | null; challanBank: string | null; govRef: string | null; ackNo: string | null;
  attachments: { fileName: string; fileUrl: string; fileType?: string | null; size?: number }[];
  journalId: number | null; submittedAt: string | null; approvedAt: string | null; cancelledAt: string | null; cancelReason: string | null;
  createdBy: number | null; createdAt: string;
}

export interface StatutoryReturnRow {
  id: number; statutoryType: string; returnType: string; financialYear: string; taxPeriod: string;
  liabilityAmount: number; status: ReturnStatus; filedDate: string | null; ackNo: string | null; remarks: string | null;
}

/* ------------------------------------------------------------------ payloads */

const attachment = z.object({ fileName: z.string(), fileUrl: z.string(), fileType: z.string().nullable().optional(), size: z.coerce.number().optional() });

export const StatutoryPaymentCreateSchema = z.object({
  statutoryType: z.string().min(1, "Select a statutory type."),
  taxPeriod: z.string().regex(/^\d{4}-\d{2}$/, "Select a tax period."),
  paymentDate: z.string().optional(),
  liabilityAmount: z.coerce.number().min(0).default(0),
  alreadyPaid: z.coerce.number().min(0).default(0),
  paidAmount: z.coerce.number().min(0, "Enter the amount to pay."),
  interest: z.coerce.number().min(0).default(0),
  penalty: z.coerce.number().min(0).default(0),
  breakupJson: z.string().nullish(),
  paymentMode: z.string().optional(),
  bankAccount: z.string().optional(),
  referenceNo: z.string().optional(),
  transactionNo: z.string().optional(),
  remarks: z.string().max(500).optional(),
  // Challan (optional at creation, can be added later).
  challanNo: z.string().optional(), cpin: z.string().optional(), cin: z.string().optional(), bsrCode: z.string().optional(),
  challanBank: z.string().optional(), govRef: z.string().optional(), ackNo: z.string().optional(),
  attachments: z.array(attachment).optional(),
});
export type StatutoryPaymentCreateInput = z.infer<typeof StatutoryPaymentCreateSchema>;

export const ChallanSaveSchema = z.object({
  paymentId: z.coerce.number().int(),
  challanNo: z.string().optional(), cpin: z.string().optional(), cin: z.string().optional(), bsrCode: z.string().optional(),
  challanBank: z.string().optional(), govRef: z.string().optional(), ackNo: z.string().optional(),
  attachments: z.array(attachment).optional(),
});

export const ReturnSaveSchema = z.object({
  statutoryType: z.string().min(1),
  returnType: z.string().min(1),
  taxPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  liabilityAmount: z.coerce.number().min(0).default(0),
  ackNo: z.string().optional(),
  filedDate: z.string().optional(),
  remarks: z.string().max(500).optional(),
});

export const StatutoryActionSchema = z.object({
  op: z.enum(["submit", "approve", "cancel", "markPaid", "verifyChallan"]),
  id: z.coerce.number().int(),
  reason: z.string().optional(),
});
