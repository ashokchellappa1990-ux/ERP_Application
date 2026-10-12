import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

// PATCH /api/system/businesses/[id] — edit a business, toggle status, or make it
// the tenant's default (exactly one default per tenant).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, "setup", { req, entity: "Business", entityId: id });
  if (denied) return denied;

  let b: { name?: string; legalName?: string; gstNumber?: string; pan?: string; status?: string; makeDefault?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const biz = await prisma.business.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!biz) return NextResponse.json({ ok: false, message: "Business not found." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (b.makeDefault) {
      await tx.business.updateMany({ where: { tenantId: user.tenantId }, data: { isDefault: false } });
    }
    await tx.business.update({
      where: { id: biz.id },
      data: {
        name: b.name?.trim() || undefined,
        legalName: b.legalName !== undefined ? (b.legalName.trim() || null) : undefined,
        gstNumber: b.gstNumber !== undefined ? (b.gstNumber.trim() || null) : undefined,
        pan: b.pan !== undefined ? (b.pan.trim() || null) : undefined,
        status: b.status === "active" || b.status === "inactive" ? b.status : undefined,
        isDefault: b.makeDefault ? true : undefined,
      },
    });
  });

  await writeAudit(prisma, user, {
    action: "business.update", entity: "Business", entityId: biz.id,
    summary: `Updated business ${b.name?.trim() || biz.name}`,
    meta: { name: b.name?.trim(), legalName: b.legalName, gstNumber: b.gstNumber, pan: b.pan, status: b.status, makeDefault: b.makeDefault },
    businessId: biz.id, ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, message: "Business updated." });
}
