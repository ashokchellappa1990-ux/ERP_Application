import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { loadingOperatorInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

function toRow(r: { id: number; name: string; status: string; remarks: string | null }) {
  return { id: r.id, name: r.name, status: r.status, remarks: r.remarks };
}

// GET /api/transport/masters/loading-operator/[id] — single loading operator.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.loadingOperator.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId, deletedAt: null } });
  if (!r) return NextResponse.json({ ok: false, message: "Loading operator not found." }, { status: 404 });
  return NextResponse.json({ ok: true, row: toRow(r) });
}

// PUT /api/transport/masters/loading-operator/[id] — update a loading operator.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.loadingOperator.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: { id: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Loading operator not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoadingOperator", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = loadingOperatorInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  try {
    const updated = await prisma.loadingOperator.update({
      where: { id },
      data: { name: b.name, status: b.status, remarks: b.remarks ?? null, updatedBy: user.id },
    });
    await writeAudit(prisma, user, {
      action: "transport_loading_operator.update", entity: "LoadingOperator", entityId: id,
      summary: `Updated loading operator ${updated.name}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, row: toRow(updated), message: "Loading operator updated." });
  } catch (err) {
    console.error("[transport/loading-operator] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the loading operator." }, { status: 500 });
  }
}

// DELETE /api/transport/masters/loading-operator/[id] — soft delete.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.loadingOperator.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null }, select: { id: true, name: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Loading operator not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoadingOperator", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  await prisma.loadingOperator.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: user.id } });
  await writeAudit(prisma, user, {
    action: "transport_loading_operator.delete", entity: "LoadingOperator", entityId: id,
    summary: `Deleted loading operator ${existing.name}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Loading operator deleted." });
}
