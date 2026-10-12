"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Layers,
  BookOpen,
  Building2,
  Target,
  Landmark,
  ReceiptText,
  Plus,
  Trash2,
  Search,
  Check,
  Sparkles,
  UploadCloud,
  Download,
  FileSpreadsheet,
  CircleAlert,
  CheckCircle2,
  GitPullRequestArrow,
  Wallet,
  ArrowRight,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import {
  COA_TABS,
  ACCOUNT_GROUPS,
  LEDGERS,
  GST_LEDGERS,
  BANKS,
  CASH_ACCOUNTS,
  COST_CENTERS,
  PROFIT_CENTERS,
  OPENING_BALANCES,
  REPORTS,
  IMPORT_SOURCES,
  BUSINESS_TYPES,
  AI_GENERATED,
  COA_STATS,
  type AccountType,
} from "@/lib/finance/coaConfig";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/settings/generalConfig";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { RadioCard } from "@/components/ui/RadioCard";
import { ReportView } from "./ReportView";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------- helpers -- */
const TYPE_TONE: Record<AccountType, "primary" | "danger" | "info" | "success" | "warning"> = {
  Asset: "primary",
  Liability: "danger",
  Equity: "info",
  Income: "success",
  Expense: "warning",
};

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pb-1 pt-1">
      <span className="h-4 w-1 rounded-full bg-brand-gradient" />
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

interface ColDef { key: string; label: string; align?: "right" | "center" }
interface FieldDef { name: string; label: string; type?: "text" | "number"; options?: string[] }
type Row = Record<string, string> & { id: string };

/* Generic searchable + add/remove table for the editable masters. */
function ManagedList({
  columns,
  fields,
  seed,
  addLabel,
  searchKeys,
}: {
  columns: ColDef[];
  fields: FieldDef[];
  seed: Row[];
  addLabel: string;
  searchKeys: string[];
}) {
  const [rows, setRows] = useState<Row[]>(seed);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const counter = useMemo(() => ({ n: seed.length + 1 }), [seed]);

  const filtered = rows.filter(
    (r) => !query || searchKeys.some((k) => r[k]?.toLowerCase?.().includes(query.toLowerCase()))
  );

  function save() {
    if (!draft[fields[0].name]?.trim()) return;
    setRows((rs) => [{ id: `new-${counter.n++}`, ...draft } as Row, ...rs]);
    setDraft({});
    setAdding(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
        </div>
        <Button size="md" onClick={() => setAdding((a) => !a)}>
          <Plus className={cn("h-4 w-4 transition-transform", adding && "rotate-45")} /> {addLabel}
        </Button>
      </div>

      {adding && (
        <div className="rounded-xl border border-primary/30 bg-primary-subtle/30 p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) =>
              f.options ? (
                <Select key={f.name} label={f.label} options={f.options.map((o) => ({ value: o, label: o }))} value={draft[f.name] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [f.name]: e.target.value }))} />
              ) : (
                <Input key={f.name} label={f.label} type={f.type === "number" ? "number" : "text"} value={draft[f.name] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [f.name]: e.target.value }))} />
              )
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft({}); }}>Cancel</Button>
            <Button size="sm" onClick={save}><Check className="h-3.5 w-3.5" /> Save</Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                {columns.map((c) => (<th key={c.key} className={cn("px-4 py-2.5", c.align === "right" && "text-right", c.align === "center" && "text-center")}>{c.label}</th>))}
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn("px-4 py-2.5", c.align === "right" && "text-right", c.align === "center" && "text-center", i === 0 ? "font-medium text-foreground" : "text-muted")}>
                      {c.key === "type" ? <Badge tone={TYPE_TONE[r.type as AccountType] ?? "neutral"}>{r[c.key]}</Badge> : r[c.key] || "—"}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-sm text-muted">No records.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-4 py-2 text-xs text-muted">{filtered.length} records</div>
      </div>
    </div>
  );
}

/* ============================================================== tabs === */

