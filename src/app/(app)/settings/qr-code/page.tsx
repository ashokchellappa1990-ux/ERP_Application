"use client";

import { useEffect, useMemo, useState } from "react";
import { QrCode as QrCodeIcon, Save, Hash, Palette, LayoutGrid, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SettingsScopeBanner } from "@/components/scope/SettingsScopeBanner";
import { Switch } from "@/components/ui/Switch";
import { QrCode } from "@/components/ui/QrCode";
import { sampleQrCode } from "@/lib/qr/codeFormat";
import type { QrStyle, QrEc } from "@/lib/masters/qr";
import { cn } from "@/lib/cn";

interface QrForm {
  prefix: string; separator: string;
  includeDocRef: boolean; includeProductCode: boolean; includeSequence: boolean;
  sequenceLength: number; nextSequence: number;
  errorCorrection: QrEc; darkColor: string; lightColor: string; moduleStyle: QrStyle;
  labelWidthMm: number; labelHeightMm: number;
  showName: boolean; showPrice: boolean; showCodeText: boolean;
  defaultMode: "shared" | "unique";
}

const DEFAULTS: QrForm = {
  prefix: "QR", separator: "-", includeDocRef: true, includeProductCode: true, includeSequence: true,
  sequenceLength: 4, nextSequence: 1, errorCorrection: "M", darkColor: "#0f172a", lightColor: "#ffffff",
  moduleStyle: "square", labelWidthMm: 50, labelHeightMm: 30, showName: true, showPrice: true, showCodeText: true,
  defaultMode: "shared",
};

const STYLES: { v: QrStyle; label: string }[] = [{ v: "square", label: "Square" }, { v: "dots", label: "Dots" }, { v: "rounded", label: "Rounded" }];
const ECS: { v: QrEc; label: string }[] = [{ v: "L", label: "Low (7%)" }, { v: "M", label: "Medium (15%)" }, { v: "Q", label: "Quartile (25%)" }, { v: "H", label: "High (30%)" }];

