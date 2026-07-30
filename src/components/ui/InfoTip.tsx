"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Small "i" affordance next to a field label. Shows the field's purpose and a
 * sample value on hover / focus / tap. Tap toggles for touch devices.
 */
export function InfoTip({
  text,
  sample,
  className,
}: {
  text: string;
  sample?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label="About this field"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className="grid h-4 w-4 place-items-center rounded-full text-subtle transition hover:text-primary"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-6 z-50 w-60 rounded-lg border border-border bg-foreground px-3 py-2 text-2xs leading-relaxed text-surface shadow-lg"
        >
          {text}
          {sample && (
            <span className="mt-1 block text-surface/70">
              Example:{" "}
              <span className="font-semibold text-surface">{sample}</span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
