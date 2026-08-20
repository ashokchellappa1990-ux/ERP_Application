"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronDown, X } from "lucide-react";
import { NAV_SECTIONS, type NavItem, type NavSection } from "@/lib/navigation";
import { Logo } from "@/components/ui/Logo";
import { Badge } from "@/components/ui/Badge";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useSession } from "@/components/auth/SessionProvider";
import { canAccessRoute } from "@/lib/auth/permissions";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/cn";

/** Filter the nav to the features the user's permissions allow. Recurses so a
 * nested group (e.g. Tyre Management inside Transport & Vehicle Operations)
 * survives filtering as long as any of its own (possibly nested) children do. */
function filterNavItem(it: NavItem, perms: Set<string>): NavItem | null {
  if (it.children) {
    const kids = it.children.map((c) => filterNavItem(c, perms)).filter((x): x is NavItem => x !== null);
    return kids.length ? { ...it, children: kids } : null;
  }
  return canAccessRoute(it.href ?? "", perms) ? it : null;
}
function filterNav(sections: NavSection[], perms: Set<string>): NavSection[] {
  return sections
    .map((s) => ({ ...s, items: s.items.map((it) => filterNavItem(it, perms)).filter((x): x is NavItem => x !== null) }))
    .filter((s) => s.items.length > 0);
}

/** First reachable leaf href under an item — used for the collapsed rail's
 * link target when the item (or its first child) is itself a group. */
function firstLeafHref(item: NavItem): string | undefined {
  if (item.href) return item.href;
  for (const c of item.children ?? []) {
    const href = firstLeafHref(c);
    if (href) return href;
  }
  return undefined;
}

/** Whether an item's (possibly nested) descendants include the active route —
 * used to auto-expand a parent and keep it highlighted when the active page
 * is a grandchild inside a nested group. */
function containsActivePath(item: NavItem, isActive: (href?: string) => boolean): boolean {
  return !!item.children?.some((c) => isActive(c.href) || containsActivePath(c, isActive));
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const currentReport = useSearchParams().get("report");
  const { theme } = useTheme();
  const { permissions, permsReady } = useSession();
  const darkMenu = !THEMES.find((t) => t.id === theme)?.lightSidebar;

  // Only show features the user is permitted to. Until permissions resolve, show
  // the full menu (avoids a flash of an empty sidebar for owners/admins).
  const sections = useMemo(
    () => (permsReady ? filterNav(NAV_SECTIONS, permissions) : NAV_SECTIONS),
    [permsReady, permissions]
  );

  // Every leaf href with its query stripped — used to pick the single most
  // specific (longest) match so a parent path like "/finance" never highlights
  // while you're on a deeper route like "/finance/petty-cash".
  const allPaths = useMemo(() => {
    const out: string[] = [];
    const walk = (items: NavItem[]) => {
      for (const it of items) {
        if (it.href) out.push(it.href.split(/[?#]/)[0]);
        if (it.children) walk(it.children);
      }
    };
    for (const s of NAV_SECTIONS) walk(s.items);
    return out;
  }, []);

  // The one path that best matches the current URL (longest exact/prefix match).
  const activePath = useMemo(() => {
    let best = "";
    for (const p of allPaths) {
      if ((pathname === p || pathname.startsWith(p + "/")) && p.length > best.length) best = p;
    }
    return best;
  }, [allPaths, pathname]);

  const isActive = (href?: string) => {
    if (!href) return false;
    const [path, query] = href.split("?");
    if (path !== activePath) return false;
    // Deep-links that share one pathname (e.g. /finance/reports?report=x): only the
    // item whose report param matches the current URL is active.
    if (query) return new URLSearchParams(query).get("report") === currentReport;
    return true;
  };
  const hasActiveChild = (item: NavItem) => containsActivePath(item, isActive);

  // Expand parents that contain the active route by default.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV_SECTIONS.forEach((s) =>
      s.items.forEach((i) => {
        if (i.children && containsActivePath(i, isActive))
          init[i.label] = true;
      })
    );
    return init;
  });

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-menu text-menu-foreground transition-all duration-200",
          "border-r border-[color:var(--color-menu-border)]",
          "lg:static lg:z-auto lg:translate-x-0",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex h-topbar shrink-0 items-center border-b border-[color:var(--color-menu-border)]",
            collapsed ? "justify-center px-2" : "justify-between px-4"
          )}
        >
          {collapsed ? <Logo showText={false} /> : <Logo invert={darkMenu} />}
          <button
            type="button"
            onClick={onCloseMobile}
            className="touch-target grid place-items-center rounded-md text-menu-muted hover:bg-menu-hover lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {sections.map((section) => (
            <div key={section.title} className="mb-1">
              {!collapsed && section.title && (
                <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-menu-muted">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) =>
                  item.children ? (
                    <ParentItem
                      key={item.label}
                      item={item}
                      collapsed={collapsed}
                      expanded={!!open[item.label]}
                      activeChild={hasActiveChild(item)}
                      onToggle={() =>
                        setOpen((o) => ({ ...o, [item.label]: !o[item.label] }))
                      }
                      isActive={isActive}
                      onNavigate={onCloseMobile}
                    />
                  ) : (
                    <LeafItem
                      key={item.label}
                      item={item}
                      collapsed={collapsed}
                      active={isActive(item.href)}
                      onNavigate={onCloseMobile}
                    />
                  )
                )}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="hidden shrink-0 border-t border-[color:var(--color-menu-border)] p-2 lg:block">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "flex w-full items-center rounded-md px-3 py-2 text-xs font-medium text-menu-muted transition hover:bg-menu-hover",
              collapsed && "justify-center px-0"
            )}
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform",
                collapsed && "rotate-180",
                !collapsed && "mr-2"
              )}
            />
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ----------------------------------------------------------- leaf item -- */
function LeafItem({
  item,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href ?? "#"}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition",
          collapsed && "justify-center px-0",
          active
            ? "nav-item-active text-white shadow-md"
            : "text-menu-foreground hover:bg-menu-hover"
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", !collapsed && "mr-3")} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && (
              <Badge
                tone="primary"
                className={cn(
                  "ml-2",
                  active ? "bg-white/25 text-white" : "bg-primary-subtle text-primary"
                )}
              >
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </Link>
    </li>
  );
}

