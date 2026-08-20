import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { positionCodeInput } from "@/lib/contracts/tyre";

const PERM = "transport.tyre";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const templateId = Number(params.id);
  const rows = await prisma.tyrePositionCode.findMany({ where: { tenantId: user.tenantId, templateId }, orderBy: { displayOrder: "asc" } });
  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const templateId = Number(params.id);
  const template = await prisma.tyrePositionTemplate.findFirst({ where: { id: templateId, tenantId: user.tenantId } });
  if (!template) return NextResponse.json({ ok: false, message: "Template not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyrePositionCode", entityId: templateId, businessId: template.businessId, branchId: template.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = positionCodeInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const dup = await prisma.tyrePositionCode.findFirst({ where: { templateId, positionCode: b.positionCode } });
  if (dup) return NextResponse.json({ ok: false, message: `Position code ${b.positionCode} already exists in this template.` }, { status: 422 });

  const created = await prisma.tyrePositionCode.create({
    data: { tenantId: user.tenantId, templateId, positionCode: b.positionCode, positionLabel: b.positionLabel, axleNumber: b.axleNumber ?? null, side: b.side ?? null, wheelSet: b.wheelSet ?? null, displayOrder: b.displayOrder },
  });
  return NextResponse.json({ ok: true, id: created.id, message: "Position added." }, { status: 201 });
}
