"use client";

import { useCallback, useEffect, useState } from "react";
import { Disc, Plus, Search, AlertTriangle, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  tyreMasterInput, TYRE_STATUS_OPTS, TYRE_TYPE_OPTS, TYRE_CATEGORY_OPTS,
  type TyreRow, type TyreMasterInput,
} from "@/lib/contracts/tyre";
import { TyreHistory } from "@/components/transport/masters/tyre/TyreHistory";

interface DashboardData {
  summary: { total: number; fitted: number; available: number; underRepair: number; underRetreading: number; scrapped: number; inStock: number };
  alerts: { id: number; category: string; severity: string; title: string; message: string; href: string | null }[];
  cost: { repairCostMonth: number; retreadCostMonth: number; repairCostYear: number; retreadCostYear: number; purchaseCostYear: number };
}
interface StockRow { status: string; count: number; purchaseCost: number }

const STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "info"> = {
  "In Stock": "neutral", Available: "success", Fitted: "primary", "Under Inspection": "info",
  "Under Repair": "warning", "Under Retreading": "warning", Removed: "neutral", Scrapped: "danger",
  Sold: "neutral", Lost: "danger", "Warranty Claim": "info",
};
const SEVERITY_TONE: Record<string, "warning" | "danger" | "info"> = { High: "danger", Medium: "warning", Low: "info" };

// Mirrors the NEXT transition tables in
// src/app/api/transport/tyre/master/[id]/status/route.ts — only offer an
// action here if the server will actually accept it from this status.
const STATUS_ACTIONS: Record<string, { action: string; label: string }[]> = {
  "In Stock": [{ action: "makeAvailable", label: "Make Available" }],
  "Under Repair": [{ action: "makeAvailable", label: "Make Available" }, { action: "scrap", label: "Scrap" }],
  "Under Retreading": [{ action: "makeAvailable", label: "Make Available" }],
  "Under Inspection": [{ action: "makeAvailable", label: "Make Available" }, { action: "scrap", label: "Scrap" }, { action: "fileWarrantyClaim", label: "File Warranty Claim" }],
  Available: [{ action: "scrap", label: "Scrap" }, { action: "sell", label: "Sell" }, { action: "reportLost", label: "Report Lost" }, { action: "fileWarrantyClaim", label: "File Warranty Claim" }],
  Removed: [{ action: "scrap", label: "Scrap" }, { action: "sell", label: "Sell" }, { action: "fileWarrantyClaim", label: "File Warranty Claim" }],
  Fitted: [{ action: "reportLost", label: "Report Lost" }],
  Scrapped: [{ action: "sell", label: "Sell" }],
};

