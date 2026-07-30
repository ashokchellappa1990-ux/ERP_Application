import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { writeAudit, type AuditActor } from "@/lib/audit/log";
import {
  isWarehouseEntity, DEFAULT_CATEGORIES, DEFAULT_WAREHOUSE_CONFIG, DEFAULT_PROGRESS,
  mergeConfig, mergeProgress, capabilityCount, progressPercent, validateConfig,
  type WarehouseConfigInput,
} from "@/lib/contracts/warehouse";

/** Warehouse Configuration engine — configures a Branch (the warehouse master). No Branch data duplicated. */
const num = (v: unknown) => (v == null ? 0 : Number(v));
type Tx = Prisma.TransactionClient | typeof prisma;

function branchWhere(scope: ActiveScope): Prisma.BranchWhereInput {
  return { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(scope.readBranchIds?.length ? { id: { in: scope.readBranchIds } } : {}) };
}

async function warehouseEntityTypeIds(tenantId: number): Promise<number[]> {
  const ets = await prisma.entityType.findMany({ where: { tenantId }, select: { id: true, code: true, name: true } });
  return ets.filter(isWarehouseEntity).map((e) => e.id);
}

/* ------------------------------------------------------------ categories */
export async function listCategories(scope: ActiveScope, includeInactive = false) {
  let rows = await prisma.warehouseCategory.findMany({ where: { tenantId: scope.tenantId }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] });
  if (rows.length === 0) {
    await prisma.warehouseCategory.createMany({ data: DEFAULT_CATEGORIES.map((c, i) => ({ tenantId: scope.tenantId, code: c.code, name: c.name, storageTypeDefault: c.storageTypeDefault, displayOrder: i + 1, status: "active" })), skipDuplicates: true });
    rows = await prisma.warehouseCategory.findMany({ where: { tenantId: scope.tenantId }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] });
  }
  return (includeInactive ? rows : rows.filter((r) => r.status === "active")).map((r) => ({ id: r.id, code: r.code, name: r.name, description: r.description, storageTypeDefault: r.storageTypeDefault, displayOrder: r.displayOrder, status: r.status }));
}
export async function saveCategory(scope: ActiveScope, user: AuditActor, input: { id?: number; code: string; name: string; description?: string; storageTypeDefault?: string; displayOrder?: number; status?: string }) {
  const data = { tenantId: scope.tenantId, code: input.code.trim().toUpperCase(), name: input.name.trim(), description: input.description || null, storageTypeDefault: input.storageTypeDefault || null, displayOrder: input.displayOrder ?? 1, status: input.status || "active" };
  const row = input.id ? await prisma.warehouseCategory.update({ where: { id: input.id }, data }) : await prisma.warehouseCategory.create({ data });
  await writeAudit(prisma, user, { action: `warehouse.category.${input.id ? "update" : "create"}`, entity: "WarehouseCategory", entityId: row.id, summary: `${input.id ? "Updated" : "Created"} warehouse category ${row.name}` });
  return row.id;
}

/* ------------------------------------------------ ensure config on branch save */
export async function ensureWarehouseConfig(tx: Tx, args: { tenantId: number; businessId: number | null; branchId: number; warehouseCategoryId?: number | null; userId?: number | null; userName?: string | null }): Promise<number> {
  const existing = await tx.warehouseConfiguration.findFirst({ where: { tenantId: args.tenantId, branchId: args.branchId }, select: { id: true, warehouseCategoryId: true } });
  if (existing) {
    if (args.warehouseCategoryId && existing.warehouseCategoryId !== args.warehouseCategoryId) await tx.warehouseConfiguration.update({ where: { id: existing.id }, data: { warehouseCategoryId: args.warehouseCategoryId } });
    return existing.id;
  }
  const row = await tx.warehouseConfiguration.create({
    data: { tenantId: args.tenantId, businessId: args.businessId, branchId: args.branchId, warehouseCategoryId: args.warehouseCategoryId ?? null, status: "Pending", config: DEFAULT_WAREHOUSE_CONFIG as unknown as Prisma.InputJsonValue, progress: DEFAULT_PROGRESS as unknown as Prisma.InputJsonValue, createdBy: args.userId ?? null, createdByName: args.userName ?? null },
    select: { id: true },
  });
  return row.id;
}

