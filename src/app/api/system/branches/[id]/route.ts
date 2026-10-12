import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { commonBranchData, resolveEntityType, moveSubtree, wouldCycle, type BranchBody } from "@/lib/system/branchHierarchy";
import { isWarehouseEntity } from "@/lib/contracts/warehouse";
import { ensureWarehouseConfig } from "@/lib/warehouse/api";

// PATCH /api/system/branches/[id] — edit a branch, move it under a new parent,
// toggle status/allow-child, set entity type, or make it the business default.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, "setup", { req, entity: "Branch", entityId: id });
  if (denied) return denied;

  let b: BranchBody;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const branch = await prisma.branch.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!branch) return NextResponse.json({ ok: false, message: "Branch not found." }, { status: 404 });

  const et = b.entityTypeId !== undefined ? await resolveEntityType(prisma, user.tenantId, b.entityTypeId) : undefined;

  // Determine whether this is a MOVE (parentBranchId present and actually changed).
  const wantParentKey = Object.prototype.hasOwnProperty.call(b, "parentBranchId");
  const wantParentId = wantParentKey ? (b.parentBranchId ? Number(b.parentBranchId) : null) : undefined;
  const isMove = wantParentKey && wantParentId !== branch.parentBranchId;

  let newParent: { id: number; hierarchyPath: string | null; hierarchyLevel: number } | null = null;
  if (isMove && wantParentId) {
    const cand = await prisma.branch.findFirst({
      where: { id: wantParentId, tenantId: user.tenantId, businessId: branch.businessId },
      select: { id: true, hierarchyPath: true, hierarchyLevel: true, allowChild: true },
    });
    if (!cand) return NextResponse.json({ ok: false, message: "Parent branch not found in this business." }, { status: 404 });
    if (!cand.allowChild) return NextResponse.json({ ok: false, message: "The selected parent does not allow child branches." }, { status: 422 });
    if (wouldCycle(branch, cand)) return NextResponse.json({ ok: false, message: "A branch cannot be moved under itself or one of its own descendants." }, { status: 422 });
    newParent = cand;
  }

  await prisma.$transaction(async (tx) => {
    if (b.makeDefault) {
      await tx.branch.updateMany({ where: { businessId: branch.businessId }, data: { isDefault: false } });
    }
    const common = commonBranchData(b);
    await tx.branch.update({
      where: { id: branch.id },
      data: {
        name: b.name?.trim() || undefined,
        code: b.code?.trim() || undefined,
        type: et ? et.name.slice(0, 40) : (b.type?.trim() || undefined),
        entityTypeId: et ? et.id : undefined,
        allowChild: b.allowChild !== undefined ? b.allowChild : undefined,
        status: b.status === "active" || b.status === "inactive" ? b.status : undefined,
        isDefault: b.makeDefault ? true : undefined,
        // commonBranchData returns undefined for keys not present in the body.
        manager: common.manager, phone: common.phone, email: common.email, gstin: common.gstin,
        address: common.address, city: common.city, state: common.state, pincode: common.pincode,
        openTime: common.openTime, closeTime: common.closeTime,
        bankName: common.bankName, bankAccount: common.bankAccount, bankIfsc: common.bankIfsc, bankUpi: common.bankUpi,
        contactPerson: common.contactPerson, remarks: common.remarks,
        latitude: common.latitude, longitude: common.longitude,
        defaultCostCenterId: common.defaultCostCenterId, defaultProfitCenterId: common.defaultProfitCenterId,
        displayOrder: common.displayOrder,
      },
    });
    if (isMove) {
      await moveSubtree(tx, { id: branch.id, hierarchyPath: branch.hierarchyPath, hierarchyLevel: branch.hierarchyLevel }, newParent);
    }
    // Warehouse entity → ensure a (Pending) warehouse configuration exists + sync its category.
    if (et && isWarehouseEntity(et)) await ensureWarehouseConfig(tx, { tenantId: user.tenantId, businessId: branch.businessId, branchId: branch.id, warehouseCategoryId: b.warehouseCategoryId ?? null, userId: user.id, userName: user.fullName });
  });

  await writeAudit(prisma, user, {
    action: isMove ? "branch.move" : "branch.update", entity: "Branch", entityId: branch.id,
    summary: isMove ? `Moved branch ${branch.name} (${branch.code})` : `Updated branch ${b.name?.trim() || branch.name} (${b.code?.trim() || branch.code})`,
    meta: { name: b.name?.trim(), code: b.code?.trim(), entityTypeId: b.entityTypeId, parentBranchId: wantParentId, status: b.status, makeDefault: b.makeDefault },
    businessId: branch.businessId, branchId: branch.id, ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, message: isMove ? "Branch moved." : "Branch updated." });
}

// DELETE /api/system/branches/[id] — remove a leaf node. Blocked when it has child
// branches (move/deactivate them first) or is the business default. Deactivate via
// PATCH is the safe alternative for nodes that already hold transactions.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, "setup", { req, entity: "Branch", entityId: id });
  if (denied) return denied;

  const branch = await prisma.branch.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!branch) return NextResponse.json({ ok: false, message: "Branch not found." }, { status: 404 });
  if (branch.isDefault) return NextResponse.json({ ok: false, message: "The default branch cannot be deleted. Set another branch as default first." }, { status: 422 });

  const children = await prisma.branch.count({ where: { parentBranchId: id } });
  if (children > 0) return NextResponse.json({ ok: false, message: `This branch has ${children} child branch(es). Move or delete them first, or deactivate this branch instead.` }, { status: 422 });

  await prisma.branch.delete({ where: { id: branch.id } });
  await writeAudit(prisma, user, {
    action: "branch.delete", entity: "Branch", entityId: branch.id,
    summary: `Deleted branch ${branch.name} (${branch.code})`,
    meta: { name: branch.name, code: branch.code }, businessId: branch.businessId, branchId: branch.id, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Branch deleted." });
}
