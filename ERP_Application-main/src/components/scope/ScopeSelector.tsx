"use client";

import { useEffect, useRef, useState } from "react";
import { Store, GitBranch, ChevronDown, Check } from "lucide-react";
import { useScope } from "@/components/scope/ScopeProvider";
import { cn } from "@/lib/cn";

/**
 * Global business + branch selector (rendered in the scope bar below the topbar).
 * Restricted to what the signed-in
 * user is allowed to see: owner/admin pick any business + branches; a business
 * user picks branches of their business; a branch user is shown a fixed label.
 * Branch selection is multi-select with an "All branches" option.
 */
export function ScopeSelector() {
  const { ready, businesses, branches, lockBusiness, lockBranch, businessId, branchIds, setBusiness, setBranches } = useScope();
  const [open, setOpen] = useState<"biz" | "branch" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the popover on any click/escape outside this selector (no full-screen
  // overlay — so it can never block the rest of the page).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!ready || businesses.length === 0) return null;
  // The header branding already shows the active business + branch. A branch-pinned
  // user (branch user) has nothing to switch, so hide the control entirely. A
  // business user keeps a BRANCH filter (defaults to "All branches") so they can
  // filter every list/feature by branch; the redundant business switcher is hidden
  // (shown only for owner/admin who can change the business).
  if (lockBranch) return null;

  const business = businesses.find((b) => b.id === businessId) ?? businesses[0];
  const myBranches = branches.filter((b) => b.businessId === business?.id);
  const allBranches = branchIds === null;
  const selectedId = branchIds && branchIds.length === 1 ? branchIds[0] : null;
  const branchLabel = lockBranch
    ? myBranches[0]?.name ?? "—"
    : allBranches ? "All branches" : (myBranches.find((b) => b.id === selectedId)?.name ?? "Selected branches");

  // Single-select filter: pick one branch, or All. Closes after choosing.
  const selectBranch = (id: number | null) => { setBranches(id === null ? null : [id]); setOpen(null); };

  return (
    <div ref={rootRef} className="flex items-center gap-1.5">
      {/* Business — only when the user can switch business (owner/admin). */}
      {!lockBusiness && (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(open === "biz" ? null : "biz")}
          className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-foreground transition hover:bg-surface-2"
          title="Business"
        >
          <Store className="h-4 w-4 text-primary" />
          <span className="max-w-[130px] truncate">{business?.name ?? "—"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-subtle" />
        </button>
        {open === "biz" && (
          <Popover>
            {businesses.map((b) => (
              <button key={b.id} onClick={() => { setBusiness(b.id); setOpen(null); }} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-2", b.id === business?.id && "font-semibold text-primary")}>
                <Store className="h-3.5 w-3.5 shrink-0" /><span className="flex-1 truncate">{b.name}</span>{b.id === business?.id && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </Popover>
        )}
      </div>
      )}

      {/* Branch filter — drives data across all features (default: All branches). */}
      <div className="relative">
        <button
          type="button"
          disabled={lockBranch}
          onClick={() => setOpen(open === "branch" ? null : "branch")}
          className={cn("flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-foreground transition", !lockBranch && "hover:bg-surface-2", lockBranch && "cursor-default")}
          title="Branch"
        >
          <GitBranch className="h-4 w-4 text-accent" />
          <span className="max-w-[130px] truncate">{branchLabel}</span>
          {!lockBranch && <ChevronDown className="h-3.5 w-3.5 text-subtle" />}
        </button>
        {open === "branch" && !lockBranch && (
          <Popover>
            <button onClick={() => selectBranch(null)} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-2", allBranches && "font-semibold text-primary")}>
              <span className="flex-1">All branches</span>{allBranches && <Check className="h-3.5 w-3.5" />}
            </button>
            <div className="my-1 h-px bg-border" />
            {myBranches.map((b) => (
              <button key={b.id} onClick={() => selectBranch(b.id)} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-2", b.id === selectedId && "font-semibold text-primary")} style={{ paddingLeft: 10 + Math.max(0, (b.hierarchyLevel ?? 1) - 1) * 16 }}>
                <GitBranch className="h-3.5 w-3.5 shrink-0 text-accent" /><span className="flex-1 truncate">{b.name}</span>{b.id === selectedId && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
            {myBranches.length === 0 && <p className="px-2.5 py-2 text-2xs text-muted">No branches.</p>}
          </Popover>
        )}
      </div>
    </div>
  );
}

function Popover({ children }: { children: React.ReactNode }) {
  // No backdrop — outside-click is handled by the parent's document listener, so
  // this can never cover the page.
  return (
    <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl">
      {children}
    </div>
  );
}
