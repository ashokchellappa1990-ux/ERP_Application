import { type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";

export interface StatCardProps {
  label: string;
  value: string;
  delta?: number; // percentage, signed
  deltaLabel?: string;
  icon: ReactNode;
  iconTone?: "primary" | "secondary" | "success" | "warning" | "accent";
}

const iconToneClasses: Record<
  NonNullable<StatCardProps["iconTone"]>,
  string
> = {
  primary: "bg-primary-subtle text-primary",
  secondary: "bg-secondary-subtle text-secondary",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  accent: "bg-accent/15 text-accent-foreground",
};

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  icon,
  iconTone = "primary",
}: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
            iconToneClasses[iconTone]
          )}
        >
          {icon}
        </span>
      </div>
      {delta !== undefined && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              positive ? "text-success" : "text-danger"
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {Math.abs(delta)}%
          </span>
          {deltaLabel && <span className="text-subtle">{deltaLabel}</span>}
        </div>
      )}
    </Card>
  );
}
