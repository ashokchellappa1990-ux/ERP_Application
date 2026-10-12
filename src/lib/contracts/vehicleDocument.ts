import { z } from "zod";

/**
 * Vehicle Document & Compliance — additive over VehicleMaster (referenced by
 * vehicleId only, never duplicated). One page, one nav entry, tab-based UI —
 * see VehicleDocumentComplianceHub.tsx. Renewing a document never overwrites
 * it; it creates a new VehicleDocument row linked via previousDocId, so full
 * version history is always retained (Rule 9/10).
 */

export const RENEWAL_STATUS_OPTS = ["Pending", "Initiated", "In Progress", "Submitted", "Verified", "Completed", "Rejected", "Cancelled"] as const;
export const ENFORCEMENT_MODE_OPTS = ["warning", "block"] as const;
export const DEFAULT_ALERT_DAYS = [90, 60, 30, 15, 7, 1, 0];

/* ----------------------------------------------------------- document type */
export const documentTypeInput = z.object({
  code: z.string().trim().min(1, "Code is required.").max(30),
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  applicableVehicleTypes: z.array(z.string()).default([]), // empty = all vehicle types
  mandatory: z.coerce.boolean().default(false),
  expiryRequired: z.coerce.boolean().default(true),
  renewalRequired: z.coerce.boolean().default(true),
  alertEnabled: z.coerce.boolean().default(true),
  defaultAlertDays: z.coerce.number().int().min(0).max(365).default(30),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
export type DocumentTypeInput = z.infer<typeof documentTypeInput>;
export interface DocumentTypeRow {
  id: number; code: string; name: string; description: string | null; applicableVehicleTypes: string[];
  mandatory: boolean; expiryRequired: boolean; renewalRequired: boolean; alertEnabled: boolean;
  defaultAlertDays: number; isSystem: boolean; status: string; docCount: number;
}

/* ------------------------------------------------------ mandatory config */
export const mandatoryConfigInput = z.object({
  vehicleType: z.string().trim().min(1, "Vehicle type is required.").max(60),
  documentTypeIds: z.array(z.coerce.number().int().positive()).default([]), // the set that IS mandatory for this vehicle type
});
export type MandatoryConfigInput = z.infer<typeof mandatoryConfigInput>;
export interface MandatoryConfigRow { vehicleType: string; documentTypeId: number; documentTypeName: string; mandatory: boolean }

/* ------------------------------------------------------------- document */
const attachmentInput = z.object({ fileName: z.string(), fileUrl: z.string(), fileType: z.string().nullable().optional(), size: z.coerce.number().optional() });
export type AttachmentInput = z.infer<typeof attachmentInput>;

export const vehicleDocumentInput = z.object({
  vehicleId: z.coerce.number().int().positive("Vehicle is required."),
  documentTypeId: z.coerce.number().int().positive("Document type is required."),
  documentNo: z.string().trim().max(80).optional().nullable(),
  issueDate: z.string().trim().max(30).optional().nullable(),
  expiryDate: z.string().trim().max(30).optional().nullable(),
  issuingAuthority: z.string().trim().max(150).optional().nullable(),
  placeOfIssue: z.string().trim().max(150).optional().nullable(),
  renewalRequired: z.coerce.boolean().default(true),
  renewalFrequencyMonths: z.coerce.number().int().min(0).max(120).optional().nullable(),
  cost: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  otherCharges: z.coerce.number().min(0).default(0),
  paymentDate: z.string().trim().max(30).optional().nullable(),
  paymentReference: z.string().trim().max(80).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  attachments: z.array(attachmentInput).default([]),
});
export type VehicleDocumentInput = z.infer<typeof vehicleDocumentInput>;

// Computed, not stored — derived live from expiryDate vs configured thresholds (Rule 12).
export type ComputedStatus = "Valid" | "Expiring Soon" | "Due Today" | "Expired" | "Missing" | "Renewal Pending";

export interface VehicleDocumentRow {
  id: number; vehicleId: number; vehicleNo: string; vehicleType: string | null;
  documentTypeId: number; documentTypeName: string; documentNo: string | null;
  issueDate: string | null; expiryDate: string | null; daysRemaining: number | null;
  computedStatus: ComputedStatus; dbStatus: string; versionNo: number; mandatory: boolean;
  issuingAuthority: string | null; totalCost: number; renewalStatus: string | null;
  createdByName: string | null; createdAt: string;
}
export interface AttachmentOut { id: number; fileName: string; fileUrl: string; fileType: string | null; size: number | null }
export interface VehicleDocumentDetail extends VehicleDocumentRow {
  placeOfIssue: string | null; renewalRequired: boolean; renewalFrequencyMonths: number | null;
  cost: number; tax: number; otherCharges: number; paymentDate: string | null; paymentReference: string | null;
  remarks: string | null; previousDocId: number | null; attachments: AttachmentOut[];
  updatedByName: string | null; updatedAt: string;
  cancelledByName: string | null; cancelledAt: string | null; cancellationReason: string | null;
  versions: { id: number; versionNo: number; documentNo: string | null; expiryDate: string | null; status: string; computedStatus: ComputedStatus }[];
}

export const cancelDocInput = z.object({ cancellationReason: z.string().trim().min(1, "A reason is required.").max(1000) });

/* --------------------------------------------------------------- renewal */
export const renewalInitiateInput = z.object({
  vehicleDocumentId: z.coerce.number().int().positive("Document is required."),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type RenewalInitiateInput = z.infer<typeof renewalInitiateInput>;

export const renewalUpdateInput = z.object({
  status: z.enum(RENEWAL_STATUS_OPTS),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type RenewalUpdateInput = z.infer<typeof renewalUpdateInput>;

export const renewalCompleteInput = z.object({
  newDocumentNo: z.string().trim().max(80).optional().nullable(),
  newIssueDate: z.string().trim().min(1, "Issue date is required.").max(30),
  newExpiryDate: z.string().trim().min(1, "Expiry date is required.").max(30),
  renewalDate: z.string().trim().max(30).optional().nullable(),
  renewalCost: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  otherCharges: z.coerce.number().min(0).default(0),
  issuingAuthority: z.string().trim().max(150).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  attachments: z.array(attachmentInput).default([]),
});
export type RenewalCompleteInput = z.infer<typeof renewalCompleteInput>;

export interface RenewalRow {
  id: number; vehicleDocumentId: number; vehicleNo: string; documentTypeName: string;
  currentExpiry: string | null; status: string; initiatedDate: string; renewalDate: string | null;
  newExpiryDate: string | null; totalCost: number; newDocumentId: number | null;
}

/* --------------------------------------------------------- compliance */
export const complianceConfigInput = z.object({
  checkEnabled: z.coerce.boolean().default(false),
  enforcementMode: z.enum(ENFORCEMENT_MODE_OPTS).default("warning"),
  alertDays: z.array(z.coerce.number().int().min(0).max(365)).default(DEFAULT_ALERT_DAYS),
  expiringSoonDays: z.coerce.number().int().min(1).max(365).default(30),
});
export type ComplianceConfigInput = z.infer<typeof complianceConfigInput>;
export interface ComplianceConfigRow extends ComplianceConfigInput {}

export type ComplianceStatus = "Compliant" | "Expiring Soon" | "Non-Compliant" | "Missing";
export interface VehicleComplianceRow {
  vehicleId: number; vehicleNo: string; vehicleType: string | null; status: ComplianceStatus; issues: string[];
}
export interface ComplianceResult { status: ComplianceStatus; issues: string[] }

export interface DashboardStats {
  totalVehicles: number; compliantVehicles: number; expiringSoon: number; expired: number;
  renewalsPending: number; documentsMissing: number;
  statusBreakdown: { compliant: number; expiringSoon: number; expired: number; missing: number; underRenewal: number };
  expirySummary: { today: number; next7: number; next30: number; next60: number; next90: number };
  ranking: VehicleComplianceRow[];
}
