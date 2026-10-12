import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { getExchangeConfig } from "@/lib/sales/exchangeConfig";
import type { ExchangeConfigDTO, ExchangeInvoiceMatch, ExchangeLookupSale } from "@/lib/contracts/salesExchange";

const num = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * GET /api/sales/exchanges/lookup?q=<invoiceNo | mobile | name | QR | barcode>
 * Resolves the original invoice for an exchange. A scanned QR / exact invoice number
 * → the full sale (lines + already returned/exchanged qty). Free text → matches to
 * pick from. Always returns the effective exchange config to drive the editor.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.exchange");
  if (denied) return denied;

  const cfg = await getExchangeConfig(user);
  const config: ExchangeConfigDTO = {
    exchangeAllowed: cfg.exchangeAllowed, exchangeWithoutInvoice: cfg.exchangeWithoutInvoice,
    allowPartialExchange: cfg.allowPartialExchange, allowFullExchange: cfg.allowFullExchange,
    allowPriceDifference: cfg.allowPriceDifference, refundIfLower: cfg.refundIfLower, collectIfHigher: cfg.collectIfHigher, ignorePriceDifference: cfg.ignorePriceDifference,
    priceBasis: cfg.priceBasis, maxExchangeQty: cfg.maxExchangeQty, maxExchangeDays: cfg.maxExchangeDays,
    settlementModes: cfg.settlementModes, defaultSettlement: cfg.defaultSettlement,
    handlingModes: cfg.handlingModes, defaultHandling: cfg.defaultHandling,
    searchToggles: cfg.searchToggles, defaultSearch: cfg.defaultSearch, reasons: cfg.reasons,
  };

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ ok: true, matches: [], config });
  const sw = scopeWhere(await getActiveScope(user), { branch: true }) as Prisma.SaleWhereInput;

  // 1) Resolve a single sale: scanned QR/barcode → sale_line_qrs, or an exact invoiceNo.
  const qr = await prisma.saleLineQr.findFirst({ where: { tenantId: user.tenantId, code: q }, select: { saleId: true } });
  let saleId = qr?.saleId ?? null;
  if (!saleId) {
    const exact = await prisma.sale.findFirst({ where: { ...sw, invoiceNo: q }, select: { id: true } });
    saleId = exact?.id ?? null;
  }

  if (saleId) {
    const sale = await prisma.sale.findFirst({ where: { ...sw, id: saleId }, include: { lines: { orderBy: { id: "asc" } } } });
    if (sale) {
      const returned = await exchangedMap(user.tenantId, sale.id);
      return NextResponse.json({ ok: true, sale: shapeSale(sale, returned), config });
    }
  }

  // 2) Free-text search → matching invoices to choose from.
  const where: Prisma.SaleWhereInput = { ...sw, OR: [{ invoiceNo: { contains: q } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }] };
  const rows = await prisma.sale.findMany({ where, orderBy: { id: "desc" }, take: 20, select: { id: true, invoiceNo: true, saleDate: true, customerName: true, customerPhone: true, total: true, itemCount: true } });
  const matches: ExchangeInvoiceMatch[] = rows.map((s) => ({ id: s.id, invoiceNo: s.invoiceNo, saleDate: s.saleDate, customerName: s.customerName ?? "Walk-in", customerPhone: s.customerPhone ?? "", total: num(s.total), itemCount: s.itemCount }));
  return NextResponse.json({ ok: true, matches, config });
}

/** Per-sale-line quantity already taken back — counts completed return/exchange legs
 * (via sales_return_lines) plus quantities reserved by still-Pending exchanges. */
async function exchangedMap(tenantId: number, saleId: number): Promise<Map<number, number>> {
  const [retAgg, pendItems] = await Promise.all([
    prisma.salesReturnLine.groupBy({ by: ["saleLineId"], where: { salesReturn: { saleId, status: { not: "Rejected" } } }, _sum: { returnQty: true } }),
    prisma.salesExchangeItem.groupBy({
      by: ["saleLineId"],
      where: { side: "RETURN", exchange: { tenantId, originalSaleId: saleId, status: "Pending" } },
      _sum: { qty: true },
    }),
  ]);
  const m = new Map<number, number>();
  for (const a of retAgg) if (a.saleLineId != null) m.set(a.saleLineId, num(a._sum.returnQty));
  for (const a of pendItems) if (a.saleLineId != null) m.set(a.saleLineId, (m.get(a.saleLineId) ?? 0) + num(a._sum.qty));
  return m;
}

type SaleWithLines = Prisma.SaleGetPayload<{ include: { lines: true } }>;
function shapeSale(sale: SaleWithLines, returned: Map<number, number>): ExchangeLookupSale {
  return {
    id: sale.id, invoiceNo: sale.invoiceNo, saleDate: sale.saleDate, warehouse: sale.warehouse ?? "Main Store", channel: sale.channel ?? "POS",
    customerId: sale.customerId, customerName: sale.customerName ?? "Walk-in", customerPhone: sale.customerPhone ?? "",
    subtotal: num(sale.subtotal), itemDiscount: num(sale.itemDiscount), billDiscount: num(sale.billDiscount),
    taxableValue: num(sale.taxableValue), taxTotal: num(sale.taxTotal), total: num(sale.total),
    lines: sale.lines.map((l) => {
      const soldQty = num(l.qty);
      const alreadyReturned = returned.get(l.id) ?? 0;
      return {
        saleLineId: l.id, productId: l.productId, productName: l.productName, sku: l.sku ?? "", uom: l.uom ?? "",
        soldQty, alreadyReturned, exchangeableQty: +(soldQty - alreadyReturned).toFixed(3),
        rate: num(l.rate), discAmount: num(l.discAmount), taxPct: num(l.taxPct), taxAmount: num(l.taxAmount), value: num(l.value),
        batchNo: l.batchNo ?? "", mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "",
      };
    }),
  };
}
