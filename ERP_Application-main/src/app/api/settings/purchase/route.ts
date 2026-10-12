import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";
import { DEFAULT_PURCHASE_INVOICE_CONFIG, type PurchaseConfigData } from "@/lib/settings/purchaseConfigDefaults";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

// Deep-merge a stored config onto the defaults so newly-added keys always exist.
function mergeConfig(stored: Partial<PurchaseConfigData> | null | undefined): PurchaseConfigData {
  const base = JSON.parse(JSON.stringify(DEFAULT_PURCHASE_INVOICE_CONFIG)) as PurchaseConfigData;
  if (!stored) return base;
  base.fields = { ...base.fields, ...(stored.fields ?? {}) };
  base.flags = { ...base.flags, ...(stored.flags ?? {}) };
  return base;
}

async function readRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await resolveScoped((where) => prisma.purchaseSetting.findFirst({ where }), sc))
    ?? prisma.purchaseSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: null, config: DEFAULT_PURCHASE_INVOICE_CONFIG as unknown as Prisma.InputJsonValue } });
}
async function writeRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await prisma.purchaseSetting.findFirst({ where: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } }))
    ?? prisma.purchaseSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId, config: DEFAULT_PURCHASE_INVOICE_CONFIG as unknown as Prisma.InputJsonValue } });
}

// GET /api/settings/purchase — load this tenant's purchase configuration.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const row = await readRow(user);
  return NextResponse.json({ ok: true, config: mergeConfig(row.config as unknown as PurchaseConfigData) });
}

// PUT /api/settings/purchase — save the { fields, flags } config.
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "settings.purchase", { req, entity: "Setting" });
  if (denied) return denied;

  let body: Partial<PurchaseConfigData>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const cur = await writeRow(user);
  const merged = mergeConfig(body);
  const row = await prisma.purchaseSetting.update({ where: { id: cur.id }, data: { config: merged as unknown as Prisma.InputJsonValue } });
  const sc = await settingScope(user);
  await writeAudit(prisma, user, {
    action: "settings.purchase.save", entity: "Setting", entityId: "purchase",
    summary: "Updated Purchase Configuration",
    businessId: sc.businessId, branchId: sc.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Purchase configuration saved.", config: mergeConfig(row.config as unknown as PurchaseConfigData) });
}
