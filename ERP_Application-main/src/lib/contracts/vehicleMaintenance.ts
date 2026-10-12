import { z } from "zod";

/**
 * Vehicle Maintenance Management — additive over VehicleMaster/DriverMaster/
 * VehicleTrip/Product/Supplier (all referenced by id, never duplicated).
 * "Current KM" is resolved live from the latest completed VehicleTrip's
 * endOdometer (src/lib/transport/vehicleMaintenance.ts) — no second odometer
 * value is stored anywhere in this module.
 */

export const MAINTENANCE_TYPE_SUGGESTIONS = [
  "Periodic Service", "Engine Oil Change", "Oil Filter Replacement", "Air Filter Replacement",
  "Brake Inspection", "Brake Service", "Coolant Check", "Battery Check", "Greasing", "General Inspection", "Repair",
] as const;

export const BREAKDOWN_TYPE_OPTS = [
  "Engine Breakdown", "Brake Failure", "Tyre-related Issue", "Electrical Problem", "Battery Failure",
  "Transmission Problem", "Cooling System Problem", "Suspension Problem", "Other Mechanical Failure",
] as const;

export const TRIGGER_TYPE_OPTS = ["Date", "KM", "Both"] as const;
export const PRIORITY_OPTS = ["Low", "Normal", "High", "Critical"] as const;
export const SCHEDULE_STATUS_OPTS = ["Active", "Inactive"] as const;
export const MAINTENANCE_STATUS_OPTS = ["Draft", "InProgress", "Completed", "Cancelled"] as const;
export const BREAKDOWN_STATUS_OPTS = ["Reported", "Inspection", "RepairInProgress", "Testing", "Completed", "Cancelled"] as const;
export const MAINTENANCE_CATEGORY_OPTS = ["Preventive", "Repair"] as const;

export type DueStatus = "Upcoming" | "Due" | "Overdue" | "Not Set";

const itemLine = z.object({
  productId: z.coerce.number().int().positive().optional().nullable(),
  itemName: z.string().trim().min(1, "Item name is required.").max(200),
  qty: z.coerce.number().min(0).default(1),
  uom: z.string().trim().max(20).optional().nullable(),
  rate: z.coerce.number().min(0).default(0),
  remarks: z.string().trim().max(300).optional().nullable(),
});
const labourLine = z.object({
  description: z.string().trim().min(1, "Description is required.").max(200),
  hours: z.coerce.number().min(0).optional().nullable(),
  rate: z.coerce.number().min(0).default(0),
  technician: z.string().trim().max(150).optional().nullable(),
  remarks: z.string().trim().max(300).optional().nullable(),
});
export type ItemLineInput = z.infer<typeof itemLine>;
export type LabourLineInput = z.infer<typeof labourLine>;

/* --------------------------------------------------------- schedule */
export const scheduleInput = z.object({
  vehicleId: z.coerce.number().int().positive("Vehicle is required."),
  maintenanceType: z.string().trim().min(1, "Maintenance type is required.").max(60),
  triggerType: z.enum(TRIGGER_TYPE_OPTS).default("KM"),
  intervalKm: z.coerce.number().min(0).optional().nullable(),
  intervalMonths: z.coerce.number().int().min(0).optional().nullable(),
  lastServiceDate: z.string().trim().max(20).optional().nullable(),
  lastServiceKm: z.coerce.number().min(0).optional().nullable(),
  nextDueDate: z.string().trim().max(20).optional().nullable(),
  nextDueKm: z.coerce.number().min(0).optional().nullable(),
  alertBeforeDays: z.coerce.number().int().min(0).optional().nullable(),
  alertBeforeKm: z.coerce.number().min(0).optional().nullable(),
  status: z.enum(SCHEDULE_STATUS_OPTS).default("Active"),
  remarks: z.string().trim().max(2000).optional().nullable(),
}).superRefine((v, ctx) => {
  if ((v.triggerType === "KM" || v.triggerType === "Both") && !v.intervalKm) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["intervalKm"], message: "KM interval is required for this trigger type." });
  if ((v.triggerType === "Date" || v.triggerType === "Both") && !v.intervalMonths) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["intervalMonths"], message: "Month interval is required for this trigger type." });
});
export type ScheduleInput = z.infer<typeof scheduleInput>;

export interface ScheduleRow {
  id: number; scheduleNo: string; vehicleId: number; vehicleNo: string;
  maintenanceType: string; triggerType: string;
  lastServiceDate: string | null; lastServiceKm: number | null;
  nextDueDate: string | null; nextDueKm: number | null;
  status: string; dueStatus: DueStatus; dueInKm: number | null; dueInDays: number | null;
  currentKm: number | null;
  remarks: string | null;
}

