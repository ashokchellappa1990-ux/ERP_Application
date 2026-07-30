"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Bell, Search, Menu, LogOut, GitBranch } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { useScope } from "@/components/scope/ScopeProvider";
import { useSession } from "@/components/auth/SessionProvider";
import {
  getCompanyProfile,
  subscribeCompanyProfile,
  companyInitials,
} from "@/lib/settings/companyProfileConfig";
import { cn } from "@/lib/cn";

const ROLE_LABELS: Record<string, string> = {
  owner: "Business Owner",
  admin: "Administrator",
  manager: "Manager",
  cashier: "Cashier",
};

export interface TopbarProps {
  onMenu: () => void;
}

export function Topbar({ onMenu }: TopbarProps) {
  const { user, signOut } = useSession();
  // Live company branding from Business Setup (re-renders on save).
  const company = useSyncExternalStore(
    subscribeCompanyProfile,
    getCompanyProfile,
    getCompanyProfile
  );

  // Active business + branch from the scope selector (falls back to Business Setup).
  const { businesses, branches, businessId, branchIds } = useScope();
  const activeBiz = businesses.find((b) => b.id === businessId);
  const companyName = activeBiz?.name || company.name || user?.businessName || "—";
  const gstin = activeBiz?.gstNumber || company.gstin; // active business's GSTIN
  const branchName =
    branchIds === null ? "All branches"
    : branchIds.length === 1 ? (branches.find((b) => b.id === branchIds[0])?.name ?? "1 branch")
    : `${branchIds.length} branches`;
  const userName = user?.fullName ?? "—";
  const roleLabel = user ? ROLE_LABELS[user.role] ?? user.role : "Not signed in";

  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center gap-3 border-b border-border bg-surface/90 px-3 backdrop-blur md:px-5">
      <button
        type="button"
        onClick={onMenu}
        className="touch-target grid place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-foreground"
        aria-label="Toggle menu"
        title="Collapse / expand menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Company branding — logo + name + GSTIN from Business Setup */}
      <Link
        href="/setup"
        title="Business Setup"
        className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition hover:bg-surface-2"
      >
        {company.logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoDataUrl}
            alt={companyName}
            className="h-9 w-9 shrink-0 rounded-lg object-contain ring-1 ring-border"
          />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-gradient text-xs font-bold text-primary-foreground">
            {companyInitials(companyName)}
          </span>
        )}
        <span className="hidden flex-col leading-tight lg:flex">
          <span className="max-w-[280px] truncate text-sm font-bold text-foreground">
            {companyName}
          </span>
          <span className="flex items-center gap-1.5 text-2xs font-medium text-muted">
            <span className="inline-flex items-center gap-1 text-foreground"><GitBranch className="h-3 w-3 text-accent" /> {branchName}</span>
            {gstin && (
              <>
                <span className="text-subtle">·</span>
                <span>GSTIN: <span className="font-mono text-foreground">{gstin}</span></span>
              </>
            )}
          </span>
        </span>
      </Link>

      {/* Search */}
      <div className="relative ml-auto hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          type="search"
          placeholder="Search products, invoices, customers…  (Ctrl + K)"
          className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        <ThemeSwitcher />

        <button
          type="button"
          className="touch-target relative grid place-items-center rounded-md border border-border bg-surface text-muted transition hover:bg-surface-2 hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
        </button>

        {/* User menu — from the active session */}
        <div className="ml-1 flex items-center gap-2.5 rounded-md py-1 pl-1.5 pr-1">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {user ? companyInitials(user.fullName) : "—"}
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-xs font-semibold text-foreground">{userName}</span>
            <span className="text-2xs text-subtle">{roleLabel}</span>
          </span>
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            className={cn(
              "touch-target ml-1 grid place-items-center rounded-md text-muted",
              "transition hover:bg-danger-subtle hover:text-danger"
            )}
            aria-label="Sign out"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
