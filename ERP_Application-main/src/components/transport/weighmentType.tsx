"use client";

import { cn } from "@/lib/cn";
import type { WeighmentType } from "@/lib/contracts/transport";

export type { WeighmentType };

// Entry / Exit Weighment serve both flows; which physical weight each one
// captures flips with the type:
//   Sales    — arrives empty:  1st = Tare  (empty)  → loading   → 2nd = Gross (loaded)
//   Purchase — arrives loaded: 1st = Gross (loaded) → unloading → 2nd = Tare  (empty)
export const WEIGHMENT_COPY: Record<WeighmentType, {
  entryType: "Dispatch" | "RawMaterial";
  party: "Customer" | "Supplier";
  first: { weight: "Tare" | "Gross"; label: string; hint: string };
  second: { weight: "Tare" | "Gross"; label: string; hint: string };
}> = {
  Sales: {
    entryType: "Dispatch", party: "Customer",
    first: { weight: "Tare", label: "Tare Weight (Empty Vehicle, In Kgs)", hint: "Empty vehicle weighed before loading." },
    second: { weight: "Gross", label: "Gross Weight (Loaded Vehicle, In Kgs)", hint: "Loaded vehicle weighed after loading — net = gross − tare." },
  },
  Purchase: {
    entryType: "RawMaterial", party: "Supplier",
    first: { weight: "Gross", label: "Gross Weight (Loaded Vehicle, In Kgs)", hint: "Loaded vehicle weighed on arrival, before unloading." },
    second: { weight: "Tare", label: "Tare Weight (Empty Vehicle, In Kgs)", hint: "Empty vehicle weighed after unloading — net = gross − tare." },
  },
};

export const typeOfEntry = (entryType: string | null | undefined): WeighmentType => (entryType === "RawMaterial" ? "Purchase" : "Sales");

/** `?type=Purchase` keeps the chosen tab across reloads / hand-off links. */
export function readTypeParam(): WeighmentType {
  if (typeof window === "undefined") return "Sales";
  return new URLSearchParams(window.location.search).get("type") === "Purchase" ? "Purchase" : "Sales";
}
export function writeTypeParam(t: WeighmentType) {
  const url = new URL(window.location.href);
  if (t === "Purchase") url.searchParams.set("type", t); else url.searchParams.delete("type");
  window.history.replaceState(null, "", url);
}

export function WeighmentTypeToggle({ value, onChange, disabled }: { value: WeighmentType; onChange: (t: WeighmentType) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-2 p-1">
      {([["Sales", "Sales (Dispatch)"], ["Purchase", "Purchase (Raw Material)"]] as const).map(([v, label]) => (
        <button key={v} type="button" disabled={disabled} onClick={() => onChange(v)} className={cn("rounded-md px-4 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed", value === v ? "bg-brand-gradient text-white shadow-sm" : "text-muted hover:text-foreground")}>{label}</button>
      ))}
    </div>
  );
}
