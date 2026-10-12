import { getUserPermissions } from "@/lib/auth/rbac";
import type { ActiveScope } from "@/lib/auth/scope";
import type { AiActor } from "../types";
import type { TxType } from "./transactions";
import { budgetCheckForHead } from "./masters";

/**
 * PRE-DRAFT VALIDATION — a lightweight, SAFE subset run before a draft is finalized:
 * permission, mandatory fields, positive amount, and an honest note that the full ERP
 * validation (budget, stock, credit limit, GST/TDS/TCS, duplicates, financial period)
 * runs when the user actually creates the record in the module. The AI never bypasses
 * those — it only stages a draft.
 */

export interface ValidationResult { ok: boolean; issues: string[]; warnings: string[] }

export async function hasTxPermission(actor: AiActor, tx: TxType): Promise<boolean> {
  const perms = new Set(await getUserPermissions({ role: actor.role, roleId: actor.roleId }));
  const role = (actor.role ?? "").toLowerCase();
  if (perms.has("*") || role.includes("owner") || role.includes("admin")) return true;
  return perms.has(tx.permission) || perms.has(tx.permission.split(".")[0]);
}

export async function validateDraft(actor: AiActor, tx: TxType, fields: Record<string, string>, scope?: ActiveScope): Promise<ValidationResult> {
  const issues: string[] = []; const warnings: string[] = [];
  if (!(await hasTxPermission(actor, tx))) issues.push(`You don't have permission to create ${tx.label}.`);
  for (const f of tx.fields) if (f.required && !(fields[f.key] ?? "").trim()) issues.push(`${f.label} is required.`);
  const amt = Number(fields.amount || 0);
  if (tx.fields.some((f) => f.key === "amount")) {
    if (fields.amount !== undefined && amt <= 0) issues.push("Amount must be greater than zero.");
    if (amt >= 50000) warnings.push("Large amount — this will likely require an approval step.");
  }
  // Budget control — when the expense head resolved to a real head + amount, check the plan.
  if (scope && fields.headId && amt > 0) {
    const b = await budgetCheckForHead(scope, Number(fields.headId), amt);
    if (b.level === "stop") issues.push(`Budget: ${b.message ?? "over budget — posting is blocked by budget control."}`);
    else if (b.level === "approval") warnings.push(`Budget approval: ${b.message ?? "this exceeds budget and needs approval."}`);
    else if (b.level === "warn") warnings.push(`Budget: ${b.message ?? "nearing the budget limit."}`);
  }
  warnings.push("Final checks (stock, credit limit, GST/TDS, duplicates, financial period) run when you create this in the module.");
  return { ok: issues.length === 0, issues, warnings };
}
