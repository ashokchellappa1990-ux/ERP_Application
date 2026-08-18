import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { fuelEntryInput, type FuelEntryRow } from "@/lib/contracts/fuelManagement";
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
  const driverId = url.searchParams.get("driverId");
  const tripId = url.searchParams.get("tripId");
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.FuelEntryWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (driverId) where.driverId = Number(driverId);
  if (tripId) where.tripId = Number(tripId);
  if (status && status !== "All") where.status = status;
  if (q) where.OR = [{ entryNo: { contains: q } }, { fuelStationName: { contains: q } }];

  const rows = await prisma.fuelEntry.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const driverIds = Array.from(new Set(rows.map((r) => r.driverId).filter((x): x is number => x != null)));
  const tripIds = Array.from(new Set(rows.map((r) => r.tripId).filter((x): x is number => x != null)));
  const createdByIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is number => x != null)));
  const [vehicles, drivers, trips, users] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
    driverIds.length ? prisma.driverMaster.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } }) : [],
    tripIds.length ? prisma.vehicleTrip.findMany({ where: { id: { in: tripIds } }, select: { id: true, tripNo: true } }) : [],
    createdByIds.length ? prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const dMap = new Map(drivers.map((d) => [d.id, d.name]));
  const tMap = new Map(trips.map((t) => [t.id, t.tripNo]));
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));

  const list: FuelEntryRow[] = rows.map((r) => ({
    id: r.id, entryNo: r.entryNo, entryDate: dateStr(r.entryDate) ?? "", vehicleId: r.vehicleId, vehicleNo: vMap.get(r.vehicleId) ?? "—",
    driverId: r.driverId, driverName: r.driverId != null ? dMap.get(r.driverId) ?? null : null,
    tripId: r.tripId, tripNo: r.tripId != null ? tMap.get(r.tripId) ?? null : null,
    fuelType: r.fuelType, fuelStationName: r.fuelStationName, quantity: num(r.quantity) ?? 0, rate: num(r.rate) ?? 0, amount: num(r.amount) ?? 0,
    odometer: num(r.odometer), status: r.status, createdByName: r.createdBy != null ? uMap.get(r.createdBy) ?? null : null, createdAt: r.createdAt.toISOString(),
  }));

  // Dashboard summary — over the full scoped, non-cancelled set.
  const allEntries = await prisma.fuelEntry.findMany({ where: { ...scopeWhere(scope, { branch: true }), status: { not: "Cancelled" } }, select: { quantity: true, amount: true, rate: true, entryDate: true, vehicleId: true } });
  const allIssues = await prisma.fuelIssue.findMany({ where: { ...scopeWhere(scope, { branch: true }), status: { not: "Cancelled" } }, select: { quantity: true, amount: true, rate: true, issueDate: true, vehicleId: true } });
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const combined = [...allEntries.map((e) => ({ qty: Number(e.quantity), amt: Number(e.amount), rate: Number(e.rate), date: e.entryDate })), ...allIssues.map((e) => ({ qty: Number(e.quantity), amt: Number(e.amount), rate: Number(e.rate), date: e.issueDate }))];
  const thisMonth = combined.filter((c) => c.date >= startOfMonth);
  const stats = {
    totalQty: combined.reduce((s, c) => s + c.qty, 0), totalCost: combined.reduce((s, c) => s + c.amt, 0),
    avgRate: combined.length ? combined.reduce((s, c) => s + c.rate, 0) / combined.length : 0,
    qtyThisMonth: thisMonth.reduce((s, c) => s + c.qty, 0), costThisMonth: thisMonth.reduce((s, c) => s + c.amt, 0),
    transactionCount: combined.length,
  };

  return NextResponse.json({ ok: true, rows: list, stats });
}

// POST /api/transport/fuel-entry — external refuelling (no tank stock impact).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "FuelEntry" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = fuelEntryInput.safeParse(raw);
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

  // Odometer validation — warn (block unless explicitly overridden), never
  // silently accept an inconsistent reading. Vehicle-under-maintenance is a
  // warning too, not a hard block, per spec.
  const warnings: string[] = [];
  if (b.odometer != null) {
    const lastKnown = await getLastKnownOdometer(user.tenantId, b.vehicleId);
    if (lastKnown != null && b.odometer < lastKnown) {
      if (!b.overrideOdometerWarning) return NextResponse.json({ ok: false, message: `Entered odometer (${b.odometer} KM) is less than the last known reading (${lastKnown} KM) for this vehicle.`, requiresOverride: true }, { status: 422 });
      warnings.push(`Odometer override: entered ${b.odometer} KM is below last known ${lastKnown} KM.`);
    }
  }
  if (await isVehicleUnderMaintenance(user.tenantId, b.vehicleId)) warnings.push("This vehicle is currently under maintenance.");

  let fuelStationName = b.fuelStationName ?? null;
  if (b.fuelStationId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: b.fuelStationId, tenantId: user.tenantId }, select: { name: true } });
    if (supplier) fuelStationName = supplier.name;
  }

  const amount = b.quantity * b.rate;
  const seg = await resolveWriteScope(user);
  const created = await prisma.fuelEntry.create({
    data: {
      tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
      entryNo: "TMP", entryDate: new Date(b.entryDate), vehicleId: b.vehicleId, driverId: b.driverId ?? null, tripId: b.tripId ?? null,
      fuelType: b.fuelType, fuelStationId: b.fuelStationId ?? null, fuelStationName,
      quantity: b.quantity, uom: b.uom, rate: b.rate, amount, odometer: b.odometer ?? null,
      invoiceNo: b.invoiceNo ?? null, invoiceDate: b.invoiceDate ? new Date(b.invoiceDate) : null, paymentMode: b.paymentMode ?? null,
      status: "Confirmed", remarks: b.remarks ?? null, createdBy: user.id,
    },
  });
  const entryNo = `FE-${String(created.id).padStart(6, "0")}`;
  await prisma.fuelEntry.update({ where: { id: created.id }, data: { entryNo } });

  await writeAudit(prisma, user, { action: "fuel_entry.create", entity: "FuelEntry", entityId: created.id, summary: `Fuel entry ${entryNo} — ${b.quantity}${b.uom} for vehicle ${vehicle.vehicleNo}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, entryNo, warnings, message: "Fuel entry recorded." }, { status: 201 });
}
