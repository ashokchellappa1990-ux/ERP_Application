import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { positionTemplateInput, type PositionTemplateRow } from "@/lib/contracts/tyre";

const PERM = "transport.tyre";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const rows = await prisma.tyrePositionTemplate.findMany({ where: scopeWhere(scope, { branch: true }), orderBy: { id: "desc" } });
  const counts = await prisma.tyrePositionCode.groupBy({ by: ["templateId"], where: { templateId: { in: rows.map((r) => r.id) } }, _count: true });
  const cMap = new Map(counts.map((c) => [c.templateId, c._count]));
  const list: PositionTemplateRow[] = rows.map((r) => ({
    id: r.id, templateName: r.templateName, vehicleType: r.vehicleType, numberOfAxles: r.numberOfAxles,
    isDefault: r.isDefault, status: r.status, codeCount: cMap.get(r.id) ?? 0,
  }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyrePositionTemplate" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = positionTemplateInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const scope = await getActiveScope(user);
  const seg = await resolveWriteScope(user);
  if (b.isDefault) await prisma.tyrePositionTemplate.updateMany({ where: { tenantId: user.tenantId, isDefault: true }, data: { isDefault: false } });
  const created = await prisma.tyrePositionTemplate.create({
    data: { tenantId: user.tenantId, ...scopeData(scope, { branch: true }), businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined, templateName: b.templateName, vehicleType: b.vehicleType ?? null, numberOfAxles: b.numberOfAxles ?? null, isDefault: b.isDefault, status: b.status, remarks: b.remarks ?? null, createdBy: user.id },
  });
  await writeAudit(prisma, user, { action: "tyre.position_template.create", entity: "TyrePositionTemplate", entityId: created.id, summary: `Position template ${b.templateName} created`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, message: "Position template created." }, { status: 201 });
}