/* -------------------------------------------------------------- list / get */
export async function listWarehouses(scope: ActiveScope) {
  const etIds = await warehouseEntityTypeIds(scope.tenantId);
  if (!etIds.length) return [];
  const branches = await prisma.branch.findMany({ where: { ...branchWhere(scope), entityTypeId: { in: etIds } }, select: { id: true, name: true, code: true, businessId: true, entityTypeId: true }, orderBy: { name: "asc" } });
  const branchIds = branches.map((b) => b.id);
  const [configs, cats, businesses, ets] = await Promise.all([
    prisma.warehouseConfiguration.findMany({ where: { tenantId: scope.tenantId, branchId: { in: branchIds } } }),
    prisma.warehouseCategory.findMany({ where: { tenantId: scope.tenantId }, select: { id: true, name: true } }),
    prisma.business.findMany({ where: { tenantId: scope.tenantId }, select: { id: true, name: true } }),
    prisma.entityType.findMany({ where: { tenantId: scope.tenantId }, select: { id: true, name: true } }),
  ]);
  const cfgBy = new Map(configs.map((c) => [c.branchId, c]));
  const catBy = new Map(cats.map((c) => [c.id, c.name]));
  const bizBy = new Map(businesses.map((b) => [b.id, b.name]));
  const etBy = new Map(ets.map((e) => [e.id, e.name]));
  return branches.map((b) => {
    const cfg = cfgBy.get(b.id);
    return { branchId: b.id, name: b.name, code: b.code, entityType: b.entityTypeId != null ? etBy.get(b.entityTypeId) ?? "" : "", business: b.businessId != null ? bizBy.get(b.businessId) ?? "" : "", category: cfg?.warehouseCategoryId != null ? catBy.get(cfg.warehouseCategoryId) ?? "" : "", status: cfg?.status ?? "Pending", progress: cfg ? progressPercent(mergeProgress(cfg.progress)) : 0, configured: !!cfg && cfg.status !== "Pending" };
  });
}

