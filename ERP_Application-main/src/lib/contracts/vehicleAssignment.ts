import { z } from "zod";

/**
 * Vehicle-Driver Assignment — the operational link between VehicleMaster and
 * DriverMaster (many-to-many over time). References both masters by id only
 * ("Do not duplicate values into the assignment master" — vehicle/driver
 * detail is joined live at read time, never copied in). See
 * prisma/schema.prisma's VehicleDriverAssignment for the storage shape.
 */

export const ASSIGNMENT_TYPE_OPTS = ["Primary", "Secondary", "Temporary", "Trip-wise"] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPE_OPTS)[number];

/** Stored statuses only — "Completed" is never written, it's derived at read
 * time from `toDate` vs today (see effectiveAssignmentStatus below), so nothing
 * needs a cron/scheduled job to keep it current. */
export const ASSIGNMENT_STORED_STATUSES = ["Active", "Cancelled"] as const;
export const ASSIGNMENT_STATUS_OPTS = ["Active", "Completed", "Cancelled"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS_OPTS)[number];

/** Active-in-DB + toDate already passed => Completed for display/rules
 * purposes, without ever writing that back. `today` param is injectable for
 * tests; defaults to "now" (as a plain date, ignoring time-of-day). */
export function effectiveAssignmentStatus(status: string, toDate: Date | string | null, today: Date = new Date()): AssignmentStatus {
  if (status !== "Active") return status as AssignmentStatus;
  if (!toDate) return "Active";
  const to = typeof toDate === "string" ? new Date(toDate) : toDate;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return to.getTime() < t.getTime() ? "Completed" : "Active";
}

export interface AssignmentVehicleInfo {
  id: number; vehicleNo: string; vehicleType: string | null; vehicleCategory: string | null;
  capacity: number; capacityUnit: string | null; ownerType: string; transportCompanyName: string | null; status: string;
}
export interface AssignmentDriverInfo {
  id: number; driverCode: string | null; name: string; phone: string | null;
  licenseNo: string | null; licenseExpiry: string | null; status: string;
}

export interface AssignmentRow {
  id: number; assignmentNo: string;
  vehicleId: number; vehicleNo: string; vehicleType: string | null;
  driverId: number; driverName: string; driverPhone: string | null;
  assignmentType: AssignmentType | string;
  isPrimary: boolean;
  fromDate: string; toDate: string | null;
  status: string; effectiveStatus: AssignmentStatus;
  remarks: string | null;
  createdByName: string | null; createdAt: string;
}

export interface AssignmentDetail extends AssignmentRow {
  vehicle: AssignmentVehicleInfo | null;
  driver: AssignmentDriverInfo | null;
  updatedByName: string | null; updatedAt: string;
  cancelledByName: string | null; cancelledAt: string | null; cancellationReason: string | null;
}

export const vehicleAssignmentInput = z.object({
  vehicleId: z.coerce.number().int().positive("Vehicle is required."),
  driverId: z.coerce.number().int().positive("Driver is required."),
  assignmentType: z.enum(ASSIGNMENT_TYPE_OPTS).default("Primary"),
  isPrimary: z.coerce.boolean().default(false),
  fromDate: z.string().trim().min(1, "From date is required.").max(20),
  toDate: z.string().trim().max(20).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
}).superRefine((v, ctx) => {
  if (v.toDate && v.toDate.trim() && v.toDate < v.fromDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toDate"], message: "To Date cannot be before From Date." });
  }
});
export type VehicleAssignmentInput = z.infer<typeof vehicleAssignmentInput>;

export const reassignInput = z.object({
  driverId: z.coerce.number().int().positive("Driver is required."),
  assignmentType: z.enum(ASSIGNMENT_TYPE_OPTS).default("Primary"),
  isPrimary: z.coerce.boolean().default(false),
  fromDate: z.string().trim().min(1, "From date is required.").max(20),
  toDate: z.string().trim().max(20).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
}).superRefine((v, ctx) => {
  if (v.toDate && v.toDate.trim() && v.toDate < v.fromDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toDate"], message: "To Date cannot be before From Date." });
  }
});
export type ReassignInput = z.infer<typeof reassignInput>;

export const assignmentCancelInput = z.object({
  cancellationReason: z.string().trim().min(1, "Cancellation reason is required.").max(1000),
});
