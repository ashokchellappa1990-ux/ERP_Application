"use client";

import { useCallback, useEffect, useState } from "react";
import { Wrench, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  inspectionInput, repairInput, retreadingInput, warrantyClaimInput,
  INSPECTION_CONDITION_OPTS, RECOMMENDED_ACTION_OPTS,
  type InspectionInput, type RepairInput, type RetreadingInput, type WarrantyClaimInput,
  type InspectionRow, type RepairRow, type RetreadingRow, type WarrantyClaimRow, type TyreRow,
} from "@/lib/contracts/tyre";

interface SupplierOpt { id: number; name: string }

const REPAIR_TONE: Record<string, "neutral" | "info" | "success" | "danger"> = { Draft: "neutral", InProgress: "info", Completed: "success", Cancelled: "danger" };
const RETREAD_TONE: Record<string, "neutral" | "info" | "success" | "danger" | "warning"> = { Sent: "neutral", InProgress: "info", Received: "success", Rejected: "danger", Cancelled: "warning" };
const CLAIM_TONE: Record<string, "neutral" | "info" | "success" | "danger" | "warning"> = { Filed: "neutral", UnderReview: "info", Approved: "success", Rejected: "danger", Settled: "success" };
const COND_TONE: Record<string, "success" | "warning" | "danger"> = { Good: "success", Wear: "warning", Damage: "danger", Critical: "danger" };

