import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { FuelEntryDetail, FuelEntryAttachmentInput } from "@/lib/contracts/fuelManagement";
import { computeEfficiency } from "@/lib/transport/fuelManagement";

const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }
function dateStr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.fuelEntry.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Fuel entry not found." }, { status: 404 });

  const [vehicle, tank, driver, trip, createdByUser, updatedByUser, cancelledByUser, eff, lineRows, paymentRows, headRow] = await Promise.all([
    r.vehicleId != null ? prisma.vehicleMaster.findFirst({ where: { id: r.vehicleId }, select: { vehicleNo: true } }) : null,
    r.tankId != null ? prisma.fuelTank.findFirst({ where: { id: r.tankId }, select: { tankName: true } }) : null,
    r.driverId != null ? prisma.driverMaster.findFirst({ where: { id: r.driverId }, select: { name: true } }) : null,
    r.tripId != null ? prisma.vehicleTrip.findFirst({ where: { id: r.tripId }, select: { tripNo: true } }) : null,
    r.createdBy != null ? prisma.user.findFirst({ where: { id: r.createdBy }, select: { fullName: true } }) : null,
    r.updatedBy != null ? prisma.user.findFirst({ where: { id: r.updatedBy }, select: { fullName: true } }) : null,
    r.cancelledBy != null ? prisma.user.findFirst({ where: { id: r.cancelledBy }, select: { fullName: true } }) : null,
    r.vehicleId != null ? computeEfficiency(user.tenantId, r.vehicleId, num(r.odometer), num(r.quantity) ?? 0, { excludeFuelEntryId: r.id }) : Promise.resolve({ efficiency: null, distanceSincePrev: null }),
    prisma.fuelEntryLine.findMany({ where: { tenantId: user.tenantId, fuelEntryId: r.id }, orderBy: { id: "asc" } }),
    prisma.fuelEntryPayment.findMany({ where: { tenantId: user.tenantId, fuelEntryId: r.id }, orderBy: { id: "asc" } }),
    r.headId != null ? prisma.expenseHead.findFirst({ where: { id: r.headId }, select: { name: true } }) : null,
  ]);

  let attachments: FuelEntryAttachmentInput[] = [];
  if (r.attachmentsJson) { try { attachments = JSON.parse(r.attachmentsJson); } catch { attachments = []; } }

  const row: FuelEntryDetail = {
    id: r.id, entryNo: r.entryNo, entryDate: dateStr(r.entryDate) ?? "", usageType: r.usageType,
    vehicleId: r.vehicleId, vehicleNo: r.vehicleId != null ? vehicle?.vehicleNo ?? "—" : null,
    tankId: r.tankId, tankName: r.tankId != null ? tank?.tankName ?? "—" : null,
    driverId: r.driverId, driverName: driver?.name ?? null, tripId: r.tripId, tripNo: trip?.tripNo ?? null,
    fuelType: r.fuelType, fuelStationName: r.fuelStationName, quantity: num(r.quantity) ?? 0, rate: num(r.rate) ?? 0, amount: num(r.amount) ?? 0,
    odometer: num(r.odometer), status: r.status, createdByName: createdByUser?.fullName ?? null, createdAt: r.createdAt.toISOString(),
    totalAmount: num(r.totalAmount) ?? num(r.amount) ?? 0, postingType: r.postingType,
    uom: r.uom, invoiceNo: r.invoiceNo, invoiceDate: dateStr(r.invoiceDate), remarks: r.remarks,
    fuelStationId: r.fuelStationId, efficiency: eff.efficiency, distanceSincePrev: eff.distanceSincePrev,
    updatedByName: updatedByUser?.fullName ?? null, updatedAt: r.updatedAt.toISOString(),
    cancelledByName: cancelledByUser?.fullName ?? null, cancelledAt: r.cancelledAt?.toISOString() ?? null, cancellationReason: r.cancellationReason,
    headId: r.headId, headName: headRow?.name ?? null, gstApplicable: r.gstApplicable, gstPct: num(r.gstPct), taxAmount: num(r.taxAmount) ?? 0, otherCost: num(r.otherCost) ?? 0,
    supplierGstin: r.supplierGstin, bankId: r.bankId, bankName: r.bankName, bankAccount: r.bankAccount,
    lines: lineRows.map((l) => ({ id: l.id, headId: l.headId, headName: l.headName, description: l.description, amount: num(l.amount) ?? 0 })),
    payments: paymentRows.map((p) => ({ id: p.id, mode: p.mode, amount: num(p.amount) ?? 0, reference: p.reference })),
    attachments,
  };
  return NextResponse.json({ ok: true, row });
}
