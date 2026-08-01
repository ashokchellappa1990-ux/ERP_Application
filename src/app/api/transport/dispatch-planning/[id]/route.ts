import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { dispatchPlanningInput } from "@/lib/contracts/transport";
import type { DispatchPlanningDetail } from "@/lib/contracts/transport";

const PERM = "warehouse";
const num = (v: unknown) => (v == null ? 0 : Number(v));

async function load(req: Request, id: number) {
  const user = await getSessionUser();
  if (!user) return { err: NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 }) };
  const denied = await requirePermission(user, PERM, { req, entity: "DispatchPlanning" });
  if (denied) return { err: denied };
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const plan = await prisma.dispatchPlanning.findFirst({ where: { ...sw, id, deletedAt: null }, include: { items: { orderBy: { id: "asc" } } } });
  if (!plan) return { err: NextResponse.json({ ok: false, message: "Dispatch plan not found." }, { status: 404 }) };
  return { user, plan };
}

// GET /api/transport/dispatch-planning/[id] — full detail with items.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const r = await load(req, Number(params.id));
  if ("err" in r) return r.err;
  const p = r.plan;
  const data: DispatchPlanningDetail = {
    id: p.id, planningNo: p.planningNo, planningDate: p.planningDate, dispatchSource: p.dispatchSource,
    referenceType: p.referenceType, referenceId: p.referenceId, referenceNo: p.referenceNo,
    warehouse: p.warehouse, expectedDispatchDate: p.expectedDispatchDate, priority: p.priority,
    transportMode: p.transportMode, estimatedWeight: num(p.estimatedWeight), estimatedVolume: num(p.estimatedVolume),
    remarks: p.remarks, status: p.status,
    approvedByName: p.approvedByName, approvedAt: p.approvedAt?.toISOString() ?? null,
    cancelledAt: p.cancelledAt?.toISOString() ?? null, cancelReason: p.cancelReason,
    createdByName: p.createdByName, createdAt: p.createdAt.toISOString(),
    items: p.items.map((it) => ({ id: it.id, productId: it.productId, productName: it.productName, sku: it.sku, batchNo: it.batchNo, qty: num(it.qty), uom: it.uom, remarks: it.remarks })),
  };
  return NextResponse.json({ ok: true, data });
}

// PUT /api/transport/dispatch-planning/[id] — edit a Draft plan (full replace of header + items).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const r = await load(req, Number(params.id));
  if ("err" in r) return r.err;
  const { user, plan } = r;
  if (plan.status !== "Draft") return NextResponse.json({ ok: false, message: "Only draft dispatch plans can be edited." }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = dispatchPlanningInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;
  if (!body.items.length) return NextResponse.json({ ok: false, message: "Add at least one item." }, { status: 422 });

  const productIds = Array.from(new Set(body.items.map((i) => i.productId)));
  const prods = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: user.tenantId }, select: { id: true, name: true, sku: true, baseUom: true } });
  if (prods.length !== productIds.length) return NextResponse.json({ ok: false, message: "One or more items are not in your catalog." }, { status: 422 });
  const byId = new Map(prods.map((p) => [p.id, p]));

  await prisma.$transaction(async (tx) => {
    await tx.dispatchPlanningItem.deleteMany({ where: { planningId: plan.id } });
    await tx.dispatchPlanning.update({
      where: { id: plan.id },
      data: {
        planningDate: body.planningDate || plan.planningDate, dispatchSource: body.dispatchSource,
        referenceType: body.referenceType ?? null, referenceId: body.referenceId ?? null, referenceNo: body.referenceNo ?? null,
        warehouse: body.warehouse ?? null, expectedDispatchDate: body.expectedDispatchDate ?? null,
        priority: body.priority, transportMode: body.transportMode ?? null,
        estimatedWeight: body.estimatedWeight, estimatedVolume: body.estimatedVolume, remarks: body.remarks ?? null,
        updatedBy: user.id,
        items: {
          create: body.items.map((it) => {
            const p = byId.get(it.productId)!;
            return {
              tenantId: user.tenantId, productId: it.productId, productName: it.productName || p.name, sku: it.sku ?? p.sku,
              batchNo: it.batchNo ?? undefined, allocationLotId: it.allocationLotId ?? undefined,
              qty: it.qty, uom: it.uom ?? p.baseUom, remarks: it.remarks ?? undefined,
            };
          }),
        },
      },
    });
  });
  await writeAudit(prisma, user, { action: "dispatch_planning.update", entity: "DispatchPlanning", entityId: plan.id, summary: `Edited dispatch plan ${plan.planningNo}`, businessId: plan.businessId ?? null, branchId: plan.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Dispatch plan updated.", id: plan.id });
}

// DELETE /api/transport/dispatch-planning/[id] — delete a Draft plan.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const r = await load(req, Number(params.id));
  if ("err" in r) return r.err;
  const { user, plan } = r;
  if (plan.status !== "Draft") return NextResponse.json({ ok: false, message: "Only draft dispatch plans can be deleted. Cancel approved plans instead." }, { status: 422 });
  await prisma.dispatchPlanning.delete({ where: { id: plan.id } });
  await writeAudit(prisma, user, { action: "dispatch_planning.delete", entity: "DispatchPlanning", entityId: plan.id, summary: `Deleted draft dispatch plan ${plan.planningNo}`, businessId: plan.businessId ?? null, branchId: plan.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Draft dispatch plan deleted." });
}
