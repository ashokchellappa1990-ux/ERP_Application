"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { SectionCard } from "@/components/ui/SectionCard";
import { SummaryView } from "@/components/operations/SummaryView";
import type { LiveSummary } from "@/lib/contracts/eod";
import type { DayClosingRow } from "@/lib/contracts/eodClose";

const ENDPOINT = "/api/operations/day-close/day-close";

export function DayClosingTab({ terminalId = "" }: { terminalId?: string }) {
  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [rows, setRows] = useState<DayClosingRow[]>([]);
  const [closedToday, setClosedToday] = useState(false);
  const [date, setDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setMsg(null);
    const q = terminalId ? `?terminalId=${terminalId}` : "";
    const j = await fetch(`${ENDPOINT}${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setSummary(j.summary ?? null); setRows(j.rows ?? []); setClosedToday(!!j.closedToday); setDate(j.date ?? ""); }
    setLoading(false);
  }, [terminalId]);
  useEffect(() => { load(); }, [load]);

  const close = useCallback(async (force: boolean) => {
    setClosing(true); setMsg(null);
    const j = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) }).then((r) => r.json()).catch(() => ({ ok: false, message: "Network error." }));
    setClosing(false);
    if (j.ok) { setMsg(`Business day closed — ${j.dayClosingNo}.`); await load(); return; }
    if (j.needsShiftClose) { if (window.confirm(`${j.message ?? "Open sessions remain."}\n\nForce-close the business day anyway?`)) await close(true); return; }
    setMsg(j.message ?? "Could not close the business day.");
  }, [load]);

  if (loading) return <div className="py-12"><AppLoader label="Aggregating the business day…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-2.5">
        <p className="text-sm text-muted">Business day <span className="font-semibold text-foreground">{date || "—"}</span> · branch level
          {closedToday && <span className="ml-2 inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Closed</span>}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          <Button size="sm" disabled={closedToday || closing} onClick={() => close(false)}><Lock className="h-4 w-4" /> {closing ? "Closing…" : closedToday ? "Day Closed" : "Close Business Day"}</Button>
        </div>
      </div>

      {msg && <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">{msg}</p>}

      {summary ? <SummaryView data={summary} /> : <div className="py-6 text-center text-sm text-muted">No summary available.</div>}

      <SectionCard title="Recent Closings">
        {rows.length === 0 ? <p className="py-4 text-center text-sm text-muted">No business days closed yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-2xs uppercase tracking-wide text-subtle"><th className="py-2 pr-3">Closing No</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Closed At</th><th className="py-2 pr-3">Status</th><th className="py-2">Remarks</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-semibold text-foreground">{r.dayClosingNo}</td>
                    <td className="py-2 pr-3">{r.closingDate}</td>
                    <td className="py-2 pr-3 text-subtle">{new Date(r.closedAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">{r.status}</td>
                    <td className="py-2 text-subtle">{r.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
