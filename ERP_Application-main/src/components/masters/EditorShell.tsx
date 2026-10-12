"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Check,
  CheckCircle2,
  Sparkles,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export interface ShellTab {
  id: string;
  label: string;
  icon: LucideIcon;
}
export interface SummaryField {
  label: string;
  value: string;
  badge?: { label: string; tone: Tone };
}
export interface AiHint {
  ok: boolean;
  text: string;
}

export interface EditorShellProps {
  parentLabel: string;
  parentHref: string;
  cancelHref: string;
  title: string;
  status: { label: string; tone: Tone };
  tabs: ShellTab[];
  activeId: string;
  onTab: (id: string) => void;
  onAi?: () => void;
  aiLabel?: string;
  onSaveDraft: () => void;
  onSave: () => void;
  saveLabel: string;
  summaryTitle: string;
  summaryName: string;
  summaryCode: string;
  summaryBadges?: { label: string; tone: Tone }[];
  summaryFields: SummaryField[];
  ai?: AiHint[];
  saved?: boolean;
  savedText?: string;
  /** Optional control rendered in the content header, beside "Step X of Y". */
  headerAction?: ReactNode;
  children: ReactNode;
}

function Ring({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center">
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span className="absolute text-2xs font-bold text-foreground">{pct}%</span>
    </span>
  );
}

export function EditorShell({
  parentLabel, parentHref, cancelHref, title, status,
  tabs, activeId, onTab, onAi, aiLabel = "AI Setup",
  onSaveDraft, onSave, saveLabel,
  summaryTitle, summaryName, summaryCode, summaryBadges = [], summaryFields,
  ai, saved, savedText, headerAction, children,
}: EditorShellProps) {
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const total = tabs.length;
  const active = tabs[activeIndex];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === total - 1;
  const progress = Math.round(((activeIndex + 1) / total) * 100);
  const pending = tabs.slice(activeIndex + 1, activeIndex + 4);

  const stepperRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef<HTMLButtonElement>(null);
  // Keep the active step in view as the user moves through the stepper.
  useEffect(() => {
    const scroller = stepperRef.current;
    const el = activeStepRef.current;
    if (!scroller || !el) return;
    const target = el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeId]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {/* Header */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs text-muted">
          <Link href={parentHref} className="hover:text-foreground">{parentLabel}</Link>
          <span className="text-subtle">/</span>
          <span className="font-medium text-foreground">{title}</span>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
            <Badge tone={status.tone} className="capitalize">{status.label}</Badge>
            {onAi && (
              <button type="button" onClick={onAi} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-105">
                <Sparkles className="h-3.5 w-3.5" /> {aiLabel}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href={cancelHref}><Button variant="ghost" size="md">Cancel</Button></Link>
            <Button variant="outline" size="md" onClick={onSaveDraft}><Save className="h-4 w-4" /> Save Draft</Button>
            <Button size="md" onClick={onSave}><Check className="h-4 w-4" /> {saveLabel}</Button>
          </div>
        </div>
      </div>

      {/* Horizontal stepper */}
      <div ref={stepperRef} className="overflow-x-auto rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex min-w-max items-center">
          {tabs.map((t, i) => {
            const done = i < activeIndex;
            const isActive = i === activeIndex;
            return (
              <div key={t.id} className="flex items-center">
                <button ref={isActive ? activeStepRef : undefined} type="button" onClick={() => onTab(t.id)} className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-left transition">
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition",
                      isActive ? "text-white shadow ring-4 ring-primary/15" : done ? "bg-success text-white" : "border-2 border-border-strong bg-surface text-subtle"
                    )}
                    style={isActive ? { backgroundImage: "var(--gradient-brand)" } : undefined}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="hidden sm:block">
                    <span className={cn("block text-xs font-semibold leading-tight", isActive ? "text-primary" : done ? "text-foreground" : "text-muted")}>{t.label}</span>
                    <span className={cn("block text-2xs leading-tight", isActive ? "text-primary/70" : done ? "text-success" : "text-subtle")}>
                      {done ? "Completed" : isActive ? "In Progress" : `Step ${i + 1}`}
                    </span>
                  </span>
                </button>
                {i < total - 1 && <span className={cn("mx-2 h-px w-6 shrink-0 sm:w-10", done ? "bg-success" : "bg-border")} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Body + right panel */}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-primary-subtle/60 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white shadow-sm"><active.icon className="h-[18px] w-[18px]" /></span>
                <h2 className="text-sm font-bold text-primary">{active.label}</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Step {activeIndex + 1} of {total}</span>
                {headerAction}
              </div>
            </div>
            <div className="p-5 sm:p-6">{children}</div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
            <Button variant="ghost" size="md" disabled={isFirst} onClick={() => onTab(tabs[activeIndex - 1].id)}><ArrowLeft className="h-4 w-4" /> Previous</Button>
            <Button variant="outline" size="md" onClick={onSaveDraft}><Save className="h-4 w-4" /> Save Draft</Button>
            {isLast ? (
              <Button size="md" onClick={onSave}><Check className="h-4 w-4" /> {saveLabel}</Button>
            ) : (
              <Button size="md" onClick={() => onTab(tabs[activeIndex + 1].id)}>Next <ArrowRight className="h-4 w-4" /></Button>
            )}
          </div>
        </div>

        {/* Right panel */}
        <aside className="hidden space-y-4 xl:block">
          {/* Summary */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">{summaryTitle}</p>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow-sm">{(summaryName || "?").charAt(0)}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{summaryName || "New record"}</p>
                <p className="text-2xs text-subtle">{summaryCode}</p>
              </div>
            </div>
            {summaryBadges.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">{summaryBadges.map((b) => <Badge key={b.label} tone={b.tone} className="capitalize">{b.label}</Badge>)}</div>
            )}
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              {summaryFields.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-2 text-xs">
                  <span className="shrink-0 text-muted">{f.label}</span>
                  <span className="flex items-center gap-1.5 truncate font-medium text-foreground">
                    {f.value || "—"}
                    {f.badge && <Badge tone={f.badge.tone}>{f.badge.label}</Badge>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Setup Progress</p>
            <div className="flex items-center gap-3">
              <Ring pct={progress} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{progress >= 100 ? "All set!" : "Almost there"}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
            {pending.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                <p className="text-2xs font-semibold uppercase tracking-wide text-subtle">Next Steps</p>
                {pending.map((p) => (
                  <button key={p.id} onClick={() => onTab(p.id)} className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-xs text-foreground transition hover:bg-surface-2">
                    <span className="inline-flex items-center gap-2"><Circle className="h-3 w-3 text-subtle" />{p.label}</span>
                    <span className="text-2xs font-medium text-warning">Pending</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI */}
          {ai && ai.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle"><Sparkles className="h-3.5 w-3.5 text-primary" /> AI Suggestions</p>
              <div className="space-y-2">
                {ai.map((h) => (
                  <div key={h.text} className="flex items-start gap-2 text-xs">
                    {h.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />}
                    <span className={h.ok ? "text-foreground" : "text-info"}>{h.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Success overlay */}
      {saved && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
          <div className="success-pop mx-4 w-full max-w-sm rounded-2xl bg-card p-7 text-center shadow-xl">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success"><CheckCircle2 className="h-8 w-8 text-white" /></div>
            <h2 className="mt-4 text-lg font-bold text-foreground">Saved</h2>
            <p className="mt-1 text-sm text-muted">{savedText}</p>
          </div>
        </div>
      )}
    </div>
  );
}