export async function getWarehouse(scope: ActiveScope, branchId: number) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId: scope.tenantId }, select: { id: true, name: true, code: true, businessId: true, entityTypeId: true } });
  if (!branch) return null;
  const [cfg, cats, ets, businesses, mappings, etIds] = await Promise.all([
    prisma.warehouseConfiguration.findFirst({ where: { tenantId: scope.tenantId, branchId } }),
    listCategories(scope),
    prisma.entityType.findMany({ where: { tenantId: scope.tenantId }, select: { id: true, name: true } }),
    prisma.business.findMany({ where: { tenantId: scope.tenantId }, select: { id: true, name: true } }),
    listMappings(scope, branchId),
    warehouseEntityTypeIds(scope.tenantId),
  ]);
  const whBranches = await prisma.branch.findMany({ where: { ...branchWhere(scope), entityTypeId: { in: etIds }, id: { not: branchId } }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
  const etBy = new Map(ets.map((e) => [e.id, e.name]));
  const bizBy = new Map(businesses.map((b) => [b.id, b.name]));
  return {
    header: { branchId: branch.id, name: branch.name, code: branch.code, business: branch.businessId != null ? bizBy.get(branch.businessId) ?? "" : "", entityType: branch.entityTypeId != null ? etBy.get(branch.entityTypeId) ?? "" : "", status: cfg?.status ?? "Pending" },
    warehouseCategoryId: cfg?.warehouseCategoryId ?? null,
    storageType: cfg?.storageType ?? "", capacity: cfg?.capacity != null ? num(cfg.capacity) : null, capacityUnit: cfg?.capacityUnit ?? "", maxWeight: cfg?.maxWeight != null ? num(cfg.maxWeight) : null, weightUnit: cfg?.weightUnit ?? "",
    config: mergeConfig(cfg?.config), progress: mergeProgress(cfg?.progress),
    categories: cats, warehouseOptions: whBranches, mappings,
  };
}

export async function saveConfig(scope: ActiveScope, user: AuditActor & { fullName?: string | null }, branchId: number, input: WarehouseConfigInput) {
  const err = validateConfig(input);
  if (err) throw new Error(err);
  const cfg = mergeConfig(input.config);
  const progress = mergeProgress(input.progress);
  progress.warehouseConfigured = true;
  progress.readyForOperations = capabilityCount(cfg) >= 1 && !!input.warehouseCategoryId && Number(input.capacity) > 0;
  const existing = await prisma.warehouseConfiguration.findFirst({ where: { tenantId: scope.tenantId, branchId }, select: { id: true, status: true } });
  const status = existing && (existing.status === "Active" || existing.status === "Inactive") ? existing.status : "Configured";
  const data = {
    tenantId: scope.tenantId, businessId: scope.businessId, branchId, warehouseCategoryId: input.warehouseCategoryId ?? null,
    storageType: input.storageType || null, capacity: input.capacity ?? null, capacityUnit: input.capacityUnit || null, maxWeight: input.maxWeight ?? null, weightUnit: input.weightUnit || null,
    status, config: cfg as unknown as Prisma.InputJsonValue, progress: progress as unknown as Prisma.InputJsonValue,
  };
  const row = existing
    ? await prisma.warehouseConfiguration.update({ where: { id: existing.id }, data })
    : await prisma.warehouseConfiguration.create({ data: { ...data, createdBy: user?.id ?? null, createdByName: user?.fullName ?? null } });
  await writeAudit(prisma, user, { action: "warehouse.config.save", entity: "WarehouseConfiguration", entityId: row.id, summary: `Configured warehouse (branch ${branchId})`, businessId: scope.businessId, meta: { branchId, status, categoryId: input.warehouseCategoryId } });
  return { id: row.id, status };
}

/* ---------------------------------------------------------- parent mapping */
export async function listMappings(scope: ActiveScope, branchId: number) {
  const rows = await prisma.warehouseParentMapping.findMany({ where: { tenantId: scope.tenantId, OR: [{ destinationWarehouseBranchId: branchId }, { sourceWarehouseBranchId: branchId }] }, orderBy: { id: "desc" } });
  const ids = [...new Set(rows.flatMap((r) => [r.sourceWarehouseBranchId, r.destinationWarehouseBranchId]))];
  const branches = ids.length ? await prisma.branch.findMany({ where: { tenantId: scope.tenantId, id: { in: ids } }, select: { id: true, name: true } }) : [];
  const bn = new Map(branches.map((b) => [b.id, b.name]));
  return rows.map((r) => ({ id: r.id, sourceWarehouseBranchId: r.sourceWarehouseBranchId, sourceName: bn.get(r.sourceWarehouseBranchId) ?? `#${r.sourceWarehouseBranchId}`, destinationWarehouseBranchId: r.destinationWarehouseBranchId, destinationName: bn.get(r.destinationWarehouseBranchId) ?? `#${r.destinationWarehouseBranchId}`, relationshipType: r.relationshipType, priority: r.priority, isDefault: r.isDefault, status: r.status }));
}
export async function addMapping(scope: ActiveScope, user: AuditActor, input: { sourceWarehouseBranchId: number; destinationWarehouseBranchId: number; relationshipType: string; priority: string; isDefault: boolean }) {
  if (input.sourceWarehouseBranchId === input.destinationWarehouseBranchId) throw new Error("Parent Warehouse cannot be itself.");
  if (input.isDefault) await prisma.warehouseParentMapping.updateMany({ where: { tenantId: scope.tenantId, destinationWarehouseBranchId: input.destinationWarehouseBranchId }, data: { isDefault: false } });
  const row = await prisma.warehouseParentMapping.create({ data: { tenantId: scope.tenantId, businessId: scope.businessId, sourceWarehouseBranchId: input.sourceWarehouseBranchId, destinationWarehouseBranchId: input.destinationWarehouseBranchId, relationshipType: input.relationshipType, priority: input.priority, isDefault: input.isDefault, status: "active" } });
  await writeAudit(prisma, user, { action: "warehouse.mapping.create", entity: "WarehouseParentMapping", entityId: row.id, summary: `Mapped source ${input.sourceWarehouseBranchId} → ${input.destinationWarehouseBranchId}` });
  return row.id;
}
export async function deleteMapping(scope: ActiveScope, user: AuditActor, id: number) {
  await prisma.warehouseParentMapping.deleteMany({ where: { id, tenantId: scope.tenantId } });
  await writeAudit(prisma, user, { action: "warehouse.mapping.delete", entity: "WarehouseParentMapping", entityId: id, summary: `Removed parent mapping ${id}` });
}
