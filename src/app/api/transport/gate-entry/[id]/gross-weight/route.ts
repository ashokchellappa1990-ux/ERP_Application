import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

const PERM = "transport.gate-entry";

// GET /api/transport/gate-entry/[id]/gross-weight — minimal display context
// for the "Update Gross Weight" follow-up screen.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const entry = await prisma.vehicleGateEntry.findFirst({
    where: { ...sw, id: Number(params.id), deletedAt: null },
    select: { id: true, gateEntryNo: true, vehicleId: true, supplierName: true, entryType: true, status: true, grossWeight: true },
  });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });
  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: entry.vehicleId }, select: { vehicleNo: true } });
  return NextResponse.json({
    ok: true,
    data: {
      id: entry.id, gateEntryNo: entry.gateEntryNo, vehicleNo: vehicle?.vehicleNo ?? "—",
      supplierName: entry.supplierName, entryType: entry.entryType, status: entry.status,
      grossWeight: entry.grossWeight != null ? Number(entry.grossWeight) : null,
    },
  });
}

// POST /api/transport/gate-entry/[id]/gross-weight — { grossWeight: number }.
// Only valid for a Raw Material entry that doesn't already have a gross weight
// recorded — status is unaffected (Raw Material entries are Inside Factory
// from the moment they're recorded; weight is tracked independently).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleGateEntry" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const grossWeight = Number((raw as { grossWeight?: unknown })?.grossWeight);
  if (!Number.isFinite(grossWeight) || grossWeight < 0) return NextResponse.json({ ok: false, message: "Enter a valid gross weight." }, { status: 422 });

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id: Number(params.id), deletedAt: null }, select: { id: true, gateEntryNo: true, entryType: true, grossWeight: true, businessId: true, branchId: true } });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });
  if (entry.entryType !== "RawMaterial") return NextResponse.json({ ok: false, message: "This action only applies to Raw Material gate entries." }, { status: 422 });
  if (entry.grossWeight != null) return NextResponse.json({ ok: false, message: "Gross weight is already recorded for this entry." }, { status: 422 });

  await prisma.vehicleGateEntry.update({ where: { id: entry.id }, data: { grossWeight, updatedBy: user.id } });
  await writeAudit(prisma, user, { action: "vehicle_gate_entry.gross_weight", entity: "VehicleGateEntry", entityId: entry.id, summary: `Gross weight ${grossWeight} recorded for ${entry.gateEntryNo}`, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Gross weight recorded." });
}
