import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { getDispatchConfig } from "@/lib/settings/dispatchConfig";
import { postLoadingWeighmentInput } from "@/lib/contracts/transport";

const PERM = "transport.post-weighment";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/transport/post-weighment?gateEntryId=123
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const gateEntryId = url.searchParams.get("gateEntryId");
  const where: { tenantId: number; gateEntryId?: number } = { tenantId: user.tenantId };
  if (gateEntryId) where.gateEntryId = Number(gateEntryId);

  const rows = await prisma.postLoadingWeighment.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
      id: r.id, gateEntryId: r.gateEntryId, grossWeight: num(r.grossWeight), tareWeight: num(r.tareWeight), netWeight: num(r.netWeight),
      weighDate: r.weighDate, operator: r.operator, toleranceExceeded: r.toleranceExceeded, approvalStatus: r.approvalStatus,
      remarks: r.remarks, createdAt: r.createdAt.toISOString(),
    })),
  });
}

// POST /api/transport/post-weighment — one gross-weight record per gate entry (unique).
//
// Tolerance-comparison logic (documented per the module spec):
//   1. tareWeight is ALWAYS copied from that gate entry's PreLoadingWeighment row
//      (created earlier in the chain) — it is an error to post-weigh a vehicle
//      that was never tare-weighed.
//   2. netWeight = grossWeight - tareWeight (computed here, never trusted from input).
//   3. A baseline "expected weight" is looked up ONLY when the gate entry carries
//      a dispatchPlanningId AND that Dispatch Planning has a positive
//      estimatedWeight — that is the one place in the schema an actual prior
//      weight estimate exists for this vehicle's load.
//   4. When no baseline is determinable (no linked planning, or no estimated
//      weight recorded on it): toleranceExceeded = false, approvalStatus =
//      "NotRequired" — the flow is NEVER blocked for lack of a baseline.
//   5. When a baseline IS determinable: percentage deviation =
//      abs(netWeight - estimatedWeight) / estimatedWeight * 100, compared
//      against Dispatch Configuration's fields.weightTolerancePct (e.g. "2").
//      Within tolerance → toleranceExceeded = false, approvalStatus =
//      "NotRequired" (no approval needed). Outside tolerance →
//      toleranceExceeded = true, approvalStatus = "Pending" (flagged for a
//      supervisor to review/approve later; the gate entry flow itself is NOT
//      blocked by this — Gate Exit only checks for the ROW's existence, not its
//      approval state).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "PostLoadingWeighment" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = postLoadingWeighmentInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid weighment." }, { status: 422 });
  const input = parsed.data;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id: input.gateEntryId, deletedAt: null } });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });

  const existing = await prisma.postLoadingWeighment.findFirst({ where: { gateEntryId: input.gateEntryId }, select: { id: true } });
  if (existing) return NextResponse.json({ ok: false, message: "A post-loading weighment already exists for this gate entry." }, { status: 422 });

  const preWeighment = await prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: input.gateEntryId, tenantId: user.tenantId } });
  if (!preWeighment) return NextResponse.json({ ok: false, message: "No pre-loading (tare) weighment exists for this gate entry yet." }, { status: 422 });

  const tareWeight = num(preWeighment.tareWeight);
  const grossWeight = input.grossWeight;
  const netWeight = Math.round((grossWeight - tareWeight) * 1000) / 1000;

  let toleranceExceeded = false;
  let approvalStatus: "NotRequired" | "Pending" = "NotRequired";
  if (entry.dispatchPlanningId) {
    const plan = await prisma.dispatchPlanning.findFirst({ where: { id: entry.dispatchPlanningId, tenantId: user.tenantId }, select: { estimatedWeight: true } });
    const baseline = num(plan?.estimatedWeight);
    if (baseline > 0) {
      const cfg = await getDispatchConfig(user);
      const tolerancePct = Number(cfg.fields.weightTolerancePct) || 0;
      const deviationPct = (Math.abs(netWeight - baseline) / baseline) * 100;
      if (deviationPct > tolerancePct) { toleranceExceeded = true; approvalStatus = "Pending"; }
    }
  }

  try {
    const id = await prisma.$transaction(async (tx) => {
      const row = await tx.postLoadingWeighment.create({
        data: {
          tenantId: user.tenantId, gateEntryId: input.gateEntryId, grossWeight, tareWeight, netWeight,
          weighDate: input.weighDate ?? undefined, operator: input.operator ?? undefined,
          toleranceExceeded, approvalStatus, remarks: input.remarks ?? undefined, createdBy: user.id,
        },
        select: { id: true },
      });
      await tx.vehicleMovementHistory.create({
        data: {
          tenantId: user.tenantId, businessId: entry.businessId ?? undefined, branchId: entry.branchId ?? undefined,
          vehicleId: entry.vehicleId, dispatchExecutionId: entry.dispatchExecutionId ?? undefined, gateEntryId: entry.id,
          eventType: "PostWeighment", eventAt: new Date(), actorUserId: user.id, actorName: user.fullName ?? null,
          remarks: `Post-loading weighment — gross ${grossWeight}, net ${netWeight}${toleranceExceeded ? " (tolerance exceeded)" : ""}`,
        },
      });
      return row.id;
    });
    await writeAudit(prisma, user, { action: "post_loading_weighment.create", entity: "PostLoadingWeighment", entityId: id, summary: `Post-loading weighment recorded for gate entry ${entry.gateEntryNo} — net ${netWeight}`, meta: { toleranceExceeded, approvalStatus }, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: toleranceExceeded ? "Post-loading weighment recorded — weight tolerance exceeded, flagged for review." : "Post-loading weighment recorded.", id, netWeight, toleranceExceeded, approvalStatus }, { status: 201 });
  } catch (err) {
    console.error("[transport/post-weighment] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the post-loading weighment." }, { status: 500 });
  }
}
