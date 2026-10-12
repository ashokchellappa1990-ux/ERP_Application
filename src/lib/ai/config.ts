import { prisma } from "@/lib/db/prisma";

/**
 * AI configuration accessor (Module 12 — AI Configuration). Resolves the effective
 * settings for a tenant: a per-tenant override row falls back to the global default
 * (tenantId null), which falls back to hard defaults. The Anthropic API key is NEVER
 * stored in the DB — it comes only from the ANTHROPIC_API_KEY environment variable.
 */

export interface AiSettingsView {
  enabled: boolean;
  provider: string;
  model: string;
  maxTokens: number;
  temperature: number;
  streaming: boolean;
  systemPrompt: string | null;
  dailyTokenLimit: number | null;
  retentionDays: number | null;
  timeoutMs: number;
  maxRetries: number;
  apiKeyPresent: boolean; // derived from env, never persisted
}

const DEFAULTS: Omit<AiSettingsView, "apiKeyPresent"> = {
  enabled: true, provider: "claude", model: "claude-sonnet-4-6", maxTokens: 1024, temperature: 0.3,
  streaming: true, systemPrompt: null, dailyTokenLimit: null, retentionDays: 90, timeoutMs: 30000, maxRetries: 2,
};

/** True if an API key is available from the environment (checked without a DB round-trip). */
export function apiKeyPresent(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
}

/** The effective Anthropic key: the ANTHROPIC_API_KEY env var takes precedence, else the
 *  key saved in the global AI settings row (entered via Platform → AI Platform). */
export async function resolveApiKey(): Promise<string | null> {
  const env = process.env.ANTHROPIC_API_KEY?.trim();
  if (env) return env;
  const row = await prisma.aiSettings.findFirst({ where: { tenantId: null }, select: { apiKey: true } }).catch(() => null);
  const stored = row?.apiKey?.trim();
  return stored || null;
}

export async function hasApiKey(): Promise<boolean> {
  return !!(await resolveApiKey());
}

/** Where the active key comes from — for the platform UI to explain the status. */
export async function apiKeySource(): Promise<"env" | "stored" | "none"> {
  if (apiKeyPresent()) return "env";
  const row = await prisma.aiSettings.findFirst({ where: { tenantId: null }, select: { apiKey: true } }).catch(() => null);
  return row?.apiKey?.trim() ? "stored" : "none";
}

/** Save or clear the stored Anthropic key on the global settings row. */
export async function setApiKey(key: string | null) {
  const clean = key?.trim() || null;
  const existing = await prisma.aiSettings.findFirst({ where: { tenantId: null } });
  if (existing) return prisma.aiSettings.update({ where: { id: existing.id }, data: { apiKey: clean } });
  return prisma.aiSettings.create({ data: { tenantId: null, apiKey: clean } });
}

export async function getAiSettings(tenantId?: number | null): Promise<AiSettingsView> {
  const rows = await prisma.aiSettings.findMany({ where: tenantId != null ? { OR: [{ tenantId }, { tenantId: null }] } : { tenantId: null } }).catch(() => []);
  // Prefer the tenant-specific row, else the global row.
  const row = rows.find((r) => r.tenantId === tenantId) ?? rows.find((r) => r.tenantId == null) ?? null;
  const s = row
    ? {
        enabled: row.enabled, provider: row.provider, model: row.model, maxTokens: row.maxTokens, temperature: Number(row.temperature),
        streaming: row.streaming, systemPrompt: row.systemPrompt, dailyTokenLimit: row.dailyTokenLimit, retentionDays: row.retentionDays,
        timeoutMs: row.timeoutMs, maxRetries: row.maxRetries,
      }
    : DEFAULTS;
  return { ...s, apiKeyPresent: await hasApiKey() };
}

/** Upsert the global (or tenant) settings row. */
export async function saveAiSettings(tenantId: number | null, patch: Partial<Omit<AiSettingsView, "apiKeyPresent">>) {
  const existing = await prisma.aiSettings.findFirst({ where: { tenantId } });
  const data = {
    enabled: patch.enabled, provider: patch.provider, model: patch.model, maxTokens: patch.maxTokens,
    temperature: patch.temperature, streaming: patch.streaming, systemPrompt: patch.systemPrompt ?? null,
    dailyTokenLimit: patch.dailyTokenLimit ?? null, retentionDays: patch.retentionDays ?? null,
    timeoutMs: patch.timeoutMs, maxRetries: patch.maxRetries,
  };
  // Strip undefined so a partial patch doesn't overwrite with null.
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  if (existing) return prisma.aiSettings.update({ where: { id: existing.id }, data: clean });
  return prisma.aiSettings.create({ data: { tenantId, ...clean } });
}
