"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck, UserCog, KeyRound, Plus, X, CheckCircle2, AlertCircle, Pencil, Trash2, Lock, Search,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";

interface Role { id: number; name: string; slug: string; description: string; isSystem: boolean; isAllAccess: boolean; users: number; permissionKeys: string[] }
interface UserRow { id: number; fullName: string; username: string; email: string; mobile: string; role: string; roleId: number | null; businessId: number | null; branchId: number | null; status: string; terminalIds?: number[] }
interface Opt { id: number; name: string }
interface BranchOpt extends Opt { businessId: number }
interface TerminalOpt { id: number; code: string; name: string; branchId: number | null }
interface PermGroup { module: string; items: { key: string; label: string }[] }

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";

export function AccessConsole() {
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [businesses, setBusinesses] = useState<Opt[]>([]);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [terminals, setTerminals] = useState<TerminalOpt[]>([]);
  const [groups, setGroups] = useState<PermGroup[]>([]);

  const load = useCallback(async () => {
    try {
      const [u, r, p] = await Promise.all([
        fetch("/api/system/users", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/system/roles", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/system/permissions", { cache: "no-store" }).then((x) => x.json()),
      ]);
      if (u.ok) { setUsers(u.users); setBusinesses(u.businesses); setBranches(u.branches); setTerminals(u.terminals ?? []); }
      else setError(u.message || "Could not load users.");
      if (r.ok) setRoles(r.roles);
      if (p.ok) setGroups(p.groups);
    } catch { setError("Network error."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading access control…" size="sm" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>System</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Users &amp; Roles</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ShieldCheck className="h-5 w-5 text-primary" /> Users, Roles &amp; Permissions</h1>
        <p className="mt-0.5 text-sm text-muted">Create user accounts with a password, assign roles, and control which features each role can access.</p>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-subtle px-4 py-2.5 text-sm font-medium text-danger"><AlertCircle className="h-4 w-4 shrink-0" /> {error}</div>}

      <div className="inline-flex overflow-hidden rounded-lg border border-border text-sm">
        {([["users", "User Accounts", UserCog], ["roles", "Roles & Permissions", KeyRound]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("inline-flex items-center gap-1.5 px-4 py-2 font-semibold transition", tab === id ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2")}><Icon className="h-4 w-4" /> {label}</button>
        ))}
      </div>

      {tab === "users"
        ? <UsersTab users={users} roles={roles} businesses={businesses} branches={branches} terminals={terminals} onChanged={load} onError={setError} />
        : <RolesTab roles={roles} groups={groups} onChanged={load} onError={setError} />}
    </div>
  );
}

/* ============================== Users tab ============================== */
function UsersTab({ users, roles, businesses, branches, terminals, onChanged, onError }: { users: UserRow[]; roles: Role[]; businesses: Opt[]; branches: BranchOpt[]; terminals: TerminalOpt[]; onChanged: () => Promise<void>; onError: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ mode: "add" } | { mode: "edit"; user: UserRow } | null>(null);
  const filtered = users.filter((u) => !q || `${u.fullName} ${u.username} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  const roleName = (id: number | null) => roles.find((r) => r.id === id)?.name ?? "—";

  return (
    <SectionCard icon={UserCog} title={`User Accounts (${users.length})`} allowOverflow
      action={<Button size="sm" onClick={() => setModal({ mode: "add" })}><Plus className="h-3.5 w-3.5" /> Add User</Button>}>
      <div className="mb-3 relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, username, email…" className={cn(inp, "pl-9")} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">User</th><th className="px-3 py-2.5">Username</th><th className="px-3 py-2.5">Role</th><th className="px-3 py-2.5">Business / Branch</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-right">Actions</th></tr></thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                <td className="px-3 py-2.5"><div className="font-medium text-foreground">{u.fullName}</div><div className="text-2xs text-muted">{u.email}</div></td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted">{u.username}</td>
                <td className="px-3 py-2.5"><Badge tone="primary">{roleName(u.roleId)}</Badge></td>
                <td className="px-3 py-2.5 text-2xs text-muted">{businesses.find((b) => b.id === u.businessId)?.name ?? "—"}{u.branchId ? ` · ${branches.find((b) => b.id === u.branchId)?.name ?? ""}` : ""}</td>
                <td className="px-3 py-2.5 text-center"><Badge tone={u.status === "active" ? "success" : u.status === "suspended" ? "danger" : "neutral"}>{u.status}</Badge></td>
                <td className="px-3 py-2.5 text-right"><button onClick={() => setModal({ mode: "edit", user: u })} className="inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline"><Pencil className="h-3 w-3" /> Edit</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted">No users found.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && <UserModal modal={modal} roles={roles} businesses={businesses} branches={branches} terminals={terminals} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await onChanged(); }} onError={onError} />}
    </SectionCard>
  );
}

function UserModal({ modal, roles, businesses, branches, terminals, onClose, onSaved, onError }: { modal: { mode: "add" } | { mode: "edit"; user: UserRow }; roles: Role[]; businesses: Opt[]; branches: BranchOpt[]; terminals: TerminalOpt[]; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const isAdd = modal.mode === "add";
  const u = isAdd ? null : modal.user;
  const [f, setF] = useState({
    fullName: u?.fullName ?? "", username: u?.username ?? "", email: u?.email ?? "", mobile: u?.mobile ?? "",
    password: "", roleId: u?.roleId ?? roles[0]?.id ?? 0, businessId: u?.businessId ?? businesses[0]?.id ?? 0, branchId: u?.branchId ?? 0, status: u?.status ?? "active",
  });
  const [terminalIds, setTerminalIds] = useState<number[]>(u?.terminalIds ?? []);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const branchOpts = branches.filter((b) => b.businessId === Number(f.businessId));
  const toggleTerminal = (id: number) => setTerminalIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function save() {
    setBusy(true); setErrs({});
    try {
      const url = isAdd ? "/api/system/users" : `/api/system/users/${u!.id}`;
      const method = isAdd ? "POST" : "PATCH";
      const body: Record<string, unknown> = { roleId: Number(f.roleId), businessId: Number(f.businessId) || null, branchId: Number(f.branchId) || null, status: f.status, fullName: f.fullName, terminalIds };
      if (isAdd) Object.assign(body, { username: f.username, email: f.email, mobile: f.mobile, password: f.password });
      else if (f.password) body.password = f.password;
      const j = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (!j.ok) { if (j.errors) setErrs(j.errors); onError(j.message || "Could not save the user."); return; }
      onSaved();
    } catch { onError("Network error."); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center gap-2.5 border-b border-border bg-primary-subtle/40 px-5 py-3.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><UserCog className="h-4 w-4" /></span>
          <h3 className="flex-1 text-sm font-bold text-foreground">{isAdd ? "Add User Account" : `Edit — ${u!.fullName}`}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={lbl}>Full Name <span className="text-danger">*</span></label><input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} className={inp} />{errs.fullName && <p className="mt-1 text-2xs text-danger">{errs.fullName}</p>}</div>
            <div><label className={lbl}>Username <span className="text-danger">*</span></label><input value={f.username} disabled={!isAdd} onChange={(e) => setF({ ...f, username: e.target.value })} className={cn(inp, !isAdd && "opacity-60")} />{errs.username && <p className="mt-1 text-2xs text-danger">{errs.username}</p>}</div>
            <div><label className={lbl}>Mobile <span className="text-danger">*</span></label><input value={f.mobile} disabled={!isAdd} onChange={(e) => setF({ ...f, mobile: e.target.value })} className={cn(inp, !isAdd && "opacity-60")} />{errs.mobile && <p className="mt-1 text-2xs text-danger">{errs.mobile}</p>}</div>
            <div className="col-span-2"><label className={lbl}>Email <span className="text-danger">*</span></label><input value={f.email} disabled={!isAdd} onChange={(e) => setF({ ...f, email: e.target.value })} className={cn(inp, !isAdd && "opacity-60")} />{errs.email && <p className="mt-1 text-2xs text-danger">{errs.email}</p>}</div>
            <div className="col-span-2"><label className={lbl}><Lock className="mr-1 inline h-3 w-3" />{isAdd ? "Password" : "Reset Password (optional)"} {isAdd && <span className="text-danger">*</span>}</label><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder={isAdd ? "Min 8 characters" : "Leave blank to keep current"} className={inp} />{errs.password && <p className="mt-1 text-2xs text-danger">{errs.password}</p>}</div>
            <div><label className={lbl}>Role <span className="text-danger">*</span></label><select value={f.roleId} onChange={(e) => setF({ ...f, roleId: Number(e.target.value) })} className={inp}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>{errs.roleId && <p className="mt-1 text-2xs text-danger">{errs.roleId}</p>}</div>
            <div><label className={lbl}>Status</label><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inp}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div>
            <div><label className={lbl}>Business</label><select value={f.businessId} onChange={(e) => setF({ ...f, businessId: Number(e.target.value), branchId: 0 })} className={inp}><option value={0}>—</option>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className={lbl}>Branch</label><select value={f.branchId} onChange={(e) => setF({ ...f, branchId: Number(e.target.value) })} className={inp}><option value={0}>—</option>{branchOpts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div className="col-span-2">
              <label className={lbl}>Mapped POS Terminals</label>
              {terminals.length === 0 ? (
                <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-2xs text-muted">No POS terminals configured yet.</p>
              ) : (
                <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border-strong bg-surface p-1.5">
                  {terminals.map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2">
                      <input type="checkbox" checked={terminalIds.includes(t.id)} onChange={() => toggleTerminal(t.id)} className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary" />
                      <span className="truncate text-foreground">{t.code} — {t.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-1 text-2xs text-muted">Leave empty for full access; mapped users only see their terminals&apos; transactions when Terminal-based Setup is on.</p>
            </div>
          </div>
          <p className="rounded-lg bg-info-subtle/60 p-2.5 text-2xs text-info">The password is set here — no OTP or email verification is needed. The user can sign in immediately with their username/email + this password.</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={save} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Saving…" : isAdd ? "Create User" : "Save Changes"}</Button>
        </div>
      </div>
    </div>
  );
}

/* ============================== Roles tab ============================== */
function RolesTab({ roles, groups, onChanged, onError }: { roles: Role[]; groups: PermGroup[]; onChanged: () => Promise<void>; onError: (m: string) => void }) {
  const [selId, setSelId] = useState<number | null>(roles[0]?.id ?? null);
  const sel = roles.find((r) => r.id === selId) ?? roles[0] ?? null;
  const [keys, setKeys] = useState<Set<string>>(new Set(sel?.permissionKeys ?? []));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  // Reset matrix when switching role.
  const selKeysSig = useMemo(() => (sel ? sel.id + ":" + sel.permissionKeys.length : ""), [sel]);
  useEffect(() => { setKeys(new Set(sel?.permissionKeys ?? [])); setDirty(false); }, [selKeysSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (k: string) => { setKeys((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; }); setDirty(true); };
  const toggleGroup = (g: PermGroup, on: boolean) => { setKeys((s) => { const n = new Set(s); g.items.forEach((i) => on ? n.add(i.key) : n.delete(i.key)); return n; }); setDirty(true); };

  async function save() {
    if (!sel) return;
    setBusy(true);
    try {
      const j = await fetch(`/api/system/roles/${sel.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissionKeys: [...keys] }) }).then((r) => r.json());
      if (!j.ok) { onError(j.message || "Could not save."); return; }
      setDirty(false); await onChanged();
    } catch { onError("Network error."); } finally { setBusy(false); }
  }
  async function addRole() {
    if (!newName.trim()) return;
    const j = await fetch("/api/system/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, permissionKeys: ["dashboard"] }) }).then((r) => r.json());
    if (!j.ok) { onError(j.message || "Could not create role."); return; }
    setAdding(false); setNewName(""); await onChanged(); setSelId(j.id);
  }
  async function delRole() {
    if (!sel || sel.isSystem) return;
    const j = await fetch(`/api/system/roles/${sel.id}`, { method: "DELETE" }).then((r) => r.json());
    if (!j.ok) { onError(j.message || "Could not delete."); return; }
    setSelId(null); await onChanged();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Roles list */}
      <SectionCard icon={ShieldCheck} title={`Roles (${roles.length})`} bodyClass="p-2"
        action={<button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline"><Plus className="h-3.5 w-3.5" /> New</button>}>
        {adding && (
          <div className="mb-2 flex gap-1.5 p-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Role name" className={cn(inp, "h-8")} autoFocus />
            <Button size="sm" onClick={addRole}>Add</Button>
          </div>
        )}
        <ul className="space-y-0.5">
          {roles.map((r) => (
            <li key={r.id}>
              <button onClick={() => setSelId(r.id)} className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition", sel?.id === r.id ? "bg-primary-subtle/60 font-semibold text-primary" : "text-foreground hover:bg-surface-2")}>
                <span className="truncate">{r.name}</span>
                <span className="flex items-center gap-1">{r.isAllAccess && <Lock className="h-3 w-3 text-muted" />}<Badge tone="neutral">{r.users}</Badge></span>
              </button>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* Permission matrix */}
      <SectionCard icon={KeyRound} title={sel ? `Permissions — ${sel.name}` : "Permissions"}
        action={sel && !sel.isAllAccess ? (
          <div className="flex items-center gap-2">
            {!sel.isSystem && <button onClick={delRole} className="inline-flex items-center gap-1 text-2xs font-semibold text-danger hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
            <Button size="sm" onClick={save} disabled={!dirty || busy}><CheckCircle2 className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Save"}</Button>
          </div>
        ) : undefined}>
        {!sel ? <p className="py-8 text-center text-sm text-muted">Select a role.</p>
          : sel.isAllAccess ? <div className="flex items-center gap-2 rounded-lg bg-success-subtle p-3 text-sm text-success"><Lock className="h-4 w-4" /> This role has <strong>full access</strong> to all features and can&apos;t be restricted.</div>
            : (
              <div className="space-y-4">
                {sel.description && <p className="text-2xs text-muted">{sel.description}</p>}
                {groups.map((g) => {
                  const allOn = g.items.every((i) => keys.has(i.key));
                  return (
                    <div key={g.module}>
                      <div className="mb-1.5 flex items-center justify-between border-b border-border pb-1">
                        <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">{g.module}</span>
                        <button onClick={() => toggleGroup(g, !allOn)} className="text-2xs font-semibold text-primary hover:underline">{allOn ? "Clear" : "Select all"}</button>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {g.items.map((i) => (
                          <label key={i.key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                            <input type="checkbox" checked={keys.has(i.key)} onChange={() => toggle(i.key)} className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary" />
                            <span className="truncate text-foreground">{i.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
      </SectionCard>
    </div>
  );
}
