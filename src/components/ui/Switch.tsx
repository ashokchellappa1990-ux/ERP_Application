"use client";

import { cn } from "@/lib/cn";

export interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/** Accessible on/off toggle (token-driven). */
export function Switch({
  checked,
  onChange,
  id,
  disabled,
  ...rest
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50",
        checked ? "bg-primary" : "bg-border-strong"
      )}
      {...rest}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
