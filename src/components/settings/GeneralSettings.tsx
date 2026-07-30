"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, CheckCircle2, Coins, Calculator, CalendarClock, Globe, MonitorCog } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SettingsScopeBanner } from "@/components/scope/SettingsScopeBanner";
import { Switch } from "@/components/ui/Switch";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  cloneGeneralConfig, applyGeneralConfig, GENERAL_OPTIONS, roundAmount, formatMoney,
  DEFAULT_GENERAL_CONFIG, type GeneralConfigData,
} from "@/lib/settings/generalConfig";

type Opt = { value: string; label: string };

export function GeneralSettings({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const [cfg, setCfg] = useState<GeneralConfigData>(() => cloneGeneralConfig());
  const [saved, setSaved] = useState(false);

  const [saving, setSaving] = useState(false);
  const setField = (k: string, v: string) => setCfg((c) => ({ ...c, fields: { ...c.fields, [k]: v } }));
  const setFlag = (k: string, v: boolean) => setCfg((c) => ({ ...c, flags: { ...c.flags, [k]: v } }));

  // Load this tenant's saved settings from the DB.
  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/settings/general", { cache: "no-store" }).then((r) => r.json());
        if (j.ok && j.config) {
          const merged: GeneralConfigData = { fields: { ...DEFAULT_GENERAL_CONFIG.fields, ...j.config.fields }, flags: { ...DEFAULT_GENERAL_CONFIG.flags, ...j.config.flags } };
          setCfg(merged);
          applyGeneralConfig(merged); // keep the in-memory singleton in sync for the rest of the app
        }
      } catch { /* keep defaults */ }
    })();
  }, []);

  // Live preview using a temporary apply so formatMoney/roundAmount reflect the draft.
  const preview = useMemo(() => {
    const backup = JSON.parse(JSON.stringify(DEFAULT_GENERAL_CONFIG)) as GeneralConfigData;
    applyGeneralConfig(cfg);
    const money = formatMoney(123456.789);
    const rounded = roundAmount(1234.56);
    applyGeneralConfig(backup);
    return { money, rounded };
  }, [cfg]);

  async function save() {
    setSaving(true);
    applyGeneralConfig(cfg); // apply immediately app-wide
    try {
      const j = await fetch("/api/settings/general", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) }).then((r) => r.json());
      toast.result(j, "General settings saved.", "Could not save general settings.");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch {
      toast.error("Could not reach the server. Please try again.");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      {!embedded && <SettingsScopeBanner />}
      {embedded ? (
        <div className="flex justify-end">
          <Button size="md" onClick={save} disabled={saving}><CheckCircle2 className="h-4 w-4" /> {saving ? "Saving…" : "Save Settings"}</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">General Settings</span></div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><SlidersHorizontal className="h-5 w-5 text-primary" /> General Settings</h1>
            <p className="mt-0.5 text-sm text-muted">Application-wide defaults — number rounding, currency, date &amp; time, regional and system behaviour.</p>
          </div>
          <Button size="md" onClick={save} disabled={saving}><CheckCircle2 className="h-4 w-4" /> {saving ? "Saving…" : "Save Settings"}</Button>
        </div>
      )}

      {/* live preview */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-primary"><Calculator className="h-4 w-4" /> Live preview:</span>
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-muted">Amount → <span className="font-semibold text-foreground">{preview.money}</span></span>
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-muted">₹1,234.56 rounds → <span className="font-semibold text-foreground">{preview.rounded}</span></span>
      </div>

      {/* Currency & Numbers */}
      <SectionCard icon={Coins} title="Currency & Numbers">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Sel label="Currency Position" value={cfg.fields.currencyPosition} opts={GENERAL_OPTIONS.currencyPosition} onChange={(v) => setField("currencyPosition", v)} />
          <Txt label="Currency Symbol" value={cfg.fields.currencySymbol} onChange={(v) => setField("currencySymbol", v)} />
          <Txt label="Currency Code" value={cfg.fields.baseCurrency} onChange={(v) => setField("baseCurrency", v)} />
          <Sel label="Number System" value={cfg.fields.numberSystem} opts={GENERAL_OPTIONS.numberSystem} onChange={(v) => setField("numberSystem", v)} />
          <Sel label="Thousand Separator" value={cfg.fields.thousandSeparator} opts={GENERAL_OPTIONS.thousandSeparator} onChange={(v) => setField("thousandSeparator", v)} />
          <Sel label="Amount Decimals" value={cfg.fields.amountDecimals} opts={GENERAL_OPTIONS.decimals} onChange={(v) => setField("amountDecimals", v)} />
          <Sel label="Quantity Decimals" value={cfg.fields.qtyDecimals} opts={GENERAL_OPTIONS.decimals} onChange={(v) => setField("qtyDecimals", v)} />
          <Sel label="Rate / Price Decimals" value={cfg.fields.rateDecimals} opts={GENERAL_OPTIONS.decimals} onChange={(v) => setField("rateDecimals", v)} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Flag label="Append Currency Code" desc="Show INR after the amount (₹100 INR)." checked={cfg.flags.showCurrencyCode} onChange={(v) => setFlag("showCurrencyCode", v)} />
          <Flag label="Negative in Red" desc="Render negative figures in red across reports." checked={cfg.flags.negativeInRed} onChange={(v) => setFlag("negativeInRed", v)} />
        </div>
      </SectionCard>

      {/* Rounding */}
      <SectionCard icon={Calculator} title="Rounding Off">
        <Flag label="Enable Bill Rounding" desc="Apply round-off to the net payable on bills & invoices." checked={cfg.flags.enableRounding} onChange={(v) => setFlag("enableRounding", v)} />
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Sel label="Rounding Method" value={cfg.fields.roundingMethod} opts={GENERAL_OPTIONS.roundingMethod} onChange={(v) => setField("roundingMethod", v)} disabled={!cfg.flags.enableRounding} />
          <Sel label="Round To Nearest" value={cfg.fields.roundingPrecision} opts={GENERAL_OPTIONS.roundingPrecision} onChange={(v) => setField("roundingPrecision", v)} disabled={!cfg.flags.enableRounding} />
        </div>
        <div className="mt-3">
          <Flag label="Show Round-Off on Print" desc="Display the round-off line on printed documents." checked={cfg.flags.roundInPrint} onChange={(v) => setFlag("roundInPrint", v)} />
        </div>
      </SectionCard>

      {/* Date & Time */}
      <SectionCard icon={CalendarClock} title="Date & Time">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Sel label="Date Format" value={cfg.fields.dateFormat} opts={GENERAL_OPTIONS.dateFormat} onChange={(v) => setField("dateFormat", v)} />
          <Sel label="Time Format" value={cfg.fields.timeFormat} opts={GENERAL_OPTIONS.timeFormat} onChange={(v) => setField("timeFormat", v)} />
          <Sel label="Time Zone" value={cfg.fields.timezone} opts={GENERAL_OPTIONS.timezone} onChange={(v) => setField("timezone", v)} />
        </div>
      </SectionCard>

      {/* Regional */}
      <SectionCard icon={Globe} title="Regional & Fiscal">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Sel label="Fiscal Year Starts" value={cfg.fields.fiscalYearStart} opts={GENERAL_OPTIONS.fiscalYearStart} onChange={(v) => setField("fiscalYearStart", v)} />
          <Sel label="Week Starts On" value={cfg.fields.weekStart} opts={GENERAL_OPTIONS.weekStart} onChange={(v) => setField("weekStart", v)} />
          <Sel label="Language" value={cfg.fields.language} opts={GENERAL_OPTIONS.language} onChange={(v) => setField("language", v)} />
        </div>
      </SectionCard>

      {/* System Behaviour */}
      <SectionCard icon={MonitorCog} title="System Behaviour">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Sel label="Default Page Size" value={cfg.fields.defaultPageSize} opts={GENERAL_OPTIONS.pageSize} onChange={(v) => setField("defaultPageSize", v)} />
          <Sel label="Session Timeout" value={cfg.fields.sessionTimeout} opts={GENERAL_OPTIONS.sessionTimeout} onChange={(v) => setField("sessionTimeout", v)} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Flag label="Auto Logout when Idle" desc="Log the user out after the session timeout." checked={cfg.flags.autoLogout} onChange={(v) => setFlag("autoLogout", v)} />
          <Flag label="Confirm Before Delete" desc="Show a confirmation on destructive actions." checked={cfg.flags.confirmBeforeDelete} onChange={(v) => setFlag("confirmBeforeDelete", v)} />
          <Flag label="Compact Density" desc="Tighter row & list spacing for dense screens." checked={cfg.flags.compactDensity} onChange={(v) => setFlag("compactDensity", v)} />
          <Flag label="Sound on Action" desc="Play a beep on POS scan & save." checked={cfg.flags.soundOnAction} onChange={(v) => setFlag("soundOnAction", v)} />
          <Flag label="Terminal-based Setup Required" desc="Require every transaction to be billed at a registered POS terminal under an open session; users see only their mapped terminals' data." checked={cfg.flags.terminalSetupRequired} onChange={(v) => setFlag("terminalSetupRequired", v)} />
        </div>
      </SectionCard>

      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">These defaults apply across every module — amount &amp; quantity formatting, bill round-off, date display and idle-logout all read from here.</p>

      {saved && <SavedToast />}
    </div>
  );
}


function Sel({ label, value, opts, onChange, disabled }: { label: string; value: string; opts: readonly Opt[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:bg-surface focus:outline-none disabled:opacity-50">
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Txt({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:bg-surface focus:outline-none" />
    </div>
  );
}

function Flag({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
      <span><span className="block text-sm font-medium text-foreground">{label}</span><span className="text-2xs text-muted">{desc}</span></span>
      <Switch checked={checked} onChange={onChange} aria-label={label} />
    </label>
  );
}

function SavedToast() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
      <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
        <p className="text-sm font-bold text-foreground">Settings saved</p><p className="text-2xs text-muted">Applied across the application.</p>
      </div>
    </div>
  );
}
