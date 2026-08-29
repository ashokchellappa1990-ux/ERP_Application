import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { vehicleDocumentInput, type VehicleDocumentDetail } from "@/lib/contracts/vehicleDocument";
import { computeDocStatus, getComplianceConfig } from "@/lib/transport/vehicleCompliance";

const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number { return v == null ? 0 : Number(v); }
function dstr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.vehicleDocument.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Vehicle document not found." }, { status: 404 });

  const config = await getComplianceConfig(user.tenantId);
  const [vehicle, docType, createdByUser, updatedByUser, cancelledByUser, attachments, renewal] = await Promise.all([
    prisma.vehicleMaster.findFirst({ where: { id: r.vehicleId }, select: { vehicleNo: true, vehicleType: true } }),
    prisma.vehicleDocumentType.findFirst({ where: { id: r.documentTypeId }, select: { name: true, mandatory: true } }),
    r.createdBy != null ? prisma.user.findFirst({ where: { id: r.createdBy }, select: { fullName: true } }) : null,
    r.updatedBy != null ? prisma.user.findFirst({ where: { id: r.updatedBy }, select: { fullName: true } }) : null,
    r.cancelledBy != null ? prisma.user.findFirst({ where: { id: r.cancelledBy }, select: { fullName: true } }) : null,
    prisma.vehicleDocumentAttachment.findMany({ where: { tenantId: user.tenantId, vehicleDocumentId: r.id }, orderBy: { id: "asc" } }),
    prisma.vehicleDocumentRenewal.findFirst({ where: { tenantId: user.tenantId, vehicleDocumentId: r.id }, orderBy: { id: "desc" } }),
  ]);

  // Walk the version chain both backwards (previousDocId) and forwards (any
  // doc whose previousDocId points to one in our chain) to list every version.
  const chainIds = new Set<number>([r.id]);
  let cursor: number | null = r.previousDocId;
  while (cursor != null) { chainIds.add(cursor); const prev = await prisma.vehicleDocument.findFirst({ where: { id: cursor }, select: { previousDocId: true } }); cursor = prev?.previousDocId ?? null; }
  const forward = await prisma.vehicleDocument.findMany({ where: { tenantId: user.tenantId, previousDocId: { in: Array.from(chainIds) } }, select: { id: true } });
  forward.forEach((f) => chainIds.add(f.id));
  const versionRows = await prisma.vehicleDocument.findMany({ where: { id: { in: Array.from(chainIds) } }, orderBy: { versionNo: "asc" } });

  const { status: computedStatus, daysRemaining } = computeDocStatus(r.expiryDate, config.expiringSoonDays);
  const row: VehicleDocumentDetail = {
    id: r.id, vehicleId: r.vehicleId, vehicleNo: vehicle?.vehicleNo ?? "—", vehicleType: vehicle?.vehicleType ?? null,
    documentTypeId: r.documentTypeId, documentTypeName: docType?.name ?? "—", documentNo: r.documentNo,
    issueDate: dstr(r.issueDate), expiryDate: dstr(r.expiryDate), daysRemaining, computedStatus, dbStatus: r.status,
    versionNo: r.versionNo, mandatory: docType?.mandatory ?? false, issuingAuthority: r.issuingAuthority, totalCost: num(r.totalCost),
    renewalStatus: renewal && !["Completed", "Rejected", "Cancelled"].includes(renewal.status) ? renewal.status : null,
    createdByName: createdByUser?.fullName ?? null, createdAt: r.createdAt.toISOString(),
    placeOfIssue: r.placeOfIssue, renewalRequired: r.renewalRequired, renewalFrequencyMonths: r.renewalFrequencyMonths,
    cost: num(r.cost), tax: num(r.tax), otherCharges: num(r.otherCharges), paymentDate: dstr(r.paymentDate), paymentReference: r.paymentReference,
    remarks: r.remarks, previousDocId: r.previousDocId,
    attachments: attachments.map((a) => ({ id: a.id, fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType, size: a.size })),
    updatedByName: updatedByUser?.fullName ?? null, updatedAt: r.updatedAt.toISOString(),
    cancelledByName: cancelledByUser?.fullName ?? null, cancelledAt: r.cancelledAt?.toISOString() ?? null, cancellationReason: r.cancellationReason,
    versions: versionRows.map((v) => ({ id: v.id, versionNo: v.versionNo, documentNo: v.documentNo, expiryDate: dstr(v.expiryDate), status: v.status, computedStatus: v.status === "Active" ? computeDocStatus(v.expiryDate, config.expiringSoonDays).status : (v.status === "Cancelled" ? "Missing" : "Expired") })),
  };
  return NextResponse.json({ ok: true, row });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleDocument.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Vehicle document not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDocument", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;
  if (existing.status !== "Active") return NextResponse.json({ ok: false, message: "Only an Active document can be edited." }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = vehicleDocumentInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;
  const totalCost = Math.round((b.cost + b.tax + b.otherCharges) * 100) / 100;

  await prisma.$transaction(async (tx) => {
    await tx.vehicleDocument.update({
      where: { id },
      data: {
        documentNo: b.documentNo ?? null, issueDate: b.issueDate ? new Date(b.issueDate) : null, expiryDate: b.expiryDate ? new Date(b.expiryDate) : null,
        issuingAuthority: b.issuingAuthority ?? null, placeOfIssue: b.placeOfIssue ?? null,
        renewalRequired: b.renewalRequired, renewalFrequencyMonths: b.renewalFrequencyMonths ?? null,
        cost: b.cost, tax: b.tax, otherCharges: b.otherCharges, totalCost,
        paymentDate: b.paymentDate ? new Date(b.paymentDate) : null, paymentReference: b.paymentReference ?? null,
        remarks: b.remarks ?? null, updatedBy: user.id,
      },
    });
    if (b.attachments.length) {
      const existingUrls = new Set((await tx.vehicleDocumentAttachment.findMany({ where: { vehicleDocumentId: id }, select: { fileUrl: true } })).map((a) => a.fileUrl));
      const fresh = b.attachments.filter((a) => !existingUrls.has(a.fileUrl));
      if (fresh.length) await tx.vehicleDocumentAttachment.createMany({ data: fresh.map((a) => ({ tenantId: user.tenantId, vehicleDocumentId: id, fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType ?? null, size: a.size ?? null, uploadedBy: user.id })) });
    }
  });
  await writeAudit(prisma, user, { action: "vehicle_document.update", entity: "VehicleDocument", entityId: String(id), summary: `Updated vehicle document #${id}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Vehicle document updated." });
}
