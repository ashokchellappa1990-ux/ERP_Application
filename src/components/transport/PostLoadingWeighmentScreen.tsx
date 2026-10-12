"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Weight, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { WEIGHMENT_COPY, WeighmentTypeToggle, readTypeParam, writeTypeParam, type WeighmentType } from "@/components/transport/weighmentType";

interface Row {
  id: number; gateEntryId: number; weighmentType: WeighmentType; grossWeight: number; tareWeight: number; netWeight: number;
  weighDate: string | null; operator: string | null; toleranceExceeded: boolean; approvalStatus: string;
  remarks: string | null; createdAt: string;
}
interface GateRow { id: number; gateEntryNo: string; vehicleNo: string; status: string; customerName: string | null; supplierName: string | null; grnId: number | null }

// Exit Weighment list — Sales (gross, after loading) / Purchase (tare, after unloading).
export function PostLoadingWeighmentScreen() {
  const router = useRouter();
  // null until mounted — the ?type= param is only readable client-side, and
  // loading "Sales" first would race the real tab's fetch.
  const [typeState, setType] = useState<WeighmentType | null>(null);
  const type = typeState ?? "Sales";
  const [rows, setRows] = useState<Row[]>([]);
  const [gateEntries, setGateEntries] = useState<GateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  useEffect(() => { setType(readTypeParam()); }, []);

  const load = useCallback(async (t: WeighmentType) => {
    setLoading(true);
    try {
      const [pw, ge] = await Promise.all([
        fetch(`/api/transport/post-weighment?type=${t}`, { cache: "no-store" }),
        fetch(`/api/transport/gate-entry?entryType=${WEIGHMENT_COPY[t].entryType}`, { cache: "no-store" }),
      ]);
      if (pw.status === 401 || ge.status === 401) { setNotAuthed(true); return; }
      const [pj, gj] = await Promise.all([pw.json().catch(() => ({})), ge.json().catch(() => ({}))]);
      if (pj.ok) { setNotAuthed(false); setRows(pj.rows); }
      if (gj.ok) setGateEntries(gj.rows);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (typeState) load(typeState); }, [load, typeState]);

  const gateMap = useMemo(() => new Map(gateEntries.map((g) => [g.id, g])), [gateEntries]);
  const copy = WEIGHMENT_COPY[type];
  const isPurchase = type === "Purchase";
  const cols = 8;

  function switchType(t: WeighmentType) { setRows([]); setType(t); writeTypeParam(t); }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Exit Weighment</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Weight className="h-5 w-5 text-primary" /> Exit Weighment</h1>
          <p className="mt-0.5 text-sm text-muted">{isPurchase ? "Purchase: the empty (tare) weight after unloading — net weight is computed against the first-weighment gross." : "Sales: the loaded (gross) weight after loading — net weight is computed against the first-weighment tare."}</p>
        </div>
        <Button size="md" onClick={() => router.push(`/transport/post-weighment/new?type=${type}`)}><Plus className="h-4 w-4" /> New Weighment</Button>
      </div>

      <WeighmentTypeToggle value={type} onChange={switchType} />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Gate Entry</th>
                <th className="px-4 py-3">{copy.party}</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Tare</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Weighed On</th>
                <th className="px-4 py-3 text-center">{isPurchase ? "GRN" : "Tolerance"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const g = gateMap.get(r.gateEntryId);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                    <td className="px-4 py-3 text-2xs text-muted">{g ? `${g.gateEntryNo} — ${g.vehicleNo}` : `#${r.gateEntryId}`}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{(isPurchase ? g?.supplierName : g?.customerName) ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{r.grossWeight.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{r.tareWeight.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{r.netWeight.toLocaleString()}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.operator ?? "—"}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.weighDate ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {isPurchase
                        ? (g?.grnId ? <Link href={`/purchase/grn/${g.grnId}`} className="text-2xs font-semibold text-primary hover:underline">View GRN</Link> : <Badge tone="warning">GRN Pending</Badge>)
                        : (r.toleranceExceeded ? <Badge tone="danger">Exceeded ({r.approvalStatus})</Badge> : <Badge tone="success">OK</Badge>)}
                    </td>
                  </tr>
                );
              })}
              {loading && rows.length === 0 && <tr><td colSpan={cols} className="px-4 py-8"><AppLoader label="Loading weighments…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : `No ${type.toLowerCase()} exit weighments yet.`}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
