"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/** Dependency-free SVG charts for the Decision Intelligence platform (Module 17). */

export interface FPoint { name: string; value: number; lower?: number; upper?: number; forecast?: boolean }

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const fmtByUnit = (unit: string) => (n: number) => unit === "money" ? money(n) : unit === "percent" ? `${Math.round(n)}%` : Math.round(n).toLocaleString("en-IN");

/** History line + dashed forecast + shaded confidence band. */
export function ForecastChart({ points, unit = "money", height = 150 }: { points: FPoint[]; unit?: string; height?: number }) {
  const gid = useId();
  if (!points.length) return <div className="grid h-32 place-items-center text-2xs text-muted">No data</div>;
  const W = 320, H = height, P = 8;
  const vals = points.flatMap((p) => [p.value, p.lower ?? p.value, p.upper ?? p.value]);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const fmt = fmtByUnit(unit);
  const firstFc = points.findIndex((p) => p.forecast);
  const histPts = points.map((p, i) => `${x(i)},${y(p.value)}`).slice(0, firstFc < 0 ? points.length : firstFc + 1).join(" ");
  const fcPts = firstFc < 0 ? "" : points.map((p, i) => `${x(i)},${y(p.value)}`).slice(firstFc - 1 < 0 ? 0 : firstFc - 1).join(" ");
  const bandPts = points.map((p) => p).filter((p) => p.forecast && p.upper != null);
  const bandTop = bandPts.map((p) => `${x(points.indexOf(p))},${y(p.upper ?? p.value)}`);
  const bandBot = bandPts.map((p) => `${x(points.indexOf(p))},${y(p.lower ?? p.value)}`).reverse();
  const band = bandTop.length ? `${bandTop.join(" ")} ${bandBot.join(" ")}` : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {band && <polygon points={band} fill={`url(#band-${gid})`} opacity={0.25} />}
      <defs><linearGradient id={`band-${gid}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--color-primary,#6366f1)" stopOpacity="0.5" /><stop offset="100%" stopColor="var(--color-primary,#6366f1)" stopOpacity="0.05" /></linearGradient></defs>
      {firstFc >= 0 && <line x1={x(firstFc - 0.5 < 0 ? 0 : firstFc - 0.5)} x2={x(firstFc - 0.5 < 0 ? 0 : firstFc - 0.5)} y1={P} y2={H - P} stroke="var(--color-border,#e5e7eb)" strokeDasharray="3 3" />}
      <polyline points={histPts} fill="none" stroke="var(--color-primary,#6366f1)" strokeWidth="2" />
      {fcPts && <polyline points={fcPts} fill="none" stroke="var(--color-primary,#6366f1)" strokeWidth="2" strokeDasharray="5 4" opacity={0.8} />}
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={p.forecast ? 2.5 : 2} fill={p.forecast ? "#fff" : "var(--color-primary,#6366f1)"} stroke="var(--color-primary,#6366f1)" strokeWidth={p.forecast ? 1.5 : 0} />)}
      <text x={P} y={12} className="fill-current text-[9px] text-muted">{fmt(max)}</text>
      <text x={P} y={H - 2} className="fill-current text-[9px] text-muted">{fmt(min)}</text>
    </svg>
  );
}

export function Sparkline({ values, tone = "primary" }: { values: number[]; tone?: "primary" | "success" | "danger" }) {
  if (values.length < 2) return null;
  const W = 90, H = 26, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i * W) / (values.length - 1)},${H - 2 - ((v - min) / span) * (H - 4)}`).join(" ");
  const color = tone === "success" ? "#22c55e" : tone === "danger" ? "#ef4444" : "var(--color-primary,#6366f1)";
  return <svg viewBox={`0 0 ${W} ${H}`} className="h-6 w-[90px]"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" /></svg>;
}

/** Waterfall — baseline → deltas → result. */
export function Waterfall({ items, unit = "money", height = 160 }: { items: { name: string; value: number; total?: boolean }[]; unit?: string; height?: number }) {
  if (!items.length) return null;
  const fmt = fmtByUnit(unit);
  let run = 0; const bars = items.map((it) => { const start = it.total ? 0 : run; const end = it.total ? it.value : run + it.value; if (!it.total) run += it.value; return { ...it, start, end }; });
  const all = bars.flatMap((b) => [b.start, b.end]); const min = Math.min(0, ...all), max = Math.max(...all), span = max - min || 1;
  const W = 320, H = height, P = 18, bw = (W - 2 * P) / bars.length * 0.6;
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {bars.map((b, i) => { const cx = P + (i + 0.5) * ((W - 2 * P) / bars.length); const top = y(Math.max(b.start, b.end)), bot = y(Math.min(b.start, b.end)); const up = b.total ? "#6366f1" : b.value >= 0 ? "#22c55e" : "#ef4444"; return (
        <g key={i}><rect x={cx - bw / 2} y={top} width={bw} height={Math.max(2, bot - top)} rx={2} fill={up} opacity={b.total ? 1 : 0.85} /><text x={cx} y={H - 5} textAnchor="middle" className="fill-current text-[8px] text-muted">{b.name}</text><text x={cx} y={top - 3} textAnchor="middle" className="fill-current text-[8px] text-foreground">{fmt(b.total ? b.value : b.value)}</text></g>
      ); })}
    </svg>
  );
}

/** Heatmap grid — value intensity per cell. */
export function Heatmap({ rows, unit = "count" }: { rows: { label: string; cells: { name: string; value: number }[] }[]; unit?: string }) {
  if (!rows.length) return null;
  const all = rows.flatMap((r) => r.cells.map((c) => c.value)); const max = Math.max(1, ...all);
  const fmt = fmtByUnit(unit);
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-1">
          <span className="w-20 shrink-0 truncate text-[10px] text-muted">{r.label}</span>
          <div className="flex flex-1 gap-1">{r.cells.map((c) => { const t = c.value / max; return <div key={c.name} title={`${c.name}: ${fmt(c.value)}`} className="h-6 flex-1 rounded" style={{ background: `rgba(99,102,241,${0.12 + t * 0.8})` }} />; })}</div>
        </div>
      ))}
    </div>
  );
}

/** Scenario comparison — baseline vs scenario bars per metric. */
export function ScenarioCompare({ metrics }: { metrics: { label: string; unit: string; baseline: number; scenario: number; better: boolean }[] }) {
  return (
    <div className="space-y-2.5">
      {metrics.map((m) => { const max = Math.max(Math.abs(m.baseline), Math.abs(m.scenario), 1); const fmt = fmtByUnit(m.unit); return (
        <div key={m.label}>
          <div className="mb-0.5 flex items-center justify-between text-2xs"><span className="text-muted">{m.label}</span><span className={cn("font-semibold", m.better ? "text-success" : "text-danger")}>{fmt(m.scenario)}</span></div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5"><span className="w-10 text-[9px] text-subtle">Base</span><div className="h-2 flex-1 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-muted/50" style={{ width: `${(Math.abs(m.baseline) / max) * 100}%` }} /></div></div>
            <div className="flex items-center gap-1.5"><span className="w-10 text-[9px] text-subtle">Scen</span><div className="h-2 flex-1 rounded-full bg-surface-2"><div className={cn("h-2 rounded-full", m.better ? "bg-success" : "bg-danger")} style={{ width: `${(Math.abs(m.scenario) / max) * 100}%` }} /></div></div>
          </div>
        </div>
      ); })}
    </div>
  );
}
