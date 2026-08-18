import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import {
  tripStartInput, tripTransitInput, tripArriveInput, tripCompleteInput, tripHoldInput, tripCancelInput, tripReturnInput,
} from "@/lib/contracts/vehicleTrip";
import { TRIP_NEXT } from "@/lib/transport/vehicleTrip";

const PERM = "masters.transport";
type Action = "start" | "transit" | "arrive" | "complete" | "hold" | "resume" | "cancel" | "return";
const SCHEMAS: Record<Exclude<Action, "resume">, typeof tripStartInput | typeof tripTransitInput | typeof tripArriveInput | typeof tripCompleteInput | typeof tripHoldInput | typeof tripCancelInput | typeof tripReturnInput> = {
  start: tripStartInput, transit: tripTransitInput, arrive: tripArriveInput, complete: tripCompleteInput,
  hold: tripHoldInput, cancel: tripCancelInput, return: tripReturnInput,
};
// Vehicle Movement History event names for each trip action — additive
// eventType strings on the existing vehicle_movement_history log (same table
// Gate Entry/Weighment/Loading already write to), so a trip's journey shows
// up in that one shared vehicle timeline instead of a separate log.
const MOVEMENT_EVENT: Record<Action, string> = {
  start: "TripStart", transit: "TripInTransit", arrive: "TripArrived", complete: "TripCompleted",
  hold: "TripOnHold", resume: "TripResumed", cancel: "TripCancelled", return: "TripReturned",
};

async function logMovement(tripId: number, action: Action, trip: { tenantId: number; businessId: number | null; branchId: number | null; vehicleId: number; vehicleGateEntryId: number | null; tripNo: string }, actor: { id: number; fullName: string | null }, remarks?: string) {
  try {
    await prisma.vehicleMovementHistory.create({
      data: {
        tenantId: trip.tenantId, businessId: trip.businessId ?? undefined, branchId: trip.branchId ?? undefined,
        vehicleId: trip.vehicleId, gateEntryId: trip.vehicleGateEntryId ?? undefined,
        eventType: MOVEMENT_EVENT[action], eventAt: new Date(), actorUserId: actor.id, actorName: actor.fullName ?? null,
        remarks: `${trip.tripNo}${remarks ? ` — ${remarks}` : ""}`.slice(0, 300),
      },
    });
  } catch (e) { console.error("[vehicle-trip] movement history log failed (non-fatal)", e); }
}

// POST /api/transport/vehicle-trip/[id]/status — { action, ...fields }.
// Controlled transitions only (see TRIP_NEXT) — no arbitrary status writes.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const trip = await prisma.vehicleTrip.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!trip) return NextResponse.json({ ok: false, message: "Trip not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleTrip", entityId: id, businessId: trip.businessId, branchId: trip.branchId });
  if (denied) return denied;

  let raw: Record<string, unknown>;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const action = raw.action as Action;

  if (action === "resume") {
    if (trip.status !== "ON_HOLD") return NextResponse.json({ ok: false, message: "Only a trip that's On Hold can be resumed." }, { status: 422 });
    const to = trip.preHoldStatus ?? "ASSIGNED";
    const updated = await prisma.vehicleTrip.update({ where: { id }, data: { status: to, preHoldStatus: null, updatedBy: user.id } });
    await writeAudit(prisma, user, { action: "vehicle_trip.resume", entity: "VehicleTrip", entityId: id, summary: `Trip ${trip.tripNo} resumed → ${to}`, businessId: trip.businessId, branchId: trip.branchId, ip: requestMeta(req).ip });
    await logMovement(id, "resume", trip, user);
    return NextResponse.json({ ok: true, status: updated.status, message: `Trip resumed (${to}).` });
  }

  const schema = SCHEMAS[action];
  if (!schema) return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 422 });
  const to = TRIP_NEXT[action]?.[trip.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${action} a trip that is ${trip.status}.` }, { status: 422 });

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data as Record<string, unknown>;

  const data: Record<string, unknown> = { status: to, updatedBy: user.id };
  if (action === "start") {
    data.actualStartAt = new Date();
    if (b.startOdometer != null) data.startOdometer = b.startOdometer;
    if (b.sourceLocation) data.sourceLocation = b.sourceLocation;
    if (b.driverId) data.driverId = b.driverId;
    if (b.remarks) data.remarks = b.remarks;
  } else if (action === "transit") {
    if (b.currentLocation) data.sourceLocation = b.currentLocation;
    if (b.remarks) data.remarks = b.remarks;
  } else if (action === "arrive") {
    data.arrivalAt = new Date();
    if (b.destinationLocation) data.destinationLocation = b.destinationLocation;
    if (b.remarks) data.remarks = b.remarks;
  } else if (action === "complete") {
    data.endAt = new Date();
    if (b.endOdometer != null) {
      data.endOdometer = b.endOdometer;
      if (trip.startOdometer != null && Number(b.endOdometer) < Number(trip.startOdometer)) {
        return NextResponse.json({ ok: false, message: "End KM cannot be less than Start KM." }, { status: 422 });
      }
      if (trip.startOdometer != null) data.tripDistance = Number(b.endOdometer) - Number(trip.startOdometer);
    }
    if (b.actualQty != null) data.actualQty = b.actualQty;
    if (b.remarks) data.remarks = b.remarks;
  } else if (action === "hold") {
    data.preHoldStatus = trip.status;
    if (b.remarks) data.remarks = b.remarks;
  } else if (action === "cancel" || action === "return") {
    data.remarks = b.remarks;
  }

  const updated = await prisma.vehicleTrip.update({ where: { id }, data });
  await writeAudit(prisma, user, {
    action: `vehicle_trip.${action}`, entity: "VehicleTrip", entityId: id,
    summary: `Trip ${trip.tripNo} ${trip.status} → ${to}`, meta: { from: trip.status, to, remarks: b.remarks ?? null },
    businessId: trip.businessId, branchId: trip.branchId, ip: requestMeta(req).ip,
  });
  await logMovement(id, action, trip, user, typeof b.remarks === "string" ? b.remarks : undefined);
  return NextResponse.json({ ok: true, status: updated.status, message: `Trip ${action === "complete" ? "completed" : action === "cancel" ? "cancelled" : "updated"}.` });
}
