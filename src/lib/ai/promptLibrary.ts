import { prisma } from "@/lib/db/prisma";
import type { AiActor } from "./types";

/**
 * MODULE 7 — PROMPT LIBRARY. Ready-made prompts (global, isSystem) + user-created ones,
 * with create / edit / save / favourite / share. Categories come from ai_prompt_category.
 */

export async function listCategories(tenantId: number) {
  const rows = await prisma.aiPromptCategory.findMany({ where: { OR: [{ tenantId }, { tenantId: null }] }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const byKey = new Map<string, { key: string; name: string; icon: string | null }>();
  for (const r of rows) if (!byKey.has(r.key)) byKey.set(r.key, { key: r.key, name: r.name, icon: r.icon });
  return [...byKey.values()];
}

export async function listPrompts(user: AiActor, opts: { category?: string; q?: string; favouritesOnly?: boolean } = {}) {
  const favIds = new Set((await prisma.aiUserFavourite.findMany({ where: { tenantId: user.tenantId, userId: user.id }, select: { promptId: true } })).map((f) => f.promptId));
  const where: Record<string, unknown> = {
    // Global/system prompts, this tenant's shared prompts, and the user's own.
    OR: [{ tenantId: null }, { tenantId: user.tenantId, shared: true }, { tenantId: user.tenantId, createdBy: user.id }],
  };
  if (opts.category) where.category = opts.category;
  if (opts.q) where.OR = [{ title: { contains: opts.q } }, { promptText: { contains: opts.q } }];
  const rows = await prisma.aiPromptLibrary.findMany({ where, orderBy: [{ isSystem: "desc" }, { usageCount: "desc" }, { id: "desc" }], take: 300 });
  let list = rows.map((p) => ({ id: p.id, category: p.category, title: p.title, promptText: p.promptText, description: p.description, isSystem: p.isSystem, shared: p.shared, usageCount: p.usageCount, mine: p.createdBy === user.id && p.tenantId === user.tenantId, favourite: favIds.has(p.id), createdByName: p.createdByName }));
  if (opts.favouritesOnly) list = list.filter((p) => p.favourite);
  return list;
}

export async function createPrompt(user: AiActor, data: { category: string; title: string; promptText: string; description?: string; shared?: boolean }) {
  return prisma.aiPromptLibrary.create({ data: {
    tenantId: user.tenantId, category: data.category, title: data.title.slice(0, 200), promptText: data.promptText.slice(0, 4000),
    description: data.description?.slice(0, 300) ?? null, isSystem: false, shared: !!data.shared, createdBy: user.id, createdByName: user.fullName ?? null,
  } });
}

export async function updatePrompt(user: AiActor, id: number, data: { category?: string; title?: string; promptText?: string; description?: string; shared?: boolean }) {
  const p = await prisma.aiPromptLibrary.findFirst({ where: { id, tenantId: user.tenantId, createdBy: user.id } });
  if (!p) return false;
  await prisma.aiPromptLibrary.update({ where: { id }, data: {
    category: data.category ?? p.category, title: (data.title ?? p.title).slice(0, 200), promptText: (data.promptText ?? p.promptText).slice(0, 4000),
    description: data.description !== undefined ? data.description.slice(0, 300) : p.description, shared: data.shared ?? p.shared,
  } });
  return true;
}

export async function deletePrompt(user: AiActor, id: number) {
  const r = await prisma.aiPromptLibrary.deleteMany({ where: { id, tenantId: user.tenantId, createdBy: user.id } });
  return r.count > 0;
}

export async function toggleFavourite(user: AiActor, promptId: number) {
  const existing = await prisma.aiUserFavourite.findFirst({ where: { userId: user.id, promptId } });
  if (existing) { await prisma.aiUserFavourite.delete({ where: { id: existing.id } }); return false; }
  await prisma.aiUserFavourite.create({ data: { tenantId: user.tenantId, userId: user.id, promptId } });
  return true;
}

export async function bumpUsage(id: number) {
  await prisma.aiPromptLibrary.update({ where: { id }, data: { usageCount: { increment: 1 } } }).catch(() => {});
}
