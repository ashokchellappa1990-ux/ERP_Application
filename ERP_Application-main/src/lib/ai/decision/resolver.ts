import type { ActiveScope } from "@/lib/auth/scope";
import { findMetric, fmtUnit } from "@/lib/ai/bi/metrics";
import { decisionMetric } from "./catalog";
import { predictMetric } from "./predict";
import { detectRisks } from "./risk";
import { detectOpportunities } from "./opportunity";
import { recommendations } from "./recommend";

/**
 * COPILOT BRIDGE — answers predict/forecast/risk/opportunity/recommend questions from the
 * Decision Intelligence engine. Keyword-gated so it ONLY fires on decision intents (plain
 * BI questions still go to the BI engine). Returns a grounded answer + a forecast chart.
 */

export interface DecisionAnswer { text: string; facts: string; entity: string; chart?: { type: "line"; title: string; unit: "money" | "count" | "percent"; items: { name: string; value: number }[] } }

const PREDICT = /\b(predict|forecast|projection|project|outlook|expected|will\s+\w+\s+be|next\s+(month|week|quarter|year))\b/i;
const RISK = /\b(risk|risks|risky|exposure|threat)\b/i;
const OPP = /\b(opportunit|upside|cross[- ]?sell|upsell|grow(th)?\s+opportun)\b/i;
const REC = /\b(recommend|recommendation|what should i do|suggest|advice|advise)\b/i;

const horizonFrom = (q: string) => (/\b7\b|\bweek\b/.test(q) ? 7 : /\b90\b|\bquarter\b/.test(q) ? 90 : /\b180\b/.test(q) ? 180 : /\b365\b|\byear\b/.test(q) ? 365 : 30);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export async function resolveDecision(scope: ActiveScope, message: string): Promise<DecisionAnswer | null> {
  const q = message.toLowerCase();

  if (PREDICT.test(q)) {
    const bi = findMetric(message);
    const key = bi && decisionMetric(bi.key) ? bi.key : "sales";
    const horizonDays = horizonFrom(q);
    const p = await predictMetric(scope, key, { horizonDays });
    if (!p) return null;
    const dir = p.trendPct >= 0 ? "up" : "down";
    const text = `**${p.label} forecast (${horizonDays} days)**\n\nCurrent: ${p.formattedCurrent} → Forecast: **${p.formattedForecast}** (${p.trendPct >= 0 ? "+" : ""}${p.trendPct}%, trending ${dir}).\nConfidence ${p.confidence}% · risk score ${p.riskScore}/100 · method: ${p.method}.\n\n_${p.explain.why}_`;
    const facts = `PREDICTION ${p.label}: current=${p.current}, forecast=${p.forecastValue}, horizon=${horizonDays}d, confidence=${p.confidence}%, trend=${p.trendPct}%`;
    return { text, facts, entity: "Decision.predict", chart: { type: "line", title: `${p.label} — history & forecast`, unit: p.unit, items: p.series.map((s) => ({ name: s.name, value: s.value })) } };
  }

  if (RISK.test(q) && !/no risk|risk free/.test(q)) {
    const risks = await detectRisks(scope);
    if (!risks.length) return { text: "No material risks detected right now — cash, budget, inventory, compliance and receivables all look within limits.", facts: "RISKS: none", entity: "Decision.risk" };
    const top = risks.slice(0, 5);
    const text = `**${risks.length} risk(s) detected** — top items:\n\n${top.map((r) => `- **${r.severity}** · ${r.title} — ${r.explanation} _Mitigation: ${r.mitigation}_`).join("\n")}`;
    return { text, facts: `RISKS(${risks.length}): ${top.map((r) => `${r.severity}:${r.title}`).join("; ")}`, entity: "Decision.risk" };
  }

  if (OPP.test(q)) {
    const opps = await detectOpportunities(scope);
    if (!opps.length) return { text: "No standout opportunities surfaced from the current data.", facts: "OPPS: none", entity: "Decision.opportunity" };
    const top = opps.slice(0, 5);
    const text = `**${opps.length} opportunit(ies)** — top by benefit:\n\n${top.map((o) => `- ${o.title} — ${o.rationale} (est. ${o.benefitLabel})`).join("\n")}`;
    return { text, facts: `OPPS(${opps.length}): ${top.map((o) => `${o.title}=${o.estimatedBenefit}`).join("; ")}`, entity: "Decision.opportunity" };
  }

  if (REC.test(q)) {
    const recs = await recommendations(scope);
    if (!recs.length) return null;
    const top = recs.slice(0, 5);
    const text = `**Top recommendations:**\n\n${top.map((r) => `- **${r.title}** — ${r.reason} _(${r.estimatedBenefit})_`).join("\n")}`;
    return { text, facts: `RECS(${recs.length}): ${top.map((r) => r.title).join("; ")}`, entity: "Decision.recommend" };
  }

  return null;
}
