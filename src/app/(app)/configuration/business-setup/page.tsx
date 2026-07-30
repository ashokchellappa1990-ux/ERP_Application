"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ArrowRight,
  CheckCircle2,
  Settings2,
  Clock,
  Layers,
  ShieldCheck,
  Sparkles,
  Zap,
  PencilLine,
  Wand2,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RadioCard } from "@/components/ui/RadioCard";
import { MODES, type SetupMode } from "@/lib/setup/config";
import {
  AiSetupModal,
  SMART_METHODS,
  type SmartMethod,
} from "@/components/setup/AiSetupModal";
import { cn } from "@/lib/cn";

const COVERS = [
  "Company, branches & warehouses",
  "GST, tax & financial year",
  "Users, roles & permissions",
  "Inventory, POS & payments",
  "Modules & industry-specific settings",
  "Data migration & security",
];

const MODE_ICONS: Record<SetupMode, typeof Zap> = {
  quick: Zap,
  standard: Settings2,
  advanced: Layers,
};

export default function BusinessSetupPage() {
  const router = useRouter();
  const [pace, setPace] = useState<SetupMode>("standard");
  const [approach, setApproach] = useState<"smart" | "manual">("smart");
  const [methodId, setMethodId] = useState<string | null>("gst-cert");
  const [modalMethod, setModalMethod] = useState<SmartMethod | null>(null);

  function startManual() {
    sessionStorage.setItem("oneerp.setup.start", JSON.stringify({ mode: pace }));
    router.push("/setup");
  }
  function startSmart() {
    const m = SMART_METHODS.find((x) => x.id === methodId);
    if (m) setModalMethod(m);
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-xs text-muted">
        <span>Configuration</span>
        <span className="text-subtle">/</span>
        <span className="font-medium text-foreground">Business Setup</span>
      </div>

      {/* ---------------- Card 1: overview + pace ---------------- */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div
          className="relative px-7 py-7 text-white"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        >
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Building2 className="h-7 w-7" />
            </span>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Business Setup</h1>
                <Badge tone="warning" className="bg-white/20 text-white">
                  One-time
                </Badge>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/85">
                The guided onboarding that configures your company before you
                start operations — company details, locations, GST &amp; finance,
                users, inventory, POS, payments and modules.
              </p>
            </div>
          </div>
        </div>

        <div className="p-7">
          <div className="grid gap-7 lg:grid-cols-2">
            {/* What it covers */}
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                What you&apos;ll configure
              </h2>
              <ul className="mt-3 space-y-2">
                {COVERS.map((c) => (
                  <li key={c} className="flex items-center gap-2.5 text-sm text-foreground">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success-subtle text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" /> 5–25 minutes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Save &amp; resume
                </span>
              </div>
            </div>

            {/* Pace selection */}
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Settings2 className="h-4 w-4 text-primary" />
                Choose your pace
              </h2>
              <div className="mt-3 space-y-2.5">
                {MODES.map((m) => {
                  const Icon = MODE_ICONS[m.id];
                  return (
                    <RadioCard
                      key={m.id}
                      selected={pace === m.id}
                      onSelect={() => setPace(m.id)}
                      title={m.name}
                      description={`${m.tagline} · ${m.minutes}`}
                      icon={<Icon className="h-5 w-5" />}
                      badge={m.badge}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Card 2: AI-Assisted Company Setup ---------------- */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-gradient-to-r from-primary/[0.08] via-secondary/[0.04] to-transparent px-7 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                AI-Assisted Company Setup
              </h2>
              <p className="text-sm text-muted">
                How would you like to set up your company?
              </p>
            </div>
          </div>
        </div>

        <div className="p-7">
          {/* Smart vs Manual */}
          <div className="grid gap-3 sm:grid-cols-2">
            <RadioCard
              selected={approach === "smart"}
              onSelect={() => setApproach("smart")}
              title="Smart Setup"
              description="Upload a document or enter your GST number — AI auto-fills your company details in seconds."
              icon={<Wand2 className="h-5 w-5" />}
              badge="Recommended"
            />
            <RadioCard
              selected={approach === "manual"}
              onSelect={() => setApproach("manual")}
              title="Manual Setup"
              description="Fill in every field yourself, step by step. Full control, takes longer."
              icon={<PencilLine className="h-5 w-5" />}
            />
          </div>

          {/* Method cards */}
          {approach === "smart" && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
                Choose a source — ranked by accuracy &amp; speed
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {SMART_METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = methodId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethodId(m.id)}
                      className={cn(
                        "relative flex flex-col rounded-xl border p-4 text-left transition",
                        "focus-visible:outline-none focus-visible:shadow-focus",
                        active
                          ? "border-primary bg-primary-subtle/40 shadow-sm ring-1 ring-primary"
                          : "border-border bg-surface hover:border-border-strong hover:bg-surface-2"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                            active ? "bg-brand-gradient text-white" : "bg-surface-2 text-primary"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <Badge tone={m.recommended ? "success" : "neutral"}>
                          {m.recommended ? "Recommended" : `Priority ${m.priority}`}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-foreground">
                        {m.title}
                      </h3>
                      <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">
                        {m.desc}
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-2xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-success">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          {m.accuracy}
                        </span>
                        <span className="inline-flex items-center gap-1 text-muted">
                          <Clock className="h-3.5 w-3.5" />
                          {m.effort}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer action */}
          <div className="mt-7 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">
              {approach === "smart"
                ? "AI will read your source and pre-fill the setup. You can edit anything."
                : "You'll fill in each field yourself in the step-by-step wizard."}
            </p>
            {approach === "smart" ? (
              <Button size="lg" onClick={startSmart} disabled={!methodId} className="shrink-0">
                <Sparkles className="h-4 w-4" />
                Start AI Setup
              </Button>
            ) : (
              <Button size="lg" onClick={startManual} className="shrink-0">
                Start Manual Setup
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {modalMethod && (
        <AiSetupModal
          method={modalMethod}
          pace={pace}
          onClose={() => setModalMethod(null)}
        />
      )}
    </div>
  );
}
