import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

// GET /api/system/tenant — the tenant account + its businesses, each with branches,
// plus the caller's active scope. Backs the System → Account & Tenant screen.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "system.account");
  if (denied) return denied;

  const [tenant, businesses, scope] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: user.tenantId } }),
    prisma.business.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      include: { branches: { orderBy: [{ hierarchyLevel: "asc" }, { displayOrder: "asc" }, { id: "asc" }] } },
    }),
    getActiveScope(user),
  ]);
  if (!tenant) return NextResponse.json({ ok: false, message: "Tenant not found." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    tenant: {
      id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan, status: tenant.status,
      trialEndsAt: tenant.trialEndsAt, maxBranches: tenant.maxBranches, createdAt: tenant.createdAt,
    },
    businesses: businesses.map((b) => ({
      id: b.id, name: b.name, legalName: b.legalName ?? "", gstNumber: b.gstNumber ?? "", pan: b.pan ?? "",
      isDefault: b.isDefault, status: b.status,
      branches: b.branches.map((br) => ({
        id: br.id, name: br.name, code: br.code, type: br.type, city: br.city ?? "", state: br.state ?? "",
        gstin: br.gstin ?? "", isDefault: br.isDefault, status: br.status,
        hierarchyLevel: br.hierarchyLevel, parentBranchId: br.parentBranchId,
      })),
    })),
    scope,
  });
}

// PATCH /api/system/tenant — edit the tenant account name.
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "system.account", { req, entity: "Tenant", entityId: user.tenantId });
  if (denied) return denied;

  let b: { name?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const name = (b.name ?? "").trim().slice(0, 200);
  if (!name) return NextResponse.json({ ok: false, message: "Account name is required." }, { status: 422 });

  await prisma.tenant.update({ where: { id: user.tenantId }, data: { name } });
  await writeAudit(prisma, user, {
    action: "tenant.update", entity: "Tenant", entityId: user.tenantId,
    summary: `Updated account name to ${name}`,
    meta: { name },
    ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Account updated." });
}
