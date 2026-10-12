"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PackageCheck, Plus, X, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/transport/VehicleGateEntryScreen";

interface Row {
  id: number; loadingNo: string; gateEntryId: number; warehouse: string | null; loadingBayId: number | null;
  supervisor: string | null; loadingStart: string | null; loadingEnd: string | null;
  packages: number; pallets: number; batchNo: string | null; serialNumber: string | null; sealNumber: string | null;
  remarks: string | null; createdAt: string;
}
interface GateRow { id: number; gateEntryNo: string; vehicleNo: string; status: string }
interface BayOpt { id: number; name: string }

export function LoadingConfirmationScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [gateEntries, setGateEntries] = useState<GateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [closeRow, setCloseRow] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lc, ge] = await Promise.all([
        fetch("/api/transport/loading-confirmation", { cache: "no-store" }),
        fetch("/api/transport/gate-entry", { cache: "no-store" }),
      ]);
      if (lc.status === 401 || ge.status === 401) { setNotAuthed(true); return; }
      const [lj, gj] = await Promise.all([lc.json().catch(() => ({})), ge.json().catch(() => ({}))]);
      if (lj.ok) { setNotAuthed(false); setRows(lj.rows); }
      if (gj.ok) setGateEntries(gj.rows);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openGateIds = useMemo(() => new Set(rows.filter((r) => !r.loadingEnd).map((r) => r.gateEntryId)), [rows]);
  const eligible = useMemo(() => gateEntries.filter((g) => (g.status === "Inside Factory" || g.status === "Loading") && !openGateIds.has(g.id)), [gateEntries, openGateIds]);
  const gateMap = useMemo(() => new Map(gateEntries.map((g) => [g.id, g])), [gateEntries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Loading Confirmation</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageCheck className="h-5 w-5 text-primary" /> Loading Confirmation</h1>
          <p className="mt-0.5 text-sm text-muted">Opens when loading starts, closes with packages/pallets/batch/serial/seal once loading finishes.</p>
        </div>
        <Button size="md" onClick={() => setShowCreate(true)} disabled={eligible.length === 0}><Plus className="h-4 w-4" /> Start Loading</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Loading No</th>
                <th className="px-4 py-3">Gate Entry</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3 text-center">Pkgs / Pallets</th>
                <th className="px-4 py-3">Seal</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const g = gateMap.get(r.gateEntryId);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{r.loadingNo}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{g ? `${g.gateEntryNo} — ${g.vehicleNo}` : `#${r.gateEntryId}`}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.supervisor ?? "—"}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-foreground">{r.packages} / {r.pallets}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.sealNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-center"><Badge tone={r.loadingEnd ? "success" : "warning"}>{r.loadingEnd ? "Closed" : "Open"}</Badge></td>
                    <td className="px-4 py-3"><div className="flex items-center justify-end">
                      {!r.loadingEnd && <Button size="sm" variant="outline" onClick={() => setCloseRow(r)}><StopCircle className="h-3.5 w-3.5" /> Close Loading</Button>}
                    </div></td>
                  </tr>
                );
              })}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading confirmations…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : "No loading confirmations yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <StartModal eligible={eligible} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {closeRow && <CloseModal row={closeRow} onClose={() => setCloseRow(null)} onSaved={() => { setCloseRow(null); load(); }} />}
    </div>
  );
}

function StartModal({ eligible, onClose, onSaved }: { eligible: GateRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [gateEntryId, setGateEntryId] = useState<number | "">(eligible[0]?.id ?? "");
  const [warehouse, setWarehouse] = useState("");
  const [loadingBayId, setLoadingBayId] = useState<number | "">("");
  const [bays, setBays] = useState<BayOpt[]>([]);
  const [supervisor, setSupervisor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/transport/masters/loading-bay?status=Active", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setBays(j.rows); }).catch(() => undefined);
  }, []);

  async function save() {
    if (!gateEntryId) { toast.error("Select a gate entry."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/transport/loading-confirmation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateEntryId, warehouse: warehouse || null, loadingBayId: loadingBayId || null, supervisor: supervisor || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (toast.result(j, "Loading started.", "Could not start loading.")) onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><PackageCheck className="h-4 w-4" /></span><h2 className="text-sm font-bold text-foreground">Start Loading</h2></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3.5 p-5">
          <Field label="Gate Entry *">
            <select value={gateEntryId} onChange={(e) => setGateEntryId(e.target.value ? Number(e.target.value) : "")} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
              <option value="">Select gate entry…</option>
              {eligible.map((g) => <option key={g.id} value={g.id}>{g.gateEntryNo} — {g.vehicleNo} ({g.status})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Warehouse"><input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></Field>
            <Field label="Loading Bay"><select value={loadingBayId} onChange={(e) => setLoadingBayId(e.target.value ? Number(e.target.value) : "")} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus"><option value="">—</option>{bays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          </div>
          <Field label="Supervisor"><input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={save} disabled={saving}>{saving ? "Starting…" : "Start Loading"}</Button>
        </div>
      </div>
    </div>
  );
}

function CloseModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [packages, setPackages] = useState(String(row.packages || 0));
  const [pallets, setPallets] = useState(String(row.pallets || 0));
  const [batchNo, setBatchNo] = useState(row.batchNo ?? "");
  const [serialNumber, setSerialNumber] = useState(row.serialNumber ?? "");
  const [sealNumber, setSealNumber] = useState(row.sealNumber ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/transport/loading-confirmation/${row.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packages: Number(packages) || 0, pallets: Number(pallets) || 0, batchNo: batchNo || null, serialNumber: serialNumber || null, sealNumber: sealNumber || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (toast.result(j, "Loading closed.", "Could not close loading.")) onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><StopCircle className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-foreground">Close Loading</h2><p className="text-2xs text-muted">{row.loadingNo}</p></div></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3.5 p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Packages"><input type="number" min={0} value={packages} onChange={(e) => setPackages(e.target.value)} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></Field>
            <Field label="Pallets"><input type="number" min={0} value={pallets} onChange={(e) => setPallets(e.target.value)} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></Field>
          </div>
          <Field label="Batch No"><input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></Field>
          <Field label="Serial Number"><input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></Field>
          <Field label="Seal Number"><input value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={save} disabled={saving}>{saving ? "Closing…" : "Close Loading"}</Button>
        </div>
      </div>
    </div>
  );
}
