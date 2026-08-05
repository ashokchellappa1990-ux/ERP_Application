"use client";

import { useCallback, useEffect, useState } from "react";
import { Car, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { vehicleInput, VEHICLE_TYPE_OPTS, type VehicleInput } from "@/lib/contracts/transport";

interface Row extends VehicleInput { id: number }
interface CompanyOption { id: number; name: string }
const BLANK: VehicleInput = { vehicleNo: "", vehicleType: "", capacity: 0, capacityUnit: "", transportCompanyId: null, ownerType: "Own", status: "Active", remarks: "" };

export function VehicleMasterList() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ mode: "add" | "edit"; id?: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const url = q ? `/api/transport/masters/vehicle?q=${encodeURIComponent(q)}` : "/api/transport/masters/vehicle";
    const [j, c] = await Promise.all([
      fetch(url, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/transport/masters/transport-company", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    if (j?.ok) setRows(j.rows);
    if (c?.ok) setCompanies(c.rows.map((r: { id: number; name: string }) => ({ id: r.id, name: r.name })));
    setLoading(false);
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const companyName = (id: number | null | undefined) => companies.find((c) => c.id === id)?.name ?? "—";

  async function remove(r: Row) {
    if (!window.confirm(`Delete vehicle ${r.vehicleNo}?`)) return;
    const j = await fetch(`/api/transport/masters/vehicle/${r.id}`, { method: "DELETE" }).then((x) => x.json());
    toast.result(j, "Deleted.", "Could not delete.");
    if (j.ok) load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Masters</span><span className="text-subtle">/</span><span>Transport</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Vehicle</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Car className="h-5 w-5 text-primary" /> Vehicle Master</h1>
          <p className="mt-0.5 text-sm text-muted">Own, hired and transporter vehicles used for dispatch & gate operations.</p>
        </div>
        <Button size="md" onClick={() => setModal({ mode: "add" })}><Plus className="h-4 w-4" /> Add Vehicle</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vehicle no, type…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>
        : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No vehicles yet. <button onClick={() => setModal({ mode: "add" })} className="font-semibold text-primary hover:underline">Add one →</button></div>
        : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2.5 text-left">Vehicle No</th><th className="px-3 py-2.5 text-left">Type</th><th className="px-3 py-2.5 text-left">Capacity</th><th className="px-3 py-2.5 text-left">Owner</th><th className="px-3 py-2.5 text-left">Company</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleType || "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.capacity ? `${r.capacity} ${r.capacityUnit ?? ""}` : "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.ownerType}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{companyName(r.transportCompanyId)}</td>
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

      {modal && <VehicleModal mode={modal.mode} id={modal.id} companies={companies} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function VehicleModal({ mode, id, companies, onClose, onSaved }: { mode: "add" | "edit"; id?: number; companies: CompanyOption[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<VehicleInput>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [companyList, setCompanyList] = useState<CompanyOption[]>(companies);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const set = <K extends keyof VehicleInput>(k: K, v: VehicleInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!id) return;
    fetch(`/api/transport/masters/vehicle/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setF({ ...BLANK, ...j.row }); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  async function save() {
    const parsed = vehicleInput.safeParse(f);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setErrors({});
    setBusy(true);
    const j = await fetch(id ? `/api/transport/masters/vehicle/${id}` : "/api/transport/masters/vehicle", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json());
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); onSaved(); } else { toast.error(j.message || "Could not save."); if (j.errors) setErrors(j.errors); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h3 className="text-base font-bold text-foreground">{mode === "add" ? "Add" : "Edit"} Vehicle</h3><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading ? <AppLoader label="Loading…" size="sm" /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Vehicle No *</label><input value={f.vehicleNo} onChange={(e) => set("vehicleNo", e.target.value)} className={inp} />{errors.vehicleNo && <p className={errTxt}>{errors.vehicleNo}</p>}</div>
              <div><label className={lbl}>Vehicle Type</label><select value={f.vehicleType ?? ""} onChange={(e) => set("vehicleType", e.target.value)} className={inp}><option value="">— Select —</option>{VEHICLE_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className={lbl}>Capacity</label><input type="number" value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value) || 0)} className={inp} /></div>
              <div><label className={lbl}>Capacity Unit</label><input value={f.capacityUnit ?? ""} onChange={(e) => set("capacityUnit", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Owner Type</label><select value={f.ownerType} onChange={(e) => set("ownerType", e.target.value as VehicleInput["ownerType"])} className={inp}><option value="Own">Own</option><option value="Hired">Hired</option><option value="Transporter">Transporter</option></select></div>
              <div>
                <label className={lbl}>Transport Company</label>
                <div className="flex gap-1.5">
                  <select value={f.transportCompanyId ?? ""} onChange={(e) => set("transportCompanyId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{companyList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  <button type="button" title="Add new transport company" onClick={() => setAddCompanyOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border-strong bg-surface text-muted hover:border-primary hover:text-primary"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              <div><label className={lbl}>Status</label><select value={f.status} onChange={(e) => set("status", e.target.value as VehicleInput["status"])} className={inp}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
              <div className="sm:col-span-2"><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3"><Button size="sm" variant="ghost" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy || loading}>{busy ? "Saving…" : "Save"}</Button></div>
      </div>
      {addCompanyOpen && (
        <AddTransportCompanyModal
          onClose={() => setAddCompanyOpen(false)}
          onAdded={(row) => { setCompanyList((p) => [{ id: row.id, name: row.name }, ...p]); set("transportCompanyId", row.id); setAddCompanyOpen(false); }}
        />
      )}
    </div>
  );
}

function AddTransportCompanyModal({ onClose, onAdded }: { onClose: () => void; onAdded: (row: { id: number; name: string }) => void }) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!code.trim() || !name.trim()) { toast.error("Code and name are required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/transport/masters/transport-company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name, phone: phone || null, status: "Active" }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success("Transport company added."); onAdded(j.row); }
      else { toast.error(j.message || "Could not add the transport company."); setSaving(false); }
    } catch { toast.error("Network error."); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <h2 className="text-sm font-bold text-foreground">Add Transport Company</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <div><label className={lbl}>Code *</label><input value={code} onChange={(e) => setCode(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
        </div>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
const errTxt = "mt-1 text-2xs font-medium text-danger";
