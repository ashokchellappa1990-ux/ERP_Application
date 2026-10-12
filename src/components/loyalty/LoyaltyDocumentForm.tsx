"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings2, CheckCircle2, Save, Award, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LOYALTY_LISTS, LOYALTY_FORM_META, LOYALTY_FEATURES, LOYALTY_GUIDES, loyaltyNotesFor, type LFormField } from "@/lib/loyalty/loyaltyData";
import { LoyaltyGuide } from "./LoyaltyGuide";
import { loyaltyDocNo } from "@/lib/loyalty/loyaltyConfig";
import { cn } from "@/lib/cn";

export function LoyaltyDocumentForm({ featureKey }: { featureKey: string }) {
  const router = useRouter();
  const meta = LOYALTY_FORM_META[featureKey];
  const list = LOYALTY_LISTS[featureKey];
  const feature = LOYALTY_FEATURES.find((f) => f.key === featureKey);
  const Icon = (feature?.icon ?? Award) as LucideIcon;
  const title = list?.title ?? feature?.label ?? "Record";
  const notes = useMemo(() => loyaltyNotesFor(featureKey), [featureKey]);
  const backHref = `/loyalty/${featureKey}`;

  const [docFields, setDocFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  if (!meta || !feature) return <div className="p-6 text-sm text-muted">Unknown loyalty record.</div>;
  const canSave = meta.fields.filter((f) => f.required).every((f) => (docFields[f.key] ?? "").trim() !== "");
  function save() { if (!canSave) return; setSaved(true); window.setTimeout(() => router.push(backHref), 1100); }

  const renderField = (f: LFormField) => (
    <div key={f.key} className={cn(f.full && "sm:col-span-2 lg:col-span-3")}>
      <label className="mb-1 block text-2xs font-semibold text-muted">{f.label}{f.required && <span className="text-danger"> *</span>}</label>
      {f.type === "select"
        ? <select value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:bg-surface focus:outline-none"><option value="">Select…</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        : f.type === "textarea"
          ? <textarea rows={2} value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} placeholder={f.label} className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
          : <input type={f.type} value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} placeholder={f.label} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/loyalty" className="hover:text-foreground">Loyalty</Link><span className="text-subtle">/</span><Link href={backHref} className="hover:text-foreground">{title}</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> New {title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={backHref}><Button variant="ghost" size="md">Cancel</Button></Link>
          <Button variant="outline" size="md" onClick={save} disabled={!canSave}><Save className="h-4 w-4" /> Save Draft</Button>
          <Button size="md" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> {meta.saveLabel}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Loyalty policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <LoyaltyGuide guide={LOYALTY_GUIDES[featureKey]} />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-foreground">{title} Details</p><span className="rounded-md border border-border bg-surface-2 px-2.5 py-1 font-mono text-2xs text-primary">{loyaltyDocNo(meta.prefix, 1)}</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{meta.fields.map(renderField)}</div>
        <div className="mt-4 flex justify-end"><Button size="md" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> {meta.saveLabel}</Button></div>
        {!canSave && <p className="mt-2 text-right text-2xs font-medium text-danger">Fill the required fields.</p>}
      </div>

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">{title} saved</p><p className="text-2xs text-muted">Redirecting…</p>
          </div>
        </div>
      )}
    </div>
  );
}
