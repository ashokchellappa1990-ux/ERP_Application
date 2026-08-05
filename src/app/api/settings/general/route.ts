import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { settingScope, readLookups } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

// Column ⇄ editor shape mapping.
const STRING_FIELDS = ["baseCurrency", "currencySymbol", "currencyPosition", "numberSystem", "thousandSeparator", "roundingMethod", "roundingPrecision", "dateFormat", "timeFormat", "timezone", "fiscalYearStart", "weekStart", "language"] as const;
const INT_FIELDS = ["amountDecimals", "qtyDecimals", "rateDecimals", "defaultPageSize", "sessionTimeout"] as const;
const FLAGS = ["enableRounding", "roundInPrint", "showCurrencyCode", "negativeInRed", "autoLogout", "confirmBeforeDelete", "compactDensity", "soundOnAction", "rptShowReceipt", "rptShowSales", "rptShowReturn", "rptShowDamage", "terminalSetupRequired", "showAiCopilot"] as const;

type Row = Record<string, unknown>;

function toConfig(row: Row) {
  const fields: Record<string, string> = {};
  for (const k of STRING_FIELDS) fields[k] = String(row[k] ?? "");
  for (const k of INT_FIELDS) fields[k] = String(row[k] ?? "");
  const flags: Record<string, boolean> = {};
  for (const k of FLAGS) flags[k] = !!row[k];
  return { fields, flags };
}

async function readRow(user: ScopeUser) {
  const sc = await settingScope(user);
  for (const w of readLookups(sc)) { const r = await prisma.generalSetting.findFirst({ where: w }); if (r) return r; }
  return prisma.generalSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: null } });
}
async function writeRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await prisma.generalSetting.findFirst({ where: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } }))
    ?? prisma.generalSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } });
}

// GET /api/settings/general — load this tenant's general settings.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const row = await readRow(user);
  return NextResponse.json({ ok: true, config: toConfig(row as Row) });
}

// PUT /api/settings/general — save settings (accepts the { fields, flags } editor shape).
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "settings.general", { req, entity: "Setting" });
  if (denied) return denied;

  let body: { fields?: Record<string, unknown>; flags?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const cur = await writeRow(user);
  const f = body.fields ?? {};
  const fl = body.flags ?? {};
  const data: Prisma.GeneralSettingUncheckedUpdateInput = {};
  for (const k of STRING_FIELDS) if (f[k] != null && String(f[k]).trim() !== "") data[k] = String(f[k]).slice(0, 40);
  for (const k of INT_FIELDS) { const v = Math.round(Number(f[k])); if (Number.isFinite(v)) data[k] = Math.max(0, v); }
  for (const k of FLAGS) if (fl[k] != null) data[k] = !!fl[k];

  const row = await prisma.generalSetting.update({ where: { id: cur.id }, data });
  const sc = await settingScope(user);
  await writeAudit(prisma, user, {
    action: "settings.general.save", entity: "Setting", entityId: "general",
    summary: "Updated General settings",
    businessId: sc.businessId, branchId: sc.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "General settings saved.", config: toConfig(row as Row) });
}
