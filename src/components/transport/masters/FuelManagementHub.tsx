"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fuel, Plus, Eye, Search, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  ADJUSTMENT_TYPE_OPTS, ADJUSTMENT_REASON_OPTS, stockAdjustmentInput,
  type FuelEntryRow, type FuelIssueRow, type FuelPurchaseRow, type TankRow, type AdjustmentRow, type StockAdjustmentInput,
} from "@/lib/contracts/fuelManagement";
import { StationTankManager } from "@/components/transport/masters/StationTankManager";

interface Stats { totalQty: number; totalCost: number; avgRate: number; qtyThisMonth: number; costThisMonth: number; transactionCount: number }
const TXN_TONE: Record<string, "neutral" | "info" | "success" | "danger"> = { Draft: "neutral", Confirmed: "success", Cancelled: "danger" };

export function FuelManagementHub({ vehicleFilter, embedded }: { vehicleFilter?: number; embedded?: boolean } = {}) {
  const router = useRouter();
  const [tab, setTab] = useState<"entry" | "issue" | "purchase" | "stations" | "adjustments">("entry");
  const [stats, setStats] = useState<Stats | null>(null);
  const [entries, setEntries] = useState<FuelEntryRow[]>([]);
  const [issues, setIssues] = useState<FuelIssueRow[]>([]);
  const [purchases, setPurchases] = useState<FuelPurchaseRow[]>([]);
  const [tanks, setTanks] = useState<TankRow[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const vf = vehicleFilter ? `vehicleId=${vehicleFilter}&` : "";
    const [e, i, p, t, a] = await Promise.all([
      fetch(`/api/transport/fuel-entry?${vf}${q ? `q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/transport/fuel-issue?${vf}${q ? `q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/transport/fuel-purchase", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/transport/fuel-tank", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/transport/fuel-adjustment", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    if (e?.ok) { setEntries(e.rows); setStats(e.stats); }
    if (i?.ok) setIssues(i.rows);
    if (p?.ok) setPurchases(p.rows);
    if (t?.ok) setTanks(t.rows);
    if (a?.ok) setAdjustments(a.rows);
    setLoading(false);
  }, [q, vehicleFilter]);
  useEffect(() => { load(); }, [load]);

  const lowStockTanks = tanks.filter((t) => t.lowStock);

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Fuel Management</span></div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Fuel className="h-5 w-5 text-primary" /> Fuel Management</h1>
            <p className="mt-0.5 text-sm text-muted">External fuel entries, internal tank issues, purchases and consumption — vehicle/driver/trip-centric, referencing existing masters by id only.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="md" onClick={() => router.push("/masters/transport/fuel-management/entry/new")}><Plus className="h-4 w-4" /> Fuel Entry</Button>
            <Button variant="outline" size="md" onClick={() => router.push("/masters/transport/fuel-management/issue/new")}><Plus className="h-4 w-4" /> Fuel Issue</Button>
            <Button size="md" onClick={() => router.push("/masters/transport/fuel-management/purchase/new")}><Plus className="h-4 w-4" /> Fuel Purchase</Button>
          </div>
        </div>
      )}

      {stats && !embedded && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Fuel Qty" value={`${stats.totalQty.toLocaleString()} L`} />
          <StatCard label="Total Fuel Cost" value={`₹${stats.totalCost.toLocaleString()}`} />
          <StatCard label="Avg Rate" value={`₹${stats.avgRate.toFixed(2)}`} />
          <StatCard label="This Month Qty" value={`${stats.qtyThisMonth.toLocaleString()} L`} />
          <StatCard label="This Month Cost" value={`₹${stats.costThisMonth.toLocaleString()}`} />
          <StatCard label="Transactions" value={stats.transactionCount} />
        </div>
      )}

      {lowStockTanks.length > 0 && !embedded && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning"><AlertTriangle className="h-4 w-4" /> Low stock: {lowStockTanks.map((t) => `${t.tankName} (${t.currentQty}L)`).join(", ")}</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
          {([["entry", "Fuel Entry"], ["issue", "Fuel Issue"], ["purchase", "Fuel Purchase"], ["stations", "Station / Tank"], ["adjustments", "Adjustments"]] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("px-3 py-1.5 font-semibold transition", tab === k ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
          ))}
        </div>
        {(tab === "entry" || tab === "issue") && (
          <div className="relative max-w-xs flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
          </div>
        )}
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          {tab === "entry" && (
            <ListTable rows={entries} empty="No fuel entries yet." columns={["Entry No.", "Vehicle", "Driver", "Fuel Station", "Qty", "Amount", "Odometer", "Status", ""]}
              renderRow={(r: FuelEntryRow) => (
                <tr key={r.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2/20" onClick={() => router.push(`/masters/transport/fuel-management/entry/${r.id}`)}>
                  <td className="px-3 py-2 font-medium text-foreground">{r.entryNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.driverName ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.fuelStationName ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.quantity} L</td>
                  <td className="px-3 py-2 text-2xs text-muted">₹{r.amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.odometer ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={TXN_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-3 py-2 text-right"><button onClick={(e) => { e.stopPropagation(); router.push(`/masters/transport/fuel-management/entry/${r.id}`); }} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:text-primary"><Eye className="h-4 w-4" /></button></td>
                </tr>
              )} />
          )}
          {tab === "issue" && (
            <ListTable rows={issues} empty="No fuel issues yet." columns={["Issue No.", "Vehicle", "Tank", "Driver", "Qty", "Amount", "Odometer", "Status", ""]}
              renderRow={(r: FuelIssueRow) => (
                <tr key={r.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2/20" onClick={() => router.push(`/masters/transport/fuel-management/issue/${r.id}`)}>
                  <td className="px-3 py-2 font-medium text-foreground">{r.issueNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.vehicleNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.tankName}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.driverName ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.quantity} L</td>
                  <td className="px-3 py-2 text-2xs text-muted">₹{r.amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.odometer ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={TXN_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-3 py-2 text-right"><button onClick={(e) => { e.stopPropagation(); router.push(`/masters/transport/fuel-management/issue/${r.id}`); }} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:text-primary"><Eye className="h-4 w-4" /></button></td>
                </tr>
              )} />
          )}
          {tab === "purchase" && (
            <ListTable rows={purchases} empty="No fuel purchases yet." columns={["Purchase No.", "Date", "Supplier", "Tank", "Qty", "Amount", "Status"]}
              renderRow={(r: FuelPurchaseRow) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.purchaseNo}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.purchaseDate}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.supplierName ?? "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.tankName}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.quantity} L</td>
                  <td className="px-3 py-2 text-2xs text-muted">₹{r.amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={TXN_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                </tr>
              )} />
          )}
          {tab === "stations" && !embedded && <StationTankManager tanks={tanks} onChanged={load} />}
          {tab === "adjustments" && !embedded && (
            <div className="space-y-3">
              <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => setAdjustModalOpen(true)}><Plus className="h-3.5 w-3.5" /> New Adjustment</Button></div>
              <ListTable rows={adjustments} empty="No stock adjustments yet." columns={["Adjustment No.", "Date", "Tank", "Type", "Qty", "Reason", "By"]}
                renderRow={(r: AdjustmentRow) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                    <td className="px-3 py-2 font-medium text-foreground">{r.adjustmentNo}</td>
                    <td className="px-3 py-2 text-2xs text-muted">{r.adjustmentDate}</td>
                    <td className="px-3 py-2 text-2xs text-muted">{r.tankName}</td>
                    <td className="px-3 py-2 text-2xs text-muted">{r.adjustmentType}</td>
                    <td className="px-3 py-2 text-2xs text-muted">{r.quantity} L</td>
                    <td className="px-3 py-2 text-2xs text-muted">{r.reason}</td>
                    <td className="px-3 py-2 text-2xs text-muted">{r.createdByName ?? "—"}</td>
                  </tr>
                )} />
            </div>
          )}
        </>
      )}
      {adjustModalOpen && <AdjustmentModal tanks={tanks} onClose={() => setAdjustModalOpen(false)} onSaved={() => { setAdjustModalOpen(false); load(); }} />}
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

function AdjustmentModal({ tanks, onClose, onSaved }: { tanks: TankRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<StockAdjustmentInput>({ tankId: 0, adjustmentDate: new Date().toISOString().slice(0, 10), adjustmentType: "Increase", quantity: 0, reason: "Measurement Difference", remarks: "" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof StockAdjustmentInput>(k: K, v: StockAdjustmentInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    const parsed = stockAdjustmentInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/fuel-adjustment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Recorded."); onSaved(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">Fuel Stock Adjustment</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 p-5">
          <p className="text-2xs text-warning">This directly changes tank stock and is fully audited — use only for genuine corrections (measurement/leakage/evaporation/calibration).</p>
          <div><label className={modalLbl}>Fuel Tank *</label><select value={f.tankId || ""} onChange={(e) => set("tankId", Number(e.target.value) || 0)} className={modalInp}><option value="">— Select —</option>{tanks.map((t) => <option key={t.id} value={t.id}>{t.tankName} ({t.currentQty}L current)</option>)}</select></div>
          <div><label className={modalLbl}>Date *</label><input type="date" value={f.adjustmentDate} onChange={(e) => set("adjustmentDate", e.target.value)} className={modalInp} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={modalLbl}>Adjustment Type</label><select value={f.adjustmentType} onChange={(e) => set("adjustmentType", e.target.value as StockAdjustmentInput["adjustmentType"])} className={modalInp}>{ADJUSTMENT_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className={modalLbl}>Quantity (L) *</label><input type="number" min={0} value={f.quantity || ""} onChange={(e) => set("quantity", Number(e.target.value) || 0)} className={modalInp} /></div>
          </div>
          <div><label className={modalLbl}>Reason *</label><select value={f.reason} onChange={(e) => set("reason", e.target.value as StockAdjustmentInput["reason"])} className={modalInp}>{ADJUSTMENT_REASON_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
          <div><label className={modalLbl}>Remarks</label><textarea value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={2} className={cn(modalInp, "h-auto py-2")} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Adjustment"}</Button></div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
    </div>
  );
}
