import type { ActiveScope } from "@/lib/auth/scope";
import { currentYm, recentMonths } from "@/lib/ai/bi/period";
import { fmtUnit } from "@/lib/ai/bi/metrics";
import { decisionMetric, metricsForModule, metricHistory, type DecisionMetric, type DecisionModule } from "./catalog";
import { forecastSeries, type ForecastMethod, type ForecastPoint } from "./forecast";
import { explainPrediction, type Explanation } from "./explain";

/**
 * PREDICTION ENGINE — turns any decision metric into a forecast with confidence, risk,
 * trend, an explainable-AI block and a chart-ready series (history + forecast band).
 */

export interface Prediction {
  metric: string; label: string; module: DecisionModule; unit: "money" | "count" | "percent";
  goodDirection: "up" | "down" | "neutral";
  current: number; forecastValue: number; horizonDays: number; method: ForecastMethod;
  confidence: number; trendPct: number; riskScore: number;
  formattedCurrent: string; formattedForecast: string;
  series: ForecastPoint[]; explain: Explanation;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function riskOf(metric: DecisionMetric, trendPct: number, confidence: number): number {
  const adverse = (metric.goodDirection === "up" && trendPct < 0) || (metric.goodDirection === "down" && trendPct > 0);
  if (adverse) return clamp(Math.round(Math.min(80, Math.abs(trendPct) * 1.5) + (100 - confidence) * 0.2), 5, 100);
  return clamp(Math.round((100 - confidence) * 0.25 + Math.max(0, Math.abs(trendPct) - 25) * 0.3), 0, 100);
}

export async function predictMetric(scope: ActiveScope, metricKey: string, opts?: { horizonDays?: number; method?: ForecastMethod; period?: string; months?: number }): Promise<Prediction | null> {
  const metric = decisionMetric(metricKey);
  if (!metric) return null;
  const horizonDays = opts?.horizonDays ?? 30;
  const period = opts?.period ?? currentYm();
  const months = recentMonths(period, opts?.months ?? 12);
  const history = await metricHistory(metric, scope, months);
  const horizonMonths = Math.max(1, Math.round(horizonDays / 30));
  const chartHorizon = Math.max(3, horizonMonths);
  const fc = forecastSeries(history, { horizon: chartHorizon, method: opts?.method ?? "auto" });

  const last = history[history.length - 1]?.value ?? 0;
  // Flow metrics accumulate over the horizon; balance (asOf) metrics take the level then.
  let forecastValue: number;
  if (metric.asOf) forecastValue = fc.forecast[Math.min(horizonMonths, fc.forecast.length) - 1]?.value ?? fc.nextValue;
  else forecastValue = r2(fc.forecast.slice(0, horizonMonths).reduce((s, p) => s + p.value, 0));

  const riskScore = riskOf(metric, fc.trendPct, fc.confidence);
  const explain = explainPrediction(metric, history, fc, horizonDays);

  return {
    metric: metric.key, label: metric.label, module: metric.module, unit: metric.unit, goodDirection: metric.goodDirection,
    current: last, forecastValue, horizonDays, method: fc.method, confidence: fc.confidence, trendPct: fc.trendPct, riskScore,
    formattedCurrent: fmtUnit(metric.unit, last), formattedForecast: fmtUnit(metric.unit, forecastValue),
    series: fc.all, explain,
  };
}

export async function predictModule(scope: ActiveScope, module: DecisionModule, opts?: { horizonDays?: number; method?: ForecastMethod; period?: string }): Promise<Prediction[]> {
  const metrics = metricsForModule(module);
  const out = await Promise.all(metrics.map((m) => predictMetric(scope, m.key, opts).catch(() => null)));
  return out.filter((p): p is Prediction => !!p);
}
