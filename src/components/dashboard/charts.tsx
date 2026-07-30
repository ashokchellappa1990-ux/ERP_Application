"use client";

/**
 * Dependency-free SVG chart primitives for the enterprise dashboard.
 * Mirrors the approach used in Customer360Dashboard — no Recharts/Chart.js, so
 * the bundle stays lean and everything themes off CSS variables.
 */
import { cn } from "@/lib/cn";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#84cc16", "#ec4899"];

export interface NameVal { name: string; value: number }

export function EmptyChart({ msg = "No data yet." }: { msg?: string }) {
  return <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-1 py-6 text-center text-xs text-subtle">{msg}</div>;
}

export function Bars({ items, fmt, tone = "primary" }: { items: NameVal[]; fmt: (n: number) => string; tone?: "primary" | "success" | "accent" | "danger" }) {
  if (!items.length) return <EmptyChart />;
  const max = Math.max(...items.map((i) => i.value), 1);
  const bar = { primary: "bg-primary", success: "bg-success", accent: "bg-accent", danger: "bg-danger" }[tone];
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between text-2xs"><span className="truncate pr-2 text-muted">{it.name}</span><span className="shrink-0 font-semibold text-foreground">{fmt(it.value)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ items, fmt }: { items: NameVal[]; fmt: (n: number) => string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <EmptyChart />;
  let acc = 0; const R = 32, C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 80 80" className="h-28 w-28 shrink-0 -rotate-90">
        {items.map((it, i) => { const frac = it.value / total; const seg = <circle key={i} cx="40" cy="40" r={R} fill="none" stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth="14" strokeDasharray={`${frac * C} ${C}`} strokeDashoffset={-acc * C} />; acc += frac; return seg; })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-2xs"><span className="flex min-w-0 items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="truncate text-muted">{it.name}</span></span><span className="font-semibold text-foreground">{fmt(it.value)}</span></div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ items, fmt }: { items: NameVal[]; fmt: (n: number) => string }) {
  if (items.length < 2) return <Bars items={items} fmt={fmt} />;
  const max = Math.max(...items.map((i) => i.value), 1);
  const W = 600, H = 150, pad = 10;
  const pts = items.map((it, i) => { const x = pad + (i / (items.length - 1)) * (W - 2 * pad); const y = H - pad - (it.value / max) * (H - 2 * pad); return [x, y] as const; });
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `${pad},${H - pad} ${line} ${W - pad},${H - pad}`;
  const step = Math.ceil(items.length / 8);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="h-44 w-full min-w-[420px]">
        <polygon points={area} fill="var(--color-primary, #6366f1)" opacity="0.08" />
        <polyline fill="none" stroke="var(--color-primary, #6366f1)" strokeWidth="2.5" strokeLinejoin="round" points={line} />
        {pts.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="2.5" fill="var(--color-primary, #6366f1)" />
            {i % step === 0 && <text x={x} y={H + 14} textAnchor="middle" className="fill-subtle text-[8px]">{items[i].name}</text>}
          </g>
        ))}
      </svg>
      <div className="mt-1 text-right text-2xs text-muted">Peak <span className="font-semibold text-foreground">{fmt(max)}</span></div>
    </div>
  );
}

/** Grouped two-series bars (e.g. Sales vs Purchase per month). */
export function DualBars({ series, fmt, aLabel, bLabel }: { series: { name: string; a: number; b: number }[]; fmt: (n: number) => string; aLabel: string; bLabel: string }) {
  if (!series.length) return <EmptyChart />;
  const max = Math.max(...series.flatMap((s) => [s.a, s.b]), 1);
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-2xs">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />{aLabel}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" />{bLabel}</span>
      </div>
      <div className="flex h-40 items-end gap-3">
        {series.map((s, i) => (
          <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              <div className="w-1/2 rounded-t bg-primary transition-all hover:opacity-80" style={{ height: `${Math.max(2, (s.a / max) * 100)}%` }} title={`${aLabel}: ${fmt(s.a)}`} />
              <div className="w-1/2 rounded-t bg-accent transition-all hover:opacity-80" style={{ height: `${Math.max(2, (s.b / max) * 100)}%` }} title={`${bLabel}: ${fmt(s.b)}`} />
            </div>
            <span className="text-2xs text-subtle">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Circular gauge for the business-health score. */
export function Gauge({ score, size = 88 }: { score: number; size?: number }) {
  const R = 32, C = 2 * Math.PI * R;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#6366f1" : score >= 30 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" stroke="var(--color-surface-2,#eee)" strokeWidth="8" />
        <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * C} ${C}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none text-current">
        <span className="font-bold" style={{ fontSize: Math.round(size * 0.28), lineHeight: 1 }}>{score}</span>
        <span className="mt-px font-semibold uppercase tracking-wider opacity-80" style={{ fontSize: Math.max(7, Math.round(size * 0.11)), lineHeight: 1 }}>score</span>
      </div>
    </div>
  );
}
