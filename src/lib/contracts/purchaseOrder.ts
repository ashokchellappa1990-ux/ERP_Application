import { z } from "zod";

/**
 * Shared contracts for the Purchase Order module (request Zod schema + response DTOs).
 * A PO is a supplier commitment — it does NOT post to the GL; goods post at GRN and the
 * bill posts at Purchase Invoice.
 */

export const PoLineSchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  description: z.string().trim().min(1, "Line description is required."),
  sku: z.string().trim().optional(),
  hsn: z.string().trim().optional(),
  uom: z.string().trim().optional(),
  qty: z.coerce.number().positive("Quantity must be greater than zero."),
  rate: z.coerce.number().nonnegative(),
  taxPct: z.coerce.number().nonnegative().optional(),
  discPct: z.coerce.number().nonnegative().optional(),
  expectedDate: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});
export type PoLineInput = z.infer<typeof PoLineSchema>;

export const PoAttachmentSchema = z.object({
  docType: z.string().trim().default("quotation"),
  fileName: z.string().trim(),
  fileUrl: z.string().trim(),
  fileType: z.string().trim().optional(),
  size: z.coerce.number().int().nonnegative().default(0),
});

const money = z.union([z.number(), z.string()]).optional();

export const PurchaseOrderCreateSchema = z.object({
  supplierId: z.coerce.number().int().positive().optional(),
  supplierName: z.string().trim().min(1, "Select a supplier."),
  supplierGstin: z.string().trim().optional(),
  supplierContact: z.string().trim().optional(),
  supplierRef: z.string().trim().optional(),
  poDate: z.string().trim().optional(),
  quotationNo: z.string().trim().optional(),
  quotationDate: z.string().trim().optional(),
  buyer: z.string().trim().optional(),
  purchaseType: z.enum(["Inventory", "Expense", "Service", "Asset"]).default("Inventory"),
  expectedDeliveryDate: z.string().trim().optional(),
  warehouse: z.string().trim().optional(),
  deliveryAddress: z.string().trim().optional(),
  shippingMode: z.string().trim().optional(),
  freightPaidBy: z.string().trim().optional(),
  paymentTerms: z.string().trim().optional(),
  creditDays: z.coerce.number().int().optional(),
  dueDate: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  gstMode: z.enum(["inclusive", "exclusive"]).default("exclusive"),
  gstApplicable: z.boolean().optional(),
  reverseCharge: z.boolean().optional(),
  interState: z.boolean().optional(),
  additionalDiscount: money, freight: money, loading: money, packing: money, insurance: money, otherCharges: money, roundOff: money,
  remarks: z.string().trim().optional(),
  internalNotes: z.string().trim().optional(),
  termsConditions: z.string().trim().optional(),
  saveMode: z.enum(["Draft", "Issued"]).default("Draft"),
  lines: z.array(PoLineSchema).min(1, "Add at least one line item."),
  attachments: z.array(PoAttachmentSchema).default([]),
});
export type PurchaseOrderCreateInput = z.infer<typeof PurchaseOrderCreateSchema>;

export const PurchaseOrderUpdateSchema = PurchaseOrderCreateSchema.partial().extend({ lines: z.array(PoLineSchema).optional() });
export const PoStatusSchema = z.object({ action: z.enum(["approve", "issue", "cancel", "close", "reopen"]), note: z.string().trim().max(300).optional() });

// --- response DTOs ---
export interface PurchaseOrderRow {
  id: number; poNo: string; poDate: string; supplier: string; purchaseType: string;
  expectedDeliveryDate: string; itemCount: number; netAmount: number; status: string; createdAt: string;
}
export interface PurchaseOrderItemDto {
  id: number; productId: number | null; productName: string; sku: string | null; hsn: string | null; uom: string | null;
  qty: number; rate: number; taxPct: number | null; taxAmount: number; discPct: number | null; discAmount: number; lineValue: number;
  expectedDate: string | null; receivedQty: number; remarks: string | null;
}
export interface PurchaseOrderDetail {
  id: number; poNo: string; poDate: string; status: string;
  supplierId: number | null; supplier: string; supplierGstin: string; supplierContact: string; supplierRef: string;
  quotationNo: string; quotationDate: string; buyer: string; purchaseType: string;
  expectedDeliveryDate: string; warehouse: string; deliveryAddress: string; shippingMode: string; freightPaidBy: string;
  paymentTerms: string; creditDays: number | null; dueDate: string; currency: string;
  gstApplicable: boolean; reverseCharge: boolean; interState: boolean;
  taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; gstAmount: number;
  additionalDiscount: number; freight: number; loading: number; packing: number; insurance: number; otherCharges: number; roundOff: number;
  totalOrderValue: number; netAmount: number; itemCount: number;
  approvedByName: string; approvedAt: string | null; approvalNote: string; issuedAt: string | null; cancelledAt: string | null; cancelReason: string;
  remarks: string; internalNotes: string; termsConditions: string; createdByName: string; createdAt: string;
  items: PurchaseOrderItemDto[];
  attachments: { id: number; docType: string; fileName: string; fileUrl: string; fileType: string | null; size: number }[];
}
