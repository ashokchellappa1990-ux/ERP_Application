import type { Prisma } from "@prisma/client";
import { nextPurchaseReturnNumber } from "@/lib/purchase/prNumber";
import { postPurchaseReturn } from "@/lib/purchase/postReturn";
import type { BuiltPr } from "@/lib/purchase/returnPayload";
import type { TerminalStamp } from "@/lib/pos/terminalContext";

export interface CreatePrOpts {
  user: { id: number; tenantId: number };
  seg: { businessId?: number; branchId?: number };
  stamp: TerminalStamp;
  invoice: {
    id: number; invoiceNo: string | null; grnId: number | null; grnNo: string | null; poNo: string | null;
    purchaseType: string; supplierId: number | null; supplier: string | null; supplierGstin: string | null; warehouse: string | null;
  };
  built: BuiltPr;
  status: string;        // "Approved" → posts inventory + GL immediately; else stored only
  returnDate: string;
  reason?: string | null;
  remarks?: string | null;
}

/** Insert a PurchaseReturn (+ items + returned-serial links) and, when status is
 * "Approved", post inventory OUT + supplier-outstanding cut + the reversing journal
 * — all inside the caller's tx. Single source of truth for creating a posted return. */
export async function createPurchaseReturnTx(tx: Prisma.TransactionClient, opts: CreatePrOpts): Promise<{ id: number; returnNo: string; status: string }> {
  const { user, seg, stamp, invoice, built, status, returnDate } = opts;
  const returnNo = await nextPurchaseReturnNumber(tx, user.tenantId, { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });

  const ret = await tx.purchaseReturn.create({
    data: {
      tenantId: user.tenantId, ...seg, returnNo, returnDate,
      purchaseInvoiceId: invoice.id, invoiceNo: invoice.invoiceNo, grnId: invoice.grnId, grnNo: invoice.grnNo, poNo: invoice.poNo,
      purchaseType: invoice.purchaseType, supplierId: invoice.supplierId, supplier: invoice.supplier, supplierGstin: invoice.supplierGstin, warehouse: invoice.warehouse,
      reason: opts.reason || null, remarks: opts.remarks || null,
      taxableAmount: built.taxableAmount, taxAmount: built.taxAmount, returnAmount: built.returnAmount,
      status, itemCount: Math.round(built.itemCount), createdBy: user.id, ...stamp,
    },
    select: { id: true },
  });

  // Create items one-by-one so we can attach the returned-serial links by item id.
  for (const l of built.lines) {
    const item = await tx.purchaseReturnItem.create({
      data: {
        purchaseReturnId: ret.id, piItemId: l.piItemId, grnLineId: l.grnLineId, productId: l.productId, productName: l.productName, sku: l.sku, hsn: l.hsn,
        batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate,
        invoicedQty: l.invoicedQty, returnedQty: l.alreadyReturned, returnQty: l.returnQty, rate: l.rate,
        taxPct: l.taxPct, taxAmount: l.taxAmount, discAmount: l.discAmount, returnValue: l.returnValue,
        reason: l.reason, remarks: l.remarks, inventoryHandling: l.inventoryHandling,
      },
      select: { id: true },
    });
    if (l.qrCodes.length) {
      const qrs = await tx.qrCodeMapping.findMany({
        where: { tenantId: user.tenantId, OR: [{ code: { in: l.qrCodes } }, { serialNo: { in: l.qrCodes } }] },
        select: { id: true, code: true, serialNo: true, mode: true },
      });
      const byKey = new Map<string, (typeof qrs)[number]>();
      for (const q of qrs) { byKey.set(q.code, q); if (q.serialNo) byKey.set(q.serialNo, q); }
      for (const c of l.qrCodes) {
        const q = byKey.get(c);
        if (q) await tx.purchaseReturnQr.create({ data: { tenantId: user.tenantId, purchaseReturnItemId: item.id, qrCodeMappingId: q.id, code: q.code, serialNo: q.serialNo, mode: q.mode } });
      }
    }
  }

  if (status === "Approved") await postPurchaseReturn(tx, ret.id, user.id);
  return { id: ret.id, returnNo, status };
}
