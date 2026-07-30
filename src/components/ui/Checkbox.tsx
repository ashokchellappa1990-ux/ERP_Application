"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  id?: string;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  id,
  className,
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2 text-sm text-foreground",
        className
      )}
    >
      <span
        className={cn(
          "grid h-[18px] w-[18px] shrink-0 place-items-center rounded border transition",
          checked
            ? "border-primary bg-primary text-white"
            : "border-border-strong bg-surface"
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {label && <span>{label}</span>}
    </label>
  );
}
