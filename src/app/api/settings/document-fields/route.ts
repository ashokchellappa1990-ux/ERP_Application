import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import type { ScopeUser } from "@/lib/auth/scope";

export interface DocumentFieldConfigData {
  screens: Record<string, Record<string, { enabled: boolean; mandatory: boolean }>>;
  grn: Record<string, { enabled: boolean; mandatory: boolean }>;
  company: { gstEnabled: boolean; compositionScheme: boolean; showHsn: boolean; hsnMandatory: boolean };
}

const DEFAULT: DocumentFieldConfigData = { screens: {}, grn: {}, company: { gstEnabled: true, compositionScheme: false, showHsn: true, hsnMandatory: false } };

function mergeConfig(stored: Partial<DocumentFieldConfigData> | null | undefined): DocumentFieldConfigData {
  return {
    screens: { ...(stored?.screens ?? {}) },
    grn: { ...(stored?.grn ?? {}) },
    company: { ...DEFAULT.company, ...(stored?.company ?? {}) },
  };
}

async function readRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return resolveScoped((where) => prisma.documentFieldConfig.findFirst({ where }), sc);
}
async function writeRow(user: ScopeUser) {
  const sc = await settingScope(user);
  return (await prisma.documentFieldConfig.findFirst({ where: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId } }))
    ?? prisma.documentFieldConfig.create({ data: { tenantId: sc.tenantId, businessId: sc.businessId, branchId: sc.branchId, config: DEFAULT as unknown as Prisma.InputJsonValue } });
}

// GET /api/settings/document-fields — screen field settings + GRN + company GST flags.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const row = await readRow(user);
  return NextResponse.json({ ok: true, config: mergeConfig(row?.config as unknown as DocumentFieldConfigData | undefined) });
}

// PUT /api/settings/document-fields — save { screens, grn, company }.
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "settings.documents", { req, entity: "Setting" });
  if (denied) return denied;

  let body: Partial<DocumentFieldConfigData>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const cur = await writeRow(user);
  const merged = mergeConfig(body);
  const row = await prisma.documentFieldConfig.update({ where: { id: cur.id }, data: { config: merged as unknown as Prisma.InputJsonValue } });
  const sc = await settingScope(user);
  await writeAudit(prisma, user, {
    action: "settings.document-fields.save", entity: "Setting", entityId: "document-fields",
    summary: "Updated Document Field Settings",
    businessId: sc.businessId, branchId: sc.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Document field settings saved.", config: mergeConfig(row.config as unknown as DocumentFieldConfigData) });
}
