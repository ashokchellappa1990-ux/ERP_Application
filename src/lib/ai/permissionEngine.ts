import { prisma } from "@/lib/db/prisma";
import { getUserPermissions } from "@/lib/auth/rbac";
import type { AiActor } from "./types";
import type { RegisteredModule } from "./moduleRegistry";

/**
 * MODULE 5 — PERMISSION ENGINE. Runs BEFORE every AI response. It scopes the copilot to
 * exactly what the user is allowed to see: their ERP permission keys gate which modules
 * the AI may reason about, and the active company/branch scope is always applied. An
 * optional ai_permissions table can further restrict roles per module.
 *
 * Product owner / all-access → everything. Cashier → only permitted modules (e.g. no
 * Finance P&L). Branch manager → only their branch (scope enforced by the data layer).
 */

export async function canUseAi(user: AiActor): Promise<boolean> {
  // Any signed-in ERP user may use the copilot; module visibility is filtered below.
  return !!user?.id;
}

/** Filter the registered modules down to those this user may query. */
export async function allowedModules(user: AiActor, modules: RegisteredModule[]): Promise<RegisteredModule[]> {
  const perms = new Set(await getUserPermissions({ role: user.role, roleId: user.roleId }));
  const wildcard = perms.has("*") || (user.role ?? "").toLowerCase().includes("owner") || (user.role ?? "").toLowerCase().includes("admin");

  // Optional per-role AI restrictions (ai_permissions). Absent → fall back to ERP perms.
  const roleKey = (user.role ?? "").toLowerCase();
  const rules = await prisma.aiPermission.findMany({ where: { OR: [{ tenantId: user.tenantId }, { tenantId: null }], roleKey: { in: [roleKey, "*"] } } }).catch(() => []);
  const denyKeys = new Set(rules.filter((r) => !r.allowed).map((r) => r.moduleKey));

  return modules.filter((m) => {
    if (denyKeys.has(m.moduleKey) || denyKeys.has("*")) return false;
    if (wildcard) return true;
    // Allowed if the user holds ANY of the module's declared permission keys (or it declares none).
    if (!m.permissions.length) return true;
    return m.permissions.some((p) => perms.has(p) || perms.has(p.split(".")[0]));
  });
}

/** A short, human-readable statement of the user's data boundary for the system prompt. */
export function scopeStatement(user: AiActor): string {
  const parts: string[] = [];
  parts.push(user.businessId ? `business #${user.businessId}` : "all businesses they can access");
  parts.push(user.branchId ? `branch #${user.branchId}` : "their permitted branches");
  return `The user's role is "${user.role ?? "user"}". Only answer using data within ${parts.join(" and ")}. Never reveal data outside this scope, and never expose raw database table or column names.`;
}
