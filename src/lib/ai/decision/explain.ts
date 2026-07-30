import type { DecisionMetric } from "./catalog";
import type { ForecastResult, SeriesPoint } from "./forecast";
import { fmtUnit } from "@/lib/ai/bi/metrics";

/**
 * EXPLAINABLE AI (Module 14) — every prediction carries a plain-language explanation of
 * WHY the AI predicted this, the historical comparison, the data sources, the business
 * rules applied, the confidence, and the expected impact. Deterministic (no key needed).
 */

export interface Explanation {
  why: string;
  historicalComparison: string;
  dataSources: string[];
  rulesApplied: string[];
  confidencePct: number;
  expectedImpact: string;
}

const SOURCE_MAP: Record<string, string[]> = {
  finance: ["General Ledger (journal entries)", "Accounts Receivable / Payable", "Statutory engine (GST/TDS/TCS)"],
  sales: ["Sales invoices (Completed)", "POS transactions"],
  purchase: ["Purchase invoices (Posted)", "Goods Receipt Notes"],
  inventory: ["Inventory balances", "Product reorder levels"],
  customer: ["Customer master", "Sales & receivables"],
  supplier: ["Supplier master", "Payables"],
  budget: ["Budget headers/lines", "Expense vouchers by head"],
  costcentre: ["Expense vouchers", "Dimensional journal postings"],
  profitcentre: ["Income & expense ledger", "Dimensional journal postings"],
};

export function explainPrediction(metric: DecisionMetric, history: SeriesPoint[], fc: ForecastResult, horizonDays: number): Explanation {
  const last = history[history.length - 1]?.value ?? 0;
  const first = history[0]?.value ?? 0;
  const dir = fc.trendPct > 1 ? "rising" : fc.trendPct < -1 ? "falling" : "stable";
  const methodName = fc.method === "seasonal" ? "seasonal (12-month) pattern" : fc.method === "moving" ? "moving average" : "linear trend";
  const good = metric.goodDirection;
  const favourable = (good === "up" && fc.trendPct >= 0) || (good === "down" && fc.trendPct <= 0) || good === "neutral";

  return {
    why: `Projected by fitting a ${methodName} to the last ${history.length} months of ${metric.label.toLowerCase()}. The series is ${dir} (${fc.trendPct >= 0 ? "+" : ""}${fc.trendPct}% into the ${horizonDays}-day horizon), so the model extends that pattern forward.`,
    historicalComparison: `${history.length} months ago it was ${fmtUnit(metric.unit, first)}; latest is ${fmtUnit(metric.unit, last)} (${first !== 0 ? (last >= first ? "+" : "") + Math.round(((last - first) / Math.abs(first)) * 100) : 0}% over the window). Forecast end: ${fmtUnit(metric.unit, fc.horizonValue)}.`,
    dataSources: SOURCE_MAP[metric.module] ?? ["ERP transactions"],
    rulesApplied: [
      `${methodName} fit (least-squares)`,
      `confidence band = residual σ × √horizon (≈80%)`,
      metric.asOf ? "point-in-time balance metric (level projection)" : "flow metric (period totals)",
      `direction target: ${good === "up" ? "higher is better" : good === "down" ? "lower is better" : "neutral"}`,
    ],
    confidencePct: fc.confidence,
    expectedImpact: favourable
      ? `On current trajectory this moves ${favourable ? "favourably" : "adversely"} — ${fmtUnit(metric.unit, Math.abs(fc.horizonValue - last))} ${fc.horizonValue >= last ? "increase" : "decrease"} vs latest.`
      : `Watch: this is trending against target by ${fmtUnit(metric.unit, Math.abs(fc.horizonValue - last))} over ${horizonDays} days — consider corrective action.`,
  };
}
