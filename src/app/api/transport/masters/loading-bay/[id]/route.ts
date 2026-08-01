import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { loadingBayInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

function toRow(r: {
  id: number; code: string; name: string; warehouse: string | null; capacity: Prisma.Decimal | null;
  status: string; remarks: string | null;
}) {
  return {
    id: r.id, code: r.code, name: r.name, warehouse: r.warehouse,
    capacity: r.capacity == null ? null : Number(r.capacity), status: r.status, remarks: r.remarks,
  };
}

// GET /api/transport/masters/loading-bay/[id] — single loading bay.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.loadingBay.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId, deletedAt: null } });
  if (!r) return NextResponse.json({ ok: false, message: "Loading bay not found." }, { status: 404 });
  return NextResponse.json({ ok: true, row: toRow(r) });
}

// PUT /api/transport/masters/loading-bay/[id] — update a loading bay.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.loadingBay.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: { id: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Loading bay not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoadingBay", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = loadingBayInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  try {
    const updated = await prisma.loadingBay.update({
      where: { id },
      data: {
        code: b.code, name: b.name, warehouse: b.warehouse ?? null, capacity: b.capacity ?? null,
        status: b.status, remarks: b.remarks ?? null, updatedBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_loading_bay.update", entity: "LoadingBay", entityId: id,
      summary: `Updated loading bay ${updated.code}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, row: toRow(updated), message: "Loading bay updated." });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A loading bay with this code already exists.", errors: { code: "Already in use." } }, { status: 409 });
    }
    console.error("[transport/loading-bay] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the loading bay." }, { status: 500 });
  }
}

// DELETE /api/transport/masters/loading-bay/[id] — soft delete.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.loadingBay.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: { id: true, code: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Loading bay not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoadingBay", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  await prisma.loadingBay.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: user.id } });
  await writeAudit(prisma, user, {
    action: "transport_loading_bay.delete", entity: "LoadingBay", entityId: id,
    summary: `Deleted loading bay ${existing.code}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Loading bay deleted." });
}
