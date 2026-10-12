import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";
import { DEFAULT_POS_CONFIG, mergePosConfig, type PosConfigState } from "@/lib/settings/posConfigStore";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

async function readRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await resolveScoped((where) => prisma.posSetting.findFirst({ where }), sc))
    ?? prisma.posSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: null, config: DEFAULT_POS_CONFIG as unknown as Prisma.InputJsonValue } });
}
async function writeRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await prisma.posSetting.findFirst({ where: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } }))
    ?? prisma.posSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId, config: DEFAULT_POS_CONFIG as unknown as Prisma.InputJsonValue } });
}

// GET /api/settings/pos — load this tenant's POS configuration.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const row = await readRow(user);
  return NextResponse.json({ ok: true, config: mergePosConfig(row.config as unknown as PosConfigState) });
}

// PUT /api/settings/pos — save the POS configuration.
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  // POS configuration is edited as a tab on the General Settings screen; the old
  // "settings.pos-terminal" menu/key was retired, so gate on settings.general.
  const denied = await requirePermission(user, "settings.general", { req, entity: "Setting" });
  if (denied) return denied;

  let body: Partial<PosConfigState>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const cur = await writeRow(user);
  const merged = mergePosConfig(body);
  const row = await prisma.posSetting.update({
    where: { id: cur.id },
    data: { config: merged as unknown as Prisma.InputJsonValue },
  });
  const sc = await settingScope(user);
  await writeAudit(prisma, user, {
    action: "settings.pos.save", entity: "Setting", entityId: "pos",
    summary: "Updated POS settings",
    businessId: sc.businessId, branchId: sc.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "POS configuration saved.", config: mergePosConfig(row.config as unknown as PosConfigState) });
}
