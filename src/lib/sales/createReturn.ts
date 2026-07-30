import type { Prisma } from "@prisma/client";
import { nextReturnNumber } from "@/lib/sales/invoiceNumber";
import { postSalesReturn } from "@/lib/sales/postReturn";
import type { BuiltReturn } from "@/lib/sales/returnPayload";
import type { TerminalStamp } from "@/lib/pos/terminalContext";

export interface CreateReturnOpts {
  user: { id: number; tenantId: number };
  seg: { businessId?: number; branchId?: number };
  stamp: TerminalStamp;
  sale: { id: number | null; invoiceNo: string | null; customerId: number | null; customerName: string | null; customerPhone: string | null };
  built: BuiltReturn;
  refundMode: string;
  status: string;                 // "Completed" → posts inventory + GL immediately; else stored only
  returnDate: string;
  refundRef?: string | null;
  refundRemarks?: string | null;
  notes?: string | null;
}

/** Insert a SalesReturn (+ lines) and, when status is "Completed", post inventory IN
 * + the reversal journal + any customer credit — all inside the caller's tx. The
 * single source of truth for creating a posted return (returns route + exchange leg). */
export async function createReturnTx(
  tx: Prisma.TransactionClient,
  opts: CreateReturnOpts,
): Promise<{ id: number; returnNo: string; status: string }> {
  const { user, seg, stamp, sale, built, refundMode, status, returnDate } = opts;
  const returnNo = await nextReturnNumber(tx, user.tenantId, { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
  const ret = await tx.salesReturn.create({
    data: {
      tenantId: user.tenantId, ...seg, returnNo, returnDate, saleId: sale.id, invoiceNo: sale.invoiceNo,
      customerId: sale.customerId, customerName: sale.customerName, customerPhone: sale.customerPhone,
      grossAmount: built.grossAmount, discountAdj: built.discountAdj, taxAdj: built.taxAdj,
      refundAmount: built.refundAmount, refundMode, refundRef: opts.refundRef || null, refundRemarks: opts.refundRemarks || null,
      status, itemCount: Math.round(built.itemCount), notes: opts.notes || null, createdBy: user.id, ...stamp,
      lines: { create: built.lines.map((l) => ({
        saleLineId: l.saleLineId, productId: l.productId, productName: l.productName, sku: l.sku,
        soldQty: l.soldQty, returnQty: l.returnQty, rate: l.rate, discAmount: l.discAmount, taxAmount: l.taxAmount,
        returnValue: l.returnValue, cost: l.cost, reason: l.reason, remarks: l.remarks, inventoryHandling: l.inventoryHandling,
        batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate,
      })) },
    },
    select: { id: true },
  });
  if (status === "Completed") await postSalesReturn(tx, ret.id, user.id);
  return { id: ret.id, returnNo, status };
}
