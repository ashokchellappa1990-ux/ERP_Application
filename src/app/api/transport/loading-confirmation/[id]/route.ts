import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { loadingConfirmationInput } from "@/lib/contracts/transport";

const PERM = "transport.loading-confirmation";

// Closing a loading only needs the tail fields — derived (not redefined) from
// the shared loadingConfirmationInput contract, gateEntryId omitted (it's fixed
// by the [id] already).
const closeInput = loadingConfirmationInput.omit({ gateEntryId: true }).partial();

// GET /api/transport/loading-confirmation/[id] — single record.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const row = await prisma.loadingConfirmation.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!row) return NextResponse.json({ ok: false, message: "Loading confirmation not found." }, { status: 404 });
  return NextResponse.json({
    ok: true,
    data: {
      id: row.id, loadingNo: row.loadingNo, gateEntryId: row.gateEntryId, warehouse: row.warehouse, loadingBayId: row.loadingBayId,
      supervisor: row.supervisor, loadingStart: row.loadingStart?.toISOString() ?? null, loadingEnd: row.loadingEnd?.toISOString() ?? null,
      packages: row.packages, pallets: row.pallets, batchNo: row.batchNo, serialNumber: row.serialNumber, sealNumber: row.sealNumber,
      remarks: row.remarks,
    },
  });
}

// PUT /api/transport/loading-confirmation/[id] — close the loading (loadingEnd + packages/pallets/batch/serial/seal).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoadingConfirmation" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = closeInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid loading close details." }, { status: 422 });
  const input = parsed.data;

  const row = await prisma.loadingConfirmation.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!row) return NextResponse.json({ ok: false, message: "Loading confirmation not found." }, { status: 404 });
  if (row.loadingEnd) return NextResponse.json({ ok: false, message: "This loading is already closed." }, { status: 422 });

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id: row.gateEntryId, deletedAt: null } });
  if (!entry) return NextResponse.json({ ok: false, message: "Linked gate entry not found." }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.loadingConfirmation.update({
        where: { id: row.id },
        data: {
          loadingEnd: input.loadingEnd ? new Date(input.loadingEnd) : new Date(),
          warehouse: input.warehouse ?? row.warehouse, loadingBayId: input.loadingBayId ?? row.loadingBayId,
          supervisor: input.supervisor ?? row.supervisor,
          packages: input.packages ?? row.packages, pallets: input.pallets ?? row.pallets,
          batchNo: input.batchNo ?? row.batchNo, serialNumber: input.serialNumber ?? row.serialNumber,
          sealNumber: input.sealNumber ?? row.sealNumber, remarks: input.remarks ?? row.remarks,
        },
      });
      await tx.vehicleMovementHistory.create({
        data: {
          tenantId: user.tenantId, businessId: entry.businessId ?? undefined, branchId: entry.branchId ?? undefined,
          vehicleId: entry.vehicleId, dispatchExecutionId: entry.dispatchExecutionId ?? undefined, gateEntryId: entry.id,
          eventType: "LoadingEnd", eventAt: new Date(), actorUserId: user.id, actorName: user.fullName ?? null,
          remarks: `Loading ${row.loadingNo} closed`,
        },
      });
    });
    await writeAudit(prisma, user, { action: "loading_confirmation.close", entity: "LoadingConfirmation", entityId: row.id, summary: `Loading ${row.loadingNo} closed for gate entry ${entry.gateEntryNo}`, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Loading closed." });
  } catch (err) {
    console.error("[transport/loading-confirmation] close error", err);
    return NextResponse.json({ ok: false, message: "Could not close the loading." }, { status: 500 });
  }
}
