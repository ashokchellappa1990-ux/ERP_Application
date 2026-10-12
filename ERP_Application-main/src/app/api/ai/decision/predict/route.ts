import { guardDecision, bad, ok, readParams } from "../_util";
import { predictMetric } from "@/lib/ai/decision/predict";
import { logPrediction } from "@/lib/ai/decision/history";
import { monthRange } from "@/lib/ai/bi/period";
import type { ForecastMethod } from "@/lib/ai/decision/forecast";

/** GET /api/ai/decision/predict?metric=&horizon=&method=&log=1 — forecast one metric. */
export async function GET(req: Request) {
  const g = await guardDecision(req);
  if ("error" in g) return g.error;
  const { period, horizonDays, url } = readParams(req);
  const metric = url.searchParams.get("metric") || "sales";
  const method = (url.searchParams.get("method") as ForecastMethod) || undefined;
  const p = await predictMetric(g.scope, metric, { horizonDays: horizonDays ?? 30, method, period });
  if (!p) return bad("Unknown metric.", 404);
  if (url.searchParams.get("log") === "1") await logPrediction(g.scope, g.actor, p, (period ? monthRange(period).to : new Date().toISOString().slice(0, 10))).catch(() => {});
  return ok({ prediction: p });
}
