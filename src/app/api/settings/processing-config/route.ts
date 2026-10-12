import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig, type ProcessingConfigData } from "@/lib/settings/processingConfig";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

async function writeRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await prisma.processingConfiguration.findFirst({ where: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } }))
    ?? prisma.processingConfiguration.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId, config: DEFAULT_PROCESSING_CONFIG as unknown as Prisma.InputJsonValue } });
}

// GET /api/settings/processing-config — Material Processing settings (Require 100% Output Allocation).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const sc = await settingScope(user);
  const row = await resolveScoped((where) => prisma.processingConfiguration.findFirst({ where }), sc);
  return NextResponse.json({ ok: true, config: mergeProcessingConfig(row?.config as unknown as Partial<ProcessingConfigData> | undefined) });
}

// PUT /api/settings/processing-config
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "manufacturing.processing-set", { req, entity: "Setting" });
  if (denied) return denied;

  let body: Partial<ProcessingConfigData>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const cur = await writeRow(user);
  const merged = mergeProcessingConfig(body);
  const row = await prisma.processingConfiguration.update({ where: { id: cur.id }, data: { config: merged as unknown as Prisma.InputJsonValue } });
  const sc = await settingScope(user);
  await writeAudit(prisma, user, { action: "settings.processing-config.save", entity: "Setting", entityId: "processing-config", summary: "Updated Processing Configuration", businessId: sc.businessId, branchId: sc.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Processing configuration saved.", config: mergeProcessingConfig(row.config as unknown as Partial<ProcessingConfigData>) });
}
