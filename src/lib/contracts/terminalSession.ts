import { z } from "zod";

/** Shared contract for Terminal Sessions (Module 4): a cashier's working session
 *  on a terminal with opening / closing cash reconciliation. */

export type SessionStatus = "Open" | "Closed";

export interface SessionRow {
  id: number;
  sessionNo: string;
  terminalId: number;
  terminalCode: string;
  terminalName: string;
  shiftId: number | null;
  shiftName: string;
  cashierUserId: number;
  cashierName: string;
  loginAt: string;
  logoutAt: string | null;
  openingCash: number | null;
  closingCash: number | null;
  cashDifference: number | null;
  status: SessionStatus;
}
export interface SessionListStats { open: number; today: number }
export interface SessionListResponse { ok: true; rows: SessionRow[]; stats: SessionListStats }

export interface SessionDetail extends SessionRow {
  expectedCash: number | null;
  cashSales: number; // cash collected on sales stamped to this session
  openingNote: string;
  closingNote: string;
  createdAt: string;
}

export const SessionOpenSchema = z.object({
  terminalId: z.coerce.number().int().positive(),
  shiftId: z.coerce.number().int().positive().optional(),
  openingCash: z.coerce.number().nonnegative().optional(),
  openingNote: z.string().trim().optional(),
});
export type SessionOpenInput = z.infer<typeof SessionOpenSchema>;

export const SessionCloseSchema = z.object({
  closingCash: z.coerce.number().nonnegative().optional(),
  closingNote: z.string().trim().optional(),
  approve: z.boolean().optional(), // manager override when difference exceeds the limit
});
export type SessionCloseInput = z.infer<typeof SessionCloseSchema>;
