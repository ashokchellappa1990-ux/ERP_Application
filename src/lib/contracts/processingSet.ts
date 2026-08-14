import { z } from "zod";

/**
 * Processing Set Configuration — a ONE-TIME master defining how one Raw
 * Material is normally converted into multiple Finished Goods, by expected
 * output %. Configuration only: no processing qty/lot/WIP/stock movement
 * here — a future Processing Transaction reads this to auto-calculate
 * expected output qty from the actual raw material qty processed.
 */

export const PROCESSING_SET_STATUSES = ["Active", "Inactive"] as const;
export type ProcessingSetStatus = (typeof PROCESSING_SET_STATUSES)[number];

export interface ProcessingSetOutputDto {
  id?: number;
  finishedGoodProductId: number;
  finishedGoodName: string;
  finishedGoodSku: string;
  expectedPercentage: number;
  remarks: string | null;
}

export interface ProcessingSetRow {
  id: number;
  code: string;
  name: string;
  rawMaterialProductId: number;
  rawMaterialName: string;
  outputCount: number;
  processLossPercentage: number;
  totalPercentage: number;
  status: ProcessingSetStatus;
  createdAt: string;
}
export interface ProcessingSetListResponse { ok: true; rows: ProcessingSetRow[]; rawMaterials: { id: number; name: string }[] }

export interface ProcessingSetDto {
  id: number;
  code: string;
  name: string;
  rawMaterialProductId: number;
  rawMaterialName: string;
  rawMaterialSku: string;
  rawMaterialUom: string;
  description: string | null;
  status: ProcessingSetStatus;
  outputs: ProcessingSetOutputDto[];
  processLossPercentage: number;
  totalPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export const ProcessingSetOutputSchema = z.object({
  finishedGoodProductId: z.coerce.number().int().positive("Finished good is required."),
  expectedPercentage: z.coerce.number().gt(0, "Expected % must be greater than 0.").max(100, "Expected % cannot exceed 100."),
  remarks: z.string().trim().max(300).nullish(),
});

export const ProcessingSetSaveSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().trim().min(1, "Processing Set Name is required.").max(150),
  rawMaterialProductId: z.coerce.number().int().positive("Raw Material is required."),
  description: z.string().trim().max(500).nullish(),
  status: z.enum(PROCESSING_SET_STATUSES).default("Active"),
  // Expected process loss / wastage % — NOT a Finished Good line; folds into
  // the same 100% tally so Finished Goods % + Process Loss % = 100%.
  processLossPercentage: z.coerce.number().min(0, "Process Loss % cannot be negative.").max(100, "Process Loss % cannot exceed 100.").default(0),
  outputs: z.array(ProcessingSetOutputSchema).min(1, "Add at least one Finished Good."),
}).superRefine((v, ctx) => {
  const seen = new Set<number>();
  for (const o of v.outputs) {
    if (seen.has(o.finishedGoodProductId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Finished Good already added to this Processing Set." });
      break;
    }
    seen.add(o.finishedGoodProductId);
  }
  const total = +(v.outputs.reduce((s, o) => s + o.expectedPercentage, 0) + v.processLossPercentage).toFixed(3);
  if (total !== 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: total > 100 ? "Output allocation cannot exceed 100%." : "Output allocation is incomplete. Total must be 100%." });
  }
});
export type ProcessingSetSaveInput = z.infer<typeof ProcessingSetSaveSchema>;

export const ProcessingSetStatusSchema = z.object({ status: z.enum(PROCESSING_SET_STATUSES) });

/* ---------------------------------------------------------- product picker */
export interface ManufacturingProductHit { id: number; name: string; sku: string; uom: string }
export interface ManufacturingProductsResponse { ok: true; products: ManufacturingProductHit[] }
