import { z } from "zod";

/**
 * Sales Target (Sales Performance Management) — shared contracts. EVERYTHING here is
 * config-driven: dimensions, target types, periods, distribution methods, approval and
 * traffic-lights are registries + a config row, never hardcoded business rules.
 *
 * FY month buckets m1..m12 = Apr..Mar (matches the Budget module).
 */

export const MONTH_KEYS = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12"] as const;
export type MonthKey = (typeof MONTH_KEYS)[number];
export const MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

/* ------------------------------------------------------------ dimensions -- */
/** kind drives how achievement is measured; computable=false → planning-only (achievement deferred). */
export type DimKind = "business" | "branch" | "user" | "customer" | "custValue" | "product" | "prodValue" | "saleValue" | "geo" | "gl";
export interface DimensionDef { key: string; label: string; kind: DimKind; computable: boolean; picker?: "branch" | "user" | "customer" | "customerCategory" | "product" | "productCategory" | "brand" | "channel" | "state" | "city" | "costcentre" | "profitcentre" }

export const DIMENSIONS: DimensionDef[] = [
  { key: "business", label: "Business", kind: "business", computable: true },
  { key: "branch", label: "Branch", kind: "branch", computable: true, picker: "branch" },
  { key: "salesoffice", label: "Sales Office", kind: "branch", computable: true, picker: "branch" },
  { key: "store", label: "Retail Store", kind: "branch", computable: true, picker: "branch" },
  { key: "executive", label: "Sales Executive", kind: "user", computable: true, picker: "user" },
  { key: "customer", label: "Customer", kind: "customer", computable: true, picker: "customer" },
  { key: "customerCategory", label: "Customer Category", kind: "custValue", computable: true, picker: "customerCategory" },
  { key: "product", label: "Product", kind: "product", computable: true, picker: "product" },
  { key: "productCategory", label: "Product Category", kind: "prodValue", computable: true, picker: "productCategory" },
  { key: "brand", label: "Brand", kind: "prodValue", computable: true, picker: "brand" },
  { key: "channel", label: "Sales Channel", kind: "saleValue", computable: true, picker: "channel" },
  { key: "region", label: "Region", kind: "geo", computable: true, picker: "state" },
  { key: "state", label: "State", kind: "geo", computable: true, picker: "state" },
  { key: "city", label: "City", kind: "geo", computable: true, picker: "city" },
  { key: "costcentre", label: "Cost Centre", kind: "gl", computable: false, picker: "costcentre" },
  { key: "profitcentre", label: "Profit Centre", kind: "gl", computable: false, picker: "profitcentre" },
];
export const dimensionDef = (k: string) => DIMENSIONS.find((d) => d.key === k);

/* ---------------------------------------------------------- target types -- */
export type TargetUnit = "money" | "qty" | "percent" | "count";
export type TargetBase = "sale" | "line" | "order" | "customer";
export interface TargetTypeDef { key: string; label: string; unit: TargetUnit; base: TargetBase; computable?: boolean }

export const TARGET_TYPES: TargetTypeDef[] = [
  { key: "salesValue", label: "Sales Value", unit: "money", base: "sale" },
  { key: "salesQty", label: "Sales Quantity", unit: "qty", base: "line" },
  { key: "grossSales", label: "Gross Sales", unit: "money", base: "sale" },
  { key: "netSales", label: "Net Sales", unit: "money", base: "sale" },
  { key: "grossProfit", label: "Gross Profit", unit: "money", base: "sale" },
  { key: "netProfit", label: "Net Profit", unit: "money", base: "sale", computable: false },
  { key: "marginPct", label: "Margin %", unit: "percent", base: "sale" },
  { key: "invoiceCount", label: "Invoice Count", unit: "count", base: "sale" },
  { key: "orderCount", label: "Sales Order Count", unit: "count", base: "order" },
  { key: "newCustomers", label: "New Customers", unit: "count", base: "customer" },
  { key: "repeatCustomers", label: "Repeat Customers", unit: "count", base: "customer" },
  { key: "productQty", label: "Product Quantity", unit: "qty", base: "line" },
  { key: "productRevenue", label: "Product Revenue", unit: "money", base: "line" },
  { key: "categoryRevenue", label: "Category Revenue", unit: "money", base: "line" },
  { key: "brandRevenue", label: "Brand Revenue", unit: "money", base: "line" },
  { key: "avgInvoiceValue", label: "Average Invoice Value", unit: "money", base: "sale" },
  { key: "avgOrderValue", label: "Average Order Value", unit: "money", base: "order" },
  { key: "customerAcquisition", label: "Customer Acquisition", unit: "count", base: "customer" },
];
export const targetTypeDef = (k: string) => TARGET_TYPES.find((t) => t.key === k);

export const PERIODS = [
  { key: "annual", label: "Annual" }, { key: "halfyearly", label: "Half Yearly" }, { key: "quarterly", label: "Quarterly" },
  { key: "monthly", label: "Monthly" }, { key: "weekly", label: "Weekly" }, { key: "daily", label: "Daily" }, { key: "custom", label: "Custom Period" },
] as const;
export const DISTRIBUTIONS = [
  { key: "equal", label: "Equal" }, { key: "percentage", label: "Percentage Based" }, { key: "historical", label: "Historical Sales Based" },
  { key: "seasonal", label: "Seasonal" }, { key: "manual", label: "Manual" },
] as const;

