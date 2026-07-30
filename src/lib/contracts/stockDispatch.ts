import { z } from "zod";

/**
 * Stock Transfer Dispatch — shared contracts. Physically moves inventory between
 * branches: reduces the dispatching branch's stock, creates in-transit stock at the
 * receiving branch, writes the stock ledger and posts ONLY internal-movement
 * accounting (Inventory In-Transit Dr / Inventory Cr). No sales / GST / party ledger.
 */

export const DISPATCH_TYPES = ["Transfer Request Based", "Direct Dispatch", "Packing Slip Based"] as const;
export type DispatchType = (typeof DISPATCH_TYPES)[number];
export const PACKING_SLIP_ENABLED = false; // Mode 3 — enable after Packing module

export const PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

export const DISPATCH_STATUSES = ["Draft", "Dispatched", "Partially Dispatched", "Cancelled"] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

export const DISPATCH_STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger" | "primary"> = {
  Draft: "neutral", Dispatched: "success", "Partially Dispatched": "warning", Cancelled: "neutral",
  Received: "primary", "Partially Received": "info",
  Pending: "warning", NotRequired: "neutral", Approved: "success", Rejected: "danger",
};

/** A dispatch is editable only in Draft; once posted it is immutable. */
export const isDispatchEditable = (s: string) => s === "Draft";

/* --------------------------------------------------------------- schemas */
export const dispatchItemInput = z.object({
  productId: z.coerce.number().int(),
  productName: z.string().min(1),
  sku: z.string().nullable().optional(),
  uom: z.string().nullable().optional(),
  batchNo: z.string().nullable().optional(),
  mfgDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  serials: z.array(z.string()).optional(),
  availableQty: z.coerce.number().default(0),
  requestedQty: z.coerce.number().default(0),
  allocatedQty: z.coerce.number().default(0),
  pickedQty: z.coerce.number().default(0),
  dispatchQty: z.coerce.number().default(0),
  unitCost: z.coerce.number().default(0),
  remarks: z.string().nullable().optional(),
});
export const dispatchInput = z.object({
  dispatchType: z.enum(["Transfer Request Based", "Direct Dispatch"]), // Packing Slip disabled
  dispatchDate: z.string().optional(),
  referenceId: z.coerce.number().int().nullable().optional(), // transfer request id (Mode 1)
  destinationBranchId: z.coerce.number().int(),
  destinationWarehouse: z.string().nullable().optional(),
  sourceWarehouse: z.string().nullable().optional(),
  vehicleNo: z.string().nullable().optional(),
  driverName: z.string().nullable().optional(),
  transportName: z.string().nullable().optional(),
  lrNumber: z.string().nullable().optional(),
  expectedDeliveryDate: z.string().nullable().optional(),
  priority: z.string().default("Normal"),
  remarks: z.string().nullable().optional(),
  items: z.array(dispatchItemInput).min(1),
});
export type DispatchInput = z.infer<typeof dispatchInput>;

export const dispatchActionInput = z.object({ action: z.enum(["dispatch", "cancel", "challan"]), remarks: z.string().optional() });
export type DispatchActionInput = z.infer<typeof dispatchActionInput>;

/** Header validation shared by client & server. */
export function validateDispatchHeader(input: { destinationBranchId: number; items: { dispatchQty: number }[] }): string | null {
  if (!input.destinationBranchId) return "Destination branch is required.";
  if (!input.items.length) return "Add at least one item.";
  if (!input.items.some((l) => Number(l.dispatchQty) > 0)) return "Dispatch quantity must be greater than zero for at least one item.";
  return null;
}
