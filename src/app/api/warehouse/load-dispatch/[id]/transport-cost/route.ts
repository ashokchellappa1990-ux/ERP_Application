import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { loadDispatchTransportCostInput } from "@/lib/contracts/loadDispatch";

const PERM = "warehouse.transfer";
const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface TransportCostDto {
  transportCompanyId: number | null; vehicleId: number | null; distance: number;
  freightCharge: number; loadingCharge: number; unloadingCharge: number; fuelCharge: number; tollCharge: number;
  driverAllowance: number; helperAllowance: number; driverBatta: number; vehicleRent: number; transitPass: number;
  otherCharges: number; discount: number; gstAmount: number;
  totalCost: number; remarks: string | null;
}

function toDto(r: {
  transportCompanyId: number | null; vehicleId: number | null; distance: unknown;
  freightCharge: unknown; loadingCharge: unknown; unloadingCharge: unknown; fuelCharge: unknown; tollCharge: unknown;
  driverAllowance: unknown; helperAllowance: unknown; driverBatta: unknown; vehicleRent: unknown; transitPass: unknown;
  otherCharges: unknown; discount: unknown; gstAmount: unknown;
  totalCost: unknown; remarks: string | null;
}): TransportCostDto {
  return {
    transportCompanyId: r.transportCompanyId, vehicleId: r.vehicleId, distance: num(r.distance),
    freightCharge: num(r.freightCharge), loadingCharge: num(r.loadingCharge), unloadingCharge: num(r.unloadingCharge),
    fuelCharge: num(r.fuelCharge), tollCharge: num(r.tollCharge), driverAllowance: num(r.driverAllowance),
    helperAllowance: num(r.helperAllowance), driverBatta: num(r.driverBatta), vehicleRent: num(r.vehicleRent), transitPass: num(r.transitPass),
    otherCharges: num(r.otherCharges), discount: num(r.discount),
    gstAmount: num(r.gstAmount), totalCost: num(r.totalCost), remarks: r.remarks,
  };
}

// GET /api/warehouse/load-dispatch/[id]/transport-cost — fetch the single
// TransportCost row for this dispatch, if any (Section "Transport Cost").
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const doc = await prisma.loadDispatch.findFirst({ where: { ...sw, id, deletedAt: null }, select: { id: true } });
  if (!doc) return NextResponse.json({ ok: false, message: "Load & Dispatch not found." }, { status: 404 });

  const row = await prisma.transportCost.findUnique({ where: { loadDispatchId: id } });
  return NextResponse.json({ ok: true, data: row ? toDto(row) : null });
}

// PUT /api/warehouse/load-dispatch/[id]/transport-cost — upsert (one row per
// dispatch, keyed by the unique loadDispatchId). totalCost is always computed
// server-side as the authoritative figure (sum of charges − discount + GST) —
// never trust a client-sent total.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "LoadDispatch", entityId: id });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = loadDispatchTransportCostInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const doc = await prisma.loadDispatch.findFirst({ where: { ...sw, id, deletedAt: null }, select: { id: true, dispatchNo: true, businessId: true, branchId: true } });
  if (!doc) return NextResponse.json({ ok: false, message: "Load & Dispatch not found." }, { status: 404 });

  const totalCost = b.freightCharge + b.loadingCharge + b.unloadingCharge + b.fuelCharge + b.tollCharge
    + b.driverAllowance + b.helperAllowance + b.driverBatta + b.vehicleRent + b.transitPass + b.otherCharges - b.discount + b.gstAmount;

  const data = {
    transportCompanyId: b.transportCompanyId ?? null, vehicleId: b.vehicleId ?? null, distance: b.distance,
    freightCharge: b.freightCharge, loadingCharge: b.loadingCharge, unloadingCharge: b.unloadingCharge,
    fuelCharge: b.fuelCharge, tollCharge: b.tollCharge, driverAllowance: b.driverAllowance, helperAllowance: b.helperAllowance,
    driverBatta: b.driverBatta, vehicleRent: b.vehicleRent, transitPass: b.transitPass,
    otherCharges: b.otherCharges, discount: b.discount, gstAmount: b.gstAmount, totalCost, remarks: b.remarks ?? null,
    updatedBy: user.id,
  };

  const row = await prisma.transportCost.upsert({
    where: { loadDispatchId: id },
    update: data,
    create: {
      tenantId: user.tenantId, businessId: doc.businessId ?? null, branchId: doc.branchId ?? null,
      loadDispatchId: id, createdBy: user.id, ...data,
    },
  });

  await writeAudit(prisma, user, { action: "load_dispatch.transport_cost.save", entity: "LoadDispatch", entityId: id, summary: `Saved transport cost for Load & Dispatch ${doc.dispatchNo}`, businessId: doc.businessId ?? null, branchId: doc.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Transport cost saved.", data: toDto(row) });
}
