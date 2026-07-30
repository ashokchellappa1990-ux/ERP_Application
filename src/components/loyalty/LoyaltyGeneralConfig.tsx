"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, Loader2, Power, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { LoyaltySettingDTO } from "@/lib/contracts/loyalty";

export function LoyaltyGeneralConfig() {
  const toast = useToast();
  const [data, setData] = useState<LoyaltySettingDTO | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [defaultProgramId, setDefaultProgramId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const j = await fetch("/api/loyalty/settings", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) { setData(j); setEnabled(j.enabled); setDefaultProgramId(j.defaultProgramId ?? null); }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const j = await fetch("/api/loyalty/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, defaultProgramId }) }).then((r) => r.json()).catch(() => ({}));
    toast.result(j, "Loyalty configuration saved.", "Could not save configuration.");
    setSaving(false);
  }

  if (loading) return <div className="py-20"><AppLoader label="Loading…" /></div>;
  const programs = data?.programs ?? [];
  const activePrograms = programs.filter((p) => p.status === "Active");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Loyalty</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Configuration</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><SlidersHorizontal className="h-5 w-5 text-primary" /> Loyalty Configuration</h1>
          <p className="mt-0.5 text-sm text-muted">Master switch for the loyalty engine + the default program applied at billing.</p>
        </div>
        <Button size="md" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save</Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><Power className={cn("h-4 w-4", enabled ? "text-success" : "text-muted")} /> Enable Loyalty Program</span>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-primary" />
        </label>

        <div className="max-w-md">
          <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-subtle">Default Loyalty Program</label>
          <select value={defaultProgramId ?? ""} onChange={(e) => setDefaultProgramId(e.target.value ? Number(e.target.value) : null)} disabled={!enabled} className={cn("h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none", !enabled && "opacity-60")}>
            <option value="">Highest-priority active program</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}{p.status !== "Active" ? ` (${p.status})` : ""}</option>)}
          </select>
          <p className="mt-1 text-2xs text-muted">If unset, the engine picks the highest-priority Active program matching the sale's scope &amp; channel.</p>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-primary-subtle/40 p-3 text-xs text-foreground">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          {activePrograms.length === 0
            ? <span>No <strong>Active</strong> program yet — create one in <Link href="/loyalty/program/new" className="font-semibold text-primary hover:underline">Loyalty Program Master</Link> and set its status to Active. Per-program earn/redeem/validity/eligibility rules live there.</span>
            : <span>{activePrograms.length} active program(s). Earn/redeem/validity/eligibility rules are configured per program in <Link href="/loyalty/program" className="font-semibold text-primary hover:underline">Loyalty Program Master</Link>.</span>}
        </div>
        <div className="flex flex-wrap gap-2">{programs.map((p) => <Badge key={p.id} tone={p.status === "Active" ? "success" : "neutral"}>{p.code}</Badge>)}</div>
      </div>
    </div>
  );
}
