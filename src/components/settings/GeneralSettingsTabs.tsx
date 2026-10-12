"use client";

import { useState } from "react";
import { SlidersHorizontal, Receipt } from "lucide-react";
import { GeneralSettings } from "./GeneralSettings";
import { PosConfiguration } from "./PosConfiguration";
import { cn } from "@/lib/cn";

const TABS = [
  { id: "general", label: "General Settings", icon: SlidersHorizontal },
  { id: "pos", label: "Tax Configuration", icon: Receipt },
] as const;

/** General Settings page — hosts the application-wide defaults and the POS
 * Configuration (moved here) under a single tabbed screen. */
export function GeneralSettingsTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("general");

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">General Settings</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><SlidersHorizontal className="h-5 w-5 text-primary" /> General Settings</h1>
        <p className="mt-0.5 text-sm text-muted">Application-wide defaults and POS billing behaviour — each tab saves independently.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition -mb-px",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "general" ? <GeneralSettings embedded /> : <PosConfiguration embedded />}
    </div>
  );
}
