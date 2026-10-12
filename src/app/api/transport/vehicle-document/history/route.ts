import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";

const PERM = "masters.transport";
const ENTITIES = ["VehicleDocument", "VehicleDocumentRenewal", "VehicleDocumentType", "VehicleDocumentMandatory"];

// GET — Tab 6: History, sourced from the existing audit_logs framework
// (Section 18/30) rather than a bespoke history table.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");

  let entityIds: string[] | undefined;
  if (vehicleId) {
    const docs = await prisma.vehicleDocument.findMany({ where: { tenantId: user.tenantId, vehicleId: Number(vehicleId) }, select: { id: true } });
    entityIds = docs.map((d) => String(d.id));
    if (!entityIds.length) return NextResponse.json({ ok: true, rows: [] });
  }

  const logs = await prisma.auditLog.findMany({
    where: { tenantId: user.tenantId, entity: { in: ENTITIES }, ...(entityIds ? { entityId: { in: entityIds } } : {}) },
    orderBy: { id: "desc" },
    take: 500,
  });
  const rows = logs.map((l) => ({ id: l.id, action: l.action, entity: l.entity, entityId: l.entityId, summary: l.summary, userName: l.userName, at: l.createdAt.toISOString() }));
  return NextResponse.json({ ok: true, rows });
}
