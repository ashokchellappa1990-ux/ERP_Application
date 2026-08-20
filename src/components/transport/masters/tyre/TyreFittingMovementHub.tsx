"use client";

import { useCallback, useEffect, useState } from "react";
import { GitCompare, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  fittingInput, removalInput, replacementInput, rotationInput, REMOVAL_REASON_OPTS,
  type FittingInput, type RemovalInput, type ReplacementInput, type RotationInput,
  type FittingRow, type RotationRow, type TyreRow,
} from "@/lib/contracts/tyre";

interface VehicleOpt { id: number; vehicleNo: string }
interface PositionOpt { positionCode: string; positionLabel: string }

const STATUS_TONE: Record<string, "neutral" | "success"> = { Active: "success", Removed: "neutral" };

export function TyreFittingMovementHub({ embedded }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState<"fitting" | "rotation" | "removal" | "replacement">("fitting");
  const [fittings, setFittings] = useState<FittingRow[]>([]);
  const [rotations, setRotations] = useState<RotationRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([]);
  const [availableTyres, setAvailableTyres] = useState<TyreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fitModalOpen, setFitModalOpen] = useState(false);
  const [rotModalOpen, setRotModalOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<FittingRow | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<FittingRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [f, r, v, t] = await Promise.all([
      fetch("/api/transport/tyre/fitting", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      fetch("/api/transport/tyre/rotation", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      fetch("/api/transport/masters/vehicle", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      fetch("/api/transport/tyre/master?status=Available", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
    ]);
    if (f?.ok) setFittings(f.rows);
    if (r?.ok) setRotations(r.rows);
    if (v?.ok) setVehicles(v.rows);
    if (t?.ok) setAvailableTyres(t.rows);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const activeFittings = fittings.filter((f) => f.status === "Active");

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Tyre Management</span></div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><GitCompare className="h-5 w-5 text-primary" /> Tyre Fitting &amp; Movement</h1>
            <p className="mt-0.5 text-sm text-muted">Fit, remove, rotate and replace tyres on vehicles — KM snapshots reuse the live odometer from Vehicle Trip Management.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="md" onClick={() => setRotModalOpen(true)}><Plus className="h-4 w-4" /> Rotation</Button>
            <Button size="md" onClick={() => setFitModalOpen(true)}><Plus className="h-4 w-4" /> Fit Tyre</Button>
          </div>
        </div>
      )}

      <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
        {([["fitting", "Fitting"], ["rotation", "Rotation"], ["removal", "Removal"], ["replacement", "Replacement"]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("px-3 py-1.5 font-semibold transition", tab === k ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
        ))}
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          {tab === "fitting" && (
            <ListTable rows={fittings} empty="No fittings recorded yet." columns={["Tyre", "Vehicle", "Position", "Fitted", "Fitted KM", "Removed", "Running KM", "Status"]}
              renderRow={(r: FittingRow) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.tyreCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.positionCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{new Date(r.fittedAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.fittedOdometer ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.removedAt ? new Date(r.removedAt).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.runningKm ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                </tr>
              )} />
          )}

          {tab === "rotation" && (
            <ListTable rows={rotations} empty="No rotations recorded yet." columns={["Rotation No.", "Vehicle", "Date", "Odometer", "Tyres Moved", "Remarks"]}
              renderRow={(r: RotationRow) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.rotationNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{new Date(r.rotationDate).toLocaleDateString("en-IN")}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.odometer ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.lineCount}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.remarks ?? "—"}</td>
                </tr>
              )} />
          )}

          {tab === "removal" && (
            <ListTable rows={activeFittings} empty="No tyres are currently fitted." columns={["Tyre", "Vehicle", "Position", "Fitted", "Fitted KM", ""]}
              renderRow={(r: FittingRow) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.tyreCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.positionCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{new Date(r.fittedAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.fittedOdometer ?? "—"}</td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => setRemoveTarget(r)}>Remove</Button></td>
                </tr>
              )} />
          )}

          {tab === "replacement" && (
            <ListTable rows={activeFittings} empty="No tyres are currently fitted." columns={["Tyre", "Vehicle", "Position", "Fitted", "Fitted KM", ""]}
              renderRow={(r: FittingRow) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.tyreCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.positionCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{new Date(r.fittedAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.fittedOdometer ?? "—"}</td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => setReplaceTarget(r)}>Replace</Button></td>
                </tr>
              )} />
          )}
        </>
      )}

      {fitModalOpen && <FittingModal vehicles={vehicles} tyres={availableTyres} onClose={() => setFitModalOpen(false)} onSaved={() => { setFitModalOpen(false); load(); }} />}
      {rotModalOpen && <RotationModal vehicles={vehicles} activeFittings={activeFittings} onClose={() => setRotModalOpen(false)} onSaved={() => { setRotModalOpen(false); load(); }} />}
      {removeTarget && <RemoveModal fitting={removeTarget} onClose={() => setRemoveTarget(null)} onSaved={() => { setRemoveTarget(null); load(); }} />}
      {replaceTarget && <ReplaceModal fitting={replaceTarget} tyres={availableTyres} onClose={() => setReplaceTarget(null)} onSaved={() => { setReplaceTarget(null); load(); }} />}
    </div>
  );
}

