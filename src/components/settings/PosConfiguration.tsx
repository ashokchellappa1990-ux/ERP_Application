"use client";

import { useEffect, useState } from "react";
import { Receipt, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  clonePosConfig, applyPosConfig, mergePosConfig, TAX_METHOD_OPTIONS, type PosConfigState,
} from "@/lib/settings/posConfigStore";

export function PosConfiguration({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const [cfg, setCfg] = useState<PosConfigState>(() => clonePosConfig());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load this tenant's persisted POS configuration.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const j = await fetch("/api/settings/pos", { cache: "no-store" }).then((r) => r.json());
        if (active && j.ok && j.config) setCfg(mergePosConfig(j.config));
      } catch { /* keep defaults */ }
    })();
    return () => { active = false; };
  }, []);

  const setField = (k: "taxMethod", v: string) => setCfg((c) => ({ ...c, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const j = await fetch("/api/settings/pos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) }).then((r) => r.json());
      if (j.ok) {
        applyPosConfig(cfg); setSaved(true); window.setTimeout(() => setSaved(false), 1600);
        toast.success(j.message || "POS configuration saved.");
      } else {
        toast.error(j.message || "Could not save POS configuration.");
      }
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      {embedded ? (
        <div className="flex justify-end">
          <Button size="md" onClick={save} disabled={saving}><CheckCircle2 className="h-4 w-4" /> {saving ? "Saving…" : "Save Configuration"}</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Tax Configuration</span></div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Receipt className="h-5 w-5 text-primary" /> Tax Configuration</h1>
            <p className="mt-0.5 text-sm text-muted">How the POS interprets the selling price against GST.</p>
          </div>
          <Button size="md" onClick={save} disabled={saving}><CheckCircle2 className="h-4 w-4" /> {saving ? "Saving…" : "Save Configuration"}</Button>
        </div>
      )}

      {/* Tax */}
      <SectionCard icon={Receipt} title="Tax Configuration">
        <div className="max-w-md">
          <label className="mb-1 block text-2xs font-semibold text-muted">Tax Treatment (Price ⇄ GST)</label>
          <select value={cfg.taxMethod} onChange={(e) => setField("taxMethod", e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:bg-surface focus:outline-none">
            {TAX_METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="mt-2 text-2xs text-muted">
            {cfg.taxMethod === "exclusive"
              ? "Exclusive: the selling price is the taxable base and GST is added on top — e.g. ₹350 @12% → tax ₹42.00 → total ₹392.00."
              : "Inclusive: the selling price already contains GST, which is back-calculated — e.g. ₹350 @12% → taxable ₹312.50, tax ₹37.50 → total ₹350.00."}
          </p>
        </div>
      </SectionCard>

      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info"><Receipt className="mr-1 inline h-3.5 w-3.5" />The tax treatment drives how the POS Billing screen and GRN selling price interpret GST against the price.</p>

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">Tax configuration saved</p><p className="text-2xs text-muted">Applied to billing &amp; GRN.</p>
          </div>
        </div>
      )}
    </div>
  );
}

