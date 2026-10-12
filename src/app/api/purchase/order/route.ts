import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { stampTerminal, getActiveTerminalContext } from "@/lib/pos/terminalContext";
import { buildPurchaseOrder, createPurchaseOrderTx } from "@/lib/purchase/createPurchaseOrder";
import { PurchaseOrderCreateSchema, type PurchaseOrderRow } from "@/lib/contracts/purchaseOrder";

const PERM = "purchase.order";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const OPEN = ["Draft", "Approved", "Issued", "Partially Received"];

// GET /api/purchase/order — list + stats (scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.PurchaseOrderWhereInput = { ...sw };
  if (q) where.OR = [{ poNo: { contains: q } }, { supplier: { contains: q } }, { quotationNo: { contains: q } }, { supplierRef: { contains: q } }];
  if (status !== "All") where.status = status;

  const [rows, total, draft, issued, openAgg] = await Promise.all([
    prisma.purchaseOrder.findMany({ where, orderBy: { id: "desc" }, take: 100 }),
    prisma.purchaseOrder.count({ where: sw }),
    prisma.purchaseOrder.count({ where: { ...sw, status: "Draft" } }),
    prisma.purchaseOrder.count({ where: { ...sw, status: "Issued" } }),
    prisma.purchaseOrder.aggregate({ where: { ...sw, status: { in: OPEN } }, _sum: { netAmount: true } }),
  ]);
  const shaped: PurchaseOrderRow[] = rows.map((r) => ({
    id: r.id, poNo: r.poNo, poDate: r.poDate, supplier: r.supplier ?? "", purchaseType: r.purchaseType,
    expectedDeliveryDate: r.expectedDeliveryDate ?? "", itemCount: r.itemCount, netAmount: num(r.netAmount), status: r.status, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: shaped, stats: { total, draft, issued, openValue: num(openAgg._sum.netAmount) } });
}

// POST /api/purchase/order — create a purchase order (Draft, or directly Issued).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "PurchaseOrder" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = PurchaseOrderCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const built = buildPurchaseOrder(body);
  if ("error" in built) return NextResponse.json({ ok: false, message: built.error }, { status: 422 });

  const status = body.saveMode === "Issued" ? "Issued" : "Draft";
  const seg = scopeData(await getActiveScope(user), { branch: true });
  const stamp = stampTerminal(await getActiveTerminalContext(user), "WEB_POS");

  try {
    const result = await prisma.$transaction((tx) => createPurchaseOrderTx(tx, { user, seg, stamp, input: body, built, status }));
    await writeAudit(prisma, user, {
      action: "purchase_order.create", entity: "PurchaseOrder", entityId: result.id,
      summary: `Purchase order ${result.poNo} — ${built.supplier} — ${built.netAmount.toFixed(2)} (${result.status})`,
      meta: { poNo: result.poNo, supplier: built.supplier, netAmount: built.netAmount, itemCount: built.itemCount, status: result.status },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: status === "Issued" ? "Purchase order created & issued." : "Purchase order saved as draft.", ...result }, { status: 201 });
  } catch (err) {
    console.error("[purchase-order] create error", err);
    return NextResponse.json({ ok: false, message: "Could not create the purchase order." }, { status: 500 });
  }
}