/* -------------------------------------------------------------- statuses -- */
export const TARGET_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Returned", "Locked", "Completed", "Cancelled"] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];
/** Allowed next statuses per action. Approved targets are read-only (edit only via Revision). */
export const TARGET_NEXT: Record<TargetStatus, Partial<Record<string, TargetStatus>>> = {
  Draft: { submit: "Submitted", cancel: "Cancelled" },
  Returned: { submit: "Submitted", cancel: "Cancelled" },
  Submitted: { approve: "Approved", reject: "Rejected", return: "Returned" },
  Rejected: { reopen: "Draft", cancel: "Cancelled" },
  Approved: { lock: "Locked", complete: "Completed", cancel: "Cancelled" },
  Locked: { complete: "Completed", cancel: "Cancelled" },
  Completed: {},
  Cancelled: {},
};
export const isEditable = (s: string) => s === "Draft" || s === "Returned";
export const isLocked = (s: string) => s === "Approved" || s === "Locked" || s === "Completed";

/* --------------------------------------------------------- traffic light -- */
export interface TrafficCfg { green: number; blue: number; yellow: number; orange: number }
export type TrafficBand = "green" | "blue" | "yellow" | "orange" | "red";
export function trafficLight(pct: number, cfg?: Partial<TrafficCfg>): { band: TrafficBand; label: string } {
  const t = { green: 100, blue: 90, yellow: 75, orange: 50, ...(cfg || {}) };
  if (pct >= t.green) return { band: "green", label: "On/Above Target" };
  if (pct >= t.blue) return { band: "blue", label: "Near Target" };
  if (pct >= t.yellow) return { band: "yellow", label: "Behind" };
  if (pct >= t.orange) return { band: "orange", label: "At Risk" };
  return { band: "red", label: "Critical" };
}

/* --------------------------------------------------------------- config -- */
export interface TargetConfig {
  dimensionsEnabled: string[];
  targetTypesEnabled: string[];
  periodsEnabled: string[];
  distributionsEnabled: string[];
  approvalEnabled: boolean;
  approvalThreshold: number;
  approverRole: string;
  seasonalWeights: number[];        // 12, FY order (Apr..Mar)
  trafficLight: TrafficCfg;
  notifyBelowThresholdPct: number;
  numberPrefix: string;
  numberPadding: number;
}
export const DEFAULT_TARGET_CONFIG: TargetConfig = {
  dimensionsEnabled: DIMENSIONS.map((d) => d.key),
  targetTypesEnabled: TARGET_TYPES.map((t) => t.key),
  periodsEnabled: PERIODS.map((p) => p.key),
  distributionsEnabled: DISTRIBUTIONS.map((d) => d.key),
  approvalEnabled: true,
  approvalThreshold: 1_000_000,
  approverRole: "Sales Manager",
  seasonalWeights: Array(12).fill(100 / 12),
  trafficLight: { green: 100, blue: 90, yellow: 75, orange: 50 },
  notifyBelowThresholdPct: 50,
  numberPrefix: "TGT",
  numberPadding: 4,
};
export const needsTargetApproval = (total: number, cfg: TargetConfig) => cfg.approvalEnabled && total >= cfg.approvalThreshold;

/* ------------------------------------------------------------- schemas -- */
export const targetLineInput = z.object({
  dimensionType: z.string().min(1),
  dimensionRefId: z.number().int().nullable().optional(),
  dimensionValue: z.string().nullable().optional(),
  dimensionLabel: z.string().nullable().optional(),
  parentRefId: z.number().int().nullable().optional(),
  annual: z.number().nonnegative().default(0),
  months: z.array(z.number()).length(12).optional(), // manual distribution
});
export const targetCreateInput = z.object({
  fy: z.string().min(3),
  businessId: z.number().int().nullable().optional(),
  branchId: z.number().int().nullable().optional(),
  title: z.string().max(200).optional(),
  dimension: z.string().min(1),
  targetType: z.string().min(1),
  period: z.string().min(1),
  distribution: z.string().min(1),
  currency: z.string().default("INR"),
  fromDate: z.string().nullable().optional(),
  toDate: z.string().nullable().optional(),
  remarks: z.string().optional(),
  lines: z.array(targetLineInput).min(1),
});
export const targetUpdateInput = targetCreateInput.partial().extend({ lines: z.array(targetLineInput).optional() });
export const targetActionInput = z.object({ action: z.enum(["submit", "approve", "reject", "return", "reopen", "lock", "complete", "cancel"]), remarks: z.string().optional() });
export const revisionCreateInput = z.object({
  lineId: z.number().int().nullable().optional(),
  revisionType: z.enum(["increase", "decrease"]).default("increase"),
  revisedTarget: z.number().nonnegative(),
  reason: z.string().optional(),
  effectiveDate: z.string().nullable().optional(),
  remarks: z.string().optional(),
});
export const revisionActionInput = z.object({ action: z.enum(["approve", "reject"]), remarks: z.string().optional() });

export type TargetCreateInput = z.infer<typeof targetCreateInput>;
export type TargetActionInput = z.infer<typeof targetActionInput>;
export type RevisionCreateInput = z.infer<typeof revisionCreateInput>;

/* ------------------------------------------------------------ DTO types -- */
export interface AchievementLine {
  lineId: number; dimensionType: string; label: string; computable: boolean;
  target: number; actual: number; achievementPct: number; variance: number; remaining: number;
  requiredDaily: number; requiredWeekly: number; requiredMonthly: number;
  forecast: number; forecastPct: number; growthPct: number; band: TrafficBand;
}
export interface AchievementResult {
  targetId: number; targetNo: string; targetType: string; unit: TargetUnit; period: string; fy: string;
  totalTarget: number; totalActual: number; achievementPct: number; band: TrafficBand;
  daysElapsed: number; daysTotal: number; timePct: number; lines: AchievementLine[];
}
