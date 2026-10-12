// Shared helpers for the Enterprise Branch Hierarchy (v2.0): body sanitisation,
// entity-type resolution and materialized-path recomputation on move.
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

export interface BranchBody {
  businessId?: number;
  name?: string;
  code?: string;
  entityTypeId?: number | null;
  parentBranchId?: number | null;
  warehouseCategoryId?: number | null; // set when entity type is a warehouse
  type?: string;
  manager?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  openTime?: string;
  closeTime?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankUpi?: string;
  contactPerson?: string;
  allowChild?: boolean;
  remarks?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  defaultCostCenterId?: number | null;
  defaultProfitCenterId?: number | null;
  displayOrder?: number;
  status?: string;
  makeDefault?: boolean;
}

const strN = (v: unknown, n: number) =>
  v === undefined ? undefined : typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;
export const numN = (v: unknown): number | null =>
  v === undefined || v === null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

// The non-identity, non-hierarchy fields shared by create/update. In PATCH,
// `undefined` means "leave unchanged"; here every provided key maps to a value.
export function commonBranchData(b: BranchBody) {
  return {
    manager: strN(b.manager, 150),
    phone: strN(b.phone, 30),
    email: strN(b.email, 150),
    gstin: strN(b.gstin, 20),
    address: strN(b.address, 300),
    city: strN(b.city, 100),
    state: strN(b.state, 100),
    pincode: strN(b.pincode, 12),
    openTime: strN(b.openTime, 10),
    closeTime: strN(b.closeTime, 10),
    bankName: strN(b.bankName, 150),
    bankAccount: strN(b.bankAccount, 40),
    bankIfsc: strN(b.bankIfsc, 20),
    bankUpi: strN(b.bankUpi, 60),
    contactPerson: strN(b.contactPerson, 150),
    remarks: strN(b.remarks, 500),
    latitude: b.latitude === undefined ? undefined : numN(b.latitude),
    longitude: b.longitude === undefined ? undefined : numN(b.longitude),
    defaultCostCenterId: b.defaultCostCenterId === undefined ? undefined : numN(b.defaultCostCenterId),
    defaultProfitCenterId: b.defaultProfitCenterId === undefined ? undefined : numN(b.defaultProfitCenterId),
    displayOrder: b.displayOrder === undefined ? undefined : Number(b.displayOrder) || 1,
  };
}

// Resolve an entity type within the tenant. Returns the type's name (used to keep
// the legacy `type` column in sync) and its default allowChild.
export async function resolveEntityType(tx: Tx, tenantId: number, entityTypeId?: number | null) {
  if (!entityTypeId) return null;
  const et = await tx.entityType.findFirst({
    where: { id: Number(entityTypeId), tenantId },
    select: { id: true, name: true, code: true, allowChild: true },
  });
  return et;
}

// Recompute hierarchyPath / hierarchyLevel for a node and its whole subtree when
// it is moved under a new parent (or to root when newParent is null). Cheap loop
// over the affected descendants — hierarchies are shallow and small.
export async function moveSubtree(
  tx: Tx,
  node: { id: number; hierarchyPath: string | null; hierarchyLevel: number },
  newParent: { id: number; hierarchyPath: string | null; hierarchyLevel: number } | null,
) {
  const oldPath = node.hierarchyPath || String(node.id);
  const newLevel = newParent ? newParent.hierarchyLevel + 1 : 1;
  const newPath = (newParent ? `${newParent.hierarchyPath || String(newParent.id)}/` : "") + node.id;
  const levelDelta = newLevel - node.hierarchyLevel;

  // The node itself
  await tx.branch.update({
    where: { id: node.id },
    data: { parentBranchId: newParent?.id ?? null, hierarchyLevel: newLevel, hierarchyPath: newPath },
  });

  // Its descendants (path begins with "oldPath/")
  const descendants = await tx.branch.findMany({
    where: { hierarchyPath: { startsWith: `${oldPath}/` } },
    select: { id: true, hierarchyPath: true, hierarchyLevel: true },
  });
  for (const d of descendants) {
    const rest = (d.hierarchyPath || "").slice(oldPath.length); // "/child/grandchild"
    await tx.branch.update({
      where: { id: d.id },
      data: { hierarchyPath: newPath + rest, hierarchyLevel: d.hierarchyLevel + levelDelta },
    });
  }
  return descendants.length;
}

