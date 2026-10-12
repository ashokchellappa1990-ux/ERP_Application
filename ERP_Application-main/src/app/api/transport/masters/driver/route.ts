import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
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

// GET /api/transport/masters/driver — list drivers (tenant/business/branch scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.DriverMasterWhereInput = { ...scopeWhere(scope, { branch: true }), deletedAt: null };
  if (q) where.OR = [{ name: { contains: q } }, { licenseNo: { contains: q } }, { phone: { contains: q } }, { driverCode: { contains: q } }];
  if (status && status !== "All") where.status = status;

  const rows = await prisma.driverMaster.findMany({ where, orderBy: { id: "desc" }, take: 500 });
  return NextResponse.json({ ok: true, rows: rows.map(toRow) });
}

// POST /api/transport/masters/driver — create a driver.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "DriverMaster" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = driverInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  try {
    const created = await prisma.driverMaster.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
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
        createdBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_driver.create", entity: "DriverMaster", entityId: created.id,
      summary: `Created driver ${created.name}`, meta: { name: created.name },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, id: created.id, row: toRow(created), message: "Driver created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A driver with these details already exists." }, { status: 409 });
    }
    console.error("[transport/driver] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the driver." }, { status: 500 });
  }
}