/* --------------------------------------------------------- parent item -- */
function ParentItem({
  item,
  collapsed,
  expanded,
  activeChild,
  onToggle,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  expanded: boolean;
  activeChild: boolean;
  onToggle: () => void;
  isActive: (href?: string) => boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  // Collapsed rail: behave as a link to the first reachable child.
  if (collapsed) {
    return (
      <li>
        <Link
          href={firstLeafHref(item) ?? "#"}
          onClick={onNavigate}
          title={item.label}
          className={cn(
            "flex items-center justify-center rounded-md py-2 transition",
            activeChild
              ? "nav-item-active text-white shadow-md"
              : "text-menu-foreground hover:bg-menu-hover"
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition",
          activeChild
            ? "bg-primary-subtle font-semibold text-primary"
            : "text-menu-foreground hover:bg-menu-hover"
        )}
      >
        <Icon className="mr-3 h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <ul className="mt-0.5 space-y-0.5 pl-4">
          {item.children!.map((child) =>
            child.children ? (
              <NestedParentItem key={child.label} item={child} isActive={isActive} onNavigate={onNavigate} />
            ) : (
              <LeafChild key={child.label} item={child} active={isActive(child.href)} onNavigate={onNavigate} />
            )
          )}
        </ul>
      )}
    </li>
  );
}

/* ------------------------------------------------- leaf child (nested) -- */
function LeafChild({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href ?? "#"}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
          active
            ? "nav-item-active font-medium text-white shadow-sm"
            : "text-menu-foreground/80 hover:bg-menu-hover hover:text-menu-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}

/* --------------------------------------------- nested parent (one more level) -- */
function NestedParentItem({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: (href?: string) => boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const activeChild = containsActivePath(item, isActive);
  const [expanded, setExpanded] = useState(activeChild);

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
          activeChild
            ? "bg-primary-subtle font-semibold text-primary"
            : "text-menu-foreground/80 hover:bg-menu-hover hover:text-menu-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <ul className="mt-0.5 space-y-0.5 pl-4">
          {item.children!.map((child) => (
            <LeafChild key={child.label} item={child} active={isActive(child.href)} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}
