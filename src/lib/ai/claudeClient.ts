import { prisma } from "@/lib/db/prisma";
import { resolveApiKey } from "./config";
import type { ChatMessage, ClaudeResult } from "./types";

/**
 * MODULE 1 — CLAUDE CLIENT. The ONE and ONLY component that talks to the Claude API.
 * No ERP module or other engine may call Anthropic directly; everything goes through
 * `callClaude` / `streamClaude`. Responsibilities: authentication, API communication,
 * streaming, timeout, retry, error handling, logging, usage/token tracking, model
 * selection and graceful fallback when no API key is configured.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const estTokens = (s: string) => Math.max(1, Math.ceil((s || "").length / 4));

export interface ClaudeCallOptions {
  system: string;
  messages: ChatMessage[];
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs?: number;
  maxRetries?: number;
  tenantId?: number | null;
  userId?: number | null;
  operation?: "chat" | "stream" | "ping";
  /** Deterministic answer returned when Claude is not configured (no API key). */
  fallback?: string;
}

async function log(entry: { tenantId?: number | null; userId?: number | null; model: string; operation: string; promptTokens: number; completionTokens: number; latencyMs: number; retries: number; status: string; errorMessage?: string | null }) {
  try {
    await prisma.aiApiLog.create({ data: {
      tenantId: entry.tenantId ?? null, userId: entry.userId ?? null, model: entry.model, operation: entry.operation,
      promptTokens: entry.promptTokens, completionTokens: entry.completionTokens, totalTokens: entry.promptTokens + entry.completionTokens,
      latencyMs: entry.latencyMs, retries: entry.retries, status: entry.status, errorMessage: entry.errorMessage ?? null,
    } });
  } catch { /* logging must never break a response */ }
}

const now = () => Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Single, logged, retried, timed call to Claude. Returns text + usage + status. */
export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeResult> {
  const op = opts.operation ?? "chat";
  const promptTokens = estTokens(opts.system) + opts.messages.reduce((s, m) => s + estTokens(m.content), 0);
  const started = now();
  const apiKey = await resolveApiKey();

  // ---- Fallback mode: no API key configured. The platform stays fully functional;
  // it returns a deterministic, explainable answer and is logged as "fallback".
  if (!apiKey) {
    const text = opts.fallback ?? "The AI copilot is not yet connected to Claude. Ask your administrator to add an ANTHROPIC_API_KEY in the platform AI settings to enable full answers.";
    const latencyMs = now() - started;
    await log({ tenantId: opts.tenantId, userId: opts.userId, model: opts.model, operation: op, promptTokens, completionTokens: estTokens(text), latencyMs, retries: 0, status: "fallback" });
    return { text, model: opts.model, status: "fallback", tokensIn: promptTokens, tokensOut: estTokens(text), latencyMs, retries: 0 };
  }

  const maxRetries = opts.maxRetries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 30000;
  let lastErr = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST", signal: ctrl.signal,
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
        body: JSON.stringify({ model: opts.model, max_tokens: opts.maxTokens, temperature: opts.temperature, system: opts.system, messages: opts.messages.map((m) => ({ role: m.role === "system" ? "user" : m.role, content: m.content })) }),
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) { lastErr = `HTTP ${res.status}`; if (attempt < maxRetries) { await sleep(400 * (attempt + 1)); continue; } }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastErr = `HTTP ${res.status} ${body.slice(0, 160)}`;
        break;
      }
      const data = await res.json() as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number }; model?: string };
      const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim();
      const latencyMs = now() - started;
      const tokensIn = data.usage?.input_tokens ?? promptTokens;
      const tokensOut = data.usage?.output_tokens ?? estTokens(text);
      await log({ tenantId: opts.tenantId, userId: opts.userId, model: data.model ?? opts.model, operation: op, promptTokens: tokensIn, completionTokens: tokensOut, latencyMs, retries: attempt, status: "success" });
      return { text, model: data.model ?? opts.model, status: "success", tokensIn, tokensOut, latencyMs, retries: attempt };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e instanceof Error ? (e.name === "AbortError" ? `timeout after ${timeoutMs}ms` : e.message) : "network error";
      if (attempt < maxRetries) { await sleep(400 * (attempt + 1)); continue; }
    }
  }
  const latencyMs = now() - started;
  await log({ tenantId: opts.tenantId, userId: opts.userId, model: opts.model, operation: op, promptTokens, completionTokens: 0, latencyMs, retries: maxRetries, status: "error", errorMessage: lastErr });
  return { text: `The AI service is temporarily unavailable (${lastErr}). Please try again.`, model: opts.model, status: "error", tokensIn: promptTokens, tokensOut: 0, latencyMs, retries: maxRetries, error: lastErr };
}

export interface ClaudeVisionOptions {
  system: string;
  prompt: string;
  images: { base64: string; mediaType: string }[];
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  tenantId?: number | null;
  userId?: number | null;
}

/**
 * VISION variant — sends image(s) + a prompt for OCR / document understanding. Used ONLY
 * by the Document Intelligence OCR path; still the single gateway (auth/logging/fallback).
 * Returns status "fallback" (no work done) when no API key is configured.
 */
