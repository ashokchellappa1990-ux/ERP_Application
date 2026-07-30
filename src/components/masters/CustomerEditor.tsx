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
  GitPullRequestArrow,
  Loader2,
  Phone,
  ScanLine,
  FileCheck2,
  DatabaseZap,
  IndianRupee,
  ShoppingCart,
  TrendingUp,
  Star,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { useCustomerForm, type RowKey } from "./CustomerFormContext";
import {
  CUSTOMER_TABS,
  GENERAL_FIELDS,
  PERSONAL_FIELDS,
  PRIMARY_CONTACT_FIELDS,
  SECONDARY_CONTACT_FIELDS,
  BILL_ADDRESS_FIELDS,
  SHIP_ADDRESS_FIELDS,
  GST_FIELDS,
  CREDIT_FIELDS,
  LOYALTY_FIELDS,
  PREFERENCE_FIELDS,
  CRM_FIELDS,
  ACCOUNTING_FIELDS,
  ADDRESS_ROW_FIELDS,
  DOCUMENTS,
  COMM_PREFS,
  PRODUCT_CATEGORY_PREFS,
  RISK_OPTS,
  type CField,
  type CToggle,
} from "@/lib/masters/customerConfig";
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

function FieldRenderer({ def }: { def: CField }) {
  const { getField, setField, errors, customOptions, addOption } = useCustomerForm();
  const Icon = def.icon;
  const lead = Icon ? <Icon className="h-4 w-4" /> : undefined;
  const common = { label: def.label, info: def.info, sample: def.sample, error: errors[def.name] };
  if (def.type === "textarea") {
    return <Textarea {...common} rows={2} placeholder={def.sample} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
  }
  if (def.type === "select" && def.creatable) {
    const opts = [...(def.options ?? []), ...(customOptions[def.name] ?? []).map((v) => ({ value: v, label: v }))];
    return <CreatableSelect def={def} options={opts} onAdd={(v) => addOption(def.name, v)} />;
  }
  if (def.type === "select") {
    return <Select {...common} leadingIcon={lead} placeholder="Select…" options={def.options ?? []} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
  }
  return <Input {...common} leadingIcon={lead} type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"} placeholder={def.sample} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
}

