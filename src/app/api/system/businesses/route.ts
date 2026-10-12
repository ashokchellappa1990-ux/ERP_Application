import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

// POST /api/system/businesses — add a business under the tenant. The first one is
// flagged default. Each new business automatically gets a default "Main Branch".
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "setup", { req, entity: "Business" });
  if (denied) return denied;

  let b: { name?: string; legalName?: string; gstNumber?: string; pan?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const name = (b.name ?? "").trim().slice(0, 200);
  if (!name) return NextResponse.json({ ok: false, message: "Business name is required." }, { status: 422 });

  const count = await prisma.business.count({ where: { tenantId: user.tenantId } });

  const business = await prisma.$transaction(async (tx) => {
    const created = await tx.business.create({
      data: {
        tenantId: user.tenantId, name,
        legalName: b.legalName?.trim() || null, gstNumber: b.gstNumber?.trim() || null, pan: b.pan?.trim() || null,
        isDefault: count === 0, status: "active",
      },
    });
    // Every business needs at least one branch to hold operational data.
    await tx.branch.create({
      data: { tenantId: user.tenantId, businessId: created.id, name: "Main Branch", code: "MAIN", type: "Head Office", isDefault: true, status: "active" },
    });
    return created;
  });

  await writeAudit(prisma, user, {
    action: "business.create", entity: "Business", entityId: business.id,
    summary: `Added business ${business.name}`,
    meta: { name: business.name, legalName: business.legalName, gstNumber: business.gstNumber, pan: business.pan, isDefault: business.isDefault },
    businessId: business.id, ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, message: "Business added.", id: business.id }, { status: 201 });
}
