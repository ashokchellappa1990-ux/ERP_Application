import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { SalesCancellationDetail, SalesCancellationDetailLine, SalesCancellationLedgerRow, SalesCancellationVoucher } from "@/lib/contracts/salesCancellation";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/sales/cancellations/[id] — full detail incl. inventory log + reversal voucher.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.cancellation");
  if (denied) return denied;

  const id = Number(params.id);
  const r = await prisma.salesCancellation.findFirst({ where: { id, tenantId: user.tenantId }, include: { items: { orderBy: { id: "asc" } }, payments: true } });
  if (!r) return NextResponse.json({ ok: false, message: "Sales cancellation not found." }, { status: 404 });

  const lines: SalesCancellationDetailLine[] = r.items.map((l) => ({
    id: l.id, productName: l.productName, sku: l.sku ?? "", qty: num(l.qty), rate: num(l.rate), taxAmount: num(l.taxAmount), value: num(l.value),
    batchNo: l.batchNo ?? "", mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "", serials: l.serialNos ? l.serialNos.split(",").map((s) => s.trim()).filter(Boolean) : [],
  }));

  // Inventory restoration log (SALES_CANCELLED movements this cancellation raised).
  const ledgerRows = await prisma.inventoryLedger.findMany({ where: { tenantId: user.tenantId, refType: "SALES_CANCELLED", refId: r.id }, orderBy: { id: "asc" } });
  const ledProds = ledgerRows.length ? await prisma.product.findMany({ where: { id: { in: Array.from(new Set(ledgerRows.map((x) => x.productId))) } }, select: { id: true, name: true, sku: true } }) : [];
  const ledPMap = new Map(ledProds.map((p) => [p.id, p]));
  const ledger: SalesCancellationLedgerRow[] = ledgerRows.map((x) => ({
    id: x.id, productName: ledPMap.get(x.productId)?.name ?? `#${x.productId}`, sku: ledPMap.get(x.productId)?.sku ?? "",
    txnType: x.txnType, direction: x.direction, qty: num(x.qty), warehouse: x.warehouse ?? "", batchNo: x.batchNo ?? "", balanceQty: num(x.balanceQty), txnDate: x.txnDate,
  }));

  // Accounting reversal voucher (the swap of the original SALES voucher).
  const entry = await prisma.journalEntry.findFirst({ where: { tenantId: user.tenantId, sourceType: "SALES", sourceId: r.saleId, voucherType: "JOURNAL" }, include: { lines: { include: { account: { select: { code: true, name: true } } } } }, orderBy: { id: "desc" } });
  const voucher: SalesCancellationVoucher | null = entry ? {
    voucherNo: entry.voucherNo, voucherType: entry.voucherType, date: entry.date, narration: entry.narration ?? "",
    totalDebit: num(entry.totalDebit), totalCredit: num(entry.totalCredit),
    lines: entry.lines.map((jl) => ({ code: jl.account.code, name: jl.account.name, debit: num(jl.debit), credit: num(jl.credit), narration: jl.narration ?? "" })),
  } : null;

  const detail: SalesCancellationDetail = {
    id: r.id, cancellationNo: r.cancellationNo, cancellationDate: r.cancellationDate, status: r.status,
    saleId: r.saleId, invoiceNo: r.invoiceNo ?? "", channel: r.channel ?? "", warehouse: r.warehouse ?? "",
    customerName: r.customerName ?? "", customerPhone: r.customerPhone ?? "",
    invoiceAmount: num(r.invoiceAmount), refundAmount: num(r.refundAmount), refundMethod: r.refundMethod ?? "", paymentMode: r.paymentMode ?? "",
    reason: r.reason ?? "", remarks: r.remarks ?? "",
    inventoryReversed: r.inventoryReversed, paymentReversed: r.paymentReversed, accountingReversed: r.accountingReversed, customerLedgerReversed: r.customerLedgerReversed, loyaltyReversed: r.loyaltyReversed, journalRef: r.journalRef ?? "",
    approvedBy: r.approvedBy, approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null, approvalNote: r.approvalNote ?? "",
    itemCount: r.itemCount, createdAt: r.createdAt.toISOString(),
    lines, payments: r.payments.map((p) => ({ mode: p.mode, amount: num(p.amount), reference: p.reference ?? "", refundStatus: p.refundStatus })),
    ledger, voucher,
  };
  return NextResponse.json({ ok: true, ...detail });
}
