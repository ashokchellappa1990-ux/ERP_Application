import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Public (no session, no permission check) — reached by scanning the QR on
 * a printed Pre Load Weight Slip. The opaque `publicToken` IS the security
 * boundary here: it's an unguessable random string
 * (VehicleGateEntry.publicToken, minted in
 * src/app/api/transport/pre-weighment/print-data/route.ts), so anyone who
 * has it has physically seen the printed slip. Never derive tenant scope
 * from a session on this route — there isn't one.
 *
 * IMPORTANT: this is a purely informational, optional side-log for whoever
 * is physically loading the vehicle — it must NEVER write
 * VehicleGateEntry.status. That column already drives the office's own
 * Dispatch → Complete → Exit action buttons on the Vehicle Gate Entry list
 * (src/components/transport/VehicleGateEntryScreen.tsx), which in turn gate
 * creating the real Load & Dispatch document and posting the Sales Invoice.
 * Writing "Loading"/"Completed" there from this public page would silently
 * skip the office straight past "Dispatch" to "Exit" without ever letting
 * them create that document — exactly the bug this file used to have.
 * "Start Loading"/"Complete Loading" here are tracked purely via
 * VehicleMovementHistory (LoadingStart/LoadingEnd) and are never mandatory.
 */

async function loadEntry(token: string) {
  const gateEntry = await prisma.vehicleGateEntry.findFirst({ where: { publicToken: token, deletedAt: null } });
  if (!gateEntry) return null;
  return gateEntry;
}

