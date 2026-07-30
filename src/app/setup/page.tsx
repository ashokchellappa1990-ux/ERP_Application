"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Save,
  Zap,
  Settings2,
  Building,
  CircleHelp,
  LogOut,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Pencil,
  LayoutDashboard,
  Building2,
  ReceiptText,
  Landmark,
  GitBranch,
  Blocks,
  Contact,
} from "lucide-react";
import {
  SetupProvider,
  useSetup,
} from "@/components/setup/SetupContext";
import { StepBody, STEP_DESCRIPTIONS } from "@/components/setup/StepViews";
import { ReviewStep, SuccessScreen } from "@/components/setup/ReviewStep";
import { STEPS, MODES, MODULE_TOGGLES, type SetupMode } from "@/lib/setup/config";
import { Logo } from "@/components/ui/Logo";
import { useBrand } from "@/components/theme/ThemeProvider";
import { DEFAULT_PRODUCT_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";

export default function SetupPage() {
  return (
    <SetupProvider>
      <SetupFlow />
    </SetupProvider>
  );
}

function SetupFlow() {
  const setup = useSetup();
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState(false);

  if (setup.loading) return <SetupLoading />;
  if (done) return <SuccessScreen />;
  // A completed setup opens as a read-only overview; "Edit" re-enters the wizard.
  if (setup.loadedStatus === "completed" && !editing)
    return <SetupOverview onEdit={() => setEditing(true)} />;
  if (!setup.mode) return <ModeSelection onSelect={setup.setMode} />;

  return <Wizard onComplete={() => setDone(true)} />;
}

function SetupLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--app-bg, var(--color-background))" }}
    >
      <AppLoader label="Loading your business setup…" />
    </div>
  );
}

/* ============================================= completed setup overview === */

function SetupOverview({ onEdit }: { onEdit: () => void }) {
  const { data, mode } = useSetup();
  const c = data.company;
  const modules = MODULE_TOGGLES.filter((m) => data.toggles.modules?.[m.id]).map((m) => m.label);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--app-bg, var(--color-background))" }}>
      <TopBar mode={mode} />
      <div className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 lg:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {c.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logo} alt={c.name} className="h-12 w-12 rounded-xl object-contain ring-1 ring-border" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-gradient text-base font-bold text-white">
                {(c.name || "ONE").charAt(0)}
              </span>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">Business Setup</h1>
                <Badge tone="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Completed</Badge>
              </div>
              <p className="text-sm text-muted">{c.name || "Your company"} — review your saved configuration.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard"><Button variant="outline" size="md"><LayoutDashboard className="h-4 w-4" /> Dashboard</Button></Link>
            <Button size="md" onClick={onEdit}><Pencil className="h-4 w-4" /> Edit Business Setup</Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <OvCard icon={Building2} title="Company Information">
            <OvRow k="Company" v={c.name} />
            <OvRow k="Legal Name" v={c.legalName} />
            <OvRow k="Industry" v={c.industry} />
            <OvRow k="GSTIN" v={c.gst} />
            <OvRow k="PAN" v={c.pan} />
            <OvRow k="Phone" v={c.phone} />
            <OvRow k="Email" v={c.email} />
            <OvRow k="Address" v={[c.address, c.city, c.state, c.pincode].filter(Boolean).join(", ")} />
          </OvCard>

          <OvCard icon={Contact} title="Primary Contact">
            <OvRow k="Name" v={data.contacts.primary.name} />
            <OvRow k="Mobile" v={data.contacts.primary.mobile} />
            <OvRow k="Email" v={data.contacts.primary.email} />
            <OvRow k="Designation" v={data.contacts.primary.designation} />
          </OvCard>

          <OvCard icon={ReceiptText} title="GST & Tax">
            <OvRow k="Registration" v={data.gst.regType} />
            <OvRow k="GSTIN" v={data.gst.gstin} />
            <OvRow k="State Code" v={data.gst.stateCode} />
            <OvRow k="Filing" v={data.gst.frequency} />
            <OvRow k="E-Invoice / E-Way" v={`${data.flags.gstEinvoice ? "On" : "Off"} / ${data.flags.gstEway ? "On" : "Off"}`} />
          </OvCard>

          <OvCard icon={Landmark} title="Financial">
            <OvRow k="Currency" v={data.finance.currency} />
            <OvRow k="Method" v={data.finance.method} />
            <OvRow k="FY Start" v={data.finance.fyStart} />
            <OvRow k="Bank Accounts" v={String(data.banks.length)} />
          </OvCard>

          <OvCard icon={GitBranch} title="Locations">
            <OvRow k="Branches" v={String(data.branches.length)} />
            <OvRow k="Warehouses" v={String(data.warehouses.length)} />
            <OvRow k="Organization" v={data.org.type} />
          </OvCard>

          <OvCard icon={Blocks} title="Enabled Modules">
            {modules.length ? (
              <div className="flex flex-wrap gap-1.5">{modules.map((m) => <Badge key={m} tone="neutral">{m}</Badge>)}</div>
            ) : (
              <p className="text-sm text-subtle">No modules enabled</p>
            )}
          </OvCard>
        </div>

        <p className="mt-5 rounded-lg bg-info-subtle p-3 text-xs text-info">
          Branch Setup, POS Configuration, Notifications &amp; User Roles are now managed from their own menus under System.
        </p>
      </div>
    </div>
  );
}

