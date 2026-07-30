import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";
import { stampTerminal, getActiveTerminalContext } from "@/lib/pos/terminalContext";
import { getPurchaseInvoiceConfig } from "@/lib/purchase/purchaseInvoiceConfig";
import { buildPurchaseReturnPayload } from "@/lib/purchase/returnPayload";
import { createPurchaseReturnTx } from "@/lib/purchase/createReturn";
import { loadPiReturnContext, toPayloadCtxLines } from "@/lib/purchase/returnContext";
import { PurchaseReturnCreateSchema, type PurchaseReturnRow } from "@/lib/contracts/purchaseReturn";

const PERM = "purchase.return";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/purchase/returns — list + stats (scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const type = url.searchParams.get("type") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.PurchaseReturnWhereInput = { ...sw };
  if (q) where.OR = [{ returnNo: { contains: q } }, { invoiceNo: { contains: q } }, { grnNo: { contains: q } }, { supplier: { contains: q } }];
  if (status !== "All") where.status = status;
  if (type !== "All") where.purchaseType = type;

  const [rows, total, pendingApproval, agg] = await Promise.all([
    prisma.purchaseReturn.findMany({ where, orderBy: { id: "desc" }, take: 100 }),
    prisma.purchaseReturn.count({ where: sw }),
    prisma.purchaseReturn.count({ where: { ...sw, status: "Pending Approval" } }),
    prisma.purchaseReturn.aggregate({ where: { ...sw, status: { not: "Cancelled" } }, _sum: { returnAmount: true } }),
  ]);

  const shaped: PurchaseReturnRow[] = rows.map((r) => ({
    id: r.id, returnNo: r.returnNo, returnDate: r.returnDate, invoiceNo: r.invoiceNo ?? "", grnNo: r.grnNo ?? "",
    supplier: r.supplier ?? "", purchaseType: r.purchaseType, itemCount: r.itemCount, returnAmount: num(r.returnAmount),
    status: r.status, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: shaped, stats: { total, pendingApproval, returnValue: num(agg._sum.returnAmount) } });
}

// POST /api/purchase/returns — create a purchase return against a posted invoice.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "PurchaseReturn" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = PurchaseReturnCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const cfg = await getPurchaseInvoiceConfig(user);
  if (!cfg.enablePurchaseReturn) return NextResponse.json({ ok: false, message: "Purchase Return is turned off in Purchase Configuration." }, { status: 422 });

  const ctx = await loadPiReturnContext(user.tenantId, body.purchaseInvoiceId);
  if (!ctx) return NextResponse.json({ ok: false, message: "Source purchase invoice not found." }, { status: 404 });
  if (ctx.pi.status !== "Posted") return NextResponse.json({ ok: false, message: "Only a posted purchase invoice can be returned." }, { status: 422 });

  const built = buildPurchaseReturnPayload(body, {
    purchaseType: ctx.pi.purchaseType, invoiceDate: ctx.pi.invoiceDate,
    config: { returnAllowed: cfg.enablePurchaseReturn, reasonMandatory: cfg.purchaseReturnReasonMandatory },
    lines: toPayloadCtxLines(ctx),
  });
  if ("error" in built) return NextResponse.json({ ok: false, message: built.error }, { status: 422 });

  // Approval gate: configured approval routes the return to Pending Approval (no
  // posting yet); otherwise it is Approved + posted immediately.
  const status = cfg.purchaseReturnApprovalRequired ? "Pending Approval" : "Approved";
  const seg = scopeData(await getActiveScope(user), { branch: true });
  const stamp = stampTerminal(await getActiveTerminalContext(user), "WEB_POS");
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await prisma.$transaction((tx) => createPurchaseReturnTx(tx, {
      user, seg, stamp,
      invoice: { id: ctx.pi.id, invoiceNo: ctx.pi.invoiceNo, grnId: ctx.pi.grnId, grnNo: ctx.pi.grnNo || null, poNo: ctx.pi.poNo || null, purchaseType: ctx.pi.purchaseType, supplierId: ctx.pi.supplierId, supplier: ctx.pi.supplier || null, supplierGstin: ctx.pi.supplierGstin || null, warehouse: ctx.pi.warehouse || null },
      built, status, returnDate: today, reason: body.reason || null, remarks: body.remarks || null,
    }));
    await writeAudit(prisma, user, {
      action: "purchase_return.create", entity: "PurchaseReturn", entityId: result.id,
      summary: `Return ${result.returnNo} vs invoice ${ctx.pi.invoiceNo} — ${ctx.pi.purchaseType} ${built.returnAmount.toFixed(2)} (${result.status})`,
      meta: { purchaseInvoiceId: ctx.pi.id, invoiceNo: ctx.pi.invoiceNo, purchaseType: ctx.pi.purchaseType, returnAmount: built.returnAmount, itemCount: Math.round(built.itemCount), status: result.status },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: result.status === "Pending Approval" ? "Return saved — pending approval." : "Purchase return approved & posted.", ...result }, { status: 201 });
  } catch (err) {
    console.error("[purchase-return] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the purchase return." }, { status: 500 });
  }
}
