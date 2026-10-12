"use client";

import { type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface RadioCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: string;
  className?: string;
}

/** Selectable card used for single-choice option groups. */
export function RadioCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  badge,
  className,
}: RadioCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
        "focus-visible:outline-none focus-visible:shadow-focus",
        selected
          ? "border-primary bg-primary-subtle shadow-sm ring-1 ring-primary"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
        className
      )}
    >
      {icon && (
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
            selected ? "bg-primary text-white" : "bg-surface-2 text-muted"
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge && (
            <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-2xs font-bold text-accent-foreground">
              {badge}
            </span>
          )}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {description}
          </span>
        )}
      </span>
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition",
          selected ? "border-primary bg-primary text-white" : "border-border-strong"
        )}
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
    </button>
  );
}