export async function callClaudeVision(opts: ClaudeVisionOptions): Promise<ClaudeResult> {
  const started = now();
  const apiKey = await resolveApiKey();
  const promptTokens = estTokens(opts.system) + estTokens(opts.prompt) + opts.images.length * 800;
  if (!apiKey) {
    const latencyMs = now() - started;
    await log({ tenantId: opts.tenantId, userId: opts.userId, model: opts.model, operation: "chat", promptTokens, completionTokens: 0, latencyMs, retries: 0, status: "fallback" });
    return { text: "", model: opts.model, status: "fallback", tokensIn: promptTokens, tokensOut: 0, latencyMs, retries: 0 };
  }
  const timeoutMs = opts.timeoutMs ?? 45000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const content = [
      ...opts.images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.mediaType, data: im.base64 } })),
      { type: "text", text: opts.prompt },
    ];
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST", signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
      body: JSON.stringify({ model: opts.model, max_tokens: opts.maxTokens ?? 1500, temperature: opts.temperature ?? 0.1, system: opts.system, messages: [{ role: "user", content }] }),
    });
    clearTimeout(timer);
    if (!res.ok) { const body = await res.text().catch(() => ""); throw new Error(`HTTP ${res.status} ${body.slice(0, 160)}`); }
    const data = await res.json() as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number }; model?: string };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim();
    const latencyMs = now() - started;
    const tokensIn = data.usage?.input_tokens ?? promptTokens;
    const tokensOut = data.usage?.output_tokens ?? estTokens(text);
    await log({ tenantId: opts.tenantId, userId: opts.userId, model: data.model ?? opts.model, operation: "chat", promptTokens: tokensIn, completionTokens: tokensOut, latencyMs, retries: 0, status: "success" });
    return { text, model: data.model ?? opts.model, status: "success", tokensIn, tokensOut, latencyMs, retries: 0 };
  } catch (e) {
    clearTimeout(timer);
    const err = e instanceof Error ? (e.name === "AbortError" ? `timeout after ${timeoutMs}ms` : e.message) : "vision error";
    const latencyMs = now() - started;
    await log({ tenantId: opts.tenantId, userId: opts.userId, model: opts.model, operation: "chat", promptTokens, completionTokens: 0, latencyMs, retries: 0, status: "error", errorMessage: err });
    return { text: "", model: opts.model, status: "error", tokensIn: promptTokens, tokensOut: 0, latencyMs, retries: 0, error: err };
  }
}

/** Streaming variant — yields text chunks. Falls back to a single chunk when Claude
 *  is unconfigured or streaming is unavailable. Logs a summary at the end. */
export async function* streamClaude(opts: ClaudeCallOptions): AsyncGenerator<string, ClaudeResult, unknown> {
  const apiKey = await resolveApiKey();
  if (!apiKey) {
    const res = await callClaude({ ...opts, operation: "stream" });
    // Emit the fallback answer in word chunks so the UI still "types".
    for (const w of res.text.split(/(\s+)/)) { yield w; }
    return res;
  }
  const promptTokens = estTokens(opts.system) + opts.messages.reduce((s, m) => s + estTokens(m.content), 0);
  const started = now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000);
  let full = "";
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST", signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
      body: JSON.stringify({ model: opts.model, max_tokens: opts.maxTokens, temperature: opts.temperature, system: opts.system, stream: true, messages: opts.messages.map((m) => ({ role: m.role === "system" ? "user" : m.role, content: m.content })) }),
    });
    clearTimeout(timer);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try { const ev = JSON.parse(payload); if (ev.type === "content_block_delta" && ev.delta?.text) { full += ev.delta.text; yield ev.delta.text as string; } } catch { /* ignore keep-alive */ }
      }
    }
    const latencyMs = now() - started; const tokensOut = estTokens(full);
    await log({ tenantId: opts.tenantId, userId: opts.userId, model: opts.model, operation: "stream", promptTokens, completionTokens: tokensOut, latencyMs, retries: 0, status: "success" });
    return { text: full, model: opts.model, status: "success", tokensIn: promptTokens, tokensOut, latencyMs, retries: 0 };
  } catch (e) {
    clearTimeout(timer);
    const err = e instanceof Error ? e.message : "stream error";
    const latencyMs = now() - started;
    await log({ tenantId: opts.tenantId, userId: opts.userId, model: opts.model, operation: "stream", promptTokens, completionTokens: estTokens(full), latencyMs, retries: 0, status: "error", errorMessage: err });
    const msg = full || `The AI service is temporarily unavailable (${err}).`;
    if (!full) yield msg;
    return { text: msg, model: opts.model, status: "error", tokensIn: promptTokens, tokensOut: estTokens(full), latencyMs, retries: 0, error: err };
  }
}

/** Lightweight connectivity probe for the health monitor. */
export async function pingClaude(): Promise<{ ok: boolean; latencyMs: number; detail: string }> {
  if (!(await resolveApiKey())) return { ok: false, latencyMs: 0, detail: "No API key configured (fallback mode)" };
  const r = await callClaude({ system: "Reply with the single word: OK", messages: [{ role: "user", content: "ping" }], model: "claude-haiku-4-5-20251001", maxTokens: 8, temperature: 0, operation: "ping", maxRetries: 0, timeoutMs: 8000 });
  return { ok: r.status === "success", latencyMs: r.latencyMs, detail: r.status === "success" ? "Reachable" : r.error ?? "Unreachable" };
}
