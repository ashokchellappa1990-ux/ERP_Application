import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { FuelIssueDetail } from "@/lib/contracts/fuelManagement";
import { computeEfficiency } from "@/lib/transport/fuelManagement";

const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }
function dateStr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.fuelIssue.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Fuel issue not found." }, { status: 404 });

  const [vehicle, driver, trip, tank, createdByUser, updatedByUser, cancelledByUser, eff] = await Promise.all([
    prisma.vehicleMaster.findFirst({ where: { id: r.vehicleId }, select: { vehicleNo: true } }),
    r.driverId != null ? prisma.driverMaster.findFirst({ where: { id: r.driverId }, select: { name: true } }) : null,
    r.tripId != null ? prisma.vehicleTrip.findFirst({ where: { id: r.tripId }, select: { tripNo: true } }) : null,
    prisma.fuelTank.findFirst({ where: { id: r.tankId }, select: { tankName: true } }),
    r.createdBy != null ? prisma.user.findFirst({ where: { id: r.createdBy }, select: { fullName: true } }) : null,
    r.updatedBy != null ? prisma.user.findFirst({ where: { id: r.updatedBy }, select: { fullName: true } }) : null,
    r.cancelledBy != null ? prisma.user.findFirst({ where: { id: r.cancelledBy }, select: { fullName: true } }) : null,
    computeEfficiency(user.tenantId, r.vehicleId, num(r.odometer), num(r.quantity) ?? 0, { excludeFuelIssueId: r.id }),
  ]);

  const row: FuelIssueDetail = {
    id: r.id, issueNo: r.issueNo, issueDate: dateStr(r.issueDate) ?? "", tankId: r.tankId, tankName: tank?.tankName ?? "—",
    vehicleId: r.vehicleId, vehicleNo: vehicle?.vehicleNo ?? "—", driverId: r.driverId, driverName: driver?.name ?? null,
    tripId: r.tripId, tripNo: trip?.tripNo ?? null, quantity: num(r.quantity) ?? 0, rate: num(r.rate) ?? 0, amount: num(r.amount) ?? 0,
    odometer: num(r.odometer), status: r.status, createdByName: createdByUser?.fullName ?? null, createdAt: r.createdAt.toISOString(),
    stationId: r.stationId, dispenser: r.dispenser, operator: r.operator, remarks: r.remarks,
    efficiency: eff.efficiency, distanceSincePrev: eff.distanceSincePrev,
    updatedByName: updatedByUser?.fullName ?? null, updatedAt: r.updatedAt.toISOString(),
    cancelledByName: cancelledByUser?.fullName ?? null, cancelledAt: r.cancelledAt?.toISOString() ?? null, cancellationReason: r.cancellationReason,
  };
  return NextResponse.json({ ok: true, row });
}
