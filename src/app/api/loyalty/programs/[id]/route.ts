import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { toProgramData, toProgramDetail } from "@/lib/loyalty/programData";
import { LoyaltyProgramSchema } from "@/lib/contracts/loyalty";

const PERM = "loyalty.program";

// GET /api/loyalty/programs/[id] — full program detail.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const p = await prisma.loyaltyProgram.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!p) return NextResponse.json({ ok: false, message: "Loyalty program not found." }, { status: 404 });
  return NextResponse.json({ ok: true, program: toProgramDetail(p) });
}

// PUT /api/loyalty/programs/[id] — update a program.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.loyaltyProgram.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, code: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Loyalty program not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoyaltyProgram", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = LoyaltyProgramSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  await prisma.loyaltyProgram.update({ where: { id }, data: toProgramData(parsed.data as Record<string, unknown>) });
  await writeAudit(prisma, user, { action: "loyalty_program.update", entity: "LoyaltyProgram", entityId: id, summary: `Updated loyalty program ${existing.code}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Loyalty program updated." });
}
