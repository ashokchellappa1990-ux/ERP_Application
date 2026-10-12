import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { renewalCompleteInput } from "@/lib/contracts/vehicleDocument";

const PERM = "masters.transport";

// POST — completes a renewal by creating a brand-new VehicleDocument version
// (never overwriting the old one — Rule 9/10) and marking the old one
// "Replaced" so it stops counting as the active compliance document.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleDocumentRenewal.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Renewal not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDocumentRenewal", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;
  if (["Completed", "Rejected", "Cancelled"].includes(existing.status)) return NextResponse.json({ ok: false, message: `Renewal is already ${existing.status}.` }, { status: 422 });

  const oldDoc = await prisma.vehicleDocument.findFirst({ where: { id: existing.vehicleDocumentId, tenantId: user.tenantId } });
  if (!oldDoc) return NextResponse.json({ ok: false, message: "Original document not found." }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = renewalCompleteInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;
  const totalCost = Math.round((b.renewalCost + b.tax + b.otherCharges) * 100) / 100;

  const newDoc = await prisma.$transaction(async (tx) => {
    const created = await tx.vehicleDocument.create({
      data: {
        tenantId: user.tenantId, businessId: oldDoc.businessId, branchId: oldDoc.branchId,
        vehicleId: oldDoc.vehicleId, documentTypeId: oldDoc.documentTypeId,
        documentNo: b.newDocumentNo ?? oldDoc.documentNo, issueDate: new Date(b.newIssueDate), expiryDate: new Date(b.newExpiryDate),
        issuingAuthority: b.issuingAuthority ?? oldDoc.issuingAuthority, placeOfIssue: oldDoc.placeOfIssue,
        renewalRequired: oldDoc.renewalRequired, renewalFrequencyMonths: oldDoc.renewalFrequencyMonths,
        cost: b.renewalCost, tax: b.tax, otherCharges: b.otherCharges, totalCost,
        paymentDate: b.renewalDate ? new Date(b.renewalDate) : null, remarks: b.remarks ?? null,
        previousDocId: oldDoc.id, versionNo: oldDoc.versionNo + 1, status: "Active", createdBy: user.id,
      },
    });
    if (b.attachments.length) {
      await tx.vehicleDocumentAttachment.createMany({ data: b.attachments.map((a) => ({ tenantId: user.tenantId, vehicleDocumentId: created.id, fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType ?? null, size: a.size ?? null, uploadedBy: user.id })) });
    }
    await tx.vehicleDocument.update({ where: { id: oldDoc.id }, data: { status: "Replaced", updatedBy: user.id } });
    await tx.vehicleDocumentRenewal.update({
      where: { id },
      data: {
        status: "Completed", newDocumentId: created.id, newDocumentNo: b.newDocumentNo ?? null,
        newIssueDate: new Date(b.newIssueDate), newExpiryDate: new Date(b.newExpiryDate),
        renewalDate: b.renewalDate ? new Date(b.renewalDate) : new Date(),
        renewalCost: b.renewalCost, tax: b.tax, otherCharges: b.otherCharges, totalCost,
        issuingAuthority: b.issuingAuthority ?? null, remarks: b.remarks ?? existing.remarks, updatedBy: user.id,
      },
    });
    return created;
  });

  await writeAudit(prisma, user, { action: "vehicle_document_renewal.complete", entity: "VehicleDocumentRenewal", entityId: String(id), summary: `Renewal completed — new document #${newDoc.id} (v${newDoc.versionNo}) replaces #${oldDoc.id}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, newDocumentId: newDoc.id, message: "Renewal completed — new document version created." });
}
