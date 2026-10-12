"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Users,
  UserCog,
  ShieldCheck,
  KeyRound,
  Clock,
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
  ArrowRight,
  ArrowLeft,
  Loader2,
  ScanLine,
  Contact,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import {
  ORG_TABS,
  EMPLOYEES,
  USERS,
  SHIFTS,
  SYSTEM_ROLES,
  PERMISSION_LEVELS,
  PERMISSION_GROUPS,
  APPROVAL_FLOWS,
  ATTENDANCE_METHODS,
  AUDIT_LOG,
  PERFORMANCE,
  ORG_STATS,
  EMP_TYPE_OPTS,
  EMP_STATUS_OPTS,
  USER_STATUS_OPTS,
  GENDER_OPTS,
  DEPARTMENTS,
  DESIGNATIONS,
  BRANCHES,
} from "@/lib/org/userRolesConfig";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { RadioCard } from "@/components/ui/RadioCard";
import { cn } from "@/lib/cn";

type Tone = "success" | "neutral" | "danger" | "warning" | "primary";
const statusTone = (s: string): Tone =>
  s === "Active" ? "success" : s === "Locked" || s === "Suspended" || s === "Resigned" ? "danger" : "neutral";

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
interface FieldDef { name: string; label: string; options?: string[] }
type Row = Record<string, string> & { id: string };

function ManagedList({
  columns, fields, seed, addLabel, searchKeys, badgeKeys, renderCreate,
}: {
  columns: ColDef[]; fields: FieldDef[]; seed: Row[]; addLabel: string; searchKeys: string[]; badgeKeys?: string[];
  renderCreate?: (p: { onSave: (row: Record<string, string>) => void; onCancel: () => void }) => ReactNode;
}) {
  const [rows, setRows] = useState<Row[]>(seed);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const counter = useMemo(() => ({ n: seed.length + 1 }), [seed]);
  const filtered = rows.filter((r) => !query || searchKeys.some((k) => r[k]?.toLowerCase?.().includes(query.toLowerCase())));
  const title = addLabel.replace(/^(Add|Create)\s+/, "");

  function append(row: Record<string, string>) {
    setRows((rs) => [{ id: `new-${counter.n++}`, ...row } as Row, ...rs]);
    setCreating(false);
    setDraft({});
  }

  // Create is a SEPARATE screen (custom or generic) — never inline on the list.
  if (creating && renderCreate) return <>{renderCreate({ onSave: append, onCancel: () => setCreating(false) })}</>;
  if (creating) {
    return (
      <div className="space-y-4">
        <button onClick={() => setCreating(false)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Back to list</button>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/[0.07] to-transparent px-5 py-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><Plus className="h-[18px] w-[18px]" /></span>
            <h3 className="text-sm font-bold text-foreground">Add {title}</h3>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) =>
              f.options ? (
                <Select key={f.name} label={f.label} placeholder="Select…" options={f.options.map((o) => ({ value: o, label: o }))} value={draft[f.name] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [f.name]: e.target.value }))} />
              ) : (
                <Input key={f.name} label={f.label} value={draft[f.name] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [f.name]: e.target.value }))} />
              )
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <Button variant="ghost" size="md" onClick={() => { setCreating(false); setDraft({}); }}>Cancel</Button>
            <Button size="md" onClick={() => { if (draft[fields[0].name]?.trim()) append(draft); }}><Check className="h-4 w-4" /> Save {title}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
        </div>
        <Button size="md" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> {addLabel}</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                {columns.map((c) => (<th key={c.key} className={cn("px-4 py-2.5", c.align === "center" && "text-center")}>{c.label}</th>))}
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn("px-4 py-2.5", c.align === "center" && "text-center", i === 0 ? "font-medium text-foreground" : "text-muted")}>
                      {badgeKeys?.includes(c.key) ? <Badge tone={c.key === "twofa" ? (r[c.key] === "On" ? "success" : "neutral") : statusTone(r[c.key])}>{r[c.key]}</Badge> : (r[c.key] || "—")}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
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

