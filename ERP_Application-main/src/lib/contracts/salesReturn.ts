import { z } from "zod";

/**
 * Shared API contract for the Sales Return module — the single source of truth for
 * the request/response shapes crossing the UI ↔ API boundary (and any future
 * mobile / third-party client).
 *
 * Convention (see `src/lib/contracts`):
 *  - REQUEST bodies are Zod schemas → validated at the route + the type is inferred
 *    (`z.infer`) so the server and the client agree on what is sent.
 *  - RESPONSE DTOs are exported interfaces; the route annotates its payload with
 *    them so the server is forced to conform, and the client imports the same type
 *    instead of re-declaring it (no silent drift).
 */

/* ----------------------------------------------------------- request -- */

export const INVENTORY_HANDLINGS = ["good", "damaged", "expired", "vendor", "scrap"] as const;

export const SalesReturnLineInputSchema = z.object({
  saleLineId: z.coerce.number().int().positive(),
  returnQty: z.coerce.number().nonnegative(),
  reason: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  inventoryHandling: z.enum(INVENTORY_HANDLINGS).optional(),
});

export const SalesReturnCreateSchema = z.object({
  saleId: z.coerce.number().int().positive(),
  refundMode: z.string().trim().optional(),
  refundRef: z.string().trim().optional(),
  refundRemarks: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  lines: z.array(SalesReturnLineInputSchema).min(1, "Select at least one product to return."),
});
export type SalesReturnCreateInput = z.infer<typeof SalesReturnCreateSchema>;
export type SalesReturnLineInput = z.infer<typeof SalesReturnLineInputSchema>;

/* ---------------------------------------------------------- responses -- */

export type SalesReturnStatus = "Draft" | "Pending" | "Approved" | "Rejected" | "Completed";

export interface SalesReturnRow {
  id: number; returnNo: string; returnDate: string; invoiceNo: string; customerName: string;
  itemCount: number; refundAmount: number; refundMode: string; status: string; createdAt: string;
}
export interface SalesReturnListStats { total: number; pending: number; refundValue: number; }
export interface SalesReturnListResponse { ok: true; rows: SalesReturnRow[]; stats: SalesReturnListStats; }

export interface SalesReturnDetailLine {
  id: number; productName: string; sku: string; soldQty: number; returnQty: number; rate: number;
  discAmount: number; taxAmount: number; returnValue: number; reason: string; remarks: string;
  inventoryHandling: string; batchNo: string; mfgDate: string; expiryDate: string;
}
// One inventory-ledger movement raised by the return (the stock-restore log).
export interface SalesReturnLedgerRow {
  id: number; productName: string; sku: string; txnType: string; direction: string;
  qty: number; warehouse: string; batchNo: string; balanceQty: number; txnDate: string;
}
// One debit/credit line of the posted accounting voucher (GL reversal log).
export interface SalesReturnVoucherLine { code: string; name: string; debit: number; credit: number; narration: string }
export interface SalesReturnVoucher { voucherNo: string; voucherType: string; date: string; narration: string; totalDebit: number; totalCredit: number; lines: SalesReturnVoucherLine[] }
// Credit note / store credit issued for the refund (when refund mode is store credit / credit note).
export interface SalesReturnCreditNote { creditNo: string; type: string; amount: number; balance: number; status: string; createdAt: string }

export interface SalesReturnDetail {
  id: number; returnNo: string; returnDate: string; status: string;
  invoiceNo: string; customerName: string; customerPhone: string;
  grossAmount: number; discountAdj: number; taxAdj: number; refundAmount: number;
  refundMode: string; refundRef: string; refundRemarks: string;
  approvedBy: number | null; approvedAt: string | null; approvalNote: string;
  itemCount: number; notes: string; createdAt: string;
  lines: SalesReturnDetailLine[];
  ledger: SalesReturnLedgerRow[];
  voucher: SalesReturnVoucher | null;
  creditNote: SalesReturnCreditNote | null;
}

export interface InvoiceLookupLine {
  saleLineId: number; productId: number; productName: string; sku: string; uom: string;
  soldQty: number; alreadyReturned: number; returnableQty: number;
  rate: number; discAmount: number; taxPct: number; taxAmount: number; value: number;
  batchNo: string; mfgDate: string; expiryDate: string;
}
export interface InvoiceLookupSale {
  id: number; invoiceNo: string; saleDate: string; warehouse: string;
  customerId: number | null; customerName: string; customerPhone: string;
  subtotal: number; itemDiscount: number; billDiscount: number; taxableValue: number; taxTotal: number; total: number;
  lines: InvoiceLookupLine[];
}
export interface InvoiceMatch {
  id: number; invoiceNo: string; saleDate: string; customerName: string; customerPhone: string; total: number; itemCount: number;
}
