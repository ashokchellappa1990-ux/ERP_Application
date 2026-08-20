import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeData, scopeWhere } from "@/lib/auth/scope";
import { computeTyreLifeAndCost } from "@/lib/transport/tyre";

/**
 * Tyre Management alerts — reuses the in-app `aiNotification` store (deduped
 * per tyre per day), the same mechanism as Advance/Sales Target notifications,
 * so it shares the bell/notification centre without new infra.
 */

const HIGH_COST_PER_KM_THRESHOLD = 5; // currency units per km — conservative default
const INSPECTION_OVERDUE_DAYS = 30;
const WARRANTY_EXPIRING_DAYS = 30;

export async function syncTyreNotifications(scope: ActiveScope): Promise<number> {
  const period = new Date().toISOString().slice(0, 10); // one bucket per day
  const now = new Date();
  const sw = scopeWhere(scope, { branch: true });
  const rows: { category: string; severity: string; title: string; message: string; href: string; key: string }[] = [];

  const fitted = await prisma.tyreMaster.findMany({ where: { ...sw, status: "Fitted", deletedAt: null }, select: { id: true, tyreCode: true, minTreadDepthMm: true, ratedPressurePsi: true, warrantyExpiryDate: true } });

  for (const tyre of fitted) {
    const lastInspection = await prisma.tyreInspection.findFirst({ where: { tenantId: scope.tenantId, tyreId: tyre.id }, orderBy: { inspectionDate: "desc" } });

    if (lastInspection?.treadDepthMm != null && tyre.minTreadDepthMm != null && Number(lastInspection.treadDepthMm) <= Number(tyre.minTreadDepthMm)) {
      rows.push({ category: "tyre.low_tread", severity: "High", title: `Tyre ${tyre.tyreCode} — low tread depth`, message: `Tread depth ${lastInspection.treadDepthMm}mm is at or below the ${tyre.minTreadDepthMm}mm threshold.`, href: `/transport/tyre?tyreId=${tyre.id}`, key: `tyre.low_tread:${tyre.id}:${period}` });
    }
    if (lastInspection?.pressurePsi != null && tyre.ratedPressurePsi != null) {
      const variance = Math.abs(Number(lastInspection.pressurePsi) - Number(tyre.ratedPressurePsi)) / Number(tyre.ratedPressurePsi);
      if (variance > 0.15) rows.push({ category: "tyre.low_pressure", severity: "Medium", title: `Tyre ${tyre.tyreCode} — pressure out of range`, message: `Pressure ${lastInspection.pressurePsi} psi deviates >15% from rated ${tyre.ratedPressurePsi} psi.`, href: `/transport/tyre?tyreId=${tyre.id}`, key: `tyre.low_pressure:${tyre.id}:${period}` });
    }
    const daysSinceInspection = lastInspection ? Math.floor((now.getTime() - lastInspection.inspectionDate.getTime()) / 86_400_000) : Infinity;
    if (daysSinceInspection >= INSPECTION_OVERDUE_DAYS) {
      rows.push({ category: "tyre.inspection_overdue", severity: "Medium", title: `Tyre ${tyre.tyreCode} — inspection overdue`, message: lastInspection ? `Last inspected ${daysSinceInspection} days ago.` : "Never inspected since fitting.", href: `/transport/tyre/service?tyreId=${tyre.id}`, key: `tyre.inspection_overdue:${tyre.id}:${period}` });
    }
    if (tyre.warrantyExpiryDate) {
      const daysToExpiry = Math.floor((tyre.warrantyExpiryDate.getTime() - now.getTime()) / 86_400_000);
      if (daysToExpiry >= 0 && daysToExpiry <= WARRANTY_EXPIRING_DAYS) {
        rows.push({ category: "tyre.warranty_expiring", severity: "Medium", title: `Tyre ${tyre.tyreCode} — warranty expiring`, message: `Warranty expires in ${daysToExpiry} day(s).`, href: `/transport/tyre?tyreId=${tyre.id}`, key: `tyre.warranty_expiring:${tyre.id}:${period}` });
      }
    }

    const { lifeKm, costPerKm } = await computeTyreLifeAndCost(scope.tenantId, tyre.id);
    if (lifeKm > 1000 && costPerKm != null && costPerKm > HIGH_COST_PER_KM_THRESHOLD) {
      rows.push({ category: "tyre.high_cost_per_km", severity: "Low", title: `Tyre ${tyre.tyreCode} — high cost per km`, message: `Cost/km of ${costPerKm.toFixed(2)} exceeds the ${HIGH_COST_PER_KM_THRESHOLD} threshold.`, href: `/transport/tyre?tyreId=${tyre.id}`, key: `tyre.high_cost_per_km:${tyre.id}:${period}` });
    }
  }

  let created = 0;
  for (const n of rows) {
    try {
      await prisma.aiNotification.upsert({
        where: { tenantId_dedupeKey: { tenantId: scope.tenantId, dedupeKey: n.key } },
        create: { tenantId: scope.tenantId, ...scopeData(scope, { branch: true }), category: n.category, severity: n.severity, title: n.title.slice(0, 200), message: n.message.slice(0, 500), href: n.href, dedupeKey: n.key, status: "unread" },
        update: { severity: n.severity, title: n.title.slice(0, 200), message: n.message.slice(0, 500) },
      });
      created++;
    } catch { /* dedupe race — ignore */ }
  }
  return created;
}
