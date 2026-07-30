import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

// PATCH /api/system/entity-types/[id] — edit an entity type or toggle its status.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, "setup", { req, entity: "EntityType", entityId: id });
  if (denied) return denied;

  let b: { name?: string; description?: string; icon?: string; color?: string; allowChild?: boolean; displayOrder?: number; status?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const et = await prisma.entityType.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!et) return NextResponse.json({ ok: false, message: "Entity type not found." }, { status: 404 });

  await prisma.entityType.update({
    where: { id: et.id },
    data: {
      name: b.name?.trim().slice(0, 80) || undefined,
      description: b.description !== undefined ? (b.description.trim().slice(0, 300) || null) : undefined,
      icon: b.icon?.trim().slice(0, 40) || undefined,
      color: b.color?.trim().slice(0, 20) || undefined,
      allowChild: b.allowChild !== undefined ? b.allowChild : undefined,
      displayOrder: b.displayOrder !== undefined ? Number(b.displayOrder) || 1 : undefined,
      status: b.status === "active" || b.status === "inactive" ? b.status : undefined,
    },
  });

  await writeAudit(prisma, user, {
    action: "entityType.update", entity: "EntityType", entityId: et.id,
    summary: `Updated entity type ${b.name?.trim() || et.name}`,
    meta: { name: b.name?.trim(), allowChild: b.allowChild, status: b.status }, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Entity type updated." });
}
