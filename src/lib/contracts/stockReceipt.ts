import { z } from "zod";

/**
 * Stock Transfer Receipt — shared contracts. The destination branch acknowledges
 * dispatched stock: In-Transit → destination real warehouse (accepted) / Damage or
 * Quarantine (damaged); missing qty stays in-transit. Posts internal accounting only
 * (Inventory Dr / Inventory In-Transit Cr). No purchase / supplier / GST entries.
 */

export const RECEIPT_STATUSES = ["Draft", "Partially Received", "Received", "Cancelled"] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];
export const MANUAL_RECEIPT_ENABLED = false; // Mode 2 — future

export const RECEIPT_STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger" | "primary"> = {
  Draft: "neutral", "Partially Received": "warning", Received: "success", Cancelled: "neutral",
  Pending: "warning", NotRequired: "neutral", Approved: "success", Rejected: "danger",
};

export const isReceiptEditable = (s: string) => s === "Draft";

/* --------------------------------------------------------------- schemas */
export const receiptItemInput = z.object({
  dispatchItemId: z.coerce.number().int().nullable().optional(),
  productId: z.coerce.number().int(),
  productName: z.string().min(1),
  sku: z.string().nullable().optional(),
  uom: z.string().nullable().optional(),
  batchNo: z.string().nullable().optional(),
  mfgDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  serials: z.array(z.string()).optional(),
  dispatchQty: z.coerce.number().default(0),
  receivedQty: z.coerce.number().default(0),
  damagedQty: z.coerce.number().default(0),
  purchasePrice: z.coerce.number().default(0),
  sellingPrice: z.coerce.number().default(0),
  mrp: z.coerce.number().default(0),
  remarks: z.string().nullable().optional(),
});
export const receiptInput = z.object({
  dispatchId: z.coerce.number().int(),
  receiptDate: z.string().optional(),
  remarks: z.string().nullable().optional(),
  items: z.array(receiptItemInput).min(1),
});
export type ReceiptInput = z.infer<typeof receiptInput>;

export const receiptActionInput = z.object({ action: z.enum(["receive", "cancel"]), remarks: z.string().optional() });
export type ReceiptActionInput = z.infer<typeof receiptActionInput>;

/** acceptedQty = receivedQty − damagedQty; missingQty = dispatchQty − receivedQty. */
export function receiptLineMath(dispatchQty: number, receivedQty: number, damagedQty: number) {
  const rec = Math.max(0, Number(receivedQty) || 0);
  const dmg = Math.max(0, Number(damagedQty) || 0);
  const disp = Math.max(0, Number(dispatchQty) || 0);
  return { acceptedQty: Math.max(0, rec - dmg), missingQty: Math.max(0, disp - rec) };
}

/** Header + line validation shared by client & server. */
export function validateReceipt(items: { dispatchQty: number; receivedQty: number; damagedQty: number; productName: string }[]): string | null {
  if (!items.length) return "No items to receive.";
  if (!items.some((l) => Number(l.receivedQty) > 0)) return "Enter a received quantity for at least one item.";
  for (const l of items) {
    if (Number(l.receivedQty) > Number(l.dispatchQty) + 0.001) return `${l.productName}: received qty cannot exceed dispatched qty (${l.dispatchQty}).`;
    if (Number(l.damagedQty) > Number(l.receivedQty) + 0.001) return `${l.productName}: damaged qty cannot exceed received qty.`;
  }
  return null;
}
