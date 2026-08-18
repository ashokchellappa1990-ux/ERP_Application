"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCog, Settings2, CheckCircle2, Receipt, PackageCheck, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { DOC_SCREENS, DEFAULT_DOC_FIELDS_CONFIG, setFieldSetting, applyDocFieldsConfig, type DocFieldsConfig } from "@/lib/settings/docFieldsConfig";
import { DEFAULT_COMPANY_CONFIG, setCompanyFlag, applyCompanyConfig, type CompanyConfig } from "@/lib/settings/companyConfig";
import { GRN_LINE_FIELDS, DEFAULT_GRN_PRICING_CONFIG, setGrnField, applyGrnConfig, CATEGORY_RULES, type GrnFieldSetting } from "@/lib/settings/grnPricingConfig";
import { DEFAULT_DISPATCH_CONFIG, type TransportConfigData } from "@/lib/settings/transportConfigDefaults";
import { GATE_ENTRY_DISPATCH_TYPES } from "@/lib/contracts/transport";
import { cn } from "@/lib/cn";

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const REFERENCE_TYPE_OPTS = [
  { value: "", label: "— No preload —" },
  { value: "Sales Order", label: "Sales Order" },
  { value: "Direct Customer Dispatch", label: "Direct Customer Dispatch" },
];

