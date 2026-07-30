import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, type ActiveScope } from "@/lib/auth/scope";
import type { AiActor } from "./types";

/** Resolve the signed-in ERP user + active scope into the AiActor the engine needs. */
export async function currentAiActor(): Promise<AiActor | null> {
  const ctx = await currentAiContext();
  return ctx?.actor ?? null;
}

/** Actor + full ActiveScope — needed by the live-data resolver for scoped queries. */
export async function currentAiContext(): Promise<{ actor: AiActor; scope: ActiveScope } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const u = user as { id: number; tenantId: number; fullName?: string | null; role?: string | null; roleId?: number | null };
  const scope = await getActiveScope(user);
  return { actor: { id: u.id, tenantId: u.tenantId, fullName: u.fullName ?? null, role: u.role ?? null, roleId: u.roleId ?? null, businessId: scope.businessId, branchId: scope.branchId }, scope };
}
