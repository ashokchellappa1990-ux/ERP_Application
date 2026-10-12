import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { tripCreateInput, type TripDetail, type TripLinkedDocs, type TripTimelineEvent } from "@/lib/contracts/vehicleTrip";

const PERM = "masters.transport";

function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }
function iso(d: Date | null | undefined): string | null { return d ? d.toISOString() : null; }

type TripRowRaw = NonNullable<Awaited<ReturnType<typeof prisma.vehicleTrip.findFirst>>>;

async function resolveLinks(trip: TripRowRaw): Promise<{ linked: TripLinkedDocs; timeline: TripTimelineEvent[]; resolvedActualQty: number | null }> {
  const linked: TripLinkedDocs = { gateEntryNo: null, gateEntryId: null, salesOrderNo: null, loadDispatchNo: null, loadDispatchId: null, grnNo: null, grnId: null, weighmentNetWeight: null, weighmentUom: null };
  const timeline: TripTimelineEvent[] = [
    { label: "Trip Created", at: iso(trip.createdAt), done: true },
  ];
  let resolvedActualQty: number | null = num(trip.actualQty);

  if (trip.vehicleGateEntryId) {
    const gate = await prisma.vehicleGateEntry.findFirst({
      where: { id: trip.vehicleGateEntryId },
      select: { id: true, gateEntryNo: true, salesOrderId: true, grnId: true, arrivalTime: true, entryType: true, netWeight: true },
    });
    if (gate) {
      linked.gateEntryId = gate.id; linked.gateEntryNo = gate.gateEntryNo;
      timeline.push({ label: "Vehicle Entry", at: iso(gate.arrivalTime), done: true });

      if (gate.salesOrderId) {
        const so = await prisma.salesDocument.findFirst({ where: { id: gate.salesOrderId }, select: { docNo: true } });
        linked.salesOrderNo = so?.docNo ?? null;
      }

      const dispatch = await prisma.loadDispatch.findFirst({ where: { vehicleGateEntryId: gate.id }, select: { id: true, dispatchNo: true, loadingStart: true, startedAt: true, completedAt: true } });
      if (dispatch) {
        linked.loadDispatchId = dispatch.id; linked.loadDispatchNo = dispatch.dispatchNo;
        if (dispatch.loadingStart) timeline.push({ label: "Loading Started", at: iso(dispatch.loadingStart), done: true });
        if (dispatch.startedAt) timeline.push({ label: "Dispatch", at: iso(dispatch.startedAt), done: true });
      }

      if (gate.entryType === "RawMaterial") {
        if (gate.netWeight != null) { linked.weighmentNetWeight = Number(gate.netWeight); linked.weighmentUom = "Kg"; }
        if (gate.netWeight != null) timeline.push({ label: "Final Weighment", at: null, done: true });
        if (resolvedActualQty == null) resolvedActualQty = linked.weighmentNetWeight;
      } else {
        const post = await prisma.postLoadingWeighment.findFirst({ where: { gateEntryId: gate.id }, orderBy: { id: "desc" }, select: { netWeight: true, weighDate: true } });
        if (post) {
          linked.weighmentNetWeight = Number(post.netWeight); linked.weighmentUom = "Kg";
          timeline.push({ label: "Final Weighment", at: post.weighDate, done: true });
          if (resolvedActualQty == null) resolvedActualQty = linked.weighmentNetWeight;
        }
      }

      if (gate.grnId) {
        const grn = await prisma.goodsReceiptNote.findFirst({ where: { id: gate.grnId }, select: { id: true, grnNo: true } });
        if (grn) { linked.grnId = grn.id; linked.grnNo = grn.grnNo; timeline.push({ label: "GRN Posted", at: null, done: true }); }
      }
    }
  }

  timeline.push({ label: "Vehicle Assigned", at: iso(trip.createdAt), done: true });
  timeline.push({ label: "Vehicle Departed", at: iso(trip.actualStartAt), done: !!trip.actualStartAt });
  timeline.push({ label: "Arrived", at: iso(trip.arrivalAt), done: !!trip.arrivalAt });
  timeline.push({ label: "Trip Completed", at: iso(trip.endAt), done: !!trip.endAt });
  timeline.sort((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : a.done === b.done ? 0 : a.done ? -1 : 1));

  return { linked, timeline, resolvedActualQty };
}

