import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { stampTerminal } from "@/lib/pos/terminalContext";
import { requireTerminalForTxn, terminalListWhere } from "@/lib/pos/terminalGuard";
import { getExchangeConfig } from "@/lib/sales/exchangeConfig";
import { nextExchangeNumber } from "@/lib/sales/invoiceNumber";
import { buildExchangeLegs, postExchangeLegs, type ExchangeLegs, type SaleWithLines } from "@/lib/sales/createExchange";
import { SalesExchangeCreateSchema, type SalesExchangeRow } from "@/lib/contracts/salesExchange";

const PERM = "sales.exchange";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/sales/exchanges — list + stats (scoped).
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
  const where: Prisma.SalesExchangeWhereInput = { ...sw, ...tw };
  if (q) where.OR = [{ exchangeNo: { contains: q } }, { invoiceNo: { contains: q } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }];
  if (status !== "All") where.status = status;

  const [rows, total, pending, collectAgg, refundAgg] = await Promise.all([
    prisma.salesExchange.findMany({ where, orderBy: { id: "desc" }, take: 100 }),
    prisma.salesExchange.count({ where: sw }),
    prisma.salesExchange.count({ where: { ...sw, status: "Pending" } }),
    prisma.salesExchange.aggregate({ where: { ...sw, settlementType: "collect" }, _sum: { priceDifference: true } }),
    prisma.salesExchange.aggregate({ where: { ...sw, settlementType: "refund" }, _sum: { priceDifference: true } }),
  ]);

  const shaped: SalesExchangeRow[] = rows.map((r) => ({
    id: r.id, exchangeNo: r.exchangeNo, exchangeDate: r.exchangeDate, invoiceNo: r.invoiceNo ?? "",
    customerName: r.customerName ?? "Walk-in", itemCount: r.itemCount, returnValue: num(r.returnValue), newSaleValue: num(r.newSaleValue),
    priceDifference: num(r.priceDifference), settlementType: r.settlementType, status: r.status, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: shaped, stats: { total, pending, netCollected: num(collectAgg._sum.priceDifference), netRefunded: Math.abs(num(refundAgg._sum.priceDifference)) } });
}

// POST /api/sales/exchanges — create an exchange (return old + issue new, settle diff).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "SalesExchange" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = SalesExchangeCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const cfg = await getExchangeConfig(user);
  if (!cfg.exchangeAllowed) return NextResponse.json({ ok: false, message: "Sales exchange is turned off in Sales Exchange Configuration." }, { status: 422 });
  if (!body.originalSaleId) return NextResponse.json({ ok: false, message: "Select the original invoice to exchange against." }, { status: 422 });

  const sale = await prisma.sale.findFirst({ where: { id: body.originalSaleId, tenantId: user.tenantId }, include: { lines: { orderBy: { id: "asc" } } } }) as SaleWithLines | null;
  if (!sale) return NextResponse.json({ ok: false, message: "Original invoice not found." }, { status: 404 });

  const legs = await buildExchangeLegs(user, sale, body, cfg);
  if ("error" in legs) return NextResponse.json({ ok: false, message: legs.error }, { status: 422 });

  // Threshold approval on the absolute price difference.
  const status = cfg.approvalEnabled && cfg.approvalAutoLimit > 0 && Math.abs(legs.priceDifference) > cfg.approvalAutoLimit ? "Pending" : "Completed";

  const seg = scopeData(await getActiveScope(user), { branch: true });
  const { denied: tDenied, ctx } = await requireTerminalForTxn(user, { feature: "allowExchange", label: "sales exchange" });
  if (tDenied) return tDenied;
  const stamp = stampTerminal(ctx, "WEB_POS");
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const exchangeNo = await nextExchangeNumber(tx, user.tenantId, { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
      const ex = await tx.salesExchange.create({
        data: {
          tenantId: user.tenantId, ...seg, exchangeNo, exchangeDate: today,
          originalSaleId: sale.id, invoiceNo: sale.invoiceNo, channel: sale.channel ?? "POS",
          customerId: sale.customerId, customerName: sale.customerName, customerPhone: sale.customerPhone,
          returnValue: legs.returnValue, newSaleValue: legs.newSaleValue, priceDifference: legs.priceDifference,
          settlementType: legs.settlementType, settlementMode: legs.settlementMode, settlementRef: body.settlementRef || null,
          reason: body.reason || null, remarks: body.remarks || null,
          status, itemCount: Math.round(num(legs.built.itemCount)) + legs.prepared.itemCount, createdBy: user.id, ...stamp,
          items: { create: snapshotItems(legs) },
        },
        select: { id: true },
      });
      if (status === "Completed") {
        const { returnId, newSaleId } = await postExchangeLegs(tx, { user, seg, stamp, sale, legs, exchangeDate: today });
        await tx.salesExchange.update({ where: { id: ex.id }, data: { returnId, newSaleId } });
      }
      return { id: ex.id, exchangeNo, status };
    });

    await writeAudit(prisma, user, {
      action: "sales_exchange.create", entity: "SalesExchange", entityId: result.id,
      summary: `Exchange ${result.exchangeNo} vs invoice ${sale.invoiceNo} — diff ${legs.priceDifference.toFixed(2)} (${result.status})`,
      meta: { originalSaleId: sale.id, invoiceNo: sale.invoiceNo, returnValue: legs.returnValue, newSaleValue: legs.newSaleValue, priceDifference: legs.priceDifference, settlementType: legs.settlementType, status: result.status },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: result.status === "Pending" ? "Exchange saved — pending approval." : "Exchange completed.", ...result }, { status: 201 });
  } catch (err) {
    console.error("[sales-exchange] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the sales exchange." }, { status: 500 });
  }
}

/** Flat both-sides snapshot for the exchange document + reporting + approval rebuild. */
function snapshotItems(legs: ExchangeLegs): Prisma.SalesExchangeItemCreateWithoutExchangeInput[] {
  const retItems = legs.built.lines.map((l) => ({
    side: "RETURN", saleLineId: l.saleLineId, productId: l.productId, productName: l.productName, sku: l.sku,
    qty: l.returnQty, rate: l.rate, taxPct: null, taxAmount: l.taxAmount, value: l.returnValue,
    reason: l.reason, inventoryHandling: l.inventoryHandling, batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate,
  }));
  const newItems = legs.prepared.lines.map((l) => ({
    side: "NEW", saleLineId: null, productId: l.productId, productName: l.productName, sku: l.sku ?? null,
    qty: Number(l.qty), rate: Number(l.rate), taxPct: l.taxPct == null ? null : Number(l.taxPct), taxAmount: Number(l.taxAmount), value: Number(l.value),
    reason: null, inventoryHandling: null, batchNo: l.batchNo ?? null, mfgDate: l.mfgDate ?? null, expiryDate: l.expiryDate ?? null,
  }));
  return [...retItems, ...newItems];
}
