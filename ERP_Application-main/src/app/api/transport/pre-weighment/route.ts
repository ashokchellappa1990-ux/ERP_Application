import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { preLoadingWeighmentInput, weighmentTypeOf } from "@/lib/contracts/transport";

const PERM = "transport.pre-weighment";

// GET /api/transport/pre-weighment?gateEntryId=123&type=Sales|Purchase — Entry Weighment list.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const gateEntryId = url.searchParams.get("gateEntryId");
  const type = url.searchParams.get("type");
  const where: { tenantId: number; gateEntryId?: number; weighmentType?: string } = { tenantId: user.tenantId };
  if (gateEntryId) where.gateEntryId = Number(gateEntryId);
  if (type === "Sales" || type === "Purchase") where.weighmentType = type;

  const rows = await prisma.preLoadingWeighment.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
      id: r.id, weighmentNo: r.weighmentNo, gateEntryId: r.gateEntryId, vehicleId: r.vehicleId, weighmentType: r.weighmentType,
      tareWeight: Number(r.tareWeight), grossWeight: r.grossWeight != null ? Number(r.grossWeight) : null,
      weighDate: r.weighDate, weighTime: r.weighTime, operator: r.operator,
      weighbridgeId: r.weighbridgeId, photoUrl: r.photoUrl, remarks: r.remarks, createdAt: r.createdAt.toISOString(),
    })),
  });
}

