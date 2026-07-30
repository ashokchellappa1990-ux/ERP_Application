import { prisma } from "@/lib/db/prisma";
import path from "path";
import { readFile } from "fs/promises";
import type { ActiveScope } from "@/lib/auth/scope";
import type { AiActor } from "@/lib/ai/types";
import { callClaude, callClaudeVision } from "@/lib/ai/claudeClient";
import { getAiSettings } from "@/lib/ai/config";
import { extractEntities } from "./indexer";
import { retrieveChunks } from "./retrieval";
import type { DocSummary, DocDiff, OcrResult } from "./types";
import { IMAGE_EXTS } from "./types";
import { extOf } from "./extract";

/**
 * DOCUMENT AI OPERATIONS (Modules 5,6,7,3,11,10) — chat, summarise, compare, OCR,
 * translate, FAQ. Every op goes through the single Claude gateway with a deterministic
 * fallback so the platform works with or without an API key, logs to doc_ai_queries for
 * audit + analytics, and never posts to any ERP ledger.
 */

const settingsFor = (tenantId: number) => getAiSettings(tenantId);

async function logQuery(scope: ActiveScope, actor: AiActor | null, docId: number | null, kind: string, query: string, answer: string, model: string, status: string, latencyMs: number, tokensOut: number) {
  try {
    await prisma.docAiQuery.create({ data: { tenantId: scope.tenantId, businessId: scope.businessId, branchId: scope.branchId, userId: actor?.id ?? null, documentId: docId, scope: kind, query: query.slice(0, 4000), answer: answer.slice(0, 60000), model, status, latencyMs, tokensOut } });
  } catch { /* analytics logging must never break a response */ }
}

const splitSentences = (t: string) => (t || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 20);
const pick = (sents: string[], re: RegExp, n: number) => [...new Set(sents.filter((s) => re.test(s)))].slice(0, n);

async function loadDoc(scope: ActiveScope, documentId: number) {
  return prisma.document.findFirst({ where: { tenantId: scope.tenantId, id: documentId }, select: { id: true, title: true, docNo: true, fileName: true, fileUrl: true, extractedText: true, ocrText: true, language: true, entitiesJson: true } });
}

// ----------------------------------------------------------------- CHAT (M5)
export async function chatWithDoc(scope: ActiveScope, actor: AiActor | null, documentId: number, question: string): Promise<{ answer: string; status: string; model: string; sources: string[] }> {
  const started = Date.now();
  const doc = await loadDoc(scope, documentId);
  if (!doc) return { answer: "Document not found.", status: "error", model: "none", sources: [] };
  const chunks = await retrieveChunks(scope, documentId, question, 5);
  const context = (chunks.join("\n---\n") || doc.extractedText || doc.ocrText || "").slice(0, 12000);
  if (!context.trim()) return { answer: "This document has no readable text yet. If it's a scan/image, run OCR first.", status: "empty", model: "none", sources: [] };
  const s = await settingsFor(scope.tenantId);
  const fallback = `From **${doc.title}**:\n\n> ${(chunks[0] || context).slice(0, 700).replace(/\n+/g, " ")}…\n\n_(Connect a Claude API key for a phrased answer; this is the most relevant passage.)_`;
  const res = await callClaude({
    system: `You are an enterprise document assistant. Answer the user's question ONLY from the provided document excerpts. If the answer isn't present, say so plainly. Be concise and cite figures/dates/clauses exactly as written. Document: "${doc.title}" (${doc.docNo}).`,
    messages: [{ role: "user", content: `Document excerpts:\n${context}\n\nQuestion: ${question}` }],
    model: s.model, maxTokens: Math.min(s.maxTokens, 900), temperature: 0.2, timeoutMs: s.timeoutMs, maxRetries: s.maxRetries, tenantId: scope.tenantId, userId: actor?.id ?? null, operation: "chat", fallback,
  });
  await logQuery(scope, actor, documentId, "chat", question, res.text, res.model, res.status, Date.now() - started, res.tokensOut);
  return { answer: res.text, status: res.status, model: res.model, sources: chunks.slice(0, 3) };
}