export function TyreInspectionServiceHub({ embedded }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState<"inspection" | "repair" | "retreading" | "warranty">("inspection");
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [retreadings, setRetreadings] = useState<RetreadingRow[]>([]);
  const [claims, setClaims] = useState<WarrantyClaimRow[]>([]);
  const [tyres, setTyres] = useState<TyreRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"inspection" | "repair" | "retreading" | "warranty" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [i, r, rt, w, t, s] = await Promise.all([
      fetch("/api/transport/tyre/inspection", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      fetch("/api/transport/tyre/repair", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      fetch("/api/transport/tyre/retreading", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      fetch("/api/transport/tyre/warranty-claim", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      fetch("/api/transport/tyre/master", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      fetch("/api/masters/suppliers", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
    ]);
    if (i?.ok) setInspections(i.rows);
    if (r?.ok) setRepairs(r.rows);
    if (rt?.ok) setRetreadings(rt.rows);
    if (w?.ok) setClaims(w.rows);
    if (t?.ok) setTyres(t.rows);
    if (s?.ok) setSuppliers(s.suppliers);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(kind: "repair" | "retreading" | "warranty", id: number, action: string, extra?: Record<string, unknown>) {
    const path = kind === "warranty" ? "warranty-claim" : kind;
    const j = await fetch(`/api/transport/tyre/${path}/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) load();
    return j;
  }

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Tyre Management</span></div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wrench className="h-5 w-5 text-primary" /> Tyre Inspection &amp; Service</h1>
            <p className="mt-0.5 text-sm text-muted">Tread/pressure inspections, repairs, retreading and warranty claims — cost lines share Vehicle Maintenance's item/labour tables.</p>
          </div>
          <Button size="md" onClick={() => setModal(tab)}><Plus className="h-4 w-4" /> New</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
          {([["inspection", "Inspection"], ["repair", "Repair"], ["retreading", "Retreading"], ["warranty", "Warranty"]] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("px-3 py-1.5 font-semibold transition", tab === k ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
          ))}
        </div>
        {embedded && <Button size="sm" variant="outline" onClick={() => setModal(tab)}><Plus className="h-3.5 w-3.5" /> New</Button>}
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          {tab === "inspection" && (
            <ListTable rows={inspections} empty="No inspections recorded yet." columns={["Inspection No.", "Tyre", "Date", "Tread (mm)", "Pressure (psi)", "Condition", "Recommendation"]}
              renderRow={(r: InspectionRow) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.inspectionNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.tyreCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{new Date(r.inspectionDate).toLocaleDateString("en-IN")}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.treadDepthMm ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.pressurePsi ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={COND_TONE[r.condition] ?? "warning"}>{r.condition}</Badge></td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.recommendedAction ?? "—"}</td>
                </tr>
              )} />
          )}

          {tab === "repair" && (
            <ListTable rows={repairs} empty="No repairs recorded yet." columns={["Repair No.", "Tyre", "Date", "Workshop", "Total Cost", "Status", ""]}
              renderRow={(r: RepairRow) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.repairNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.tyreCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{new Date(r.repairDate).toLocaleDateString("en-IN")}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.workshopName ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">₹{r.totalCost.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={REPAIR_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-3 py-2 text-right">
                    {r.status === "Draft" && <Button size="sm" variant="outline" onClick={() => transition("repair", r.id, "start")}>Start</Button>}
                    {(r.status === "Draft" || r.status === "InProgress") && <Button size="sm" onClick={() => transition("repair", r.id, "complete")} className="ml-1.5">Complete</Button>}
                  </td>
                </tr>
              )} />
          )}

          {tab === "retreading" && (
            <ListTable rows={retreadings} empty="No retreading records yet." columns={["Retread No.", "Tyre", "Sent Date", "Vendor", "Cost", "Status", ""]}
              renderRow={(r: RetreadingRow) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.retreadNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.tyreCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{new Date(r.sentDate).toLocaleDateString("en-IN")}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vendorName ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">₹{r.cost.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={RETREAD_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-3 py-2 text-right">
                    {(r.status === "Sent" || r.status === "InProgress") && <Button size="sm" onClick={() => transition("retreading", r.id, "receive")}>Receive</Button>}
                  </td>
                </tr>
              )} />
          )}

          {tab === "warranty" && (
            <ListTable rows={claims} empty="No warranty claims yet." columns={["Claim No.", "Tyre", "Date", "Reason", "Claimed", "Approved", "Status", ""]}
              renderRow={(r: WarrantyClaimRow) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.claimNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.tyreCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{new Date(r.claimDate).toLocaleDateString("en-IN")}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.reason}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.claimedAmount != null ? `₹${r.claimedAmount.toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.approvedAmount != null ? `₹${r.approvedAmount.toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={CLAIM_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-3 py-2 text-right">
                    {r.status === "Filed" && <Button size="sm" variant="outline" onClick={() => transition("warranty", r.id, "approve")}>Approve</Button>}
                    {r.status === "Approved" && <Button size="sm" onClick={() => transition("warranty", r.id, "settle")} className="ml-1.5">Settle</Button>}
                  </td>
                </tr>
              )} />
          )}
        </>
      )}

      {modal === "inspection" && <InspectionModal tyres={tyres} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === "repair" && <RepairModal tyres={tyres} suppliers={suppliers} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === "retreading" && <RetreadingModal tyres={tyres} suppliers={suppliers} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === "warranty" && <WarrantyModal tyres={tyres} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
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

function InspectionModal({ tyres, onClose, onSaved }: { tyres: TyreRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<InspectionInput>({ tyreId: 0, inspectionDate: new Date().toISOString().slice(0, 10), condition: "Good", recommendedAction: "None" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof InspectionInput>(k: K, v: InspectionInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    const parsed = inspectionInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/tyre/inspection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Recorded."); onSaved(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">New Inspection</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 p-5">
          <div><label className={modalLbl}>Tyre *</label><select value={f.tyreId || ""} onChange={(e) => set("tyreId", Number(e.target.value) || 0)} className={modalInp}><option value="">— Select —</option>{tyres.map((t) => <option key={t.id} value={t.id}>{t.tyreCode} {t.currentVehicleNo ? `(${t.currentVehicleNo})` : ""}</option>)}</select></div>
          <div><label className={modalLbl}>Inspection Date *</label><input type="date" value={f.inspectionDate} onChange={(e) => set("inspectionDate", e.target.value)} className={modalInp} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={modalLbl}>Tread Depth (mm)</label><input type="number" min={0} step="0.1" value={f.treadDepthMm ?? ""} onChange={(e) => set("treadDepthMm", e.target.value ? Number(e.target.value) : null)} className={modalInp} /></div>
            <div><label className={modalLbl}>Pressure (psi)</label><input type="number" min={0} value={f.pressurePsi ?? ""} onChange={(e) => set("pressurePsi", e.target.value ? Number(e.target.value) : null)} className={modalInp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={modalLbl}>Condition</label><select value={f.condition} onChange={(e) => set("condition", e.target.value as InspectionInput["condition"])} className={modalInp}>{INSPECTION_CONDITION_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className={modalLbl}>Recommended Action</label><select value={f.recommendedAction} onChange={(e) => set("recommendedAction", e.target.value as InspectionInput["recommendedAction"])} className={modalInp}>{RECOMMENDED_ACTION_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
          </div>
          <div><label className={modalLbl}>Defect Type</label><input value={f.defectType ?? ""} onChange={(e) => set("defectType", e.target.value)} placeholder="Cut / Crack / Bulge / Puncture / Uneven Wear" className={modalInp} /></div>
          <div><label className={modalLbl}>Remarks</label><textarea value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={2} className={cn(modalInp, "h-auto py-2")} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Inspection"}</Button></div>
      </div>
    </div>
  );
}

function RepairModal({ tyres, suppliers, onClose, onSaved }: { tyres: TyreRow[]; suppliers: SupplierOpt[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<RepairInput>({ tyreId: 0, repairDate: new Date().toISOString().slice(0, 10), otherCost: 0, items: [], labour: [] });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RepairInput>(k: K, v: RepairInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    const parsed = repairInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/tyre/repair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Recorded."); onSaved(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">New Repair</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 p-5">
          <div><label className={modalLbl}>Tyre *</label><select value={f.tyreId || ""} onChange={(e) => set("tyreId", Number(e.target.value) || 0)} className={modalInp}><option value="">— Select —</option>{tyres.filter((t) => t.status !== "Fitted").map((t) => <option key={t.id} value={t.id}>{t.tyreCode}</option>)}</select></div>
          <div><label className={modalLbl}>Repair Date *</label><input type="date" value={f.repairDate} onChange={(e) => set("repairDate", e.target.value)} className={modalInp} /></div>
          <div><label className={modalLbl}>Workshop (Supplier)</label><select value={f.workshopId ?? ""} onChange={(e) => set("workshopId", e.target.value ? Number(e.target.value) : null)} className={modalInp}><option value="">— Select or leave blank —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className={modalLbl}>Repair Type</label><input value={f.repairType ?? ""} onChange={(e) => set("repairType", e.target.value)} placeholder="Puncture Repair / Patch / Vulcanising" className={modalInp} /></div>
          <div><label className={modalLbl}>Cost</label><input type="number" min={0} value={f.otherCost} onChange={(e) => set("otherCost", Number(e.target.value) || 0)} className={modalInp} /></div>
          <div><label className={modalLbl}>Description</label><textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} className={cn(modalInp, "h-auto py-2")} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Repair"}</Button></div>
      </div>
    </div>
  );
}

function RetreadingModal({ tyres, suppliers, onClose, onSaved }: { tyres: TyreRow[]; suppliers: SupplierOpt[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<RetreadingInput>({ tyreId: 0, sentDate: new Date().toISOString().slice(0, 10), cost: 0 });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RetreadingInput>(k: K, v: RetreadingInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    const parsed = retreadingInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/tyre/retreading", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Sent for retreading."); onSaved(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">Send for Retreading</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 p-5">
          <div><label className={modalLbl}>Tyre *</label><select value={f.tyreId || ""} onChange={(e) => set("tyreId", Number(e.target.value) || 0)} className={modalInp}><option value="">— Select —</option>{tyres.filter((t) => t.status !== "Fitted").map((t) => <option key={t.id} value={t.id}>{t.tyreCode}</option>)}</select></div>
          <div><label className={modalLbl}>Sent Date *</label><input type="date" value={f.sentDate} onChange={(e) => set("sentDate", e.target.value)} className={modalInp} /></div>
          <div><label className={modalLbl}>Vendor (Supplier)</label><select value={f.vendorId ?? ""} onChange={(e) => set("vendorId", e.target.value ? Number(e.target.value) : null)} className={modalInp}><option value="">— Select or leave blank —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className={modalLbl}>Retread Type</label><input value={f.retreadType ?? ""} onChange={(e) => set("retreadType", e.target.value)} placeholder="Hot / Cold (Precure)" className={modalInp} /></div>
          <div><label className={modalLbl}>Cost</label><input type="number" min={0} value={f.cost} onChange={(e) => set("cost", Number(e.target.value) || 0)} className={modalInp} /></div>
          <div><label className={modalLbl}>Remarks</label><textarea value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={2} className={cn(modalInp, "h-auto py-2")} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Send for Retreading"}</Button></div>
      </div>
    </div>
  );
}

function WarrantyModal({ tyres, onClose, onSaved }: { tyres: TyreRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<WarrantyClaimInput>({ tyreId: 0, claimDate: new Date().toISOString().slice(0, 10), reason: "" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof WarrantyClaimInput>(k: K, v: WarrantyClaimInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    const parsed = warrantyClaimInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/tyre/warranty-claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Claim filed."); onSaved(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">File Warranty Claim</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 p-5">
          <div><label className={modalLbl}>Tyre *</label><select value={f.tyreId || ""} onChange={(e) => set("tyreId", Number(e.target.value) || 0)} className={modalInp}><option value="">— Select —</option>{tyres.map((t) => <option key={t.id} value={t.id}>{t.tyreCode}</option>)}</select></div>
          <div><label className={modalLbl}>Claim Date *</label><input type="date" value={f.claimDate} onChange={(e) => set("claimDate", e.target.value)} className={modalInp} /></div>
          <div><label className={modalLbl}>Reason *</label><input value={f.reason} onChange={(e) => set("reason", e.target.value)} className={modalInp} /></div>
          <div><label className={modalLbl}>Claimed Amount</label><input type="number" min={0} value={f.claimedAmount ?? ""} onChange={(e) => set("claimedAmount", e.target.value ? Number(e.target.value) : null)} className={modalInp} /></div>
          <div><label className={modalLbl}>Remarks</label><textarea value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={2} className={cn(modalInp, "h-auto py-2")} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "File Claim"}</Button></div>
      </div>
    </div>
  );
}
