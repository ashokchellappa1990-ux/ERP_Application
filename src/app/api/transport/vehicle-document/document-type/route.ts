import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { documentTypeInput, type DocumentTypeRow } from "@/lib/contracts/vehicleDocument";

const PERM = "masters.transport";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const rows = await prisma.vehicleDocumentType.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  const counts = await prisma.vehicleDocument.groupBy({ by: ["documentTypeId"], where: { tenantId: user.tenantId, status: "Active" }, _count: { _all: true } });
  const countMap = new Map(counts.map((c) => [c.documentTypeId, c._count._all]));

  const list: DocumentTypeRow[] = rows.map((r) => ({
    id: r.id, code: r.code, name: r.name, description: r.description,
    applicableVehicleTypes: r.applicableVehicleTypes ? r.applicableVehicleTypes.split(",").map((x) => x.trim()).filter(Boolean) : [],
    mandatory: r.mandatory, expiryRequired: r.expiryRequired, renewalRequired: r.renewalRequired,
    alertEnabled: r.alertEnabled, defaultAlertDays: r.defaultAlertDays, isSystem: r.isSystem, status: r.status,
    docCount: countMap.get(r.id) ?? 0,
  }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDocumentType" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = documentTypeInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  try {
    const created = await prisma.vehicleDocumentType.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined,
        code: b.code.toUpperCase().replace(/\s+/g, "_"), name: b.name, description: b.description ?? null,
        applicableVehicleTypes: b.applicableVehicleTypes.length ? b.applicableVehicleTypes.join(",") : null,
        mandatory: b.mandatory, expiryRequired: b.expiryRequired, renewalRequired: b.renewalRequired,
        alertEnabled: b.alertEnabled, defaultAlertDays: b.defaultAlertDays, isSystem: false, status: b.status,
        createdBy: user.id,
      },
    });
    await writeAudit(prisma, user, { action: "vehicle_document_type.create", entity: "VehicleDocumentType", entityId: String(created.id), summary: `Created document type ${created.name}`, businessId: seg.businessId ?? null, branchId: null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, id: created.id, message: "Document type created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return NextResponse.json({ ok: false, message: `Code "${b.code}" already exists.` }, { status: 409 });
    console.error("[vehicle-document-type] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the document type." }, { status: 500 });
  }
}
