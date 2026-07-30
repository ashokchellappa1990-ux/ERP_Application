import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";
import type { TerminalStamp } from "@/lib/pos/terminalContext";
import { getExchangeConfig } from "@/lib/sales/exchangeConfig";
import { buildExchangeLegs, postExchangeLegs, type SaleWithLines } from "@/lib/sales/createExchange";
import type { SalesExchangeCreateInput } from "@/lib/contracts/salesExchange";

// POST /api/sales/exchanges/[id]/approve — approve a Pending exchange: rebuild its
// return + new-sale legs from the stored snapshot and post them.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const id = Number(params.id);
  let body: { note?: string } = {};
  try { body = await req.json(); } catch { /* note optional */ }

  const ex = await prisma.salesExchange.findFirst({ where: { id, tenantId: user.tenantId }, include: { items: true } });
  if (!ex) return NextResponse.json({ ok: false, message: "Sales exchange not found." }, { status: 404 });
  const denied = await requirePermission(user, "sales.exchange", { req, entity: "SalesExchange", entityId: id, businessId: ex.businessId, branchId: ex.branchId });
  if (denied) return denied;
  if (ex.status !== "Pending") return NextResponse.json({ ok: false, message: "Only a pending exchange can be approved." }, { status: 422 });
  if (!ex.originalSaleId) return NextResponse.json({ ok: false, message: "This exchange has no linked invoice to post against." }, { status: 422 });

  const sale = await prisma.sale.findFirst({ where: { id: ex.originalSaleId, tenantId: user.tenantId }, include: { lines: { orderBy: { id: "asc" } } } }) as SaleWithLines | null;
  if (!sale) return NextResponse.json({ ok: false, message: "Original invoice not found." }, { status: 404 });

  // Rebuild the create input from the stored both-sides snapshot.
  const input: SalesExchangeCreateInput = {
    originalSaleId: ex.originalSaleId,
    returnLines: ex.items.filter((i) => i.side === "RETURN").map((i) => ({ saleLineId: i.saleLineId as number, returnQty: Number(i.qty), reason: i.reason ?? undefined, inventoryHandling: (i.inventoryHandling as "good" | "damaged" | "quarantine") ?? undefined })),
    newLines: ex.items.filter((i) => i.side === "NEW").map((i) => ({ productId: i.productId, productName: i.productName, sku: i.sku ?? undefined, qty: Number(i.qty), rate: Number(i.rate), taxPct: i.taxPct == null ? undefined : Number(i.taxPct), batchNo: i.batchNo ?? undefined, mfgDate: i.mfgDate ?? undefined, expiryDate: i.expiryDate ?? undefined })),
    settlementMode: ex.settlementMode ?? undefined,
    settlementRef: ex.settlementRef ?? undefined,
    reason: ex.reason ?? undefined,
    remarks: ex.remarks ?? undefined,
  };

  const cfg = await getExchangeConfig(user);
  const legs = await buildExchangeLegs(user, sale, input, cfg, { excludeExchangeId: ex.id });
  if ("error" in legs) return NextResponse.json({ ok: false, message: legs.error }, { status: 422 });

  // Carry the exchange's original terminal traceability onto the posted legs.
  const stamp: TerminalStamp = {
    terminalId: ex.terminalId ?? undefined, terminalSessionId: ex.terminalSessionId ?? undefined,
    shiftSessionId: ex.shiftSessionId ?? undefined, cashierUserId: ex.cashierUserId ?? undefined,
    dayOpeningId: ex.dayOpeningId ?? undefined, transactionSource: ex.transactionSource ?? "WEB_POS",
  };
  const seg = { businessId: ex.businessId ?? undefined, branchId: ex.branchId ?? undefined };

  try {
    await prisma.$transaction(async (tx) => {
      const { returnId, newSaleId } = await postExchangeLegs(tx, { user, seg, stamp, sale, legs, exchangeDate: ex.exchangeDate });
      await tx.salesExchange.update({
        where: { id }, data: {
          status: "Completed", returnId, newSaleId, approvedBy: user.id, approvedAt: new Date(), approvalNote: body.note || null,
          returnValue: legs.returnValue, newSaleValue: legs.newSaleValue, priceDifference: legs.priceDifference, settlementType: legs.settlementType,
        },
      });
      await writeAudit(tx, user, {
        action: "sales_exchange.approve", entity: "SalesExchange", entityId: id,
        summary: `Approved exchange ${ex.exchangeNo} — diff ${legs.priceDifference.toFixed(2)}`,
        meta: { note: body.note || null, priceDifference: legs.priceDifference, returnId, newSaleId },
        businessId: ex.businessId, branchId: ex.branchId, ip: requestMeta(req).ip,
      });
    });
    return NextResponse.json({ ok: true, message: "Exchange approved & posted." });
  } catch (err) {
    console.error("[sales-exchange] approve error", err);
    return NextResponse.json({ ok: false, message: "Could not approve the exchange." }, { status: 500 });
  }
}
