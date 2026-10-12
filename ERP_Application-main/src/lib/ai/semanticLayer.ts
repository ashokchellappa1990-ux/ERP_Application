import { prisma } from "@/lib/db/prisma";

/**
 * MODULE 3 — SEMANTIC LAYER. Converts business language ("Today's Sales", "Outstanding
 * Receivable", "Budget Utilization") into ERP context (module + business entity + KPI)
 * WITHOUT ever exposing database tables to the model. It reads ai_semantic_dictionary
 * (global rows + tenant overrides) and matches by normalized term / synonyms.
 */

export interface SemanticMatch { term: string; entity: string; kpi: string | null; moduleKey: string | null; definition: string | null }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export async function resolveTerms(tenantId: number, query: string): Promise<SemanticMatch[]> {
  const q = norm(query);
  if (!q) return [];
  const dict = await prisma.aiSemanticDictionary.findMany({ where: { OR: [{ tenantId }, { tenantId: null }] }, orderBy: { id: "asc" } }).catch(() => []);
  const hits: SemanticMatch[] = [];
  const seen = new Set<string>();
  for (const d of dict) {
    const keys = [norm(d.normalized), norm(d.term), ...(d.synonyms ? safeArr(d.synonyms).map(norm) : [])].filter(Boolean);
    const matched = keys.some((k) => k && q.includes(k));
    if (matched && !seen.has(d.entity)) { seen.add(d.entity); hits.push({ term: d.term, entity: d.entity, kpi: d.kpi, moduleKey: d.moduleKey, definition: d.definition }); }
  }
  return hits;
}

/** Which module keys are implicated by a query (via the semantic matches). */
export async function inferModules(tenantId: number, query: string): Promise<string[]> {
  const matches = await resolveTerms(tenantId, query);
  return [...new Set(matches.map((m) => m.moduleKey).filter((x): x is string => !!x))];
}

function safeArr(s: string): string[] { try { const a = JSON.parse(s); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } }
