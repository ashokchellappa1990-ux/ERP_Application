import { guardDecision, bad, ok } from "../_util";
import { predictMetric } from "@/lib/ai/decision/predict";
import { callClaude } from "@/lib/ai/claudeClient";
import { getAiSettings } from "@/lib/ai/config";

/** POST /api/ai/decision/explain — deterministic explainable-AI block for a prediction,
 *  plus an optional richer Claude narrative (fallback = the deterministic explanation). */
export async function POST(req: Request) {
  const g = await guardDecision(req);
  if ("error" in g) return g.error;
  let body: { metric?: string; horizon?: number; period?: string }; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const p = await predictMetric(g.scope, body.metric || "sales", { horizonDays: body.horizon ?? 30, period: body.period });
  if (!p) return bad("Unknown metric.", 404);
  const s = await getAiSettings(g.scope.tenantId);
  const fallback = `${p.explain.why} ${p.explain.expectedImpact}`;
  const res = await callClaude({
    system: "You are a business analyst. In 2-3 sentences, explain this forecast to a manager in plain language: why it's expected, and what to watch. Do not invent numbers beyond those given.",
    messages: [{ role: "user", content: `Metric: ${p.label}. Current ${p.formattedCurrent} → forecast ${p.formattedForecast} over ${p.horizonDays} days (${p.trendPct}% trend, ${p.confidence}% confidence, method ${p.method}). Rules: ${p.explain.rulesApplied.join("; ")}. Historical: ${p.explain.historicalComparison}` }],
    model: s.model, maxTokens: 300, temperature: 0.3, timeoutMs: s.timeoutMs, maxRetries: s.maxRetries, tenantId: g.scope.tenantId, userId: g.actor.id, operation: "chat", fallback,
  });
  return ok({ prediction: p, explain: p.explain, narrative: res.text, aiGenerated: res.status === "success" });
}
