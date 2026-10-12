import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Canonical section card used across the whole application. A single, consistent
 * heading style — tinted background strip, brand-coloured bold title and a
 * primary icon chip, left-aligned, with an optional right-aligned action.
 *
 * Use this for every titled form / settings / summary section so headings look
 * identical everywhere.
 */
export function SectionCard({
  icon: Icon,
  title,
  action,
  children,
  bodyClass,
  className,
  allowOverflow = false,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  bodyClass?: string;
  className?: string;
  /** Set when the body contains an absolutely-positioned popover (e.g. a search
   * dropdown) that must escape the card instead of being clipped. */
  allowOverflow?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card shadow-sm", allowOverflow ? "overflow-visible" : "overflow-hidden", className)}>
      <div className={cn("flex items-center justify-between gap-2 border-b border-border bg-primary-subtle/60 px-4 py-2.5", allowOverflow && "rounded-t-2xl")}>
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          {Icon && (
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-white shadow-sm">
              <Icon className="h-4 w-4" />
            </span>
          )}
          {title}
        </p>
        {action}
      </div>
      <div className={bodyClass ?? "p-4"}>{children}</div>
    </div>
  );
}
