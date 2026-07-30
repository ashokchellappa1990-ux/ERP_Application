"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import {
  Plus,
  Trash2,
  Building2,
  Building,
  UploadCloud,
  ShieldCheck,
  FileText,
  Store,
  Tag,
  Briefcase,
  Calendar,
  ReceiptText,
  CreditCard,
  BadgeCheck,
  Utensils,
  Pill,
  Mail,
  Phone,
  Globe,
  MapPin,
  Hash,
  Users,
  TrendingUp,
  Clock,
  Coins,
  Layers,
  Target,
  User,
  AtSign,
  Lock,
  Landmark,
  Warehouse as WarehouseIcon,
  GitBranch,
  UserCog,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { useSetup } from "./SetupContext";
import {
  INDUSTRIES,
  OWNERSHIP_TYPES,
  TURNOVER_RANGES,
  EMPLOYEE_RANGES,
  BRANCH_TYPES,
  WAREHOUSE_TYPES,
  ACCOUNT_TYPES,
  ROLES,
  MIGRATION_SOURCES,
  WEEKDAYS,
  INVENTORY_TOGGLES,
  INVENTORY_RULES,
  POS_TOGGLES,
  RECEIPT_TOGGLES,
  PAYMENT_MODES,
  NOTIFY_CHANNELS,
  NOTIFY_EVENTS,
  HARDWARE_TOGGLES,
  MODULE_TOGGLES,
  SECURITY_TOGGLES,
  MIGRATION_IMPORTS,
  type ToggleItem,
  type StepId,
} from "@/lib/setup/config";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { RadioCard } from "@/components/ui/RadioCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

/* ============================================================ helpers === */

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

type FlatSection = "company" | "profile" | "finance" | "gst" | "org" | "admin";
type ArrayKey = "branches" | "warehouses" | "banks" | "users";

interface FieldDef {
  name: string;
  label: string;
  icon: LucideIcon;
  info: string;
  sample?: string;
  type?: string;
  options?: SelectOption[];
  full?: boolean;
}

function TextField({
  section,
  name,
  label,
  icon: Icon,
  info,
  sample,
  errKey,
  type,
  placeholder,
}: {
  section: FlatSection;
  name: string;
  label: string;
  icon?: LucideIcon;
  info?: string;
  sample?: string;
  errKey?: string;
  type?: string;
  placeholder?: string;
}) {
  const { data, patch, errors } = useSetup();
  const val = (data[section] as Record<string, string>)[name] ?? "";
  return (
    <Input
      label={label}
      type={type}
      placeholder={placeholder ?? sample}
      leadingIcon={Icon ? <Icon className="h-4 w-4" /> : undefined}
      info={info}
      sample={sample}
      value={val}
      onChange={(e) => patch(section, { [name]: e.target.value })}
      error={errors[errKey ?? `${section}.${name}`]}
    />
  );
}

function SelectField({
  section,
  name,
  label,
  options,
  icon: Icon,
  info,
  sample,
  errKey,
}: {
  section: FlatSection;
  name: string;
  label: string;
  options: SelectOption[];
  icon?: LucideIcon;
  info?: string;
  sample?: string;
  errKey?: string;
}) {
  const { data, patch, errors } = useSetup();
  const val = (data[section] as Record<string, string>)[name] ?? "";
  return (
    <Select
      label={label}
      options={options}
      placeholder="Select…"
      leadingIcon={Icon ? <Icon className="h-4 w-4" /> : undefined}
      info={info}
      sample={sample}
      value={val}
      onChange={(e) => patch(section, { [name]: e.target.value })}
      error={errors[errKey ?? `${section}.${name}`]}
    />
  );
}

function FlatFields({ section, defs }: { section: FlatSection; defs: FieldDef[] }) {
  return (
    <Grid>
      {defs.map((d) => (
        <div key={d.name} className={d.full ? "sm:col-span-2 lg:col-span-3" : ""}>
          {d.options ? (
            <SelectField
              section={section}
              name={d.name}
              label={d.label}
              options={d.options}
              icon={d.icon}
              info={d.info}
              sample={d.sample}
            />
          ) : (
            <TextField
              section={section}
              name={d.name}
              label={d.label}
              type={d.type}
              icon={d.icon}
              info={d.info}
              sample={d.sample}
            />
          )}
        </div>
      ))}
    </Grid>
  );
}

function ContactField({
  which,
  name,
  label,
  icon: Icon,
  info,
  sample,
  type,
}: {
  which: "primary" | "secondary";
  name: string;
  label: string;
  icon: LucideIcon;
  info: string;
  sample: string;
  type?: string;
}) {
  const { data, patchContact, errors } = useSetup();
  return (
    <Input
      label={label}
      type={type}
      placeholder={sample}
      leadingIcon={<Icon className="h-4 w-4" />}
      info={info}
      sample={sample}
      value={data.contacts[which][name] ?? ""}
      onChange={(e) => patchContact(which, { [name]: e.target.value })}
      error={errors[`${which}.${name}`]}
    />
  );
}

