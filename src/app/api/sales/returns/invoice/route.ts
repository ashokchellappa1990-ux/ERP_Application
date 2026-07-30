import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { InvoiceLookupSale, InvoiceMatch } from "@/lib/contracts/salesReturn";

const num = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * GET /api/sales/returns/invoice?q=<invoiceNo | mobile | name | QR code>
 * Resolves the original invoice for a return. A scanned product/invoice QR or an
 * exact invoice number → the full sale (with lines + already-returned qty). A
 * free-text search → a list of matching invoices to pick from.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.return");
  if (denied) return denied;

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ ok: true, matches: [] });
  const sw = scopeWhere(await getActiveScope(user), { branch: true }) as Prisma.SaleWhereInput;

  // 1) Resolve a single sale: scanned QR code → sale_line_qrs, or an exact invoiceNo.
  const qr = await prisma.saleLineQr.findFirst({ where: { tenantId: user.tenantId, code: q }, select: { saleId: true } });
  let saleId = qr?.saleId ?? null;
  if (!saleId) {
    const exact = await prisma.sale.findFirst({ where: { ...sw, invoiceNo: q }, select: { id: true } });
    saleId = exact?.id ?? null;
  }

  if (saleId) {
    const sale = await prisma.sale.findFirst({ where: { ...sw, id: saleId }, include: { lines: { orderBy: { id: "asc" } } } });
    if (sale) {
      const agg = await prisma.salesReturnLine.groupBy({ by: ["saleLineId"], where: { salesReturn: { saleId: sale.id, status: { not: "Rejected" } } }, _sum: { returnQty: true } });
      const returned = new Map<number, number>(agg.filter((a) => a.saleLineId != null).map((a) => [a.saleLineId as number, num(a._sum.returnQty)]));
      return NextResponse.json({ ok: true, sale: shapeSale(sale, returned) });
    }
  }

  // 2) Free-text search → matching invoices to choose from.
  const where: Prisma.SaleWhereInput = { ...sw, OR: [{ invoiceNo: { contains: q } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }] };
  const rows = await prisma.sale.findMany({ where, orderBy: { id: "desc" }, take: 20, select: { id: true, invoiceNo: true, saleDate: true, customerName: true, customerPhone: true, total: true, itemCount: true } });
  const matches: InvoiceMatch[] = rows.map((s) => ({ id: s.id, invoiceNo: s.invoiceNo, saleDate: s.saleDate, customerName: s.customerName ?? "Walk-in", customerPhone: s.customerPhone ?? "", total: num(s.total), itemCount: s.itemCount }));
  return NextResponse.json({ ok: true, matches });
}

type SaleWithLines = Prisma.SaleGetPayload<{ include: { lines: true } }>;
function shapeSale(sale: SaleWithLines, returned: Map<number, number>): InvoiceLookupSale {
  return {
    id: sale.id, invoiceNo: sale.invoiceNo, saleDate: sale.saleDate, warehouse: sale.warehouse ?? "Main Store",
    customerId: sale.customerId, customerName: sale.customerName ?? "Walk-in", customerPhone: sale.customerPhone ?? "",
    subtotal: num(sale.subtotal), itemDiscount: num(sale.itemDiscount), billDiscount: num(sale.billDiscount),
    taxableValue: num(sale.taxableValue), taxTotal: num(sale.taxTotal), total: num(sale.total),
    lines: sale.lines.map((l) => {
      const soldQty = num(l.qty);
      const alreadyReturned = returned.get(l.id) ?? 0;
      return {
        saleLineId: l.id, productId: l.productId, productName: l.productName, sku: l.sku ?? "", uom: l.uom ?? "",
        soldQty, alreadyReturned, returnableQty: +(soldQty - alreadyReturned).toFixed(3),
        rate: num(l.rate), discAmount: num(l.discAmount), taxPct: num(l.taxPct), taxAmount: num(l.taxAmount), value: num(l.value),
        batchNo: l.batchNo ?? "", mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "",
      };
    }),
  };
}
