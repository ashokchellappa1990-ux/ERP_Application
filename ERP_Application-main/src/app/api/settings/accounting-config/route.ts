import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";
import { DEFAULT_ACCOUNTING_CONFIG, mergeAccountingConfigData, type AccountingConfigData } from "@/lib/settings/accountingConfigDefaults";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

async function readRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await resolveScoped((where) => prisma.accountingConfiguration.findFirst({ where }), sc))
    ?? prisma.accountingConfiguration.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: null, config: DEFAULT_ACCOUNTING_CONFIG as unknown as Prisma.InputJsonValue } });
}
async function writeRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await prisma.accountingConfiguration.findFirst({ where: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } }))
    ?? prisma.accountingConfiguration.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId, config: DEFAULT_ACCOUNTING_CONFIG as unknown as Prisma.InputJsonValue } });
}

// GET /api/settings/accounting-config — load this tenant's Dispatch & Sales Accounting configuration.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const row = await readRow(user);
  return NextResponse.json({ ok: true, config: mergeAccountingConfigData(row.config as unknown as AccountingConfigData) });
}

// PUT /api/settings/accounting-config — save the { fields, flags, glMapping } config.
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "settings.accounting-config", { req, entity: "Setting" });
  if (denied) return denied;

  let body: Partial<AccountingConfigData>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const cur = await writeRow(user);
  const merged = mergeAccountingConfigData(body);
  const row = await prisma.accountingConfiguration.update({ where: { id: cur.id }, data: { config: merged as unknown as Prisma.InputJsonValue } });
  const sc = await settingScope(user);
  await writeAudit(prisma, user, {
    action: "settings.accounting-config.save", entity: "Setting", entityId: "accounting-config",
    summary: "Updated Dispatch & Sales Accounting configuration",
    businessId: sc.businessId, branchId: sc.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Accounting configuration saved.", config: mergeAccountingConfigData(row.config as unknown as AccountingConfigData) });
}
