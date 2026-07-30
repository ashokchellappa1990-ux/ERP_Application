"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  ShieldCheck,
  UploadCloud,
  Sparkles,
  Download,
  FileSpreadsheet,
  CircleAlert,
  Star,
  GitPullRequestArrow,
  TrendingUp,
  Truck,
  Package,
  RotateCcw,
  FileCheck2,
  ReceiptText,
  ScanLine,
  Contact,
  DatabaseZap,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useSupplierForm, type RowKey } from "./SupplierFormContext";
import {
  SUPPLIER_TABS,
  GENERAL_FIELDS,
  PRIMARY_CONTACT_FIELDS,
  SECONDARY_CONTACT_FIELDS,
  REG_ADDRESS_FIELDS,
  COMM_ADDRESS_FIELDS,
  GST_FIELDS,
  BANK_FIELDS,
  PURCHASE_FIELDS,
  CREDIT_FIELDS,
  PRODUCT_MAP_FIELDS,
  ACCOUNTING_FIELDS,
  RATING_FIELDS,
  COMM_PREFS,
  PAYMENT_MODES,
  DOCUMENTS,
  PAYMENT_TERM_OPTS,
  type SField,
  type SToggle,
} from "@/lib/masters/supplierConfig";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { RadioCard } from "@/components/ui/RadioCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { EditorShell } from "./EditorShell";
import { BranchScopeField } from "@/components/scope/BranchScopeField";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

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

function FieldRenderer({ def }: { def: SField }) {
  const { getField, setField, errors, customOptions, addOption } = useSupplierForm();
  const Icon = def.icon;
  const lead = Icon ? <Icon className="h-4 w-4" /> : undefined;
  const common = { label: def.label, info: def.info, sample: def.sample, error: errors[def.name] };

  if (def.type === "textarea") {
    return (
      <Textarea {...common} rows={2} placeholder={def.sample} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />
    );
  }
  if (def.type === "select" && def.creatable) {
    const opts = [...(def.options ?? []), ...(customOptions[def.name] ?? []).map((v) => ({ value: v, label: v }))];
    return <CreatableSelect def={def} options={opts} onAdd={(v) => addOption(def.name, v)} />;
  }
  if (def.type === "select") {
    return (
      <Select {...common} leadingIcon={lead} placeholder="Select…" options={def.options ?? []} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />
    );
  }
  return (
    <Input {...common} leadingIcon={lead} type={def.type === "number" ? "number" : "text"} placeholder={def.sample} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />
  );
}

function CreatableSelect({ def, options, onAdd }: { def: SField; options: { value: string; label: string }[]; onAdd: (v: string) => void }) {
  const { getField, setField } = useSupplierForm();
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const Icon = def.icon;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="text-[13px] font-semibold text-foreground">{def.label}</label>
        {def.info && <InfoTip text={def.info} sample={def.sample} />}
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Select options={options} placeholder="Select…" leadingIcon={Icon ? <Icon className="h-4 w-4" /> : undefined} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />
        </div>
        <button type="button" onClick={() => setAdding((a) => !a)} aria-label="Add new" className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md border transition", adding ? "border-primary bg-primary text-white" : "border-border-strong bg-surface text-primary hover:bg-primary-subtle")}>
          <Plus className={cn("h-4 w-4 transition-transform", adding && "rotate-45")} />
        </button>
      </div>
      {adding && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-subtle/40 p-2">
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (val.trim()) { onAdd(val.trim()); setVal(""); setAdding(false); } } if (e.key === "Escape") setAdding(false); }} placeholder="New value…" className="h-9 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          <Button size="sm" onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); setAdding(false); } }}>Add</Button>
        </div>
      )}
    </div>
  );
}

function Fields({ defs }: { defs: SField[] }) {
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

function ToggleGrid({ group, items, cols = 2 }: { group: string; items: SToggle[]; cols?: 2 | 3 }) {
  const { isOn, toggle } = useSupplierForm();
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3")}>
      {items.map((it) => {
        const on = isOn(group, it.id);
        return (
          <label key={it.id} className={cn("flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3.5 transition", on ? "border-primary/40 bg-primary-subtle/40" : "border-border bg-surface hover:bg-surface-2")}>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{it.label}</span>
              {it.desc && <span className="mt-0.5 block text-2xs text-muted">{it.desc}</span>}
            </span>
            <Switch checked={on} onChange={() => toggle(group, it.id)} aria-label={it.label} />
          </label>
        );
      })}
    </div>
  );
}

