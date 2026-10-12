import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere } from "@/lib/auth/scope";

/** KNOWLEDGE ANALYTICS (Module 16) — dashboard metrics over the document platform. */

export interface KnowledgeAnalytics {
  totalDocuments: number; published: number; drafts: number; archived: number;
  ocrCompleted: number; ocrPending: number;
  knowledgeEntries: number; totalQueries: number; avgResponseMs: number;
  mostViewed: { id: number; title: string; viewCount: number }[];
  mostAsked: { query: string; count: number }[];
  popularCategories: { name: string; count: number }[];
  byStatus: { status: string; count: number }[];
  coverage: number; // % of documents with extracted text (searchable)
  storageMb: number;
}

export async function knowledgeAnalytics(scope: ActiveScope): Promise<KnowledgeAnalytics> {
  const where = scopeWhere(scope, { branch: true }) as Prisma.DocumentWhereInput;
  const tw = { tenantId: scope.tenantId };
  const [total, published, drafts, archived, ocrCompleted, ocrPending, withText, kb, statusGroups, catGroups, mostViewed, sizeAgg] = await Promise.all([
    prisma.document.count({ where: { ...where, status: { not: "Deleted" } } }),
    prisma.document.count({ where: { ...where, status: "Published" } }),
    prisma.document.count({ where: { ...where, status: "Draft" } }),
    prisma.document.count({ where: { ...where, status: "Archived" } }),
    prisma.document.count({ where: { ...where, ocrStatus: "completed" } }),
    prisma.document.count({ where: { ...where, ocrStatus: "pending" } }),
    prisma.document.count({ where: { ...where, status: { not: "Deleted" }, NOT: { extractedText: null } } }),
    prisma.knowledgeBase.count({ where: { ...tw, status: "Published" } }),
    prisma.document.groupBy({ by: ["status"], where: { ...where, status: { not: "Deleted" } }, _count: true }),
    prisma.document.groupBy({ by: ["categoryId"], where: { ...where, status: { not: "Deleted" } }, _count: true }),
    prisma.document.findMany({ where: { ...where, status: { not: "Deleted" } }, orderBy: { viewCount: "desc" }, take: 5, select: { id: true, title: true, viewCount: true } }),
    prisma.document.aggregate({ where: { ...where, status: { not: "Deleted" } }, _sum: { fileSize: true } }),
  ]);

  const queries = await prisma.docAiQuery.findMany({ where: tw, select: { query: true, latencyMs: true }, take: 2000, orderBy: { createdAt: "desc" } }).catch(() => []);
  const totalQueries = queries.length;
  const avgResponseMs = totalQueries ? Math.round(queries.reduce((s, q) => s + (q.latencyMs ?? 0), 0) / totalQueries) : 0;
  const askMap = new Map<string, number>();
  for (const q of queries) { const k = (q.query || "").slice(0, 80); if (!k) continue; askMap.set(k, (askMap.get(k) ?? 0) + 1); }
  const mostAsked = [...askMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([query, count]) => ({ query, count }));

  const cats = await prisma.docCategory.findMany({ where: { tenantId: scope.tenantId }, select: { id: true, name: true } });
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const popularCategories = catGroups.map((g) => ({ name: g.categoryId ? (catName.get(g.categoryId) ?? "Uncategorised") : "Uncategorised", count: g._count })).sort((a, b) => b.count - a.count).slice(0, 8);

  return {
    totalDocuments: total, published, drafts, archived, ocrCompleted, ocrPending,
    knowledgeEntries: kb, totalQueries, avgResponseMs,
    mostViewed, mostAsked, popularCategories,
    byStatus: statusGroups.map((g) => ({ status: g.status, count: g._count })),
    coverage: total ? Math.round((withText / total) * 100) : 0,
    storageMb: Math.round(((sizeAgg._sum.fileSize ?? 0) / (1024 * 1024)) * 10) / 10,
  };
}
