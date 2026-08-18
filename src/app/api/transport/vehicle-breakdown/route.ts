import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { breakdownInput, type BreakdownRow } from "@/lib/contracts/vehicleMaintenance";

const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.VehicleBreakdownWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (status && status !== "All") where.status = status;
  if (q) where.OR = [{ breakdownNo: { contains: q } }, { breakdownType: { contains: q } }];

  const rows = await prisma.vehicleBreakdown.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const driverIds = Array.from(new Set(rows.map((r) => r.driverId).filter((x): x is number => x != null)));
  const tripIds = Array.from(new Set(rows.map((r) => r.tripId).filter((x): x is number => x != null)));
  const [vehicles, drivers, trips] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
    driverIds.length ? prisma.driverMaster.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } }) : [],
    tripIds.length ? prisma.vehicleTrip.findMany({ where: { id: { in: tripIds } }, select: { id: true, tripNo: true } }) : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const dMap = new Map(drivers.map((d) => [d.id, d.name]));
  const tMap = new Map(trips.map((t) => [t.id, t.tripNo]));

  const list: BreakdownRow[] = rows.map((r) => ({
    id: r.id, breakdownNo: r.breakdownNo, vehicleId: r.vehicleId, vehicleNo: vMap.get(r.vehicleId) ?? "—",
    driverId: r.driverId, driverName: r.driverId != null ? dMap.get(r.driverId) ?? null : null,
    tripId: r.tripId, tripNo: r.tripId != null ? tMap.get(r.tripId) ?? null : null,
    breakdownDate: r.breakdownDate.toISOString(), breakdownType: r.breakdownType, priority: r.priority, status: r.status, totalCost: num(r.totalCost) ?? 0,
    location: r.location, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleBreakdown" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = breakdownInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: b.vehicleId, tenantId: user.tenantId, deletedAt: null } });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 422 });

  const seg = await resolveWriteScope(user);
  const created = await prisma.vehicleBreakdown.create({
    data: {
      tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
      breakdownNo: "TMP", vehicleId: b.vehicleId, driverId: b.driverId ?? null, tripId: b.tripId ?? null,
      breakdownDate: new Date(b.breakdownDate), odometer: b.odometer ?? null, location: b.location ?? null,
      breakdownType: b.breakdownType, problemDescription: b.problemDescription ?? null, priority: b.priority,
      workshopId: b.workshopId ?? null, workshopName: b.workshopName ?? null,
      status: "Reported", remarks: b.remarks ?? null, createdBy: user.id,
    },
  });
  const breakdownNo = `BRK-${String(created.id).padStart(6, "0")}`;
  await prisma.vehicleBreakdown.update({ where: { id: created.id }, data: { breakdownNo } });

  await writeAudit(prisma, user, { action: "vehicle_breakdown.create", entity: "VehicleBreakdown", entityId: created.id, summary: `Reported breakdown ${breakdownNo} (${b.breakdownType}) for vehicle ${vehicle.vehicleNo}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, breakdownNo, message: "Breakdown reported." }, { status: 201 });
}
