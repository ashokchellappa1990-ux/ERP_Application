import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";
import { stampTerminal } from "@/lib/pos/terminalContext";
import { requireTerminalForTxn, terminalListWhere } from "@/lib/pos/terminalGuard";

const PERM = "sales.return";
import { getReturnConfig } from "@/lib/sales/returnConfig";
import { buildReturnPayload, type SaleLineCtx } from "@/lib/sales/returnPayload";
import { createReturnTx } from "@/lib/sales/createReturn";
import { SalesReturnCreateSchema, type SalesReturnRow } from "@/lib/contracts/salesReturn";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/sales/returns — list + stats (scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const tw = await terminalListWhere(user, url.searchParams.get("terminalId"));
  const where: Prisma.SalesReturnWhereInput = { ...sw, ...tw };
  if (q) where.OR = [{ returnNo: { contains: q } }, { invoiceNo: { contains: q } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }];
  if (status !== "All") where.status = status;

  const [rows, total, pending, agg] = await Promise.all([
    prisma.salesReturn.findMany({ where, orderBy: { id: "desc" }, take: 100 }),
    prisma.salesReturn.count({ where: sw }),
    prisma.salesReturn.count({ where: { ...sw, status: "Pending" } }),
    prisma.salesReturn.aggregate({ where: sw, _sum: { refundAmount: true } }),
  ]);

  const shaped: SalesReturnRow[] = rows.map((r) => ({
    id: r.id, returnNo: r.returnNo, returnDate: r.returnDate, invoiceNo: r.invoiceNo ?? "",
    customerName: r.customerName ?? "Walk-in", itemCount: r.itemCount, refundAmount: num(r.refundAmount),
    refundMode: r.refundMode ?? "", status: r.status, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: shaped, stats: { total, pending, refundValue: num(agg._sum.refundAmount) } });
}

// POST /api/sales/returns — create a sales return against an original invoice.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "SalesReturn" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  // Shared contract: validate the request shape (Zod) before any business rules.
  const parsed = SalesReturnCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const cfg = await getReturnConfig(user);
  if (!cfg.returnAllowed) return NextResponse.json({ ok: false, message: "Sales returns are turned off in Sales Return Configuration." }, { status: 422 });

  const saleId = body.saleId;
  const sale = await prisma.sale.findFirst({ where: { id: saleId, tenantId: user.tenantId }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!sale) return NextResponse.json({ ok: false, message: "Original invoice not found." }, { status: 404 });

  // Quantity already returned per sale line (across non-rejected returns).
  const agg = await prisma.salesReturnLine.groupBy({ by: ["saleLineId"], where: { salesReturn: { saleId, status: { not: "Rejected" } } }, _sum: { returnQty: true } });
  const returned = new Map<number, number>(agg.filter((a) => a.saleLineId != null).map((a) => [a.saleLineId as number, num(a._sum.returnQty)]));

  const linesCtx = new Map<number, SaleLineCtx>();
  for (const sl of sale.lines) {
    linesCtx.set(sl.id, {
      saleLineId: sl.id, productId: sl.productId, productName: sl.productName, sku: sl.sku ?? null,
      soldQty: num(sl.qty), alreadyReturned: returned.get(sl.id) ?? 0,
      rate: num(sl.rate), discAmount: num(sl.discAmount), taxAmount: num(sl.taxAmount), value: num(sl.value), cost: num(sl.cost),
      batchNo: sl.batchNo ?? null, mfgDate: sl.mfgDate ?? null, expiryDate: sl.expiryDate ?? null,
    });
  }

  const refundMode = cfg.refundEnabled ? String(body.refundMode || cfg.defaultRefund) : "storeCredit";
  const built = buildReturnPayload({ ...body, refundMode }, {
    saleDate: sale.saleDate, warehouse: sale.warehouse || "Main Store",
    config: { returnAllowed: cfg.returnAllowed, reasonMandatory: cfg.reasonMandatory, inventoryHandlingEnabled: cfg.inventoryHandlingEnabled, maxReturnDays: cfg.maxReturnDays, refundModes: cfg.refundModes, defaultInventoryHandling: cfg.defaultInventoryHandling },
    lines: linesCtx,
  });
  if ("error" in built) return NextResponse.json({ ok: false, message: built.error }, { status: 422 });

  // Threshold approval: above the auto-approve limit → Pending (no posting yet).
  const status = cfg.approvalEnabled && cfg.approvalAutoLimit > 0 && built.refundAmount > cfg.approvalAutoLimit ? "Pending" : "Completed";
  const seg = scopeData(await getActiveScope(user), { branch: true });
  const { denied: tDenied, ctx } = await requireTerminalForTxn(user, { feature: "allowReturn", label: "sales return" });
  if (tDenied) return tDenied;
  const stamp = stampTerminal(ctx, "WEB_POS");
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await prisma.$transaction((tx) => createReturnTx(tx, {
      user, seg, stamp,
      sale: { id: saleId, invoiceNo: sale.invoiceNo, customerId: sale.customerId, customerName: sale.customerName, customerPhone: sale.customerPhone },
      built, refundMode, status, returnDate: today,
      refundRef: body.refundRef || null, refundRemarks: body.refundRemarks || null, notes: body.notes || null,
    }));
    // Audit (fire-and-forget — never blocks the committed return).
    await writeAudit(prisma, user, {
      action: "sales_return.create", entity: "SalesReturn", entityId: result.id,
      summary: `Return ${result.returnNo} vs invoice ${sale.invoiceNo} — refund ${built.refundAmount.toFixed(2)} (${result.status})`,
      meta: { saleId, invoiceNo: sale.invoiceNo, refundAmount: built.refundAmount, refundMode, itemCount: Math.round(built.itemCount), status: result.status },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: result.status === "Pending" ? "Return saved — pending approval." : "Sales return completed.", ...result }, { status: 201 });
  } catch (err) {
    console.error("[sales-return] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the sales return." }, { status: 500 });
  }
}
