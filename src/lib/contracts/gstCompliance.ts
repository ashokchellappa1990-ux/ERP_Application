import { z } from "zod";

/**
 * GST Compliance & Statutory Management — contracts (Zod request schemas +
 * response DTOs). The module READS figures from existing transaction tables and
 * persists only compliance artifacts (returns / 2B import / recon / ITC / JSON /
 * filing / period-closing / validation logs).
 */

// ---------------------------------------------------------------- shared types

export type GstReturnType = "GSTR-1" | "GSTR-3B";
export type GstReturnStatus = "Draft" | "Prepared" | "Verified" | "Approved" | "ReadyForFiling" | "Filed";
export type GstSeverity = "Error" | "Warning" | "Information";
export type GstReconStatus = "Matched" | "PartiallyMatched" | "Mismatch" | "MissingInErp" | "SupplierNotFiled" | "Pending";

/** YYYY-MM period string. */
export const PeriodSchema = z.string().regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM.");

// ----------------------------------------------------------------- KPI / header

export interface GstHeader {
  gstin: string;
  legalName: string;
  stateCode: string;
  regType: string;
  filingFrequency: string;
  period: string;
  periodLabel: string;
  fromDate: string;
  toDate: string;
  returnDueDate: string;       // GSTR-3B due date (20th of next month)
  gstr1DueDate: string;        // 11th of next month
  periodLocked: boolean;
  closingStatus: string;       // Open | Verified | Locked
}

export interface GstKpis {
  totalSales: number;
  totalPurchase: number;
  taxableSales: number;
  taxablePurchase: number;
  outputCgst: number;
  outputSgst: number;
  outputIgst: number;
  inputCgst: number;
  inputSgst: number;
  inputIgst: number;
  eligibleItc: number;
  blockedItc: number;
  gstPayable: number;
  gstReceivable: number;
  pendingReconciliation: number;
  gstMismatches: number;
  returnsPending: number;
  returnsFiled: number;
  returnDueDate: string;
  filingStatus: string;
}

export interface GstNameVal { name: string; value: number }
export interface GstSeries { name: string; a: number; b: number }

export interface GstDashboard {
  header: GstHeader;
  kpis: GstKpis;
  charts: {
    monthlyCollection: GstNameVal[];   // output tax by month
    monthlyItc: GstNameVal[];          // ITC by month
    outputVsInput: GstSeries[];        // per month output vs input
    liabilityTrend: GstNameVal[];      // net liability by month
    salesVsPurchaseGst: GstSeries[];   // per month sales-gst vs purchase-gst
    filingStatus: GstNameVal[];        // counts by filing status
  };
  alerts: GstAlert[];
}

export interface GstAlert { type: string; severity: GstSeverity; message: string }

// ------------------------------------------------------------ verification

export interface GstValidationRow {
  id: number;
  sourceType: string;
  sourceId: number | null;
  docNo: string;
  docDate: string;
  partyName: string;
  checkCode: string;
  severity: GstSeverity;
  message: string;
  status: string;
  resolvedByName: string;
  resolvedAt: string;
}

export interface GstVerificationSummary {
  lastRunAt: string;
  errors: number;
  warnings: number;
  info: number;
  open: number;
  resolved: number;
  rows: GstValidationRow[];
}

export const VerifyRunSchema = z.object({ period: PeriodSchema });
export const ValidationResolveSchema = z.object({
  status: z.enum(["Ignored", "Approved", "Corrected", "Open"]),
  note: z.string().trim().max(300).optional(),
});

// ----------------------------------------------------------------------- ITC

export interface GstItcRow {
  id: number;
  supplierName: string;
  supplierGstin: string;
  invoiceNo: string;
  invoiceDate: string;
  purchaseType: string;
  gstAmount: number;
  eligibleAmount: number;
  claimedAmount: number;
  pendingAmount: number;
  blockedAmount: number;
  reverseCharge: boolean;
  itcStatus: string;
}

export interface GstItcReport {
  eligible: number;
  ineligible: number;
  blocked: number;
  pending: number;
  reverseCharge: number;
  totalGst: number;
  rows: GstItcRow[];
}

// ------------------------------------------------------------- reconciliation

export interface Gstr2bRow {
  id: number;
  supplierGstin: string;
  supplierName: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceValue: number;
  gstAmount: number;
  eligibleItc: number;
  itcStatus: string;
  matchStatus: string;
}

export interface GstReconRow {
  id: number;
  supplierGstin: string;
  supplierName: string;
  invoiceNo: string;
  invoiceDate: string;
  erpTaxable: number;
  erpGst: number;
  portalTaxable: number;
  portalGst: number;
  taxDifference: number;
  gstDifference: number;
  status: GstReconStatus;
  issue: string;
  action: string;
}

