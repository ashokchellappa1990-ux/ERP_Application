import type { Prisma } from "@prisma/client";
import { postMovement, addLot } from "@/lib/inventory/ledger";
import { reverseJournalForSource } from "@/lib/accounting/post";
import { reverseInlineSettlements } from "@/lib/advance/engine";
import { reverseForCancellation } from "@/lib/loyalty/engine";
import type { CancellationConfig } from "@/lib/sales/cancellationConfig";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

/**
 * Post an Approved sales cancellation — fully reverse the original sale:
 *  - Inventory: restore each line (SALES_CANCELLED IN + fresh lot, batch/expiry kept).
 *  - Serial: flip the sale's unique pieces Sold → Available (clear customer/warranty).
 *  - Accounting: reverse the original SALES voucher (swap Dr/Cr) → cash/bank refunded,
 *    receivable + revenue + GST + COGS + inventory all reversed.
 *  - Customer ledger + loyalty: roll back totalSpent + loyaltyPoints.
 *  - Mark the Sale "Cancelled" so it drops out of POS terminal / shift / day cash
 *    (EOD aggregates only count status = "Completed").
 * Each switch obeys the cancellation config. Call once, on transition to Approved.
 */
export async function postSalesCancellation(tx: Prisma.TransactionClient, cancellationId: number, cfg: CancellationConfig, createdBy?: number | null) {
  const c = await tx.salesCancellation.findUnique({ where: { id: cancellationId } });
  if (!c) throw new Error("Sales cancellation not found.");
  const sale = await tx.sale.findUnique({ where: { id: c.saleId }, include: { lines: true } });
  if (!sale) throw new Error("Original sale not found.");
  const seg = { businessId: c.businessId ?? null, branchId: c.branchId ?? null };
  const warehouse = sale.warehouse || "Main Store";

  // 1) Inventory restoration (Inventory products only — service lines have no lot).
  let inventoryReversed = false;
  if (cfg.restoreInventory) {
    for (const line of sale.lines) {
      const qty = num(line.qty);
      if (qty <= 0) continue;
      const unitCost = qty > 0 ? r2(num(line.cost) / qty) : 0;
      await postMovement(tx, {
        tenantId: c.tenantId, ...seg, productId: line.productId, txnType: "SALES_CANCELLED", direction: "IN", qty,
        rate: unitCost, sellingRate: num(line.rate), warehouse, batchNo: line.batchNo, mfgDate: line.mfgDate, expiryDate: line.expiryDate,
        refType: "SALES_CANCELLED", refId: c.id, refNo: c.cancellationNo, txnDate: c.cancellationDate, createdBy: createdBy ?? c.createdBy,
      });
      await addLot(tx, {
        tenantId: c.tenantId, ...seg, productId: line.productId, warehouse, batchNo: line.batchNo, mfgDate: line.mfgDate, expiryDate: line.expiryDate,
        refType: "SALES_CANCELLED", refId: line.id, refNo: c.cancellationNo, receivedDate: c.cancellationDate,
        qty, unitRate: unitCost, sellingRate: num(line.rate),
      });
    }
    inventoryReversed = true;
  }

  // 2) Serial / unique-QR pieces → Available again (clear sale/customer/warranty).
  if (cfg.restoreSerialStatus) {
    const codes = await tx.saleLineQr.findMany({ where: { saleId: sale.id, mode: "unique" }, select: { qrCodeMappingId: true } });
    for (const q of codes) {
      await tx.qrCodeMapping.update({ where: { id: q.qrCodeMappingId }, data: { status: "Active", soldSaleId: null, soldAt: null, soldInvoiceNo: null, customerId: null, customerName: null, warrantyStart: null, warrantyEnd: null, activatedAt: null } });
    }
  }

  // 3) Accounting — reverse the original SALES voucher entirely.
  let accountingReversed = false; let journalRef: string | null = null;
  if (cfg.reverseAccounting) {
    await reverseJournalForSource(tx, c.tenantId, "SALES", sale.id, c.cancellationDate, createdBy ?? c.createdBy);
    const rev = await tx.journalEntry.findFirst({ where: { tenantId: c.tenantId, sourceType: "SALES", sourceId: sale.id, voucherType: "JOURNAL" }, orderBy: { id: "desc" }, select: { voucherNo: true } });
    journalRef = rev?.voucherNo ?? null;
    accountingReversed = true;
  }

  // 3b) Advance Management — void any customer-advance settlements applied to this
  // invoice (its advance GL was inside the SALES voucher reversed above) so the
  // advance balance is restored.
  await reverseInlineSettlements(tx, c.tenantId, "Sales Invoice", sale.id);

  // 4) Customer ledger roll-back + loyalty reversal (via the loyalty engine:
  // reverse all earned points + restore any redeemed points; writes the ledger).
  let customerLedgerReversed = false; let loyaltyReversed = false;
  if (sale.customerId) {
    if (cfg.reverseCustomerOutstanding) {
      const cust = await tx.customer.findUnique({ where: { id: sale.customerId }, select: { totalSpent: true } });
      if (cust) { await tx.customer.update({ where: { id: sale.customerId }, data: { totalSpent: Math.max(0, r2(num(cust.totalSpent) - num(sale.total))) } }); customerLedgerReversed = true; }
    }
    if (cfg.reverseLoyalty && (sale.loyaltyEarned > 0 || sale.loyaltyRedeemed > 0)) {
      await reverseForCancellation(tx, { tenantId: c.tenantId, businessId: c.businessId ?? null, branchId: c.branchId ?? null, createdBy: createdBy ?? c.createdBy, txnDate: c.cancellationDate }, { sale: { id: sale.id, invoiceNo: sale.invoiceNo, loyaltyEarned: sale.loyaltyEarned, loyaltyRedeemed: sale.loyaltyRedeemed, customerId: sale.customerId }, cancellationId: c.id });
      loyaltyReversed = true;
    }
  }

  // 5) Mark the sale Cancelled (drops it from POS/EOD cash + tax aggregates).
  await tx.sale.update({ where: { id: sale.id }, data: { status: "Cancelled" } });

  // 6) Stamp the reversal status flags on the cancellation.
  await tx.salesCancellation.update({
    where: { id: c.id },
    data: { inventoryReversed, paymentReversed: true, accountingReversed, customerLedgerReversed, loyaltyReversed, journalRef },
  });
}
