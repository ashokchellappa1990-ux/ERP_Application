import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { gateEntryInput } from "@/lib/contracts/transport";

const PERM = "transport.gate-entry";

// GET /api/transport/gate-entry — list + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const customerName = (url.searchParams.get("customerName") ?? "").trim();
  const vehicleId = Number(url.searchParams.get("vehicleId") ?? "");

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.VehicleGateEntryWhereInput = { ...sw, deletedAt: null };
  if (q) where.OR = [{ gateEntryNo: { contains: q } }, { referenceNo: { contains: q } }, { customerName: { contains: q } }];
  // Used by Direct Customer Dispatch to auto-load Transport/Driver details +
  // the gate reference number once a customer is picked, without a separate
  // manual gate-entry search step.
  if (customerName) where.customerName = { contains: customerName };
  // Fallback match when the vehicle was picked manually instead of via the
  // customer — finds that vehicle's own active gate entry (for Weighment Management).
  if (vehicleId > 0) where.vehicleId = vehicleId;
  if (status !== "All") where.status = status;

  const [rows, total, waiting, inside, loading] = await Promise.all([
    prisma.vehicleGateEntry.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.vehicleGateEntry.count({ where: sw }),
    prisma.vehicleGateEntry.count({ where: { ...sw, status: "Waiting", deletedAt: null } }),
    prisma.vehicleGateEntry.count({ where: { ...sw, status: "Inside Factory", deletedAt: null } }),
    prisma.vehicleGateEntry.count({ where: { ...sw, status: "Loading", deletedAt: null } }),
  ]);

  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const driverIds = Array.from(new Set(rows.map((r) => r.driverId).filter((v): v is number => !!v)));
  const companyIds = Array.from(new Set(rows.map((r) => r.transportCompanyId).filter((v): v is number => !!v)));
  const [vehicles, drivers, companies] = await Promise.all([
    prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }),
    driverIds.length ? prisma.driverMaster.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    companyIds.length ? prisma.transportCompany.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const dMap = new Map(drivers.map((d) => [d.id, d.name]));
  const cMap = new Map(companies.map((c) => [c.id, c.name]));

  const shaped = rows.map((r) => ({
    id: r.id, gateEntryNo: r.gateEntryNo, vehicleId: r.vehicleId, vehicleNo: vMap.get(r.vehicleId) ?? "—",
    // Prefer the actual driver captured at the gate (may differ from any planned driver) —
    // fall back to the linked Driver Master record if no freeform capture was made.
    driverId: r.driverId, driverName: r.driverName || (r.driverId ? (dMap.get(r.driverId) ?? null) : null),
    driverMobile: r.driverMobile, driverLicenseNo: r.driverLicenseNo,
    transportCompanyId: r.transportCompanyId, transportCompanyName: r.transportCompanyId ? (cMap.get(r.transportCompanyId) ?? "—") : null,
    dispatchPlanningId: r.dispatchPlanningId, dispatchExecutionId: r.dispatchExecutionId,
    dispatchType: r.dispatchType, referenceNo: r.referenceNo, customerName: r.customerName,
    vehicleType: r.vehicleType, transportMode: r.transportMode,
    arrivalTime: r.arrivalTime ? r.arrivalTime.toISOString() : null,
    securityOfficer: r.securityOfficer, remarks: r.remarks, status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ ok: true, rows: shaped, stats: { total, waiting, inside, loading } });
}

