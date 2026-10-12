import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { fuelIssueInput, type FuelIssueRow } from "@/lib/contracts/fuelManagement";
import { getLastKnownOdometer } from "@/lib/transport/fuelManagement";
import { isVehicleUnderMaintenance } from "@/lib/transport/vehicleMaintenance";

const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }
function dateStr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  const tankId = url.searchParams.get("tankId");
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.FuelIssueWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (tankId) where.tankId = Number(tankId);
  if (status && status !== "All") where.status = status;
  if (q) where.issueNo = { contains: q };

  const rows = await prisma.fuelIssue.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId).filter((x): x is number => x != null)));
  const driverIds = Array.from(new Set(rows.map((r) => r.driverId).filter((x): x is number => x != null)));
  const tripIds = Array.from(new Set(rows.map((r) => r.tripId).filter((x): x is number => x != null)));
  const tankIds = Array.from(new Set([...rows.map((r) => r.tankId), ...rows.map((r) => r.toTankId).filter((x): x is number => x != null)]));
  const createdByIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is number => x != null)));
  const [vehicles, drivers, trips, tanks, users] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
    driverIds.length ? prisma.driverMaster.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } }) : [],
    tripIds.length ? prisma.vehicleTrip.findMany({ where: { id: { in: tripIds } }, select: { id: true, tripNo: true } }) : [],
    tankIds.length ? prisma.fuelTank.findMany({ where: { id: { in: tankIds } }, select: { id: true, tankName: true } }) : [],
    createdByIds.length ? prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const dMap = new Map(drivers.map((d) => [d.id, d.name]));
  const tMap = new Map(trips.map((t) => [t.id, t.tripNo]));
  const tkMap = new Map(tanks.map((t) => [t.id, t.tankName]));
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));

  const list: FuelIssueRow[] = rows.map((r) => ({
    id: r.id, issueNo: r.issueNo, issueDate: dateStr(r.issueDate) ?? "", transferType: r.transferType, tankId: r.tankId, tankName: tkMap.get(r.tankId) ?? "—",
    toTankId: r.toTankId, toTankName: r.toTankId != null ? tkMap.get(r.toTankId) ?? "—" : null,
    vehicleId: r.vehicleId, vehicleNo: r.vehicleId != null ? vMap.get(r.vehicleId) ?? "—" : null, driverId: r.driverId, driverName: r.driverId != null ? dMap.get(r.driverId) ?? null : null,
    tripId: r.tripId, tripNo: r.tripId != null ? tMap.get(r.tripId) ?? null : null, quantity: num(r.quantity) ?? 0, rate: num(r.rate) ?? 0, amount: num(r.amount) ?? 0,
    odometer: num(r.odometer), status: r.status, createdByName: r.createdBy != null ? uMap.get(r.createdBy) ?? null : null, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: list });
}

// POST /api/transport/fuel-issue — internal dispensing; validates + decrements tank stock.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "FuelIssue" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = fuelIssueInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  let vehicle: Awaited<ReturnType<typeof prisma.vehicleMaster.findFirst>> = null;
  const warnings: string[] = [];
  if (b.transferType === "tank_vehicle") {
    vehicle = await prisma.vehicleMaster.findFirst({ where: { id: b.vehicleId!, tenantId: user.tenantId, deletedAt: null } });
    if (!vehicle) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 422 });
    if (vehicle.status !== "Active") return NextResponse.json({ ok: false, message: "This vehicle is not Active." }, { status: 422 });

    if (b.driverId) {
      const driver = await prisma.driverMaster.findFirst({ where: { id: b.driverId, tenantId: user.tenantId, deletedAt: null } });
      if (!driver) return NextResponse.json({ ok: false, message: "Driver not found." }, { status: 422 });
      if (driver.status !== "Active") return NextResponse.json({ ok: false, message: "This driver is not Active." }, { status: 422 });
    }

    if (b.odometer != null) {
      const lastKnown = await getLastKnownOdometer(user.tenantId, b.vehicleId!);
      if (lastKnown != null && b.odometer < lastKnown) {
        if (!b.overrideOdometerWarning) return NextResponse.json({ ok: false, message: `Entered odometer (${b.odometer} KM) is less than the last known reading (${lastKnown} KM) for this vehicle.`, requiresOverride: true }, { status: 422 });
        warnings.push(`Odometer override: entered ${b.odometer} KM is below last known ${lastKnown} KM.`);
      }
    }
    if (await isVehicleUnderMaintenance(user.tenantId, b.vehicleId!)) warnings.push("This vehicle is currently under maintenance.");
  }

  const tank = await prisma.fuelTank.findFirst({ where: { id: b.tankId, tenantId: user.tenantId } });
  if (!tank) return NextResponse.json({ ok: false, message: "Fuel tank not found." }, { status: 422 });
  if (Number(tank.currentQty) < b.quantity) return NextResponse.json({ ok: false, message: `Insufficient fuel stock — ${tank.tankName} has ${tank.currentQty}L available, requested ${b.quantity}L.` }, { status: 422 });

  let toTank: Awaited<ReturnType<typeof prisma.fuelTank.findFirst>> = null;
  if (b.transferType === "tank_tank") {
    toTank = await prisma.fuelTank.findFirst({ where: { id: b.toTankId!, tenantId: user.tenantId } });
    if (!toTank) return NextResponse.json({ ok: false, message: "Destination tank not found." }, { status: 422 });
    if (toTank.status !== "Active") return NextResponse.json({ ok: false, message: "The destination tank is not Active." }, { status: 422 });
  }

  const amount = b.quantity * b.rate;
  const seg = await resolveWriteScope(user);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.fuelIssue.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        issueNo: "TMP", issueDate: new Date(b.issueDate), stationId: tank.stationId, tankId: b.tankId,
        transferType: b.transferType, toTankId: b.toTankId ?? null,
        vehicleId: b.vehicleId ?? null, driverId: b.driverId ?? null, tripId: b.tripId ?? null, fuelType: tank.fuelType,
        quantity: b.quantity, rate: b.rate, amount, odometer: b.odometer ?? null,
        dispenser: b.dispenser ?? null, operator: b.operator ?? null, status: "Confirmed", remarks: b.remarks ?? null, createdBy: user.id,
      },
    });
    await tx.fuelTank.update({ where: { id: b.tankId }, data: { currentQty: { decrement: b.quantity } } });
    if (b.transferType === "tank_tank") await tx.fuelTank.update({ where: { id: b.toTankId! }, data: { currentQty: { increment: b.quantity } } });
    return row;
  });
  const issueNo = `FI-${String(created.id).padStart(6, "0")}`;
  await prisma.fuelIssue.update({ where: { id: created.id }, data: { issueNo } });

  const summary = b.transferType === "tank_tank"
    ? `Fuel transfer ${issueNo} — ${b.quantity}L from ${tank.tankName} to ${toTank!.tankName}`
    : `Fuel issue ${issueNo} — ${b.quantity}L to vehicle ${vehicle!.vehicleNo} from ${tank.tankName}`;
  await writeAudit(prisma, user, { action: "fuel_issue.create", entity: "FuelIssue", entityId: created.id, summary, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, issueNo, warnings, message: b.transferType === "tank_tank" ? "Fuel transferred — tank stock updated." : "Fuel issued — tank stock updated." }, { status: 201 });
}
