import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { checkBudget } from "@/lib/finance/budgetService";

/**
 * MASTER CROSS-VALIDATION for the command center — checks a collected value against the
 * real ERP master (expense head, supplier, customer) exactly like the module screen would,
 * and budget availability against the plan. When a value isn't found, the AI offers the
 * closest matches + an option to CREATE it in the master (with the user's acknowledgement).
 */

const norm = (s: string) => s.trim().toLowerCase();

export interface MasterResolve { ok: boolean; id?: number; canonical?: string; suggestions: string[]; createHref: string; masterLabel: string }

export async function resolveMaster(kind: string, tenantId: number, value: string): Promise<MasterResolve> {
  const v = norm(value);
  if (!v) return { ok: false, suggestions: [], createHref: "", masterLabel: kind };

  if (kind === "expenseHead") {
    const heads = await prisma.expenseHead.findMany({ where: { tenantId, active: true, parentId: { not: null } }, select: { id: true, name: true } });
    const exact = heads.find((h) => norm(h.name) === v);
    if (exact) return { ok: true, id: exact.id, canonical: exact.name, suggestions: [], createHref: "/accounting/petty-cash-config", masterLabel: "Accounts Head" };
    const sugg = heads.filter((h) => norm(h.name).includes(v) || v.includes(norm(h.name))).slice(0, 5).map((h) => h.name);
    return { ok: false, suggestions: sugg, createHref: "/accounting/petty-cash-config", masterLabel: "Accounts Head" };
  }
  if (kind === "supplier") {
    const rows = await prisma.supplier.findMany({ where: { tenantId }, select: { id: true, name: true }, take: 800 });
    const exact = rows.find((r) => norm(r.name) === v);
    if (exact) return { ok: true, id: exact.id, canonical: exact.name, suggestions: [], createHref: "/masters/supplier", masterLabel: "Supplier" };
    const sugg = rows.filter((r) => norm(r.name).includes(v)).slice(0, 5).map((r) => r.name);
    return { ok: false, suggestions: sugg, createHref: "/masters/supplier", masterLabel: "Supplier" };
  }
  if (kind === "customer") {
    const rows = await prisma.customer.findMany({ where: { tenantId }, select: { id: true, name: true }, take: 800 });
    const exact = rows.find((r) => norm(r.name) === v);
    if (exact) return { ok: true, id: exact.id, canonical: exact.name, suggestions: [], createHref: "/masters/customer", masterLabel: "Customer" };
    const sugg = rows.filter((r) => norm(r.name).includes(v)).slice(0, 5).map((r) => r.name);
    return { ok: false, suggestions: sugg, createHref: "/masters/customer", masterLabel: "Customer" };
  }
  return { ok: true, canonical: value, suggestions: [], createHref: "", masterLabel: kind };
}

/** Budget availability for an expense head — mirrors the screen's budget control. */
export async function budgetCheckForHead(scope: ActiveScope, headId: number, amount: number): Promise<{ level: "ok" | "warn" | "approval" | "stop"; message?: string }> {
  try {
    const dec = await checkBudget(prisma, { tenantId: scope.tenantId, businessId: scope.businessId, branchId: scope.branchId, headId, dateStr: new Date().toISOString().slice(0, 10), amount });
    if (!dec.ok) return { level: dec.reason === "stop" ? "stop" : "approval", message: dec.message };
    if ("warn" in dec && dec.warn) return { level: "warn", message: dec.message };
    return { level: "ok" };
  } catch { return { level: "ok" }; }
}
