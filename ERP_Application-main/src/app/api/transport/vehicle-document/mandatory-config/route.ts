import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { mandatoryConfigInput } from "@/lib/contracts/vehicleDocument";

const PERM = "masters.transport";

// GET /api/transport/vehicle-document/mandatory-config?vehicleType=Tipper
// Returns every Active document type with whether it's mandatory for that
// vehicle type (per-type override if one exists, else the type's own default).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleType = (url.searchParams.get("vehicleType") ?? "").trim();

  const [types, overrides, vehicleTypes] = await Promise.all([
    prisma.vehicleDocumentType.findMany({ where: { tenantId: user.tenantId, status: "Active" }, orderBy: { name: "asc" } }),
    vehicleType ? prisma.vehicleDocumentMandatory.findMany({ where: { tenantId: user.tenantId, vehicleType } }) : Promise.resolve([]),
    prisma.vehicleMaster.findMany({ where: { tenantId: user.tenantId, deletedAt: null, vehicleType: { not: null } }, select: { vehicleType: true }, distinct: ["vehicleType"] }),
  ]);
  const overrideMap = new Map(overrides.map((o) => [o.documentTypeId, o.mandatory]));

  const rows = types.map((t) => ({
    documentTypeId: t.id, documentTypeName: t.name,
    mandatory: overrideMap.has(t.id) ? overrideMap.get(t.id)! : t.mandatory,
  }));
  const vTypes = Array.from(new Set(vehicleTypes.map((v) => v.vehicleType).filter((x): x is string => !!x))).sort();
  return NextResponse.json({ ok: true, rows, vehicleTypes: vTypes });
}

// PUT — replace the mandatory set for one vehicle type in one call.
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDocumentMandatory" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = mandatoryConfigInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  const types = await prisma.vehicleDocumentType.findMany({ where: { tenantId: user.tenantId, status: "Active" }, select: { id: true } });
  await prisma.$transaction(
    types.map((t) =>
      prisma.vehicleDocumentMandatory.upsert({
        where: { tenantId_vehicleType_documentTypeId: { tenantId: user.tenantId, vehicleType: b.vehicleType, documentTypeId: t.id } },
        create: { tenantId: user.tenantId, businessId: seg.businessId ?? null, vehicleType: b.vehicleType, documentTypeId: t.id, mandatory: b.documentTypeIds.includes(t.id), createdBy: user.id },
        update: { mandatory: b.documentTypeIds.includes(t.id), updatedBy: user.id },
      }),
    ),
  );
  await writeAudit(prisma, user, { action: "vehicle_document_mandatory.update", entity: "VehicleDocumentMandatory", entityId: b.vehicleType, summary: `Updated mandatory documents for vehicle type ${b.vehicleType}`, businessId: seg.businessId ?? null, branchId: null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Mandatory document configuration saved." });
}
