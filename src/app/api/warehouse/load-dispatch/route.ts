import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma as PrismaNS } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { loadFromSalesOrder, loadFromTransferRequest, createDirectCustomerDispatch, createOtherDispatch } from "@/lib/transport/loadDispatch";
import { loadFromSalesOrderInput, loadFromTransferRequestInput, directCustomerDispatchInput, otherDispatchInput } from "@/lib/contracts/loadDispatch";
import type { LoadDispatchRow } from "@/lib/contracts/loadDispatch";

const PERM = "warehouse.transfer";

const OTHER_SOURCE_TO_DOC_TYPE: Record<"PURCHASE_RETURN" | "SALES_RETURN_PICKUP" | "PRODUCTION_TRANSFER" | "JOB_WORK" | "OTHERS", "PurchaseReturn" | "SalesReturnPickup" | "ProductionTransfer" | "JobWork" | "Others"> = {
  PURCHASE_RETURN: "PurchaseReturn", SALES_RETURN_PICKUP: "SalesReturnPickup",
  PRODUCTION_TRANSFER: "ProductionTransfer", JOB_WORK: "JobWork", OTHERS: "Others",
};

// GET /api/warehouse/load-dispatch — list + filters + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const docType = url.searchParams.get("docType") ?? "All";
  const warehouse = (url.searchParams.get("warehouse") ?? "").trim();
  const dateFrom = url.searchParams.get("dateFrom") ?? "";
  const dateTo = url.searchParams.get("dateTo") ?? "";

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: PrismaNS.LoadDispatchWhereInput = { ...sw, deletedAt: null };
  if (q) where.OR = [{ dispatchNo: { contains: q } }, { sourceRefNo: { contains: q } }, { partyName: { contains: q } }];
  if (status !== "All") where.status = status;
  if (docType !== "All") where.docType = docType;
  if (warehouse) where.warehouse = { contains: warehouse };
  if (dateFrom || dateTo) where.dispatchDate = { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) };

  const [rows, total, draft, dispatched, cancelled] = await Promise.all([
    prisma.loadDispatch.findMany({ where, orderBy: { id: "desc" }, take: 200 }),
    prisma.loadDispatch.count({ where: { ...sw, deletedAt: null } }),
    prisma.loadDispatch.count({ where: { ...sw, deletedAt: null, status: "Draft" } }),
    prisma.loadDispatch.count({ where: { ...sw, deletedAt: null, status: { in: ["Dispatched", "Delivery Challan Generated", "Sales Invoice Posted"] } } }),
    prisma.loadDispatch.count({ where: { ...sw, deletedAt: null, status: "Cancelled" } }),
  ]);

  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId).filter((v): v is number => !!v)));
  const vehicles = vehicleIds.length ? await prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [];
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));

  const shaped: LoadDispatchRow[] = rows.map((r) => ({
    id: r.id, dispatchNo: r.dispatchNo, docType: r.docType as LoadDispatchRow["docType"], sourceRefNo: r.sourceRefNo,
    partyName: r.partyName, warehouse: r.warehouse, vehicleNo: r.vehicleId ? (vMap.get(r.vehicleId) ?? null) : null,
    dispatchDate: r.dispatchDate, status: r.status as LoadDispatchRow["status"], createdByName: r.createdByName, createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ ok: true, rows: shaped, stats: { total, draft, dispatched, cancelled } });
}

const sourceEnvelope = z.object({ source: z.string() });

// POST /api/warehouse/load-dispatch — create, branching by Step-1 dispatch source.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoadDispatch" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const env = sourceEnvelope.safeParse(raw);
  if (!env.success) return NextResponse.json({ ok: false, message: "A dispatch source is required." }, { status: 422 });

  const scope = await getActiveScope(user);
  try {
    switch (env.data.source) {
      case "SALES_ORDER": {
        const body = loadFromSalesOrderInput.parse(raw);
        const res = await loadFromSalesOrder(scope, user, body);
        return NextResponse.json({ ok: true, message: "Loaded from Sales Order.", id: res.id }, { status: 201 });
      }
      case "DIRECT_CUSTOMER": {
        const body = directCustomerDispatchInput.parse(raw);
        const res = await createDirectCustomerDispatch(scope, user, body);
        return NextResponse.json({ ok: true, message: "Direct customer dispatch created.", id: res.id }, { status: 201 });
      }
      case "STOCK_TRANSFER": {
        const body = loadFromTransferRequestInput.parse(raw);
        const res = await loadFromTransferRequest(scope, user, body);
        return NextResponse.json({ ok: true, message: "Loaded from Transfer Request.", id: res.id }, { status: 201 });
      }
      case "PURCHASE_RETURN": case "SALES_RETURN_PICKUP": case "PRODUCTION_TRANSFER": case "JOB_WORK": case "OTHERS": {
        const body = otherDispatchInput.parse(raw);
        const docType = OTHER_SOURCE_TO_DOC_TYPE[body.source];
        const res = await createOtherDispatch(scope, user, { docType, dispatchDate: body.dispatchDate, partyName: body.partyName, warehouse: body.warehouse, areaId: body.areaId, remarks: body.remarks, items: body.items });
        return NextResponse.json({ ok: true, message: "Dispatch created.", id: res.id }, { status: 201 });
      }
      default:
        return NextResponse.json({ ok: false, message: "Unknown dispatch source." }, { status: 422 });
    }
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ ok: false, message: err.issues[0]?.message ?? "Invalid request." }, { status: 422 });
    console.error("[load-dispatch] create error", err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Could not create the dispatch." }, { status: 400 });
  }
}
