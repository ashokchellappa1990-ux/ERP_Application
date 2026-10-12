// Shared client-side types + helpers for the Enterprise Branch Hierarchy screen.
import {
  Building2, Landmark, Map as MapIcon, MapPin, GitBranch, Briefcase, Truck, Warehouse, Store,
  Factory, PackageOpen, HardHat, Wrench, Handshake, Building, type LucideIcon,
} from "lucide-react";

export interface BranchNode {
  id: number;
  businessId: number;
  name: string;
  code: string;
  type: string;
  entityTypeId: number | null;
  parentBranchId: number | null;
  hierarchyLevel: number;
  hierarchyPath: string | null;
  displayOrder: number;
  allowChild: boolean;
  remarks: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  defaultCostCenterId: number | null;
  defaultProfitCenterId: number | null;
  manager: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  openTime: string | null;
  closeTime: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
  bankUpi: string | null;
  contactPerson: string | null;
  isDefault: boolean;
  status: string;
  // filled client-side
  children?: BranchNode[];
}

export interface EntityTypeOpt {
  id: number;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
  allowChild: boolean;
}

export interface CentreOpt { id: number; code: string; name: string }

export interface BranchData {
  business: { id: number; name: string } | null;
  branches: BranchNode[];
  entityTypes: EntityTypeOpt[];
  costCentres: CentreOpt[];
  profitCentres: CentreOpt[];
}

export const ICONS: Record<string, LucideIcon> = {
  Building2, Landmark, Map: MapIcon, MapPin, GitBranch, Briefcase, Truck, Warehouse, Store,
  Factory, PackageOpen, HardHat, Wrench, Handshake, Building,
};
export const iconFor = (name?: string | null): LucideIcon => ICONS[name ?? ""] ?? Building;

/** Build a parent→children forest from the flat list, ordered by displayOrder. */
export function buildTree(branches: BranchNode[]): BranchNode[] {
  const byId = new Map<number, BranchNode>();
  branches.forEach((b) => byId.set(b.id, { ...b, children: [] }));
  const roots: BranchNode[] = [];
  for (const b of byId.values()) {
    const parent = b.parentBranchId != null ? byId.get(b.parentBranchId) : null;
    if (parent) parent.children!.push(b);
    else roots.push(b);
  }
  const sort = (list: BranchNode[]) => {
    list.sort((a, z) => a.displayOrder - z.displayOrder || a.name.localeCompare(z.name));
    list.forEach((n) => n.children && n.children.length && sort(n.children));
  };
  sort(roots);
  return roots;
}

/** Ids of a node and all its descendants (for cycle-safe parent pickers). */
export function subtreeIds(branches: BranchNode[], rootId: number): Set<number> {
  const root = branches.find((b) => b.id === rootId);
  const ids = new Set<number>([rootId]);
  const rootPath = root?.hierarchyPath || String(rootId);
  for (const b of branches) {
    if (b.hierarchyPath && (b.hierarchyPath === rootPath || b.hierarchyPath.startsWith(`${rootPath}/`))) ids.add(b.id);
  }
  return ids;
}

/** All ancestor ids for a node (from its hierarchyPath, excluding itself). */
export function ancestorIds(node: BranchNode): number[] {
  if (!node.hierarchyPath) return [];
  return node.hierarchyPath.split("/").map(Number).filter((n) => n !== node.id);
}

export function maxDepth(branches: BranchNode[]): number {
  return branches.reduce((m, b) => Math.max(m, b.hierarchyLevel), 0);
}
