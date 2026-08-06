import { prisma } from "@/lib/db/prisma";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";
import { DEFAULT_ACCOUNTING_CONFIG, mergeAccountingConfigData, type AccountingConfigData } from "@/lib/settings/accountingConfigDefaults";

/** Read-only accessor used by the Dispatch & Sales Accounting posting engine
 * (postDispatchAccountingVoucher / buildPreparedSale in
 * src/lib/transport/loadDispatch.ts) to check timing/mode configuration. */
export async function getAccountingConfig(user: ScopeUser): Promise<AccountingConfigData> {
  const sc = await settingScope(user);
  const row = await resolveScoped((where) => prisma.accountingConfiguration.findFirst({ where }), sc);
  return mergeAccountingConfigData(row?.config as unknown as AccountingConfigData | undefined);
}

export { DEFAULT_ACCOUNTING_CONFIG };
