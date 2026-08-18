import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { tripCreateInput, type TripRow } from "@/lib/contracts/vehicleTrip";

// Shares the Transport masters' permission key — same one-key-per-module
// convention already used for Vehicle/Driver/Transport Company masters and
// Vehicle-Driver Assignment (no per-action RBAC granularity exists anywhere
// in this app to plug a finer-grained key into).
const PERM = "masters.transport";

function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }
function iso(d: Date | null | undefined): string | null { return d ? d.toISOString() : null; }

// GET /api/transport/vehicle-trip — list, filterable by vehicleId, driverId,
// tripType, status, q (trip no / vehicle no / driver name). Also returns a
// `stats` summary (dashboard counters) over the full scoped set, independent
// of the current filters.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  const driverId = url.searchParams.get("driverId");
  const tripType = url.searchParams.get("tripType");
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const baseWhere = scopeWhere(scope, { branch: true });
  const where: Prisma.VehicleTripWhereInput = { ...baseWhere };
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (driverId) where.driverId = Number(driverId);
  if (tripType) where.tripType = tripType;
  if (status && status !== "All") where.status = status;
  if (q) where.OR = [{ tripNo: { contains: q } }, { materialName: { contains: q } }];

  const [rows, allForStats] = await Promise.all([
    prisma.vehicleTrip.findMany({ where, orderBy: { id: "desc" }, take: 1000 }),
    prisma.vehicleTrip.findMany({ where: baseWhere, select: { status: true, vehicleId: true, endAt: true } }),
  ]);

  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const driverIds = Array.from(new Set(rows.map((r) => r.driverId).filter((x): x is number => x != null)));
  const companyIds = Array.from(new Set(rows.map((r) => r.transportCompanyId).filter((x): x is number => x != null)));
  const createdByIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is number => x != null)));
  const [vehicles, drivers, companies, users] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
    driverIds.length ? prisma.driverMaster.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } }) : [],
    companyIds.length ? prisma.transportCompany.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }) : [],
    createdByIds.length ? prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const dMap = new Map(drivers.map((d) => [d.id, d.name]));
  const cMap = new Map(companies.map((c) => [c.id, c.name]));
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));

  const list: TripRow[] = rows.map((r) => ({
    id: r.id, tripNo: r.tripNo, tripType: r.tripType, tripPurpose: r.tripPurpose,
    vehicleId: r.vehicleId, vehicleNo: vMap.get(r.vehicleId) ?? "—",
    driverId: r.driverId, driverName: r.driverId != null ? dMap.get(r.driverId) ?? null : null,
    transportCompanyId: r.transportCompanyId, transportCompanyName: r.transportCompanyId != null ? cMap.get(r.transportCompanyId) ?? null : null,
    sourceLocation: r.sourceLocation, destinationLocation: r.destinationLocation,
    materialName: r.materialName, plannedQty: num(r.plannedQty), actualQty: num(r.actualQty), uom: r.uom,
    plannedStartAt: iso(r.plannedStartAt), actualStartAt: iso(r.actualStartAt), arrivalAt: iso(r.arrivalAt), endAt: iso(r.endAt),
    startOdometer: num(r.startOdometer), endOdometer: num(r.endOdometer), tripDistance: num(r.tripDistance),
    status: r.status,
    createdByName: r.createdBy != null ? uMap.get(r.createdBy) ?? null : null, createdAt: r.createdAt.toISOString(),
  }));

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeVehicleIds = new Set(allForStats.filter((r) => !["COMPLETED", "CANCELLED", "RETURNED"].includes(r.status)).map((r) => r.vehicleId));
  const stats = {
    planned: allForStats.filter((r) => r.status === "PLANNED").length,
    assigned: allForStats.filter((r) => r.status === "ASSIGNED").length,
    started: allForStats.filter((r) => r.status === "STARTED").length,
    inTransit: allForStats.filter((r) => r.status === "IN_TRANSIT").length,
    arrived: allForStats.filter((r) => r.status === "ARRIVED").length,
    completed: allForStats.filter((r) => r.status === "COMPLETED").length,
    completedToday: allForStats.filter((r) => r.status === "COMPLETED" && r.endAt && r.endAt >= startOfDay).length,
    completedThisWeek: allForStats.filter((r) => r.status === "COMPLETED" && r.endAt && r.endAt >= startOfWeek).length,
    completedThisMonth: allForStats.filter((r) => r.status === "COMPLETED" && r.endAt && r.endAt >= startOfMonth).length,
    onHold: allForStats.filter((r) => r.status === "ON_HOLD").length,
    cancelled: allForStats.filter((r) => r.status === "CANCELLED").length,
    returned: allForStats.filter((r) => r.status === "RETURNED").length,
    vehiclesOnTrip: activeVehicleIds.size,
  };

  return NextResponse.json({ ok: true, rows: list, stats });
}

