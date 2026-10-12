import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { checkVehicleCompliance, getComplianceConfig } from "@/lib/transport/vehicleCompliance";
import type { DashboardStats, VehicleComplianceRow } from "@/lib/contracts/vehicleDocument";

const PERM = "masters.transport";

// GET — dashboard KPIs + compliance status per vehicle (Tab 1: Dashboard, and
// the data backing Tab 4: Expiry & Compliance's vehicle status cards).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const vehicles = await prisma.vehicleMaster.findMany({ where: { ...scopeWhere(scope, { branch: true }), deletedAt: null, status: "Active" }, select: { id: true, vehicleNo: true, vehicleType: true } });

  const ranking: VehicleComplianceRow[] = [];
  let compliant = 0, expiringSoon = 0, nonCompliant = 0, missing = 0;
  for (const v of vehicles) {
    const res = await checkVehicleCompliance(user.tenantId, v.id);
    if (res.status === "Compliant") compliant++;
    else if (res.status === "Expiring Soon") expiringSoon++;
    else if (res.status === "Non-Compliant") nonCompliant++;
    else missing++;
    if (res.status !== "Compliant") ranking.push({ vehicleId: v.id, vehicleNo: v.vehicleNo, vehicleType: v.vehicleType, status: res.status, issues: res.issues });
  }
  const rank: Record<string, number> = { "Non-Compliant": 0, Missing: 1, "Expiring Soon": 2 };
  ranking.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
  const in60 = new Date(now); in60.setDate(in60.getDate() + 60);
  const in90 = new Date(now); in90.setDate(in90.getDate() + 90);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);

  const vehicleIds = vehicles.map((v) => v.id);
  const docWhere = { tenantId: user.tenantId, status: "Active" as const, vehicleId: { in: vehicleIds } };
  const [today, next7, next30, next60, next90, expiredCount, renewalsPending] = await Promise.all([
    prisma.vehicleDocument.count({ where: { ...docWhere, expiryDate: { gte: now, lt: tomorrow } } }),
    prisma.vehicleDocument.count({ where: { ...docWhere, expiryDate: { gte: now, lt: in7 } } }),
    prisma.vehicleDocument.count({ where: { ...docWhere, expiryDate: { gte: now, lt: in30 } } }),
    prisma.vehicleDocument.count({ where: { ...docWhere, expiryDate: { gte: now, lt: in60 } } }),
    prisma.vehicleDocument.count({ where: { ...docWhere, expiryDate: { gte: now, lt: in90 } } }),
    prisma.vehicleDocument.count({ where: { ...docWhere, expiryDate: { lt: now } } }),
    prisma.vehicleDocumentRenewal.count({ where: { tenantId: user.tenantId, status: { notIn: ["Completed", "Rejected", "Cancelled"] } } }),
  ]);

  const stats: DashboardStats = {
    totalVehicles: vehicles.length, compliantVehicles: compliant, expiringSoon, expired: expiredCount,
    renewalsPending, documentsMissing: missing,
    statusBreakdown: { compliant, expiringSoon, expired: nonCompliant, missing, underRenewal: renewalsPending },
    expirySummary: { today, next7, next30, next60, next90 },
    ranking: ranking.slice(0, 50),
  };
  return NextResponse.json({ ok: true, ...stats });
}
