import { z } from "zod";

/**
 * Shared contract for the Opening Stock module (and the read-only Inventory
 * Ledger / Stock Position inquiries that share the inventory namespace).
 *
 * Response DTOs are the source of truth for the list / detail / inquiry shapes
 * shared by the server routes and the inventory client pages. The create/update
 * REQUEST is validated by the existing domain builder `buildDocPayload`
 * (returns a typed result or `{ error }` → 422) — that is Opening Stock's
 * request contract; only the small QR-print request is schematised here with Zod.
 */

export type OpeningStockStatus = "Draft" | "Submitted";

/* ----------------------------------------------------------------- list */
export interface OpeningStockRow {
  id: number;
  docNo: string;
  asOnDate: string;
  warehouse: string;
  status: OpeningStockStatus;
  lineCount: number;
  totalQty: number;
  totalValue: number;
  createdAt: string;
}
export interface OpeningStockListStats { total: number; draft: number; submitted: number; totalValue: number; totalQty: number }
export interface OpeningStockListResponse { ok: true; rows: OpeningStockRow[]; stats: OpeningStockListStats }

/* --------------------------------------------------------------- detail */
export interface OpeningStockDetailLine {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  uom: string;
  category: string;
  qty: number;
  mrp: number | string;
  purchasePrice: number | string;
  value: number;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  supplier: string;
  purchaseRef: string;
  purchaseDate: string;
  remarks: string;
  qrRequired: boolean;
  qrMode: "shared" | "unique";
  qrStatus: "Pending" | "Generated" | "Not Required";
  qrGeneratedCount: number;
  printedQty: number;
}
export interface OpeningStockDetail {
  id: number;
  docNo: string;
  asOnDate: string;
  warehouse: string;
  notes: string;
  status: OpeningStockStatus;
  totalQty: number;
  totalValue: number;
  lineCount: number;
  lines: OpeningStockDetailLine[];
}

/* -------------------------------------------------------------- qr gen */
export interface OpeningStockQrResponse {
  ok: true;
  message: string;
  mode: "shared" | "unique";
  count: number;
  codes: string[];
}

/* ------------------------------------------------------------- qr print */
export const OpeningStockPrintSchema = z.object({
  lineId: z.coerce.number().int().positive(),
  count: z.coerce.number().int().nonnegative().optional(),
});
export type OpeningStockPrintInput = z.infer<typeof OpeningStockPrintSchema>;
export interface OpeningStockPrintResponse {
  ok: true;
  message: string;
  codes: string[];
  line: { name: string; sku: string; mrp: number | null };
}

/* ---------------------------------------------------- inventory ledger */
export interface LedgerRow {
  id: number;
  txnDate: string;
  productName: string;
  sku: string;
  uom: string;
  qrCode: string;
  txnType: string;
  direction: "IN" | "OUT";
  qty: number;
  rate: number | null;
  value: number | null;
  sellingRate: number | null;
  sellingValue: number | null;
  balanceQty: number;
  warehouse: string;
  batchNo: string;
  refNo: string;
  createdAt: string;
}
export interface LedgerBalance {
  productId: number;
  productName: string;
  sku: string;
  uom: string;
  brand: string;
  warehouse: string;
  qtyOnHand: number;
  purchaseRate: number | null;
  sellingRate: number | null;
  value: number;
  purchaseValue: number;
  sellingValue: number;
  lastMovementAt: string | null;
}
export interface LedgerLot {
  productName: string;
  sku: string;
  uom: string;
  warehouse: string;
  batchNo: string;
  refType: string;
  refNo: string;
  receivedDate: string;
  expiryDate: string;
  qtyOnHand: number;
  purchaseRate: number | null;
  sellingRate: number | null;
  value: number;
  purchaseValue: number;
  sellingValue: number;
}
export interface LedgerStats { skuCount: number; totalQty: number; totalValue: number; totalSellingValue: number; movements: number }
export interface LedgerResponse {
  ok: true;
  rows: LedgerRow[];
  balances: LedgerBalance[];
  lots: LedgerLot[];
  stats: LedgerStats;
}

/* --------------------------------------------------- stock position */
export interface StockPositionRow { date: string; ob: number; receipt: number; ret: number; sales: number; purchaseRet: number; transfer: number; damage: number; cb: number }
export interface StockPositionProduct { id: number; name: string; sku: string; brand: string }
export interface StockPositionTotals { receipt: number; ret: number; sales: number; purchaseRet: number; transfer: number; damage: number }
export interface StockPositionResponse {
  ok: true;
  product: StockPositionProduct | null;
  rows: StockPositionRow[];
  openingBalance: number;
  closing: number;
  totals: StockPositionTotals;
}
