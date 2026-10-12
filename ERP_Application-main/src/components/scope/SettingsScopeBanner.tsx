"use client";

import { Info, Store, GitBranch } from "lucide-react";
import { useScope } from "@/components/scope/ScopeProvider";

/**
 * Banner shown on configuration / settings screens telling the user WHICH
 * business + branch the settings they're editing apply to. The scope comes from
 * the top-bar business/branch selector:
 *   - "All branches" → the business default (every branch inherits it).
 *   - a specific branch → only that branch (an override).
 * To edit a different scope, change the selection in the top bar.
 */
export function SettingsScopeBanner() {
  const { ready, businesses, branches, businessId, branchIds, lockBranch } = useScope();
  if (!ready || businesses.length === 0) return null;

  const biz = businesses.find((b) => b.id === businessId) ?? businesses[0];
  const all = branchIds === null;
  const branchLabel = lockBranch
    ? branches.find((b) => b.businessId === biz?.id)?.name ?? "your branch"
    : all ? "All branches" : branchIds.length === 1 ? branches.find((b) => b.id === branchIds[0])?.name ?? "1 branch" : `${branchIds.length} branches`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5 text-sm">
      <span className="inline-flex items-center gap-1.5 font-semibold text-primary"><Info className="h-4 w-4" /> Editing settings for:</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-foreground"><Store className="h-3.5 w-3.5 text-primary" /> {biz?.name}</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-foreground"><GitBranch className="h-3.5 w-3.5 text-accent" /> {branchLabel}</span>
      <span className="text-2xs text-muted">{all ? "Saved as the business default — every branch inherits it unless it has its own override." : "Saved for this branch only — other branches keep the business default."} Change the business/branch in the top bar to edit a different scope.</span>
    </div>
  );
}
