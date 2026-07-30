/**
 * FORECASTING LIBRARY (Phase 5) — deterministic, dependency-free time-series prediction.
 * Given a historical series it projects future points with a confidence band. Three
 * methods (linear least-squares trend, moving average, seasonal index × trend) plus an
 * "auto" selector. No external ML; works fully offline. Claude only NARRATES the result.
 */

export type ForecastMethod = "linear" | "moving" | "seasonal" | "auto";
export interface SeriesPoint { name: string; value: number }
export interface ForecastPoint { name: string; value: number; lower: number; upper: number; forecast: boolean }
export interface ForecastResult {
  method: ForecastMethod;
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  all: ForecastPoint[];
  nextValue: number; // first forecast point
  horizonValue: number; // last forecast point
  slope: number; // per-period change
  trendPct: number; // % change history-end → forecast-end
  confidence: number; // 0-100
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
function stddev(a: number[]): number { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); }

/** Least-squares linear fit → { slope, intercept }. x = 0..n-1. */
function linfit(y: number[]): { slope: number; intercept: number } {
  const n = y.length; if (n < 2) return { slope: 0, intercept: y[0] ?? 0 };
  const xm = (n - 1) / 2; const ym = mean(y);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - xm) * (y[i] - ym); den += (i - xm) ** 2; }
  const slope = den ? num / den : 0;
  return { slope, intercept: ym - slope * xm };
}

/** Residual standard deviation of a linear fit (drives the confidence band width). */
function residualStd(y: number[], slope: number, intercept: number): number {
  const res = y.map((v, i) => v - (intercept + slope * i));
  return stddev(res);
}

const labelFuture = (i: number) => `+${i}`;

/**
 * Forecast `horizon` future periods from a historical series.
 * `method:"auto"` uses seasonal when ≥ 2 full seasons of history, else linear.
 */
export function forecastSeries(series: SeriesPoint[], opts?: { horizon?: number; method?: ForecastMethod; seasonLen?: number }): ForecastResult {
  const horizon = Math.max(1, opts?.horizon ?? 3);
  const seasonLen = opts?.seasonLen ?? 12;
  const y = series.map((p) => Number(p.value) || 0);
  const n = y.length;
  let method: ForecastMethod = opts?.method ?? "auto";
  if (method === "auto") method = n >= seasonLen * 2 ? "seasonal" : "linear";
  if (n < 2) method = "linear";

  const { slope, intercept } = linfit(y);
  const resStd = residualStd(y, slope, intercept) || Math.abs(mean(y)) * 0.08 || 1;
  const nonNeg = y.every((v) => v >= 0);

  // Seasonal indices (multiplicative) when we have enough history.
  let seasonalIdx: number[] | null = null;
  if (method === "seasonal" && n >= seasonLen) {
    const gm = mean(y) || 1;
    const idx: number[] = new Array(seasonLen).fill(0);
    const cnt: number[] = new Array(seasonLen).fill(0);
    for (let i = 0; i < n; i++) { const s = i % seasonLen; idx[s] += y[i] / gm; cnt[s]++; }
    seasonalIdx = idx.map((v, s) => (cnt[s] ? v / cnt[s] : 1));
  }

  const project = (i: number): number => {
    if (method === "moving") { const w = Math.min(3, n); return mean(y.slice(n - w)); }
    let base = intercept + slope * i; // linear trend at absolute index i
    if (seasonalIdx) { const deTrendMean = mean(y) || 1; base = (intercept + slope * i); const factor = seasonalIdx[i % seasonLen] ?? 1; base = base * 1 * factor / (mean(seasonalIdx) || 1); }
    return base;
  };

  const history: ForecastPoint[] = series.map((p, i) => ({ name: p.name, value: r2(y[i]), lower: r2(y[i]), upper: r2(y[i]), forecast: false }));
  const forecast: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const i = n - 1 + h;
    let v = project(i);
    if (nonNeg) v = Math.max(0, v);
    const band = resStd * Math.sqrt(h) * 1.28; // ~80% band, widening with horizon
    forecast.push({ name: labelFuture(h), value: r2(v), lower: r2(Math.max(nonNeg ? 0 : -Infinity, v - band)), upper: r2(v + band), forecast: true });
  }

  const last = y[n - 1] ?? 0;
  const horizonValue = forecast[forecast.length - 1]?.value ?? last;
  const trendPct = last !== 0 ? r2(((horizonValue - last) / Math.abs(last)) * 100) : 0;
  // Confidence: high when residuals small relative to level and enough history.
  const level = Math.abs(mean(y)) || 1;
  const noise = resStd / level; // coefficient of variation of residuals
  let confidence = clamp(Math.round(100 - noise * 120 - Math.max(0, 6 - n) * 6), 25, 96);
  if (method === "seasonal") confidence = clamp(confidence + 4, 25, 97);

  return { method, history, forecast, all: [...history, ...forecast], nextValue: forecast[0]?.value ?? last, horizonValue, slope: r2(slope), trendPct, confidence };
}

/** Scale a monthly forecast to an arbitrary day-horizon (for 7/30/90/180/365-day views). */
export function scaleToHorizon(monthlyNext: number, horizonDays: number): number {
  return r2((monthlyNext / 30) * horizonDays);
}
