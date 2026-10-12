import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { LoyaltySettingSchema, type LoyaltySettingDTO } from "@/lib/contracts/loyalty";

const PERM = "loyalty.configuration";

// GET /api/loyalty/settings — global loyalty config + program options.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const setting = await prisma.loyaltySetting.findFirst({ where: { tenantId: user.tenantId, businessId: null, branchId: null } });
  const programs = await prisma.loyaltyProgram.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ priority: "desc" }, { id: "desc" }], select: { id: true, code: true, name: true, status: true } });
  const dto: LoyaltySettingDTO = { enabled: !!setting?.enabled, defaultProgramId: setting?.defaultProgramId ?? null, programs };
  return NextResponse.json({ ok: true, ...dto });
}

// PUT /api/loyalty/settings — enable/disable loyalty + set the default program.
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoyaltySetting" });
  if (denied) return denied;
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = LoyaltySettingSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  const existing = await prisma.loyaltySetting.findFirst({ where: { tenantId: user.tenantId, businessId: null, branchId: null } });
  if (existing) await prisma.loyaltySetting.update({ where: { id: existing.id }, data: { enabled: b.enabled, defaultProgramId: b.defaultProgramId ?? null } });
  else await prisma.loyaltySetting.create({ data: { tenantId: user.tenantId, businessId: null, branchId: null, enabled: b.enabled, defaultProgramId: b.defaultProgramId ?? null } });
  await writeAudit(prisma, user, { action: "loyalty.configure", entity: "LoyaltySetting", summary: `Loyalty ${b.enabled ? "enabled" : "disabled"}`, meta: { enabled: b.enabled, defaultProgramId: b.defaultProgramId ?? null }, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Loyalty configuration saved." });
}