// Default entity types — mirrors scripts/mig-branch-hierarchy.mjs. Used to seed a
// brand-new tenant on demand (the migration only seeded tenants that existed then).
export const SEED_ENTITY_TYPES = [
  { code: "HO", name: "Head Office", icon: "Building2", color: "#6366f1", allowChild: true },
  { code: "CORP", name: "Corporate Office", icon: "Landmark", color: "#8b5cf6", allowChild: true },
  { code: "STATE", name: "State Office", icon: "Map", color: "#0ea5e9", allowChild: true },
  { code: "REGION", name: "Regional Office", icon: "MapPin", color: "#06b6d4", allowChild: true },
  { code: "BRANCH", name: "Branch Office", icon: "GitBranch", color: "#10b981", allowChild: true },
  { code: "SALES", name: "Sales Office", icon: "Briefcase", color: "#14b8a6", allowChild: true },
  { code: "DC", name: "Distribution Centre", icon: "Truck", color: "#f59e0b", allowChild: true },
  { code: "WH", name: "Warehouse", icon: "Warehouse", color: "#eab308", allowChild: false },
  { code: "STORE", name: "Retail Store", icon: "Store", color: "#ef4444", allowChild: false },
  { code: "FACTORY", name: "Factory", icon: "Factory", color: "#78716c", allowChild: true },
  { code: "MFG", name: "Manufacturing Unit", icon: "Factory", color: "#a16207", allowChild: true },
  { code: "DARK", name: "Dark Store", icon: "PackageOpen", color: "#db2777", allowChild: false },
  { code: "PROJECT", name: "Project Office", icon: "HardHat", color: "#0891b2", allowChild: true },
  { code: "SERVICE", name: "Service Centre", icon: "Wrench", color: "#f97316", allowChild: false },
  { code: "FRANCHISE", name: "Franchise", icon: "Handshake", color: "#65a30d", allowChild: false },
  { code: "OFFICE", name: "Office", icon: "Building", color: "#64748b", allowChild: true },
];

// Legacy Branch.type / old category → seed entity-type name (for resolving during
// wizard save and for pre-hierarchy data).
export const LEGACY_TYPE_ALIAS: Record<string, string> = {
  "retail outlet": "Retail Store",
  "warehouse outlet": "Warehouse",
  "head office": "Head Office",
  "franchise": "Franchise",
  "corporate office": "Corporate Office",
  "distribution centre": "Distribution Centre",
  "factory": "Factory",
};

/** Seed the 16 default entity types for a tenant if it has none yet (idempotent). */
export async function ensureEntityTypesSeeded(tx: Tx, tenantId: number) {
  const n = await tx.entityType.count({ where: { tenantId } });
  if (n > 0) return false;
  await tx.entityType.createMany({
    data: SEED_ENTITY_TYPES.map((s, i) => ({ tenantId, code: s.code, name: s.name, icon: s.icon, color: s.color, allowChild: s.allowChild, displayOrder: i + 1, status: "active" })),
  });
  return true;
}

/** Resolve an entity-type name (or legacy category) → its id for a tenant. */
export async function entityTypeIdByName(tx: Tx, tenantId: number, name?: string | null): Promise<number | null> {
  const raw = (name ?? "").trim();
  if (!raw) return null;
  const types = await tx.entityType.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const byName = new Map(types.map((t) => [t.name.toLowerCase(), t.id]));
  return byName.get(raw.toLowerCase()) ?? byName.get((LEGACY_TYPE_ALIAS[raw.toLowerCase()] ?? "").toLowerCase()) ?? null;
}

/** Recompute hierarchyLevel + hierarchyPath for EVERY branch of a business from
 *  its parentBranchId links (BFS from roots). Cheap + self-healing; used after the
 *  onboarding wizard writes a batch of branches with parent references. */
export async function rebuildHierarchy(tx: Tx, businessId: number) {
  const all = await tx.branch.findMany({ where: { businessId }, select: { id: true, parentBranchId: true } });
  const ids = new Set(all.map((b) => b.id));
  const children = new Map<number | null, number[]>();
  for (const b of all) {
    const p = b.parentBranchId && ids.has(b.parentBranchId) && b.parentBranchId !== b.id ? b.parentBranchId : null;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(b.id);
  }
  const visited = new Set<number>();
  const updates: { id: number; path: string; level: number }[] = [];
  const walk = (parentId: number | null, parentPath: string, parentLevel: number) => {
    for (const id of children.get(parentId) ?? []) {
      if (visited.has(id)) continue;
      visited.add(id);
      const path = parentPath ? `${parentPath}/${id}` : String(id);
      const level = parentLevel + 1;
      updates.push({ id, path, level });
      walk(id, path, level);
    }
  };
  walk(null, "", 0);
  // Defensive: anything unreachable (e.g. a broken parent cycle) becomes a root.
  for (const b of all) if (!visited.has(b.id)) updates.push({ id: b.id, path: String(b.id), level: 1 });
  for (const u of updates) await tx.branch.update({ where: { id: u.id }, data: { hierarchyLevel: u.level, hierarchyPath: u.path } });
  return updates.length;
}

// Would moving `node` under `candidateParent` create a cycle? True if the
// candidate is the node itself or one of its descendants.
export function wouldCycle(
  node: { id: number; hierarchyPath: string | null },
  candidateParent: { id: number; hierarchyPath: string | null },
) {
  if (candidateParent.id === node.id) return true;
  const nodePath = node.hierarchyPath || String(node.id);
  const parentPath = candidateParent.hierarchyPath || String(candidateParent.id);
  return parentPath === nodePath || parentPath.startsWith(`${nodePath}/`);
}
