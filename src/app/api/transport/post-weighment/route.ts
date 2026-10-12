import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { getDispatchConfig } from "@/lib/settings/dispatchConfig";
<<<<<<< HEAD
import { postLoadingWeighmentInput, weighmentTypeOf } from "@/lib/contracts/transport";
=======
import { postLoadingWeighmentInput } from "@/lib/contracts/transport";
>>>>>>> origin/main

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
<<<<<<< HEAD
  const type = url.searchParams.get("type");
  const where: { tenantId: number; gateEntryId?: number; weighmentType?: string } = { tenantId: user.tenantId };
  if (gateEntryId) where.gateEntryId = Number(gateEntryId);
  if (type === "Sales" || type === "Purchase") where.weighmentType = type;
=======
  const where: { tenantId: number; gateEntryId?: number } = { tenantId: user.tenantId };
  if (gateEntryId) where.gateEntryId = Number(gateEntryId);
>>>>>>> origin/main

  const rows = await prisma.postLoadingWeighment.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
<<<<<<< HEAD
      id: r.id, gateEntryId: r.gateEntryId, weighmentType: r.weighmentType, grossWeight: num(r.grossWeight), tareWeight: num(r.tareWeight), netWeight: num(r.netWeight),
=======
      id: r.id, gateEntryId: r.gateEntryId, grossWeight: num(r.grossWeight), tareWeight: num(r.tareWeight), netWeight: num(r.netWeight),
>>>>>>> origin/main
      weighDate: r.weighDate, operator: r.operator, toleranceExceeded: r.toleranceExceeded, approvalStatus: r.approvalStatus,
      remarks: r.remarks, createdAt: r.createdAt.toISOString(),
    })),
  });
}

<<<<<<< HEAD
// POST /api/transport/post-weighment — one Exit Weighment per gate entry (unique).
// Purchase (RawMaterial gate entry) is handled by postPurchase() below: the
// input is the tare (empty vehicle after unloading), gross comes from the First
// Weighment, and the result is synced onto the GRN. Everything else is Sales:
=======
// POST /api/transport/post-weighment — one gross-weight record per gate entry (unique).
>>>>>>> origin/main
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
<<<<<<< HEAD
  if (existing) return NextResponse.json({ ok: false, message: "An exit weighment already exists for this gate entry." }, { status: 422 });

  const preWeighment = await prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: input.gateEntryId, tenantId: user.tenantId } });

  if (weighmentTypeOf(entry.entryType) === "Purchase") return postPurchase(req, user, entry, preWeighment, input);

  if (!preWeighment) return NextResponse.json({ ok: false, message: "No first (tare) weighment exists for this gate entry yet." }, { status: 422 });
  if (input.grossWeight == null || input.grossWeight <= 0) return NextResponse.json({ ok: false, message: "Enter a valid gross (loaded vehicle) weight." }, { status: 422 });
=======
  if (existing) return NextResponse.json({ ok: false, message: "A post-loading weighment already exists for this gate entry." }, { status: 422 });

  const preWeighment = await prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: input.gateEntryId, tenantId: user.tenantId } });
  if (!preWeighment) return NextResponse.json({ ok: false, message: "No pre-loading (tare) weighment exists for this gate entry yet." }, { status: 422 });
>>>>>>> origin/main

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
<<<<<<< HEAD
    return NextResponse.json({ ok: true, message: toleranceExceeded ? "Exit weighment recorded — weight tolerance exceeded, flagged for review." : "Exit weighment recorded.", id, netWeight, toleranceExceeded, approvalStatus }, { status: 201 });
  } catch (err) {
    console.error("[transport/post-weighment] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the exit weighment." }, { status: 500 });
  }
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
type GateEntry = NonNullable<Awaited<ReturnType<typeof prisma.vehicleGateEntry.findFirst>>>;
type PreWeighment = Awaited<ReturnType<typeof prisma.preLoadingWeighment.findFirst>>;

