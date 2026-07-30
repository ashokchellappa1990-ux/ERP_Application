import type { Prisma } from "@prisma/client";
import { DEFAULT_PURCHASE_INVOICE_CONFIG, type PurchaseConfigData } from "@/lib/settings/purchaseConfigDefaults";

/**
 * Reserve and return the next purchase-invoice number for this tenant (per the
 * active business/branch purchase settings). Uses its own continuous `seqPI`
 * counter and the configured `piPrefix` (default PINV) + optional branch code.
 */
export async function nextPurchaseInvoiceNumber(
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

  const locked = await tx.$queryRawUnsafe<Array<{ seqPI: number }>>(
    "SELECT `seqPI` FROM `purchase_settings` WHERE `id` = ? FOR UPDATE",
    row.id,
  );
  const cfg = (row.config ?? DEFAULT_PURCHASE_INVOICE_CONFIG) as unknown as PurchaseConfigData;
  const prefix = (cfg.fields?.piPrefix || "PINV").replace(/[\s/_-]+$/, "");
  const branchCode = br != null
    ? ((await tx.branch.findUnique({ where: { id: br }, select: { code: true } }))?.code ?? null)
    : null;

  const assigned = Math.max(1, locked[0]?.seqPI ?? 0);
  await tx.purchaseSetting.update({ where: { id: row.id }, data: { seqPI: assigned + 1 } });

  const parts = [prefix];
  if (branchCode) parts.push(branchCode);
  parts.push(String(assigned).padStart(5, "0"));
  return parts.join("/");
}
