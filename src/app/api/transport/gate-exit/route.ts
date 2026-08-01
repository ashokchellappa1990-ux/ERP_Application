import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { getDispatchConfig } from "@/lib/settings/dispatchConfig";
import { stampTerminal } from "@/lib/pos/terminalContext";
import { requireTerminalForTxn } from "@/lib/pos/terminalGuard";
import { completeExecution } from "@/lib/transport/dispatchExecution";
import { gateExitInput } from "@/lib/contracts/transport";

const PERM = "transport.gate-exit";

// GET /api/transport/gate-exit?gateEntryId=123
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const gateEntryId = url.searchParams.get("gateEntryId");
  const where: { tenantId: number; gateEntryId?: number } = { tenantId: user.tenantId };
  if (gateEntryId) where.gateEntryId = Number(gateEntryId);

  const rows = await prisma.gateExit.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
      id: r.id, gateExitNo: r.gateExitNo, gateEntryId: r.gateEntryId, vehicleId: r.vehicleId,
      exitTime: r.exitTime?.toISOString() ?? null, securityOfficer: r.securityOfficer, sealVerified: r.sealVerified,
      remarks: r.remarks, createdAt: r.createdAt.toISOString(),
    })),
  });
}

// POST /api/transport/gate-exit — final step of the physical chain: validates
// the configured prerequisites, records the exit, flips the gate entry to
// "Exited", and (best-effort) completes the linked Dispatch Execution.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "GateExit" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = gateExitInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid gate exit." }, { status: 422 });
  const input = parsed.data;

  const scope = await getActiveScope(user);
  const sw = scopeWhere(scope, { branch: true });
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id: input.gateEntryId, deletedAt: null } });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });
  if (entry.status === "Exited") return NextResponse.json({ ok: false, message: "This vehicle has already exited." }, { status: 422 });

  const already = await prisma.gateExit.findFirst({ where: { gateEntryId: input.gateEntryId }, select: { id: true } });
  if (already) return NextResponse.json({ ok: false, message: "A gate exit already exists for this gate entry." }, { status: 422 });

  // Prerequisite checks driven by Dispatch Configuration flags.
  const cfg = await getDispatchConfig(user);
  const missing: string[] = [];
  if (cfg.flags.requireLoadingConfirmation) {
    const lc = await prisma.loadingConfirmation.findFirst({ where: { gateEntryId: input.gateEntryId, tenantId: user.tenantId } });
    if (!lc) missing.push("Loading Confirmation");
  }
  if (cfg.flags.requireWeighment) {
    const [pre, post] = await Promise.all([
      prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: input.gateEntryId, tenantId: user.tenantId } }),
      prisma.postLoadingWeighment.findFirst({ where: { gateEntryId: input.gateEntryId } }),
    ]);
    if (!pre) missing.push("Pre-Loading Weighment");
    if (!post) missing.push("Post-Loading Weighment");
  }
  if (missing.length) {
    return NextResponse.json({ ok: false, message: `Cannot exit — missing: ${missing.join(", ")}.` }, { status: 422 });
  }

  const { denied: tDenied, ctx } = await requireTerminalForTxn(user, { label: "vehicle dispatch" });
  if (tDenied) return tDenied;
  const stamp = stampTerminal(ctx);

  let id: number;
  try {
    id = await prisma.$transaction(async (tx) => {
      const row = await tx.gateExit.create({
        data: {
          tenantId: user.tenantId, gateExitNo: "TMP", gateEntryId: input.gateEntryId, vehicleId: entry.vehicleId,
          exitTime: input.exitTime ? new Date(input.exitTime) : new Date(), securityOfficer: input.securityOfficer ?? undefined,
          sealVerified: input.sealVerified, remarks: input.remarks ?? undefined, createdBy: user.id,
        },
        select: { id: true },
      });
      const gateExitNo = `GOUT-${row.id}`;
      await tx.gateExit.update({ where: { id: row.id }, data: { gateExitNo } });
      await tx.vehicleGateEntry.update({ where: { id: entry.id }, data: { status: "Exited", updatedBy: user.id } });
      await tx.vehicleMovementHistory.create({
        data: {
          tenantId: user.tenantId, businessId: entry.businessId ?? undefined, branchId: entry.branchId ?? undefined,
          vehicleId: entry.vehicleId, dispatchExecutionId: entry.dispatchExecutionId ?? undefined, gateEntryId: entry.id,
          eventType: "GateOut", eventAt: new Date(), actorUserId: user.id, actorName: user.fullName ?? null,
          remarks: `Gate exit ${gateExitNo} recorded`,
        },
      });
      return row.id;
    });
  } catch (err) {
    console.error("[transport/gate-exit] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the gate exit." }, { status: 500 });
  }

  await writeAudit(prisma, user, { action: "gate_exit.create", entity: "GateExit", entityId: id, summary: `Gate exit recorded for ${entry.gateEntryNo}`, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });

  // The gate exit itself is committed at this point regardless of what happens
  // next — completion of the linked Dispatch Execution (stock/GL/invoice) is a
  // best-effort follow-on step and must never roll back the physical gate exit.
  let warning: string | null = null;
  if (entry.dispatchExecutionId) {
    try {
      await completeExecution(scope, { id: user.id, tenantId: user.tenantId, fullName: user.fullName ?? null }, entry.dispatchExecutionId, { stamp });
    } catch (err) {
      console.error("[transport/gate-exit] completeExecution failed", err);
      warning = "Gate exit was recorded, but completing the linked dispatch (invoice/posting) failed — please complete it manually from Dispatch Execution.";
    }
  }

  return NextResponse.json({ ok: true, message: "Vehicle gate exit recorded.", id, warning });
}
