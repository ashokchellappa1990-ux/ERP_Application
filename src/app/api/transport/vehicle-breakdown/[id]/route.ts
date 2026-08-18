import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { BreakdownDetail } from "@/lib/contracts/vehicleMaintenance";

const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }

async function toDetail(r: NonNullable<Awaited<ReturnType<typeof prisma.vehicleBreakdown.findFirst>>>): Promise<BreakdownDetail> {
  const [vehicle, driver, trip, items, labour, createdByUser, updatedByUser, cancelledByUser] = await Promise.all([
    prisma.vehicleMaster.findFirst({ where: { id: r.vehicleId }, select: { vehicleNo: true } }),
    r.driverId != null ? prisma.driverMaster.findFirst({ where: { id: r.driverId }, select: { name: true } }) : null,
    r.tripId != null ? prisma.vehicleTrip.findFirst({ where: { id: r.tripId }, select: { tripNo: true } }) : null,
    prisma.vehicleMaintenanceItem.findMany({ where: { breakdownId: r.id }, orderBy: { id: "asc" } }),
    prisma.vehicleMaintenanceLabour.findMany({ where: { breakdownId: r.id }, orderBy: { id: "asc" } }),
    r.createdBy != null ? prisma.user.findFirst({ where: { id: r.createdBy }, select: { fullName: true } }) : null,
    r.updatedBy != null ? prisma.user.findFirst({ where: { id: r.updatedBy }, select: { fullName: true } }) : null,
    r.cancelledBy != null ? prisma.user.findFirst({ where: { id: r.cancelledBy }, select: { fullName: true } }) : null,
  ]);
  return {
    id: r.id, breakdownNo: r.breakdownNo, vehicleId: r.vehicleId, vehicleNo: vehicle?.vehicleNo ?? "—",
    driverId: r.driverId, driverName: driver?.name ?? null, tripId: r.tripId, tripNo: trip?.tripNo ?? null,
    breakdownDate: r.breakdownDate.toISOString(), breakdownType: r.breakdownType, priority: r.priority, status: r.status, totalCost: num(r.totalCost) ?? 0,
    location: r.location, createdAt: r.createdAt.toISOString(),
    odometer: num(r.odometer), problemDescription: r.problemDescription, diagnosisNotes: r.diagnosisNotes,
    workshopId: r.workshopId, workshopName: r.workshopName,
    partsCost: num(r.partsCost) ?? 0, labourCost: num(r.labourCost) ?? 0, otherCost: num(r.otherCost) ?? 0,
    items: items.map((i) => ({ id: i.id, productId: i.productId, itemName: i.itemName, qty: Number(i.qty), uom: i.uom, rate: Number(i.rate), amount: Number(i.amount), remarks: i.remarks })),
    labour: labour.map((l) => ({ id: l.id, description: l.description, hours: l.hours != null ? Number(l.hours) : null, rate: Number(l.rate), amount: Number(l.amount), technician: l.technician, remarks: l.remarks })),
    releasedAt: r.releasedAt?.toISOString() ?? null, closedAt: r.closedAt?.toISOString() ?? null, remarks: r.remarks,
    createdByName: createdByUser?.fullName ?? null, updatedByName: updatedByUser?.fullName ?? null, updatedAt: r.updatedAt.toISOString(),
    cancelledByName: cancelledByUser?.fullName ?? null, cancelledAt: r.cancelledAt?.toISOString() ?? null, cancellationReason: r.cancellationReason,
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const r = await prisma.vehicleBreakdown.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Breakdown not found." }, { status: 404 });
  return NextResponse.json({ ok: true, row: await toDetail(r) });
}
