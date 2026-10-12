import { z } from "zod";

/** Cost Centre & Profit Centre masters — financial dimensions with hierarchy. */

export const CENTRE_STATUSES = ["Active", "Inactive"] as const;
export type CentreStatus = (typeof CENTRE_STATUSES)[number];

export interface CostCentreDto {
  id: number; businessId: number | null; branchId: number | null; branchName: string | null;
  code: string; name: string; shortName: string | null; description: string | null; department: string | null;
  parentId: number | null; parentName: string | null; allowChildren: boolean; manager: string | null;
  budgetApplicable: boolean; status: CentreStatus; effectiveFrom: string | null; effectiveTo: string | null; remarks: string | null;
}
export interface CostCentreRow {
  id: number; code: string; name: string; shortName: string | null; department: string | null; manager: string | null;
  parentId: number | null; allowChildren: boolean; budgetApplicable: boolean; status: CentreStatus; branchName: string | null; childCount: number;
}

export interface ProfitCentreDto {
  id: number; businessId: number | null; branchId: number | null; branchName: string | null;
  code: string; name: string; description: string | null; businessUnit: string | null; division: string | null;
  parentId: number | null; parentName: string | null; manager: string | null; status: CentreStatus; effectiveDate: string | null; remarks: string | null;
}
export interface ProfitCentreRow {
  id: number; code: string; name: string; businessUnit: string | null; division: string | null; manager: string | null;
  parentId: number | null; status: CentreStatus; branchName: string | null; childCount: number;
}

/** Light option for selectors on transactions (expense/income vouchers etc.). */
export interface CentreOption { id: number; code: string; name: string }

export const CostCentreSaveSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().min(1, "Cost centre name is required."),
  shortName: z.string().max(60).nullish(),
  description: z.string().max(1000).nullish(),
  branchId: z.coerce.number().int().nullish(),
  department: z.string().max(120).nullish(),
  parentId: z.coerce.number().int().nullish(),
  allowChildren: z.boolean().default(true),
  manager: z.string().max(160).nullish(),
  budgetApplicable: z.boolean().default(false),
  status: z.enum(CENTRE_STATUSES).default("Active"),
  effectiveFrom: z.string().nullish(),
  effectiveTo: z.string().nullish(),
  remarks: z.string().max(1000).nullish(),
});
export type CostCentreSaveInput = z.infer<typeof CostCentreSaveSchema>;

export const ProfitCentreSaveSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().min(1, "Profit centre name is required."),
  description: z.string().max(1000).nullish(),
  branchId: z.coerce.number().int().nullish(),
  businessUnit: z.string().max(120).nullish(),
  division: z.string().max(120).nullish(),
  parentId: z.coerce.number().int().nullish(),
  manager: z.string().max(160).nullish(),
  status: z.enum(CENTRE_STATUSES).default("Active"),
  effectiveDate: z.string().nullish(),
  remarks: z.string().max(1000).nullish(),
});
export type ProfitCentreSaveInput = z.infer<typeof ProfitCentreSaveSchema>;

export const CentreStatusSchema = z.object({ status: z.enum(CENTRE_STATUSES) });
