"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ArrowRight } from "lucide-react";
import { type LoyaltyGuide as Guide } from "@/lib/loyalty/loyaltyData";
import { cn } from "@/lib/cn";

/**
 * Inline flow-wise guide shown on each Loyalty screen: a plain-language summary,
 * the step-by-step flow, and what every field is for — so the user understands
 * the process and purpose without leaving the page.
 */
export function LoyaltyGuide({ guide }: { guide?: Guide }) {
  const [open, setOpen] = useState(false);
  if (!guide) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-primary-subtle/15">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <BookOpen className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-semibold text-foreground">How it works &amp; field guide</span>
        <span className="hidden text-2xs font-medium text-muted sm:inline">{open ? "Hide" : "Show"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-primary/15 px-4 py-4">
          <p className="text-xs leading-relaxed text-muted">{guide.summary}</p>

          {/* Flow */}
          <div>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-subtle">The flow</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {guide.flow.map((step, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-foreground">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-gradient text-[9px] font-bold text-white">{i + 1}</span>
                    {step}
                  </span>
                  {i < guide.flow.length - 1 && <ArrowRight className="h-3 w-3 text-subtle" />}
                </span>
              ))}
            </div>
          </div>

          {/* Field purposes */}
          <div>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-subtle">What each field is for</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {guide.fields.map((f, i) => (
                <li key={i} className="rounded-lg border border-border bg-surface p-2.5">
                  <p className="text-xs font-semibold text-foreground">{f.name}</p>
                  <p className="mt-0.5 text-2xs leading-relaxed text-muted">{f.purpose}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
