"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Plus, Pencil, Eye, Power, Trash2, X, CornerDownRight, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { AREA_TYPE_OPTS, INVENTORY_STORAGE_TYPE_OPTS, type AreaRow, type AreaDto } from "@/lib/contracts/area";

interface Branch { id: number; name: string }
type Form = Omit<AreaDto, "id" | "branchName" | "parentAreaName" | "businessId">;
const BLANK: Form = { branchId: 0, code: "", name: "", type: AREA_TYPE_OPTS[0], parentAreaId: null, description: "", status: "Active", isInventoryStorage: false, inventoryStorageType: null };

export function AreaMaster() {
  const toast = useToast();
  const [rows, setRows] = useState<AreaRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "add" | "edit" | "view"; id?: number } | null>(null);

  // Filters
  const [branchId, setBranchId] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const u = new URLSearchParams();
    if (branchId) u.set("branchId", branchId);
    if (type) u.set("type", type);
    if (status) u.set("status", status);
    if (appliedQ.trim()) u.set("q", appliedQ.trim());
    const j = await fetch(`/api/system/areas?${u}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setRows(j.rows); setBranches(j.branches ?? []); }
    else toast.error(j?.message || "Could not load areas.");
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, type, status, appliedQ]);
  useEffect(() => { load(); }, [load]);

  function resetFilters() { setBranchId(""); setType(""); setStatus(""); setQ(""); setAppliedQ(""); }

  // Order rows as a hierarchy (roots first, children indented under parents) —
  // grouped by branch first since areas from different branches are unrelated.
  const tree = useMemo(() => {
    const out: { row: AreaRow; depth: number }[] = [];
    const byBranch = new Map<number, AreaRow[]>();
    for (const r of rows) { if (!byBranch.has(r.branchId)) byBranch.set(r.branchId, []); byBranch.get(r.branchId)!.push(r); }
    for (const branchRows of byBranch.values()) {
      const byParent = new Map<number | null, AreaRow[]>();
      for (const r of branchRows) { const k = r.parentAreaId; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k)!.push(r); }
      const seen = new Set<number>();
      const walk = (parentId: number | null, depth: number) => { for (const r of byParent.get(parentId) ?? []) { out.push({ row: r, depth }); seen.add(r.id); walk(r.id, depth + 1); } };
      walk(null, 0);
      for (const r of branchRows) if (!seen.has(r.id)) out.push({ row: r, depth: 0 });
    }
    return out;
  }, [rows]);

  async function toggle(r: AreaRow) {
    const j = await fetch(`/api/system/areas/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: r.status === "Active" ? "Inactive" : "Active" }) }).then((x) => x.json());
    if (j.ok) { toast.success(j.message || "Updated."); load(); } else toast.error(j.message || "Failed.");
  }
  async function remove(r: AreaRow) {
    if (!window.confirm(`Delete area "${r.name}"?`)) return;
    const j = await fetch(`/api/system/areas/${r.id}`, { method: "DELETE" }).then((x) => x.json());
    if (j.ok) { toast.success("Area deleted."); load(); } else toast.error(j.message || "Failed.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Configuration</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Area Config</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><LayoutGrid className="h-5 w-5 text-primary" /> Area Configuration</h1>
          <p className="mt-0.5 text-sm text-muted">Configure storage, processing and operational areas within each branch.</p>
        </div>
        <Button size="md" onClick={() => setModal({ mode: "add" })}><Plus className="h-4 w-4" /> Add Area</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inpAuto}><option value="">All Branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={inpAuto}><option value="">All Types</option>{AREA_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inpAuto}><option value="">All Statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setAppliedQ(q); }} placeholder="Search area name / code…" className={cn(inp, "pl-9")} />
        </div>
        <Button size="sm" variant="primary" onClick={() => setAppliedQ(q)}><Search className="h-3.5 w-3.5" /> Search</Button>
        <Button size="sm" variant="outline" onClick={resetFilters}><X className="h-3.5 w-3.5" /> Reset</Button>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>
        : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No areas yet. <button onClick={() => setModal({ mode: "add" })} className="font-semibold text-primary hover:underline">Add one →</button></div>
        : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2.5 text-left">Area Code</th><th className="px-3 py-2.5 text-left">Area Name</th><th className="px-3 py-2.5 text-left">Branch</th>
              <th className="px-3 py-2.5 text-left">Type</th><th className="px-3 py-2.5 text-left">Inventory Storage</th><th className="px-3 py-2.5 text-left">Parent Area</th><th className="px-3 py-2.5 text-center">Status</th>
              <th className="px-3 py-2.5 text-left">Created On</th><th className="px-3 py-2.5 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {tree.map(({ row: r, depth }) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-mono text-2xs text-muted">{r.code}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>{depth > 0 && <CornerDownRight className="h-3.5 w-3.5 text-subtle" />}<span className="font-medium text-foreground">{r.name}</span>{r.childCount > 0 && <span className="text-2xs text-subtle">({r.childCount})</span>}</div></td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.branchName ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.type}</td>
                  <td className="px-3 py-2 text-2xs">{r.isInventoryStorage ? <Badge tone="info">{r.inventoryStorageType}</Badge> : <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.parentAreaName ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={r.status === "Active" ? "success" : "neutral"}>{r.status}</Badge></td>
                  <td className="px-3 py-2 text-2xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => setModal({ mode: "view", id: r.id })} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => setModal({ mode: "edit", id: r.id })} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => toggle(r)} title={r.status === "Active" ? "Deactivate" : "Activate"} className={cn("grid h-8 w-8 place-items-center rounded-md border transition", r.status === "Active" ? "border-warning/30 text-warning hover:bg-warning hover:text-white" : "border-success/30 text-success hover:bg-success hover:text-white")}><Power className="h-4 w-4" /></button>
                    {r.childCount === 0 && <button onClick={() => remove(r)} title="Delete" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-danger/30 hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {modal && <AreaModal mode={modal.mode} id={modal.id} branches={branches} parents={rows} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function AreaModal({ mode, id, branches, parents, onClose, onSaved }: { mode: "add" | "edit" | "view"; id?: number; branches: Branch[]; parents: AreaRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const readOnly = mode === "view";
  const [f, setF] = useState<Form>(BLANK);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!id) return;
    fetch(`/api/system/areas/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok) {
        const a: AreaDto = j.area;
        setF({ branchId: a.branchId, code: a.code, name: a.name, type: a.type as Form["type"], parentAreaId: a.parentAreaId, description: a.description ?? "", status: a.status, isInventoryStorage: a.isInventoryStorage, inventoryStorageType: a.inventoryStorageType });
        setCode(a.code);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Parent Area choices: same branch, excluding self and its own descendants (to
  // avoid cycles) — good enough for a shallow list; server also re-validates.
  const descendantIds = useMemo(() => {
    if (!id) return new Set<number>();
    const s = new Set<number>();
    const walk = (pid: number) => { for (const p of parents.filter((x) => x.parentAreaId === pid)) { s.add(p.id); walk(p.id); } };
    walk(id);
    return s;
  }, [id, parents]);
  const parentChoices = parents.filter((p) => p.branchId === f.branchId && p.id !== id && !descendantIds.has(p.id));

  async function save() {
    if (!f.branchId) { toast.error("Select a branch."); return; }
    if (!f.code.trim()) { toast.error("Enter an area code."); return; }
    if (!f.name.trim()) { toast.error("Enter an area name."); return; }
    setBusy(true);
    const j = await fetch(id ? `/api/system/areas/${id}` : "/api/system/areas", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).then((r) => r.json());
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); onSaved(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h3 className="text-base font-bold text-foreground">{mode === "add" ? "Add" : mode === "view" ? "View" : "Edit"} Area{code ? ` · ${code}` : ""}</h3><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading ? <AppLoader label="Loading…" size="sm" /> : (
            <fieldset disabled={readOnly} className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Branch *</label><select value={f.branchId || ""} onChange={(e) => set("branchId", Number(e.target.value) || 0)} className={inp}><option value="">— Select —</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div><label className={lbl}>Area Code *</label><input value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="RM-001" className={inp} /></div>
              <div className="sm:col-span-2"><label className={lbl}>Area Name *</label><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Raw Material Store" className={inp} /></div>
              <div><label className={lbl}>Area Type *</label><select value={f.type} onChange={(e) => set("type", e.target.value as Form["type"])} className={inp}>{AREA_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className={lbl}>Parent Area</label><select value={f.parentAreaId ?? ""} onChange={(e) => set("parentAreaId", Number(e.target.value) || null)} className={inp} disabled={readOnly || !f.branchId}><option value="">— None (top level) —</option>{parentChoices.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></div>
              <div><label className={lbl}>Status</label><select value={f.status} onChange={(e) => set("status", e.target.value as Form["status"])} className={inp}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
              <div>
                <label className={lbl}>Inventory Storage Space?</label>
                <select
                  value={f.isInventoryStorage ? "yes" : "no"}
                  onChange={(e) => {
                    const yes = e.target.value === "yes";
                    set("isInventoryStorage", yes);
                    if (!yes) set("inventoryStorageType", null);
                  }}
                  className={inp}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              {f.isInventoryStorage && (
                <div>
                  <label className={lbl}>Storage Holds *</label>
                  <select
                    value={f.inventoryStorageType ?? ""}
                    onChange={(e) => set("inventoryStorageType", (e.target.value || null) as Form["inventoryStorageType"])}
                    className={inp}
                  >
                    <option value="">— Select —</option>
                    {INVENTORY_STORAGE_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2"><label className={lbl}>Description</label><textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} className={cn(inp, "h-auto py-2")} /></div>
            </fieldset>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3"><Button size="sm" variant="ghost" onClick={onClose}>Close</Button>{!readOnly && <Button size="sm" onClick={save} disabled={busy || loading}>{busy ? "Saving…" : "Save"}</Button>}</div>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const inpAuto = "h-9 w-auto min-w-[160px] rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