export interface GstReconResult {
  imported: number;
  matched: number;
  partially: number;
  mismatch: number;
  missingInErp: number;
  missingInPortal: number;
  rows: GstReconRow[];
  importRows: Gstr2bRow[];
}

/** A GSTR-2B invoice line accepted by the import endpoint (normalised). */
export const Gstr2bImportLineSchema = z.object({
  supplierGstin: z.string().trim().optional(),
  supplierName: z.string().trim().optional(),
  invoiceNo: z.string().trim().optional(),
  invoiceDate: z.string().trim().optional(),
  invoiceValue: z.coerce.number().optional(),
  taxableValue: z.coerce.number().optional(),
  cgst: z.coerce.number().optional(),
  sgst: z.coerce.number().optional(),
  igst: z.coerce.number().optional(),
  cess: z.coerce.number().optional(),
  itcStatus: z.string().trim().optional(),
});
export const Gstr2bImportSchema = z.object({
  period: PeriodSchema,
  source: z.enum(["JSON", "EXCEL", "API"]).default("JSON"),
  fileName: z.string().trim().optional(),
  rawJson: z.string().optional(),                 // GST-portal GSTR-2B JSON pasted/uploaded
  rows: z.array(Gstr2bImportLineSchema).optional(),
});
export const ReconResolveSchema = z.object({ decision: z.enum(["Approved", "Pending"]) });

// ------------------------------------------------------------- returns / GSTR

export interface GstReturnRow {
  id: number;
  returnType: GstReturnType;
  period: string;
  gstin: string;
  status: GstReturnStatus;
  taxableValue: number;
  outputTax: number;
  itcTotal: number;
  netLiability: number;
  jsonVersion: number;
  preparedByName: string;
  preparedAt: string;
  verifiedByName: string;
  approvedByName: string;
  updatedAt: string;
}

export interface GstReturnSectionRow {
  section: string;
  invoiceNo: string;
  invoiceDate: string;
  partyName: string;
  partyGstin: string;
  placeOfSupply: string;
  hsn: string;
  description: string;
  rate: number;
  qty: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
}

export interface GstReturnDetail extends GstReturnRow {
  fromDate: string;
  toDate: string;
  legalName: string;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  remarks: string;
  totals: unknown;            // section summary snapshot
  sections: Record<string, GstReturnSectionRow[]>;
}

export const GenerateReturnSchema = z.object({
  returnType: z.enum(["GSTR-1", "GSTR-3B"]),
  period: PeriodSchema,
});
export const ReturnTransitionSchema = z.object({
  subAction: z.enum(["prepare", "verify", "approve", "ready", "file", "reopen"]),
  arn: z.string().trim().optional(),
  remarks: z.string().trim().max(500).optional(),
});

// --------------------------------------------------------------- JSON export

export interface GstJsonExportRow {
  id: number;
  returnType: string;
  period: string;
  gstin: string;
  version: number;
  fileName: string;
  validationStatus: string;
  validationNotes: string;
  generatedByName: string;
  generatedAt: string;
  downloadCount: number;
}

export const GenerateJsonSchema = z.object({ returnId: z.coerce.number().int().positive() });

// --------------------------------------------------------------- filing / period

export interface GstFilingRow {
  id: number;
  returnType: string;
  period: string;
  gstin: string;
  arn: string;
  filingDate: string;
  jsonVersion: number;
  status: string;
  filedByName: string;
  remarks: string;
}

export interface GstPeriodRow {
  id: number | null;
  period: string;
  periodLabel: string;
  fromDate: string;
  toDate: string;
  filingStatus: string;
  closingStatus: string;
  lockedByName: string;
  lockedAt: string;
  reopenedByName: string;
  reopenReason: string;
}

export const PeriodClosingSchema = z.object({
  period: PeriodSchema,
  subAction: z.enum(["verify", "lock", "reopen"]),
  reason: z.string().trim().max(300).optional(),
});

// ----------------------------------------------------------------- reports

export interface GstRegisterRow {
  docNo: string;
  docDate: string;
  partyName: string;
  partyGstin: string;
  placeOfSupply: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
  docType?: string;
}
export interface GstHsnRow {
  hsn: string;
  description: string;
  uom: string;
  qty: number;
  rate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
}
export interface GstReport {
  key: string;
  title: string;
  columns: { key: string; label: string; money?: boolean; qty?: boolean }[];
  rows: Record<string, string | number>[];
  totals: Record<string, number>;
}

// ------------------------------------------------------------------- audit

export interface GstAuditRow {
  id: number;
  action: string;
  entity: string;
  summary: string;
  userName: string;
  at: string;
}