// -------------------------------------------------------------- SUMMARY (M6)
export async function summarizeDoc(scope: ActiveScope, actor: AiActor | null, documentId: number, kind = "executive"): Promise<DocSummary> {
  const started = Date.now();
  const doc = await loadDoc(scope, documentId);
  const text = (doc?.extractedText || doc?.ocrText || "").trim();
  const ent = extractEntities(text);
  const sents = splitSentences(text);
  const keyPoints = sents.slice(0, 6);
  const risks = pick(sents, /\b(risk|penalt|liabilit|breach|terminat|default|indemnif|dispute|forfeit|late fee|non-?compliance)\b/i, 6);
  const clauses = pick(sents, /\b(shall|must|agree|warrant|govern|jurisdiction|confidential|renew|notice period|payment term|cancellation|arbitrat)\b/i, 8);
  const compliance = pick(sents, /\b(gst|tds|tcs|statutory|regulation|\bact\b|complian|law|audit|filing|return)\b/i, 6);
  const actions = pick(sents, /\b(renew|expire|expiry|due|deadline|submit|pay|before|within \d+ days|action required)\b/i, 6);

  const s = await settingsFor(scope.tenantId);
  let narrative = ""; let generatedBy: "ai" | "fallback" = "fallback"; let model = "fallback"; let statusOut = "fallback";
  if (text) {
    const res = await callClaude({
      system: `You are an enterprise document analyst. Produce a clear ${kind} summary of the document. Start with a 2-3 sentence overview, then 4-6 bullet key points, then any risks and recommended actions. Plain markdown only.`,
      messages: [{ role: "user", content: text.slice(0, 14000) }],
      model: s.model, maxTokens: Math.min(s.maxTokens, 1000), temperature: 0.3, timeoutMs: s.timeoutMs, maxRetries: s.maxRetries, tenantId: scope.tenantId, userId: actor?.id ?? null, operation: "chat",
      fallback: keyPoints.length ? `${sents.slice(0, 2).join(" ")}\n\nKey points:\n${keyPoints.map((k) => `- ${k}`).join("\n")}` : "No readable text to summarise.",
    });
    narrative = res.text; model = res.model; statusOut = res.status; generatedBy = res.status === "success" ? "ai" : "fallback";
    await logQuery(scope, actor, documentId, "summary", `summary:${kind}`, res.text, res.model, res.status, Date.now() - started, res.tokensOut);
  }
  const executive = (splitSentences(narrative).slice(0, 2).join(" ")) || sents.slice(0, 2).join(" ") || "No summary available.";
  return {
    kind, executive, detailed: narrative || keyPoints.map((k) => `- ${k}`).join("\n"),
    keyPoints, risks, importantDates: ent.dates, importantAmounts: ent.amounts, importantClauses: clauses,
    complianceNotes: compliance, recommendedActions: actions, generatedBy,
  };
}

// ------------------------------------------------------------ COMPARISON (M7)
export async function compareDocs(scope: ActiveScope, actor: AiActor | null, leftId: number, rightId: number): Promise<DocDiff> {
  const started = Date.now();
  const [a, b] = await Promise.all([loadDoc(scope, leftId), loadDoc(scope, rightId)]);
  const at = (a?.extractedText || a?.ocrText || "").trim();
  const bt = (b?.extractedText || b?.ocrText || "").trim();
  const { diffLines } = await import("diff");
  const parts = diffLines(at, bt);
  const added: string[] = []; const removed: string[] = [];
  for (const p of parts) {
    const lines = p.value.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 3);
    if (p.added) added.push(...lines);
    else if (p.removed) removed.push(...lines);
  }
  // Pair near-matches as "modified" (a removed line that has a similar added line).
  const modified: { before: string; after: string }[] = [];
  const remLeft = [...removed]; const addLeft = [...added];
  const sim = (x: string, y: string) => { const xs = new Set(x.toLowerCase().split(/\s+/)); const ys = y.toLowerCase().split(/\s+/); const common = ys.filter((w) => xs.has(w)).length; return common / Math.max(xs.size, ys.length, 1); };
  for (const r of [...remLeft]) {
    const match = addLeft.find((ad) => sim(r, ad) >= 0.5);
    if (match) { modified.push({ before: r, after: match }); remLeft.splice(remLeft.indexOf(r), 1); addLeft.splice(addLeft.indexOf(match), 1); }
  }
  const totalLines = Math.max(1, (at.split(/\n/).length + bt.split(/\n/).length) / 2);
  const similarity = Math.round(Math.max(0, 1 - (addLeft.length + remLeft.length + modified.length) / totalLines) * 100);

  let narrative = `${addLeft.length} addition(s), ${remLeft.length} removal(s), ${modified.length} modification(s). ~${similarity}% unchanged.`;
  let generatedBy: "ai" | "fallback" = "fallback";
  const s = await settingsFor(scope.tenantId);
  if (at && bt && (addLeft.length || remLeft.length || modified.length)) {
    const res = await callClaude({
      system: "You compare two versions of an enterprise document. Summarise the material differences in 3-5 bullets: what was added, removed, and how terms/amounts/dates changed. Plain markdown.",
      messages: [{ role: "user", content: `ADDED:\n${addLeft.slice(0, 40).join("\n")}\n\nREMOVED:\n${remLeft.slice(0, 40).join("\n")}\n\nMODIFIED:\n${modified.slice(0, 30).map((m) => `- "${m.before}" -> "${m.after}"`).join("\n")}` }],
      model: s.model, maxTokens: Math.min(s.maxTokens, 700), temperature: 0.3, timeoutMs: s.timeoutMs, maxRetries: s.maxRetries, tenantId: scope.tenantId, userId: actor?.id ?? null, operation: "chat", fallback: narrative,
    });
    narrative = res.text; generatedBy = res.status === "success" ? "ai" : "fallback";
    await logQuery(scope, actor, leftId, "compare", `compare:${leftId}-${rightId}`, res.text, res.model, res.status, Date.now() - started, res.tokensOut);
  }
  return { added: addLeft.slice(0, 60), removed: remLeft.slice(0, 60), modified: modified.slice(0, 60), stats: { added: addLeft.length, removed: remLeft.length, modified: modified.length, similarity }, narrative, generatedBy };
}

