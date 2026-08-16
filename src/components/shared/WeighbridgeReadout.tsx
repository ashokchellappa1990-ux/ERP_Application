"use client";

import { Scale } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WeighbridgeConnState } from "@/lib/hooks/useWeighbridge";

/** Live weighbridge value badge for a section header's right-hand corner —
 * brand-themed, always visible once the feature is on, showing a zeroed
 * placeholder until a real reading comes in — plus a separate green/red
 * connection status dot + label sitting right next to the badge. */
export function WeighbridgeReadout({ state, liveWeight, className }: { state: WeighbridgeConnState; liveWeight: number | null; className?: string }) {
  const connected = state === "connected";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("flex items-center gap-1 text-2xs font-semibold", connected ? "text-success" : "text-danger")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-success" : "bg-danger")} />
        {connected ? "Connected" : "Not Connected"}
      </span>
      <div className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-white shadow-sm">
        <Scale className={cn("h-3.5 w-3.5", connected ? "text-white" : "text-white/60")} />
        <div className="leading-tight">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-white/70">Weighbridge</p>
          <p className="font-mono text-sm font-bold tabular-nums">{connected && liveWeight != null ? liveWeight.toFixed(3) : "000.000"} <span className="text-[10px] font-semibold text-white/70">Kg</span></p>
        </div>
      </div>
    </div>
  );
}
