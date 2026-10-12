"use client";

import Link from "next/link";
import { ClipboardList, ClipboardCheck, GitCompare, Gauge, BarChart3, Settings2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS: { key: string; label: string; href: string; icon: LucideIcon }[] = [
  { key: "planning", label: "Target Planning", href: "/sales/target", icon: ClipboardList },
  { key: "approval", label: "Target Approval", href: "/sales/target/approval", icon: ClipboardCheck },
  { key: "revision", label: "Target Revision", href: "/sales/target/revision", icon: GitCompare },
  { key: "achievement", label: "Target Achievement", href: "/sales/target/achievement", icon: Gauge },
  { key: "performance", label: "Performance Analysis", href: "/sales/target/performance", icon: BarChart3 },
  { key: "config", label: "Configuration", href: "/sales/target/config", icon: Settings2 },
];

/** Sub-navigation across the Sales Target screens (the sidebar shows a single entry). */
export function TargetTabs({ active }: { active: string }) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
      {TABS.map((t) => { const Icon = t.icon; const on = t.key === active; return (
        <Link key={t.key} href={t.href} className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition", on ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-surface-2 hover:text-foreground")}>
          <Icon className="h-4 w-4" />{t.label}
        </Link>
      ); })}
    </div>
  );
}
