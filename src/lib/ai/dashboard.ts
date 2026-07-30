import { prisma } from "@/lib/db/prisma";
import { hasApiKey } from "./config";

/** MODULE 8 — AI DASHBOARD aggregations (usage analytics over the ai_* tables). */
const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function aiDashboard(tenantId: number) {
  const startOfDay = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const [totalConv, todayConv, msgAgg, todayMsgs, logAgg, tokenAgg, popularPrompts, topUsers, moduleLogs] = await Promise.all([
    prisma.aiConversation.count({ where: { tenantId } }),
    prisma.aiConversation.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
    prisma.aiMessage.aggregate({ where: { tenantId, role: "assistant" }, _avg: { latencyMs: true }, _count: true }),
    prisma.aiMessage.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
    prisma.aiApiLog.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
    prisma.aiApiLog.aggregate({ where: { tenantId }, _sum: { totalTokens: true, promptTokens: true, completionTokens: true } }),
    prisma.aiPromptLibrary.findMany({ where: { OR: [{ tenantId: null }, { tenantId }] }, orderBy: { usageCount: "desc" }, take: 5, select: { title: true, category: true, usageCount: true } }),
    prisma.aiConversation.groupBy({ by: ["userId"], where: { tenantId }, _count: true, orderBy: { _count: { userId: "desc" } }, take: 5 }),
    prisma.aiConversation.groupBy({ by: ["category"], where: { tenantId, category: { not: null } }, _count: true }),
  ]);

  // Frequently asked questions (from user messages, coarse-grouped by first 60 chars).
  const userMsgs = await prisma.aiMessage.findMany({ where: { tenantId, role: "user" }, orderBy: { id: "desc" }, take: 400, select: { content: true } });
  const faqMap = new Map<string, number>();
  for (const m of userMsgs) { const k = m.content.trim().slice(0, 60).toLowerCase(); if (k.length < 4) continue; faqMap.set(k, (faqMap.get(k) ?? 0) + 1); }
  const faqs = [...faqMap.entries()].map(([q, c]) => ({ q, count: c })).sort((a, b) => b.count - a.count).slice(0, 6);

  // Resolve top user names.
  const userIds = topUsers.map((u) => u.userId);
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }).catch(() => []) : [];
  const nameOf = (id: number) => users.find((u) => u.id === id)?.fullName ?? `User #${id}`;

  const statusMap = new Map(logAgg.map((l) => [l.status, l._count as number]));
  const totalCalls = [...statusMap.values()].reduce((s, v) => s + v, 0);
  const success = statusMap.get("success") ?? 0;

  return {
    totalConversations: totalConv, todaysConversations: todayConv,
    avgResponseTimeMs: Math.round(num(msgAgg._avg.latencyMs)), totalMessages: msgAgg._count, todaysMessages: todayMsgs,
    tokenUsage: { total: num(tokenAgg._sum.totalTokens), prompt: num(tokenAgg._sum.promptTokens), completion: num(tokenAgg._sum.completionTokens) },
    claudeStatus: (await hasApiKey()) ? "Connected" : "Fallback (no API key)",
    successRate: totalCalls > 0 ? Math.round((success / totalCalls) * 100) : 100,
    faqs, popularPrompts: popularPrompts.map((p) => ({ title: p.title, category: p.category, uses: p.usageCount })),
    topUsers: topUsers.map((u) => ({ name: nameOf(u.userId), conversations: u._count })),
    mostUsedModules: moduleLogs.map((m) => ({ module: m.category ?? "General", count: m._count })).sort((a, b) => b.count - a.count),
  };
}
