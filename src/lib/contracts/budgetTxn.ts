import { z } from "zod";

/**
 * Budget Revision & Budget Transfer — separate transactions that never modify the
 * original Budget Planning record. Only APPROVED transactions change the effective
 * (current) budget. Full history + approval + audit are preserved.
 */

export const TXN_STATUSES = ["Pending", "Approved", "Rejected"] as const;
export type TxnStatus = (typeof TXN_STATUSES)[number];

export interface Attachment { fileName: string; fileUrl: string; fileType?: string | null; size?: number }

/* ------------------------------------------------------------- revision -- */

export interface RevisionRow {
  id: number; revisionNo: string; revisionDate: string; fy: string;
  scope: "company" | "branch"; branchName: string | null;
  headName: string; revisionType: "increase" | "decrease";
  originalBudget: number; previousBudget: number; amount: number; revisedBudget: number;
  status: TxnStatus; requestedByName: string | null; approvedByName: string | null; remarks: string | null;
}

export interface RevisionDetail extends RevisionRow {
  headerId: number; headId: number; committedSnapshot: number; actualSnapshot: number;
  reason: string | null; effectiveDate: string | null; attachments: Attachment[];
  rejectReason: string | null; approvedAt: string | null; createdAt: string;
}

export const RevisionCreateSchema = z.object({
  headerId: z.coerce.number().int(),
  headId: z.coerce.number().int(),
  revisionType: z.enum(["increase", "decrease"]),
  amount: z.coerce.number().positive("Enter a revision amount."),
  revisionDate: z.string().min(8),
  effectiveDate: z.string().nullish(),
  reason: z.string().max(1000).nullish(),
  remarks: z.string().max(1000).nullish(),
  attachments: z.array(z.object({ fileName: z.string(), fileUrl: z.string(), fileType: z.string().nullish(), size: z.number().nullish() })).optional(),
});
export type RevisionCreateInput = z.infer<typeof RevisionCreateSchema>;

/* ------------------------------------------------------------- transfer -- */

export interface TransferRow {
  id: number; transferNo: string; transferDate: string; fy: string;
  scope: "company" | "branch"; branchName: string | null;
  fromHeadName: string; toHeadName: string; amount: number;
  status: TxnStatus; requestedByName: string | null; approvedByName: string | null; remarks: string | null;
}

export interface TransferDetail extends TransferRow {
  headerId: number; fromHeadId: number; toHeadId: number;
  fromPrevBudget: number; fromNewBudget: number; toPrevBudget: number; toNewBudget: number;
  reason: string | null; effectiveDate: string | null; attachments: Attachment[];
  rejectReason: string | null; approvedAt: string | null; createdAt: string;
}

export const TransferCreateSchema = z.object({
  headerId: z.coerce.number().int(),
  fromHeadId: z.coerce.number().int(),
  toHeadId: z.coerce.number().int(),
  amount: z.coerce.number().positive("Enter a transfer amount."),
  transferDate: z.string().min(8),
  effectiveDate: z.string().nullish(),
  reason: z.string().max(1000).nullish(),
  remarks: z.string().max(1000).nullish(),
  attachments: z.array(z.object({ fileName: z.string(), fileUrl: z.string(), fileType: z.string().nullish(), size: z.number().nullish() })).optional(),
});
export type TransferCreateInput = z.infer<typeof TransferCreateSchema>;

export const ApproveSchema = z.object({ action: z.enum(["approve", "reject"]), rejectReason: z.string().max(300).nullish() });

/* --------------------------------------------------------- timeline/log -- */

export interface BudgetLogEntry {
  date: string; type: "Budget Planning" | "Revision (Increase)" | "Revision (Decrease)" | "Transfer In" | "Transfer Out";
  refNo: string; headName: string; previousBudget: number; amount: number; currentBudget: number;
  createdByName: string | null; approvedByName: string | null; status: TxnStatus | "—"; remarks: string | null;
}
