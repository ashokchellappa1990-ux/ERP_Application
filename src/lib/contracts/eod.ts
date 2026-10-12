import { z } from "zod";

/** Shared contract for the Day Opening & Day Closing (EOD) module. Extended per phase. */

/* ----------------------------------------------------------- Day Opening */
export const DayOpenSchema = z.object({
  terminalId: z.coerce.number().int().positive().optional(), // omitted for branch-level day
  shiftId: z.coerce.number().int().positive().optional(),
  openingCash: z.coerce.number().nonnegative().optional(),
  openingPettyCash: z.coerce.number().nonnegative().optional(),
  remarks: z.string().trim().optional(),
});
export type DayOpenInput = z.infer<typeof DayOpenSchema>;

/** Console-level terminal filter options (drives the filter shown across all EOD tabs). */
export interface EodTerminalOption { id: number; code: string; name: string }
export interface EodTerminalOptions {
  ok: true;
  show: boolean;        // false → terminal-based setup off / no terminals → no filter
  restricted: boolean;  // mapped user (no "All" option, locked to their terminals)
  defaultId: number | null; // default selection (a mapped user's terminal, else null = All)
  terminals: EodTerminalOption[];
}

/** Picker metadata for the Day Opening form (drives conditional fields). */
export interface DayTerminalOption { id: number; code: string; name: string; prevClosingCash: number | null }
export interface DayOpenMeta {
  terminalSetupRequired: boolean; // General Settings flag — gates the terminal/shift fields
  terminals: DayTerminalOption[]; // the user's mapped active terminals (empty = unmapped → no terminal field)
  shifts: { id: number; code: string; name: string }[];
}

export type DayOpeningStatus = "Open" | "Closed";

export interface DayOpeningRow {
  id: number;
  dayOpeningNo: string;
  openingDate: string;
  openingAt: string;
  terminalId: number | null;
  terminalCode: string;
  terminalName: string;
  shiftId: number | null;
  cashierUserId: number;
  cashierName: string;
  terminalSessionId: number | null;
  openingCash: number;
  openingBankBalance: number | null;
  openingSafeBalance: number | null;
  openingPettyCash: number | null;
  remarks: string;
  status: DayOpeningStatus;
}
export interface DayOpeningListResponse { ok: true; rows: DayOpeningRow[]; active: DayOpeningRow | null; meta: DayOpenMeta }

/* --------------------------------------------------------- Live Summary */
export interface LiveSummary {
  period: { date: string; level: string; terminalSessionId: number | null };
  sales: { b2cCount: number; b2cTotal: number; b2bCount: number; b2bTotal: number; returnsCount: number; returnsTotal: number; taxTotal: number };
  collection: { byMode: Record<string, number>; total: number };
  finance: { receipt: number; payment: number; contra: number; journal: number; collections: number; supplierPayments: number; pettyCash: number; net: number };
  cash: { opening: number; cashSales: number; cashRefund: number; pettyCash: number; deposits: number; withdrawals: number; safeTransferIn: number; safeTransferOut: number; bankDeposit: number; expected: number };
  bank: { openingBalance: number; deposited: number; withdrawn: number; closing: number; inTransit: number };
  safe: { opening: number; inFromTerminal: number; inFromBank: number; outToTerminal: number; outToBank: number; closing: number };
  inventory: { purchaseCount: number; purchaseValue: number; salesMovements: number; returnMovements: number; adjustments: number; transfers: number };
}
export interface LiveSummaryResponse { ok: true; summary: LiveSummary }
