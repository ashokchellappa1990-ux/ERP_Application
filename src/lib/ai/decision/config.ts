import { prisma } from "@/lib/db/prisma";

/**
 * AI MODEL MANAGER (Module: AI Model Manager) — per-tenant configuration of the decision
 * engine: default forecast horizon + method, per-metric method overrides, health weights,
 * risk thresholds and enable flags. (Deterministic statistical models — this selects the
 * method, it does not train a neural net.)
 */

export interface ModelConfig {
  defaultHorizon: number;
  defaultMethod: "auto" | "linear" | "moving" | "seasonal";
  methods: Record<string, string>;      // metricKey → method override
  thresholds: { budgetWarn: number; lowStockAlert: number; receivableDays: number };
  enabled: { predictions: boolean; risks: boolean; opportunities: boolean; notifications: boolean };
}

const DEFAULTS: ModelConfig = {
  defaultHorizon: 30, defaultMethod: "auto", methods: {},
  thresholds: { budgetWarn: 90, lowStockAlert: 1, receivableDays: 30 },
  enabled: { predictions: true, risks: true, opportunities: true, notifications: true },
};

export async function getModelConfig(tenantId: number): Promise<ModelConfig> {
  const row = await prisma.aiModelConfig.findUnique({ where: { tenantId } }).catch(() => null);
  if (!row) return DEFAULTS;
  let extra: Partial<ModelConfig> = {};
  try { extra = row.configJson ? JSON.parse(row.configJson) : {}; } catch { /* keep defaults */ }
  return {
    defaultHorizon: row.defaultHorizon ?? DEFAULTS.defaultHorizon,
    defaultMethod: (row.defaultMethod as ModelConfig["defaultMethod"]) ?? DEFAULTS.defaultMethod,
    methods: extra.methods ?? {}, thresholds: { ...DEFAULTS.thresholds, ...(extra.thresholds ?? {}) },
    enabled: { ...DEFAULTS.enabled, ...(extra.enabled ?? {}) },
  };
}

export type ModelConfigPatch = {
  defaultHorizon?: number; defaultMethod?: ModelConfig["defaultMethod"]; methods?: Record<string, string>;
  thresholds?: Partial<ModelConfig["thresholds"]>; enabled?: Partial<ModelConfig["enabled"]>;
};

export async function saveModelConfig(tenantId: number, userId: number, patch: ModelConfigPatch): Promise<ModelConfig> {
  const cur = await getModelConfig(tenantId);
  const next: ModelConfig = {
    defaultHorizon: patch.defaultHorizon ?? cur.defaultHorizon,
    defaultMethod: patch.defaultMethod ?? cur.defaultMethod,
    methods: patch.methods ?? cur.methods,
    thresholds: { ...cur.thresholds, ...(patch.thresholds ?? {}) },
    enabled: { ...cur.enabled, ...(patch.enabled ?? {}) },
  };
  const configJson = JSON.stringify({ methods: next.methods, thresholds: next.thresholds, enabled: next.enabled });
  const existing = await prisma.aiModelConfig.findUnique({ where: { tenantId } });
  if (existing) await prisma.aiModelConfig.update({ where: { tenantId }, data: { defaultHorizon: next.defaultHorizon, defaultMethod: next.defaultMethod, configJson, updatedBy: userId } });
  else await prisma.aiModelConfig.create({ data: { tenantId, defaultHorizon: next.defaultHorizon, defaultMethod: next.defaultMethod, configJson, updatedBy: userId } });
  return next;
}
