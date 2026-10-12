"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FaqItem } from "@/lib/website/config";

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((it, i) => (
        <div key={i}>
          <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-surface-2">
            <span className="text-sm font-semibold text-foreground">{it.q}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open === i && "rotate-180")} />
          </button>
          <div className={cn("grid transition-all duration-300", open === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden"><p className="px-5 pb-4 text-sm leading-relaxed text-muted">{it.a}</p></div>
          </div>
        </div>
      ))}
    </div>
  );
}
