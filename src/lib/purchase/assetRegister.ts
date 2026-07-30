import type { Prisma } from "@prisma/client";
import { nextAssetNumber } from "@/lib/purchase/prNumber";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

/**
 * Create Asset Register entries from a posted Asset-type Purchase Invoice. One
 * FixedAsset row per invoice item (qty-aware: totalValue = qty × unit). Idempotent —
 * skips if assets already exist for this invoice (re-approval / re-post safe).
 */
export async function createAssetRegisterForInvoice(
  tx: Prisma.TransactionClient,
  tenantId: number,
  seg: { businessId?: number | null; branchId?: number | null },
  inv: { id: number; invoiceNo: string; supplierId: number | null; supplier: string | null; supplierInvoiceDate: string | null },
  userId: number,
): Promise<number> {
  const existing = await tx.fixedAsset.count({ where: { tenantId, purchaseInvoiceId: inv.id } });
  if (existing > 0) return 0;

  const items = await tx.purchaseInvoiceItem.findMany({ where: { purchaseInvoiceId: inv.id }, orderBy: { id: "asc" } });
  let created = 0;
  for (const it of items) {
    const qty = num(it.qty) || 1;
    const unit = num(it.unitPrice);
    const assetNo = await nextAssetNumber(tx, tenantId, { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
    await tx.fixedAsset.create({
      data: {
        tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        assetNo, name: it.productName, category: it.hsn ?? null,
        purchaseInvoiceId: inv.id, purchaseInvoiceNo: inv.invoiceNo,
        supplierId: inv.supplierId ?? undefined, supplier: inv.supplier ?? undefined,
        purchaseDate: inv.supplierInvoiceDate ?? undefined,
        qty, unitValue: unit, totalValue: r2(qty * unit),
        status: "Active", createdBy: userId,
      },
    });
    created++;
  }
  return created;
}

/**
 * Mark Asset Register rows Returned for a purchase return of an Asset invoice.
 * Returns up to `count` still-Active assets for the invoice (oldest first).
 */
export async function markAssetsReturned(
  tx: Prisma.TransactionClient,
  tenantId: number,
  purchaseInvoiceId: number,
  count: number,
  returnRef: string,
): Promise<number[]> {
  if (count <= 0) return [];
  const assets = await tx.fixedAsset.findMany({
    where: { tenantId, purchaseInvoiceId, status: "Active" },
    orderBy: { id: "asc" }, take: Math.round(count), select: { id: true },
  });
  const ids = assets.map((a) => a.id);
  if (ids.length) {
    await tx.fixedAsset.updateMany({ where: { id: { in: ids } }, data: { status: "Returned", returnedAt: new Date(), returnRef } });
  }
  return ids;
}
