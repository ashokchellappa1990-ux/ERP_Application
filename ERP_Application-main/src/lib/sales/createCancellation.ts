import type { Prisma } from "@prisma/client";
import { nextCancellationNumber } from "@/lib/sales/invoiceNumber";
import { postSalesCancellation } from "@/lib/sales/postCancellation";
import { restorePromoForSaleTx } from "@/lib/promo/service";
import type { CancellationConfig } from "@/lib/sales/cancellationConfig";
import type { TerminalStamp } from "@/lib/pos/terminalContext";

const num = (v: unknown) => (v == null ? 0 : Number(v));

type SaleWithLines = Prisma.SaleGetPayload<{ include: { lines: true; payments: true } }>;

export interface CreateCancellationOpts {
  user: { id: number; tenantId: number };
  seg: { businessId?: number; branchId?: number };
  stamp: TerminalStamp;
  sale: SaleWithLines;
  cfg: CancellationConfig;
  status: string;            // "Approved" → reverses immediately; else stored only
  cancellationDate: string;
  reason?: string | null;
  remarks?: string | null;
  refundMethod?: string | null;
  refundAmount: number;
}

// Card / UPI refunds settle through the gateway later → Pending; others immediate.
const isPendingRefund = (mode: string) => /card|upi/i.test(mode);

/** Insert a SalesCancellation (+ item & payment snapshots) and, when status is
 * "Approved", run the full reversal — all inside the caller's tx. Single source of
 * truth for creating a posted cancellation. */
export async function createCancellationTx(tx: Prisma.TransactionClient, opts: CreateCancellationOpts): Promise<{ id: number; cancellationNo: string; status: string }> {
  const { user, seg, stamp, sale, cfg, status, cancellationDate } = opts;
  const cancellationNo = await nextCancellationNumber(tx, user.tenantId, { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });

  // Snapshot the restored serials per line (for the item record + reporting).
  const qrs = await tx.saleLineQr.findMany({ where: { saleId: sale.id, mode: "unique" }, include: { qrMapping: { select: { serialNo: true } } } });
  const serialsByLine = new Map<number, string[]>();
  for (const q of qrs) { const arr = serialsByLine.get(q.saleLineId) ?? []; arr.push(q.qrMapping.serialNo || q.code); serialsByLine.set(q.saleLineId, arr); }

  const c = await tx.salesCancellation.create({
    data: {
      tenantId: user.tenantId, ...seg, cancellationNo, cancellationDate,
      saleId: sale.id, invoiceNo: sale.invoiceNo, channel: sale.channel, warehouse: sale.warehouse,
      customerId: sale.customerId, customerName: sale.customerName, customerPhone: sale.customerPhone,
      invoiceAmount: num(sale.total), refundAmount: opts.refundAmount, refundMethod: opts.refundMethod || "original", paymentMode: sale.paymentMode,
      reason: opts.reason || null, remarks: opts.remarks || null,
      status, itemCount: sale.itemCount, createdBy: user.id, ...stamp,
      items: { create: sale.lines.map((l) => ({
        saleLineId: l.id, productId: l.productId, productName: l.productName, sku: l.sku, hsn: l.hsn,
        qty: l.qty, rate: l.rate, taxAmount: l.taxAmount, value: l.value, cost: l.cost,
        batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate,
        serialNos: (serialsByLine.get(l.id) ?? []).join(", ") || null,
      })) },
      payments: { create: sale.payments.map((p) => ({ mode: p.mode, amount: p.amount, reference: p.reference, refundStatus: isPendingRefund(p.mode) ? "Pending" : "Completed" })) },
    },
    select: { id: true },
  });

  if (status === "Approved") {
    await postSalesCancellation(tx, c.id, cfg, user.id);
    // Full void → reverse any promo code redeemed on this sale (re-activates single-use).
    await restorePromoForSaleTx(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null }, sale.id);
  }
  return { id: c.id, cancellationNo, status };
}