function CreatableSelect({ def, options, onAdd }: { def: CField; options: { value: string; label: string }[]; onAdd: (v: string) => void }) {
  const { getField, setField } = useCustomerForm();
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

function Fields({ defs }: { defs: CField[] }) {
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

function ToggleGrid({ group, items, cols = 2 }: { group: string; items: CToggle[]; cols?: 2 | 3 }) {
  const { isOn, toggle } = useCustomerForm();
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
  const { flag, setFlag } = useCustomerForm();
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

function Repeatable({ rowKey, addLabel, empty, defs }: { rowKey: RowKey; addLabel: string; empty: string; defs: CField[] }) {
  const { rowsOf, addRow, updateRow, removeRow } = useCustomerForm();
  const rows = rowsOf(rowKey);
  return (
    <div className="space-y-4">
      {rows.length === 0 && <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-8 text-center text-sm text-muted">{empty}</div>}
      {rows.map((r, i) => (
        <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <Badge tone="primary">#{i + 1}</Badge>
            <button type="button" onClick={() => removeRow(rowKey, r.id)} className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
          </div>
          <Grid>
            {defs.map((d) => (
              <div key={d.name} className={d.full ? "sm:col-span-2 lg:col-span-3" : ""}>
                {d.type === "select" ? (
                  <Select label={d.label} options={d.options ?? []} value={r[d.name] ?? ""} onChange={(e) => updateRow(rowKey, r.id, { [d.name]: e.target.value })} />
                ) : (
                  <Input label={d.label} placeholder={d.sample} leadingIcon={d.icon ? <d.icon className="h-4 w-4" /> : undefined} value={r[d.name] ?? ""} onChange={(e) => updateRow(rowKey, r.id, { [d.name]: e.target.value })} />
                )}
              </div>
            ))}
          </Grid>
        </div>
      ))}
      <Button variant="outline" size="md" onClick={() => addRow(rowKey)}><Plus className="h-4 w-4" /> {addLabel}</Button>
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

// B2C personal fields (DOB / Anniversary / Gender) are shown only when enabled in
// Sales Settings → B2C Customer Fields. Defaults mirror salesConfigDefaults until
// the live config loads.
const DEFAULT_B2C_FIELDS: Record<string, boolean> = { dob: true, anniversary: true, gender: false };
function useB2cCustomerFields() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(DEFAULT_B2C_FIELDS);
  useEffect(() => {
    let on = true;
    fetch("/api/settings/sales")
      .then((r) => r.json())
      .then((j) => { if (on && j?.ok) setEnabled(j.config?.toggles?.customerCapture ?? DEFAULT_B2C_FIELDS); })
      .catch(() => {});
    return () => { on = false; };
  }, []);
  return enabled;
}

function GeneralTab() {
  const b2c = useB2cCustomerFields();
  const personal = PERSONAL_FIELDS.filter((f) => b2c[f.name]);
  return (
    <div className="space-y-5">
      <Fields defs={GENERAL_FIELDS} />
      {personal.length > 0 && (
        <>
          <SubHeading>Personal Details</SubHeading>
          <Fields defs={personal} />
        </>
      )}
    </div>
  );
}
function ContactTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Primary Contact</SubHeading>
      <Fields defs={PRIMARY_CONTACT_FIELDS} />
      <SubHeading>Secondary Contact</SubHeading>
      <Fields defs={SECONDARY_CONTACT_FIELDS} />
      <SubHeading>Communication Preference</SubHeading>
      <ToggleGrid group="commPrefs" items={COMM_PREFS} cols={3} />
    </div>
  );
}
function AddressTab() {
  const { flag } = useCustomerForm();
  return (
    <div className="space-y-5">
      <SubHeading>Billing Address</SubHeading>
      <Fields defs={BILL_ADDRESS_FIELDS} />
      <Flag id="sameAsBilling" label="Shipping address same as billing" />
      {!flag("sameAsBilling") && (
        <>
          <SubHeading>Shipping Address</SubHeading>
          <Fields defs={SHIP_ADDRESS_FIELDS} />
        </>
      )}
      <SubHeading>Additional Addresses</SubHeading>
      <Repeatable rowKey="addresses" addLabel="Add Address" empty="No additional addresses. Add Home / Office / Delivery addresses." defs={ADDRESS_ROW_FIELDS} />
    </div>
  );
}
function GstTab() {
  const { getField, setField } = useCustomerForm();
  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">Applicable for B2B / registered customers. Leave blank for walk-in retail.</p>
      <SubHeading>Customer GST Type</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["registered", "Registered"], ["unregistered", "Unregistered"], ["sez", "SEZ"], ["export", "Export"]].map(([id, t]) => (
          <RadioCard key={id} selected={getField("gstType") === id} onSelect={() => setField("gstType", id)} title={t} />
        ))}
      </div>
      <Fields defs={GST_FIELDS} />
      <div className="flex items-center gap-3 rounded-lg border border-secondary/30 bg-secondary-subtle/50 p-3">
        <ShieldCheck className="h-5 w-5 text-secondary" />
        <p className="flex-1 text-xs text-foreground">Validate the GSTIN against the GST portal before saving.</p>
        <Button variant="secondary" size="sm">Verify GSTIN</Button>
      </div>
    </div>
  );
}
function CreditTab() {
  const { getField, setField, flag } = useCustomerForm();
  return (
    <div className="space-y-5">
      <Flag id="creditAllowed" label="Credit Allowed" desc="Allow this customer to buy on credit" />
      {flag("creditAllowed") && (
        <>
          <Fields defs={CREDIT_FIELDS} />
          <SubHeading>Outstanding Control</SubHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            <Flag id="blockOnExceed" label="Block Billing on Limit Exceeded" />
            <Flag id="warnOnExceed" label="Warning on Limit Exceeded" />
          </div>
        </>
      )}
      <SubHeading>Customer Risk Rating</SubHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        {RISK_OPTS.map((r) => (
          <RadioCard key={r.value} selected={getField("riskRating") === r.value} onSelect={() => setField("riskRating", r.value)} title={r.label} />
        ))}
      </div>
    </div>
  );
}
function LoyaltyTab() {
  const { flag } = useCustomerForm();
  return (
    <div className="space-y-5">
      <Flag id="loyaltyMember" label="Loyalty Member" desc="Enroll in the loyalty program" />
      {flag("loyaltyMember") && <Fields defs={LOYALTY_FIELDS} />}
    </div>
  );
}
function PreferencesTab() {
  return (
    <div className="space-y-5">
      <Fields defs={PREFERENCE_FIELDS} />
      <SubHeading>Preferred Product Categories</SubHeading>
      <ToggleGrid group="categoryPrefs" items={PRODUCT_CATEGORY_PREFS} cols={3} />
    </div>
  );
}
function CrmTab() {
  return <Fields defs={CRM_FIELDS} />;
}
function AccountingTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Receivables</SubHeading>
      <Fields defs={ACCOUNTING_FIELDS.slice(0, 2)} />
      <SubHeading>Opening Balances</SubHeading>
      <Fields defs={ACCOUNTING_FIELDS.slice(2)} />
    </div>
  );
}
function DocumentsTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Upload Documents</SubHeading>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOCUMENTS.map((d) => <Dropzone key={d.id} label={d.label} />)}
      </div>
    </div>
  );
}
function AnalyticsTab() {
  const metrics: { icon: LucideIcon; label: string; value: string; tone: string }[] = [
    { icon: ShoppingCart, label: "Total Purchases", value: "128", tone: "text-primary" },
    { icon: IndianRupee, label: "Total Sales Value", value: "₹4.8L", tone: "text-success" },
    { icon: TrendingUp, label: "Avg Purchase Value", value: "₹3,750", tone: "text-primary" },
    { icon: IndianRupee, label: "Outstanding", value: "₹0", tone: "text-success" },
    { icon: Star, label: "Loyalty Points", value: "1,250", tone: "text-accent-foreground" },
    { icon: Gauge, label: "Customer Rating", value: "4.7 / 5", tone: "text-success" },
  ];
  const scores: { label: string; value: number; tone: string }[] = [
    { label: "Revenue Score", value: 86, tone: "var(--color-primary)" },
    { label: "Loyalty Score", value: 72, tone: "var(--color-accent)" },
    { label: "Engagement Score", value: 64, tone: "var(--color-secondary)" },
  ];
  return (
    <div className="space-y-5">
      <SubHeading>Customer Metrics</SubHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-surface p-3">
            <m.icon className={cn("h-4 w-4", m.tone)} />
            <p className="mt-2 text-lg font-bold text-foreground">{m.value}</p>
            <p className="text-2xs text-muted">{m.label}</p>
          </div>
        ))}
      </div>
      <SubHeading>Customer Score</SubHeading>
      <div className="space-y-3">
        {scores.map((s) => (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{s.label}</span>
              <span className="font-bold text-foreground">{s.value}/100</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full" style={{ width: `${s.value}%`, background: s.tone }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const AI_METHODS = [
  { id: "mobile", icon: Phone, t: "Mobile Number Lookup", d: "92% · 5s", input: "mobile" },
  { id: "card", icon: ScanLine, t: "Visiting Card Scan", d: "85% · 20s", input: "upload" },
  { id: "gst", icon: FileCheck2, t: "GST Certificate Upload", d: "95% · 30s", input: "upload" },
  { id: "excel", icon: FileSpreadsheet, t: "Customer Excel Upload", d: "100% · varies", input: "upload" },
  { id: "software", icon: DatabaseZap, t: "Existing Software Import", d: "95% · 2m", input: "software" },
] as const;
const AI_CHECKS = ["Customer Name", "Mobile Number", "Email", "GST Number", "Address", "Business Details"];

function AiTab() {
  const { prefill, setApproval } = useCustomerForm();
  const [methodId, setMethodId] = useState("mobile");
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
    const iv = window.setInterval(() => { c += 6; if (c >= 94) { c = 94; window.clearInterval(iv); } setConfidence(c); }, 80);
    const timers = AI_CHECKS.map((_, i) => window.setTimeout(() => setRevealed(i + 1), 260 * (i + 1)));
    const done = window.setTimeout(() => {
      prefill({
        name: "Priya Sharma",
        c1Name: "Priya Sharma",
        c1Mobile: "+91 98765 43210",
        c1Email: "priya@example.com",
        gstin: "29AABCS1234C1Z5",
        pan: "AABCS1234C",
        billLine1: "12, 4th Cross",
        billCity: "Bengaluru",
        billState: "Karnataka",
        billPincode: "560038",
      });
      setApproval("pending");
      setPhase("done");
    }, 1800);
    return () => { window.clearInterval(iv); timers.forEach((t) => window.clearTimeout(t)); window.clearTimeout(done); };
  }, [phase, prefill, setApproval]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white">
        <Sparkles className="h-6 w-6 shrink-0" />
        <div>
          <p className="text-sm font-bold">AI Smart Customer Creation</p>
          <p className="text-xs text-white/85">Look up a mobile number or load a document — AI extracts name, mobile, email, GST &amp; address.</p>
        </div>
      </div>

      <SubHeading>1. Choose a source</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AI_METHODS.map((m) => {
          const on = methodId === m.id;
          return (
            <button key={m.id} type="button" onClick={() => { setMethodId(m.id); setPhase("idle"); setFileName(""); }} className={cn("rounded-xl border p-4 text-left transition", on ? "border-primary bg-primary-subtle/40 ring-1 ring-primary" : "border-border bg-surface hover:bg-surface-2")}>
              <span className={cn("grid h-9 w-9 place-items-center rounded-lg", on ? "bg-brand-gradient text-white" : "bg-primary-subtle text-primary")}><m.icon className="h-5 w-5" /></span>
              <p className="mt-2.5 text-sm font-semibold text-foreground">{m.t}</p>
              <p className="text-2xs text-muted">Accuracy {m.d}</p>
            </button>
          );
        })}
      </div>

      <SubHeading>2. {method.input === "mobile" ? "Enter the mobile number" : "Load the document"}</SubHeading>
      {method.input === "mobile" && (
        <div className="sm:max-w-sm">
          <Input label="Mobile Number" placeholder="+91 98765 43210" defaultValue="+91 98765 43210" leadingIcon={<Phone className="h-4 w-4" />} info="AI looks up existing records & public data for this number." />
        </div>
      )}
      {(method.input === "upload" || method.input === "software") && (
        <div className="space-y-3">
          {method.input === "software" && (
            <div className="sm:max-w-xs">
              <Select label="Existing Software" options={["Tally", "Marg", "Busy", "Zoho", "Excel"].map((x) => ({ value: x, label: x }))} defaultValue="Tally" onChange={() => {}} />
            </div>
          )}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center transition hover:border-primary hover:bg-primary-subtle/30">
            <UploadCloud className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium text-foreground">{fileName || `Click to upload — ${method.t}`}</span>
            <span className="text-2xs text-subtle">PDF, JPG, PNG or XLSX · up to 10 MB</span>
            <input type="file" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "sample-document.pdf")} />
          </label>
        </div>
      )}

      {phase === "processing" ? (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Analyzing…</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {AI_CHECKS.map((c, i) => {
              const ok = i < revealed;
              return (
                <span key={c} className={cn("flex items-center gap-1.5 text-xs transition", ok ? "text-foreground" : "text-subtle/50")}>
                  <span className={cn("grid h-4 w-4 place-items-center rounded-full", ok ? "bg-success text-white" : "border border-border-strong")}>{ok && <Check className="h-2.5 w-2.5" strokeWidth={3} />}</span>
                  {c}
                </span>
              );
            })}
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted">Confidence Score</span><span className="font-bold text-primary">{confidence}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${confidence}%` }} /></div>
          </div>
        </div>
      ) : phase === "done" ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-success/30 bg-success-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-5 w-5" /> Extracted with 94% confidence — review the tabs, then Save.</span>
          <Button variant="outline" size="md" onClick={() => setPhase("idle")}>Re-run</Button>
        </div>
      ) : (
        <Button size="lg" block onClick={() => setPhase("processing")}><Sparkles className="h-4 w-4" /> Analyze with AI</Button>
      )}
    </div>
  );
}

