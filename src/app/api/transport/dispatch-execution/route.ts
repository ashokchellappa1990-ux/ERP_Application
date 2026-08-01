import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma as PrismaNS } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { loadFromSalesOrder, loadFromStockTransferDispatch, createDirectCustomerDispatch } from "@/lib/transport/dispatchExecution";
import { directCustomerDispatchInput, DISPATCH_DOC_TYPES } from "@/lib/contracts/transport";
import type { DispatchExecutionRow } from "@/lib/contracts/transport";

// Same fallback key used by the Transport & Vehicle Operations section in
// general (no Dispatch Execution-specific key exists yet — it is reached
// from Dispatch Planning / created directly, not from a dedicated nav entry).
const PERM = "transport";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/transport/dispatch-execution — list + stats (scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const docType = url.searchParams.get("docType") ?? "All";

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: PrismaNS.DispatchExecutionWhereInput = { ...sw, deletedAt: null };
  if (q) where.OR = [{ docNo: { contains: q } }, { sourceRefNo: { contains: q } }, { partyName: { contains: q } }];
  if (status !== "All") where.status = status;
  if (docType !== "All") where.docType = docType;

  const [rows, total, draft, vehicleAssigned, completed] = await Promise.all([
    prisma.dispatchExecution.findMany({ where, orderBy: { id: "desc" }, take: 100 }),
    prisma.dispatchExecution.count({ where: { ...sw, deletedAt: null } }),
    prisma.dispatchExecution.count({ where: { ...sw, deletedAt: null, status: "Draft" } }),
    prisma.dispatchExecution.count({ where: { ...sw, deletedAt: null, status: "Vehicle Assigned" } }),
    prisma.dispatchExecution.count({ where: { ...sw, deletedAt: null, status: "Completed" } }),
  ]);

  const shaped: DispatchExecutionRow[] = rows.map((r) => ({
    id: r.id, docNo: r.docNo, docType: r.docType, docDate: r.docDate,
    sourceRefNo: r.sourceRefNo, partyName: r.partyName, warehouse: r.warehouse,
    status: r.status, totalQty: num(r.totalQty), totalValue: num(r.totalValue), createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: shaped, stats: { total, draft, vehicleAssigned, completed } });
}

const stockTransferLoadInput = z.object({
  docType: z.literal("StockTransfer"),
  stockTransferDispatchId: z.coerce.number().int().positive(),
  dispatchPlanningId: z.coerce.number().int().positive().optional().nullable(),
  docDate: z.string().trim().min(1),
});

const barePhysicalTrackingInput = z.object({
  docType: z.enum(["PurchaseReturn", "SalesReturn", "ProductionTransfer", "JobWork", "VendorDispatch", "Others"]),
  docDate: z.string().trim().min(1),
  partyName: z.string().trim().max(200).optional().nullable(),
  warehouse: z.string().trim().max(120).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  dispatchPlanningId: z.coerce.number().int().positive().optional().nullable(),
});

// POST /api/transport/dispatch-execution — create a dispatch execution, branching by docType:
//  - "Customer" + salesOrderId   -> loadFromSalesOrder (auto-loads undelivered SO lines)
//  - "Customer" (no salesOrderId) -> createDirectCustomerDispatch (manual items)
//  - "StockTransfer"              -> loadFromStockTransferDispatch (copies an existing Draft StockTransferDispatch)
//  - other docTypes (PurchaseReturn/SalesReturn/ProductionTransfer/JobWork/VendorDispatch/Others)
//    -> Phase-1 bare Draft row (no stock-moving engine exists for these yet); items are not
//    auto-loaded and must be added later once such an engine exists.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "DispatchExecution" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const docType = (raw as { docType?: string })?.docType;
  if (!docType || !DISPATCH_DOC_TYPES.includes(docType as (typeof DISPATCH_DOC_TYPES)[number])) {
    return NextResponse.json({ ok: false, message: "A valid docType is required." }, { status: 422 });
  }

  const scope = await getActiveScope(user);

  try {
    if (docType === "Customer" && (raw as { salesOrderId?: unknown }).salesOrderId) {
      const body = z.object({
        salesOrderId: z.coerce.number().int().positive(),
        dispatchPlanningId: z.coerce.number().int().positive().optional().nullable(),
        docDate: z.string().trim().min(1),
        warehouse: z.string().trim().max(120).optional().nullable(),
      }).parse(raw);
      const res = await loadFromSalesOrder(scope, user, body);
      return NextResponse.json({ ok: true, message: "Dispatch execution loaded from Sales Order.", id: res.id }, { status: 201 });
    }

    if (docType === "Customer") {
      const body = directCustomerDispatchInput.parse(raw);
      const res = await createDirectCustomerDispatch(scope, user, body);
      return NextResponse.json({ ok: true, message: "Direct customer dispatch created.", id: res.id }, { status: 201 });
    }

    if (docType === "StockTransfer") {
      const body = stockTransferLoadInput.parse(raw);
      const res = await loadFromStockTransferDispatch(scope, user, body);
      return NextResponse.json({ ok: true, message: "Dispatch execution loaded from Stock Transfer Dispatch.", id: res.id }, { status: 201 });
    }

    // Phase-1 bare Draft — physical tracking only.
    const body = barePhysicalTrackingInput.parse(raw);
    const seg = await resolveWriteScope(user, (raw as { scopeBranchId?: number | "all" }).scopeBranchId);
    const prefix: Record<string, string> = { PurchaseReturn: "DE-PR", SalesReturn: "DE-SR", ProductionTransfer: "DE-PT", JobWork: "DE-JW", VendorDispatch: "DE-VD", Others: "DE-OT" };
    const id = await prisma.$transaction(async (tx) => {
      const doc = await tx.dispatchExecution.create({
        data: {
          tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
          docNo: "TMP", docType: body.docType, docDate: body.docDate,
          dispatchPlanningId: body.dispatchPlanningId ?? undefined,
          partyName: body.partyName ?? undefined, warehouse: body.warehouse ?? undefined, remarks: body.remarks ?? undefined,
          status: "Draft", createdBy: user.id, createdByName: user.fullName ?? undefined,
        },
        select: { id: true },
      });
      const docNo = `${prefix[body.docType] ?? "DE"}-${String(doc.id).padStart(5, "0")}`;
      await tx.dispatchExecution.update({ where: { id: doc.id }, data: { docNo } });
      return doc.id;
    });
    await writeAudit(prisma, user, { action: "dispatch_execution.create", entity: "DispatchExecution", entityId: id, summary: `${body.docType} dispatch execution created (physical tracking only)`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Dispatch execution created.", id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ ok: false, message: err.issues[0]?.message ?? "Invalid request." }, { status: 422 });
    console.error("[dispatch-execution] create error", err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Could not create the dispatch execution." }, { status: 400 });
  }
}
