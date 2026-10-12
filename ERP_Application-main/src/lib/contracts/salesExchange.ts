import { z } from "zod";
import { SaleLineInputSchema } from "@/lib/contracts/sale";

/**
 * Shared API contract for the Sales Exchange module — request schemas (Zod) and
 * response DTOs crossing the UI ↔ API boundary. An exchange returns old item(s)
 * against an original invoice and issues new item(s), settling the price
 * difference. Posting reuses the return + sale legs (see `createReturn`/`createSale`).
 */

/* ----------------------------------------------------------- request -- */

export const EXCHANGE_HANDLINGS = ["good", "damaged", "quarantine"] as const;

/** A line of the original invoice being returned in the exchange. */
export const ExchangeReturnLineSchema = z.object({
  saleLineId: z.coerce.number().int().positive(),
  returnQty: z.coerce.number().positive(),
  reason: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  inventoryHandling: z.enum(EXCHANGE_HANDLINGS).optional(),
});

export const SalesExchangeCreateSchema = z.object({
  originalSaleId: z.coerce.number().int().positive().optional(),
  returnLines: z.array(ExchangeReturnLineSchema).min(1, "Select at least one item to return."),
  newLines: z.array(SaleLineInputSchema).min(1, "Add at least one new item to issue."),
  settlementMode: z.string().trim().optional(),
  settlementRef: z.string().trim().optional(),
  reason: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});
export type SalesExchangeCreateInput = z.infer<typeof SalesExchangeCreateSchema>;
export type ExchangeReturnLineInput = z.infer<typeof ExchangeReturnLineSchema>;

/* ---------------------------------------------------------- responses -- */

export type SalesExchangeStatus = "Draft" | "Pending" | "Approved" | "Rejected" | "Completed";

export interface SalesExchangeRow {
  id: number; exchangeNo: string; exchangeDate: string; invoiceNo: string; customerName: string;
  itemCount: number; returnValue: number; newSaleValue: number; priceDifference: number;
  settlementType: string; status: string; createdAt: string;
}
export interface SalesExchangeListStats { total: number; pending: number; netCollected: number; netRefunded: number; }
export interface SalesExchangeListResponse { ok: true; rows: SalesExchangeRow[]; stats: SalesExchangeListStats; }

export interface SalesExchangeDetailItem {
  id: number; side: string; productName: string; sku: string; qty: number; rate: number;
  taxPct: number; taxAmount: number; value: number; reason: string; inventoryHandling: string;
  batchNo: string; mfgDate: string; expiryDate: string;
}
export interface SalesExchangeDetail {
  id: number; exchangeNo: string; exchangeDate: string; status: string;
  invoiceNo: string; originalSaleId: number | null; channel: string;
  customerName: string; customerPhone: string;
  returnId: number | null; newSaleId: number | null;
  returnValue: number; newSaleValue: number; priceDifference: number;
  settlementType: string; settlementMode: string; settlementRef: string;
  reason: string; remarks: string;
  approvedBy: number | null; approvedAt: string | null; approvalNote: string;
  itemCount: number; createdAt: string;
  items: SalesExchangeDetailItem[];
}

/* ------------------------------------------------------- invoice lookup */
export interface ExchangeLookupLine {
  saleLineId: number; productId: number; productName: string; sku: string; uom: string;
  soldQty: number; alreadyReturned: number; exchangeableQty: number;
  rate: number; discAmount: number; taxPct: number; taxAmount: number; value: number;
  batchNo: string; mfgDate: string; expiryDate: string;
}
export interface ExchangeLookupSale {
  id: number; invoiceNo: string; saleDate: string; warehouse: string; channel: string;
  customerId: number | null; customerName: string; customerPhone: string;
  subtotal: number; itemDiscount: number; billDiscount: number; taxableValue: number; taxTotal: number; total: number;
  lines: ExchangeLookupLine[];
}
export interface ExchangeInvoiceMatch {
  id: number; invoiceNo: string; saleDate: string; customerName: string; customerPhone: string; total: number; itemCount: number;
}
/** Subset of the effective exchange config the editor needs to drive its UI. */
export interface ExchangeConfigDTO {
  exchangeAllowed: boolean; exchangeWithoutInvoice: boolean;
  allowPartialExchange: boolean; allowFullExchange: boolean;
  allowPriceDifference: boolean; refundIfLower: boolean; collectIfHigher: boolean; ignorePriceDifference: boolean;
  priceBasis: string; maxExchangeQty: number | null; maxExchangeDays: number | null;
  settlementModes: string[]; defaultSettlement: string;
  handlingModes: string[]; defaultHandling: string;
  searchToggles: Record<string, boolean>; defaultSearch: string;
  reasons: string[];
}
export interface ExchangeLookupResponse { ok: true; matches?: ExchangeInvoiceMatch[]; sale?: ExchangeLookupSale | null; config: ExchangeConfigDTO; }
