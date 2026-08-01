"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { GateExitModal } from "@/components/transport/VehicleGateEntryScreen";

interface Row {
  id: number; gateExitNo: string; gateEntryId: number; vehicleId: number;
  exitTime: string | null; securityOfficer: string | null; sealVerified: boolean; remarks: string | null; createdAt: string;
}
interface GateRow { id: number; gateEntryNo: string; vehicleNo: string; status: string }

export function GateExitScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [gateEntries, setGateEntries] = useState<GateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [exitTarget, setExitTarget] = useState<GateRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ge1, ge2] = await Promise.all([
        fetch("/api/transport/gate-exit", { cache: "no-store" }),
        fetch("/api/transport/gate-entry", { cache: "no-store" }),
      ]);
      if (ge1.status === 401 || ge2.status === 401) { setNotAuthed(true); return; }
      const [j1, j2] = await Promise.all([ge1.json().catch(() => ({})), ge2.json().catch(() => ({}))]);
      if (j1.ok) { setNotAuthed(false); setRows(j1.rows); }
      if (j2.ok) setGateEntries(j2.rows);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const gateMap = useMemo(() => new Map(gateEntries.map((g) => [g.id, g])), [gateEntries]);
  const readyToExit = useMemo(() => gateEntries.filter((g) => g.status === "Completed"), [gateEntries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Gate Exit</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><LogOut className="h-5 w-5 text-primary" /> Gate Exit</h1>
          <p className="mt-0.5 text-sm text-muted">Final step — verifies loading/weighment prerequisites, records the exit and completes the linked dispatch.</p>
        </div>
      </div>

      {readyToExit.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">Ready to exit</p>
          <div className="flex flex-wrap gap-2">
            {readyToExit.map((g) => (
              <button key={g.id} onClick={() => setExitTarget(g)} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary">
                {g.gateEntryNo} — {g.vehicleNo} <LogOut className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Gate Exit No</th>
                <th className="px-4 py-3">Gate Entry</th>
                <th className="px-4 py-3">Exit Time</th>
                <th className="px-4 py-3">Security Officer</th>
                <th className="px-4 py-3 text-center">Seal Verified</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const g = gateMap.get(r.gateEntryId);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{r.gateExitNo}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{g ? `${g.gateEntryNo} — ${g.vehicleNo}` : `#${r.gateEntryId}`}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.exitTime ? new Date(r.exitTime).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.securityOfficer ?? "—"}</td>
                    <td className="px-4 py-3 text-center">{r.sealVerified ? <Badge tone="success"><ShieldCheck className="h-3 w-3" /> Verified</Badge> : <Badge tone="warning">Not Verified</Badge>}</td>
                  </tr>
                );
              })}
              {loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8"><AppLoader label="Loading gate exits…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : "No gate exits recorded yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {exitTarget && (
        <GateExitModal
          row={{ id: exitTarget.id, gateEntryNo: exitTarget.gateEntryNo, vehicleId: 0, vehicleNo: exitTarget.vehicleNo, driverId: null, driverName: null, transportCompanyId: null, transportCompanyName: null, dispatchPlanningId: null, dispatchExecutionId: null, dispatchType: null, referenceNo: null, arrivalTime: null, securityOfficer: null, remarks: null, status: "Completed", createdAt: "" }}
          onClose={() => setExitTarget(null)}
          onSaved={(warning) => { setExitTarget(null); load(); if (warning) toast.warning(warning); else toast.success("Vehicle exited."); }}
        />
      )}
    </div>
  );
}
