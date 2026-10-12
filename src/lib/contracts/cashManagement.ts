import { z } from "zod";

/**
 * Finance Cash Management contracts — Fund Transfer (Cash <-> Bank) and
 * Miscellaneous Receipt (non-sales income into cash/bank). Each posts a GL voucher.
 */

export const FUND_TRANSFER_TYPES = ["CASH_TO_BANK", "BANK_TO_CASH"] as const;
export type FundTransferType = (typeof FUND_TRANSFER_TYPES)[number];
export const FUND_TRANSFER_LABELS: Record<FundTransferType, string> = {
  CASH_TO_BANK: "Cash to Bank (deposit)",
  BANK_TO_CASH: "Bank to Cash (withdrawal)",
};

export const RECEIVED_IN = ["Cash", "Bank"] as const;
export const RECEIPT_MODES = ["Cash", "Cheque", "UPI", "Card", "Bank Transfer"] as const;

export const FundTransferSchema = z.object({
  kind: z.literal("FUND_TRANSFER"),
  date: z.string().trim().optional(),
  transferType: z.enum(FUND_TRANSFER_TYPES),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  bankId: z.coerce.number().int().positive().optional(),
  bankName: z.string().trim().optional(),
  bankAccount: z.string().trim().optional(),
  reference: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(300).optional(),
});
export type FundTransferInput = z.infer<typeof FundTransferSchema>;

export const MiscReceiptSchema = z.object({
  kind: z.literal("MISC_RECEIPT"),
  date: z.string().trim().optional(),
  receivedIn: z.enum(RECEIVED_IN),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  payer: z.string().trim().min(1, "Received from is required."),
  incomeHead: z.string().trim().max(120).optional(),
  mode: z.string().trim().max(20).optional(),
  bankId: z.coerce.number().int().positive().optional(),
  bankName: z.string().trim().optional(),
  bankAccount: z.string().trim().optional(),
  reference: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(300).optional(),
});
export type MiscReceiptInput = z.infer<typeof MiscReceiptSchema>;

export const CashEntryCreateSchema = z.discriminatedUnion("kind", [FundTransferSchema, MiscReceiptSchema]);
export type CashEntryCreateInput = z.infer<typeof CashEntryCreateSchema>;

export interface BankRef { id: number; bankName: string; account: string }

export interface CashEntryRow {
  id: number;
  kind: "FUND_TRANSFER" | "MISC_RECEIPT";
  docNo: string;
  date: string;
  particulars: string;   // human label (transfer route or payer)
  account: string;       // cash/bank involved
  amount: number;
  mode: string;
  status: string;
  createdByName: string;
}

export interface CashEntryJournalLine { account: string; code: string; debit: number; credit: number; narration: string }

export interface CashEntryDetail extends CashEntryRow {
  transferType: string;
  fromAccount: string;
  toAccount: string;
  receivedIn: string;
  payer: string;
  incomeHead: string;
  bankName: string;
  bankAccount: string;
  reference: string;
  remarks: string;
  journalRef: string;
  voucherNo: string;
  journal: CashEntryJournalLine[];
}

export interface CashKpis {
  cashIn: number;        // misc receipts into cash this period
  bankIn: number;        // misc receipts into bank this period
  toBank: number;        // cash deposited to bank
  toCash: number;        // bank withdrawn to cash
  receiptCount: number;
  transferCount: number;
}
