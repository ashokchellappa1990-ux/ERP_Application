"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Check,
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  Image as ImageIcon,
  FileText,
  BookOpen,
  ShieldAlert,
  FileBox,
  GitPullRequestArrow,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import {
  industrySamplesFor, industryKeyFor, aiKeywords, aiDescription, aiClassify, INDUSTRY_LABEL,
  ATTRIBUTE_PRESETS, AI_TIPS,
  type SampleSet, type IndustryKey,
} from "@/lib/masters/industrySamples";
import { useProductForm, type ProductVariant } from "./ProductFormContext";
import {
  PRODUCT_TABS,
  GENERAL_FIELDS,
  CLASSIFICATION_FIELDS,
  UOM_FIELDS,
  DIMENSION_FIELDS,
  WEIGHT_FIELDS,
  CODE_FIELDS,
  BARCODE_FIELDS,
  TAX_FIELDS,
  PRICING_PURCHASE,
  PRICING_SALES,
  PRICING_REGIONAL,
  ACCOUNTING_FIELDS,
  STOCK_OPENING,
  STOCK_REORDER,
  EXPIRY_FIELDS,
  PURCHASE_FIELDS,
  INVENTORY_TRACKING,
  SALES_TOGGLES,
  SALES_CONTROLS,
  PHARMACY_TOGGLES,
  VALUATION_OPTS,
  BATCH_SALES_POLICY_OPTS,
  ATTR_TYPE_OPTS,
  type PField,
  type ToggleItem,
} from "@/lib/masters/productConfig";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { EditorShell } from "./EditorShell";
import { BranchScopeField } from "@/components/scope/BranchScopeField";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import type { MasterTree } from "@/lib/contracts/masters";
import { cn } from "@/lib/cn";

/* ===================================================== industry context = */

interface IndustryInfo {
  samples: SampleSet;
  ik: IndustryKey;
  industry: string;
}
const IndustryContext = createContext<IndustryInfo>({ samples: {}, ik: "grocery", industry: "" });
const useIndustry = () => useContext(IndustryContext);

interface MasterValues {
  tree: MasterTree;
  addValue: (type: string, value: string, parentId?: number) => Promise<number | undefined>;
}
const EMPTY_TREE: MasterTree = { categories: [], brands: [], manufacturers: [], suppliers: [] };
const MasterValuesContext = createContext<MasterValues>({ tree: EMPTY_TREE, addValue: async () => undefined });
const useMasterValues = () => useContext(MasterValuesContext);

/* ============================================================ helpers === */

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function SubHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pb-1 pt-2">
      <span className="h-4 w-1 rounded-full bg-brand-gradient" />
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function FieldRenderer({ def }: { def: PField }) {
  const { getField, setField, errors } = useProductForm();
  const { samples } = useIndustry();
  // Examples/placeholders follow the business's industry.
  const sample = samples[def.name] ?? def.sample;
  const Icon = def.icon;
  const lead = Icon ? <Icon className="h-4 w-4" /> : undefined;
  const common = { label: def.label, info: def.info, sample, error: errors[def.name] };

  // Search Keywords & Description get an AI assist based on the product name.
  if (def.name === "keywords" || def.name === "description") {
    return <AiAssistField def={def} sample={sample} />;
  }
  if (def.type === "textarea") {
    return (
      <Textarea
        {...common}
        rows={2}
        placeholder={sample}
        value={getField(def.name)}
        onChange={(e) => setField(def.name, e.target.value)}
      />
    );
  }
  if (def.type === "select") {
    if (def.name === "category" || def.name === "subCategory" || def.name === "group") return <HierSelectField def={def} />;
    if (def.creatable || def.name === "preferredSupplier") return <CreatableSelectField def={def} />;
    return (
      <Select
        {...common}
        leadingIcon={lead}
        placeholder="Select…"
        options={def.options ?? []}
        value={getField(def.name)}
        onChange={(e) => setField(def.name, e.target.value)}
      />
    );
  }
  return (
    <Input
      {...common}
      leadingIcon={lead}
      type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
      placeholder={sample}
      value={getField(def.name)}
      onChange={(e) => setField(def.name, e.target.value)}
    />
  );
}