function EmployeesTab() {
  return (
    <ManagedList
      addLabel="Add Employee" searchKeys={["code", "name", "dept", "designation", "branch"]} badgeKeys={["status"]}
      columns={[{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "dept", label: "Department" }, { key: "designation", label: "Designation" }, { key: "type", label: "Type" }, { key: "branch", label: "Branch" }, { key: "status", label: "Status", align: "center" }]}
      fields={[{ name: "name", label: "Employee Name" }]}
      seed={EMPLOYEES.map((e) => ({ id: e.id, code: e.code, name: e.name, dept: e.dept, designation: e.designation, type: e.type, branch: e.branch, mobile: e.mobile, status: e.status }))}
      renderCreate={({ onSave, onCancel }) => <EmployeeCreateForm onSave={onSave} onCancel={onCancel} />}
    />
  );
}
function UsersTab() {
  return (
    <ManagedList
      addLabel="Create User" searchKeys={["username", "email", "role"]} badgeKeys={["status", "twofa"]}
      columns={[{ key: "username", label: "Username" }, { key: "email", label: "Login Email" }, { key: "role", label: "Role" }, { key: "branch", label: "Branch Access" }, { key: "twofa", label: "2FA", align: "center" }, { key: "status", label: "Status", align: "center" }]}
      fields={[{ name: "username", label: "Username" }]}
      seed={USERS.map((u) => ({ id: u.id, username: u.username, email: u.email, role: u.role, branch: u.branch, twofa: u.twofa, status: u.status }))}
      renderCreate={({ onSave, onCancel }) => <UserCreateForm onSave={onSave} onCancel={onCancel} />}
    />
  );
}

/* ---------------------------------------------------- create screens --- */
function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function CreateScreen({ title, icon: Icon, onCancel, onSave, saveLabel, children }: { title: string; icon: LucideIcon; onCancel: () => void; onSave: () => void; saveLabel: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <button onClick={onCancel} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Back to list</button>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/[0.07] to-transparent px-5 py-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><Icon className="h-[18px] w-[18px]" /></span>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
        <div className="space-y-5 p-5 sm:p-6">{children}</div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" size="md" onClick={onCancel}>Cancel</Button>
          <Button size="md" onClick={onSave}><Check className="h-4 w-4" /> {saveLabel}</Button>
        </div>
      </div>
    </div>
  );
}
function FlagCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Switch checked={checked} onChange={onChange} aria-label={label} />
    </label>
  );
}

function EmployeeCreateForm({ onSave, onCancel }: { onSave: (r: Record<string, string>) => void; onCancel: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ status: "Active", type: "Permanent" });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const T = (k: string, label: string, type = "text") => <Input label={label} type={type} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} />;
  const S = (k: string, label: string, opts: { value: string; label: string }[]) => <Select label={label} placeholder="Select…" options={opts} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} />;
  function submit() {
    if (!f.name?.trim()) return;
    onSave({ code: f.code || "", name: f.name, dept: f.dept || "", designation: f.designation || "", type: f.type || "Permanent", branch: f.branch || "", mobile: f.mobile || "", status: f.status || "Active" });
  }
  return (
    <CreateScreen title="Add Employee" icon={Users} onCancel={onCancel} onSave={submit} saveLabel="Save Employee">
      <SubHeading>Employee Information</SubHeading>
      <FormGrid>
        {T("code", "Employee Code")}{T("name", "Employee Name *")}{S("gender", "Gender", GENDER_OPTS)}
        {T("dob", "Date of Birth", "date")}{T("mobile", "Mobile Number")}{T("altMobile", "Alternate Mobile")}
        {T("email", "Email ID", "email")}{T("aadhaar", "Aadhaar Number")}{T("pan", "PAN Number")}
      </FormGrid>
      <SubHeading>Employment Details</SubHeading>
      <FormGrid>
        {S("type", "Employee Type", EMP_TYPE_OPTS)}{S("dept", "Department", DEPARTMENTS)}{S("designation", "Designation", DESIGNATIONS)}
        {T("manager", "Reporting Manager")}{T("joining", "Joining Date", "date")}{S("status", "Employment Status", EMP_STATUS_OPTS)}
      </FormGrid>
      <SubHeading>Branch Assignment</SubHeading>
      <FormGrid>
        {S("branch", "Branch", BRANCHES)}{T("warehouse", "Warehouse")}{T("store", "Store")}
      </FormGrid>
    </CreateScreen>
  );
}

