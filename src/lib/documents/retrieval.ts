import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere } from "@/lib/auth/scope";
import { resolveTerms } from "@/lib/ai/semanticLayer";

/**
 * DOCUMENT RETRIEVAL (Modules 5 & 9) — RAG-lite. Turns a natural-language query into
 * the most relevant documents + text chunks using lexical overlap (title/keywords/body)
 * blended with the semantic layer. No external vector DB; works fully offline. This is
 * also the bridge that lets the AI Copilot answer from documents (`resolveDocs`).
 */

const STOP = new Set("the a an and or of to in on for with is are was were be do does did this that show me my our find what which who when where how about get list all any".split(/\s+/));
const norm = (s: string) => (s || "").toLowerCase();
const tokenize = (s: string) => [...new Set((norm(s).match(/[a-z0-9][a-z0-9-]{1,}/g) ?? []).filter((w) => !STOP.has(w)))];
const arr = (s: string | null | undefined): string[] => { if (!s) return []; try { const a = JSON.parse(s); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };

export interface DocHit {
  id: number; docNo: string; title: string; category: string | null; status: string;
  score: number; specificity: number; snippet: string; href: string;
}
export interface DocsAnswer { text: string; facts: string; entity: string; sourceHref?: string; sources: { id: number; title: string; href: string }[] }

interface DocRow { id: number; docNo: string; title: string; description: string | null; status: string; categoryId: number | null; keywordsJson: string | null; extractedText: string | null; tagsJson: string | null; }

function scoreDoc(row: DocRow, qTokens: string[], semTerms: string[]): { score: number; specificity: number; snippet: string } {
  const title = norm(row.title);
  const keywords = arr(row.keywordsJson).map(norm);
  const tags = arr(row.tagsJson).map(norm);
  const body = norm(row.extractedText ?? "").slice(0, 60000);
  const desc = norm(row.description ?? "");
  let score = 0;
  // specificity = how many DISTINCT query tokens hit the title/keywords/tags (the "aboutness"
  // signal). A single shared word (e.g. "sales") appearing only in the body is NOT specific.
  let specificity = 0;
  for (const t of qTokens) {
    const inTitle = title.includes(t), inKw = keywords.includes(t) || tags.includes(t);
    if (inTitle) score += 6;
    if (desc.includes(t)) score += 2;
    if (keywords.includes(t)) score += 4;
    if (tags.includes(t)) score += 4;
    const occ = body.split(t).length - 1;
    if (occ > 0) score += Math.min(occ, 8);
    if (inTitle || inKw) specificity += 1;
  }
  for (const s of semTerms) { if (title.includes(s) || body.includes(s)) score += 3; }
  // Build a snippet around the first query hit in the body.
  let snippet = "";
  const hitTok = qTokens.find((t) => body.includes(t));
  if (hitTok) {
    const at = body.indexOf(hitTok);
    const raw = (row.extractedText ?? "").slice(Math.max(0, at - 120), at + 240).replace(/\s+/g, " ").trim();
    snippet = (at > 120 ? "…" : "") + raw + "…";
  } else {
    snippet = (row.description || row.extractedText || "").slice(0, 200).replace(/\s+/g, " ").trim();
  }
  return { score, specificity, snippet };
}

/** Rank documents for a query. `statuses` restricts by lifecycle (default: everything but Deleted). */
export async function searchDocuments(scope: ActiveScope, query: string, opts?: { limit?: number; statuses?: string[]; categoryId?: number }): Promise<DocHit[]> {
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  const semTerms = (await resolveTerms(scope.tenantId, query).catch(() => [])).map((m) => norm(m.term)).filter(Boolean);
  const where = scopeWhere(scope, { branch: true }) as Prisma.DocumentWhereInput;
  const statuses = opts?.statuses ?? ["Draft", "Review", "Approved", "Published", "Archived"];
  const rows = await prisma.document.findMany({
    where: { ...where, status: { in: statuses }, ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}) },
    select: { id: true, docNo: true, title: true, description: true, status: true, categoryId: true, keywordsJson: true, extractedText: true, tagsJson: true },
    take: 400, orderBy: { updatedAt: "desc" },
  }).catch(() => [] as DocRow[]);
  const scored = rows.map((r) => { const { score, specificity, snippet } = scoreDoc(r as DocRow, qTokens, semTerms); return { r: r as DocRow, score, specificity, snippet }; })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts?.limit ?? 10);
  return scored.map((x) => ({ id: x.r.id, docNo: x.r.docNo, title: x.r.title, category: null, status: x.r.status, score: x.score, specificity: x.specificity, snippet: x.snippet, href: `/ai/documents?doc=${x.r.id}` }));
}

/** Retrieve the best chunks of a single document for a question (used by doc chat). */
export async function retrieveChunks(scope: ActiveScope, documentId: number, question: string, limit = 4): Promise<string[]> {
  const qTokens = tokenize(question);
  const chunks = await prisma.docChunk.findMany({ where: { tenantId: scope.tenantId, documentId }, orderBy: { chunkNo: "asc" }, select: { text: true } }).catch(() => []);
  if (!chunks.length) return [];
  if (!qTokens.length) return chunks.slice(0, limit).map((c) => c.text);
  const scored = chunks.map((c) => { const b = norm(c.text); let s = 0; for (const t of qTokens) s += b.split(t).length - 1; return { text: c.text, s }; });
  const top = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.text);
  return top.length ? top : chunks.slice(0, limit).map((c) => c.text);
}

/**
 * COPILOT BRIDGE — retrieve document knowledge for a free-text question and shape it as
 * a grounded answer the orchestrator can use (facts injected into the prompt; text is
 * the offline fallback). Returns null when nothing relevant is found so the copilot
 * falls through to the general model.
 */
export async function resolveDocs(scope: ActiveScope, message: string): Promise<DocsAnswer | null> {
  if ((message || "").trim().length < 4) return null;
  const hits = await searchDocuments(scope, message, { limit: 4 }).catch(() => []);
  // Runs FIRST in the copilot pipeline, so require a genuinely strong AND specific match:
  // a high score plus ≥2 distinct query tokens hitting the title/keywords. This stops a
  // single shared word (e.g. "sales" appearing in a policy) from hijacking a BI question.
  const strong = hits.filter((h) => h.score >= 12 && h.specificity >= 2);
  if (!strong.length) return null;

  // Pull the single best chunk from the top document for a focused excerpt.
  const top = strong[0];
  const chunks = await retrieveChunks(scope, top.id, message, 2);
  const excerpt = (chunks[0] || top.snippet || "").slice(0, 600);

  const sources = strong.map((h) => ({ id: h.id, title: h.title, href: h.href }));
  const facts = strong.map((h) => `Document "${h.title}" (${h.docNo}, ${h.status}): ${h.snippet}`).join(" | ").slice(0, 1800);
  const text = [
    `Based on your documents, here's what I found:`,
    ``,
    `**${top.title}** (${top.docNo})`,
    excerpt ? `> ${excerpt.replace(/\n+/g, " ")}` : "",
    strong.length > 1 ? `\nOther related documents: ${strong.slice(1).map((h) => `**${h.title}**`).join(", ")}.` : "",
    `\n_Open the Document Library to read the full document._`,
  ].filter(Boolean).join("\n");

  return { text, facts: `KNOWLEDGE BASE (uploaded documents) — ${facts}`, entity: "Docs.knowledge", sourceHref: top.href, sources };
}
