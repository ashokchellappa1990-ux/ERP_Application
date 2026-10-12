import { z } from "zod";
import type { LiveSummary } from "@/lib/contracts/eod";

/** Shared contract for EOD Phase 2 — Terminal Cash Management, Cash Closing
 *  (declaration) and Shift Closing. Mirrors the eod.ts Zod-request + DTO style. */

/* ------------------------------------------------- Terminal Cash Transaction */
export const CashTxnTypes = ["Deposit", "Withdrawal", "PettyCash", "Adjustment", "Declaration"] as const;
export type CashTxnType = (typeof CashTxnTypes)[number];

export const CashTxnSchema = z.object({
  type: z.enum(CashTxnTypes),
  amount: z.coerce.number().positive(),
  reason: z.string().trim().optional(),
  voucherRef: z.string().trim().optional(),
  terminalId: z.coerce.number().int().positive().optional(),
});
export type CashTxnInput = z.infer<typeof CashTxnSchema>;

export interface CashTxnRow {
  id: number;
  txnNo: string;
  dayOpeningId: number | null;
  terminalId: number;
  terminalSessionId: number | null;
  cashierUserId: number;
  cashierName: string;
  type: CashTxnType;
  amount: number;
  reason: string;
  voucherRef: string;
  approvalStatus: string;
  createdAt: string;
}
export interface CashTxnListResponse { ok: true; rows: CashTxnRow[] }

/* ----------------------------------------------------- Cash Declaration */
export const CashDeclareSchema = z.object({
  physicalCount: z.coerce.number().nonnegative(),
  denominations: z.record(z.string(), z.any()).optional(),
  remarks: z.string().trim().optional(),
});
export type CashDeclareInput = z.infer<typeof CashDeclareSchema>;

export interface CashDeclarationRow {
  id: number;
  dayOpeningId: number;
  terminalId: number;
  terminalSessionId: number | null;
  cashierUserId: number;
  cashierName: string;
  expectedCash: number;
  physicalCount: number;
  excess: number;
  shortage: number;
  difference: number;
  remarks: string;
  approvalStatus: string;
  createdAt: string;
}
export interface CashDeclarationListResponse { ok: true; rows: CashDeclarationRow[] }

/* --------------------------------------------------------- Shift Closing */
export const ShiftCloseSchema = z.object({
  countedCash: z.coerce.number().nonnegative().optional(),
  force: z.boolean().optional(),
});
export type ShiftCloseInput = z.infer<typeof ShiftCloseSchema>;

export interface ShiftClosingRow {
  id: number;
  dayOpeningId: number;
  terminalId: number;
  shiftId: number | null;
  terminalSessionId: number | null;
  cashierUserId: number;
  cashierName: string;
  closedAt: string;
  expectedCash: number;
  countedCash: number;
  difference: number;
  status: string;
  summary: LiveSummary | null;
}
export interface ShiftClosingListResponse { ok: true; rows: ShiftClosingRow[] }
