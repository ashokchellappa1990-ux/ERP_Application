import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { loadingConfirmationInput } from "@/lib/contracts/transport";

const PERM = "transport.loading-confirmation";

// GET /api/transport/loading-confirmation?gateEntryId=123 — list.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const gateEntryId = url.searchParams.get("gateEntryId");
  const where: { tenantId: number; gateEntryId?: number } = { tenantId: user.tenantId };
  if (gateEntryId) where.gateEntryId = Number(gateEntryId);

  const rows = await prisma.loadingConfirmation.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
      id: r.id, loadingNo: r.loadingNo, gateEntryId: r.gateEntryId, warehouse: r.warehouse, loadingBayId: r.loadingBayId,
      supervisor: r.supervisor, loadingStart: r.loadingStart?.toISOString() ?? null, loadingEnd: r.loadingEnd?.toISOString() ?? null,
      packages: r.packages, pallets: r.pallets, batchNo: r.batchNo, serialNumber: r.serialNumber, sealNumber: r.sealNumber,
      remarks: r.remarks, createdAt: r.createdAt.toISOString(),
    })),
  });
}

// POST /api/transport/loading-confirmation — opens loading (loadingStart set now).
// Closing (loadingEnd + packages/pallets/batch/serial/seal) happens via
// PUT /api/transport/loading-confirmation/[id].
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoadingConfirmation" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = loadingConfirmationInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid loading confirmation." }, { status: 422 });
  const input = parsed.data;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id: input.gateEntryId, deletedAt: null } });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });
  if (entry.status !== "Inside Factory" && entry.status !== "Loading") {
    return NextResponse.json({ ok: false, message: `Loading cannot start while the gate entry is ${entry.status}.` }, { status: 422 });
  }

  const open = await prisma.loadingConfirmation.findFirst({ where: { gateEntryId: input.gateEntryId, tenantId: user.tenantId, loadingEnd: null } });
  if (open) return NextResponse.json({ ok: false, message: "A loading is already open for this gate entry — close it before starting a new one." }, { status: 422 });

  try {
    const id = await prisma.$transaction(async (tx) => {
      const row = await tx.loadingConfirmation.create({
        data: {
          tenantId: user.tenantId, loadingNo: "TMP", gateEntryId: input.gateEntryId, warehouse: input.warehouse ?? undefined,
          loadingBayId: input.loadingBayId ?? undefined, supervisor: input.supervisor ?? undefined,
          loadingStart: input.loadingStart ? new Date(input.loadingStart) : new Date(),
          packages: input.packages, pallets: input.pallets, batchNo: input.batchNo ?? undefined,
          serialNumber: input.serialNumber ?? undefined, sealNumber: input.sealNumber ?? undefined,
          remarks: input.remarks ?? undefined, createdBy: user.id,
        },
        select: { id: true },
      });
      const loadingNo = `LOAD-${row.id}`;
      await tx.loadingConfirmation.update({ where: { id: row.id }, data: { loadingNo } });
      await tx.vehicleMovementHistory.create({
        data: {
          tenantId: user.tenantId, businessId: entry.businessId ?? undefined, branchId: entry.branchId ?? undefined,
          vehicleId: entry.vehicleId, dispatchExecutionId: entry.dispatchExecutionId ?? undefined, gateEntryId: entry.id,
          eventType: "LoadingStart", eventAt: new Date(), actorUserId: user.id, actorName: user.fullName ?? null,
          remarks: `Loading ${loadingNo} started`,
        },
      });
      return row.id;
    });
    await writeAudit(prisma, user, { action: "loading_confirmation.create", entity: "LoadingConfirmation", entityId: id, summary: `Loading started for gate entry ${entry.gateEntryNo}`, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Loading started.", id }, { status: 201 });
  } catch (err) {
    console.error("[transport/loading-confirmation] create error", err);
    return NextResponse.json({ ok: false, message: "Could not start loading." }, { status: 500 });
  }
}
