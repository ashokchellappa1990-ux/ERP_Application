import type { DocEntities } from "./types";

/**
 * DOCUMENT INDEXING (Module 4) — deterministic, key-free extraction of the search
 * metadata that makes a document findable and chat-able: keywords, structured entities
 * (dates/amounts/GSTIN/PO & invoice nos/emails), a one-line auto summary, and text
 * chunks for retrieval (RAG unit). No AI required; works entirely offline.
 */

const STOP = new Set("the a an and or of to in on for with is are was were be been being this that these those it its as at by from into over under out up down off above below then than so such not no nor only own same too very can will just should now his her their our your my we you they he she them us who whom which what when where why how all any both each few more most other some any if but because while during before after between through against about above across your".split(/\s+/));

export function extractKeywords(text: string, limit = 20): string[] {
  const freq = new Map<string, number>();
  for (const raw of (text || "").toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []) {
    if (STOP.has(raw) || raw.length > 30) continue;
    freq.set(raw, (freq.get(raw) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([w]) => w);
}

const uniq = (a: string[], n: number) => [...new Set(a.map((s) => s.trim()).filter(Boolean))].slice(0, n);

export function extractEntities(text: string): DocEntities {
  const t = text || "";
  const dates = uniq((t.match(/\b(\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3,9})[-/.]\d{2,4})\b|\b(?:\d{1,2}\s)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s?\d{0,2},?\s?\d{2,4}\b/gi) ?? []), 15);
  const amounts = uniq((t.match(/(?:₹|Rs\.?|INR|\$|USD|EUR|€)\s?[\d,]+(?:\.\d{1,2})?|\b[\d,]{4,}(?:\.\d{2})\b/gi) ?? []), 20);
  const gstins = uniq((t.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g) ?? []), 10);
  const emails = uniq((t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []), 10);
  const invoiceNos = uniq((t.match(/\b(?:invoice|inv|bill)\s*(?:no\.?|#|number)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/-]{2,20})/gi) ?? []).map((s) => s.replace(/\s+/g, " ")), 10);
  const poNos = uniq((t.match(/\b(?:P\.?O\.?|purchase\s*order)\s*(?:no\.?|#|number)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/-]{2,20})/gi) ?? []).map((s) => s.replace(/\s+/g, " ")), 10);
  const phones = uniq((t.match(/\b(?:\+?\d{1,3}[- ]?)?(?:\d{5}[- ]?\d{5}|\d{3}[- ]?\d{3}[- ]?\d{4}|\d{10})\b/g) ?? []), 8);
  // Party/organisation cues.
  const relationships = uniq((t.match(/\b[A-Z][A-Za-z&.]+(?:\s+[A-Z][A-Za-z&.]+){0,3}\s+(?:Ltd|Limited|Pvt|Private|LLP|Inc|Corp|Company|Enterprises|Industries|Traders|Solutions|Technologies|Services|Bank)\b/g) ?? []), 10);
  return { dates, amounts, gstins, emails, invoiceNos, poNos, phones, relationships };
}

/** A short auto title/summary when the user didn't supply one. */
export function autoSummary(text: string, max = 240): string {
  const firstPara = (text || "").split(/\n\s*\n/).map((s) => s.trim()).find((s) => s.length > 40) ?? (text || "").trim();
  const sentence = firstPara.split(/(?<=[.!?])\s+/)[0] ?? firstPara;
  const s = (sentence.length > 30 ? sentence : firstPara).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export function autoTitle(text: string, fileName: string): string {
  const firstLine = (text || "").split(/\r?\n/).map((s) => s.trim()).find((s) => s.length >= 6 && s.length <= 120);
  if (firstLine) return firstLine.replace(/\s+/g, " ");
  return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled document";
}

const estTokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

/** Split text into ~500-token windows on sentence/paragraph boundaries. */
export function chunkText(text: string, targetTokens = 500): { chunkNo: number; text: string; tokens: number }[] {
  const clean = (text || "").replace(/\r/g, "").trim();
  if (!clean) return [];
  const units = clean.split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
  const chunks: { chunkNo: number; text: string; tokens: number }[] = [];
  let buf: string[] = []; let bufTok = 0; let no = 0;
  const flush = () => { if (buf.length) { const t = buf.join(" "); chunks.push({ chunkNo: no++, text: t, tokens: estTokens(t) }); buf = []; bufTok = 0; } };
  for (const u of units) {
    const ut = estTokens(u);
    if (bufTok + ut > targetTokens && buf.length) flush();
    if (ut > targetTokens * 1.5) {
      // Very long unit — hard-split by words.
      const words = u.split(/\s+/); let cur: string[] = [];
      for (const w of words) { cur.push(w); if (estTokens(cur.join(" ")) >= targetTokens) { chunks.push({ chunkNo: no++, text: cur.join(" "), tokens: estTokens(cur.join(" ")) }); cur = []; } }
      if (cur.length) { buf.push(cur.join(" ")); bufTok += estTokens(cur.join(" ")); }
    } else { buf.push(u); bufTok += ut; }
  }
  flush();
  return chunks.slice(0, 400); // safety cap
}

export interface IndexResult { keywords: string[]; entities: DocEntities; summary: string; title: string }

export function indexDocument(text: string, fileName: string): IndexResult {
  return { keywords: extractKeywords(text), entities: extractEntities(text), summary: autoSummary(text), title: autoTitle(text, fileName) };
}
