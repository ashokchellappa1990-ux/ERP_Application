"use client";

import { useScope } from "@/components/scope/ScopeProvider";
import { ScopeSelector } from "@/components/scope/ScopeSelector";

/**
 * Slim scope/filter strip rendered on every page directly below the topbar.
 * Holds the single global business + branch filter (moved out of the cramped
 * header). Hidden for a branch-pinned user, who has nothing to switch.
 */
export function ScopeBar() {
  const { ready, businesses, lockBranch } = useScope();
  if (!ready || businesses.length === 0 || lockBranch) return null;

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface/60 px-3 md:px-5">
      <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Showing</span>
      <ScopeSelector />
    </div>
  );
}