function Flag({ id, label, desc }: { id: string; label: string; desc?: string }) {
  const { flag, setFlag } = useSupplierForm();
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

function Repeatable({ rowKey, addLabel, empty, defs }: { rowKey: RowKey; addLabel: string; empty: string; defs: SField[] }) {
  const { rowsOf, addRow, updateRow, removeRow } = useSupplierForm();
  const rows = rowsOf(rowKey);
  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-8 text-center text-sm text-muted">{empty}</div>
      )}
      {rows.map((r, i) => (
        <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <Badge tone="primary">#{i + 1}</Badge>
            <button type="button" onClick={() => removeRow(rowKey, r.id)} className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
          <Grid>
            {defs.map((d) => (
              <div key={d.name} className={d.full ? "sm:col-span-2 lg:col-span-3" : ""}>
                {d.type === "select" ? (
                  <Select label={d.label} options={d.options ?? []} value={r[d.name] ?? ""} onChange={(e) => updateRow(rowKey, r.id, { [d.name]: e.target.value })} />
                ) : (
                  <Input label={d.label} type={d.type === "number" ? "number" : "text"} placeholder={d.sample} leadingIcon={d.icon ? <d.icon className="h-4 w-4" /> : undefined} value={r[d.name] ?? ""} onChange={(e) => updateRow(rowKey, r.id, { [d.name]: e.target.value })} />
                )}
              </div>
            ))}
          </Grid>
        </div>
      ))}
      <Button variant="outline" size="md" onClick={() => addRow(rowKey)}>
        <Plus className="h-4 w-4" /> {addLabel}
      </Button>
    </div>
  );
}