/** Keywords / Description field with an AI suggestion based on the product name. */
function AiAssistField({ def, sample }: { def: PField; sample?: string }) {
  const { getField, setField, errors } = useProductForm();
  const { ik } = useIndustry();
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [needName, setNeedName] = useState(false);
  const isTextarea = def.type === "textarea";
  const value = getField(def.name);

  function generate() {
    const name = getField("name").trim();
    if (!name) {
      setNeedName(true);
      setSuggestion(null);
      return;
    }
    setNeedName(false);
    setLoading(true);
    const category = getField("category");
    const brand = getField("brand");
    // Simulate AI latency, then produce a recommendation from the product name.
    window.setTimeout(() => {
      const text = def.name === "keywords" ? aiKeywords(name, category, brand, ik) : aiDescription(name, category, brand, ik);
      setSuggestion(text);
      setLoading(false);
    }, 550);
  }

  function apply() {
    if (suggestion) setField(def.name, suggestion);
    setSuggestion(null);
  }

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-[13px] font-semibold text-foreground">{def.label}</label>
          {def.info && <InfoTip text={def.info} sample={sample} />}
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-2xs font-bold text-accent-foreground transition hover:bg-accent/20 disabled:opacity-60"
        >
          {loading ? <Sparkles className="h-3 w-3 animate-pulse" /> : <Wand2 className="h-3 w-3" />}
          {loading ? "Generating…" : "AI Suggest"}
        </button>
      </div>

      {isTextarea ? (
        <Textarea rows={2} placeholder={sample} value={value} error={errors[def.name]} onChange={(e) => setField(def.name, e.target.value)} />
      ) : (
        <Input placeholder={sample} value={value} error={errors[def.name]} onChange={(e) => setField(def.name, e.target.value)} />
      )}

      {needName && (
        <p className="mt-1.5 text-2xs text-warning">Enter the product name first — the AI uses it to suggest.</p>
      )}

      {suggestion && (
        <div className="mt-2 rounded-lg border border-accent/30 bg-accent/[0.07] p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-accent-foreground">
            <Sparkles className="h-3 w-3" /> AI Recommendation
          </div>
          <p className="text-sm text-foreground">{suggestion}</p>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={apply} className="inline-flex items-center gap-1 rounded-md bg-brand-gradient px-2.5 py-1 text-2xs font-bold text-white">
              <Check className="h-3 w-3" /> Use this
            </button>
            <button type="button" onClick={generate} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-muted hover:text-foreground">
              <Wand2 className="h-3 w-3" /> Regenerate
            </button>
            <button type="button" onClick={() => setSuggestion(null)} className="ml-auto grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-danger">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Map a product field to its flat master type.
const FLAT_MASTER_TYPE: Record<string, string> = { brand: "brand", manufacturer: "manufacturer", preferredSupplier: "supplier" };

/** Flat creatable select (Brand / Manufacturer / Supplier) — values from the master DB only. */
function CreatableSelectField({ def }: { def: PField }) {
  const { getField, setField } = useProductForm();
  const { tree, addValue } = useMasterValues();
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const Icon = def.icon;
  const cleanLabel = def.label.replace(" *", "");

  const masterType = FLAT_MASTER_TYPE[def.name] ?? def.name;
  const dbValues = masterType === "brand" ? tree.brands : masterType === "manufacturer" ? tree.manufacturers : masterType === "supplier" ? tree.suppliers : [];
  // DB values only (+ the currently-saved value so it still displays).
  const current = getField(def.name);
  const seen = new Set<string>();
  const options = [current, ...dbValues]
    .filter((v) => v && !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()))
    .map((v) => ({ value: v, label: v }));

  async function commit() {
    const v = val.trim();
    if (!v) return;
    await addValue(masterType, v); // persists to the master DB
    setField(def.name, v);
    setVal("");
    setAdding(false);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="text-[13px] font-semibold text-foreground">{def.label}</label>
        {def.info && <InfoTip text={def.info} sample={def.sample} />}
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Select
            options={options}
            placeholder="Select…"
            leadingIcon={Icon ? <Icon className="h-4 w-4" /> : undefined}
            value={getField(def.name)}
            onChange={(e) => setField(def.name, e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          title={`Add new ${cleanLabel}`}
          aria-label={`Add new ${cleanLabel}`}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-md border transition",
            adding
              ? "border-primary bg-primary text-white"
              : "border-border-strong bg-surface text-primary hover:border-primary hover:bg-primary-subtle"
          )}
        >
          <Plus className={cn("h-4 w-4 transition-transform", adding && "rotate-45")} />
        </button>
      </div>
      {adding && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-subtle/40 p-2">
          <input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder={`New ${cleanLabel}…`}
            className="h-9 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus"
          />
          <Button size="sm" onClick={commit}>
            <Check className="h-3.5 w-3.5" />
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

const HIER_CHILDREN: Record<string, string[]> = { category: ["subCategory", "group"], subCategory: ["group"], group: [] };

/** Dependent hierarchical select — Category → Sub-category → Group. Options are
 * filtered by the chosen parent, and a new value is created under that parent. */
function HierSelectField({ def }: { def: PField }) {
  const { getField, setField } = useProductForm();
  const { tree, addValue } = useMasterValues();
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const Icon = def.icon;
  const level = def.name; // category | subCategory | group
  const cleanLabel = def.label.replace(" *", "");

  const categoryVal = getField("category");
  const subCatVal = getField("subCategory");

  let parentId: number | undefined;
  let values: string[] = [];
  let disabled = false;
  let parentHint = "";

  if (level === "category") {
    values = tree.categories.map((c) => c.value);
  } else if (level === "subCategory") {
    const cat = tree.categories.find((c) => c.value === categoryVal);
    parentId = cat?.id;
    values = cat ? cat.subCategories.map((s) => s.value) : [];
    disabled = !categoryVal;
    parentHint = "Select a category first";
  } else {
    const cat = tree.categories.find((c) => c.subCategories.some((s) => s.value === subCatVal));
    const sub = cat?.subCategories.find((s) => s.value === subCatVal);
    parentId = sub?.id;
    values = sub ? sub.groups.map((g) => g.value) : [];
    disabled = !subCatVal;
    parentHint = "Select a sub-category first";
  }

  // Keep the current value visible even if its parent link isn't loaded.
  const current = getField(level);
  const seen = new Set<string>();
  const options = [current, ...values]
    .filter((v) => v && !seen.has(v) && seen.add(v))
    .map((v) => ({ value: v, label: v }));

  function pick(v: string) {
    setField(level, v);
    HIER_CHILDREN[level].forEach((f) => setField(f, "")); // reset deeper levels
  }
  async function commit() {
    const v = val.trim();
    if (!v) return;
    await addValue(level, v, parentId);
    setField(level, v);
    HIER_CHILDREN[level].forEach((f) => setField(f, ""));
    setVal("");
    setAdding(false);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="text-[13px] font-semibold text-foreground">{def.label}</label>
        {def.info && <InfoTip text={def.info} sample={def.sample} />}
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Select
            options={options}
            placeholder={disabled ? parentHint : "Select…"}
            leadingIcon={Icon ? <Icon className="h-4 w-4" /> : undefined}
            value={current}
            disabled={disabled}
            onChange={(e) => pick(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAdding((a) => !a)}
          title={`Add new ${cleanLabel}`}
          aria-label={`Add new ${cleanLabel}`}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-50",
            adding ? "border-primary bg-primary text-white" : "border-border-strong bg-surface text-primary hover:border-primary hover:bg-primary-subtle"
          )}
        >
          <Plus className={cn("h-4 w-4 transition-transform", adding && "rotate-45")} />
        </button>
      </div>
      {disabled && <p className="mt-1 text-2xs text-subtle">{parentHint} to add or pick a {cleanLabel.toLowerCase()}.</p>}
      {adding && !disabled && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-subtle/40 p-2">
          <input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder={`New ${cleanLabel}…`}
            className="h-9 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus"
          />
          <Button size="sm" onClick={commit}><Check className="h-3.5 w-3.5" /> Add</Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

function Fields({ defs }: { defs: PField[] }) {
  return (
    <Grid>
      {defs.map((d) => (
        <div key={d.name} className={d.full ? "sm:col-span-2 lg:col-span-3" : ""}>
          <FieldRenderer def={d} />
        </div>
      ))}
    </Grid>
  );
}

function PToggleGrid({ group, items, cols = 2 }: { group: string; items: ToggleItem[]; cols?: 2 | 3 }) {
  const { isOn, toggle } = useProductForm();
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3")}>
      {items.map((it) => {
        const on = isOn(group, it.id);
        return (
          <label
            key={it.id}
            className={cn(
              "flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3.5 transition",
              on ? "border-primary/40 bg-primary-subtle/40" : "border-border bg-surface hover:bg-surface-2"
            )}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                {it.label}
                {it.info && <InfoTip text={it.info} />}
              </span>
              {it.desc && <span className="mt-0.5 block text-2xs text-muted">{it.desc}</span>}
            </span>
            <Switch checked={on} onChange={() => toggle(group, it.id)} aria-label={it.label} />
          </label>
        );
      })}
    </div>
  );
}

function PFlag({ id, label, desc }: { id: string; label: string; desc?: string }) {
  const { flag, setFlag } = useProductForm();
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {desc && <span className="text-2xs text-muted">{desc}</span>}
      </span>
      <Switch checked={flag(id)} onChange={(v) => setFlag(id, v)} aria-label={label} />
    </label>
  );
}

function Dropzone({ icon: Icon, label }: { icon: typeof ImageIcon; label: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-foreground">{label}</p>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-6 text-center transition hover:border-primary hover:bg-primary-subtle/30">
        <Icon className="h-6 w-6 text-primary" />
        <span className="text-xs font-medium text-foreground">Click to upload</span>
        <input type="file" className="hidden" />
      </label>
    </div>
  );
}

/* ============================================================== tabs === */

function GeneralTab() {
  return <Fields defs={GENERAL_FIELDS} />;
}
function ClassificationTab() {
  const { getField, setField } = useProductForm();
  const { ik } = useIndustry();
  const { addValue } = useMasterValues();
  const [busy, setBusy] = useState(false);
  const name = getField("name").trim();
  const suggestion = name ? aiClassify(name, ik) : null;

  async function applyClassification() {
    if (!suggestion) return;
    setBusy(true);
    try {
      // Persist to the master tree (create category → sub-category → group with
      // proper parent links) so the suggested values are available even if the
      // master had none, then select them on the form.
      const catId = await addValue("category", suggestion.category);
      const subId = suggestion.subCategory ? await addValue("subCategory", suggestion.subCategory, catId) : undefined;
      if (suggestion.group) await addValue("group", suggestion.group, subId);
    } catch {
      /* still fill the fields even if master write fails */
    }
    setField("category", suggestion.category);
    setField("subCategory", suggestion.subCategory);
    setField("group", suggestion.group);
    setField("family", suggestion.family);
    setField("segment", suggestion.segment);
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary-subtle/60 to-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Classification
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {name
                ? "Suggested from the product name & your industry. Applying also saves any new values to the master."
                : "Enter a Product Name on the General tab, then auto-classify here."}
            </p>
            {suggestion && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {([
                  ["Category", suggestion.category], ["Sub-category", suggestion.subCategory],
                  ["Group", suggestion.group], ["Family", suggestion.family], ["Segment", suggestion.segment],
                ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-2xs">
                    <span className="text-subtle">{k}:</span><span className="font-semibold text-foreground">{v}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <Button size="sm" onClick={applyClassification} disabled={!suggestion || busy}>
            <Wand2 className="h-3.5 w-3.5" /> {busy ? "Applying…" : "Auto-classify"}
          </Button>
        </div>
      </div>
      <Fields defs={CLASSIFICATION_FIELDS} />
    </div>
  );
}
function UomTab() {
  return (
    <div className="space-y-5">
      <Fields defs={UOM_FIELDS} />
      <SubHeading>Package Dimensions</SubHeading>
      <Fields defs={DIMENSION_FIELDS} />
      <SubHeading>Weight Details</SubHeading>
      <Fields defs={WEIGHT_FIELDS} />
    </div>
  );
}
function CodesTab() {
  const { flag } = useProductForm();
  const auto = flag("autoUniqueCode");
  return (
    <div className="space-y-5">
      <PFlag
        id="autoUniqueCode"
        label="Unique Code Generation"
        desc="Let the system generate a unique product code, SKU & EAN-13 barcode/QR automatically — no manual codes needed. Used to track this product across inward (GRN), sales & stock movements."
      />
      {auto ? (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-subtle/40 p-4 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-muted">
            <p className="font-semibold text-foreground">Codes will be auto-generated on save</p>
            A unique product code, per-variant SKU and EAN-13 barcode/QR are created automatically and used to
            track inward, sales and stock movements. Manual code entry is turned off.
          </div>
        </div>
      ) : (
        <>
          <Fields defs={CODE_FIELDS} />
          <SubHeading>Barcode Configuration</SubHeading>
          <PFlag id="autoBarcode" label="Auto Barcode Generation" desc="Generate barcodes automatically on save" />
          <Fields defs={BARCODE_FIELDS} />
          <SubHeading>QR Configuration</SubHeading>
          <PFlag id="qrRequired" label="QR Code Required" />
        </>
      )}
    </div>
  );
}
function TaxTab() {
  return <Fields defs={TAX_FIELDS} />;
}
function InventoryTab() {
  const { getField, setField } = useProductForm();
  return (
    <div className="space-y-5">
      <SubHeading>Tracking</SubHeading>
      <PToggleGrid group="inventoryTracking" items={INVENTORY_TRACKING} />
      <SubHeading>
        <span className="inline-flex items-center gap-1.5">
          Inventory Valuation Method
          <InfoTip text="Batch issue order for stock value, COGS & billing: FIFO issues the oldest received batch first, FEFO issues the first-to-expire batch first (for perishables), or Not Required when batch order isn't enforced." />
        </span>
      </SubHeading>
      <div className="grid gap-4 sm:max-w-2xl sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">Valuation Method</label>
          <Select
            options={VALUATION_OPTS}
            value={getField("valuation") || "fifo"}
            onChange={(e) => setField("valuation", e.target.value)}
          />
        </div>
        {/* When FIFO/FEFO is enforced, choose how an out-of-order batch pick is handled at billing. */}
        {(getField("valuation") || "fifo") !== "notRequired" && (
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-2xs font-semibold text-muted">
              Batch Sales Policy
              <InfoTip text="When a cashier picks a batch other than the FIFO/FEFO priority-1 batch: Sales Restricted blocks the sale; Sales Allowed shows only a warning." />
            </label>
            <Select
              options={BATCH_SALES_POLICY_OPTS}
              value={getField("batchSalesPolicy") || "warn"}
              onChange={(e) => setField("batchSalesPolicy", e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
function ExpiryTab() {
  const { flag } = useProductForm();
  return (
    <div className="space-y-5">
      <PFlag id="expiryApplicable" label="Expiry Applicable" desc="Enable shelf-life and near-expiry alerts" />
      {flag("expiryApplicable") ? (
        <>
          <SubHeading>Shelf Life</SubHeading>
          <Fields defs={EXPIRY_FIELDS.slice(0, 2)} />
          <SubHeading>Near Expiry Alert</SubHeading>
          <Fields defs={EXPIRY_FIELDS.slice(2)} />
        </>
      ) : (
        <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
          Turn on “Expiry Applicable” to configure shelf life and near-expiry alerts.
        </p>
      )}
    </div>
  );
}
function StockTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Opening Stock</SubHeading>
      <Fields defs={STOCK_OPENING} />
      <SubHeading>Reorder Configuration</SubHeading>
      <Fields defs={STOCK_REORDER} />
    </div>
  );
}
function PricingTab() {
  const { getField, setField, flag } = useProductForm();
  return (
    <div className="space-y-5">
      <SubHeading>Purchase Pricing</SubHeading>
      <Fields defs={PRICING_PURCHASE} />
      <SubHeading>Sales Pricing</SubHeading>
      <Fields defs={PRICING_SALES} />
      <SubHeading>Regional Pricing</SubHeading>
      <Fields defs={PRICING_REGIONAL} />
      <SubHeading>Discount Configuration</SubHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        <PFlag id="maxDiscountEnabled" label="Discount Allowed" />
        {flag("maxDiscountEnabled") && (
          <Input
            label="Maximum Discount %"
            type="number"
            placeholder="10"
            info="Cap on discount that can be applied at billing."
            value={getField("maxDiscountPct")}
            onChange={(e) => setField("maxDiscountPct", e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
function AccountingTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Account Mapping</SubHeading>
      <Fields defs={ACCOUNTING_FIELDS} />
    </div>
  );
}
function SalesTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Sales Permissions</SubHeading>
      <PToggleGrid group="sales" items={SALES_TOGGLES} cols={3} />
      <SubHeading>Additional Controls</SubHeading>
      <PToggleGrid group="salesControls" items={SALES_CONTROLS} />
    </div>
  );
}
function PurchaseTab() {
  return (
    <div className="space-y-5">
      <PFlag id="purchaseAllowed" label="Purchase Allowed" />
      <Fields defs={PURCHASE_FIELDS} />
    </div>
  );
}
function AttributesTab() {
  const { data, addAttr, updateAttr, removeAttr } = useProductForm();
  const { ik } = useIndustry();
  const presets = ATTRIBUTE_PRESETS[ik] ?? [];
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-info-subtle p-3 text-xs text-info">
        Add attributes that define product variants. Examples — Textile: Size, Color,
        Fabric · Electronics: RAM, Storage, Processor · Furniture: Material, Dimension.
      </div>
      {presets.length > 0 && (
        <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary-subtle/50 to-surface p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Quick add for {INDUSTRY_LABEL[ik]} — one click fills the values, then Generate Variants
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const exists = data.attributes.some((a) => a.name.trim().toLowerCase() === p.name.toLowerCase());
              return (
                <button
                  key={p.name}
                  type="button"
                  disabled={exists}
                  onClick={() => addAttr({ name: p.name, type: p.type, values: p.values })}
                  title={p.values}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    exists
                      ? "cursor-not-allowed border-border bg-surface-2 text-subtle"
                      : "border-primary/40 bg-surface text-primary hover:bg-primary hover:text-white"
                  )}
                >
                  {exists ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {data.attributes.length === 0 && (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-6 text-center text-sm text-muted">
          No attributes yet. Add one to define variants.
        </div>
      )}
      {data.attributes.map((a, i) => (
        <div key={a.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <Badge tone="primary">Attribute #{i + 1}</Badge>
            <button
              type="button"
              onClick={() => removeAttr(a.id)}
              className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
          <Grid>
            <Input
              label="Attribute Name"
              placeholder="e.g. Size"
              value={a.name}
              onChange={(e) => updateAttr(a.id, { name: e.target.value })}
            />
            <Select
              label="Attribute Type"
              options={ATTR_TYPE_OPTS}
              value={a.type}
              onChange={(e) => updateAttr(a.id, { type: e.target.value })}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <Input
                label="Values (comma separated)"
                placeholder="S, M, L, XL"
                value={a.values}
                onChange={(e) => updateAttr(a.id, { values: e.target.value })}
              />
            </div>
          </Grid>
        </div>
      ))}
      <Button variant="outline" size="md" onClick={() => addAttr()}>
        <Plus className="h-4 w-4" />
        Add Attribute
      </Button>

      <SubHeading>Variant Matrix (Stock-Keeping Units)</SubHeading>
      <VariantMatrix />
    </div>
  );
}

/* ---- variant matrix helper (SKU & barcode are generated by the backend) ---- */
function buildMatrix(
  attributes: { name: string; values: string }[],
  baseMrp: string,
  existing: ProductVariant[]
): ProductVariant[] {
  // Merge attributes that share a name (e.g. three "Size" rows) into ONE
  // dimension with all its values, so every value becomes a separate variant.
  const dimMap = new Map<string, { name: string; values: string[] }>();
  for (const a of attributes) {
    const name = (a.name || "").trim();
    if (!name) continue;
    const vals = (a.values || "").split(",").map((v) => v.trim()).filter(Boolean);
    if (!vals.length) continue;
    const key = name.toLowerCase();
    if (!dimMap.has(key)) dimMap.set(key, { name, values: [] });
    const dim = dimMap.get(key)!;
    for (const v of vals) if (!dim.values.includes(v)) dim.values.push(v);
  }
  const dims = Array.from(dimMap.values()).slice(0, 3); // Size × Colour × Fabric
  if (!dims.length) return [];
  let combos: { name: string; value: string }[][] = [[]];
  for (const d of dims) {
    const next: { name: string; value: string }[][] = [];
    for (const c of combos) for (const v of d.values) next.push([...c, { name: d.name, value: v }]);
    combos = next;
  }
  let n = 0;
  return combos.map((dimsArr) => {
    const label = dimsArr.map((x) => x.value).join(" / ");
    const prev = existing.find((e) => e.label === label);
    return {
      id: prev?.id || `var-${Date.now()}-${n++}`,
      label,
      dims: dimsArr,
      sku: prev?.sku || "", // backend generates on save
      barcode: prev?.barcode || "", // backend generates on save
      mrp: prev?.mrp || baseMrp || "",
      openingStock: prev?.openingStock || "0",
      status: prev?.status || "Active",
    };
  });
}

function VariantMatrix() {
  const { data, getField, setVariants, updateVariant, removeVariant } = useProductForm();
  const fmt = useFmt();
  const variants = data.variants;
  const dimNames = variants[0]?.dims.map((d) => d.name) ?? [];
  const totalStock = variants.reduce((s, v) => s + (Number(v.openingStock) || 0), 0);
  const ready = data.attributes.some((a) => a.name.trim() && a.values.trim());

  function generate() {
    setVariants(buildMatrix(data.attributes, getField("mrp"), variants));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-subtle/40 p-3 text-xs">
        <span className="text-muted">
          Each combination becomes a <strong className="text-foreground">stock-keeping variant</strong>. <strong className="text-foreground">SKU &amp; barcode are generated automatically</strong> when you save.
        </span>
        <Button variant="outline" size="sm" onClick={generate} disabled={!ready}>
          <Wand2 className="h-3.5 w-3.5" /> {variants.length ? "Regenerate Variants" : "Generate Variants"}
        </Button>
      </div>

      {!ready && variants.length === 0 && (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-6 text-center text-sm text-muted">
          Add attributes above (e.g. <span className="font-semibold text-foreground">Size = S, M, L</span> and <span className="font-semibold text-foreground">Colour = Blue, Red</span>), then Generate Variants.
        </div>
      )}

      {variants.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                  {dimNames.map((n) => <th key={n} className="px-3 py-2.5">{n || "Attribute"}</th>)}
                  <th className="px-3 py-2.5">SKU</th>
                  <th className="px-3 py-2.5">Barcode</th>
                  <th className="px-3 py-2.5 text-right">MRP</th>
                  <th className="px-3 py-2.5 text-right">Opening Stock</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0">
                    {v.dims.map((d, i) => (
                      <td key={i} className="px-3 py-2"><Badge tone="neutral">{d.value}</Badge></td>
                    ))}
                    <td className="px-3 py-2 font-mono text-2xs">{v.sku ? <span className="text-foreground">{v.sku}</span> : <span className="italic text-subtle">Auto</span>}</td>
                    <td className="px-3 py-2 font-mono text-2xs">{v.barcode ? <span className="text-foreground">{v.barcode}</span> : <span className="italic text-subtle">Auto</span>}</td>
                    <td className="px-3 py-2 text-right"><CellInput value={v.mrp} onChange={(x) => updateVariant(v.id, { mrp: x })} type="number" w="w-24" align="right" /></td>
                    <td className="px-3 py-2 text-right"><CellInput value={v.openingStock} onChange={(x) => updateVariant(v.id, { openingStock: x })} type="number" w="w-24" align="right" /></td>
                    <td className="px-3 py-2 text-center">
                      <select value={v.status} onChange={(e) => updateVariant(v.id, { status: e.target.value })} className="h-8 rounded-md border border-border bg-surface-2 px-2 text-xs focus:border-primary focus:outline-none">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => removeVariant(v.id)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <Badge tone="primary">{variants.length} variants</Badge>
            <span>Total opening stock: <strong className="text-foreground">{fmt.qty(totalStock)}</strong></span>
          </div>
        </>
      )}
    </div>
  );
}

function CellInput({ value, onChange, type, mono, placeholder, w = "w-32", align }: { value: string; onChange: (v: string) => void; type?: string; mono?: boolean; placeholder?: string; w?: string; align?: "right" }) {
  return (
    <input
      type={type === "number" ? "number" : "text"}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-8 rounded-md border border-border bg-surface-2 px-2 text-xs focus:border-primary focus:bg-surface focus:outline-none", w, mono && "font-mono", align === "right" && "text-right")}
    />
  );
}
function MediaTab() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Dropzone icon={ImageIcon} label="Product Image" />
      <Dropzone icon={FileText} label="Product Documents" />
      <Dropzone icon={BookOpen} label="Product Brochure" />
      <Dropzone icon={FileBox} label="Technical Specifications" />
      <Dropzone icon={ShieldAlert} label="Safety Instructions" />
    </div>
  );
}
function PharmacyTab() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-info-subtle p-3 text-xs text-info">
        Visible because this product is in the Pharmacy category. Configure
        drug-control and compliance options.
      </div>
      <PToggleGrid group="pharmacy" items={PHARMACY_TOGGLES} />
    </div>
  );
}
function ApprovalTab() {
  const { data, setApproval } = useProductForm();
  const flow = [
    { id: "draft", label: "Draft", desc: "Being created / edited" },
    { id: "pending", label: "Pending Approval", desc: "Submitted for review" },
    { id: "approved", label: "Approved", desc: "Live and usable" },
    { id: "rejected", label: "Rejected", desc: "Sent back with remarks" },
  ] as const;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg bg-primary-subtle/40 p-3">
        <GitPullRequestArrow className="h-5 w-5 text-primary" />
        <p className="text-xs text-foreground">
          Maker-Checker process — a product created by one user must be approved by
          an authorised checker before it goes live.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {flow.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setApproval(s.id)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left transition",
              data.approvalStatus === s.id
                ? "border-primary bg-primary-subtle/40 ring-1 ring-primary"
                : "border-border bg-surface hover:bg-surface-2"
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full text-2xs font-bold",
                data.approvalStatus === s.id ? "bg-brand-gradient text-white" : "bg-surface-2 text-muted"
              )}
            >
              {data.approvalStatus === s.id ? <Check className="h-4 w-4" /> : ""}
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{s.label}</span>
              <span className="text-2xs text-muted">{s.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const TAB_BODIES: Record<string, () => ReactNode> = {
  general: GeneralTab,
  classification: ClassificationTab,
  uom: UomTab,
  codes: CodesTab,
  tax: TaxTab,
  inventory: InventoryTab,
  expiry: ExpiryTab,
  stock: StockTab,
  pricing: PricingTab,
  accounting: AccountingTab,
  sales: SalesTab,
  attributes: AttributesTab,
  media: MediaTab,
  pharmacy: PharmacyTab,
  approval: ApprovalTab,
};

/* ============================================================ editor === */

export function ProductEditor({ productId }: { productId?: number } = {}) {
  const router = useRouter();
  const form = useProductForm();
  const fmt = useFmt();
  const isPharmacy = form.getField("category") === "Pharmacy";
  const tabs = useMemo(
    () => PRODUCT_TABS.filter((t) => !t.conditional || isPharmacy),
    [isPharmacy]
  );
  const [activeId, setActiveId] = useState("general");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [scopeBranchId, setScopeBranchId] = useState<number | "all" | undefined>(undefined); // "Add to" branch choice

  // Pull the business's industry from Business Setup so examples match the trade.
  const [industry, setIndustry] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/company-setup", { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        const ind = j?.data?.company?.industry || j?.data?.industrySelected || "";
        if (active && ind) setIndustry(ind);
      } catch {
        /* default to grocery samples */
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const industryInfo = useMemo<IndustryInfo>(
    () => ({ samples: industrySamplesFor(industry), ik: industryKeyFor(industry), industry }),
    [industry]
  );

  // DB-backed master tree (Category → Sub-category → Group) + flat brands/manufacturers.
  const [tree, setTree] = useState<MasterTree>(EMPTY_TREE);
  const loadTree = useCallback(async () => {
    try {
      const res = await fetch("/api/masters/values", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (j.ok && j.tree) setTree(j.tree);
    } catch {
      /* fall back to static options */
    }
  }, []);
  useEffect(() => {
    loadTree();
  }, [loadTree]);
  const addMasterValue = useCallback(async (type: string, value: string, parentId?: number) => {
    try {
      const res = await fetch("/api/masters/values", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, value, parentId }) });
      const j = await res.json().catch(() => ({}));
      await loadTree(); // refetch so the new node (and its id) is available
      return typeof j?.id === "number" ? (j.id as number) : undefined;
    } catch {
      return undefined;
    }
  }, [loadTree]);
  const masterInfo = useMemo<MasterValues>(() => ({ tree, addValue: addMasterValue }), [tree, addMasterValue]);

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const Body = TAB_BODIES[(tabs[activeIndex] ?? tabs[0]).id];
  const statusTone = form.data.approvalStatus === "approved" ? "success" : "warning";
  const hsn = form.getField("hsn");

  async function save() {
    if (!form.validate()) {
      setActiveId("general");
      return;
    }
    setSubmitting(true);
    setApiError("");
    try {
      const payload = {
        fields: form.data.fields,
        toggles: form.data.toggles,
        flags: form.data.flags,
        attributes: form.data.attributes.map((a) => ({ name: a.name, type: a.type, values: a.values })),
        variants: form.data.variants.map((v) => ({
          label: v.label, dims: v.dims, sku: v.sku, barcode: v.barcode,
          mrp: v.mrp, openingStock: v.openingStock, status: v.status,
        })),
        approvalStatus: form.data.approvalStatus,
        // "Add to" branch: on create default to All; on edit only re-target if the
        // user changed it (so an untouched edit keeps the product's current branch).
        ...(productId ? (scopeBranchId !== undefined ? { scopeBranchId } : {}) : { scopeBranchId: scopeBranchId ?? "all" }),
      };
      const res = await fetch(productId ? `/api/products/${productId}` : "/api/products", {
        method: productId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApiError(json?.message || "Could not save the product.");
        setSubmitting(false);
        return;
      }
      setSaved(true);
      window.setTimeout(() => router.push("/masters/product"), 1300);
    } catch {
      setApiError("Network error — could not save the product.");
      setSubmitting(false);
    }
  }

  return (
    <IndustryContext.Provider value={industryInfo}>
    <MasterValuesContext.Provider value={masterInfo}>
      {apiError && (
        <div className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-danger/30 bg-danger px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {apiError}
        </div>
      )}
    <EditorShell
      parentLabel="Products"
      parentHref="/masters/product"
      cancelHref="/masters/product"
      title={form.getField("name") || "New Product"}
      status={{ label: form.data.approvalStatus, tone: statusTone }}
      tabs={tabs}
      activeId={activeId}
      onTab={setActiveId}
      onSaveDraft={() => form.setApproval("pending")}
      onSave={save}
      saveLabel={submitting ? "Saving…" : productId ? "Update Product" : "Save Product"}
      aiLabel={`AI Tips · ${INDUSTRY_LABEL[industryInfo.ik]}`}
      summaryTitle="Product Summary"
      summaryName={form.getField("name") || "New Product"}
      summaryCode={form.getField("code") || "—"}
      summaryBadges={[{ label: form.data.approvalStatus, tone: statusTone }, ...(form.getField("category") ? [{ label: form.getField("category"), tone: "primary" as const }] : [])]}
      summaryFields={[
        { label: "Category", value: form.getField("category") },
        { label: "Brand", value: form.getField("brand") },
        { label: "Base UOM", value: form.getField("baseUom") },
        { label: "MRP", value: form.getField("mrp") ? fmt.money(Number(form.getField("mrp")) || 0) : "—" },
        { label: "GST", value: form.getField("gstRate") },
        { label: "HSN", value: hsn, badge: hsn && /^\d{4,8}$/.test(hsn) ? { label: "Valid", tone: "success" } : undefined },
      ]}
      ai={[
        { ok: hsn ? /^\d{4,8}$/.test(hsn) : false, text: hsn && /^\d{4,8}$/.test(hsn) ? "HSN code looks valid" : "Add a 4–8 digit HSN code" },
        { ok: !!form.getField("mrp"), text: form.getField("mrp") ? "MRP set" : "Set an MRP & selling price" },
        { ok: !!form.getField("category"), text: form.getField("category") ? "Category set — use AI Classify for the full tree" : "Auto-classify from the product name on the Classification tab" },
        ...AI_TIPS[industryInfo.ik].map((t) => ({ ok: true, text: t })),
      ]}
      saved={saved}
      savedText={`${form.getField("name") || "Product"} has been added. Redirecting…`}
    >
      {!productId && activeId === "general" && <div className="mb-3"><BranchScopeField value={scopeBranchId} onChange={setScopeBranchId} /></div>}
      {activeId === "general" && <IndustryNote info={industryInfo} />}
      {Body && <Body />}
    </EditorShell>
    </MasterValuesContext.Provider>
    </IndustryContext.Provider>
  );
}

function IndustryNote({ info }: { info: IndustryInfo }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/[0.07] px-3.5 py-2 text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold text-accent-foreground">
        <Sparkles className="h-3.5 w-3.5" /> Examples tailored for {INDUSTRY_LABEL[info.ik]}
      </span>
      <span className="text-muted">
        Placeholders &amp; AI suggestions match your industry{info.industry ? ` (${info.industry})` : ""}. Change it in
      </span>
      <Link href="/setup" className="font-semibold text-primary hover:underline">Business Setup</Link>
    </div>
  );
}