// Purchase Exit Weighment — the empty vehicle after unloading. Gross comes
// from the Entry Weighment (or, for entries weighed before Entry Weighment
// covered Purchase, the gate entry's own grossWeight). The tare is written to
// the gate entry, where a GRN created later prefills it from; if the GRN
// already exists (and isn't invoiced yet) its tare/net are updated directly —
// so the two can happen in either order.
async function postPurchase(req: Request, user: SessionUser, entry: GateEntry, pre: PreWeighment, input: { gateEntryId: number; tareWeight?: number | null; weighDate?: string | null; operator?: string | null; remarks?: string | null }) {
  const grossWeight = num(pre?.grossWeight ?? entry.grossWeight);
  if (!(grossWeight > 0)) return NextResponse.json({ ok: false, message: "No first (gross) weighment exists for this gate entry yet." }, { status: 422 });
  const tareWeight = input.tareWeight;
  if (tareWeight == null || tareWeight <= 0) return NextResponse.json({ ok: false, message: "Enter a valid tare (empty vehicle) weight." }, { status: 422 });
  if (tareWeight > grossWeight) return NextResponse.json({ ok: false, message: `Tare weight can't exceed the gross weight (${grossWeight}).` }, { status: 422 });
  const netWeight = Math.round((grossWeight - tareWeight) * 1000) / 1000;

  const grn = entry.grnId
    ? await prisma.goodsReceiptNote.findFirst({ where: { id: entry.grnId, tenantId: user.tenantId }, select: { id: true, grnNo: true, status: true, weightUom: true, grossWeight: true, invoiceRecorded: true } })
    : null;
  const syncGrn = !!grn && !!grn.weightUom && grn.status !== "Cancelled" && !grn.invoiceRecorded;
  const grnNet = syncGrn ? +(num(grn!.grossWeight) - tareWeight).toFixed(3) : null;

  try {
    const id = await prisma.$transaction(async (tx) => {
      const row = await tx.postLoadingWeighment.create({
        data: {
          tenantId: user.tenantId, gateEntryId: entry.id, weighmentType: "Purchase", grossWeight, tareWeight, netWeight,
          weighDate: input.weighDate ?? undefined, operator: input.operator ?? undefined,
          remarks: input.remarks ?? undefined, createdBy: user.id,
        },
        select: { id: true },
      });
      await tx.vehicleGateEntry.update({ where: { id: entry.id }, data: { tareWeight, updatedBy: user.id } });
      if (syncGrn) await tx.goodsReceiptNote.update({ where: { id: grn!.id }, data: { tareWeight, netWeight: grnNet } });
      await tx.vehicleMovementHistory.create({
        data: {
          tenantId: user.tenantId, businessId: entry.businessId ?? undefined, branchId: entry.branchId ?? undefined,
          vehicleId: entry.vehicleId, dispatchExecutionId: entry.dispatchExecutionId ?? undefined, gateEntryId: entry.id,
          eventType: "PostWeighment", eventAt: new Date(), actorUserId: user.id, actorName: user.fullName ?? null,
          remarks: `Exit weighment (Purchase) — tare ${tareWeight}, net ${netWeight}`,
        },
      });
      return row.id;
    });
    await writeAudit(prisma, user, { action: "post_loading_weighment.create", entity: "PostLoadingWeighment", entityId: id, summary: `Exit weighment (Purchase) recorded for gate entry ${entry.gateEntryNo} — net ${netWeight}`, meta: { grnSynced: syncGrn ? grn!.grnNo : null }, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
    const grnNote = syncGrn ? ` GRN ${grn!.grnNo} tare updated.` : grn ? ` GRN ${grn.grnNo} was not changed (${grn.invoiceRecorded ? "invoice already recorded" : grn.status === "Cancelled" ? "cancelled" : "not a weight-based GRN"}).` : "";
    return NextResponse.json({ ok: true, message: `Exit weighment recorded — net ${netWeight}.${grnNote}`, id, netWeight, grnId: grn?.id ?? null, grnSynced: syncGrn }, { status: 201 });
  } catch (err) {
    console.error("[transport/post-weighment] purchase create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the exit weighment." }, { status: 500 });
=======
    return NextResponse.json({ ok: true, message: toleranceExceeded ? "Post-loading weighment recorded — weight tolerance exceeded, flagged for review." : "Post-loading weighment recorded.", id, netWeight, toleranceExceeded, approvalStatus }, { status: 201 });
  } catch (err) {
    console.error("[transport/post-weighment] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the post-loading weighment." }, { status: 500 });
>>>>>>> origin/main
  }
}
