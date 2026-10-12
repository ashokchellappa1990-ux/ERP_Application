/**
 * Target distribution — split an annual target into 12 FY months (Apr..Mar) by method.
 * Config-driven: seasonal weights + historical monthly actuals are supplied by the caller,
 * never hardcoded. The result always sums back to `annual` (rounding remainder on the last).
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Proportionally split `annual` across 12 weights, correcting the rounding drift on the last bucket. */
function splitByWeights(annual: number, weights: number[]): number[] {
  const w = weights.length === 12 ? weights.map((x) => Math.max(0, Number(x) || 0)) : Array(12).fill(1);
  const total = w.reduce((s, x) => s + x, 0);
  if (total <= 0) return splitByWeights(annual, Array(12).fill(1));
  const out = w.map((x) => r2((annual * x) / total));
  const drift = r2(annual - out.reduce((s, x) => s + x, 0));
  out[11] = r2(out[11] + drift);
  return out;
}

export type DistMethod = "equal" | "percentage" | "historical" | "seasonal" | "manual";

export function distribute(
  annual: number,
  method: DistMethod,
  opts?: { percentages?: number[]; historicalMonthly?: number[]; seasonalWeights?: number[]; manual?: number[] },
): number[] {
  switch (method) {
    case "manual": {
      const m = opts?.manual && opts.manual.length === 12 ? opts.manual.map(r2) : splitByWeights(annual, Array(12).fill(1));
      return m;
    }
    case "percentage":
      return splitByWeights(annual, opts?.percentages && opts.percentages.length === 12 ? opts.percentages : Array(12).fill(1));
    case "historical": {
      const h = opts?.historicalMonthly && opts.historicalMonthly.length === 12 ? opts.historicalMonthly : [];
      const sum = h.reduce((s, x) => s + (Number(x) || 0), 0);
      return splitByWeights(annual, sum > 0 ? h : Array(12).fill(1)); // fall back to equal when no history
    }
    case "seasonal":
      return splitByWeights(annual, opts?.seasonalWeights && opts.seasonalWeights.length === 12 ? opts.seasonalWeights : Array(12).fill(1));
    case "equal":
    default:
      return splitByWeights(annual, Array(12).fill(1));
  }
}

/** Sum an m1..m12 record/array. */
export const sumMonths = (m: number[]) => r2(m.reduce((s, x) => s + (Number(x) || 0), 0));
