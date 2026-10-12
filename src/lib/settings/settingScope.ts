import { resolveWriteScope, type ScopeUser } from "@/lib/auth/scope";

/**
 * Per-branch settings scope. Settings resolve with an override precedence:
 *   branch-specific row (branchId = active branch)
 *   → business default (branchId = null)
 *   → tenant default (businessId = null, branchId = null)
 * Writes target the active (business, branch) exactly — so editing one branch's
 * settings never touches another's; "All branches" (branchId null) is the default
 * that every branch inherits unless it has its own row.
 */
export interface SettingScope {
  tenantId: number;
  businessId: number | null;
  branchId: number | null; // null = "All branches" (business default)
}

export async function settingScope(user: ScopeUser): Promise<SettingScope> {
  const { businessId, branchId } = await resolveWriteScope(user);
  return { tenantId: user.tenantId, businessId: businessId ?? null, branchId: branchId ?? null };
}

export interface SettingWhere { tenantId: number; businessId: number | null; branchId: number | null }

/** The ordered (businessId, branchId) lookups to try for a READ, most specific first. */
export function readLookups(sc: SettingScope): SettingWhere[] {
  const ladder: { businessId: number | null; branchId: number | null }[] = [];
  if (sc.branchId != null) ladder.push({ businessId: sc.businessId, branchId: sc.branchId }); // branch-specific
  ladder.push({ businessId: sc.businessId, branchId: null }); // business default
  ladder.push({ businessId: null, branchId: null }); // tenant default
  return ladder.map((l) => ({ tenantId: sc.tenantId, ...l }));
}

/** Resolve the effective settings row for a scope via the override ladder. Pass a
 * model's findFirst as `find` — e.g. (where) => prisma.posSetting.findFirst({ where }). */
export async function resolveScoped<R extends { id: number }>(
  find: (where: SettingWhere) => Promise<R | null>,
  sc: SettingScope,
): Promise<R | null> {
  for (const w of readLookups(sc)) { const r = await find(w); if (r) return r; }
  return null;
}
