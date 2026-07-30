import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { SalesReturnDetail, SalesReturnLedgerRow, SalesReturnVoucher, SalesReturnCreditNote } from "@/lib/contracts/salesReturn";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/sales/returns/[id] — one return with its lines.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.return");
  if (denied) return denied;

  const ret = await prisma.salesReturn.findFirst({
    where: { id: Number(params.id), tenantId: user.tenantId },
    include: { lines: { orderBy: { id: "asc" } } },
  });
  if (!ret) return NextResponse.json({ ok: false, message: "Sales return not found." }, { status: 404 });

  // Inventory restore log — the SALES_RETURN movements this return raised.
  const ledgerRows = await prisma.inventoryLedger.findMany({ where: { tenantId: user.tenantId, refType: "SALES_RETURN", refId: ret.id }, orderBy: { id: "asc" } });
  const ledProds = ledgerRows.length ? await prisma.product.findMany({ where: { id: { in: Array.from(new Set(ledgerRows.map((x) => x.productId))) } }, select: { id: true, name: true, sku: true } }) : [];
  const ledPMap = new Map(ledProds.map((p) => [p.id, p]));
  const ledger: SalesReturnLedgerRow[] = ledgerRows.map((x) => ({
    id: x.id, productName: ledPMap.get(x.productId)?.name ?? `#${x.productId}`, sku: ledPMap.get(x.productId)?.sku ?? "",
    txnType: x.txnType, direction: x.direction, qty: num(x.qty), warehouse: x.warehouse ?? "", batchNo: x.batchNo ?? "", balanceQty: num(x.balanceQty), txnDate: x.txnDate,
  }));

  // Accounting posting (sales-return reversal) voucher.
  const entry = await prisma.journalEntry.findFirst({ where: { tenantId: user.tenantId, sourceType: "SALES_RETURN", sourceId: ret.id }, include: { lines: { include: { account: { select: { code: true, name: true } } } } }, orderBy: { id: "desc" } });
  const voucher: SalesReturnVoucher | null = entry ? {
    voucherNo: entry.voucherNo, voucherType: entry.voucherType, date: entry.date, narration: entry.narration ?? "",
    totalDebit: num(entry.totalDebit), totalCredit: num(entry.totalCredit),
    lines: entry.lines.map((jl) => ({ code: jl.account.code, name: jl.account.name, debit: num(jl.debit), credit: num(jl.credit), narration: jl.narration ?? "" })),
  } : null;

  // Credit note / store credit issued for this return (if any).
  const credit = await prisma.customerCredit.findFirst({ where: { tenantId: user.tenantId, sourceType: "SALES_RETURN", sourceId: ret.id }, orderBy: { id: "desc" } });
  const creditNote: SalesReturnCreditNote | null = credit ? { creditNo: credit.creditNo, type: credit.type, amount: num(credit.amount), balance: num(credit.balance), status: credit.status, createdAt: credit.createdAt.toISOString() } : null;

  const data: SalesReturnDetail = {
    id: ret.id, returnNo: ret.returnNo, returnDate: ret.returnDate, status: ret.status,
    invoiceNo: ret.invoiceNo ?? "", customerName: ret.customerName ?? "", customerPhone: ret.customerPhone ?? "",
    grossAmount: num(ret.grossAmount), discountAdj: num(ret.discountAdj), taxAdj: num(ret.taxAdj),
    refundAmount: num(ret.refundAmount), refundMode: ret.refundMode ?? "", refundRef: ret.refundRef ?? "", refundRemarks: ret.refundRemarks ?? "",
    approvedBy: ret.approvedBy, approvedAt: ret.approvedAt ? ret.approvedAt.toISOString() : null, approvalNote: ret.approvalNote ?? "",
    itemCount: ret.itemCount, notes: ret.notes ?? "", createdAt: ret.createdAt.toISOString(),
    lines: ret.lines.map((l) => ({
      id: l.id, productName: l.productName, sku: l.sku ?? "", soldQty: num(l.soldQty), returnQty: num(l.returnQty),
      rate: num(l.rate), discAmount: num(l.discAmount), taxAmount: num(l.taxAmount), returnValue: num(l.returnValue),
      reason: l.reason ?? "", remarks: l.remarks ?? "", inventoryHandling: l.inventoryHandling,
      batchNo: l.batchNo ?? "", mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "",
    })),
    ledger, voucher, creditNote,
  };
  return NextResponse.json({ ok: true, data });
}