/* ------------------------------------------------------- maintenance */
export const maintenanceInput = z.object({
  vehicleId: z.coerce.number().int().positive("Vehicle is required."),
  scheduleId: z.coerce.number().int().positive().optional().nullable(),
  maintenanceType: z.string().trim().min(1, "Maintenance type is required.").max(60),
  maintenanceCategory: z.enum(MAINTENANCE_CATEGORY_OPTS).default("Preventive"),
  serviceDate: z.string().trim().min(1, "Service date is required.").max(20),
  odometer: z.coerce.number().min(0).optional().nullable(),
  workshopId: z.coerce.number().int().positive().optional().nullable(),
  workshopName: z.string().trim().max(200).optional().nullable(),
  mechanic: z.string().trim().max(150).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  workPerformed: z.string().trim().max(2000).optional().nullable(),
  workshopCost: z.coerce.number().min(0).default(0),
  otherCost: z.coerce.number().min(0).default(0),
  nextDueDate: z.string().trim().max(20).optional().nullable(),
  nextDueKm: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  items: z.array(itemLine).default([]),
  labour: z.array(labourLine).default([]),
});
export type MaintenanceInput = z.infer<typeof maintenanceInput>;

export const maintenanceCompleteInput = z.object({
  odometer: z.coerce.number().min(0).optional().nullable(),
  nextDueDate: z.string().trim().max(20).optional().nullable(),
  nextDueKm: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export const cancelInput = z.object({ cancellationReason: z.string().trim().min(1, "A reason is required.").max(1000) });

export interface MaintenanceRow {
  id: number; maintenanceNo: string; vehicleId: number; vehicleNo: string;
  maintenanceType: string; maintenanceCategory: string; serviceDate: string; odometer: number | null;
  workshopName: string | null; totalCost: number; status: string;
  nextDueDate: string | null; nextDueKm: number | null;
  createdByName: string | null; createdAt: string;
}
export interface MaintenanceLineOut { id: number; productId: number | null; itemName: string; qty: number; uom: string | null; rate: number; amount: number; remarks: string | null }
export interface LabourLineOut { id: number; description: string; hours: number | null; rate: number; amount: number; technician: string | null; remarks: string | null }
export interface MaintenanceDetail extends MaintenanceRow {
  scheduleId: number | null; mechanic: string | null; description: string | null; workPerformed: string | null;
  partsCost: number; labourCost: number; workshopCost: number; otherCost: number;
  remarks: string | null; items: MaintenanceLineOut[]; labour: LabourLineOut[];
  updatedByName: string | null; updatedAt: string;
  cancelledByName: string | null; cancelledAt: string | null; cancellationReason: string | null;
}

/* --------------------------------------------------------- breakdown */
export const breakdownInput = z.object({
  vehicleId: z.coerce.number().int().positive("Vehicle is required."),
  driverId: z.coerce.number().int().positive().optional().nullable(),
  tripId: z.coerce.number().int().positive().optional().nullable(),
  breakdownDate: z.string().trim().min(1, "Breakdown date is required.").max(30),
  odometer: z.coerce.number().min(0).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  breakdownType: z.string().trim().min(1, "Breakdown type is required.").max(60),
  problemDescription: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(PRIORITY_OPTS).default("Normal"),
  workshopId: z.coerce.number().int().positive().optional().nullable(),
  workshopName: z.string().trim().max(200).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});
export type BreakdownInput = z.infer<typeof breakdownInput>;

export const breakdownStatusInput = z.object({
  action: z.enum(["inspect", "startRepair", "test", "complete", "cancel"]),
  diagnosisNotes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(itemLine).optional(),
  labour: z.array(labourLine).optional(),
  otherCost: z.coerce.number().min(0).optional(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  cancellationReason: z.string().trim().max(1000).optional().nullable(),
});

export interface BreakdownRow {
  id: number; breakdownNo: string; vehicleId: number; vehicleNo: string;
  driverId: number | null; driverName: string | null; tripId: number | null; tripNo: string | null;
  breakdownDate: string; breakdownType: string; priority: string; status: string; totalCost: number;
  location: string | null; createdAt: string;
}
export interface BreakdownDetail extends BreakdownRow {
  odometer: number | null; problemDescription: string | null; diagnosisNotes: string | null;
  workshopId: number | null; workshopName: string | null;
  partsCost: number; labourCost: number; otherCost: number;
  items: MaintenanceLineOut[]; labour: LabourLineOut[];
  releasedAt: string | null; closedAt: string | null; remarks: string | null;
  createdByName: string | null; updatedByName: string | null; updatedAt: string;
  cancelledByName: string | null; cancelledAt: string | null; cancellationReason: string | null;
}
