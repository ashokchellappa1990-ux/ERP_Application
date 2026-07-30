import { z } from "zod";

/**
 * Shared contract for the Terminal-Shift mapping (Module B).
 *
 * A mapping authorises a Shift on a POS Terminal for an optional effective window.
 * The list view joins terminal + shift so the client can show codes/names without
 * extra lookups.
 */

export type TerminalShiftStatus = "active" | "inactive";

/* --------------------------------------------------------- responses */
export interface TerminalShiftRow {
  id: number;
  terminalId: number;
  terminalCode: string;
  terminalName: string;
  shiftId: number;
  shiftCode: string;
  shiftName: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: TerminalShiftStatus;
  createdAt: string;
}
export interface TerminalShiftListResponse { ok: true; rows: TerminalShiftRow[] }

/* ---------------------------------------------------------- requests */
export const MappingCreateSchema = z.object({
  terminalId: z.coerce.number().int().positive(),
  shiftId: z.coerce.number().int().positive(),
  effectiveFrom: z.string().trim().optional(),
  effectiveTo: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export type MappingCreateInput = z.infer<typeof MappingCreateSchema>;

export const MappingStatusSchema = z.object({ status: z.enum(["active", "inactive"]) });
