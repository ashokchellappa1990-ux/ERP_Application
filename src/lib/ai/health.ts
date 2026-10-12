import { prisma } from "@/lib/db/prisma";
import { hasApiKey } from "./config";
import { pingClaude } from "./claudeClient";

/** MODULE 9 — AI HEALTH. Claude status, latency, error/retry counts, success rate,
 *  derived from the ai_api_logs written by the Claude Client (the single gateway). */
const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function aiHealth(tenantId: number, doPing = false) {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [byStatus, latency, retries, recentErrors] = await Promise.all([
    prisma.aiApiLog.groupBy({ by: ["status"], where: { tenantId, createdAt: { gte: since } }, _count: true }),
    prisma.aiApiLog.aggregate({ where: { tenantId, status: "success", createdAt: { gte: since } }, _avg: { latencyMs: true }, _max: { latencyMs: true } }),
    prisma.aiApiLog.aggregate({ where: { tenantId, createdAt: { gte: since } }, _sum: { retries: true } }),
    prisma.aiApiLog.findMany({ where: { tenantId, status: "error", createdAt: { gte: since } }, orderBy: { id: "desc" }, take: 6, select: { errorMessage: true, model: true, createdAt: true } }),
  ]);
  const s = new Map(byStatus.map((r) => [r.status, r._count as number]));
  const total = [...s.values()].reduce((a, b) => a + b, 0);
  const success = s.get("success") ?? 0;
  const errors = s.get("error") ?? 0;
  const fallback = s.get("fallback") ?? 0;

  const ping = doPing ? await pingClaude() : null;
  const configured = await hasApiKey();
  const attempts = success + errors; // fallback isn't a real API attempt

  return {
    claudeApi: configured ? (ping ? (ping.ok ? "Online" : "Offline") : "Configured") : "Fallback",
    online: configured && (ping ? ping.ok : true),
    apiKeyConfigured: configured,
    responseTimeMs: ping?.latencyMs ?? Math.round(num(latency._avg.latencyMs)),
    avgLatencyMs: Math.round(num(latency._avg.latencyMs)),
    maxLatencyMs: num(latency._max.latencyMs),
    apiErrors24h: errors,
    retryCount24h: num(retries._sum.retries),
    fallback24h: fallback,
    totalCalls24h: total,
    successRate: attempts > 0 ? Math.round((success / attempts) * 100) : 100,
    recentErrors: recentErrors.map((e) => ({ message: e.errorMessage ?? "error", model: e.model, at: e.createdAt.toISOString() })),
  };
}
