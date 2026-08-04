import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

/**
 * Data-segregation scope for the signed-in user.
 *
 * Hierarchy:  Tenant (account) → Business (GST/PAN entity) → Branch (location).
 *  - `tenantId`   isolates one subscriber account from every other.
 *  - `businessId` isolates one business from sibling businesses under the tenant.
 *  - `branchId`   isolates one location's operational data within a business.
 *
 * A user selects an active business + one-or-more branches ("All" = every branch
 * they're allowed). The selection is constrained by the user's hierarchy:
 *  - owner / admin (all-access)  → any business, any branch.
 *  - business-level user         → their business, any of its branches.
 *  - branch-level user           → locked to their assigned branch only.
 */
export const ACTIVE_BUSINESS_COOKIE = "pos_business";
export const ACTIVE_BRANCHES_COOKIE = "pos_branches"; // CSV of branch ids, or "all"

export interface ActiveScope {
  tenantId: number;
  businessId: number | null;
  branchId: number | null;     // primary branch — used when writing a new row
  branchIds: number[] | null;  // user's topbar selection; null = "All branches"
  readBranchIds: number[];     // concrete, bounded branch ids a read may show
}

/** A scope `where` fragment, structurally assignable to any Prisma WhereInput. */
export interface ScopeFilter {
  tenantId: number;
  businessId?: number;
  AND?: { OR: ({ branchId: null } | { branchId: { in: number[] } })[] }[];
}

export interface ScopeUser {
  id?: number;
  tenantId: number;
  role?: string | null;
  roleId?: number | null;
  businessId?: number | null;
  branchId?: number | null;
}

export interface AllowedScope {
  businesses: { id: number; name: string; gstNumber: string | null }[];
  branches: { id: number; name: string; businessId: number; code: string; hierarchyPath?: string | null; hierarchyLevel?: number; parentBranchId?: number | null; isDefault?: boolean }[];
  lockBusiness: boolean; // user may not change the business
  lockBranch: boolean;   // user is pinned to a single branch
  privileged: boolean;
}

const PRIVILEGED = ["owner", "admin", "super-admin", "business-owner", "administrator"];

// getAllowedScope runs on essentially every API request (it's what
// getActiveScope calls first) and was costing 2-3 sequential DB round trips
// (role check + business list + branch list) before the request's actual
// work even started — a fixed "tax" on every list load / search keystroke.
// The org hierarchy this resolves (businesses/branches/role privilege) changes
// rarely — an operator restructuring branches, not a per-second event — so a
// short TTL cache eliminates the redundant queries for the overwhelmingly
// common case (many requests per user within a few seconds) while still
// picking up real changes within half a minute. Module-level, so it persists
// across warm invocations in the same process/serverless container; a cold
// start just starts with an empty cache, no correctness impact either way.
const SCOPE_CACHE_TTL_MS = 30_000;
const scopeCache = new Map<string, { data: AllowedScope; expiresAt: number }>();

