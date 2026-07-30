"use client";

import { useEffect, useState } from "react";
import { Settings2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { DIMENSIONS, TARGET_TYPES, PERIODS, DISTRIBUTIONS, MONTH_LABELS, type TargetConfig as Cfg } from "@/lib/contracts/salesTarget";
import { fetchJson } from "./shared";
import { Head, Section } from "./TargetApproval";

export function TargetConfig() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetchJson<{ ok: boolean; config: Cfg }>("/api/sales/target/config").then((j) => j.ok && setCfg(j.config)); }, []);
  const set = (patch: Partial<Cfg>) => setCfg((c) => (c ? { ...c, ...patch } : c));
  const toggle = (key: keyof Cfg, val: string) => { if (!cfg) return; const arr = cfg[key] as string[]; set({ [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] } as Partial<Cfg>); };
  const save = async () => { if (!cfg) return; setBusy(true); await fetchJson("/api/sales/target/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(cfg) }); setBusy(false); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  if (!cfg) return <div className="p-10"><AppLoader label="Loading configuration…" /></div>;
  const Chk = ({ k, items }: { k: keyof Cfg; items: { key: string; label: string }[] }) => (
    <div className="flex flex-wrap gap-2">{items.map((it) => { const on = (cfg[k] as string[]).includes(it.key); return <button key={it.key} onClick={() => toggle(k, it.key)} className={`rounded-full border px-2.5 py-1 text-2xs font-semibold transition ${on ? "border-primary bg-primary text-white" : "border-border bg-surface text-muted hover:border-primary/40"}`}>{it.label}</button>; })}</div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Head icon={Settings2} title="Sales Target Configuration" sub="Everything is config-driven — enable dimensions, types, periods, approval & scoring rules." />
        <Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {saved ? "Saved" : "Save"}</Button>
      </div>

      <Section title="Enabled Dimensions"><div className="p-4"><Chk k="dimensionsEnabled" items={DIMENSIONS} /></div></Section>
      <Section title="Enabled Target Types"><div className="p-4"><Chk k="targetTypesEnabled" items={TARGET_TYPES} /></div></Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Enabled Periods"><div className="p-4"><Chk k="periodsEnabled" items={PERIODS.map((p) => ({ key: p.key, label: p.label }))} /></div></Section>
        <Section title="Enabled Distributions"><div className="p-4"><Chk k="distributionsEnabled" items={DISTRIBUTIONS.map((d) => ({ key: d.key, label: d.label }))} /></div></Section>
      </div>

      <Section title="Approval Workflow">
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.approvalEnabled} onChange={(e) => set({ approvalEnabled: e.target.checked })} /> Approval required</label>
          <Field label="Approval Threshold (₹)"><input type="number" value={cfg.approvalThreshold} onChange={(e) => set({ approvalThreshold: Number(e.target.value) })} className={inp} /></Field>
          <Field label="Approver Role"><input value={cfg.approverRole} onChange={(e) => set({ approverRole: e.target.value })} className={inp} /></Field>
        </div>
      </Section>

      <Section title="Traffic-Light Thresholds (% achievement)">
        <div className="grid gap-3 p-4 sm:grid-cols-4">
          {(["green", "blue", "yellow", "orange"] as const).map((k) => <Field key={k} label={`${k} ≥`}><input type="number" value={cfg.trafficLight[k]} onChange={(e) => set({ trafficLight: { ...cfg.trafficLight, [k]: Number(e.target.value) } })} className={inp} /></Field>)}
        </div>
      </Section>

      <Section title="Seasonal Weights (Apr → Mar)">
        <div className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-6 lg:grid-cols-12">
          {MONTH_LABELS.map((m, i) => <Field key={m} label={m}><input type="number" value={cfg.seasonalWeights[i]} onChange={(e) => { const w = [...cfg.seasonalWeights]; w[i] = Number(e.target.value); set({ seasonalWeights: w }); }} className={inp} /></Field>)}
        </div>
      </Section>

      <Section title="Notifications & Numbering">
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Field label="Alert when achievement below (%)"><input type="number" value={cfg.notifyBelowThresholdPct} onChange={(e) => set({ notifyBelowThresholdPct: Number(e.target.value) })} className={inp} /></Field>
          <Field label="Number Prefix"><input value={cfg.numberPrefix} onChange={(e) => set({ numberPrefix: e.target.value })} className={inp} /></Field>
          <Field label="Number Padding"><input type="number" value={cfg.numberPadding} onChange={(e) => set({ numberPadding: Number(e.target.value) })} className={inp} /></Field>
        </div>
      </Section>
    </div>
  );
}
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex flex-col gap-1"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</span>{children}</label>; }
