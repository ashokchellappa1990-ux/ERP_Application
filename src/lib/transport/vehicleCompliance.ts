import { prisma } from "@/lib/db/prisma";
import type { ComplianceResult, ComplianceStatus, ComputedStatus } from "@/lib/contracts/vehicleDocument";

function dstr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }
function daysBetween(expiry: Date): number { const today = new Date(); today.setHours(0, 0, 0, 0); const e = new Date(expiry); e.setHours(0, 0, 0, 0); return Math.round((e.getTime() - today.getTime()) / 86400000); }

/** Live-computed document status — never stored (Rule 12). */
export function computeDocStatus(expiryDate: Date | string | null | undefined, expiringSoonDays: number): { status: ComputedStatus; daysRemaining: number | null } {
  if (!expiryDate) return { status: "Missing", daysRemaining: null };
  const d = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  const days = daysBetween(d);
  if (days < 0) return { status: "Expired", daysRemaining: days };
  if (days === 0) return { status: "Due Today", daysRemaining: days };
  if (days <= expiringSoonDays) return { status: "Expiring Soon", daysRemaining: days };
  return { status: "Valid", daysRemaining: days };
}

export async function getComplianceConfig(tenantId: number, businessId?: number | null, branchId?: number | null) {
  const row =
    (branchId != null ? await prisma.vehicleComplianceConfig.findFirst({ where: { tenantId, businessId: businessId ?? null, branchId } }) : null) ??
    (businessId != null ? await prisma.vehicleComplianceConfig.findFirst({ where: { tenantId, businessId, branchId: null } }) : null) ??
    (await prisma.vehicleComplianceConfig.findFirst({ where: { tenantId, businessId: null, branchId: null } }));
  const alertDays: number[] = row ? JSON.parse(row.alertDaysJson || "[]") : [90, 60, 30, 15, 7, 1, 0];
  return {
    checkEnabled: row?.checkEnabled ?? false,
    enforcementMode: row?.enforcementMode ?? "warning",
    alertDays,
    expiringSoonDays: row?.expiringSoonDays ?? 30,
  };
}

/**
 * The reusable compliance function referenced by Section 21 — callable from
 * Trip Assignment, Dispatch, Sales, Purchase, etc. Never blocks anything by
 * itself; callers decide what to do with the result based on their own
 * VehicleComplianceConfig.checkEnabled/enforcementMode read.
 */
export async function checkVehicleCompliance(tenantId: number, vehicleId: number): Promise<ComplianceResult> {
  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: vehicleId, tenantId }, select: { vehicleType: true } });
  if (!vehicle) return { status: "Missing", issues: ["Vehicle not found"] };

  const config = await getComplianceConfig(tenantId);
  const [types, overrides, docs] = await Promise.all([
    prisma.vehicleDocumentType.findMany({ where: { tenantId, status: "Active" } }),
    prisma.vehicleDocumentMandatory.findMany({ where: { tenantId } }),
    prisma.vehicleDocument.findMany({ where: { tenantId, vehicleId, status: "Active" }, orderBy: { id: "desc" } }),
  ]);

  const overrideMap = new Map(overrides.filter((o) => o.vehicleType === vehicle.vehicleType).map((o) => [o.documentTypeId, o.mandatory]));
  const mandatoryTypes = types.filter((t) => {
    const applicable = !t.applicableVehicleTypes || (t.applicableVehicleTypes.split(",").map((x) => x.trim()).filter(Boolean).length === 0) ||
      t.applicableVehicleTypes.split(",").map((x) => x.trim()).includes(vehicle.vehicleType ?? "");
    if (!applicable) return false;
    return overrideMap.has(t.id) ? overrideMap.get(t.id) : t.mandatory;
  });

  // Latest Active document per type (highest versionNo / id wins).
  const latestByType = new Map<number, (typeof docs)[number]>();
  for (const d of docs) if (!latestByType.has(d.documentTypeId)) latestByType.set(d.documentTypeId, d);

  const issues: string[] = [];
  let worst: ComplianceStatus = "Compliant";
  const rank: Record<ComplianceStatus, number> = { Compliant: 0, "Expiring Soon": 1, Missing: 2, "Non-Compliant": 3 };
  const escalate = (s: ComplianceStatus) => { if (rank[s] > rank[worst]) worst = s; };

  for (const t of mandatoryTypes) {
    const doc = latestByType.get(t.id);
    if (!doc) { issues.push(`${t.name} not available`); escalate("Missing"); continue; }
    const { status } = computeDocStatus(doc.expiryDate, config.expiringSoonDays);
    if (status === "Expired") { issues.push(`${t.name} expired`); escalate("Non-Compliant"); }
    else if (status === "Due Today") { issues.push(`${t.name} expires today`); escalate("Non-Compliant"); }
    else if (status === "Expiring Soon") {
      const { daysRemaining } = computeDocStatus(doc.expiryDate, config.expiringSoonDays);
      issues.push(`${t.name} expires in ${daysRemaining} days`);
      escalate("Expiring Soon");
    }
  }

  return { status: worst, issues: issues.length ? issues : ["All mandatory documents are valid."] };
}

export { dstr };
