"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Gauge as GaugeIcon } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { Gauge } from "@/components/dashboard/charts";
import { type AchievementResult } from "@/lib/contracts/salesTarget";
import { fetchJson, TrafficBadge, useValueFmt, BAND_COLOR } from "./shared";
import { Head } from "./TargetApproval";

interface TRow { id: number; targetNo: string; fy: string; dimension: string; targetType: string }

export function TargetAchievement() {
  const params = useSearchParams();
  const vfmt = useValueFmt();
  const [targets, setTargets] = useState<TRow[]>([]);
  const [id, setId] = useState<number | null>(null);
  const [ach, setAch] = useState<AchievementResult | null>(null);

  useEffect(() => {
    fetchJson<{ ok: boolean; rows: TRow[] }>("/api/sales/target?status=Approved").then((j) => {
      const approved = j.ok ? j.rows : [];
      fetchJson<{ ok: boolean; rows: TRow[] }>("/api/sales/target?status=Locked").then((k) => {
        const all = [...approved, ...(k.ok ? k.rows : [])];
        setTargets(all);
        const qid = Number(params.get("id")) || all[0]?.id || null;
        setId(qid);
      });
    });
  }, [params]);
  useEffect(() => { if (!id) return; setAch(null); fetchJson<{ ok: boolean; achievement: AchievementResult }>(`/api/sales/target/${id}/achievement`).then((j) => j.ok && setAch(j.achievement)); }, [id]);

  const cur = targets.find((t) => t.id === id);
  return (
    <div className="space-y-4">
      <Head icon={GaugeIcon} title="Target Achievement" sub="Live target-vs-actual from sales invoices — traffic lights, run-rate & forecast." />
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <span className="text-2xs font-semibold uppercase text-muted">Target</span>
        <select value={id ?? ""} onChange={(e) => setId(Number(e.target.value))} className="h-8 min-w-[18rem] rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none">
          {targets.length === 0 && <option value="">No approved targets</option>}
          {targets.map((t) => <option key={t.id} value={t.id}>{t.targetNo} · {t.fy} · {t.dimension}/{t.targetType}</option>)}
        </select>
      </div>

      {targets.length === 0 ? <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">Approve a target to see achievement.</div>
        : !ach || !cur ? <div className="p-10"><AppLoader label="Computing achievement…" /></div> : (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4 shadow-sm">
              <Gauge score={Math.min(100, Math.round(ach.achievementPct))} size={110} />
              <div className="mt-1"><TrafficBadge band={ach.band} pct={ach.achievementPct} /></div>
            </div>
            <Kpi label="Total Target" value={vfmt(ach.totalTarget, cur.targetType)} />
            <Kpi label="Actual (to date)" value={vfmt(ach.totalActual, cur.targetType)} />
            <Kpi label="Time Elapsed" value={`${ach.timePct}%`} sub={`${ach.daysElapsed}/${ach.daysTotal} days`} />
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-primary-subtle/40 px-4 py-2 text-sm font-bold text-primary">Dimension-wise Achievement</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2/40 text-left text-2xs font-semibold uppercase tracking-wide text-muted"><th className="px-3 py-2">Dimension</th><th className="px-3 py-2">Progress</th><th className="px-3 py-2 text-right">Target</th><th className="px-3 py-2 text-right">Actual</th><th className="px-3 py-2 text-center">Achv</th><th className="px-3 py-2 text-right">Remaining</th><th className="px-3 py-2 text-right">Req/day</th><th className="px-3 py-2 text-right">Forecast</th></tr></thead>
                <tbody>
                  {ach.lines.map((l) => (
                    <tr key={l.lineId} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground">{l.label}{!l.computable && <span className="ml-1 text-2xs text-warning">(plan-only)</span>}</td>
                      <td className="px-3 py-2"><div className="h-2 w-32 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${BAND_COLOR[l.band]}`} style={{ width: `${Math.min(100, l.achievementPct)}%` }} /></div></td>
                      <td className="px-3 py-2 text-right tabular-nums">{vfmt(l.target, cur.targetType)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{vfmt(l.actual, cur.targetType)}</td>
                      <td className="px-3 py-2 text-center"><TrafficBadge band={l.band} pct={l.achievementPct} /></td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{vfmt(l.remaining, cur.targetType)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{l.requiredDaily ? vfmt(l.requiredDaily, cur.targetType) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{vfmt(l.forecast, cur.targetType)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: string }) => <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</div><div className="mt-1 text-lg font-bold tabular-nums text-foreground">{value}</div>{sub && <div className="text-2xs text-subtle">{sub}</div>}</div>;
