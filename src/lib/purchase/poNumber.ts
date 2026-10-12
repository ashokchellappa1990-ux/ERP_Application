import type { Prisma } from "@prisma/client";
import { DEFAULT_PURCHASE_INVOICE_CONFIG, type PurchaseConfigData } from "@/lib/settings/purchaseConfigDefaults";

/**
 * Reserve and return the next purchase-order number for this tenant (per the active
 * business/branch purchase settings). Uses its own continuous `seqPO` counter and the
 * configured `poPrefix` (default PO) + optional branch code. Mirrors nextPurchaseInvoiceNumber.
 */
export async function nextPurchaseOrderNumber(
  tx: Prisma.TransactionClient,
  tenantId: number,
  scope?: { businessId: number | null; branchId: number | null },
): Promise<string> {
  const biz = scope?.businessId ?? null;
  const br = scope?.branchId ?? null;
  const row =
    (br != null ? await tx.purchaseSetting.findFirst({ where: { tenantId, businessId: biz, branchId: br } }) : null) ??
    (await tx.purchaseSetting.findFirst({ where: { tenantId, businessId: biz, branchId: null } })) ??
    (await tx.purchaseSetting.findFirst({ where: { tenantId, businessId: null, branchId: null } })) ??
    (await tx.purchaseSetting.create({ data: { tenantId, businessId: biz, branchId: null, config: DEFAULT_PURCHASE_INVOICE_CONFIG as unknown as Prisma.InputJsonValue } }));

  const locked = await tx.$queryRawUnsafe<Array<{ seqPO: number }>>(
    "SELECT `seqPO` FROM `purchase_settings` WHERE `id` = ? FOR UPDATE",
    row.id,
  );
  const cfg = (row.config ?? DEFAULT_PURCHASE_INVOICE_CONFIG) as unknown as PurchaseConfigData;
  const fields = (cfg.fields ?? {}) as Record<string, string | undefined>;
  const prefix = (fields.poPrefix || "PO").replace(/[\s/_-]+$/, "");
  const branchCode = br != null
    ? ((await tx.branch.findUnique({ where: { id: br }, select: { code: true } }))?.code ?? null)
    : null;

  const assigned = Math.max(1, locked[0]?.seqPO ?? 0);
  await tx.purchaseSetting.update({ where: { id: row.id }, data: { seqPO: assigned + 1 } });

  const parts = [prefix];
  if (branchCode) parts.push(branchCode);
  parts.push(String(assigned).padStart(5, "0"));
  return parts.join("/");
}
