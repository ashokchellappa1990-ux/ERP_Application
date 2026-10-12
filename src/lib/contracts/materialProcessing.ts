import { z } from "zod";

/**
 * Material Processing — the TRANSACTION that consumes Processing Set
 * Configuration as a starting template. Selecting a Processing Set COPIES its
 * configured raw material + output % into the transaction; the master is
 * never dynamically re-read afterwards (editing the master never changes an
 * existing transaction). Flow: Draft (no stock impact) -> Initiate (raw
 * material moves Source Area -> WIP) -> Complete (WIP cleared, Finished Goods
 * received) -> or Cancelled (only before Completed).
 */

export const MATERIAL_PROCESSING_STATUSES = ["Draft", "InProgress", "Completed", "Cancelled"] as const;
export type MaterialProcessingStatus = (typeof MATERIAL_PROCESSING_STATUSES)[number];

export interface MaterialProcessingOutputDto {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  configuredPercentage: number | null; // null when added ad-hoc, not from the master set
  actualPercentage: number;
  calculatedQuantity: number;
  actualQuantity: number;
  finalActualQuantity: number | null;
  outputAreaId: number;
  outputAreaName: string;
  outputType: string;
  remarks: string | null;
}

export interface MaterialProcessingRow {
  id: number;
  processingNumber: string;
  processingDate: string;
  branchName: string;
  processingAreaName: string;
  processingSetName: string;
  rawMaterialName: string;
  inputQuantity: number;
  inputUom: string;
  outputCount: number;
  status: MaterialProcessingStatus;
  createdAt: string;
}
export interface MaterialProcessingListResponse { ok: true; rows: MaterialProcessingRow[] }

export interface MaterialProcessingLedgerRow {
  id: number;
  txnDate: string;
  txnType: string;
  direction: "IN" | "OUT";
  productName: string;
  qty: number;
  warehouse: string;
  areaName: string;
  value: number | null;
}

export interface MaterialProcessingDto {
  id: number;
  processingNumber: string;
  processingDate: string;
  branchId: number | null;
  branchName: string;
  processingAreaId: number;
  processingAreaName: string;
  processingUnit: string | null;
  processingSetId: number;
  processingSetCode: string;
  processingSetName: string;
  rawMaterialProductId: number;
  rawMaterialName: string;
  rawMaterialSku: string;
  sourceAreaId: number;
  sourceAreaName: string;
  inputQuantity: number;
  inputUom: string;
  status: MaterialProcessingStatus;
  requireFullAllocation: boolean;
  totalActualOutputQty: number;
  finalOutputQty: number | null;
  processLossQty: number | null;
  fgReceiptNo: string | null;
  outputs: MaterialProcessingOutputDto[];
  ledgerMovements: MaterialProcessingLedgerRow[];
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  initiatedAt: string | null;
  initiatedByName: string | null;
  completedAt: string | null;
  completedByName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  updatedAt: string;
}

/* -------------------------------------------------------------- save (Draft/Edit) */
export const MaterialProcessingOutputInputSchema = z.object({
  id: z.coerce.number().int().optional(), // present when editing an existing line
  productId: z.coerce.number().int().positive("Finished good is required."),
  configuredPercentage: z.coerce.number().nullish(),
  actualPercentage: z.coerce.number().min(0, "Actual % cannot be negative."),
  actualQuantity: z.coerce.number().min(0, "Actual quantity cannot be negative."),
  outputAreaId: z.coerce.number().int().positive("Output storage area is required."),
  remarks: z.string().trim().max(300).nullish(),
});

export const MaterialProcessingSaveSchema = z.object({
  id: z.coerce.number().int().optional(),
  processingDate: z.string().trim().min(1, "Processing date is required."),
  branchId: z.coerce.number().int().positive().nullish(),
  processingAreaId: z.coerce.number().int().positive("Processing Area is required."),
  processingUnit: z.string().trim().max(120).nullish(),
  processingSetId: z.coerce.number().int().positive("Processing Set is required."),
  rawMaterialProductId: z.coerce.number().int().positive("Raw Material is required."),
  sourceAreaId: z.coerce.number().int().positive("Source Storage Area is required."),
  inputQuantity: z.coerce.number().gt(0, "Processing Quantity must be greater than 0."),
  inputUom: z.string().trim().max(20).nullish(),
  outputs: z.array(MaterialProcessingOutputInputSchema).min(1, "Add at least one Finished Good output."),
}).superRefine((v, ctx) => {
  const seen = new Set<number>();
  for (const o of v.outputs) {
    if (seen.has(o.productId)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "This Finished Good is already added to this transaction." }); break; }
    seen.add(o.productId);
  }
});
export type MaterialProcessingSaveInput = z.infer<typeof MaterialProcessingSaveSchema>;

/* -------------------------------------------------------------------- complete */
export const CompleteProcessSchema = z.object({
  outputs: z.array(z.object({ id: z.coerce.number().int().positive(), finalActualQuantity: z.coerce.number().min(0) })).min(1),
});
export type CompleteProcessInput = z.infer<typeof CompleteProcessSchema>;

/* --------------------------------------------------------------------- cancel */
export const CancelProcessSchema = z.object({ reason: z.string().trim().max(300).nullish() });

/* ------------------------------------------------------------- stock check */
export interface StockCheckResponse {
  ok: true;
  availableQty: number;
  wipQty: number;
  requestedQty: number;
  balanceAfterIssue: number;
  sufficient: boolean;
}
