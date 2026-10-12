import { z } from "zod";

/**
 * Shared API contract for the Purchase Invoice / Supplier Bill module. A purchase
 * invoice records the supplier bill against one or more posted GRNs; inventory +
 * GST were already booked at GRN, so this only records the bill, takes over the
 * GRN's payable, and posts invoice-level charge/discount/round-off deltas.
 */

const numOrStr = z.union([z.number(), z.string()]);

export const PURCHASE_TYPES = ["Inventory", "Expense", "Service", "Asset"] as const;
export const PI_ATTACHMENT_DOCTYPES = ["invoice", "image", "challan", "supporting"] as const;

export const PurchaseAttachmentSchema = z.object({
  docType: z.enum(PI_ATTACHMENT_DOCTYPES).optional(),
  fileName: z.string(),
  fileUrl: z.string(),
  fileType: z.string().nullable().optional(),
  size: z.coerce.number().optional(),
});

/** A manually-entered line on a Direct vendor bill (product-picked or free-text). */
export const PiLineSchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  description: z.string().trim().min(1, "Line description is required."),
  sku: z.string().trim().optional(),
  hsn: z.string().trim().optional(),
  qty: z.coerce.number().positive(),
  rate: z.coerce.number().nonnegative(),
  taxPct: z.coerce.number().nonnegative().optional(),
  discPct: z.coerce.number().nonnegative().optional(),
  batchNo: z.string().trim().optional(),
  expiryDate: z.string().trim().optional(),
});
export type PiLineInput = z.infer<typeof PiLineSchema>;

export const PurchaseInvoiceCreateSchema = z.object({
  invoiceType: z.enum(["GRN", "Direct"]).default("GRN"),
  grnIds: z.array(z.coerce.number().int().positive()).default([]),
  // Direct bill: supplier + manual lines + optional GRN reference no.
  supplierId: z.coerce.number().int().positive().optional(),
  supplierName: z.string().trim().optional(),
  supplierGstin: z.string().trim().optional(),
  grnRef: z.string().trim().optional(),
  poNo: z.string().trim().optional(), // direct bill raised against a Purchase Order
  lines: z.array(PiLineSchema).default([]),
  supplierInvoiceNo: z.string().trim().optional(),
  supplierInvoiceDate: z.string().trim().optional(),
  supplierBillNo: z.string().trim().optional(),
  supplierBillDate: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  paymentTerms: z.string().trim().optional(),
  creditDays: z.coerce.number().int().optional(),
  currency: z.string().trim().optional(),
  supplierRef: z.string().trim().optional(),
  purchaseType: z.enum(PURCHASE_TYPES).optional(),
  gstMode: z.enum(["inclusive", "exclusive"]).default("exclusive"), // direct-bill line tax basis
  // Bill amount charges
  additionalDiscount: numOrStr.optional(),
  freight: numOrStr.optional(),
  loading: numOrStr.optional(),
  packing: numOrStr.optional(),
  insurance: numOrStr.optional(),
  otherCharges: numOrStr.optional(),
  roundOff: numOrStr.optional(),
  // GST
  gstApplicable: z.boolean().optional(),
  reverseCharge: z.boolean().optional(),
  remarks: z.string().trim().optional(),
  internalNotes: z.string().trim().optional(),
  attachments: z.array(PurchaseAttachmentSchema).default([]),
  // Supplier advances applied against this bill (Advance Management integration).
  advanceAdjustments: z.array(z.object({ advanceId: z.coerce.number().int(), amount: numOrStr })).optional(),
});
export type PurchaseInvoiceCreateInput = z.infer<typeof PurchaseInvoiceCreateSchema>;

export const PurchaseInvoiceEditSchema = PurchaseInvoiceCreateSchema.partial().omit({ grnIds: true });
export type PurchaseInvoiceEditInput = z.infer<typeof PurchaseInvoiceEditSchema>;

/* ---------------------------------------------------------- responses -- */
export type PurchaseInvoiceStatus = "Draft" | "Pending Approval" | "Approved" | "Posted" | "Cancelled";

export interface PurchaseInvoiceRow {
  id: number; invoiceNo: string; invoiceType: string; supplierInvoiceNo: string; supplierInvoiceDate: string;
  supplier: string; grnNos: string; netPayable: number; status: string; paymentStatus: string;
  balanceAmount: number; createdAt: string;
}
export interface PurchaseInvoiceListStats { total: number; pendingApproval: number; outstanding: number; paid: number; }
export interface PurchaseInvoiceListResponse { ok: true; rows: PurchaseInvoiceRow[]; stats: PurchaseInvoiceListStats; }

export interface PurchaseInvoiceItemDTO {
  id: number; productName: string; sku: string; batchNo: string; expiryDate: string;
  qty: number; unitPrice: number; taxPct: number; taxAmount: number; discAmount: number; lineValue: number;
}
export interface PurchaseInvoiceVoucherDTO { id: number; voucherNo: string; voucherType: string; date: string; narration: string; totalDebit: number; lines: { account: string; debit: number; credit: number; narration: string }[]; }
export interface PurchaseInvoiceDetail {
  id: number; invoiceNo: string; status: string; invoiceType: string; grnRef: string;
  supplierInvoiceNo: string; supplierInvoiceDate: string; supplierBillNo: string; supplierBillDate: string;
  dueDate: string; paymentTerms: string; creditDays: number | null; currency: string; supplierRef: string;
  supplier: string; supplierGstin: string; poNo: string; warehouse: string; purchaseType: string;
  grnAmount: number; additionalDiscount: number; freight: number; loading: number; packing: number; insurance: number; otherCharges: number; roundOff: number;
  taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; gstAmount: number; gstApplicable: boolean; reverseCharge: boolean;
  totalInvoiceAmount: number; netPayable: number;
  accountsPosted: boolean; journalRef: string; payableId: number | null;
  approvedBy: number | null; approvedAt: string | null; approvalNote: string;
  remarks: string; internalNotes: string; itemCount: number; createdAt: string;
  grnNos: string;
  paymentStatus: string; paidAmount: number; balanceAmount: number;
  items: PurchaseInvoiceItemDTO[];
  attachments: { id: number; docType: string; fileName: string; fileUrl: string; fileType: string; size: number }[];
  grns: { grnId: number; grnNo: string; grnAmount: number }[];
  vouchers: PurchaseInvoiceVoucherDTO[];
}

/* ------------------------------------------------------ pending GRN lookup */
export interface PendingGrnRow {
  id: number; grnNo: string; grnDate: string; supplier: string; poNo: string; warehouse: string;
  lineCount: number; grnAmount: number;
}
export interface PendingGrnLine {
  productId: number; productName: string; sku: string; batchNo: string; mfgDate: string; expiryDate: string;
  qty: number; unitPrice: number; taxPct: number; taxAmount: number; discPct: number; discAmount: number; lineValue: number;
}
export interface PendingGrnDetail {
  id: number; grnNo: string; grnDate: string; supplier: string; supplierGstin: string; poNo: string;
  businessId: number | null; branchId: number | null; warehouse: string;
  subtotal: number; taxTotal: number; freightAmount: number; otherCharges: number; transitPassAmount: number; roundOff: number; grnAmount: number;
  paymentTerms: string; creditDays: number | null; dueDate: string;
  lines: PendingGrnLine[];
}
