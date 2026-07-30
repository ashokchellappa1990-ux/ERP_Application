import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeData } from "@/lib/auth/scope";
import type { AiActor } from "@/lib/ai/types";
import type { Prediction } from "./predict";

/**
 * DECISION HISTORY + LEARNING (Modules 15 & Prediction Analytics) — store predictions and
 * the decisions taken on them, then record actual outcomes and accuracy so the platform
 * "learns" (tracked accuracy tempers displayed confidence over time).
 */

export async function logPrediction(scope: ActiveScope, actor: AiActor | null, p: Prediction, forPeriod: string): Promise<number> {
  const row = await prisma.aiPrediction.create({ data: {
    tenantId: scope.tenantId, ...scopeData(scope, { branch: true }),
    module: p.module, metric: p.metric, label: p.label, horizonDays: p.horizonDays, forPeriod,
    currentValue: p.current, forecastValue: p.forecastValue, confidence: p.confidence, riskScore: p.riskScore,
    trendPct: p.trendPct, method: p.method, unit: p.unit, seriesJson: JSON.stringify(p.series), explainJson: JSON.stringify(p.explain),
    createdBy: actor?.id ?? null,
  } });
  return row.id;
}

export async function recordActual(scope: ActiveScope, predictionId: number, actualValue: number): Promise<{ ok: boolean; accuracyPct?: number }> {
  const p = await prisma.aiPrediction.findFirst({ where: { tenantId: scope.tenantId, id: predictionId }, select: { forecastValue: true } });
  if (!p) return { ok: false };
  const err = p.forecastValue !== 0 ? Math.abs((actualValue - p.forecastValue) / Math.abs(p.forecastValue)) : (actualValue === 0 ? 0 : 1);
  const accuracyPct = Math.max(0, Math.round((1 - err) * 100));
  await prisma.aiPrediction.update({ where: { id: predictionId }, data: { actualValue, accuracyPct, actualAt: new Date() } });
  return { ok: true, accuracyPct };
}

export async function logDecision(scope: ActiveScope, actor: AiActor | null, input: { source: string; refKey: string; module?: string; title: string; recommendation?: string; decisionTaken?: string }): Promise<number> {
  const row = await prisma.aiDecision.create({ data: {
    tenantId: scope.tenantId, ...scopeData(scope, { branch: true }),
    source: input.source, refKey: input.refKey.slice(0, 160), module: input.module ?? null, title: input.title.slice(0, 240),
    recommendation: input.recommendation ?? null, decisionTaken: input.decisionTaken ?? "Pending", takenBy: actor?.id ?? null, takenByName: actor?.fullName ?? null,
  } });
  return row.id;
}

export async function updateDecision(scope: ActiveScope, id: number, patch: { decisionTaken?: string; actualResult?: string; accuracy?: number; learningOutcome?: string }) {
  const d = await prisma.aiDecision.findFirst({ where: { tenantId: scope.tenantId, id }, select: { id: true } });
  if (!d) return false;
  await prisma.aiDecision.update({ where: { id }, data: patch });
  return true;
}

export async function listDecisions(scope: ActiveScope, opts?: { source?: string; take?: number }) {
  return prisma.aiDecision.findMany({ where: { tenantId: scope.tenantId, ...(opts?.source ? { source: opts.source } : {}) }, orderBy: { createdAt: "desc" }, take: opts?.take ?? 100 });
}

export async function predictionAccuracy(scope: ActiveScope) {
  const scored = await prisma.aiPrediction.findMany({ where: { tenantId: scope.tenantId, accuracyPct: { not: null } }, select: { metric: true, label: true, module: true, accuracyPct: true, forecastValue: true, actualValue: true, createdAt: true }, orderBy: { actualAt: "desc" }, take: 500 });
  const pending = await prisma.aiPrediction.count({ where: { tenantId: scope.tenantId, accuracyPct: null } });
  const total = scored.length;
  const avg = total ? Math.round(scored.reduce((s, r) => s + (r.accuracyPct ?? 0), 0) / total) : 0;
  const byMetric = new Map<string, { label: string; module: string; sum: number; n: number }>();
  for (const r of scored) { const e = byMetric.get(r.metric) ?? { label: r.label, module: r.module, sum: 0, n: 0 }; e.sum += r.accuracyPct ?? 0; e.n++; byMetric.set(r.metric, e); }
  const metrics = [...byMetric.entries()].map(([metric, e]) => ({ metric, label: e.label, module: e.module, accuracy: Math.round(e.sum / e.n), n: e.n })).sort((a, b) => b.n - a.n);
  return { total, pending, avgAccuracy: avg, metrics, recent: scored.slice(0, 20) };
}

/** Learning multiplier — scales displayed confidence by observed accuracy for a metric. */
export async function confidenceAdjustment(scope: ActiveScope, metric: string): Promise<number> {
  const rows = await prisma.aiPrediction.findMany({ where: { tenantId: scope.tenantId, metric, accuracyPct: { not: null } }, select: { accuracyPct: true }, take: 20 }).catch(() => []);
  if (!rows.length) return 1;
  const avg = rows.reduce((s, r) => s + (r.accuracyPct ?? 0), 0) / rows.length;
  return Math.max(0.6, Math.min(1.05, avg / 85)); // >85% observed → boost; below → temper
}
