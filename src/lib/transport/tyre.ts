import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentOdometer } from "@/lib/transport/vehicleMaintenance";

type Db = Prisma.TransactionClient | typeof prisma;

export { getCurrentOdometer };

/** Resolves the position-code template to use for a vehicle: match on
 * VehicleMaster.vehicleType (read-only — VehicleMaster is never written to
 * from Tyre Management), falling back to the tenant's isDefault template. */
export async function resolveTyrePositionTemplate(tenantId: number, vehicleId: number) {
  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: vehicleId, tenantId }, select: { vehicleType: true } });
  const byType = vehicle?.vehicleType
    ? await prisma.tyrePositionTemplate.findFirst({ where: { tenantId, vehicleType: vehicle.vehicleType, status: "Active" } })
    : null;
  const template = byType ?? (await prisma.tyrePositionTemplate.findFirst({ where: { tenantId, isDefault: true, status: "Active" } }));
  if (!template) return null;
  const codes = await prisma.tyrePositionCode.findMany({ where: { templateId: template.id }, orderBy: { displayOrder: "asc" } });
  return { template, codes };
}

/** Tyre life & cost, computed live from the fitting/repair/retreading/
 * warranty-claim history — never stored redundantly on TyreMaster. */
export async function computeTyreLifeAndCost(tenantId: number, tyreId: number) {
  const [tyre, fittings, repairs, retreadings, claims] = await Promise.all([
    prisma.tyreMaster.findFirst({ where: { id: tyreId, tenantId }, select: { purchaseCost: true } }),
    prisma.tyreVehicleFitting.findMany({ where: { tenantId, tyreId, status: "Removed" }, select: { runningKm: true, removedAt: true } }),
    prisma.tyreRepair.aggregate({ where: { tenantId, tyreId, status: { not: "Cancelled" } }, _sum: { totalCost: true } }),
    prisma.tyreRetreading.findMany({ where: { tenantId, tyreId, status: "Received" }, select: { cost: true, receivedDate: true } }),
    prisma.tyreWarrantyClaim.aggregate({ where: { tenantId, tyreId, status: "Settled" }, _sum: { approvedAmount: true } }),
  ]);

  const totalLifeKm = fittings.reduce((s, f) => s + (f.runningKm != null ? Number(f.runningKm) : 0), 0);
  const firstRetreadAt = retreadings.length ? retreadings.map((r) => r.receivedDate).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null : null;
  const firstLifeKm = firstRetreadAt
    ? fittings.filter((f) => f.removedAt && f.removedAt <= firstRetreadAt).reduce((s, f) => s + (f.runningKm != null ? Number(f.runningKm) : 0), 0)
    : totalLifeKm;
  const retreadLifeKm = totalLifeKm - firstLifeKm;

  const retreadCost = retreadings.reduce((s, r) => s + (r.cost != null ? Number(r.cost) : 0), 0);
  const purchaseCost = tyre?.purchaseCost != null ? Number(tyre.purchaseCost) : 0;
  const repairCost = repairs._sum.totalCost != null ? Number(repairs._sum.totalCost) : 0;
  const settledClaims = claims._sum.approvedAmount != null ? Number(claims._sum.approvedAmount) : 0;
  const netCost = purchaseCost + repairCost + retreadCost - settledClaims;
  const costPerKm = totalLifeKm > 0 ? netCost / totalLifeKm : null;

  return { lifeKm: totalLifeKm, firstLifeKm, retreadLifeKm, netCost, costPerKm };
}

/** One append-only row per lifecycle transition — the tyre-scoped, UI-facing
 * timeline (complements writeAudit, which is the tenant-wide compliance
 * trail). Never throws — a history-log failure must not block the business
 * operation it records. */
export async function logTyreMovement(
  db: Db,
  input: {
    tenantId: number; businessId?: number | null; branchId?: number | null;
    tyreId: number; vehicleId?: number | null; eventType: string; eventAt?: Date;
    positionCode?: string | null; odometer?: number | null; vendorId?: number | null; cost?: number | null;
    refEntity?: string | null; refId?: number | null;
    actorUserId?: number | null; actorName?: string | null; remarks?: string | null;
  },
): Promise<void> {
  try {
    await db.tyreMovementHistory.create({
      data: {
        tenantId: input.tenantId, businessId: input.businessId ?? null, branchId: input.branchId ?? null,
        tyreId: input.tyreId, vehicleId: input.vehicleId ?? null, eventType: input.eventType, eventAt: input.eventAt ?? new Date(),
        positionCode: input.positionCode ?? null, odometer: input.odometer ?? null, vendorId: input.vendorId ?? null, cost: input.cost ?? null,
        refEntity: input.refEntity ?? null, refId: input.refId ?? null,
        actorUserId: input.actorUserId ?? null, actorName: input.actorName ?? null, remarks: input.remarks ?? null,
      },
    });
  } catch (err) {
    console.error("[tyre-history] write failed:", input.eventType, err);
  }
}