function GroupsTab() {
  return (
    <ManagedList
      addLabel="Add Group"
      searchKeys={["code", "name", "parent"]}
      columns={[{ key: "code", label: "Code" }, { key: "name", label: "Group Name" }, { key: "parent", label: "Parent" }, { key: "type", label: "Type", align: "center" }]}
      fields={[
        { name: "code", label: "Group Code" },
        { name: "name", label: "Group Name" },
        { name: "parent", label: "Parent Group" },
        { name: "type", label: "Account Type", options: ["Asset", "Liability", "Equity", "Income", "Expense"] },
      ]}
      seed={ACCOUNT_GROUPS.map((g) => ({ id: g.id, code: g.code, name: g.level === 0 ? g.name : `   ${g.name}`, parent: g.parent, type: g.type }))}
    />
  );
}
function LedgersTab() {
  return (
    <ManagedList
      addLabel="Add Ledger"
      searchKeys={["code", "name", "group"]}
      columns={[{ key: "code", label: "Code" }, { key: "name", label: "Account Name" }, { key: "type", label: "Type", align: "center" }, { key: "group", label: "Parent Group" }]}
      fields={[
        { name: "code", label: "Account Code" },
        { name: "name", label: "Account Name" },
        { name: "type", label: "Account Type", options: ["Asset", "Liability", "Equity", "Income", "Expense"] },
        { name: "group", label: "Parent Group" },
      ]}
      seed={LEDGERS.map((l) => ({ id: l.id, code: l.code, name: l.name, type: l.type, group: l.group }))}
    />
  );
}
function GstTab() {
  const groups: { kind: string; tone: "primary" | "danger" | "warning" }[] = [
    { kind: "Input", tone: "primary" },
    { kind: "Output", tone: "danger" },
    { kind: "Other", tone: "warning" },
  ];
  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">System GST ledgers — auto-posted from sales & purchases. Create them once during setup.</p>
      {groups.map((g) => (
        <div key={g.kind}>
          <SubHeading>{g.kind} GST</SubHeading>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GST_LEDGERS.filter((x) => x.kind === g.kind).map((x) => (
              <div key={x.code} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"><ReceiptText className="h-[18px] w-[18px]" /></span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{x.name}</p>
                  <p className="text-2xs text-subtle">{x.code}</p>
                </div>
                <Badge tone={g.tone} className="ml-auto">{x.kind}</Badge>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
function BankTab() {
  return (
    <ManagedList
      addLabel="Add Bank Account"
      searchKeys={["bank", "account", "ifsc"]}
      columns={[{ key: "bank", label: "Bank" }, { key: "account", label: "Account Number" }, { key: "branch", label: "Branch" }, { key: "ifsc", label: "IFSC" }, { key: "type", label: "Type", align: "center" }]}
      fields={[
        { name: "bank", label: "Bank Name" },
        { name: "account", label: "Account Number" },
        { name: "branch", label: "Branch" },
        { name: "ifsc", label: "IFSC Code" },
        { name: "type", label: "Account Type", options: ["Current", "Savings", "OD"] },
      ]}
      seed={BANKS.map((b) => ({ id: b.id, bank: b.isDefault ? `${b.bank} ★` : b.bank, account: b.account, branch: b.branch, ifsc: b.ifsc, type: b.type }))}
    />
  );
}
function CashTab() {
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">System cash accounts — used at POS and for petty expenses.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CASH_ACCOUNTS.map((c) => (
          <div key={c.code} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><Wallet className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-foreground">{c.name}</p>
              <p className="text-2xs text-muted">{c.desc} · {c.code}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function CostTab() {
  return (
    <ManagedList
      addLabel="Add Cost Center"
      searchKeys={["code", "name", "desc"]}
      columns={[{ key: "code", label: "Code" }, { key: "name", label: "Cost Center" }, { key: "desc", label: "Description" }]}
      fields={[{ name: "code", label: "Cost Center Code" }, { name: "name", label: "Cost Center Name" }, { name: "desc", label: "Description" }]}
      seed={COST_CENTERS.map((c) => ({ id: c.id, code: c.code, name: c.name, desc: c.desc }))}
    />
  );
}
function ProfitTab() {
  return (
    <ManagedList
      addLabel="Add Profit Center"
      searchKeys={["code", "name", "desc"]}
      columns={[{ key: "code", label: "Code" }, { key: "name", label: "Profit Center" }, { key: "desc", label: "Description" }]}
      fields={[{ name: "code", label: "Profit Center Code" }, { name: "name", label: "Profit Center Name" }, { name: "desc", label: "Description" }]}
      seed={PROFIT_CENTERS.map((c) => ({ id: c.id, code: c.code, name: c.name, desc: c.desc }))}
    />
  );
}
function OpeningTab() {
  const [rows, setRows] = useState(OPENING_BALANCES);
  const totalDr = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
  const totalCr = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
  const balanced = totalDr === totalCr;
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">Enter opening balances at go-live. Total debit must equal total credit.</p>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
              <th className="px-4 py-2.5">Account</th>
              <th className="px-4 py-2.5 text-right">Debit (₹)</th>
              <th className="px-4 py-2.5 text-right">Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium text-foreground">{r.account}</td>
                <td className="px-2 py-1.5 text-right">
                  <input value={r.debit} onChange={(e) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, debit: e.target.value } : x))} className="h-8 w-28 rounded-md border border-border bg-surface px-2 text-right text-sm text-foreground focus:border-primary focus:outline-none" />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <input value={r.credit} onChange={(e) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, credit: e.target.value } : x))} className="h-8 w-28 rounded-md border border-border bg-surface px-2 text-right text-sm text-foreground focus:border-primary focus:outline-none" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-2 font-bold text-foreground">
              <td className="px-4 py-2.5 text-right">Total</td>
              <td className="px-4 py-2.5 text-right">{formatMoney(totalDr)}</td>
              <td className="px-4 py-2.5 text-right">{formatMoney(totalCr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className={cn("flex items-center gap-2 rounded-lg p-3 text-sm font-medium", balanced ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger")}>
        {balanced ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
        {balanced ? "Balanced — debit equals credit." : `Out of balance by ${formatMoney(Math.abs(totalDr - totalCr))}.`}
      </div>
    </div>
  );
}
function AiTab() {
  const [biz, setBiz] = useState("Grocery");
  const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white">
        <Sparkles className="h-6 w-6 shrink-0" />
        <div>
          <p className="text-sm font-bold">AI Smart COA Setup</p>
          <p className="text-xs text-white/85">Pick your business type — AI generates a ready-to-use chart of accounts.</p>
        </div>
      </div>
      <SubHeading>What type of business do you operate?</SubHeading>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {BUSINESS_TYPES.map((b) => (
          <RadioCard key={b} selected={biz === b} onSelect={() => { setBiz(b); setPhase("idle"); }} title={b} />
        ))}
      </div>
      {phase === "idle" && (
        <Button size="lg" onClick={() => { setPhase("processing"); window.setTimeout(() => setPhase("done"), 1400); }}>
          <Sparkles className="h-4 w-4" /> Generate Chart of Accounts
        </Button>
      )}
      {phase === "processing" && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Generating a {biz} chart of accounts…
        </div>
      )}
      {phase === "done" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-success-subtle p-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-5 w-5" /> Generated a {biz} chart of accounts — review below.</span>
            <span className="text-xs font-semibold text-success">96% match</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AI_GENERATED.map((g) => (
              <div key={g.label} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-2xl font-bold text-foreground">{g.count}</p>
                <p className="text-2xs text-muted">{g.label}</p>
              </div>
            ))}
          </div>
          <Button size="md"><Check className="h-4 w-4" /> Apply Generated COA</Button>
        </div>
      )}
    </div>
  );
}
function ImportTab() {
  return (
    <div className="space-y-5">
      <SubHeading>1. Select a source</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {IMPORT_SOURCES.map((s) => (
          <div key={s} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-4">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-subtle text-primary"><Download className="h-[18px] w-[18px]" /></span>
            <span className="text-sm font-semibold text-foreground">{s}</span>
          </div>
        ))}
      </div>
      <SubHeading>2. Upload export file</SubHeading>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center transition hover:border-primary hover:bg-primary-subtle/30">
        <FileSpreadsheet className="h-8 w-8 text-primary" />
        <span className="text-sm font-medium text-foreground">Drag &amp; drop or click to upload</span>
        <span className="text-2xs text-subtle">Auto-mapping detects account groups & ledgers</span>
        <input type="file" className="hidden" />
      </label>
      <SubHeading>3. Validation &amp; error report</SubHeading>
      <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> 184 accounts mapped</span>
          <span className="inline-flex items-center gap-1.5 text-danger"><CircleAlert className="h-4 w-4" /> 3 unmapped</span>
        </div>
        <ul className="space-y-1 text-2xs text-muted">
          <li>Row 22 — Account group “Misc” not found, mapped to “Other Income”.</li>
          <li>Row 57 — Duplicate account code “4101”.</li>
        </ul>
      </div>
    </div>
  );
}
function ApprovalTab() {
  const [status, setStatus] = useState("draft");
  const flow = [
    { id: "draft", label: "Draft", desc: "COA being built / edited" },
    { id: "pending", label: "Pending Approval", desc: "Submitted to checker" },
    { id: "approved", label: "Approved", desc: "Locked & live for posting" },
    { id: "rejected", label: "Rejected", desc: "Returned with remarks" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg bg-primary-subtle/40 p-3">
        <GitPullRequestArrow className="h-5 w-5 text-primary" />
        <p className="text-xs text-foreground">Maker-Checker — the chart of accounts must be approved before transactions can be posted against it.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {flow.map((s) => (
          <button key={s.id} type="button" onClick={() => setStatus(s.id)} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left transition", status === s.id ? "border-primary bg-primary-subtle/40 ring-1 ring-primary" : "border-border bg-surface hover:bg-surface-2")}>
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-2xs font-bold", status === s.id ? "bg-brand-gradient text-white" : "bg-surface-2 text-muted")}>{status === s.id ? <Check className="h-4 w-4" /> : ""}</span>
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
function ReportsTab() {
  const [selected, setSelected] = useState<string | null>(null);
  if (selected) return <ReportView reportId={selected} onBack={() => setSelected(null)} />;
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">Financial reports are generated from the chart of accounts and posted transactions. Select a report to open it.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <button key={r.id} onClick={() => setSelected(r.id)} className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-primary hover:shadow-sm">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary transition group-hover:bg-brand-gradient group-hover:text-white"><FileBarChartMini /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{r.name}</p>
              <p className="text-2xs text-muted">{r.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}
function FileBarChartMini() {
  return <span className="text-[15px] font-bold">₹</span>;
}

const TAB_BODIES: Record<string, () => ReactNode> = {
  groups: GroupsTab,
  ledgers: LedgersTab,
  gst: GstTab,
  bank: BankTab,
  cash: CashTab,
  cost: CostTab,
  profit: ProfitTab,
  opening: OpeningTab,
  ai: AiTab,
  import: ImportTab,
  approval: ApprovalTab,
  reports: ReportsTab,
};

/* ============================================================ console === */

const STAT_TONES = {
  primary: "bg-primary text-white",
  secondary: "bg-secondary text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
  accent: "bg-accent text-accent-foreground",
} as const;

function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: keyof typeof STAT_TONES }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg shadow-sm", STAT_TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span>
        <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
      </div>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}

export function CoaConsole() {
  const [activeId, setActiveId] = useState("groups");
  const active = COA_TABS.find((t) => t.id === activeId) ?? COA_TABS[0];
  const Body = TAB_BODIES[active.id];
  let lastGroup = "";

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <span>Finance &amp; Accounting</span>
            <span className="text-subtle">/</span>
            <span className="font-medium text-foreground">Chart of Accounts</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Chart of Accounts</h1>
          <p className="mt-0.5 text-sm text-muted">Account groups, ledgers, GST, cost &amp; profit centers and reports.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="md" onClick={() => setActiveId("import")}><UploadCloud className="h-4 w-4" /> Import</Button>
          <Button variant="secondary" size="md" onClick={() => setActiveId("ai")}><Sparkles className="h-4 w-4" /> AI Setup</Button>
          <Button size="md" onClick={() => setActiveId("ledgers")}><Plus className="h-4 w-4" /> Add Account</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={Layers} label="Account Groups" value={String(COA_STATS.groups)} tone="primary" />
        <Stat icon={BookOpen} label="Ledger Accounts" value={String(COA_STATS.ledgers)} tone="secondary" />
        <Stat icon={ReceiptText} label="GST Ledgers" value={String(COA_STATS.gst)} tone="warning" />
        <Stat icon={Building2} label="Cost Centers" value={String(COA_STATS.cost)} tone="accent" />
        <Stat icon={Target} label="Profit Centers" value={String(COA_STATS.profit)} tone="success" />
        <Stat icon={Landmark} label="Bank Accounts" value={String(COA_STATS.banks)} tone="danger" />
      </div>

      {/* Console */}
      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-4 space-y-0.5 rounded-2xl border border-border bg-card p-2 shadow-sm">
            {COA_TABS.map((t) => {
              const Icon = t.icon;
              const isActive = t.id === active.id;
              const header = t.group !== lastGroup ? ((lastGroup = t.group), t.group) : null;
              return (
                <div key={t.id}>
                  {header && <p className="px-2 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">{header}</p>}
                  <button type="button" onClick={() => setActiveId(t.id)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition", isActive ? "nav-item-active font-semibold text-white shadow-sm" : "text-muted hover:bg-surface-2")}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 lg:hidden">
            <Select options={COA_TABS.map((t) => ({ value: t.id, label: t.label }))} value={active.id} onChange={(e) => setActiveId(e.target.value)} />
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ backgroundImage: "var(--gradient-brand)" }}>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/15 backdrop-blur"><active.icon className="h-5 w-5" /></span>
              <h2 className="text-base font-bold">{active.label}</h2>
            </div>
            <div className="p-5 sm:p-6">{Body && <Body />}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
