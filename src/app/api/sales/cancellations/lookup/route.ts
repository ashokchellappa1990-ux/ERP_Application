import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { CancellationLookupSale, CancellationInvoiceMatch, CancellationLookupLine } from "@/lib/contracts/salesCancellation";

const num = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * GET /api/sales/cancellations/lookup?q=<invoiceNo | mobile | name | QR> | ?id=<saleId>
 * Resolve a sale to cancel. Exact id / invoice / scanned QR → the full sale (lines,
 * payments, serials) + a cancellable verdict; free text → matching invoices.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.cancellation");
  if (denied) return denied;

  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const q = (url.searchParams.get("q") ?? "").trim();
  const sw = scopeWhere(await getActiveScope(user), { branch: true }) as Prisma.SaleWhereInput;

  // 1) Resolve a single sale: id, scanned QR, or exact invoice number.
  let saleId: number | null = Number.isInteger(id) && id > 0 ? id : null;
  if (!saleId && q) {
    const qr = await prisma.saleLineQr.findFirst({ where: { tenantId: user.tenantId, code: q }, select: { saleId: true } });
    saleId = qr?.saleId ?? null;
    if (!saleId) { const exact = await prisma.sale.findFirst({ where: { ...sw, invoiceNo: q }, select: { id: true } }); saleId = exact?.id ?? null; }
  }

  if (saleId) {
    const sale = await prisma.sale.findFirst({ where: { ...sw, id: saleId }, include: { lines: { orderBy: { id: "asc" } }, payments: true } });
    if (sale) {
      // Serials sold per line.
      const qrs = await prisma.saleLineQr.findMany({ where: { saleId: sale.id, mode: "unique" }, include: { qrMapping: { select: { serialNo: true } } } });
      const serialsByLine = new Map<number, string[]>();
      for (const x of qrs) { const a = serialsByLine.get(x.saleLineId) ?? []; a.push(x.qrMapping.serialNo || x.code); serialsByLine.set(x.saleLineId, a); }

      // Cancellable verdict — already cancelled / returned / exchanged?
      const returns = await prisma.salesReturn.count({ where: { saleId: sale.id, status: { not: "Rejected" } } });
      let cancellable = true; let blockReason = "";
      if (sale.status !== "Completed") { cancellable = false; blockReason = `Invoice is ${sale.status} — cannot cancel.`; }
      else if (returns > 0) { cancellable = false; blockReason = "Invoice already has a return/exchange — cancel those first."; }

      const lines: CancellationLookupLine[] = sale.lines.map((l) => ({
        saleLineId: l.id, productId: l.productId, productName: l.productName, sku: l.sku ?? "", uom: l.uom ?? "",
        qty: num(l.qty), rate: num(l.rate), taxAmount: num(l.taxAmount), value: num(l.value),
        batchNo: l.batchNo ?? "", mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "", serials: serialsByLine.get(l.id) ?? [],
      }));
      const out: CancellationLookupSale = {
        id: sale.id, invoiceNo: sale.invoiceNo, saleDate: sale.saleDate, channel: sale.channel ?? "POS", warehouse: sale.warehouse ?? "Main Store",
        customerId: sale.customerId, customerName: sale.customerName ?? "Walk-in", customerPhone: sale.customerPhone ?? "",
        subtotal: num(sale.subtotal), taxableValue: num(sale.taxableValue), taxTotal: num(sale.taxTotal), total: num(sale.total),
        amountPaid: num(sale.amountPaid), paymentMode: sale.paymentMode ?? "", paymentStatus: sale.paymentStatus ?? "",
        cancellable, blockReason,
        lines, payments: sale.payments.map((p) => ({ mode: p.mode, amount: num(p.amount), reference: p.reference ?? "" })),
      };
      return NextResponse.json({ ok: true, sale: out });
    }
  }

  if (!q) return NextResponse.json({ ok: true, matches: [] });

  // 2) Free-text search → matching invoices.
  const where: Prisma.SaleWhereInput = { ...sw, OR: [{ invoiceNo: { contains: q } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }] };
  const rows = await prisma.sale.findMany({ where, orderBy: { id: "desc" }, take: 20, select: { id: true, invoiceNo: true, saleDate: true, customerName: true, channel: true, total: true, itemCount: true, status: true } });
  const matches: CancellationInvoiceMatch[] = rows.map((s) => ({ id: s.id, invoiceNo: s.invoiceNo, saleDate: s.saleDate, customerName: s.customerName ?? "Walk-in", channel: s.channel ?? "POS", total: num(s.total), itemCount: s.itemCount, status: s.status }));
  return NextResponse.json({ ok: true, matches });
}
