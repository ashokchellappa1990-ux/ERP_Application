import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { maintenanceInput, type MaintenanceRow } from "@/lib/contracts/vehicleMaintenance";

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
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("maintenanceCategory");
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.VehicleMaintenanceWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (status && status !== "All") where.status = status;
  if (category) where.maintenanceCategory = category;
  if (q) where.OR = [{ maintenanceNo: { contains: q } }, { maintenanceType: { contains: q } }];

  const rows = await prisma.vehicleMaintenance.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const createdByIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is number => x != null)));
  const [vehicles, users] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
    createdByIds.length ? prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));

  const list: MaintenanceRow[] = rows.map((r) => ({
    id: r.id, maintenanceNo: r.maintenanceNo, vehicleId: r.vehicleId, vehicleNo: vMap.get(r.vehicleId) ?? "—",
    maintenanceType: r.maintenanceType, maintenanceCategory: r.maintenanceCategory, serviceDate: dateStr(r.serviceDate) ?? "", odometer: num(r.odometer),
    workshopName: r.workshopName, totalCost: num(r.totalCost) ?? 0, status: r.status,
    nextDueDate: dateStr(r.nextDueDate), nextDueKm: num(r.nextDueKm),
    createdByName: r.createdBy != null ? uMap.get(r.createdBy) ?? null : null, createdAt: r.createdAt.toISOString(),
  }));

  // Dashboard stats — computed over the full scoped set, independent of filters.
  const [allMaint, allBreak] = await Promise.all([
    prisma.vehicleMaintenance.findMany({ where: scopeWhere(scope, { branch: true }), select: { status: true, maintenanceCategory: true, totalCost: true, partsCost: true, labourCost: true, workshopCost: true, otherCost: true, createdAt: true, vehicleId: true } }),
    prisma.vehicleBreakdown.findMany({ where: scopeWhere(scope, { branch: true }), select: { status: true, vehicleId: true } }),
  ]);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const inMonth = allMaint.filter((m) => m.createdAt >= startOfMonth);
  const inYear = allMaint.filter((m) => m.createdAt >= startOfYear);
  const totalVehicles = await prisma.vehicleMaster.count({ where: { tenantId: user.tenantId, deletedAt: null } });
  const underMaintVehicleIds = new Set([
    ...allMaint.filter((m) => m.status === "InProgress").map((m) => m.vehicleId),
    ...allBreak.filter((b) => !["Completed", "Cancelled"].includes(b.status)).map((b) => b.vehicleId),
  ]);
  const stats = {
    totalVehicles, vehiclesUnderMaintenance: underMaintVehicleIds.size, vehiclesAvailable: Math.max(0, totalVehicles - underMaintVehicleIds.size),
    scheduled: 0, inProgress: allMaint.filter((m) => m.status === "InProgress").length + allBreak.filter((b) => !["Completed", "Cancelled"].includes(b.status)).length,
    completed: allMaint.filter((m) => m.status === "Completed").length,
    cancelled: allMaint.filter((m) => m.status === "Cancelled").length,
    breakdownVehicles: new Set(allBreak.filter((b) => !["Completed", "Cancelled"].includes(b.status)).map((b) => b.vehicleId)).size,
    costThisMonth: inMonth.reduce((s, m) => s + Number(m.totalCost), 0),
    costThisYear: inYear.reduce((s, m) => s + Number(m.totalCost), 0),
    partsCost: inMonth.reduce((s, m) => s + Number(m.partsCost), 0),
    labourCost: inMonth.reduce((s, m) => s + Number(m.labourCost), 0),
    workshopCost: inMonth.reduce((s, m) => s + Number(m.workshopCost), 0),
    otherCost: inMonth.reduce((s, m) => s + Number(m.otherCost), 0),
  };

  return NextResponse.json({ ok: true, rows: list, stats });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleMaintenance" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = maintenanceInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: b.vehicleId, tenantId: user.tenantId, deletedAt: null } });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 422 });

  const partsCost = b.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const labourCost = b.labour.reduce((s, l) => s + (l.hours ?? 1) * l.rate, 0);
  const totalCost = partsCost + labourCost + b.workshopCost + b.otherCost;

  const seg = await resolveWriteScope(user);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.vehicleMaintenance.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        maintenanceNo: "TMP", vehicleId: b.vehicleId, scheduleId: b.scheduleId ?? null,
        maintenanceType: b.maintenanceType, maintenanceCategory: b.maintenanceCategory,
        serviceDate: new Date(b.serviceDate), odometer: b.odometer ?? null,
        workshopId: b.workshopId ?? null, workshopName: b.workshopName ?? null, mechanic: b.mechanic ?? null,
        description: b.description ?? null, workPerformed: b.workPerformed ?? null,
        partsCost, labourCost, workshopCost: b.workshopCost, otherCost: b.otherCost, totalCost,
        nextDueDate: b.nextDueDate ? new Date(b.nextDueDate) : null, nextDueKm: b.nextDueKm ?? null,
        status: "InProgress", remarks: b.remarks ?? null, createdBy: user.id,
      },
    });
    if (b.items.length) await tx.vehicleMaintenanceItem.createMany({ data: b.items.map((i) => ({ tenantId: user.tenantId, maintenanceId: row.id, productId: i.productId ?? null, itemName: i.itemName, qty: i.qty, uom: i.uom ?? null, rate: i.rate, amount: i.qty * i.rate, remarks: i.remarks ?? null })) });
    if (b.labour.length) await tx.vehicleMaintenanceLabour.createMany({ data: b.labour.map((l) => ({ tenantId: user.tenantId, maintenanceId: row.id, description: l.description, hours: l.hours ?? null, rate: l.rate, amount: (l.hours ?? 1) * l.rate, technician: l.technician ?? null, remarks: l.remarks ?? null })) });
    return row;
  });
  const maintenanceNo = `SRV-${String(created.id).padStart(6, "0")}`;
  await prisma.vehicleMaintenance.update({ where: { id: created.id }, data: { maintenanceNo } });

  await writeAudit(prisma, user, { action: "vehicle_maintenance.create", entity: "VehicleMaintenance", entityId: created.id, summary: `Created service entry ${maintenanceNo} (${b.maintenanceType}) for vehicle ${vehicle.vehicleNo}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, maintenanceNo, message: "Service entry created." }, { status: 201 });
}
