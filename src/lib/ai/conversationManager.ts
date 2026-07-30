import { prisma } from "@/lib/db/prisma";
import type { AiActor, ChatMessage } from "./types";

/**
 * MODULE 6 — CONVERSATION MANAGER. History, session, pin / rename / delete / search,
 * and per-message storage (question, answer, execution time, feedback, date, user).
 */

export async function createConversation(user: AiActor, title: string, category?: string) {
  return prisma.aiConversation.create({ data: {
    tenantId: user.tenantId, businessId: user.businessId ?? null, branchId: user.branchId ?? null, userId: user.id,
    title: title.slice(0, 200) || "New conversation", category: category ?? null, createdBy: user.id, lastMessageAt: new Date(),
  } });
}

export async function addMessage(tenantId: number, conversationId: number, msg: { role: "user" | "assistant" | "system"; content: string; model?: string | null; tokensIn?: number; tokensOut?: number; latencyMs?: number; status?: string; contextJson?: string | null; createdBy?: number | null }) {
  const m = await prisma.aiMessage.create({ data: {
    tenantId, conversationId, role: msg.role, content: msg.content, model: msg.model ?? null,
    tokensIn: msg.tokensIn ?? null, tokensOut: msg.tokensOut ?? null, latencyMs: msg.latencyMs ?? null, status: msg.status ?? null,
    contextJson: msg.contextJson ?? null, createdBy: msg.createdBy ?? null,
  } });
  await prisma.aiConversation.update({ where: { id: conversationId }, data: { messageCount: { increment: 1 }, lastMessageAt: new Date() } });
  return m;
}

export async function listConversations(user: AiActor, opts: { q?: string; pinned?: boolean; category?: string } = {}) {
  const where: Record<string, unknown> = { tenantId: user.tenantId, userId: user.id };
  if (opts.pinned) where.pinned = true;
  if (opts.category) where.category = opts.category;
  if (opts.q) where.title = { contains: opts.q };
  const rows = await prisma.aiConversation.findMany({ where, orderBy: [{ pinned: "desc" }, { lastMessageAt: "desc" }], take: 100 });
  return rows.map((c) => ({ id: c.id, title: c.title, category: c.category, pinned: c.pinned, messageCount: c.messageCount, lastMessageAt: c.lastMessageAt?.toISOString() ?? c.createdAt.toISOString() }));
}

export async function getConversation(user: AiActor, id: number) {
  const c = await prisma.aiConversation.findFirst({ where: { id, tenantId: user.tenantId, userId: user.id } });
  if (!c) return null;
  const messages = await prisma.aiMessage.findMany({ where: { conversationId: id }, orderBy: { id: "asc" }, include: { feedback: { where: { userId: user.id }, select: { rating: true } } } });
  const extrasOf = (s: string | null) => { if (!s) return undefined; try { return JSON.parse(s).extras; } catch { return undefined; } };
  return {
    id: c.id, title: c.title, category: c.category, pinned: c.pinned,
    messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, model: m.model, latencyMs: m.latencyMs, status: m.status, tokensOut: m.tokensOut, createdAt: m.createdAt.toISOString(), feedback: m.feedback[0]?.rating ?? null, extras: m.role === "assistant" ? extrasOf(m.contextJson) : undefined })),
  };
}

export async function historyMessages(conversationId: number): Promise<ChatMessage[]> {
  const rows = await prisma.aiMessage.findMany({ where: { conversationId, role: { in: ["user", "assistant"] } }, orderBy: { id: "asc" }, take: 20, select: { role: true, content: true } });
  return rows.map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

export async function pinConversation(user: AiActor, id: number, pinned: boolean) {
  await prisma.aiConversation.updateMany({ where: { id, tenantId: user.tenantId, userId: user.id }, data: { pinned } });
}
export async function renameConversation(user: AiActor, id: number, title: string) {
  await prisma.aiConversation.updateMany({ where: { id, tenantId: user.tenantId, userId: user.id }, data: { title: title.slice(0, 200) } });
}
export async function deleteConversation(user: AiActor, id: number) {
  await prisma.aiConversation.deleteMany({ where: { id, tenantId: user.tenantId, userId: user.id } });
}
export async function saveFeedback(user: AiActor, messageId: number, rating: "up" | "down", comment?: string) {
  const msg = await prisma.aiMessage.findFirst({ where: { id: messageId, tenantId: user.tenantId }, select: { id: true } });
  if (!msg) return;
  const existing = await prisma.aiFeedback.findFirst({ where: { messageId, userId: user.id } });
  if (existing) await prisma.aiFeedback.update({ where: { id: existing.id }, data: { rating, comment: comment ?? null } });
  else await prisma.aiFeedback.create({ data: { tenantId: user.tenantId, messageId, userId: user.id, rating, comment: comment ?? null } });
}
