"use client";

import { useCallback, useEffect, useState } from "react";
import { Warehouse, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { loadingBayInput, type LoadingBayInput } from "@/lib/contracts/transport";

interface Row extends LoadingBayInput { id: number }
const BLANK: LoadingBayInput = { code: "", name: "", warehouse: "", capacity: null, status: "Active", remarks: "" };

export function LoadingBayList() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ mode: "add" | "edit"; id?: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const url = q ? `/api/transport/masters/loading-bay?q=${encodeURIComponent(q)}` : "/api/transport/masters/loading-bay";
    const j = await fetch(url, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) setRows(j.rows);
    setLoading(false);
  }, [q]);
  useEffect(() => { load(); }, [load]);

  async function remove(r: Row) {
    if (!window.confirm(`Delete loading bay ${r.code} — ${r.name}?`)) return;
    const j = await fetch(`/api/transport/masters/loading-bay/${r.id}`, { method: "DELETE" }).then((x) => x.json());
    toast.result(j, "Deleted.", "Could not delete.");
    if (j.ok) load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Masters</span><span className="text-subtle">/</span><span>Transport</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Loading Bay</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Warehouse className="h-5 w-5 text-primary" /> Loading Bay Master</h1>
          <p className="mt-0.5 text-sm text-muted">Warehouse loading bays used for dispatch loading confirmation.</p>
        </div>
        <Button size="md" onClick={() => setModal({ mode: "add" })}><Plus className="h-4 w-4" /> Add Loading Bay</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, name, warehouse…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>
        : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No loading bays yet. <button onClick={() => setModal({ mode: "add" })} className="font-semibold text-primary hover:underline">Add one →</button></div>
        : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2.5 text-left">Code</th><th className="px-3 py-2.5 text-left">Name</th><th className="px-3 py-2.5 text-left">Warehouse</th><th className="px-3 py-2.5 text-left">Capacity</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-mono text-2xs text-muted">{r.code}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.warehouse || "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.capacity ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={r.status === "Active" ? "success" : "neutral"}>{r.status}</Badge></td>
                  <td className="px-3 py-2"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => setModal({ mode: "edit", id: r.id })} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(r)} title="Delete" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-danger/30 hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {modal && <LoadingBayModal mode={modal.mode} id={modal.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function LoadingBayModal({ mode, id, onClose, onSaved }: { mode: "add" | "edit"; id?: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<LoadingBayInput>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof LoadingBayInput>(k: K, v: LoadingBayInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!id) return;
    fetch(`/api/transport/masters/loading-bay/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setF({ ...BLANK, ...j.row }); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  async function save() {
    const parsed = loadingBayInput.safeParse(f);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setErrors({});
    setBusy(true);
    const j = await fetch(id ? `/api/transport/masters/loading-bay/${id}` : "/api/transport/masters/loading-bay", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json());
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); onSaved(); } else { toast.error(j.message || "Could not save."); if (j.errors) setErrors(j.errors); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h3 className="text-base font-bold text-foreground">{mode === "add" ? "Add" : "Edit"} Loading Bay</h3><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading ? <AppLoader label="Loading…" size="sm" /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Code *</label><input value={f.code} onChange={(e) => set("code", e.target.value)} className={inp} />{errors.code && <p className={errTxt}>{errors.code}</p>}</div>
              <div><label className={lbl}>Name *</label><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} />{errors.name && <p className={errTxt}>{errors.name}</p>}</div>
              <div><label className={lbl}>Warehouse</label><input value={f.warehouse ?? ""} onChange={(e) => set("warehouse", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Capacity</label><input type="number" value={f.capacity ?? ""} onChange={(e) => set("capacity", e.target.value === "" ? null : Number(e.target.value))} className={inp} /></div>
              <div><label className={lbl}>Status</label><select value={f.status} onChange={(e) => set("status", e.target.value as LoadingBayInput["status"])} className={inp}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
              <div className="sm:col-span-2"><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3"><Button size="sm" variant="ghost" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy || loading}>{busy ? "Saving…" : "Save"}</Button></div>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
const errTxt = "mt-1 text-2xs font-medium text-danger";
