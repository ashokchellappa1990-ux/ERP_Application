import { z } from "zod";

/**
 * Stock Transfer Request — shared contracts. Records an internal stock movement request between
 * branches (source document for Stock Transfer Dispatch). NO inventory / accounting posting.
 */

export const TRANSFER_TYPES = ["Internal Transfer", "Branch Transfer", "Warehouse Transfer", "Replenishment", "Return Transfer"] as const;
export const PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

export const STR_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Partially Dispatched", "Fully Dispatched", "Cancelled"] as const;
export type StrStatus = (typeof STR_STATUSES)[number];
/** Allowed next status per action. Dispatch transitions come from the Dispatch module, not here. */
export const STR_NEXT: Record<StrStatus, Partial<Record<string, StrStatus>>> = {
  Draft: { submit: "Submitted", cancel: "Cancelled" },
  Submitted: { approve: "Approved", reject: "Rejected", cancel: "Cancelled" },
  Approved: { cancel: "Cancelled" },
  Rejected: { reopen: "Draft", cancel: "Cancelled" },
  "Partially Dispatched": {},
  "Fully Dispatched": {},
  Cancelled: {},
};
export const isEditable = (s: string) => s === "Draft" || s === "Rejected";
export const isDispatchStarted = (s: string) => s === "Partially Dispatched" || s === "Fully Dispatched";

export const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "danger" | "warning" | "primary"> = {
  Draft: "neutral", Submitted: "info", Approved: "success", Rejected: "danger", "Partially Dispatched": "warning", "Fully Dispatched": "primary", Cancelled: "neutral",
  Pending: "warning", NotRequired: "neutral",
};

/* --------------------------------------------------------------- schemas */
export const strLineInput = z.object({
  productId: z.coerce.number().int(),
  productName: z.string().min(1),
  sku: z.string().nullable().optional(),
  uom: z.string().nullable().optional(),
  availableSource: z.coerce.number().default(0),
  availableDest: z.coerce.number().default(0),
  requestedQty: z.coerce.number(),
  minStockQty: z.coerce.number().nullable().optional(),
  maxStockQty: z.coerce.number().nullable().optional(),
  remarks: z.string().nullable().optional(),
});
export const stockTransferInput = z.object({
  transferType: z.string().optional(),
  sourceBranchId: z.coerce.number().int(),
  sourceWarehouse: z.string().nullable().optional(),
  destinationBranchId: z.coerce.number().int(),
  destinationWarehouse: z.string().nullable().optional(),
  priority: z.string().default("Normal"),
  requestDate: z.string().optional(),
  requiredDate: z.string().nullable().optional(),
  expectedDeliveryDate: z.string().nullable().optional(),
  referenceDoc: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  lines: z.array(strLineInput).min(1),
});
export type StockTransferInput = z.infer<typeof stockTransferInput>;
export const strActionInput = z.object({ action: z.enum(["submit", "approve", "reject", "reopen", "cancel"]), remarks: z.string().optional() });

/** Header-level validation shared by client & server (business-match & entity-type are server-side). */
export function validateHeader(input: { sourceBranchId: number; destinationBranchId: number; lines: { requestedQty: number }[] }): string | null {
  if (!input.sourceBranchId || !input.destinationBranchId) return "Source and Destination branch are required.";
  if (input.sourceBranchId === input.destinationBranchId) return "Source and Destination cannot be the same.";
  if (!input.lines.length) return "Add at least one item.";
  if (!input.lines.some((l) => Number(l.requestedQty) > 0)) return "Requested Quantity must be greater than zero.";
  return null;
}
