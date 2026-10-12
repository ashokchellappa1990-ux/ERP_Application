import type { Prisma } from "@prisma/client";
import { postMovement, addLot } from "@/lib/inventory/ledger";
import { postSalesReturnJournal } from "@/lib/accounting/post";
import { reverseForReturn } from "@/lib/loyalty/engine";
import { returnWarehouse, isSellableReturn } from "@/lib/inventory/buckets";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

/**
 * Post a (Completed) sales return: inventory IN per line to the right warehouse
 * bucket, the proportional GL reversal + refund journal, a customer-credit ledger
 * entry for store-credit/credit-note refunds, and QR traceability (good-condition
 * unique codes flip back to Active so they can be re-sold). Idempotency: callers
 * must only call this once per return (when moving to Completed).
 */
export async function postSalesReturn(tx: Prisma.TransactionClient, returnId: number, createdBy?: number | null) {
  const ret = await tx.salesReturn.findUnique({ where: { id: returnId }, include: { lines: true } });
  if (!ret) throw new Error("Sales return not found.");
  const sale = ret.saleId ? await tx.sale.findUnique({ where: { id: ret.saleId }, select: { warehouse: true } }) : null;
  const sellable = sale?.warehouse || "Main Store";
  const seg = { businessId: ret.businessId ?? null, branchId: ret.branchId ?? null };

  let taxable = 0, tax = 0, cost = 0, writeOff = 0;

  for (const line of ret.lines) {
    const qty = num(line.returnQty);
    if (qty <= 0) continue;
    const lineCost = num(line.cost);
    const unitCost = qty > 0 ? r2(lineCost / qty) : 0;
    const wh = returnWarehouse(line.inventoryHandling, sellable);

    await postMovement(tx, {
      tenantId: ret.tenantId, ...seg, productId: line.productId, txnType: "SALES_RETURN", direction: "IN", qty,
      rate: unitCost, sellingRate: num(line.rate), warehouse: wh,
      batchNo: line.batchNo, mfgDate: line.mfgDate, expiryDate: line.expiryDate,
      refType: "SALES_RETURN", refId: ret.id, refNo: ret.returnNo, txnDate: ret.returnDate, createdBy: createdBy ?? ret.createdBy,
    });
    // Good-condition returns re-enter sellable stock as a fresh lot (FEFO-able).
    if (isSellableReturn(line.inventoryHandling)) {
      await addLot(tx, {
        tenantId: ret.tenantId, ...seg, productId: line.productId, warehouse: wh,
        batchNo: line.batchNo, mfgDate: line.mfgDate, expiryDate: line.expiryDate,
        refType: "SALES_RETURN", refId: line.id, refNo: ret.returnNo, receivedDate: ret.returnDate,
        qty, unitRate: unitCost, sellingRate: num(line.rate),
      });
    }

    // QR traceability — link the original sale line's unique codes (up to returnQty)
    // and, for good-condition, flip them back to Active so they can be re-sold.
    if (line.saleLineId) {
      const codes = await tx.saleLineQr.findMany({ where: { saleLineId: line.saleLineId, mode: "unique" }, select: { qrCodeMappingId: true, code: true, mode: true } });
      if (codes.length) {
        const alreadyReturned = new Set((await tx.salesReturnQr.findMany({ where: { code: { in: codes.map((c) => c.code) } }, select: { code: true } })).map((c) => c.code));
        const take = codes.filter((c) => !alreadyReturned.has(c.code)).slice(0, Math.round(qty));
        // Returned serial → Available (re-sellable, clear sale/customer/warranty) for
        // good condition; otherwise park it by handling (Quarantine / Damaged / Scrapped).
        const returnedStatus = ({ damaged: "Damaged", expired: "Scrapped", scrap: "Scrapped", vendor: "ReturnedToSupplier", quarantine: "Quarantine" } as Record<string, string>)[line.inventoryHandling] ?? "Quarantine";
        for (const c of take) {
          await tx.salesReturnQr.create({ data: { tenantId: ret.tenantId, salesReturnLineId: line.id, qrCodeMappingId: c.qrCodeMappingId, code: c.code, mode: c.mode } });
          if (isSellableReturn(line.inventoryHandling)) {
            await tx.qrCodeMapping.update({ where: { id: c.qrCodeMappingId }, data: { status: "Active", soldSaleId: null, soldAt: null, soldInvoiceNo: null, customerId: null, customerName: null, warrantyStart: null, warrantyEnd: null, activatedAt: null } });
          } else {
            await tx.qrCodeMapping.update({ where: { id: c.qrCodeMappingId }, data: { status: returnedStatus } });
          }
        }
      }
    }

    taxable += num(line.returnValue) - num(line.taxAmount);
    tax += num(line.taxAmount);
    cost += lineCost;
    if (["damaged", "expired", "scrap"].includes(line.inventoryHandling)) writeOff += lineCost;
  }

  // GL: reverse sale proportionally + settle the refund + restore/write-off inventory.
  await postSalesReturnJournal(tx, {
    tenantId: ret.tenantId, ...seg, date: ret.returnDate, returnNo: ret.returnNo, returnId: ret.id, customerName: ret.customerName,
    taxableValue: r2(taxable), taxTotal: r2(tax), refundMode: ret.refundMode ?? "cash",
    inventoryCost: r2(cost), writeOffCost: r2(writeOff), createdBy: createdBy ?? ret.createdBy,
  });

  // Loyalty: reverse the points earned on the returned portion (proportional).
  if (ret.saleId && ret.customerId) {
    const osale = await tx.sale.findUnique({ where: { id: ret.saleId }, select: { id: true, invoiceNo: true, total: true, loyaltyEarned: true, customerId: true } });
    if (osale && osale.loyaltyEarned > 0) {
      await reverseForReturn(tx, { tenantId: ret.tenantId, ...seg, createdBy: createdBy ?? ret.createdBy, txnDate: ret.returnDate }, { sale: { id: osale.id, invoiceNo: osale.invoiceNo, total: num(osale.total), loyaltyEarned: osale.loyaltyEarned, customerId: osale.customerId }, returnId: ret.id, returnValue: num(ret.grossAmount) });
    }
  }

  // Store-credit / credit-note refund → issue a customer-credit ledger entry.
  const mode = (ret.refundMode ?? "").toLowerCase();
  if (mode === "storecredit" || mode === "creditnote") {
    const amount = r2(num(ret.refundAmount));
    if (amount > 0) {
      await tx.customerCredit.create({ data: {
        tenantId: ret.tenantId, ...seg, customerId: ret.customerId,
        creditNo: ret.returnNo, type: mode === "creditnote" ? "CreditNote" : "StoreCredit",
        amount, balance: amount, sourceType: "SALES_RETURN", sourceId: ret.id, status: "Active",
      } });
    }
  }
}