function ToggleGrid({
  group,
  items,
  cols = 2,
}: {
  group: string;
  items: ToggleItem[];
  cols?: 2 | 3;
}) {
  const { isOn, toggle } = useSetup();
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3")}>
      {items.map((it) => {
        const on = isOn(group, it.id);
        return (
          <label
            key={it.id}
            className={cn(
              "flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3.5 transition",
              on
                ? "border-primary/40 bg-primary-subtle/40"
                : "border-border bg-surface hover:bg-surface-2"
            )}
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {it.label}
              </span>
              {it.desc && (
                <span className="mt-0.5 block text-2xs text-muted">{it.desc}</span>
              )}
            </span>
            <Switch checked={on} onChange={() => toggle(group, it.id)} aria-label={it.label} />
          </label>
        );
      })}
    </div>
  );
}

function FlagSwitch({ id, label, desc }: { id: string; label: string; desc?: string }) {
  const { flag, setFlag } = useSetup();
  const on = flag(id);
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {desc && <span className="text-2xs text-muted">{desc}</span>}
      </span>
      <Switch checked={on} onChange={(v) => setFlag(id, v)} aria-label={label} />
    </label>
  );
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

/* ======================================================= field metadata = */

const COMPANY_FIELDS: FieldDef[] = [
  { name: "name", label: "Company Name *", icon: Building2, info: "Registered trading name shown on invoices, receipts and reports.", sample: "Rao Super Market Pvt Ltd" },
  { name: "legalName", label: "Legal Entity Name", icon: FileText, info: "Full legal name exactly as per incorporation / registration.", sample: "Rao Retail Private Limited" },
  { name: "businessType", label: "Business Type", icon: Store, info: "Your primary mode of trade.", sample: "Retail" },
  { name: "industry", label: "Industry Category *", icon: Tag, info: "Determines vertical-specific defaults across the product.", sample: "Grocery & Supermarket", options: INDUSTRIES },
  { name: "nature", label: "Nature of Business", icon: Briefcase, info: "A short description of what you sell or do.", sample: "Supermarket & daily essentials" },
  { name: "established", label: "Date of Establishment", icon: Calendar, info: "The date the business began operating.", type: "date" },
  { name: "gst", label: "GST Number", icon: ReceiptText, info: "15-digit GSTIN issued by the GST department.", sample: "29ABCDE1234F1Z5" },
  { name: "pan", label: "PAN Number", icon: CreditCard, info: "10-character Permanent Account Number of the entity.", sample: "ABCDE1234F" },
  { name: "cin", label: "CIN Number", icon: FileText, info: "Corporate Identification Number (Pvt / Public Ltd only).", sample: "U52190KA2020PTC012345" },
  { name: "udyam", label: "MSME / Udyam Number", icon: BadgeCheck, info: "MSME registration number for scheme & loan benefits.", sample: "UDYAM-KR-03-0001234" },
  { name: "fssai", label: "FSSAI Number", icon: Utensils, info: "Food safety licence — for grocery & food retail.", sample: "12345678901234" },
  { name: "drugLicense", label: "Drug License Number", icon: Pill, info: "Drug licence — required for pharmacy / medical stores.", sample: "KA-B21-123456" },
  { name: "email", label: "Company Email", icon: Mail, info: "Primary email for invoices and official communication.", sample: "info@raomart.com" },
  { name: "phone", label: "Company Phone *", icon: Phone, info: "Main contact number for the business.", sample: "+91 98765 43210" },
  { name: "website", label: "Website", icon: Globe, info: "Public website or store page (optional).", sample: "https://raomart.com" },
];

const COMPANY_ADDRESS_FIELDS: FieldDef[] = [
  { name: "country", label: "Country", icon: Globe, info: "Country of operation.", sample: "India" },
  { name: "state", label: "State", icon: MapPin, info: "State / UT — drives the GST state code.", sample: "Karnataka" },
  { name: "city", label: "City", icon: MapPin, info: "City or town of the head office.", sample: "Bengaluru" },
  { name: "pincode", label: "Pincode", icon: Hash, info: "6-digit postal code.", sample: "560001" },
];

const PROFILE_FIELDS: FieldDef[] = [
  { name: "employees", label: "Number of Employees", icon: Users, info: "Approximate headcount — sets HR & payroll defaults.", sample: "11–50", options: EMPLOYEE_RANGES },
  { name: "turnover", label: "Annual Turnover Range", icon: TrendingUp, info: "Revenue band — used for GST & compliance hints.", sample: "₹1.5 Cr – ₹5 Cr", options: TURNOVER_RANGES },
  { name: "ownership", label: "Business Ownership Type", icon: Building2, info: "Legal ownership structure of the business.", sample: "Private Limited", options: OWNERSHIP_TYPES },
];
const PROFILE_TIME_FIELDS: FieldDef[] = [
  { name: "startTime", label: "Business Start Time", icon: Clock, info: "Daily opening time of the store.", sample: "09:00", type: "time" },
  { name: "endTime", label: "Business End Time", icon: Clock, info: "Daily closing time of the store.", sample: "21:00", type: "time" },
];

