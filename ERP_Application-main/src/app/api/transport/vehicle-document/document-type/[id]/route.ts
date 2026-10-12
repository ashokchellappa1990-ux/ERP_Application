import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { documentTypeInput } from "@/lib/contracts/vehicleDocument";

const PERM = "masters.transport";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleDocumentType.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Document type not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDocumentType", entityId: id, businessId: existing.businessId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = documentTypeInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  await prisma.vehicleDocumentType.update({
    where: { id },
    data: {
      name: b.name, description: b.description ?? null,
      applicableVehicleTypes: b.applicableVehicleTypes.length ? b.applicableVehicleTypes.join(",") : null,
      mandatory: b.mandatory, expiryRequired: b.expiryRequired, renewalRequired: b.renewalRequired,
      alertEnabled: b.alertEnabled, defaultAlertDays: b.defaultAlertDays, status: b.status, updatedBy: user.id,
    },
  });
  await writeAudit(prisma, user, { action: "vehicle_document_type.update", entity: "VehicleDocumentType", entityId: String(id), summary: `Updated document type ${b.name}`, businessId: existing.businessId, branchId: null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Document type updated." });
}