// POST /api/transport/pre-weighment — one Entry Weighment per gate entry.
//   Sales    (Dispatch gate entry):    { tareWeight } — empty vehicle before loading.
//   Purchase (RawMaterial gate entry): { grossWeight } — loaded vehicle before
//     unloading, plus the GRN-prefill details (bill net weight, weight slip ref,
//     inventory area, product) which are also written onto the gate entry, where
//     the GRN's "Create from Gate Entry" flow reads them.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "PreLoadingWeighment" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = preLoadingWeighmentInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid weighment." }, { status: 422 });
  const input = parsed.data;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id: input.gateEntryId, deletedAt: null } });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });
  if (entry.status === "Exited") return NextResponse.json({ ok: false, message: "This vehicle has already exited." }, { status: 422 });

  const weighmentType = weighmentTypeOf(entry.entryType);
  const isPurchase = weighmentType === "Purchase";
  if (isPurchase) {
    if (input.grossWeight == null || input.grossWeight <= 0) return NextResponse.json({ ok: false, message: "Enter a valid gross (loaded vehicle) weight." }, { status: 422 });
    if (entry.grnId) return NextResponse.json({ ok: false, message: "A GRN has already been created for this gate entry." }, { status: 422 });
  } else if (input.tareWeight == null) {
    return NextResponse.json({ ok: false, message: "Enter a valid tare (empty vehicle) weight." }, { status: 422 });
  }

  // No DB-level unique constraint on gateEntryId — enforce "one first
  // weighment per gate entry" here so a vehicle can't be weighed-in twice.
  const existing = await prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: input.gateEntryId, tenantId: user.tenantId }, select: { id: true } });
  if (existing) return NextResponse.json({ ok: false, message: "An entry weighment already exists for this gate entry." }, { status: 422 });

  // Purchase-only GRN-prefill details, validated against this tenant's masters.
  let product: { id: number; name: string; sku: string | null; uom: string | null } | null = null;
  let areaId: number | null = null;
  if (isPurchase) {
    if (input.productId) {
      const p = await prisma.product.findFirst({ where: { id: input.productId, tenantId: user.tenantId }, select: { id: true, name: true, sku: true, baseUom: true } });
      if (!p) return NextResponse.json({ ok: false, message: "Selected product was not found in your catalog." }, { status: 422 });
      product = { id: p.id, name: p.name, sku: p.sku ?? null, uom: p.baseUom ?? null };
    }
    if (input.areaId) areaId = (await prisma.area.findFirst({ where: { id: input.areaId, tenantId: user.tenantId }, select: { id: true } }))?.id ?? null;
  }

  // Completing the entry weighment is the vehicle's cue to move inside —
  // auto-advance Waiting -> Inside Factory instead of requiring a separate
  // manual "Move Inside" click for what's really the same physical event.
  const autoMovedInside = entry.status === "Waiting";
  const weightLabel = isPurchase ? `gross ${input.grossWeight}` : `tare ${input.tareWeight}`;

  try {
    const id = await prisma.$transaction(async (tx) => {
      const row = await tx.preLoadingWeighment.create({
        data: {
          tenantId: user.tenantId, weighmentNo: "TMP", gateEntryId: input.gateEntryId, vehicleId: entry.vehicleId, weighmentType,
          tareWeight: isPurchase ? 0 : (input.tareWeight ?? 0), grossWeight: isPurchase ? input.grossWeight : null,
          weighDate: input.weighDate ?? undefined, weighTime: input.weighTime ?? undefined,
          operator: input.operator ?? undefined, weighbridgeId: input.weighbridgeId ?? undefined,
          photoUrl: input.photoUrl ?? undefined, remarks: input.remarks ?? undefined, createdBy: user.id,
        },
        select: { id: true },
      });
      const weighmentNo = `PWT-${row.id}`;
      await tx.preLoadingWeighment.update({ where: { id: row.id }, data: { weighmentNo } });
      await tx.vehicleMovementHistory.create({
        data: {
          tenantId: user.tenantId, businessId: entry.businessId ?? undefined, branchId: entry.branchId ?? undefined,
          vehicleId: entry.vehicleId, dispatchExecutionId: entry.dispatchExecutionId ?? undefined, gateEntryId: entry.id,
          eventType: "PreWeighment", eventAt: new Date(), actorUserId: user.id, actorName: user.fullName ?? null,
          remarks: `Entry weighment ${weighmentNo} (${weighmentType}) — ${weightLabel}`,
        },
      });
      if (isPurchase) {
        // The gate entry's netWeight is the supplier-slip figure (it prefills
        // the GRN's "Net Weight as per Bill"), not a calculated net.
        await tx.vehicleGateEntry.update({
          where: { id: entry.id },
          data: {
            grossWeight: input.grossWeight, netWeight: input.billNetWeight ?? null, weightSlipRefNo: input.weightSlipRefNo || null, areaId,
            ...(autoMovedInside ? { status: "Inside Factory" } : {}), updatedBy: user.id,
          },
        });
        if (product) {
          await tx.vehicleGateEntryItem.deleteMany({ where: { gateEntryId: entry.id } });
          await tx.vehicleGateEntryItem.create({ data: { tenantId: user.tenantId, gateEntryId: entry.id, productId: product.id, productName: product.name, sku: product.sku ?? undefined, uom: product.uom ?? undefined, qty: 1 } });
        }
      } else if (autoMovedInside) {
        await tx.vehicleGateEntry.update({ where: { id: entry.id }, data: { status: "Inside Factory", updatedBy: user.id } });
      }
      return row.id;
    });
    await writeAudit(prisma, user, { action: "pre_loading_weighment.create", entity: "PreLoadingWeighment", entityId: id, summary: `Entry weighment (${weighmentType}, ${weightLabel}) recorded for gate entry ${entry.gateEntryNo}`, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
    if (autoMovedInside) {
      await writeAudit(prisma, user, { action: "vehicle_gate_entry.move-inside", entity: "VehicleGateEntry", entityId: entry.id, summary: `Gate entry ${entry.gateEntryNo} Waiting → Inside Factory (auto, on entry weighment)`, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
    }
    return NextResponse.json({
      ok: true,
      message: autoMovedInside ? "Entry weighment recorded — vehicle moved inside." : "Entry weighment recorded.",
      id, weighmentType,
      gateEntryStatus: autoMovedInside ? "Inside Factory" : entry.status,
    }, { status: 201 });
  } catch (err) {
    console.error("[transport/pre-weighment] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the entry weighment." }, { status: 500 });
  }
}
