"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Scale, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
<<<<<<< HEAD
import { WEIGHMENT_COPY, WeighmentTypeToggle, readTypeParam, writeTypeParam, type WeighmentType } from "@/components/transport/weighmentType";

interface Row {
  id: number; weighmentNo: string; gateEntryId: number; vehicleId: number; weighmentType: WeighmentType;
  tareWeight: number; grossWeight: number | null;
  weighDate: string | null; weighTime: string | null; operator: string | null;
  weighbridgeId: number | null; photoUrl: string | null; remarks: string | null; createdAt: string;
}
interface GateRow { id: number; gateEntryNo: string; vehicleNo: string; status: string; customerName: string | null; supplierName: string | null }

// Entry Weighment list — Sales (tare, before loading) / Purchase (gross, before unloading).
export function PreLoadingWeighmentScreen() {
  const router = useRouter();
  // null until mounted — the ?type= param is only readable client-side, and
  // loading "Sales" first would race the real tab's fetch.
  const [typeState, setType] = useState<WeighmentType | null>(null);
  const type = typeState ?? "Sales";
=======

interface Row {
  id: number; weighmentNo: string; gateEntryId: number; vehicleId: number; tareWeight: number;
  weighDate: string | null; weighTime: string | null; operator: string | null;
  weighbridgeId: number | null; photoUrl: string | null; remarks: string | null; createdAt: string;
}
interface GateRow { id: number; gateEntryNo: string; vehicleNo: string; status: string }

export function PreLoadingWeighmentScreen() {
  const router = useRouter();
>>>>>>> origin/main
  const [rows, setRows] = useState<Row[]>([]);
  const [gateEntries, setGateEntries] = useState<GateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

<<<<<<< HEAD
  useEffect(() => { setType(readTypeParam()); }, []);

  const load = useCallback(async (t: WeighmentType) => {
    setLoading(true);
    try {
      const [wt, ge] = await Promise.all([
        fetch(`/api/transport/pre-weighment?type=${t}`, { cache: "no-store" }),
        fetch(`/api/transport/gate-entry?entryType=${WEIGHMENT_COPY[t].entryType}`, { cache: "no-store" }),
=======
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wt, ge] = await Promise.all([
        fetch("/api/transport/pre-weighment", { cache: "no-store" }),
        fetch("/api/transport/gate-entry", { cache: "no-store" }),
>>>>>>> origin/main
      ]);
      if (wt.status === 401 || ge.status === 401) { setNotAuthed(true); return; }
      const [wj, gj] = await Promise.all([wt.json().catch(() => ({})), ge.json().catch(() => ({}))]);
      if (wj.ok) { setNotAuthed(false); setRows(wj.rows); }
      if (gj.ok) setGateEntries(gj.rows);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

<<<<<<< HEAD
  useEffect(() => { if (typeState) load(typeState); }, [load, typeState]);

  const gateMap = useMemo(() => new Map(gateEntries.map((g) => [g.id, g])), [gateEntries]);
  const copy = WEIGHMENT_COPY[type];
  const isPurchase = type === "Purchase";
  const listHref = `/transport/pre-weighment${isPurchase ? "?type=Purchase" : ""}`;

  function switchType(t: WeighmentType) { setRows([]); setType(t); writeTypeParam(t); }
=======
  useEffect(() => { load(); }, [load]);

  const gateMap = useMemo(() => new Map(gateEntries.map((g) => [g.id, g])), [gateEntries]);
>>>>>>> origin/main

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
<<<<<<< HEAD
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Entry Weighment</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Scale className="h-5 w-5 text-primary" /> Entry Weighment</h1>
          <p className="mt-0.5 text-sm text-muted">{isPurchase ? "Purchase: the loaded (gross) weight of a vehicle arriving with material, before unloading." : "Sales: the empty (tare) weight of a vehicle before loading begins."}</p>
        </div>
        <Button size="md" onClick={() => router.push(`/transport/pre-weighment/new?type=${type}`)}><Plus className="h-4 w-4" /> New Weighment</Button>
      </div>

      <WeighmentTypeToggle value={type} onChange={switchType} />

=======
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Pre Loading Weighment</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Scale className="h-5 w-5 text-primary" /> Pre Loading Weighment</h1>
          <p className="mt-0.5 text-sm text-muted">Records the empty (tare) weight of a vehicle before loading begins.</p>
        </div>
        <Button size="md" onClick={() => router.push("/transport/pre-weighment/new")}><Plus className="h-4 w-4" /> New Weighment</Button>
      </div>

>>>>>>> origin/main
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Weighment No</th>
                <th className="px-4 py-3">Gate Entry</th>
<<<<<<< HEAD
                <th className="px-4 py-3">{copy.party}</th>
                <th className="px-4 py-3 text-right">{copy.first.weight} Weight</th>
=======
                <th className="px-4 py-3 text-right">Tare Weight</th>
>>>>>>> origin/main
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Weighed On</th>
                <th className="px-4 py-3 text-center">Gate Status</th>
                <th className="px-4 py-3 text-right">Token</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const g = gateMap.get(r.gateEntryId);
<<<<<<< HEAD
                const weight = isPurchase ? (r.grossWeight ?? 0) : r.tareWeight;
=======
>>>>>>> origin/main
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{r.weighmentNo}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{g ? `${g.gateEntryNo} — ${g.vehicleNo}` : `#${r.gateEntryId}`}</td>
<<<<<<< HEAD
                    <td className="px-4 py-3 text-2xs text-muted">{(isPurchase ? g?.supplierName : g?.customerName) ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{weight.toLocaleString()}</td>
=======
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{r.tareWeight.toLocaleString()}</td>
>>>>>>> origin/main
                    <td className="px-4 py-3 text-2xs text-muted">{r.operator ?? "—"}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{r.weighDate ?? "—"} {r.weighTime ?? ""}</td>
                    <td className="px-4 py-3 text-center">{g && <Badge tone="neutral">{g.status}</Badge>}</td>
                    <td className="px-4 py-3 text-right">
<<<<<<< HEAD
                      <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => router.push(`/transport/pre-weighment/token?id=${r.id}&next=${encodeURIComponent(listHref)}`)}>
=======
                      <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => router.push(`/transport/pre-weighment/token?id=${r.id}&next=${encodeURIComponent("/transport/pre-weighment")}`)}>
>>>>>>> origin/main
                        <Printer className="h-3.5 w-3.5" /> Preview &amp; Print
                      </Button>
                    </td>
                  </tr>
                );
              })}
<<<<<<< HEAD
              {loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8"><AppLoader label="Loading weighments…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : `No ${type.toLowerCase()} entry weighments yet.`}</td></tr>}
=======
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading weighments…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : "No pre-loading weighments yet."}</td></tr>}
>>>>>>> origin/main
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