// ------------------------------------------------------------ FAQ (M10)
export async function generateFaqs(scope: ActiveScope, actor: AiActor | null, documentId: number, count = 10): Promise<{ items: { question: string; answer: string }[]; generatedBy: "ai" | "fallback" }> {
  const started = Date.now();
  const doc = await loadDoc(scope, documentId);
  const text = (doc?.extractedText || doc?.ocrText || "").trim();
  if (!text) return { items: [], generatedBy: "fallback" };
  const s = await settingsFor(scope.tenantId);
  const res = await callClaude({
    system: `You generate frequently asked questions from an enterprise document (policy/SOP/contract). Produce up to ${count} concise Q&A pairs a staff member would ask. Format EXACTLY as lines: "Q: ...\\nA: ..." separated by a blank line. Answer only from the document.`,
    messages: [{ role: "user", content: text.slice(0, 14000) }],
    model: s.model, maxTokens: Math.min(s.maxTokens, 1200), temperature: 0.4, timeoutMs: s.timeoutMs, maxRetries: s.maxRetries, tenantId: scope.tenantId, userId: actor?.id ?? null, operation: "chat",
    fallback: "",
  });
  await logQuery(scope, actor, documentId, "faq", `faq:${count}`, res.text, res.model, res.status, Date.now() - started, res.tokensOut);
  const items: { question: string; answer: string }[] = [];
  if (res.status === "success" && res.text) {
    const blocks = res.text.split(/\n\s*\n/);
    for (const b of blocks) {
      const q = /Q:\s*(.+)/i.exec(b); const a = /A:\s*([\s\S]+)/i.exec(b);
      if (q && a) items.push({ question: q[1].trim(), answer: a[1].trim().replace(/^Q:.*/im, "").trim() });
    }
  }
  if (items.length) return { items: items.slice(0, count), generatedBy: "ai" };
  // Deterministic fallback: derive Q&A from key sentences.
  const sents = splitSentences(text).slice(0, count);
  const fb = sents.map((s2) => {
    const topic = s2.split(/\s+/).slice(0, 6).join(" ");
    return { question: `What does the document say about ${topic.toLowerCase()}…?`, answer: s2 };
  });
  return { items: fb, generatedBy: "fallback" };
}

// ------------------------------------------------------ TRANSLATION (M11)
export async function translateDoc(scope: ActiveScope, actor: AiActor | null, documentId: number, targetLang: string, langLabel: string): Promise<{ text: string; status: string; model: string }> {
  const started = Date.now();
  const doc = await loadDoc(scope, documentId);
  const text = (doc?.extractedText || doc?.ocrText || "").trim();
  if (!text) return { text: "No readable text to translate.", status: "empty", model: "none" };
  const s = await settingsFor(scope.tenantId);
  const res = await callClaude({
    system: `You are a professional translator. Translate the document into ${langLabel}. Preserve structure, headings, numbering and figures. Output only the translation.`,
    messages: [{ role: "user", content: text.slice(0, 14000) }],
    model: s.model, maxTokens: Math.min(s.maxTokens, 2000), temperature: 0.2, timeoutMs: s.timeoutMs, maxRetries: s.maxRetries, tenantId: scope.tenantId, userId: actor?.id ?? null, operation: "chat",
    fallback: `Translation to ${langLabel} needs a connected Claude API key. Add ANTHROPIC_API_KEY in AI Settings to enable document translation.`,
  });
  await logQuery(scope, actor, documentId, "translate", `translate:${targetLang}`, res.text, res.model, res.status, Date.now() - started, res.tokensOut);
  if (res.status === "success") {
    try { await prisma.docTranslation.create({ data: { tenantId: scope.tenantId, documentId, targetLang, translatedText: res.text, status: "completed", model: res.model, createdBy: actor?.id ?? null } }); } catch { /* cache best-effort */ }
  }
  return { text: res.text, status: res.status, model: res.model };
}