const FINANCE_FIELDS: FieldDef[] = [
  { name: "fyStart", label: "Financial Year Start Date", icon: Calendar, info: "Start of your financial year (India: 1 April).", type: "date" },
  { name: "fyEnd", label: "Financial Year End Date", icon: Calendar, info: "End of your financial year (India: 31 March).", type: "date" },
  { name: "acctStart", label: "Accounting Start Date", icon: Calendar, info: "Date from which books are maintained in Oasys ERP.", type: "date" },
  { name: "currency", label: "Base Currency", icon: Coins, info: "Default currency for transactions and reports.", sample: "INR", options: [
    { value: "INR", label: "₹ Indian Rupee (INR)" },
    { value: "USD", label: "$ US Dollar (USD)" },
    { value: "AED", label: "AED UAE Dirham" },
  ] },
  { name: "costCenter", label: "Default Cost Center", icon: Layers, info: "Default cost center for expense allocation.", sample: "Main Store" },
  { name: "profitCenter", label: "Default Profit Center", icon: Target, info: "Default profit center for performance tracking.", sample: "Retail" },
];

const GST_FIELDS: FieldDef[] = [
  { name: "gstin", label: "GSTIN", icon: ReceiptText, info: "15-digit GST Identification Number.", sample: "29ABCDE1234F1Z5" },
  { name: "pan", label: "PAN", icon: CreditCard, info: "PAN linked to the GST registration.", sample: "ABCDE1234F" },
  { name: "stateCode", label: "State Code", icon: Hash, info: "2-digit GST state code (e.g. 29 = Karnataka).", sample: "29" },
  { name: "effective", label: "GST Effective Date", icon: Calendar, info: "Date the GST registration became effective.", type: "date" },
];

const ADMIN_FIELDS: FieldDef[] = [
  { name: "name", label: "Full Name *", icon: User, info: "Full name of the primary administrator.", sample: "Arjun Rao" },
  { name: "mobile", label: "Mobile Number *", icon: Phone, info: "Mobile used for OTP and critical alerts.", sample: "+91 98765 43210" },
  { name: "email", label: "Email Address *", icon: Mail, info: "Sign-in email and notifications.", sample: "arjun@raomart.com", type: "email" },
  { name: "username", label: "Username *", icon: AtSign, info: "Unique username for signing in.", sample: "arjun.rao" },
  { name: "password", label: "Password *", icon: Lock, info: "Min 8 characters incl. uppercase, number & symbol.", sample: "Strong@123", type: "password" },
];

/* ============================================================== steps === */

function CompanyStep() {
  const { data, patch } = useSetup();
  return (
    <div className="space-y-5">
      <FlatFields section="company" defs={COMPANY_FIELDS} />
      <Grid>
        <LogoUpload />
      </Grid>
      <SubHeading>Registered Address</SubHeading>
      <Textarea
        label="Company Address"
        rows={2}
        info="Building, street and area of your head office."
        sample="No. 12, MG Road, Shivajinagar"
        placeholder="No. 12, MG Road, Shivajinagar"
        value={data.company.address ?? ""}
        onChange={(e) => patch("company", { address: e.target.value })}
      />
      <FlatFields section="company" defs={COMPANY_ADDRESS_FIELDS} />
    </div>
  );
}