function ListTable<T>({ rows, columns, renderRow, empty }: { rows: T[]; columns: string[]; renderRow: (r: T) => React.ReactNode; empty: string }) {
  if (rows.length === 0) return <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">{empty}</div>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted">
          {columns.map((c, i) => <th key={i} className={cn("px-3 py-2.5", i === columns.length - 1 && c === "" ? "text-right" : "text-left")}>{c}</th>)}
        </tr></thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div></div>
  );
}

const modalInp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const modalLbl = "mb-1 block text-2xs font-semibold text-muted";

function usePositions(vehicleId: number | "") {
  const [codes, setCodes] = useState<PositionOpt[]>([]);
  useEffect(() => {
    if (!vehicleId) { setCodes([]); return; }
    fetch(`/api/transport/tyre/position-template/resolve?vehicleId=${vehicleId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setCodes(j.codes); });
  }, [vehicleId]);
  return codes;
}

function FittingModal({ vehicles, tyres, onClose, onSaved }: { vehicles: VehicleOpt[]; tyres: TyreRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<FittingInput>({ tyreId: 0, vehicleId: 0, positionCode: "", fittedAt: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const positions = usePositions(f.vehicleId || "");
  const set = <K extends keyof FittingInput>(k: K, v: FittingInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    const parsed = fittingInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/tyre/fitting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Fitted."); onSaved(); } else toast.error(j.message || "Could not fit tyre.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">Fit Tyre</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 p-5">
          <div><label className={modalLbl}>Vehicle *</label><select value={f.vehicleId || ""} onChange={(e) => set("vehicleId", Number(e.target.value) || 0)} className={modalInp}><option value="">— Select —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}</select></div>
          <div><label className={modalLbl}>Tyre (Available only) *</label><select value={f.tyreId || ""} onChange={(e) => set("tyreId", Number(e.target.value) || 0)} className={modalInp}><option value="">— Select —</option>{tyres.map((t) => <option key={t.id} value={t.id}>{t.tyreCode} ({t.brand ?? "—"})</option>)}</select></div>
          <div><label className={modalLbl}>Position *</label>
            {positions.length > 0 ? (
              <select value={f.positionCode} onChange={(e) => set("positionCode", e.target.value)} className={modalInp}><option value="">— Select —</option>{positions.map((p) => <option key={p.positionCode} value={p.positionCode}>{p.positionLabel} ({p.positionCode})</option>)}</select>
            ) : (
              <input value={f.positionCode} onChange={(e) => set("positionCode", e.target.value)} placeholder="e.g. FL, RL-O" className={modalInp} />
            )}
          </div>
          <div><label className={modalLbl}>Fitting Date *</label><input type="date" value={f.fittedAt} onChange={(e) => set("fittedAt", e.target.value)} className={modalInp} /></div>
          <div><label className={modalLbl}>Remarks</label><textarea value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={2} className={cn(modalInp, "h-auto py-2")} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Fit Tyre"}</Button></div>
      </div>
    </div>
  );
}

function RemoveModal({ fitting, onClose, onSaved }: { fitting: FittingRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<RemovalInput>({ removalReason: "Wear", remarks: "" });
  const [busy, setBusy] = useState(false);

  async function save() {
    const parsed = removalInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch(`/api/transport/tyre/fitting/${fitting.id}/remove`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Removed."); onSaved(); } else toast.error(j.message || "Could not remove tyre.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">Remove Tyre — {fitting.tyreCode}</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 p-5">
          <p className="text-2xs text-muted">Current vehicle KM will be captured automatically to compute running KM for this fitting spell.</p>
          <div><label className={modalLbl}>Removal Reason *</label><select value={f.removalReason} onChange={(e) => setF((s) => ({ ...s, removalReason: e.target.value as RemovalInput["removalReason"] }))} className={modalInp}>{REMOVAL_REASON_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
          <div><label className={modalLbl}>Remarks</label><textarea value={f.remarks ?? ""} onChange={(e) => setF((s) => ({ ...s, remarks: e.target.value }))} rows={2} className={cn(modalInp, "h-auto py-2")} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Removing…" : "Remove Tyre"}</Button></div>
      </div>
    </div>
  );
}

function ReplaceModal({ fitting, tyres, onClose, onSaved }: { fitting: FittingRow; tyres: TyreRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<ReplacementInput>({ removalReason: "Wear", newTyreId: 0, fittedAt: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);

  async function save() {
    const parsed = replacementInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch(`/api/transport/tyre/fitting/${fitting.id}/replace`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Replaced."); onSaved(); } else toast.error(j.message || "Could not replace tyre.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">Replace Tyre — {fitting.tyreCode}</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 p-5">
          <div><label className={modalLbl}>Removal Reason (for old tyre) *</label><select value={f.removalReason} onChange={(e) => setF((s) => ({ ...s, removalReason: e.target.value as ReplacementInput["removalReason"] }))} className={modalInp}>{REMOVAL_REASON_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
          <div><label className={modalLbl}>New Tyre (Available only) *</label><select value={f.newTyreId || ""} onChange={(e) => setF((s) => ({ ...s, newTyreId: Number(e.target.value) || 0 }))} className={modalInp}><option value="">— Select —</option>{tyres.map((t) => <option key={t.id} value={t.id}>{t.tyreCode} ({t.brand ?? "—"})</option>)}</select></div>
          <div><label className={modalLbl}>Fitting Date *</label><input type="date" value={f.fittedAt} onChange={(e) => setF((s) => ({ ...s, fittedAt: e.target.value }))} className={modalInp} /></div>
          <div><label className={modalLbl}>Remarks</label><textarea value={f.remarks ?? ""} onChange={(e) => setF((s) => ({ ...s, remarks: e.target.value }))} rows={2} className={cn(modalInp, "h-auto py-2")} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Replacing…" : "Replace Tyre"}</Button></div>
      </div>
    </div>
  );
}

function RotationModal({ vehicles, activeFittings, onClose, onSaved }: { vehicles: VehicleOpt[]; activeFittings: FittingRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [vehicleId, setVehicleId] = useState<number | "">("");
  const [rotationDate, setRotationDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<{ tyreId: number; toPositionCode: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const positions = usePositions(vehicleId);
  const vehicleTyres = activeFittings.filter((f) => f.vehicleId === vehicleId);

  useEffect(() => { setLines(vehicleTyres.map((f) => ({ tyreId: f.tyreId, toPositionCode: f.positionCode }))); }, [vehicleId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const payload: RotationInput = { vehicleId: vehicleId || 0, rotationDate, lines };
    const parsed = rotationInput.safeParse(payload);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/tyre/rotation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Rotation recorded."); onSaved(); } else toast.error(j.message || "Could not record rotation.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">Rotate Tyres</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 p-5">
          <div><label className={modalLbl}>Vehicle *</label><select value={vehicleId} onChange={(e) => setVehicleId(Number(e.target.value) || "")} className={modalInp}><option value="">— Select —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}</select></div>
          <div><label className={modalLbl}>Rotation Date *</label><input type="date" value={rotationDate} onChange={(e) => setRotationDate(e.target.value)} className={modalInp} /></div>
          {vehicleTyres.length > 0 && (
            <div className="space-y-2 rounded-lg bg-surface-2/40 p-3">
              <p className="text-2xs font-semibold text-muted">Assign each currently-fitted tyre's new position:</p>
              {vehicleTyres.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 font-medium text-foreground">{f.tyreCode}</span>
                  <span className="text-2xs text-subtle">from {f.positionCode} →</span>
                  {positions.length > 0 ? (
                    <select value={lines[i]?.toPositionCode ?? ""} onChange={(e) => setLines((s) => s.map((l, li) => li === i ? { ...l, toPositionCode: e.target.value } : l))} className="h-8 flex-1 rounded-md border border-border-strong bg-surface px-2 text-xs">
                      {positions.map((p) => <option key={p.positionCode} value={p.positionCode}>{p.positionLabel} ({p.positionCode})</option>)}
                    </select>
                  ) : (
                    <input value={lines[i]?.toPositionCode ?? ""} onChange={(e) => setLines((s) => s.map((l, li) => li === i ? { ...l, toPositionCode: e.target.value } : l))} className="h-8 flex-1 rounded-md border border-border-strong bg-surface px-2 text-xs" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy || lines.length < 2}>{busy ? "Saving…" : "Record Rotation"}</Button></div>
      </div>
    </div>
  );
}
