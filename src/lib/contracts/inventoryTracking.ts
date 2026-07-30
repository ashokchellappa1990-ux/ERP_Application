/**
 * Shared response DTOs for the Inventory Tracking screen (Batch / Expiry / Serial).
 * All read-only; data is derived from InventoryLot, InventoryLedger and QrCodeMapping.
 */

export interface BatchTrackRow {
  key: string; batchNo: string; productId: number; product: string; sku: string; warehouse: string;
  supplier: string; mfgDate: string; expiryDate: string; purchaseRate: number; sellingRate: number;
  received: number; available: number; reserved: number; sold: number; damaged: number; returned: number; dispatched: number; status: string;
}
export interface BatchTrackResponse { ok: true; rows: BatchTrackRow[] }

export interface ExpiryTrackRow {
  key: string; productId: number; product: string; sku: string; batchNo: string; warehouse: string;
  mfgDate: string; expiryDate: string; remainingDays: number | null; available: number; status: string; // Normal | Near Expiry | Expired
}
export interface ExpiryTrackResponse { ok: true; rows: ExpiryTrackRow[]; nearExpiryDays: number }

export interface SerialTrackRow {
  id: number; serialNo: string; code: string; productId: number; product: string; sku: string;
  batchNo: string; warehouse: string; status: string; purchaseRef: string; salesInvoice: string;
  customer: string; warrantyStart: string; warrantyEnd: string;
}
export interface SerialTrackResponse { ok: true; rows: SerialTrackRow[] }

export interface SerialHistoryEvent { at: string; action: string; detail: string }
export interface SerialHistoryResponse {
  ok: true;
  serial: SerialTrackRow & { mfgDate: string; expiryDate: string; activatedAt: string };
  events: SerialHistoryEvent[];
}

export interface AvailableSerial { id: number; serialNo: string; code: string }
export interface AvailableSerialResponse { ok: true; rows: AvailableSerial[] }

export interface TrackingStats {
  totalBatches: number; nearExpiry: number; expired: number;
  serialAvailable: number; serialSold: number; serialReturned: number; serialOther: number;
}
export interface TrackingStatsResponse { ok: true; stats: TrackingStats }
