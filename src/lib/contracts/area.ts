import { z } from "zod";

/** Area Config — Branch-scoped physical/operational areas (standalone master,
 * no storage/processing sub-config or transaction integration in this pass). */

export const AREA_STATUSES = ["Active", "Inactive"] as const;
export type AreaStatus = (typeof AREA_STATUSES)[number];

export const AREA_TYPE_OPTS = ["Storage", "Processing", "WIP", "Finished Goods", "Rejection/Waste", "Quarantine", "Packing", "Dispatch", "Other"] as const;
export type AreaType = (typeof AREA_TYPE_OPTS)[number];

export interface AreaDto {
  id: number; businessId: number | null; branchId: number; branchName: string | null;
  code: string; name: string; type: AreaType | string;
  parentAreaId: number | null; parentAreaName: string | null;
  description: string | null; status: AreaStatus;
}
export interface AreaRow {
  id: number; code: string; name: string; branchId: number; branchName: string | null;
  type: AreaType | string; parentAreaId: number | null; parentAreaName: string | null;
  childCount: number; status: AreaStatus; createdAt: string;
}

export const AreaSaveSchema = z.object({
  id: z.coerce.number().int().optional(),
  branchId: z.coerce.number().int().positive("Branch is required."),
  code: z.string().trim().min(1, "Area code is required.").max(30),
  name: z.string().trim().min(1, "Area name is required.").max(150),
  type: z.enum(AREA_TYPE_OPTS, { message: "Area type is required." }),
  parentAreaId: z.coerce.number().int().nullish(),
  description: z.string().max(1000).nullish(),
  status: z.enum(AREA_STATUSES).default("Active"),
});
export type AreaSaveInput = z.infer<typeof AreaSaveSchema>;

export const AreaStatusSchema = z.object({ status: z.enum(AREA_STATUSES) });
