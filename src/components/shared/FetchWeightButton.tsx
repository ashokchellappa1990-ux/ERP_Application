"use client";

import { RadioTower } from "lucide-react";
import { cn } from "@/lib/cn";

/** Fetch button for a weight input — enabled only once the shared weighbridge
 * connection (see useWeighbridge / WeighbridgeReadout, both fed by the same
 * hook instance at the page level) is live; copies that live reading into
 * the field on click. No connect affordance here — connecting happens once,
 * up front, on the Weighbridge Setting screen. */
export function FetchWeightButton({ connected, liveWeight, onFetch, className }: { connected: boolean; liveWeight: number | null; onFetch: (kg: number) => void; className?: string }) {
  return (
    <button
      type="button"
      title="Fetch from weighbridge"
      onClick={() => { if (liveWeight != null) onFetch(liveWeight); }}
      disabled={!connected || liveWeight == null}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border-strong bg-surface px-3 text-2xs font-semibold text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-strong disabled:hover:text-muted",
        className,
      )}
    >
      <RadioTower className="h-3.5 w-3.5" /> Fetch
    </button>
  );
}
