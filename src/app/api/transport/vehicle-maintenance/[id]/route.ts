import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { maintenanceInput, type MaintenanceDetail } from "@/lib/contracts/vehicleMaintenance";

const PERM = "masters.transport";

function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }
function dateStr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

async function toDetail(r: NonNullable<Awaited<ReturnType<typeof prisma.vehicleMaintenance.findFirst>>>): Promise<MaintenanceDetail> {
  const [vehicle, items, labour, createdByUser, updatedByUser, cancelledByUser] = await Promise.all([
    prisma.vehicleMaster.findFirst({ where: { id: r.vehicleId }, select: { vehicleNo: true } }),
    prisma.vehicleMaintenanceItem.findMany({ where: { maintenanceId: r.id }, orderBy: { id: "asc" } }),
    prisma.vehicleMaintenanceLabour.findMany({ where: { maintenanceId: r.id }, orderBy: { id: "asc" } }),
    r.createdBy != null ? prisma.user.findFirst({ where: { id: r.createdBy }, select: { fullName: true } }) : null,
    r.updatedBy != null ? prisma.user.findFirst({ where: { id: r.updatedBy }, select: { fullName: true } }) : null,
    r.cancelledBy != null ? prisma.user.findFirst({ where: { id: r.cancelledBy }, select: { fullName: true } }) : null,
  ]);
  return {
    id: r.id, maintenanceNo: r.maintenanceNo, vehicleId: r.vehicleId, vehicleNo: vehicle?.vehicleNo ?? "—",
    maintenanceType: r.maintenanceType, maintenanceCategory: r.maintenanceCategory, serviceDate: dateStr(r.serviceDate) ?? "", odometer: num(r.odometer),
    workshopName: r.workshopName, totalCost: num(r.totalCost) ?? 0, status: r.status,
    nextDueDate: dateStr(r.nextDueDate), nextDueKm: num(r.nextDueKm),
    createdByName: createdByUser?.fullName ?? null, createdAt: r.createdAt.toISOString(),
    scheduleId: r.scheduleId, mechanic: r.mechanic, description: r.description, workPerformed: r.workPerformed,
    partsCost: num(r.partsCost) ?? 0, labourCost: num(r.labourCost) ?? 0, workshopCost: num(r.workshopCost) ?? 0, otherCost: num(r.otherCost) ?? 0,
    remarks: r.remarks,
    items: items.map((i) => ({ id: i.id, productId: i.productId, itemName: i.itemName, qty: Number(i.qty), uom: i.uom, rate: Number(i.rate), amount: Number(i.amount), remarks: i.remarks })),
    labour: labour.map((l) => ({ id: l.id, description: l.description, hours: l.hours != null ? Number(l.hours) : null, rate: Number(l.rate), amount: Number(l.amount), technician: l.technician, remarks: l.remarks })),
    updatedByName: updatedByUser?.fullName ?? null, updatedAt: r.updatedAt.toISOString(),
    cancelledByName: cancelledByUser?.fullName ?? null, cancelledAt: r.cancelledAt?.toISOString() ?? null, cancellationReason: r.cancellationReason,
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const r = await prisma.vehicleMaintenance.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Service entry not found." }, { status: 404 });
  return NextResponse.json({ ok: true, row: await toDetail(r) });
}

// PUT — edit while still Draft/InProgress; replaces the items/labour lines wholesale.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleMaintenance.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Service entry not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleMaintenance", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;
  if (!["Draft", "InProgress"].includes(existing.status)) return NextResponse.json({ ok: false, message: "Only a Draft/In Progress service entry can be edited." }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = maintenanceInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const partsCost = b.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const labourCost = b.labour.reduce((s, l) => s + (l.hours ?? 1) * l.rate, 0);
  const totalCost = partsCost + labourCost + b.workshopCost + b.otherCost;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.vehicleMaintenance.update({
      where: { id },
      data: {
        vehicleId: b.vehicleId, scheduleId: b.scheduleId ?? null, maintenanceType: b.maintenanceType, maintenanceCategory: b.maintenanceCategory,
        serviceDate: new Date(b.serviceDate), odometer: b.odometer ?? null,
        workshopId: b.workshopId ?? null, workshopName: b.workshopName ?? null, mechanic: b.mechanic ?? null,
        description: b.description ?? null, workPerformed: b.workPerformed ?? null,
        partsCost, labourCost, workshopCost: b.workshopCost, otherCost: b.otherCost, totalCost,
        nextDueDate: b.nextDueDate ? new Date(b.nextDueDate) : null, nextDueKm: b.nextDueKm ?? null,
        remarks: b.remarks ?? null, updatedBy: user.id,
      },
    });
    await tx.vehicleMaintenanceItem.deleteMany({ where: { maintenanceId: id } });
    await tx.vehicleMaintenanceLabour.deleteMany({ where: { maintenanceId: id } });
    if (b.items.length) await tx.vehicleMaintenanceItem.createMany({ data: b.items.map((i) => ({ tenantId: user.tenantId, maintenanceId: id, productId: i.productId ?? null, itemName: i.itemName, qty: i.qty, uom: i.uom ?? null, rate: i.rate, amount: i.qty * i.rate, remarks: i.remarks ?? null })) });
    if (b.labour.length) await tx.vehicleMaintenanceLabour.createMany({ data: b.labour.map((l) => ({ tenantId: user.tenantId, maintenanceId: id, description: l.description, hours: l.hours ?? null, rate: l.rate, amount: (l.hours ?? 1) * l.rate, technician: l.technician ?? null, remarks: l.remarks ?? null })) });
    return row;
  });

  await writeAudit(prisma, user, { action: "vehicle_maintenance.update", entity: "VehicleMaintenance", entityId: id, summary: `Updated service entry ${updated.maintenanceNo}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, row: await toDetail(updated), message: "Service entry updated." });
}
