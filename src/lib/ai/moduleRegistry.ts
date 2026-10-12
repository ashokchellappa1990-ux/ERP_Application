import { prisma } from "@/lib/db/prisma";

/**
 * MODULE 4 — AI MODULE REGISTRY. Every ERP module registers metadata here; a NEW module
 * becomes AI-enabled just by adding a registry row (no AI code changes). Global rows
 * (tenantId null) ship with the platform; tenants may add/override their own.
 */

export interface RegisteredModule {
  moduleKey: string; name: string; description: string | null; menu: string | null;
  businessTerms: string[]; kpis: string[]; questions: string[]; actions: string[];
  permissions: string[]; tables: string[]; relationships: string[]; enabled: boolean;
}

const arr = (s: string | null): string[] => { if (!s) return []; try { const a = JSON.parse(s); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };

export async function listModules(tenantId: number, onlyEnabled = true): Promise<RegisteredModule[]> {
  const rows = await prisma.aiModuleRegistry.findMany({ where: { OR: [{ tenantId }, { tenantId: null }], ...(onlyEnabled ? { enabled: true } : {}) }, orderBy: { name: "asc" } }).catch(() => []);
  // Tenant override wins over the global row with the same key.
  const byKey = new Map<string, RegisteredModule>();
  for (const r of rows.sort((a, b) => (a.tenantId ?? -1) - (b.tenantId ?? -1))) {
    byKey.set(r.moduleKey, { moduleKey: r.moduleKey, name: r.name, description: r.description, menu: r.menu, businessTerms: arr(r.businessTerms), kpis: arr(r.kpis), questions: arr(r.questions), actions: arr(r.actions), permissions: arr(r.permissions), tables: arr(r.tables), relationships: arr(r.relationships), enabled: r.enabled });
  }
  return [...byKey.values()];
}

export async function getModules(tenantId: number, keys: string[]): Promise<RegisteredModule[]> {
  if (!keys.length) return [];
  const all = await listModules(tenantId);
  return all.filter((m) => keys.includes(m.moduleKey));
}

/** Register or update a module's metadata (used by platform config + seeding). */
export async function registerModule(tenantId: number | null, m: Partial<RegisteredModule> & { moduleKey: string; name: string }) {
  const data = {
    name: m.name, description: m.description ?? null, menu: m.menu ?? null,
    businessTerms: JSON.stringify(m.businessTerms ?? []), kpis: JSON.stringify(m.kpis ?? []), questions: JSON.stringify(m.questions ?? []),
    actions: JSON.stringify(m.actions ?? []), permissions: JSON.stringify(m.permissions ?? []), tables: JSON.stringify(m.tables ?? []),
    relationships: JSON.stringify(m.relationships ?? []), enabled: m.enabled ?? true,
  };
  const existing = await prisma.aiModuleRegistry.findFirst({ where: { tenantId, moduleKey: m.moduleKey } });
  if (existing) return prisma.aiModuleRegistry.update({ where: { id: existing.id }, data });
  return prisma.aiModuleRegistry.create({ data: { tenantId, moduleKey: m.moduleKey, ...data } });
}
