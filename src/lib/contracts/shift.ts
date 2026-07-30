import { z } from "zod";

/**
 * Shared contract for the POS Shift registry (Module A).
 *
 * Timing + cash rules are typed columns; the operational toggles and auto-actions
 * live in the `config` JSON blob (typed here as `ShiftConfig` for the client,
 * validated loosely server-side).
 */

export type ShiftStatus = "active" | "inactive";

/* -------------------------------------------------- config blob shape */
export interface ShiftOperational {
  allowSales?: boolean; allowReturn?: boolean; allowHold?: boolean; allowResume?: boolean; allowB2b?: boolean;
  allowB2c?: boolean; allowPettyCash?: boolean; allowDeposit?: boolean; allowWithdrawal?: boolean;
}
export interface ShiftAuto { autoLogout?: boolean; autoClose?: boolean; autoPrintSummary?: boolean }
export interface ShiftConfig {
  operational?: ShiftOperational;
  auto?: ShiftAuto;
}

/* --------------------------------------------------------- responses */
export interface ShiftRow {
  id: number;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  crossDay: boolean;
  status: ShiftStatus;
  createdAt: string;
}
export interface ShiftListStats { total: number; active: number; inactive: number }
export interface ShiftListResponse { ok: true; rows: ShiftRow[]; stats: ShiftListStats }

export interface ShiftDetail {
  id: number;
  code: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  crossDay: boolean;
  gracePeriodMins: number | null;
  openingCashMandatory: boolean;
  closingCashMandatory: boolean;
  physicalCountRequired: boolean;
  managerApprovalRequired: boolean;
  maxCashDifference: number | null;
  status: ShiftStatus;
  config: ShiftConfig;
  createdAt: string;
}

/* ---------------------------------------------------------- requests */
export const ShiftCreateSchema = z.object({
  code: z.string().trim().min(1, "Shift code is required."),
  name: z.string().trim().min(1, "Shift name is required."),
  description: z.string().trim().optional(),
  startTime: z.string().trim().optional(),
  endTime: z.string().trim().optional(),
  crossDay: z.boolean().optional(),
  gracePeriodMins: z.coerce.number().int().optional(),
  openingCashMandatory: z.boolean().optional(),
  closingCashMandatory: z.boolean().optional(),
  physicalCountRequired: z.boolean().optional(),
  managerApprovalRequired: z.boolean().optional(),
  maxCashDifference: z.coerce.number().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  config: z.record(z.string(), z.any()).optional(),
});
export type ShiftCreateInput = z.infer<typeof ShiftCreateSchema>;

export const ShiftUpdateSchema = ShiftCreateSchema.partial();
export type ShiftUpdateInput = z.infer<typeof ShiftUpdateSchema>;

export const ShiftStatusSchema = z.object({ status: z.enum(["active", "inactive"]) });
