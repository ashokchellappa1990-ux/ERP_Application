import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { dispatchPlanningInput } from "@/lib/contracts/transport";
import type { DispatchPlanningRow } from "@/lib/contracts/transport";

// Same permission key the existing Warehouse Management / Stock Transfer
// screens use (see src/app/api/warehouse/dispatch/route.ts, warehouse/transfer/*).
const PERM = "warehouse";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/transport/dispatch-planning — list + stats (scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const source = url.searchParams.get("source") ?? "All";

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.DispatchPlanningWhereInput = { ...sw, deletedAt: null };
  if (q) where.OR = [{ planningNo: { contains: q } }, { referenceNo: { contains: q } }, { warehouse: { contains: q } }];
  if (status !== "All") where.status = status;
  if (source !== "All") where.dispatchSource = source;

  const [rows, total, draft, approved, completed] = await Promise.all([
    prisma.dispatchPlanning.findMany({ where, orderBy: { id: "desc" }, take: 100, include: { items: true } }),
    prisma.dispatchPlanning.count({ where: { ...sw, deletedAt: null } }),
    prisma.dispatchPlanning.count({ where: { ...sw, deletedAt: null, status: "Draft" } }),
    prisma.dispatchPlanning.count({ where: { ...sw, deletedAt: null, status: "Approved" } }),
    prisma.dispatchPlanning.count({ where: { ...sw, deletedAt: null, status: "Completed" } }),
  ]);

  const shaped: DispatchPlanningRow[] = rows.map((r) => ({
    id: r.id, planningNo: r.planningNo, planningDate: r.planningDate, dispatchSource: r.dispatchSource,
    referenceNo: r.referenceNo ?? "", warehouse: r.warehouse ?? "", priority: r.priority, status: r.status,
    itemCount: r.items.length, totalQty: r.items.reduce((s, it) => s + num(it.qty), 0), createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: shaped, stats: { total, draft, approved, completed } });
}

// POST /api/transport/dispatch-planning — create a dispatch plan (always Draft).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "DispatchPlanning" });
  if (denied) return denied;

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

  const seg = await resolveWriteScope(user, (raw as { scopeBranchId?: number | "all" }).scopeBranchId);

  try {
    const id = await prisma.$transaction(async (tx) => {
      const doc = await tx.dispatchPlanning.create({
        data: {
          tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
          planningNo: "TMP", planningDate: body.planningDate, dispatchSource: body.dispatchSource,
          referenceType: body.referenceType ?? undefined, referenceId: body.referenceId ?? undefined, referenceNo: body.referenceNo ?? undefined,
          warehouse: body.warehouse ?? undefined, expectedDispatchDate: body.expectedDispatchDate ?? undefined,
          priority: body.priority, transportMode: body.transportMode ?? undefined,
          estimatedWeight: body.estimatedWeight, estimatedVolume: body.estimatedVolume, remarks: body.remarks ?? undefined,
          status: "Draft", createdBy: user.id, createdByName: user.fullName ?? undefined,
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
        select: { id: true },
      });
      const planningNo = `DP-${String(doc.id).padStart(5, "0")}`;
      await tx.dispatchPlanning.update({ where: { id: doc.id }, data: { planningNo } });
      return doc.id;
    });
    await writeAudit(prisma, user, {
      action: "dispatch_planning.create", entity: "DispatchPlanning", entityId: id,
      summary: `Dispatch plan created (${body.items.length} item(s))`,
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Dispatch plan saved as draft.", id }, { status: 201 });
  } catch (err) {
    console.error("[dispatch-planning] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the dispatch plan." }, { status: 500 });
  }
}
