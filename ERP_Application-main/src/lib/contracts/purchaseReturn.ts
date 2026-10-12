import { z } from "zod";

/**
 * Shared API contract for the Purchase Return module (unified — no separate Debit
 * Note). A return is always created against an existing Purchase Invoice and
 * inherits its purchaseType (read-only). See `src/lib/contracts` convention:
 * REQUEST = Zod schema (validated + inferred); RESPONSE = exported interfaces.
 */

/* ----------------------------------------------------------- request -- */

// Destination treatment for the returned goods (Inventory type). Purchase returns
// default to "vendor" (goods leave to the supplier).
export const PR_HANDLINGS = ["vendor", "damaged", "scrap"] as const;

// Return reasons (UI presets; "Other" allows free text in remarks).
export const PR_REASONS = [
  "Damaged", "Defective", "Wrong Item", "Wrong Service", "Quality Issue",
  "Expired", "Near Expiry", "Excess Quantity", "Other",
] as const;

export const PurchaseReturnLineInputSchema = z.object({
  piItemId: z.coerce.number().int().positive(),
  returnQty: z.coerce.number().nonnegative(),
  reason: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  inventoryHandling: z.enum(PR_HANDLINGS).optional(),
  // Serial / unique-QR codes being returned for this line (serial-tracked products).
  qrCodes: z.array(z.string().trim()).optional(),
});

export const PurchaseReturnCreateSchema = z.object({
  purchaseInvoiceId: z.coerce.number().int().positive(),
  reason: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  lines: z.array(PurchaseReturnLineInputSchema).min(1, "Select at least one line to return."),
});
export type PurchaseReturnCreateInput = z.infer<typeof PurchaseReturnCreateSchema>;
export type PurchaseReturnLineInput = z.infer<typeof PurchaseReturnLineInputSchema>;

/* ---------------------------------------------------------- responses -- */

export type PurchaseReturnStatus = "Draft" | "Pending Approval" | "Approved" | "Cancelled";

export interface PurchaseReturnRow {
  id: number; returnNo: string; returnDate: string; invoiceNo: string; grnNo: string;
  supplier: string; purchaseType: string; itemCount: number; returnAmount: number;
  status: string; createdAt: string;
}
export interface PurchaseReturnListStats { total: number; pendingApproval: number; returnValue: number; }
export interface PurchaseReturnListResponse { ok: true; rows: PurchaseReturnRow[]; stats: PurchaseReturnListStats; }

export interface PurchaseReturnDetailLine {
  id: number; productName: string; sku: string; hsn: string;
  invoicedQty: number; returnedQty: number; returnQty: number; rate: number;
  taxAmount: number; discAmount: number; returnValue: number;
  reason: string; remarks: string; inventoryHandling: string;
  batchNo: string; mfgDate: string; expiryDate: string; serials: string[];
}
// One inventory-ledger movement raised by the return (the stock reversal log).
export interface PurchaseReturnLedgerRow {
  id: number; productName: string; sku: string; txnType: string; direction: string;
  qty: number; warehouse: string; batchNo: string; balanceQty: number; txnDate: string;
}
// One debit/credit line of the posted accounting voucher (the GL reversal log).
export interface PurchaseReturnVoucherLine { code: string; name: string; debit: number; credit: number; narration: string }
export interface PurchaseReturnVoucher { voucherNo: string; voucherType: string; date: string; narration: string; totalDebit: number; totalCredit: number; lines: PurchaseReturnVoucherLine[] }
// Debit-note view (the return IS the debit note — no separate module).
export interface PurchaseReturnDebitNote { debitNoteNo: string; date: string; supplier: string; supplierGstin: string; invoiceNo: string; taxableAmount: number; taxAmount: number; totalDebit: number; supplierOutstandingUpdated: boolean }

export interface PurchaseReturnDetail {
  id: number; returnNo: string; returnDate: string; status: string;
  purchaseInvoiceId: number; invoiceNo: string; grnNo: string; poNo: string; purchaseType: string;
  supplier: string; supplierGstin: string; warehouse: string;
  reason: string; remarks: string;
  taxableAmount: number; taxAmount: number; roundOff: number; returnAmount: number;
  inventoryUpdated: boolean; supplierOutstandingUpdated: boolean; accountingPosted: boolean; journalRef: string;
  approvedBy: number | null; approvedAt: string | null; approvalNote: string;
  itemCount: number; createdAt: string;
  lines: PurchaseReturnDetailLine[];
  ledger: PurchaseReturnLedgerRow[];
  voucher: PurchaseReturnVoucher | null;
  debitNote: PurchaseReturnDebitNote;
}

/* ---- Purchase Invoice lookup (to build a return against an invoice) ---- */

export interface PiReturnLine {
  piItemId: number; grnLineId: number | null; productId: number | null; productName: string; sku: string; hsn: string;
  invoicedQty: number; alreadyReturned: number; returnableQty: number;
  rate: number; taxPct: number; taxAmount: number; discAmount: number; lineValue: number;
  batchNo: string; mfgDate: string; expiryDate: string;
  // Serial-tracked: still-available manufacturer serials received against this product.
  serialTracked: boolean; availableSerials: { id: number; serialNo: string; code: string }[];
}
export interface PiReturnSource {
  id: number; invoiceNo: string; invoiceDate: string; invoiceType: string; purchaseType: string;
  grnId: number | null; grnNo: string; poNo: string; warehouse: string;
  supplierId: number | null; supplier: string; supplierGstin: string;
  taxableAmount: number; gstAmount: number; totalInvoiceAmount: number;
  lines: PiReturnLine[];
}
export interface PiReturnMatch {
  id: number; invoiceNo: string; invoiceDate: string; supplier: string; purchaseType: string; total: number; itemCount: number;
}
