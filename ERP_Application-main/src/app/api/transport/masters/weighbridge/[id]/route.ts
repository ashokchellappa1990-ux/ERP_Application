import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { weighbridgeInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

function toRow(r: {
  id: number; code: string; name: string; location: string | null; capacity: Prisma.Decimal | null;
  calibrationDueDate: string | null; status: string; remarks: string | null;
}) {
  return {
    id: r.id, code: r.code, name: r.name, location: r.location,
    capacity: r.capacity == null ? null : Number(r.capacity), calibrationDueDate: r.calibrationDueDate,
    status: r.status, remarks: r.remarks,
  };
}

// GET /api/transport/masters/weighbridge/[id] — single weighbridge.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.weighbridgeMaster.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId, deletedAt: null } });
  if (!r) return NextResponse.json({ ok: false, message: "Weighbridge not found." }, { status: 404 });
  return NextResponse.json({ ok: true, row: toRow(r) });
}

// PUT /api/transport/masters/weighbridge/[id] — update a weighbridge.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.weighbridgeMaster.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: { id: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Weighbridge not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "WeighbridgeMaster", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = weighbridgeInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  try {
    const updated = await prisma.weighbridgeMaster.update({
      where: { id },
      data: {
        code: b.code, name: b.name, location: b.location ?? null, capacity: b.capacity ?? null,
        calibrationDueDate: b.calibrationDueDate ?? null, status: b.status, remarks: b.remarks ?? null,
        updatedBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_weighbridge.update", entity: "WeighbridgeMaster", entityId: id,
      summary: `Updated weighbridge ${updated.code}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, row: toRow(updated), message: "Weighbridge updated." });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A weighbridge with this code already exists.", errors: { code: "Already in use." } }, { status: 409 });
    }
    console.error("[transport/weighbridge] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the weighbridge." }, { status: 500 });
  }
}

// DELETE /api/transport/masters/weighbridge/[id] — soft delete.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.weighbridgeMaster.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: { id: true, code: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Weighbridge not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "WeighbridgeMaster", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  await prisma.weighbridgeMaster.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: user.id } });
  await writeAudit(prisma, user, {
    action: "transport_weighbridge.delete", entity: "WeighbridgeMaster", entityId: id,
    summary: `Deleted weighbridge ${existing.code}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Weighbridge deleted." });
}
