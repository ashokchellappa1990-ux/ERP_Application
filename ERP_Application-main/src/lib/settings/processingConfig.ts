import { prisma } from "@/lib/db/prisma";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";

export interface ProcessingConfigData {
  flags: {
    // Yes -> Initiate Process is only allowed when Finished Goods output
    // (+ any process loss captured on the transaction) sums to exactly 100%
    // of the input quantity. No -> initiation is allowed with an unallocated
    // balance, which stays visible on the transaction throughout.
    requireFullOutputAllocation: boolean;
  };
}

export const DEFAULT_PROCESSING_CONFIG: ProcessingConfigData = { flags: { requireFullOutputAllocation: false } };

export function mergeProcessingConfig(stored: Partial<ProcessingConfigData> | null | undefined): ProcessingConfigData {
  const base = JSON.parse(JSON.stringify(DEFAULT_PROCESSING_CONFIG)) as ProcessingConfigData;
  if (!stored) return base;
  base.flags = { ...base.flags, ...(stored.flags ?? {}) };
  return base;
}

/** Read-only accessor used by the Material Processing initiate flow. */
export async function getProcessingConfig(user: ScopeUser): Promise<ProcessingConfigData> {
  const sc = await settingScope(user);
  const row = await resolveScoped((where) => prisma.processingConfiguration.findFirst({ where }), sc);
  return mergeProcessingConfig(row?.config as unknown as Partial<ProcessingConfigData> | undefined);
}