/** "2h 15m" / "35m" — whole-minute duration between two Dates, floor-rounded. */
function fmtDuration(from: Date, to: Date): string {
  const mins = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function loadingProgress(gateEntryId: number) {
  // Most recent Start/End pair — a re-scanned/retried gate entry could have
  // more than one attempt logged; only the latest of each matters for display.
  const events = await prisma.vehicleMovementHistory.findMany({
    where: { gateEntryId, eventType: { in: ["LoadingStart", "LoadingEnd"] } },
    orderBy: { eventAt: "desc" },
    select: { eventType: true, eventAt: true, actorName: true },
  });
  const startEvent = events.find((e) => e.eventType === "LoadingStart") ?? null;
  const endEvent = events.find((e) => e.eventType === "LoadingEnd") ?? null;
  return {
    nextAction: (endEvent ? null : startEvent ? "complete" : "start") as "start" | "complete" | null,
    loadingStartedAt: startEvent?.eventAt.toISOString() ?? null,
    loadingStartedBy: startEvent?.actorName ?? null,
    loadingCompletedAt: endEvent?.eventAt.toISOString() ?? null,
    loadingCompletedBy: endEvent?.actorName ?? null,
    loadingDuration: startEvent && endEvent ? fmtDuration(startEvent.eventAt, endEvent.eventAt) : null,
  };
}

// GET /api/public/gate-entry-loading/[token] — details + eligible operators.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const gateEntry = await loadEntry(params.token);
  if (!gateEntry) return NextResponse.json({ ok: false, message: "This link is invalid or has expired." }, { status: 404 });

  const [vehicle, setup, tenant, dispatch, gateEntryItem, operators, progress] = await Promise.all([
    prisma.vehicleMaster.findFirst({ where: { id: gateEntry.vehicleId }, select: { vehicleNo: true } }),
    prisma.companySetup.findFirst({ where: { tenantId: gateEntry.tenantId, NOT: { companyName: null } }, orderBy: { updatedAt: "desc" }, select: { companyName: true } }),
    prisma.tenant.findUnique({ where: { id: gateEntry.tenantId }, select: { name: true } }),
    prisma.loadDispatch.findFirst({ where: { vehicleGateEntryId: gateEntry.id, deletedAt: null }, orderBy: { id: "desc" }, select: { status: true, items: { orderBy: { id: "asc" }, take: 1, select: { productName: true } } } }),
    prisma.vehicleGateEntryItem.findFirst({ where: { gateEntryId: gateEntry.id }, orderBy: { id: "asc" }, select: { productName: true } }),
    prisma.loadingOperator.findMany({ where: { tenantId: gateEntry.tenantId, businessId: gateEntry.businessId, status: "Active", deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    loadingProgress(gateEntry.id),
  ]);

  // Once a real Load & Dispatch document exists, it's the authoritative,
  // more-advanced state — it should win over the physical-loading overlay
  // (e.g. "Sales Invoice Posted" is more informative than "Loading
  // Completed" at that point) and closes out the Start/Complete actions.
  const DISPATCHED_LABEL: Record<string, string> = {
    Draft: "Draft", Ready: "Ready", Loading: "Loading",
    Dispatched: "Dispatched", "Delivery Challan Generated": "Dispatched", "Sales Invoice Posted": "Dispatched",
    Cancelled: "Cancelled",
  };
  const dispatchedOrLater = !!dispatch && ["Dispatched", "Delivery Challan Generated", "Sales Invoice Posted"].includes(dispatch.status);

  let displayStatus: string;
  let nextAction: "start" | "complete" | null;
  let statusMessage = "";
  if (dispatchedOrLater) {
    displayStatus = DISPATCHED_LABEL[dispatch!.status] ?? dispatch!.status;
    nextAction = null;
    statusMessage = "This vehicle has already been dispatched — no further action needed here.";
  } else {
    // Display-only label — "Loading" / "Loading Completed" reflect the
    // physical-loading side-log above, deliberately distinct from
    // gateEntry.status (which this page never touches).
    displayStatus = progress.loadingCompletedAt ? "Loading Completed" : progress.loadingStartedAt ? "Loading" : gateEntry.status;
    nextAction = progress.nextAction;
    statusMessage = progress.nextAction ? "" : "Loading has already been marked complete for this vehicle — no further action needed here.";
  }

  return NextResponse.json({
    ok: true,
    data: {
      businessName: setup?.companyName || tenant?.name || "My Store",
      gateEntryNo: gateEntry.gateEntryNo,
      vehicleNumber: vehicle?.vehicleNo ?? null,
      customerName: gateEntry.customerName || null,
      productName: dispatch?.items[0]?.productName || gateEntryItem?.productName || null,
      status: displayStatus,
      nextAction,
      statusMessage,
      operators,
      loadingStartedAt: progress.loadingStartedAt,
      loadingStartedBy: progress.loadingStartedBy,
      loadingCompletedAt: progress.loadingCompletedAt,
      loadingCompletedBy: progress.loadingCompletedBy,
      loadingDuration: progress.loadingDuration,
    },
  });
}

// POST /api/public/gate-entry-loading/[token]?action=start|complete — body { operatorId }.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const action = new URL(req.url).searchParams.get("action");
  if (action !== "start" && action !== "complete") return NextResponse.json({ ok: false, message: "Invalid action." }, { status: 400 });

  const gateEntry = await loadEntry(params.token);
  if (!gateEntry) return NextResponse.json({ ok: false, message: "This link is invalid or has expired." }, { status: 404 });

  let body: { operatorId?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const operatorId = Number(body.operatorId);
  if (!operatorId) return NextResponse.json({ ok: false, message: "Select your name first." }, { status: 422 });

  const operator = await prisma.loadingOperator.findFirst({ where: { id: operatorId, tenantId: gateEntry.tenantId, status: "Active", deletedAt: null }, select: { id: true, name: true } });
  if (!operator) return NextResponse.json({ ok: false, message: "That name isn't recognized — please pick from the list." }, { status: 422 });

  const dispatch = await prisma.loadDispatch.findFirst({ where: { vehicleGateEntryId: gateEntry.id, deletedAt: null }, orderBy: { id: "desc" }, select: { status: true } });
  if (dispatch && ["Dispatched", "Delivery Challan Generated", "Sales Invoice Posted"].includes(dispatch.status)) {
    return NextResponse.json({ ok: false, message: "This vehicle has already been dispatched — no further action needed here." }, { status: 422 });
  }

  const progress = await loadingProgress(gateEntry.id);
  if (progress.nextAction !== action) {
    return NextResponse.json({ ok: false, message: progress.nextAction === null ? "Loading has already been marked complete." : `Please ${progress.nextAction === "start" ? "start" : "complete"} loading first.` }, { status: 422 });
  }

  const eventType = action === "start" ? "LoadingStart" : "LoadingEnd";
  // Purely a side-log — never touches VehicleGateEntry.status (see file
  // header comment), so the office's own Dispatch/Complete/Exit flow for
  // this gate entry is completely unaffected by this public page.
  await prisma.vehicleMovementHistory.create({
    data: {
      tenantId: gateEntry.tenantId, businessId: gateEntry.businessId ?? undefined, branchId: gateEntry.branchId ?? undefined,
      vehicleId: gateEntry.vehicleId, gateEntryId: gateEntry.id,
      eventType, eventAt: new Date(), actorUserId: null, actorName: operator.name,
      remarks: `${eventType === "LoadingStart" ? "Loading started" : "Loading completed"} by ${operator.name} (public QR scan)`.slice(0, 300),
    },
  });

  const next = await loadingProgress(gateEntry.id);
  return NextResponse.json({ ok: true, nextAction: next.nextAction, message: action === "start" ? "Loading started." : "Loading completed." });
}