function Dropzone({ label }: { label: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-foreground">{label}</p>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-5 text-center transition hover:border-primary hover:bg-primary-subtle/30">
        <UploadCloud className="h-6 w-6 text-primary" />
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
function ContactTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Primary Contact</SubHeading>
      <Fields defs={PRIMARY_CONTACT_FIELDS} />
      <SubHeading>Secondary Contact</SubHeading>
      <Fields defs={SECONDARY_CONTACT_FIELDS} />
      <SubHeading>Communication Preferences</SubHeading>
      <ToggleGrid group="commPrefs" items={COMM_PREFS} cols={3} />
    </div>
  );
}
function AddressTab() {
  const { flag } = useSupplierForm();
  return (
    <div className="space-y-5">
      <SubHeading>Registered Address</SubHeading>
      <Fields defs={REG_ADDRESS_FIELDS} />
      <Flag id="sameAsReg" label="Communication address same as registered" />
      {!flag("sameAsReg") && (
        <>
          <SubHeading>Communication Address</SubHeading>
          <Fields defs={COMM_ADDRESS_FIELDS} />
        </>
      )}
      <SubHeading>Supplier Branch Locations</SubHeading>
      <Repeatable
        rowKey="branches"
        addLabel="Add Branch"
        empty="No supplier branches added. Add the supplier's other locations."
        defs={[
          { name: "branchName", label: "Branch Name", sample: "Mumbai DC" },
          { name: "city", label: "City", sample: "Mumbai" },
          { name: "state", label: "State", sample: "Maharashtra" },
          { name: "contact", label: "Contact", sample: "+91 98765 43210" },
        ]}
      />
    </div>
  );
}
function GstTab() {
  const { getField, setField, flag } = useSupplierForm();
  return (
    <div className="space-y-5">
      <SubHeading>GST Registration Type</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["regular", "Regular"], ["composition", "Composition"], ["sez", "SEZ"], ["export", "Export"]].map(([id, t]) => (
          <RadioCard key={id} selected={getField("regType") === id} onSelect={() => setField("regType", id)} title={t} />
        ))}
      </div>
      <Fields defs={GST_FIELDS.slice(0, 5)} />
      <div className="flex items-center gap-3 rounded-lg border border-secondary/30 bg-secondary-subtle/50 p-3">
        <ShieldCheck className="h-5 w-5 text-secondary" />
        <p className="flex-1 text-xs text-foreground">Validate the GSTIN against the GST portal before saving.</p>
        <Button variant="secondary" size="sm">Verify GSTIN</Button>
      </div>
      <SubHeading>TDS Configuration</SubHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        <Flag id="tdsApplicable" label="TDS Applicable" />
        {flag("tdsApplicable") && <FieldRenderer def={GST_FIELDS[5]} />}
      </div>
    </div>
  );
}
function BankingTab() {
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">Add one or more bank accounts. Mark the primary account as default for payments.</p>
      <Repeatable rowKey="banks" addLabel="Add Bank Account" empty="No bank accounts added. Add the account used for payments." defs={BANK_FIELDS} />
    </div>
  );
}
function PurchaseTab() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Flag id="preferredSupplier" label="Preferred Supplier" />
        <Flag id="purchaseApproval" label="Purchase Approval Required" />
      </div>
      <Fields defs={PURCHASE_FIELDS} />
    </div>
  );
}
function CreditTab() {
  const { getField, setField } = useSupplierForm();
  return (
    <div className="space-y-5">
      <Flag id="creditAllowed" label="Credit Allowed" />
      <Fields defs={CREDIT_FIELDS} />
      <SubHeading>Payment Terms</SubHeading>
      <div className="sm:max-w-xs">
        <Select options={PAYMENT_TERM_OPTS} value={getField("paymentTerms")} onChange={(e) => setField("paymentTerms", e.target.value)} />
      </div>
      <SubHeading>Payment Mode Preference</SubHeading>
      <ToggleGrid group="paymentModes" items={PAYMENT_MODES} />
    </div>
  );
}
function ProductsTab() {
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">Map the products this supplier provides, with their codes and last purchase price.</p>
      <Repeatable rowKey="products" addLabel="Add Product Mapping" empty="No products mapped yet." defs={PRODUCT_MAP_FIELDS} />
    </div>
  );
}
function BranchTab() {
  const { flag, setFlag } = useSupplierForm();
  const sampleBranches = ["Main Store — MG Road", "Whitefield Branch", "Koramangala Branch", "Central Warehouse"];
  const [selected, setSelected] = useState<string[]>([sampleBranches[0]]);
  return (
    <div className="space-y-5">
      <SubHeading>Applicable Branches & Warehouses</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <RadioCard selected={flag("allBranches")} onSelect={() => setFlag("allBranches", true)} title="All Branches" description="Supplier serves every branch & warehouse." />
        <RadioCard selected={!flag("allBranches")} onSelect={() => setFlag("allBranches", false)} title="Selected Branches" description="Choose specific branches below." />
      </div>
      {!flag("allBranches") && (
        <div className="grid gap-2 sm:grid-cols-2">
          {sampleBranches.map((b) => {
            const on = selected.includes(b);
            return (
              <label key={b} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition", on ? "border-primary bg-primary-subtle/40 text-foreground" : "border-border bg-surface text-muted hover:bg-surface-2")}>
                <input type="checkbox" checked={on} onChange={() => setSelected((s) => (on ? s.filter((x) => x !== b) : [...s, b]))} className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary)]" />
                {b}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
function DocumentsTab() {
  return (
    <div className="space-y-5">
      <Flag id="docExpiry" label="Document Expiry Tracking" desc="Alert before licences / certificates expire" />
      <SubHeading>Upload Documents</SubHeading>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOCUMENTS.map((d) => (
          <Dropzone key={d.id} label={d.label} />
        ))}
      </div>
    </div>
  );
}
function PerformanceTab() {
  const metrics: { icon: LucideIcon; label: string; value: string; tone: string }[] = [
    { icon: TrendingUp, label: "Total Purchase Value", value: "₹18.4L", tone: "text-success" },
    { icon: Package, label: "Total Purchase Qty", value: "42,180", tone: "text-primary" },
    { icon: Truck, label: "Delivery Performance", value: "94%", tone: "text-success" },
    { icon: CircleAlert, label: "Rejection %", value: "1.8%", tone: "text-warning" },
    { icon: RotateCcw, label: "Return %", value: "0.9%", tone: "text-warning" },
    { icon: Star, label: "Vendor Rating", value: "4.6 / 5", tone: "text-accent-foreground" },
  ];
  return (
    <div className="space-y-5">
      <SubHeading>Performance Metrics</SubHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-surface p-3">
            <m.icon className={cn("h-4 w-4", m.tone)} />
            <p className="mt-2 text-lg font-bold text-foreground">{m.value}</p>
            <p className="text-2xs text-muted">{m.label}</p>
          </div>
        ))}
      </div>
      <SubHeading>Rating Parameters</SubHeading>
      <Fields defs={RATING_FIELDS} />
    </div>
  );
}
function AccountingTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Accounts Payable</SubHeading>
      <Fields defs={ACCOUNTING_FIELDS.slice(0, 3)} />
      <SubHeading>Opening Balance</SubHeading>
      <Fields defs={ACCOUNTING_FIELDS.slice(3)} />
    </div>
  );
}
type AiMethod = {
  id: string;
  icon: LucideIcon;
  t: string;
  d: string;
  input: "upload" | "gstin" | "software";
};
const AI_METHODS: AiMethod[] = [
  { id: "gst-cert", icon: FileCheck2, t: "Upload GST Certificate", d: "95%+ · 30s", input: "upload" },
  { id: "gstin", icon: ReceiptText, t: "Enter GST Number", d: "90%+ · 10s", input: "gstin" },
  { id: "invoice", icon: ScanLine, t: "Upload Supplier Invoice", d: "90% · 45s", input: "upload" },
  { id: "card", icon: Contact, t: "Upload Visiting Card", d: "85% · 20s", input: "upload" },
  { id: "software", icon: DatabaseZap, t: "Import From Software", d: "95% · 2m", input: "software" },
  { id: "excel", icon: FileSpreadsheet, t: "Import From Excel", d: "100% · varies", input: "upload" },
];
const AI_CHECKS = ["Supplier Name", "GST Number", "PAN Number", "Address", "Contact Details", "Bank Information"];

