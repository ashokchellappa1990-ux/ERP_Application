import { z } from "zod";
import type { LiveSummary } from "@/lib/contracts/eod";

/** Shared contract for Day Closing (EOD Phase 4) — business-day consolidated close. */

const today = () => new Date().toISOString().slice(0, 10);

/* --------------------------------------------------------- Close request */
export const DayCloseSchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
    .optional()
    .default(today),
  remarks: z.string().trim().max(300).optional(),
  /** Proceed even if open shifts/day-openings remain for the branch+date. */
  force: z.boolean().optional(),
});
export type DayCloseInput = z.infer<typeof DayCloseSchema>;

/* ------------------------------------------------------------- List rows */
export interface DayClosingRow {
  id: number;
  dayClosingNo: string;
  closingDate: string;
  closedAt: string;
  status: string;
  remarks: string;
  createdBy: number | null;
}
export interface DayClosingListResponse {
  ok: true;
  rows: DayClosingRow[];
  /** Whether the active branch already has a closing for the requested date. */
  closedToday: boolean;
  /** The live (or snapshot) summary for the requested date, branch level. */
  summary: LiveSummary | null;
  date: string;
}

/* ------------------------------------------------------- Snapshot result */
export interface DaySummaryResponse {
  ok: true;
  summary: LiveSummary;
  closing: { id: number; dayClosingNo: string; closingDate: string } | null;
}
