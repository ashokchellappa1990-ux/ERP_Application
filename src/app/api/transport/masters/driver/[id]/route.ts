import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { driverInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

/** "YYYY-MM-DD" (from a date input) <-> DateTime column. */
function toDate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function toDateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

type DriverRow = Awaited<ReturnType<typeof prisma.driverMaster.findFirstOrThrow>>;

function toRow(r: DriverRow) {
  return {
    id: r.id, name: r.name, licenseNo: r.licenseNo, licenseExpiry: r.licenseExpiry, phone: r.phone,
    transportCompanyId: r.transportCompanyId, status: r.status, remarks: r.remarks,
    driverCode: r.driverCode, alternateContact: r.alternateContact, address: r.address,
    dob: toDateStr(r.dob), gender: r.gender, joiningDate: toDateStr(r.joiningDate),
    licenseType: r.licenseType, licenseIssuingAuthority: r.licenseIssuingAuthority, licenseIssueDate: toDateStr(r.licenseIssueDate),
    permittedVehicleClass: r.permittedVehicleClass,
    employmentType: r.employmentType,
    emergencyContactName: r.emergencyContactName, emergencyContactNumber: r.emergencyContactNumber, emergencyContactRelationship: r.emergencyContactRelationship,
    idProofType: r.idProofType, idProofNo: r.idProofNo,
    medicalFitnessNo: r.medicalFitnessNo, medicalFitnessValidUpto: toDateStr(r.medicalFitnessValidUpto),
    otherDocumentsNote: r.otherDocumentsNote,
  };
}

// GET /api/transport/masters/driver/[id] — single driver.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.driverMaster.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId, deletedAt: null } });
  if (!r) return NextResponse.json({ ok: false, message: "Driver not found." }, { status: 404 });
  return NextResponse.json({ ok: true, row: toRow(r) });
}

// PUT /api/transport/masters/driver/[id] — update a driver.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.driverMaster.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: { id: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Driver not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "DriverMaster", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = driverInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  try {
    const updated = await prisma.driverMaster.update({
      where: { id },
      data: {
        name: b.name, licenseNo: b.licenseNo ?? null, licenseExpiry: b.licenseExpiry ?? null, phone: b.phone ?? null,
        transportCompanyId: b.transportCompanyId ?? null, status: b.status, remarks: b.remarks ?? null,
        driverCode: b.driverCode ?? null, alternateContact: b.alternateContact ?? null, address: b.address ?? null,
        dob: toDate(b.dob), gender: b.gender ?? null, joiningDate: toDate(b.joiningDate),
        licenseType: b.licenseType ?? null, licenseIssuingAuthority: b.licenseIssuingAuthority ?? null, licenseIssueDate: toDate(b.licenseIssueDate),
        permittedVehicleClass: b.permittedVehicleClass ?? null,
        employmentType: b.employmentType,
        emergencyContactName: b.emergencyContactName ?? null, emergencyContactNumber: b.emergencyContactNumber ?? null, emergencyContactRelationship: b.emergencyContactRelationship ?? null,
        idProofType: b.idProofType ?? null, idProofNo: b.idProofNo ?? null,
        medicalFitnessNo: b.medicalFitnessNo ?? null, medicalFitnessValidUpto: toDate(b.medicalFitnessValidUpto),
        otherDocumentsNote: b.otherDocumentsNote ?? null,
        updatedBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_driver.update", entity: "DriverMaster", entityId: id,
      summary: `Updated driver ${updated.name}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, row: toRow(updated), message: "Driver updated." });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A driver with these details already exists." }, { status: 409 });
    }
    console.error("[transport/driver] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the driver." }, { status: 500 });
  }
}

// DELETE /api/transport/masters/driver/[id] — soft delete.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.driverMaster.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: { id: true, name: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Driver not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "DriverMaster", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  await prisma.driverMaster.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: user.id } });
  await writeAudit(prisma, user, {
    action: "transport_driver.delete", entity: "DriverMaster", entityId: id,
    summary: `Deleted driver ${existing.name}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Driver deleted." });
}