function OvCard({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon className="h-4 w-4" /></span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function OvRow({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{k}</span>
      <span className="truncate text-right font-medium text-foreground">{v || "—"}</span>
    </div>
  );
}

/* =================================================== mode selection ===== */

const MODE_ICONS: Record<SetupMode, typeof Zap> = {
  quick: Zap,
  standard: Settings2,
  advanced: Building,
};

function ModeSelection({ onSelect }: { onSelect: (m: SetupMode) => void }) {
  const [selected, setSelected] = useState<SetupMode>("standard");
  const brand = useBrand();

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--app-bg, var(--color-background))" }}
    >
      <TopBar />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-4xl">
          <div className="mb-8 text-center">
            <Badge tone="primary" className="mb-3">
              Welcome to {brand.productName || DEFAULT_PRODUCT_NAME}
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              How would you like to set up your business?
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
              Choose a setup mode. You can always change configuration later from
              Settings.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {MODES.map((m) => {
              const Icon = MODE_ICONS[m.id];
              const active = selected === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m.id)}
                  className={cn(
                    "relative flex flex-col rounded-2xl border p-5 text-left transition",
                    active
                      ? "border-primary bg-primary-subtle/40 shadow-md ring-1 ring-primary"
                      : "border-border bg-card hover:border-border-strong hover:shadow-sm"
                  )}
                >
                  {m.badge && (
                    <span className="absolute right-4 top-4">
                      <Badge tone="success">{m.badge}</Badge>
                    </span>
                  )}
                  <span
                    className={cn(
                      "grid h-12 w-12 place-items-center rounded-xl",
                      active ? "bg-brand-gradient text-white" : "bg-surface-2 text-primary"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-foreground">
                    {m.name}
                  </h3>
                  <p className="text-xs text-muted">{m.tagline}</p>
                  <ul className="mt-4 space-y-2">
                    {m.points.map((p) => (
                      <li
                        key={p}
                        className="flex items-start gap-2 text-xs text-foreground"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-4 text-2xs font-semibold uppercase tracking-wide text-subtle">
                    {m.minutes}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            <Button size="lg" onClick={() => onSelect(selected)}>
              Continue with {MODES.find((m) => m.id === selected)?.name}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================== wizard ===== */

function Wizard({ onComplete }: { onComplete: () => void }) {
  const {
    mode,
    steps,
    stepIndex,
    current,
    progress,
    isFirst,
    isLast,
    goNext,
    goBack,
    goTo,
    completed,
    data,
    applyErrors,
  } = useSetup();
  const [savedAt, setSavedAt] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const meta = STEPS.find((s) => s.id === current);
  const stepNo = stepIndex + 1;

  function buildPayload(status: "draft" | "completed") {
    return {
      mode,
      status,
      currentStep: stepIndex,
      company: data.company,
      profile: data.profile,
      org: data.org,
      finance: data.finance,
      gst: data.gst,
      admin: data.admin,
      contacts: data.contacts,
      workingDays: data.workingDays,
      branches: data.branches,
      warehouses: data.warehouses,
      banks: data.banks,
      users: data.users,
      inventoryValuation: data.inventoryValuation,
      paymentDefault: data.paymentDefault,
      migrationSource: data.migrationSource,
      industrySelected: data.industrySelected,
      toggles: data.toggles,
      flags: data.flags,
    };
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    setActionError("");
    try {
      const res = await fetch("/api/company-setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("draft")),
      });
      if (res.ok) {
        setSavedAt(true);
        window.setTimeout(() => setSavedAt(false), 2000);
      } else {
        const j = await res.json().catch(() => ({}));
        setActionError(j?.message || "Could not save draft.");
      }
    } catch {
      setActionError("Network error — could not save draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    setActionError("");
    try {
      const res = await fetch("/api/company-setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("completed")),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        onComplete();
        return;
      }
      // Surface server validation errors and jump to the offending step.
      if (j?.errors) {
        applyErrors(j.errors);
        if (j.step) {
          const i = steps.indexOf(j.step);
          if (i >= 0) goTo(i);
        }
      }
      setActionError(j?.message || "Please complete the required fields.");
    } catch {
      setActionError("Network error — could not complete setup.");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--app-bg, var(--color-background))" }}
    >
      <TopBar mode={mode} />

      <div className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 lg:px-6">
        {/* Top horizontal stepper flow */}
        <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex min-w-max items-center">
            {steps.map((id, i) => {
              const m = STEPS.find((s) => s.id === id)!;
              const done = i < stepIndex;
              const active = i === stepIndex;
              const reachable = i <= Math.max(stepIndex, ...Array.from(completed), 0) + 1;
              return (
                <div key={id} className="flex items-center">
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => goTo(i)}
                    className={cn("flex items-center gap-2.5 rounded-lg px-1 py-1 text-left transition", !reachable && "cursor-not-allowed opacity-55")}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition",
                        active ? "text-white shadow ring-4 ring-primary/15" : done ? "bg-success text-white" : "border-2 border-border-strong bg-surface text-subtle"
                      )}
                      style={active ? { backgroundImage: "var(--gradient-brand)" } : undefined}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="hidden sm:block">
                      <span className={cn("block text-xs font-semibold leading-tight", active ? "text-primary" : done ? "text-foreground" : "text-muted")}>{m.title}</span>
                      <span className={cn("block text-2xs leading-tight", active ? "text-primary/70" : done ? "text-success" : "text-subtle")}>
                        {done ? "Completed" : active ? "In Progress" : `Step ${i + 1}`}
                      </span>
                    </span>
                  </button>
                  {i < steps.length - 1 && <span className={cn("mx-2 h-px w-5 shrink-0 sm:w-8", done ? "bg-success" : "bg-border")} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body + right panel */}
        <div className="mt-5 grid gap-6 pb-28 xl:grid-cols-[1fr_288px]">
          <main className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {/* Gradient-tinted step header */}
              <div className="flex items-center gap-4 border-b border-border bg-gradient-to-r from-primary/[0.08] via-secondary/[0.04] to-transparent px-5 py-4 sm:px-6 sm:py-5">
                {meta && (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-md">
                    <meta.icon className="h-[22px] w-[22px]" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Step {stepNo} of {steps.length}</p>
                  <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{meta?.title}</h2>
                  <p className="mt-0.5 hidden text-sm text-muted sm:block">{current && STEP_DESCRIPTIONS[current]}</p>
                </div>
                <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted md:flex">{progress}% complete</span>
              </div>
              <div className="p-5 sm:p-6">
                {current === "review" ? <ReviewStep /> : current && <StepBody stepId={current} />}
              </div>
            </div>
          </main>

          {/* Right summary panel */}
          <aside className="hidden space-y-4 xl:block">
            <div className="sticky top-6 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Setup Summary</p>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow-sm">
                  {(data.company.name || "ONE").charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{data.company.name || "Your Company"}</p>
                  <p className="text-2xs text-subtle">{data.company.industry || "Set up your business"}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
                <div className="flex items-center justify-between"><span className="text-muted">Mode</span><span className="font-medium capitalize text-foreground">{mode}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Branches</span><span className="font-medium text-foreground">{data.branches.length}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Users</span><span className="font-medium text-foreground">{data.users.length + 1}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Step</span><span className="font-medium text-foreground">{stepNo} / {steps.length}</span></div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Tips
              </p>
              <ul className="space-y-2 text-2xs text-muted">
                <li className="flex items-start gap-1.5"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> You can <strong className="text-foreground">Save Draft</strong> anytime and resume later.</li>
                <li className="flex items-start gap-1.5"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> Required fields are marked with *.</li>
                <li className="flex items-start gap-1.5"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> Everything here is editable later from Settings.</li>
              </ul>
            </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer nav */}
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <Button variant="ghost" size="md" onClick={goBack} disabled={isFirst}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-3">
            {actionError && (
              <span className="hidden items-center gap-1 text-xs font-medium text-danger sm:flex">
                <AlertCircle className="h-4 w-4" />
                {actionError}
              </span>
            )}
            {savedAt && !actionError && (
              <span className="hidden items-center gap-1 text-xs font-medium text-success sm:flex">
                <CheckCircle2 className="h-4 w-4" />
                Draft saved to your account
              </span>
            )}
            <Button variant="outline" size="md" onClick={handleSaveDraft} disabled={savingDraft || completing}>
              <Save className="h-4 w-4" />
              {savingDraft ? "Saving…" : "Save Draft"}
            </Button>
            {isLast ? (
              <Button size="md" onClick={handleComplete} disabled={completing}>
                <Check className="h-4 w-4" />
                {completing ? "Completing…" : "Complete Setup"}
              </Button>
            ) : (
              <Button size="md" onClick={goNext}>
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------- progress rail - */

function ProgressRail({
  steps,
  stepIndex,
  completed,
  onJump,
  progress,
}: {
  steps: string[];
  stepIndex: number;
  completed: Set<number>;
  onJump: (i: number) => void;
  progress: number;
}) {
  const items = steps.map((id, i) => ({ i, meta: STEPS.find((s) => s.id === id)! }));
  const reachableMax = Math.max(stepIndex, ...Array.from(completed), 0) + 1;

  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-6 space-y-3">
        {/* Progress summary */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div
            className="px-5 py-4 text-white"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">
              Setup Progress
            </p>
            <div className="mt-1 flex items-end justify-between">
              <span className="text-3xl font-bold leading-none">{progress}%</span>
              <span className="text-xs text-white/80">
                {stepIndex + 1} of {steps.length}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="relative">
            {items.map(({ i, meta }, idx) => {
              const isDone = completed.has(i) && i !== stepIndex;
              const isActive = i === stepIndex;
              const reachable = i <= reachableMax;
              return (
                <button
                  key={meta.id}
                  type="button"
                  disabled={!reachable}
                  onClick={() => onJump(i)}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition",
                    isActive
                      ? "bg-primary-subtle"
                      : reachable
                      ? "hover:bg-surface-2"
                      : "cursor-not-allowed opacity-55"
                  )}
                >
                  {idx < items.length - 1 && (
                    <span
                      className={cn(
                        "absolute left-[21px] top-8 h-[calc(100%-12px)] w-0.5",
                        isDone ? "bg-success" : "bg-border"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-2xs font-bold transition",
                      isActive
                        ? "text-white shadow ring-4 ring-primary/15"
                        : isDone
                        ? "bg-success text-white"
                        : "border-2 border-border-strong bg-surface text-subtle"
                    )}
                    style={isActive ? { backgroundImage: "var(--gradient-brand)" } : undefined}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      isActive
                        ? "font-semibold text-primary"
                        : isDone
                        ? "text-foreground"
                        : "text-muted"
                    )}
                  >
                    {meta.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------- top bar -- */

function TopBar({ mode }: { mode?: SetupMode | null }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <Logo />
        <span className="hidden h-5 w-px bg-border sm:block" />
        <span className="hidden text-sm font-medium text-muted sm:block">
          Business Setup
        </span>
        {mode && (
          <Badge tone="primary" className="capitalize">
            {mode} mode
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted transition hover:bg-surface-2 sm:flex">
          <CircleHelp className="h-4 w-4" />
          Help
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted transition hover:bg-surface-2"
        >
          <LogOut className="h-4 w-4" />
          Exit
        </Link>
      </div>
    </header>
  );
}
