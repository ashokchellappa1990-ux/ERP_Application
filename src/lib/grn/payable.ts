import type { Prisma } from "@prisma/client";

/** Keep the supplier payable in sync with a GRN. A posted GRN with an unpaid /
 * part-paid balance creates an Open/Partial payable; fully-paid or draft GRNs
 * carry no payable. Always replaces any prior payable for the GRN. */
export async function syncGrnPayable(
  tx: Prisma.TransactionClient,
  tenantId: number,
  grn: { id: number; grnNo: string; supplier: string | null; grnDate: string; paymentTerms: string | null; dueDate: string | null },
  grandTotal: number,
  amountPaid: number,
  posted: boolean,
  scope?: { businessId?: number | null; branchId?: number | null }, // segregate the payable by GRN's business/branch
) {
  await tx.payable.deleteMany({ where: { tenantId, sourceType: "GRN", sourceId: grn.id } });
  if (!posted) return;
  const balance = +(grandTotal - amountPaid).toFixed(2);
  if (balance <= 0.005) return; // fully paid → nothing payable
  await tx.payable.create({
    data: {
      tenantId, businessId: scope?.businessId ?? undefined, branchId: scope?.branchId ?? undefined,
      sourceType: "GRN", sourceId: grn.id, refNo: grn.grnNo, supplier: grn.supplier,
      docDate: grn.grnDate, dueDate: grn.dueDate, paymentTerms: grn.paymentTerms,
      totalAmount: grandTotal, paidAmount: amountPaid, balanceAmount: balance,
      status: amountPaid > 0 ? "Partial" : "Open",
    },
  });
}
