import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { commonBranchData, resolveEntityType, ensureEntityTypesSeeded, type BranchBody } from "@/lib/system/branchHierarchy";
import { isWarehouseEntity } from "@/lib/contracts/warehouse";
import { ensureWarehouseConfig } from "@/lib/warehouse/api";

const branchSelect = {
  id: true, businessId: true, name: true, code: true, type: true,
  entityTypeId: true, parentBranchId: true, hierarchyLevel: true, hierarchyPath: true,
  displayOrder: true, allowChild: true, remarks: true, latitude: true, longitude: true,
  defaultCostCenterId: true, defaultProfitCenterId: true,
  manager: true, phone: true, email: true, gstin: true, address: true, city: true, state: true, pincode: true,
  openTime: true, closeTime: true, bankName: true, bankAccount: true, bankIfsc: true, bankUpi: true,
  contactPerson: true, isDefault: true, status: true,
} as const;

// GET /api/system/branches — the org hierarchy for the active business, plus the
// entity-type master and cost/profit-centre options for the Branch Setup screen.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "setup", { entity: "Branch" });
  if (denied) return denied;

  await ensureEntityTypesSeeded(prisma, user.tenantId);
  const scope = await getActiveScope(user);
  const business = scope.businessId
    ? await prisma.business.findFirst({ where: { id: scope.businessId, tenantId: user.tenantId }, select: { id: true, name: true } })
    : await prisma.business.findFirst({ where: { tenantId: user.tenantId }, orderBy: [{ isDefault: "desc" }, { id: "asc" }], select: { id: true, name: true } });

  const [branches, entityTypes, costCentres, profitCentres] = await Promise.all([
    business
      ? prisma.branch.findMany({ where: { tenantId: user.tenantId, businessId: business.id }, select: branchSelect, orderBy: [{ hierarchyLevel: "asc" }, { displayOrder: "asc" }, { id: "asc" }] })
      : Promise.resolve([]),
    prisma.entityType.findMany({ where: { tenantId: user.tenantId, status: "active" }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }], select: { id: true, code: true, name: true, icon: true, color: true, allowChild: true } }),
    business ? prisma.costCentre.findMany({ where: { tenantId: user.tenantId, businessId: business.id, status: "Active" }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }) : Promise.resolve([]),
    business ? prisma.profitCentre.findMany({ where: { tenantId: user.tenantId, businessId: business.id, status: "Active" }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    ok: true,
    business: business ? { id: business.id, name: business.name } : null,
    branches,
    entityTypes,
    costCentres,
    profitCentres,
  });
}

// POST /api/system/branches — add a branch node. Optional parentBranchId places it
// under another node (empty = root). hierarchyLevel/hierarchyPath are derived.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "setup", { req, entity: "Branch" });
  if (denied) return denied;

  let b: BranchBody;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const name = (b.name ?? "").trim().slice(0, 150);
  const code = (b.code ?? "").trim().slice(0, 30);
  if (!name) return NextResponse.json({ ok: false, message: "Branch name is required." }, { status: 422 });
  if (!code) return NextResponse.json({ ok: false, message: "Branch code is required." }, { status: 422 });

  // Resolve the target business (from body, else the caller's active scope).
  const scope = await getActiveScope(user);
  const businessId = Number(b.businessId) || scope.businessId || 0;
  const business = await prisma.business.findFirst({ where: { id: businessId, tenantId: user.tenantId }, select: { id: true } });
  if (!business) return NextResponse.json({ ok: false, message: "Business not found." }, { status: 404 });

  // Resolve the parent (if any) — it must be in the same business, and must allow children.
  let parent: { id: number; hierarchyPath: string | null; hierarchyLevel: number; allowChild: boolean } | null = null;
  if (b.parentBranchId) {
    parent = await prisma.branch.findFirst({
      where: { id: Number(b.parentBranchId), tenantId: user.tenantId, businessId: business.id },
      select: { id: true, hierarchyPath: true, hierarchyLevel: true, allowChild: true },
    });
    if (!parent) return NextResponse.json({ ok: false, message: "Parent branch not found in this business." }, { status: 404 });
    if (!parent.allowChild) return NextResponse.json({ ok: false, message: "The selected parent does not allow child branches." }, { status: 422 });
  }

  const et = await resolveEntityType(prisma, user.tenantId, b.entityTypeId);
  const allowChild = b.allowChild ?? et?.allowChild ?? true;
  const existing = await prisma.branch.count({ where: { businessId: business.id } });

  const branch = await prisma.$transaction(async (tx) => {
    const created = await tx.branch.create({
      data: {
        tenantId: user.tenantId, businessId: business.id, name, code,
        type: (et?.name || b.type?.trim() || "Retail Outlet").slice(0, 40),
        entityTypeId: et?.id ?? null,
        parentBranchId: parent?.id ?? null,
        hierarchyLevel: parent ? parent.hierarchyLevel + 1 : 1,
        allowChild,
        isDefault: existing === 0,
        status: b.status === "inactive" ? "inactive" : "active",
        ...commonBranchData(b),
      },
    });
    const hierarchyPath = (parent ? `${parent.hierarchyPath || String(parent.id)}/` : "") + created.id;
    const updated = await tx.branch.update({ where: { id: created.id }, data: { hierarchyPath } });
    // Entity Type = Warehouse → create a Pending warehouse configuration (Branch is the master).
    if (isWarehouseEntity(et)) await ensureWarehouseConfig(tx, { tenantId: user.tenantId, businessId: business.id, branchId: created.id, warehouseCategoryId: b.warehouseCategoryId ?? null, userId: user.id, userName: user.fullName });
    return updated;
  });

  await writeAudit(prisma, user, {
    action: "branch.create", entity: "Branch", entityId: branch.id,
    summary: `Added branch ${branch.name} (${branch.code})`,
    meta: { name: branch.name, code: branch.code, type: branch.type, entityTypeId: branch.entityTypeId, parentBranchId: branch.parentBranchId, level: branch.hierarchyLevel, isDefault: branch.isDefault },
    businessId: branch.businessId, branchId: branch.id, ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, message: "Branch added.", id: branch.id }, { status: 201 });
}