export function TyreMasterStockHub({ embedded }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState<"dashboard" | "master" | "stock">("dashboard");
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [tyres, setTyres] = useState<TyreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTyre, setEditTyre] = useState<TyreRow | null>(null);
  const [historyTyre, setHistoryTyre] = useState<TyreRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status !== "All") qs.set("status", status);
    const [d, s, t] = await Promise.all([
      fetch("/api/transport/tyre/dashboard", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/transport/tyre/stock", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/transport/tyre/master?${qs.toString()}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    if (d?.ok) setDash(d);
    if (s?.ok) setStock(s.rows);
    if (t?.ok) setTyres(t.rows);
    setLoading(false);
    fetch("/api/transport/tyre/alerts/sync", { method: "POST" }).catch(() => {});
  }, [q, status]);
  useEffect(() => { load(); }, [load]);

  const toast = useToast();
  async function runStatusAction(id: number, action: string, label: string) {
    if (action === "scrap" && !confirm(`Scrap this tyre? It cannot be fitted again afterwards.`)) return;
    const j = await fetch(`/api/transport/tyre/master/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { toast.success(j.message || `${label} done.`); load(); } else toast.error(j.message || `Could not ${label.toLowerCase()}.`);
  }

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Tyre Management</span></div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Disc className="h-5 w-5 text-primary" /> Tyre Master &amp; Stock</h1>
            <p className="mt-0.5 text-sm text-muted">Every physical tyre's identity, purchase, warranty and current lifecycle status — referencing Vehicle/Supplier/Item Master by id only.</p>
          </div>
          <Button size="md" onClick={() => { setEditTyre(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Add Tyre</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
          {([["dashboard", "Dashboard"], ["master", "Tyre Master"], ["stock", "Stock"]] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("px-3 py-1.5 font-semibold transition", tab === k ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>
          ))}
        </div>
        {tab === "master" && (
          <>
            <div className="relative max-w-xs flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tyre code, serial, brand…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-border bg-surface-2 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none">
              <option value="All">All statuses</option>
              {TYRE_STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        )}
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          {tab === "dashboard" && dash && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Total Tyres" value={dash.summary.total} />
                <StatCard label="Fitted" value={dash.summary.fitted} />
                <StatCard label="Available" value={dash.summary.available} />
                <StatCard label="Under Repair" value={dash.summary.underRepair} />
                <StatCard label="Under Retreading" value={dash.summary.underRetreading} />
                <StatCard label="Scrapped" value={dash.summary.scrapped} />
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <StatCard label="Repair Cost (Month)" value={`₹${dash.cost.repairCostMonth.toLocaleString()}`} />
                <StatCard label="Retreading Cost (Month)" value={`₹${dash.cost.retreadCostMonth.toLocaleString()}`} />
                <StatCard label="Purchase Cost (Year)" value={`₹${dash.cost.purchaseCostYear.toLocaleString()}`} />
              </div>
              {dash.alerts.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground"><AlertTriangle className="h-4 w-4 text-warning" /> Alerts</h3>
                  <div className="space-y-1.5">
                    {dash.alerts.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 rounded-lg bg-surface-2/40 px-3 py-2 text-xs">
                        <Badge tone={SEVERITY_TONE[a.severity] ?? "info"}>{a.severity}</Badge>
                        <div><p className="font-semibold text-foreground">{a.title}</p><p className="text-2xs text-muted">{a.message}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "master" && (
            <ListTable rows={tyres} empty="No tyres added yet." columns={["Tyre Code", "Brand / Size", "Type", "Status", "Vehicle / Position", "Purchase Cost", "Retreads", ""]}
              renderRow={(r: TyreRow) => (
                <tr key={r.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2/20" onClick={() => { setEditTyre(r); setModalOpen(true); }}>
                  <td className="px-3 py-2 font-medium text-foreground">{r.tyreCode}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{[r.brand, r.size].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.tyreType ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.currentVehicleNo ? `${r.currentVehicleNo} @ ${r.currentPositionCode}` : "—"}</td>
                  <td className="px-3 py-2 text-2xs text-muted">₹{r.purchaseCost.toLocaleString()}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.retreadCount}</td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {(STATUS_ACTIONS[r.status] ?? []).length > 0 && (
                        <select
                          value=""
                          onChange={(e) => { const a = STATUS_ACTIONS[r.status]?.find((x) => x.action === e.target.value); if (a) runStatusAction(r.id, a.action, a.label); }}
                          className="h-8 rounded-md border border-border-strong bg-surface px-2 text-2xs text-foreground focus:border-primary focus:outline-none"
                        >
                          <option value="">Action…</option>
                          {STATUS_ACTIONS[r.status]!.map((a) => <option key={a.action} value={a.action}>{a.label}</option>)}
                        </select>
                      )}
                      <button onClick={() => setHistoryTyre(r)} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:text-primary" title="View history"><Eye className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              )} />
          )}

          {tab === "stock" && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2.5 text-left">Status</th><th className="px-3 py-2.5 text-right">Count</th><th className="px-3 py-2.5 text-right">Purchase Cost</th></tr></thead>
                <tbody>
                  {stock.map((s) => (
                    <tr key={s.status} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2"><Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{s.status}</Badge></td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{s.count}</td>
                      <td className="px-3 py-2 text-right text-2xs text-muted">₹{s.purchaseCost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modalOpen && <TyreModal tyre={editTyre} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load(); }} />}
      {historyTyre && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => setHistoryTyre(null)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">Tyre History — {historyTyre.tyreCode}</h2><button onClick={() => setHistoryTyre(null)} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
            <div className="p-5"><TyreHistory embedded tyreFilter={historyTyre.id} /></div>
          </div>
        </div>
      )}
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

function TyreModal({ tyre, onClose, onSaved }: { tyre: TyreRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<TyreMasterInput>({
    tyreCode: tyre?.tyreCode ?? "", serialNo: tyre?.serialNo ?? "", brand: tyre?.brand ?? "", pattern: "", size: tyre?.size ?? "",
    tyreType: (tyre?.tyreType as TyreMasterInput["tyreType"]) ?? null, category: (tyre?.category as TyreMasterInput["category"]) ?? null,
    purchaseCost: tyre?.purchaseCost ?? 0, minTreadDepthMm: 1.6, purchaseDate: null, purchaseInvoiceNo: null,
    warrantyMonths: null, warrantyKm: null, warrantyExpiryDate: null, originalTreadDepthMm: null, ratedPressurePsi: null, remarks: null,
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TyreMasterInput>(k: K, v: TyreMasterInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (tyre) fetch(`/api/transport/tyre/master/${tyre.id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setF({ ...j.tyre, tyreType: j.tyre.tyreType, category: j.tyre.category }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tyre?.id]);

  async function save() {
    const parsed = tyreMasterInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const url = tyre ? `/api/transport/tyre/master/${tyre.id}` : "/api/transport/tyre/master";
    const j = await fetch(url, { method: tyre ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); onSaved(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">{tyre ? `Edit Tyre — ${tyre.tyreCode}` : "Add Tyre"}</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {!tyre && <div><label className={modalLbl}>Tyre Code</label><input value={f.tyreCode ?? ""} onChange={(e) => set("tyreCode", e.target.value)} placeholder="Auto-generated if left blank" className={modalInp} /></div>}
          <div><label className={modalLbl}>Serial No.</label><input value={f.serialNo ?? ""} onChange={(e) => set("serialNo", e.target.value)} className={modalInp} /></div>
          <div><label className={modalLbl}>Brand</label><input value={f.brand ?? ""} onChange={(e) => set("brand", e.target.value)} className={modalInp} /></div>
          <div><label className={modalLbl}>Size</label><input value={f.size ?? ""} onChange={(e) => set("size", e.target.value)} placeholder="e.g. 295/80 R22.5" className={modalInp} /></div>
          <div><label className={modalLbl}>Pattern</label><input value={f.pattern ?? ""} onChange={(e) => set("pattern", e.target.value)} className={modalInp} /></div>
          <div><label className={modalLbl}>Type</label><select value={f.tyreType ?? ""} onChange={(e) => set("tyreType", (e.target.value || null) as TyreMasterInput["tyreType"])} className={modalInp}><option value="">—</option>{TYRE_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className={modalLbl}>Category</label><select value={f.category ?? ""} onChange={(e) => set("category", (e.target.value || null) as TyreMasterInput["category"])} className={modalInp}><option value="">—</option>{TYRE_CATEGORY_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className={modalLbl}>Purchase Date</label><input type="date" value={f.purchaseDate ?? ""} onChange={(e) => set("purchaseDate", e.target.value || null)} className={modalInp} /></div>
          <div><label className={modalLbl}>Purchase Invoice No.</label><input value={f.purchaseInvoiceNo ?? ""} onChange={(e) => set("purchaseInvoiceNo", e.target.value)} className={modalInp} /></div>
          <div><label className={modalLbl}>Purchase Cost</label><input type="number" min={0} value={f.purchaseCost} onChange={(e) => set("purchaseCost", Number(e.target.value) || 0)} className={modalInp} /></div>
          <div><label className={modalLbl}>Warranty (months)</label><input type="number" min={0} value={f.warrantyMonths ?? ""} onChange={(e) => set("warrantyMonths", e.target.value ? Number(e.target.value) : null)} className={modalInp} /></div>
          <div><label className={modalLbl}>Warranty Expiry</label><input type="date" value={f.warrantyExpiryDate ?? ""} onChange={(e) => set("warrantyExpiryDate", e.target.value || null)} className={modalInp} /></div>
          <div><label className={modalLbl}>Original Tread Depth (mm)</label><input type="number" min={0} step="0.1" value={f.originalTreadDepthMm ?? ""} onChange={(e) => set("originalTreadDepthMm", e.target.value ? Number(e.target.value) : null)} className={modalInp} /></div>
          <div><label className={modalLbl}>Min. Tread Depth Threshold (mm)</label><input type="number" min={0} step="0.1" value={f.minTreadDepthMm} onChange={(e) => set("minTreadDepthMm", Number(e.target.value) || 1.6)} className={modalInp} /></div>
          <div><label className={modalLbl}>Rated Pressure (psi)</label><input type="number" min={0} value={f.ratedPressurePsi ?? ""} onChange={(e) => set("ratedPressurePsi", e.target.value ? Number(e.target.value) : null)} className={modalInp} /></div>
          <div className="sm:col-span-2"><label className={modalLbl}>Remarks</label><textarea value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={2} className={cn(modalInp, "h-auto py-2")} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Tyre"}</Button></div>
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
