"use client";

import { Fragment } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

export interface GrnFlowStep { label: string; done: boolean }

/** Shared progress-stepper visual — used by the GRN view page and, while still
 * filling the form, the New/Edit GRN page for gate-entry-sourced receipts. */
export function GrnFlowStepper({ steps }: { steps: GrnFlowStep[] }) {
  const currentIdx = Math.max(0, steps.findIndex((s) => !s.done));
  const activeIdx = steps.every((s) => s.done) ? steps.length - 1 : currentIdx;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start">
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            <div className="flex w-24 shrink-0 flex-col items-center gap-1.5 sm:w-32">
              <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-xs font-bold", s.done ? "border-success bg-success-subtle text-success" : i === activeIdx ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-subtle")}>
                {s.done ? <CheckCircle2 className="h-5 w-5" /> : <span>{i + 1}</span>}
              </div>
              <span className={cn("text-center text-2xs font-semibold leading-tight", s.done ? "text-success" : i === activeIdx ? "text-primary" : "text-subtle")}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={cn("mt-[18px] h-0.5 flex-1", s.done ? "bg-success" : "bg-border")} />}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
