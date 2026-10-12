"use client";

import { GitBranch } from "lucide-react";
import { useScope } from "@/components/scope/ScopeProvider";
import { cn } from "@/lib/cn";

/**
 * "Add to: All branches / a particular branch" picker for add/edit forms.
 * Populated from the user's allowed branches (hierarchy-restricted): a branch
 * user sees only their branch (locked); a business/owner user picks All or one.
 * Emits `value`: "all" = applies to every branch (branchId null), or a branchId.
 */
export function BranchScopeField({ value, onChange }: { value: number | "all" | undefined; onChange: (v: number | "all") => void }) {
  const { ready, branches, businessId, lockBranch } = useScope();
  if (!ready) return null;

  const myBranches = branches.filter((b) => b.businessId === businessId);
  // Branch-level user: locked to their single branch.
  if (lockBranch) {
    return (
      <div className="rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-2xs text-muted">
        <GitBranch className="mr-1 inline h-3.5 w-3.5 text-accent" /> This record will be added to your branch: <strong className="text-foreground">{myBranches[0]?.name ?? "—"}</strong>
      </div>
    );
  }

  const current: number | "all" = value ?? "all";
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle"><GitBranch className="h-3.5 w-3.5 text-accent" /> Add to</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChange("all")} className={cn("rounded-md border px-3 py-1.5 text-sm font-medium transition", current === "all" ? "border-primary bg-primary-subtle/50 text-primary" : "border-border bg-surface text-muted hover:bg-surface-2")}>
          All branches
        </button>
        <span className="text-2xs text-subtle">or a particular branch:</span>
        <select
          value={current === "all" ? "" : String(current)}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "all")}
          className="h-9 rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="">— select branch —</option>
          {myBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <p className="mt-1.5 text-2xs text-muted">{current === "all" ? "Applies to every branch of this business." : "Applies to the selected branch only — other branches won't see it."}</p>
    </div>
  );
}
