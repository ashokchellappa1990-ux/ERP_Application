import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { z } from "zod";

const PERM = "transport.gate-entry";

// Fields editable AFTER creation — customer/transport/driver details captured
// or corrected once the vehicle is already at the gate (e.g. from the Pre
// Loading Weighment screen's "add/modify if missing" flow). Core identifiers
// (vehicleId, gateEntryNo, dispatchType) are not editable here.
const patchInput = z.object({
  transportCompanyId: z.coerce.number().int().positive().optional().nullable(),
  customerName: z.string().trim().max(200).optional().nullable(),
  driverName: z.string().trim().max(150).optional().nullable(),
  driverMobile: z.string().trim().max(20).optional().nullable(),
  driverLicenseNo: z.string().trim().max(60).optional().nullable(),
  helperName: z.string().trim().max(150).optional().nullable(),
  helperMobile: z.string().trim().max(20).optional().nullable(),
  vehicleType: z.string().trim().max(60).optional().nullable(),
  transportMode: z.string().trim().max(30).optional().nullable(),
});

// GET /api/transport/gate-entry/[id] — full detail, including every physical
// step recorded so far (pre-weighment / loading confirmation / post-weighment /
// gate exit), so the UI can decide which action buttons to offer next.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id: Number(params.id), deletedAt: null } });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });

  const [vehicle, driver, company, plan, preWeighment, loading, postWeighment, gateExit, items] = await Promise.all([
    prisma.vehicleMaster.findFirst({ where: { id: entry.vehicleId }, select: { id: true, vehicleNo: true, vehicleType: true } }),
    entry.driverId ? prisma.driverMaster.findFirst({ where: { id: entry.driverId }, select: { id: true, name: true, phone: true } }) : null,
    entry.transportCompanyId ? prisma.transportCompany.findFirst({ where: { id: entry.transportCompanyId }, select: { id: true, name: true } }) : null,
    entry.dispatchPlanningId ? prisma.dispatchPlanning.findFirst({ where: { id: entry.dispatchPlanningId }, select: { id: true, planningNo: true, status: true, estimatedWeight: true } }) : null,
    prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: entry.id, tenantId: user.tenantId } }),
    prisma.loadingConfirmation.findFirst({ where: { gateEntryId: entry.id, tenantId: user.tenantId }, orderBy: { id: "desc" } }),
    prisma.postLoadingWeighment.findFirst({ where: { gateEntryId: entry.id, tenantId: user.tenantId } }),
    prisma.gateExit.findFirst({ where: { gateEntryId: entry.id, tenantId: user.tenantId } }),
    prisma.vehicleGateEntryItem.findMany({ where: { gateEntryId: entry.id }, orderBy: { id: "asc" } }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      id: entry.id, gateEntryNo: entry.gateEntryNo, status: entry.status,
      vehicleId: entry.vehicleId, vehicleNo: vehicle?.vehicleNo ?? "—", vehicleType: vehicle?.vehicleType ?? null,
      driverId: entry.driverId, driverPhone: driver?.phone ?? null,
      transportCompanyId: entry.transportCompanyId, transportCompanyName: company?.name ?? null,
      dispatchPlanningId: entry.dispatchPlanningId, dispatchPlanningNo: plan?.planningNo ?? null, dispatchPlanningStatus: plan?.status ?? null,
      dispatchExecutionId: entry.dispatchExecutionId, dispatchType: entry.dispatchType, referenceNo: entry.referenceNo,
      arrivalTime: entry.arrivalTime ? entry.arrivalTime.toISOString() : null,
      securityOfficer: entry.securityOfficer, remarks: entry.remarks,
      customerName: entry.customerName, deliveryAddress: entry.deliveryAddress,
      // Freeform capture wins over the linked master (the actual driver at the gate may differ).
      driverName: entry.driverName || driver?.name || null, driverMobile: entry.driverMobile || driver?.phone || null,
      driverLicenseNo: entry.driverLicenseNo, helperName: entry.helperName, helperMobile: entry.helperMobile,
      vehicleTypeEntry: entry.vehicleType, transportMode: entry.transportMode,
      createdAt: entry.createdAt.toISOString(), updatedAt: entry.updatedAt.toISOString(),
      preWeighment: preWeighment ? { id: preWeighment.id, weighmentNo: preWeighment.weighmentNo, tareWeight: Number(preWeighment.tareWeight) } : null,
      loadingConfirmation: loading ? { id: loading.id, loadingNo: loading.loadingNo, loadingStart: loading.loadingStart?.toISOString() ?? null, loadingEnd: loading.loadingEnd?.toISOString() ?? null } : null,
      postWeighment: postWeighment ? { id: postWeighment.id, grossWeight: Number(postWeighment.grossWeight), netWeight: Number(postWeighment.netWeight), toleranceExceeded: postWeighment.toleranceExceeded, approvalStatus: postWeighment.approvalStatus } : null,
      gateExit: gateExit ? { id: gateExit.id, gateExitNo: gateExit.gateExitNo, exitTime: gateExit.exitTime?.toISOString() ?? null, sealVerified: gateExit.sealVerified } : null,
      items: items.map((i) => ({ id: i.id, productId: i.productId, productName: i.productName, sku: i.sku, uom: i.uom, qty: Number(i.qty), remarks: i.remarks })),
    },
  });
}

// PUT /api/transport/gate-entry/[id] — add/correct customer, transport company
// & driver details captured at the gate. Used by the Pre Loading Weighment
// screen's "if anything is not available, add and modify" flow — core
// identifiers (vehicleId, gateEntryNo, dispatchType) are not editable here.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleGateEntry", entityId: Number(params.id) });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = patchInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const input = parsed.data;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id: Number(params.id), deletedAt: null }, select: { id: true, businessId: true, branchId: true, gateEntryNo: true } });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });

  await prisma.vehicleGateEntry.update({
    where: { id: entry.id },
    data: {
      transportCompanyId: input.transportCompanyId === undefined ? undefined : input.transportCompanyId,
      customerName: input.customerName === undefined ? undefined : input.customerName,
      driverName: input.driverName === undefined ? undefined : input.driverName,
      driverMobile: input.driverMobile === undefined ? undefined : input.driverMobile,
      driverLicenseNo: input.driverLicenseNo === undefined ? undefined : input.driverLicenseNo,
      helperName: input.helperName === undefined ? undefined : input.helperName,
      helperMobile: input.helperMobile === undefined ? undefined : input.helperMobile,
      vehicleType: input.vehicleType === undefined ? undefined : input.vehicleType,
      transportMode: input.transportMode === undefined ? undefined : input.transportMode,
      updatedBy: user.id,
    },
  });
  await writeAudit(prisma, user, { action: "vehicle_gate_entry.update", entity: "VehicleGateEntry", entityId: entry.id, summary: `Updated customer/transport/driver details on gate entry ${entry.gateEntryNo}`, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Gate entry details updated." });
}