function AiTab() {
  const { prefill, setApproval } = useSupplierForm();
  const [methodId, setMethodId] = useState("gst-cert");
  const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");
  const [confidence, setConfidence] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [fileName, setFileName] = useState("");
  const method = AI_METHODS.find((m) => m.id === methodId)!;

  useEffect(() => {
    if (phase !== "processing") return;
    setConfidence(0);
    setRevealed(0);
    let c = 0;
    const iv = window.setInterval(() => {
      c += 6;
      if (c >= 96) {
        c = 96;
        window.clearInterval(iv);
      }
      setConfidence(c);
    }, 80);
    const timers = AI_CHECKS.map((_, i) =>
      window.setTimeout(() => setRevealed(i + 1), 260 * (i + 1))
    );
    const done = window.setTimeout(() => {
      prefill({
        name: "Metro Cash & Carry",
        legalName: "Metro Wholesale India Pvt Ltd",
        gstin: "29AABCM1234C1Z5",
        pan: "AABCM1234C",
        regLine1: "Plot 21, Industrial Estate",
        regCity: "Bengaluru",
        regDistrict: "Bengaluru Urban",
        regState: "Karnataka",
        regPincode: "560058",
        c1Name: "Rakesh Mehta",
        c1Mobile: "+91 98765 43210",
        c1Email: "rakesh@metro.co.in",
      });
      setApproval("pending");
      setPhase("done");
    }, 1900);
    return () => {
      window.clearInterval(iv);
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(done);
    };
  }, [phase, prefill, setApproval]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white">
        <Sparkles className="h-6 w-6 shrink-0" />
        <div>
          <p className="text-sm font-bold">AI Smart Supplier Setup</p>
          <p className="text-xs text-white/85">Pick a source, load the document, and AI extracts name, GST, PAN, address, contacts &amp; bank — then you review.</p>
        </div>
      </div>

      {/* 1. Choose a source */}
      <SubHeading>1. Choose a source</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AI_METHODS.map((m) => {
          const on = methodId === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMethodId(m.id);
                setPhase("idle");
                setFileName("");
              }}
              className={cn(
                "rounded-xl border p-4 text-left transition",
                on ? "border-primary bg-primary-subtle/40 ring-1 ring-primary" : "border-border bg-surface hover:bg-surface-2"
              )}
            >
              <span className={cn("grid h-9 w-9 place-items-center rounded-lg", on ? "bg-brand-gradient text-white" : "bg-primary-subtle text-primary")}>
                <m.icon className="h-5 w-5" />
              </span>
              <p className="mt-2.5 text-sm font-semibold text-foreground">{m.t}</p>
              <p className="text-2xs text-muted">Accuracy {m.d}</p>
            </button>
          );
        })}
      </div>

      {/* 2. Load the document / input */}
      <SubHeading>2. Load the document</SubHeading>
      {(method.input === "upload" || method.input === "software") && (
        <div className="space-y-3">
          {method.input === "software" && (
            <div className="sm:max-w-xs">
              <Select
                label="Existing Software"
                options={["Tally", "Marg", "Busy", "Zoho", "Excel"].map((x) => ({ value: x, label: x }))}
                defaultValue="Tally"
                onChange={() => {}}
              />
            </div>
          )}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center transition hover:border-primary hover:bg-primary-subtle/30">
            <UploadCloud className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {fileName || `Click to upload — ${method.t}`}
            </span>
            <span className="text-2xs text-subtle">PDF, JPG, PNG or XLSX · up to 10 MB</span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "sample-document.pdf")}
            />
          </label>
          {fileName && (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-4 w-4" /> {fileName} ready to analyze
            </p>
          )}
        </div>
      )}
      {method.input === "gstin" && (
        <div className="sm:max-w-sm">
          <Input
            label="GST Number"
            placeholder="29AABCM1234C1Z5"
            defaultValue="29AABCM1234C1Z5"
            leadingIcon={<ReceiptText className="h-4 w-4" />}
            info="Enter the supplier's 15-digit GSTIN — AI fetches the rest."
          />
        </div>
      )}

      {/* 3. Analyze / result */}
      {phase === "processing" ? (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Analyzing document…
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {AI_CHECKS.map((c, i) => {
              const ok = i < revealed;
              return (
                <span key={c} className={cn("flex items-center gap-1.5 text-xs transition", ok ? "text-foreground" : "text-subtle/50")}>
                  <span className={cn("grid h-4 w-4 place-items-center rounded-full", ok ? "bg-success text-white" : "border border-border-strong")}>
                    {ok && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </span>
                  {c}
                </span>
              );
            })}
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted">Confidence Score</span>
              <span className="font-bold text-primary">{confidence}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${confidence}%` }} />
            </div>
          </div>
        </div>
      ) : phase === "done" ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-success/30 bg-success-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-5 w-5" /> Extracted with 96% confidence — review the other tabs, then Save.
          </span>
          <Button variant="outline" size="md" onClick={() => setPhase("idle")}>
            <RotateCcw className="h-4 w-4" /> Re-run
          </Button>
        </div>
      ) : (
        <Button size="lg" block onClick={() => setPhase("processing")}>
          <Sparkles className="h-4 w-4" /> Analyze with AI
        </Button>
      )}
    </div>
  );
}
function ImportTab() {
  const templates = ["Supplier Master", "Outstanding Balances", "Supplier Product Mapping"];
  return (
    <div className="space-y-5">
      <SubHeading>1. Download a template</SubHeading>
      <div className="grid gap-2 sm:grid-cols-3">
        {templates.map((t) => (
          <button key={t} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-xs font-medium text-foreground transition hover:border-primary hover:bg-surface-2">
            <Download className="h-4 w-4 shrink-0 text-primary" /> {t}
          </button>
        ))}
      </div>
      <SubHeading>2. Upload (Excel / CSV)</SubHeading>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center transition hover:border-primary hover:bg-primary-subtle/30">
        <FileSpreadsheet className="h-8 w-8 text-primary" />
        <span className="text-sm font-medium text-foreground">Drag &amp; drop or click to upload</span>
        <input type="file" className="hidden" accept=".xlsx,.csv" />
      </label>
      <SubHeading>3. Validation report</SubHeading>
      <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> 48 valid</span>
          <span className="inline-flex items-center gap-1.5 text-danger"><CircleAlert className="h-4 w-4" /> 2 errors</span>
        </div>
        <ul className="space-y-1 text-2xs text-muted">
          <li>Row 8 — Duplicate GST number “29AABCM1234C1Z5”.</li>
          <li>Row 23 — Invalid IFSC code “HDFC123”.</li>
        </ul>
      </div>
    </div>
  );
}
function ApprovalTab() {
  const { data, setApproval } = useSupplierForm();
  const flow = [
    { id: "draft", label: "Draft", desc: "Being created / edited" },
    { id: "pending", label: "Pending Approval", desc: "Submitted to checker(s)" },
    { id: "approved", label: "Approved", desc: "Live & transactable" },
    { id: "rejected", label: "Rejected", desc: "Returned with remarks" },
  ] as const;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg bg-primary-subtle/40 p-3">
        <GitPullRequestArrow className="h-5 w-5 text-primary" />
        <p className="text-xs text-foreground">Maker-Checker with multi-level approval — a supplier created by one user must be approved before transactions are allowed.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {flow.map((s) => (
          <button key={s.id} type="button" onClick={() => setApproval(s.id)} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left transition", data.approvalStatus === s.id ? "border-primary bg-primary-subtle/40 ring-1 ring-primary" : "border-border bg-surface hover:bg-surface-2")}>
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-2xs font-bold", data.approvalStatus === s.id ? "bg-brand-gradient text-white" : "bg-surface-2 text-muted")}>
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
  contact: ContactTab,
  address: AddressTab,
  gst: GstTab,
  banking: BankingTab,
  purchase: PurchaseTab,
  credit: CreditTab,
  products: ProductsTab,
  branch: BranchTab,
  documents: DocumentsTab,
  performance: PerformanceTab,
  accounting: AccountingTab,
  ai: AiTab,
  import: ImportTab,
  approval: ApprovalTab,
};

/* ============================================================ editor === */

export function SupplierEditor({ supplierId }: { supplierId?: string }) {
  const router = useRouter();
  const form = useSupplierForm();
  const toast = useToast();
  const isEdit = !!supplierId;
  const tabs = useMemo(() => SUPPLIER_TABS, []);
  const [activeId, setActiveId] = useState("general");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState("");
  const [scopeBranchId, setScopeBranchId] = useState<number | "all" | undefined>(undefined);

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const Body = TAB_BODIES[tabs[activeIndex].id];
  const gst = form.getField("gstin");
  const statusTone = form.data.approvalStatus === "approved" ? "success" : "warning";

  // Build the full master payload (general + contact + address + gst + banking +
  // credit + accounting) plus the address sub-records (registered, communication).
  function buildPayload() {
    const g = (n: string) => form.getField(n);
    const addresses: Record<string, unknown>[] = [];
    const reg = { label: "Registered", line1: g("regLine1"), line2: g("regLine2"), city: g("regCity"), district: g("regDistrict"), state: g("regState"), country: g("regCountry"), pincode: g("regPincode"), isDefault: true };
    if (reg.line1 || reg.city || reg.pincode) addresses.push(reg);
    if (!form.flag("sameAsReg")) {
      const comm = { label: "Communication", line1: g("commLine1"), city: g("commCity"), state: g("commState"), pincode: g("commPincode") };
      if (comm.line1 || comm.city || comm.pincode) addresses.push(comm);
    }
    return {
      name: g("name"), code: g("code"), legalName: g("legalName"), type: g("type"), category: g("category"), status: g("status"), website: g("website"), description: g("description"),
      contactPerson: g("c1Name"), contact1Designation: g("c1Designation"), phone: g("c1Mobile"), altMobile: g("c1AltMobile"), email: g("c1Email"),
      contact2Name: g("c2Name"), contact2Designation: g("c2Designation"), contact2Mobile: g("c2Mobile"), contact2Email: g("c2Email"),
      address: [g("regLine1"), g("regLine2")].filter(Boolean).join(", "), city: g("regCity"), state: g("regState"), pincode: g("regPincode"),
      addresses,
      gstin: g("gstin"), pan: g("pan"), tan: g("tan"), stateCode: g("stateCode"), placeOfSupply: g("placeOfSupply"), tdsPct: g("tdsPct"),
      bankName: g("bankName"), bankBranch: g("branch"), accountHolder: g("holder"), accountNumber: g("account"), ifsc: g("ifsc"), upi: g("upi"),
      creditAllowed: form.flag("creditAllowed"), creditLimit: g("creditLimit"), creditPeriod: g("creditPeriod"), paymentTerms: g("paymentTerms"),
      ledgerAccount: g("ledger"), advanceAccount: g("advanceAccount"), purchaseAccount: g("purchaseAccount"), openingPayable: g("openingPayable"), openingAdvance: g("openingAdvance"),
      preferred: form.flag("preferredSupplier"), approvalStatus: form.data.approvalStatus, notes: g("notes"),
      scopeBranchId: scopeBranchId ?? "all",
    };
  }

  // Persist the supplier (create or update) to the API.
  async function save() {
    if (!form.validate()) { setActiveId("general"); return; }
    setBusy(true); setApiError("");
    try {
      const url = isEdit ? `/api/masters/suppliers/${supplierId}` : "/api/masters/suppliers";
      const res = await fetch(url, { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) }).then((r) => r.json());
      if (!res.ok) { setApiError(res.message || "Could not save the supplier."); toast.error(res.message || "Could not save the supplier."); setActiveId("general"); return; }
      toast.success(res.message || "Supplier saved.");
      setSaved(true);
      window.setTimeout(() => router.push("/masters/supplier"), 1100);
    } catch { setApiError("Network error — please try again."); toast.error("Could not reach the server. Please try again."); } finally { setBusy(false); }
  }

  return (
    <EditorShell
      parentLabel="Suppliers"
      parentHref="/masters/supplier"
      cancelHref="/masters/supplier"
      title={form.getField("name") || (isEdit ? "Edit Supplier" : "New Supplier")}
      status={{ label: form.data.approvalStatus, tone: statusTone }}
      tabs={tabs}
      activeId={activeId}
      onTab={setActiveId}
      onAi={() => setActiveId("ai")}
      aiLabel="AI Smart Supplier Setup"
      onSaveDraft={() => form.setApproval("pending")}
      onSave={save}
      saveLabel={busy ? "Saving…" : "Save Supplier"}
      summaryTitle="Supplier Summary"
      summaryName={form.getField("name") || "New Supplier"}
      summaryCode={form.getField("code") || "—"}
      summaryBadges={[{ label: form.data.approvalStatus, tone: statusTone }, ...(form.getField("type") ? [{ label: form.getField("type"), tone: "neutral" as const }] : [])]}
      summaryFields={[
        { label: "Type", value: form.getField("type") },
        { label: "Category", value: form.getField("category") },
        { label: "GSTIN", value: gst, badge: gst.length === 15 ? { label: "Valid", tone: "success" } : undefined },
        { label: "Contact", value: form.getField("c1Name") },
        { label: "Mobile", value: form.getField("c1Mobile") },
        { label: "Email", value: form.getField("c1Email") },
      ]}
      ai={[
        { ok: gst.length === 15, text: gst.length === 15 ? "GSTIN format is valid" : "Enter a 15-digit GSTIN" },
        { ok: !!form.getField("stateCode"), text: form.getField("stateCode") ? `State code ${form.getField("stateCode")} detected` : "Add the GST state code" },
        { ok: form.rowsOf("banks").length > 0, text: form.rowsOf("banks").length > 0 ? "Bank details added" : "Add banking details for faster payments" },
      ]}
      saved={saved}
      savedText={`${form.getField("name") || "Supplier"} has been ${isEdit ? "updated" : "added"}. Redirecting…`}
    >
      {!isEdit && activeId === "general" && <div className="mb-3"><BranchScopeField value={scopeBranchId} onChange={setScopeBranchId} /></div>}
      {apiError && <div className="mb-3 rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{apiError}</div>}
      {Body && <Body />}
    </EditorShell>
  );
}