// POST /api/transport/vehicle-trip — manual trip creation (primarily for
// "Other" movements; Sales/Purchase trips normally auto-create off Gate
// Entry, see src/lib/transport/vehicleTrip.ts, but manual creation is left
// open for backfill/edge cases too).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleTrip" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = tripCreateInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: b.vehicleId, tenantId: user.tenantId, deletedAt: null } });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 422 });
  if (vehicle.status !== "Active") return NextResponse.json({ ok: false, message: "This vehicle is not Active." }, { status: 422 });

  if (b.driverId) {
    const driver = await prisma.driverMaster.findFirst({ where: { id: b.driverId, tenantId: user.tenantId, deletedAt: null } });
    if (!driver) return NextResponse.json({ ok: false, message: "Driver not found." }, { status: 422 });
    if (driver.status !== "Active") return NextResponse.json({ ok: false, message: "This driver is not Active." }, { status: 422 });
  }

  const seg = await resolveWriteScope(user);
  const created = await prisma.vehicleTrip.create({
    data: {
      tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
      tripNo: "TMP", tripType: b.tripType, tripPurpose: b.tripPurpose ?? null,
      vehicleId: b.vehicleId, driverId: b.driverId ?? null, transportCompanyId: b.transportCompanyId ?? null,
      sourceLocation: b.sourceLocation ?? null, destinationLocation: b.destinationLocation ?? null,
      materialName: b.materialName ?? null, plannedQty: b.plannedQty ?? null, uom: b.uom ?? null,
      plannedStartAt: b.plannedStartAt ? new Date(b.plannedStartAt) : new Date(),
      status: b.driverId ? "ASSIGNED" : "PLANNED", remarks: b.remarks ?? null,
      createdBy: user.id,
    },
  });
  const tripNo = `TRIP-${String(created.id).padStart(6, "0")}`;
  await prisma.vehicleTrip.update({ where: { id: created.id }, data: { tripNo } });

  await writeAudit(prisma, user, {
    action: "vehicle_trip.create", entity: "VehicleTrip", entityId: created.id,
    summary: `Created trip ${tripNo} (${b.tripType}) for vehicle ${vehicle.vehicleNo}`,
    businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
  });
  // Manually-created trips have no Gate Entry of their own to log "GateIn"
  // (auto-created Sales/Purchase trips already get that from the gate entry
  // route) — log trip creation here so it still shows up in the vehicle's
  // shared movement history.
  try {
    await prisma.vehicleMovementHistory.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        vehicleId: b.vehicleId, eventType: "TripCreated", eventAt: new Date(),
        actorUserId: user.id, actorName: user.fullName ?? null, remarks: `${tripNo} (${b.tripType})`.slice(0, 300),
      },
    });
  } catch (e) { console.error("[vehicle-trip] movement history log failed (non-fatal)", e); }

  return NextResponse.json({ ok: true, id: created.id, tripNo, message: "Trip created." }, { status: 201 });
}
