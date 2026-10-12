import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { renewalInitiateInput, type RenewalRow } from "@/lib/contracts/vehicleDocument";

const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number { return v == null ? 0 : Number(v); }
function dstr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const scope = await getActiveScope(user);
  const where: Prisma.VehicleDocumentRenewalWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (status && status !== "All") where.status = status;

  const rows = await prisma.vehicleDocumentRenewal.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const docIds = Array.from(new Set(rows.map((r) => r.vehicleDocumentId)));
  const docs = docIds.length ? await prisma.vehicleDocument.findMany({ where: { id: { in: docIds } }, select: { id: true, vehicleId: true, documentTypeId: true, expiryDate: true } }) : [];
  const docMap = new Map(docs.map((d) => [d.id, d]));
  const vehicleIds = Array.from(new Set(docs.map((d) => d.vehicleId)));
  const typeIds = Array.from(new Set(docs.map((d) => d.documentTypeId)));
  const [vehicles, types] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
    typeIds.length ? prisma.vehicleDocumentType.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } }) : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const tMap = new Map(types.map((t) => [t.id, t.name]));

  const list: RenewalRow[] = rows.map((r) => {
    const doc = docMap.get(r.vehicleDocumentId);
    return {
      id: r.id, vehicleDocumentId: r.vehicleDocumentId, vehicleNo: doc ? vMap.get(doc.vehicleId) ?? "—" : "—",
      documentTypeName: doc ? tMap.get(doc.documentTypeId) ?? "—" : "—", currentExpiry: doc ? dstr(doc.expiryDate) : null,
      status: r.status, initiatedDate: dstr(r.initiatedDate) ?? "", renewalDate: dstr(r.renewalDate),
      newExpiryDate: dstr(r.newExpiryDate), totalCost: num(r.totalCost), newDocumentId: r.newDocumentId,
    };
  });
  return NextResponse.json({ ok: true, rows: list });
}

// POST — initiate a renewal for a document (Section 15, first step: Pending).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleDocumentRenewal" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = renewalInitiateInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const doc = await prisma.vehicleDocument.findFirst({ where: { id: b.vehicleDocumentId, tenantId: user.tenantId, status: "Active" } });
  if (!doc) return NextResponse.json({ ok: false, message: "Document not found or not Active." }, { status: 422 });
  const openRenewal = await prisma.vehicleDocumentRenewal.findFirst({ where: { tenantId: user.tenantId, vehicleDocumentId: b.vehicleDocumentId, status: { notIn: ["Completed", "Rejected", "Cancelled"] } } });
  if (openRenewal) return NextResponse.json({ ok: false, message: "A renewal is already in progress for this document." }, { status: 422 });

  const seg = await resolveWriteScope(user);
  const created = await prisma.vehicleDocumentRenewal.create({
    data: { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, vehicleDocumentId: b.vehicleDocumentId, status: "Initiated", remarks: b.remarks ?? null, createdBy: user.id },
  });
  await writeAudit(prisma, user, { action: "vehicle_document_renewal.initiate", entity: "VehicleDocumentRenewal", entityId: String(created.id), summary: `Initiated renewal for document #${b.vehicleDocumentId}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, message: "Renewal initiated." }, { status: 201 });
}
