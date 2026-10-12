import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ALLOWED_EXTS, SUPPORTED_LANGS } from "./types";

/** DOCUMENT INTELLIGENCE SETTINGS (Module: AI Settings) — per-tenant configuration. */

export interface DocSettingsView {
  maxFileSizeMb: number; allowedTypes: string[]; langs: string[];
  ocrEnabled: boolean; autoIndex: boolean; autoSummary: boolean; embeddingEnabled: boolean;
  defaultCategoryId: number | null; retentionDays: number | null;
}

const DEFAULTS: DocSettingsView = {
  maxFileSizeMb: 25, allowedTypes: DEFAULT_ALLOWED_EXTS, langs: SUPPORTED_LANGS.map((l) => l.code),
  ocrEnabled: true, autoIndex: true, autoSummary: false, embeddingEnabled: false, defaultCategoryId: null, retentionDays: null,
};

const arr = (s: string | null | undefined, fb: string[]): string[] => { if (!s) return fb; try { const a = JSON.parse(s); return Array.isArray(a) && a.length ? a.map(String) : fb; } catch { return fb; } };

export async function getDocSettings(tenantId: number): Promise<DocSettingsView> {
  const row = await prisma.docSettings.findUnique({ where: { tenantId } }).catch(() => null);
  if (!row) return DEFAULTS;
  return {
    maxFileSizeMb: row.maxFileSizeMb, allowedTypes: arr(row.allowedTypesJson, DEFAULTS.allowedTypes), langs: arr(row.langsJson, DEFAULTS.langs),
    ocrEnabled: row.ocrEnabled, autoIndex: row.autoIndex, autoSummary: row.autoSummary, embeddingEnabled: row.embeddingEnabled,
    defaultCategoryId: row.defaultCategoryId, retentionDays: row.retentionDays,
  };
}

export async function saveDocSettings(tenantId: number, userId: number, patch: Partial<DocSettingsView>) {
  const data: Record<string, unknown> = {};
  if (patch.maxFileSizeMb !== undefined) data.maxFileSizeMb = patch.maxFileSizeMb;
  if (patch.allowedTypes !== undefined) data.allowedTypesJson = JSON.stringify(patch.allowedTypes);
  if (patch.langs !== undefined) data.langsJson = JSON.stringify(patch.langs);
  if (patch.ocrEnabled !== undefined) data.ocrEnabled = patch.ocrEnabled;
  if (patch.autoIndex !== undefined) data.autoIndex = patch.autoIndex;
  if (patch.autoSummary !== undefined) data.autoSummary = patch.autoSummary;
  if (patch.embeddingEnabled !== undefined) data.embeddingEnabled = patch.embeddingEnabled;
  if (patch.defaultCategoryId !== undefined) data.defaultCategoryId = patch.defaultCategoryId;
  if (patch.retentionDays !== undefined) data.retentionDays = patch.retentionDays;
  data.updatedBy = userId;
  const existing = await prisma.docSettings.findUnique({ where: { tenantId } });
  if (existing) return prisma.docSettings.update({ where: { tenantId }, data });
  return prisma.docSettings.create({ data: { tenantId, ...data } });
}
