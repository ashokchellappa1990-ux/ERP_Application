import type { Prisma } from "@prisma/client";

/** Resolve (or seed) the loyalty_settings row for a scope and lock it for a
 * running-counter read+bump. */
async function lockSetting(tx: Prisma.TransactionClient, tenantId: number, scope: { businessId: number | null; branchId: number | null }) {
  const biz = scope.businessId ?? null; const br = scope.branchId ?? null;
  const row =
    (await tx.loyaltySetting.findFirst({ where: { tenantId, businessId: biz, branchId: null } })) ??
    (await tx.loyaltySetting.findFirst({ where: { tenantId, businessId: null, branchId: null } })) ??
    (await tx.loyaltySetting.create({ data: { tenantId, businessId: null, branchId: null } }));
  return row;
}

/** Reserve and return the next loyalty program code (LP/00001) for a tenant. */
export async function nextProgramCode(tx: Prisma.TransactionClient, tenantId: number, scope?: { businessId: number | null; branchId: number | null }): Promise<string> {
  const row = await lockSetting(tx, tenantId, { businessId: scope?.businessId ?? null, branchId: scope?.branchId ?? null });
  const locked = await tx.$queryRawUnsafe<Array<{ seqProgram: number }>>("SELECT `seqProgram` FROM `loyalty_settings` WHERE `id` = ? FOR UPDATE", row.id);
  const assigned = Math.max(1, (locked[0]?.seqProgram ?? 0) + 1);
  await tx.loyaltySetting.update({ where: { id: row.id }, data: { seqProgram: assigned } });
  return `LP/${String(assigned).padStart(5, "0")}`;
}
