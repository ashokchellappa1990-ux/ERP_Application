import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere, scopeData } from "@/lib/auth/scope";
import { writeAudit } from "@/lib/audit/log";
import type { AiActor } from "@/lib/ai/types";

/** KNOWLEDGE BASE (Module 8) — enterprise Q&A from documents, FAQs, ERP or manual entry. */

const actorRef = (a: AiActor) => ({ id: a.id, tenantId: a.tenantId, fullName: a.fullName ?? null });
const norm = (s: string) => (s || "").toLowerCase();
const safe = (s: string | null): string[] => { if (!s) return []; try { const a = JSON.parse(s); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };

export async function listKnowledge(scope: ActiveScope, f: { q?: string; categoryId?: number; source?: string; status?: string; take?: number }) {
  const where = scopeWhere(scope, { branch: false }) as Prisma.KnowledgeBaseWhereInput;
  where.status = f.status ?? "Published";
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.source) where.source = f.source;
  if (f.q) where.OR = [{ question: { contains: f.q } }, { answer: { contains: f.q } }];
  const rows = await prisma.knowledgeBase.findMany({ where, orderBy: { updatedAt: "desc" }, take: f.take ?? 100 });
  return rows.map((r) => ({ ...r, tags: safe(r.tagsJson) }));
}

/** Natural-language KB search — lexical scoring over question + answer. */
export async function searchKnowledge(scope: ActiveScope, query: string, limit = 8) {
  const q = norm(query);
  const tokens = [...new Set((q.match(/[a-z0-9]{3,}/g) ?? []))];
  if (!tokens.length) return [];
  const rows = await listKnowledge(scope, { take: 500 });
  return rows.map((r) => {
    const hay = norm(r.question + " " + r.answer);
    let score = 0; for (const t of tokens) { if (norm(r.question).includes(t)) score += 3; if (hay.includes(t)) score += 1; }
    return { r, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.r);
}

export async function createKnowledge(scope: ActiveScope, actor: AiActor, input: { question: string; answer: string; categoryId?: number | null; department?: string; source?: string; documentId?: number | null; tags?: string[]; status?: string }) {
  const kb = await prisma.knowledgeBase.create({ data: {
    tenantId: scope.tenantId, ...scopeData(scope, { branch: false }),
    question: input.question.slice(0, 500), answer: input.answer, categoryId: input.categoryId ?? null,
    department: input.department ?? null, ownerId: actor.id, ownerName: actor.fullName ?? null,
    source: input.source ?? "manual", documentId: input.documentId ?? null, tagsJson: JSON.stringify(input.tags ?? []),
    status: input.status ?? "Published", createdBy: actor.id,
  } });
  await writeAudit(prisma, actorRef(actor), { action: "knowledge.create", entity: "KnowledgeBase", entityId: kb.id, summary: input.question.slice(0, 120), businessId: scope.businessId, branchId: scope.branchId });
  return kb;
}

export async function updateKnowledge(scope: ActiveScope, id: number, patch: Partial<{ question: string; answer: string; categoryId: number | null; department: string; status: string; tags: string[] }>) {
  const k = await prisma.knowledgeBase.findFirst({ where: { tenantId: scope.tenantId, id }, select: { id: true } });
  if (!k) return null;
  const data: Record<string, unknown> = { ...patch };
  if (patch.tags !== undefined) { delete (data as { tags?: unknown }).tags; data.tagsJson = JSON.stringify(patch.tags); }
  return prisma.knowledgeBase.update({ where: { id }, data });
}

export async function deleteKnowledge(scope: ActiveScope, id: number) {
  const k = await prisma.knowledgeBase.findFirst({ where: { tenantId: scope.tenantId, id }, select: { id: true } });
  if (!k) return false;
  await prisma.knowledgeBase.update({ where: { id }, data: { status: "Archived" } });
  return true;
}

/** Promote generated FAQs into the Knowledge Base. */
export async function promoteFaqsToKnowledge(scope: ActiveScope, actor: AiActor, documentId: number, categoryId?: number | null) {
  const faqs = await prisma.docFaq.findMany({ where: { tenantId: scope.tenantId, documentId } });
  let n = 0;
  for (const f of faqs) {
    await createKnowledge(scope, actor, { question: f.question, answer: f.answer, categoryId: categoryId ?? null, source: "faq", documentId }); n++;
  }
  return n;
}
