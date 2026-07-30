"use client";

import { useEffect, useState } from "react";
import { BookOpen, ArrowRight, X } from "lucide-react";

export interface GuidePoint {
  /** The field / setting name. */
  label: string;
  /** What it is & why it exists. */
  why: string;
  /** What happens on the operation / transaction screen because of it. */
  effect: string;
}
export interface TabGuide {
  summary: string;
  points: GuidePoint[];
}

/**
 * A small, unobtrusive "Field Guide" reference. Renders as a distinct pill
 * button (top-right of a tab). Clicking opens a popup modal explaining each
 * field: what it is, why it exists, and its effect on the billing / print
 * screen — without cluttering the form itself. Hidden by default.
 */
export function FieldGuide({ guide, effectLabel = "On the screen" }: { guide?: TabGuide; effectLabel?: string }) {
  const [open, setOpen] = useState(false);

  // Lock background scroll & close on Escape while the popup is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  if (!guide) return null;

  return (
    <>
      {/* Reference button — distinct amber "help" styling so it reads as optional reference */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs font-semibold text-accent-foreground shadow-sm transition hover:border-accent hover:bg-accent/20"
        title="What does each setting do?"
      >
        <BookOpen className="h-3.5 w-3.5 text-accent-foreground" />
        Field Guide
        <span className="grid h-4 w-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">?</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center gap-2.5 border-b border-border bg-accent/10 px-5 py-3.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/20 text-accent-foreground"><BookOpen className="h-4 w-4" /></span>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">Field Guide</h3>
                <p className="text-2xs text-muted">What each setting does &amp; its effect</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 overflow-y-auto px-5 py-4">
              <p className="text-xs leading-relaxed text-muted">{guide.summary}</p>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {guide.points.map((p, i) => (
                  <li key={i} className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-xs font-semibold text-foreground">{p.label}</p>
                    <p className="mt-0.5 text-2xs leading-relaxed text-muted">{p.why}</p>
                    <p className="mt-1.5 flex items-start gap-1.5 text-2xs leading-relaxed text-primary">
                      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                      <span><span className="font-semibold">{effectLabel}:</span> {p.effect}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-border px-5 py-3 text-right">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-brand-gradient px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105">Got it</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
