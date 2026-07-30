import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ReceiptCategorySchema } from "@/lib/contracts/receipt";
import { listCategories, createCategory, listAccounts } from "@/lib/finance/receipt";

const PERM = "accounting.receipt-config";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const scope = await getActiveScope(user);
  const s = { tenantId: user.tenantId, businessId: scope.businessId ?? null };
  const [categories, accounts] = await Promise.all([listCategories(s), listAccounts(s)]);
  return NextResponse.json({ ok: true, categories, accounts });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ReceiptCategory" });
  if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ReceiptCategorySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const scope = await getActiveScope(user);
  const id = await createCategory({ tenantId: user.tenantId, businessId: scope.businessId ?? null }, parsed.data);
  await writeAudit(prisma, user, { action: "settings.receipt.category.create", entity: "ReceiptCategory", entityId: id, summary: `Added receipt category ${parsed.data.name}`, businessId: scope.businessId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Category saved.", id }, { status: 201 });
}