export default function QrCodeSettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState<QrForm>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings/qr-code", { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (j.ok) setForm({ ...DEFAULTS, ...j.settings });
      } catch { /* defaults */ } finally { setLoading(false); }
    })();
  }, []);

  const set = <K extends keyof QrForm>(k: K, v: QrForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const sample = useMemo(() => sampleQrCode(form), [form]);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/settings/qr-code", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json().catch(() => ({}));
      if (j.ok) {
        setSaved(true); window.setTimeout(() => setSaved(false), 2500); if (j.settings) setForm({ ...DEFAULTS, ...j.settings });
        toast.success(j.message || "QR code settings saved.");
      } else {
        toast.error(j.message || "Could not save QR code settings.");
      }
    } catch {
      toast.error("Could not reach the server. Please try again.");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <SettingsScopeBanner />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">QR Code Settings</span></div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">QR Code Settings</h1>
          <p className="mt-0.5 text-sm text-muted">Define how QR reference numbers are formed, how codes look, and the label layout used when printing.</p>
        </div>
        <Button size="md" onClick={save} disabled={saving || loading}>
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Settings"}
          {saved && <CheckCircle2 className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Config */}
        <div className="space-y-5">
          {/* Number formation */}
          <Section icon={Hash} title="Number Formation" desc="Compose the QR reference number from these segments.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Prefix" value={form.prefix} onChange={(v) => set("prefix", v)} placeholder="QR" />
              <Text label="Separator" value={form.separator} onChange={(v) => set("separator", v)} placeholder="-" />
            </div>
            <div className="mt-3 space-y-2.5">
              <Toggle label="Include document reference" hint="e.g. OPN-00007" checked={form.includeDocRef} onChange={(v) => set("includeDocRef", v)} />
              <Toggle label="Include product code / SKU" hint="e.g. JEAN-30" checked={form.includeProductCode} onChange={(v) => set("includeProductCode", v)} />
              <Toggle label="Include running sequence" hint="ensures uniqueness" checked={form.includeSequence} onChange={(v) => set("includeSequence", v)} />
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Num label="Sequence length (padding)" value={form.sequenceLength} min={1} max={10} onChange={(v) => set("sequenceLength", v)} />
              <Num label="Next sequence number" value={form.nextSequence} min={1} max={99999999} onChange={(v) => set("nextSequence", v)} readOnly />
            </div>
          </Section>

          {/* Appearance */}
          <Section icon={Palette} title="QR Appearance" desc="Module shape, colour and error-correction level.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Module style</Label>
                <div className="flex gap-1.5">
                  {STYLES.map((s) => (
                    <button key={s.v} onClick={() => set("moduleStyle", s.v)} className={cn("flex-1 rounded-md border px-2 py-2 text-xs font-semibold transition", form.moduleStyle === s.v ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40")}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Error correction</Label>
                <select value={form.errorCorrection} onChange={(e) => set("errorCorrection", e.target.value as QrEc)} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none">
                  {ECS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
                </select>
              </div>
              <Color label="Dark (modules)" value={form.darkColor} onChange={(v) => set("darkColor", v)} />
              <Color label="Light (background)" value={form.lightColor} onChange={(v) => set("lightColor", v)} />
            </div>
          </Section>

          {/* Label layout */}
          <Section icon={LayoutGrid} title="Label Layout" desc="Sticker size and what prints next to the QR.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Num label="Label width (mm)" value={form.labelWidthMm} min={20} max={150} onChange={(v) => set("labelWidthMm", v)} />
              <Num label="Label height (mm)" value={form.labelHeightMm} min={15} max={150} onChange={(v) => set("labelHeightMm", v)} />
            </div>
            <div className="mt-3 space-y-2.5">
              <Toggle label="Show product name" checked={form.showName} onChange={(v) => set("showName", v)} />
              <Toggle label="Show price (MRP)" checked={form.showPrice} onChange={(v) => set("showPrice", v)} />
              <Toggle label="Show code text under QR" checked={form.showCodeText} onChange={(v) => set("showCodeText", v)} />
            </div>
            <div className="mt-3">
              <Label>Default generation mode</Label>
              <div className="flex gap-1.5">
                <button onClick={() => set("defaultMode", "shared")} className={cn("flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition", form.defaultMode === "shared" ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40")}>Shared (one code / line)</button>
                <button onClick={() => set("defaultMode", "unique")} className={cn("flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition", form.defaultMode === "unique" ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40")}>Unique (per piece)</button>
              </div>
            </div>
          </Section>
        </div>

        {/* Live preview */}
        <div className="space-y-4">
          <div className="sticky top-4 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground"><QrCodeIcon className="h-4 w-4 text-primary" /> Sample Reference Number</div>
              <div className="rounded-lg bg-surface-2 px-3 py-2 text-center font-mono text-sm font-bold text-foreground">{sample}</div>
              <p className="mt-2 text-2xs text-subtle">Format: {[form.prefix, form.includeDocRef && "DOC", form.includeProductCode && "SKU", form.includeSequence && "SEQ"].filter(Boolean).join(` ${form.separator} `)}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground"><LayoutGrid className="h-4 w-4 text-primary" /> Label Preview</div>
              <div className="flex justify-center rounded-lg bg-surface-2 p-4">
                <div className="flex items-center gap-2 rounded border border-dashed border-border-strong bg-white p-2 shadow-sm" style={{ width: `${Math.min(form.labelWidthMm * 3.4, 240)}px`, minHeight: `${form.labelHeightMm * 3.0}px` }}>
                  <QrCode value={sample} size={Math.min(form.labelHeightMm * 2.6, 84)} options={{ dark: form.darkColor, light: form.lightColor, ec: form.errorCorrection, style: form.moduleStyle }} />
                  <div className="min-w-0 flex-1">
                    {form.showName && <div className="truncate text-2xs font-bold text-slate-900">Slim Fit Jeans - 30</div>}
                    {form.showCodeText && <div className="break-all font-mono text-[8px] leading-tight text-slate-600">{sample}</div>}
                    {form.showPrice && <div className="text-2xs font-bold text-slate-900">MRP ₹1999</div>}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-center text-2xs text-subtle">{form.labelWidthMm} × {form.labelHeightMm} mm · {form.moduleStyle} · EC {form.errorCorrection}</p>
            </div>

            {loading && <p className="flex items-center gap-1.5 text-2xs text-subtle"><RefreshCw className="h-3 w-3 animate-spin" /> Loading saved settings…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: typeof Hash; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon className="h-4 w-4" /></span>
        <div><h2 className="text-sm font-bold text-foreground">{title}</h2><p className="text-2xs text-muted">{desc}</p></div>
      </div>
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold text-foreground">{children}</label>;
}
function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div><Label>{label}</Label><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus" /></div>
  );
}
function Num({ label, value, onChange, min, max, readOnly }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; readOnly?: boolean }) {
  return (
    <div><Label>{label}</Label><input type="number" min={min} max={max} value={value} readOnly={readOnly} onChange={(e) => onChange(Number(e.target.value))} className={cn("h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none", readOnly && "cursor-not-allowed bg-surface-2 text-muted")} /></div>
  );
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border border-border-strong bg-surface" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
      </div>
    </div>
  );
}
function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span><span className="block text-sm font-medium text-foreground">{label}</span>{hint && <span className="block text-2xs text-subtle">{hint}</span>}</span>
      <Switch checked={checked} onChange={() => onChange(!checked)} aria-label={label} />
    </label>
  );
}
