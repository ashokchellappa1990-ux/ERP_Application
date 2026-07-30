import type { Prisma } from "@prisma/client";
import { DEFAULT_PURCHASE_INVOICE_CONFIG, type PurchaseConfigData } from "@/lib/settings/purchaseConfigDefaults";

/** Resolve (or seed) the effective purchase_settings row for the active scope and
 * lock it FOR UPDATE so a running counter can be read+bumped atomically. */
async function lockSettingRow(tx: Prisma.TransactionClient, tenantId: number, scope: { businessId: number | null; branchId: number | null }) {
  const biz = scope.businessId ?? null;
  const br = scope.branchId ?? null;
  const row =
    (br != null ? await tx.purchaseSetting.findFirst({ where: { tenantId, businessId: biz, branchId: br } }) : null) ??
    (await tx.purchaseSetting.findFirst({ where: { tenantId, businessId: biz, branchId: null } })) ??
    (await tx.purchaseSetting.findFirst({ where: { tenantId, businessId: null, branchId: null } })) ??
    (await tx.purchaseSetting.create({ data: { tenantId, businessId: biz, branchId: null, config: DEFAULT_PURCHASE_INVOICE_CONFIG as unknown as Prisma.InputJsonValue } }));
  const branchCode = br != null
    ? ((await tx.branch.findUnique({ where: { id: br }, select: { code: true } }))?.code ?? null)
    : null;
  const cfg = (row.config ?? DEFAULT_PURCHASE_INVOICE_CONFIG) as unknown as PurchaseConfigData;
  return { row, branchCode, cfg };
}

/**
 * Reserve and return the next purchase-return number for this tenant (per the active
 * business/branch purchase settings). Uses its own continuous `seqPR` counter and
 * the configured `prPrefix` (default PRTN) + optional branch code.
 */
export async function nextPurchaseReturnNumber(
  tx: Prisma.TransactionClient,
  tenantId: number,
  scope?: { businessId: number | null; branchId: number | null },
): Promise<string> {
  const { row, branchCode, cfg } = await lockSettingRow(tx, tenantId, { businessId: scope?.businessId ?? null, branchId: scope?.branchId ?? null });
  const locked = await tx.$queryRawUnsafe<Array<{ seqPR: number }>>(
    "SELECT `seqPR` FROM `purchase_settings` WHERE `id` = ? FOR UPDATE",
    row.id,
  );
  const prefix = (cfg.fields?.prPrefix || "PRTN").replace(/[\s/_-]+$/, "");
  const assigned = Math.max(1, locked[0]?.seqPR ?? 0);
  await tx.purchaseSetting.update({ where: { id: row.id }, data: { seqPR: assigned + 1 } });
  const parts = [prefix];
  if (branchCode) parts.push(branchCode);
  parts.push(String(assigned).padStart(5, "0"));
  return parts.join("/");
}

/**
 * Reserve and return the next asset-register number for this tenant. Uses its own
 * continuous `seqAsset` counter and the configured `assetPrefix` (default FA).
 */
export async function nextAssetNumber(
  tx: Prisma.TransactionClient,
  tenantId: number,
  scope?: { businessId: number | null; branchId: number | null },
): Promise<string> {
  const { row, branchCode, cfg } = await lockSettingRow(tx, tenantId, { businessId: scope?.businessId ?? null, branchId: scope?.branchId ?? null });
  const locked = await tx.$queryRawUnsafe<Array<{ seqAsset: number }>>(
    "SELECT `seqAsset` FROM `purchase_settings` WHERE `id` = ? FOR UPDATE",
    row.id,
  );
  const prefix = (cfg.fields?.assetPrefix || "FA").replace(/[\s/_-]+$/, "");
  const assigned = Math.max(1, locked[0]?.seqAsset ?? 0);
  await tx.purchaseSetting.update({ where: { id: row.id }, data: { seqAsset: assigned + 1 } });
  const parts = [prefix];
  if (branchCode) parts.push(branchCode);
  parts.push(String(assigned).padStart(5, "0"));
  return parts.join("/");
}
