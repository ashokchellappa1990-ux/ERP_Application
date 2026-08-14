import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { AreaSaveSchema, AreaStatusSchema, type AreaDto } from "@/lib/contracts/area";

// Must match the permission key auto-derived from the sidebar route
// (/system/areas → "system.areas") — see routeKey() in lib/auth/permissions.ts.
const PERM = "system.areas";

async function toDto(r: NonNullable<Awaited<ReturnType<typeof prisma.area.findFirst>>>, user: { tenantId: number }): Promise<AreaDto> {
  const allowed = await getAllowedScope({ ...user } as never);
  const parent = r.parentAreaId ? await prisma.area.findFirst({ where: { id: r.parentAreaId, tenantId: r.tenantId }, select: { name: true } }) : null;
  return {
    id: r.id, businessId: r.businessId, branchId: r.branchId, branchName: allowed.branches.find((b) => b.id === r.branchId)?.name ?? null,
    code: r.code, name: r.name, type: r.type, parentAreaId: r.parentAreaId, parentAreaName: parent?.name ?? null,
    description: r.description, status: r.status as AreaDto["status"],
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const r = await prisma.area.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, area: await toDto(r, user) });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "Area" });
  if (denied) return denied;
  const cur = await prisma.area.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = AreaSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  if (b.parentAreaId && Number(b.parentAreaId) === cur.id) return NextResponse.json({ ok: false, message: "An area cannot be its own parent." }, { status: 422 });

  // Branch can only change if this area has no child areas — mirrors Cost
  // Centre's "has children → can't restructure" guard. No transaction
  // integration exists yet, so child-area dependency is what we track.
  if (b.branchId !== cur.branchId) {
    const kids = await prisma.area.count({ where: { parentAreaId: cur.id } });
    if (kids > 0) return NextResponse.json({ ok: false, message: "This area cannot be moved to another branch because other areas are nested under it." }, { status: 422 });
  }
  if (b.parentAreaId) {
    const parent = await prisma.area.findFirst({ where: { id: b.parentAreaId, tenantId: user.tenantId }, select: { branchId: true } });
    if (!parent) return NextResponse.json({ ok: false, message: "Parent area not found." }, { status: 422 });
    if (parent.branchId !== b.branchId) return NextResponse.json({ ok: false, message: "Parent area must belong to the same branch." }, { status: 422 });
  }
  if (b.code !== cur.code) {
    const dupe = await prisma.area.findFirst({ where: { tenantId: user.tenantId, branchId: b.branchId, code: b.code, id: { not: cur.id } } });
    if (dupe) return NextResponse.json({ ok: false, message: `Area code "${b.code}" already exists in this branch.` }, { status: 409 });
  }

  await prisma.area.update({
    where: { id: cur.id },
    data: { branchId: b.branchId, code: b.code, name: b.name, type: b.type, parentAreaId: b.parentAreaId ?? null, description: b.description ?? null, status: b.status, updatedBy: user.id },
  });
  await writeAudit(prisma, user, { action: "area.update", entity: "Area", entityId: cur.id, summary: `Area ${cur.code} updated`, meta: { before: { name: cur.name, type: cur.type, status: cur.status, branchId: cur.branchId }, after: { name: b.name, type: b.type, status: b.status, branchId: b.branchId } }, businessId: cur.businessId ?? null, branchId: b.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Area updated." });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "Area" });
  if (denied) return denied;
  const cur = await prisma.area.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = AreaStatusSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 422 });
  await prisma.area.update({ where: { id: cur.id }, data: { status: parsed.data.status, updatedBy: user.id } });
  await writeAudit(prisma, user, { action: "area.status_change", entity: "Area", entityId: cur.id, summary: `Area ${cur.code} → ${parsed.data.status}`, meta: { from: cur.status, to: parsed.data.status }, businessId: cur.businessId ?? null, branchId: cur.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, status: parsed.data.status, message: `Area ${parsed.data.status === "Inactive" ? "deactivated" : "activated"}.` });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "Area" });
  if (denied) return denied;
  const cur = await prisma.area.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  const kids = await prisma.area.count({ where: { parentAreaId: cur.id } });
  if (kids > 0) return NextResponse.json({ ok: false, message: "This area cannot be deleted because it has child areas — deactivate instead." }, { status: 422 });
  await prisma.area.delete({ where: { id: cur.id } });
  await writeAudit(prisma, user, { action: "area.delete", entity: "Area", entityId: cur.id, summary: `Area ${cur.code} deleted`, meta: { code: cur.code }, businessId: cur.businessId ?? null, branchId: cur.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Area deleted." });
}
