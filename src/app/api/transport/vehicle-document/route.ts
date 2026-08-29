import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { vehicleDocumentInput, type VehicleDocumentRow } from "@/lib/contracts/vehicleDocument";
import { computeDocStatus, getComplianceConfig } from "@/lib/transport/vehicleCompliance";

const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number { return v == null ? 0 : Number(v); }
function dstr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  const documentTypeId = url.searchParams.get("documentTypeId");
  const status = url.searchParams.get("status"); // computed status filter (Valid/Expiring Soon/Expired/Missing)
  const q = (url.searchParams.get("q") ?? "").trim();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const scope = await getActiveScope(user);
  const where: Prisma.VehicleDocumentWhereInput = { ...scopeWhere(scope, { branch: true }), status: "Active" };
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (documentTypeId) where.documentTypeId = Number(documentTypeId);
  if (from || to) where.expiryDate = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };

  const config = await getComplianceConfig(user.tenantId);
  const rows = await prisma.vehicleDocument.findMany({ where, orderBy: [{ expiryDate: "asc" }, { id: "desc" }], take: 2000 });
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const typeIds = Array.from(new Set(rows.map((r) => r.documentTypeId)));
  const createdByIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is number => x != null)));
  const [vehicles, types, users, mandatoryOverrides, renewals] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true, vehicleType: true } }) : [],
    typeIds.length ? prisma.vehicleDocumentType.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true, mandatory: true } }) : [],
    createdByIds.length ? prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [],
    prisma.vehicleDocumentMandatory.findMany({ where: { tenantId: user.tenantId } }),
    rows.length ? prisma.vehicleDocumentRenewal.findMany({ where: { tenantId: user.tenantId, vehicleDocumentId: { in: rows.map((r) => r.id) }, status: { notIn: ["Completed", "Rejected", "Cancelled"] } }, select: { vehicleDocumentId: true, status: true } }) : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v]));
  const tMap = new Map(types.map((t) => [t.id, t]));
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));
  const renewalMap = new Map(renewals.map((r) => [r.vehicleDocumentId, r.status]));
  const overrideMap = new Map(mandatoryOverrides.map((o) => [`${o.vehicleType}:${o.documentTypeId}`, o.mandatory]));

  let list: VehicleDocumentRow[] = rows.map((r) => {
    const vehicle = vMap.get(r.vehicleId);
    const type = tMap.get(r.documentTypeId);
    const { status: computedStatus, daysRemaining } = computeDocStatus(r.expiryDate, config.expiringSoonDays);
    const overrideKey = `${vehicle?.vehicleType ?? ""}:${r.documentTypeId}`;
    const mandatory = overrideMap.has(overrideKey) ? overrideMap.get(overrideKey)! : (type?.mandatory ?? false);
    return {
      id: r.id, vehicleId: r.vehicleId, vehicleNo: vehicle?.vehicleNo ?? "—", vehicleType: vehicle?.vehicleType ?? null,
      documentTypeId: r.documentTypeId, documentTypeName: type?.name ?? "—", documentNo: r.documentNo,
      issueDate: dstr(r.issueDate), expiryDate: dstr(r.expiryDate), daysRemaining, computedStatus, dbStatus: r.status,
      versionNo: r.versionNo, mandatory, issuingAuthority: r.issuingAuthority, totalCost: num(r.totalCost),
      renewalStatus: renewalMap.get(r.id) ?? null, createdByName: r.createdBy != null ? uMap.get(r.createdBy) ?? null : null, createdAt: r.createdAt.toISOString(),
    };
  });

  if (status && status !== "All") list = list.filter((r) => r.computedStatus === status || (status === "Renewal Pending" && r.renewalStatus));
  if (q) { const ql = q.toLowerCase(); list = list.filter((r) => r.vehicleNo.toLowerCase().includes(ql) || (r.documentNo ?? "").toLowerCase().includes(ql) || r.documentTypeName.toLowerCase().includes(ql)); }

  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDocument" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = vehicleDocumentInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: b.vehicleId, tenantId: user.tenantId, deletedAt: null } });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 422 });
  const docType = await prisma.vehicleDocumentType.findFirst({ where: { id: b.documentTypeId, tenantId: user.tenantId } });
  if (!docType) return NextResponse.json({ ok: false, message: "Document type not found." }, { status: 422 });
  if (docType.expiryRequired && !b.expiryDate) return NextResponse.json({ ok: false, message: `Expiry date is required for ${docType.name}.` }, { status: 422 });

  const totalCost = Math.round((b.cost + b.tax + b.otherCharges) * 100) / 100;
  const seg = await resolveWriteScope(user);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.vehicleDocument.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        vehicleId: b.vehicleId, documentTypeId: b.documentTypeId, documentNo: b.documentNo ?? null,
        issueDate: b.issueDate ? new Date(b.issueDate) : null, expiryDate: b.expiryDate ? new Date(b.expiryDate) : null,
        issuingAuthority: b.issuingAuthority ?? null, placeOfIssue: b.placeOfIssue ?? null,
        renewalRequired: b.renewalRequired, renewalFrequencyMonths: b.renewalFrequencyMonths ?? null,
        cost: b.cost, tax: b.tax, otherCharges: b.otherCharges, totalCost,
        paymentDate: b.paymentDate ? new Date(b.paymentDate) : null, paymentReference: b.paymentReference ?? null,
        remarks: b.remarks ?? null, versionNo: 1, status: "Active", createdBy: user.id,
      },
    });
    if (b.attachments.length) {
      await tx.vehicleDocumentAttachment.createMany({
        data: b.attachments.map((a) => ({ tenantId: user.tenantId, vehicleDocumentId: row.id, fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType ?? null, size: a.size ?? null, uploadedBy: user.id })),
      });
    }
    return row;
  });

  await writeAudit(prisma, user, { action: "vehicle_document.create", entity: "VehicleDocument", entityId: String(created.id), summary: `Added ${docType.name} for vehicle ${vehicle.vehicleNo}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, message: "Vehicle document saved." }, { status: 201 });
}
