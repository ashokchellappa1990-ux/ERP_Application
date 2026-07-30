import { isTerminalSetupRequired } from "@/lib/pos/terminalGuard";
import { getUserTerminalIds } from "@/lib/pos/userTerminals";

type ScopeUser = { id: number; tenantId: number; role?: string | null; roleId?: number | null; businessId?: number | null; branchId?: number | null };

/** EOD role scoping: cashiers see only their own activity; everyone else sees the
 *  whole active branch scope. Returns extra Prisma where columns to merge in. */
export function eodCashierScope(user: { id: number; role?: string | null }): { cashierUserId?: number } {
  return (user.role ?? "").toLowerCase() === "cashier" ? { cashierUserId: user.id } : {};
}

/** Validate a requested terminal filter for the EOD screens. Returns the terminal
 *  id to filter by, or null (no filter). Mapped users may only view a terminal
 *  they're assigned to; everyone may view any terminal. No filter when terminal
 *  setup is off. */
export async function resolveEodTerminalId(user: ScopeUser, param: string | null | undefined): Promise<number | null> {
  if (!param) return null;
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!(await isTerminalSetupRequired(user))) return null;
  const mapped = await getUserTerminalIds(user);
  if (mapped.length && !mapped.includes(id)) return null; // assigned users are restricted
  return id;
}
