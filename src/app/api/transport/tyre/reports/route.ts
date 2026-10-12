import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { computeTyreLifeAndCost } from "@/lib/transport/tyre";

const PERM = "transport.tyre";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/transport/tyre/reports?type=register|life|cost|vehicle|inspection|failure
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const type = new URL(req.url).searchParams.get("type") ?? "register";
  const scope = await getActiveScope(user);
  const where = { ...scopeWhere(scope, { branch: true }), deletedAt: null };

  if (type === "register") {
    const rows = await prisma.tyreMaster.findMany({ where, orderBy: { id: "desc" }, take: 2000 });
    return NextResponse.json({ ok: true, rows: rows.map((r) => ({ tyreCode: r.tyreCode, brand: r.brand, size: r.size, status: r.status, purchaseDate: r.purchaseDate?.toISOString() ?? null, purchaseCost: num(r.purchaseCost), retreadCount: r.retreadCount })) });
  }

  if (type === "life" || type === "cost") {
    const tyres = await prisma.tyreMaster.findMany({ where, select: { id: true, tyreCode: true, brand: true }, take: 2000 });
    const rows = await Promise.all(tyres.map(async (t) => {
      const c = await computeTyreLifeAndCost(user.tenantId, t.id);
      return { tyreCode: t.tyreCode, brand: t.brand, ...c };
    }));
    return NextResponse.json({ ok: true, rows });
  }

  if (type === "vehicle") {
    const fittings = await prisma.tyreVehicleFitting.findMany({ where: scopeWhere(scope, { branch: true }), select: { vehicleId: true, tyreId: true, runningKm: true } });
    const byVehicle = new Map<number, { tyreIds: Set<number>; km: number }>();
    for (const f of fittings) {
      const e = byVehicle.get(f.vehicleId) ?? { tyreIds: new Set<number>(), km: 0 };
      e.tyreIds.add(f.tyreId); e.km += f.runningKm != null ? Number(f.runningKm) : 0;
      byVehicle.set(f.vehicleId, e);
    }
    const vehicleIds = Array.from(byVehicle.keys());
    const vehicles = vehicleIds.length ? await prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [];
    const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
    const rows = await Promise.all(vehicleIds.map(async (vid) => {
      const e = byVehicle.get(vid)!;
      let totalCost = 0;
      for (const tid of e.tyreIds) totalCost += (await computeTyreLifeAndCost(user.tenantId, tid)).netCost;
      return { vehicleId: vid, vehicleNo: vMap.get(vid) ?? "—", totalTyres: e.tyreIds.size, totalTyreKm: e.km, totalTyreCost: totalCost, costPerKm: e.km > 0 ? totalCost / e.km : null };
    }));
    return NextResponse.json({ ok: true, rows });
  }

  if (type === "inspection") {
    const rows = await prisma.tyreInspection.findMany({ where: scopeWhere(scope, { branch: true }), orderBy: { id: "desc" }, take: 2000 });
    const tyreIds = Array.from(new Set(rows.map((r) => r.tyreId)));
    const tyres = tyreIds.length ? await prisma.tyreMaster.findMany({ where: { id: { in: tyreIds } }, select: { id: true, tyreCode: true } }) : [];
    const tMap = new Map(tyres.map((t) => [t.id, t.tyreCode]));
    return NextResponse.json({ ok: true, rows: rows.map((r) => ({ inspectionNo: r.inspectionNo, tyreCode: tMap.get(r.tyreId) ?? "—", inspectionDate: r.inspectionDate.toISOString(), treadDepthMm: num(r.treadDepthMm), pressurePsi: num(r.pressurePsi), condition: r.condition, recommendedAction: r.recommendedAction })) });
  }

  if (type === "failure") {
    const rows = await prisma.tyreInspection.findMany({ where: { ...scopeWhere(scope, { branch: true }), condition: { in: ["Damage", "Critical"] } }, orderBy: { id: "desc" }, take: 2000 });
    const tyreIds = Array.from(new Set(rows.map((r) => r.tyreId)));
    const tyres = tyreIds.length ? await prisma.tyreMaster.findMany({ where: { id: { in: tyreIds } }, select: { id: true, tyreCode: true, brand: true } }) : [];
    const tMap = new Map(tyres.map((t) => [t.id, t]));
    return NextResponse.json({ ok: true, rows: rows.map((r) => ({ tyreCode: tMap.get(r.tyreId)?.tyreCode ?? "—", brand: tMap.get(r.tyreId)?.brand ?? null, inspectionDate: r.inspectionDate.toISOString(), condition: r.condition, defectType: r.defectType, recommendedAction: r.recommendedAction })) });
  }

  return NextResponse.json({ ok: false, message: "Unknown report type." }, { status: 422 });
}
