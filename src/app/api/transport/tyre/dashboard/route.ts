import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

const PERM = "transport.tyre";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const where: Prisma.TyreMasterWhereInput = { ...scopeWhere(scope, { branch: true }), deletedAt: null };

  const [byStatus, monthStart, yearStart] = await Promise.all([
    prisma.tyreMaster.groupBy({ by: ["status"], where, _count: true }),
    Promise.resolve(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    Promise.resolve(new Date(new Date().getFullYear(), 0, 1)),
  ]);
  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) statusCounts[row.status] = row._count;

  const scopeAlert = { tenantId: scope.tenantId, ...(scope.businessId ? { businessId: scope.businessId } : {}) };
  const alerts = await prisma.aiNotification.findMany({ where: { ...scopeAlert, category: { startsWith: "tyre." }, status: "unread" }, orderBy: { createdAt: "desc" }, take: 50 });

  const [repairMonth, retreadMonth, repairYear, retreadYear, purchaseYear] = await Promise.all([
    prisma.tyreRepair.aggregate({ where: { tenantId: scope.tenantId, status: { not: "Cancelled" }, repairDate: { gte: monthStart } }, _sum: { totalCost: true } }),
    prisma.tyreRetreading.aggregate({ where: { tenantId: scope.tenantId, status: "Received", sentDate: { gte: monthStart } }, _sum: { cost: true } }),
    prisma.tyreRepair.aggregate({ where: { tenantId: scope.tenantId, status: { not: "Cancelled" }, repairDate: { gte: yearStart } }, _sum: { totalCost: true } }),
    prisma.tyreRetreading.aggregate({ where: { tenantId: scope.tenantId, status: "Received", sentDate: { gte: yearStart } }, _sum: { cost: true } }),
    prisma.tyreMaster.aggregate({ where: { ...where, purchaseDate: { gte: yearStart } }, _sum: { purchaseCost: true } }),
  ]);
  const num = (v: Prisma.Decimal | null | undefined) => (v == null ? 0 : Number(v));

  return NextResponse.json({
    ok: true,
    summary: {
      total: byStatus.reduce((s, r) => s + r._count, 0),
      fitted: statusCounts["Fitted"] ?? 0, available: statusCounts["Available"] ?? 0,
      underRepair: statusCounts["Under Repair"] ?? 0, underRetreading: statusCounts["Under Retreading"] ?? 0,
      scrapped: statusCounts["Scrapped"] ?? 0, inStock: statusCounts["In Stock"] ?? 0,
      statusCounts,
    },
    alerts: alerts.map((a) => ({ id: a.id, category: a.category, severity: a.severity, title: a.title, message: a.message, href: a.href })),
    cost: {
      repairCostMonth: num(repairMonth._sum.totalCost), retreadCostMonth: num(retreadMonth._sum.cost),
      repairCostYear: num(repairYear._sum.totalCost), retreadCostYear: num(retreadYear._sum.cost),
      purchaseCostYear: num(purchaseYear._sum.purchaseCost),
    },
  });
}
