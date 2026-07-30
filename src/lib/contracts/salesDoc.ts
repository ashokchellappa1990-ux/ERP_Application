import { z } from "zod";

/**
 * Shared contract for Sales Quotation + Sales Order (one engine, `docType`
 * discriminated). Both are pre-sale documents — a quote / commitment that does
 * NOT post to the GL and does NOT move stock. Mirrors the Purchase Order contract.
 */
export type SalesDocType = "quotation" | "order";

const numOrStr = z.union([z.number(), z.string()]);

export const SalesDocLineSchema = z.object({
  productId: z.coerce.number().int().optional(),
  description: z.string().min(1, "Item description is required."),
  sku: z.string().optional(),
  hsn: z.string().optional(),
  uom: z.string().optional(),
  qty: z.coerce.number().positive("Qty must be greater than 0."),
  mrp: numOrStr.optional(),
  rate: numOrStr.optional(),
  discPct: numOrStr.optional(),
  taxPct: numOrStr.optional(),
  expectedDate: z.string().optional(),
  remarks: z.string().optional(),
});

export const SalesDocAttachmentSchema = z.object({
  docType: z.string().optional(),
  fileName: z.string(),
  fileUrl: z.string(),
  fileType: z.string().nullable().optional(),
  size: z.coerce.number().optional(),
});

export const SalesDocCreateSchema = z.object({
  customerId: z.coerce.number().int().optional(),
  customerName: z.string().optional(),
  customerGstin: z.string().optional(),
  customerContact: z.string().optional(),
  customerPhone: z.string().optional(),
  customerRef: z.string().optional(),
  salesperson: z.string().optional(),
  enquiryNo: z.string().optional(),
  enquiryDate: z.string().optional(),
  docDate: z.string().optional(),
  validUntil: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  warehouse: z.string().optional(),
  deliveryAddress: z.string().optional(),
  shippingMode: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditDays: z.coerce.number().optional(),
  dueDate: z.string().optional(),
  currency: z.string().optional(),
  gstMode: z.enum(["exclusive", "inclusive"]).optional(),
  gstApplicable: z.boolean().optional(),
  reverseCharge: z.boolean().optional(),
  interState: z.boolean().optional(),
  additionalDiscount: numOrStr.optional(),
  freight: numOrStr.optional(),
  loading: numOrStr.optional(),
  packing: numOrStr.optional(),
  insurance: numOrStr.optional(),
  otherCharges: numOrStr.optional(),
  roundOff: numOrStr.optional(),
  remarks: z.string().optional(),
  internalNotes: z.string().optional(),
  termsConditions: z.string().optional(),
  saveMode: z.enum(["Draft", "Issued"]).optional(),
  lines: z.array(SalesDocLineSchema).min(1, "Add at least one line item."),
  attachments: z.array(SalesDocAttachmentSchema).optional(),
});
export type SalesDocCreateInput = z.infer<typeof SalesDocCreateSchema>;
export type SalesDocLineInput = z.infer<typeof SalesDocLineSchema>;

export const SalesDocStatusSchema = z.object({
  action: z.string(),
  note: z.string().optional(),
});

/* ---------------------------------------------------------------- DTOs */
export interface SalesDocRow {
  id: number;
  docNo: string;
  docDate: string;
  status: string;
  customerName: string;
  customerGstin: string;
  itemCount: number;
  totalValue: number;
  netAmount: number;
  keyDate: string; // validUntil (quotation) / expectedDeliveryDate (order)
  convertedToNo: string;
}

export interface SalesDocItemDto {
  id: number;
  productId: number | null;
  productName: string;
  sku: string | null;
  hsn: string | null;
  uom: string | null;
  qty: number;
  mrp: number | null;
  rate: number;
  discPct: number | null;
  discAmount: number;
  taxPct: number | null;
  taxableValue: number;
  taxAmount: number;
  lineValue: number;
  deliveredQty: number;
  expectedDate: string;
  remarks: string;
}

export interface SalesDocDetail {
  id: number;
  docType: SalesDocType;
  docNo: string;
  docDate: string;
  status: string;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  customerGstin: string;
  customerContact: string;
  customerRef: string;
  salesperson: string;
  enquiryNo: string;
  enquiryDate: string;
  validUntil: string;
  expectedDeliveryDate: string;
  warehouse: string;
  deliveryAddress: string;
  shippingMode: string;
  paymentTerms: string;
  creditDays: number | null;
  dueDate: string;
  currency: string;
  gstApplicable: boolean;
  reverseCharge: boolean;
  interState: boolean;
  gstMode: string;
  subtotal: number;
  itemDiscount: number;
  additionalDiscount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstAmount: number;
  freight: number;
  loading: number;
  packing: number;
  insurance: number;
  otherCharges: number;
  roundOff: number;
  totalValue: number;
  netAmount: number;
  itemCount: number;
  sourceDocType: string;
  sourceDocNo: string;
  convertedToType: string;
  convertedToId: number | null;
  convertedToNo: string;
  approvalNote: string;
  cancelReason: string;
  remarks: string;
  internalNotes: string;
  termsConditions: string;
  createdByName: string;
  createdAt: string;
  items: SalesDocItemDto[];
  attachments: { id: number; fileName: string; fileUrl: string; fileType: string | null; size: number }[];
}

/* ------------------------------------------------ status workflow maps */
// action -> { [fromStatus]: toStatus }. A status transition is allowed only when
// the current status is a key. `convert` is handled by a dedicated endpoint.
export const QUOTATION_NEXT: Record<string, Record<string, string>> = {
  send: { Draft: "Sent" },
  accept: { Draft: "Accepted", Sent: "Accepted" },
  reject: { Draft: "Rejected", Sent: "Rejected" },
  expire: { Sent: "Expired", Accepted: "Expired" },
  cancel: { Draft: "Cancelled", Sent: "Cancelled", Accepted: "Cancelled", Rejected: "Cancelled", Expired: "Cancelled" },
  reopen: { Rejected: "Draft", Expired: "Draft", Cancelled: "Draft" },
};
export const ORDER_NEXT: Record<string, Record<string, string>> = {
  confirm: { Draft: "Confirmed" },
  deliver: { Confirmed: "Delivered", "Partially Delivered": "Delivered" },
  invoice: { Confirmed: "Invoiced", Delivered: "Invoiced", "Partially Delivered": "Invoiced" },
  close: { Delivered: "Closed", Invoiced: "Closed" },
  cancel: { Draft: "Cancelled", Confirmed: "Cancelled", Delivered: "Cancelled" },
  reopen: { Cancelled: "Draft", Closed: "Confirmed" },
};
export const nextMap = (docType: SalesDocType) => (docType === "order" ? ORDER_NEXT : QUOTATION_NEXT);

// Open (editable / still-active) statuses per doc type.
export const OPEN_STATUSES: Record<SalesDocType, string[]> = {
  quotation: ["Draft", "Sent", "Accepted"],
  order: ["Draft", "Confirmed", "Delivered", "Partially Delivered"],
};

export const DOC_LABEL: Record<SalesDocType, { title: string; short: string; number: string; keyDate: string }> = {
  quotation: { title: "Sales Quotation", short: "Quotation", number: "Quotation No", keyDate: "Valid Until" },
  order: { title: "Sales Order", short: "Order", number: "Order No", keyDate: "Expected Delivery" },
};
