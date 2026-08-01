"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Scale, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";

interface Row {
  id: number; weighmentNo: string; gateEntryId: number; vehicleId: number; tareWeight: number;
  weighDate: string | null; weighTime: string | null; operator: string | null;
  weighbridgeId: number | null; photoUrl: string | null; remarks: string | null; createdAt: string;
}
interface GateRow { id: number; gateEntryNo: string; vehicleNo: string; status: string }

export function PreLoadingWeighmentScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [gateEntries, setGateEntries] = useState<GateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wt, ge] = await Promise.all([
        fetch("/api/transport/pre-weighment", { cache: "no-store" }),
        fetch("/api/transport/gate-entry", { cache: "no-store" }),
      ]);
      if (wt.status === 401 || ge.status === 401) { setNotAuthed(true); return; }
      const [wj, gj] = await Promise.all([wt.json().catch(() => ({})), ge.json().catch(() => ({}))]);
      if (wj.ok) { setNotAuthed(false); setRows(wj.rows); }
      if (gj.ok) setGateEntries(gj.rows);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const gateMap = useMemo(() => new Map(gateEntries.map((g) => [g.id, g])), [gateEntries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Pre Loading Weighment</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Scale className="h-5 w-5 text-primary" /> Pre Loading Weighment</h1>
          <p className="mt-0.5 text-sm text-muted">Records the empty (tare) weight of a vehicle before loading begins.</p>
        </div>
        <Button size="md" onClick={() => router.push("/transport/pre-weighment/new")}><Plus className="h-4 w-4" /> New Weighment</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Weighment No</th>
                <th className="px-4 py-3">Gate Entry</th>
                <th className="px-4 py-3 text-right">Tare Weight</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Weighed On</th>
                <th className="px-4 py-3 text-center">Gate Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const g = gateMap.get(r.gateEntryId);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{r.weighmentNo}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{g ? `${g.gateEntryNo} — ${g.vehicleNo}` : `#${r.gateEntryId}`}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{r.tareWeight.toLocaleString()}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.operator ?? "—"}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.weighDate ?? "—"} {r.weighTime ?? ""}</td>
                    <td className="px-4 py-3 text-center">{g && <Badge tone="neutral">{g.status}</Badge>}</td>
                  </tr>
                );
              })}
              {loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8"><AppLoader label="Loading weighments…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : "No pre-loading weighments yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
