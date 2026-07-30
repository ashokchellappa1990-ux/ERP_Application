import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { settingScope, readLookups } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

const HEX = /^#?[0-9a-fA-F]{3,8}$/;
const cleanColor = (v: unknown) => { const s = String(v ?? "").trim(); if (!s) return null; return HEX.test(s) ? (s.startsWith("#") ? s : `#${s}`).slice(0, 9) : null; };

// Effective theme for the active scope (branch → business default → tenant default).
async function readRow(user: ScopeUser) {
  const sc = await settingScope(user);
  for (const w of readLookups(sc)) { const r = await prisma.themeSetting.findFirst({ where: w }); if (r) return r; }
  return prisma.themeSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: null } });
}
// The exact row for the active (business, branch) — created if missing (PUT target).
async function writeRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await prisma.themeSetting.findFirst({ where: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } }))
    ?? prisma.themeSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } });
}
function toJson(row: { theme: string; density: string; primaryColor: string | null; secondaryColor: string | null; accentColor: string | null; fontFamily: string | null; buttonStyle: string; gradientFrom: string | null; gradientTo: string | null; gradientAngle: number }) {
  return {
    theme: row.theme, density: row.density,
    primaryColor: row.primaryColor ?? "", secondaryColor: row.secondaryColor ?? "", accentColor: row.accentColor ?? "", fontFamily: row.fontFamily ?? "",
    buttonStyle: row.buttonStyle, gradientFrom: row.gradientFrom ?? "", gradientTo: row.gradientTo ?? "", gradientAngle: row.gradientAngle,
  };
}

// GET /api/settings/theme — this tenant's application theme.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const row = await readRow(user);
  return NextResponse.json({ ok: true, theme: toJson(row) });
}

// PUT /api/settings/theme — save the application theme + brand colour overrides.
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "settings.theme", { req, entity: "Setting" });
  if (denied) return denied;

  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const cur = await writeRow(user);
  const data: Prisma.ThemeSettingUncheckedUpdateInput = {};
  if (typeof b.theme === "string" && b.theme.trim()) data.theme = b.theme.trim().slice(0, 30);
  if (b.density === "comfortable" || b.density === "touch") data.density = b.density;
  if ("primaryColor" in b) data.primaryColor = cleanColor(b.primaryColor);
  if ("secondaryColor" in b) data.secondaryColor = cleanColor(b.secondaryColor);
  if ("accentColor" in b) data.accentColor = cleanColor(b.accentColor);
  if ("fontFamily" in b) data.fontFamily = b.fontFamily ? String(b.fontFamily).slice(0, 80) : null;
  if (b.buttonStyle === "solid" || b.buttonStyle === "gradient") data.buttonStyle = b.buttonStyle;
  if ("gradientFrom" in b) data.gradientFrom = cleanColor(b.gradientFrom);
  if ("gradientTo" in b) data.gradientTo = cleanColor(b.gradientTo);
  if ("gradientAngle" in b) { const a = Math.round(Number(b.gradientAngle)); if (Number.isFinite(a)) data.gradientAngle = Math.max(0, Math.min(360, a)); }

  const row = await prisma.themeSetting.update({ where: { id: cur.id }, data });
  const sc = await settingScope(user);
  await writeAudit(prisma, user, {
    action: "settings.theme.save", entity: "Setting", entityId: "theme",
    summary: "Updated Theme settings",
    businessId: sc.businessId, branchId: sc.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Theme saved.", theme: toJson(row) });
}