function UserCreateForm({ onSave, onCancel }: { onSave: (r: Record<string, string>) => void; onCancel: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ status: "Active", branch: "All Branches" });
  const [flags, setFlags] = useState({ sendDefault: true, forceReset: true, twofa: false, otp: false, biometric: false });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const fl = (k: keyof typeof flags, v: boolean) => setFlags((s) => ({ ...s, [k]: v }));
  const branchOpts = [{ value: "All Branches", label: "All Branches" }, ...BRANCHES];
  const empOpts = [{ value: "", label: "— Not linked —" }, ...EMPLOYEES.map((e) => ({ value: e.id, label: `${e.name} · ${e.code}` }))];
  function linkEmployee(id: string) {
    const emp = EMPLOYEES.find((e) => e.id === id);
    setF((s) => ({
      ...s,
      employee: id,
      ...(emp ? { mobile: emp.mobile, username: s.username || emp.name.toLowerCase().replace(/\s+/g, ".") } : {}),
    }));
  }
  function submit() {
    if (!f.username?.trim()) return;
    onSave({ username: f.username, email: f.email || "", role: f.role || "", branch: f.branch || "All Branches", twofa: flags.twofa ? "On" : "Off", status: f.status || "Active" });
  }
  return (
    <CreateScreen title="Create User" icon={UserCog} onCancel={onCancel} onSave={submit} saveLabel="Create User">
      <SubHeading>Link to Employee (optional)</SubHeading>
      <div className="sm:max-w-md">
        <Select label="Link this user to an employee?" placeholder="— Not linked —" options={empOpts} value={f.employee ?? ""} onChange={(e) => linkEmployee(e.target.value)} />
        <p className="mt-1.5 text-2xs text-muted">Optional — pick an employee to auto-fill their mobile &amp; username, or leave unlinked.</p>
      </div>

      <SubHeading>User Information</SubHeading>
      <FormGrid>
        <Input label="Username *" value={f.username ?? ""} onChange={(e) => set("username", e.target.value)} />
        <Input label="Login Email" type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        <Input label="Registered Mobile Number *" hint="The default password is sent to this number." value={f.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} />
      </FormGrid>

      <SubHeading>Access</SubHeading>
      <FormGrid>
        <Select label="Role" placeholder="Select role…" options={SYSTEM_ROLES.map((r) => ({ value: r, label: r }))} value={f.role ?? ""} onChange={(e) => set("role", e.target.value)} />
        <Select label="Branch Access" options={branchOpts} value={f.branch ?? ""} onChange={(e) => set("branch", e.target.value)} />
      </FormGrid>

      <SubHeading>Password</SubHeading>
      <div className="flex items-start gap-2.5 rounded-lg border border-info/30 bg-info-subtle p-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-info" />
        <p className="text-xs text-info">After the user is created, a <strong>password is generated in the backend</strong> and shared on the <strong>registered mobile number / email</strong>. The user must <strong>reset it at first login</strong>.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FlagCard label="Send default password to mobile & email" checked={flags.sendDefault} onChange={(v) => fl("sendDefault", v)} />
        <FlagCard label="Force password reset on first login" checked={flags.forceReset} onChange={(v) => fl("forceReset", v)} />
      </div>

      <SubHeading>Security</SubHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        <FlagCard label="Two-Factor Authentication" checked={flags.twofa} onChange={(v) => fl("twofa", v)} />
        <FlagCard label="OTP Login" checked={flags.otp} onChange={(v) => fl("otp", v)} />
        <FlagCard label="Biometric Login" checked={flags.biometric} onChange={(v) => fl("biometric", v)} />
      </div>

      <SubHeading>Status</SubHeading>
      <div className="sm:max-w-xs">
        <Select label="Status" options={USER_STATUS_OPTS} value={f.status ?? ""} onChange={(e) => set("status", e.target.value)} />
      </div>
    </CreateScreen>
  );
}
function RolesTab() {
  return (
    <div className="space-y-5">
      <SubHeading>System Roles</SubHeading>
      <div className="flex flex-wrap gap-2">
        {SYSTEM_ROLES.map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {r}
          </span>
        ))}
      </div>
      <SubHeading>Custom Roles</SubHeading>
      <ManagedList
        addLabel="Create Role" searchKeys={["code", "name", "desc"]}
        columns={[{ key: "code", label: "Role Code" }, { key: "name", label: "Role Name" }, { key: "desc", label: "Description" }]}
        fields={[{ name: "code", label: "Role Code" }, { name: "name", label: "Role Name" }, { name: "desc", label: "Description" }]}
        seed={[{ id: "r1", code: "ROL-01", name: "Counter Supervisor", desc: "Oversees POS counters" }]}
      />
    </div>
  );
}
function PermissionsTab() {
  return <PermissionMatrix />;
}
function PermissionMatrix() {
  const [role, setRole] = useState("Store Manager");
  // perms[module] = Set of enabled levels
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>(() => {
    const seed: Record<string, Record<string, boolean>> = {};
    PERMISSION_GROUPS.forEach((g) => g.modules.forEach((m) => {
      seed[m] = {};
      PERMISSION_LEVELS.forEach((l) => { seed[m][l] = ["View", "Add", "Edit"].includes(l); });
    }));
    return seed;
  });
  function toggle(m: string, l: string) {
    setPerms((p) => ({ ...p, [m]: { ...p[m], [l]: !p[m][l] } }));
  }
  function setAll(m: string, val: boolean) {
    setPerms((p) => ({ ...p, [m]: Object.fromEntries(PERMISSION_LEVELS.map((l) => [l, val])) }));
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <label className="mb-1.5 block text-[13px] font-semibold text-foreground">Permissions for role</label>
          <Select options={SYSTEM_ROLES.map((r) => ({ value: r, label: r }))} value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <Button size="md"><Check className="h-4 w-4" /> Save Permissions</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-2.5 text-left">Module</th>
                {PERMISSION_LEVELS.map((l) => (<th key={l} className="px-2 py-2.5 text-center">{l}</th>))}
                <th className="px-3 py-2.5 text-center">All</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((g) => (
                <FragmentGroup key={g.group} group={g.group} modules={g.modules} perms={perms} toggle={toggle} setAll={setAll} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-2xs text-subtle">Role-Based Access Control — tick the actions each role can perform per module. “Approve” gates maker-checker steps.</p>
    </div>
  );
}
function FragmentGroup({ group, modules, perms, toggle, setAll }: { group: string; modules: string[]; perms: Record<string, Record<string, boolean>>; toggle: (m: string, l: string) => void; setAll: (m: string, v: boolean) => void; }) {
  return (
    <>
      <tr className="bg-surface-2/60"><td colSpan={PERMISSION_LEVELS.length + 2} className="px-4 py-1.5 text-2xs font-bold uppercase tracking-wide text-primary">{group}</td></tr>
      {modules.map((m) => {
        const allOn = PERMISSION_LEVELS.every((l) => perms[m]?.[l]);
        return (
          <tr key={m} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
            <td className="px-4 py-2 font-medium text-foreground">{m}</td>
            {PERMISSION_LEVELS.map((l) => (
              <td key={l} className="px-2 py-2 text-center">
                <button onClick={() => toggle(m, l)} className={cn("grid h-5 w-5 place-items-center rounded border transition", perms[m]?.[l] ? "border-primary bg-primary text-white" : "border-border-strong bg-surface hover:border-primary/50")}>
                  {perms[m]?.[l] && <Check className="h-3 w-3" strokeWidth={3} />}
                </button>
              </td>
            ))}
            <td className="px-3 py-2 text-center">
              <Switch checked={allOn} onChange={(v) => setAll(m, v)} aria-label={`All ${m}`} />
            </td>
          </tr>
        );
      })}
    </>
  );
}
function BranchTab() {
  const [access, setAccess] = useState("assigned");
  const [wh, setWh] = useState("assigned");
  return (
    <div className="space-y-5">
      <SubHeading>Branch Access Level</SubHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        {[["all", "All Branches", "Access every branch & store"], ["assigned", "Assigned Branches", "Only selected branches"], ["own", "Own Branch Only", "Just the user's home branch"]].map(([id, t, d]) => (
          <RadioCard key={id} selected={access === id} onSelect={() => setAccess(id)} title={t} description={d} />
        ))}
      </div>
      {access === "assigned" && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Branch</th><th className="px-4 py-2.5">Access Level</th></tr></thead>
            <tbody>
              {BRANCHES.map((b) => (
                <tr key={b.value} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{b.label}</td>
                  <td className="px-4 py-2"><div className="max-w-[180px]"><Select options={[{ value: "full", label: "Full Access" }, { value: "view", label: "View Only" }, { value: "none", label: "No Access" }]} defaultValue="full" onChange={() => {}} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SubHeading>Warehouse Access</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <RadioCard selected={wh === "all"} onSelect={() => setWh("all")} title="All Warehouses" />
        <RadioCard selected={wh === "assigned"} onSelect={() => setWh("assigned")} title="Assigned Warehouses" />
      </div>
    </div>
  );
}
function ApprovalTab() {
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">Configure multi-level approval chains. Each level must approve before the next is notified.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {APPROVAL_FLOWS.map((f) => (
          <div key={f.name} className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center gap-2"><GitPullRequestArrow className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold text-foreground">{f.name}</h4></div>
            <div className="flex flex-wrap items-center gap-1.5">
              {f.levels.map((l, i) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-medium text-primary"><span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-white">{i + 1}</span>{l}</span>
                  {i < f.levels.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-subtle" />}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function AttendanceTab() {
  const [on, setOn] = useState<Record<string, boolean>>({ manual: true, biometric: true });
  return (
    <div className="space-y-5">
      <SubHeading>Attendance Methods</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ATTENDANCE_METHODS.map((m) => (
          <label key={m.id} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3.5 transition", on[m.id] ? "border-primary/40 bg-primary-subtle/40" : "border-border bg-surface hover:bg-surface-2")}>
            <span className="text-sm font-medium text-foreground">{m.label}</span>
            <Switch checked={!!on[m.id]} onChange={() => setOn((o) => ({ ...o, [m.id]: !o[m.id] }))} aria-label={m.label} />
          </label>
        ))}
      </div>
      <SubHeading>Tracked</SubHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Check In", "09:02 AM"], ["Check Out", "07:14 PM"], ["Working Hours", "9h 12m"], ["Overtime", "1h 12m"]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-lg font-bold text-foreground">{v}</p>
            <p className="text-2xs text-muted">{k}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
function ShiftsTab() {
  return (
    <ManagedList
      addLabel="Add Shift" searchKeys={["code", "name"]}
      columns={[{ key: "code", label: "Code" }, { key: "name", label: "Shift" }, { key: "start", label: "Start" }, { key: "end", label: "End" }, { key: "break", label: "Break" }]}
      fields={[{ name: "code", label: "Shift Code" }, { name: "name", label: "Shift Name" }, { name: "start", label: "Start Time" }, { name: "end", label: "End Time" }, { name: "break", label: "Break Time" }]}
      seed={SHIFTS.map((s) => ({ id: s.id, code: s.code, name: s.name, start: s.start, end: s.end, break: s.break }))}
    />
  );
}
function PerformanceTab() {
  return (
    <div className="space-y-3">
      <SubHeading>Employee Performance &amp; KPIs</SubHeading>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-2.5">Employee</th><th className="px-4 py-2.5 text-right">Sales</th><th className="px-4 py-2.5 text-right">Collections</th><th className="px-4 py-2.5 text-center">Customers</th><th className="px-4 py-2.5 text-center">Attendance</th><th className="px-4 py-2.5 text-center">Achievement</th><th className="px-4 py-2.5 text-right">Incentive</th>
              </tr>
            </thead>
            <tbody>
              {PERFORMANCE.map((p) => (
                <tr key={p.name} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                  <td className="px-4 py-2.5 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-2.5 text-right text-foreground">{p.sales}</td>
                  <td className="px-4 py-2.5 text-right text-foreground">{p.collections}</td>
                  <td className="px-4 py-2.5 text-center text-muted">{p.customers}</td>
                  <td className="px-4 py-2.5 text-center"><span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-semibold text-success">{p.attendance}</span></td>
                  <td className="px-4 py-2.5 text-center font-semibold text-foreground">{p.achievement}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-success">{p.incentive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function AuditTab() {
  const [query, setQuery] = useState("");
  const rows = AUDIT_LOG.filter((a) => !query || `${a.user} ${a.action} ${a.ip} ${a.device}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search audit log…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Date &amp; Time</th><th className="px-4 py-2.5">IP Address</th><th className="px-4 py-2.5">Device</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                  <td className="px-4 py-2.5 font-medium text-foreground">{a.user}</td>
                  <td className="px-4 py-2.5"><span className={cn("inline-flex items-center gap-1.5", a.tone === "danger" ? "text-danger" : a.tone === "warning" ? "text-warning" : a.tone === "success" ? "text-success" : "text-muted")}><span className={cn("h-1.5 w-1.5 rounded-full", a.tone === "danger" ? "bg-danger" : a.tone === "warning" ? "bg-warning" : a.tone === "success" ? "bg-success" : "bg-info")} />{a.action}</span></td>
                  <td className="px-4 py-2.5 text-muted">{a.datetime}</td>
                  <td className="px-4 py-2.5 font-mono text-2xs text-muted">{a.ip}</td>
                  <td className="px-4 py-2.5 text-muted">{a.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-4 py-2 text-xs text-muted">{rows.length} events</div>
      </div>
    </div>
  );
}
function AiTab() {
  const [method, setMethod] = useState("aadhaar");
  const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");
  const methods = [
    { id: "aadhaar", icon: ScanLine, t: "Aadhaar Scan", d: "95% · 20s" },
    { id: "card", icon: Contact, t: "Visiting Card Scan", d: "85% · 20s" },
    { id: "excel", icon: FileSpreadsheet, t: "Employee Excel Import", d: "100% · varies" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white">
        <Sparkles className="h-6 w-6 shrink-0" /><div><p className="text-sm font-bold">AI Employee Setup</p><p className="text-xs text-white/85">Scan an Aadhaar / card or upload Excel — AI extracts name, mobile, email & designation.</p></div>
      </div>
      <SubHeading>Choose a source</SubHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        {methods.map((m) => (
          <button key={m.id} type="button" onClick={() => { setMethod(m.id); setPhase("idle"); }} className={cn("rounded-xl border p-4 text-left transition", method === m.id ? "border-primary bg-primary-subtle/40 ring-1 ring-primary" : "border-border bg-surface hover:bg-surface-2")}>
            <span className={cn("grid h-9 w-9 place-items-center rounded-lg", method === m.id ? "bg-brand-gradient text-white" : "bg-primary-subtle text-primary")}><m.icon className="h-5 w-5" /></span>
            <p className="mt-2.5 text-sm font-semibold text-foreground">{m.t}</p>
            <p className="text-2xs text-muted">Accuracy {m.d}</p>
          </button>
        ))}
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center transition hover:border-primary hover:bg-primary-subtle/30">
        <UploadCloud className="h-8 w-8 text-primary" /><span className="text-sm font-medium text-foreground">Click to upload</span><input type="file" className="hidden" />
      </label>
      {phase === "idle" && <Button size="lg" block onClick={() => { setPhase("processing"); window.setTimeout(() => setPhase("done"), 1500); }}><Sparkles className="h-4 w-4" /> Analyze with AI</Button>}
      {phase === "processing" && <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium text-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Extracting employee details…</div>}
      {phase === "done" && (
        <div className="space-y-3 rounded-xl border border-success/30 bg-success-subtle p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-5 w-5" /> Extracted with 95% confidence:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[["Name", "Ramesh Iyer"], ["Mobile", "+91 98765 43219"], ["Email", "ramesh@example.com"], ["Designation", "Sales Executive"]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-surface p-2"><p className="text-2xs text-muted">{k}</p><p className="text-sm font-medium text-foreground">{v}</p></div>
            ))}
          </div>
          <Button size="md"><Check className="h-4 w-4" /> Create Employee Record</Button>
        </div>
      )}
    </div>
  );
}
function ImportTab() {
  return (
    <div className="space-y-5">
      <SubHeading>1. What to import</SubHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        {["Employee Master", "User Accounts", "Reporting Structure"].map((t) => (
          <div key={t} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-subtle text-primary"><Download className="h-[18px] w-[18px]" /></span><span className="text-sm font-semibold text-foreground">{t}</span></div>
        ))}
      </div>
      <SubHeading>2. Source &amp; upload</SubHeading>
      <div className="flex flex-wrap gap-2">{["Excel", "CSV", "Existing ERP"].map((s) => (<span key={s} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground">{s}</span>))}</div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center transition hover:border-primary hover:bg-primary-subtle/30">
        <FileSpreadsheet className="h-8 w-8 text-primary" /><span className="text-sm font-medium text-foreground">Drag &amp; drop or click to upload</span><input type="file" className="hidden" accept=".xlsx,.csv" />
      </label>
      <SubHeading>3. Validation report</SubHeading>
      <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-sm">
        <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> 44 employees valid</span><span className="inline-flex items-center gap-1.5 text-danger"><CircleAlert className="h-4 w-4" /> 4 errors</span></div>
        <ul className="space-y-1 text-2xs text-muted"><li>Row 9 — Duplicate employee code “EMP-1003”.</li><li>Row 21 — Duplicate mobile number.</li><li>Row 33 — Invalid email address.</li></ul>
      </div>
    </div>
  );
}

const TAB_BODIES: Record<string, () => ReactNode> = {
  employees: EmployeesTab, users: UsersTab, roles: RolesTab, permissions: PermissionsTab,
  branch: BranchTab, approval: ApprovalTab, attendance: AttendanceTab, shifts: ShiftsTab,
  performance: PerformanceTab, audit: AuditTab, ai: AiTab, import: ImportTab,
};

/* ============================================================ console === */
const STAT_TONES = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white", accent: "bg-accent text-accent-foreground" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: keyof typeof STAT_TONES }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg shadow-sm", STAT_TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-xl font-bold tracking-tight text-foreground">{value}</p></div>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}

const QUICK = [
  { tab: "employees", icon: Users, label: "Add Employee", tone: "primary" as const },
  { tab: "users", icon: UserCog, label: "Create User", tone: "secondary" as const },
  { tab: "roles", icon: ShieldCheck, label: "Create Role", tone: "accent" as const },
  { tab: "permissions", icon: KeyRound, label: "Configure Permissions", tone: "success" as const },
  { tab: "branch", icon: MapPin, label: "Assign Branch Access", tone: "primary" as const },
];
const QA_TONES = { primary: { card: "border-primary/20 bg-primary-subtle", ring: "text-primary" }, secondary: { card: "border-secondary/20 bg-secondary-subtle", ring: "text-secondary" }, success: { card: "border-success/20 bg-success-subtle", ring: "text-success" }, accent: { card: "border-accent/30 bg-accent/10", ring: "text-accent-foreground" } } as const;

export function UserRolesConsole() {
  const [activeId, setActiveId] = useState("employees");
  const active = ORG_TABS.find((t) => t.id === activeId) ?? ORG_TABS[0];
  const Body = TAB_BODIES[active.id];
  let lastGroup = "";

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>System</span><span className="text-subtle">/</span><span className="font-medium text-foreground">User &amp; Roles</span></div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">User &amp; Roles</h1>
          <p className="mt-0.5 text-sm text-muted">Employees, user accounts, RBAC permissions, branch access &amp; audit.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="md" onClick={() => setActiveId("import")}><UploadCloud className="h-4 w-4" /> Import</Button>
          <Button variant="secondary" size="md" onClick={() => setActiveId("ai")}><Sparkles className="h-4 w-4" /> AI Setup</Button>
          <Button size="md" onClick={() => setActiveId("employees")}><Plus className="h-4 w-4" /> Add Employee</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={Users} label="Total Employees" value={String(ORG_STATS.employees)} tone="primary" />
        <Stat icon={CheckCircle2} label="Active" value={String(ORG_STATS.active)} tone="success" />
        <Stat icon={UserCog} label="Users Created" value={String(ORG_STATS.users)} tone="secondary" />
        <Stat icon={ShieldCheck} label="Roles" value={String(ORG_STATS.roles)} tone="accent" />
        <Stat icon={GitPullRequestArrow} label="Pending Approvals" value={String(ORG_STATS.pending)} tone="warning" />
        <Stat icon={Clock} label="Attendance Today" value={ORG_STATS.attendanceToday} tone="danger" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {QUICK.map((q) => {
          const t = QA_TONES[q.tone];
          return (
            <button key={q.label} onClick={() => setActiveId(q.tab)} className={cn("flex flex-col items-center gap-2.5 rounded-2xl border p-4 text-center transition hover:-translate-y-0.5 hover:shadow-sm", t.card)}>
              <span className={cn("grid h-11 w-11 place-items-center rounded-full bg-surface shadow-sm", t.ring)}><q.icon className="h-5 w-5" /></span>
              <span className="text-xs font-semibold leading-tight text-foreground">{q.label}</span>
            </button>
          );
        })}
      </div>

      {/* Console */}
      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-4 space-y-0.5 rounded-2xl border border-border bg-card p-2 shadow-sm">
            {ORG_TABS.map((t) => {
              const Icon = t.icon;
              const isActive = t.id === active.id;
              const header = t.group !== lastGroup ? ((lastGroup = t.group), t.group) : null;
              return (
                <div key={t.id}>
                  {header && <p className="px-2 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">{header}</p>}
                  <button type="button" onClick={() => setActiveId(t.id)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition", isActive ? "nav-item-active font-semibold text-white shadow-sm" : "text-muted hover:bg-surface-2")}>
                    <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{t.label}</span>
                  </button>
                </div>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0">
          <div className="mb-4 lg:hidden"><Select options={ORG_TABS.map((t) => ({ value: t.id, label: t.label }))} value={active.id} onChange={(e) => setActiveId(e.target.value)} /></div>
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