// ------------------------------------------------------------- OCR (M3)
export async function ocrDocument(scope: ActiveScope, actor: AiActor | null, documentId: number): Promise<OcrResult> {
  const started = Date.now();
  const doc = await loadDoc(scope, documentId);
  if (!doc) return { status: "failed", text: "", fields: {}, engine: "none", note: "Document not found." };
  const ext = extOf(doc.fileName);
  const isImage = IMAGE_EXTS.includes(ext) || ext === "pdf";
  if (!isImage) return { status: "failed", text: "", fields: {}, engine: "none", note: "OCR applies to images/scanned PDFs only." };

  let job = await prisma.docOcrJob.create({ data: { tenantId: scope.tenantId, documentId, status: "processing", engine: "claude-vision", createdBy: actor?.id ?? null } }).catch(() => null);
  const finalize = async (r: OcrResult) => {
    if (job) await prisma.docOcrJob.update({ where: { id: job.id }, data: { status: r.status, extractedText: r.text, fieldsJson: JSON.stringify(r.fields), error: r.note ?? null, completedAt: new Date() } }).catch(() => {});
    await prisma.document.update({ where: { id: documentId }, data: { ocrStatus: r.status === "completed" ? "completed" : r.status === "pending" ? "pending" : "failed", ocrText: r.text || undefined } }).catch(() => {});
    await logQuery(scope, actor, documentId, "ocr", "ocr", r.text.slice(0, 2000), r.engine, r.status, Date.now() - started, 0);
    return r;
  };

  // Only images can be sent to the vision model (PDF scans need rasterising — deferred).
  if (ext === "pdf") return finalize({ status: "pending", text: "", fields: {}, engine: "claude-vision", note: "Scanned-PDF OCR needs page rasterisation (deferred). Upload page images to OCR now." });

  let buffer: Buffer;
  try { buffer = await readFile(path.join(process.cwd(), "public", doc.fileUrl.replace(/^\//, ""))); }
  catch { return finalize({ status: "failed", text: "", fields: {}, engine: "claude-vision", note: "Stored file could not be read." }); }

  const mediaType = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
  const vision = await callClaudeVision({
    system: "You are an OCR + document understanding engine. Transcribe ALL text from the image, then extract key fields. Respond as: first the full transcription, then a line '---FIELDS---', then JSON with keys invoiceNo,poNo,supplier,customer,amount,gst,date,items(array). Use empty string when a field is absent.",
    prompt: "Extract the text and fields from this document image.",
    images: [{ base64: buffer.toString("base64"), mediaType }],
    model: (await settingsFor(scope.tenantId)).model, maxTokens: 1500, tenantId: scope.tenantId, userId: actor?.id ?? null,
  });
  if (vision.status !== "success") {
    return finalize({ status: "pending", text: "", fields: {}, engine: "claude-vision", note: vision.status === "fallback" ? "OCR needs a Claude API key (vision). Add ANTHROPIC_API_KEY in AI Settings." : `OCR failed: ${vision.error ?? "error"}` });
  }
  const [rawText, fieldsPart] = vision.text.split(/---FIELDS---/);
  let fields: OcrResult["fields"] = {};
  try { const j = JSON.parse((fieldsPart || "").match(/\{[\s\S]*\}/)?.[0] ?? "{}"); fields = { invoiceNo: j.invoiceNo, poNo: j.poNo, supplier: j.supplier, customer: j.customer, amount: j.amount, gst: j.gst, date: j.date, items: Array.isArray(j.items) ? j.items.map(String) : [] }; } catch { /* keep text */ }
  return finalize({ status: "completed", text: (rawText || vision.text).trim(), fields, engine: "claude-vision" });
}
