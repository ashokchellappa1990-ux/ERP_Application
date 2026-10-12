import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere, scopeData } from "@/lib/auth/scope";
import type { AiActor } from "@/lib/ai/types";

/** DOCUMENT CATEGORIES (Module 2) — configurable classification master. */

export const DEFAULT_CATEGORIES: { name: string; icon?: string; color?: string }[] = [
  { name: "Finance", color: "#16a34a" }, { name: "Sales", color: "#2563eb" }, { name: "Purchase", color: "#7c3aed" },
  { name: "Inventory", color: "#0891b2" }, { name: "HR", color: "#db2777" }, { name: "Payroll", color: "#e11d48" },
  { name: "Legal", color: "#b91c1c" }, { name: "Compliance", color: "#ca8a04" }, { name: "GST", color: "#059669" },
  { name: "Income Tax", color: "#0d9488" }, { name: "TDS", color: "#0284c7" }, { name: "TCS", color: "#4f46e5" },
  { name: "Customer", color: "#f59e0b" }, { name: "Supplier", color: "#8b5cf6" }, { name: "Marketing", color: "#ec4899" },
  { name: "Projects", color: "#14b8a6" }, { name: "Assets", color: "#6366f1" }, { name: "Maintenance", color: "#64748b" },
  { name: "Training", color: "#22c55e" }, { name: "SOP", color: "#3b82f6" }, { name: "User Manuals", color: "#a855f7" },
  { name: "Policies", color: "#ef4444" }, { name: "Contracts", color: "#f97316" },
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function listCategories(scope: ActiveScope, opts?: { withCounts?: boolean }) {
  const where = scopeWhere(scope, { branch: false }) as Prisma.DocCategoryWhereInput;
  const cats = await prisma.docCategory.findMany({ where: { ...where, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  if (!opts?.withCounts) return cats.map((c) => ({ ...c, count: 0 }));
  const counts = await prisma.document.groupBy({ by: ["categoryId"], where: { tenantId: scope.tenantId, status: { not: "Deleted" } }, _count: true }).catch(() => []);
  const map = new Map(counts.map((c) => [c.categoryId, c._count]));
  return cats.map((c) => ({ ...c, count: map.get(c.id) ?? 0 }));
}

export async function createCategory(scope: ActiveScope, actor: AiActor, input: { name: string; parentId?: number | null; description?: string; color?: string; icon?: string; sortOrder?: number }) {
  return prisma.docCategory.create({ data: { tenantId: scope.tenantId, ...scopeData(scope, { branch: false }), name: input.name.slice(0, 120), slug: slugify(input.name), parentId: input.parentId ?? null, description: input.description ?? null, color: input.color ?? null, icon: input.icon ?? null, sortOrder: input.sortOrder ?? 0, createdBy: actor.id } });
}

export async function updateCategory(scope: ActiveScope, id: number, patch: { name?: string; description?: string; color?: string; icon?: string; sortOrder?: number; active?: boolean }) {
  const c = await prisma.docCategory.findFirst({ where: { tenantId: scope.tenantId, id }, select: { id: true } });
  if (!c) return null;
  const data: Record<string, unknown> = { ...patch };
  if (patch.name) data.slug = slugify(patch.name);
  return prisma.docCategory.update({ where: { id }, data });
}

/** Seed the default category list once per tenant (idempotent). */
export async function ensureDefaultCategories(scope: ActiveScope) {
  const existing = await prisma.docCategory.count({ where: { tenantId: scope.tenantId } });
  if (existing > 0) return 0;
  let i = 0;
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.docCategory.create({ data: { tenantId: scope.tenantId, ...scopeData(scope, { branch: false }), name: c.name, slug: slugify(c.name), color: c.color ?? null, systemSeed: true, sortOrder: i++ } }).catch(() => {});
  }
  return DEFAULT_CATEGORIES.length;
}