/** The businesses + branches a user is permitted to see/select (hierarchy rule). */
export async function getAllowedScope(user: ScopeUser): Promise<AllowedScope> {
  const cacheKey = user.id != null ? `${user.tenantId}:${user.id}` : null;
  if (cacheKey) {
    const cached = scopeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    // Opportunistic cleanup so a long-lived process doesn't accumulate stale
    // entries forever — cheap relative to the queries this cache saves.
    if (scopeCache.size > 500) scopeCache.clear();
  }

  let privileged = PRIVILEGED.includes((user.role ?? "").toLowerCase());
  if (!privileged && user.roleId) {
    const r = await prisma.role.findUnique({ where: { id: user.roleId }, select: { isAllAccess: true } });
    if (r?.isAllAccess) privileged = true;
  }

  const allBiz = await prisma.business.findMany({
    where: { tenantId: user.tenantId }, select: { id: true, name: true, gstNumber: true }, orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });

  // Branches are ordered by the org hierarchy (root → children, then displayOrder)
  // so every selector / list shows business-then-branch-hierarchy order.
  const branchSelect = { id: true, name: true, businessId: true, code: true, hierarchyPath: true, hierarchyLevel: true, parentBranchId: true, isDefault: true } as const;
  const branchOrder = [{ businessId: "asc" as const }, { hierarchyLevel: "asc" as const }, { displayOrder: "asc" as const }, { id: "asc" as const }];

  if (privileged) {
    const branches = await prisma.branch.findMany({ where: { tenantId: user.tenantId }, select: branchSelect, orderBy: branchOrder });
    const result: AllowedScope = { businesses: allBiz, branches, lockBusiness: false, lockBranch: false, privileged: true };
    if (cacheKey) scopeCache.set(cacheKey, { data: result, expiresAt: Date.now() + SCOPE_CACHE_TTL_MS });
    return result;
  }

  // Non-privileged: restricted to the assigned business (and branch subtree, if branch-level).
  const businesses = user.businessId ? allBiz.filter((b) => b.id === user.businessId) : allBiz;
  const bizIds = businesses.map((b) => b.id);
  let branches = await prisma.branch.findMany({
    where: { tenantId: user.tenantId, businessId: { in: bizIds.length ? bizIds : [-1] } },
    select: branchSelect, orderBy: branchOrder,
  });
  let lockBranch = false;
  if (user.branchId) {
    // A branch user sees their branch AND every branch beneath it (the subtree) —
    // e.g. a user pinned to a Regional Office sees all its shops' data. A user with
    // no branch mapped falls through and sees the whole business (entity level).
    const self = branches.find((b) => b.id === user.branchId);
    const selfPath = self?.hierarchyPath || String(user.branchId);
    branches = branches.filter((b) => {
      const p = b.hierarchyPath || String(b.id);
      return b.id === user.branchId || p === selfPath || p.startsWith(`${selfPath}/`);
    });
    // Only a SINGLE-branch user is truly locked (no filter). A branch user whose
    // branch has children keeps a branch filter so they can drill into each
    // sub-branch/store separately — still confined to their subtree.
    lockBranch = branches.length <= 1;
  }
  const result: AllowedScope = { businesses, branches, lockBusiness: businesses.length <= 1, lockBranch, privileged: false };
  if (cacheKey) scopeCache.set(cacheKey, { data: result, expiresAt: Date.now() + SCOPE_CACHE_TTL_MS });
  return result;
}

/** Resolve the active {businessId, branchId, branchIds} from cookies, validated
 *  against what the user is allowed to see. */
export async function getActiveScope(user: ScopeUser): Promise<ActiveScope> {
  const allowed = await getAllowedScope(user);
  const jar = cookies();
  const allowedBizIds = new Set(allowed.businesses.map((b) => b.id));

  const wantBiz = Number(jar.get(ACTIVE_BUSINESS_COOKIE)?.value) || 0;
  const businessId =
    (wantBiz && allowedBizIds.has(wantBiz) ? wantBiz : 0) ||
    (user.businessId && allowedBizIds.has(user.businessId) ? user.businessId : 0) ||
    (allowed.businesses[0]?.id ?? null);

  const allowedBranchIds = allowed.branches.filter((b) => b.businessId === businessId).map((b) => b.id);

  const raw = jar.get(ACTIVE_BRANCHES_COOKIE)?.value ?? "";
  let branchIds: number[] | null = null; // null = all allowed branches
  if (raw && raw !== "all") {
    const sel = raw.split(",").map(Number).filter((n) => allowedBranchIds.includes(n));
    branchIds = sel.length ? sel : null;
  }
  if (allowed.lockBranch && user.branchId) branchIds = [user.branchId]; // branch user is pinned

  // Write-target branch: the explicit selection, else the user's own branch, else
  // the business default (not merely the first listed — the list is now ordered by
  // hierarchy, so we must resolve the default explicitly).
  const defaultBranchId = allowed.branches.find((b) => b.businessId === businessId && b.isDefault)?.id;
  const branchId =
    (branchIds && branchIds[0]) ||
    (user.branchId && allowedBranchIds.includes(user.branchId) ? user.branchId : 0) ||
    defaultBranchId ||
    (allowedBranchIds[0] ?? null);

  // Concrete branch ids a read may show: the explicit selection, else every
  // branch this user is allowed under the active business. Reads are always
  // bounded to this set (plus all-branch rows) — never unfiltered.
  //
  // Hierarchy roll-up: when the user selects a grouping node (e.g. a Regional
  // Office), every operating branch beneath it must roll up too. We expand the
  // selection to its descendants via the materialized `hierarchyPath`, always
  // intersected with what the user is already allowed to see (never widens).
  const baseRead = branchIds ?? allowedBranchIds;
  const readBranchIds = branchIds
    ? expandDescendants(baseRead, allowed.branches, allowedBranchIds)
    : baseRead;

  return { tenantId: user.tenantId, businessId, branchId, branchIds, readBranchIds };
}