export function DocumentSettings() {
  const [cfg, setCfg] = useState<DocFieldsConfig>(() => clone(DEFAULT_DOC_FIELDS_CONFIG));
  const [company, setCompany] = useState<CompanyConfig>(() => clone(DEFAULT_COMPANY_CONFIG));
  const [grn, setGrn] = useState<Record<string, GrnFieldSetting>>(() => clone(DEFAULT_GRN_PRICING_CONFIG));
  // Predefined Dispatch Type / Reference Type for Vehicle Gate Entry — same
  // persisted store as the Dispatch Configuration screen (dispatch_configurations),
  // fetched here too so this screen can offer the same preload/lock controls
  // alongside the rest of Vehicle Gate Entry's field settings.
  const [dispatchCfg, setDispatchCfg] = useState<TransportConfigData>(() => clone(DEFAULT_DISPATCH_CONFIG));
  const [active, setActive] = useState(DOC_SCREENS[0].key);
  const [saved, setSaved] = useState(false);
  const screen = DOC_SCREENS.find((s) => s.key === active);
  const isGrn = active === "grn_pricing";

  useEffect(() => {
    fetch("/api/settings/dispatch-config", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok && j.config) setDispatchCfg(j.config); }).catch(() => {});
    // Fetch this screen's own persisted config directly rather than relying on
    // the app-wide DocumentFieldsConfigLoader having already resolved by the
    // time this page mounts (it might not have, if this is the first page
    // loaded) — this guarantees the edit form always starts from the real
    // saved values, never stale in-memory defaults.
    fetch("/api/settings/document-fields", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      applyDocFieldsConfig(j.config.screens);
      applyGrnConfig(j.config.grn);
      applyCompanyConfig(j.config.company);
      setCfg(clone(DEFAULT_DOC_FIELDS_CONFIG));
      setGrn(clone(DEFAULT_GRN_PRICING_CONFIG));
      setCompany(clone(DEFAULT_COMPANY_CONFIG));
    }).catch(() => {});
  }, []);

  const setField = (screenKey: string, key: string, patch: { enabled?: boolean; mandatory?: boolean }) =>
    setCfg((c) => ({ ...c, [screenKey]: { ...c[screenKey], [key]: { ...{ enabled: true, mandatory: false }, ...c[screenKey][key], ...patch } } }));
  const setGrnDraft = (key: string, patch: Partial<GrnFieldSetting>) =>
    setGrn((g) => ({ ...g, [key]: { ...{ enabled: true, mandatory: false }, ...g[key], ...patch } }));
  const setDispatchField = (n: string, v: string) => setDispatchCfg((c) => ({ ...c, fields: { ...c.fields, [n]: v } }));
  const setDispatchFlag = (n: string, v: boolean) => setDispatchCfg((c) => ({ ...c, flags: { ...c.flags, [n]: v } }));

  async function save() {
    // apply the draft to the shared singletons so the forms pick it up this session
    for (const s of DOC_SCREENS) for (const f of s.fields) setFieldSetting(s.key, f.key, cfg[s.key][f.key]);
    for (const f of GRN_LINE_FIELDS) setGrnField(f.key, grn[f.key]);
    (Object.keys(company) as (keyof CompanyConfig)[]).forEach((k) => setCompanyFlag(k, company[k]));
    // Persist screen fields + GRN + company flags so they survive a server
    // restart / new session (previously in-memory only — this whole page's
    // edits used to reset on every refresh, which is exactly what this fix
    // addresses).
    try {
      const j = await fetch("/api/settings/document-fields", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ screens: cfg, grn, company }) }).then((r) => r.json());
      if (j.ok && j.config) { setCfg(j.config.screens); setGrn(j.config.grn); setCompany(j.config.company); }
    } catch { /* best effort — in-session singletons above already applied */ }
    // Dispatch Type / Reference Type preload+lock are persisted server-side
    // (shared with Dispatch Configuration) — save the full fetched config back
    // so nothing else on that screen gets clobbered.
    try {
      const j = await fetch("/api/settings/dispatch-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dispatchCfg) }).then((r) => r.json());
      if (j.ok && j.config) setDispatchCfg(j.config);
    } catch { /* best effort — field/GRN/company settings above already applied */ }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  // Group order follows each screen's own field list (first-seen order) rather
  // than a fixed tuple, since Vehicle Gate Entry uses entirely different group
  // names (Gate Information/Dispatch & Reference/Transport Details/etc.) from
  // the commercial docs' Fields/Discount/Taxes.
  const groups = screen ? Array.from(new Set(screen.fields.map((f) => f.group))) : [];

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Document Field Settings</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileCog className="h-5 w-5 text-primary" /> Document Field Settings</h1>
          <p className="mt-0.5 text-sm text-muted">Screen-wise — enable / disable fields and set which are mandatory.</p>
        </div>
        <Button size="md" onClick={save}><CheckCircle2 className="h-4 w-4" /> Save Configuration</Button>
      </div>

      {/* Company GST — controls Tax & HSN visibility everywhere */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Receipt className="h-4 w-4 text-primary" /> Company GST Setup</p>
        <p className="mb-3 text-2xs text-muted">From Business Setup. When GST is off, Tax &amp; HSN columns are hidden on every document.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Flag label="GST Enabled" desc="Show tax & HSN on documents." checked={company.gstEnabled} onChange={(v) => setCompany({ ...company, gstEnabled: v })} />
          <Flag label="Composition Scheme" desc="No tax breakup on invoices." checked={company.compositionScheme} onChange={(v) => setCompany({ ...company, compositionScheme: v })} />
          <Flag label="HSN Mandatory" desc="Require HSN on every line." checked={company.hsnMandatory} onChange={(v) => setCompany({ ...company, hsnMandatory: v })} />
        </div>
      </div>

      {/* screen selector */}
      <div className="flex flex-wrap gap-2">
        {DOC_SCREENS.map((s) => <button key={s.key} onClick={() => setActive(s.key)} className={cn("rounded-lg px-4 py-2 text-sm font-semibold transition", active === s.key ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40")}>{s.label}</button>)}
        <button onClick={() => setActive("grn_pricing")} className={cn("inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition", isGrn ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40")}><PackageCheck className="h-4 w-4" /> GRN Batch Pricing</button>
      </div>

      {isGrn ? (
        <>
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border bg-primary-subtle/30 px-5 py-3 text-sm font-semibold text-foreground"><PackageCheck className="h-4 w-4 text-primary" /> GRN Batch-Pricing Line Items</div>
            <div className="divide-y divide-border">
              {(["Batch", "Pricing", "Control"] as const).map((g) => {
                const items = GRN_LINE_FIELDS.filter((f) => f.group === g);
                return (
                  <div key={g} className="p-4">
                    <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-subtle">{g}</p>
                    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-1 text-sm">
                      <span></span><span className="text-center text-2xs font-semibold uppercase text-subtle">Enabled</span><span className="w-20 text-center text-2xs font-semibold uppercase text-subtle">Mandatory</span>
                      {items.map((f) => {
                        const s = grn[f.key] ?? { enabled: true, mandatory: false };
                        return (
                          <div key={f.key} className="contents">
                            <span className="py-1.5 font-medium text-foreground">{f.label}{f.price && <span className="ml-1.5 rounded-full bg-primary-subtle px-1.5 py-0.5 text-[10px] font-semibold text-primary">price</span>}</span>
                            <div className="flex justify-center py-1.5"><Switch checked={s.enabled} onChange={(v) => setGrnDraft(f.key, { enabled: v })} aria-label={`${f.label} enabled`} /></div>
                            <div className="flex w-20 justify-center py-1.5">{f.mandatoryable ? <Switch checked={s.mandatory && s.enabled} disabled={!s.enabled} onChange={(v) => setGrnDraft(f.key, { mandatory: v })} aria-label={`${f.label} mandatory`} /> : <span className="text-2xs text-subtle">—</span>}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-primary-subtle/30 px-5 py-3 text-sm font-semibold text-foreground">Category-wise Behaviour (applied automatically)</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5 text-center">Batch</th><th className="px-4 py-2.5 text-center">Expiry</th><th className="px-4 py-2.5 text-center">Batch Price</th><th className="px-4 py-2.5 text-center">Pricing Control</th><th className="px-4 py-2.5 text-center">Serial</th></tr></thead>
              <tbody>
                {CATEGORY_RULES.map((r) => (
                  <tr key={r.category} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.category}</td>
                    <td className="px-4 py-2.5 text-center"><Badge tone={r.batch === "Mandatory" ? "danger" : r.batch === "Optional" ? "warning" : "neutral"}>{r.batch}</Badge></td>
                    <td className="px-4 py-2.5 text-center"><Badge tone={r.expiry === "Mandatory" ? "danger" : r.expiry === "Optional" ? "warning" : "neutral"}>{r.expiry}</Badge></td>
                    <td className="px-4 py-2.5 text-center"><Badge tone={r.batchPrice === "Mandatory" ? "danger" : r.batchPrice === "Allowed" ? "success" : "neutral"}>{r.batchPrice}</Badge></td>
                    <td className="px-4 py-2.5 text-center"><Badge tone="primary">{r.pricing}</Badge></td>
                    <td className="px-4 py-2.5 text-center">{r.serial ? <Badge tone="info">Yes</Badge> : <span className="text-subtle">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : screen && (
      <>
      {screen.key === "vehicle_gate_entry" && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><ListChecks className="h-4 w-4 text-primary" /> Predefined Dispatch Type &amp; Reference Type</p>
          <p className="mb-3 text-2xs text-muted">Preloads these two on the Vehicle Gate Entry add screen so most users never have to pick them. Leave blank for no preload; locking shows the preloaded value but disables changing it. Shared with Dispatch Configuration.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Select label="Default Dispatch Type" options={[{ value: "", label: "— No preload —" }, ...GATE_ENTRY_DISPATCH_TYPES.map((t) => ({ value: t.value, label: t.label }))]} value={dispatchCfg.fields.defaultDispatchType ?? ""} onChange={(e) => setDispatchField("defaultDispatchType", e.target.value)} />
              <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                <span className="text-sm font-medium text-foreground">Lock (not user-changeable)</span>
                <Switch checked={!!dispatchCfg.flags.lockDefaultDispatchType} onChange={(v) => setDispatchFlag("lockDefaultDispatchType", v)} aria-label="Lock default dispatch type" />
              </label>
            </div>
            <div>
              <Select label="Default Reference Type" options={REFERENCE_TYPE_OPTS} value={dispatchCfg.fields.defaultReferenceType ?? ""} onChange={(e) => setDispatchField("defaultReferenceType", e.target.value)} />
              <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                <span className="text-sm font-medium text-foreground">Lock (not user-changeable)</span>
                <Switch checked={!!dispatchCfg.flags.lockDefaultReferenceType} onChange={(v) => setDispatchFlag("lockDefaultReferenceType", v)} aria-label="Lock default reference type" />
              </label>
            </div>
          </div>
          <div className="mt-4 max-w-xs">
            <label className="mb-1.5 block text-xs font-semibold text-foreground">Gate Entry No Prefix</label>
            <input value={dispatchCfg.fields.gateEntryPrefix ?? ""} onChange={(e) => setDispatchField("gateEntryPrefix", e.target.value)} placeholder="GATE" className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus" />
            <p className="mt-1 text-2xs text-muted">
              Auto-generated whenever Gate Entry No is left as the suggested value — currently
              {" "}{dispatchCfg.flags.gateEntryNoIncludeMonthYear ? `{prefix}-{MMYY}-00001, {prefix}-{MMYY}-00002, …` : `{prefix}-00001, {prefix}-00002, …`}
            </p>
            <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
              <span><span className="block text-sm font-medium text-foreground">Include Month &amp; Year</span><span className="block text-2xs text-subtle">Adds the entry's creation month+year right after the prefix, e.g. GATE-0826-00001.</span></span>
              <Switch checked={!!dispatchCfg.flags.gateEntryNoIncludeMonthYear} onChange={(v) => setDispatchFlag("gateEntryNoIncludeMonthYear", v)} aria-label="Include month and year in Gate Entry No" />
            </label>
          </div>
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
            <span><span className="block text-sm font-medium text-foreground">Auto-load Customer from Vehicle History</span><span className="block text-2xs text-subtle">Picking a Vehicle Number looks up that vehicle&apos;s most recent past gate entry and pre-fills its Customer — still changeable by the user afterward. When off, Customer is picked manually as today.</span></span>
            <Switch checked={!!dispatchCfg.flags.autoLoadCustomerFromVehicleHistory} onChange={(v) => setDispatchFlag("autoLoadCustomerFromVehicleHistory", v)} aria-label="Auto-load customer from vehicle history" />
          </label>
        </div>
      )}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-primary-subtle/30 px-5 py-3 text-sm font-semibold text-foreground"><Settings2 className="h-4 w-4 text-primary" /> {screen.label} — Fields</div>
        <div className="divide-y divide-border">
          {groups.map((g) => {
            const items = screen.fields.filter((f) => f.group === g);
            if (!items.length) return null;
            return (
              <div key={g} className="p-4">
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-subtle">{g}</p>
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-1 text-sm">
                  <span className="text-2xs font-semibold uppercase text-subtle"></span>
                  <span className="text-center text-2xs font-semibold uppercase text-subtle">Enabled</span>
                  <span className="w-20 text-center text-2xs font-semibold uppercase text-subtle">Mandatory</span>
                  {items.map((f) => {
                    const setting = cfg[screen.key][f.key] ?? { enabled: true, mandatory: false };
                    const gstOff = f.gst && !company.gstEnabled;
                    return (
                      <div key={f.key} className="contents">
                        <span className={cn("py-1.5 font-medium", gstOff ? "text-subtle line-through" : "text-foreground")}>{f.label}{f.gst && <span className="ml-1.5 rounded-full bg-info-subtle px-1.5 py-0.5 text-[10px] font-semibold text-info">GST</span>}</span>
                        <div className="flex justify-center py-1.5"><Switch checked={setting.enabled && !gstOff} disabled={gstOff} onChange={(v) => setField(screen.key, f.key, { enabled: v })} aria-label={`${f.label} enabled`} /></div>
                        <div className="flex w-20 justify-center py-1.5">{f.mandatoryable ? <Switch checked={setting.mandatory && setting.enabled} disabled={!setting.enabled} onChange={(v) => setField(screen.key, f.key, { mandatory: v })} aria-label={`${f.label} mandatory`} /> : <span className="text-2xs text-subtle">—</span>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}

      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">These settings drive the New / Edit forms for {DOC_SCREENS.map((s) => s.label).join(", ")} &amp; GRN batch pricing. Tax &amp; HSN follow the company GST setup above.</p>

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">Configuration saved</p><p className="text-2xs text-muted">Applied to all document forms.</p>
          </div>
        </div>
      )}
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