async function toDetail(r: TripRowRaw): Promise<TripDetail> {
  const [vehicle, driver, company, createdByUser, updatedByUser, { linked, timeline, resolvedActualQty }] = await Promise.all([
    prisma.vehicleMaster.findFirst({ where: { id: r.vehicleId }, select: { vehicleNo: true } }),
    r.driverId != null ? prisma.driverMaster.findFirst({ where: { id: r.driverId }, select: { name: true } }) : null,
    r.transportCompanyId != null ? prisma.transportCompany.findFirst({ where: { id: r.transportCompanyId }, select: { name: true } }) : null,
    r.createdBy != null ? prisma.user.findFirst({ where: { id: r.createdBy }, select: { fullName: true } }) : null,
    r.updatedBy != null ? prisma.user.findFirst({ where: { id: r.updatedBy }, select: { fullName: true } }) : null,
    resolveLinks(r),
  ]);

  return {
    id: r.id, tripNo: r.tripNo, tripType: r.tripType, tripPurpose: r.tripPurpose,
    vehicleId: r.vehicleId, vehicleNo: vehicle?.vehicleNo ?? "—",
    driverId: r.driverId, driverName: driver?.name ?? null,
    transportCompanyId: r.transportCompanyId, transportCompanyName: company?.name ?? null,
    sourceLocation: r.sourceLocation, destinationLocation: r.destinationLocation,
    materialName: r.materialName, plannedQty: num(r.plannedQty), actualQty: resolvedActualQty, uom: r.uom,
    plannedStartAt: iso(r.plannedStartAt), actualStartAt: iso(r.actualStartAt), arrivalAt: iso(r.arrivalAt), endAt: iso(r.endAt),
    startOdometer: num(r.startOdometer), endOdometer: num(r.endOdometer), tripDistance: num(r.tripDistance),
    status: r.status,
    createdByName: createdByUser?.fullName ?? null, createdAt: r.createdAt.toISOString(),
    remarks: r.remarks,
    sourceModule: r.sourceModule, sourceTransactionType: r.sourceTransactionType, sourceTransactionId: r.sourceTransactionId, sourceTransactionNo: r.sourceTransactionNo,
    linked, timeline,
    updatedByName: updatedByUser?.fullName ?? null, updatedAt: r.updatedAt.toISOString(),
  };
}

// GET /api/transport/vehicle-trip/[id] — full detail incl. resolved linked
// docs (Gate Entry, Sales Order, Load & Dispatch, GRN, Weighment) and timeline.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.vehicleTrip.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Trip not found." }, { status: 404 });
  return NextResponse.json({ ok: true, row: await toDetail(r) });
}

// PUT /api/transport/vehicle-trip/[id] — edit while still PLANNED/ASSIGNED
// (once Started, use the status actions instead — that's what actually
// drives the operational timeline).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleTrip.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, status: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Trip not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleTrip", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  if (!["PLANNED", "ASSIGNED"].includes(existing.status)) {
    return NextResponse.json({ ok: false, message: "Only a Planned or Assigned trip can be edited — once Started, use Reassign Driver or the trip actions instead." }, { status: 422 });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = tripCreateInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: b.vehicleId, tenantId: user.tenantId, deletedAt: null } });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 422 });
  if (b.driverId) {
    const driver = await prisma.driverMaster.findFirst({ where: { id: b.driverId, tenantId: user.tenantId, deletedAt: null } });
    if (!driver) return NextResponse.json({ ok: false, message: "Driver not found." }, { status: 422 });
  }

  const updated = await prisma.vehicleTrip.update({
    where: { id },
    data: {
      tripType: b.tripType, tripPurpose: b.tripPurpose ?? null, vehicleId: b.vehicleId, driverId: b.driverId ?? null,
      transportCompanyId: b.transportCompanyId ?? null, sourceLocation: b.sourceLocation ?? null, destinationLocation: b.destinationLocation ?? null,
      materialName: b.materialName ?? null, plannedQty: b.plannedQty ?? null, uom: b.uom ?? null,
      plannedStartAt: b.plannedStartAt ? new Date(b.plannedStartAt) : undefined,
      status: b.driverId && existing.status === "PLANNED" ? "ASSIGNED" : undefined,
      remarks: b.remarks ?? null, updatedBy: user.id,
    },
  });
  await writeAudit(prisma, user, { action: "vehicle_trip.update", entity: "VehicleTrip", entityId: id, summary: `Updated trip ${updated.tripNo}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, row: await toDetail(updated), message: "Trip updated." });
}