// POST /api/transport/gate-entry — create a gate entry (status starts "Waiting").
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleGateEntry" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = gateEntryInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid gate entry." }, { status: 422 });
  const input = parsed.data;

  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: input.vehicleId, tenantId: user.tenantId }, select: { id: true } });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Selected vehicle was not found in your catalog." }, { status: 422 });

  // A gate entry may reference an approved Dispatch Planning; anything still in
  // Draft (not yet approved) or Cancelled cannot start the physical vehicle flow.
  if (input.dispatchPlanningId) {
    const plan = await prisma.dispatchPlanning.findFirst({ where: { id: input.dispatchPlanningId, tenantId: user.tenantId }, select: { id: true, status: true, planningNo: true } });
    if (!plan) return NextResponse.json({ ok: false, message: "Linked Dispatch Planning was not found." }, { status: 422 });
    if (plan.status === "Draft" || plan.status === "Cancelled") {
      return NextResponse.json({ ok: false, message: `Dispatch Planning ${plan.planningNo} is ${plan.status} — it must be Approved (or further along) before a gate entry can be raised.` }, { status: 422 });
    }
  }

  const scope = await getActiveScope(user);

  // Location auto-populates from the logged-in user's active branch — never
  // client-trusted. Reference Document details (customer/delivery address,
  // source/destination warehouse) are similarly re-resolved from the
  // authoritative Sales Order / Transfer Request record, ignoring whatever the
  // client may have echoed back, so the ERP "automatically loads these
  // details" as specified rather than trusting client input for them.
  let location: string | null = null;
  if (scope.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: scope.branchId, tenantId: user.tenantId }, select: { name: true } });
    location = branch?.name ?? null;
  }

  let referenceNo = input.referenceNo ?? null;
  let customerName: string | null = null;
  let deliveryAddress: string | null = input.deliveryAddress ?? null;
  if (input.referenceType === "Sales Order" && input.salesOrderId) {
    const so = await prisma.salesDocument.findFirst({ where: { id: input.salesOrderId, tenantId: user.tenantId, docType: "order" }, select: { docNo: true, customerName: true, deliveryAddress: true } });
    if (!so) return NextResponse.json({ ok: false, message: "Selected Sales Order was not found." }, { status: 422 });
    referenceNo = so.docNo;
    customerName = so.customerName;
    deliveryAddress = so.deliveryAddress;
  } else if (input.customerId) {
    // Direct Customer Dispatch — no source doc to derive from; the customer
    // NAME is still re-resolved from the Customer Master (not client-trusted),
    // but deliveryAddress is legitimately free text here.
    const cust = await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: user.tenantId }, select: { name: true } });
    if (!cust) return NextResponse.json({ ok: false, message: "Selected customer was not found." }, { status: 422 });
    customerName = cust.name;
  }

  // Gate Entry No is user-enterable — if given, it must be unique for this
  // tenant; if left blank, one is auto-generated (GATE-#####) as before.
  if (input.gateEntryNo) {
    const dupe = await prisma.vehicleGateEntry.findFirst({ where: { tenantId: user.tenantId, gateEntryNo: input.gateEntryNo, deletedAt: null }, select: { id: true } });
    if (dupe) return NextResponse.json({ ok: false, message: `Gate Entry No "${input.gateEntryNo}" is already in use.` }, { status: 409 });
  }

  let sourceWarehouse: string | null = null;
  let destinationWarehouse: string | null = null;
  if (input.dispatchType === "StockTransfer" && input.transferRequestId) {
    const str = await prisma.stockTransferRequest.findFirst({ where: { id: input.transferRequestId, tenantId: user.tenantId }, select: { requestNo: true, sourceWarehouse: true, destinationWarehouse: true } });
    if (!str) return NextResponse.json({ ok: false, message: "Selected Transfer Request was not found." }, { status: 422 });
    referenceNo = str.requestNo;
    sourceWarehouse = str.sourceWarehouse;
    destinationWarehouse = str.destinationWarehouse;
  }

  try {
    const id = await prisma.$transaction(async (tx) => {
      const entry = await tx.vehicleGateEntry.create({
        data: {
          tenantId: user.tenantId, businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined,
          gateEntryNo: input.gateEntryNo || "TMP", vehicleId: input.vehicleId, driverId: input.driverId ?? undefined,
          transportCompanyId: input.transportCompanyId ?? undefined, dispatchPlanningId: input.dispatchPlanningId ?? undefined,
          dispatchExecutionId: input.dispatchExecutionId ?? undefined, dispatchType: input.dispatchType ?? undefined,
          referenceNo: referenceNo ?? undefined, arrivalTime: input.arrivalTime ? new Date(input.arrivalTime) : new Date(),
          securityOfficer: input.securityOfficer ?? undefined, remarks: input.remarks ?? undefined,
          gate: input.gate ?? undefined, location: location ?? undefined,
          referenceType: input.referenceType ?? undefined, salesOrderId: input.salesOrderId ?? undefined,
          customerName: customerName ?? undefined, deliveryAddress: deliveryAddress ?? undefined,
          transferRequestId: input.transferRequestId ?? undefined,
          sourceWarehouse: sourceWarehouse ?? undefined, destinationWarehouse: destinationWarehouse ?? undefined,
          transportMode: input.transportMode ?? undefined, vehicleType: input.vehicleType ?? undefined,
          trailerNumber: input.trailerNumber ?? undefined, containerNumber: input.containerNumber ?? undefined,
          driverName: input.driverName ?? undefined, driverMobile: input.driverMobile ?? undefined,
          driverLicenseNo: input.driverLicenseNo ?? undefined, helperName: input.helperName ?? undefined,
          helperMobile: input.helperMobile ?? undefined,
          vehicleCapacity: input.vehicleCapacity ?? undefined, expectedLoadWeight: input.expectedLoadWeight ?? undefined,
          gpsAvailable: input.gpsAvailable ?? false, sealNumber: input.sealNumber ?? undefined,
          purpose: input.purpose ?? undefined, expectedExitTime: input.expectedExitTime ? new Date(input.expectedExitTime) : undefined,
          loadingBayId: input.loadingBayId ?? undefined,
          createdBy: user.id,
        },
        select: { id: true },
      });
      const gateEntryNo = input.gateEntryNo || `GATE-${String(entry.id).padStart(5, "0")}`;
      if (!input.gateEntryNo) await tx.vehicleGateEntry.update({ where: { id: entry.id }, data: { gateEntryNo } });
      await tx.vehicleMovementHistory.create({
        data: {
          tenantId: user.tenantId, businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined,
          vehicleId: input.vehicleId, dispatchExecutionId: input.dispatchExecutionId ?? undefined, gateEntryId: entry.id,
          eventType: "GateIn", eventAt: new Date(), actorUserId: user.id, actorName: user.fullName ?? null,
          remarks: `Gate entry ${gateEntryNo} recorded`,
        },
      });
      return entry.id;
    });
    await writeAudit(prisma, user, { action: "vehicle_gate_entry.create", entity: "VehicleGateEntry", entityId: id, summary: `Vehicle gate entry created for vehicle #${input.vehicleId}`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Gate entry recorded.", id }, { status: 201 });
  } catch (err) {
    console.error("[transport/gate-entry] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the gate entry." }, { status: 500 });
  }
}
