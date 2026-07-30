"use client";

import { useState } from "react";
import { Palette, Check, RotateCcw, Save, CheckCircle2, Sparkles, SquareMousePointer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { useTheme } from "@/components/theme/ThemeProvider";
import { SettingsScopeBanner } from "@/components/scope/SettingsScopeBanner";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/cn";

const OASYS = { primaryColor: "#1B75BC", secondaryColor: "#7AB317", accentColor: "#F5A623" };
const ANGLES: { deg: number; label: string }[] = [
  { deg: 90, label: "→" }, { deg: 135, label: "↘" }, { deg: 180, label: "↓" }, { deg: 45, label: "↗" },
];

export default function ApplicationThemePage() {
  const { theme, density, brand, setTheme, setDensity, setBrand } = useTheme();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const meta = THEMES.find((t) => t.id === theme);
  const eff = (key: "primaryColor" | "secondaryColor" | "accentColor", idx: 0 | 1 | 2) => brand[key] || meta?.swatch[idx] || "#000000";
  const buttonStyle = brand.buttonStyle ?? "gradient";
  const gradientAngle = brand.gradientAngle ?? 135;
  const gradFrom = brand.gradientFrom || eff("primaryColor", 0);
  const gradTo = brand.gradientTo || eff("secondaryColor", 1);

  async function save() {
    setSaving(true);
    try {
      // Persist the EFFECTIVE colours shown in the pickers (what-you-see-is-what-you-save).
      // Previously we sent the raw override, which is undefined for a colour left on the
      // preset → stored as null → on reload that colour silently reverted to the preset
      // while the others stuck (most visibly the Primary colour). Saving the effective
      // value guarantees the stored colour always matches what the user sees.
      const p = eff("primaryColor", 0), s = eff("secondaryColor", 1), a = eff("accentColor", 2);
      const j = await fetch("/api/settings/theme", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme, density,
          primaryColor: p, secondaryColor: s, accentColor: a,
          buttonStyle, gradientFrom: gradFrom, gradientTo: gradTo, gradientAngle,
        }),
      }).then((r) => r.json());
      if (j.ok) {
        // Lock the effective colours in as explicit overrides so live state, localStorage
        // and the DB all agree — no colour can drift back to the preset on the next load.
        setBrand({ primaryColor: p, secondaryColor: s, accentColor: a });
        setSaved(true); window.setTimeout(() => setSaved(false), 2000);
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Application Theme</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Palette className="h-5 w-5 text-primary" /> Application Theme</h1>
          <p className="mt-0.5 text-sm text-muted">Pick a colour theme or set your own brand colours. Changes preview live and are saved per business.</p>
        </div>
        <Button size="md" onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Theme"}{saved && <CheckCircle2 className="h-4 w-4" />}</Button>
      </div>

      <SettingsScopeBanner />

      {/* Presets */}
      <SectionCard icon={Sparkles} title="Theme Presets">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => { setTheme(t.id); setBrand({ primaryColor: undefined, secondaryColor: undefined, accentColor: undefined, gradientFrom: undefined, gradientTo: undefined }); }} className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition", theme === t.id ? "border-primary bg-primary-subtle/40 ring-2 ring-primary/20" : "border-border bg-surface hover:border-primary/40")}>
              <span className="flex shrink-0 gap-1">{t.swatch.map((c, i) => <span key={i} className="h-9 w-4 rounded-full border border-black/10" style={{ background: c }} />)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">{t.name}{t.id === "oasys" && <Badge tone="primary">Brand</Badge>}{theme === t.id && <Check className="h-3.5 w-3.5 text-primary" />}</span>
                <span className="mt-0.5 block text-2xs text-muted">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Custom brand colours */}
      <SectionCard icon={Palette} title="Brand Colours (override the preset)"
        action={<button onClick={() => setBrand({ primaryColor: undefined, secondaryColor: undefined, accentColor: undefined, gradientFrom: undefined, gradientTo: undefined })} className="inline-flex items-center gap-1 text-2xs font-semibold text-muted hover:text-primary"><RotateCcw className="h-3.5 w-3.5" /> Reset to preset</button>}>
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField label="Primary" value={eff("primaryColor", 0)} onChange={(v) => setBrand({ primaryColor: v })} />
          <ColorField label="Secondary" value={eff("secondaryColor", 1)} onChange={(v) => setBrand({ secondaryColor: v })} />
          <ColorField label="Accent" value={eff("accentColor", 2)} onChange={(v) => setBrand({ accentColor: v })} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { setTheme("oasys"); setBrand({ primaryColor: undefined, secondaryColor: undefined, accentColor: undefined }); }}>Use OASYS theme</Button>
          <Button size="sm" variant="ghost" onClick={() => setBrand(OASYS)}>Apply OASYS colours only</Button>
          <span className="text-2xs text-muted">Overrides apply on top of the selected preset.</span>
        </div>
      </SectionCard>

      {/* Density */}
      <SectionCard icon={Sparkles} title="Density">
        <div className="inline-flex overflow-hidden rounded-lg border border-border text-sm">
          {(["comfortable", "touch"] as const).map((d) => (
            <button key={d} onClick={() => setDensity(d)} className={cn("px-4 py-2 font-semibold capitalize transition", density === d ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2")}>{d}{d === "touch" ? " (POS)" : ""}</button>
          ))}
        </div>
      </SectionCard>

      {/* Button style & gradient */}
      <SectionCard icon={SquareMousePointer} title="Button Style & Gradient"
        action={brand.buttonStyle || brand.gradientFrom || brand.gradientTo || brand.gradientAngle != null
          ? <button onClick={() => setBrand({ buttonStyle: undefined, gradientFrom: undefined, gradientTo: undefined, gradientAngle: undefined })} className="inline-flex items-center gap-1 text-2xs font-semibold text-muted hover:text-primary"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
          : undefined}>
        <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
          <div className="space-y-4">
            {/* Fill style */}
            <div>
              <label className="mb-1.5 block text-2xs font-semibold text-muted">Primary Button Fill</label>
              <div className="inline-flex overflow-hidden rounded-lg border border-border text-sm">
                {(["gradient", "solid"] as const).map((s) => (
                  <button key={s} onClick={() => setBrand({ buttonStyle: s })} className={cn("px-4 py-2 font-semibold capitalize transition", buttonStyle === s ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2")}>{s}</button>
                ))}
              </div>
            </div>
            {/* Direction — gradient only */}
            <div className={cn("transition", buttonStyle === "solid" && "pointer-events-none opacity-40")}>
              <label className="mb-1.5 block text-2xs font-semibold text-muted">Gradient Direction</label>
              <div className="inline-flex overflow-hidden rounded-lg border border-border text-sm">
                {ANGLES.map((a) => (
                  <button key={a.deg} onClick={() => setBrand({ gradientAngle: a.deg })} className={cn("px-3.5 py-2 font-semibold transition", gradientAngle === a.deg ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2")} title={`${a.deg}°`}>{a.label}</button>
                ))}
              </div>
            </div>
          </div>
          {/* Gradient endpoints — gradient only */}
          <div className={cn("grid gap-4 sm:grid-cols-2", buttonStyle === "solid" && "pointer-events-none opacity-40")}>
            <ColorField label="Gradient Start" value={gradFrom} onChange={(v) => setBrand({ gradientFrom: v })} />
            <ColorField label="Gradient End" value={gradTo} onChange={(v) => setBrand({ gradientTo: v })} />
          </div>
        </div>
        <p className="mt-4 text-2xs text-muted">{buttonStyle === "solid" ? "Primary buttons use a solid Primary colour." : "Primary buttons, active menu & logo use the gradient. Defaults to your Primary → Secondary colours."}</p>
      </SectionCard>

      {/* Live preview */}
      <SectionCard icon={Palette} title="Live Preview">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="md">Primary Button</Button>
          <Button size="md" variant="secondary">Secondary</Button>
          <Button size="md" variant="accent">Accent</Button>
          <Button size="md" variant="outline">Outline</Button>
          <span className="rounded-lg bg-brand-gradient px-3 py-1.5 text-sm font-semibold text-white">Brand Gradient</span>
          <Badge tone="primary">Primary</Badge><Badge tone="success">Success</Badge><Badge tone="warning">Warning</Badge>
          <span className="rounded-md bg-primary-subtle px-2.5 py-1 text-xs font-semibold text-primary">Subtle chip</span>
        </div>
      </SectionCard>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-border bg-surface p-0.5" aria-label={`${label} colour`} />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-28 rounded-md border border-border-strong bg-surface px-2 font-mono text-sm uppercase text-foreground focus:border-primary focus:outline-none" />
      </div>
    </div>
  );
}
