import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";
import { DEFAULT_SALES_CONFIG, type SalesConfigData } from "@/lib/settings/salesConfigDefaults";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

// Deep-merge a stored config onto the defaults so newly-added keys always exist.
function mergeConfig(stored: Partial<SalesConfigData> | null | undefined): SalesConfigData {
  const base = JSON.parse(JSON.stringify(DEFAULT_SALES_CONFIG)) as SalesConfigData;
  if (!stored) return base;
  base.fields = { ...base.fields, ...(stored.fields ?? {}) };
  base.flags = { ...base.flags, ...(stored.flags ?? {}) };
  const toggles = stored.toggles ?? {};
  for (const g of Object.keys(toggles)) base.toggles[g] = { ...(base.toggles[g] ?? {}), ...toggles[g] };
  return base;
}

// Effective config for the active scope (branch → business default → tenant default).
async function readRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await resolveScoped((where) => prisma.salesSetting.findFirst({ where }), sc))
    ?? prisma.salesSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: null, config: DEFAULT_SALES_CONFIG as unknown as Prisma.InputJsonValue } });
}
// The exact row for the active (business, branch) — created if missing (PUT target).
async function writeRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await prisma.salesSetting.findFirst({ where: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } }))
    ?? prisma.salesSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId, config: DEFAULT_SALES_CONFIG as unknown as Prisma.InputJsonValue } });
}

// GET /api/settings/sales — load this tenant's sales rule-engine config.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const row = await readRow(user);
  return NextResponse.json({ ok: true, config: mergeConfig(row.config as unknown as SalesConfigData) });
}

// PUT /api/settings/sales — save the { fields, toggles, flags } config.
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "settings.sales", { req, entity: "Setting" });
  if (denied) return denied;

  let body: Partial<SalesConfigData>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const cur = await writeRow(user);
  const merged = mergeConfig(body);
  const row = await prisma.salesSetting.update({
    where: { id: cur.id },
    data: { config: merged as unknown as Prisma.InputJsonValue },
  });
  const sc = await settingScope(user);
  await writeAudit(prisma, user, {
    action: "settings.sales.save", entity: "Setting", entityId: "sales",
    summary: "Updated Sales settings",
    businessId: sc.businessId, branchId: sc.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Sales settings saved.", config: mergeConfig(row.config as unknown as SalesConfigData) });
}
