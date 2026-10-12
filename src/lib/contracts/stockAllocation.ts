import { z } from "zod";

/**
 * Stock Allocation — shared contracts. Reserves inventory against an approved Stock
 * Transfer Request before dispatch. Reservation only — NO physical stock reduction,
 * NO stock-ledger, NO accounting. Allocation follows the product master policy
 * (FIFO / FEFO / Serial / Batch) or plain quantity when no policy applies.
 */

export const ALLOC_STATUSES = ["Draft", "Allocated", "Partially Allocated", "Released", "Cancelled"] as const;
export type AllocStatus = (typeof ALLOC_STATUSES)[number];

export const ALLOC_STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger" | "primary"> = {
  Draft: "neutral", Allocated: "success", "Partially Allocated": "warning", Released: "info", Cancelled: "neutral",
  Pending: "warning", NotRequired: "neutral", Approved: "success", Rejected: "danger",
};
export const LINE_STATUS_TONE: Record<string, "neutral" | "warning" | "success"> = { Pending: "neutral", Partial: "warning", Allocated: "success" };

/** Product allocation policy resolved from the product master. */
export type AllocPolicy = "Qty" | "FIFO" | "FEFO" | "Batch" | "Serial" | "Manual";

/** A Draft allocation (or one that is Partially Allocated) can still be worked on. */
export const isAllocationEditable = (s: string) => s === "Draft" || s === "Partially Allocated";
export const isAllocationClosed = (s: string) => s === "Released" || s === "Cancelled";

/* --------------------------------------------------------------- schemas */
// Per-line allocation instruction. `allocatedQty` is the qty to reserve; for a
// Serial product `serials` lists the chosen serial numbers (length must equal qty).
export const allocateLineInput = z.object({
  lineId: z.coerce.number().int(),
  allocatedQty: z.coerce.number().min(0),
  serials: z.array(z.string()).optional(),
  remarks: z.string().nullable().optional(),
});
export const allocateInput = z.object({
  all: z.boolean().optional(),           // Allocate All → fill every line to min(requested, available)
  lines: z.array(allocateLineInput).optional(),
});
export type AllocateInput = z.infer<typeof allocateInput>;

export const saveDraftInput = z.object({
  remarks: z.string().nullable().optional(),
  lines: z.array(z.object({ lineId: z.coerce.number().int(), allocatedQty: z.coerce.number().min(0), remarks: z.string().nullable().optional() })).optional(),
});
export type SaveDraftInput = z.infer<typeof saveDraftInput>;

export const allocActionInput = z.object({ action: z.enum(["release", "reallocate", "cancel"]), remarks: z.string().optional() });
export type AllocActionInput = z.infer<typeof allocActionInput>;
