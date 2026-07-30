import { z } from "zod";

/** Shared contract for EOD Phase 3 — Terminal Fund Transfer, Safe Locker, Bank Deposit. */

/* ----------------------------------------------- Terminal Fund Transfer */
export const FundTransferSchema = z
  .object({
    fromTerminalId: z.coerce.number().int().positive(),
    toTerminalId: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive(),
    shiftId: z.coerce.number().int().positive().optional(),
    reason: z.string().trim().optional(),
  })
  .refine((d) => d.fromTerminalId !== d.toTerminalId, {
    message: "From and To terminals must be different.",
    path: ["toTerminalId"],
  });
export type FundTransferInput = z.infer<typeof FundTransferSchema>;

export type FundTransferStatus = "Requested" | "Acknowledged" | "Completed";

export interface FundTransferRow {
  id: number;
  transferNo: string;
  fromTerminalId: number;
  fromTerminalCode: string;
  fromTerminalName: string;
  toTerminalId: number;
  toTerminalCode: string;
  toTerminalName: string;
  shiftId: number | null;
  amount: number;
  reason: string;
  transferredBy: number;
  transferredByName: string;
  receivedBy: number | null;
  receivedByName: string;
  acknowledgedAt: string | null;
  status: FundTransferStatus;
  createdAt: string;
}
export interface FundTransferListResponse { ok: true; rows: FundTransferRow[] }

/* ----------------------------------------------------- Safe Locker */
export const SafeTxnSchema = z.object({
  direction: z.enum(["IN_FROM_TERMINAL", "OUT_TO_TERMINAL"]),
  terminalId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  reason: z.string().trim().optional(),
});
export type SafeTxnInput = z.infer<typeof SafeTxnSchema>;

export type SafeTxnDirection = "IN_FROM_TERMINAL" | "OUT_TO_TERMINAL" | "OUT_TO_BANK";

export interface SafeTxnRow {
  id: number;
  txnNo: string;
  direction: SafeTxnDirection;
  terminalId: number | null;
  terminalCode: string;
  terminalName: string;
  amount: number;
  reason: string;
  refType: string | null;
  refId: number | null;
  status: string;
  createdAt: string;
}
export interface SafeLockerResponse { ok: true; balance: number; rows: SafeTxnRow[] }

/* ----------------------------------------------------- Bank Deposit */
export const BankDepositSchema = z.object({
  bankName: z.string().trim().min(1, "Bank name is required."),
  bankAccount: z.string().trim().optional(),
  depositSlip: z.string().trim().optional(),
  amount: z.coerce.number().positive(),
  remarks: z.string().trim().optional(),
});
export type BankDepositInput = z.infer<typeof BankDepositSchema>;

export interface BankDepositRow {
  id: number;
  depositNo: string;
  bankName: string;
  bankAccount: string;
  depositSlip: string;
  amount: number;
  depositDate: string;
  depositAt: string;
  depositBy: number;
  depositByName: string;
  remarks: string;
  status: string;
}
export interface BankDepositListResponse { ok: true; rows: BankDepositRow[] }

/* ===================== Unified cash transfer (consolidated screen) ========= */
// One screen handling all cash movements as a Transfer Type + multiple line items.
export const TRANSFER_TYPES = ["BANK_TO_SAFE", "SAFE_TO_TERMINAL", "TERMINAL_TO_TERMINAL", "TERMINAL_TO_SAFE", "SAFE_TO_BANK"] as const;
export type TransferType = (typeof TRANSFER_TYPES)[number];
export const TRANSFER_TYPE_LABELS: Record<TransferType, string> = {
  BANK_TO_SAFE: "Bank Withdrawal to Safe",
  SAFE_TO_TERMINAL: "Safe to Terminal",
  TERMINAL_TO_TERMINAL: "Terminal to Terminal",
  TERMINAL_TO_SAFE: "Terminal to Safe",
  SAFE_TO_BANK: "Safe to Bank Deposit",
};

export const TransferLineSchema = z.object({
  amount: z.coerce.number().positive(),
  terminalId: z.coerce.number().int().positive().optional(),   // from-terminal (or single terminal)
  toTerminalId: z.coerce.number().int().positive().optional(), // terminal→terminal target
  bankId: z.coerce.number().int().positive().optional(),
  bankName: z.string().trim().optional(),
  reason: z.string().trim().optional(),
});
export const TransferSubmitSchema = z.object({
  transferType: z.enum(TRANSFER_TYPES),
  lines: z.array(TransferLineSchema).min(1, "Add at least one line item."),
});
export type TransferSubmitInput = z.infer<typeof TransferSubmitSchema>;

export interface BankOption { id: number; bankName: string; account: string }
export interface BankListResponse { ok: true; banks: BankOption[] }

// A normalised recent cash-movement row (across fund-transfer / safe / bank-deposit).
export interface MovementRow { id: string; kind: TransferType | "OTHER"; label: string; amount: number; detail: string; at: string }
export interface TransferScreenResponse { ok: true; safeBalance: number; movements: MovementRow[] }
