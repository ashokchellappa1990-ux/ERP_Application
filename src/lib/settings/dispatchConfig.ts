import { prisma } from "@/lib/db/prisma";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";
import { DEFAULT_DISPATCH_CONFIG, type TransportConfigData } from "@/lib/settings/transportConfigDefaults";

/** Deep-merge a stored config onto the defaults so newly-added keys always exist. */
export function mergeDispatchConfig(stored: Partial<TransportConfigData> | null | undefined): TransportConfigData {
  const base = JSON.parse(JSON.stringify(DEFAULT_DISPATCH_CONFIG)) as TransportConfigData;
  if (!stored) return base;
  base.fields = { ...base.fields, ...(stored.fields ?? {}) };
  base.flags = { ...base.flags, ...(stored.flags ?? {}) };
  return base;
}

/** Read-only accessor used by the dispatch execution engine and the gate/weighment
 * chain to check config flags (requireWeighment, salesInvoicePostingMethod, …). */
export async function getDispatchConfig(user: ScopeUser): Promise<TransportConfigData> {
  const sc = await settingScope(user);
  const row = await resolveScoped((where) => prisma.dispatchConfiguration.findFirst({ where }), sc);
  return mergeDispatchConfig(row?.config as unknown as TransportConfigData | undefined);
}
