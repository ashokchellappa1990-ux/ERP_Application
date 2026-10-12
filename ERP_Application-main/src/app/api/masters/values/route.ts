import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import type { MasterTree } from "@/lib/contracts/masters";

const PERM = "masters.product";
const TYPES = ["category", "subCategory", "group", "brand", "manufacturer", "supplier"] as const;
type MasterType = (typeof TYPES)[number];
// Hierarchy: each type's parent type (null = top level / flat).
const PARENT_TYPE: Record<MasterType, MasterType | null> = {
  category: null,
  subCategory: "category",
  group: "subCategory",
  brand: null,
  manufacturer: null,
  supplier: null,
};

// GET /api/masters/values — Category→Sub-category→Group tree + flat brands/manufacturers.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const all = await prisma.masterValue.findMany({ where: scopeWhere(await getActiveScope(user), { branch: true }), orderBy: { value: "asc" } });
  const cats = all.filter((r) => r.type === "category");
  const subs = all.filter((r) => r.type === "subCategory");
  const grps = all.filter((r) => r.type === "group");

  const categories = cats.map((c) => ({
    id: c.id,
    value: c.value,
    subCategories: subs
      .filter((s) => s.parentId === c.id)
      .map((s) => ({
        id: s.id,
        value: s.value,
        groups: grps.filter((g) => g.parentId === s.id).map((g) => ({ id: g.id, value: g.value })),
      })),
  }));

  const tree: MasterTree = {
    categories,
    brands: all.filter((r) => r.type === "brand").map((r) => r.value),
    manufacturers: all.filter((r) => r.type === "manufacturer").map((r) => r.value),
    suppliers: all.filter((r) => r.type === "supplier").map((r) => r.value),
  };
  return NextResponse.json({ ok: true, tree });
}

// POST /api/masters/values { type, value, parentId? } → add a value (idempotent).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "MasterValue" });
  if (denied) return denied;

  let body: { type?: string; value?: string; parentId?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const type = String(body.type ?? "").trim() as MasterType;
  const value = String(body.value ?? "").trim();
  const parentId = body.parentId != null ? Number(body.parentId) : null;

  if (!TYPES.includes(type)) return NextResponse.json({ ok: false, message: "Unknown master type." }, { status: 400 });
  if (!value) return NextResponse.json({ ok: false, message: "Value is required." }, { status: 422 });
  // Sub-category / Group must be created under a parent.
  if (PARENT_TYPE[type] && parentId == null) {
    return NextResponse.json({ ok: false, message: `Select a ${PARENT_TYPE[type]} first.` }, { status: 422 });
  }

  // Optional parent must belong to the same tenant.
  if (parentId != null) {
    const parent = await prisma.masterValue.findFirst({ where: { id: parentId, tenantId: user.tenantId }, select: { id: true } });
    if (!parent) return NextResponse.json({ ok: false, message: "Parent not found." }, { status: 422 });
  }

  // Idempotent: reuse if the same value already exists under the same parent (within this tenant).
  const existing = await prisma.masterValue.findFirst({ where: { tenantId: user.tenantId, type, value, parentId } });
  if (existing) return NextResponse.json({ ok: true, id: existing.id, type, value });

  const seg = await resolveWriteScope(user, (body as { scopeBranchId?: number | "all" }).scopeBranchId);
  const created = await prisma.masterValue.create({ data: { tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined, type, value, parentId } });
  await writeAudit(prisma, user, {
    action: "master_value.create", entity: "MasterValue", entityId: created.id,
    summary: `Added ${type} "${value}"`,
    meta: { type, value, parentId },
    businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, id: created.id, type, value });
}
