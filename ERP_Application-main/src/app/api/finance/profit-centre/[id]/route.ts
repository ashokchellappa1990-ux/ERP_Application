import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ProfitCentreSaveSchema, CentreStatusSchema, type ProfitCentreDto } from "@/lib/contracts/costCentre";

const PERM = "system.profit-centre";

async function toDto(r: NonNullable<Awaited<ReturnType<typeof prisma.profitCentre.findFirst>>>, user: { tenantId: number }): Promise<ProfitCentreDto> {
  const allowed = await getAllowedScope({ ...user } as never);
  const parent = r.parentId ? await prisma.profitCentre.findFirst({ where: { id: r.parentId, tenantId: r.tenantId }, select: { name: true } }) : null;
  return {
    id: r.id, businessId: r.businessId, branchId: r.branchId, branchName: r.branchId == null ? null : allowed.branches.find((b) => b.id === r.branchId)?.name ?? null,
    code: r.code, name: r.name, description: r.description, businessUnit: r.businessUnit, division: r.division,
    parentId: r.parentId, parentName: parent?.name ?? null, manager: r.manager, status: r.status as ProfitCentreDto["status"], effectiveDate: r.effectiveDate, remarks: r.remarks,
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const r = await prisma.profitCentre.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, profitCentre: await toDto(r, user) });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ProfitCentre" });
  if (denied) return denied;
  const cur = await prisma.profitCentre.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = ProfitCentreSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  if (b.parentId && Number(b.parentId) === cur.id) return NextResponse.json({ ok: false, message: "A profit centre cannot be its own parent." }, { status: 422 });
  const allowed = await getAllowedScope(user);
  const branchId = b.branchId && allowed.branches.some((x) => x.id === Number(b.branchId) && x.businessId === cur.businessId) ? Number(b.branchId) : null;
  await prisma.profitCentre.update({ where: { id: cur.id }, data: {
    name: b.name, description: b.description ?? null, branchId, businessUnit: b.businessUnit ?? null, division: b.division ?? null,
    parentId: b.parentId ?? null, manager: b.manager ?? null, status: b.status, effectiveDate: b.effectiveDate ?? null, remarks: b.remarks ?? null,
  } });
  await writeAudit(prisma, user, { action: "profit_centre.update", entity: "ProfitCentre", entityId: cur.id, summary: `Profit centre ${cur.code} updated`, meta: { name: b.name, status: b.status, manager: b.manager ?? null }, businessId: cur.businessId ?? null, branchId: branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Profit centre updated." });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ProfitCentre" });
  if (denied) return denied;
  const cur = await prisma.profitCentre.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = CentreStatusSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 422 });
  await prisma.profitCentre.update({ where: { id: cur.id }, data: { status: parsed.data.status } });
  await writeAudit(prisma, user, { action: "profit_centre.status", entity: "ProfitCentre", entityId: cur.id, summary: `Profit centre ${cur.code} → ${parsed.data.status}`, meta: { from: cur.status, to: parsed.data.status }, businessId: cur.businessId ?? null, branchId: cur.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, status: parsed.data.status, message: `Profit centre ${parsed.data.status === "Inactive" ? "deactivated" : "activated"}.` });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ProfitCentre" });
  if (denied) return denied;
  const cur = await prisma.profitCentre.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  const [kids, used] = await Promise.all([prisma.profitCentre.count({ where: { parentId: cur.id } }), prisma.journalEntry.count({ where: { tenantId: user.tenantId, profitCenterId: cur.id } })]);
  if (kids > 0) return NextResponse.json({ ok: false, message: "Has child profit centres — deactivate instead." }, { status: 422 });
  if (used > 0) return NextResponse.json({ ok: false, message: "Used in postings — deactivate instead." }, { status: 422 });
  await prisma.profitCentre.delete({ where: { id: cur.id } });
  await writeAudit(prisma, user, { action: "profit_centre.delete", entity: "ProfitCentre", entityId: cur.id, summary: `Profit centre ${cur.code} deleted`, meta: { code: cur.code }, businessId: cur.businessId ?? null, branchId: cur.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Profit centre deleted." });
}
