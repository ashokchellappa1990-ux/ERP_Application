import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { preLoadingWeighmentInput } from "@/lib/contracts/transport";

const PERM = "transport.pre-weighment";

// GET /api/transport/pre-weighment?gateEntryId=123 — list (usually a single row).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const gateEntryId = url.searchParams.get("gateEntryId");
  const where: { tenantId: number; gateEntryId?: number } = { tenantId: user.tenantId };
  if (gateEntryId) where.gateEntryId = Number(gateEntryId);

  const rows = await prisma.preLoadingWeighment.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
      id: r.id, weighmentNo: r.weighmentNo, gateEntryId: r.gateEntryId, vehicleId: r.vehicleId,
      tareWeight: Number(r.tareWeight), weighDate: r.weighDate, weighTime: r.weighTime, operator: r.operator,
      weighbridgeId: r.weighbridgeId, photoUrl: r.photoUrl, remarks: r.remarks, createdAt: r.createdAt.toISOString(),
    })),
  });
}

// POST /api/transport/pre-weighment — one tare-weight record per gate entry.
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

  // No DB-level unique constraint on gateEntryId — enforce "one pre-weighment
  // per gate entry" here so a vehicle can't be weighed-in twice.
  const existing = await prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: input.gateEntryId, tenantId: user.tenantId }, select: { id: true } });
  if (existing) return NextResponse.json({ ok: false, message: "A pre-loading weighment already exists for this gate entry." }, { status: 422 });

  // Completing the pre-loading weighment is the vehicle's cue to move inside —
  // auto-advance Waiting -> Inside Factory instead of requiring a separate
  // manual "Move Inside" click for what's really the same physical event.
  const autoMovedInside = entry.status === "Waiting";

  try {
    const id = await prisma.$transaction(async (tx) => {
      const row = await tx.preLoadingWeighment.create({
        data: {
          tenantId: user.tenantId, weighmentNo: "TMP", gateEntryId: input.gateEntryId, vehicleId: entry.vehicleId,
          tareWeight: input.tareWeight, weighDate: input.weighDate ?? undefined, weighTime: input.weighTime ?? undefined,
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
          remarks: `Pre-loading weighment ${weighmentNo} — tare ${input.tareWeight}`,
        },
      });
      if (autoMovedInside) {
        await tx.vehicleGateEntry.update({ where: { id: entry.id }, data: { status: "Inside Factory", updatedBy: user.id } });
      }
      return row.id;
    });
    await writeAudit(prisma, user, { action: "pre_loading_weighment.create", entity: "PreLoadingWeighment", entityId: id, summary: `Pre-loading weighment recorded for gate entry ${entry.gateEntryNo}`, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
    if (autoMovedInside) {
      await writeAudit(prisma, user, { action: "vehicle_gate_entry.move-inside", entity: "VehicleGateEntry", entityId: entry.id, summary: `Gate entry ${entry.gateEntryNo} Waiting → Inside Factory (auto, on pre-loading weighment)`, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
    }
    return NextResponse.json({
      ok: true,
      message: autoMovedInside ? "Pre-loading weighment recorded — vehicle moved inside." : "Pre-loading weighment recorded.",
      id,
      gateEntryStatus: autoMovedInside ? "Inside Factory" : entry.status,
    }, { status: 201 });
  } catch (err) {
    console.error("[transport/pre-weighment] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the pre-loading weighment." }, { status: 500 });
  }
}
