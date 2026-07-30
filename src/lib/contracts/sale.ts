import { z } from "zod";

/**
 * Shared contract for the POS Sale module (create + recent-sales list).
 *
 * The create REQUEST is validated by `SaleCreateSchema` (outer shape + coercion);
 * the detailed per-line tax / payment computation stays in the route. Response
 * DTOs are the source of truth for the list shapes shared with the client.
 */

const numOrStr = z.union([z.number(), z.string()]);

export const SaleLineInputSchema = z.object({
  productId: z.coerce.number().int().optional(),
  productName: z.string().optional(),
  sku: z.string().optional(),
  hsn: z.string().optional(),
  uom: z.string().optional(),
  qty: numOrStr.optional(),
  mrp: numOrStr.optional(),
  rate: numOrStr.optional(),
  disc: numOrStr.optional(),
  discType: z.string().optional(),
  taxPct: numOrStr.optional(),
  batchNo: z.string().optional(),
  mfgDate: z.string().optional(),
  expiryDate: z.string().optional(),
  qrCodes: z.array(z.string()).optional(),
});

export const SalePaymentInputSchema = z.object({
  mode: z.string().optional(),
  amount: numOrStr.optional(),
  reference: z.string().optional(),
});

export const SaleCreateSchema = z.object({
  saleDate: z.string().optional(),
  warehouse: z.string().optional(),
  customerId: z.coerce.number().int().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  billDiscount: numOrStr.optional(),
  billDiscType: z.string().optional(),
  loyaltyRedeemPoints: numOrStr.optional(), // points the customer chose to redeem (server validates + clamps)
  couponCode: z.string().optional(), // coupon number/code applied at POS (server re-validates + recomputes the discount)
  promoCode: z.string().optional(), // promo code applied at POS (server re-validates + recomputes the discount)
  membershipApply: z.union([z.boolean(), z.string()]).optional(), // apply the member's configured bill-discount benefit
  giftVoucherNo: z.string().optional(), // gift voucher tendered as payment (stored value)
  giftVoucherAmount: numOrStr.optional(),
  notes: z.string().optional(),
  lines: z.array(SaleLineInputSchema).default([]),
  payments: z.array(SalePaymentInputSchema).default([]),
  bankId: z.coerce.number().nullable().optional(), bankName: z.string().optional(), bankAccount: z.string().optional(),
});
export type SaleCreateInput = z.infer<typeof SaleCreateSchema>;
export type SaleLineInput = z.infer<typeof SaleLineInputSchema>;
export type SalePaymentInput = z.infer<typeof SalePaymentInputSchema>;

/* ----------------------------------------------------------------- list */
export interface SaleRow {
  id: number;
  invoiceNo: string;
  saleDate: string;
  customerName: string;
  customerPhone: string;
  itemCount: number;
  total: number;
  paymentMode: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
}
export interface SaleListStats { todaySales: number; todayBills: number }
export interface SaleListResponse { ok: true; rows: SaleRow[]; stats: SaleListStats }

/* --------------------------------------------------- B2B tax invoice */
export const B2bAttachmentSchema = z.object({
  fileName: z.string().optional(),
  fileUrl: z.string().optional(),
  fileType: z.string().nullable().optional(),
  size: z.coerce.number().optional(),
});
export const B2bInvoiceCreateSchema = z.object({
  customerId: z.coerce.number().int().optional(),
  saleDate: z.string().optional(),
  dueDate: z.string().optional(),
  paymentTerms: z.string().optional(),
  interState: z.boolean().optional(),
  warehouse: z.string().optional(),
  notes: z.string().optional(),
  soNumber: z.string().optional(),
  termsConditions: z.string().optional(),
  tdsAmount: numOrStr.optional(),
  tcsAmount: numOrStr.optional(),
  billDiscount: numOrStr.optional(),
  billDiscType: z.string().optional(),
  lines: z.array(SaleLineInputSchema).default([]),
  payments: z.array(SalePaymentInputSchema).default([]),
  bankId: z.coerce.number().nullable().optional(), bankName: z.string().optional(), bankAccount: z.string().optional(),
  attachments: z.array(B2bAttachmentSchema).default([]),
  // Customer advances applied against this invoice (Advance Management integration).
  advanceAdjustments: z.array(z.object({ advanceId: z.coerce.number().int(), amount: numOrStr })).optional(),
});
export type B2bInvoiceCreateInput = z.infer<typeof B2bInvoiceCreateSchema>;

export interface B2bInvoiceRow {
  id: number;
  invoiceNo: string;
  saleDate: string;
  dueDate: string;
  customerName: string;
  customerGstin: string;
  total: number;
  amountPaid: number;
  paymentStatus: string;
  status: string;
  itemCount: number;
}
export interface B2bInvoiceListStats { invoices: number; mtdValue: number; outstanding: number }
export interface B2bInvoiceListResponse { ok: true; rows: B2bInvoiceRow[]; stats: B2bInvoiceListStats }

/* ------------------------------------------------ customer collection */
export const CollectionAllocInputSchema = z.object({ saleId: z.coerce.number().int().optional(), amount: numOrStr.optional() });
export const CollectionCreateSchema = z.object({
  customerId: z.coerce.number().int().optional(),
  collectionDate: z.string().optional(),
  notes: z.string().optional(),
  payments: z.array(SalePaymentInputSchema).default([]),
  bankId: z.coerce.number().nullable().optional(), bankName: z.string().optional(), bankAccount: z.string().optional(),
  attachments: z.array(B2bAttachmentSchema).default([]),
  allocations: z.array(CollectionAllocInputSchema).default([]),
});
export type CollectionCreateInput = z.infer<typeof CollectionCreateSchema>;

export interface CollectionRow {
  id: number;
  collectionNo: string;
  customerName: string;
  collectionDate: string;
  mode: string;
  reference: string;
  totalAmount: number;
  invoiceCount: number;
  status: string;
}
export interface CollectionListStats { collections: number; thisMonth: number }
export interface CollectionListResponse { ok: true; rows: CollectionRow[]; stats: CollectionListStats }

export interface OpenInvoiceRow {
  saleId: number;
  invoiceNo: string;
  channel: string;
  saleDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  overdue: boolean;
}
export interface CollectionCustomer {
  id: number;
  name: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPerson: string;
}
export interface CollectionOpenResponse { ok: true; customer: CollectionCustomer | null; rows: OpenInvoiceRow[]; totalBalance: number }
