"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { FUEL_TYPE_OPTS, stationInput, tankInput, type StationInput, type TankInput, type StationRow, type TankRow } from "@/lib/contracts/fuelManagement";

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";

export function StationTankManager({ tanks, onChanged }: { tanks: TankRow[]; onChanged: () => void }) {
  const [stations, setStations] = useState<StationRow[]>([]);
  const [stationModal, setStationModal] = useState<{ id?: number } | null>(null);
  const [tankModal, setTankModal] = useState<{ id?: number } | null>(null);

  const loadStations = () => fetch("/api/transport/fuel-station", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setStations(j.rows); }).catch(() => {});
  useEffect(() => { loadStations(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-foreground">Fuel Stations</h3><Button size="sm" variant="outline" onClick={() => setStationModal({})}><Plus className="h-3.5 w-3.5" /> New Station</Button></div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2 text-left">Code</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Location</th><th className="px-3 py-2 text-center">Tanks</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
            <tbody>
              {stations.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-2xs text-muted">No fuel stations yet.</td></tr>}
              {stations.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{s.code}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{s.name}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{s.location ?? "—"}</td>
                  <td className="px-3 py-2 text-center text-2xs text-muted">{s.tankCount}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={s.status === "Active" ? "success" : "neutral"}>{s.status}</Badge></td>
                  <td className="px-3 py-2 text-right"><button onClick={() => setStationModal({ id: s.id })} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:text-primary"><Pencil className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-foreground">Fuel Tanks</h3><Button size="sm" variant="outline" onClick={() => setTankModal({})}><Plus className="h-3.5 w-3.5" /> New Tank</Button></div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2 text-left">Code</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Station</th><th className="px-3 py-2 text-left">Fuel</th><th className="px-3 py-2 text-right">Capacity</th><th className="px-3 py-2 text-right">Current</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
            <tbody>
              {tanks.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-2xs text-muted">No fuel tanks yet.</td></tr>}
              {tanks.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{t.tankCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{t.tankName}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{t.stationName}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{t.fuelType}</td>
                  <td className="px-3 py-2 text-right text-2xs text-muted">{t.capacity} L</td>
                  <td className="px-3 py-2 text-right text-2xs font-semibold">{t.currentQty} L {t.lowStock && <AlertTriangle className="ml-1 inline h-3 w-3 text-warning" />}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={t.status === "Active" ? "success" : "neutral"}>{t.status}</Badge></td>
                  <td className="px-3 py-2 text-right"><button onClick={() => setTankModal({ id: t.id })} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:text-primary"><Pencil className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      </div>

      {stationModal && <StationModal id={stationModal.id} onClose={() => setStationModal(null)} onSaved={() => { setStationModal(null); loadStations(); onChanged(); }} />}
      {tankModal && <TankModal id={tankModal.id} stations={stations} onClose={() => setTankModal(null)} onSaved={() => { setTankModal(null); loadStations(); onChanged(); }} />}
    </div>
  );
}

function StationModal({ id, onClose, onSaved }: { id?: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<StationInput>({ code: "", name: "", location: "", status: "Active", remarks: "" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof StationInput>(k: K, v: StationInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { if (id) fetch("/api/transport/fuel-station", { cache: "no-store" }).then((r) => r.json()).then((j) => { const row = j.ok ? j.rows.find((r: { id: number }) => r.id === id) : null; if (row) setF({ code: row.code, name: row.name, location: row.location ?? "", status: row.status, remarks: "" }); }).catch(() => {}); }, [id]);

  async function save() {
    const parsed = stationInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch(id ? `/api/transport/fuel-station/${id}` : "/api/transport/fuel-station", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); onSaved(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">{id ? "Edit" : "New"} Fuel Station</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 p-5">
          <div><label className={lbl}>Station Code *</label><input value={f.code} onChange={(e) => set("code", e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Station Name *</label><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Location</label><input value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Status</label><select value={f.status} onChange={(e) => set("status", e.target.value as StationInput["status"])} className={inp}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
      </div>
    </div>
  );
}

function TankModal({ id, stations, onClose, onSaved }: { id?: number; stations: StationRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<TankInput>({ tankCode: "", tankName: "", stationId: 0, fuelType: "Diesel", capacity: 0, minLevel: null, maxLevel: null, status: "Active", remarks: "" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TankInput>(k: K, v: TankInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { if (id) fetch("/api/transport/fuel-tank", { cache: "no-store" }).then((r) => r.json()).then((j) => { const row = j.ok ? j.rows.find((r: { id: number }) => r.id === id) : null; if (row) setF({ tankCode: row.tankCode, tankName: row.tankName, stationId: row.stationId, fuelType: row.fuelType, capacity: row.capacity, minLevel: row.minLevel, maxLevel: row.maxLevel, status: row.status, remarks: "" }); }).catch(() => {}); }, [id]);

  async function save() {
    const parsed = tankInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch(id ? `/api/transport/fuel-tank/${id}` : "/api/transport/fuel-tank", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); onSaved(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">{id ? "Edit" : "New"} Fuel Tank</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <div><label className={lbl}>Tank Code *</label><input value={f.tankCode} onChange={(e) => set("tankCode", e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Tank Name *</label><input value={f.tankName} onChange={(e) => set("tankName", e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Station *</label><select value={f.stationId || ""} onChange={(e) => set("stationId", Number(e.target.value) || 0)} className={inp}><option value="">— Select —</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className={lbl}>Fuel Type</label><select value={f.fuelType} onChange={(e) => set("fuelType", e.target.value as TankInput["fuelType"])} className={inp}>{FUEL_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className={lbl}>Capacity (L)</label><input type="number" min={0} value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value) || 0)} className={inp} /></div>
          <div><label className={lbl}>Status</label><select value={f.status} onChange={(e) => set("status", e.target.value as TankInput["status"])} className={inp}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
          <div><label className={lbl}>Minimum Level (L)</label><input type="number" min={0} value={f.minLevel ?? ""} onChange={(e) => set("minLevel", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
          <div><label className={lbl}>Maximum Level (L)</label><input type="number" min={0} value={f.maxLevel ?? ""} onChange={(e) => set("maxLevel", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
      </div>
    </div>
  );
}
