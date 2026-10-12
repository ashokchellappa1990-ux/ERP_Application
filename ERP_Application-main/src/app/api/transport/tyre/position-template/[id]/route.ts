import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { positionTemplateInput } from "@/lib/contracts/tyre";

const PERM = "transport.tyre";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const id = Number(params.id);
  const r = await prisma.tyrePositionTemplate.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Template not found." }, { status: 404 });
  const codes = await prisma.tyrePositionCode.findMany({ where: { templateId: id }, orderBy: { displayOrder: "asc" } });
  return NextResponse.json({ ok: true, template: r, codes });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.tyrePositionTemplate.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Template not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyrePositionTemplate", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = positionTemplateInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  if (b.isDefault) await prisma.tyrePositionTemplate.updateMany({ where: { tenantId: user.tenantId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
  await prisma.tyrePositionTemplate.update({ where: { id }, data: { templateName: b.templateName, vehicleType: b.vehicleType ?? null, numberOfAxles: b.numberOfAxles ?? null, isDefault: b.isDefault, status: b.status, remarks: b.remarks ?? null, updatedBy: user.id } });
  await writeAudit(prisma, user, { action: "tyre.position_template.update", entity: "TyrePositionTemplate", entityId: id, summary: `Position template ${b.templateName} updated`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Template updated." });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.tyrePositionTemplate.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Template not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyrePositionTemplate", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  await prisma.tyrePositionCode.deleteMany({ where: { templateId: id } });
  await prisma.tyrePositionTemplate.delete({ where: { id } });
  await writeAudit(prisma, user, { action: "tyre.position_template.delete", entity: "TyrePositionTemplate", entityId: id, summary: `Position template ${existing.templateName} deleted`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Template deleted." });
}
