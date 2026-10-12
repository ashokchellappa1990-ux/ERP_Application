"use client";

import { LogOut, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  icon?: LucideIcon;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Generic centered confirmation popup — modelled on GateExitModal's card
 *  layout so it matches the rest of the app's modal styling. Used wherever an
 *  action needs an explicit "are you sure" before it fires (e.g. sign-out). */
export function ConfirmDialog({
  open, title, message, icon: Icon = LogOut, confirmLabel = "Confirm", cancelLabel = "Cancel",
  tone = "primary", busy = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onCancel}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-3 px-6 pb-2 pt-7 text-center">
          <span className={cn(
            "grid h-12 w-12 place-items-center rounded-full",
            tone === "danger" ? "bg-danger-subtle text-danger" : "bg-primary-subtle text-primary"
          )}>
            <Icon className="h-6 w-6" />
          </span>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted">{message}</p>
        </div>
        <div className="flex items-center justify-center gap-2.5 px-6 pb-6 pt-4">
          <Button variant="ghost" size="md" onClick={onCancel} disabled={busy} className="flex-1">{cancelLabel}</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} size="md" onClick={onConfirm} disabled={busy} className="flex-1">
            {busy ? "Please wait…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
