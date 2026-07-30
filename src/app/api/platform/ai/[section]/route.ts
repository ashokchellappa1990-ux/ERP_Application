import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { platformAuth, isResponse } from "@/lib/platform/apiGuard";
import { getAiSettings, hasApiKey, apiKeySource } from "@/lib/ai/config";

/**
 * Platform (SaaS control-plane) AI configuration reader — GLOBAL defaults + cross-tenant
 * usage. Guarded by the platform session (platform staff), not the ERP session.
 */
const arr = (s: string | null) => { if (!s) return []; try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch { return []; } };
const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function GET(_req: Request, { params }: { params: { section: string } }) {
  const auth = await platformAuth("settings");
  if (isResponse(auth)) return auth;

  try {
    switch (params.section) {
      case "settings":
        return NextResponse.json({ ok: true, settings: await getAiSettings(null), apiKeyPresent: await hasApiKey(), apiKeySource: await apiKeySource() });
      case "modules": {
        const rows = await prisma.aiModuleRegistry.findMany({ where: { tenantId: null }, orderBy: { name: "asc" } });
        return NextResponse.json({ ok: true, modules: rows.map((r) => ({ id: r.id, moduleKey: r.moduleKey, name: r.name, description: r.description, menu: r.menu, enabled: r.enabled, businessTerms: arr(r.businessTerms), kpis: arr(r.kpis), questions: arr(r.questions), permissions: arr(r.permissions) })) });
      }
      case "semantic": {
        const rows = await prisma.aiSemanticDictionary.findMany({ where: { tenantId: null }, orderBy: { term: "asc" } });
        return NextResponse.json({ ok: true, terms: rows.map((r) => ({ id: r.id, term: r.term, entity: r.entity, kpi: r.kpi, moduleKey: r.moduleKey, definition: r.definition, synonyms: arr(r.synonyms) })) });
      }
      case "prompts": {
        const rows = await prisma.aiPromptLibrary.findMany({ where: { tenantId: null }, orderBy: [{ category: "asc" }, { title: "asc" }] });
        return NextResponse.json({ ok: true, prompts: rows.map((r) => ({ id: r.id, category: r.category, title: r.title, promptText: r.promptText, description: r.description, isSystem: r.isSystem, usageCount: r.usageCount })) });
      }
      case "health": {
        const since = new Date(Date.now() - 24 * 3600 * 1000);
        const [byStatus, latency, retries, recent] = await Promise.all([
          prisma.aiApiLog.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: true }),
          prisma.aiApiLog.aggregate({ where: { status: "success", createdAt: { gte: since } }, _avg: { latencyMs: true }, _max: { latencyMs: true } }),
          prisma.aiApiLog.aggregate({ where: { createdAt: { gte: since } }, _sum: { retries: true } }),
          prisma.aiApiLog.findMany({ where: { status: "error", createdAt: { gte: since } }, orderBy: { id: "desc" }, take: 8, select: { errorMessage: true, model: true, createdAt: true } }),
        ]);
        const s = new Map(byStatus.map((r) => [r.status, r._count as number]));
        const success = s.get("success") ?? 0, errors = s.get("error") ?? 0, fallback = s.get("fallback") ?? 0;
        const attempts = success + errors;
        const configured = await hasApiKey();
        return NextResponse.json({ ok: true, health: {
          apiKeyConfigured: configured, claudeApi: configured ? "Configured" : "Fallback",
          avgLatencyMs: Math.round(num(latency._avg.latencyMs)), maxLatencyMs: num(latency._max.latencyMs),
          apiErrors24h: errors, retryCount24h: num(retries._sum.retries), fallback24h: fallback, successRate: attempts > 0 ? Math.round((success / attempts) * 100) : 100,
          recentErrors: recent.map((e) => ({ message: e.errorMessage ?? "error", model: e.model, at: e.createdAt.toISOString() })),
        } });
      }
      case "dashboard": {
        const startOfDay = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
        const [totalConv, todayConv, tokens, tenants] = await Promise.all([
          prisma.aiConversation.count(), prisma.aiConversation.count({ where: { createdAt: { gte: startOfDay } } }),
          prisma.aiApiLog.aggregate({ _sum: { totalTokens: true } }),
          prisma.aiConversation.groupBy({ by: ["tenantId"], _count: true, orderBy: { _count: { tenantId: "desc" } }, take: 8 }),
        ]);
        return NextResponse.json({ ok: true, dashboard: { totalConversations: totalConv, todaysConversations: todayConv, totalTokens: num(tokens._sum.totalTokens), byTenant: tenants.map((t) => ({ tenantId: t.tenantId, conversations: t._count })) } });
      }
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (err) {
    console.error("[platform/ai]", params.section, err);
    return NextResponse.json({ ok: false, message: "Could not load." }, { status: 500 });
  }
}
