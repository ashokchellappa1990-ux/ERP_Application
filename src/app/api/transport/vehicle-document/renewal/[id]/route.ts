import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { renewalUpdateInput } from "@/lib/contracts/vehicleDocument";

const PERM = "masters.transport";

// PUT — move a renewal through its workflow (Initiated -> In Progress ->
// Submitted -> Verified, or Rejected/Cancelled). Use POST .../complete to
// finish it (that step creates the new document version).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.vehicleDocumentRenewal.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Renewal not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDocumentRenewal", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;
  if (["Completed", "Rejected", "Cancelled"].includes(existing.status)) return NextResponse.json({ ok: false, message: `Renewal is already ${existing.status}.` }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = renewalUpdateInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  if (parsed.data.status === "Completed") return NextResponse.json({ ok: false, message: "Use the Complete Renewal action to finish this — it captures the new document details." }, { status: 422 });

  await prisma.vehicleDocumentRenewal.update({ where: { id }, data: { status: parsed.data.status, remarks: parsed.data.remarks ?? existing.remarks, updatedBy: user.id } });
  await writeAudit(prisma, user, { action: "vehicle_document_renewal.status", entity: "VehicleDocumentRenewal", entityId: String(id), summary: `Renewal #${id} → ${parsed.data.status}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Renewal status updated." });
}
