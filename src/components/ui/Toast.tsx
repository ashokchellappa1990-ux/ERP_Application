"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * App-wide toast notifications. Mounted once at the root so any screen can show
 * a success / error / info / warning popup:
 *
 *   const toast = useToast();
 *   toast.success("Saved.");                 // green, auto-dismiss
 *   toast.error("Could not save.");          // red, stays a bit longer
 *   toast.info("Heads up…");  toast.warning("Careful…");
 *
 * Convenience for the app's `{ ok, message }` API shape:
 *   toast.result(j, "Saved.", "Could not save.");
 */
export type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem { id: number; type: ToastType; title?: string; message: string; duration: number }

interface ApiResult { ok?: boolean; message?: string }

interface ToastApi {
  show: (message: string, opts?: { type?: ToastType; title?: string; duration?: number }) => number;
  success: (message: string, title?: string) => number;
  error: (message: string, title?: string) => number;
  info: (message: string, title?: string) => number;
  warning: (message: string, title?: string) => number;
  /** Toast from an `{ ok, message }` API response. Returns `res.ok`. */
  result: (res: ApiResult | null | undefined, okMsg?: string, failMsg?: string) => boolean;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastApi | undefined>(undefined);
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<ToastApi["show"]>((message, opts = {}) => {
    const id = (counter += 1);
    const type = opts.type ?? "info";
    const duration = opts.duration ?? (type === "error" ? 6000 : 3500);
    setToasts((t) => [...t, { id, type, title: opts.title, message, duration }]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => {
    const mk = (type: ToastType) => (message: string, title?: string) => show(message, { type, title });
    return {
      show,
      success: mk("success"),
      error: mk("error"),
      info: mk("info"),
      warning: mk("warning"),
      dismiss,
      result: (res, okMsg, failMsg) => {
        const ok = !!res?.ok;
        if (ok) show(res?.message || okMsg || "Done.", { type: "success" });
        else show(res?.message || failMsg || "Something went wrong.", { type: "error" });
        return ok;
      },
    };
  }, [show, dismiss]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/* ------------------------------------------------------------------ rendering */

const VARIANT: Record<ToastType, { icon: typeof CheckCircle2; accent: string; iconColor: string }> = {
  success: { icon: CheckCircle2, accent: "border-l-success", iconColor: "text-success" },
  error: { icon: XCircle, accent: "border-l-danger", iconColor: "text-danger" },
  warning: { icon: AlertTriangle, accent: "border-l-warning", iconColor: "text-warning" },
  info: { icon: Info, accent: "border-l-info", iconColor: "text-info" },
};

function Toaster({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[100] flex flex-col items-end justify-start gap-2 px-4 pb-4 pt-[calc(var(--topbar-height,3.5rem)+0.75rem)] sm:px-6 sm:pb-6">
      <div className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => <ToastCard key={t.id} t={t} onDismiss={onDismiss} />)}
      </div>
    </div>,
    document.body,
  );
}

function ToastCard({ t, onDismiss }: { t: ToastItem; onDismiss: (id: number) => void }) {
  const [shown, setShown] = useState(false);
  const v = VARIANT[t.type];
  const Icon = v.icon;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const timer = window.setTimeout(() => onDismiss(t.id), t.duration);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(timer); };
  }, [t.id, t.duration, onDismiss]);

  return (
    <div
      role={t.type === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 border-border bg-card p-3.5 shadow-xl ring-1 ring-black/5 transition-all duration-300",
        v.accent,
        shown ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0",
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", v.iconColor)} />
      <div className="min-w-0 flex-1">
        {t.title && <p className="text-sm font-semibold text-foreground">{t.title}</p>}
        <p className={cn("text-sm text-foreground", t.title && "text-muted")}>{t.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(t.id)}
        className="-mr-1 -mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-subtle transition hover:bg-surface-2 hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
