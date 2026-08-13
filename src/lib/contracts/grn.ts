import { z } from "zod";

/**
 * Shared contract for the Goods Receipt Note (GRN) module.
 *
 * Response DTOs are the source of truth for the list / detail shapes shared by the
 * server routes and the purchase client pages. The create/update REQUEST is
 * validated by the existing domain builder `buildGrnPayload` (returns a typed
 * result or `{ error }` → 422) — that is GRN's request contract; only the small
 * QR-print request is schematised here with Zod.
 */

export type GrnStatus = "Draft" | "Posted" | "Cancelled";

/* ----------------------------------------------------------------- list */
export interface GrnRow {
  id: number;
  grnNo: string;
  status: GrnStatus;
  grnDate: string;
  supplier: string;
  poNo: string;
  warehouse: string;
  lineCount: number;
  totalQty: number;
  totalValue: number;
  createdAt: string;
  supplierInvoiceNo: string;
  paymentStatus: string;
  invoiceRecorded: boolean;
  vehicleNo: string;
}
export interface GrnListStats { total: number; draft: number; posted: number; totalValue: number; totalQty: number; scope: "today" | "filtered" }
export interface GrnListResponse { ok: true; rows: GrnRow[]; stats: GrnListStats }

/* --------------------------------------------------------------- detail */
export interface GrnDetailLine {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  uom: string;
  category: string;
  qty: number;
  freeQty: number | string;
  rate: number | string;
  sellingPrice: number | string;
  discPct: number | string;
  taxPct: number | string;
  value: number;
  mrp: number | string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  remarks: string;
  qrMode: "shared" | "unique";
  qrStatus: "Pending" | "Generated" | "Not Required";
  qrGeneratedCount: number;
  printedQty: number;
  qrRequired: boolean;
}

export interface GrnDetail {
  id: number;
  grnNo: string;
  status: GrnStatus;
  grnDate: string;
  supplier: string;
  supplierGstin: string;
  supplierContact: string;
  supplierInvoiceNo: string;
  supplierInvoiceDate: string;
  poNo: string;
  warehouse: string;
  notes: string;
  gstMode: string;
  gstPct: number | string;
  subtotal: number;
  taxTotal: number;
  freightAmount: number;
  otherCharges: number;
  roundOff: number;
  totalInvoiceValue: number;
  paymentStatus: string;
  amountPaid: number;
  paymentMode: string;
  paymentRef: string;
  paymentDate: string;
  paymentTerms: string;
  creditDays: number | string;
  dueDate: string;
  transporterName: string;
  transportMode: string;
  transportType: string;
  vehicleNo: string;
  lrNo: string;
  ewayBillNo: string;
  freightPaidBy: string;
  numPackages: number | string;
  transportRemarks: string;
  weightSlipRefNo: string;
  inventoryMovement: string;
  vehicleOwnerType: string;
  tareWeight: number | string;
  grossWeight: number | string;
  netWeight: number | string;
  billNetWeight: number | string;
  weightUom: string;
  emptyWeight: number | string;
  emptyWeightAt: string;
  emptyWeightRemarks: string;
  invoiceRecorded: boolean;
  purchaseInvoiceId: number | null;
  totalQty: number;
  totalValue: number;
  lineCount: number;
  gateEntryId: number | null;
  gateEntry: { gateEntryNo: string; grossWeight: number | null; status: string } | null;
  lines: GrnDetailLine[];
}

/* ----------------------------------------------------------- qr print */
export const GrnPrintSchema = z.object({
  lineId: z.coerce.number().int().positive(),
  count: z.coerce.number().int().nonnegative().optional(),
});
export type GrnPrintInput = z.infer<typeof GrnPrintSchema>;
export interface GrnPrintResponse {
  ok: true;
  message: string;
  codes: string[];
  line: { name: string; sku: string; mrp: number | null };
}
