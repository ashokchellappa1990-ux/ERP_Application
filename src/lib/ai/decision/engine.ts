import type { ActiveScope } from "@/lib/auth/scope";
import { computeBaseline } from "./baseline";
import { businessHealth } from "./health";
import { detectRisks } from "./risk";
import { detectOpportunities } from "./opportunity";
import { recommendations } from "./recommend";
import { predictMetric, type Prediction } from "./predict";
import { syncNotifications, unreadCount } from "./notify";
import { getModelConfig } from "./config";

/**
 * DECISION OVERVIEW (Module: Decision Intelligence Dashboard) — the one composite payload
 * for the hub landing: business health + headline forecasts + top risks + top
 * opportunities + top recommendations + notification count. Computes the baseline ONCE
 * and shares it across every engine, and syncs notifications as a side-effect.
 */

const HEADLINE = ["sales", "netProfit", "cash", "gstDue", "inventoryValue"];

export interface DecisionOverview {
  generatedAt: string;
  period: string;
  health: { overall: number; band: string; color: string; aiConfidence: number; domains: { key: string; label: string; score: number; note: string }[] };
  predictions: Prediction[];
  risks: Awaited<ReturnType<typeof detectRisks>>;
  opportunities: Awaited<ReturnType<typeof detectOpportunities>>;
  recommendations: Awaited<ReturnType<typeof recommendations>>;
  notifications: number;
  counts: { risks: number; opportunities: number; recommendations: number };
}

export async function decisionOverview(scope: ActiveScope, opts?: { period?: string; horizonDays?: number }): Promise<DecisionOverview> {
  const cfg = await getModelConfig(scope.tenantId);
  const horizonDays = opts?.horizonDays ?? cfg.defaultHorizon;
  const baseline = await computeBaseline(scope, opts);

  const [health, risks, opportunities, predictions] = await Promise.all([
    businessHealth(scope, opts),
    cfg.enabled.risks ? detectRisks(scope, { baseline }) : Promise.resolve([]),
    cfg.enabled.opportunities ? detectOpportunities(scope, { baseline }) : Promise.resolve([]),
    cfg.enabled.predictions ? Promise.all(HEADLINE.map((k) => predictMetric(scope, k, { horizonDays, method: cfg.defaultMethod, period: opts?.period }).catch(() => null))).then((a) => a.filter((p): p is Prediction => !!p)) : Promise.resolve([] as Prediction[]),
  ]);
  const recs = await recommendations(scope, { baseline, risks, opps: opportunities });

  let notifications = 0;
  if (cfg.enabled.notifications) { await syncNotifications(scope, { risks, health, period: baseline.period }).catch(() => {}); notifications = await unreadCount(scope).catch(() => 0); }

  return {
    generatedAt: new Date().toISOString(), period: baseline.period,
    health: { overall: health.overall, band: health.band, color: health.color, aiConfidence: health.aiConfidence, domains: health.domains },
    predictions, risks, opportunities, recommendations: recs, notifications,
    counts: { risks: risks.length, opportunities: opportunities.length, recommendations: recs.length },
  };
}
