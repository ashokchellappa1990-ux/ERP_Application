import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { PurchaseReturnDetail, PurchaseReturnDetailLine, PurchaseReturnLedgerRow, PurchaseReturnVoucher } from "@/lib/contracts/purchaseReturn";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/purchase/returns/[id] — full return detail.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "purchase.return");
  if (denied) return denied;

  const id = Number(params.id);
  const r = await prisma.purchaseReturn.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { items: { orderBy: { id: "asc" }, include: { qrs: true } } },
  });
  if (!r) return NextResponse.json({ ok: false, message: "Purchase return not found." }, { status: 404 });

  const lines: PurchaseReturnDetailLine[] = r.items.map((l) => ({
    id: l.id, productName: l.productName, sku: l.sku ?? "", hsn: l.hsn ?? "",
    invoicedQty: num(l.invoicedQty), returnedQty: num(l.returnedQty), returnQty: num(l.returnQty), rate: num(l.rate),
    taxAmount: num(l.taxAmount), discAmount: num(l.discAmount), returnValue: num(l.returnValue),
    reason: l.reason ?? "", remarks: l.remarks ?? "", inventoryHandling: l.inventoryHandling,
    batchNo: l.batchNo ?? "", mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "",
    serials: l.qrs.map((q) => q.serialNo || q.code),
  }));

  // Inventory reversal log — the PURCHASE_RETURN movements this return raised.
  const ledgerRows = await prisma.inventoryLedger.findMany({ where: { tenantId: user.tenantId, refType: "PURCHASE_RETURN", refId: r.id }, orderBy: { id: "asc" } });
  const ledProds = ledgerRows.length ? await prisma.product.findMany({ where: { id: { in: Array.from(new Set(ledgerRows.map((x) => x.productId))) } }, select: { id: true, name: true, sku: true } }) : [];
  const ledPMap = new Map(ledProds.map((p) => [p.id, p]));
  const ledger: PurchaseReturnLedgerRow[] = ledgerRows.map((x) => ({
    id: x.id, productName: ledPMap.get(x.productId)?.name ?? `#${x.productId}`, sku: ledPMap.get(x.productId)?.sku ?? "",
    txnType: x.txnType, direction: x.direction, qty: num(x.qty), warehouse: x.warehouse ?? "", batchNo: x.batchNo ?? "",
    balanceQty: num(x.balanceQty), txnDate: x.txnDate,
  }));

  // Accounting posting (reversal) voucher — Dr Payable, Cr cost-account + Input GST.
  const entry = await prisma.journalEntry.findFirst({ where: { tenantId: user.tenantId, sourceType: "PURCHASE_RETURN", sourceId: r.id }, include: { lines: { include: { account: { select: { code: true, name: true } } } } }, orderBy: { id: "desc" } });
  const voucher: PurchaseReturnVoucher | null = entry ? {
    voucherNo: entry.voucherNo, voucherType: entry.voucherType, date: entry.date, narration: entry.narration ?? "",
    totalDebit: num(entry.totalDebit), totalCredit: num(entry.totalCredit),
    lines: entry.lines.map((jl) => ({ code: jl.account.code, name: jl.account.name, debit: num(jl.debit), credit: num(jl.credit), narration: jl.narration ?? "" })),
  } : null;

  const detail: PurchaseReturnDetail = {
    id: r.id, returnNo: r.returnNo, returnDate: r.returnDate, status: r.status,
    purchaseInvoiceId: r.purchaseInvoiceId, invoiceNo: r.invoiceNo ?? "", grnNo: r.grnNo ?? "", poNo: r.poNo ?? "", purchaseType: r.purchaseType,
    supplier: r.supplier ?? "", supplierGstin: r.supplierGstin ?? "", warehouse: r.warehouse ?? "",
    reason: r.reason ?? "", remarks: r.remarks ?? "",
    taxableAmount: num(r.taxableAmount), taxAmount: num(r.taxAmount), roundOff: num(r.roundOff), returnAmount: num(r.returnAmount),
    inventoryUpdated: r.inventoryUpdated, supplierOutstandingUpdated: r.supplierOutstandingUpdated, accountingPosted: r.accountingPosted, journalRef: r.journalRef ?? "",
    approvedBy: r.approvedBy, approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null, approvalNote: r.approvalNote ?? "",
    itemCount: r.itemCount, createdAt: r.createdAt.toISOString(),
    lines, ledger, voucher,
    debitNote: {
      debitNoteNo: r.returnNo, date: r.returnDate, supplier: r.supplier ?? "", supplierGstin: r.supplierGstin ?? "", invoiceNo: r.invoiceNo ?? "",
      taxableAmount: num(r.taxableAmount), taxAmount: num(r.taxAmount), totalDebit: num(r.returnAmount), supplierOutstandingUpdated: r.supplierOutstandingUpdated,
    },
  };
  return NextResponse.json({ ok: true, ...detail });
}