function LogoUpload() {
  const { data, patch } = useSetup();
  const logo = data.company.logo ?? "";
  const ref = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patch("company", { logo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">
        Company Logo
      </label>
      {logo ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="Company logo" className="h-10 w-10 rounded-md object-contain ring-1 ring-border" />
          <button type="button" onClick={() => patch("company", { logo: "" })} className="text-xs font-medium text-muted transition hover:text-danger">
            Remove
          </button>
        </div>
      ) : (
        <div
          onClick={() => ref.current?.click()}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-2 px-3 text-sm text-muted transition hover:border-primary hover:text-foreground"
        >
          <UploadCloud className="h-4 w-4" />
          Upload PNG / SVG
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}

function ProfileStep() {
  const { data, setValue } = useSetup();
  const days = data.workingDays;
  return (
    <div className="space-y-5">
      <FlatFields section="profile" defs={PROFILE_FIELDS} />
      <div>
        <label className="mb-2 block text-xs font-medium text-muted">
          Business Working Days
        </label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => {
            const on = days.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() =>
                  setValue("workingDays", on ? days.filter((x) => x !== day) : [...days, day])
                }
                className={cn(
                  "h-9 w-12 rounded-md border text-sm font-medium transition",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border-strong bg-surface text-muted hover:bg-surface-2"
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-2xs text-subtle">
          Weekly off: {WEEKDAYS.filter((d) => !days.includes(d)).join(", ") || "None"}
        </p>
      </div>
      <FlatFields section="profile" defs={PROFILE_TIME_FIELDS} />
    </div>
  );
}

function ContactStep() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <SubHeading>Primary Contact</SubHeading>
        <Grid>
          <ContactField which="primary" name="name" label="Contact Person Name *" icon={User} info="Person we should reach for account matters." sample="Priya Rao" />
          <ContactField which="primary" name="designation" label="Designation" icon={Briefcase} info="Their role in the business." sample="Owner" />
          <ContactField which="primary" name="mobile" label="Mobile Number *" icon={Phone} info="Direct mobile number." sample="+91 98765 43210" />
          <ContactField which="primary" name="email" label="Email Address" icon={Mail} info="Direct email address." sample="priya@raomart.com" type="email" />
        </Grid>
      </div>
      <div className="space-y-4">
        <SubHeading>Secondary Contact</SubHeading>
        <Grid>
          <ContactField which="secondary" name="name" label="Contact Person Name" icon={User} info="Backup contact person." sample="Karan Rao" />
          <ContactField which="secondary" name="designation" label="Designation" icon={Briefcase} info="Their role in the business." sample="Manager" />
          <ContactField which="secondary" name="mobile" label="Mobile Number" icon={Phone} info="Their mobile number." sample="+91 98765 43211" />
          <ContactField which="secondary" name="email" label="Email Address" icon={Mail} info="Their email address." sample="karan@raomart.com" type="email" />
        </Grid>
      </div>
    </div>
  );
}

/* ----- repeatable scaffold ----- */
function RepeatableList({
  arrayKey,
  empty,
  addLabel,
  render,
}: {
  arrayKey: ArrayKey;
  empty: string;
  addLabel: string;
  render: (id: string) => ReactNode;
}) {
  const { data, addRow, removeRow } = useSetup();
  const rows = data[arrayKey] as { id: string }[];
  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-8 text-center">
          <p className="text-sm text-muted">{empty}</p>
        </div>
      )}
      {rows.map((r, i) => (
        <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <Badge tone="primary">#{i + 1}</Badge>
            <button
              type="button"
              onClick={() => removeRow(arrayKey, r.id)}
              className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
          {render(r.id)}
        </div>
      ))}
      <Button variant="outline" size="md" onClick={() => addRow(arrayKey)}>
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}

function RowFields({
  arrayKey,
  id,
  defs,
}: {
  arrayKey: ArrayKey;
  id: string;
  defs: FieldDef[];
}) {
  const { data, updateRow } = useSetup();
  const row = (data[arrayKey] as unknown as Record<string, string>[]).find(
    (r) => r.id === id
  )!;
  return (
    <Grid>
      {defs.map((d) => {
        const Icon = d.icon;
        return (
          <div key={d.name} className={d.full ? "sm:col-span-2 lg:col-span-3" : ""}>
            {d.options ? (
              <Select
                label={d.label}
                options={d.options}
                leadingIcon={<Icon className="h-4 w-4" />}
                info={d.info}
                sample={d.sample}
                value={row[d.name] ?? ""}
                onChange={(e) =>
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  updateRow(arrayKey, id, { [d.name]: e.target.value } as any)
                }
              />
            ) : (
              <Input
                label={d.label}
                type={d.type}
                placeholder={d.sample}
                leadingIcon={<Icon className="h-4 w-4" />}
                info={d.info}
                sample={d.sample}
                value={row[d.name] ?? ""}
                onChange={(e) =>
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  updateRow(arrayKey, id, { [d.name]: e.target.value } as any)
                }
              />
            )}
          </div>
        );
      })}
    </Grid>
  );
}

const BRANCH_FIELDS: FieldDef[] = [
  { name: "name", label: "Branch Name", icon: GitBranch, info: "Display name of this branch / store.", sample: "MG Road Branch" },
  { name: "code", label: "Branch Code", icon: Hash, info: "Short unique code for the branch.", sample: "BR-001" },
  { name: "type", label: "Branch Category", icon: Building, info: "Type of this location (retail, warehouse, etc.).", sample: "Retail Outlet", options: BRANCH_TYPES },
  { name: "gstin", label: "Branch GSTIN", icon: ReceiptText, info: "15-character GSTIN registered at this branch.", sample: "29ABCDE1234F1Z5" },
  { name: "address", label: "Branch Address", icon: MapPin, info: "Street address of the branch.", sample: "No. 5, MG Road", full: true },
  { name: "city", label: "City", icon: MapPin, info: "City of the branch.", sample: "Bengaluru" },
  { name: "state", label: "State", icon: MapPin, info: "State of the branch.", sample: "Karnataka" },
  { name: "pincode", label: "Pincode", icon: Hash, info: "6-digit postal code.", sample: "560001" },
  // Operating hours
  { name: "openTime", label: "Opens At", icon: Clock, info: "Branch opening time.", sample: "09:00", type: "time" },
  { name: "closeTime", label: "Closes At", icon: Clock, info: "Branch closing time.", sample: "21:30", type: "time" },
  // Manager + contact
  { name: "manager", label: "Manager Name", icon: User, info: "Manager in charge of this branch.", sample: "S. Kumar" },
  { name: "contactPerson", label: "Contact Person", icon: User, info: "Branch contact person (if different from manager).", sample: "R. Devi" },
  { name: "phone", label: "Contact Phone", icon: Phone, info: "Branch contact number.", sample: "+91 80 1234 5678" },
  { name: "email", label: "Contact Email", icon: Mail, info: "Branch email address.", sample: "mgroad@raomart.com", type: "email" },
];

const miniInp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none";

// One branch can hold several bank accounts (stored in setup_banks with branchId).
function BranchBanksEditor({ branchId }: { branchId: string }) {
  const { data, updateRow } = useSetup();
  const branch = data.branches.find((b) => b.id === branchId);
  const banks = branch?.banks ?? [];
  const setBanks = (next: typeof banks) => updateRow("branches", branchId, { banks: next });
  const addBank = () => setBanks([...banks, { id: `bbk-${Date.now()}-${banks.length}`, bankName: "", branch: "", account: "", ifsc: "", type: "Current", upi: "" }]);
  const updateBank = (id: string, patch: Partial<(typeof banks)[number]>) => setBanks(banks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeBank = (id: string) => setBanks(banks.filter((b) => b.id !== id));
  return (
    <div className="mt-4 rounded-lg border border-dashed border-border-strong bg-surface-2/40 p-3">
      <span className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle"><Landmark className="h-3.5 w-3.5" /> Bank Accounts ({banks.length})</span>
      {banks.length === 0 && <p className="mt-1.5 text-2xs text-muted">No bank account added for this branch. A branch can have multiple banks.</p>}
      <div className="mt-2 space-y-2">
        {banks.map((bk, i) => (
          <div key={bk.id} className="rounded-lg border border-border bg-surface p-2.5">
            <div className="mb-1.5 flex items-center justify-between"><Badge tone="neutral">Bank #{i + 1}</Badge><button type="button" onClick={() => removeBank(bk.id)} className="inline-flex items-center gap-1 text-2xs font-medium text-danger hover:underline"><Trash2 className="h-3 w-3" /> Remove</button></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <input placeholder="Bank Name" value={bk.bankName} onChange={(e) => updateBank(bk.id, { bankName: e.target.value })} className={miniInp} />
              <input placeholder="Account Number" value={bk.account} onChange={(e) => updateBank(bk.id, { account: e.target.value })} className={miniInp} />
              <input placeholder="IFSC Code" value={bk.ifsc} onChange={(e) => updateBank(bk.id, { ifsc: e.target.value })} className={cn(miniInp, "uppercase")} />
              <input placeholder="Bank Branch" value={bk.branch} onChange={(e) => updateBank(bk.id, { branch: e.target.value })} className={miniInp} />
              <select value={bk.type} onChange={(e) => updateBank(bk.id, { type: e.target.value })} className={miniInp}>{ACCOUNT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              <input placeholder="UPI ID" value={bk.upi} onChange={(e) => updateBank(bk.id, { upi: e.target.value })} className={miniInp} />
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addBank} className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary"><Plus className="h-3 w-3" /> Add Bank Account</button>
    </div>
  );
}

// Fallback entity-type names if the API hasn't responded yet (same 16 defaults).
const FALLBACK_ENTITY_TYPES = [
  "Head Office", "Corporate Office", "State Office", "Regional Office", "Branch Office", "Sales Office",
  "Distribution Centre", "Warehouse", "Retail Store", "Factory", "Manufacturing Unit", "Dark Store",
  "Project Office", "Service Centre", "Franchise", "Office",
];

function BranchStep() {
  const { data } = useSetup();
  const [etNames, setEtNames] = useState<string[]>([]);
  useEffect(() => {
    let on = true;
    fetch("/api/system/entity-types")
      .then((r) => r.json())
      .then((j) => { if (on && j?.ok) setEtNames(j.rows.filter((r: { status: string }) => r.status === "active").map((r: { name: string }) => r.name)); })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  const etOptions: SelectOption[] = (etNames.length ? etNames : FALLBACK_ENTITY_TYPES).map((n) => ({ value: n, label: n }));

  // Build the field list for one branch row: swap "Branch Category" for a dynamic
  // "Entity Type", and add an optional "Parent Branch" (the other branches by code).
  const defsFor = (id: string): FieldDef[] => {
    const parentOpts: SelectOption[] = [
      { value: "", label: "— None (Main / Top-level) —" },
      ...data.branches.filter((b) => b.id !== id && (b.code ?? "").trim()).map((b) => ({ value: b.code, label: `${b.name || "Branch"} (${b.code})` })),
    ];
    return BRANCH_FIELDS.flatMap((f): FieldDef[] => {
      if (f.name !== "type") return [f];
      return [
        { ...f, label: "Entity Type", info: "Category of this org node (Head Office, Warehouse, Retail Store…). Manage the list in System → Branch Setup.", options: etOptions },
        { name: "parentCode", label: "Parent Branch", icon: Building, info: "Optional — place this branch under another (empty = top-level). Deep multi-level hierarchy is managed in System → Branch Setup.", options: parentOpts },
      ];
    });
  };

  return (
    <RepeatableList
      arrayKey="branches"
      empty="No branches added yet. Add your first branch / store location."
      addLabel="Add Branch"
      render={(id) => <><RowFields arrayKey="branches" id={id} defs={defsFor(id)} /><BranchBanksEditor branchId={id} /></>}
    />
  );
}

function WarehouseStep() {
  const { data } = useSetup();
  const branchOpts: SelectOption[] = data.branches.map((b) => ({
    value: b.id,
    label: b.name || "Unnamed branch",
  }));
  const fields: FieldDef[] = [
    { name: "name", label: "Warehouse Name", icon: WarehouseIcon, info: "Display name of the warehouse.", sample: "Central Warehouse" },
    { name: "code", label: "Warehouse Code", icon: Hash, info: "Unique warehouse code.", sample: "WH-001" },
    { name: "type", label: "Warehouse Type", icon: Layers, info: "Category of the warehouse.", sample: "Main", options: WAREHOUSE_TYPES },
    { name: "branch", label: "Branch Mapping", icon: GitBranch, info: "Branch this warehouse serves stock to.", sample: "MG Road Branch", options: branchOpts.length ? branchOpts : [{ value: "main", label: "Main Store" }] },
    { name: "address", label: "Address", icon: MapPin, info: "Warehouse street address.", sample: "Plot 9, Industrial Area", full: true },
    { name: "contact", label: "Contact Person", icon: User, info: "Person in charge of the warehouse.", sample: "R. Singh" },
    { name: "mobile", label: "Mobile Number", icon: Phone, info: "Contact mobile number.", sample: "+91 98765 43210" },
    { name: "capacity", label: "Storage Capacity", icon: Layers, info: "Storage capacity (area or units).", sample: "5000 sq.ft" },
  ];
  return (
    <RepeatableList
      arrayKey="warehouses"
      empty="No warehouses added yet. Add a warehouse and map it to a branch."
      addLabel="Add Warehouse"
      render={(id) => <RowFields arrayKey="warehouses" id={id} defs={fields} />}
    />
  );
}

const BANK_FIELDS: FieldDef[] = [
  { name: "bankName", label: "Bank Name", icon: Landmark, info: "Bank used for settlements.", sample: "HDFC Bank" },
  { name: "branch", label: "Branch Name", icon: Building, info: "Bank branch name.", sample: "MG Road" },
  { name: "account", label: "Account Number", icon: Hash, info: "Bank account number.", sample: "50100123456789" },
  { name: "ifsc", label: "IFSC Code", icon: Hash, info: "11-character IFSC code of the branch.", sample: "HDFC0000123" },
  { name: "type", label: "Account Type", icon: CreditCard, info: "Type of bank account.", sample: "Current", options: ACCOUNT_TYPES },
  { name: "upi", label: "UPI ID", icon: Smartphone, info: "UPI ID linked to this account.", sample: "raomart@hdfcbank" },
];

function BankingStep() {
  return (
    <RepeatableList
      arrayKey="banks"
      empty="No bank accounts added. Add the account used for settlements."
      addLabel="Add Bank Account"
      render={(id) => <RowFields arrayKey="banks" id={id} defs={BANK_FIELDS} />}
    />
  );
}

const USER_FIELDS: FieldDef[] = [
  { name: "name", label: "Full Name", icon: User, info: "Team member's full name.", sample: "Meena R" },
  { name: "role", label: "Role", icon: UserCog, info: "Access role / permission set.", sample: "Store Manager", options: ROLES },
  { name: "mobile", label: "Mobile Number", icon: Phone, info: "Their mobile number.", sample: "+91 98765 43211" },
  { name: "email", label: "Email Address", icon: Mail, info: "Their email address.", sample: "meena@raomart.com", type: "email" },
  { name: "username", label: "Username", icon: AtSign, info: "Login username for this user.", sample: "meena.r" },
];

function OrganizationStep() {
  const { data, patch } = useSetup();
  const orgTypes = [
    { id: "single", title: "Single Store", desc: "One location, one inventory." },
    { id: "multi-store", title: "Multi Store", desc: "Several stores, shared masters." },
    { id: "multi-branch", title: "Multi Branch", desc: "Branches with local control." },
    { id: "franchise", title: "Franchise", desc: "Franchisee-operated outlets." },
  ];
  return (
    <div className="space-y-6">
      <div>
        <SubHeading>Organization Type</SubHeading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {orgTypes.map((o) => (
            <RadioCard
              key={o.id}
              selected={data.org.type === o.id}
              onSelect={() => patch("org", { type: o.id })}
              title={o.title}
              description={o.desc}
              icon={<Building2 className="h-5 w-5" />}
            />
          ))}
        </div>
      </div>
      <div>
        <SubHeading>Centralized Configuration</SubHeading>
        <div className="mt-3">
          <ToggleGrid
            group="orgCentralized"
            items={[
              { id: "inventory", label: "Centralized Inventory" },
              { id: "pricing", label: "Centralized Pricing" },
              { id: "purchase", label: "Centralized Purchase" },
              { id: "accounting", label: "Centralized Accounting" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function FinancialStep() {
  const { data, patch } = useSetup();
  return (
    <div className="space-y-6">
      <FlatFields section="finance" defs={FINANCE_FIELDS} />
      <div>
        <SubHeading>Accounting Method</SubHeading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            { id: "accrual", t: "Accrual", d: "Record income & expense when incurred." },
            { id: "cash", t: "Cash Based", d: "Record only on actual payment." },
          ].map((m) => (
            <RadioCard
              key={m.id}
              selected={data.finance.method === m.id}
              onSelect={() => patch("finance", { method: m.id })}
              title={m.t}
              description={m.d}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FlagSwitch id="multiCurrency" label="Multi Currency" />
        <FlagSwitch id="budgetMgmt" label="Budget Management" />
        <FlagSwitch id="costCenterAcct" label="Cost Center Accounting" />
      </div>
    </div>
  );
}

function GstStep() {
  const { data, patch } = useSetup();
  return (
    <div className="space-y-6">
      <div>
        <SubHeading>GST Registration Type</SubHeading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { id: "regular", t: "Regular" },
            { id: "composition", t: "Composition" },
            { id: "sez", t: "SEZ" },
            { id: "export", t: "Export" },
          ].map((g) => (
            <RadioCard
              key={g.id}
              selected={data.gst.regType === g.id}
              onSelect={() => patch("gst", { regType: g.id })}
              title={g.t}
            />
          ))}
        </div>
      </div>
      <FlatFields section="gst" defs={GST_FIELDS} />
      <div>
        <SubHeading>Applicable Taxes</SubHeading>
        <div className="mt-3">
          <ToggleGrid
            group="gstTaxes"
            cols={3}
            items={[
              { id: "cgst", label: "CGST" },
              { id: "sgst", label: "SGST" },
              { id: "igst", label: "IGST" },
              { id: "utgst", label: "UTGST" },
            ]}
          />
        </div>
      </div>
      <div>
        <SubHeading>Filing Frequency</SubHeading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            { id: "monthly", t: "Monthly" },
            { id: "quarterly", t: "Quarterly" },
          ].map((f) => (
            <RadioCard
              key={f.id}
              selected={data.gst.frequency === f.id}
              onSelect={() => patch("gst", { frequency: f.id })}
              title={f.t}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FlagSwitch id="gstEinvoice" label="E-Invoice" />
        <FlagSwitch id="gstEway" label="E-Way Bill" />
        <FlagSwitch id="gstTds" label="TDS" />
      </div>
    </div>
  );
}

function UsersStep() {
  return (
    <div className="space-y-6">
      <div>
        <SubHeading>Primary Administrator</SubHeading>
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary-subtle/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Company Admin</span>
            <Badge tone="primary">Full Access</Badge>
          </div>
          <FlatFields section="admin" defs={ADMIN_FIELDS} />
        </div>
      </div>
      <div>
        <SubHeading>Additional Users</SubHeading>
        <div className="mt-3">
          <RepeatableList
            arrayKey="users"
            empty="No additional users. You can invite team members now or later."
            addLabel="Add User"
            render={(id) => <RowFields arrayKey="users" id={id} defs={USER_FIELDS} />}
          />
        </div>
      </div>
    </div>
  );
}

function InventoryStep() {
  const { data, setValue } = useSetup();
  return (
    <div className="space-y-6">
      <div>
        <SubHeading>Tracking Options</SubHeading>
        <div className="mt-3">
          <ToggleGrid group="inventory" items={INVENTORY_TOGGLES} />
        </div>
      </div>
      <div>
        <SubHeading>Stock Valuation Method</SubHeading>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { id: "fifo", t: "FIFO", d: "First In First Out" },
            { id: "fefo", t: "FEFO", d: "First Expiry First Out" },
            { id: "wavg", t: "Weighted Average", d: "Average cost" },
          ].map((m) => (
            <RadioCard
              key={m.id}
              selected={data.inventoryValuation === m.id}
              onSelect={() => setValue("inventoryValuation", m.id)}
              title={m.t}
              description={m.d}
            />
          ))}
        </div>
      </div>
      <div>
        <SubHeading>Stock Rules</SubHeading>
        <div className="mt-3">
          <ToggleGrid group="inventoryRules" items={INVENTORY_RULES} />
        </div>
      </div>
    </div>
  );
}

function PosStep() {
  return (
    <div className="space-y-6">
      <div>
        <SubHeading>Billing Features</SubHeading>
        <div className="mt-3">
          <ToggleGrid group="pos" items={POS_TOGGLES} cols={3} />
        </div>
      </div>
      <div>
        <SubHeading>Receipt Options</SubHeading>
        <div className="mt-3">
          <ToggleGrid group="receipt" items={RECEIPT_TOGGLES} />
        </div>
      </div>
    </div>
  );
}

function PaymentStep() {
  const { data, setValue, isOn } = useSetup();
  const enabledModes: SelectOption[] = PAYMENT_MODES.filter((m) => isOn("payment", m.id)).map(
    (m) => ({ value: m.id, label: m.label })
  );
  return (
    <div className="space-y-6">
      <div>
        <SubHeading>Accepted Payment Modes</SubHeading>
        <div className="mt-3">
          <ToggleGrid group="payment" items={PAYMENT_MODES} cols={3} />
        </div>
      </div>
      <Grid>
        <Select
          label="Default Payment Mode"
          leadingIcon={<CreditCard className="h-4 w-4" />}
          info="Mode pre-selected at checkout."
          options={enabledModes.length ? enabledModes : [{ value: "cash", label: "Cash" }]}
          value={data.paymentDefault}
          onChange={(e) => setValue("paymentDefault", e.target.value)}
        />
        <div className="flex items-end">
          <FlagSwitch id="paymentGateway" label="Payment Gateway Integration Required" />
        </div>
      </Grid>
    </div>
  );
}

function NotificationStep() {
  return (
    <div className="space-y-6">
      <div>
        <SubHeading>Channels</SubHeading>
        <div className="mt-3">
          <ToggleGrid group="notifyChannels" items={NOTIFY_CHANNELS} />
        </div>
      </div>
      <div>
        <SubHeading>Events</SubHeading>
        <div className="mt-3">
          <ToggleGrid group="notifyEvents" items={NOTIFY_EVENTS} cols={3} />
        </div>
      </div>
    </div>
  );
}

function HardwareStep() {
  return <ToggleGrid group="hardware" items={HARDWARE_TOGGLES} cols={3} />;
}

function ModulesStep() {
  return <ToggleGrid group="modules" items={MODULE_TOGGLES} cols={3} />;
}

function IndustryStep() {
  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">
        Enable configuration specific to your vertical. Options apply only to the
        relevant industry modules.
      </p>
      <div>
        <SubHeading>Pharmacy</SubHeading>
        <div className="mt-3">
          <ToggleGrid
            group="industryPharmacy"
            items={[
              { id: "prescription", label: "Prescription Management" },
              { id: "schedule", label: "Schedule Drug Control" },
              { id: "validation", label: "Pharmacist Validation" },
              { id: "license", label: "Drug License Compliance" },
              { id: "gs1", label: "GS1 QR Verification" },
            ]}
          />
        </div>
      </div>
      <div>
        <SubHeading>Electronics</SubHeading>
        <div className="mt-3">
          <ToggleGrid
            group="industryElectronics"
            items={[
              { id: "serial", label: "Serial Number Tracking" },
              { id: "warranty", label: "Warranty Tracking" },
            ]}
          />
        </div>
      </div>
      <div>
        <SubHeading>Textile</SubHeading>
        <div className="mt-3">
          <ToggleGrid
            group="industryTextile"
            items={[
              { id: "size", label: "Size Variants" },
              { id: "color", label: "Color Variants" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function MigrationStep() {
  const { data, setValue } = useSetup();
  return (
    <div className="space-y-6">
      <Grid>
        <Select
          label="Existing Software"
          leadingIcon={<FileText className="h-4 w-4" />}
          info="Your current software — we map its data into Oasys ERP."
          placeholder="Select your current software"
          options={MIGRATION_SOURCES}
          value={data.migrationSource}
          onChange={(e) => setValue("migrationSource", e.target.value)}
        />
      </Grid>
      <div>
        <SubHeading>Data to Import</SubHeading>
        <div className="mt-3">
          <ToggleGrid group="migrationImports" items={MIGRATION_IMPORTS} />
        </div>
      </div>
    </div>
  );
}

function SecurityStep() {
  return <ToggleGrid group="security" items={SECURITY_TOGGLES} />;
}

/* ---------------------------------------------------------- registry --- */

const STEP_COMPONENTS: Partial<Record<StepId, () => ReactNode>> = {
  company: CompanyStep,
  profile: ProfileStep,
  contact: ContactStep,
  branch: BranchStep,
  warehouse: WarehouseStep,
  organization: OrganizationStep,
  financial: FinancialStep,
  banking: BankingStep,
  gst: GstStep,
  users: UsersStep,
  inventory: InventoryStep,
  pos: PosStep,
  payment: PaymentStep,
  notification: NotificationStep,
  hardware: HardwareStep,
  modules: ModulesStep,
  industry: IndustryStep,
  migration: MigrationStep,
  security: SecurityStep,
};

export const STEP_DESCRIPTIONS: Record<StepId, string> = {
  company: "Tell us about your company — legal details, tax IDs and registered address.",
  profile: "Help us tailor defaults to your size, turnover and working hours.",
  contact: "Who should we reach for account and operational matters?",
  branch: "Add the stores / branches you operate. You can add more anytime.",
  warehouse: "Define warehouses and map them to branches for stock control.",
  organization: "Choose how your organization is structured and centralized.",
  financial: "Set your financial year, currency and accounting preferences.",
  banking: "Add the bank accounts used for settlements and reconciliation.",
  gst: "Configure GST registration, taxes and compliance options.",
  users: "Create the primary administrator and invite your team.",
  inventory: "Choose tracking, valuation and stock-control rules.",
  pos: "Enable the billing and receipt features your counters need.",
  payment: "Select the payment modes you accept at checkout.",
  notification: "Decide which channels and events trigger notifications.",
  hardware: "Tell us which peripherals are connected at your counters.",
  modules: "Switch on the product modules you want to use.",
  industry: "Enable configuration specific to your retail vertical.",
  migration: "Import your existing masters and balances to get a head start.",
  security: "Harden access with OTP, 2FA and audit policies.",
  review: "Review everything before we provision your workspace.",
};

export function StepBody({ stepId }: { stepId: StepId }) {
  const Comp = STEP_COMPONENTS[stepId];
  if (!Comp) return null;
  return <Comp />;
}
