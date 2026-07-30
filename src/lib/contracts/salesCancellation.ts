import { z } from "zod";

/**
 * Shared API contract for the Sales Cancellation module — full-invoice void. A
 * cancellation is created against an existing (Completed) Sale; the user only
 * supplies a reason, remarks and (optionally) a refund method. Everything else is
 * inherited read-only. REQUEST = Zod schema; RESPONSE = exported interfaces.
 */

export const CANCELLATION_REFUND_METHODS = ["original", "cash", "storeCredit", "wallet"] as const;

export const SalesCancellationCreateSchema = z.object({
  saleId: z.coerce.number().int().positive(),
  reason: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  refundMethod: z.string().trim().optional(),
});
export type SalesCancellationCreateInput = z.infer<typeof SalesCancellationCreateSchema>;

export type SalesCancellationStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected" | "Cancelled";

export interface SalesCancellationRow {
  id: number; cancellationNo: string; cancellationDate: string; invoiceNo: string;
  customerName: string; channel: string; invoiceAmount: number; refundAmount: number;
  paymentMode: string; status: string; createdAt: string;
}
export interface SalesCancellationListStats { total: number; pendingApproval: number; cancelledAmount: number; }
export interface SalesCancellationListResponse { ok: true; rows: SalesCancellationRow[]; stats: SalesCancellationListStats; }

export interface SalesCancellationDetailLine {
  id: number; productName: string; sku: string; qty: number; rate: number; taxAmount: number; value: number;
  batchNo: string; mfgDate: string; expiryDate: string; serials: string[];
}
export interface SalesCancellationPaymentRow { mode: string; amount: number; reference: string; refundStatus: string }
export interface SalesCancellationLedgerRow { id: number; productName: string; sku: string; txnType: string; direction: string; qty: number; warehouse: string; batchNo: string; balanceQty: number; txnDate: string }
export interface SalesCancellationVoucherLine { code: string; name: string; debit: number; credit: number; narration: string }
export interface SalesCancellationVoucher { voucherNo: string; voucherType: string; date: string; narration: string; totalDebit: number; totalCredit: number; lines: SalesCancellationVoucherLine[] }

export interface SalesCancellationDetail {
  id: number; cancellationNo: string; cancellationDate: string; status: string;
  saleId: number; invoiceNo: string; channel: string; warehouse: string;
  customerName: string; customerPhone: string;
  invoiceAmount: number; refundAmount: number; refundMethod: string; paymentMode: string;
  reason: string; remarks: string;
  inventoryReversed: boolean; paymentReversed: boolean; accountingReversed: boolean; customerLedgerReversed: boolean; loyaltyReversed: boolean; journalRef: string;
  approvedBy: number | null; approvedAt: string | null; approvalNote: string;
  itemCount: number; createdAt: string;
  lines: SalesCancellationDetailLine[];
  payments: SalesCancellationPaymentRow[];
  ledger: SalesCancellationLedgerRow[];
  voucher: SalesCancellationVoucher | null;
}

/* ---- Invoice lookup (to build a cancellation against a sale) ---- */

export interface CancellationLookupLine {
  saleLineId: number; productId: number; productName: string; sku: string; uom: string;
  qty: number; rate: number; taxAmount: number; value: number;
  batchNo: string; mfgDate: string; expiryDate: string; serials: string[];
}
export interface CancellationLookupPayment { mode: string; amount: number; reference: string }
export interface CancellationLookupSale {
  id: number; invoiceNo: string; saleDate: string; channel: string; warehouse: string;
  customerId: number | null; customerName: string; customerPhone: string;
  subtotal: number; taxableValue: number; taxTotal: number; total: number; amountPaid: number; paymentMode: string; paymentStatus: string;
  cancellable: boolean; blockReason: string;
  lines: CancellationLookupLine[];
  payments: CancellationLookupPayment[];
}
export interface CancellationInvoiceMatch {
  id: number; invoiceNo: string; saleDate: string; customerName: string; channel: string; total: number; itemCount: number; status: string;
}
