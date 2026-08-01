"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, Search, Plus, X, LogIn, PlayCircle, CheckCircle2, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { GateEntryStatus } from "@/lib/contracts/transport";

interface Row {
  id: number; gateEntryNo: string; vehicleId: number; vehicleNo: string;
  driverId: number | null; driverName: string | null;
  transportCompanyId: number | null; transportCompanyName: string | null;
  dispatchPlanningId: number | null; dispatchExecutionId: number | null;
  dispatchType: string | null; referenceNo: string | null;
  arrivalTime: string | null; securityOfficer: string | null; remarks: string | null;
  status: GateEntryStatus; createdAt: string;
}
interface Stats { total: number; waiting: number; inside: number; loading: number }
const EMPTY: Stats = { total: 0, waiting: 0, inside: 0, loading: 0 };
const STATUS_TONE: Record<GateEntryStatus, "neutral" | "info" | "warning" | "success" | "primary"> = {
  Waiting: "neutral", "Inside Factory": "info", Loading: "warning", Completed: "success", Exited: "primary",
};
const FILTERS = ["All", "Waiting", "Inside Factory", "Loading", "Completed", "Exited"] as const;

export function VehicleGateEntryScreen() {
  const toast = useToast();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("All");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [exitRow, setExitRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = new URLSearchParams();
      if (status !== "All") u.set("status", status);
      if (query.trim()) u.set("q", query.trim());
      const res = await fetch(`/api/transport/gate-entry?${u}`, { cache: "no-store" });
      if (res.status === 401) { setNotAuthed(true); return; }
      const j = await res.json().catch(() => ({}));
      if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [query, status]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function runAction(row: Row, action: "move-inside" | "start-loading" | "complete") {
    setBusy(row.id);
    try {
      const res = await fetch(`/api/transport/gate-entry/${row.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await res.json().catch(() => ({}));
      toast.result(j, "Updated.", "Could not update the gate entry.");
      if (j.ok) {
        if (action === "start-loading") {
          // Start Loading now hands off straight into Load & Dispatch, pre-filled
          // with this gate entry's vehicle/transport/driver details — Customer
          // dispatches go to the invoice-grade Direct form; other dispatch types
          // land on the source picker with the gate entry reference carried along.
          const path = row.dispatchType === "Customer"
            ? `/warehouse/transfer/load-dispatch/new/direct?gateEntryId=${row.id}`
            : `/warehouse/transfer/load-dispatch/new?gateEntryId=${row.id}`;
          router.push(path);
          return;
        }
        load();
      }
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Vehicle Gate Entry</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> Vehicle Gate Entry</h1>
          <p className="mt-0.5 text-sm text-muted">First step of the physical vehicle flow — records arrival &amp; drives Move Inside → Start Loading → Complete → Exit.</p>
        </div>
        <Button size="md" onClick={() => router.push("/transport/gate-entry/new")}><Plus className="h-4 w-4" /> New Gate Entry</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={stats.total} tone="primary" />
        <Stat label="Waiting" value={stats.waiting} tone="neutral" />
        <Stat label="Inside Factory" value={stats.inside} tone="info" />
        <Stat label="Loading" value={stats.loading} tone="warning" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search gate entry no or reference…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
            {FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All statuses" : f}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Gate Entry No</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Arrival</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><span className="font-mono text-xs font-semibold text-foreground">{r.gateEntryNo}</span></td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.vehicleNo}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{r.driverName ?? "—"}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{r.dispatchType ? `${r.dispatchType} · ` : ""}{r.referenceNo ?? "—"}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{r.arrivalTime ? new Date(r.arrivalTime).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === "Waiting" && <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => runAction(r, "move-inside")}><LogIn className="h-3.5 w-3.5" /> Move Inside</Button>}
                      {r.status === "Inside Factory" && <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => runAction(r, "start-loading")}><PlayCircle className="h-3.5 w-3.5" /> Start Loading</Button>}
                      {r.status === "Loading" && <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => runAction(r, "complete")}><CheckCircle2 className="h-3.5 w-3.5" /> Complete</Button>}
                      {r.status === "Completed" && <Button size="sm" onClick={() => setExitRow(r)}><LogOut className="h-3.5 w-3.5" /> Exit</Button>}
                      {r.status === "Exited" && <Badge tone="success"><ShieldCheck className="h-3 w-3" /> Exited</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading gate entries…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : "No gate entries yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {exitRow && <GateExitModal row={exitRow} onClose={() => setExitRow(null)} onSaved={(warning) => { setExitRow(null); load(); if (warning) toast.warning(warning); else toast.success("Vehicle exited."); }} />}
    </div>
  );
}

export function GateExitModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: (warning: string | null) => void }) {
  const toast = useToast();
  const [securityOfficer, setSecurityOfficer] = useState("");
  const [sealVerified, setSealVerified] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/transport/gate-exit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateEntryId: row.id, securityOfficer: securityOfficer || null, sealVerified, remarks: remarks || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.ok) onSaved(j.warning ?? null);
      else toast.error(j.message || "Could not record the gate exit.");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><LogOut className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-foreground">Gate Exit</h2><p className="text-2xs text-muted">{row.gateEntryNo} — {row.vehicleNo}</p></div></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3.5 p-5">
          <Field label="Security Officer"><input value={securityOfficer} onChange={(e) => setSecurityOfficer(e.target.value)} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></Field>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground"><input type="checkbox" checked={sealVerified} onChange={(e) => setSealVerified(e.target.checked)} className="h-4 w-4 rounded border-border-strong" /> Seal verified</label>
          <Field label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={save} disabled={saving}>{saving ? "Recording…" : "Record Exit"}</Button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span>{children}</label>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "primary" | "neutral" | "info" | "warning" }) {
  const TONES = { primary: "bg-primary text-white", neutral: "bg-surface-2 text-muted", info: "bg-info text-white", warning: "bg-warning text-white" } as const;
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Truck className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
