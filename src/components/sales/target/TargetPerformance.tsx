"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Sparkles } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { Badge } from "@/components/ui/Badge";
import { fetchJson, useOptions, TrafficBadge, useValueFmt } from "./shared";
import { Head } from "./TargetApproval";
import { trafficLight, type TrafficBand } from "@/lib/contracts/salesTarget";

interface PerfRow { subjectType: string; subjectLabel: string; target: number; actual: number; achievementPct: number; band: string; achievementScore: number; growthScore: number; profitScore: number; consistencyScore: number; completionScore: number; overallScore: number }
interface Insight { key: string; severity: string; title: string; detail: string; metric?: string; href?: string }

export function TargetPerformance() {
  const opt = useOptions();
  const vfmt = useValueFmt();
  const [fy, setFy] = useState("");
  const [rows, setRows] = useState<PerfRow[] | null>(null);
  const [insights, setInsights] = useState<Insight[] | null>(null);

  useEffect(() => { if (opt && !fy) setFy(opt.fyList[1] ?? opt.fyList[0] ?? ""); }, [opt, fy]);
  useEffect(() => {
    if (!fy) return; setRows(null); setInsights(null);
    fetchJson<{ ok: boolean; rows: PerfRow[] }>(`/api/sales/target/performance?fy=${encodeURIComponent(fy)}`).then((j) => setRows(j.ok ? j.rows : []));
    fetchJson<{ ok: boolean; insights: Insight[] }>(`/api/sales/target/ai?fy=${encodeURIComponent(fy)}`).then((j) => setInsights(j.ok ? j.insights : []));
  }, [fy]);

  return (
    <div className="space-y-4">
      <Head icon={BarChart3} title="Performance Analysis" sub="Target-vs-actual, performance scores, rankings & AI insights across dimensions." />
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <span className="text-2xs font-semibold uppercase text-muted">Financial Year</span>
        <select value={fy} onChange={(e) => setFy(e.target.value)} className="h-8 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none">{opt?.fyList.map((f) => <option key={f}>{f}</option>)}</select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-primary-subtle/40 px-4 py-2 text-sm font-bold text-primary">Performance Ranking &amp; Scores</div>
        {!rows ? <div className="p-8"><AppLoader label="Scoring performance…" size="sm" /></div> : rows.length === 0 ? <p className="p-8 text-center text-sm text-muted">No approved targets for {fy}.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2/40 text-left text-2xs font-semibold uppercase tracking-wide text-muted"><th className="px-3 py-2">#</th><th className="px-3 py-2">Subject</th><th className="px-3 py-2 text-right">Target</th><th className="px-3 py-2 text-right">Actual</th><th className="px-3 py-2 text-center">Achv</th><th className="px-3 py-2 text-center">Achieve</th><th className="px-3 py-2 text-center">Growth</th><th className="px-3 py-2 text-center">Profit</th><th className="px-3 py-2 text-center">Consist.</th><th className="px-3 py-2 text-center">Overall</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.subjectLabel + i} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 text-2xs font-bold text-subtle">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-foreground capitalize">{r.subjectLabel} <span className="text-2xs text-subtle">({r.subjectType})</span></td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{vfmt(r.target, "salesValue")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">{vfmt(r.actual, "salesValue")}</td>
                    <td className="px-3 py-2 text-center"><TrafficBadge band={r.band as TrafficBand} pct={r.achievementPct} /></td>
                    <Score n={r.achievementScore} /><Score n={r.growthScore} /><Score n={r.profitScore} /><Score n={r.consistencyScore} />
                    <td className="px-3 py-2 text-center"><span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">{r.overallScore}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-border bg-primary-subtle/40 px-4 py-2 text-sm font-bold text-primary"><Sparkles className="h-4 w-4" /> AI Sales Intelligence</div>
        <div className="p-4">
          {!insights ? <AppLoader label="Generating insights…" size="sm" /> : insights.length === 0 ? <p className="py-4 text-center text-sm text-muted">No insights.</p> : (
            <div className="space-y-2">{insights.map((i) => (
              <div key={i.key} className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/30 px-3 py-2 text-sm">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${i.severity === "critical" || i.severity === "high" ? "bg-danger" : i.severity === "medium" ? "bg-warning" : "bg-info"}`} />
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-semibold text-foreground">{i.title}</span>{i.metric && <Badge tone={i.severity === "critical" || i.severity === "high" ? "danger" : i.severity === "medium" ? "warning" : "info"}>{i.metric}</Badge>}</div><p className="text-2xs text-muted">{i.detail}</p></div>
                {i.href && <Link href={i.href} className="shrink-0 text-2xs font-semibold text-primary hover:underline">Open</Link>}
              </div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}
function Score({ n }: { n: number }) { const b = trafficLight(n).band; return <td className="px-3 py-2 text-center"><span className={`text-2xs font-bold ${b === "green" ? "text-success" : b === "blue" ? "text-info" : b === "yellow" ? "text-warning" : b === "orange" ? "text-accent" : "text-danger"}`}>{n}</span></td>; }
