import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

async function readRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await resolveScoped((where) => prisma.qrCodeSetting.findFirst({ where }), sc))
    ?? prisma.qrCodeSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: null } });
}
async function writeRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await prisma.qrCodeSetting.findFirst({ where: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } }))
    ?? prisma.qrCodeSetting.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } });
}

// GET /api/settings/qr-code — load the QR configuration.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const s = await readRow(user);
  return NextResponse.json({ ok: true, settings: s });
}

const str = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v.trim() : fb);
const bool = (v: unknown) => !!v;
const int = (v: unknown, fb: number, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
};
const hex = (v: unknown, fb: string) => (/^#[0-9a-fA-F]{3,8}$/.test(String(v)) ? String(v) : fb);

// PUT /api/settings/qr-code — save the QR configuration.
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "settings.qr-code", { req, entity: "Setting" });
  if (denied) return denied;

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const cur = await writeRow(user);
  const ec = ["L", "M", "Q", "H"].includes(String(b.errorCorrection)) ? String(b.errorCorrection) : cur.errorCorrection;
  const style = ["square", "dots", "rounded"].includes(String(b.moduleStyle)) ? String(b.moduleStyle) : cur.moduleStyle;
  const mode = ["shared", "unique"].includes(String(b.defaultMode)) ? String(b.defaultMode) : cur.defaultMode;

  const settings = await prisma.qrCodeSetting.update({
    where: { id: cur.id },
    data: {
      prefix: str(b.prefix, cur.prefix).slice(0, 20),
      separator: str(b.separator, cur.separator).slice(0, 3),
      includeDocRef: bool(b.includeDocRef),
      includeProductCode: bool(b.includeProductCode),
      includeSequence: bool(b.includeSequence),
      sequenceLength: int(b.sequenceLength, cur.sequenceLength, 1, 10),
      errorCorrection: ec,
      darkColor: hex(b.darkColor, cur.darkColor),
      lightColor: hex(b.lightColor, cur.lightColor),
      moduleStyle: style,
      labelWidthMm: int(b.labelWidthMm, cur.labelWidthMm, 20, 150),
      labelHeightMm: int(b.labelHeightMm, cur.labelHeightMm, 15, 150),
      showName: bool(b.showName),
      showPrice: bool(b.showPrice),
      showCodeText: bool(b.showCodeText),
      defaultMode: mode,
    },
  });
  const sc = await settingScope(user);
  await writeAudit(prisma, user, {
    action: "settings.qr-code.save", entity: "Setting", entityId: "qr-code",
    summary: "Updated QR Code settings",
    businessId: sc.businessId, branchId: sc.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "QR settings saved.", settings });
}
