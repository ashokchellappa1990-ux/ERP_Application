import type { Prisma } from "@prisma/client";
import { postMovement, consumeLots } from "@/lib/inventory/ledger";
import { postPurchaseReturnJournal } from "@/lib/accounting/post";
import { markAssetsReturned } from "@/lib/purchase/assetRegister";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

/**
 * Post an Approved purchase return. Per inherited purchaseType:
 *  - Inventory: reduce stock (PURCHASE_RETURN OUT) + draw down the source lots
 *    (batch/expiry preserved) + flip returned serials → ReturnedToSupplier.
 *  - Asset: mark the matching Asset Register rows Returned.
 *  - Service / Expense / Asset: value-only (no inventory).
 * Always: reduce the supplier outstanding (the PI payable) + post the reversing
 * accounting voucher (Dr Payable, Cr cost-account + Input GST). Call once, on
 * the transition to Approved.
 */
export async function postPurchaseReturn(tx: Prisma.TransactionClient, returnId: number, createdBy?: number | null) {
  const ret = await tx.purchaseReturn.findUnique({ where: { id: returnId }, include: { items: { include: { qrs: true } } } });
  if (!ret) throw new Error("Purchase return not found.");
  const seg = { businessId: ret.businessId ?? null, branchId: ret.branchId ?? null };
  const warehouse = ret.warehouse || "Main Store";
  const isInventory = ret.purchaseType === "Inventory";

  let taxable = 0, tax = 0, inventoryUpdated = false;

  for (const line of ret.items) {
    const qty = num(line.returnQty);
    if (qty > 0 && isInventory && line.productId != null) {
      // Goods leave OUR warehouse back to the supplier: draw down the exact source
      // batch/lot and reduce the balance from the same warehouse (no in-bucket move).
      await consumeLots(tx, ret.tenantId, ret.branchId ?? null, line.productId, warehouse, qty, { batchNo: line.batchNo, fefo: false });
      await postMovement(tx, {
        tenantId: ret.tenantId, ...seg, productId: line.productId, txnType: "PURCHASE_RETURN", direction: "OUT", qty,
        rate: num(line.rate), warehouse, batchNo: line.batchNo, mfgDate: line.mfgDate, expiryDate: line.expiryDate,
        refType: "PURCHASE_RETURN", refId: ret.id, refNo: ret.returnNo, grnId: ret.grnId, txnDate: ret.returnDate, createdBy: createdBy ?? ret.createdBy,
      });
      inventoryUpdated = true;

      // Serial-tracked pieces selected on this line → ReturnedToSupplier.
      for (const q of line.qrs) {
        await tx.qrCodeMapping.update({ where: { id: q.qrCodeMappingId }, data: { status: "ReturnedToSupplier", notes: `Returned to supplier — ${ret.returnNo}` } });
      }
    }
    taxable += num(line.returnValue) - num(line.taxAmount);
    tax += num(line.taxAmount);
  }

  // Asset return → mark Asset Register rows Returned (count = total returned qty).
  if (ret.purchaseType === "Asset") {
    const count = ret.items.reduce((s, l) => s + Math.round(num(l.returnQty)), 0);
    await markAssetsReturned(tx, ret.tenantId, ret.purchaseInvoiceId, count, ret.returnNo);
  }

  // Reduce the supplier outstanding (the PI payable) by the return value.
  let supplierOutstandingUpdated = false;
  const payable = await tx.payable.findFirst({ where: { tenantId: ret.tenantId, sourceType: "PURCHASE_INVOICE", sourceId: ret.purchaseInvoiceId }, orderBy: { id: "desc" } });
  if (payable) {
    const cut = r2(num(ret.returnAmount));
    const newBalance = r2(Math.max(0, num(payable.balanceAmount) - cut));
    const newTotal = r2(Math.max(num(payable.paidAmount), num(payable.totalAmount) - cut));
    await tx.payable.update({
      where: { id: payable.id },
      data: { balanceAmount: newBalance, totalAmount: newTotal, status: newBalance <= 0.005 ? "Paid" : (num(payable.paidAmount) > 0 ? "Partial" : "Open") },
    });
    supplierOutstandingUpdated = true;
  }

  // GL reversal: Dr Payable, Cr cost-account (per type) + Input GST.
  const entryId = await postPurchaseReturnJournal(tx, {
    tenantId: ret.tenantId, ...seg, date: ret.returnDate, returnNo: ret.returnNo, returnId: ret.id, supplier: ret.supplier,
    purchaseType: ret.purchaseType, taxableValue: r2(taxable), taxTotal: r2(tax), roundOff: num(ret.roundOff), createdBy: createdBy ?? ret.createdBy,
  });
  const journalRef = entryId ? (await tx.journalEntry.findUnique({ where: { id: entryId }, select: { voucherNo: true } }))?.voucherNo ?? null : null;

  await tx.purchaseReturn.update({
    where: { id: ret.id },
    data: { inventoryUpdated, supplierOutstandingUpdated, accountingPosted: !!entryId, journalRef },
  });
}
