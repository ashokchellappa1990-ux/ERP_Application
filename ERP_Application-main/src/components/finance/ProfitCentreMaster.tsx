"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PieChart, Plus, Pencil, Eye, Power, Trash2, X, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { ProfitCentreRow, ProfitCentreDto } from "@/lib/contracts/costCentre";

interface Branch { id: number; name: string }
const today = () => new Date().toISOString().slice(0, 10);
type Form = Omit<ProfitCentreDto, "id" | "code" | "branchName" | "parentName" | "businessId">;
const BLANK: Form = { branchId: null, name: "", description: "", businessUnit: "", division: "", parentId: null, manager: "", status: "Active", effectiveDate: today(), remarks: "" };

export function ProfitCentreMaster() {
  const toast = useToast();
  const [rows, setRows] = useState<ProfitCentreRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "add" | "edit" | "view"; id?: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch("/api/finance/profit-centre", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setRows(j.rows); setBranches(j.branches ?? []); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const tree = useMemo(() => {
    const byParent = new Map<number | null, ProfitCentreRow[]>();
    for (const r of rows) { const k = r.parentId; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k)!.push(r); }
    const out: { row: ProfitCentreRow; depth: number }[] = [];
    const walk = (pid: number | null, depth: number) => { for (const r of byParent.get(pid) ?? []) { out.push({ row: r, depth }); walk(r.id, depth + 1); } };
    walk(null, 0);
    const seen = new Set(out.map((x) => x.row.id));
    for (const r of rows) if (!seen.has(r.id)) out.push({ row: r, depth: 0 });
    return out;
  }, [rows]);

  async function toggle(r: ProfitCentreRow) {
    const j = await fetch(`/api/finance/profit-centre/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: r.status === "Active" ? "Inactive" : "Active" }) }).then((x) => x.json());
    if (j.ok) { toast.show(j.message || "Updated.", { type: "success" }); load(); } else toast.show(j.message || "Failed.", { type: "error" });
  }
  async function remove(r: ProfitCentreRow) {
    if (!window.confirm(`Delete ${r.code} — ${r.name}?`)) return;
    const j = await fetch(`/api/finance/profit-centre/${r.id}`, { method: "DELETE" }).then((x) => x.json());
    if (j.ok) { toast.show("Deleted.", { type: "success" }); load(); } else toast.show(j.message || "Failed.", { type: "error" });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>System</span><span className="text-subtle">/</span><span>Organization Configuration</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Profit Centre</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PieChart className="h-5 w-5 text-primary" /> Profit Centre Master</h1>
          <p className="mt-0.5 text-sm text-muted">Measure revenue, expenses &amp; profitability by business unit / division — supports hierarchy. Captured on postings.</p>
        </div>
        <Button size="md" onClick={() => setModal({ mode: "add" })}><Plus className="h-4 w-4" /> Add Profit Centre</Button>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>
        : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No profit centres yet. <button onClick={() => setModal({ mode: "add" })} className="font-semibold text-primary hover:underline">Add one →</button></div>
        : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2.5 text-left">Code</th><th className="px-3 py-2.5 text-left">Profit Centre</th><th className="px-3 py-2.5 text-left">Business Unit</th><th className="px-3 py-2.5 text-left">Division</th><th className="px-3 py-2.5 text-left">Manager</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-right">Actions</th></tr></thead>
            <tbody>
              {tree.map(({ row: r, depth }) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-mono text-2xs text-muted">{r.code}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>{depth > 0 && <CornerDownRight className="h-3.5 w-3.5 text-subtle" />}<span className="font-medium text-foreground">{r.name}</span>{r.childCount > 0 && <span className="text-2xs text-subtle">({r.childCount})</span>}</div>{r.branchName && <div className="text-2xs text-subtle" style={{ paddingLeft: depth * 18 }}>{r.branchName}</div>}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.businessUnit ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.division ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.manager ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={r.status === "Active" ? "success" : "neutral"}>{r.status}</Badge></td>
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

      {modal && <ProfitCentreModal mode={modal.mode} id={modal.id} branches={branches} parents={rows} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function ProfitCentreModal({ mode, id, branches, parents, onClose, onSaved }: { mode: "add" | "edit" | "view"; id?: number; branches: Branch[]; parents: ProfitCentreRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const readOnly = mode === "view";
  const [f, setF] = useState<Form>(BLANK);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!id) return;
    fetch(`/api/finance/profit-centre/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { const c: ProfitCentreDto = j.profitCentre; setF({ branchId: c.branchId, name: c.name, description: c.description ?? "", businessUnit: c.businessUnit ?? "", division: c.division ?? "", parentId: c.parentId, manager: c.manager ?? "", status: c.status, effectiveDate: c.effectiveDate ?? "", remarks: c.remarks ?? "" }); setCode(c.code); } setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  async function save() {
    if (!f.name.trim()) { toast.show("Enter a name.", { type: "error" }); return; }
    setBusy(true);
    const j = await fetch(id ? `/api/finance/profit-centre/${id}` : "/api/finance/profit-centre", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).then((r) => r.json());
    setBusy(false);
    if (j.ok) { toast.show(j.message || "Saved.", { type: "success" }); onSaved(); } else toast.show(j.message || "Could not save.", { type: "error" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h3 className="text-base font-bold text-foreground">{mode === "add" ? "Add" : mode === "view" ? "View" : "Edit"} Profit Centre{code ? ` · ${code}` : ""}</h3><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading ? <AppLoader label="Loading…" size="sm" /> : (
            <fieldset disabled={readOnly} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className={lbl}>Profit Centre Name *</label><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Business Unit</label><input value={f.businessUnit ?? ""} onChange={(e) => set("businessUnit", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Division</label><input value={f.division ?? ""} onChange={(e) => set("division", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Branch (blank = Company)</label><select value={f.branchId ?? ""} onChange={(e) => set("branchId", Number(e.target.value) || null)} className={inp}><option value="">Company</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div><label className={lbl}>Parent Profit Centre</label><select value={f.parentId ?? ""} onChange={(e) => set("parentId", Number(e.target.value) || null)} className={inp}><option value="">— None (top level) —</option>{parents.filter((p) => p.id !== id).map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></div>
              <div><label className={lbl}>Manager</label><input value={f.manager ?? ""} onChange={(e) => set("manager", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Status</label><select value={f.status} onChange={(e) => set("status", e.target.value as Form["status"])} className={inp}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
              <div><label className={lbl}>Effective Date</label><input type="date" value={f.effectiveDate ?? ""} onChange={(e) => set("effectiveDate", e.target.value)} className={inp} /></div>
              <div className="sm:col-span-2"><label className={lbl}>Description</label><input value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} className={inp} /></div>
              <div className="sm:col-span-2"><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
            </fieldset>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3"><Button size="sm" variant="ghost" onClick={onClose}>Close</Button>{!readOnly && <Button size="sm" onClick={save} disabled={busy || loading}>{busy ? "Saving…" : "Save"}</Button>}</div>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
