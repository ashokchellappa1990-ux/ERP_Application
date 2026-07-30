import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ReceiptConfigSchema } from "@/lib/contracts/receipt";
import { getConfig, saveConfig } from "@/lib/finance/receipt";

const PERM = "accounting.receipt-config";
const sc = async () => { const u = await getSessionUser(); return u ? { user: u, scope: await getActiveScope(u) } : null; };

export async function GET() {
  const ctx = await sc();
  if (!ctx) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const config = await getConfig({ tenantId: ctx.user.tenantId, businessId: ctx.scope.businessId ?? null });
  return NextResponse.json({ ok: true, config });
}

export async function PUT(req: Request) {
  const ctx = await sc();
  if (!ctx) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(ctx.user, PERM, { req, entity: "ReceiptConfiguration" });
  if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ReceiptConfigSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const config = await saveConfig({ tenantId: ctx.user.tenantId, businessId: ctx.scope.businessId ?? null }, parsed.data);
  await writeAudit(prisma, ctx.user, { action: "settings.receipt.save", entity: "ReceiptConfiguration", entityId: "receipt", summary: "Updated Receipt Configuration", businessId: ctx.scope.businessId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Receipt configuration saved.", config });
}
