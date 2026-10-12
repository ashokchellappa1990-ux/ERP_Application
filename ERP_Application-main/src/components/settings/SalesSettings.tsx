"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ScrollText,
  ShieldAlert,
  Layers3,
  Radio,
  Percent,
  CreditCard,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useSalesSettings } from "./SalesSettingsFormContext";
import { SettingsScopeBanner } from "@/components/scope/SettingsScopeBanner";
import { useScope } from "@/components/scope/ScopeProvider";
import {
  SALES_TABS,
  BUSINESS_MODES,
  CHANNELS,
  PRODUCT_METHODS,
  BARCODE_TYPES,
  BARCODE_FLAGS,
  QR_CONTAINS,
  QR_ACTIONS,
  SERIAL_CATEGORIES,
  SERIAL_FLAGS,
  BATCH_FLAGS,
  EXPIRY_FLAGS,
  APPROVAL_FOR,
  APPROVAL_LEVELS,
  POS_SCREEN,
  NOTIFICATIONS,
  AI_FEATURES,
  B2C_FLAGS,
  B2C_CUSTOMER_FIELDS,
  B2B_FLAGS,
  PRICING_FLAGS,
  PRICE_SOURCE_TOGGLES,
  MRP_SOURCE_OPTS,
  CREDIT_FLAGS,
  CREDIT_FIELDS,
  INVOICE_FLAGS,
  INVOICE_FIELDS,
  RETURN_GENERAL_FLAGS,
  RETURN_REASON_FLAGS,
  RETURN_REFUND_FLAGS,
  RETURN_HANDLING_FLAGS,
  RETURN_APPROVAL_FLAGS,
  RETURN_SEARCH_TOGGLES,
  REFUND_MODE_TOGGLES,
  INVENTORY_HANDLING_TOGGLES,
  RETURN_APPROVAL_BASIS,
  MAX_RETURN_PERIOD_OPTS,
  EXCHANGE_GENERAL_FLAGS,
  EXCHANGE_SEARCH_TOGGLES,
  EXCHANGE_PRODUCT_FLAGS,
  EXCHANGE_QTY_FLAGS,
  EXCHANGE_PRICE_FLAGS,
  EXCHANGE_HANDLING_TOGGLES,
  EXCHANGE_HANDLING_FLAGS,
  EXCHANGE_APPROVAL_FLAGS,
  EXCHANGE_APPROVAL_BASIS,
  EXCHANGE_SETTLEMENT_TOGGLES,
  EXCHANGE_PERIOD_BASIS_OPTS,
  EXCHANGE_VALIDITY_OPTS,
  EXCHANGE_PRICE_BASIS_OPTS,
  SEQUENCE_FIELDS,
  NUMBER_COMPOSITION_FLAGS,
  NUMBER_TOKENS,
  RESET_FREQUENCY_OPTS,
  YEAR_FORMAT_OPTS,
  SEPARATOR_OPTS,
  TRISTATE_OPTS,
  EXPIRY_VALIDATION_OPTS,
  BATCH_SELECTION_OPTS,
  NEAR_EXPIRY_OPTS,
  INVENTORY_METHODS,
  PRICE_SOURCES,
  SALES_STATS,
  type SField,
  type SToggle,
  type SFlag,
} from "@/lib/settings/salesConfig";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { RadioCard } from "@/components/ui/RadioCard";
import { EditorShell } from "@/components/masters/EditorShell";
import { FieldGuide } from "./FieldGuide";
import { SALES_GUIDES } from "@/lib/settings/salesGuides";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------- helpers -- */
function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function SubHeading({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="pb-1 pt-1">
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-1 rounded-full bg-brand-gradient" />
        <h3 className="text-sm font-semibold text-foreground">{children}</h3>
        <span className="h-px flex-1 bg-border" />
      </div>
      {hint && <p className="ml-3.5 mt-1 text-2xs text-muted">{hint}</p>}
    </div>
  );
}
function FieldRenderer({ def }: { def: SField }) {
  const { getField, setField, errors } = useSalesSettings();
  const Icon = def.icon;
  const lead = Icon ? <Icon className="h-4 w-4" /> : undefined;
  const common = { label: def.label, info: def.info, sample: def.sample, error: errors[def.name] };
  if (def.type === "select") return <Select {...common} leadingIcon={lead} placeholder="Select…" options={def.options ?? []} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
  return <Input {...common} leadingIcon={lead} type={def.type === "number" ? "number" : "text"} placeholder={def.sample} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
}
function Fields({ defs }: { defs: SField[] }) {
  return <Grid>{defs.map((d) => <div key={d.name} className={d.full ? "sm:col-span-2 lg:col-span-3" : ""}><FieldRenderer def={d} /></div>)}</Grid>;
}
function SelectField({ name, label, options, info }: { name: string; label: string; options: { value: string; label: string }[]; info?: string }) {
  const { getField, setField, errors } = useSalesSettings();
  return <Select label={label} info={info} options={options} error={errors[name]} value={getField(name)} onChange={(e) => setField(name, e.target.value)} placeholder="Select…" />;
}
function ToggleGrid({ group, items, cols = 3 }: { group: string; items: SToggle[]; cols?: 2 | 3 }) {
  const { isOn, toggle, errors } = useSalesSettings();
  return (
    <div className="space-y-2">
      <div className={cn("grid gap-3 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3")}>
        {items.map((it) => {
          const active = isOn(group, it.id);
          return (
            <label key={it.id} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3.5 transition", active ? "border-primary/40 bg-primary-subtle/40" : "border-border bg-surface hover:bg-surface-2")}>
              <span><span className="block text-sm font-medium text-foreground">{it.label}</span>{it.desc && <span className="text-2xs text-muted">{it.desc}</span>}</span>
              <Switch checked={active} onChange={() => toggle(group, it.id)} aria-label={it.label} />
            </label>
          );
        })}
      </div>
      {errors[group] && <p className="text-xs font-medium text-danger">{errors[group]}</p>}
    </div>
  );
}
function Flags({ items, cols = 2 }: { items: SFlag[]; cols?: 1 | 2 | 3 }) {
  const { flag, setFlag } = useSalesSettings();
  return (
    <div className={cn("grid gap-3", cols === 1 ? "grid-cols-1" : cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
      {items.map((it) => (
        <label key={it.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <span><span className="block text-sm font-medium text-foreground">{it.label}</span>{it.desc && <span className="text-2xs text-muted">{it.desc}</span>}</span>
          <Switch checked={flag(it.id)} onChange={(v) => setFlag(it.id, v)} aria-label={it.label} />
        </label>
      ))}
    </div>
  );
}

/* ============================================================== tabs === */
const KPI_TONES = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white", accent: "bg-accent text-accent-foreground" } as const;
function Kpi({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: keyof typeof KPI_TONES }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2"><span className={cn("grid h-8 w-8 place-items-center rounded-lg", KPI_TONES[tone])}><Icon className="h-4 w-4" /></span><p className="text-lg font-bold text-foreground">{value}</p></div>
      <p className="mt-1.5 text-2xs font-medium text-muted">{label}</p>
    </div>
  );
}
function ModeTab() {
  const { getField, setField, countOn } = useSalesSettings();
  const mode = getField("businessMode");
  return (
    <div className="space-y-5">
      <SubHeading hint="Live snapshot of how the rule engine is currently configured.">Sales Rule Dashboard</SubHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={Layers3} label="Active Sales Rules" value={String(SALES_STATS.activeRules)} tone="primary" />
        <Kpi icon={Radio} label="Active Channels" value={String(countOn("channels") || SALES_STATS.activeChannels)} tone="secondary" />
        <Kpi icon={Percent} label="Discount Sources" value={String(countOn("discountSources") || SALES_STATS.activeDiscounts)} tone="success" />
        <Kpi icon={CreditCard} label="Credit Rules" value={String(SALES_STATS.creditRules)} tone="warning" />
        <Kpi icon={ShieldAlert} label="Pending Approvals" value={String(SALES_STATS.pendingApprovals)} tone="accent" />
        <Kpi icon={Sparkles} label="AI Recommendations" value={String(SALES_STATS.aiRecommendations)} tone="primary" />
      </div>
      <SubHeading hint="Selecting a mode pre-fills sensible default rules across all tabs.">Business Mode</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BUSINESS_MODES.map((m) => <RadioCard key={m.value} selected={mode === m.value} onSelect={() => setField("businessMode", m.value)} title={m.label} description={m.desc} />)}
      </div>
    </div>
  );
}
function ChannelTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Enable Sales Channels</SubHeading>
      <ToggleGrid group="channels" items={CHANNELS} />
      <SubHeading>Default Channel</SubHeading>
      <Grid><div><SelectField name="defaultChannel" label="Default Sales Channel" options={CHANNELS.map((c) => ({ value: c.id, label: c.label }))} /></div></Grid>
    </div>
  );
}
function ProductTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Product Selection Methods</SubHeading>
      <ToggleGrid group="productMethods" items={PRODUCT_METHODS} />
      <SubHeading>Default Method</SubHeading>
      <Grid><div><SelectField name="defaultProductMethod" label="Default Product Selection Method" options={PRODUCT_METHODS.map((c) => ({ value: c.id, label: c.label }))} /></div></Grid>
    </div>
  );
}
function BarcodeTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Barcode Billing</SubHeading>
      <Flags items={BARCODE_FLAGS} cols={3} />
      <SubHeading>Supported Barcode Types</SubHeading>
      <ToggleGrid group="barcodeTypes" items={BARCODE_TYPES} />
    </div>
  );
}
function QrTab() {
  const { flag, setFlag } = useSalesSettings();
  return (
    <div className="space-y-5">
      <Flags items={[{ id: "enableQr", label: "Enable QR Billing", desc: "Allow scanning QR codes at billing." }]} cols={1} />
      <SubHeading>QR Code Contains</SubHeading>
      <ToggleGrid group="qrContains" items={QR_CONTAINS} />
      <SubHeading>When QR Scanned</SubHeading>
      <ToggleGrid group="qrActions" items={QR_ACTIONS} cols={2} />
      {!flag("enableQr") && <button onClick={() => setFlag("enableQr", true)} className="text-xs font-medium text-primary hover:underline">Enable QR billing to use these rules</button>}
    </div>
  );
}
function SerialTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Serial Number Tracking</SubHeading>
      <Grid><div><SelectField name="serialTracking" label="Serial Tracking" options={TRISTATE_OPTS} info="Mandatory for high-value serialised goods." /></div></Grid>
      <SubHeading>Applicable Categories</SubHeading>
      <ToggleGrid group="serialCategories" items={SERIAL_CATEGORIES} cols={3} />
      <SubHeading>Rules</SubHeading>
      <Flags items={SERIAL_FLAGS} />
    </div>
  );
}
function BatchTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Batch Tracking</SubHeading>
      <Grid>
        <div><SelectField name="batchTracking" label="Batch Tracking" options={TRISTATE_OPTS} info="Mandatory for pharma & FMCG." /></div>
        <div><SelectField name="batchSelection" label="Batch Selection Method" options={BATCH_SELECTION_OPTS} info="Auto-pick logic at billing." /></div>
      </Grid>
      <SubHeading>Rules</SubHeading>
      <Flags items={BATCH_FLAGS} />
    </div>
  );
}
function ExpiryTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Expiry Validation</SubHeading>
      <Grid>
        <div><SelectField name="expiryValidation" label="Expiry Validation" options={EXPIRY_VALIDATION_OPTS} /></div>
        <div><SelectField name="nearExpiry" label="Near-Expiry Alert" options={NEAR_EXPIRY_OPTS} info="Warn this many days before expiry." /></div>
      </Grid>
      <SubHeading>Rules</SubHeading>
      <Flags items={EXPIRY_FLAGS} />
    </div>
  );
}
function InventoryTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Inventory Issue Method</SubHeading>
      <Grid><div><SelectField name="inventoryMethod" label="Stock Issue Method" options={INVENTORY_METHODS} /></div></Grid>
      <SubHeading hint="Order in which branch & warehouse stock is consumed.">Allocation Priority</SubHeading>
      <Grid>
        <div><Input label="Branch Stock Priority" placeholder="e.g. Billing branch → nearest branch" /></div>
        <div><Input label="Warehouse Priority" placeholder="e.g. Retail floor → main warehouse" /></div>
      </Grid>
    </div>
  );
}
function B2cTab() {
  return (
    <div className="space-y-5">
      <SubHeading>B2C / Walk-In Rules</SubHeading>
      <Flags items={B2C_FLAGS} />
      <SubHeading hint="Fields captured when adding a new walk-in customer at the POS — used for birthday / anniversary campaigns, tier discounts & messaging.">New Customer Capture Fields</SubHeading>
      <ToggleGrid group="customerCapture" items={B2C_CUSTOMER_FIELDS} />
      <SubHeading>Default Customer</SubHeading>
      <Grid><div><Input label="Default Walk-In Customer" placeholder="Cash Sales" /></div></Grid>
    </div>
  );
}
function B2bTab() {
  return (
    <div className="space-y-5">
      <SubHeading>B2B / Business Rules</SubHeading>
      <Flags items={B2B_FLAGS} />
    </div>
  );
}
function PricingTab() {
  return (
    <div className="space-y-5">
      <SubHeading hint="Where the effective MRP / selling price is fetched from at billing.">MRP / Price Fetch Source</SubHeading>
      <Grid>
        <div><SelectField name="mrpSource" label="Fetch Price From" options={MRP_SOURCE_OPTS} info="Product Master standard, GRN/batch price, common pricing config master, last purchase, or manual." /></div>
        <div><SelectField name="priceSource" label="Default Product-Master Tier" options={PRICE_SOURCES} info="Tier used when source resolves to Product Master." /></div>
      </Grid>
      <SubHeading hint="Billing evaluates these in priority order (1→5). First enabled source with a price wins; Product Master is the fallback.">Price Source Priority</SubHeading>
      <ToggleGrid group="priceSources" items={PRICE_SOURCE_TOGGLES} />
      <SubHeading>Override Rules</SubHeading>
      <Flags items={PRICING_FLAGS} />
    </div>
  );
}
function CreditTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Credit Sales Rules</SubHeading>
      <Flags items={CREDIT_FLAGS} />
      <SubHeading>Credit Limits</SubHeading>
      <Fields defs={CREDIT_FIELDS} />
    </div>
  );
}
function ApprovalTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Approval Required For</SubHeading>
      <ToggleGrid group="approvalFor" items={APPROVAL_FOR} />
      <SubHeading hint="Discount/price overrides escalate up these levels.">Approval Levels</SubHeading>
      <div className="space-y-2">
        {APPROVAL_LEVELS.map((l, i) => (
          <div key={l.role} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white">{i + 1}</span>
            <span className="flex-1 text-sm font-semibold text-foreground">{l.role}</span>
            <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-2xs font-semibold text-primary">{l.limit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function yearToken(fmt: string) {
  const now = new Date();
  const y = now.getFullYear();
  const fyStart = now.getMonth() >= 3 ? y : y - 1; // FY starts April (month index 3)
  const fyEnd = fyStart + 1;
  switch (fmt) {
    case "fy_full": return `${fyStart}-${fyEnd}`;
    case "cal_full": return `${y}`;
    case "cal_short": return String(y).slice(-2);
    case "fy_short": default: return `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
  }
}
function buildNumber(opts: { prefix: string; branch: string; sep: string; pad: number; start: number; yearFormat: string; incBranch: boolean; incFy: boolean; incMonth: boolean }) {
  const parts: string[] = [];
  if (opts.prefix) parts.push(opts.prefix.replace(/[\s/_-]+$/, ""));
  if (opts.incBranch && opts.branch) parts.push(opts.branch);
  if (opts.incFy) parts.push(yearToken(opts.yearFormat));
  if (opts.incMonth) parts.push(String(new Date().getMonth() + 1).padStart(2, "0"));
  parts.push(String(Math.max(1, opts.start)).padStart(Math.max(1, opts.pad), "0"));
  return parts.join(opts.sep ?? "/");
}
function InvoiceTab() {
  const { getField, flag } = useSalesSettings();
  // Branch code is resolved from the Branch master for the logged-in branch — not a
  // configured sample. Use it to render an accurate live preview.
  const { branches, branchIds, businessId } = useScope();
  const activeBranch =
    (branchIds && branchIds.length === 1 ? branches.find((b) => b.id === branchIds[0]) : undefined) ??
    branches.find((b) => b.businessId === businessId) ?? branches[0];
  const branchCode = activeBranch?.code || "";
  const sep = getField("seqSeparator");
  const pad = Number(getField("seqPadding")) || 4;
  const start = Number(getField("seqStart")) || 1;
  const yearFormat = getField("yearFormat");
  const branch = branchCode;
  const incBranch = flag("includeBranchInNumber");
  const incFy = flag("includeFyInNumber");
  const incMonth = flag("includeMonthInNumber");
  const resetLabel = RESET_FREQUENCY_OPTS.find((r) => r.value === getField("resetFrequency"))?.label ?? "Never";
  const common = { branch, sep, pad, start, yearFormat, incBranch, incFy, incMonth };
  const b2c = buildNumber({ prefix: getField("b2cSeries"), ...common });
  const b2b = buildNumber({ prefix: getField("b2bSeries"), ...common });

  return (
    <div className="space-y-5">
      <SubHeading>Invoice Prefixes</SubHeading>
      <Fields defs={INVOICE_FIELDS} />

      <SubHeading hint="Build the bill number from segments — Prefix · Branch · Year · Month · Running No.">Bill Number Format</SubHeading>
      <div className="flex flex-wrap items-center gap-1.5">
        {NUMBER_TOKENS.map((t) => {
          const active = t === "{PREFIX}" || t === "{SEQ}" || (t === "{BRANCH}" && incBranch) || (t === "{FY}" && incFy) || (t === "{MM}" && incMonth);
          return <span key={t} className={cn("rounded-md border px-2 py-1 font-mono text-2xs font-semibold", active ? "border-primary/40 bg-primary-subtle text-primary" : "border-border bg-surface text-subtle line-through")}>{t}</span>;
        })}
      </div>
      <Flags items={NUMBER_COMPOSITION_FLAGS} cols={3} />
      <Grid>
        {SEQUENCE_FIELDS.filter((d) => d.name !== "sampleBranchCode").map((d) => <div key={d.name}><FieldRenderer def={d} /></div>)}
        <div className="rounded-lg border border-dashed border-border bg-surface-2/40 px-3 py-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Branch Code</p>
          <p className="mt-1 text-sm font-medium text-foreground">It will display from the branch master</p>
          {branchCode && <p className="mt-0.5 font-mono text-2xs text-primary">Logged-in branch: {branchCode}</p>}
        </div>
        <div><SelectField name="seqSeparator" label="Segment Separator" options={SEPARATOR_OPTS} info="Character between segments." /></div>
        <div><SelectField name="yearFormat" label="Year Format" options={YEAR_FORMAT_OPTS} info="How the year/FY segment renders." /></div>
        <div><SelectField name="resetFrequency" label="Sequence Reset" options={RESET_FREQUENCY_OPTS} info="When the running number resets to the start." /></div>
      </Grid>

      <SubHeading>Live Preview</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-primary/30 bg-primary-subtle/40 p-4">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted">Next B2C Bill No.</p>
          <p className="mt-1 font-mono text-lg font-bold text-primary">{b2c}</p>
        </div>
        <div className="rounded-xl border border-secondary/30 bg-secondary-subtle/40 p-4">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted">Next B2B Bill No.{flag("separateB2bSequence") ? "" : " (shared seq)"}</p>
          <p className="mt-1 font-mono text-lg font-bold text-secondary">{b2b}</p>
        </div>
      </div>
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">
        Resets <strong>{resetLabel}</strong>
        {flag("branchWiseNumbering") ? " · separate running number per branch" : " · single running number across branches"}
        {flag("lockOnReset") ? " · old series locked after reset" : ""}.
      </p>

      <SubHeading>Numbering Rules</SubHeading>
      <Flags items={INVOICE_FLAGS} />
    </div>
  );
}
function ReturnTab() {
  const { getField, setField } = useSalesSettings();
  let reasons: string[] = [];
  try { reasons = JSON.parse(getField("returnReasons") || "[]"); } catch { /* keep [] */ }
  const saveReasons = (r: string[]) => setField("returnReasons", JSON.stringify(r));
  const [newReason, setNewReason] = useState("");
  const refundOpts = REFUND_MODE_TOGGLES.map((t) => ({ value: t.id, label: t.label }));
  const searchOpts = RETURN_SEARCH_TOGGLES.map((t) => ({ value: t.id, label: t.label }));
  const handlingOpts = INVENTORY_HANDLING_TOGGLES.map((t) => ({ value: t.id, label: t.label }));
  return (
    <div className="space-y-5">
      <SubHeading hint="The Sales Return Add screen shows/hides features based on these settings.">General Settings</SubHeading>
      <Flags items={RETURN_GENERAL_FLAGS} />
      <Grid>
        <div><SelectField name="maxReturnPeriod" label="Maximum Return Period" options={MAX_RETURN_PERIOD_OPTS} info="Block returns older than this from the sale date." /></div>
        <div><Input label="Return Number Prefix" value={getField("returnSeries")} onChange={(e) => setField("returnSeries", e.target.value)} placeholder="SR" /></div>
      </Grid>

      <SubHeading>Invoice Search Settings</SubHeading>
      <ToggleGrid group="returnSearch" items={RETURN_SEARCH_TOGGLES} />
      <Grid><div><SelectField name="defaultSearch" label="Default Search Method" options={searchOpts} /></div></Grid>

      <SubHeading>Return Reasons</SubHeading>
      <Flags items={RETURN_REASON_FLAGS} />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {reasons.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground">
              {r}<button type="button" onClick={() => saveReasons(reasons.filter((_, j) => j !== i))} className="text-subtle hover:text-danger">×</button>
            </span>
          ))}
          {!reasons.length && <span className="text-2xs text-muted">No reasons yet — add a few below.</span>}
        </div>
        <div className="flex max-w-md gap-2">
          <Input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Add a return reason…" onKeyDown={(e) => { if (e.key === "Enter" && newReason.trim()) { saveReasons([...reasons, newReason.trim()]); setNewReason(""); } }} />
          <Button type="button" variant="outline" size="md" onClick={() => { if (newReason.trim()) { saveReasons([...reasons, newReason.trim()]); setNewReason(""); } }}>Add</Button>
        </div>
      </div>

      <SubHeading>Refund Configuration</SubHeading>
      <Flags items={RETURN_REFUND_FLAGS} cols={1} />
      <ToggleGrid group="refundModes" items={REFUND_MODE_TOGGLES} />
      <Grid><div><SelectField name="defaultRefund" label="Default Refund Method" options={refundOpts} /></div></Grid>

      <SubHeading hint="Where each returned item goes when received. Good condition re-enters sellable stock; others move to a non-sellable bucket.">Inventory Handling Configuration</SubHeading>
      <Flags items={RETURN_HANDLING_FLAGS} cols={1} />
      <ToggleGrid group="inventoryHandling" items={INVENTORY_HANDLING_TOGGLES} />
      <Grid><div><SelectField name="defaultInventoryHandling" label="Default Inventory Handling" options={handlingOpts} /></div></Grid>

      <SubHeading hint="Returns above the auto-approve limit need approval before inventory & accounting post.">Approval Configuration</SubHeading>
      <Flags items={RETURN_APPROVAL_FLAGS} cols={1} />
      <ToggleGrid group="returnApprovalBasis" items={RETURN_APPROVAL_BASIS} cols={3} />
      <Grid><div><Input type="number" label="Auto-Approve Up To (₹)" value={getField("approvalAutoLimit")} onChange={(e) => setField("approvalAutoLimit", e.target.value)} placeholder="500" /></div></Grid>
    </div>
  );
}
function ExchangeTab() {
  const { getField, setField } = useSalesSettings();
  let reasons: string[] = [];
  try { reasons = JSON.parse(getField("exchangeReasons") || "[]"); } catch { /* keep [] */ }
  const saveReasons = (r: string[]) => setField("exchangeReasons", JSON.stringify(r));
  const [newReason, setNewReason] = useState("");
  const searchOpts = EXCHANGE_SEARCH_TOGGLES.map((t) => ({ value: t.id, label: t.label }));
  const settleOpts = EXCHANGE_SETTLEMENT_TOGGLES.map((t) => ({ value: t.id, label: t.label }));
  const handlingOpts = EXCHANGE_HANDLING_TOGGLES.map((t) => ({ value: t.id, label: t.label }));
  return (
    <div className="space-y-5">
      <SubHeading hint="The Sales Exchange screen shows/hides features & enforces rules based on these settings.">General Settings</SubHeading>
      <Flags items={EXCHANGE_GENERAL_FLAGS} />
      <Grid>
        <div><Input label="Exchange Number Prefix" value={getField("exchangeSeries")} onChange={(e) => setField("exchangeSeries", e.target.value)} placeholder="SE" /></div>
      </Grid>

      <SubHeading hint="Block exchanges older than the validity period, measured from the chosen date.">Exchange Period</SubHeading>
      <Grid>
        <div><SelectField name="exchangeBasis" label="Exchange Allowed Based On" options={EXCHANGE_PERIOD_BASIS_OPTS} /></div>
        <div><SelectField name="exchangeValidityDays" label="Exchange Validity" options={EXCHANGE_VALIDITY_OPTS} info="Maximum days from the sale to allow an exchange." /></div>
      </Grid>

      <SubHeading>Invoice Search Settings</SubHeading>
      <ToggleGrid group="exchangeSearch" items={EXCHANGE_SEARCH_TOGGLES} />
      <Grid><div><SelectField name="defaultExchangeSearch" label="Default Search Method" options={searchOpts} /></div></Grid>

      <SubHeading hint="Which differences between the original and the new item are permitted.">Product Validation</SubHeading>
      <Flags items={EXCHANGE_PRODUCT_FLAGS} />

      <SubHeading>Quantity Rules</SubHeading>
      <Flags items={EXCHANGE_QTY_FLAGS} cols={3} />
      <Grid><div><Input type="number" label="Maximum Exchange Quantity" value={getField("maxExchangeQty")} onChange={(e) => setField("maxExchangeQty", e.target.value)} placeholder="No limit" /></div></Grid>

      <SubHeading hint="How the value gap between the old and new item is settled.">Price Rules</SubHeading>
      <Flags items={EXCHANGE_PRICE_FLAGS} cols={1} />
      <Grid><div><SelectField name="exchangePriceBasis" label="Exchange Based On" options={EXCHANGE_PRICE_BASIS_OPTS} info="Value the returned item at its current price or the original invoice price." /></div></Grid>

      <SubHeading hint="Where each returned item goes when received.">Inventory Rules</SubHeading>
      <Flags items={EXCHANGE_HANDLING_FLAGS} cols={1} />
      <ToggleGrid group="exchangeHandling" items={EXCHANGE_HANDLING_TOGGLES} />
      <Grid><div><SelectField name="defaultExchangeHandling" label="Default Inventory Handling" options={handlingOpts} /></div></Grid>

      <SubHeading hint="Exchanges above the auto-approve limit need approval before inventory & accounting post.">Approval Rules</SubHeading>
      <Flags items={EXCHANGE_APPROVAL_FLAGS} cols={1} />
      <ToggleGrid group="exchangeApprovalBasis" items={EXCHANGE_APPROVAL_BASIS} cols={3} />
      <Grid><div><Input type="number" label="Auto-Approve Up To (₹ difference)" value={getField("exchangeApprovalAutoLimit")} onChange={(e) => setField("exchangeApprovalAutoLimit", e.target.value)} placeholder="1000" /></div></Grid>

      <SubHeading hint="Settlement methods offered when a refund is due to the customer.">Payment / Settlement Rules</SubHeading>
      <ToggleGrid group="exchangeSettlement" items={EXCHANGE_SETTLEMENT_TOGGLES} />
      <Grid><div><SelectField name="defaultExchangeSettlement" label="Default Settlement Method" options={settleOpts} /></div></Grid>

      <SubHeading>Exchange Reasons</SubHeading>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {reasons.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground">
              {r}<button type="button" onClick={() => saveReasons(reasons.filter((_, j) => j !== i))} className="text-subtle hover:text-danger">×</button>
            </span>
          ))}
          {!reasons.length && <span className="text-2xs text-muted">No reasons yet — add a few below.</span>}
        </div>
        <div className="flex max-w-md gap-2">
          <Input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Add an exchange reason…" onKeyDown={(e) => { if (e.key === "Enter" && newReason.trim()) { saveReasons([...reasons, newReason.trim()]); setNewReason(""); } }} />
          <Button type="button" variant="outline" size="md" onClick={() => { if (newReason.trim()) { saveReasons([...reasons, newReason.trim()]); setNewReason(""); } }}>Add</Button>
        </div>
      </div>
    </div>
  );
}
function CancellationTab() {
  const { getField, setField } = useSalesSettings();
  let reasons: string[] = [];
  try { reasons = JSON.parse(getField("cancellationReasons") || "[]"); } catch { /* keep [] */ }
  const saveReasons = (r: string[]) => setField("cancellationReasons", JSON.stringify(r));
  const [newReason, setNewReason] = useState("");
  const SEARCH = [{ id: "invoiceNo", label: "Invoice No" }, { id: "mobile", label: "Mobile" }, { id: "name", label: "Customer Name" }, { id: "barcode", label: "Barcode" }, { id: "qrCode", label: "QR Code" }];
  const REFUNDS = [{ id: "original", label: "Original Method" }, { id: "cash", label: "Cash" }, { id: "storeCredit", label: "Store Credit" }, { id: "wallet", label: "Wallet" }];
  const PERIOD_OPTS = [{ value: "30min", label: "Within 30 Minutes" }, { value: "2hr", label: "Within 2 Hours" }, { value: "sameDay", label: "Same Business Day" }, { value: "unlimited", label: "No Limit" }];
  return (
    <div className="space-y-5">
      <SubHeading hint="Sales Cancellation voids an ENTIRE invoice and reverses inventory, payments, accounting, customer ledger & loyalty.">General Settings</SubHeading>
      <Flags items={[
        { id: "cancellationAllowed", label: "Enable Sales Cancellation", desc: "Master switch for the cancellation module." },
        { id: "autoGenerateCancellationNo", label: "Auto Generate Cancellation Number" },
        { id: "autoCloseCancellation", label: "Auto Close Cancellation", desc: "Approve & post immediately when no approval is needed." },
        { id: "cancellationReasonMandatory", label: "Reason Mandatory" },
        { id: "cancellationRemarksMandatory", label: "Remarks Mandatory" },
        { id: "allowCustomCancellationReason", label: "Allow Custom Reason" },
      ]} />
      <Grid><div><Input label="Cancellation Number Prefix" value={getField("cancellationSeries")} onChange={(e) => setField("cancellationSeries", e.target.value)} placeholder="SC" /></div></Grid>

      <SubHeading hint="Restrict when an invoice may be cancelled relative to payment, shift close, day close & the financial period.">Time Restrictions</SubHeading>
      <Flags items={[
        { id: "allowCancelBeforePayment", label: "Allow Before Payment" },
        { id: "allowCancelAfterPayment", label: "Allow After Payment" },
        { id: "allowCancelBeforeShiftClose", label: "Allow Before Shift Closing" },
        { id: "allowCancelAfterShiftClose", label: "Allow After Shift Closing" },
        { id: "allowCancelBeforeDayClose", label: "Allow Before Day Closing" },
        { id: "allowCancelAfterDayClose", label: "Allow After Day Closing" },
        { id: "allowCancelAfterPeriodClose", label: "Allow After Financial Period Closing" },
      ]} />
      <Grid><div><SelectField name="maxCancellationPeriod" label="Maximum Cancellation Time" options={PERIOD_OPTS} info="How long after the sale a cancellation is permitted." /></div></Grid>

      <SubHeading hint="What the system automatically reverses on approval.">Reversal Rules</SubHeading>
      <Flags items={[
        { id: "cancelRestoreInventory", label: "Restore Inventory / Batch / Expiry" },
        { id: "cancelRestoreSerialStatus", label: "Restore Serial Number Status" },
        { id: "cancelReverseAccounting", label: "Reverse Accounting Entries" },
        { id: "cancelReverseCustomerOutstanding", label: "Reverse Customer Outstanding" },
        { id: "cancelReverseLoyalty", label: "Reverse Loyalty Points" },
      ]} />

      <SubHeading hint="Cancellations above the auto-approve limit need approval before reversal posts.">Approval Rules</SubHeading>
      <Flags items={[{ id: "cancellationApprovalEnabled", label: "Require Approval", desc: "Route high-value cancellations through approval." }]} cols={1} />
      <ToggleGrid group="cancellationApprovalBasis" items={[{ id: "amount", label: "By Amount" }]} cols={3} />
      <Grid><div><Input type="number" label="Auto-Approve Up To (₹ invoice value)" value={getField("cancellationApprovalAutoLimit")} onChange={(e) => setField("cancellationApprovalAutoLimit", e.target.value)} placeholder="0 = always auto" /></div></Grid>

      <SubHeading>Refund &amp; Search Settings</SubHeading>
      <ToggleGrid group="cancellationRefundModes" items={REFUNDS} />
      <Grid>
        <div><SelectField name="defaultCancellationRefund" label="Default Refund Method" options={REFUNDS.map((r) => ({ value: r.id, label: r.label }))} /></div>
        <div><SelectField name="defaultCancellationSearch" label="Default Search Method" options={SEARCH.map((s) => ({ value: s.id, label: s.label }))} /></div>
      </Grid>
      <ToggleGrid group="cancellationSearch" items={SEARCH} />

      <SubHeading>Cancellation Reasons</SubHeading>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {reasons.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground">
              {r}<button type="button" onClick={() => saveReasons(reasons.filter((_, j) => j !== i))} className="text-subtle hover:text-danger">×</button>
            </span>
          ))}
          {!reasons.length && <span className="text-2xs text-muted">No reasons yet — add a few below.</span>}
        </div>
        <div className="flex max-w-md gap-2">
          <Input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Add a cancellation reason…" onKeyDown={(e) => { if (e.key === "Enter" && newReason.trim()) { saveReasons([...reasons, newReason.trim()]); setNewReason(""); } }} />
          <Button type="button" variant="outline" size="md" onClick={() => { if (newReason.trim()) { saveReasons([...reasons, newReason.trim()]); setNewReason(""); } }}>Add</Button>
        </div>
      </div>
    </div>
  );
}
function PosTab() {
  return (
    <div className="space-y-5">
      <SubHeading hint="Show or hide POS billing-screen panels & columns.">POS Screen Layout</SubHeading>
      <ToggleGrid group="posScreen" items={POS_SCREEN} />
    </div>
  );
}
function NotificationTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Customer Notifications</SubHeading>
      <ToggleGrid group="notifications" items={NOTIFICATIONS} />
    </div>
  );
}
function AiTab() {
  const { flag, setFlag } = useSalesSettings();
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white"><Sparkles className="h-6 w-6 shrink-0" /><div><p className="text-sm font-bold">AI Sales Engine</p><p className="text-xs text-white/85">Drives recommendations, upselling, cross-selling & near-expiry clearance at the POS.</p></div></div>
      <Flags items={[{ id: "enableAi", label: "Enable AI", desc: "Master switch for all AI sales features." }]} cols={1} />
      <SubHeading>AI Features</SubHeading>
      <ToggleGrid group="aiFeatures" items={AI_FEATURES} />
      {!flag("enableAi") && <button onClick={() => setFlag("enableAi", true)} className="text-xs font-medium text-primary hover:underline">Enable AI to activate these features</button>}
    </div>
  );
}
function AuditTab() {
  const log = [
    { user: "admin", action: "Set business mode → Retail + Wholesale", at: "2026-06-08 09:02", tone: "info" },
    { user: "admin", action: "Enabled E-Invoice & E-Way Bill", at: "2026-06-08 09:14", tone: "success" },
    { user: "fin.mgr", action: "Max invoice discount 25% → 20%", at: "2026-06-08 10:40", tone: "warning" },
    { user: "admin", action: "Enabled AI near-expiry clearance", at: "2026-06-08 11:05", tone: "success" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg bg-primary-subtle/40 p-3 text-xs text-foreground"><ScrollText className="h-4 w-4 text-primary" /> Every change to the sales rule engine is versioned with user, timestamp &amp; old → new value.</div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Change</th><th className="px-4 py-2.5">Date &amp; Time</th></tr></thead>
          <tbody>
            {log.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{l.user}</td>
                <td className="px-4 py-2.5"><span className={cn("inline-flex items-center gap-1.5", l.tone === "warning" ? "text-warning" : l.tone === "success" ? "text-success" : "text-muted")}><span className={cn("h-1.5 w-1.5 rounded-full", l.tone === "warning" ? "bg-warning" : l.tone === "success" ? "bg-success" : "bg-info")} />{l.action}</span></td>
                <td className="px-4 py-2.5 text-muted">{l.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TAB_BODIES: Record<string, () => ReactNode> = {
  mode: ModeTab, channel: ChannelTab, product: ProductTab, barcode: BarcodeTab, qr: QrTab,
  serial: SerialTab, batch: BatchTab, expiry: ExpiryTab, inventory: InventoryTab, b2c: B2cTab,
  b2b: B2bTab, pricing: PricingTab, credit: CreditTab,
  approval: ApprovalTab, invoice: InvoiceTab, return: ReturnTab, exchange: ExchangeTab, cancellation: CancellationTab,
  pos: PosTab, notification: NotificationTab, ai: AiTab, audit: AuditTab,
};

export function SalesSettings() {
  const router = useRouter();
  const form = useSalesSettings();
  const tabs = useMemo(() => SALES_TABS, []);
  const [activeId, setActiveId] = useState("mode");
  const [saved, setSaved] = useState(false);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const Body = TAB_BODIES[tabs[activeIndex].id];
  const modeLabel = BUSINESS_MODES.find((m) => m.value === form.getField("businessMode"))?.label ?? "—";

  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.validate()) { setActiveId("channel"); return; }
    setSaving(true);
    const ok = await form.save();
    setSaving(false);
    if (!ok) return;
    setSaved(true);
    window.setTimeout(() => { setSaved(false); router.push("/dashboard"); }, 1400);
  }

  return (
    <EditorShell
      parentLabel="Settings"
      parentHref="/settings"
      cancelHref="/settings"
      title="Sales Settings"
      status={{ label: "configuration", tone: "primary" }}
      tabs={tabs}
      activeId={activeId}
      onTab={setActiveId}
      onAi={() => setActiveId("ai")}
      aiLabel="AI Sales Config"
      onSaveDraft={() => setSaved(false)}
      onSave={save}
      saveLabel={saving ? "Saving…" : "Save Configuration"}
      summaryTitle="Configuration Summary"
      summaryName="Sales Rule Engine"
      summaryCode={modeLabel}
      summaryBadges={[{ label: modeLabel, tone: "primary" }, { label: `${form.countOn("channels")} channels`, tone: "info" }]}
      summaryFields={[
        { label: "Business Mode", value: modeLabel },
        { label: "Default Channel", value: form.getField("defaultChannel") },
        { label: "Price Source", value: PRICE_SOURCES.find((p) => p.value === form.getField("priceSource"))?.label ?? "—" },
        { label: "Tax Method", value: form.getField("taxMethod") === "inclusive" ? "Inclusive" : "Exclusive" },
        { label: "Inventory", value: form.getField("inventoryMethod") },
      ]}
      ai={[
        { ok: form.countOn("channels") > 0, text: form.countOn("channels") > 0 ? "Sales channels enabled" : "Enable a sales channel" },
        { ok: form.flag("eInvoice"), text: form.flag("eInvoice") ? "E-Invoice compliance on" : "Enable E-Invoice for GST" },
        { ok: form.flag("enableAi"), text: form.flag("enableAi") ? "AI sales engine active" : "Turn on the AI sales engine" },
      ]}
      saved={saved}
      savedText="Sales configuration saved. The rule engine is now live across billing."
      headerAction={<FieldGuide guide={SALES_GUIDES[activeId]} effectLabel="At billing" />}
    >
      {activeId === SALES_TABS[0]?.id && <div className="mb-3"><SettingsScopeBanner /></div>}
      {Body && <Body />}
    </EditorShell>
  );
}
