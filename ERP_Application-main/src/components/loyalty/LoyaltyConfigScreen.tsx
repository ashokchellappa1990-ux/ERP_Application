"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { CONFIG_PAGES, LOYALTY_FEATURES, LOYALTY_GUIDES, type CfgField } from "@/lib/loyalty/loyaltyData";
import { LoyaltyGuide } from "./LoyaltyGuide";
import { DEFAULT_LOYALTY_CONFIG } from "@/lib/loyalty/loyaltyConfig";
import { cn } from "@/lib/cn";

export function LoyaltyConfigScreen({ pageKey }: { pageKey: string }) {
  const page = CONFIG_PAGES[pageKey];
  const Icon = LOYALTY_FEATURES.find((f) => f.key === pageKey)?.icon ?? Settings2;
  const [flags, setFlags] = useState<Record<string, boolean>>(() => ({ ...DEFAULT_LOYALTY_CONFIG.flags }));
  const [fields, setFields] = useState<Record<string, string>>(() => ({ ...DEFAULT_LOYALTY_CONFIG.fields }));
  const [saved, setSaved] = useState(false);

  if (!page) return <div className="p-6 text-sm text-muted">Unknown configuration.</div>;

  function save() {
    Object.assign(DEFAULT_LOYALTY_CONFIG.flags, flags);
    Object.assign(DEFAULT_LOYALTY_CONFIG.fields, fields);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  const renderField = (f: CfgField) => {
    if (f.type === "toggle") return (
      <label key={f.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
        <span><span className="block text-sm font-medium text-foreground">{f.label}</span>{f.desc && <span className="text-2xs text-muted">{f.desc}</span>}</span>
        <Switch checked={!!flags[f.key]} onChange={(v) => setFlags((s) => ({ ...s, [f.key]: v }))} aria-label={f.label} />
      </label>
    );
    return (
      <div key={f.key}>
        <label className="mb-1 block text-2xs font-semibold text-muted">{f.label}</label>
        {f.type === "select"
          ? <select value={fields[f.key] ?? ""} onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm capitalize text-foreground focus:border-primary focus:outline-none">{f.options?.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select>
          : <input type={f.type} value={fields[f.key] ?? ""} onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:bg-surface focus:outline-none" />}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/loyalty" className="hover:text-foreground">Loyalty</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{page.title}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> {page.title}</h1>
          <p className="mt-0.5 text-sm text-muted">{page.intro}</p>
        </div>
        <Button size="md" onClick={save}><CheckCircle2 className="h-4 w-4" /> Save Configuration</Button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5 text-xs font-semibold text-primary">
        <Settings2 className="h-4 w-4" /> Applied in real-time at billing across POS, Sales &amp; Mobile.
      </div>

      <LoyaltyGuide guide={LOYALTY_GUIDES[pageKey]} />

      {page.sections.map((sec) => (
        <div key={sec.heading} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2.5"><span className="h-4 w-1 rounded-full bg-brand-gradient" /><h2 className="text-sm font-semibold text-foreground">{sec.heading}</h2></div>
          <div className={cn("grid gap-3", sec.fields.every((f) => f.type === "toggle") ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3")}>{sec.fields.map(renderField)}</div>
        </div>
      ))}

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">Configuration saved</p><p className="text-2xs text-muted">Loyalty engine updated.</p>
          </div>
        </div>
      )}
    </div>
  );
}