function ImportTab() {
  const templates = ["Customer Master", "Outstanding Balances", "Loyalty Data"];
  return (
    <div className="space-y-5">
      <SubHeading>1. Download a template</SubHeading>
      <div className="grid gap-2 sm:grid-cols-3">
        {templates.map((t) => (
          <button key={t} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-xs font-medium text-foreground transition hover:border-primary hover:bg-surface-2"><Download className="h-4 w-4 shrink-0 text-primary" /> {t}</button>
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
          <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> 312 valid</span>
          <span className="inline-flex items-center gap-1.5 text-danger"><CircleAlert className="h-4 w-4" /> 5 errors</span>
        </div>
        <ul className="space-y-1 text-2xs text-muted">
          <li>Row 18 — Duplicate mobile number.</li>
          <li>Row 44 — Invalid email address.</li>
          <li>Row 91 — Duplicate customer code.</li>
        </ul>
      </div>
    </div>
  );
}

function ApprovalTab() {
  const { data, setApproval } = useCustomerForm();
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
        <p className="text-xs text-foreground">Maker-Checker with multi-level approval — credit customers may need finance sign-off before transactions.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {flow.map((s) => (
          <button key={s.id} type="button" onClick={() => setApproval(s.id)} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left transition", data.approvalStatus === s.id ? "border-primary bg-primary-subtle/40 ring-1 ring-primary" : "border-border bg-surface hover:bg-surface-2")}>
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-2xs font-bold", data.approvalStatus === s.id ? "bg-brand-gradient text-white" : "bg-surface-2 text-muted")}>{data.approvalStatus === s.id ? <Check className="h-4 w-4" /> : ""}</span>
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
  credit: CreditTab,
  loyalty: LoyaltyTab,
  preferences: PreferencesTab,
  crm: CrmTab,
  accounting: AccountingTab,
  documents: DocumentsTab,
  analytics: AnalyticsTab,
  ai: AiTab,
  import: ImportTab,
  approval: ApprovalTab,
};

/* ============================================================ editor === */

export function CustomerEditor({ customerId }: { customerId?: string }) {
  const router = useRouter();
  const form = useCustomerForm();
  const toast = useToast();
  const isEdit = !!customerId;
  const tabs = useMemo(() => CUSTOMER_TABS, []);
  const [activeId, setActiveId] = useState("general");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState("");
  const [scopeBranchId, setScopeBranchId] = useState<number | "all" | undefined>(undefined);

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const Body = TAB_BODIES[tabs[activeIndex].id];
  const statusTone = form.data.approvalStatus === "approved" ? "success" : "warning";
  const tier = form.getField("loyaltyTier");

  // Build the full master payload (general + contact + address + gst + credit +
  // accounting), plus the addresses sub-records (billing, shipping, extra rows).
  function buildPayload() {
    const g = (n: string) => form.getField(n);
    const addresses: Record<string, unknown>[] = [];
    const bill = { label: "Billing", line1: g("billLine1"), line2: g("billLine2"), city: g("billCity"), district: g("billDistrict"), state: g("billState"), country: g("billCountry"), pincode: g("billPincode"), isDefault: true };
    if (bill.line1 || bill.city || bill.pincode) addresses.push(bill);
    if (!form.flag("sameAsBilling")) {
      const ship = { label: "Shipping", line1: g("shipLine1"), city: g("shipCity"), state: g("shipState"), pincode: g("shipPincode") };
      if (ship.line1 || ship.city || ship.pincode) addresses.push(ship);
    }
    for (const r of form.rowsOf("addresses")) if (r.line1 || r.city || r.pincode) addresses.push({ label: r.type || "Other", line1: r.line1, city: r.city, pincode: r.pincode });
    return {
      name: g("name"), code: g("code"), legalName: g("legalName"), type: g("type"), category: g("category"), status: g("status"), regDate: g("regDate"), since: g("since"),
      phone: g("c1Mobile"), email: g("c1Email"), contactPerson: g("c1Name"), altMobile: g("c1AltMobile"), whatsapp: g("c1Whatsapp"),
      contact2Name: g("c2Name"), contact2Mobile: g("c2Mobile"), contact2Email: g("c2Email"), dob: g("dob"), anniversary: g("anniversary"), gender: g("gender"),
      address: [g("billLine1"), g("billLine2")].filter(Boolean).join(", "), city: g("billCity"), state: g("billState"), pincode: g("billPincode"),
      addresses,
      gstin: g("gstin").trim().toUpperCase(), pan: g("pan").trim().toUpperCase(), tan: g("tan"), businessName: g("businessName"), stateCode: g("stateCode"),
      creditAllowed: form.flag("creditAllowed"), creditLimit: g("creditLimit"), creditPeriod: g("creditPeriod"),
      ledgerAccount: g("ledger"), advanceAccount: g("advanceAccount"), openingReceivable: g("openingReceivable"), openingAdvance: g("openingAdvance"),
      approvalStatus: form.data.approvalStatus, notes: g("notes"),
      scopeBranchId: scopeBranchId ?? "all",
    };
  }

  // Which tab each validated field lives on — so a validation error focuses the
  // right tab (e.g. a GSTIN error jumps to GST & Tax, not General).
  const FIELD_TAB: Record<string, string> = { name: "general", code: "general", c1Name: "contact", c1Mobile: "contact", c1Email: "contact", gstin: "gst", pan: "gst" };

  // Persist the customer (create or update) to the API.
  async function save() {
    const errs = form.validate();
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      setActiveId(FIELD_TAB[first] ?? "general");
      toast.error(errs[first]);
      return;
    }
    setBusy(true); setApiError("");
    try {
      const url = isEdit ? `/api/masters/customers/${customerId}` : "/api/masters/customers";
      const res = await fetch(url, { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) }).then((r) => r.json());
      if (!res.ok) { setApiError(res.message || "Could not save the customer."); toast.error(res.message || "Could not save the customer."); setActiveId("general"); return; }
      toast.success(res.message || "Customer saved.");
      setSaved(true);
      window.setTimeout(() => router.push("/masters/customer"), 1100);
    } catch { setApiError("Network error — please try again."); toast.error("Could not reach the server. Please try again."); } finally { setBusy(false); }
  }

  return (
    <EditorShell
      parentLabel="Customers"
      parentHref="/masters/customer"
      cancelHref="/masters/customer"
      title={form.getField("name") || (isEdit ? "Edit Customer" : "New Customer")}
      status={{ label: form.data.approvalStatus, tone: statusTone }}
      tabs={tabs}
      activeId={activeId}
      onTab={setActiveId}
      onAi={() => setActiveId("ai")}
      aiLabel="AI Smart Customer Creation"
      onSaveDraft={() => form.setApproval("pending")}
      onSave={save}
      saveLabel={busy ? "Saving…" : "Save Customer"}
      summaryTitle="Customer Summary"
      summaryName={form.getField("name") || "New Customer"}
      summaryCode={form.getField("code") || "—"}
      summaryBadges={[{ label: form.data.approvalStatus, tone: statusTone }, ...(form.getField("category") ? [{ label: form.getField("category"), tone: "primary" as const }] : [])]}
      summaryFields={[
        { label: "Type", value: form.getField("type") },
        { label: "Mobile", value: form.getField("c1Mobile") },
        { label: "Email", value: form.getField("c1Email") },
        { label: "Loyalty", value: form.flag("loyaltyMember") ? tier || "Member" : "—", badge: form.flag("loyaltyMember") ? { label: "Member", tone: "primary" as const } : undefined },
        { label: "Credit", value: form.flag("creditAllowed") ? form.getField("creditLimit") || "Allowed" : "—" },
      ]}
      ai={[
        { ok: !!form.getField("c1Mobile"), text: form.getField("c1Mobile") ? "Mobile captured for loyalty & OTP" : "Add a mobile number" },
        { ok: form.flag("loyaltyMember"), text: form.flag("loyaltyMember") ? "Enrolled in loyalty program" : "Enroll in loyalty for repeat sales" },
        { ok: !form.getField("gstin") || form.getField("gstin").length === 15, text: form.getField("gstin") && form.getField("gstin").length !== 15 ? "GSTIN should be 15 digits" : "GST details OK" },
      ]}
      saved={saved}
      savedText={`${form.getField("name") || "Customer"} has been ${isEdit ? "updated" : "added"}. Redirecting…`}
    >
      {!isEdit && activeId === "general" && <div className="mb-3"><BranchScopeField value={scopeBranchId} onChange={setScopeBranchId} /></div>}
      {apiError && <div className="mb-3 rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{apiError}</div>}
      {Body && <Body />}
    </EditorShell>
  );
}