/** Add every allowed branch whose hierarchyPath sits under one of `selectedIds`. */
function expandDescendants(
  selectedIds: number[],
  branches: AllowedScope["branches"],
  allowedIds: number[],
): number[] {
  const allowed = new Set(allowedIds);
  const out = new Set(selectedIds.filter((id) => allowed.has(id)));
  const sel = new Set(selectedIds);
  for (const b of branches) {
    if (!allowed.has(b.id) || out.has(b.id) || !b.hierarchyPath) continue;
    const ancestors = b.hierarchyPath.split("/").map(Number);
    if (ancestors.some((a) => sel.has(a))) out.add(b.id);
  }
  return [...out];
}

/**
 * Prisma `where` fragment scoping a read to the active business and branch
 * visibility. Branch rule (the segregation contract):
 *   branchId IS NULL              → an "all-branches" record, visible to everyone
 *                                   in the business.
 *   branchId IN (readBranchIds)   → a branch-specific record, visible only to a
 *                                   user who may see that branch.
 * The branch condition goes in `AND` so callers can still use their own `OR`
 * (e.g. a text search) without conflict.
 */
export function scopeWhere(scope: ActiveScope, opts: { branch?: boolean } = {}): ScopeFilter {
  const where: ScopeFilter = { tenantId: scope.tenantId };
  if (scope.businessId) where.businessId = scope.businessId;
  if (opts.branch) {
    where.AND = [{ OR: [{ branchId: null }, { branchId: { in: scope.readBranchIds } }] }];
  }
  return where;
}

/** Stamp the active business / primary branch onto a row being created. */
export function scopeData(scope: ActiveScope, opts: { branch?: boolean } = {}) {
  const data: { businessId?: number; branchId?: number } = {};
  if (scope.businessId) data.businessId = scope.businessId;
  if (opts.branch && scope.branchId) data.branchId = scope.branchId;
  return data;
}

/**
 * Target { businessId, branchId } for a NEW master/config row, honouring the
 * "Add to: All branches / a particular branch" choice from the add form:
 *   branchChoice = "all" | null   → branchId null (applies to all branches)
 *   branchChoice = <branchId>     → that branch (validated against allowed)
 *   branchChoice = undefined      → derive from the active topbar scope
 * A branch-level user is always forced to their own branch.
 */
export async function resolveWriteScope(
  user: ScopeUser,
  branchChoice?: number | "all" | null,
): Promise<{ businessId: number | null; branchId: number | null }> {
  const [scope, allowed] = await Promise.all([getActiveScope(user), getAllowedScope(user)]);
  const businessId = scope.businessId;
  let branchId: number | null;
  if (branchChoice === "all" || branchChoice === null) {
    branchId = null;
  } else if (typeof branchChoice === "number" && branchChoice > 0) {
    branchId = allowed.branches.some((b) => b.id === branchChoice && b.businessId === businessId) ? branchChoice : null;
  } else {
    branchId = scope.branchIds == null ? null : scope.branchIds.length === 1 ? scope.branchIds[0] : scope.branchId;
  }
  if (allowed.lockBranch && user.branchId) branchId = user.branchId;
  return { businessId, branchId };
}
